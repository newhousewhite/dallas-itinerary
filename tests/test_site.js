const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const APP_READY_TIMEOUT = 10_000;
const ROUTES = [
  ['index.html', 'overview'],
  ['arrival.html', 'arrival'],
  ['day1.html', 'day1'],
  ['day2.html', 'day2'],
  ['departure.html', 'departure'],
  ['about.html', 'about'],
  ['map.html', 'map'],
  ['lunch.html', 'lunch'],
  ['trolley.html', 'trolley'],
];

const CONTENT_TYPES = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ics': 'text/calendar; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

let baseUrl;
let browser;
let server;

before(async () => {
  server = http.createServer((request, response) => {
    const requestPath = new URL(request.url, 'http://localhost').pathname;
    const relativePath = requestPath === '/' ? 'index.html' : decodeURIComponent(requestPath.slice(1));
    const filePath = path.resolve(ROOT, relativePath);

    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROME_PATH
      || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
});

after(async () => {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
});

test('every route renders with active navigation and loaded images', async () => {
  for (const [route, pageId] of ROUTES) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    const response = await page.goto(`${baseUrl}/${route}`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200, route);
    try {
      await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });
    } catch (error) {
      await page.close();
      throw new Error(`${route}: app did not become ready; console errors: ${JSON.stringify(errors)}`, { cause: error });
    }

    assert.equal(await page.locator('.date-nav a').count(), ROUTES.length, route);
    assert.equal(await page.locator('.date-nav a[aria-current="page"]').count(), 1, route);
    assert.equal(await page.locator('body').getAttribute('data-page'), pageId, route);
    assert.ok((await page.locator('h1').first().innerText()).trim(), route);
    assert.deepEqual(errors, [], route);

    const images = page.locator('img');
    for (let index = 0; index < await images.count(); index += 1) {
      const image = images.nth(index);
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((element) => element.decode());
      assert.ok(await image.evaluate((element) => element.naturalWidth), `${route}: image ${index}`);
    }
    await page.close();
  }
});

test('destination guide renders before the map, lunch, and trolley pages', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/about.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });

  assert.equal((await page.locator('h1').innerText()).trim(), 'Dallas Fort Worth는 어떤 곳인가요?');
  const navLinks = page.locator('.date-nav a');
  assert.equal(await navLinks.count(), 9);
  assert.equal((await navLinks.nth(5).innerText()).includes('지역 안내'), true);
  assert.equal((await navLinks.nth(6).innerText()).includes('여행 지도'), true);
  assert.equal((await navLinks.nth(7).innerText()).includes('점심 추천'), true);
  assert.equal((await navLinks.nth(8).innerText()).includes('M-Line 트롤리'), true);
  assert.equal(await page.locator('.history-milestone').count(), 7);
  assert.equal(await page.locator('.history-theme').count(), 3);
  assert.equal(await page.locator('.city-guide-card').count(), 3);
  assert.equal(await page.locator('.city-place').count(), 15);
  assert.equal(await page.locator('.travel-tip').count(), 4);
  assert.match(await page.locator('.destination-guide').innerText(), /텍사스 BBQ.*TRE 통근열차.*식당 팁 문화\(약 15~20%\)/s);
  await page.close();
});

test('overview exports the itinerary to iCal and Google Calendar', async () => {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });

  const calendar = page.locator('.calendar-section');
  await calendar.waitFor({ timeout: 5000 });
  assert.match(await calendar.innerText(), /캘린더로 일정 내보내기.*종료 시간이 없는 일정은 1시간으로 내보냅니다/s);
  assert.equal(await calendar.locator('.calendar-download-button').count(), 1);
  assert.equal(await calendar.locator('.google-calendar-link').count(), 12);
  assert.equal(await calendar.locator('.calendar-download-button').getAttribute('href'), 'calendar/howdy-eight-dallas-fort-worth.ics');
  assert.equal(await calendar.locator('.calendar-download-button').getAttribute('download'), 'howdy-eight-dallas-fort-worth.ics');

  const firstGoogle = new URL(await calendar.locator('.google-calendar-link').first().getAttribute('href'));
  assert.equal(firstGoogle.origin + firstGoogle.pathname, 'https://calendar.google.com/calendar/render');
  assert.equal(firstGoogle.searchParams.get('action'), 'TEMPLATE');
  assert.equal(firstGoogle.searchParams.get('text'), '달라스 리셉션');
  assert.equal(firstGoogle.searchParams.get('dates'), '20260716T190000/20260716T220000');
  assert.equal(firstGoogle.searchParams.get('ctz'), 'America/Chicago');
  assert.equal(firstGoogle.searchParams.get('location'), '3 Nations Brewing');
  assert.match(firstGoogle.searchParams.get('details'), /Tex-Mex/);

  const rodeoGoogle = new URL(await calendar.locator('[data-calendar-event-id="cowtown-rodeo"] .google-calendar-link').getAttribute('href'));
  assert.equal(rodeoGoogle.searchParams.get('dates'), '20260718T193000/20260718T203000');

  const downloadPromise = page.waitForEvent('download');
  await calendar.locator('.calendar-download-button').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'howdy-eight-dallas-fort-worth.ics');
  const ics = fs.readFileSync(await download.path(), 'utf8');
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /X-WR-TIMEZONE:America\/Chicago/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 12);
  assert.match(ics, /DTSTART;TZID=America\/Chicago:20260716T190000/);
  assert.match(ics, /DTEND;TZID=America\/Chicago:20260716T220000/);
  assert.match(ics, /SUMMARY:달라스 리셉션/);
  assert.match(ics, /SUMMARY:Rodeo @ Cowtown Coliseum/);
  assert.match(ics, /DTSTART;TZID=America\/Chicago:20260718T193000/);
  assert.match(ics, /DTEND;TZID=America\/Chicago:20260718T203000/);

  await context.close();
});

test('the map tab loads all places and opens a marker from the list', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/map.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });

  const iframe = page.locator('iframe.travel-map-frame');
  assert.equal(await iframe.getAttribute('title'), '댈러스·포트워스·알링턴 여행 지도');
  const map = page.frameLocator('iframe.travel-map-frame');
  await map.locator('#map.leaflet-container').waitFor({ timeout: 10000 });
  const mapItems = map.locator('.item');
  assert.equal(await mapItems.count(), 37);
  await mapItems.nth(1).click();
  await map.locator('.leaflet-popup').waitFor({ timeout: 3000 });
  assert.match(await map.locator('.leaflet-popup').innerText(), /식스 플로어 박물관/);
  await page.close();
});

test('the map renders eleven lunch recommendations as a separate group', async () => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/map.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });

  const map = page.frameLocator('iframe.travel-map-frame');
  await map.locator('#map.leaflet-container').waitFor({ timeout: 10000 });
  const lunchGroup = map.locator('.grp[data-group="lunch"]');
  await lunchGroup.waitFor({ timeout: 5000 });
  assert.equal(await lunchGroup.locator('.item').count(), 11);
  assert.match(await lunchGroup.innerText(), /점심 추천.*Malai Kitchen.*Cosmic Cafe/s);
  assert.equal(await map.locator('[data-place-count]').innerText(), '36');

  const firstLunch = lunchGroup.locator('.item[data-place-id="L1"]');
  await firstLunch.click();
  const popup = map.locator('.leaflet-popup');
  await popup.waitFor({ timeout: 3000 });
  assert.match(await popup.innerText(), /Malai Kitchen.*업타운.*\$25 ~ \$40.*3699 McKinney Ave/s);
  assert.equal(
    await popup.locator('.map-link').getAttribute('href'),
    'https://maps.app.goo.gl/2UaDwhBLH6jYZJUi6',
  );
  await popup.locator('.copy-address-button').click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    '3699 McKinney Ave Ste 350, Dallas, TX 75204',
  );
  await context.close();
});

test('the map keeps its core places when lunch data cannot load', async () => {
  const page = await browser.newPage();
  await page.route('**/data/itinerary.json', (route) => {
    if (route.request().frame().url().includes('/maps/')) route.abort();
    else route.continue();
  });
  await page.goto(`${baseUrl}/map.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });

  const map = page.frameLocator('iframe.travel-map-frame');
  await map.locator('#map.leaflet-container').waitFor({ timeout: 10000 });
  const lunchGroup = map.locator('.grp[data-group="lunch"]');
  await lunchGroup.waitFor({ timeout: 5000 });
  assert.equal(await map.locator('.item').count(), 26);
  assert.match(await lunchGroup.innerText(), /점심 정보를 불러오지 못했습니다/);
  assert.equal(await map.locator('[data-place-count]').innerText(), '25');
  await page.close();
});

test('the lunch tab renders eleven two-image recommendation cards', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/lunch.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });

  assert.equal((await page.locator('h1').innerText()).trim(), '오늘 점심, 어디서 먹을까요?');
  assert.equal(await page.locator('.lunch-card').count(), 11);
  assert.equal(await page.locator('.lunch-gallery img').count(), 22);
  assert.equal(await page.locator('.lunch-card .button-link').count(), 11);
  assert.match(await page.locator('.lunch-grid').innerText(), /Malai Kitchen.*Mexican Sugar.*Cosmic Cafe/s);

  const cards = page.locator('.lunch-card');
  for (let index = 0; index < await cards.count(); index += 1) {
    assert.equal(await cards.nth(index).locator('.lunch-gallery img').count(), 2);
    assert.match(await cards.nth(index).locator('.button-link').getAttribute('href'), /^https:\/\/maps\.app\.goo\.gl\//);
  }
  await page.close();
});

test('the final trolley tab embeds the copied guide', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/trolley.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });

  assert.equal(await page.locator('.date-nav a').count(), 9);
  assert.equal(await page.locator('.date-nav a[aria-current="page"]').innerText(), '08\nM-Line 트롤리');

  const iframe = page.locator('iframe.travel-map-frame');
  assert.equal(await iframe.getAttribute('src'), 'resources/mline-trolley-guide-ko.html');
  assert.equal(await iframe.getAttribute('title'), 'M-Line Trolley 한국어 안내');
  const frame = page.frameLocator('iframe.travel-map-frame');
  await frame.locator('body').waitFor({ timeout: 5000 });
  assert.ok((await frame.locator('body').innerText()).trim().length > 0);

  await page.close();
});

test('a failed lunch image is replaced with the shared runtime fallback', async () => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.route('**/images/dallas/lunch/malai-kitchen-1.jpg', (route) => route.abort());
  await page.goto(`${baseUrl}/lunch.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });

  const firstGallery = page.locator('.lunch-card').first().locator('.lunch-gallery');
  assert.equal(await firstGallery.locator('.runtime-fallback').count(), 1);
  assert.equal(await firstGallery.locator('img').count(), 1);
  await page.close();
});

test('rendered addresses copy exact text and announce success', async () => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/day1.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });
  assert.equal(await page.locator('.place-card .copy-address-button').count(), 12);
  assert.equal(await page.locator('.timeline-item .copy-address-button').count(), 1);
  const dayOneButton = page.locator('.place-card .copy-address-button').first();
  await dayOneButton.click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    'Nasher: 2001 Flora St, Dallas, TX 75201 · DMA: 1717 N Harwood St, Dallas, TX 75201',
  );
  assert.match(await dayOneButton.innerText(), /복사됨/);

  await page.goto(`${baseUrl}/arrival.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });
  assert.equal(await page.locator('.hotel-card .copy-address-button').count(), 1);
  await page.locator('.hotel-card .copy-address-button').click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    '1907 Elm Street, Dallas, Texas, USA, 75201',
  );

  await page.goto(`${baseUrl}/lunch.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });
  assert.equal(await page.locator('.lunch-card .copy-address-button').count(), 11);
  await page.locator('.lunch-card .copy-address-button').first().click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    '3699 McKinney Ave Ste 350, Dallas, TX 75204',
  );

  await context.close();
});

test('address copying falls back when the Clipboard API rejects permission', async () => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.readOriginalClipboard = navigator.clipboard.readText.bind(navigator.clipboard);
    Object.defineProperty(navigator.clipboard, 'writeText', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')),
    });
  });
  await page.goto(`${baseUrl}/arrival.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });

  const button = page.locator('.hotel-card .copy-address-button');
  await button.click();
  assert.match(await button.innerText(), /복사됨/);
  assert.equal(
    await page.evaluate(() => window.readOriginalClipboard()),
    '1907 Elm Street, Dallas, Texas, USA, 75201',
  );

  await context.close();
});

test('the map hotel popup copies its displayed address', async () => {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/map.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });

  const map = page.frameLocator('iframe.travel-map-frame');
  await map.locator('#map.leaflet-container').waitFor({ timeout: 10000 });
  await map.locator('.item').first().click();
  const copyButton = map.locator('.leaflet-popup .copy-address-button');
  await copyButton.waitFor({ timeout: 3000 });
  await copyButton.click();
  assert.equal(
    await page.evaluate(() => navigator.clipboard.readText()),
    '1907 Elm Street, Dallas, Texas, USA, 75201',
  );
  assert.match(await copyButton.innerText(), /복사됨/);

  await context.close();
});

test('secondary resources are keyboard accessible', async () => {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/day1.html`, { waitUntil: 'networkidle' });
  const details = page.locator('details.resource-list').first();
  const summary = details.locator('summary');
  await summary.focus();
  await summary.press('Enter');
  assert.equal(await details.evaluate((element) => element.open), true);
  assert.ok(await details.locator('a').count());
  await page.close();
});

test('requested contact, hotel, DART, and departure details render', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });
  const contact = page.locator('a.emergency-contact');
  assert.equal(await contact.getAttribute('href'), 'tel:+18147776590');
  assert.match(await contact.innerText(), /민일.*\+1-814-777-6590/s);
  assert.match(await page.locator('.sans-theme').innerText(), /SANS.*Solidarity.*Art.*Smoke.*평생의 기억/s);

  await page.goto(`${baseUrl}/arrival.html`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.hotel-card .button-link').getAttribute('href'), 'https://www.marriott.com/en-us/hotels/dalbw-renaissance-saint-elm-dallas-downtown-hotel/overview/');
  assert.equal(await page.locator('.transit-route').count(), 2);
  assert.match(await page.locator('.arrival-guide').innerText(), /Love Link \(Route 55\).*Inwood\/Love Field.*St Paul Station/s);
  const dartLinks = page.locator('a.dart-link');
  assert.ok(await dartLinks.count());
  for (let index = 0; index < await dartLinks.count(); index += 1) {
    assert.equal(await dartLinks.nth(index).getAttribute('href'), 'https://www.dart.org');
  }

  await page.goto(`${baseUrl}/day1.html`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.place-address').count(), 12);
  assert.match(await page.locator('.timeline').innerText(), /6 AM — 8 AM.*호텔 조식.*7 PM — 9 PM.*Terry Black’s BBQ.*9 PM — 10 PM.*Auction \+ 대표님과의 담화/s);
  assert.match(await page.locator('.place-grid').innerText(), /2001 Flora St.*13550 N Dallas Pkwy.*5776 Grandscape Blvd/s);

  await page.goto(`${baseUrl}/day2.html`, { waitUntil: 'networkidle' });
  const day2Text = await page.locator('.timeline').innerText();
  assert.equal((day2Text.match(/Architecture Docent · Haeseok Ko \/ Art Docent · Nari Rhee/g) || []).length, 2);
  assert.match(day2Text, /6 AM — 8 AM.*호텔 조식.*우버 이동/s);
  assert.match(day2Text, /10 AM — 12 PM.*Kimbell Art Museum.*우버 이동 · 약 35분/s);
  assert.match(day2Text, /12 PM — 2 PM.*점심 · The Café Modern.*2 — 4 PM.*The Modern Art Museum of Fort Worth/s);
  assert.match(day2Text, /4:30 PM — 7:30 PM.*Stockyards 자유 탐방.*9 PM.*호텔로 복귀.*우버로 복귀/s);
  assert.doesNotMatch(day2Text, /버스 대절|전세 버스|버스 · 약 35분/);
  assert.doesNotMatch(day2Text, /Hae Suk Ko/);

  await page.goto(`${baseUrl}/departure.html`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('.timeline').innerText(), /7 — 9 AM.*산스 전체세션 참석/s);
  assert.equal(await page.locator('.status-badge').count(), 0);
  assert.match(await page.locator('.timeline').innerText(), /공항 이동 & 귀국.*DART 전철/s);
  await page.close();
});

test('mobile layout has no horizontal page overflow', async () => {
  for (const viewport of [{ width: 760, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    for (const [route] of ROUTES) {
      await page.goto(`${baseUrl}/${route}`, { waitUntil: 'networkidle' });
      await page.locator('body.is-ready').waitFor({ timeout: APP_READY_TIMEOUT });
      const metrics = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
        activeTabVisible: (() => {
          const nav = document.querySelector('.date-nav');
          const active = nav?.querySelector('[aria-current="page"]');
          if (!nav || !active) return false;
          const navRect = nav.getBoundingClientRect();
          const activeRect = active.getBoundingClientRect();
          return activeRect.left >= navRect.left - 1 && activeRect.right <= navRect.right + 1;
        })(),
      }));
      assert.ok(metrics.page <= metrics.viewport + 1, `${viewport.width}px ${route}: ${JSON.stringify(metrics)}`);
      assert.equal(metrics.activeTabVisible, true, `${viewport.width}px ${route}: active navigation tab is clipped`);
    }
    await page.close();
  }
});
