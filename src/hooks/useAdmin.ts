import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { isAdminUser } from '@/lib/isAdmin';
export function useAdmin() {
  const auth = useAuth();
  const role = useQuery({
    queryKey: ['admin-role', auth.user?.id],
    queryFn: () => isAdminUser(auth.user!.id),
    enabled: !!auth.user && !auth.loading,
    staleTime: 0,
    retry: 1,
  });
  return { ...auth, isAdmin: !!auth.user && !role.isError && role.data === true,
    loading: auth.loading || (!!auth.user && role.isPending) };
}
