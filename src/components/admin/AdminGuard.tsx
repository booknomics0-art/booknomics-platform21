import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { Layout } from "@/components/Layout";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAdmin();
  if (loading) return <Layout><div className="p-8">Loading…</div></Layout>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
