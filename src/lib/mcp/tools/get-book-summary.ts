import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "get_book_summary",
  title: "Get book summary",
  description:
    "Fetch the public summary content for one Booknomics book by its slug (overview and metadata). Premium sections (action system, trackers) require a paid subscription on booknomics.com and are not returned here.",
  inputSchema: {
    slug: z.string().trim().describe("Book slug, e.g. 'atomic-habits'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const { data, error } = await supabaseAnon()
      .from("books")
      .select(
        "slug,title,author,category,language,reading_time,rating,tagline,overview,cover_url",
      )
      .eq("is_draft", false)
      .eq("slug", slug)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: `No published book found for slug '${slug}'.` }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { book: data },
    };
  },
});
