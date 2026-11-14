import express from 'express';
const router = express.Router();
import Stripe from 'stripe';
import auth from '../middleware/auth.js';
import { deleteAccount } from '../lib/account-deletion.js';
import { revokeToken, revokeAllForUser } from '../lib/session.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.use(auth);

// Delete the calling user's account — permanently and immediately.
//
// The account acted on is always the one the bearer token belongs to; there is no
// id in the URL or body, so one user can never delete another user's account.
// What goes: the Stripe subscription (canceled first, so no further billing), all
// evidence files on disk, savid_conversations, edits, evidence_files, entries, the
// subscriptions row, and finally the users row.
router.delete('/', async (req, res) => {
  const userId = req.userId;

  try {
    const result = await deleteAccount({ userId, stripe });

    if (result.status === 'not_found') {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (result.status === 'file_delete_failed') {
      // Files first, rows second: if a file could not be removed we have deleted
      // nothing else and say so, rather than reporting a deletion that left data.
      return res.status(500).json({
        error: 'Could not delete all evidence files. Nothing else was deleted — please retry.',
        files_failed: result.files.failed,
        billing: result.billing
      });
    }

    console.log(`Account deleted: ${result.user.id} (${result.user.email})`);

    // The account is gone; its sessions must go with it. The token that made this
    // request is revoked through the same path sign-out uses, and a single
    // user-wide revocation row ends every other session the account holds — a
    // second device, an old tab — so no token outlives the data it was a key to.
    // Deletion has already happened at this point, so a revocation failure is
    // logged rather than reported as a failed deletion: retrying the delete would
    // only find the account missing.
    try {
      revokeToken({ jti: req.tokenId, userId, exp: req.tokenExp });
      revokeAllForUser(userId);
    } catch (revokeError) {
      console.error('Account deleted but session revocation failed:', revokeError.message, {
        userId
      });
    }

    return res.json({
      message: 'Account deleted',
      deleted: result.deleted,
      files: {
        deleted: result.files.deleted.length,
        already_missing: result.files.missing.length,
        skipped: result.files.skipped
      },
      billing: result.billing
    });
  } catch (error) {
    console.error('Account deletion error:', error);

    if (error.stage === 'stripe_cancel') {
      // Nothing was deleted — the account is intact and can be retried.
      return res.status(502).json({
        error: 'Could not cancel your subscription with our payment provider, so your account was not deleted. Nothing has been removed — please try again.',
        stage: 'stripe_cancel'
      });
    }

    if (error.partial) {
      return res.status(500).json({
        error: `Account deletion stopped partway (while deleting ${error.stage}). Your account still exists — please retry; the remaining steps are safe to repeat.`,
        stage: error.stage,
        completed: error.completed
      });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
