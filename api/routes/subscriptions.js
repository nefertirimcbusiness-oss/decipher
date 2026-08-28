import express from 'express';
const router = express.Router();
import Stripe from 'stripe';
import { query } from '../db.js';
import auth from '../middleware/auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.use(auth);

router.post('/create', async (req, res) => {
  const userId = req.userId;
  try {
    const users = query('SELECT * FROM users WHERE id = ?', [userId]);
    const user = users[0];

    const priceId = process.env.STRIPE_PRICE_ID; 
    const couponId = process.env.STRIPE_COUPON_ID;

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: 'subscription',
      discounts: couponId ? [{
        coupon: couponId,
      }] : [],
      subscription_data: {
        trial_period_days: 7,
      },
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
    });

    res.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status', async (req, res) => {
  const userId = req.userId;
  try {
    const subs = query('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);
    res.json(subs[0] || { status: 'inactive' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/cancel', async (req, res) => {
  const userId = req.userId;
  try {
    const subs = query('SELECT stripe_subscription_id FROM subscriptions WHERE user_id = ? AND status != ?', [userId, 'canceled']);
    if (subs.length === 0 || !subs[0].stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const subscriptionId = subs[0].stripe_subscription_id;

    // Cancel the subscription immediately as requested
    const canceledSubscription = await stripe.subscriptions.cancel(subscriptionId);

    // Update the local database
    query('UPDATE subscriptions SET status = ? WHERE stripe_subscription_id = ?', ['canceled', subscriptionId]);
    query('UPDATE users SET subscription_status = ? WHERE id = ?', ['canceled', userId]);

    res.json({ success: true, message: 'Subscription canceled successfully', status: canceledSubscription.status });
  } catch (error) {
    console.error('Stripe cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
