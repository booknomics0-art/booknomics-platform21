import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CreditCard, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTier } from "@/hooks/useTier";
import { toast } from "sonner";

type Subscription = {
  id: string; plan: string; amount: number; status: string;
  expires_at: string | null; created_at: string;
  razorpay_subscription_id: string | null; cancel_at_cycle_end: boolean | null;
  provider_status: string | null;
};
const display = (date?: string | null) =>
  date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "Awaiting confirmation";

export default function SubscriptionAccount() {
  const { user, loading } = useAuth();
  const { refresh } = useTier();
  const [rows, setRows] = useState<Subscription[]>([]);
  const [fetching, setFetching] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const load = async () => {
    if (!user) { setFetching(false); return; }
    const { data, error } = await (supabase as any).from("subscriptions")
      .select("id,plan,amount,status,expires_at,created_at,razorpay_subscription_id,cancel_at_cycle_end,provider_status")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
    if (error) toast.error("Could not load billing details");
    setRows(data || []);
    setFetching(false);
  };
  useEffect(() => { document.title = "My Subscription | Booknomics"; }, []);
  useEffect(() => { void load(); }, [user?.id]);
  const current = rows.find((r) => r.status === "active" && r.expires_at && new Date(r.expires_at) > new Date()) || rows[0];
  const active = !!current && current.status === "active" && !!current.expires_at && new Date(current.expires_at) > new Date();
  const cancel = async () => {
    if (!current?.razorpay_subscription_id || !active || current.cancel_at_cycle_end) return;
    if (!window.confirm("Stop future automatic renewals? You will retain access through the already-paid period.")) return;
    setCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("razorpay-manage-subscription", {
        body: { action: "cancel_at_period_end", subscription_id: current.razorpay_subscription_id },
      });
      if (error || !data?.ok) throw new Error(data?.error || "Could not cancel subscription");
      toast.success("Future renewals cancelled. Current paid access remains.");
      await load();
      await refresh();
    } catch (error: any) {
      toast.error(error?.message || "Cancellation failed");
    } finally { setCancelling(false); }
  };
  return <Layout>
    <main className="container max-w-3xl py-14 md:py-20">
      <div className="inline-flex items-center gap-2 text-primary font-semibold uppercase tracking-wider text-xs mb-4"><CreditCard className="w-4 h-4" /> Account & Billing</div>
      <h1 className="font-serif text-4xl md:text-5xl font-bold">My Subscription</h1>
      <p className="text-muted-foreground mt-3 mb-9">Review your membership and manage future renewals.</p>
      {loading || fetching ? <div className="rounded-2xl border p-8">Loading membership...</div> :
        !user ? <div className="rounded-2xl border p-8">Please <Link to="/auth" className="underline text-primary">sign in</Link> to view billing.</div> :
        !current ? <div className="rounded-2xl border p-8"><p>You have no subscriptions yet.</p><Button className="mt-5" asChild><Link to="/pricing">Explore Premium plans</Link></Button></div> :
        <div className="rounded-3xl border bg-card p-6 md:p-9 shadow-sm">
          <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
            <div><div className="text-xs text-muted-foreground uppercase tracking-wider">Membership</div><div className="font-serif text-2xl font-bold capitalize mt-1">{current.plan} Premium</div></div>
            <div className="rounded-full border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-bold capitalize">{active ? "Active" : current.status}</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-5 py-5 border-y">
            <div><p className="text-xs text-muted-foreground">Last configured payment amount</p><p className="font-bold text-xl mt-1">₹{(current.amount / 100).toFixed(2)}</p></div>
            <div><p className="text-xs text-muted-foreground">{current.cancel_at_cycle_end ? "Access ends" : "Current paid period ends"}</p><p className="font-bold mt-1">{display(current.expires_at)}</p></div>
          </div>
          {active && current.razorpay_subscription_id ? <div className="pt-6 space-y-4">
            <div className="flex gap-2 items-center text-sm"><CalendarClock className="w-4 h-4 text-primary" />
              {current.cancel_at_cycle_end ? "Auto-renewal is scheduled to stop." : "This membership renews automatically unless you cancel."}
            </div>
            {!current.cancel_at_cycle_end && <Button variant="outline" disabled={cancelling} onClick={cancel}>{cancelling ? "Cancelling..." : "Cancel future renewals"}</Button>}
          </div> : <p className="text-sm text-muted-foreground pt-6">{current.status === "pending" ? "Razorpay is processing your mandate/payment. If you paid, do not pay again until support has checked the payment." : "This membership is not currently active."}</p>}
          <div className="flex items-start gap-2 text-xs text-muted-foreground pt-6"><ShieldCheck className="w-4 h-4 shrink-0" /> Billing is verified on the server. Previous one-time plans keep their original validity and do not auto-renew.</div>
        </div>}
      <div className="flex gap-5 mt-8 text-sm"><Link to="/pricing" className="underline text-primary">View pricing</Link><Link to="/contact" className="underline text-primary">Billing support</Link><Link to="/terms" className="underline text-primary">Terms</Link></div>
    </main>
  </Layout>;
}
