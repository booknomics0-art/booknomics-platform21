import { z } from 'zod';
import { createMcpHandler } from 'mcp-handler';

export const runtime = 'nodejs';
export const maxDuration = 60;

const graphVersion = process.env.META_GRAPH_VERSION || 'v26.0';
const graphBase = `https://graph.facebook.com/${graphVersion}`;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function writesEnabled(): boolean {
  return process.env.ENABLE_INSTAGRAM_WRITES === 'true';
}

async function graphGet(path: string, params: Record<string, string> = {}) {
  const token = env('META_ACCESS_TOKEN');
  const url = new URL(`${graphBase}/${path.replace(/^\//, '')}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `Meta API GET failed (${response.status})`);
  }
  return data;
}

async function graphPost(path: string, params: Record<string, string>) {
  const token = env('META_ACCESS_TOKEN');
  const response = await fetch(`${graphBase}/${path.replace(/^\//, '')}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  const data = await response.json();
  if (!response.ok || data?.error) {
    throw new Error(data?.error?.message || `Meta API POST failed (${response.status})`);
  }
  return data;
}

async function waitForContainer(creationId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const status = await graphGet(creationId, { fields: 'status_code,status' });
    if (status.status_code === 'FINISHED') return status;
    if (status.status_code === 'ERROR' || status.status_code === 'EXPIRED') {
      throw new Error(`Instagram media container ${status.status_code}: ${status.status || ''}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error('Instagram media container did not finish within the polling window.');
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

const handler = createMcpHandler((server) => {
  server.registerTool(
    'instagram_config_status',
    {
      title: 'Instagram Config Status',
      description: 'Checks whether the Booknomics Instagram MCP server is configured. Never returns secret values.',
      inputSchema: z.object({}),
    },
    async () => {
      const required = ['META_ACCESS_TOKEN', 'INSTAGRAM_ACCOUNT_ID', 'META_PAGE_ID'];
      const missing = required.filter((name) => !process.env[name]);
      return text({
        configured: missing.length === 0,
        missing,
        graph_version: graphVersion,
        instagram_username: process.env.INSTAGRAM_USERNAME || null,
        writes_enabled: writesEnabled(),
      });
    },
  );

  server.registerTool(
    'instagram_get_profile',
    {
      title: 'Get Instagram Profile',
      description: 'Reads the connected Booknomics Instagram professional account profile.',
      inputSchema: z.object({}),
    },
    async () => {
      const igId = env('INSTAGRAM_ACCOUNT_ID');
      const data = await graphGet(igId, {
        fields: 'id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url',
      });
      return text(data);
    },
  );

  server.registerTool(
    'instagram_list_media',
    {
      title: 'List Instagram Media',
      description: 'Lists recent Instagram media for the connected Booknomics account.',
      inputSchema: z.object({ limit: z.number().int().min(1).max(25).default(10) }),
    },
    async ({ limit }) => {
      const igId = env('INSTAGRAM_ACCOUNT_ID');
      const data = await graphGet(`${igId}/media`, {
        fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username',
        limit: String(limit),
      });
      return text(data);
    },
  );

  server.registerTool(
    'instagram_get_media',
    {
      title: 'Get Instagram Media',
      description: 'Reads one Instagram media object by ID.',
      inputSchema: z.object({ media_id: z.string().min(1) }),
    },
    async ({ media_id }) => {
      const data = await graphGet(media_id, {
        fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username',
      });
      return text(data);
    },
  );

  server.registerTool(
    'instagram_publish_image',
    {
      title: 'Publish Instagram Image',
      description: 'Creates and publishes a single image post. Dry-run is on by default. Live publishing is blocked unless ENABLE_INSTAGRAM_WRITES=true.',
      inputSchema: z.object({
        image_url: z.url(),
        caption: z.string().max(2200).default(''),
        dry_run: z.boolean().default(true),
      }),
    },
    async ({ image_url, caption, dry_run }) => {
      if (dry_run) {
        return text({ dry_run: true, image_url, caption, would_publish_to: process.env.INSTAGRAM_USERNAME || 'connected account' });
      }
      if (!writesEnabled()) {
        throw new Error('Live Instagram writes are disabled. Set ENABLE_INSTAGRAM_WRITES=true only after securing and testing the MCP endpoint.');
      }
      const igId = env('INSTAGRAM_ACCOUNT_ID');
      const container = await graphPost(`${igId}/media`, { image_url, caption });
      await waitForContainer(container.id);
      const published = await graphPost(`${igId}/media_publish`, { creation_id: container.id });
      return text({ published: true, creation_id: container.id, media_id: published.id });
    },
  );

  server.registerTool(
    'instagram_publish_reel',
    {
      title: 'Publish Instagram Reel',
      description: 'Creates and publishes a Reel from a public video URL. Dry-run is on by default. Live publishing is blocked unless ENABLE_INSTAGRAM_WRITES=true.',
      inputSchema: z.object({
        video_url: z.url(),
        caption: z.string().max(2200).default(''),
        share_to_feed: z.boolean().default(true),
        dry_run: z.boolean().default(true),
      }),
    },
    async ({ video_url, caption, share_to_feed, dry_run }) => {
      if (dry_run) {
        return text({ dry_run: true, media_type: 'REELS', video_url, caption, share_to_feed });
      }
      if (!writesEnabled()) {
        throw new Error('Live Instagram writes are disabled. Set ENABLE_INSTAGRAM_WRITES=true only after securing and testing the MCP endpoint.');
      }
      const igId = env('INSTAGRAM_ACCOUNT_ID');
      const container = await graphPost(`${igId}/media`, {
        media_type: 'REELS',
        video_url,
        caption,
        share_to_feed: String(share_to_feed),
      });
      await waitForContainer(container.id);
      const published = await graphPost(`${igId}/media_publish`, { creation_id: container.id });
      return text({ published: true, creation_id: container.id, media_id: published.id });
    },
  );

  server.registerTool(
    'booknomics_publish_book_post',
    {
      title: 'Publish Booknomics Book Post',
      description: 'Publishes a Booknomics book-cover post with a structured caption. Dry-run is on by default.',
      inputSchema: z.object({
        title: z.string().min(1).max(180),
        author: z.string().min(1).max(160),
        cover_url: z.url(),
        book_url: z.url(),
        language: z.enum(['English', 'Hindi']).default('English'),
        extra_caption: z.string().max(900).optional(),
        dry_run: z.boolean().default(true),
      }),
    },
    async ({ title, author, cover_url, book_url, language, extra_caption, dry_run }) => {
      const caption = [
        `📚 ${title}`,
        `✍️ ${author}`,
        '',
        extra_caption?.trim() || (language === 'Hindi'
          ? 'Booknomics पर इस किताब का सार, मुख्य विचार और actionable insights पढ़ें।'
          : 'Read the summary, key ideas and actionable insights on Booknomics.'),
        '',
        `🔗 ${book_url}`,
        '',
        language === 'Hindi'
          ? '#Booknomics #HindiBooks #BookSummary #Books'
          : '#Booknomics #Books #BookSummary #Reading',
      ].join('\n');

      if (dry_run) {
        return text({ dry_run: true, title, author, cover_url, book_url, caption });
      }
      if (!writesEnabled()) {
        throw new Error('Live Instagram writes are disabled. Set ENABLE_INSTAGRAM_WRITES=true only after securing and testing the MCP endpoint.');
      }
      const igId = env('INSTAGRAM_ACCOUNT_ID');
      const container = await graphPost(`${igId}/media`, { image_url: cover_url, caption });
      await waitForContainer(container.id);
      const published = await graphPost(`${igId}/media_publish`, { creation_id: container.id });
      return text({ published: true, title, media_id: published.id, creation_id: container.id });
    },
  );
});

export { handler as GET, handler as POST };
