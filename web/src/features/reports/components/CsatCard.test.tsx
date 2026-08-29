import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CsatCard } from './CsatCard';

describe('CsatCard', () => {
  it('renders the "no CSAT data collected yet" Empty state and no chart element', () => {
    const { container } = render(<CsatCard block={{ available: false, reason: 'not_collected' }} />);

    expect(screen.getByText('No CSAT data collected yet.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('.recharts-responsive-container')).toBeNull();
  });
});
