import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrandingTab } from './BrandingTab';
import { I18nextProvider, i18n } from '../../../i18n';
import { api } from '../../../lib/api';

vi.mock('../../../lib/api', async () => {
  const actual = await vi.importActual('../../../lib/api');
  return { ...actual, api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() } };
});

const get = api.get as ReturnType<typeof vi.fn>;

function renderTab() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <BrandingTab />
      </QueryClientProvider>
    </I18nextProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockResolvedValue({ data: { data: { primary_color: null, logo_url: null, updated_at: null } } });
});

describe('BrandingTab', () => {
  // #0E7490 fails AA on this app's dark card background (Decision 8; see
  // model/contrast.test.ts) — Save changes must still stay enabled.
  it('shows the contrast warning for #0E7490 and keeps Save changes enabled', async () => {
    renderTab();
    const hexInput = await screen.findByDisplayValue('#4F46E5');

    await userEvent.clear(hexInput);
    await userEvent.type(hexInput, '#0E7490');

    expect(await screen.findByText(/Contrast warning:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('updates the warning text as the color changes', async () => {
    renderTab();
    const hexInput = await screen.findByDisplayValue('#4F46E5');

    await userEvent.clear(hexInput);
    await userEvent.type(hexInput, '#FDE68A');

    expect(await screen.findByText(/#FDE68A/)).toBeInTheDocument();
  });

  it('tracks the draft color in the live preview before any save', async () => {
    renderTab();
    const hexInput = await screen.findByDisplayValue('#4F46E5');

    await userEvent.clear(hexInput);
    await userEvent.type(hexInput, '#0E7490');

    const preview = document.querySelector('.org-brand-preview-row') as HTMLElement;
    expect(preview.style.color.toLowerCase()).toContain('14, 116, 144');
  });

  it('disables Remove with no stored logo', async () => {
    const { unmount } = renderTab();
    expect(await screen.findByRole('button', { name: 'Remove' })).toBeDisabled();
    unmount();
  });

  it('enables Remove once a logo exists', async () => {
    get.mockResolvedValue({
      data: { data: { primary_color: null, logo_url: 'https://example.test/storage/branding/x.png', updated_at: null } },
    });
    renderTab();
    expect(await screen.findByRole('button', { name: 'Remove' })).toBeEnabled();
  });

  it('reads the PNG/JPG/WEBP hint, not the artboard SVG copy', async () => {
    renderTab();

    expect(
      await screen.findByText('Recommended: PNG, JPG or WEBP, 256×256px, transparent background')
    ).toBeInTheDocument();
    expect(screen.queryByText(/SVG/)).not.toBeInTheDocument();
  });
});
