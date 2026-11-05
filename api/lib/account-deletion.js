import { query } from '../db.js';
import { deleteEvidenceFiles } from './evidence-files.js';

// Statuses in which a Stripe subscription can never produce another charge.
const TERMINAL_STRIPE_STATUSES = new Set(['canceled', 'incomplete_expired']);

// Cancel one Stripe subscription ahead of an account deletion.
//
// Returns { action, status } and never throws for the two benign cases:
//   - the row has no stripe_subscription_id (nothing was ever bought)
//   - Stripe says the subscription does not exist / is already canceled
// Any other Stripe failure throws, so the caller can abort *before* deleting
// anything. A user who deletes their account must never be billed again, so we
// refuse to finish the deletion when we cannot confirm the cancellation.
export async function cancelSubscriptionForDeletion(stripe, subscriptionRow) {
  const subscriptionId = subscriptionRow?.stripe_subscription_id;
  if (!subscriptionId) {
    return { action: 'skipped', reason: 'no stripe_subscription_id' };
  }

  let current;
  try {
    current = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    if (error?.code === 'resource_missing' || error?.statusCode === 404) {
      return { action: 'skipped', status: 'not_found_in_stripe', subscription_id: subscriptionId };
    }
    throw withStripeContext(error, subscriptionId, 'retrieve');
  }

  if (TERMINAL_STRIPE_STATUSES.has(current.status)) {
    return { action: 'skipped', status: current.status, subscription_id: subscriptionId };
  }

  try {
    const canceled = await stripe.subscriptions.cancel(subscriptionId);
    return { action: 'canceled', status: canceled.status, subscription_id: subscriptionId };
  } catch (error) {
    if (error?.code === 'resource_missing' || error?.statusCode === 404) {
      return { action: 'skipped', status: 'not_found_in_stripe', subscription_id: subscriptionId };
    }
    throw withStripeContext(error, subscriptionId, 'cancel');
  }
}

function withStripeContext(error, subscriptionId, operation) {
  const wrapped = new Error(
    `Stripe ${operation} failed for subscription ${subscriptionId}: ${error?.message ?? error}`
  );
  wrapped.stage = 'stripe_cancel';
  wrapped.stripeError = error;
  return wrapped;
}

function scalar(sql, params) {
  const rows = query(sql, params);
  if (!rows || rows.length === 0) return 0;
  const value = Object.values(rows[0])[0];
  return Number(value ?? 0);
}

// Permanently delete one account: Stripe subscription first, then the evidence
// files on disk, then every database row, with the users row last.
//
// Deletion is IMMEDIATE — nothing is queued and nothing depends on a job that
// may never run. The order is deliberate and makes a partial failure recoverable:
//
//  1. Stripe   — a failure here aborts before anything is deleted, so the account
//                is untouched and the user can retry.
//  2. Files    — deleted before the rows that point at them, so we never lose the
//                only record of a file that is still on disk. Unlinking is
//                idempotent, so a retry simply finds them already gone.
//  3. Rows     — children before parents. The users row is deleted LAST, so if a
//                row delete fails partway the account still exists, the token
//                still authenticates, and the same endpoint can be called again.
//
// team-db runs one statement per call (no transactions available), so a failure
// is reported honestly with the stage that failed rather than swallowed.
export async function deleteAccount({ userId, stripe }) {
  const users = query('SELECT id, email FROM users WHERE id = ?', [userId]);
  if (users.length === 0) return { status: 'not_found' };
  const user = users[0];

  // 1. Billing. Throws on an unconfirmable cancellation -> nothing deleted yet.
  const subscriptionRows = query(
    'SELECT id, stripe_subscription_id, status FROM subscriptions WHERE user_id = ?',
    [userId]
  );
  const billing = [];
  for (const row of subscriptionRows) {
    billing.push(await cancelSubscriptionForDeletion(stripe, row));
  }

  // 2. Evidence files on disk.
  const evidenceRows = query(
    `SELECT ef.file_path FROM evidence_files ef
       JOIN entries e ON e.id = ef.entry_id
      WHERE e.user_id = ?`,
    [userId]
  );
  const files = await deleteEvidenceFiles(evidenceRows.map((row) => row.file_path));

  if (files.failed.length > 0) {
    return { status: 'file_delete_failed', user, billing, files };
  }

  // 3. Rows, children first, users last.
  const counts = {
    savid_conversations: scalar(
      'SELECT COUNT(*) AS n FROM savid_conversations WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ?)',
      [userId]
    ),
    edits: scalar(
      'SELECT COUNT(*) AS n FROM edits WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ?)',
      [userId]
    ),
    evidence_files: scalar(
      'SELECT COUNT(*) AS n FROM evidence_files WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ?)',
      [userId]
    ),
    entries: scalar('SELECT COUNT(*) AS n FROM entries WHERE user_id = ?', [userId]),
    subscriptions: scalar('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ?', [userId]),
    users: 1
  };

  const statements = [
    ['savid_conversations', 'DELETE FROM savid_conversations WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ?)', [userId]],
    ['edits', 'DELETE FROM edits WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ?)', [userId]],
    ['evidence_files', 'DELETE FROM evidence_files WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ?)', [userId]],
    ['entries', 'DELETE FROM entries WHERE user_id = ?', [userId]],
    ['subscriptions', 'DELETE FROM subscriptions WHERE user_id = ?', [userId]],
    ['users', 'DELETE FROM users WHERE id = ?', [userId]]
  ];

  const completed = [];
  for (const [stage, sql, params] of statements) {
    try {
      query(sql, params);
      completed.push(stage);
    } catch (error) {
      const failure = new Error(`Account deletion failed while deleting ${stage}: ${error.message}`);
      failure.stage = stage;
      failure.completed = completed;
      failure.files = files;
      failure.billing = billing;
      failure.partial = true;
      throw failure;
    }
  }

  return { status: 'deleted', user, billing, files, deleted: counts };
}
