import { supabase } from "@/integrations/supabase/client";
/**
 * The public admin RPC checks the *current authenticated user* against the
 * private role table. The old public.has_role RPC no longer exists after the
 * security migration, so calling it always hid the admin portal.
 *
 * Never grant access based on an email supplied by the browser.
 */
export async function isAdminUser(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin_email');
  if (error) throw error;
  return data === true;
}
