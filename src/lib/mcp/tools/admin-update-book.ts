import { defineTool } from '@lovable.dev/mcp-js';
import { z } from 'zod';
import { supabaseForUser } from '../supabase';
export default defineTool({
  name: 'admin_update_book', title: 'Update book content (admin only)',
  description: 'Update the specified public fields of one existing book. Requires an administrator role. Returns the saved fields. Does not change premium content, publication status, URLs, users, billing, code, or infrastructure.',
  inputSchema: {
    book_id: z.string().uuid(),
    patch: z.object({
      title: z.string().trim().min(1).max(300).optional(),
      author: z.string().trim().min(1).max(200).optional(),
      tagline: z.string().trim().max(500).optional(),
      overview: z.string().trim().max(20000).optional(),
      category: z.string().trim().min(1).max(100).optional(),
      meta_title: z.string().trim().max(200).optional(),
      meta_description: z.string().trim().max(500).optional(),
    }).strict().refine(p => Object.keys(p).length > 0, 'Provide at least one field'),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ book_id, patch }, ctx) => {
    const fail = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });
    if (!ctx.isAuthenticated()) return fail('Authentication required');
    const db = supabaseForUser(ctx);
    const { data: allowed, error: roleError } = await db.rpc('has_role', { _user_id: ctx.getUserId(), _role: 'admin' });
    if (roleError || allowed !== true) return fail('Administrator role required');
    const { data, error } = await db.from('books').update(patch).eq('id', book_id)
      .select('id,title,author,tagline,overview,category,meta_title,meta_description').maybeSingle();
    if (error) return fail('Book update failed');
    if (!data) return fail('Book not found or access denied');
    return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: { book: data } };
  },
});
