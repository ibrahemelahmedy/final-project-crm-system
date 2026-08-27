import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useCustomer } from '../hooks/useCustomer';
import { CustomerAvatar } from '../components/CustomerAvatar';
import { CustomerTierBadge } from '../components/CustomerTierBadge';
import { CustomerFormModal } from '../components/CustomerFormModal';
import { InteractionHistory } from '../components/InteractionHistory';
import { NotesPanel } from '../components/NotesPanel';
import { AttachmentsPanel } from '../components/AttachmentsPanel';

// Route /customers/:customerId. No design export exists for this screen —
// composed from the modal's field styling, the table card's
// background/border/radius, and the empty-state geometry.
export const CustomerProfilePage: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const id = Number(customerId);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: customer, isLoading, isError, refetch } = useCustomer(id);
  const [editOpen, setEditOpen] = useState(false);

  const canSeeTeamQueue = user?.role === 'team_lead' || user?.role === 'administrator';

  if (isLoading) {
    return (
      <div className="profile-page">
        <p className="dt-empty-body">Loading customer…</p>
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="profile-page">
        <p className="dt-empty-body">Something went wrong loading this customer.</p>
        <button type="button" className="dt-btn dt-btn-primary fv" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <CustomerAvatar initials={customer.initials} size={48} />
        <div className="profile-header-info">
          <h1>{customer.name}</h1>
          <span className="profile-header-meta">
            {customer.company ?? '—'} <CustomerTierBadge tier={customer.tier} label={customer.tier_label} />
          </span>
        </div>
        <div className="profile-header-actions">
          <button type="button" className="dt-btn dt-btn-primary fv" onClick={() => setEditOpen(true)}>
            Edit
          </button>
          <Link to="/customers" className="dt-btn dt-btn-outline fv">
            Back to customers
          </Link>
        </div>
      </div>

      <div className="profile-grid">
        <div className="profile-column">
          <InteractionHistory customerId={customer.id} />
        </div>
        <div className="profile-column">
          <section className="profile-panel" aria-label="Contact details">
            <h2>Contact details</h2>
            <dl className="contact-details">
              <dt>Email</dt>
              <dd>{customer.email ?? '—'}</dd>
              <dt>Phone</dt>
              <dd>{customer.phone ?? '—'}</dd>
              <dt>Company</dt>
              <dd>{customer.company ?? '—'}</dd>
            </dl>
          </section>
          <NotesPanel customerId={customer.id} />
          <AttachmentsPanel
            customerId={customer.id}
            canDeleteAny={canSeeTeamQueue}
            currentUserId={user?.id ?? 0}
          />
        </div>
      </div>

      <CustomerFormModal
        open={editOpen}
        customer={customer}
        onClose={() => setEditOpen(false)}
        onDeleted={() => navigate('/customers')}
      />
    </div>
  );
};
