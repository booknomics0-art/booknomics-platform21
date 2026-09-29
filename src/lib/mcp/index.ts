import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchBooks from "./tools/search-books";
import getBookSummary from "./tools/get-book-summary";
import listMyLibrary from "./tools/list-my-library";
import addBookToLibrary from "./tools/add-book-to-library";

import { supabaseProjectUrl } from "./supabase";
import updateBook from "./tools/admin-update-book";
import adminBookWorkflow from "./tools/admin-book-workflow";

export default defineMcp({
  name: "book-insight-hub",
  title: "Book Insight Hub",
  version: "0.3.0",
  instructions:
    "Tools for Booknomics, a library of AI-curated book summaries in English and Hindi. Use search_books and get_book_summary for readers; list_my_library and add_book_to_library for signed-in users. Admins can create a draft, generate long-form content, generate a premium cover, generate a persistent 8–20 minute audio podcast (15 minutes by default), update book fields, and publish after review. Do not publish incomplete content or regenerate paid assets unless requested.",
  auth: auth.oauth.issuer({
    issuer: `${supabaseProjectUrl()}/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchBooks, getBookSummary, listMyLibrary, addBookToLibrary, updateBook, ...adminBookWorkflow],
});
