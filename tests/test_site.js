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

    assert.equal(await page.locator('.date-nav a').count(), 5, route);
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

test('mobile layout has no horizontal page overflow', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const [route] of ROUTES) {
    await page.goto(`${baseUrl}/${route}`, { waitUntil: 'networkidle' });
    await page.locator('body.is-ready').waitFor({ timeout: 3000 });
    const metrics = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    assert.ok(metrics.page <= metrics.viewport + 1, `${route}: ${JSON.stringify(metrics)}`);
  }
  await page.close();
});
