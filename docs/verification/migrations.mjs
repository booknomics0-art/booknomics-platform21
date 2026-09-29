import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT current_user::text $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY, name text, public boolean);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
`);
const dir=new URL('../../supabase/migrations/', import.meta.url).pathname;
let count=0;
for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort()){
 try {await db.exec(readFileSync(dir+'/'+name,'utf8'));count++;}
 catch(e){console.log('FAIL',name,e.message);process.exit(1);}
}
console.log('Migration replay PASS',count);
console.log('Tables', (await db.query("select count(*) from pg_tables where schemaname='public'")).rows);
console.log('Unprotected tables',(await db.query("select tablename from pg_tables where schemaname='public' and not rowsecurity")).rows);
console.log('Buckets',(await db.query('select id from storage.buckets')).rows);
// The old owner's email alone must not authorize administration.
await db.exec(`set role authenticated; set request.jwt.claims = '{"email":"amansrivast2104@gmail.com"}';`);
console.log('Old email bypass',(await db.query('select public.is_admin_email() allowed')).rows);
await db.exec('reset role');
await db.exec(`insert into auth.users(id, raw_user_meta_data, email) values ('00000000-0000-0000-0000-000000000001','{}','owner@example.com');
insert into public.books(id,slug,title,author,category) values ('00000000-0000-0000-0000-000000000002','test-book','Test','Author','Business');
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-000000000001';`);
const denied = await db.query("update public.books set title='Unauthorized' where slug='test-book' returning title");
if (denied.rows.length) throw new Error('Non-admin edit was allowed');
await db.exec(`reset role; insert into public.user_roles(user_id,role) values('00000000-0000-0000-0000-000000000001','admin'); set role authenticated;`);
const allowed = await db.query("update public.books set title='Authorized' where slug='test-book' returning title");
if (allowed.rows[0]?.title !== 'Authorized') throw new Error('Admin edit failed');
await db.exec('reset role');
const audited = await db.query('select count(*) from private.book_edit_audit');
if (audited.rows[0].count !== 1) throw new Error('Audit row missing');
console.log('Admin/non-admin write isolation and edit audit PASS');
await db.exec('set role anon');
try { await db.query('select deep_summary from public.books'); throw new Error('Premium exposure'); }
catch (e) { if (e.message === 'Premium exposure') throw e; if (!e.message.includes('permission denied')) throw e; }
console.log('Anonymous premium column denial PASS');
await db.close();
