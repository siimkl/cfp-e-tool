import type { Item } from '../types';
import { dateRange, displayDate, isNew } from '../lib/dates';
import { normaliseUrl } from '../lib/dedupe';
const modes = {
  IN_PERSON: 'In person',
  ONLINE: 'Online',
  HYBRID: 'Hybrid',
  UNKNOWN: '',
};
export function ItemCard({
  item,
  admin,
  onEdit,
  onArchive,
  onDelete,
  onSources,
}: {
  item: Item;
  admin: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSources: () => void;
}) {
  const url = normaliseUrl(item.homepage_url);
  return (
    <article className="item-card">
      <div className="card-tags">
        <span className={'type-badge ' + item.item_type.toLowerCase()}>
          {item.item_type === 'CFP' ? 'CALL FOR PAPERS' : 'EVENT'}
        </span>
        {isNew(item) && <span className="new-badge">NEW</span>}
        {item.archived && <span className="archived-badge">ARCHIVED</span>}
      </div>
      <h2>{item.title}</h2>
      {(item.journal || item.organiser) && (
        <p className="publisher">
          {[item.journal, item.organiser].filter(Boolean).join(' · ')}
        </p>
      )}
      {item.summary && <p className="summary">{item.summary}</p>}
      <div className="card-facts">
        <p>
          <span className="fact-label">
            {item.item_type === 'CFP' ? 'Deadline' : 'Event'}
          </span>
          <strong>
            {item.item_type === 'CFP'
              ? displayDate(item.deadline)
              : dateRange(item.event_start, item.event_end)}
          </strong>
        </p>
        {(item.location || modes[item.event_mode]) && (
          <p>
            <span className="fact-label">Where</span>
            <span>
              {[item.location, modes[item.event_mode]]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </p>
        )}
      </div>
      {item.topics.length > 0 && (
        <div className="topics">
          {item.topics.map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
      )}
      <div className="card-bottom">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open announcement <span aria-hidden="true">↗</span>
          </a>
        ) : (
          <span className="muted">Announcement link not supplied</span>
        )}
      </div>
      {admin && (
        <div className="admin-actions">
          <button onClick={onEdit}>Edit</button>
          <button onClick={onArchive}>
            {item.archived ? 'Restore' : 'Archive'}
          </button>
          <button onClick={onSources}>Sources</button>
          <button className="danger-link" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </article>
  );
}
