import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { NotebookPen, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface NoteRow {
  id: string; content: string; updated_at: string;
  books: { slug: string; title: string; author: string } | null;
}

export function NotesArchive({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase.from("book_notes")
      .select("id,content,updated_at,books(slug,title,author)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setNotes((data as any) ?? []));
  }, [userId]);

  const visible = open ? notes : notes.slice(0, 3);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-2xl font-bold flex items-center gap-2"><NotebookPen className="h-5 w-5 text-primary" /> Personal notes</h2>
          <span className="text-xs text-muted-foreground">{notes.length} {notes.length === 1 ? "note" : "notes"}</span>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Write reflections on book pages — they'll appear here.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {visible.map(n => (
                <li key={n.id} className="border-l-2 border-primary/40 pl-4 py-1">
                  <div className="text-sm whitespace-pre-wrap line-clamp-3">{n.content}</div>
                  {n.books && (
                    <Link to={`/books/${n.books.slug}`} className="text-xs text-primary hover:underline mt-1 inline-block">
                      → {n.books.title}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
            {notes.length > 3 && (
              <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setOpen(o => !o)}>
                {open ? <><ChevronUp className="h-4 w-4 mr-1" /> Show less</> : <><ChevronDown className="h-4 w-4 mr-1" /> Show all {notes.length}</>}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
