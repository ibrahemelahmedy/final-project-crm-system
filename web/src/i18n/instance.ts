import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enCustomers from './locales/en/customers.json';
import enTickets from './locales/en/tickets.json';
import enConversation from './locales/en/conversation.json';
import enSla from './locales/en/sla.json';
import enDashboard from './locales/en/dashboard.json';
import enUsers from './locales/en/users.json';
import enKnowledge from './locales/en/knowledge.json';
import enProductivity from './locales/en/productivity.json';
import enNotifications from './locales/en/notifications.json';
import enReports from './locales/en/reports.json';
import enCsat from './locales/en/csat.json';
import enChannels from './locales/en/channels.json';

import arCommon from './locales/ar/common.json';
import arAuth from './locales/ar/auth.json';
import arCustomers from './locales/ar/customers.json';
import arTickets from './locales/ar/tickets.json';
import arConversation from './locales/ar/conversation.json';
import arSla from './locales/ar/sla.json';
import arDashboard from './locales/ar/dashboard.json';
import arUsers from './locales/ar/users.json';
import arKnowledge from './locales/ar/knowledge.json';
import arProductivity from './locales/ar/productivity.json';
import arNotifications from './locales/ar/notifications.json';
import arReports from './locales/ar/reports.json';
import arCsat from './locales/ar/csat.json';
import arChannels from './locales/ar/channels.json';

export type Locale = 'en' | 'ar';

export const NAMESPACES = [
  'common',
  'auth',
  'customers',
  'tickets',
  'conversation',
  'sla',
  'dashboard',
  'users',
  'knowledge',
  'productivity',
  'notifications',
  'reports',
  'csat',
  'channels',
] as const;

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    customers: enCustomers,
    tickets: enTickets,
    conversation: enConversation,
    sla: enSla,
    dashboard: enDashboard,
    users: enUsers,
    knowledge: enKnowledge,
    productivity: enProductivity,
    notifications: enNotifications,
    reports: enReports,
    csat: enCsat,
    channels: enChannels,
  },
  ar: {
    common: arCommon,
    auth: arAuth,
    customers: arCustomers,
    tickets: arTickets,
    conversation: arConversation,
    sla: arSla,
    dashboard: arDashboard,
    users: arUsers,
    knowledge: arKnowledge,
    productivity: arProductivity,
    notifications: arNotifications,
    reports: arReports,
    csat: arCsat,
    channels: arChannels,
  },
} as const;

// Story 15, decision 1: i18next JSON v4 format (the modern default) delegates
// plural selection to `Intl.PluralRules`, which yields Arabic's six CLDR
// categories (zero/one/two/few/many/other) as separate suffixed keys.
// Do NOT set `compatibilityJSON` — leaving it at the default is what enables
// real Arabic plural rules instead of `count === 1`.

/** Humanise the last dotted segment: `tickets.queue.title` -> `Title`. */
function humanizeKey(key: string): string {
  const last = key.split(/[.:]/).pop() ?? key;
  const spaced = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : key;
}

let missingKeyCount = 0;
export const getMissingKeyCount = () => missingKeyCount;

function logMiss(label: string) {
  missingKeyCount += 1;
  const line = `[i18n] ${label}`;
  // eslint-disable-next-line no-console
  console.warn(import.meta.env?.DEV ? line : `${line} (miss #${missingKeyCount})`);
}

// i18next does NOT fire `missingKeyHandler` when a fallback-language value
// resolves — so "present in en, missing in ar" would silently pass. This
// post-processor runs on every `t()` result and catches exactly that case:
// the value still renders (English), but the miss is logged. Edge Case
// "a key present in en and missing in ar".
const missGuard = {
  type: 'postProcessor' as const,
  name: 'missGuard',
  process(value: string, key: string | string[], _opts: unknown, translator: { language?: string }) {
    const lng = translator?.language || i18n.language;
    if (lng && !lng.startsWith('en')) {
      const keys = Array.isArray(key) ? key : [key];
      for (const k of keys) {
        const inActive = i18n.exists(k, { lng, fallbackLng: [] as string[] });
        const inEnglish = i18n.exists(k, { lng: 'en', fallbackLng: [] as string[] });
        if (!inActive && inEnglish) {
          logMiss(`missing key "${k}" for ${lng} — rendered the English fallback`);
        }
      }
    }
    return value;
  },
};

i18n.use(missGuard).use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: ['en', 'ar'],
  ns: NAMESPACES as unknown as string[],
  defaultNS: 'common',
  returnEmptyString: false,
  saveMissing: true,
  postProcess: ['missGuard'],
  interpolation: { escapeValue: false },
  missingKeyHandler: (lngs, ns, key) => {
    logMiss(`missing key "${ns}:${key}" for ${lngs.join(',')}`);
  },
  // A miss degrades to the English value, then to a humanised last segment —
  // never to a raw dotted key and never to "".
  parseMissingKeyHandler: (key, defaultValue) => {
    if (typeof defaultValue === 'string' && defaultValue.length > 0) return defaultValue;
    const [ns, bareKey] = key.includes(':') ? key.split(/:(.+)/) : ['common', key];
    const enValue = i18n.getResource('en', ns, bareKey);
    if (typeof enValue === 'string' && enValue.length > 0) return enValue;
    return humanizeKey(key);
  },
});

export default i18n;
