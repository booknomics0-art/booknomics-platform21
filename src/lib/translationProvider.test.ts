import { afterEach, describe, expect, it, vi } from 'vitest';
import { chunks, translateChunk } from '../../server/translation';
afterEach(()=>vi.unstubAllGlobals());
describe('translation provider',()=>{
 it('splits losslessly including markdown and paragraph boundaries',()=>{const s=('**दिन 1:** सीखें।\n\n').repeat(500);expect(chunks(s).join('')).toBe(s);expect(chunks(s).every(c=>c.length<=3501)).toBe(true);});
 it('fails closed without credentials',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);await expect(translateChunk('hello','en','hi',{})).rejects.toMatchObject({status:503,code:'PROVIDER_NOT_CONFIGURED'});expect(fetch).not.toHaveBeenCalled();});
 it('uses Gemini server credentials and parses a successful translation',async()=>{const fetch=vi.fn().mockResolvedValue(Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({translation:'नमस्ते'})}]}}]}));vi.stubGlobal('fetch',fetch);expect(await translateChunk('hello','en','hi',{GEMINI_API_KEY:'test'})).toBe('नमस्ते');expect(fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('test');});
 it.each([[401,'PROVIDER_AUTH'],[402,'PROVIDER_CREDITS'],[429,'PROVIDER_RATE_LIMIT']])('distinguishes provider %s',async(status,code)=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('secret upstream body',{status:Number(status)})));await expect(translateChunk('hello','en','hi',{GEMINI_API_KEY:'test'})).rejects.toMatchObject({code});});
 it('rejects truncated output',async()=>{vi.stubGlobal('fetch',vi.fn().mockResolvedValue(Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'{"translation":"short"}'}]}}]})));await expect(translateChunk('hello','en','hi',{GEMINI_API_KEY:'test'})).rejects.toMatchObject({code:'INCOMPLETE_TRANSLATION'});});
});
