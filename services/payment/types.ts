/**
 * Provider-agnostic payment contract.
 * Concrete adapters (stripe.ts, payjs.ts, ...) implement this interface;
 * business code never talks to Stripe / PayJS SDKs directly.
 */

export type PaymentProviderId = "stripe" | "payjs" | "wechat" | "alipay";

export type Plan = "single" | "monthly";

export type Currency = "USD" | "CNY";

export interface CheckoutInput {
  userId: string;
  userEmail?: string;
  /** Stripe customer id (or equivalent) to attach this session to. */
  customerId?: string;
  plan: Plan;
  amountCents: number;
  currency: Currency;
  successUrl: string;
  cancelUrl: string;
  /** Our internal orders.id — carried through to webhook as metadata. */
  orderId: string;
}

export interface CheckoutResult {
  providerOrderId: string;
  checkoutUrl: string;
}

export interface EnsureCustomerInput {
  userId: string;
  email?: string;
  /** If present, verify it's still valid; otherwise mint a new one. */
  existingCustomerId?: string | null;
}

export interface EnsureCustomerResult {
  customerId: string;
}

export interface PortalSessionInput {
  customerId: string;
  returnUrl: string;
}

export interface PortalSessionResult {
  url: string;
}

export type WebhookEventKind =
  | "checkout_paid"
  | "checkout_failed"
  | "subscription_canceled"
  | "unhandled";

export interface WebhookEvent {
  kind: WebhookEventKind;
  providerOrderId?: string;
  /** Our internal orders.id, echoed back via provider metadata. */
  orderId?: string;
  /** Stripe customer id for subscription lifecycle events. */
  customerId?: string;
  status?: "paid" | "failed" | "refunded";
  paidAt?: Date;
  failureReason?: string;
  raw: unknown;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  verifyAndParseWebhook(req: Request): Promise<WebhookEvent>;
  ensureCustomer(input: EnsureCustomerInput): Promise<EnsureCustomerResult>;
  createPortalSession(input: PortalSessionInput): Promise<PortalSessionResult>;
  /**
   * Cancels every active subscription tied to a customer. Called when a user
   * deletes their account so we never keep billing a closed account.
   * Idempotent — a no-op if the customer has nothing active.
   */
  cancelActiveSubscriptions(customerId: string): Promise<void>;
}
