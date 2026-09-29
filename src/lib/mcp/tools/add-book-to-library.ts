import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_book_to_library",
  title: "Add book to my library",
  description: "Save a published Booknomics book to the signed-in user's library, by book slug.",
  inputSchema: {
    slug: z.string().trim().describe("Book slug to save, e.g. 'atomic-habits'."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: book, error: bookError } = await supabase
      .from("books")
      .select("id,slug,title")
      .eq("is_draft", false)
      .eq("slug", slug)
      .maybeSingle();
    if (bookError) return { content: [{ type: "text", text: bookError.message }], isError: true };
    if (!book) return { content: [{ type: "text", text: `No published book found for slug '${slug}'.` }], isError: true };

    const { error } = await supabase
      .from("library")
      .upsert({ user_id: ctx.getUserId()!, book_id: book.id }, { onConflict: "user_id,book_id", ignoreDuplicates: true });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Saved "${book.title}" to your library.` }],
      structuredContent: { saved: { slug: book.slug, title: book.title } },
    };
  },
});
