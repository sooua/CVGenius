import Stripe from "stripe";
import { env } from "@/lib/env.server";
import type {
  CheckoutInput,
  CheckoutResult,
  EnsureCustomerInput,
  EnsureCustomerResult,
  PaymentProvider,
  PortalSessionInput,
  PortalSessionResult,
  WebhookEvent,
} from "./types";

const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY)
  : null;

function assertStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.",
    );
  }
  return stripe;
}

function productNameFor(plan: CheckoutInput["plan"]): string {
  return plan === "monthly" ? "FirstCV Monthly" : "FirstCV Single Export";
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",

  async ensureCustomer(
    input: EnsureCustomerInput,
  ): Promise<EnsureCustomerResult> {
    const s = assertStripe();

    if (input.existingCustomerId) {
      try {
        const cust = await s.customers.retrieve(input.existingCustomerId);
        if (!("deleted" in cust) || !cust.deleted) {
          return { customerId: input.existingCustomerId };
        }
      } catch {
        // fall through to create a new one
      }
    }

    const cust = await s.customers.create({
      email: input.email,
      metadata: { userId: input.userId },
    });
    return { customerId: cust.id };
  },

  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    const s = assertStripe();

    const sessionArgs: Stripe.Checkout.SessionCreateParams = {
      mode: input.plan === "monthly" ? "subscription" : "payment",
      client_reference_id: input.userId,
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: { name: productNameFor(input.plan) },
            unit_amount: input.amountCents,
            recurring:
              input.plan === "monthly" ? { interval: "month" } : undefined,
          },
          quantity: 1,
        },
      ],
      metadata: {
        orderId: input.orderId,
        plan: input.plan,
      },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    };

    // Prefer customer attachment (persistent history for the Billing Portal)
    // over a one-off email on the session.
    if (input.customerId) {
      sessionArgs.customer = input.customerId;
    } else if (input.userEmail) {
      sessionArgs.customer_email = input.userEmail;
    }

    const session = await s.checkout.sessions.create(sessionArgs);

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }

    return {
      providerOrderId: session.id,
      checkoutUrl: session.url,
    };
  },

  async createPortalSession(
    input: PortalSessionInput,
  ): Promise<PortalSessionResult> {
    const s = assertStripe();
    const session = await s.billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  },

  async cancelActiveSubscriptions(customerId: string): Promise<void> {
    const s = assertStripe();
    const subs = await s.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 100,
    });
    await Promise.all(subs.data.map((sub) => s.subscriptions.cancel(sub.id)));
  },

  async verifyAndParseWebhook(req: Request): Promise<WebhookEvent> {
    const s = assertStripe();
    const sig = req.headers.get("stripe-signature");
    if (!sig) throw new Error("Missing stripe-signature header");
    if (!env.STRIPE_WEBHOOK_SECRET)
      throw new Error("STRIPE_WEBHOOK_SECRET not set");

    const body = await req.text();
    const event = s.webhooks.constructEvent(
      body,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        kind: "checkout_paid",
        providerOrderId: session.id,
        orderId: session.metadata?.orderId ?? "",
        customerId:
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id,
        status: "paid",
        paidAt: new Date(),
        raw: event,
      };
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      return {
        kind: "checkout_failed",
        providerOrderId: session.id,
        orderId: session.metadata?.orderId ?? "",
        status: "failed",
        failureReason: "checkout_session_expired",
        raw: event,
      };
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      return {
        kind: "subscription_canceled",
        customerId:
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        raw: event,
      };
    }

    return {
      kind: "unhandled",
      raw: event,
    };
  },
};
