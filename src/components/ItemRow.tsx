import type { Item } from '../types';
import { dateRange, dateStatus, displayDate, isNew } from '../lib/dates';
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
          {item.item_type === 'CFP' ? 'CFP' : 'Sündmus'}
        </span>
        {isNew(item) && <span className="new-badge">Uus</span>}
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
        {item.summary && (
          <details className="row-summary">
            <summary>Kokkuvõte</summary>
            <p>{item.summary}</p>
          </details>
        )}
        {!url && <span className="muted">Kuulutuse link puudub</span>}
      </td>
      <td className="date-cell">
        <span className="date-label">
          {item.item_type === 'CFP' ? 'Tähtaeg' : 'Toimumisaeg'}
        </span>
        <strong>
          {item.item_type === 'CFP'
            ? displayDate(item.deadline)
            : dateRange(item.event_start, item.event_end)}
        </strong>
        <span className={`date-status ${status.tone}`}>{status.label}</span>
      </td>
      <td className="location-cell">
        <span>{item.location || '—'}</span>
        {modes[item.event_mode] && <small>{modes[item.event_mode]}</small>}
      </td>
      <td className="topics-cell">
        {item.topics.length ? (
          <div className="topics">
            {item.topics.map((topic) => (
              <span key={topic}>{topic}</span>
            ))}
          </div>
        ) : (
          <span className="muted">—</span>
        )}
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
