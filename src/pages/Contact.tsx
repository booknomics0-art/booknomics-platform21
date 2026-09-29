import { useState } from "react";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Twitter, Instagram, Shield } from "lucide-react";
import { toast } from "sonner";

const Contact = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !message) return toast.error("Please fill in all fields");
    const subject = encodeURIComponent(`[Booknomics] Message from ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:hello@booknomics.com?subject=${subject}&body=${body}`;
    toast.success("Opening your email app…");
  };

  return (
    <Layout>
      <SEO
        title="Contact Booknomics — Get in touch with our editorial team"
        description="Questions, feedback, partnership ideas, or copyright concerns? Reach the Booknomics editorial team. We reply within 48 hours."
        path="/contact"
        breadcrumbs={[{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }]}
      />
      <section className="container max-w-4xl py-12 md:py-16">
        <div className="text-xs tracking-[0.2em] uppercase text-primary font-semibold mb-3">Contact</div>
        <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight mb-4">Get in touch</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mb-10">
          Feedback, partnership ideas, or a copyright question? Send us a note —
          our editorial team replies within 48 hours.
        </p>

        <div className="grid md:grid-cols-[1fr_280px] gap-8">
          <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-paper space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Message</label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" rows={6} required />
            </div>
            <Button type="submit" className="w-full">Send message</Button>
          </form>

          <aside className="space-y-3">
            <a href="mailto:hello@booknomics.com" className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:bg-muted/50 transition">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">General</div>
                <div className="text-sm font-medium">hello@booknomics.com</div>
              </div>
            </a>
            <a href="mailto:legal@booknomics.com" className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:bg-muted/50 transition">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-muted-foreground">Copyright / DMCA</div>
                <div className="text-sm font-medium">legal@booknomics.com</div>
              </div>
            </a>
            <a href="https://twitter.com/booknomics" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:bg-muted/50 transition">
              <Twitter className="h-5 w-5 text-primary" />
              <div className="text-sm font-medium">@booknomics</div>
            </a>
            <a href="https://instagram.com/booknomics" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-card border border-border rounded-xl p-4 hover:bg-muted/50 transition">
              <Instagram className="h-5 w-5 text-primary" />
              <div className="text-sm font-medium">@booknomics</div>
            </a>
          </aside>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
