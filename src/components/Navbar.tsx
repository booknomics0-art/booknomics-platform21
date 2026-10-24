import { Link, NavLink, useNavigate } from "react-router-dom";
import { Crown, LogOut, Search, User as UserIcon } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAdmin } from "@/hooks/useAdmin";
import { TierSimulator } from "./TierSimulator";
import { useTier } from "@/hooks/useTier";
import { FollowMenu } from "./FollowMenu";
import { BrandLogo } from "./BrandLogo";

export const Navbar = () => {
  const { user, loading, signOut, isAdmin } = useAdmin();
  const showAdmin = !loading && isAdmin;
  const navigate = useNavigate();
  const { isPremium } = useTier();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `bn-nav-link text-sm font-medium transition-colors ${isActive ? "text-primary" : "text-foreground/70 hover:text-foreground"}`;

  return (
    <header className="bn-navbar sticky top-0 z-40 backdrop-blur-xl bg-background/80 border-b border-border">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Booknomics home">
          <BrandLogo />
        </Link>

        <nav className="hidden md:flex items-center gap-5 lg:gap-6" aria-label="Primary navigation">
          <NavLink to="/" end className={linkCls}>Home</NavLink>
          <NavLink to="/browse" className={linkCls}>Browse</NavLink>
          <NavLink to="/paths" className={linkCls}>Paths</NavLink>
          <NavLink to="/hindi" className={linkCls}>हिंदी</NavLink>
          {user && <NavLink to="/library" className={linkCls}>Library</NavLink>}
          <NavLink to="/community" className={linkCls}>Community</NavLink>
          {user && <NavLink to="/dashboard" className={linkCls}>Dashboard</NavLink>}
          {showAdmin && <NavLink to="/admin" className={linkCls}>Admin</NavLink>}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden xl:block"><FollowMenu /></div>
          {showAdmin && <div className="hidden md:block"><TierSimulator /></div>}
          {showAdmin && (
            <Link to="/admin" className="md:hidden text-xs font-semibold text-primary border border-primary/30 rounded-full px-3 py-2">
              Admin
            </Link>
          )}
          <Link to="/pricing"
            className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-2 text-[11px] font-semibold text-primary hover:bg-primary/15"
            aria-label={isPremium ? "View your Premium benefits" : "See Premium plans"}>
            <Crown className="h-4 w-4" />
            <span className="hidden sm:inline">{isPremium ? "My Premium" : "Go Premium"}</span>
          </Link>
          <Button variant="outline" size="icon" onClick={() => navigate("/browse")} className="rounded-full bg-card/70" aria-label="Search books">
            <Search className="h-4 w-4" />
          </Button>
          <ThemeToggle />
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2">
              <LogOut className="h-4 w-4" /> <span className="hidden xl:inline">Sign out</span>
            </Button>
          ) : (
            <Button onClick={() => navigate("/auth")} size="sm" className="gap-2 rounded-full bg-gold text-primary-foreground hover:opacity-90">
              <UserIcon className="h-4 w-4" /> <span className="hidden sm:inline">Sign in</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
