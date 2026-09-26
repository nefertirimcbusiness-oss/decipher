import express from 'express';
const app = express();
const PORT = 8000;

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!endpointSecret) {
    console.log('[Webhook] No webhook secret configured, skipping verification');
    return res.json({ received: true });
  }
  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log(`[Webhook] Received: ${event.type}`);
    return res.json({ received: true });
  } catch (err) {
    console.error(`[Webhook] Error: ${err.message}`);
    return res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Webhook server on port ${PORT}`));
