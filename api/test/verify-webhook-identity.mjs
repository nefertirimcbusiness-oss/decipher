// Proves the Stripe webhook identifies the account from the reference stamped on
// the checkout session, NOT from the payer-editable email address.
//
// The attack this closes: a payer types someone else's email at checkout. Before,
// `checkout.session.completed` looked the user up by `customer_details.email`, so
// paying with a victim's address wrote a subscription onto the victim's account.
//
// The events are signed with the real STRIPE_WEBHOOK_SECRET and posted to the
// PUBLIC url (BASE_URL), so this exercises the deployed route, not a local copy.
//
// The handler calls stripe.subscriptions.retrieve(subscription) with the key the
// API is running with. To keep the proof end-to-end without a real charge, the API
// must be running with the TEST key for the duration; the script creates a real
// test-mode subscription so the retrieve succeeds and the DB write is genuine.
//
//   BASE_URL=https://<public host> STRIPE_SECRET_KEY=$STRIPE_TEST_SECRET_KEY node index.js   (API side)
//   node test/verify-webhook-identity.mjs
import 'dotenv/config';
import Stripe from 'stripe';
import crypto from 'crypto';
import { query, execute, close } from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const BASE = process.env.BASE_URL || 'https://eb044699c4cc4dada8cc7727a5002ea2.cto.site';
const HOOK = `${BASE}/api/webhooks/stripe`;
const secret = process.env.STRIPE_WEBHOOK_SECRET;
const test = new Stripe(process.env.STRIPE_TEST_SECRET_KEY);

if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
if (!process.env.STRIPE_TEST_SECRET_KEY) throw new Error('STRIPE_TEST_SECRET_KEY is not set');

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

function sign(payload) {
  const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return `t=${t},v1=${sig}`;
}

async function post(event) {
  const payload = JSON.stringify(event);
  const res = await fetch(HOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': sign(payload) },
    body: payload,
  });
  return { status: res.status, body: await res.text() };
}

const ts = Date.now();
const emailA = `wh-victim-${ts}@example.com`;
const emailB = `wh-payer-${ts}@example.com`;
const userA = uuidv4();
const userB = uuidv4();
const hash = await bcrypt.hash('not-a-real-password-' + ts, 4);

let product, price, sub1, sub2;
const subscriptionIds = [];

try {
  execute('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userA, emailA, hash]);
  execute('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userB, emailB, hash]);
  const before = (id) => query('SELECT subscription_status FROM users WHERE id = ?', [id])[0]?.subscription_status;

  console.log(`A (email only, must stay untouched): ${emailA}`);
  console.log(`B (referenced account):              ${emailB}`);
  console.log(`before: A=${before(userA)} B=${before(userB)}`);

  product = await test.products.create({ name: 'Decipher webhook identity probe' });
  price = await test.prices.create({ currency: 'usd', unit_amount: 2499, recurring: { interval: 'month' }, product: product.id });
  const customer = await test.customers.create({ email: emailA });
  sub1 = await test.subscriptions.create({
    customer: customer.id, items: [{ price: price.id }], trial_period_days: 7, payment_behavior: 'default_incomplete',
  });
  subscriptionIds.push(sub1.id);

  // ---- 1. the attack: payer email = A, reference = B -------------------------
  const attack = {
    id: 'evt_identity_' + ts, object: 'event', api_version: '2026-07-29.dahlia',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_identity_' + ts, object: 'checkout.session', mode: 'subscription',
        client_reference_id: userB,
        metadata: { user_id: userB },
        customer: customer.id,
        customer_email: emailA,
        customer_details: { email: emailA },
        subscription: sub1.id,
        status: 'complete',
      },
    },
  };
  const r1 = await post(attack);
  check('signed event with A\'s email + B\'s reference is accepted', r1.status === 200, `HTTP ${r1.status} ${r1.body}`);

  const rowsB = query('SELECT user_id, status FROM subscriptions WHERE stripe_subscription_id = ?', [sub1.id]);
  check('B received the subscription', rowsB.length === 1 && rowsB[0].user_id === userB, JSON.stringify(rowsB));
  check('B\'s account is activated', before(userB) === sub1.status, `subscription_status=${before(userB)} (stripe=${sub1.status})`);

  const rowsA = query('SELECT id FROM subscriptions WHERE user_id = ?', [userA]);
  check('A has no subscription row', rowsA.length === 0, `${rowsA.length} rows`);
  check('A\'s account is untouched', before(userA) === 'inactive', `subscription_status=${before(userA)}`);

  // ---- 2. no reference at all: must be ignored, never email-matched ----------
  sub2 = await test.subscriptions.create({
    customer: customer.id, items: [{ price: price.id }], trial_period_days: 7, payment_behavior: 'default_incomplete',
  });
  subscriptionIds.push(sub2.id);

  const noRef = {
    id: 'evt_noref_' + ts, object: 'event', api_version: '2026-07-29.dahlia',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_noref_' + ts, object: 'checkout.session', mode: 'subscription',
        customer: customer.id,
        customer_email: emailA,
        customer_details: { email: emailA },
        subscription: sub2.id,
        status: 'complete',
      },
    },
  };
  const r2 = await post(noRef);
  check('event with no reference is acknowledged, not errored', r2.status === 200, `HTTP ${r2.status} ${r2.body}`);

  const rowsNoRef = query('SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?', [sub2.id]);
  check('no-reference event wrote no subscription', rowsNoRef.length === 0, `${rowsNoRef.length} rows`);
  check('no-reference event left A untouched', before(userA) === 'inactive', `subscription_status=${before(userA)}`);
} finally {
  // cleanup: DB rows, then the Stripe test objects
  for (const id of [userA, userB]) {
    execute('DELETE FROM subscriptions WHERE user_id = ?', [id]);
    execute('DELETE FROM users WHERE id = ?', [id]);
  }
  for (const id of subscriptionIds) {
    try { await test.subscriptions.cancel(id); } catch {}
  }
  if (price) { try { await test.prices.update(price.id, { active: false }); } catch {} }
  if (product) { try { await test.products.update(product.id, { active: false }); } catch {} }
  const left = query('SELECT COUNT(*) AS n FROM users WHERE id IN (?, ?)', [userA, userB])[0].n;
  console.log(`cleanup: users left = ${left}, test subscriptions cancelled`);
  close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
