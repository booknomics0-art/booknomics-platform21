import { createClient } from '@supabase/supabase-js';
import { FIELDS, chunks, translateChunk, TranslationError } from '../server/translation.js';
export const maxDuration = 300;
const reply = (status: number, body: unknown) => Response.json(body, {status,headers:{'Cache-Control':'no-store'}});
export async function POST(req: Request) {
  try {
    const token = req.headers.get('authorization');
    if (!token?.startsWith('Bearer ')) return reply(401,{error:'Sign in to translate this book.'});
    const url = process.env.SUPABASE_URL;
    const anon = process.env.SUPABASE_ANON_KEY;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anon || !service) return reply(503,{error:'Translation server configuration is incomplete.',code:'SERVER_NOT_CONFIGURED'});
    const client = createClient(url,anon,{global:{headers:{Authorization:token}},auth:{persistSession:false}});
    const {data:user,error:authError} = await client.auth.getUser();
    if (authError || !user.user) return reply(401,{error:'Sign in again to translate this book.'});
    const raw: unknown = await req.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return reply(400,{error:"Invalid request."});
    const body = raw as Record<string, string>;
    if (!/^[0-9a-f-]{36}$/i.test(body.bookId || '') || !['hi','en'].includes(body.targetLanguage)) return reply(400,{error:'Invalid book or target language.'});
    // Read authoritative public book content instead of offering an arbitrary-text AI proxy.
    const {data:book,error} = await client.from('books').select(`id,language,${FIELDS.join(',')}`).eq('id',body.bookId).eq('is_draft',false).in('status',['published','published_noindex']).maybeSingle();
    if (error || !book) return reply(404,{error:'Published book not found.'});
    const row = book as unknown as Record<string,string>;
    const source = row.language === 'hi' ? 'hi' : 'en';
    if (source === body.targetLanguage) return reply(400,{error:'Choose a different target language.'});
    const sections = Object.fromEntries(FIELDS.filter(k=>typeof row[k] === 'string' && row[k].trim()).map(k=>[k,row[k]]));
    if (!Object.keys(sections).length || Object.values(sections).join('').length > 100000) return reply(413,{error:'Book content exceeds translation limits or is empty.'});
    const work = Object.entries(sections).flatMap(([field,text])=>chunks(text).map((text,index)=>({field,text,index})));
    if (work.length > 36) return reply(413,{error:'Book needs too many translation chunks.'});
    const admin = createClient(url,service,{auth:{persistSession:false}});
    const {data:allowed,error:limitError} = await admin.rpc('consume_security_rate_limit',{_key:`translate:${user.user.id}`,_max_requests:10,_window_seconds:3600});
    if (limitError) return reply(503,{error:'Translation rate limiter unavailable. Please retry later.'});
    if (!allowed) return reply(429,{error:'Translation limit reached. Please retry later.'});
    const output: Record<string,string[]> = Object.fromEntries(Object.keys(sections).map(k=>[k,[]]));
    const signal = AbortSignal.timeout(260000);
    for (let i=0;i<work.length;i+=3) {
      const batch = work.slice(i,i+3);
      const result = await Promise.all(batch.map(c=>translateChunk(c.text,source,body.targetLanguage,process.env,signal)));
      batch.forEach((c,j)=>output[c.field][c.index]=result[j]);
    }
    return reply(200,{sections:Object.fromEntries(Object.entries(output).map(([k,v])=>[k,v.join('')])),targetLanguage:body.targetLanguage});
  } catch (e) {
    if (e instanceof TranslationError) return reply(e.status,{error:e.message,code:e.code});
    console.error('translation_failed',e instanceof Error ? e.name : 'unknown');
    return reply(502,{error:'Translation could not finish. Original text is preserved.'});
  }
}
