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
    title: 'Research on Digital Society',
    journal: 'Digital Studies Journal',
    organiser: null,
    summary: 'A call for research on institutions and technology.',
    deadline: day(30),
    event_start: null,
    event_end: null,
    event_mode: 'UNKNOWN',
    location: null,
    homepage_url: 'https://example.org/cfp',
    topics: ['digitaalne ühiskond'],
    source_type: 'EMAIL',
    archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...changes,
  };
}
async function api(page: Page, staff = false) {
  let rows = [
    item('1'),
    item('2', {
      item_type: 'EVENT',
      title: 'Research Methods Workshop',
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
  const user = {
    id: '11111111-1111-4111-8111-111111111111',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'staff@example.org',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  if (staff) {
    const jwt = [
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      Buffer.from(
        JSON.stringify({
          sub: user.id,
          exp: Math.floor(Date.now() / 1000) + 3600,
          role: 'authenticated',
        }),
      ).toString('base64url'),
      'testsignature',
    ].join('.');
    await page.addInitScript(
      ({ user, jwt }) =>
        localStorage.setItem(
          'sb-cfp-test-auth-token',
          JSON.stringify({
            access_token: jwt,
            refresh_token: 'test-refresh',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            token_type: 'bearer',
            user,
          }),
        ),
      { user, jwt },
    );
  }
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
    if (url.pathname.includes('/auth/v1/user')) return respond(user);
    if (url.pathname.includes('/auth/v1/otp')) return respond({});
    if (url.pathname.includes('/auth/v1/logout')) return respond({});
    if (url.pathname.includes('/item_sources'))
      return respond([
        {
          id: 's1',
          source_excerpt: 'Academic announcement excerpt',
          extraction_confidence: 0.96,
          processed_emails: {
            sender: 'private-sender@example.org',
            subject: 'Private newsletter subject',
            received_at: new Date().toISOString(),
          },
        },
      ]);
    if (url.pathname.includes('/items')) {
      if (req.method() === 'GET')
        return respond(rows.filter((row) => staff || !row.archived));
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

test('public read, search, topics, date filtering and mobile layout', async ({
  page,
}) => {
  const requests = await api(page);
  await page.goto('/');
  await expect(page).toHaveTitle('ÜTI CFP & Sündmuste jälgija');
  await expect(page.locator('html')).toHaveAttribute('lang', 'et');
  await expect(
    page.getByRole('heading', { name: 'Research on Digital Society' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Expired CFP' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Muuda', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Möödunud', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Expired CFP' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Kõik', exact: true }).click();
  await page.getByRole('searchbox').fill('Tallinn');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('searchbox').fill('');
  await page
    .getByRole('combobox', { name: /^Teema/ })
    .selectOption('digitaalne ühiskond');
  await expect(page.locator('tbody tr')).toHaveCount(1);
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
test('added-date filter uses Tallinn dates and Monday calendar weeks', async ({
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
  await expect(page.locator('.metric')).toHaveCount(2);
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
  await filter.selectOption('week');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await filter.selectOption('last7');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await filter.selectOption('month');
  await expect(page.locator('tbody tr')).toHaveCount(5);
  await page.getByRole('button', { name: 'Lähtesta filtrid' }).click();
  await expect(filter).toHaveValue('last7');
  await expect(page.locator('tbody tr')).toHaveCount(4);
  await filter.selectOption('all');
  await expect(page.locator('tbody tr')).toHaveCount(6);
});

test('header source link opens the guide instead of staff login', async ({
  page,
}) => {
  await api(page);
  await page.goto('/');
  await expect(
    page.getByRole('button', { name: /Halduri sisselogimine/ }),
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

test('staff can add CFP and event, edit, inspect provenance, archive, restore and delete', async ({
  page,
}) => {
  await api(page, true);
  await page.goto('/');
  await page.getByRole('button', { name: '+ Lisa kuulutus' }).click();
  await page.getByLabel('Pealkiri').fill('Staff CFP');
  await page.getByLabel('Tähtaeg', { exact: true }).fill(day(20));
  await page.getByRole('button', { name: 'Salvesta kuulutus' }).click();
  await expect(
    page.getByRole('heading', { name: 'Staff CFP', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '+ Lisa kuulutus' }).click();
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
  const automated = page.locator('tbody tr').filter({
    has: page.getByRole('heading', { name: 'Research on Digital Society' }),
  });
  await automated.getByRole('button', { name: 'Allikad', exact: true }).click();
  await expect(page.getByText('private-sender@example.org')).toBeVisible();
  await page.getByRole('button', { name: 'Sulge aken' }).click();
  await card.getByRole('button', { name: 'Arhiveeri', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Arhiveeritud', exact: true }).click();
  await card.getByRole('button', { name: 'Taasta', exact: true }).click();
  await page.getByRole('button', { name: 'Kõik', exact: true }).click();
  await card.getByRole('button', { name: 'Kustuta', exact: true }).click();
  await page.getByRole('button', { name: 'Kustuta jäädavalt' }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Logi välja' }).click();
  await expect(
    page.locator('header').getByRole('link', { name: /Lisa uus allikas/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '+ Lisa kuulutus' }),
  ).toHaveCount(0);
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
  ];
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
  await row('Seven days CFP').getByText('Kokkuvõte', { exact: true }).click();
  await expect(
    row('Seven days CFP').getByText(
      'A call for research on institutions and technology.',
    ),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Möödunud', exact: true }).click();
  await expect(row('Past CFP')).toHaveClass(/date-past/);
  await expect(row('Past CFP')).toContainText('Möödunud · 1 päev tagasi');
});
