import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ITEM_CATEGORIES } from '../shared/core.js';
import {
  configurationReady,
  legacyPublicItemColumns,
  publicItemColumns,
  supabase,
} from './lib/supabase';
import {
  isPast,
  primaryDate,
  todayInTallinn,
  matchesAddedPeriod,
  type AddedPeriod,
} from './lib/dates';
import { makeDedupeKey } from './lib/dedupe';
import type { Item, ItemInput } from './types';
import { ItemRow } from './components/ItemRow';
import { ItemForm } from './components/ItemForm';
import { QuickItemInput } from './components/QuickItemInput';
import { Modal } from './components/Modal';
import { InfoPage, type InfoPageKind } from './components/InfoPage';
import { errorText } from './lib/messages';

type Tab = 'All' | 'CFPs' | 'Events' | 'Initiatives' | 'Archived';
const tabLabels: Record<Tab, string> = {
  All: 'Kõik',
  CFPs: 'Call for Papers (CFP)',
  Events: 'Sündmused',
  Initiatives: 'Algatused',
  Archived: 'Arhiveeritud',
};
type Dialog =
  | { kind: 'capture' }
  | { kind: 'edit'; item?: Item; initial?: ItemInput }
  | { kind: 'delete'; item: Item }
  | null;
export default function App() {
  const getInfoPage = (): InfoPageKind | null =>
    window.location.hash === '#/allikad'
      ? 'sources'
      : window.location.hash === '#/arhitektuur'
        ? 'architecture'
        : null;
  const [infoPage, setInfoPage] = useState(getInfoPage);
  useEffect(() => {
    const navigate = () => {
      setInfoPage(getInfoPage());
      setDialog(null);
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('All');
  const [period, setPeriod] = useState('current');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [highlightedOnly, setHighlightedOnly] = useState(false);
  const [highlightSupported, setHighlightSupported] = useState(true);
  const [addedPeriod, setAddedPeriod] = useState<AddedPeriod>('last7');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState(todayInTallinn());
  const request = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayInTallinn()), 60000);
    return () => clearInterval(timer);
  }, []);
  const load = useCallback(async () => {
    if (!supabase) return;
    const client = supabase;
    const version = ++request.current;
    setLoading(true);
    setError('');
    try {
      const all: Item[] = [];
      let columns = publicItemColumns;
      let supportsHighlights = true;
      // Paginate explicitly; Supabase's default row limit is 1,000.
      for (let offset = 0; ; offset += 500) {
        const readPage = (selectedColumns: string) =>
          client
            .from('items')
            .select(selectedColumns)
            .order('id')
            .range(offset, offset + 499);
        let { data, error } = await readPage(columns);
        if (
          offset === 0 &&
          error?.code === '42703' &&
          error.message.includes('highlighted')
        ) {
          columns = legacyPublicItemColumns;
          supportsHighlights = false;
          ({ data, error } = await readPage(columns));
        }
        if (error) throw error;
        const rows = (data ?? []) as unknown as Array<
          Omit<Item, 'highlighted'> & { highlighted?: boolean }
        >;
        all.push(
          ...rows.map((item) => ({
            ...item,
            highlighted: item.highlighted === true,
          })),
        );
        if (rows.length < 500) break;
      }
      if (version === request.current) {
        setItems(all);
        setHighlightSupported(supportsHighlights);
      }
    } catch (e) {
      if (version === request.current)
        setError(
          errorText(e, 'Kuulutuste laadimine ebaõnnestus. Proovi uuesti.'),
        );
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const current = useMemo(
    () => items.filter((item) => !item.archived && !isPast(item, today)),
    [items, today],
  );
  const visible = useMemo(
    () =>
      items
        .filter((item) => {
          if (tab === 'Archived') {
            if (!item.archived) return false;
          } else {
            if (
              item.archived ||
              (period !== 'all' &&
                (period === 'past'
                  ? !isPast(item, today)
                  : isPast(item, today)))
            )
              return false;
          }
          if (tab === 'CFPs' && item.item_type !== 'CFP') return false;
          if (tab === 'Events' && item.item_type !== 'EVENT') return false;
          if (tab === 'Initiatives' && item.item_type !== 'INITIATIVE')
            return false;
          if (category && item.category !== category) return false;
          if (highlightedOnly && !item.highlighted) return false;
          if (!matchesAddedPeriod(item.created_at, addedPeriod, today))
            return false;
          return [
            item.title,
            item.journal,
            item.organiser,
            item.summary,
            item.location,
            ...item.topics,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query.trim().toLowerCase());
        })
        .sort(
          (a, b) =>
            (primaryDate(a) || '9999').localeCompare(
              primaryDate(b) || '9999',
            ) || a.title.localeCompare(b.title),
        ),
    [items, tab, category, highlightedOnly, query, today, addedPeriod, period],
  );
  async function save(data: ItemInput) {
    if (!supabase) throw new Error('Andmebaasi ühendus puudub.');
    const dedupe_key = await makeDedupeKey(data);
    const result =
      dialog?.kind === 'edit' && dialog.item
        ? await supabase
            .from('items')
            .update({ ...data, dedupe_key })
            .eq('id', dialog.item.id)
            .select('id')
            .single()
        : await supabase
            .from('items')
            .insert({
              ...data,
              dedupe_key,
              source_type: 'MANUAL',
            })
            .select('id')
            .single();
    if (result.error)
      throw new Error(
        result.error.code === '23505'
          ? 'Sama pealkirja, väljaandja ja kuupäevaga kuulutus on juba olemas.'
          : errorText(result.error, 'Kuulutuse salvestamine ebaõnnestus.'),
      );
    setDialog(null);
    setNotice('Kuulutus salvestatud.');
    await load();
  }
  async function extractItem(text: string) {
    if (!supabase) throw new Error('Andmebaasi ühendus puudub.');
    const { data, error } = await supabase.functions.invoke('structure-item', {
      body: { text },
    });
    if (error) {
      let message = '';
      const context = (error as { context?: Response }).context;
      if (context) {
        try {
          const body = (await context.clone().json()) as { error?: string };
          message = body.error || '';
        } catch {
          // Use the stable fallback below for non-JSON gateway errors.
        }
      }
      throw new Error(
        message || 'Kuulutuse automaatne tuvastamine ei ole praegu saadaval.',
      );
    }
    const item = (data as { item?: ItemInput } | null)?.item;
    if (!item) throw new Error('Keelemudel ei tagastanud kuulutuse andmeid.');
    setDialog({ kind: 'edit', initial: item });
  }
  async function mutate(
    item: Item,
    action: 'archive' | 'delete' | 'highlight',
  ) {
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { error } =
      action === 'delete'
        ? await supabase
            .from('items')
            .delete()
            .eq('id', item.id)
            .select('id')
            .single()
        : action === 'highlight'
          ? await supabase
              .from('items')
              .update({ highlighted: !item.highlighted })
              .eq('id', item.id)
              .select('id')
              .single()
          : await supabase
              .from('items')
              .update({ archived: !item.archived })
              .eq('id', item.id)
              .select('id')
              .single();
    setBusy(false);
    if (error) {
      setError(errorText(error, 'Toiming ebaõnnestus. Proovi uuesti.'));
      return;
    }
    setDialog(null);
    setNotice(
      action === 'delete'
        ? 'Kuulutus kustutatud.'
        : action === 'highlight'
          ? item.highlighted
            ? 'Esiletõst eemaldatud.'
            : 'Kuulutus esiletõstetud.'
          : item.archived
            ? 'Kuulutus taastatud.'
            : 'Kuulutus arhiveeritud.',
    );
    await load();
  }
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="./">
            <img
              className="brand-mark"
              src={`${import.meta.env.BASE_URL}teadusradar.svg`}
              alt=""
              width="46"
              height="46"
            />
            <span>
              ÜTI Teadusradar
              <small>
                CFP-d, konverentsid ja muud teadussündmused ühest kohast.
              </small>
            </span>
          </a>
          <div className="header-actions">
            <button
              className="primary header-add-button"
              onClick={() => setDialog({ kind: 'capture' })}
            >
              + Lisa kuulutus
            </button>
            <a className="header-source-link" href="#/allikad">
              Lisa uus allikas, mida jälgida <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </header>
      <main>
        {infoPage ? (
          <InfoPage kind={infoPage} />
        ) : (
          <>
            <section className="directory" aria-label="Kuulutused">
              <div className="filter-tabs" aria-label="Filtreeri kuulutusi">
                {(
                  ['All', 'CFPs', 'Events', 'Initiatives', 'Archived'] as Tab[]
                ).map((value) => (
                  <button
                    key={value}
                    aria-pressed={tab === value}
                    onClick={() => setTab(value)}
                  >
                    {tabLabels[value]}{' '}
                    <span className="tab-count">
                      (
                      {!configurationReady || loading
                        ? '—'
                        : value === 'Archived'
                          ? items.filter((i) => i.archived).length
                          : value === 'All'
                            ? current.length
                            : current.filter(
                                (i) =>
                                  i.item_type ===
                                  (
                                    {
                                      CFPs: 'CFP',
                                      Events: 'EVENT',
                                      Initiatives: 'INITIATIVE',
                                    } as Record<string, string>
                                  )[value],
                              ).length}
                      )
                    </span>
                  </button>
                ))}
              </div>
              <div className="search-row">
                <label>
                  <span className="sr-only">Kuulutuste olek</span>
                  <select
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                  >
                    <option value="current">Aktiivsed kuulutused</option>
                    <option value="past">Möödunud kuulutused</option>
                    <option value="all">Kõik kuupäevad</option>
                  </select>
                </label>
                <label>
                  <span className="sr-only">Lisamise aeg</span>
                  <select
                    value={addedPeriod}
                    onChange={(e) =>
                      setAddedPeriod(e.target.value as AddedPeriod)
                    }
                  >
                    <option value="all">Kõik lisamisajad</option>
                    <option value="today">Täna lisatud</option>
                    <option value="yesterday">Eile lisatud</option>
                    <option value="last7">Lisatud 7 päeva jooksul</option>
                    <option value="last30">Lisatud 30 päeva jooksul</option>
                  </select>
                </label>
                <label className="search-field">
                  <span className="sr-only">Otsi kuulutusi</span>
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    placeholder="Otsi pealkirja, teema või ajakirja järgi…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <label>
                  <span className="sr-only">Kategooria</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Kõik kategooriad</option>
                    {ITEM_CATEGORIES.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
                {highlightSupported && (
                  <label className="highlight-filter">
                    <input
                      type="checkbox"
                      checked={highlightedOnly}
                      onChange={(event) =>
                        setHighlightedOnly(event.target.checked)
                      }
                    />
                    <span>Ainult esiletõstetud</span>
                  </label>
                )}
              </div>
              {notice && (
                <div className="notice" role="status">
                  {notice}
                  <button
                    aria-label="Sulge teavitus"
                    onClick={() => setNotice('')}
                  >
                    ×
                  </button>
                </div>
              )}
              {error && (
                <div className="error" role="alert">
                  {error}{' '}
                  <button onClick={() => void load()}>Proovi uuesti</button>
                </div>
              )}
              {!configurationReady ? (
                <div className="empty-state">
                  <span className="empty-symbol" aria-hidden="true">
                    ↗
                  </span>
                  <h3>Ühenda kuulutuste andmebaas</h3>
                  <p>
                    Lisa keskkonnaseadetesse Supabase’i projekti aadress ja
                    avalik API-võti ning loo rakenduse uus versioon.
                  </p>
                  <p className="muted">
                    Failis README.md on juhised andmebaasi, ühiskasutuse ja
                    Gmailist importimise seadistamiseks.
                  </p>
                </div>
              ) : loading ? (
                <p className="loading" role="status">
                  Kuulutuste laadimine…
                </p>
              ) : (
                <>
                  <div className="results-line">
                    <span>
                      {visible.length}{' '}
                      {visible.length === 1 ? 'kuulutus' : 'kuulutust'}
                      {period === 'past' ? ' möödunud kuupäevadega' : ''}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery('');
                        setAddedPeriod('last7');
                        setCategory('');
                        setHighlightedOnly(false);
                        setTab('All');
                        setPeriod('current');
                      }}
                    >
                      Lähtesta filtrid
                    </button>
                  </div>
                  {visible.length ? (
                    <>
                      <div
                        className="date-legend"
                        aria-label="Kuupäevade värvide selgitus"
                      >
                        <span className="urgent">0–7 päeva</span>
                        <span className="soon">8–30 päeva</span>
                        <span className="later">Üle 30 päeva</span>
                        <span className="active">Käimas</span>
                        <span className="past">Möödunud</span>
                      </div>
                      <p className="table-hint">
                        Kõigi veergude nägemiseks keri tabelit külgsuunas →
                      </p>
                      <div
                        className="table-scroll"
                        role="region"
                        aria-label="Kuulutuste tabel"
                        tabIndex={0}
                      >
                        <table className="announcements-table">
                          <caption className="sr-only">
                            Kuulutused koos kuupäevade, järelejäänud aja,
                            toimumiskoha ja teemadega
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Liik</th>
                              <th scope="col">Kuulutus / korraldaja</th>
                              <th scope="col">Kuupäev / järelejäänud aeg</th>
                              <th scope="col">Toimumiskoht</th>
                              <th scope="col">Kategooria</th>
                              <th scope="col">Kokkuvõte</th>
                              <th scope="col">Haldus</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((item) => (
                              <ItemRow
                                key={item.id}
                                item={item}
                                today={today}
                                onEdit={() => setDialog({ kind: 'edit', item })}
                                onArchive={() => {
                                  if (!busy) void mutate(item, 'archive');
                                }}
                                onHighlight={
                                  highlightSupported
                                    ? () => {
                                        if (!busy)
                                          void mutate(item, 'highlight');
                                      }
                                    : undefined
                                }
                                onDelete={() =>
                                  setDialog({ kind: 'delete', item })
                                }
                              />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    !error && (
                      <div className="empty-state">
                        <span className="empty-symbol" aria-hidden="true">
                          ≡
                        </span>
                        <h3>Kuulutusi ei leitud</h3>
                        <p>
                          {query || category || addedPeriod !== 'all'
                            ? 'Proovi teist otsingut või lähtesta filtrid.'
                            : 'Kuulutused ilmuvad siia, kui kasutaja need lisab või need postkastist imporditakse.'}
                        </p>
                      </div>
                    )
                  )}
                </>
              )}
              <p className="table-disclaimer">
                Andmeid töötleb keelemudel, mis võib teha vigu. Kontrolli
                üksikasju alati korraldaja juures.
              </p>
            </section>
          </>
        )}
      </main>
      <footer>
        <a className="footer-brand" href="./">
          <img
            src={`${import.meta.env.BASE_URL}teadusradar.svg`}
            alt=""
            width="30"
            height="30"
          />
          <span>ÜTI Teadusradar</span>
        </a>
        <span>CFP-d, konverentsid ja muud teadussündmused ühest kohast.</span>
        <nav className="footer-links" aria-label="Rakenduse juhendid">
          <a href="#/arhitektuur">CFP rakenduse arhitektuur</a>
        </nav>
        <span className="webmaster">
          Veebihaldur: Siim Klais ·{' '}
          <a href="mailto:siim.klais@ut.ee">siim.klais@ut.ee</a>
        </span>
      </footer>
      {dialog?.kind === 'capture' && (
        <Modal title="Lisa kuulutus" onClose={() => setDialog(null)}>
          <QuickItemInput
            onExtract={extractItem}
            onManual={() => setDialog({ kind: 'edit' })}
            onCancel={() => setDialog(null)}
          />
        </Modal>
      )}
      {dialog?.kind === 'edit' && (
        <Modal
          title={
            dialog.item
              ? 'Muuda kuulutust'
              : dialog.initial
                ? 'Kontrolli kuulutuse andmeid'
                : 'Lisa kuulutus'
          }
          onClose={() => setDialog(null)}
        >
          <ItemForm
            item={dialog.item}
            initial={dialog.initial}
            onSave={save}
            onCancel={() => setDialog(null)}
          />
        </Modal>
      )}
      {dialog?.kind === 'delete' && (
        <Modal title="Kas kustutada kuulutus?" onClose={() => setDialog(null)}>
          <p>
            Kuulutus „{dialog.item.title}” ja selle allikaviited kustutatakse
            jäädavalt. Kuulutuse säilitamiseks kasuta arhiveerimist.
          </p>
          <div className="form-actions">
            <button onClick={() => setDialog(null)}>Loobu</button>
            <button
              className="danger"
              data-initial-focus
              disabled={busy}
              onClick={() => void mutate(dialog.item, 'delete')}
            >
              {busy ? 'Kustutamine…' : 'Kustuta jäädavalt'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
