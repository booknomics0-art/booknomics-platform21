import { loadEnv } from 'vite';

const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
// Cloudflare is the migration branch's primary backend. Supabase remains available
// only as an explicit rollback mode until parity and production smoke tests pass.
const backend = (env.VITE_DATA_BACKEND || 'cloudflare').trim().toLowerCase();

if (backend === 'cloudflare') {
  const apiBase = (env.VITE_API_BASE || '').trim();
  if (apiBase && !/^https:\/\//.test(apiBase) && !apiBase.startsWith('/')) {
    throw new Error('VITE_API_BASE must be an HTTPS URL or a same-origin path');
  }
  console.log('Cloudflare backend environment configuration validated');
} else if (backend === 'supabase') {
  const url = env.VITE_SUPABASE_URL?.trim();
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error('Use the project HTTPS Supabase URL');
  if (key.startsWith('sb_secret_')) throw new Error('Never put a secret key in a VITE_ variable');
  if (!key.startsWith('sb_publishable_')) {
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
      if (claims.role !== 'anon') throw new Error('Browser key must use anon role');
      if (claims.ref && !url.includes(`//${claims.ref}.`)) throw new Error('Key and project URL mismatch');
    } catch {
      throw new Error('Use a publishable key or an anon JWT for this same project');
    }
  }
  console.log('Supabase rollback environment configuration validated');
} else {
  throw new Error(`Unsupported VITE_DATA_BACKEND: ${backend}`);
}
