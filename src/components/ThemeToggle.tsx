import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const syncBrowserThemeColor = (isDark: boolean) => {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = isDark ? "#0b0d10" : "#fdfbf6";
};

export const ThemeToggle = () => {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved === "dark" || saved === null;
    document.documentElement.classList.toggle("dark", isDark);
    syncBrowserThemeColor(isDark);
    setDark(isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    syncBrowserThemeColor(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };

  return (
    <Button variant="outline" size="icon" onClick={toggle} aria-label="Toggle theme" className="rounded-full">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
};
