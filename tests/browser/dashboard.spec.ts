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
    topics: ['digital society'],
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
      topics: ['methods'],
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
  await expect(
    page.getByRole('heading', { name: 'Research on Digital Society' }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Expired CFP' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Edit', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Past', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Expired CFP' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('searchbox').fill('Tallinn');
  await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('searchbox').fill('');
  await page
    .getByRole('combobox', { name: /^Topic/ })
    .selectOption('digital society');
  await expect(page.locator('article')).toHaveCount(1);
  expect(
    requests.some((r) => /item_sources|processed_emails/.test(r.url)),
  ).toBe(false);
  await page.getByRole('button', { name: 'Reset filters' }).click();
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
test('staff login disables account creation', async ({ page }) => {
  const requests = await api(page);
  await page.goto('/');
  await page.getByRole('button', { name: /Admin login/ }).click();
  await page.getByLabel('Email address').fill('invited@example.org');
  await page.getByRole('button', { name: 'Send sign-in link' }).click();
  await expect(
    page.getByText('Check your email for a sign-in link.', { exact: false }),
  ).toBeVisible();
  expect(requests.find((r) => r.url.includes('/otp'))?.data.create_user).toBe(
    false,
  );
});
test('staff can add CFP and event, edit, inspect provenance, archive, restore and delete', async ({
  page,
}) => {
  await api(page, true);
  await page.goto('/');
  await page.getByRole('button', { name: '+ Add item' }).click();
  await page.getByLabel('Title').fill('Staff CFP');
  await page.getByLabel('Deadline', { exact: true }).fill(day(20));
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(
    page.getByRole('heading', { name: 'Staff CFP', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '+ Add item' }).click();
  await page.getByRole('combobox', { name: /^Type/ }).selectOption('EVENT');
  await page.getByLabel('Title').fill('Staff conference');
  await page.getByLabel('Event start').fill(day(40));
  await page.getByLabel('Event end').fill(day(42));
  await page.getByRole('button', { name: 'Save item' }).click();
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: 'Staff conference' }) });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Location', { exact: true }).fill('Tartu');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(card.getByText('Tartu', { exact: true })).toBeVisible();
  const automated = page
    .locator('article')
    .filter({
      has: page.getByRole('heading', { name: 'Research on Digital Society' }),
    });
  await automated.getByRole('button', { name: 'Sources', exact: true }).click();
  await expect(page.getByText('private-sender@example.org')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await card.getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Archived', exact: true }).click();
  await card.getByRole('button', { name: 'Restore', exact: true }).click();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete permanently' }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('button', { name: /Admin login/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add item' })).toHaveCount(0);
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
  await expect(page.getByRole('alert')).toContainText('Database unavailable');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
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
  await expect(page.locator('article img')).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: /Open announcement/ }),
  ).toHaveCount(0);
});
