# n8n: Cover Forge batch workflow

`cover-batch.workflow.json` is an importable n8n workflow (n8n → Workflows →
Import from File). It does not re-implement the generator; it shells out to the
same CLI this repository already ships, so the two can never drift apart.

> The **Execute Command** node is only available on self-hosted n8n (it is
> disabled on n8n Cloud). The machine running n8n needs the repo checked out,
> Node 22, `npm install && node fetch-fonts.mjs` done once in
> `tools/cover-forge`, and `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in the
> n8n process environment (Settings → Environment variables), never in the
> request body.

## Two entry points

| Trigger | Use |
| --- | --- |
| `POST /webhook/booknomics-covers` | manual / scripted batches |
| Schedule (Mondays 03:00) | top-up: books that still have no cover, 200 at a time |

Request body (all fields optional):

```json
{
  "source": "db",          // "db" (books table, missing covers only) or "drafts"
  "limit": 100,
  "offset": 0,
  "concurrency": 6,
  "template": "classic",   // force one layout, or omit for the normal cycle
  "seed": 0,               // change to regenerate a fresh set
  "artDir": "",            // /srv/booknomics/artwork for the AI-artwork track
  "upload": true,          // false = render + check only
  "skipExisting": true     // never overwrite a cover a human already approved
}
```

Response:

```json
{ "ok": true, "generated": 100, "failures": 0, "templates": {...}, "bytes": 4718592, "upload": true }
```

On failure the workflow answers 500 with the failing stage, stderr and the
command to reproduce it locally.

## Flow

```
webhook ─► validate ─► generate.mjs ─┬─► check.mjs ─┬─► upload.mjs --apply ─► report ─► respond
                                     │             └─► failure detail ─► respond (500)
                                     └─► failure detail
schedule ─► defaults ─► generate.mjs
```

## Operating notes

- `--skip-existing` in `upload.mjs` only skips books that already have a
  non-empty `cover_url`, so re-running the workflow is safe and cheap.
- Batches are shardable: run offsets `0/1000/2000` on three machines (or three
  workflow executions) and merge the manifests — template and palette cycles
  are computed from the book's position in the full list, so shards stay
  consistent with a single full run.
- Keep batches around 500 covers per execution. A full 3,000-cover run is
  3,000 × ~0.3 s ≈ 15 minutes of CPU, which is fine on a box but pointless in
  one n8n execution (timeouts, no partial results).
- If the quality gate fails, nothing is uploaded: n8n returns the failure while
  `covers/` keeps the generated files for inspection.
