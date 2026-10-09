import { useState, type FormEvent } from 'react';
import { ACADEMIC_TOPICS, ITEM_CATEGORIES } from '../../shared/core.js';
import type { Item, ItemInput } from '../types';
import {
  clearFieldValidation,
  errorText,
  translateFieldValidation,
} from '../lib/messages';
import { normaliseUrl, validateItem } from '../lib/dedupe';
const empty: ItemInput = {
  item_type: 'CFP',
  title: '',
  category: 'Valdkondadeülene teadus',
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
  const [topics, setTopics] = useState<string[]>(item?.topics || []);
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
        topics: [...new Set(topics)],
      };
      // Whitelist form fields: do not send metadata from an existing Item object.
      const clean = Object.fromEntries(
        Object.keys(empty).map((key) => [key, data[key as keyof ItemInput]]),
      ) as unknown as ItemInput;
      validateItem(clean);
      clean.homepage_url = normaliseUrl(clean.homepage_url);
      await onSave(clean);
    } catch (e) {
      setError(errorText(e, 'Kuulutuse salvestamine ebaõnnestus.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="item-form"
      onInvalidCapture={translateFieldValidation}
      onInputCapture={clearFieldValidation}
    >
      <label>
        Liik
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
          <option value="CFP">Call for Papers (CFP)</option>
          <option value="EVENT">Sündmus</option>
        </select>
      </label>
      <label>
        Pealkiri <span aria-hidden="true">*</span>
        <input
          required
          maxLength={500}
          value={draft.title}
          onChange={(e) => field('title', e.target.value)}
        />
      </label>
      <div className="form-pair">
        <label>
          Ajakiri
          <input
            value={draft.journal || ''}
            onChange={(e) => field('journal', e.target.value)}
          />
        </label>
        <label>
          Korraldaja
          <input
            value={draft.organiser || ''}
            onChange={(e) => field('organiser', e.target.value)}
          />
        </label>
      </div>
      <label>
        Kokkuvõte
        <textarea
          rows={3}
          maxLength={2000}
          value={draft.summary || ''}
          onChange={(e) => field('summary', e.target.value)}
        />
      </label>
      {draft.item_type === 'CFP' ? (
        <label>
          Tähtaeg
          <input
            type="date"
            value={draft.deadline || ''}
            onChange={(e) => field('deadline', e.target.value)}
          />
        </label>
      ) : (
        <div className="form-pair">
          <label>
            Sündmuse algus
            <input
              type="date"
              value={draft.event_start || ''}
              onChange={(e) => field('event_start', e.target.value)}
            />
          </label>
          <label>
            Sündmuse lõpp
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
          Osalemisviis
          <select
            value={draft.event_mode}
            onChange={(e) => field('event_mode', e.target.value)}
          >
            <option value="UNKNOWN">Teadmata</option>
            <option value="IN_PERSON">Kohapeal</option>
            <option value="ONLINE">Veebis</option>
            <option value="HYBRID">Hübriid</option>
          </select>
        </label>
        <label>
          Asukoht
          <input
            value={draft.location || ''}
            onChange={(e) => field('location', e.target.value)}
          />
        </label>
      </div>
      <label>
        Veebilehe või kuulutuse aadress
        <input
          type="url"
          placeholder="https://"
          value={draft.homepage_url || ''}
          onChange={(e) => field('homepage_url', e.target.value)}
        />
      </label>
      <label>
        Kategooria
        <select
          value={draft.category}
          onChange={(e) => field('category', e.target.value)}
        >
          {ITEM_CATEGORIES.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
      <fieldset className="topic-picker">
        <legend>Täpsemad teemasildid</legend>
        <p className="muted">Vali sobivad eestikeelsed kategooriad.</p>
        <div className="topic-options">
          {[...ACADEMIC_TOPICS]
            .sort((a, b) => a.localeCompare(b, 'et'))
            .map((topic) => (
              <label key={topic}>
                <input
                  type="checkbox"
                  checked={topics.includes(topic)}
                  onChange={(event) =>
                    setTopics((current) =>
                      event.target.checked
                        ? [...current, topic]
                        : current.filter((value) => value !== topic),
                    )
                  }
                />
                {topic}
              </label>
            ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Loobu
        </button>
        <button className="primary" disabled={busy}>
          {busy ? 'Salvestamine…' : 'Salvesta kuulutus'}
        </button>
      </div>
    </form>
  );
}
