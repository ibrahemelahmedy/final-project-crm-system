import { Link } from 'react-router-dom';

function BackChevron() {
  // Mirrors under RTL by swapping the path — not scaleX(-1).
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={rtl ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'} />
    </svg>
  );
}

export function ThreadTopBar({ id, subject }: { id: number; subject: string }) {
  return (
    <div className="thread-topbar">
      <Link to="/tickets" className="thread-back">
        <BackChevron />
        Back to Tickets
      </Link>
      <span className="thread-topbar-divider" aria-hidden="true" />
      <span className="thread-topbar-id" dir="ltr">
        #{id}
      </span>
      <span className="thread-topbar-subject" title={subject}>
        {subject}
      </span>
    </div>
  );
}
