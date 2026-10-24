import { apiFetch } from "@/lib/cloudflareApi";

/** The Cloudflare Worker checks the signed-in session against its private role table. */
export async function isAdminUser(): Promise<boolean> {
  const data = await apiFetch<{ isAdmin: boolean }>("/api/me/admin");
  return data.isAdmin === true;
}
