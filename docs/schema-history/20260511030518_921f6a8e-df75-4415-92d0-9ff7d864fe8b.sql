
REVOKE ALL ON FUNCTION public.award_points(uuid,int,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_award_book_complete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_award_discussion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_award_library_save() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_award_helpful_vote() FROM PUBLIC, anon, authenticated;
