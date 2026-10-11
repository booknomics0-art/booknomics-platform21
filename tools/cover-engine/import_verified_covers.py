#!/usr/bin/env python3
"""Import a reviewed, immutable cover plan; retain old URLs for rollback."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ['SUPABASE_URL'].rstrip('/')
KEY = os.environ['SUPABASE_SERVICE_ROLE_KEY']
ROOT = Path(__file__).resolve().parents[2]
PLAN = json.loads((ROOT / 'tools/cover-engine/import-plan-20261011.json').read_text())
OUT = ROOT / 'out/cover-import-20261011'
OUT.mkdir(parents=True, exist_ok=True)
LOCK = threading.Lock()

def request(path, method='GET', body=None, extra=None, public=False):
    headers = {} if public else {'apikey': KEY, 'Authorization': 'Bearer ' + KEY}
    headers.update(extra or {})
    for attempt in range(4):
        try:
            req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
            with urllib.request.urlopen(req, timeout=90) as response:
                return response.read(), response.headers
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise RuntimeError(f'{method} {path}: HTTP {error.code}') from None
        except (TimeoutError, urllib.error.URLError):
            if attempt == 3:
                raise RuntimeError(f'{method} {path}: network failure') from None
        time.sleep(2 ** attempt)

def read_book(row):
    query = urllib.parse.urlencode({'select':'id,title,author,language,cover_url,status,is_draft', 'id':'eq.' + row['book_id']})
    data, _ = request('/rest/v1/books?' + query)
    books = json.loads(data)
    if len(books) != 1:
        raise ValueError('Book missing or ambiguous')
    return books[0]

def upload(row):
    result = {'book_id': row['book_id'], 'title': row['title'], 'language': row['language'], 'old_cover_url': row['old_cover_url']}
    try:
        file = ROOT / row['file']
        content = file.read_bytes()
        if hashlib.sha256(content).hexdigest() != row['sha256']:
            raise ValueError('Source checksum mismatch')
        current = read_book(row)
        if any(current[key] != row[key] for key in ('title','author','language')):
            raise ValueError('Book identity changed since review')
        public_path = '/storage/v1/object/public/book-covers/' + row['storage_path']
        url = BASE + public_path
        result['cover_url'] = url
        if current['cover_url'] not in (row['old_cover_url'], url):
            result['status'] = 'skipped-concurrent-cover-change'
            return result
        if current['cover_url'] != url:
            try:
                request('/storage/v1/object/book-covers/' + row['storage_path'], 'POST', content,
                        {'Content-Type':'image/jpeg', 'Cache-Control':'max-age=31536000', 'x-upsert':'false'})
            except RuntimeError as error:
                if 'HTTP 400' not in str(error) and 'HTTP 409' not in str(error):
                    raise
                # A retry can encounter an already uploaded object; verify it below.
        image, headers = request(public_path, public=True)
        if not headers.get('Content-Type','').startswith('image/') or hashlib.sha256(image).hexdigest() != row['sha256']:
            raise ValueError('Public image checksum verification failed')
        if current['cover_url'] != url:
            query = {'id':'eq.' + row['book_id'], 'cover_url': 'is.null' if row['old_cover_url'] is None else 'eq.' + row['old_cover_url']}
            data, _ = request('/rest/v1/books?' + urllib.parse.urlencode(query), 'PATCH',
                              json.dumps({'cover_url':url}).encode(),
                              {'Content-Type':'application/json','Prefer':'return=representation'})
            updated = json.loads(data)
            if len(updated) != 1 or updated[0]['cover_url'] != url:
                raise ValueError('Cover compare-and-set update did not affect exactly one book')
        after = read_book(row)
        if after['cover_url'] != url:
            raise ValueError('Database readback failed')
        result['status'] = 'verified'
        result['bytes'] = len(image)
        result['sha256'] = row['sha256']
    except Exception as error:
        result['status'] = 'error'
        result['error'] = str(error)
    finally:
        with LOCK:
            with (OUT / 'results.jsonl').open('a') as stream:
                stream.write(json.dumps(result,ensure_ascii=False) + '\n')
    return result

def main():
    if not KEY:
        raise SystemExit('Missing Supabase service role repository secret')
    if len({x['book_id'] for x in PLAN}) != len(PLAN):
        raise SystemExit('Duplicate target IDs')
    print(f'Importing {len(PLAN)} reviewed covers',flush=True)
    # A small pilot verifies permissions and public object delivery before bulk work.
    pilot = [next(x for x in PLAN if x['language'] == lang) for lang in ('en','hi')]
    results = [upload(row) for row in pilot]
    if any(x['status'] != 'verified' for x in results):
        print(json.dumps(results,ensure_ascii=False),flush=True)
        raise SystemExit('Pilot failed; bulk import was not started')
    print('English and Hindi pilot uploads verified',flush=True)
    pilot_ids = {x['book_id'] for x in pilot}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(upload,row) for row in PLAN if row['book_id'] not in pilot_ids]
        for future in concurrent.futures.as_completed(futures):
            result = future.result()
            results.append(result)
            if result['status'] == 'error':
                print(json.dumps(result,ensure_ascii=False),flush=True)
            if len(results) % 100 == 0:
                print(f'Processed {len(results)}/{len(PLAN)}; verified={sum(r["status"] == "verified" for r in results)}',flush=True)
    counts = {status:sum(x['status']==status for x in results) for status in sorted({x['status'] for x in results})}
    (OUT / 'summary.json').write_text(json.dumps({'counts':counts,'total':len(results)},indent=2))
    print(json.dumps(counts),flush=True)
    if counts.get('error'):
        raise SystemExit('Some covers require follow-up; see results artifact')

if __name__ == '__main__':
    main()
