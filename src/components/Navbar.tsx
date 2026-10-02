import { Link, NavLink, useNavigate } from "react-router-dom";
import { BookOpen, Crown, LogOut, Search, User as UserIcon } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/hooks/useAdmin";
import { TierSimulator } from "./TierSimulator";
import { usePricingModal } from "./PricingModal";
import { useTier } from "@/hooks/useTier";
import { FollowMenu } from "./FollowMenu";

export const Navbar = () => {
  const { user, loading, signOut, isAdmin } = useAdmin();
  const showAdmin = !loading && isAdmin;
  const navigate = useNavigate();
  const openPricing = usePricingModal();
  const { isPremium, tier } = useTier();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-foreground/70 hover:text-foreground"}`;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="bg-gold h-10 w-10 rounded-lg grid place-items-center shadow-paper">
            <BookOpen className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <div className="font-serif text-xl font-bold tracking-tight">Booknomics</div>
            <div className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Read · Apply · Transform</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <NavLink to="/" end className={linkCls}>Home</NavLink>
          <NavLink to="/browse" className={linkCls}>Browse</NavLink>
          <NavLink to="/paths" className={linkCls}>Paths</NavLink>
          <NavLink to="/hindi" className={linkCls}>हिंदी 🇮🇳</NavLink>
          {user && <NavLink to="/library" className={linkCls}>Library</NavLink>}
          <NavLink to="/community" className={linkCls}>Community</NavLink>
          {user && <NavLink to="/dashboard" className={linkCls}>Dashboard</NavLink>}
          {showAdmin && <NavLink to="/admin" className={linkCls}>Admin</NavLink>}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden lg:block"><FollowMenu /></div>
          {showAdmin && <div className="hidden md:block"><TierSimulator /></div>}
          {!isPremium && (
            <Button
              onClick={openPricing}
              size="sm"
              className="hidden sm:inline-flex gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-violet-600 text-white hover:opacity-90 shadow-md"
            >
              <Crown className="h-4 w-4" /> Go Premium
            </Button>
          )}
          {isPremium && (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider">
              <Crown className="h-3 w-3" /> {tier}
            </span>
          )}
          <Button variant="outline" size="icon" onClick={() => navigate("/browse")} className="rounded-full" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          ) : (
            <Button onClick={() => navigate("/auth")} size="sm" className="gap-2 bg-gold text-primary-foreground hover:opacity-90">
              <UserIcon className="h-4 w-4" /> Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
