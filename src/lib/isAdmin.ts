import { supabase } from "@/integrations/supabase/client";
/** Database roles are authoritative; email and user_metadata are not permissions. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (error) throw error;
  return data === true;
}
