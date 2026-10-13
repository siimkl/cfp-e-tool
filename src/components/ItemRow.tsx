import type { Item } from '../types';
import { dateRange, dateStatus, displayDate } from '../lib/dates';
import { normaliseUrl } from '../lib/dedupe';

const modes = {
  IN_PERSON: 'Kohapeal',
  ONLINE: 'Veebis',
  HYBRID: 'Hübriid',
  UNKNOWN: '',
};

export function ItemRow({
  item,
  today,
  admin,
  onEdit,
  onArchive,
  onDelete,
  onSources,
}: {
  item: Item;
  today: string;
  admin: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSources: () => void;
}) {
  const url = normaliseUrl(item.homepage_url);
  const status = dateStatus(item, today);
  return (
    <tr className={`item-row date-${status.tone}`}>
      <td className="kind-cell">
        <span
          className={'type-badge ' + item.item_type.toLowerCase()}
          title={item.item_type === 'CFP' ? 'Call for Papers' : undefined}
        >
          <svg
            className="type-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            {item.item_type === 'INITIATIVE' ? (
              <>
                <circle cx="12" cy="6" r="3" />
                <circle cx="5" cy="18" r="3" />
                <circle cx="19" cy="18" r="3" />
                <path d="m10 9-4 6m8-6 4 6M8 18h8" />
              </>
            ) : item.item_type === 'CFP' ? (
              <>
                <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" />
                <path d="M14 3v5h5M8 12h8M8 16h5" />
              </>
            ) : (
              <>
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2" />
              </>
            )}
          </svg>
          <span>
            {item.item_type === 'CFP'
              ? 'CFP'
              : item.item_type === 'INITIATIVE'
                ? 'Algatus'
                : 'Sündmus'}
          </span>
        </span>
        {item.archived && <span className="archived-badge">Arhiveeritud</span>}
      </td>
      <td className="announcement-cell">
        <h2>
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
              {item.title} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            item.title
          )}
        </h2>
        {(item.journal || item.organiser) && (
          <p className="publisher">
            {[item.journal, item.organiser].filter(Boolean).join(' · ')}
          </p>
        )}
        {!url && <span className="muted">Kuulutuse link puudub</span>}
      </td>
      <td className="date-cell">
        <span className="date-label">
          {item.item_type === 'CFP'
            ? 'Tähtaeg'
            : item.item_type === 'INITIATIVE'
              ? 'Algatus'
              : 'Toimumisaeg'}
        </span>
        <strong>
          {item.item_type === 'INITIATIVE'
            ? '—'
            : item.item_type === 'CFP'
              ? displayDate(item.deadline)
              : dateRange(item.event_start, item.event_end)}
        </strong>
        <span className={`date-status ${status.tone}`}>{status.label}</span>
      </td>
      <td className="location-cell">
        <span>{item.location || '—'}</span>
        {modes[item.event_mode] && <small>{modes[item.event_mode]}</small>}
      </td>
      <td className="category-cell">{item.category}</td>
      <td className="summary-cell">
        {item.summary || <span className="muted">—</span>}
      </td>
      {admin && (
        <td>
          <div className="admin-actions">
            <button onClick={onEdit}>Muuda</button>
            <button onClick={onArchive}>
              {item.archived ? 'Taasta' : 'Arhiveeri'}
            </button>
            <button onClick={onSources}>Allikad</button>
            <button className="danger-link" onClick={onDelete}>
              Kustuta
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
