// @vitest-environment node
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  signed: vi.fn(async () => true),
  adminClient: vi.fn(),
}));
vi.mock("../supabase/functions/_shared/razorpay-billing.ts", () => ({
  signed: mock.signed,
  adminClient: mock.adminClient,
  PRICE: { monthly: { amount: 4900 }, weekly: { amount: 1900 } },
  time: (seconds: unknown) => typeof seconds === "number" && seconds > 0
    ? new Date(seconds * 1000).toISOString() : null,
}));
type Subscriber = {
  id: string; plan: string; amount: number; status: string; expires_at: string | null;
  last_provider_event_at: string | null; razorpay_payment_id: string | null;
  cancel_at_cycle_end?: boolean;
};
let handler: (req: Request) => Promise<Response>;
let row: Subscriber;
let updates: ReturnType<typeof vi.fn>;
let processed: Set<string>;
const now = Math.floor(Date.now() / 1000);
const request = (event: string, payment?: Record<string, unknown>, eventId = "evt_fake1234") =>
  new Request("https://example.org", {
    method: "POST",
    headers: { "x-razorpay-signature": "a".repeat(64), "x-razorpay-event-id": eventId },
    body: JSON.stringify({
      event, created_at: now, payload: {
        subscription: { entity: {
          id: "sub_test1234", status: "active", current_start: now,
          current_end: now + 30 * 86400,
        } },
        payment: payment ? { entity: payment } : undefined,
      },
    }),
  });
beforeEach(async () => {
  vi.resetModules();
  mock.signed.mockReset().mockResolvedValue(true);
  processed = new Set();
  row = { id: "db-id", plan: "monthly", amount: 4900, status: "pending",
    expires_at: null, last_provider_event_at: null, razorpay_payment_id: null };
  updates = vi.fn((values: Partial<Subscriber>) => {
    Object.assign(row, values);
    return { eq: async () => ({ error: null }) };
  });
  const db = {
    from(name: string) {
      if (name === "subscriptions") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
          update: updates,
        };
      }
      if (name === "razorpay_webhook_events") {
        return {
          select: () => ({ eq: (_: string, id: string) => ({
            maybeSingle: async () => ({ data: processed.has(id) ? { processed_at: "2026-10-22" } : null }),
          }) }),
          upsert: () => ({ error: null }),
          update: () => ({ eq: (_: string, id: string) => {
            processed.add(id);
            return Promise.resolve({ error: null });
          } }),
        };
      }
      throw new Error("Unexpected table: " + name);
    },
  };
  mock.adminClient.mockReturnValue(db);
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => key === "RAZORPAY_WEBHOOK_SECRET" ? "test_webhook_secret" : null },
    serve: (cb: typeof handler) => { handler = cb; },
  });
  await import("../supabase/functions/razorpay-subscription-webhook/index.ts");
});
afterEach(() => vi.unstubAllGlobals());
describe("Razorpay recurring webhooks", () => {
  it("rejects invalid webhook signatures without granting Premium", async () => {
    mock.signed.mockResolvedValueOnce(false);
    expect((await handler(request("subscription.charged", {
      id: "pay_test", status: "captured", amount: 4900, currency: "INR",
    }))).status).toBe(401);
    expect(updates).not.toHaveBeenCalled();
  });
  it("never activates from mandate authorisation alone", async () => {
    expect((await handler(request("subscription.activated"))).status).toBe(200);
    expect(row.status).toBe("pending");
    expect(row.expires_at).toBeNull();
  });
  it("credits a properly signed captured charge even when payment.subscription_id is omitted", async () => {
    const paid = { id: "pay_test", status: "captured", amount: 4900, currency: "INR" };
    expect((await handler(request("subscription.charged", paid))).status).toBe(200);
    expect(row.status).toBe("active");
    expect(row.razorpay_payment_id).toBe("pay_test");
    expect(new Date(row.expires_at!).getTime()).toBeGreaterThan(Date.now());
    const calls = updates.mock.calls.length;
    expect((await handler(request("subscription.charged", paid))).status).toBe(200);
    expect(updates).toHaveBeenCalledTimes(calls);
  });
  it("accepts a late captured charge even after a newer status notification", async () => {
    row.last_provider_event_at = new Date((now + 60) * 1000).toISOString();
    const paid = { id: "pay_late", status: "captured", amount: 4900, currency: "INR" };
    expect((await handler(request("subscription.charged", paid, "evt_late1234"))).status).toBe(200);
    expect(row.status).toBe("active");
  });
  it("does not extend access for failed, underpaid, or mismatched charges", async () => {
    const payment = { id: "pay_test", status: "failed", amount: 4900, currency: "INR" };
    await handler(request("subscription.charged", payment, "evt_failed123"));
    expect(row.status).toBe("pending");
    await handler(request("subscription.charged", { ...payment, status: "captured", amount: 1 }, "evt_small1234"));
    expect(row.expires_at).toBeNull();
    await handler(request("subscription.charged", { ...payment, status: "captured", subscription_id: "sub_other", amount: 4900 }, "evt_wrong123"));
    expect(row.expires_at).toBeNull();
  });
  it("preserves an already-paid period when cancellation arrives", async () => {
    row.status = "active";
    row.expires_at = new Date((now + 30 * 86400) * 1000).toISOString();
    await handler(request("subscription.cancelled", undefined, "evt_cancel12"));
    expect(row.status).toBe("active");
    expect(row.cancel_at_cycle_end).toBe(true);
  });
});
