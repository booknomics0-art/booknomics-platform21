import { personalSupabase } from '@/lib/personalSupabase';

function client() {
  if (!personalSupabase) throw new Error('Personal Supabase is not configured');
  return personalSupabase;
}

export interface PersonalHabitEntry {
  day_number: number;
  done: boolean;
  score: number;
  notes: string | null;
}

export interface PersonalBookNote {
  id: string;
  book_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
}

export async function getReadingGoal(userId: string): Promise<number> {
  const { data, error } = await client().from('profiles').select('daily_goal_minutes').eq('id', userId).single();
  if (error) throw error;
  return Number(data.daily_goal_minutes) || 15;
}

export async function saveReadingGoal(userId: string, minutes: number): Promise<void> {
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 60) throw new Error('Invalid reading goal');
  const { error } = await client().from('profiles').update({ daily_goal_minutes: minutes }).eq('id', userId);
  if (error) throw error;
}

export async function getHabitEntries(userId: string, bookId: string): Promise<PersonalHabitEntry[]> {
  const { data, error } = await client().from('habit_entries')
    .select('day_number,done,score,notes').eq('user_id', userId).eq('book_id', bookId).order('day_number');
  if (error) throw error;
  return (data || []) as PersonalHabitEntry[];
}

export async function saveHabitEntry(userId: string, bookId: string, entry: PersonalHabitEntry): Promise<void> {
  if (!Number.isInteger(entry.day_number) || entry.day_number < 1 || entry.day_number > 7 ||
      !Number.isInteger(entry.score) || entry.score < 0 || entry.score > 5) throw new Error('Invalid practice entry');
  const { error } = await client().from('habit_entries').upsert({
    user_id: userId, book_id: bookId, day_number: entry.day_number,
    done: entry.done, score: entry.score, notes: entry.notes,
  }, { onConflict: 'user_id,book_id,day_number' });
  if (error) throw error;
}

export async function markBookCompleted(userId: string, bookId: string): Promise<void> {
  const { error } = await client().from('reading_progress').upsert({
    user_id: userId, book_id: bookId, completed: true, last_read_at: new Date().toISOString(),
  }, { onConflict: 'user_id,book_id' });
  if (error) throw error;
}

export async function getBookNotes(userId: string, bookId: string): Promise<PersonalBookNote[]> {
  const { data, error } = await client().from('book_notes').select('id,book_id,content,created_at,updated_at')
    .eq('user_id', userId).eq('book_id', bookId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as PersonalBookNote[];
}

export async function addBookNote(userId: string, bookId: string, content: string): Promise<PersonalBookNote> {
  const clean = content.trim();
  if (!clean || clean.length > 10000) throw new Error('Note must be between 1 and 10,000 characters');
  const { data, error } = await client().from('book_notes').insert({
    user_id: userId, book_id: bookId, content: clean,
  }).select('id,book_id,content,created_at,updated_at').single();
  if (error) throw error;
  return data as PersonalBookNote;
}

export async function deleteBookNote(userId: string, noteId: string): Promise<void> {
  const { error } = await client().from('book_notes').delete().eq('user_id', userId).eq('id', noteId);
  if (error) throw error;
}

export interface PersonalArchiveNote extends PersonalBookNote {
  slug: string | null;
  title: string | null;
  author: string | null;
}

export async function getNotesArchive(userId: string): Promise<PersonalArchiveNote[]> {
  const db = client();
  const [notes, saved] = await Promise.all([
    db.from('book_notes').select('id,book_id,content,created_at,updated_at')
      .eq('user_id', userId).order('updated_at', { ascending: false }).limit(100),
    db.from('library').select('book_id,book_slug,book_title,book_author').eq('user_id', userId).limit(500),
  ]);
  if (notes.error) throw notes.error;
  if (saved.error) throw saved.error;
  const books = new Map((saved.data || []).map(book => [book.book_id, book]));
  return (notes.data || []).map(note => {
    const book = books.get(note.book_id);
    return {
      ...note,
      slug: book?.book_slug || null,
      title: book?.book_title || null,
      author: book?.book_author || null,
    };
  });
}

export async function isEnrolled(userId: string, pathId: string): Promise<boolean> {
  const { data, error } = await client().from('path_enrollments')
    .select('id').eq('user_id', userId).eq('path_id', pathId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function setEnrolled(userId: string, pathId: string, value: boolean): Promise<void> {
  const db = client();
  const result = value
    ? await db.from('path_enrollments').upsert({ user_id: userId, path_id: pathId }, { onConflict: 'user_id,path_id' })
    : await db.from('path_enrollments').delete().eq('user_id', userId).eq('path_id', pathId);
  if (result.error) throw result.error;
}

type DashboardBook = {
  id: string; slug: string; title: string; author: string;
  cover_color: string; cover_url: string | null;
};
type DashboardBadge = {
  book_id: string; quiz_score: number; quiz_total: number; badge_awarded: boolean;
  books: Omit<DashboardBook, 'id' | 'author'> | null;
};

export async function getPersonalDashboard(userId: string) {
  const db = client();
  const [profile, library, progress, habits, mastery] = await Promise.all([
    db.from('profiles').select('streak_count').eq('id', userId).single(),
    db.from('library').select('book_id,book_title,book_slug,book_author,book_category,book_cover_color,book_cover_url,created_at')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(500),
    db.from('reading_progress').select('book_id,completed').eq('user_id', userId).limit(500),
    db.from('habit_entries').select('done').eq('user_id', userId).limit(1000),
    db.from('user_book_mastery').select('book_id,quiz_score,quiz_total,badge_awarded,completed_at')
      .eq('user_id', userId).eq('badge_awarded', true).order('completed_at', { ascending: false }).limit(6),
  ]);
  for (const result of [profile, library, progress, habits, mastery]) if (result.error) throw result.error;
  const saved = library.data || [];
  const savedById = new Map(saved.map(book => [book.book_id, book]));
  const completedBooks = new Set((progress.data || []).filter(row => row.completed).map(row => row.book_id));
  const recent: DashboardBook[] = saved.slice(0, 4).map(book => ({
    id: book.book_id, slug: book.book_slug, title: book.book_title, author: book.book_author,
    cover_color: book.book_cover_color, cover_url: book.book_cover_url,
  }));
  const badges: DashboardBadge[] = (mastery.data || []).map(row => {
    const book = savedById.get(row.book_id);
    return {
      book_id: row.book_id, quiz_score: row.quiz_score, quiz_total: row.quiz_total,
      badge_awarded: row.badge_awarded,
      books: book ? { title: book.book_title, slug: book.book_slug,
        cover_color: book.book_cover_color, cover_url: book.book_cover_url } : null,
    };
  });
  const categories = new Map<string, number>();
  for (const book of saved) categories.set(book.book_category || 'Books', (categories.get(book.book_category || 'Books') || 0) + 1);
  return {
    streak: Number(profile.data?.streak_count || 0),
    stats: {
      completed: completedBooks.size,
      inProgress: Math.max(0, (progress.data || []).filter(row => !row.completed).length),
      totalHabits: (habits.data || []).length,
      doneHabits: (habits.data || []).filter(row => row.done).length,
      // We do not have a measured reading duration in the new schema yet.
      hoursSaved: 0,
      masterBadges: badges.length,
    },
    recent,
    categoryMap: [...categories.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    badges,
  };
}
