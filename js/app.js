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
    const sections = page.sections.map((section, index) => renderSection(data, section, index)).join('');
    main.innerHTML = page.layout === 'embed'
      ? sections
      : [renderHero(data, page), sections, renderPager(data.pages, pageId)].join('');
    linkifyDartReferences(main, data.trip.dartUrl);
    attachImageFallbacks();
    attachAddressCopyHandlers(main);
    attachCalendarExportHandlers(main);
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

  const activeLink = nav.querySelector('[aria-current="page"]');
  if (activeLink) {
    nav.scrollLeft = Math.max(0, activeLink.offsetLeft - ((nav.clientWidth - activeLink.offsetWidth) / 2));
  }
}

function renderHero(data, page) {
  const place = page.heroPlace ? data.places[page.heroPlace] : null;
  const heroImage = place?.image || place?.images?.[0];
  const media = heroImage
    ? renderImage(heroImage, 'hero-image', false)
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
    case 'calendarExport':
      return `<section class="content-section calendar-section" id="${id}">${intro}${renderCalendarExport(data, section)}</section>`;
    case 'sansTheme':
      return `<section class="content-section sans-section" id="${id}">${renderSansTheme(section)}</section>`;
    case 'timeline':
      return `<section class="content-section timeline-section" id="${id}">${intro}${renderTimeline(data, section.items)}</section>`;
    case 'cards':
      return `<section class="content-section card-section" id="${id}">${intro}${renderCardGrid(data, section.items)}</section>`;
    case 'lunchCards':
      return `<section class="content-section lunch-section" id="${id}">${intro}${renderLunchGrid(data, section.items)}</section>`;
    case 'contact':
      return `<section class="content-section contact-section" id="${id}">${renderContact(section)}</section>`;
    case 'arrivalGuide':
      return `<section class="content-section guide-section" id="${id}">${intro}${renderArrivalGuide(section)}</section>`;
    case 'destinationGuide':
      return `<section class="content-section destination-section" id="${id}">${intro}${renderDestinationGuide(section)}</section>`;
    case 'mapEmbed':
      return renderMapEmbed(section, id);
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
            ${isStreetAddress(item.location) ? renderAddressCopyButton(item.location, `${item.title} 주소 복사`) : ''}
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

function renderLunchGrid(data, items) {
  return `<div class="lunch-grid">${items.map((placeId, index) => {
    const place = data.places[placeId];
    return place ? renderLunchCard(place, index) : '';
  }).join('')}</div>`;
}

function renderLunchCard(place, index) {
  const gallery = place.images?.length
    ? place.images.map((image) => renderImage(image, 'lunch-image')).join('')
    : renderPlaceholder('LUNCH', 'lunch-gallery-placeholder');

  return `
    <article class="lunch-card">
      <div class="lunch-gallery">${gallery}</div>
      <div class="lunch-card-copy">
        <header class="lunch-card-heading">
          <p>${String(index + 1).padStart(2, '0')} · LUNCH PICK</p>
          <h3>${escapeHtml(place.name)}</h3>
        </header>
        <div class="lunch-meta" aria-label="지역과 예상 예산">
          <span>${escapeHtml(place.location)}</span>
          <span>${escapeHtml(place.budget)} / 1인</span>
        </div>
        <div class="lunch-description">
          <div>
            <strong>THE PLACE</strong>
            <p>${escapeHtml(place.description)}</p>
          </div>
          <div>
            <strong>ON THE TABLE</strong>
            <p>${escapeHtml(place.menu)}</p>
          </div>
        </div>
        ${renderCopyableAddress(place.address, 'lunch-address', 'MEET HERE', `${place.name} 주소 복사`)}
        <div class="lunch-card-actions">${renderPrimaryLink(place, 'button-link')}</div>
      </div>
    </article>`;
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
        ${place.address ? renderCopyableAddress(place.address, 'place-address', 'UBER ADDRESS', `${place.name} 주소 복사`) : ''}
        <div class="place-card-actions">
          ${renderPrimaryLink(place, 'button-link')}
          ${item.status ? renderStatus(item.status) : ''}
        </div>
        ${renderResources(place.resources)}
      </div>
    </article>`;
}

function renderSansTheme(section) {
  return `
    <div class="sans-theme">
      <div class="sans-theme-intro">
        <p class="eyebrow">${escapeHtml(section.eyebrow)}</p>
        <h2>${escapeHtml(section.heading)}</h2>
        <p>${escapeHtml(section.intro)}</p>
      </div>
      <div class="sans-letter-grid">
        ${section.letters.map((item) => `
          <article class="sans-letter">
            <strong>${escapeHtml(item.letter)}</strong>
            <div><h3>${escapeHtml(item.term)}</h3><p>${escapeHtml(item.meaning)}</p></div>
          </article>`).join('')}
      </div>
      <p class="sans-closing">${formatTitle(section.closing)}</p>
    </div>`;
}

function renderMapEmbed(section, id) {
  const iframeTitle = section.iframeTitle || section.title || '여행 안내';
  return `
    <section class="map-embed-section" id="${id}">
      <h1 class="visually-hidden">${escapeHtml(section.title)}</h1>
      <iframe class="travel-map-frame" src="${escapeHtml(section.src)}" title="${escapeHtml(iframeTitle)}"></iframe>
    </section>`;
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

function renderContact(section) {
  return `
    <div class="emergency-card">
      <div>
        <p class="eyebrow">${escapeHtml(section.eyebrow)}</p>
        <h2>${escapeHtml(section.heading)}</h2>
      </div>
      <a class="emergency-contact" href="${escapeHtml(section.phoneHref)}">
        <span>${escapeHtml(section.name)}</span>
        <strong>${escapeHtml(section.phone)}</strong>
        <i aria-hidden="true">통화 ↗</i>
      </a>
    </div>`;
}

function renderCalendarExport(data, section) {
  const calendar = data.calendar || {};
  const events = calendar.events || [];
  const timezone = calendar.timezone || 'America/Chicago';
  const filename = calendar.filename || 'howdy-eight-dallas-fort-worth.ics';
  const icsPath = calendar.icsPath || filename;
  const note = section.note || calendar.note || '';

  return `
    <div class="calendar-export" data-calendar-export>
      <article class="calendar-download-card">
        <p class="calendar-kicker">ONE FILE · ${escapeHtml(timezone)}</p>
        <h3>전체 일정을 한 번에</h3>
        <p>iPhone, Apple Calendar, Outlook 등에서 열 수 있는 iCal 파일로 ${events.length}개 일정을 저장합니다.</p>
        <a class="calendar-download-button" href="${escapeHtml(icsPath)}" download="${escapeHtml(filename)}" data-calendar-download>
          <span>${escapeHtml(section.downloadLabel || '전체 iCal 다운로드')}</span>
          <i aria-hidden="true">↧</i>
        </a>
        <p class="calendar-download-status" data-calendar-download-status aria-live="polite"></p>
        ${note ? `<p class="calendar-export-note">${escapeHtml(note)}</p>` : ''}
      </article>
      <article class="calendar-google-card">
        <div class="calendar-list-heading">
          <p class="calendar-kicker">${escapeHtml(section.googleHeading || 'Google Calendar')}</p>
          <strong>${events.length} EVENTS</strong>
        </div>
        <ol class="calendar-event-list">
          ${events.map((event) => `
            <li class="calendar-event-item" data-calendar-event-id="${escapeHtml(event.id)}">
              <div>
                <time datetime="${escapeHtml(event.start)}">${escapeHtml(formatCalendarRange(event))}</time>
                <h3>${escapeHtml(event.title)}</h3>
                ${event.location ? `<p>${escapeHtml(event.location)}</p>` : ''}
              </div>
              <a class="google-calendar-link" href="${escapeHtml(buildGoogleCalendarUrl(event, timezone))}" target="_blank" rel="noopener noreferrer">
                Google Calendar <span aria-hidden="true">↗</span>
              </a>
            </li>`).join('')}
        </ol>
      </article>
    </div>`;
}

function attachCalendarExportHandlers(root) {
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-calendar-download]');
    if (!button || !root.contains(button)) return;

    button.classList.add('is-downloaded');
    window.clearTimeout(button.downloadResetTimer);
    button.downloadResetTimer = window.setTimeout(() => button.classList.remove('is-downloaded'), 1800);

    const status = root.querySelector('[data-calendar-download-status]');
    if (status) {
      status.textContent = '다운로드를 시작했습니다. 브라우저의 다운로드 폴더를 확인하세요.';
      window.clearTimeout(status.downloadResetTimer);
      status.downloadResetTimer = window.setTimeout(() => {
        status.textContent = '';
      }, 3600);
    }
  });
}

function buildGoogleCalendarUrl(event, timezone) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${formatGoogleDateTime(event.start)}/${formatGoogleDateTime(event.end)}`,
    ctz: timezone,
  });
  if (event.location) params.set('location', event.location);
  if (event.description) params.set('details', event.description);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function formatCalendarRange(event) {
  const start = parseLocalDateTime(event.start);
  const end = parseLocalDateTime(event.end);
  const sameDay = start.year === end.year && start.month === end.month && start.day === end.day;
  const dateLabel = `${start.month}/${start.day}`;
  return sameDay
    ? `${dateLabel} ${formatClock(start)} — ${formatClock(end)}`
    : `${dateLabel} ${formatClock(start)} — ${end.month}/${end.day} ${formatClock(end)}`;
}

function formatClock(parts) {
  const suffix = parts.hour >= 12 ? 'PM' : 'AM';
  const hour = parts.hour % 12 || 12;
  const minutes = parts.minute ? `:${String(parts.minute).padStart(2, '0')}` : '';
  return `${hour}${minutes} ${suffix}`;
}

function formatIcsDateTime(value) {
  const parts = parseLocalDateTime(value);
  return `${parts.year}${String(parts.month).padStart(2, '0')}${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}${String(parts.minute).padStart(2, '0')}00`;
}

function formatGoogleDateTime(value) {
  return formatIcsDateTime(value);
}

function parseLocalDateTime(value) {
  const [datePart, timePart = '00:00:00'] = String(value).split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return { year, month, day, hour, minute };
}

function renderArrivalGuide(section) {
  return `
    <div class="arrival-guide">
      <article class="hotel-card">
        <p class="eyebrow">YOUR HOTEL</p>
        <h3>${escapeHtml(section.hotel.name)}</h3>
        ${renderCopyableAddress(section.hotel.address, 'hotel-address', 'HOTEL ADDRESS', `${section.hotel.name} 주소 복사`)}
        <div>
          <a class="button-link" href="${escapeHtml(section.hotel.url)}" target="_blank" rel="noopener noreferrer">호텔 홈페이지 <span aria-hidden="true">↗</span></a>
          <a class="hotel-phone" href="${escapeHtml(section.hotel.phoneHref)}">Tel: ${escapeHtml(section.hotel.phone)}</a>
        </div>
      </article>
      <div class="transit-grid">
        ${section.routes.map((route) => `
          <article class="transit-route">
            <div class="transit-route-header">
              <h3>${escapeHtml(route.title)}</h3>
              <span>${escapeHtml(route.duration)}</span>
            </div>
            <p>${escapeHtml(route.intro)}</p>
            <ol>
              ${route.steps.map((step) => `
                <li>
                  <strong>${escapeHtml(step.label)}</strong>
                  <p>${escapeHtml(step.text)}</p>
                </li>`).join('')}
            </ol>
          </article>`).join('')}
      </div>
    </div>`;
}

function renderDestinationGuide(section) {
  const history = section.history;
  return `
    <div class="destination-guide">
      <section class="guide-history" aria-labelledby="history-heading">
        <div class="guide-subheading">
          <p>${escapeHtml(history.englishHeading)}</p>
          <h3 id="history-heading">${escapeHtml(history.heading)}</h3>
        </div>
        <p class="history-intro">${escapeHtml(history.intro)}</p>
        <ol class="history-timeline">
          ${history.timeline.map((item) => `
            <li class="history-milestone">
              <strong>${escapeHtml(item.year)}</strong>
              <span>${escapeHtml(item.label)}</span>
            </li>`).join('')}
        </ol>
        <div class="history-themes">
          ${history.themes.map((theme, index) => `
            <article class="history-theme">
              <span aria-hidden="true">0${index + 1}</span>
              <h4>${escapeHtml(theme.heading)}</h4>
              <p>${escapeHtml(theme.body)}</p>
            </article>`).join('')}
        </div>
      </section>

      <section class="city-guides" aria-labelledby="cities-heading">
        <div class="guide-subheading">
          <p>THREE CITIES · ONE METROPLEX</p>
          <h3 id="cities-heading">도시별 주요 명소</h3>
        </div>
        <div class="city-guide-grid">
          ${section.cities.map((city, index) => `
            <article class="city-guide-card">
              <header><span>0${index + 1}</span><div><h4>${escapeHtml(city.name)}</h4><p>${escapeHtml(city.englishName)}</p></div></header>
              <ol>
                ${city.places.map((place) => `
                  <li class="city-place">
                    <h5>${escapeHtml(place.name)}${place.englishName ? `<small>${escapeHtml(place.englishName)}</small>` : ''}</h5>
                    <p>${escapeHtml(place.description)}</p>
                  </li>`).join('')}
              </ol>
            </article>`).join('')}
        </div>
      </section>

      <section class="travel-tips" aria-labelledby="tips-heading">
        <div class="guide-subheading inverse">
          <p>BEFORE YOU GO</p>
          <h3 id="tips-heading">여행 팁</h3>
        </div>
        <div class="travel-tip-grid">
          ${section.tips.map((tip) => `
            <article class="travel-tip">
              <h4>${escapeHtml(tip.heading)}</h4>
              <p>${escapeHtml(tip.body)}</p>
            </article>`).join('')}
        </div>
        <div class="guide-source-note">
          <strong>${escapeHtml(section.footerLabel)}</strong>
          <p>${escapeHtml(section.notice)}</p>
        </div>
      </section>
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

function renderCopyableAddress(address, className, caption, accessibleLabel) {
  return `
    <address class="${className} copyable-address">
      <span class="address-caption">${escapeHtml(caption)}</span>
      <span class="address-text">${escapeHtml(address)}</span>
      ${renderAddressCopyButton(address, accessibleLabel)}
    </address>`;
}

function renderAddressCopyButton(address, accessibleLabel = '주소 복사') {
  return `
    <button class="copy-address-button" type="button" data-copy-address="${escapeHtml(address)}" aria-label="${escapeHtml(accessibleLabel)}">
      <span class="copy-address-icon" aria-hidden="true">⧉</span>
      <span class="copy-address-label" aria-live="polite">주소 복사</span>
    </button>`;
}

function isStreetAddress(value = '') {
  return /\d/.test(value) && /\b(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Pkwy|Fwy|Drive|Dr)\b/i.test(value);
}

function attachAddressCopyHandlers(root) {
  root.addEventListener('click', async (event) => {
    const button = event.target.closest('.copy-address-button');
    if (!button || !root.contains(button)) return;

    const label = button.querySelector('.copy-address-label');
    try {
      await copyTextToClipboard(button.dataset.copyAddress || '');
      setCopyButtonState(button, label, '복사됨', true);
    } catch (error) {
      setCopyButtonState(button, label, '복사 실패', false);
      console.error('Address copy failed', error);
    }
  });
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Permission policies in embedded browsers can reject the modern API.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.className = 'clipboard-fallback';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard copy command was rejected');
}

function setCopyButtonState(button, label, message, copied) {
  window.clearTimeout(button.copyResetTimer);
  label.textContent = message;
  button.classList.toggle('is-copied', copied);
  button.classList.toggle('has-copy-error', !copied);
  button.copyResetTimer = window.setTimeout(() => {
    label.textContent = '주소 복사';
    button.classList.remove('is-copied', 'has-copy-error');
  }, 1800);
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

function linkifyDartReferences(root, url) {
  if (!root || !url) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    if (!/\bDART\b/i.test(node.nodeValue) || node.parentElement?.closest('a, script, style')) return;

    const fragment = document.createDocumentFragment();
    node.nodeValue.split(/(\bDART\b)/gi).forEach((part) => {
      if (/^DART$/i.test(part)) {
        const link = document.createElement('a');
        link.className = 'dart-link';
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', 'DART 공식 홈페이지 (새 창)');
        link.textContent = part;
        fragment.appendChild(link);
      } else {
        fragment.appendChild(document.createTextNode(part));
      }
    });
    node.replaceWith(fragment);
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
