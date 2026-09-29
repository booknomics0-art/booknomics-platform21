import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchBooks from "./tools/search-books";
import getBookSummary from "./tools/get-book-summary";
import listMyLibrary from "./tools/list-my-library";
import addBookToLibrary from "./tools/add-book-to-library";

import { supabaseProjectUrl } from "./supabase";
import updateBook from "./tools/admin-update-book";

export default defineMcp({
  name: "book-insight-hub",
  title: "Book Insight Hub",
  version: "0.2.0",
  instructions:
    "Tools for Booknomics (Book Insight Hub), a library of AI-curated book summaries in English and Hindi. Use `search_books` to find books, `get_book_summary` to read a full summary, `list_my_library` to see the signed-in user's saved books and progress, and `add_book_to_library` to save a book for them. Admins can use admin_update_book to edit public book content. It does not edit website code or deployment settings.",
  auth: auth.oauth.issuer({
    issuer: `${supabaseProjectUrl()}/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchBooks, getBookSummary, listMyLibrary, addBookToLibrary, updateBook],
});
