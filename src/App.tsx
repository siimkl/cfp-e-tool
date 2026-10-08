import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  configurationReady,
  publicItemColumns,
  supabase,
} from './lib/supabase';
import {
  isNew,
  isPast,
  primaryDate,
  todayInTallinn,
  matchesAddedPeriod,
  type AddedPeriod,
} from './lib/dates';
import { makeDedupeKey } from './lib/dedupe';
import type { Item, ItemInput, Source } from './types';
import { ItemRow } from './components/ItemRow';
import { ItemForm } from './components/ItemForm';
import { Modal } from './components/Modal';
import { InfoPage, type InfoPageKind } from './components/InfoPage';
import {
  clearFieldValidation,
  errorText,
  translateFieldValidation,
} from './lib/messages';

type Tab = 'All' | 'CFPs' | 'Events' | 'New' | 'Past' | 'Archived';
const tabLabels: Record<Tab, string> = {
  All: 'Kõik',
  CFPs: 'Call for Papers (CFP)',
  Events: 'Sündmused',
  New: 'Uued',
  Past: 'Möödunud',
  Archived: 'Arhiveeritud',
};
type Dialog =
  | { kind: 'login' }
  | { kind: 'edit'; item?: Item }
  | { kind: 'sources'; item: Item }
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
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('All');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('');
  const [sort, setSort] = useState('date');
  const [addedPeriod, setAddedPeriod] = useState<AddedPeriod>('last7');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceError, setSourceError] = useState('');
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [today, setToday] = useState(todayInTallinn());
  const request = useRef(0);
  const admin = Boolean(session);
  useEffect(() => {
    const timer = setInterval(() => setToday(todayInTallinn()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (mounted) {
        setSession(data.session);
        setAuthReady(true);
        if (error)
          setError(
            errorText(
              error,
              'Sisselogimise kontrollimine ebaõnnestus. Palun logi uuesti sisse.',
            ),
          );
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
      setSources([]);
      setDialog(null);
      setItems([]);
      request.current++;
      if (!next)
        setTab((current) => (current === 'Archived' ? 'All' : current));
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);
  const load = useCallback(async () => {
    if (!supabase || !authReady) return;
    const version = ++request.current;
    setLoading(true);
    setError('');
    try {
      const all: Item[] = [];
      // Paginate explicitly; Supabase's default row limit is 1,000.
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .from('items')
          .select(publicItemColumns)
          .order('id')
          .range(offset, offset + 499);
        if (error) throw error;
        all.push(...(data as Item[]));
        if (data.length < 500) break;
      }
      if (version === request.current) setItems(all);
    } catch (e) {
      if (version === request.current)
        setError(
          errorText(e, 'Kuulutuste laadimine ebaõnnestus. Proovi uuesti.'),
        );
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [authReady, session?.user.id]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!session || dialog?.kind !== 'sources' || !supabase) return;
    let cancelled = false;
    setSourcesLoading(true);
    setSourceError('');
    setSources([]);
    supabase
      .from('item_sources')
      .select(
        'id,source_excerpt,extraction_confidence,processed_emails(sender,subject,received_at)',
      )
      .eq('item_id', dialog.item.id)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error)
          setSourceError(errorText(error, 'Allikate laadimine ebaõnnestus.'));
        else setSources(data as unknown as Source[]);
        setSourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dialog, session]);
  const current = useMemo(
    () => items.filter((item) => !item.archived && !isPast(item, today)),
    [items, today],
  );
  const topics = useMemo(
    () =>
      [
        ...new Set(
          items.filter((item) => !item.archived).flatMap((item) => item.topics),
        ),
      ].sort(),
    [items],
  );
  const visible = useMemo(
    () =>
      items
        .filter((item) => {
          if (tab === 'Archived') {
            if (!admin || !item.archived) return false;
          } else {
            if (
              item.archived ||
              (tab === 'Past' ? !isPast(item, today) : isPast(item, today))
            )
              return false;
          }
          if (tab === 'CFPs' && item.item_type !== 'CFP') return false;
          if (tab === 'Events' && item.item_type !== 'EVENT') return false;
          if (tab === 'New' && !isNew(item)) return false;
          if (topic && !item.topics.includes(topic)) return false;
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
        .sort((a, b) =>
          sort === 'newest'
            ? b.created_at.localeCompare(a.created_at)
            : (primaryDate(a) || '9999').localeCompare(
                primaryDate(b) || '9999',
              ) || a.title.localeCompare(b.title),
        ),
    [items, tab, admin, topic, query, sort, today, addedPeriod],
  );
  async function save(data: ItemInput) {
    if (!supabase || !session) throw new Error('Palun logi uuesti sisse.');
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
              created_by: session.user.id,
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
  async function mutate(item: Item, action: 'archive' | 'delete') {
    if (!supabase || !session) return;
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
        : item.archived
          ? 'Kuulutus taastatud.'
          : 'Kuulutus arhiveeritud.',
    );
    await load();
  }
  async function login(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setLoginMessage('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    setBusy(false);
    setLoginMessage(
      error
        ? errorText(
            error,
            'Sisselogimislingi saatmine ebaõnnestus. Kontrolli e-posti aadressi ja proovi uuesti.',
          )
        : 'Vaata oma postkastist sisselogimislinki. Sisse saavad logida ainult kutse saanud haldurid.',
    );
  }
  async function logout() {
    const { error } = await supabase!.auth.signOut();
    if (error)
      setError(errorText(error, 'Toiming ebaõnnestus. Proovi uuesti.'));
    else {
      setSession(null);
      setDialog(null);
      setSources([]);
      setNotice('Oled välja logitud.');
    }
  }
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="./">
            <span className="brand-mark" aria-hidden="true">
              CF
            </span>
            <span>
              CFP &amp; Sündmuste jälgija
              <small>Call for Papers ja teadussündmused</small>
            </span>
          </a>
          <div className="header-actions">
            {admin ? (
              <>
                <span className="staff-label">Haldusvaade</span>
                <button onClick={() => void logout()}>Logi välja</button>
              </>
            ) : (
              <a className="header-source-link" href="#/allikad">
                Lisa uus allikas, mida jälgida <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        </div>
      </header>
      <main>
        {infoPage ? (
          <InfoPage kind={infoPage} />
        ) : (
          <>
            <section className="metrics" aria-label="Kuulutuste statistika">
              {[
                [
                  'Avatud CFP-d',
                  current.filter((i) => i.item_type === 'CFP').length,
                ],
                [
                  'Tulevased sündmused',
                  current.filter((i) => i.item_type === 'EVENT').length,
                ],
              ].map(([label, count]) => (
                <div className="metric" key={label}>
                  <span>{label}</span>
                  <strong>
                    {configurationReady && authReady && !loading ? count : '—'}
                  </strong>
                </div>
              ))}
            </section>
            <section className="directory" aria-label="Kuulutused">
              <div className="directory-heading">
                <h1>Kuulutused</h1>
                {admin && (
                  <button
                    className="primary"
                    onClick={() => setDialog({ kind: 'edit' })}
                  >
                    + Lisa kuulutus
                  </button>
                )}
                <span className="muted">Kuupäevad Tallinna aja järgi</span>
              </div>
              <div className="filter-tabs" aria-label="Filtreeri kuulutusi">
                {(
                  [
                    'All',
                    'CFPs',
                    'Events',
                    'New',
                    'Past',
                    ...(admin ? ['Archived'] : []),
                  ] as Tab[]
                ).map((value) => (
                  <button
                    key={value}
                    aria-pressed={tab === value}
                    onClick={() => setTab(value)}
                  >
                    {tabLabels[value]}
                  </button>
                ))}
              </div>
              <div className="search-row">
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
                    <option value="week">Sel nädalal lisatud</option>
                    <option value="last7">Viimase 7 päeva jooksul</option>
                    <option value="month">Sel kuul lisatud</option>
                    <option value="last30">Viimase 30 päeva jooksul</option>
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
                  <span className="sr-only">Teema</span>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  >
                    <option value="">Kõik teemad</option>
                    {topics.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Järjestus</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="date">Lähim kuupäev</option>
                    <option value="newest">Viimati lisatud</option>
                  </select>
                </label>
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
                    Failis README.md on juhised andmebaasi, haldurite ligipääsu
                    ja Gmailist importimise seadistamiseks.
                  </p>
                </div>
              ) : loading || !authReady ? (
                <p className="loading" role="status">
                  Kuulutuste laadimine…
                </p>
              ) : (
                <>
                  <div className="results-line">
                    <span>
                      {visible.length}{' '}
                      {visible.length === 1 ? 'kuulutus' : 'kuulutust'}
                      {tab === 'Past' ? ' möödunud kuupäevadega' : ''}
                    </span>
                    <button
                      className="text-button"
                      onClick={() => {
                        setQuery('');
                        setAddedPeriod('last7');
                        setTopic('');
                        setTab('All');
                        setSort('date');
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
                              <th scope="col">Teemad</th>
                              {admin && <th scope="col">Haldus</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((item) => (
                              <ItemRow
                                key={item.id}
                                item={item}
                                today={today}
                                admin={admin}
                                onEdit={() => setDialog({ kind: 'edit', item })}
                                onArchive={() => {
                                  if (!busy) void mutate(item, 'archive');
                                }}
                                onDelete={() =>
                                  setDialog({ kind: 'delete', item })
                                }
                                onSources={() =>
                                  setDialog({ kind: 'sources', item })
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
                          {query || topic || addedPeriod !== 'all'
                            ? 'Proovi teist otsingut või lähtesta filtrid.'
                            : 'Kuulutused ilmuvad siia, kui haldur need lisab või need postkastist imporditakse.'}
                        </p>
                      </div>
                    )
                  )}
                </>
              )}
            </section>
          </>
        )}
      </main>
      <footer>
        <span>CFP &amp; Sündmuste jälgija</span>
        <span>Teadustöö võimalused ühes kohas.</span>
        <nav className="footer-links" aria-label="Rakenduse juhendid">
          <a href="#/allikad">Lisa uus allikas, mida jälgida</a>
          <a href="#/arhitektuur">CFP rakenduse arhitektuur</a>
        </nav>
        <span>Kontrolli üksikasju alati korraldaja juures.</span>
      </footer>
      {dialog?.kind === 'login' && (
        <Modal title="Halduri sisselogimine" onClose={() => setDialog(null)}>
          <p>
            Sisesta kutse saanud halduri e-posti aadress. Saadame sellele
            turvalise sisselogimislingi.
          </p>
          <form
            className="item-form"
            onSubmit={login}
            onInvalidCapture={translateFieldValidation}
            onInputCapture={clearFieldValidation}
          >
            <label>
              E-posti aadress
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {loginMessage && <p role="status">{loginMessage}</p>}
            <button className="primary" disabled={busy}>
              {busy ? 'Saatmine…' : 'Saada sisselogimislink'}
            </button>
            <p className="muted">
              Ligipääs on ainult volitatud halduritel. Avalik registreerumine on
              suletud.
            </p>
          </form>
        </Modal>
      )}
      {admin && dialog?.kind === 'edit' && (
        <Modal
          title={dialog.item ? 'Muuda kuulutust' : 'Lisa kuulutus'}
          onClose={() => setDialog(null)}
        >
          <ItemForm
            item={dialog.item}
            onSave={save}
            onCancel={() => setDialog(null)}
          />
        </Modal>
      )}
      {admin && dialog?.kind === 'delete' && (
        <Modal title="Kas kustutada kuulutus?" onClose={() => setDialog(null)}>
          <p>
            Kuulutus „{dialog.item.title}” ja selle allikaviited kustutatakse
            jäädavalt. Kuulutuse säilitamiseks kasuta arhiveerimist.
          </p>
          <div className="form-actions">
            <button onClick={() => setDialog(null)}>Loobu</button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => void mutate(dialog.item, 'delete')}
            >
              {busy ? 'Kustutamine…' : 'Kustuta jäädavalt'}
            </button>
          </div>
        </Modal>
      )}
      {admin && dialog?.kind === 'sources' && (
        <Modal title="Kuulutuse allikad" onClose={() => setDialog(null)}>
          <h3>{dialog.item.title}</h3>
          <p>
            Allikas:{' '}
            {dialog.item.source_type === 'EMAIL'
              ? 'automaatselt imporditud'
              : 'käsitsi lisatud'}
          </p>
          {sourcesLoading ? (
            <p role="status">Allikate laadimine…</p>
          ) : sourceError ? (
            <p className="error" role="alert">
              {sourceError}
            </p>
          ) : sources.length ? (
            sources.map((source) => (
              <div className="source" key={source.id}>
                <strong>
                  {source.processed_emails?.subject || 'Teema puudub'}
                </strong>
                <p>{source.processed_emails?.sender}</p>
                <p>
                  {source.processed_emails &&
                    new Date(
                      source.processed_emails.received_at,
                    ).toLocaleString('et-EE', {
                      timeZone: 'Europe/Tallinn',
                    })}{' '}
                  · Tallinna aeg
                </p>
                {source.source_excerpt && (
                  <blockquote>{source.source_excerpt}</blockquote>
                )}
                <p className="muted">
                  Andmete tuvastamise kindlus:{' '}
                  {source.extraction_confidence == null
                    ? 'määramata'
                    : Math.round(source.extraction_confidence * 100) + '%'}
                </p>
              </div>
            ))
          ) : (
            <p className="muted">
              Sellele kuulutusele pole e-kirjade allikaid lisatud.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
