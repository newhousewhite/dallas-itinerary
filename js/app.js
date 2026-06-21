const DATA_URL = 'data/itinerary.json';

document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  const main = document.getElementById('main-content');
  const pageId = document.body.dataset.page;

  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`Itinerary request failed with ${response.status}`);

    const data = await response.json();
    const page = data.pages.find((entry) => entry.id === pageId);
    if (!page) throw new Error(`Unknown itinerary page: ${pageId}`);

    renderNavigation(data.pages, pageId);
    main.innerHTML = [
      renderHero(data, page),
      page.sections.map((section, index) => renderSection(data, section, index)).join(''),
      renderPager(data.pages, pageId),
    ].join('');
    attachImageFallbacks();
    document.body.classList.add('is-ready');
  } catch (error) {
    renderError(main);
    document.body.classList.add('is-ready');
    console.error(error);
  }
}

function renderNavigation(pages, currentPageId) {
  const nav = document.querySelector('[data-date-nav]');
  nav.innerHTML = pages.map((page, index) => {
    const current = page.id === currentPageId ? ' aria-current="page"' : '';
    const number = index === 0 ? '00' : String(index).padStart(2, '0');
    return `
      <a href="${escapeHtml(page.href)}"${current}>
        <span>${number}</span>
        <strong>${escapeHtml(page.navLabel)}</strong>
      </a>`;
  }).join('');
}

function renderHero(data, page) {
  const place = page.heroPlace ? data.places[page.heroPlace] : null;
  const media = place?.image
    ? renderImage(place.image, 'hero-image', false)
    : renderPlaceholder('TEXAS', 'hero-placeholder');

  return `
    <section class="page-hero" aria-labelledby="page-title">
      <div class="hero-media">${media}</div>
      <div class="hero-wash"></div>
      <div class="hero-compass" aria-hidden="true"><span>N</span><i></i><span>S</span></div>
      <div class="hero-copy">
        <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
        <p class="hero-date">${escapeHtml(page.date)}</p>
        <h1 id="page-title">${formatTitle(page.title)}</h1>
        <p class="hero-summary">${escapeHtml(page.summary)}</p>
        ${place ? `<p class="hero-caption">PHOTO · ${escapeHtml(place.name)}</p>` : ''}
      </div>
      <a class="scroll-cue" href="#itinerary-content">일정 보기 <span aria-hidden="true">↓</span></a>
    </section>`;
}

function renderSection(data, section, index) {
  const id = index === 0 ? 'itinerary-content' : `section-${index + 1}`;
  const intro = `
    <div class="section-heading">
      <p class="eyebrow">${escapeHtml(section.eyebrow)}</p>
      <h2>${escapeHtml(section.heading)}</h2>
      ${section.description ? `<p>${escapeHtml(section.description)}</p>` : ''}
    </div>`;

  switch (section.type) {
    case 'dayGrid':
      return `<section class="content-section route-section" id="${id}">${intro}${renderDayGrid(data, section.items)}</section>`;
    case 'timeline':
      return `<section class="content-section timeline-section" id="${id}">${intro}${renderTimeline(data, section.items)}</section>`;
    case 'cards':
      return `<section class="content-section card-section" id="${id}">${intro}${renderCardGrid(data, section.items)}</section>`;
    case 'note':
      return `<section class="content-section note-section" id="${id}">${renderNote(section)}</section>`;
    default:
      return '';
  }
}

function renderDayGrid(data, items) {
  const pagesById = Object.fromEntries(data.pages.map((page) => [page.id, page]));
  return `<div class="day-grid">${items.map((item, index) => {
    const page = pagesById[item.pageId];
    const place = item.placeId ? data.places[item.placeId] : null;
    const media = place?.image
      ? renderImage(place.image, 'day-card-image')
      : renderPlaceholder('SAFE TRAVELS', 'day-card-placeholder');
    return `
      <a class="day-card" href="${escapeHtml(page.href)}">
        <div class="day-card-media">${media}<span>0${index + 1}</span></div>
        <div class="day-card-copy">
          <p>${escapeHtml(page.date)}</p>
          <h3>${escapeHtml(page.navLabel)}</h3>
          <span>${escapeHtml(page.summary)}</span>
          <strong>일정 열기 <i aria-hidden="true">↗</i></strong>
        </div>
      </a>`;
  }).join('')}</div>`;
}

function renderTimeline(data, items) {
  return `<div class="timeline">${items.map((item, index) => {
    const place = item.placeId ? data.places[item.placeId] : null;
    const meta = [
      item.audience ? `<span>${escapeHtml(item.audience)}</span>` : '',
      item.location ? `<span>${escapeHtml(item.location)}</span>` : '',
    ].filter(Boolean).join('');
    return `
      <article class="timeline-item">
        <div class="timeline-time"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(item.time)}</strong></div>
        <div class="timeline-pin" aria-hidden="true"></div>
        <div class="timeline-copy">
          <div class="timeline-kicker">${meta}</div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.description)}</p>
          ${item.transport ? `<p class="transport"><span aria-hidden="true">↳</span> ${escapeHtml(item.transport)}</p>` : ''}
          <div class="timeline-actions">
            ${item.status ? renderStatus(item.status) : ''}
            ${place ? renderPrimaryLink(place, 'text-link') : ''}
          </div>
        </div>
      </article>`;
  }).join('')}</div>`;
}

function renderCardGrid(data, items) {
  return `<div class="place-grid">${items.map((item) => {
    const place = item.placeId ? data.places[item.placeId] : null;
    return place ? renderPlaceCard(place, item) : renderTextCard(item);
  }).join('')}</div>`;
}

function renderPlaceCard(place, item) {
  const media = place.image
    ? renderImage(place.image, 'place-card-image')
    : renderPlaceholder('DALLAS', 'place-card-placeholder');
  return `
    <article class="place-card">
      <div class="place-card-media">
        ${media}
        ${item.tag ? `<span class="place-tag">${escapeHtml(item.tag)}</span>` : ''}
      </div>
      <div class="place-card-copy">
        <h3>${escapeHtml(place.name)}</h3>
        <p>${escapeHtml(place.description)}</p>
        <div class="place-card-actions">
          ${renderPrimaryLink(place, 'button-link')}
          ${item.status ? renderStatus(item.status) : ''}
        </div>
        ${renderResources(place.resources)}
      </div>
    </article>`;
}

function renderTextCard(item) {
  return `
    <article class="place-card text-only-card">
      <div class="place-card-media">${renderPlaceholder('OPTION', 'place-card-placeholder')}${item.tag ? `<span class="place-tag">${escapeHtml(item.tag)}</span>` : ''}</div>
      <div class="place-card-copy">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.description)}</p>
        ${item.status ? `<div class="place-card-actions">${renderStatus(item.status)}</div>` : ''}
      </div>
    </article>`;
}

function renderResources(resources = []) {
  if (!resources.length) return '';
  return `
    <details class="resource-list">
      <summary>추가 자료 <span aria-hidden="true">+</span></summary>
      <div>${resources.map((resource) => `
        <a href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(resource.label)} <span aria-hidden="true">↗</span>
        </a>`).join('')}</div>
    </details>`;
}

function renderNote(section) {
  return `
    <div class="field-note">
      <span class="field-note-star" aria-hidden="true">★</span>
      <div>
        <p class="eyebrow">${escapeHtml(section.eyebrow)}</p>
        <h2>${escapeHtml(section.heading)}</h2>
        <p>${escapeHtml(section.body)}</p>
      </div>
    </div>`;
}

function renderPager(pages, currentPageId) {
  const index = pages.findIndex((page) => page.id === currentPageId);
  const previous = index > 0 ? pages[index - 1] : null;
  const next = index < pages.length - 1 ? pages[index + 1] : null;
  return `
    <nav class="page-pager" aria-label="이전 및 다음 일정">
      ${previous ? `<a href="${escapeHtml(previous.href)}"><span>← 이전</span><strong>${escapeHtml(previous.navLabel)}</strong></a>` : '<span></span>'}
      ${next ? `<a class="next" href="${escapeHtml(next.href)}"><span>다음 →</span><strong>${escapeHtml(next.navLabel)}</strong></a>` : '<a class="next" href="index.html"><span>처음으로 ↗</span><strong>여정 안내</strong></a>'}
    </nav>`;
}

function renderImage(image, className, lazy = true) {
  const loading = lazy ? ' loading="lazy"' : ' fetchpriority="high"';
  return `<img class="${className} js-venue-image" src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt)}"${loading}>`;
}

function renderPlaceholder(label, className) {
  return `<div class="${className} image-fallback" role="img" aria-label="사진 준비 중"><span aria-hidden="true">★</span><strong>${escapeHtml(label)}</strong></div>`;
}

function renderPrimaryLink(place, className) {
  return `<a class="${className}" href="${escapeHtml(place.primaryLink.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(place.primaryLink.label)} <span aria-hidden="true">↗</span></a>`;
}

function renderStatus(status) {
  return `<span class="status-badge"><i aria-hidden="true"></i>${escapeHtml(status)}</span>`;
}

function attachImageFallbacks() {
  document.querySelectorAll('.js-venue-image').forEach((image) => {
    image.addEventListener('error', () => {
      image.replaceWith(createImageFallback());
    }, { once: true });
  });
}

function createImageFallback() {
  const fallback = document.createElement('div');
  fallback.className = 'image-fallback runtime-fallback';
  fallback.setAttribute('role', 'img');
  fallback.setAttribute('aria-label', '사진을 불러오지 못했습니다');
  fallback.innerHTML = '<span aria-hidden="true">★</span><strong>TEXAS</strong>';
  return fallback;
}

function renderError(main) {
  main.innerHTML = `
    <section class="error-state">
      <p class="eyebrow">ROUTE INTERRUPTED</p>
      <h1>일정을 불러오지 못했습니다</h1>
      <p>잠시 후 페이지를 새로고침해주세요.</p>
      <a class="button-link" href="index.html">여정 안내로 돌아가기</a>
    </section>`;
}

function formatTitle(title) {
  return escapeHtml(title).replaceAll('\n', '<br>');
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
