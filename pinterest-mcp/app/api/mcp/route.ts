import { z } from 'zod';
import { createMcpHandler } from 'mcp-handler';

export const runtime = 'nodejs';
export const maxDuration = 60;

const apiBase = process.env.PINTEREST_API_BASE || 'https://api.pinterest.com/v5';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function writesEnabled(): boolean {
  return process.env.ENABLE_PINTEREST_WRITES === 'true';
}

async function apiRequest(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; params?: Record<string, string>; body?: unknown } = {},
) {
  const token = env('PINTEREST_ACCESS_TOKEN');
  const url = new URL(`${apiBase}/${path.replace(/^\//, '')}`);
  Object.entries(options.params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const raw = await response.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    const message =
      data?.message || data?.error?.message || data?.error_description || `Pinterest API ${response.status} ${response.statusText}`;
    throw new Error(`${message}${data?.code ? ` (code ${data.code})` : ''}`);
  }
  return data;
}

function text(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function pinSummary(pin: any) {
  return {
    id: pin?.id,
    title: pin?.title,
    description: pin?.description,
    link: pin?.link,
    alt_text: pin?.alt_text,
    created_at: pin?.created_at,
    board_id: pin?.board_id,
    board_name: pin?.board_name || pin?.board_owner?.username,
    dominant_color: pin?.dominant_color,
    media: pin?.media?.images?.['600x']?.url || pin?.media?.images?.['1200x']?.url || null,
  };
}

type ListBoardsArgs = { page_size: number; bookmark?: string };
type ListBoardPinsArgs = { board_id: string; page_size: number; bookmark?: string };
type GetPinArgs = { pin_id: string };
type PinAnalyticsArgs = {
  pin_id: string;
  start_date: string;
  end_date: string;
  metric_types: Array<'IMPRESSION' | 'SAVE' | 'PIN_CLICK' | 'OUTBOUND_CLICK' | 'ENGAGEMENT' | 'VIDEO_MRC_VIEW'>;
};
type CreateBoardArgs = { name: string; description?: string; privacy: 'PUBLIC' | 'PROTECTED' | 'SECRET'; dry_run: boolean };
type CreatePinArgs = {
  board_id: string;
  image_url: string;
  title: string;
  description: string;
  link?: string;
  alt_text?: string;
  dry_run: boolean;
};
type BookPinArgs = {
  title: string;
  author: string;
  board_id: string;
  cover_url: string;
  book_url: string;
  language: 'English' | 'Hindi';
  extra_description?: string;
  dry_run: boolean;
};

const handler = createMcpHandler((server) => {
  server.registerTool(
    'pinterest_config_status',
    {
      title: 'Pinterest Config Status',
      description: 'Checks whether the Booknomics Pinterest MCP server is configured. Never returns secret values.',
      inputSchema: z.object({}),
    },
    async () => {
      const required = ['PINTEREST_ACCESS_TOKEN'];
      const missing = required.filter((name) => !process.env[name]);
      return text({
        configured: missing.length === 0,
        missing,
        api_base: apiBase,
        writes_enabled: writesEnabled(),
        endpoint_secured: Boolean(process.env.MCP_SHARED_SECRET),
      });
    },
  );

  server.registerTool(
    'pinterest_get_account',
    {
      title: 'Get Pinterest Account',
      description: 'Reads the connected Pinterest account profile (username, account type, follower counts).',
      inputSchema: z.object({}),
    },
    async () => {
      const data = await apiRequest('user_account');
      return text(data);
    },
  );

  server.registerTool(
    'pinterest_list_boards',
    {
      title: 'List Pinterest Boards',
      description: 'Lists boards of the connected Pinterest account. Use the bookmark value from a response to fetch the next page.',
      inputSchema: z.object({
        page_size: z.number().int().min(1).max(100).default(25),
        bookmark: z.string().optional(),
      }),
    },
    async ({ page_size, bookmark }: ListBoardsArgs) => {
      const data = await apiRequest('boards', {
        params: { page_size: String(page_size), bookmark: bookmark || '' },
      });
      return text({
        bookmark: data?.bookmark || null,
        count: data?.items?.length || 0,
        boards: (data?.items || []).map((board: any) => ({
          id: board.id,
          name: board.name,
          description: board.description,
          privacy: board.privacy,
          pin_count: board.pin_count,
          follower_count: board.follower_count,
        })),
      });
    },
  );

  server.registerTool(
    'pinterest_list_board_pins',
    {
      title: 'List Board Pins',
      description: 'Lists pins inside a Pinterest board. Use pinterest_list_boards to find a board_id.',
      inputSchema: z.object({
        board_id: z.string().min(1),
        page_size: z.number().int().min(1).max(100).default(25),
        bookmark: z.string().optional(),
      }),
    },
    async ({ board_id, page_size, bookmark }: ListBoardPinsArgs) => {
      const data = await apiRequest(`boards/${encodeURIComponent(board_id)}/pins`, {
        params: { page_size: String(page_size), bookmark: bookmark || '' },
      });
      return text({
        bookmark: data?.bookmark || null,
        count: data?.items?.length || 0,
        pins: (data?.items || []).map(pinSummary),
      });
    },
  );

  server.registerTool(
    'pinterest_get_pin',
    {
      title: 'Get Pinterest Pin',
      description: 'Reads a single Pinterest pin by ID.',
      inputSchema: z.object({ pin_id: z.string().min(1) }),
    },
    async ({ pin_id }: GetPinArgs) => {
      const data = await apiRequest(`pins/${encodeURIComponent(pin_id)}`);
      return text(pinSummary(data));
    },
  );

  server.registerTool(
    'pinterest_pin_analytics',
    {
      title: 'Pinterest Pin Analytics',
      description: 'Reads analytics metrics for one pin (impressions, saves, clicks, etc.) between two dates.',
      inputSchema: z.object({
        pin_id: z.string().min(1),
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        metric_types: z
          .array(z.enum(['IMPRESSION', 'SAVE', 'PIN_CLICK', 'OUTBOUND_CLICK', 'ENGAGEMENT', 'VIDEO_MRC_VIEW']))
          .default(['IMPRESSION', 'SAVE', 'PIN_CLICK', 'OUTBOUND_CLICK']),
      }),
    },
    async ({ pin_id, start_date, end_date, metric_types }: PinAnalyticsArgs) => {
      const data = await apiRequest(`pins/${encodeURIComponent(pin_id)}/analytics`, {
        params: { start_date, end_date, metric_types: metric_types.join(',') },
      });
      return text(data);
    },
  );

  server.registerTool(
    'pinterest_create_board',
    {
      title: 'Create Pinterest Board',
      description: 'Creates a board on the connected account. Dry-run is on by default. Live writes are blocked unless ENABLE_PINTEREST_WRITES=true.',
      inputSchema: z.object({
        name: z.string().min(1).max(180),
        description: z.string().max(500).optional(),
        privacy: z.enum(['PUBLIC', 'PROTECTED', 'SECRET']).default('PUBLIC'),
        dry_run: z.boolean().default(true),
      }),
    },
    async ({ name, description, privacy, dry_run }: CreateBoardArgs) => {
      if (dry_run) return text({ dry_run: true, would_create: { name, description, privacy } });
      if (!writesEnabled()) {
        throw new Error('Live Pinterest writes are disabled. Set ENABLE_PINTEREST_WRITES=true only after securing and testing the MCP endpoint.');
      }
      const data = await apiRequest('boards', {
        method: 'POST',
        body: { name, description, privacy },
      });
      return text({ created: true, id: data?.id, name: data?.name });
    },
  );

  server.registerTool(
    'pinterest_create_pin',
    {
      title: 'Create Pinterest Pin',
      description: 'Creates a pin from a public image URL. Dry-run is on by default. Live writes are blocked unless ENABLE_PINTEREST_WRITES=true.',
      inputSchema: z.object({
        board_id: z.string().min(1),
        image_url: z.string().url(),
        title: z.string().max(100).default(''),
        description: z.string().max(800).default(''),
        link: z.string().url().optional(),
        alt_text: z.string().max(500).optional(),
        dry_run: z.boolean().default(true),
      }),
    },
    async ({ board_id, image_url, title, description, link, alt_text, dry_run }: CreatePinArgs) => {
      const payload = {
        board_id,
        title,
        description,
        link,
        alt_text,
        media_source: { source_type: 'image_url', url: image_url },
      };
      if (dry_run) return text({ dry_run: true, would_create: payload });
      if (!writesEnabled()) {
        throw new Error('Live Pinterest writes are disabled. Set ENABLE_PINTEREST_WRITES=true only after securing and testing the MCP endpoint.');
      }
      const data = await apiRequest('pins', { method: 'POST', body: payload });
      return text({ created: true, id: data?.id, board_id: data?.board_id, link: data?.link });
    },
  );

  server.registerTool(
    'booknomics_create_book_pin',
    {
      title: 'Create Booknomics Book Pin',
      description:
        'Creates a Booknomics book-cover pin with a structured title/description and book link. Dry-run is on by default.',
      inputSchema: z.object({
        title: z.string().min(1).max(180),
        author: z.string().min(1).max(160),
        board_id: z.string().min(1),
        cover_url: z.string().url(),
        book_url: z.string().url(),
        language: z.enum(['English', 'Hindi']).default('English'),
        extra_description: z.string().max(400).optional(),
        dry_run: z.boolean().default(true),
      }),
    },
    async ({ title, author, board_id, cover_url, book_url, language, extra_description, dry_run }: BookPinArgs) => {
      const pinTitle = `${title} — Book Summary`.slice(0, 100);
      const description = [
        extra_description?.trim() ||
          (language === 'Hindi'
            ? `${title} की किताब का सार, मुख्य विचार और actionable insights Booknomics पर पढ़ें।`
            : `Key ideas, summary and actionable insights from ${title} by ${author} on Booknomics.`),
        '',
        language === 'Hindi' ? '#Booknomics #HindiBooks #BookSummary #Books' : '#Booknomics #Books #BookSummary #Reading',
      ]
        .join('\n')
        .slice(0, 800);

      const payload = {
        board_id,
        title: pinTitle,
        description,
        link: book_url,
        alt_text: `${title} by ${author} — book summary on Booknomics`,
        media_source: { source_type: 'image_url', url: cover_url },
      };

      if (dry_run) return text({ dry_run: true, would_create: payload });
      if (!writesEnabled()) {
        throw new Error('Live Pinterest writes are disabled. Set ENABLE_PINTEREST_WRITES=true only after securing and testing the MCP endpoint.');
      }
      const data = await apiRequest('pins', { method: 'POST', body: payload });
      return text({ created: true, id: data?.id, title: pinTitle, board_id: data?.board_id, link: data?.link });
    },
  );
});

function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  });
}

async function guarded(request: Request) {
  const secret = process.env.MCP_SHARED_SECRET;
  if (secret) {
    const header = request.headers.get('authorization') || '';
    const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
    const direct = request.headers.get('x-mcp-secret') || '';
    if (bearer !== secret && direct !== secret) return unauthorized();
  }
  return handler(request);
}

export { guarded as GET, guarded as POST };
