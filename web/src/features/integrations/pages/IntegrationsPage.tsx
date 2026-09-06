import { useSearchParams } from 'react-router-dom';
import { useT } from '../../../i18n';
import { useIntegrations } from '../hooks/useIntegrations';
import { IntegrationCard } from '../components/IntegrationCard';
import { IntegrationModal } from '../components/IntegrationModal';
import { IntegrationsSkeleton } from '../components/IntegrationsSkeleton';
import { IntegrationsError } from '../components/IntegrationsError';
import type { Integration } from '../model/types';

/**
 * Integrations (`/integrations`, Story 18 / WIS-19). Administrator-only; the
 * route guard in App.tsx is UX only — the `administrator` middleware on the
 * whole /api/admin/* group is the boundary, and AdminAuthorizationTest
 * proves it.
 *
 * Modal state lives in the URL (`?configure={type}`), following Story 06's
 * SLA Rules pattern, so a reload and the back button both behave.
 *
 * No Empty component: the API always returns all five types (Story 14's
 * "always return every enum case" contract), so the design's EMPTY artboard
 * is just five Not-connected cards — the success state, not an empty state.
 */
export function IntegrationsPage() {
  const { t } = useT('integrations');
  const [params, setParams] = useSearchParams();
  const query = useIntegrations();

  const integrations = query.data ?? [];
  const openType = params.get('configure');
  const opening = integrations.find((i) => i.type === openType) ?? null;

  const openModal = (integration: Integration) => setParams({ configure: integration.type });
  const closeModal = () => setParams({});

  return (
    <div className="intg-page">
      <header className="intg-head">
        <h1 className="intg-title">{t('title')}</h1>
        <p className="intg-subtitle">{t('subtitle')}</p>
      </header>

      {!query.isPending && <p className="intg-notice">{t('notice')}</p>}

      {query.isPending && <IntegrationsSkeleton />}

      {query.isError && <IntegrationsError onRetry={() => void query.refetch()} />}

      {!query.isPending && !query.isError && (
        <div className="intg-grid">
          {integrations.map((integration) => (
            <IntegrationCard key={integration.type} integration={integration} onOpen={openModal} />
          ))}
        </div>
      )}

      {opening && <IntegrationModal integration={opening} onClose={closeModal} />}
    </div>
  );
}
