import { describe, expect, it } from "vitest";
import { handleRecurringBillingRoute } from "../worker/recurringBillingRoutes";

const fakeD1 = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
const env = { DB: fakeD1, RAZORPAY_WEBHOOK_SECRET: "local-test-secret" };
const url = (route: string) => "https://www.booknomics.com/api/payments/razorpay/" + route;

describe("Cloudflare recurring Razorpay guardrails", () => {
  it("does not intercept legacy payments", async () => {
    const result = await handleRecurringBillingRoute(new Request(url("order"), { method: "POST" }), env);
    expect(result).toBeNull();
  });
  it("only permits POST webhook and never processes unsigned events", async () => {
    const get = await handleRecurringBillingRoute(new Request(url("webhook")), env);
    expect(get?.status).toBe(405);
    const post = await handleRecurringBillingRoute(new Request(url("webhook"), {
      method: "POST", headers: { "x-razorpay-signature": "bad" },
      body: JSON.stringify({ event: "subscription.charged" }),
    }), env);
    expect(post?.status).toBe(401);
  });
  it("requires sign-in for reading billing history", async () => {
    const res = await handleRecurringBillingRoute(new Request(url("subscription")), env);
    expect(res?.status).toBe(401);
  });
  it("requires sign-in before attempting live checkout", async () => {
    const res = await handleRecurringBillingRoute(new Request(url("subscribe"), {
      method: "POST", body: JSON.stringify({ plan: "weekly" }),
    }), env);
    expect(res?.status).toBe(401);
  });
  it("rejects cross-site state-changing requests", async () => {
    const res = await handleRecurringBillingRoute(new Request(url("subscribe"), {
      method: "POST", body: JSON.stringify({ plan: "monthly" }),
      headers: { origin: "https://evil.example" },
    }), env);
    expect(res?.status).toBe(403);
  });
  it("does not allow GET checkout", async () => {
    const res = await handleRecurringBillingRoute(new Request(url("subscribe")), env);
    expect(res?.status).toBe(405);
  });
});
