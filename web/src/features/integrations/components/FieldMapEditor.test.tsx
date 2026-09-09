import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { FieldMapEditor } from './FieldMapEditor';
import { I18nextProvider, i18n } from '../../../i18n';
import type { ConflictRule } from '../model/types';

function Wrapper() {
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [conflictRules, setConflictRules] = useState<Record<string, ConflictRule>>({});
  return (
    <I18nextProvider i18n={i18n}>
      <FieldMapEditor
        fieldMap={fieldMap}
        conflictRules={conflictRules}
        onChangeFieldMap={setFieldMap}
        onChangeConflictRules={setConflictRules}
      />
    </I18nextProvider>
  );
}

describe('FieldMapEditor', () => {
  it('renders one row per SYNC_FIELDS entry plus external_id, with no conflict select on the external_id row', () => {
    render(<Wrapper />);

    expect(screen.getByText('External ID')).toBeInTheDocument();
    for (const label of ['Name', 'Email', 'Phone', 'Company', 'Tier']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    // 5 mappable fields get a conflict select; external_id does not.
    expect(screen.getAllByRole('combobox')).toHaveLength(5);
  });

  it('the conflict select is disabled while the row path is empty, and enables once a path is typed', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const nameInput = screen.getByLabelText('Remote path for Name');
    const nameSelect = screen.getByLabelText('Conflict rule for Name');
    expect(nameSelect).toBeDisabled();

    await user.type(nameInput, 'attributes.display_name');
    expect(nameSelect).toBeEnabled();
  });
});
