import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { OtpInput } from './OtpInput';

/** A controlled harness, because OtpInput is a controlled component. */
function Harness({ dir = 'ltr', disabled }: { dir?: 'ltr' | 'rtl'; disabled?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <div dir={dir}>
      <OtpInput value={value} onChange={setValue} disabled={disabled} />
      <output data-testid="value">{value}</output>
    </div>
  );
}

const boxes = () => screen.getAllByRole('textbox') as HTMLInputElement[];

describe('OtpInput', () => {
  it('renders six real inputs with numeric hints and per-digit labels', () => {
    render(<Harness />);
    const inputs = boxes();

    expect(inputs).toHaveLength(6);
    inputs.forEach((input, i) => {
      expect(input).toHaveAttribute('inputmode', 'numeric');
      expect(input).toHaveAttribute('maxlength', '1');
      expect(input).toHaveAccessibleName(`Digit ${i + 1}`);
    });
    // One-time-code autofill belongs on the first box only.
    expect(inputs[0]).toHaveAttribute('autocomplete', 'one-time-code');
    expect(inputs[1]).toHaveAttribute('autocomplete', 'off');
  });

  it('stays dir="ltr" inside an RTL page — a numeric code is not mirrored', () => {
    const { container } = render(<Harness dir="rtl" />);
    expect(container.querySelector('.portal-otp-row')).toHaveAttribute('dir', 'ltr');
  });

  it('advances focus as digits are typed', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const inputs = boxes();

    await user.click(inputs[0]);
    await user.keyboard('12');

    expect(screen.getByTestId('value')).toHaveTextContent('12');
    expect(inputs[2]).toHaveFocus();
  });

  it('drops non-digits', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(boxes()[0]);
    await user.keyboard('a');

    expect(screen.getByTestId('value').textContent).toBe('');
  });

  it('retreats on Backspace in an empty box', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const inputs = boxes();

    await user.click(inputs[0]);
    await user.keyboard('1');
    expect(inputs[1]).toHaveFocus();

    await user.keyboard('{Backspace}');
    expect(inputs[0]).toHaveFocus();
  });

  it('fills all six from a six-digit paste into any box', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const inputs = boxes();

    await user.click(inputs[2]);
    await user.paste('123456');

    expect(screen.getByTestId('value')).toHaveTextContent('123456');
    expect(inputs.map((i) => i.value).join('')).toBe('123456');
    expect(inputs[5]).toHaveFocus();
  });

  it('disables every box when disabled', () => {
    render(<Harness disabled />);
    boxes().forEach((input) => expect(input).toBeDisabled());
  });
});
