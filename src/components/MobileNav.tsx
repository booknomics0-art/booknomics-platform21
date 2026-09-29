import { NavLink } from "react-router-dom";
import { Home, BookOpen, Library, User as UserIcon, Route } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const items = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/browse", label: "Browse", icon: BookOpen },
  { to: "/paths", label: "Paths", icon: Route },
  { to: "/library", label: "Library", icon: Library, auth: true },
  { to: "/dashboard", label: "Profile", icon: UserIcon, auth: true },
];

export const MobileNav = () => {
  const { user } = useAuth();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary mobile"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ to, label, icon: Icon, end, auth }) => {
          const target = auth && !user ? "/auth" : to;
          return (
            <li key={label}>
              <NavLink
                to={target}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                    isActive && target === to
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
