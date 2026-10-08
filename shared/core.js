// Shared by the browser and Apps Script. No browser-only APIs here.
export function normaliseText(text) {
  return String(text || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normaliseUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value
    .trim()
    .match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?(?:#.*)?$/i);
  if (!match || /[@\s\\]/.test(match[2]) || /[\s<>"\\]/.test(value))
    return null;
  let host = match[2].toLowerCase();
  const protocol = match[1].toLowerCase();
  host = host.replace(protocol === 'https' ? /:443$/ : /:80$/, '');
  const path = match[3].replace(/\/$/, '');
  const tracking =
    /^(utm_source|utm_medium|utm_campaign|utm_content|utm_term|gclid|fbclid)$/i;
  const params = (match[4] || '')
    .slice(1)
    .split('&')
    .filter(Boolean)
    .filter((part) => {
      try {
        return !tracking.test(decodeURIComponent(part.split('=')[0]));
      } catch {
        return false;
      }
    })
    .sort();
  return (
    protocol +
    '://' +
    host +
    path +
    (params.length ? '?' + params.join('&') : '')
  );
}

export function primaryDate(item) {
  return item.item_type === 'CFP' ? item.deadline : item.event_start;
}
export function fingerprint(item) {
  return [
    item.item_type,
    normaliseText(item.title),
    normaliseText(item.journal || item.organiser),
    primaryDate(item) || '',
  ].join('|');
}
export function isPast(item, today) {
  const date =
    item.item_type === 'CFP'
      ? item.deadline
      : item.event_end || item.event_start;
  return Boolean(date && date < today);
}
export function isNew(item, now = new Date()) {
  const age = now.getTime() - new Date(item.created_at).getTime();
  return age >= 0 && age <= 7 * 86400000;
}
export function titleSimilarity(a, b) {
  const left = new Set(normaliseText(a).split(' ').filter(Boolean));
  const right = new Set(normaliseText(b).split(' ').filter(Boolean));
  const union = new Set([...left, ...right]);
  return union.size
    ? [...left].filter((word) => right.has(word)).length / union.size
    : 0;
}
export function duplicateEvidence(existing, incoming) {
  if (existing.item_type !== incoming.item_type) return false;
  const a = primaryDate(existing),
    b = primaryDate(incoming);
  const titleMatch = titleSimilarity(existing.title, incoming.title) >= 0.92;
  const publisher = normaliseText(existing.journal || existing.organiser);
  const samePublisher =
    publisher &&
    publisher === normaliseText(incoming.journal || incoming.organiser);
  const sameUrl =
    normaliseUrl(existing.homepage_url) &&
    normaliseUrl(existing.homepage_url) === normaliseUrl(incoming.homepage_url);
  // A homepage alone is never sufficient: recurring events may reuse the same URL.
  if (sameUrl && titleMatch && (!a || !b || a === b)) return true;
  if (samePublisher && titleMatch && a && b && a === b) return true;
  // A later CFP deadline requires explicit extension evidence, not just the same year.
  return Boolean(
    incoming.item_type === 'CFP' &&
    incoming.deadline_extended &&
    sameUrl &&
    samePublisher &&
    titleMatch &&
    a &&
    b &&
    b > a &&
    a.slice(0, 4) === b.slice(0, 4),
  );
}
export function mergeFields(existing, incoming) {
  const patch = {
    topics: [
      ...new Set([...(existing.topics || []), ...(incoming.topics || [])]),
    ],
  };
  for (const field of [
    'journal',
    'organiser',
    'summary',
    'deadline',
    'event_start',
    'event_end',
    'location',
    'homepage_url',
  ]) {
    if (existing[field] == null && incoming[field] != null)
      patch[field] = incoming[field];
  }
  if (
    (!existing.event_mode || existing.event_mode === 'UNKNOWN') &&
    incoming.event_mode !== 'UNKNOWN'
  )
    patch.event_mode = incoming.event_mode;
  if (
    existing.item_type === 'CFP' &&
    incoming.deadline_extended &&
    incoming.deadline > existing.deadline
  )
    patch.deadline = incoming.deadline;
  return patch;
}
export function validDate(value) {
  if (value == null || value === '') return true;
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateItem(item) {
  if (!['CFP', 'EVENT'].includes(item.item_type))
    throw new Error('Choose CFP or Event.');
  if (typeof item.title !== 'string' || !item.title.trim())
    throw new Error('A title is required.');
  if (item.title.length > 500)
    throw new Error('Title must be 500 characters or fewer.');
  if (!['IN_PERSON', 'ONLINE', 'HYBRID', 'UNKNOWN'].includes(item.event_mode))
    throw new Error('Choose a valid event mode.');
  for (const field of ['deadline', 'event_start', 'event_end'])
    if (!validDate(item[field])) throw new Error('Enter valid calendar dates.');
  if (item.event_end && !item.event_start)
    throw new Error('Enter an event start date before an end date.');
  if (item.event_end && item.event_start > item.event_end)
    throw new Error('Event end cannot precede event start.');
  if (item.item_type === 'EVENT' && item.deadline)
    throw new Error('Use a separate CFP for a submission deadline.');
  if (item.item_type === 'CFP' && (item.event_start || item.event_end))
    throw new Error('Use a separate Event for event dates.');
  if (item.homepage_url && !normaliseUrl(item.homepage_url))
    throw new Error('Announcement URL must be a valid HTTP or HTTPS address.');
  if (
    !Array.isArray(item.topics) ||
    item.topics.some((topic) => typeof topic !== 'string' || topic.length > 100)
  )
    throw new Error('Topics must be short text keywords.');
}

// Canonical Estonian categories shared by the importer and staff editor.
export const ACADEMIC_TOPICS = [
  'ajakirjandus',
  'ajalugu',
  'akadeemiline kirjutamine',
  'andmeteadus',
  'antropoloogia',
  'arendustehnoloogiad',
  'avalik esinemine',
  'avalik poliitika',
  'avatud juurdepääs',
  'avatud kirjastamine',
  'avatud teadmus',
  'avatud teadus',
  'bioloogia',
  'digihumanitaaria',
  'digitaalne suveräänsus',
  'digitaalne ühiskond',
  'doktoriõpe',
  'ebavõrdsus',
  'eetika',
  'ettevõtlus',
  'filosoofia',
  'füüsika',
  'haridus',
  'infokorraldus',
  'infoteadus',
  'inseneriteadused',
  'intellektuaalomand',
  'jälgimisuuringud',
  'keeleteadus',
  'keemia',
  'keskkond',
  'kestlikkus',
  'kirjandusteadus',
  'kirjastamine',
  'kliimamuutused',
  'kommunikatsioon',
  'kultuuriuuringud',
  'kunst',
  'kõrgharidus',
  'liftikõne',
  'linnauuringud',
  'loodusteadused',
  'lõputöö esitlemine',
  'majandus',
  'matemaatika',
  'meditsiin',
  'meediauuringud',
  'poliitika',
  'politoloogia',
  'praktiline õpe',
  'psühholoogia',
  'rahvusvahelised suhted',
  'reprodutseeritavus',
  'ränne',
  'soouuringud',
  'sotsiaalteadused',
  'sotsiaaltöö',
  'sotsioloogia',
  'tarkvaraarendus',
  'teadmussiire',
  'teadusandmete haldamine',
  'teaduse mõju',
  'teaduskommunikatsioon',
  'teaduskoostöö',
  'teaduskorraldus',
  'teaduspoliitika',
  'teadustulemuste kommertsialiseerimine',
  'tehisintellekt',
  'tehnoloogia',
  'tervis',
  'turvalisus',
  'uurimismeetodid',
  'valitsemine',
  'õigusteadus',
  'ühiskond',
];
