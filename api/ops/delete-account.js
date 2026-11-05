#!/usr/bin/env node
// Ops CLI: permanently delete one account from the command line.
//
// This is the path for the privacy policy's email-a-deletion-request promise
// (section 11): a human runs this for the account in the request. It uses exactly
// the same routine as DELETE /api/account — Stripe cancellation, evidence files on
// disk, then every database row, users last.
//
// Usage:
//   node ops/delete-account.js --email user@example.com --confirm
//   node ops/delete-account.js --user-id <uuid> --confirm
//
// Without --confirm it only reports what it would delete.
import 'dotenv/config';
import Stripe from 'stripe';
import { query } from '../db.js';
import { deleteAccount } from '../lib/account-deletion.js';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};
const confirmed = args.includes('--confirm');

const email = flag('email');
const userId = flag('user-id');

if (!email && !userId) {
  console.error('Usage: node ops/delete-account.js (--email <email> | --user-id <uuid>) --confirm');
  process.exit(2);
}

const users = email
  ? query('SELECT id, email FROM users WHERE email = ?', [email])
  : query('SELECT id, email FROM users WHERE id = ?', [userId]);

if (users.length === 0) {
  console.error('No such user.');
  process.exit(1);
}

const user = users[0];

if (!confirmed) {
  const counts = {
    entries: query('SELECT COUNT(*) AS n FROM entries WHERE user_id = ?', [user.id])[0]?.n ?? 0,
    evidence_files: query(
      'SELECT COUNT(*) AS n FROM evidence_files WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ?)',
      [user.id]
    )[0]?.n ?? 0,
    subscriptions: query('SELECT COUNT(*) AS n FROM subscriptions WHERE user_id = ?', [user.id])[0]?.n ?? 0
  };
  console.log(JSON.stringify({ dry_run: true, user, would_delete: counts }, null, 2));
  console.log('Re-run with --confirm to delete.');
  process.exit(0);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

try {
  const result = await deleteAccount({ userId: user.id, stripe });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === 'deleted' ? 0 : 1);
} catch (error) {
  console.error(JSON.stringify({
    status: 'failed',
    stage: error.stage ?? null,
    completed: error.completed ?? null,
    message: error.message
  }, null, 2));
  process.exit(1);
}
