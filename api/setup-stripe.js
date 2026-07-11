import 'dotenv/config';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setupStripe() {
  console.log('Setting up Stripe products and prices...');

  try {
    // 1. Create Product
    const product = await stripe.products.create({
      name: 'Decipher Premium',
      description: 'Full access to Savid and all journaling features.',
    });
    console.log(`Product created: ${product.id}`);

    // 2. Create Price
    const price = await stripe.prices.create({
      unit_amount: 2499, // $24.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      product: product.id,
    });
    console.log(`Price created: ${price.id}`);

    // 3. Create Coupon (50% off first month)
    const coupon = await stripe.coupons.create({
      duration: 'once', // first month only
      percent_off: 50,
      name: '50% Off First Month',
    });
    console.log(`Coupon created: ${coupon.id}`);

    console.log('Stripe setup complete.');
    console.log('\nAdd these to your .env:');
    console.log(`STRIPE_PRICE_ID=${price.id}`);
    console.log(`STRIPE_COUPON_ID=${coupon.id}`);
    
  } catch (error) {
    console.error('Error setting up Stripe:', error.message);
  }
}

setupStripe();
