import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nextProvider, i18n } from '../../i18n';

/**
 * Story 26 (WIS-22). Render harness for the chat-widget tests — no
 * `AppLayout`, no `AuthContext`, no `QueryClientProvider`: the page under
 * test uses none of them, matching `WidgetChatPage`'s own "fourth audience"
 * shape. Test-only, excluded from the i18n literal check by filename.
 */
export function renderWidget(ui: ReactNode, { route = '/widget/chat?key=demo-key' } = {}) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/widget/chat" element={ui} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>
  );
}
