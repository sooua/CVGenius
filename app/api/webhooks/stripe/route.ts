import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { orders } from "@/db/schema/orders";
import { users } from "@/db/schema/users";
import { resolvePaymentProvider } from "@/services/payment";

// Webhook must run on Node runtime so Stripe.Event verification + DB writes work.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const provider = resolvePaymentProvider("stripe");

  let event;
  try {
    event = await provider.verifyAndParseWebhook(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature";
    return NextResponse.json(
      { error: `Webhook verification failed: ${message}` },
      { status: 400 },
    );
  }

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

      await db
        .update(orders)
        .set({
          status: "paid",
          paidAt: event.paidAt ?? new Date(),
          providerMetadata: event.raw as object,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order.id));

      await db
        .update(users)
        .set({ plan: "pro", updatedAt: new Date() })
        .where(eq(users.id, order.userId));
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

  return NextResponse.json({ received: true });
}
