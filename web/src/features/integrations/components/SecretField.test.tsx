import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { SecretField } from './SecretField';
import { I18nextProvider, i18n } from '../../../i18n';

function Wrapper({ secretLastFour }: { secretLastFour: string | null }) {
  const [value, setValue] = useState('');
  return (
    <I18nextProvider i18n={i18n}>
      <SecretField value={value} onChange={setValue} secretLastFour={secretLastFour} />
    </I18nextProvider>
  );
}

describe('SecretField', () => {
  it('disables Reveal and Copy, and shows the saved-key hint, while the input is empty', () => {
    render(<Wrapper secretLastFour="5678" />);

    expect(screen.getByRole('button', { name: 'Reveal' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeDisabled();
    expect(screen.getByText('Saved key ends in 5678. Leave blank to keep it.')).toBeInTheDocument();
  });

  it('enables Reveal and Copy once a value is typed', async () => {
    const user = userEvent.setup();
    render(<Wrapper secretLastFour="5678" />);

    await user.type(screen.getByLabelText('API key / secret'), 'sk_new_value');

    expect(screen.getByRole('button', { name: 'Reveal' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeEnabled();
    // The saved-key hint disappears once something is typed.
    expect(screen.queryByText(/Saved key ends in/)).not.toBeInTheDocument();
  });

  it('Reveal switches the input to plain text, showing exactly what was typed', async () => {
    const user = userEvent.setup();
    render(<Wrapper secretLastFour={null} />);

    const input = screen.getByLabelText('API key / secret');
    await user.type(input, 'sk_typed_value');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Reveal' }));

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('sk_typed_value');
  });

  it('resets to hidden on unmount and remount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Wrapper secretLastFour={null} />);

    const input = screen.getByLabelText('API key / secret');
    await user.type(input, 'sk_typed_value');
    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(input).toHaveAttribute('type', 'text');

    unmount();
    render(<Wrapper secretLastFour={null} />);

    expect(screen.getByLabelText('API key / secret')).toHaveAttribute('type', 'password');
  });
});
