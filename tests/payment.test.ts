// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createHmac, webcrypto } from 'node:crypto';
const createClient = vi.hoisted(() => vi.fn());
vi.mock('https://esm.sh/@supabase/supabase-js@2.45.0', () => ({ createClient }));
let handler: (r: Request) => Promise<Response>;
let subscription: Record<string, unknown>;
let update: ReturnType<typeof vi.fn>;
let provider: ReturnType<typeof vi.fn>;
const signature = () => createHmac('sha256', 'secret').update('order_test|pay_test').digest('hex');
const request = (sig = signature()) => new Request('https://example.com', {method:'POST', headers:{Authorization:'Bearer verified-user','Content-Type':'application/json'}, body:JSON.stringify({razorpay_order_id:'order_test',razorpay_payment_id:'pay_test',razorpay_signature:sig})});
beforeEach(async () => {
  vi.resetModules(); createClient.mockReset();
  subscription = {id:'sub',plan:'monthly',user_id:'user',status:'pending',amount:6900,currency:'INR'};
  update = vi.fn(() => {const q = {eq:()=>q, select:()=>q, maybeSingle:async()=>({data:{expires_at:'2026-10-29T00:00:00Z'},error:null})};return q;});
  const table = {select:()=>table,eq:()=>table,maybeSingle:async()=>({data:subscription,error:null}),update};
  createClient.mockReturnValue({auth:{getUser:async()=>({data:{user:{id:'user'}},error:null})},from:()=>table});
  provider = vi.fn(async()=>new Response(JSON.stringify({status:'captured',order_id:'order_test',amount:6900,currency:'INR'}),{status:200}));
  vi.stubGlobal('fetch',provider); vi.stubGlobal('crypto',webcrypto);
  vi.stubGlobal('Deno',{env:{get:(key:string)=>({RAZORPAY_KEY_SECRET:'secret',RAZORPAY_KEY_ID:'rzp_test_key',SUPABASE_URL:'https://example.com',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'}[key])},serve:(fn:typeof handler)=>{handler=fn;}});
  await import('../supabase/functions/razorpay-verify/index');
});
afterEach(()=>vi.unstubAllGlobals());
it('rejects invalid signatures before touching provider or entitlements',async()=>{
  expect((await handler(request('a'.repeat(64)))).status).toBe(400);expect(update).not.toHaveBeenCalled();expect(provider).not.toHaveBeenCalled();
});
it('returns existing expiry on replay',async()=>{
  subscription.status='active';subscription.razorpay_payment_id='pay_test';subscription.expires_at='2026-10-01T00:00:00Z';
  const response=await handler(request());expect(response.status).toBe(200);expect((await response.json()).expires_at).toBe(subscription.expires_at);expect(update).not.toHaveBeenCalled();
});
it('does not reactivate expired entitlements',async()=>{
  subscription.status='expired';subscription.razorpay_payment_id='pay_test';subscription.expires_at='2026-01-01T00:00:00Z';
  expect((await handler(request())).status).toBe(200);expect(update).not.toHaveBeenCalled();
});
it('requires capture before activation',async()=>{
  provider.mockResolvedValue(new Response(JSON.stringify({status:'authorized',order_id:'order_test',amount:6900,currency:'INR'})));
  expect((await handler(request())).status).toBe(409);expect(update).not.toHaveBeenCalled();
});
it('activates matching captured payments',async()=>{
  expect((await handler(request())).status).toBe(200);expect(update).toHaveBeenCalledTimes(1);
});
it('rejects amount mismatch',async()=>{
  provider.mockResolvedValue(new Response(JSON.stringify({status:'captured',order_id:'order_test',amount:1,currency:'INR'})));
  expect((await handler(request())).status).toBe(409);expect(update).not.toHaveBeenCalled();
});
