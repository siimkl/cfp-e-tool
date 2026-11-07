import { useState, type FormEvent } from 'react';
import { errorText } from '../lib/messages';

const MAX_LENGTH = 1000;

export function QuickItemInput({
  onExtract,
  onManual,
  onCancel,
}: {
  onExtract: (text: string) => Promise<void>;
  onManual: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) {
      setError('Kleebi link või kuulutuse tekst.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onExtract(value);
    } catch (cause) {
      setError(
        errorText(
          cause,
          'Kuulutuse andmete tuvastamine ebaõnnestus. Proovi uuesti või täida vorm käsitsi.',
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="quick-item-input" onSubmit={submit}>
      <label htmlFor="announcement-source">
        Kleebi link või kuulutuse tekst
      </label>
      <p className="muted quick-item-help">
        Sobib veebiaadress, e-kirja sisu või muu tekst. Keelemudel täidab
        väljad; enne salvestamist saad neid kontrollida ja muuta.
      </p>
      <textarea
        id="announcement-source"
        data-initial-focus
        required
        rows={9}
        maxLength={MAX_LENGTH}
        value={text}
        placeholder="https://… või kleebi siia kuni 1000 tähemärki"
        onChange={(event) => setText(event.target.value)}
        disabled={busy}
      />
      <div className="character-count" aria-live="polite">
        {text.length} / {MAX_LENGTH}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-actions quick-item-actions">
        <button type="button" onClick={onCancel} disabled={busy}>
          Loobu
        </button>
        <button type="button" onClick={onManual} disabled={busy}>
          Täida käsitsi
        </button>
        <button className="primary" disabled={busy || !text.trim()}>
          {busy ? 'Analüüsin…' : 'Tuvasta andmed'}
        </button>
      </div>
    </form>
  );
}
