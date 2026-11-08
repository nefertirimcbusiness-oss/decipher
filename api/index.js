import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import authRoutes from './routes/auth.js';
import entryRoutes from './routes/entries.js';
import subscriptionRoutes from './routes/subscriptions.js';
import savidRoutes from './routes/savid.js';
import accountRoutes from './routes/account.js';
import exportRoutes from './routes/export.js';
import { initializeDatabase } from './init-db.js';

const app = express();
const PORT = 8000;

initializeDatabase();

// The export endpoint answers with `Content-Disposition` so a browser saves the
// bundle under a sensible name. Cross-origin callers can only read that header if
// it is explicitly exposed, so it is listed here; the client falls back to a name
// of its own if the header is missing.
app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(morgan('dev'));
// Store raw body for Stripe webhook verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/savid', savidRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Stripe moved `current_period_end` off the subscription object and onto each
// subscription item in API version 2025-03-31 (the installed SDK defaults to
// 2026-07-29.dahlia). Reading only the top-level field yields `undefined`, which
// silently writes NULL to subscriptions.current_period_end. Prefer the item value,
// fall back to the legacy top-level field, and give up with NULL if neither exists.
function subscriptionPeriodEnd(subscription) {
  return subscription?.items?.data?.[0]?.current_period_end
    ?? subscription?.current_period_end
    ?? null;
}

app.post('/api/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { query } = await import('./db.js');
    const { v4: uuidv4 } = await import('uuid');

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const subscriptionId = session.subscription;
        const customerEmail = session.customer_details.email;

        // Find user by email
        const users = query('SELECT id FROM users WHERE email = ?', [customerEmail]);
        if (users.length > 0) {
          const userId = users[0].id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);

          const subId = uuidv4();
          query(`
            INSERT INTO subscriptions (id, user_id, stripe_subscription_id, status, plan_id, current_period_end, trial_end)
            VALUES (?, ?, ?, ?, ?, datetime(?, 'unixepoch'), datetime(?, 'unixepoch'))
            ON CONFLICT(stripe_subscription_id) DO UPDATE SET
              status = excluded.status,
              current_period_end = excluded.current_period_end,
              trial_end = excluded.trial_end
          `, [
            subId, userId, subscriptionId, subscription.status,
            subscription.items.data[0].price.id,
            subscriptionPeriodEnd(subscription),
            subscription.trial_end
          ]);

          query('UPDATE users SET subscription_status = ? WHERE id = ?', [subscription.status, userId]);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const subscriptionId = subscription.id;

        query(`
          UPDATE subscriptions SET status = ?, current_period_end = datetime(?, 'unixepoch'), trial_end = datetime(?, 'unixepoch')
          WHERE stripe_subscription_id = ?
        `, [subscription.status, subscriptionPeriodEnd(subscription), subscription.trial_end, subscriptionId]);

        const subs = query('SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?', [subscriptionId]);
        if (subs.length > 0) {
          query('UPDATE users SET subscription_status = ? WHERE id = ?', [subscription.status, subs[0].user_id]);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Processing Error: ${err.message}`);
    return res.status(500).send(`Processing Error: ${err.message}`);
  }

  res.json({ received: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
