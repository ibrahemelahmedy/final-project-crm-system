import { useQuery } from '@tanstack/react-query';
import { fetchPortalArticle, fetchPortalFaq } from '../api/portalApi';
import { portalKeys } from '../model/portalKeys';

export function usePortalFaqList(q: string) {
  return useQuery({
    queryKey: portalKeys.faq({ q }),
    queryFn: () => fetchPortalFaq(q ? { q } : {}),
  });
}

export function usePortalArticle(slug: string | undefined) {
  return useQuery({
    queryKey: portalKeys.article(slug ?? ''),
    queryFn: () => fetchPortalArticle(slug as string),
    enabled: !!slug,
  });
}
