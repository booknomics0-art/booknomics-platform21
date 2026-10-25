export const EDITABLE_BOOK_FIELDS = [
  "title", "author", "category", "language", "slug", "tagline", "overview",
  "key_ideas", "deep_summary", "deep_analysis", "daily_application", "action_system",
  "practice_tracker", "reflection_questions", "real_life_example", "affiliate_link",
  "cover_url", "reading_time", "rating", "year",
] as const;

export type EditableBookField = typeof EDITABLE_BOOK_FIELDS[number];
type NumericBookField = "reading_time" | "rating" | "year";
export type EditableBook = { id: string; is_draft?: boolean; status?: string; seo_slug?: string | null } &
  Record<Exclude<EditableBookField, NumericBookField>, string | null> &
  Record<NumericBookField, number | null>;

/** PATCH only actual edits. Unrelated book fields stay untouched on the server. */
export function changedBookFields(original: EditableBook, edit: EditableBook) {
  const patch: Partial<Record<EditableBookField, string | number | null>> = {};
  const expected: Partial<Record<EditableBookField, string | number | null>> = {};
  for (const key of EDITABLE_BOOK_FIELDS) {
    if (edit[key] !== original[key]) {
      patch[key] = edit[key];
      expected[key] = original[key];
    }
  }
  return { patch, expected };
}
