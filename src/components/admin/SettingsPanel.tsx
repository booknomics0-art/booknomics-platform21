import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/cloudflareApi";
import { toast } from "sonner";
import { Webhook } from "lucide-react";

export function SettingsPanel() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ data: { value?: { url?: string } } | null }>("/api/admin/settings/n8n")
      .then(({ data }) => setUrl(data?.value?.url ?? ""))
      .catch((error) => toast.error(error instanceof Error ? error.message : "Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/admin/settings/n8n", {
        method: "PUT",
        body: JSON.stringify({ url }),
      });
      toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
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
