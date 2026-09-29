import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Webhook } from "lucide-react";

export function SettingsPanel() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "n8n_webhook_url").maybeSingle()
      .then(({ data }) => {
        setUrl((data?.value as any)?.url ?? "");
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").upsert({
      key: "n8n_webhook_url",
      value: { url } as any,
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Saved");
  };

  const test = async () => {
    if (!url) return toast.error("Enter URL first");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true, source: "booknomics-admin", at: new Date().toISOString() }),
      });
      toast.success(`Webhook responded ${res.status}`);
    } catch (e) {
      toast.error("Failed: " + (e as Error).message);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Webhook className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">n8n Distribution Webhook</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Paste your n8n production webhook URL. The "Publish &amp; Promote" button posts a JSON payload here
        with book metadata, assets, and social captions.
      </p>
      <div>
        <Label>Webhook URL</Label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://your-n8n.example.com/webhook/booknomics"
          disabled={loading}
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || loading}>{saving ? "Saving…" : "Save"}</Button>
        <Button onClick={test} variant="outline" disabled={!url}>Send test ping</Button>
      </div>
    </Card>
  );
}

export default SettingsPanel;
