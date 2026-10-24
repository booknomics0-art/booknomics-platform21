// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { POST } from '../../api/translate';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('rejects anonymous requests before invoking any provider',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const response=await POST(new Request('https://booknomics.com/api/translate',{method:'POST',body:'{}'}));
 expect(response.status).toBe(401);expect(fetch).not.toHaveBeenCalled();
});
it('fails closed if its private server configuration is missing',async()=>{
 vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const response=await POST(new Request('https://booknomics.com/api/translate',{method:'POST',headers:{Authorization:'Bearer test'},body:'{}'}));
 expect(response.status).toBe(503);expect(fetch).not.toHaveBeenCalled();expect(response.headers.get('Cache-Control')).toBe('no-store');
});
