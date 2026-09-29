# Booknomics API and MCP

Implementation exists in the source; no hosted endpoint was deployed or verified.
Use the NEW Supabase project's URL after setup. Do not use the old project reference.

## MCP and REST tool interface

Base: `https://<new-project-ref>.supabase.co/functions/v1/mcp`

The pinned @lovable.dev/mcp-js adapter provides Streamable HTTP MCP and:

- `/.well-known/oauth-protected-resource`: resource metadata.
- `/.mcp/list-tools`: REST tool catalog.
- `/.mcp/invoke-tool/<tool>`: REST dispatcher for a tool.

These are suffixes under the base URL. See the installed adapter documentation
for its request envelope. Authentication is OAuth against the destination Supabase
issuer. Register/authorize ChatGPT using the actual deployed MCP URL after enabling
the hosted Supabase OAuth Server and /oauth/consent UI. Do not paste a service key
into ChatGPT's connector configuration.

| Tool | Purpose | Permissions |
|---|---|---|
| search_books | Search published titles/authors/category | Returns public fields only |
| get_book_summary | Read one published overview by canonical slug | Returns public fields only |
| list_my_library | Read saved books and progress | Verified user, RLS own rows |
| add_book_to_library | Save a book; duplicate saves ignored | Verified user, RLS own rows |
| admin_update_book | Update selected public content of an existing book by UUID | Verified admin role + RLS |

Admin changes are limited to title, author, tagline, overview, category, meta_title
and meta_description. The private database trigger records old/new book values,
actor and timestamp. The tool cannot deploy code, edit UI, change payment records,
manage users or delete books. Website source changes require GitHub/Vercel access.

The OAuth consent text now mentions admin book editing. These are application-level
role checks; separate per-tool OAuth scopes were not implemented. Do not connect
an administrator account to an untrusted MCP client. Concurrent edits use normal
last-write-wins behavior; optimistic concurrency is a future enhancement.

## Supabase Data API

Supabase provides `/rest/v1/<table>` and `/rest/v1/rpc/<function>` without another
custom REST server. Use the public apikey plus the caller's bearer token. Public
books SELECT must explicitly name permitted columns; select=* is intentionally
blocked because premium columns are protected. Premium content is returned through
get_premium_summary only for entitled users/admins.

## Required hosted validation

Check unauthenticated/expired/wrong-issuer tokens, two users' library isolation,
non-admin rejection of admin_update_book, successful admin edit + audit row,
repeat library-save behavior, OAuth discovery/consent/refresh/revocation, and the
MCP initialize/list/call lifecycle in ChatGPT. No ChatGPT connector was created in
this session. Public-field tools may still require OAuth at the adapter gate.
