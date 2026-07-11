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
import { initializeDatabase } from './init-db.js';

const app = express();
const PORT = 8000;

initializeDatabase();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/savid', savidRoutes);

app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
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
          subscription.current_period_end,
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
      `, [subscription.status, subscription.current_period_end, subscription.trial_end, subscriptionId]);

      const subs = query('SELECT user_id FROM subscriptions WHERE stripe_subscription_id = ?', [subscriptionId]);
      if (subs.length > 0) {
        query('UPDATE users SET subscription_status = ? WHERE id = ?', [subscription.status, subs[0].user_id]);
      }
      break;
    }
  }

  res.json({ received: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
