import { NextRequest, NextResponse } from "next/server";

// GET: health check so Stripe can validate the URL
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "stripe-webhook" });
}

// POST: handle Stripe webhook events
export async function POST(request: NextRequest) {
  // Lazy-load stripe so build doesn't fail if the package has issues
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  try {
    const rawBody = await request.text();
    const body = Buffer.from(rawBody);
    const signature = request.headers.get("stripe-signature") || "";

    if (!signature) {
      console.error("[Stripe Webhook] Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    if (!webhookSecret) {
      console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error(
        `[Stripe Webhook] Signature verification failed: ${err.message}`
      );
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        console.log(
          `[Stripe Webhook] Checkout completed for customer: ${session.customer}`,
          { sessionId: session.id, subscriptionId: session.subscription }
        );
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        console.log(
          `[Stripe Webhook] Subscription updated: ${subscription.id}`,
          { status: subscription.status, customer: subscription.customer }
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        console.log(
          `[Stripe Webhook] Subscription deleted: ${subscription.id}`,
          { customer: subscription.customer }
        );
        break;
      }

      default: {
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error(`[Stripe Webhook] Unexpected error: ${error.message}`);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
