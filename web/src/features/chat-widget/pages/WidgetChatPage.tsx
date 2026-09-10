import React, { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { i18n, useT } from '../../../i18n';
import { useWidgetChat } from '../hooks/useWidgetChat';
import { WidgetTranscript } from '../components/WidgetTranscript';
import { WidgetComposer } from '../components/WidgetComposer';
import { WidgetIdentifyForm } from '../components/WidgetIdentifyForm';

type WidgetLocale = 'en' | 'ar';

/** The browser decides — there is no signed-in visitor to carry a server
 *  preference for, mirroring `features/csat/model/csatStrings.ts`'s
 *  `detectCsatLocale`. */
function detectWidgetLocale(language: string | undefined = navigatorLanguage()): WidgetLocale {
  return (language ?? '').toLowerCase().startsWith('ar') ? 'ar' : 'en';
}

function navigatorLanguage(): string | undefined {
  return typeof navigator !== 'undefined' ? navigator.language : undefined;
}

function postHeight(value: number) {
  if (typeof window === 'undefined' || window.parent === window) return;
  window.parent.postMessage({ type: 'wisal-widget:height', value }, '*');
}

/**
 * Story 26 (WIS-22), Decisions 10 & 11. The iframe document `web/public/widget.js`
 * injects at `<origin>/widget/chat?key=<siteKey>`. Deliberately NOT wrapped in
 * `AppLayout` or `AuthContext` — a fourth audience, an anonymous visitor on a
 * third-party page — but still RTL-correct and fully translated.
 *
 * Reports its own content height to the parent frame on a `wisal-widget:`
 * prefixed postMessage channel and reads NOTHING back from the parent — the
 * host page is untrusted, so the trust boundary is one-directional.
 */
export const WidgetChatPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const siteKey = searchParams.get('key');
  const locale = detectWidgetLocale();
  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    const previousLanguage = i18n.language;
    if (i18n.language !== locale) {
      void i18n.changeLanguage(locale);
    }
    return () => {
      void i18n.changeLanguage(previousLanguage);
    };
  }, [locale]);

  useEffect(() => {
    const html = document.documentElement;
    const prevLang = html.getAttribute('lang');
    const prevDir = html.getAttribute('dir');
    html.setAttribute('lang', locale);
    html.setAttribute('dir', dir);
    return () => {
      if (prevLang) html.setAttribute('lang', prevLang);
      else html.removeAttribute('lang');
      if (prevDir) html.setAttribute('dir', prevDir);
      else html.removeAttribute('dir');
    };
  }, [locale, dir]);

  const { t } = useT('chat-widget');
  const { state, messages, identify, sendMessage, retry } = useWidgetChat(siteKey);
  const [identifying, setIdentifying] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const report = () => postHeight(Math.ceil(el.getBoundingClientRect().height));
    report();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [state, messages.length]);

  const handleIdentify = async (name: string, email: string) => {
    setIdentifying(true);
    try {
      await identify(name, email);
    } finally {
      setIdentifying(false);
    }
  };

  const handleSend = async (body: string) => {
    setSending(true);
    try {
      await sendMessage(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="widget-launcher-frame" ref={rootRef}>
      <header className="widget-launcher-header">
        <p className="widget-launcher-title">{t('title')}</p>
      </header>

      {state === 'loading' && (
        <div className="widget-launcher-loading" role="status" aria-label={t('loading')}>
          <span className="widget-launcher-spinner" aria-hidden="true" />
          <p>{t('loading')}</p>
        </div>
      )}

      {state === 'error' && (
        <div className="widget-launcher-error" role="alert">
          <p className="widget-launcher-error-title">{t('error.title')}</p>
          <p className="widget-launcher-error-body">{t('error.body')}</p>
          <button type="button" className="widget-launcher-retry" onClick={() => void retry()}>
            {t('error.retry')}
          </button>
        </div>
      )}

      {state === 'ended' && (
        <div className="widget-launcher-ended" role="status">
          <p className="widget-launcher-ended-title">{t('ended.title')}</p>
          <p className="widget-launcher-ended-body">{t('ended.body')}</p>
          <button type="button" className="widget-launcher-retry" onClick={() => void retry()}>
            {t('ended.startNew')}
          </button>
        </div>
      )}

      {(state === 'awaiting_identity' || state === 'active') && (
        <div className="widget-launcher-body">
          <WidgetTranscript messages={messages} />

          {state === 'awaiting_identity' && (
            <WidgetIdentifyForm submitting={identifying} onSubmit={handleIdentify} />
          )}

          <WidgetComposer disabled={false} sending={sending} onSend={handleSend} />
        </div>
      )}
    </div>
  );
};
