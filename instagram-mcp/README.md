# Booknomics Instagram MCP

Remote MCP server for the Booknomics Instagram professional account.

## Vercel setup

Import the existing GitHub repository `booknomics0-art/booknomics-platform21` as a **new Vercel project** and set **Root Directory** to `instagram-mcp`.

Add these environment variables in Vercel:

- `META_ACCESS_TOKEN` — sensitive Meta access token
- `META_PAGE_ID=1106012512606232`
- `INSTAGRAM_ACCOUNT_ID=17841477248413420`
- `INSTAGRAM_USERNAME=booknomics_official`
- `META_GRAPH_VERSION=v26.0`
- `ENABLE_INSTAGRAM_WRITES=false`

Deploy first with writes disabled. The MCP endpoint will be:

`https://<project-domain>/api/mcp`

After read-only testing and endpoint security are complete, change `ENABLE_INSTAGRAM_WRITES` to `true` and redeploy.

## Tools

- `instagram_config_status`
- `instagram_get_profile`
- `instagram_list_media`
- `instagram_get_media`
- `instagram_publish_image`
- `instagram_publish_reel`
- `booknomics_publish_book_post`

Publishing tools use `dry_run=true` by default.
