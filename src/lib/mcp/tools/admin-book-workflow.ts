import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, supabaseProjectUrl } from "../supabase";

const fail = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true });

async function adminDb(ctx: any) {
  if (!ctx.isAuthenticated()) throw new Error("Authentication required");
  const db = supabaseForUser(ctx);
  const { data: allowed, error } = await db.rpc("has_role", {
    _user_id: ctx.getUserId(),
    _role: "admin",
  });
  if (error || allowed !== true) throw new Error("Administrator role required");
  return db;
}

async function invokeAdminFunction(ctx: any, functionName: string, body: Record<string, unknown>) {
  await adminDb(ctx);
  const token = ctx.getToken();
  const response = await fetch(`${supabaseProjectUrl()}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { ok: response.ok, content_type: contentType };
  if (!response.ok || payload?.error) throw new Error(payload?.error || `${functionName} failed`);
  return payload;
}

export const createBook = defineTool({
  name: "admin_create_book",
  title: "Create a Booknomics book draft (admin only)",
  description: "Create a new draft book record before generating its summary, cover and podcast. Use a stable lowercase URL slug. The book is not public until admin_publish_book is called.",
  inputSchema: {
    title: z.string().trim().min(1).max(300),
    author: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase ASCII words separated by hyphens"),
    category: z.string().trim().min(1).max(100),
    language: z.enum(["en", "hi"]),
    year: z.number().int().min(0).max(2200).optional(),
    tagline: z.string().trim().max(500).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ title, author, slug, category, language, year, tagline }, ctx) => {
    try {
      const db = await adminDb(ctx);
      const { data, error } = await db.from("books").insert({
        title, author, slug, category, language, year: year ?? null, tagline: tagline ?? null,
        is_draft: true, status: "pending", seo_slug: slug,
      }).select("id,slug,title,author,category,language,year,is_draft,status").single();
      if (error) return fail(error.code === "23505" ? "A book with this slug already exists" : "Book creation failed");
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: { book: data } };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Book creation failed");
    }
  },
});

export const generateBookContent = defineTool({
  name: "admin_generate_book_content",
  title: "Generate Booknomics long-form book content (admin only)",
  description: "Generate Booknomics editorial content for an existing draft: overview, approximately 1,800–2,200 word deep summary, key ideas, analysis, applications, reflection questions and action system.",
  inputSchema: {
    book_id: z.string().uuid(),
    language: z.enum(["en", "hi"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ book_id, language }, ctx) => {
    try {
      const data = await invokeAdminFunction(ctx, "generate-book-content", { book_id, language });
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: { result: data } };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Content generation failed");
    }
  },
});

export const generateBookCover = defineTool({
  name: "admin_generate_book_cover",
  title: "Generate and attach a premium book cover (admin only)",
  description: "Generate a portrait cover for an existing Booknomics book, upload it to Booknomics storage, and save the public cover URL on the book.",
  inputSchema: {
    book_id: z.string().uuid(),
    prompt: z.string().trim().max(2000).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ book_id, prompt }, ctx) => {
    try {
      const data = await invokeAdminFunction(ctx, "generate-book-cover", { book_id, prompt });
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: { result: data } };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Cover generation failed");
    }
  },
});

export const generateBookPodcast = defineTool({
  name: "admin_generate_book_podcast",
  title: "Generate and attach a book podcast (admin only)",
  description: "Create a persistent Hindi or English narrated podcast for a published Booknomics book. Default target is 15 minutes; use 8–20 minutes when a different length is requested. The MP3 is stored once and attached to book_assets.audio_url.",
  inputSchema: {
    book_id: z.string().uuid(),
    language: z.enum(["en", "hi"]).optional(),
    duration_minutes: z.number().int().min(8).max(20).default(15),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
  handler: async ({ book_id, language, duration_minutes }, ctx) => {
    try {
      const data = await invokeAdminFunction(ctx, "generate-book-podcast", {
        book_id,
        language,
        duration_minutes,
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: { result: data } };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Podcast generation failed");
    }
  },
});

export const publishBook = defineTool({
  name: "admin_publish_book",
  title: "Publish a Booknomics book (admin only)",
  description: "Make an existing book publicly visible after its content and cover have been reviewed. This sets is_draft=false and status=published.",
  inputSchema: {
    book_id: z.string().uuid(),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ book_id }, ctx) => {
    try {
      const db = await adminDb(ctx);
      const { data: book, error: readError } = await db.from("books")
        .select("id,slug,title,overview,deep_summary,cover_url")
        .eq("id", book_id).maybeSingle();
      if (readError || !book) return fail("Book not found");
      if (!book.overview || !book.deep_summary || !book.cover_url) {
        return fail("Book needs overview, deep summary and cover before publication");
      }
      const { data, error } = await db.from("books")
        .update({ is_draft: false, status: "published" })
        .eq("id", book_id)
        .select("id,slug,title,is_draft,status,cover_url")
        .single();
      if (error) return fail("Book publication failed");
      return { content: [{ type: "text" as const, text: JSON.stringify(data) }], structuredContent: { book: data } };
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Book publication failed");
    }
  },
});

export default [createBook, generateBookContent, generateBookCover, generateBookPodcast, publishBook];
