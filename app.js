/* UNDOMEDIA 홈페이지 동작
   순서: 공통(메뉴·헤더) → 메인(구간 표시줄·세 문장 영상·로고·슬레이트·쇼릴)
        → WORKS(탭·목록·영상 팝업) → CONTACT(후기·문의 전송) */
'use strict';

const site = window.UNDOMEDIA;
const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const isHome = document.body.classList.contains('home');

const ICON = {
  play: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
};

const findWork = id => site.projects.find(work => work.id === id);
// 썸네일을 따로 올리지 않은 영상은 유튜브의 기본 썸네일을 씁니다.
const thumbnail = work => work.image || `https://i.ytimg.com/vi/${encodeURIComponent(work.youtubeId)}/hqdefault.jpg`;

/* ---------- 공통: data.js 의 문구·정보를 화면에 반영 ----------
   HTML 의 data-text="text.hero.lead" 같은 표시는 data.js 에서 같은 위치의 글을 가져와 넣으라는 뜻입니다.
   글은 관리페이지(admin.html)에서 고칩니다. */
const readPath = path => path.split('.').reduce((value, key) => (value == null ? value : value[key]), site);
const withBreaks = value => escapeHTML(value).replace(/\n/g, ' <br>');
$$('[data-text]').forEach(node => {
  const value = readPath(node.dataset.text);
  if (typeof value !== 'string') return;
  node.innerHTML = withBreaks(value);
  if (node.dataset.link === 'mailto') node.href = `mailto:${value.trim()}`;
  if (node.dataset.link === 'tel') node.href = `tel:${value.replace(/[^\d+]/g, '')}`;
});
$$('[data-href]').forEach(node => {
  const value = readPath(node.dataset.href);
  if (typeof value !== 'string') return;
  const address = value.trim();
  // 주소가 비어 있으면 그 줄을 통째로 숨깁니다.
  if (!/^https?:\/\//.test(address)) { (node.closest('[data-optional]') || node).hidden = true; return; }
  node.href = address;
  // 인스타그램처럼 계정 이름을 보여주는 링크는 주소 끝의 이름을 @이름 으로 적습니다.
  if ('handle' in node.dataset) {
    const name = address.replace(/[/?#]+$/, '').split('/').pop();
    if (name) {
      ($('[data-handle-label]', node) || node).textContent = name;
      node.setAttribute('aria-label', `인스타그램 ${name}`);
    }
  }
});
// 아이콘처럼 파일 경로를 data.js 에서 가져오는 이미지. 경로가 비어 있으면 이미지를 빼고 대신 표시(@)가 보입니다.
$$('[data-src]').forEach(node => {
  const value = readPath(node.dataset.src);
  if (typeof value === 'string' && value.trim()) {
    node.addEventListener('error', () => node.remove(), { once: true }); // 파일을 못 불러오면 대신 표시(@)가 보입니다.
    node.src = value.trim();
  } else node.remove();
});
$$('[data-category-label]').forEach(node => {
  const category = (site.categories || []).find(item => item.id === node.dataset.categoryLabel);
  if (category) node.textContent = category.label;
});
// 첫 화면 제목: 윗줄은 글자를 하나씩 나눠 넓게 펼치고, 아랫줄은 줄마다 나눕니다.
const heroTitle = $('[data-hero-title]');
if (heroTitle && site.text?.hero) {
  const { wide = '', deep = '' } = site.text.hero;
  heroTitle.setAttribute('aria-label', `${wide} ${deep.replace(/\n/g, ' ')}`);
  $('.hero-wide', heroTitle).innerHTML = [...wide].map(char => (char === ' ' ? '<i class="gap"></i>' : `<i>${escapeHTML(char)}</i>`)).join('');
  $('.hero-deep', heroTitle).innerHTML = deep.split('\n').map(line => `<span>${escapeHTML(line)}</span>`).join('');
}
// 대표 작업의 세 문장과 해시태그
$$('[data-story]').forEach(tab => {
  const story = site.text?.works?.stories?.[tab.dataset.story];
  if (!story) return;
  $('.story-sentence', tab).textContent = story.sentence;
  $('.story-tags', tab).innerHTML = (story.tags || []).map(tag => `<span>${escapeHTML(tag)}</span>`).join('');
});

// 유튜브 플레이어는 사용자가 재생을 누를 때만 불러옵니다.
function createPlayer(work) {
  const player = document.createElement('iframe');
  player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(work.youtubeId)}?autoplay=1&rel=0`;
  player.title = work.title;
  player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  player.allowFullscreen = true;
  player.referrerPolicy = 'strict-origin-when-cross-origin';
  return player;
}

/* ---------- 공통: 모바일 메뉴 ---------- */
const header = $('[data-header]');
const menuButton = $('.menu-toggle');
const mobileMenu = $('#mobile-menu');

function setMenu(open) {
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
  mobileMenu.hidden = !open;
  header.classList.toggle('menu-open', open);
}
menuButton.addEventListener('click', () => setMenu(mobileMenu.hidden));
$$('a', mobileMenu).forEach(link => link.addEventListener('click', () => setMenu(false)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !mobileMenu.hidden) { setMenu(false); menuButton.focus(); }
});
window.matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) setMenu(false); });

/* ---------- 공통: 헤더 ----------
   메인에서는 화면 절반을 내려올 때까지 천천히 흰색으로 바뀝니다. */
function updateHeader() {
  const progress = isHome ? Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * .5))) : 1;
  const eased = progress * progress * (3 - 2 * progress);
  header.style.setProperty('--hw', eased.toFixed(4));
  header.style.setProperty('--hi', Math.min(1, eased * 2).toFixed(4));
}
window.addEventListener('scroll', updateHeader, { passive: true });
window.addEventListener('resize', updateHeader, { passive: true });
updateHeader();

// 메인의 각 화면이 헤더 바로 아래에 딱 맞는 스크롤 위치를 구합니다.
// (화면이 겹쳐 쌓이는 동안에는 요소의 현재 위치가 달라지므로, 위에서부터 높이를 더해서 계산합니다.)
function screenStops(list) {
  const headerHeight = header.getBoundingClientRect().height;
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  let top = 0;
  const stops = list.map((screen, index) => {
    const stop = index === 0 ? 0 : Math.min(max, Math.max(0, top - headerHeight));
    top += screen.offsetHeight;
    return stop;
  });
  return { stops, max };
}

/* ---------- 메인: 마지막 구간과 푸터를 한 화면에 ----------
   푸터 높이를 재서 스타일에 알려주면, 마지막 구간이 그만큼 줄어 푸터까지 한 화면에 보입니다. */
const siteFooter = $('.site-footer');
if (isHome && siteFooter) {
  const setFooterHeight = () => document.documentElement.style.setProperty('--footer-h', `${siteFooter.offsetHeight}px`);
  new ResizeObserver(setFooterHeight).observe(siteFooter);
  setFooterHeight();
}

/* ---------- 메인: 하단 구간 표시줄 ----------
   영상 플레이어의 챕터 바처럼, 지금 어느 구간을 보고 있는지 보여주고 누르면 그 구간으로 이동합니다. */
const chapterSections = $$('[data-chapter]');
if (chapterSections.length) {
  const TOTAL_SECONDS = 120; // 2분 쇼릴 길이에 맞춘 표시
  const bar = document.createElement('nav');
  bar.className = 'chapters';
  bar.setAttribute('aria-label', '화면 구간 이동');
  bar.innerHTML = `<ol>${chapterSections.map((section, index) => `<li style="--i:${index}"><a href="#${section.id}"><span class="chapter-fill"></span><span class="chapter-name">${escapeHTML(section.dataset.chapter)}</span></a></li>`).join('')}</ol><p class="chapter-time" aria-hidden="true"></p>`;
  document.body.append(bar);
  const items = $$('li', bar);
  const time = $('.chapter-time', bar);
  const clock = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  function updateChapters() {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const y = Math.min(Math.max(window.scrollY, 0), max);
    const starts = screenStops(chapterSections).stops;
    let current = 0;
    items.forEach((item, index) => {
      const start = starts[index];
      const end = index + 1 < starts.length ? starts[index + 1] : max;
      const length = Math.max(1, end - start);
      item.style.setProperty('--p', Math.min(1, Math.max(0, (y - start) / length)).toFixed(4));
      if (y >= start - 1) current = index;
    });
    items.forEach((item, index) => {
      const link = item.firstElementChild;
      if (index === current) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
    });
    time.textContent = `${clock(y / max * TOTAL_SECONDS)} / ${clock(TOTAL_SECONDS)}`;
  }
  window.addEventListener('scroll', updateChapters, { passive: true });
  window.addEventListener('resize', updateChapters, { passive: true });
  window.addEventListener('load', updateChapters);
  updateChapters();
}

/* ---------- 메인: 세 문장과 흐르는 영상 ----------
   문장별 영상 6개는 data.js 의 selections 에서 정합니다. */
let stepStory = () => false;
const carousel = $('#featured-works');
if (carousel) {
  const track = $('.film-track', carousel);
  const tabs = $$('[data-story]');
  const panel = $('#story-panel');
  const slider = $('#film-position');
  const pause = $('.film-pause');
  const status = $('.film-status');
  let selected = '';
  let currentWorks = [];
  let cycleWidth = 0;
  let userPaused = false;
  let hovered = false;
  let focused = false;
  let visible = false;
  let activeCard = null;
  let previousTime = 0;
  let motionOptIn = false;
  let ignoreHoverUntil = 0;
  let flowPosition = 0; // 흐름 위치(소수점까지 기억해 느린 속도에서도 멈추지 않게 합니다)

  function filmCard(work, duplicate = false) {
    return `<article class="film-card" data-project="${escapeHTML(work.id)}" ${duplicate ? 'data-duplicate aria-hidden="true"' : ''}>
      <div class="film-media">
        <img src="${escapeHTML(thumbnail(work))}" alt="" width="960" height="540" loading="lazy">
        <button class="film-play" type="button" data-play-video="${escapeHTML(work.id)}" aria-label="${escapeHTML(work.client)} · ${escapeHTML(work.title)} 재생" ${duplicate ? 'tabindex="-1"' : ''}><span>${ICON.play}</span></button>
      </div>
      <div class="film-meta">
        <p class="film-client">${escapeHTML(work.client)}</p>
        <h3 class="film-title">${escapeHTML(work.title)}</h3>
        ${work.role ? `<p class="film-role">참여 범위: ${escapeHTML(work.role)}</p>` : ''}
      </div>
    </article>`;
  }

  function setPaused(value) {
    userPaused = value;
    const stopped = value || (reducedMotion.matches && !motionOptIn);
    pause.innerHTML = stopped ? ICON.play : ICON.pause;
    pause.setAttribute('aria-label', stopped ? '영상 목록 흐름 재생' : '영상 목록 흐름 일시정지');
    pause.setAttribute('aria-pressed', String(stopped));
  }

  function stopPlayback() {
    if (!activeCard) return;
    $('iframe', activeCard)?.remove();
    $('[data-stop-video]', activeCard)?.remove();
    $('[data-play-video]', activeCard).hidden = false;
    activeCard.classList.remove('playing');
    if (activeCard.hasAttribute('data-duplicate')) activeCard.setAttribute('aria-hidden', 'true');
    activeCard = null;
  }

  function measure() {
    const copy = $('[data-duplicate]', track);
    cycleWidth = copy ? copy.offsetLeft - track.firstElementChild.offsetLeft : 0;
  }

  function selectStory(key) {
    if (key === selected) return;
    selected = key;
    stopPlayback();
    currentWorks = (site.selections[key] || []).map(findWork).filter(Boolean).slice(0, 12);
    // 끊김 없이 흐르도록 같은 목록을 한 번 더 이어 붙입니다.
    track.innerHTML = currentWorks.map(work => filmCard(work)).join('') + currentWorks.map(work => filmCard(work, true)).join('');
    tabs.forEach(tab => {
      const active = tab.dataset.story === key;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', `story-${key}`);
    carousel.scrollLeft = 0;
    flowPosition = 0;
    slider.value = 0;
    status.textContent = `영상 ${currentWorks.length}개 · 썸네일을 누르면 바로 재생됩니다.`;
    measure();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch' && performance.now() > ignoreHoverUntil) selectStory(tab.dataset.story); });
    tab.addEventListener('click', () => selectStory(tab.dataset.story));
    tab.addEventListener('focus', () => selectStory(tab.dataset.story));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); tabs[next].focus(); }
    });
  });

  track.addEventListener('click', event => {
    if (event.target.closest('[data-stop-video]')) { stopPlayback(); return; }
    const button = event.target.closest('[data-play-video]');
    if (!button) return;
    const work = findWork(button.dataset.playVideo);
    if (!work) return;
    stopPlayback();
    setPaused(true);
    activeCard = button.closest('.film-card');
    activeCard.classList.add('playing');
    activeCard.removeAttribute('aria-hidden');
    button.hidden = true;
    const close = document.createElement('button');
    close.type = 'button';
    close.dataset.stopVideo = '';
    close.className = 'film-stop';
    close.setAttribute('aria-label', '영상 닫기');
    close.innerHTML = ICON.close;
    $('.film-media', activeCard).append(createPlayer(work), close);
    // 화면 가장자리에 걸친 카드를 재생하면 플레이어 전체가 보이도록 맞춥니다.
    carousel.scrollTo({ left: activeCard.offsetLeft - track.firstElementChild.offsetLeft, behavior: 'instant' });
    close.focus({ preventScroll: true });
  });

  pause.addEventListener('click', () => {
    stopPlayback();
    if (reducedMotion.matches && !motionOptIn) { motionOptIn = true; setPaused(false); }
    else setPaused(!userPaused);
  });
  carousel.addEventListener('pointerenter', () => { hovered = true; });
  carousel.addEventListener('pointerleave', () => { hovered = false; });
  carousel.addEventListener('focusin', () => { focused = true; });
  carousel.addEventListener('focusout', event => { focused = carousel.contains(event.relatedTarget); });
  carousel.addEventListener('scroll', () => {
    if (cycleWidth > 0) slider.value = ((carousel.scrollLeft % cycleWidth) / cycleWidth * 100).toFixed(1);
  }, { passive: true });
  carousel.addEventListener('wheel', event => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) setPaused(true); }, { passive: true });
  carousel.addEventListener('touchstart', () => setPaused(true), { passive: true });

  // 휠을 굴릴 때 문장을 하나씩 넘기는 함수입니다. 더 넘길 문장이 없으면 false 를 돌려주고, 그때는 옆 화면으로 넘어갑니다.
  stepStory = direction => {
    const next = tabs.findIndex(tab => tab.dataset.story === selected) + direction;
    if (next < 0 || next >= tabs.length) return false;
    selectStory(tabs[next].dataset.story);
    ignoreHoverUntil = performance.now() + 700; // 마우스가 다른 문장 위에 놓여 있어도 바로 되돌아가지 않게
    return true;
  };

  slider.addEventListener('input', () => {
    stopPlayback(); setPaused(true);
    carousel.scrollLeft = cycleWidth * Number(slider.value) / 100;
  });
  $$('[data-film-step]').forEach(button => button.addEventListener('click', () => {
    stopPlayback(); setPaused(true);
    const card = track.firstElementChild;
    if (!card) return;
    const step = card.getBoundingClientRect().width + (parseFloat(getComputedStyle(track).columnGap) || 0);
    let target = carousel.scrollLeft + (button.dataset.filmStep === 'next' ? step : -step);
    if (target < 0) { carousel.scrollLeft += cycleWidth; target += cycleWidth; }
    if (target >= cycleWidth * 1.5) { carousel.scrollLeft -= cycleWidth; target -= cycleWidth; }
    carousel.scrollTo({ left: target, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  }));

  new ResizeObserver(measure).observe(carousel);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { threshold: .1 }).observe(carousel);
  reducedMotion.addEventListener('change', () => { motionOptIn = false; setPaused(userPaused); });

  function flow(time) {
    const elapsed = Math.min(time - previousTime, 40);
    previousTime = time;
    if (visible && !document.hidden && !userPaused && !hovered && !focused && !activeCard && (!reducedMotion.matches || motionOptIn) && cycleWidth > 0) {
      flowPosition += elapsed * .028;
      if (flowPosition >= cycleWidth) flowPosition -= cycleWidth;
      carousel.scrollLeft = flowPosition;
    } else {
      flowPosition = carousel.scrollLeft;
    }
    requestAnimationFrame(flow);
  }
  selectStory('explain');
  setPaused(false);
  requestAnimationFrame(flow);
}

/* ---------- 메인: 한 번 스크롤에 한 화면씩 ----------
   휠을 한 번 굴리면 다음 화면으로 넘어가 멈추고, 다음 화면이 앞 화면 위로 겹쳐 올라옵니다.
   세 문장 화면에서는 문장을 먼저 하나씩 넘긴 뒤 옆 화면으로 넘어갑니다. */
const screens = isHome ? [...$('#main').children] : [];
if (screens.length) {
  const root = document.documentElement;
  const desktop = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)');
  let paged = false;      // 지금 '한 화면씩' 방식이 켜져 있는지
  let pageIndex = 0;      // 지금 보고 있는 화면 번호
  let pageLockUntil = 0;  // 화면이 넘어가는 동안 한 번 더 넘어가지 않게 잠그는 시간
  let animation = 0;

  const pageStops = () => {
    const { stops, max } = screenStops(screens);
    if (max > stops[stops.length - 1] + 4) stops.push(max); // 마지막 화면 아래에 푸터가 남아 있으면 한 번 더 내려갑니다.
    return stops;
  };
  const nearestPage = (stops, y) => stops.reduce((best, stop, index) => (Math.abs(stop - y) < Math.abs(stops[best] - y) ? index : best), 0);

  function goToPage(index) {
    const stops = pageStops();
    pageIndex = Math.min(stops.length - 1, Math.max(0, index));
    const from = window.scrollY;
    const to = stops[pageIndex];
    cancelAnimationFrame(animation);
    animation = 0;
    if (reducedMotion.matches || Math.abs(to - from) < 2) { window.scrollTo({ top: to, behavior: 'instant' }); return; }
    const started = performance.now();
    const duration = 620;
    const tick = now => {
      const t = Math.min(1, (now - started) / duration);
      const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo({ top: from + (to - from) * eased, behavior: 'instant' });
      animation = t < 1 ? requestAnimationFrame(tick) : 0;
    };
    animation = requestAnimationFrame(tick);
  }

  // 화면이 모두 창 안에 들어올 때만 켭니다. 창이 작아 내용이 넘치면 평소처럼 스크롤합니다.
  function updatePaging() {
    const headerHeight = header.getBoundingClientRect().height;
    const fits = screens.every((screen, index) => screen.scrollHeight <= window.innerHeight - (index ? headerHeight : 0) + 2);
    paged = desktop.matches && fits;
    root.classList.toggle('paged', paged);
    if (animation) return;
    const stops = pageStops();
    pageIndex = nearestPage(stops, window.scrollY);
    if (paged && Math.abs(stops[pageIndex] - window.scrollY) > 1) window.scrollTo({ top: stops[pageIndex], behavior: 'instant' });
  }

  // 휠 신호 하나하나가 '새로 굴린 것'인지 가려냅니다.
  // 마우스 휠은 한 칸에 신호가 한 번 오지만, 트랙패드는 손을 뗀 뒤에도 점점 약해지는 신호가 이어지므로
  // 잠깐 멈췄다가 다시 오거나, 방향이 바뀌거나, 약해지던 신호가 다시 세질 때만 새로 굴린 것으로 봅니다.
  let lastWheelAt = 0;
  let lastWheelSize = 0;
  let lastWheelDirection = 0;
  let lastStepAt = -1e9;
  function wheelStep(event) {
    const now = performance.now();
    const size = Math.abs(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    const direction = Math.sign(event.deltaY);
    const gap = now - lastWheelAt;
    const sinceStep = now - lastStepAt;
    const legacy = Math.abs(event.wheelDeltaY || 0);
    const notched = event.deltaMode !== 0 || (legacy >= 120 && legacy % 120 === 0 && legacy !== Math.round(size * 3));
    const fresh = notched
      ? sinceStep > 70
      : gap > 110 || direction !== lastWheelDirection || (sinceStep > 180 && size > 14 && size > lastWheelSize * 1.7);
    lastWheelAt = now; lastWheelSize = size; lastWheelDirection = direction;
    if (!fresh || size < 2) return 0;
    lastStepAt = now;
    return direction;
  }

  function stepPage(direction) {
    // 세 문장 화면: 화면이 자리를 잡은 뒤에는 문장부터 바로바로 넘깁니다.
    if (screens[pageIndex]?.id === 'works') {
      if (animation) return;
      if (stepStory(direction)) return;
    }
    const now = performance.now();
    if (now < pageLockUntil) return;
    const next = pageIndex + direction;
    if (next < 0 || next >= pageStops().length) return;
    pageLockUntil = now + 420;
    goToPage(next);
  }

  window.addEventListener('wheel', event => {
    if (!paged || event.ctrlKey || event.metaKey || event.shiftKey || event.deltaY === 0 || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    if (document.querySelector('dialog[open]') || !mobileMenu.hidden) return;
    event.preventDefault();
    const direction = wheelStep(event);
    if (direction) stepPage(direction);
  }, { passive: false });

  // 키보드(↑ ↓, Page Up/Down, 스페이스, Home/End)로도 한 화면씩 넘깁니다.
  window.addEventListener('keydown', event => {
    if (!paged || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest('input, textarea, select, [role="tab"], [contenteditable], dialog')) return;
    if (event.key === ' ' && event.target.closest('button, a')) return;
    if (event.key === 'Home') { event.preventDefault(); goToPage(0); return; }
    if (event.key === 'End') { event.preventDefault(); goToPage(Infinity); return; }
    const direction = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, ' ': event.shiftKey ? -1 : 1 }[event.key];
    if (!direction) return;
    event.preventDefault();
    stepPage(direction);
  });

  // 메뉴의 ABOUT, 아래 구간 표시줄, '맨 위로' 처럼 같은 페이지 안을 가리키는 링크
  const screenOf = target => screens.findIndex(screen => screen === target || screen.contains(target));
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href').slice(1);
    const index = id ? screenOf(document.getElementById(id)) : 0;
    if (index < 0) return;
    event.preventDefault();
    goToPage(index);
  });

  // 스크롤바나 다른 방법으로 움직였을 때도 지금 화면 번호를 맞춰 둡니다.
  let syncTimer;
  window.addEventListener('scroll', () => {
    if (animation) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { pageIndex = nearestPage(pageStops(), window.scrollY); }, 120);
  }, { passive: true });
  window.addEventListener('resize', updatePaging);
  desktop.addEventListener('change', updatePaging);
  new ResizeObserver(updatePaging).observe(screens[screens.length - 1]);
  window.addEventListener('load', () => {
    updatePaging();
    // 다른 페이지에서 index.html#about 처럼 들어온 경우 그 화면으로 맞춥니다.
    const index = location.hash.length > 1 ? screenOf(document.getElementById(location.hash.slice(1))) : -1;
    if (index > 0) { pageIndex = index; window.scrollTo({ top: pageStops()[index], behavior: 'instant' }); }
  });
  updatePaging();
}

/* ---------- 메인: 클라이언트 로고 ----------
   로고를 세 줄로 나눠 흐르게 합니다. 끊김 없이 이어지도록 같은 묶음을 세 번 이어 붙입니다. */
const clientRows = $('#client-logos');
if (clientRows) {
  const logo = (client, copy = false) => `<div class="client-logo"><img src="${escapeHTML(client.image)}" alt="${copy ? '' : escapeHTML(client.name)}"></div>`;
  const rows = [[], [], []];
  const perRow = Math.ceil(site.clients.length / rows.length);
  site.clients.forEach((client, index) => rows[Math.min(rows.length - 1, Math.floor(index / perRow))].push(client));
  clientRows.innerHTML = rows.filter(row => row.length).map(row => {
    const copies = row.map(client => logo(client, true)).join('');
    return `<div class="client-row"><div class="client-track">${row.map(client => logo(client)).join('')}<div class="client-copy" aria-hidden="true">${copies}${copies}</div></div></div>`;
  }).join('');
  // 한 바퀴 거리를 실제 한 묶음의 너비로 정합니다. 로고가 불러와지면서 너비가 바뀌어도 흐름이 튀거나 빈 곳이 생기지 않습니다.
  const measureRows = () => $$('.client-track', clientRows).forEach(track => {
    const copy = $('.client-copy', track);
    if (copy && copy.offsetLeft > 0) track.style.setProperty('--loop', `${-copy.offsetLeft}px`);
  });
  $$('img', clientRows).forEach(image => { if (!image.complete) image.addEventListener('load', measureRows, { once: true }); });
  new ResizeObserver(measureRows).observe(clientRows);
  measureRows();
}

/* ---------- 메인: 슬레이트 ----------
   슬레이트에 적은 회사명·담당자명·연락처·문의내용을 문의 페이지 양식으로 넘겨줍니다.
   (이 브라우저 탭 안에만 잠깐 보관하고, 문의 페이지가 열리면 바로 지웁니다.) */
const slate = $('[data-slate]');
if (slate) {
  slate.addEventListener('submit', event => {
    event.preventDefault();
    const draft = {};
    ['company', 'name', 'phone', 'message'].forEach(key => { draft[key] = slate.elements[key].value.trim(); });
    try { sessionStorage.setItem('undomedia-inquiry-draft', JSON.stringify(draft)); } catch {}
    slate.classList.add('is-clapped');
    setTimeout(() => { location.href = 'contact.html#inquiry'; }, reducedMotion.matches ? 0 : 240);
  });
  // 뒤로 가기로 돌아왔을 때 슬레이트가 닫힌 채 남지 않도록
  window.addEventListener('pageshow', () => slate.classList.remove('is-clapped'));
}

/* ---------- 메인: 쇼릴 ----------
   data.js 의 showreel 이 비어 있으면 촬영 사진을 그대로 둡니다. */
const heroMedia = $('.hero-media');
if (site.showreel && heroMedia) {
  const video = document.createElement('video');
  video.src = site.showreel;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.setAttribute('aria-hidden', 'true');
  heroMedia.append(video);
  const toggle = $('.video-toggle');
  const updateVideoButton = () => {
    toggle.innerHTML = video.paused ? ICON.play : ICON.pause;
    toggle.setAttribute('aria-label', video.paused ? '배경 영상 재생' : '배경 영상 일시정지');
  };
  video.addEventListener('canplay', () => { toggle.hidden = false; updateVideoButton(); }, { once: true });
  video.addEventListener('error', () => { video.remove(); toggle.hidden = true; });
  video.addEventListener('play', updateVideoButton);
  video.addEventListener('pause', updateVideoButton);
  toggle.addEventListener('click', () => video.paused ? video.play().catch(updateVideoButton) : video.pause());
  if (!reducedMotion.matches) video.play().catch(updateVideoButton);
  reducedMotion.addEventListener('change', event => { if (event.matches) video.pause(); });
}

/* ---------- WORKS: 다섯 개 탭과 목록 ---------- */
const workGrid = $('#work-grid');
const workDialog = $('#work-dialog');
if (workGrid && workDialog) {
  const filters = $$('[data-filter]');
  const params = () => new URLSearchParams(location.search);
  // '전체' 탭은 분류가 하나라도 지정된 모든 작품을 보여줍니다.
  // (분류가 없는 영상은 메인의 세 문장 영역에만 쓰는 영상입니다.)
  const allCategory = { id: 'all', label: '전체' };
  const categoryList = [allCategory, ...site.categories];
  const inCategory = (work, id) => (id === 'all' ? (work.groups || []).length > 0 : (work.groups || []).includes(id));
  let category = allCategory;
  const panel = $('#work-panel');
  const latestBox = $('#work-latest');
  const latestGrid = $('#latest-grid');
  let works = [];

  filters.forEach(button => {
    const count = site.projects.filter(work => inCategory(work, button.dataset.filter)).length;
    button.insertAdjacentHTML('beforeend', `<span class="count">${count}</span>`);
  });

  const workCard = (work, index) => `<button class="work-card" type="button" style="--n:${index}" data-open-project="${escapeHTML(work.id)}" aria-haspopup="dialog" aria-label="${escapeHTML(work.client)} · ${escapeHTML(work.title)} 영상 보기">
    <span class="work-thumb"><img src="${escapeHTML(thumbnail(work))}" alt="" width="960" height="540" loading="lazy"><span class="work-play" aria-hidden="true"><span>${ICON.play}</span></span></span>
    <span class="work-client">${escapeHTML(work.client)}</span>
    <strong class="work-title">${escapeHTML(work.title)}</strong>
  </button>`;

  function renderWorks(filter, updateURL = false) {
    category = categoryList.find(item => item.id === filter) || allCategory;
    works = site.projects.filter(work => inCategory(work, category.id));
    workGrid.innerHTML = works.map(workCard).join('');
    // '전체' 탭에서는 관리페이지에서 고른 최신 영상(최대 6개)을 먼저 보여주고, 그 아래에 전체 영상을 둡니다.
    const latest = category.id === 'all' ? (site.latest || []).map(findWork).filter(work => work && inCategory(work, 'all')).slice(0, 6) : [];
    latestGrid.innerHTML = latest.map(workCard).join('');
    latestBox.hidden = !latest.length;
    $('#work-count').textContent = `${category.label} ${works.length}편`;
    panel.setAttribute('aria-labelledby', `category-${category.id}`);
    filters.forEach(button => {
      const active = button.dataset.filter === category.id;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    });
    if (updateURL) history.replaceState(null, '', `works.html?category=${category.id}`);
  }
  filters.forEach((button, index) => {
    button.addEventListener('click', () => renderWorks(button.dataset.filter, true));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % filters.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + filters.length) % filters.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = filters.length - 1;
      if (next !== undefined) { event.preventDefault(); filters[next].focus(); renderWorks(filters[next].dataset.filter, true); }
    });
  });

  /* 영상 팝업: 페이지 이동 없이 영상과 작업 정보를 보여줍니다. */
  const playerHost = $('#work-dialog-player');
  const steps = $('.dialog-steps', workDialog);
  let opener = null;
  let openIndex = -1;
  let previousBodyOverflow = '';
  let previousRootOverflow = '';
  let pressedBackdrop = false;

  function showWork(index) {
    const work = works[index];
    if (!work) return;
    openIndex = index;
    $('#work-dialog-title').textContent = work.title;
    $('#work-dialog-client').textContent = work.client;
    $('#work-dialog-note').textContent = work.note || work.role || '';
    $('.dialog-note', workDialog).hidden = !(work.note || work.role);
    steps.hidden = works.length < 2;
    playerHost.replaceChildren(createPlayer(work));
    history.replaceState(null, '', `works.html?category=${category.id}&work=${encodeURIComponent(work.id)}`);
    if (!workDialog.open) {
      previousBodyOverflow = document.body.style.overflow;
      previousRootOverflow = document.documentElement.style.overflow;
      workDialog.showModal();
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
  }

  panel.addEventListener('click', event => {
    const button = event.target.closest('[data-open-project]');
    if (!button) return;
    opener = button;
    showWork(works.findIndex(work => work.id === button.dataset.openProject));
  });
  $$('[data-dialog-step]', workDialog).forEach(button => button.addEventListener('click', () => {
    const move = button.dataset.dialogStep === 'next' ? 1 : -1;
    showWork((openIndex + move + works.length) % works.length);
  }));

  const outsideDialog = event => {
    const rect = workDialog.getBoundingClientRect();
    return event.target === workDialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  };
  $('.work-dialog-close').addEventListener('click', () => workDialog.close());
  workDialog.addEventListener('pointerdown', event => { pressedBackdrop = outsideDialog(event); });
  workDialog.addEventListener('click', event => {
    if (pressedBackdrop && outsideDialog(event)) workDialog.close();
    pressedBackdrop = false;
  });
  workDialog.addEventListener('close', () => {
    // 플레이어를 지워 닫은 영상의 재생과 소리도 함께 멈춥니다.
    playerHost.replaceChildren();
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousRootOverflow;
    history.replaceState(null, '', `works.html?category=${category.id}`);
    (opener?.isConnected ? opener : $(`[data-open-project="${works[openIndex]?.id}"]`))?.focus({ preventScroll: true });
    opener = null;
  });

  // 주소에 분류와 작품이 적혀 있으면 그 상태로 엽니다. (예: works.html?category=motion&work=hypr-app)
  function openFromAddress() {
    const linked = findWork(params().get('work'));
    renderWorks(params().get('category') || linked?.groups[0] || 'all');
    if (linked) showWork(works.findIndex(work => work.id === linked.id));
  }
  openFromAddress();
  window.addEventListener('popstate', () => { if (workDialog.open) workDialog.close(); openFromAddress(); });
}

/* ---------- CONTACT: 흐르는 고객 후기 ----------
   example: true 인 후기에는 '예시' 표시가 붙습니다. */
const reviewCarousel = $('#review-carousel');
if (reviewCarousel) {
  const track = $('.review-track', reviewCarousel);
  const toggle = $('.reviews-toggle');
  const reviews = site.reviews || [];
  const reviewCard = (review, duplicate = false) => `<article class="review-card" ${duplicate ? 'data-review-copy aria-hidden="true"' : ''}>
    <div class="review-card-top"><span>${escapeHTML(review.category)}</span>${review.example ? '<span class="review-example-badge">예시</span>' : ''}</div>
    <h3>${escapeHTML(review.title)}</h3>
    <blockquote>“${escapeHTML(review.quote)}”</blockquote>
    <p class="review-author">${escapeHTML(review.company)} <span>· ${escapeHTML(review.author)}</span></p>
  </article>`;
  track.innerHTML = reviews.map(review => reviewCard(review)).join('') + reviews.map(review => reviewCard(review, true)).join('');
  $('.review-example-note').hidden = !reviews.some(review => review.example);

  let paused = reducedMotion.matches;
  let hovered = false;
  let focused = false;
  let visible = false;
  let cycleWidth = 0;
  let previousTime = 0;
  let flowPosition = 0;
  function measureReviews() {
    const copy = $('[data-review-copy]', track);
    cycleWidth = copy ? copy.offsetLeft - track.firstElementChild.offsetLeft : 0;
  }
  function pauseReviews(value) {
    paused = value;
    toggle.innerHTML = value ? ICON.play : ICON.pause;
    toggle.setAttribute('aria-label', value ? '후기 흐름 재생' : '후기 흐름 일시정지');
    toggle.setAttribute('aria-pressed', String(value));
  }
  toggle.addEventListener('click', () => pauseReviews(!paused));
  reviewCarousel.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') hovered = true; });
  reviewCarousel.addEventListener('pointerleave', () => { hovered = false; });
  reviewCarousel.addEventListener('focusin', () => { focused = true; });
  reviewCarousel.addEventListener('focusout', event => { focused = reviewCarousel.contains(event.relatedTarget); });
  reviewCarousel.addEventListener('touchstart', () => pauseReviews(true), { passive: true });
  reviewCarousel.addEventListener('wheel', event => { if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) pauseReviews(true); }, { passive: true });
  reducedMotion.addEventListener('change', event => pauseReviews(event.matches));
  new ResizeObserver(measureReviews).observe(reviewCarousel);
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }, { threshold: .1 }).observe(reviewCarousel);
  function flowReviews(time) {
    const elapsed = Math.min(time - previousTime, 40);
    previousTime = time;
    if (visible && !document.hidden && !paused && !hovered && !focused && cycleWidth > 0) {
      flowPosition += elapsed * .022;
      if (flowPosition >= cycleWidth) flowPosition -= cycleWidth;
      reviewCarousel.scrollLeft = flowPosition;
    } else {
      flowPosition = reviewCarousel.scrollLeft;
    }
    requestAnimationFrame(flowReviews);
  }
  measureReviews(); pauseReviews(paused); requestAnimationFrame(flowReviews);
}

/* ---------- CONTACT: 문의 전송 ----------
   FormSubmit 이 접수했다고 응답한 경우에만 완료라고 표시합니다. */
const form = $('#inquiry-form');
if (form) {
  // 메인 슬레이트에서 적어 온 내용이 있으면 꺼내고 바로 지웁니다.
  let draft = null;
  try {
    draft = JSON.parse(sessionStorage.getItem('undomedia-inquiry-draft') || 'null');
    sessionStorage.removeItem('undomedia-inquiry-draft');
  } catch {}
  const send = $('.inquiry-send', form);
  const sendLabel = $('.send-label', send);
  const status = $('#form-status');
  if (draft && Object.values(draft).some(Boolean)) {
    ['company', 'name', 'phone', 'message'].forEach(key => { if (draft[key]) form.elements[key].value = draft[key]; });
    status.textContent = '적어주신 내용을 옮겨 왔습니다. 나머지를 확인한 뒤 보내주세요.';
    // 아직 비어 있는 필수 항목(보통 이메일)에 바로 입력할 수 있게 합니다.
    [...form.elements].find(field => field.required && !field.value)?.focus({ preventScroll: true });
  }
  let submitting = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    const data = new FormData(form);
    const value = name => String(data.get(name) || '').trim();
    if (value('_honey')) return;
    const payload = {
      _subject: `[UNDOMEDIA] ${value('company')} · 프로젝트 문의`,
      _template: 'table',
      _honey: '',
      email: value('email'),
      '이름 (직함)': value('name'),
      '회사 · 기관명': value('company'),
      '연락처': value('phone'),
      '영상 종류': value('type') || '협의 후 결정',
      '예산 범위': value('budget') || '협의 후 결정',
      '문의 내용': value('message') || '상담을 통해 구체화하고 싶습니다.',
      '접수 시각': new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' (한국 시간)'
    };
    submitting = true; send.disabled = true;
    form.setAttribute('aria-busy', 'true');
    sendLabel.textContent = '보내는 중…';
    status.textContent = ''; status.dataset.state = '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(site.inquiryEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const result = await response.json();
      if (/activat|actived|confirmation/i.test(String(result.message || ''))) {
        status.dataset.state = 'pending';
        status.textContent = '문의가 아직 전달되지 않았습니다. 수신 연결을 확인 중이니 잠시 후 다시 이용해주세요.';
      } else if (response.ok && (result.success === true || result.success === 'true')) {
        status.dataset.state = 'success';
        status.textContent = '문의가 접수되었습니다. 내용을 확인한 뒤 연락드리겠습니다.';
        form.reset();
      } else {
        throw new Error('Submission rejected');
      }
    } catch {
      status.dataset.state = 'error';
      status.textContent = '전송 결과를 확인하지 못했습니다. 입력하신 내용은 유지됩니다. 잠시 후 다시 시도해주세요.';
    } finally {
      clearTimeout(timeout);
      submitting = false; send.disabled = false;
      form.removeAttribute('aria-busy');
      sendLabel.textContent = '문의 보내기';
    }
  });
}
