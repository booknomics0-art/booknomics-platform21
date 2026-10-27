import { isPersonalSupabaseEnabled, personalSupabase } from '@/lib/personalSupabase';

const configuredBase = (import.meta.env.VITE_API_BASE || "").trim();
const API_BASE = configuredBase.endsWith("/") ? configuredBase.slice(0, -1) : configuredBase;

export type CloudflareUser = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  user_metadata: {
    name?: string;
    full_name?: string;
    avatar_url?: string;
  };
};

export async function apiRawFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && init.body instanceof Blob;
  const authHeaders: Record<string, string> = {};
  if (isPersonalSupabaseEnabled && personalSupabase && path.startsWith('/api/')) {
    const { data, error } = await personalSupabase.auth.getSession();
    if (error) throw error;
    if (data.session) authHeaders.authorization = `Bearer ${data.session.access_token}`;
  }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body && !isFormData && !isBlob ? { "content-type": "application/json" } : {}),
      ...authHeaders,
      ...init.headers,
    },
  });
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiRawFetch(path, {
    ...init,
    headers: {
      accept: "application/json",
      ...init.headers,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export function normalizeUser(user: Omit<CloudflareUser, "user_metadata"> | null): CloudflareUser | null {
  if (!user) return null;
  return {
    ...user,
    user_metadata: {
      name: user.display_name || undefined,
      full_name: user.display_name || undefined,
      avatar_url: user.avatar_url || undefined,
    },
  };
}

export function googleSignInUrl(returnTo = "/") {
  const safe = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  return `${API_BASE}/api/auth/google/start?return_to=${encodeURIComponent(safe)}`;
}
