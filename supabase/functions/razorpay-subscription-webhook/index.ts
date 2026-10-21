import { adminClient, PRICE, signed, time } from "../_shared/razorpay-billing.ts";

// Public endpoint: no JWT. Raw-body Razorpay HMAC is mandatory before any database read/write.
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  try {
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    const signature = req.headers.get("x-razorpay-signature") || "";
    const eventId = req.headers.get("x-razorpay-event-id") || "";
    if (!secret) return new Response("Webhook disabled", { status: 503 });
    if (!/^[A-Za-z0-9_-]{6,120}$/.test(eventId)) return new Response("Event ID required", { status: 400 });
    const raw = await req.text();
    if (raw.length > 250000 || !await signed(secret, raw, signature))
      return new Response("Invalid webhook signature", { status: 401 });
    const event = JSON.parse(raw);
    if (typeof event.event !== "string") return new Response("Invalid event", { status: 400 });
    const handled = new Set([
      "subscription.activated", "subscription.charged", "subscription.pending",
      "subscription.halted", "subscription.cancelled", "subscription.completed",
      "subscription.paused", "subscription.resumed",
    ]);
    if (!handled.has(event.event)) return new Response("ok");

    const providerSub = event.payload?.subscription?.entity;
    const id = providerSub?.id;
    if (typeof id !== "string" || !/^sub_[A-Za-z0-9]+$/.test(id))
      return new Response("Invalid subscription", { status: 400 });
    const db = adminClient();
    const { data: row, error: readError } = await db.from("subscriptions")
      .select("id,plan,amount,status,expires_at,last_provider_event_at,razorpay_payment_id")
      .eq("razorpay_subscription_id", id).maybeSingle();
    if (readError) throw readError;
    // A webhook for an unknown subscription cannot grant access.
    if (!row || !PRICE[row.plan]) return new Response("Untracked subscription", { status: 404 });

    const { data: eventRow, error: eventError } = await db.from("razorpay_webhook_events")
      .upsert({ event_id: eventId, event_name: event.event }, { onConflict: "event_id", ignoreDuplicates: true })
      .select("processed_at").maybeSingle();
    if (eventError) throw eventError;
    if (eventRow?.processed_at) return new Response("ok");
    const happened = time(event.created_at);
    const newer = happened && (!row.last_provider_event_at || happened >= row.last_provider_event_at);
    const updates: Record<string, unknown> = {};
    if (newer) {
      updates.provider_status = String(providerSub.status || event.event.split(".")[1]);
      updates.last_provider_event_at = happened;
    }
    if (event.event === "subscription.charged") {
      const payment = event.payload?.payment?.entity;
      const until = time(providerSub.current_end);
      const since = time(providerSub.current_start);
      if (newer && payment?.status === "captured" && payment.subscription_id === id &&
          payment.amount === row.amount && payment.currency === "INR" &&
          until && new Date(until) > new Date() &&
          (!row.expires_at || until >= row.expires_at)) {
        updates.status = "active";
        updates.expires_at = until;
        updates.starts_at = since || new Date().toISOString();
        updates.razorpay_payment_id = payment.id;
      }
    }
    if (newer && ["subscription.cancelled","subscription.completed"].includes(event.event)) {
      updates.cancel_at_cycle_end = true;
      // Keep an already-paid period accessible; never extend based on cancellation.
      if (!row.expires_at || new Date(row.expires_at) <= new Date()) updates.status = "expired";
    }
    if (Object.keys(updates).length) {
      const { error } = await db.from("subscriptions").update(updates).eq("id", row.id);
      if (error) throw error;
    }
    const { error: doneError } = await db.from("razorpay_webhook_events")
      .update({ processed_at: new Date().toISOString() }).eq("event_id", eventId);
    if (doneError) throw doneError;
    return new Response("ok");
  } catch (error) {
    console.error("Razorpay webhook could not be processed", String(error));
    return new Response("Webhook processing failed", { status: 503 });
  }
});
