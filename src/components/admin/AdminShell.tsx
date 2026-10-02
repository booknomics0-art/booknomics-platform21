import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Layout } from "@/components/Layout";
import {
  LayoutDashboard, Search, Globe, Link2, Share2, Sparkles, BookOpen, ListChecks, Wand2, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Books / Content", icon: BookOpen, end: true },
  { to: "/admin/demand", label: "Reader Demand", icon: BarChart3 },
  { to: "/admin/seo", label: "SEO Dashboard", icon: LayoutDashboard },
  { to: "/admin/seo-manager", label: "SEO Manager (Keywords)", icon: Wand2 },
  { to: "/admin/gsc", label: "Google Search Console", icon: Globe },
  { to: "/admin/slug-optimizer", label: "Slug Optimizer", icon: Link2 },
  { to: "/admin/social", label: "Social Publisher", icon: Share2 },
  { to: "/admin/polish", label: "Content Polish", icon: Sparkles },
  { to: "/admin/indexing-queue", label: "Indexing Queue", icon: ListChecks },
];

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Layout>
      <div className="container py-6">
        <div className="flex flex-col md:flex-row gap-6">
          <aside className="md:w-60 shrink-0">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-2">Admin</div>
            <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
              {NAV.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end as any}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition-colors",
                      isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted",
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-serif font-bold mb-4 flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" /> {title}
            </h1>
            {children}
          </div>
        </div>
      </div>
    </Layout>
  );
}
