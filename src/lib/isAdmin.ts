import { apiFetch } from "@/lib/cloudflareApi";

/** Server-side roles remain authoritative. */
export async function isAdminUser(_userId: string): Promise<boolean> {
  const data = await apiFetch<{ isAdmin: boolean }>("/api/me/admin");
  return data.isAdmin === true;
}
