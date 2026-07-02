import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { orders } from "@/db/schema/orders";
import { users } from "@/db/schema/users";
import { resolvePaymentProvider, type WebhookEvent } from "@/services/payment";
import { logError } from "@/lib/log";

// Webhook must run on Node runtime so Stripe.Event verification + DB writes work.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const provider = resolvePaymentProvider("stripe");

  let event;
  try {
    event = await provider.verifyAndParseWebhook(req);
  } catch (err) {
    logError("stripe-webhook.verify", err);
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json(
      { error: `Webhook verification failed: ${message}` },
      { status: 400 },
    );
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // Log + 500 so Stripe retries rather than silently dropping the event.
    logError("stripe-webhook.handle", err, { kind: event.kind });
    return NextResponse.json({ error: "handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: WebhookEvent) {
  switch (event.kind) {
    case "checkout_paid": {
      if (!event.orderId) break;
      const order = await db.query.orders.findFirst({
        where: eq(orders.id, event.orderId),
      });
      if (!order) break;
      // Stripe delivers events at-least-once; ignore replays of an order
      // we've already marked paid so downstream side effects run once.
      if (order.status === "paid") break;

      // Mark-paid and upgrade-to-pro must be atomic: if the second write failed
      // on its own, we'd return 500, Stripe would retry, and the idempotency
      // guard above would short-circuit — leaving a paid order with a free user.
      // A transaction rolls both back together so the retry re-applies both.
      await db.transaction(async (tx) => {
        await tx
          .update(orders)
          .set({
            status: "paid",
            paidAt: event.paidAt ?? new Date(),
            providerMetadata: event.raw as object,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, order.id));

        await tx
          .update(users)
          .set({ plan: "pro", updatedAt: new Date() })
          .where(eq(users.id, order.userId));
      });
      break;
    }

    case "checkout_failed": {
      if (!event.orderId) break;
      await db
        .update(orders)
        .set({
          status: "failed",
          failureReason: event.failureReason ?? null,
          providerMetadata: event.raw as object,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, event.orderId));
      break;
    }

    case "subscription_canceled": {
      // Downgrade the user tied to this Stripe customer.
      if (!event.customerId) break;
      await db
        .update(users)
        .set({ plan: "free", updatedAt: new Date() })
        .where(eq(users.stripeCustomerId, event.customerId));
      break;
    }

    case "unhandled":
    default:
      // Acknowledge unknown events so Stripe doesn't keep retrying.
      break;
  }
}
