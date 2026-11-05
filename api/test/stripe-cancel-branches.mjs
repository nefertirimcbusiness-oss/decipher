#!/usr/bin/env node
// Unit-level proof of the Stripe cancellation branches used by account deletion.
// Runs against fake Stripe clients (no network, no real subscription), so every
// branch — including the failure branches — is actually executed.
import { cancelSubscriptionForDeletion } from '../lib/account-deletion.js';

let failures = 0;
function check(label, ok, detail = '') {
  if (ok) console.log(`PASS  ${label}${detail ? ' — ' + detail : ''}`);
  else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? ' — ' + detail : ''}`);
  }
}

const calls = [];
function fakeStripe({ retrieve, cancel }) {
  return {
    subscriptions: {
      async retrieve(id) {
        calls.push(['retrieve', id]);
        return retrieve(id);
      },
      async cancel(id) {
        calls.push(['cancel', id]);
        return cancel(id);
      }
    }
  };
}

// 1. live subscription -> canceled
calls.length = 0;
let r = await cancelSubscriptionForDeletion(
  fakeStripe({ retrieve: () => ({ id: 'sub_1', status: 'active' }), cancel: () => ({ id: 'sub_1', status: 'canceled' }) }),
  { stripe_subscription_id: 'sub_1' }
);
check('active subscription is canceled', r.action === 'canceled' && r.status === 'canceled', JSON.stringify(r));
check('  ...cancel was actually called', calls.some(([op]) => op === 'cancel'));

// 2. trialing subscription (the 7-day trial case) -> canceled
calls.length = 0;
r = await cancelSubscriptionForDeletion(
  fakeStripe({ retrieve: () => ({ id: 'sub_2', status: 'trialing' }), cancel: () => ({ id: 'sub_2', status: 'canceled' }) }),
  { stripe_subscription_id: 'sub_2' }
);
check('trialing subscription is canceled', r.action === 'canceled', JSON.stringify(r));

// 3. already canceled -> no second cancel call
calls.length = 0;
r = await cancelSubscriptionForDeletion(
  fakeStripe({ retrieve: () => ({ id: 'sub_3', status: 'canceled' }), cancel: () => { throw new Error('should not be called'); } }),
  { stripe_subscription_id: 'sub_3' }
);
check('already-canceled subscription is left alone', r.action === 'skipped' && r.status === 'canceled', JSON.stringify(r));
check('  ...cancel was NOT called', !calls.some(([op]) => op === 'cancel'));

// 4. subscription does not exist in Stripe -> benign skip
r = await cancelSubscriptionForDeletion(
  fakeStripe({ retrieve: () => { const e = new Error('No such subscription'); e.code = 'resource_missing'; throw e; }, cancel: () => ({}) }),
  { stripe_subscription_id: 'sub_4' }
);
check('missing subscription is a benign skip', r.action === 'skipped', JSON.stringify(r));

// 5. no stripe id at all -> skip without calling Stripe
calls.length = 0;
r = await cancelSubscriptionForDeletion(
  fakeStripe({ retrieve: () => { throw new Error('should not be called'); }, cancel: () => { throw new Error('should not be called'); } }),
  { stripe_subscription_id: null }
);
check('no stripe_subscription_id -> skipped, Stripe untouched', r.action === 'skipped' && calls.length === 0, JSON.stringify(r));

// 6. Stripe failure on retrieve -> throws (so the account is NOT deleted)
let threw = null;
try {
  await cancelSubscriptionForDeletion(
    fakeStripe({ retrieve: () => { const e = new Error('Stripe is down'); e.statusCode = 500; throw e; }, cancel: () => ({}) }),
    { stripe_subscription_id: 'sub_6' }
  );
} catch (error) {
  threw = error;
}
check('Stripe error on retrieve aborts deletion', threw !== null && threw.stage === 'stripe_cancel', threw?.message);

// 7. Stripe failure on cancel -> throws
threw = null;
try {
  await cancelSubscriptionForDeletion(
    fakeStripe({
      retrieve: () => ({ id: 'sub_7', status: 'active' }),
      cancel: () => { const e = new Error('card network unavailable'); e.statusCode = 502; throw e; }
    }),
    { stripe_subscription_id: 'sub_7' }
  );
} catch (error) {
  threw = error;
}
check('Stripe error on cancel aborts deletion', threw !== null && threw.stage === 'stripe_cancel', threw?.message);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
