import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { RatingGroup } from './RatingGroup';
import { CSAT_STRINGS } from '../model/csatStrings';

function Harness({ onChange }: { onChange?: (n: number) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <RatingGroup
      value={value}
      onChange={(n) => {
        setValue(n);
        onChange?.(n);
      }}
      strings={CSAT_STRINGS.en}
    />
  );
}

describe('RatingGroup', () => {
  it('gives each option an accessible name combining the number and the label', () => {
    render(<Harness />);
    expect(screen.getByRole('radio', { name: '1 – Poor' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '5 – Great' })).toBeInTheDocument();
  });

  it('moves selection with the arrow keys and reflects it via the radio checked state', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const first = screen.getByRole('radio', { name: '1 – Poor' });
    first.focus();
    await user.keyboard('{ArrowRight}');

    const second = screen.getByRole('radio', { name: '2 – Fair' }) as HTMLInputElement;
    expect(second.checked).toBe(true);
    expect((first as HTMLInputElement).checked).toBe(false);
  });

  it('calls onChange with the numeric rating', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: '4 – Good' }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('renders no radio inputs in read-only mode', () => {
    render(<RatingGroup value={3} readOnly strings={CSAT_STRINGS.en} />);
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect(screen.getByText('3 – Okay')).toBeInTheDocument();
  });
});
