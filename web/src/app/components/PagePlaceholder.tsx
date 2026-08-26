import React from 'react';

export const PagePlaceholder: React.FC<{ title: string }> = ({ title }) => (
  <div data-testid="page-placeholder">
    <h1>{title}</h1>
    <p>This screen is built in its own feature story.</p>
  </div>
);
