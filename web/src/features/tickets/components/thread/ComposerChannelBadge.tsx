import type { TicketChannel } from '../../model/ticket';
import { ChannelIcon } from '../ChannelIcon';
import { useT } from '../../../../i18n';

/**
 * Read-only indicator — no chevron, no picker (Product rules). Replies always
 * go on the ticket's original channel; the server copies `$ticket->channel`.
 */
export function ComposerChannelBadge({
  channel,
  label,
}: {
  channel: TicketChannel;
  label: string;
}) {
  const { t } = useT('conversation');
  return (
    <span
      className={`composer-channel${channel === 'whatsapp' ? ' composer-channel--wa' : ''}`}
      title={t('composerBadge.title')}
    >
      <ChannelIcon channel={channel} label={label} size={13} />
      {t('composerBadge.replyVia', { channel: label })}
    </span>
  );
}
