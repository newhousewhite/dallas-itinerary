const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const ROUTES = [
  ['index.html', 'overview'],
  ['arrival.html', 'arrival'],
  ['day1.html', 'day1'],
  ['day2.html', 'day2'],
  ['departure.html', 'departure'],
  ['about.html', 'about'],
];

const CONTENT_TYPES = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
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
    await page.locator('body.is-ready').waitFor({ timeout: 3000 });

    assert.equal(await page.locator('.date-nav a').count(), 6, route);
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

test('destination guide is the final page and renders the complete guide structure', async () => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/about.html`, { waitUntil: 'networkidle' });
  await page.locator('body.is-ready').waitFor({ timeout: 3000 });

  assert.equal((await page.locator('h1').innerText()).trim(), 'Dallas Fort Worth는 어떤 곳인가요?');
  assert.equal((await page.locator('.date-nav a').last().innerText()).includes('지역 안내'), true);
  assert.equal(await page.locator('.history-milestone').count(), 7);
  assert.equal(await page.locator('.history-theme').count(), 3);
  assert.equal(await page.locator('.city-guide-card').count(), 3);
  assert.equal(await page.locator('.city-place').count(), 15);
  assert.equal(await page.locator('.travel-tip').count(), 4);
  assert.match(await page.locator('.destination-guide').innerText(), /텍사스 BBQ.*TRE 통근열차.*식당 팁 문화\(약 15~20%\)/s);
  await page.close();
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

  await page.goto(`${baseUrl}/arrival.html`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('.hotel-card .button-link').getAttribute('href'), 'https://www.marriott.com/en-us/hotels/dalbw-renaissance-saint-elm-dallas-downtown-hotel/overview/');
  assert.equal(await page.locator('.transit-route').count(), 2);
  assert.match(await page.locator('.arrival-guide').innerText(), /Love Link \(Route 55\).*Inwood\/Love Field.*St Paul Station/s);

  await page.goto(`${baseUrl}/departure.html`, { waitUntil: 'networkidle' });
  assert.match(await page.locator('.timeline').innerText(), /7 — 9 AM.*산스 전체세션 참석/s);
  assert.equal(await page.locator('.status-badge').count(), 0);
  assert.match(await page.locator('.timeline').innerText(), /공항 이동 & 귀국.*DART 전철/s);
  await page.close();
});

test('mobile layout has no horizontal page overflow', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const [route] of ROUTES) {
    await page.goto(`${baseUrl}/${route}`, { waitUntil: 'networkidle' });
    await page.locator('body.is-ready').waitFor({ timeout: 3000 });
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
    assert.ok(metrics.page <= metrics.viewport + 1, `${route}: ${JSON.stringify(metrics)}`);
    assert.equal(metrics.activeTabVisible, true, `${route}: active navigation tab is clipped`);
  }
  await page.close();
});
