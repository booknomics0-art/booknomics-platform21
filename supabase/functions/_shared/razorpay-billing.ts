import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const PRICE: Record<string, { amount: number; period: string; count: number; days: number; env: string }> = {
  weekly: { amount: 1900, period: "weekly", count: 52, days: 7, env: "RAZORPAY_WEEKLY_PLAN_ID" },
  monthly: { amount: 4900, period: "monthly", count: 12, days: 31, env: "RAZORPAY_MONTHLY_PLAN_ID" },
};

export const config = () => {
  const key = (Deno.env.get("RAZORPAY_KEY_ID") || "").trim();
  const secret = (Deno.env.get("RAZORPAY_KEY_SECRET") || "").trim();
  if (!/^rzp_(test|live)_/.test(key) || !secret) throw new Error("Razorpay is not configured");
  return { key, secret, auth: "Basic " + btoa(key + ":" + secret) };
};

export const adminClient = () => createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export async function authenticatedUser(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: "Bearer " + token } } },
  );
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

export async function provider(path: string, init: RequestInit = {}) {
  const { auth } = config();
  const res = await fetch("https://api.razorpay.com/v1/" + path, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: auth, ...(init.headers || {}) },
    signal: AbortSignal.timeout(12000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("Razorpay request failed", { path: path.split("?")[0], code: data?.error?.code, status: res.status });
    throw new Error("Payment provider is unavailable; please retry");
  }
  return data;
}

export async function signed(secret: string, message: string, signature: string) {
  if (!/^[0-9a-f]{64}$/i.test(signature)) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const bytes = new Uint8Array(signature.match(/../g)!.map((v) => parseInt(v, 16)));
  return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(message));
}

export const time = (seconds: unknown) =>
  typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString() : null;
