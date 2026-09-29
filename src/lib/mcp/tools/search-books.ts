import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "search_books",
  title: "Search books",
  description:
    "Search Booknomics published book summaries by title, author, or category. Returns slug, title, author, category and language.",
  inputSchema: {
    query: z.string().trim().max(200).describe("Search text matched against book title and author."),
    language: z.enum(["en", "hi"]).optional().describe("Filter by language code."),
    category: z.string().trim().optional().describe("Filter by category name."),
    limit: z.number().int().optional().describe("Max results, default 10, max 50."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, language, category, limit }) => {
    const take = Math.min(Math.max(limit ?? 10, 1), 50);
    let q = supabaseAnon()
      .from("books")
      .select("slug,title,author,category,language,reading_time,rating")
      .eq("is_draft", false)
      .limit(take);
    const safeQuery = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").trim();
    if (safeQuery) q = q.or(`title.ilike.%${safeQuery}%,author.ilike.%${safeQuery}%`);
    if (language) q = q.eq("language", language);
    if (category) q = q.ilike("category", category);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { books: data ?? [] },
    };
  },
});
