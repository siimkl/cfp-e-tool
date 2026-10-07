import { useState, type FormEvent } from 'react';
import type { Item, ItemInput } from '../types';
import { normaliseUrl, validateItem } from '../lib/dedupe';
const empty: ItemInput = {
  item_type: 'CFP',
  title: '',
  journal: null,
  organiser: null,
  summary: null,
  deadline: null,
  event_start: null,
  event_end: null,
  event_mode: 'UNKNOWN',
  location: null,
  homepage_url: null,
  topics: [],
};
export function ItemForm({
  item,
  onSave,
  onCancel,
}: {
  item?: Item;
  onSave: (data: ItemInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ItemInput>(item || empty);
  const [topics, setTopics] = useState(item?.topics.join(', ') || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function field(name: keyof ItemInput, value: string) {
    setDraft((prev) => ({ ...prev, [name]: value || null }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data: ItemInput = {
        ...draft,
        title: draft.title.trim(),
        topics: [
          ...new Set(
            topics
              .split(',')
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean),
          ),
        ],
      };
      // Whitelist form fields: do not send metadata from an existing Item object.
      const clean = Object.fromEntries(
        Object.keys(empty).map((key) => [key, data[key as keyof ItemInput]]),
      ) as unknown as ItemInput;
      validateItem(clean);
      clean.homepage_url = normaliseUrl(clean.homepage_url);
      await onSave(clean);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save this item.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="item-form">
      <label>
        Type
        <select
          value={draft.item_type}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              item_type: e.target.value as ItemInput['item_type'],
              deadline: null,
              event_start: null,
              event_end: null,
            }))
          }
        >
          <option value="CFP">CFP</option>
          <option value="EVENT">Event</option>
        </select>
      </label>
      <label>
        Title <span aria-hidden="true">*</span>
        <input
          required
          maxLength={500}
          value={draft.title}
          onChange={(e) => field('title', e.target.value)}
        />
      </label>
      <div className="form-pair">
        <label>
          Journal
          <input
            value={draft.journal || ''}
            onChange={(e) => field('journal', e.target.value)}
          />
        </label>
        <label>
          Organiser
          <input
            value={draft.organiser || ''}
            onChange={(e) => field('organiser', e.target.value)}
          />
        </label>
      </div>
      <label>
        Summary
        <textarea
          rows={3}
          maxLength={2000}
          value={draft.summary || ''}
          onChange={(e) => field('summary', e.target.value)}
        />
      </label>
      {draft.item_type === 'CFP' ? (
        <label>
          Deadline
          <input
            type="date"
            value={draft.deadline || ''}
            onChange={(e) => field('deadline', e.target.value)}
          />
        </label>
      ) : (
        <div className="form-pair">
          <label>
            Event start
            <input
              type="date"
              value={draft.event_start || ''}
              onChange={(e) => field('event_start', e.target.value)}
            />
          </label>
          <label>
            Event end
            <input
              type="date"
              value={draft.event_end || ''}
              onChange={(e) => field('event_end', e.target.value)}
            />
          </label>
        </div>
      )}
      <div className="form-pair">
        <label>
          Event mode
          <select
            value={draft.event_mode}
            onChange={(e) => field('event_mode', e.target.value)}
          >
            <option value="UNKNOWN">Unknown</option>
            <option value="IN_PERSON">In person</option>
            <option value="ONLINE">Online</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </label>
        <label>
          Location
          <input
            value={draft.location || ''}
            onChange={(e) => field('location', e.target.value)}
          />
        </label>
      </div>
      <label>
        Homepage / announcement URL
        <input
          type="url"
          placeholder="https://"
          value={draft.homepage_url || ''}
          onChange={(e) => field('homepage_url', e.target.value)}
        />
      </label>
      <label>
        Topics
        <input
          placeholder="Separate topics with commas"
          value={topics}
          onChange={(e) => setTopics(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save item'}
        </button>
      </div>
    </form>
  );
}
