import { screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { RequirePortalSession } from './RequirePortalSession';
import { setPortalToken } from '../api/portalClient';
import { renderPortal } from '../testUtils';

/**
 * Test 22 — the portal's RequireAuth analogue. No token -> back to /portal;
 * a token renders the guarded child.
 */
describe('RequirePortalSession', () => {
  beforeEach(() => setPortalToken(null));
  afterEach(() => setPortalToken(null));

  const tree = (
    <Routes>
      <Route path="/portal" element={<div data-testid="access" />} />
      <Route element={<RequirePortalSession />}>
        <Route path="/portal/requests" element={<div data-testid="guarded" />} />
      </Route>
    </Routes>
  );

  it('redirects to /portal when there is no token', () => {
    renderPortal(tree, { route: '/portal/requests' });
    expect(screen.getByTestId('access')).toBeInTheDocument();
    expect(screen.queryByTestId('guarded')).not.toBeInTheDocument();
  });

  it('renders the guarded child when a token is present', () => {
    setPortalToken('portal-token');
    renderPortal(tree, { route: '/portal/requests' });
    expect(screen.getByTestId('guarded')).toBeInTheDocument();
  });
});
