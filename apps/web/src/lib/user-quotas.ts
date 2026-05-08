import { CONTROL_API } from '@syncode/contracts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client.js';

export const userQuotasQueryKey = ['users', 'me', 'quotas'] as const;

export function fetchUserQuotas() {
  return api(CONTROL_API.USERS.QUOTAS);
}

export function useUserQuotasQuery(enabled: boolean) {
  return useQuery({
    queryKey: userQuotasQueryKey,
    enabled,
    queryFn: fetchUserQuotas,
  });
}
