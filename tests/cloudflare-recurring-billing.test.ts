import { describe, expect, it } from "vitest";
import { billingCredentials, handleRecurringBillingRoute } from "../worker/recurringBillingRoutes";

const fakeD1 = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
const env = { DB: fakeD1, RAZORPAY_WEBHOOK_SECRET: "local-test-secret" };
const url = (route: string) => "https://www.booknomics.com/api/payments/razorpay/" + route;

describe("Cloudflare recurring Razorpay guardrails", () => {
  it("permits test credentials only in staging and live credentials only in production", () => {
    const live = { RAZORPAY_KEY_ID: "rzp_live_sample", RAZORPAY_KEY_SECRET: "dummy" };
    const test = { RAZORPAY_KEY_ID: "rzp_test_sample", RAZORPAY_KEY_SECRET: "dummy" };
    expect(billingCredentials({ ...live, BOOKNOMICS_ENV: "production" })).not.toBeNull();
    expect(billingCredentials({ ...test, BOOKNOMICS_ENV: "staging" })).not.toBeNull();
    expect(billingCredentials({ ...test, BOOKNOMICS_ENV: "production" })).toBeNull();
    expect(billingCredentials({ ...live, BOOKNOMICS_ENV: "staging" })).toBeNull();
    expect(billingCredentials({ ...live, BOOKNOMICS_ENV: "preview" })).toBeNull();
    expect(billingCredentials({ ...live })).toBeNull();
    expect(billingCredentials({ ...test, BOOKNOMICS_ENV: "staging", RAZORPAY_KEY_SECRET: "" })).toBeNull();
  });
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
