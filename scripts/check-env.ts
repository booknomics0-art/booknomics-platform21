import { loadEnv } from 'vite';
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const url = env.VITE_SUPABASE_URL?.trim();
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!url || !key) throw new Error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY');
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) throw new Error('Use the new project HTTPS Supabase URL');
if (key.startsWith('sb_secret_')) throw new Error('Never put a secret key in a VITE_ variable');
if (!key.startsWith('sb_publishable_')) {
  try {
    const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (claims.role !== 'anon') throw new Error('Browser key must use anon role');
    if (claims.ref && !url.includes(`//${claims.ref}.`)) throw new Error('Key and project URL mismatch');
  } catch { throw new Error('Use a publishable key or an anon JWT for this same project'); }
}
console.log('Public environment configuration validated');
