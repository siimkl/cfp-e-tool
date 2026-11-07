import { test, expect, type Page } from '@playwright/test';

function day(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function item(id: string, changes = {}) {
  return {
    id,
    item_type: 'CFP',
    category: 'Ühiskond ja sotsiaalteadused',
    title: 'Research on Digital Society',
    journal: 'Digital Studies Journal',
    organiser: null,
    summary: 'A call for research on institutions and technology.',
    deadline: day(30),
    event_start: null,
    event_end: null,
    event_time: null,
    event_mode: 'UNKNOWN',
    location: null,
    homepage_url: 'https://example.org/cfp',
    topics: ['digitaalne ühiskond'],
    source_type: 'EMAIL',
    archived: false,
    highlighted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...changes,
  };
}
async function api(page: Page) {
  let rows = [
    item('1'),
    item('2', {
      item_type: 'EVENT',
      title: 'Research Methods Workshop',
      category: 'Valdkondadeülene teadus',
      deadline: null,
      event_start: day(15),
      event_end: day(17),
      event_mode: 'HYBRID',
      location: 'Tallinn',
      topics: ['uurimismeetodid'],
    }),
    item('3', { title: 'Expired CFP', deadline: day(-3) }),
    item('4', { title: 'Archived CFP', archived: true }),
  ];
  const requests: { url: string; method: string; data: any }[] = [];
  await page.route('https://cfp-test.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const data = req.postDataJSON();
    requests.push({ url: url.pathname, method: req.method(), data });
    const respond = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    if (url.pathname === '/functions/v1/structure-item') {
      return respond({
        item: {
          item_type: 'CFP',
          title: 'Staff CFP',
          category: 'Ühiskond ja sotsiaalteadused',
          journal: 'Internal Research Journal',
          organiser: null,
          summary: 'A structured announcement from pasted text.',
          deadline: day(20),
          event_start: null,
          event_end: null,
          event_time: null,
          event_mode: 'UNKNOWN',
          location: null,
          homepage_url: 'https://example.org/staff-cfp',
          topics: ['sotsiaalteadused'],
        },
      });
    }
    if (url.pathname.includes('/items')) {
      if (req.method() === 'GET') return respond(rows);
      if (req.method() === 'POST') {
        const row = item(String(rows.length + 1), data);
        rows.push(row);
        return respond({ id: row.id }, 201);
      }
      const id = url.searchParams.get('id')?.replace('eq.', '');
      if (req.method() === 'PATCH') {
        rows = rows.map((row) => (row.id === id ? { ...row, ...data } : row));
        return respond({ id });
      }
      if (req.method() === 'DELETE') {
        rows = rows.filter((row) => row.id !== id);
        return respond({ id });
      }
    }
    return respond({});
  });
  return requests;
}

test('public read, search, date filtering and mobile layout', async ({
  page,
}) => {
  const requests = await api(page);
  await page.goto('/');
  await expect(page).toHaveTitle('ÜTI Teadusradar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'et');
  await expect(
    page.getByRole('heading', { name: 'Research on Digital Society' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Expired CFP' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Muuda', exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Kuulutuste olek' })
    .selectOption('past');
  await expect(
    page.getByRole('heading', { name: 'Expired CFP' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Kõik \(/ }).click();
  await page
    .getByRole('combobox', { name: 'Kuulutuste olek' })
    .selectOption('current');
  await page.getByRole('searchbox').fill('Tallinn');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('searchbox').fill('');
  await expect(
    page.getByRole('combobox', { name: 'Teema', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Järjestus' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('option', { name: 'Uued kuulutused' }),
  ).toHaveCount(0);
  expect(
    requests.some((r) => /item_sources|processed_emails/.test(r.url)),
  ).toBe(false);
  await page.getByRole('button', { name: 'Lähtesta filtrid' }).click();
  await page.screenshot({
    path: 'test-results/dashboard-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('heading', { name: 'Research Methods Workshop' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/dashboard-mobile.png',
    fullPage: true,
  });
});

test('highlighted-only checkbox filters the public table', async ({ page }) => {
  await page.route('https://cfp-test.supabase.co/rest/v1/items*', (route) =>
    route.fulfill({
      json: [
        item('highlighted', {
          title: 'Highlighted research call',
          highlighted: true,
        }),
        item('regular', { title: 'Regular research call' }),
      ],
    }),
  );
  await page.goto('/');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Ainult esiletõstetud').check();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  const highlighted = page.locator('tbody tr');
  await expect(highlighted).toHaveClass(/item-highlighted/);
  await expect(highlighted).toContainText('Highlighted research call');
  await expect(highlighted).not.toContainText('Regular research call');
});

test('dashboard falls back cleanly before the highlight migration is applied', async ({
  page,
}) => {
  const { highlighted: _highlighted, ...legacyItem } = item('legacy');
  let requests = 0;
  await page.route('https://cfp-test.supabase.co/rest/v1/items*', (route) => {
    requests++;
    const selected = new URL(route.request().url()).searchParams.get('select');
    if (selected?.includes('highlighted')) {
      return route.fulfill({
        status: 400,
        json: {
          code: '42703',
          message: 'column items.highlighted does not exist',
        },
      });
    }
    return route.fulfill({ json: [legacyItem] });
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Research on Digital Society' }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByLabel('Ainult esiletõstetud')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Tõsta esile' }),
  ).toBeDisabled();
  expect(requests).toBeGreaterThanOrEqual(2);
});

test('added-date filter uses Tallinn dates and rolling periods', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-08T12:00:00Z') });
  const rows = [
    item('today', {
      title: 'Added today',
      created_at: '2026-10-07T21:30:00Z',
      deadline: '2027-01-01',
    }),
    item('yesterday', {
      title: 'Added yesterday',
      created_at: '2026-10-07T20:30:00Z',
      deadline: '2027-01-01',
    }),
    item('monday', {
      title: 'Added Monday',
      created_at: '2026-10-05T10:00:00Z',
      deadline: '2027-01-01',
    }),
    item('sunday', {
      title: 'Added Sunday',
      created_at: '2026-10-04T10:00:00Z',
      deadline: '2027-01-01',
    }),
    item('month', {
      title: 'Added this month',
      created_at: '2026-10-01T10:00:00Z',
      deadline: '2027-01-01',
    }),
    item('previous', {
      title: 'Added last month',
      created_at: '2026-09-30T10:00:00Z',
      deadline: '2027-01-01',
    }),
  ];
  await page.route('https://cfp-test.supabase.co/rest/v1/items*', (route) =>
    route.fulfill({ json: rows }),
  );
  await page.goto('/');
  await expect(page.locator('.metric')).toHaveCount(0);
  const filter = page.getByRole('combobox', { name: 'Lisamise aeg' });
  await filter.selectOption('today');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'Added today', exact: true }),
  ).toBeVisible();
  await filter.selectOption('yesterday');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(
    page.getByRole('heading', { name: 'Added yesterday', exact: true }),
  ).toBeVisible();
  await expect(filter.locator('option[value=week]')).toHaveCount(0);
  await filter.selectOption('last7');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await expect(filter.locator('option[value=month]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Lähtesta filtrid' }).click();
  await expect(filter).toHaveValue('last7');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await filter.selectOption('all');
  await expect(page.locator('tbody tr')).toHaveCount(6);
});

test('open workspace exposes creation controls and the source guide', async ({
  page,
}) => {
  await api(page);
  await page.goto('/');
  await expect(
    page.locator('header').getByRole('button', { name: '+ Lisa kuulutus' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Halduri sisselogimine' }),
  ).toHaveCount(0);
  await page
    .locator('header')
    .getByRole('link', { name: /Lisa uus allikas/ })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Lisa uus allikas, mida jälgida',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/allikad$/);
});

test('any visitor can add CFP and event, edit, archive, highlight, restore and delete', async ({
  page,
}) => {
  const requests = await api(page);
  await page.goto('/');
  await page.getByRole('button', { name: '+ Lisa kuulutus' }).click();
  const source = page.getByLabel('Kleebi link või kuulutuse tekst');
  await expect(source).toHaveAttribute('maxlength', '1000');
  await source.fill(
    'Call for papers: Staff CFP. Deadline in twenty days. https://example.org/staff-cfp',
  );
  await expect(page.getByText('82 / 1000', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tuvasta andmed' }).click();
  await expect(
    page.getByRole('heading', { name: 'Kontrolli kuulutuse andmeid' }),
  ).toBeVisible();
  await expect(page.getByLabel('Pealkiri')).toHaveValue('Staff CFP');
  expect(
    requests.some(
      (request) =>
        request.url === '/functions/v1/structure-item' &&
        request.data?.text?.startsWith('Call for papers:'),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Salvesta kuulutus' }).click();
  await expect(
    page.getByRole('heading', { name: 'Staff CFP', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '+ Lisa kuulutus' }).click();
  await page.getByRole('button', { name: 'Täida käsitsi' }).click();
  await page.getByRole('combobox', { name: /^Liik/ }).selectOption('EVENT');
  await page.getByLabel('Pealkiri').fill('Staff conference');
  await page.getByLabel('Sündmuse algus').fill(day(40));
  await page.getByLabel('Sündmuse lõpp').fill(day(42));
  await page.getByRole('button', { name: 'Salvesta kuulutus' }).click();
  const card = page
    .locator('tbody tr')
    .filter({ has: page.getByRole('heading', { name: 'Staff conference' }) });
  await card.getByRole('button', { name: 'Muuda', exact: true }).click();
  await page.getByLabel('Asukoht', { exact: true }).fill('Tartu');
  await page.getByRole('button', { name: 'Salvesta kuulutus' }).click();
  await expect(card.getByText('Tartu', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Arhiveeri', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: /^Arhiveeritud \(/ }).click();
  await card.getByRole('button', { name: 'Taasta', exact: true }).click();
  await page.getByRole('button', { name: /^Kõik \(/ }).click();
  await card.getByRole('button', { name: 'Tõsta esile', exact: true }).click();
  await expect(card).toHaveClass(/item-highlighted/);
  await expect(card.locator('.highlighted-badge')).toContainText(
    'Esiletõstetud',
  );
  await page.getByLabel('Ainult esiletõstetud').check();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Lähtesta filtrid' }).click();
  await expect(page.getByLabel('Ainult esiletõstetud')).not.toBeChecked();
  await card.getByRole('button', { name: 'Kustuta', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Kustuta jäädavalt' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Kustuta jäädavalt' }).click();
  await expect(card).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '+ Lisa kuulutus' }),
  ).toBeVisible();
});
test('backend errors remain visible with a retry control', async ({ page }) => {
  await page.route('https://cfp-test.supabase.co/rest/v1/items*', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Database unavailable' }),
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(
    'Kuulutuste laadimine ebaõnnestus. Proovi uuesti.',
  );
  await expect(
    page.getByRole('button', { name: 'Proovi uuesti' }),
  ).toBeVisible();
});

test('announcement text is escaped and dangerous links are suppressed', async ({
  page,
}) => {
  await page.route('https://cfp-test.supabase.co/rest/v1/items*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        item('xss', {
          title: '<img src=x onerror=alert(1)>',
          homepage_url: 'javascript:alert(1)',
        }),
      ]),
    }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: '<img src=x onerror=alert(1)>' }),
  ).toBeVisible();
  await expect(page.locator('tbody img')).toHaveCount(0);
  await expect(page.locator('tbody a')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Ava kuulutus/ })).toHaveCount(0);
});

test('table countdown distinguishes today, urgency boundaries, ongoing and past events', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-08T12:00:00Z') });
  const rows = [
    item('today', { title: 'Today CFP', deadline: '2026-10-08' }),
    item('seven', { title: 'Seven days CFP', deadline: '2026-10-15' }),
    item('eight', { title: 'Eight days CFP', deadline: '2026-10-16' }),
    item('thirty', { title: 'Thirty days CFP', deadline: '2026-11-07' }),
    item('later', { title: 'Later CFP', deadline: '2026-11-08' }),
    item('unknown', { title: 'Unknown CFP', deadline: null }),
    item('ongoing', {
      title: 'Ongoing event',
      item_type: 'EVENT',
      deadline: null,
      event_start: '2026-10-07',
      event_end: '2026-10-09',
    }),
    item('past', { title: 'Past CFP', deadline: '2026-10-07' }),
  ].map((row) => ({ ...row, created_at: '2026-10-08T10:00:00Z' }));
  await page.route('https://cfp-test.supabase.co/rest/v1/items*', (route) =>
    route.fulfill({ json: rows }),
  );
  await page.goto('/');
  const row = (title: string) =>
    page
      .locator('tbody tr')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await expect(row('Today CFP')).toContainText('Tähtaeg täna');
  await expect(row('Seven days CFP')).toHaveClass(/date-urgent/);
  await expect(row('Seven days CFP')).toContainText('7 päeva tähtajani');
  await expect(row('Eight days CFP')).toHaveClass(/date-soon/);
  await expect(row('Thirty days CFP')).toHaveClass(/date-soon/);
  await expect(row('Later CFP')).toHaveClass(/date-later/);
  await expect(row('Unknown CFP')).toHaveClass(/date-unknown/);
  await expect(row('Ongoing event')).toContainText('Käimas · lõpuni 1 päev');
  await expect(
    page.getByRole('columnheader', { name: 'Kokkuvõte', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Teemad', exact: true }),
  ).toHaveCount(0);
  await expect(
    row('Seven days CFP').locator('.announcement-cell'),
  ).not.toContainText('A call for research');
  await expect(
    row('Seven days CFP').getByText(
      'A call for research on institutions and technology.',
    ),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Kuulutuste olek' })
    .selectOption('past');
  await expect(row('Past CFP')).toHaveClass(/date-past/);
  await expect(row('Past CFP')).toContainText('Möödunud · 1 päev tagasi');
});

test('removed source page falls back to dashboard and footer has webmaster contact', async ({
  page,
}) => {
  await api(page);
  await page.goto('/#/jalgitavad-allikad');
  await expect(
    page.getByRole('heading', { name: 'Jälgitavad allikad', exact: true }),
  ).toHaveCount(0);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(
    page.locator('footer').getByRole('link', { name: 'Jälgitavad allikad' }),
  ).toHaveCount(0);
  await expect(
    page.locator('footer').getByRole('link', { name: 'siim.klais@ut.ee' }),
  ).toHaveAttribute('href', 'mailto:siim.klais@ut.ee');
  await page
    .locator('header')
    .getByRole('link', { name: /Lisa uus allikas/ })
    .click();
  await expect(page.getByRole('note')).toContainText(
    'mitte isiklikku ega asutusesisest kirjavahetust.',
  );
  await expect(page.getByRole('note')).toContainText('OpenAI');
});

test('broad category filters announcements and architecture shows all three diagrams', async ({
  page,
}) => {
  await api(page);
  await page.goto('/');
  await expect(
    page.getByRole('columnheader', { name: 'Kategooria', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Kategooria', exact: true })
    .selectOption('Valdkondadeülene teadus');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText(
    'Research Methods Workshop',
  );
  await page
    .getByRole('combobox', { name: 'Kategooria', exact: true })
    .selectOption('');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page
    .getByRole('link', { name: 'CFP rakenduse arhitektuur', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Tehniline arhitektuur', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Andmebaasi andmemudel', exact: true }),
  ).toBeVisible();
  await expect(page.locator('article svg')).toHaveCount(3);
  await page.screenshot({
    path: 'test-results/architecture-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('initiative tab counts active items and shows undated research initiatives', async ({
  page,
}) => {
  await page.route('https://cfp-test.supabase.co/rest/v1/items*', (route) =>
    route.fulfill({
      json: [
        item('initiative', {
          item_type: 'INITIATIVE',
          title: 'DigiLabour: new research lab website',
          deadline: null,
        }),
        item('cfp'),
        item('past', { deadline: day(-2) }),
      ],
    }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: 'Kõik (2)', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: 'Call for Papers (CFP) (1)',
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Algatused (1)', exact: true })
    .click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody')).toContainText('DigiLabour');
  await expect(page.locator('tbody')).toContainText('Kuupäevata algatus');
  await expect(page.locator('.type-badge.initiative svg')).toHaveCount(1);
});

test('event time is displayed as supplied and missing date appears only once', async ({
  page,
}) => {
  await page.route('https://cfp-test.supabase.co/rest/v1/items*', (route) =>
    route.fulfill({
      json: [
        item('timed', {
          item_type: 'EVENT',
          deadline: null,
          event_start: null,
          event_time: '14:00 CET',
          location: 'Microsoft Teams',
          event_mode: 'ONLINE',
        }),
      ],
    }),
  );
  await page.goto('/');
  await expect(page.locator('.event-time')).toHaveText('14:00 CET');
  await expect(
    page.getByText('Kuupäev täpsustamisel', { exact: true }),
  ).toHaveCount(1);
  await expect(page.locator('.location-cell')).toContainText('Microsoft Teams');
});
