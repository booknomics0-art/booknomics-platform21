# Booknomics Pinterest MCP

Remote MCP server for the Booknomics Pinterest account (Pinterest API v5).
Read tools work as soon as a token is set; write tools are blocked behind an env switch and default to `dry_run: true`.

## Vercel setup

Import the existing GitHub repository `booknomics0-art/booknomics-platform21` as a **new Vercel project** and set **Root Directory** to `pinterest-mcp`.

Environment variables:

- `PINTEREST_ACCESS_TOKEN` — Pinterest API v5 access token (sensitive)
- `PINTEREST_API_BASE` — defaults to `https://api.pinterest.com/v5`
- `ENABLE_PINTEREST_WRITES` — keep `false` until the endpoint is secured and tested
- `MCP_SHARED_SECRET` — optional; when set, every request must send `Authorization: Bearer <secret>` or `x-mcp-secret: <secret>`

MCP endpoint after deploy:

`https://<project-domain>/api/mcp`

## Getting a token

Pinterest API v5 uses OAuth 2.0:

1. Create an app at <https://developers.pinterest.com/apps/> and add the redirect URI.
2. Send the user to `https://www.pinterest.com/oauth/?response_type=code&client_id=<APP_ID>&redirect_uri=<REDIRECT>&scope=boards:read,pins:read,boards:write,pins:write&state=<random>`.
3. Exchange the `code` at `POST https://api.pinterest.com/v5/oauth/token` with HTTP Basic auth (`client_id:client_secret`) and `grant_type=authorization_code`.
4. Tokens expire (access ~30 days, refresh ~60 days). Refresh with `grant_type=refresh_token` before expiry.

Keep the token in Vercel env vars only — never commit it, and never paste it into a chat.

## Tools

- `pinterest_config_status` — configured? writes enabled? secrets never returned
- `pinterest_get_account` — connected account profile
- `pinterest_list_boards` — boards with `page_size` / `bookmark` pagination
- `pinterest_list_board_pins` — pins in a board
- `pinterest_get_pin` — single pin by ID
- `pinterest_pin_analytics` — impressions, saves, clicks for a date range
- `pinterest_create_board` — dry_run by default
- `pinterest_create_pin` — image-URL pin, dry_run by default
- `booknomics_create_book_pin` — structured Booknomics book-cover pin, dry_run by default

Write tools throw unless `ENABLE_PINTEREST_WRITES=true`.

## Connect it to an MCP client

- **Arena agent mode:** open the connector/integration settings, add a custom MCP server by URL (`https://<project-domain>/api/mcp`) if your plan exposes that option, plus the `Authorization` header if `MCP_SHARED_SECRET` is set. After it is connected it appears in the conversation's connected apps and the agent can load its tools.
- **Claude / Cursor / ChatGPT (developer mode):** add the same URL as a remote MCP server.

## Local test

```bash
cd pinterest-mcp
cp .env.example .env.local
npm install --legacy-peer-deps
npm run dev
# then point an MCP inspector at http://localhost:3000/api/mcp
```

## Notes

- Pinterest requires pins to come from a publicly reachable image URL (use the book cover CDN URL).
- Pinterest rate limits are per-app; polling tools should keep `page_size` small.
- Without `MCP_SHARED_SECRET` the endpoint is public. Anyone with the URL who also has the token can read the account's boards — set the secret before sharing the URL.
