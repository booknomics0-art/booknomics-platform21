
-- Tighten community_points: only owner can read own activity
DROP POLICY IF EXISTS "Points public read" ON public.community_points;
CREATE POLICY "Users read own points"
ON public.community_points
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Tighten referrals: only parties involved can read
DROP POLICY IF EXISTS "Referrals public read" ON public.referrals;
CREATE POLICY "Users read own referrals"
ON public.referrals
FOR SELECT
TO authenticated
USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

-- Tighten affiliate_clicks INSERT: prevent spoofing other users' user_id
DROP POLICY IF EXISTS "Anyone can log affiliate click" ON public.affiliate_clicks;
CREATE POLICY "Log affiliate click (own or anon)"
ON public.affiliate_clicks
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());
