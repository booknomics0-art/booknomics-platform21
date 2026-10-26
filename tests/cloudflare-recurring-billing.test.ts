import { describe, expect, it } from "vitest";
import { createHmac } from 'node:crypto';
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
  it('ignores verified webhook events tagged for the new Supabase backend without a D1 read', async () => {
    const body = JSON.stringify({
      event: 'subscription.charged',
      payload: { subscription: { entity: {
        id: 'sub_newaccount123', notes: { booknomics_backend: 'new_supabase_v1' },
      } } },
    });
    const signature = createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
    const safeEnv = { ...env, DB: { prepare: () => { throw new Error('D1 must not be queried'); } } };
    const res = await handleRecurringBillingRoute(new Request(url('webhook'), {
      method: 'POST', body, headers: {
        'x-razorpay-signature': signature, 'x-razorpay-event-id': 'evt_newaccount123',
      },
    }), safeEnv);
    expect(res?.status).toBe(200);
    expect(await res?.text()).toBe('ignored');
  });
});
