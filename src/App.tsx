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
import { isNew, isPast, primaryDate, todayInTallinn } from './lib/dates';
import { makeDedupeKey } from './lib/dedupe';
import type { Item, ItemInput, Source } from './types';
import { ItemCard } from './components/ItemCard';
import { ItemForm } from './components/ItemForm';
import { Modal } from './components/Modal';

type Tab = 'All' | 'CFPs' | 'Events' | 'New' | 'Past' | 'Archived';
type Dialog =
  | { kind: 'login' }
  | { kind: 'edit'; item?: Item }
  | { kind: 'sources'; item: Item }
  | { kind: 'delete'; item: Item }
  | null;
export default function App() {
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
        if (error) setError(error.message);
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
          e instanceof Error
            ? e.message
            : (e as { message?: string }).message ||
                'Could not load announcements.',
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
        if (error) setSourceError(error.message);
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
    [items, tab, admin, topic, query, sort, today],
  );
  async function save(data: ItemInput) {
    if (!supabase || !session) throw new Error('Please log in again.');
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
          ? 'An item with this title, publisher and date already exists.'
          : result.error.message,
      );
    setDialog(null);
    setNotice('Item saved.');
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
      setError(error.message);
      return;
    }
    setDialog(null);
    setNotice(
      action === 'delete'
        ? 'Item deleted.'
        : item.archived
          ? 'Item restored.'
          : 'Item archived.',
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
        ? error.message
        : 'Check your email for a sign-in link. Only invited staff accounts can sign in.',
    );
  }
  async function logout() {
    const { error } = await supabase!.auth.signOut();
    if (error) setError(error.message);
    else {
      setSession(null);
      setDialog(null);
      setSources([]);
      setNotice('You have signed out.');
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
              CFP/E Tool<small>Calls for Papers & Academic Events</small>
            </span>
          </a>
          <div className="header-actions">
            {admin ? (
              <>
                <span className="staff-label">Staff workspace</span>
                <button onClick={() => void logout()}>Logout</button>
              </>
            ) : (
              <button
                disabled={!configurationReady || !authReady}
                onClick={() => {
                  setLoginMessage('');
                  setDialog({ kind: 'login' });
                }}
              >
                Admin login <span aria-hidden="true">↗</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">ACADEMIC OPPORTUNITIES</p>
            <h1>Find your next contribution.</h1>
            <p className="intro">
              Calls for papers, conferences and conversations across the
              research community.
            </p>
          </div>
          {admin && (
            <button
              className="primary"
              onClick={() => setDialog({ kind: 'edit' })}
            >
              + Add item
            </button>
          )}
        </div>
        <section className="metrics" aria-label="Announcement statistics">
          {[
            [
              'Active CFPs',
              current.filter((i) => i.item_type === 'CFP').length,
              'Open calls for research',
            ],
            [
              'Upcoming Events',
              current.filter((i) => i.item_type === 'EVENT').length,
              'Meet the research community',
            ],
            [
              'New this week',
              current.filter((i) => isNew(i)).length,
              'Added in the last 7 days',
            ],
          ].map(([label, count, help]) => (
            <div className="metric" key={label}>
              <span>{label}</span>
              <strong>
                {configurationReady && authReady && !loading ? count : '—'}
              </strong>
              <small>{help}</small>
            </div>
          ))}
        </section>
        <section className="directory" aria-label="Announcements">
          <div className="directory-heading">
            <h2>Explore announcements</h2>
            <span className="muted">Dates shown in Europe/Tallinn</span>
          </div>
          <div className="filter-tabs" aria-label="Filter announcements">
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
                {value}
              </button>
            ))}
          </div>
          <div className="search-row">
            <label className="search-field">
              <span className="sr-only">Search announcements</span>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                placeholder="Search titles, topics, journals…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              <span className="sr-only">Topic</span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">All topics</option>
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="date">Next relevant date</option>
                <option value="newest">Recently added</option>
              </select>
            </label>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                ×
              </button>
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error} <button onClick={() => void load()}>Try again</button>
            </div>
          )}
          {!configurationReady ? (
            <div className="empty-state">
              <span className="empty-symbol" aria-hidden="true">
                ↗
              </span>
              <h3>Connect your announcement library</h3>
              <p>
                Add your Supabase project URL and publishable key to the
                environment, then rebuild the app.
              </p>
              <p className="muted">
                The setup guide in README.md walks you through the database,
                staff access and Gmail import.
              </p>
            </div>
          ) : loading || !authReady ? (
            <p className="loading" role="status">
              Loading announcements…
            </p>
          ) : (
            <>
              <div className="results-line">
                <span>
                  {visible.length}{' '}
                  {visible.length === 1 ? 'announcement' : 'announcements'}
                  {tab === 'Past' ? ' in the archive of past dates' : ''}
                </span>
                <button
                  className="text-button"
                  onClick={() => {
                    setQuery('');
                    setTopic('');
                    setTab('All');
                    setSort('date');
                  }}
                >
                  Reset filters
                </button>
              </div>
              {visible.length ? (
                <div className="card-grid">
                  {visible.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      admin={admin}
                      onEdit={() => setDialog({ kind: 'edit', item })}
                      onArchive={() => {
                        if (!busy) void mutate(item, 'archive');
                      }}
                      onDelete={() => setDialog({ kind: 'delete', item })}
                      onSources={() => setDialog({ kind: 'sources', item })}
                    />
                  ))}
                </div>
              ) : (
                !error && (
                  <div className="empty-state">
                    <span className="empty-symbol" aria-hidden="true">
                      ≡
                    </span>
                    <h3>No announcements found</h3>
                    <p>
                      {query || topic
                        ? 'Try a different search or clear your filters.'
                        : 'Announcements will appear here as they are added by staff or imported from the inbox.'}
                    </p>
                  </div>
                )
              )}
            </>
          )}
        </section>
      </main>
      <footer>
        <span>CFP/E Tool</span>
        <span>Academic opportunities, in one place.</span>
        <span>Always confirm details with the organiser.</span>
      </footer>
      {dialog?.kind === 'login' && (
        <Modal title="Staff sign in" onClose={() => setDialog(null)}>
          <p>
            Enter your invited staff email to receive a secure sign-in link.
          </p>
          <form className="item-form" onSubmit={login}>
            <label>
              Email address
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
              {busy ? 'Sending…' : 'Send sign-in link'}
            </button>
            <p className="muted">
              Access is limited to authorised staff. Public registration is
              closed.
            </p>
          </form>
        </Modal>
      )}
      {admin && dialog?.kind === 'edit' && (
        <Modal
          title={dialog.item ? 'Edit announcement' : 'Add announcement'}
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
        <Modal title="Delete announcement?" onClose={() => setDialog(null)}>
          <p>
            “{dialog.item.title}” and its source links will be permanently
            deleted. Archive it instead to keep a record.
          </p>
          <div className="form-actions">
            <button onClick={() => setDialog(null)}>Cancel</button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => void mutate(dialog.item, 'delete')}
            >
              {busy ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </Modal>
      )}
      {admin && dialog?.kind === 'sources' && (
        <Modal title="Announcement sources" onClose={() => setDialog(null)}>
          <h3>{dialog.item.title}</h3>
          <p>
            Source:{' '}
            {dialog.item.source_type === 'EMAIL' ? 'automated' : 'manual'}
          </p>
          {sourcesLoading ? (
            <p role="status">Loading sources…</p>
          ) : sourceError ? (
            <p className="error" role="alert">
              {sourceError}
            </p>
          ) : sources.length ? (
            sources.map((source) => (
              <div className="source" key={source.id}>
                <strong>
                  {source.processed_emails?.subject || 'No subject'}
                </strong>
                <p>{source.processed_emails?.sender}</p>
                <p>
                  {source.processed_emails &&
                    new Date(
                      source.processed_emails.received_at,
                    ).toLocaleString('en-GB', {
                      timeZone: 'Europe/Tallinn',
                    })}{' '}
                  · Europe/Tallinn
                </p>
                {source.source_excerpt && (
                  <blockquote>{source.source_excerpt}</blockquote>
                )}
                <p className="muted">
                  Extraction confidence:{' '}
                  {source.extraction_confidence == null
                    ? 'not supplied'
                    : Math.round(source.extraction_confidence * 100) + '%'}
                </p>
              </div>
            ))
          ) : (
            <p className="muted">No email sources are attached to this item.</p>
          )}
        </Modal>
      )}
    </>
  );
}
