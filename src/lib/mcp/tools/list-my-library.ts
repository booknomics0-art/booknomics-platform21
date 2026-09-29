import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_library",
  title: "List my library",
  description: "List the books saved in the signed-in user's Booknomics library, with reading progress.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const [{ data: lib, error }, { data: progress }] = await Promise.all([
      supabase.from("library").select("book_id,created_at,books(slug,title,author,category,language)"),
      supabase.from("reading_progress").select("book_id,completed,last_read_at"),
    ]);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const items = (lib ?? []).map((row: any) => ({
      ...(row.books ?? {}),
      saved_at: row.created_at,
      progress: (progress ?? []).find((p: any) => p.book_id === row.book_id) ?? null,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(items) }],
      structuredContent: { items },
    };
  },
});
