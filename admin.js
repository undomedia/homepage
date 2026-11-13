/* UNDOMEDIA 관리페이지
   홈페이지 내용(data.js)을 화면에서 고치고 '저장'을 누르면 반영합니다.
   - 인터넷에 올라간 관리페이지: GitHub 저장소에 저장 → 1~2분 뒤 홈페이지에 반영 (어느 브라우저든 가능)
   - 내 컴퓨터에서 연 관리페이지(127.0.0.1): 홈페이지 폴더에 직접 저장 (Chrome 에서 사용) */
'use strict';

// 홈페이지 파일이 올라가 있는 GitHub 저장소와, 인터넷 관리페이지 주소
const REPO = { owner: 'undomedia', name: 'homepage', branch: 'main' };
const ONLINE_ADMIN = 'https://undomedia.github.io/homepage/admin.html';
// 내 컴퓨터에서 열었는지(폴더에 저장), 인터넷에서 열었는지(GitHub 에 저장)
const ONLINE = !['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);

const data = JSON.parse(JSON.stringify(window.UNDOMEDIA || {}));
const STORY_KEYS = ['explain', 'brand', 'culture'];
const STORY_NAMES = ['첫 번째 문장', '두 번째 문장', '세 번째 문장'];

// 비어 있는 항목이 있어도 편집 화면이 깨지지 않도록 틀을 채워 둡니다.
function fillDefaults() {
  data.text ??= {};
  ['hero', 'about', 'works', 'clients', 'start', 'worksPage'].forEach(key => { data.text[key] ??= {}; });
  data.text.about.principles ??= [{}, {}, {}];
  data.text.works.stories ??= {};
  data.selections ??= {};
  STORY_KEYS.forEach(key => {
    data.text.works.stories[key] ??= { sentence: '', tags: [] };
    data.selections[key] ??= [];
  });
  data.company ??= {};
  data.company.instagramIcon ??= '';
  data.categories ??= [];
  data.projects ??= [];
  data.clients ??= [];
  data.reviews ??= [];
  data.showreel ??= '';
  data.latest ??= [];
}
fillDefaults();

const pending = new Map();   // 저장할 때 폴더에 써 넣을 새 파일 (경로 → 파일)
const previews = new Map();  // 아직 저장 전인 파일을 화면에 보여주기 위한 임시 주소
let folder = null;           // 연결된 홈페이지 폴더 (내 컴퓨터에서 열었을 때)
let key = '';                // GitHub 연결 열쇠 (인터넷에서 열었을 때)
let dirty = false;           // 저장하지 않은 변경이 있는지
let lastSaved = null;
let current = 'hero-video';
let workFilter = 'all';

const $ = (selector, context = document) => context.querySelector(selector);

/* ---------- 화면 조각을 만드는 도우미 ---------- */
function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) if (child != null && child !== false) node.append(child);
  return node;
}

function touch() {
  dirty = true;
  updateState();
}

// 글 입력칸 하나. target[key] 값을 바로 고칩니다.
function field(label, target, key, { rows = 0, help = '', placeholder = '' } = {}) {
  const input = rows
    ? h('textarea', { rows, value: target[key] ?? '', placeholder })
    : h('input', { type: 'text', value: target[key] ?? '', placeholder });
  input.addEventListener('input', () => { target[key] = input.value; touch(); });
  return h('label', { class: 'field' }, h('span', { class: 'field-label', text: label }), input, help && h('small', { text: help }));
}

function card(title, ...children) {
  return h('section', { class: 'card' }, title && h('h2', { text: title }), ...children);
}

function uploadButton(label, accept, onFile, className = 'button ghost') {
  const input = h('input', { type: 'file', accept });
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try { await onFile(file); } catch (error) { toast(error.message || '파일을 처리하지 못했습니다.', true); }
  });
  return h('label', { class: `${className} upload` }, label, input);
}

// 실수로 지우지 않도록 두 번 눌러야 동작하는 버튼
function confirmButton(label, onConfirm) {
  const button = h('button', { class: 'button small danger', type: 'button', text: label });
  let timer;
  button.addEventListener('click', () => {
    if (button.classList.contains('confirming')) { clearTimeout(timer); onConfirm(); return; }
    button.classList.add('confirming');
    button.textContent = `정말 ${label}`;
    timer = setTimeout(() => { button.classList.remove('confirming'); button.textContent = label; }, 3000);
  });
  return button;
}

function moveButtons(list, index, name) {
  const move = delta => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    touch(); renderPanel();
  };
  return [
    h('button', { class: 'button small ghost', type: 'button', text: '↑', ariaLabel: `${name} 위로`, disabled: index === 0, onclick: () => move(-1) }),
    h('button', { class: 'button small ghost', type: 'button', text: '↓', ariaLabel: `${name} 아래로`, disabled: index === list.length - 1, onclick: () => move(1) })
  ];
}

let toastTimer;
function toast(message, isError = false) {
  const node = $('#toast');
  node.textContent = message;
  node.className = isError ? 'toast error' : 'toast';
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, isError ? 7000 : 4000);
}

/* ---------- 파일 다루기 ---------- */
const stamp = () => Date.now().toString(36);
const fileURL = path => previews.get(path) || path;
const youtubeThumb = id => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
const workThumb = work => (work.image ? fileURL(work.image) : work.youtubeId ? youtubeThumb(work.youtubeId) : '');

function addFile(path, blob) {
  pending.set(path, blob);
  previews.set(path, URL.createObjectURL(blob));
  touch();
}

// 유튜브 주소 어디에서든 영상 ID(11글자)를 찾아냅니다.
function youtubeId(input) {
  const text = String(input || '').trim();
  const match = text.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  if (match) return match[1];
  return /^[\w-]{11}$/.test(text) ? text : '';
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했습니다. JPG 나 PNG 파일을 올려주세요.')); };
    image.src = url;
  });
}
const canvasBlob = (canvas, type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));

// 썸네일: 16:9 로 잘라 가로 960px 이하의 가벼운 파일로 만듭니다.
async function makeThumbnail(file) {
  const image = await readImage(file);
  const ratio = 16 / 9;
  let sw = image.naturalWidth, sh = image.naturalHeight, sx = 0, sy = 0;
  if (sw / sh > ratio) { const width = sh * ratio; sx = (sw - width) / 2; sw = width; }
  else { const height = sw / ratio; sy = (sh - height) / 2; sh = height; }
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(960, Math.round(sw));
  canvas.height = Math.round(canvas.width / ratio);
  canvas.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const webp = await canvasBlob(canvas, 'image/webp', .85);
  if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' };
  return { blob: await canvasBlob(canvas, 'image/jpeg', .85), ext: 'jpg' };
}

// 로고: 흰 배경을 투명하게 바꾸고 둘레의 빈 곳을 잘라냅니다.
async function makeLogo(file, removeWhite) {
  if (file.type === 'image/svg+xml') return { blob: file, ext: 'svg' };
  const image = await readImage(file);
  const scale = Math.min(1, 480 / image.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const d = pixels.data;
  let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
  for (let i = 0; i < d.length; i += 4) {
    if (removeWhite) {
      const a = d[i + 3] / 255;
      // 반투명한 부분은 흰 바탕 위에 놓인 색으로 계산한 뒤, 흰색에 가까울수록 투명하게 만듭니다.
      const r = d[i] * a + 255 * (1 - a), g = d[i + 1] * a + 255 * (1 - a), b = d[i + 2] * a + 255 * (1 - a);
      const alpha = 255 - Math.min(r, g, b);
      if (alpha < 10) { d[i + 3] = 0; }
      else {
        const f = 255 / alpha;
        d[i] = Math.max(0, 255 - (255 - r) * f);
        d[i + 1] = Math.max(0, 255 - (255 - g) * f);
        d[i + 2] = Math.max(0, 255 - (255 - b) * f);
        d[i + 3] = alpha;
      }
    }
    if (d[i + 3] > 24) {
      const x = (i / 4) % canvas.width, y = Math.floor(i / 4 / canvas.width);
      if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y;
    }
  }
  if (right < left) throw new Error('로고 이미지에서 내용을 찾지 못했습니다.');
  context.putImageData(pixels, 0, 0);
  const trimmed = document.createElement('canvas');
  trimmed.width = right - left + 1;
  trimmed.height = bottom - top + 1;
  trimmed.getContext('2d').drawImage(canvas, left, top, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return { blob: await canvasBlob(trimmed, 'image/png'), ext: 'png' };
}

/* ---------- 편집 화면: 메인 페이지 ---------- */
function sectionHeroVideo() {
  const view = h('div');
  const draw = () => view.replaceChildren(
    data.showreel
      ? h('div', { class: 'media-row' },
        h('video', { class: 'video-preview', src: fileURL(data.showreel), muted: true, loop: true, autoplay: true, playsInline: true }),
        h('div', {},
          h('p', { class: 'path', text: `지금 파일: ${data.showreel}` }),
          h('button', { class: 'button ghost', type: 'button', text: '영상 빼기 (촬영 사진으로 되돌리기)', onclick: () => { data.showreel = ''; touch(); draw(); } })))
      : h('p', { class: 'empty', text: '지금은 영상 없이 촬영 사진이 보입니다.' }),
    h('div', { class: 'toolbar', style: 'margin-top:14px' },
      uploadButton('새 영상 올리기', 'video/mp4,video/webm', async file => {
        const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
        const path = `assets/showreel-${stamp()}.${ext}`;
        addFile(path, file);
        data.showreel = path;
        draw();
        if (file.size > 40 * 1024 * 1024) toast(`영상이 ${Math.round(file.size / 1024 / 1024)}MB 입니다. 40MB 를 넘으면 홈페이지가 느리게 열릴 수 있습니다.`, true);
      }, 'button primary')),
    h('p', { class: 'hint', text: '소리 없이 반복 재생됩니다. MP4(H.264), 가로 1920px, 2분 이내, 40MB 이하를 권장합니다. 영상 위에 남색이 덮이고 왼쪽 아래에 제목이 놓입니다.' })
  );
  draw();
  return [card('메인 첫 화면 영상', view)];
}

function sectionHeroText() {
  const t = data.text.hero;
  return [card('첫 화면 제목',
    field('윗줄 (가늘게, 넓게 펼쳐지는 글)', t, 'wide'),
    field('아랫줄 (굵고 큰 글)', t, 'deep', { rows: 2, help: '줄을 바꾸면 화면에서도 줄이 바뀝니다.' })),
  card('설명과 버튼',
    field('설명', t, 'lead', { rows: 2 }),
    field('버튼 글자', t, 'button', { help: '누르면 WORKS 페이지로 이동합니다.' }))];
}

function sectionAbout() {
  const t = data.text.about;
  return [card('큰 제목과 설명',
    field('큰 영문 제목', t, 'question'),
    field('한글 제목', t, 'title', { rows: 2 }),
    field('설명', t, 'body', { rows: 3 })),
  ...t.principles.map((item, index) => card(`세 가지 원칙 ${index + 1}`,
    h('div', { class: 'grid-2' }, field('영문 단어', item, 'word'), field('제목', item, 'title')),
    field('설명', item, 'body', { rows: 2 })))];
}

function sectionStories() {
  const t = data.text.works;
  const top = card('공통 문구',
    h('div', { class: 'grid-2' }, field('문장 앞머리', t, 'subject'), field('아래 버튼 글자', t, 'button')));
  const stories = STORY_KEYS.map((key, index) => {
    const story = t.stories[key];
    const selected = data.selections[key];
    const tagsInput = h('input', { type: 'text', value: (story.tags || []).join(', ') });
    tagsInput.addEventListener('input', () => {
      story.tags = tagsInput.value.split(',').map(tag => tag.trim()).filter(Boolean).map(tag => (tag.startsWith('#') ? tag : `#${tag}`));
      touch();
    });
    const rows = selected.map((id, position) => {
      const work = data.projects.find(item => item.id === id);
      if (!work) return null;
      return h('li', { class: 'row' },
        h('img', { class: 'row-thumb', src: workThumb(work), alt: '' }),
        h('div', { class: 'row-main' }, h('strong', { text: work.title }), h('span', { text: work.client })),
        h('div', { class: 'row-actions' },
          ...moveButtons(selected, position, work.title),
          h('button', { class: 'button small ghost', type: 'button', text: '내리기', onclick: () => { selected.splice(position, 1); touch(); renderPanel(); } })));
    });
    const rest = data.projects.filter(work => !selected.includes(work.id));
    const picker = h('select', { ariaLabel: `${STORY_NAMES[index]}에 올릴 영상` },
      h('option', { value: '', text: '등록된 영상에서 고르기…' }),
      ...rest.map(work => h('option', { value: work.id, text: `${work.client} · ${work.title}` })));
    return card(STORY_NAMES[index],
      field('문장', story, 'sentence'),
      h('label', { class: 'field' }, h('span', { class: 'field-label', text: '해시태그' }), tagsInput, h('small', { text: '쉼표(,)로 구분합니다. 예: #MOTIONGRAPHIC, #EDUCATION' })),
      h('p', { class: 'field-label', text: `이 문장에 흐르는 영상 (${selected.length}개, 6개 권장)` }),
      selected.length ? h('ul', { class: 'rows' }, rows) : h('p', { class: 'empty', text: '올라간 영상이 없습니다.' }),
      h('div', { class: 'toolbar', style: 'margin-top:12px' },
        picker,
        h('button', { class: 'button small', type: 'button', text: '올리기', onclick: () => { if (!picker.value) return; selected.push(picker.value); touch(); renderPanel(); } }),
        h('button', { class: 'button small ghost', type: 'button', text: '새 영상 등록해서 올리기', onclick: () => openWorkEditor(null, { onSave: work => { selected.push(work.id); } }) })));
  });
  return [top, ...stories];
}

function sectionClosingText() {
  return [card('고객 로고 위의 문구',
    field('제목', data.text.clients, 'title'),
    field('설명', data.text.clients, 'body', { rows: 2 })),
  card('프로젝트 문의 문구',
    field('제목', data.text.start, 'title', { rows: 2 }),
    field('설명', data.text.start, 'lead', { rows: 2 }),
    field('슬레이트 버튼 글자', data.text.start, 'button'))];
}

/* ---------- 편집 화면: 영상과 로고 ---------- */
const categoryLabel = id => data.categories.find(item => item.id === id)?.label || id;

function removeWork(work) {
  data.projects.splice(data.projects.indexOf(work), 1);
  STORY_KEYS.forEach(key => { data.selections[key] = data.selections[key].filter(id => id !== work.id); });
  data.latest = data.latest.filter(id => id !== work.id);
  touch(); renderPanel();
}

function sectionWorks() {
  const filter = h('select', { ariaLabel: '분류로 걸러 보기' },
    h('option', { value: 'all', text: '모든 영상' }),
    ...data.categories.map(item => h('option', { value: item.id, text: item.label })),
    h('option', { value: 'none', text: '분류 없음 (메인 전용)' }));
  filter.value = workFilter;
  filter.addEventListener('change', () => { workFilter = filter.value; renderPanel(); });
  const shown = data.projects.filter(work => workFilter === 'all' || (workFilter === 'none' ? !(work.groups || []).length : (work.groups || []).includes(workFilter)));
  const rows = shown.map(work => {
    const index = data.projects.indexOf(work);
    const groups = work.groups || [];
    return h('li', { class: 'row' },
      h('img', { class: 'row-thumb', src: workThumb(work), alt: '' }),
      h('div', { class: 'row-main' },
        h('strong', { text: work.title }),
        h('span', { text: work.client }),
        h('div', {}, groups.length ? groups.map(id => h('span', { class: 'chip', text: categoryLabel(id) })) : h('span', { class: 'chip only-main', text: '분류 없음 · 메인 전용' }))),
      h('div', { class: 'row-actions' },
        ...(workFilter === 'all' ? moveButtons(data.projects, index, work.title) : []),
        h('button', { class: 'button small ghost', type: 'button', text: '수정', onclick: () => openWorkEditor(work) }),
        confirmButton('삭제', () => removeWork(work))));
  });
  return [h('div', { class: 'toolbar' },
    h('button', { class: 'button primary', type: 'button', text: '영상 추가', onclick: () => openWorkEditor(null) }),
    filter,
    h('span', { class: 'spacer', text: `${shown.length}개 표시 · 전체 ${data.projects.length}개` })),
  shown.length ? h('ul', { class: 'rows' }, rows) : h('p', { class: 'empty', text: '이 분류에 등록된 영상이 없습니다.' }),
  h('p', { class: 'hint', style: 'margin-top:12px', text: '목록 순서가 WORKS 페이지에 보이는 순서입니다. 순서는 "모든 영상"으로 볼 때 바꿀 수 있습니다.' })];
}

// WORKS '전체' 탭 맨 위에 보이는 최신 영상 (최대 6개)
function sectionLatest() {
  const LIMIT = 6;
  data.latest = data.latest.filter(id => data.projects.some(work => work.id === id));
  const latest = data.latest;
  const rows = latest.map((id, position) => {
    const work = data.projects.find(item => item.id === id);
    return h('li', { class: 'row' },
      h('img', { class: 'row-thumb', src: workThumb(work), alt: '' }),
      h('div', { class: 'row-main' }, h('strong', { text: work.title }), h('span', { text: work.client })),
      h('div', { class: 'row-actions' },
        ...moveButtons(latest, position, work.title),
        h('button', { class: 'button small ghost', type: 'button', text: '내리기', onclick: () => { latest.splice(position, 1); touch(); renderPanel(); } })));
  });
  const rest = data.projects.filter(work => (work.groups || []).length && !latest.includes(work.id));
  const picker = h('select', { ariaLabel: '최신 영상으로 올릴 영상', disabled: latest.length >= LIMIT },
    h('option', { value: '', text: latest.length >= LIMIT ? '6개가 모두 찼습니다. 하나를 내린 뒤 고르세요.' : 'WORKS 에 등록된 영상에서 고르기…' }),
    ...rest.map(work => h('option', { value: work.id, text: `${work.client} · ${work.title}` })));
  return [card(`최신 영상 (${latest.length} / ${LIMIT}개)`,
    latest.length ? h('ul', { class: 'rows' }, rows) : h('p', { class: 'empty', text: '고른 영상이 없습니다. 비워두면 "전체" 탭에 전체 영상만 보입니다.' }),
    h('div', { class: 'toolbar', style: 'margin-top:12px' },
      picker,
      h('button', { class: 'button small', type: 'button', text: '올리기', disabled: latest.length >= LIMIT, onclick: () => { if (!picker.value || latest.length >= LIMIT) return; latest.push(picker.value); touch(); renderPanel(); } })),
    h('p', { class: 'hint', text: '위에서부터 차례로 보입니다. WORKS 분류가 하나라도 지정된 영상만 고를 수 있습니다.' })),
  card('제목 글자',
    h('div', { class: 'grid-2' }, field('최신 영상 제목', data.text.worksPage, 'latestTitle'), field('전체 영상 제목', data.text.worksPage, 'allTitle')))];
}

// 영상 등록·수정 창
function openWorkEditor(work, { onSave } = {}) {
  const dialog = $('#work-editor');
  const isNew = !work;
  const draft = work
    ? JSON.parse(JSON.stringify(work))
    : { id: `w${stamp()}`, title: '', client: '', youtubeId: '', image: '', groups: [], role: '', note: '' };
  draft.groups ??= [];
  $('#work-editor-title').textContent = isNew ? '영상 등록' : '영상 수정';
  $('#work-error').textContent = '';

  const uploaded = []; // 이 창에서 새로 올린 썸네일 (취소하면 버립니다)
  const thumb = h('img', { alt: '' });
  const refreshThumb = () => { thumb.src = draft.image ? fileURL(draft.image) : draft.youtubeId ? youtubeThumb(draft.youtubeId) : ''; };
  const linkHint = h('small', {});
  const linkInput = h('input', { type: 'url', value: draft.youtubeId ? `https://youtu.be/${draft.youtubeId}` : '', placeholder: 'https://youtu.be/… 또는 https://www.youtube.com/watch?v=…' });
  const readLink = () => {
    draft.youtubeId = youtubeId(linkInput.value);
    linkHint.textContent = draft.youtubeId ? `영상을 찾았습니다. (ID: ${draft.youtubeId})` : linkInput.value.trim() ? '유튜브 주소를 다시 확인해주세요.' : '유튜브에 올린 영상의 주소를 붙여 넣어주세요.';
    refreshThumb();
  };
  linkInput.addEventListener('input', readLink);

  const bind = (label, key, options = {}) => {
    const node = field(label, draft, key, options);
    return node;
  };
  const checks = h('div', { class: 'checks' }, data.categories.map(item => {
    const box = h('input', { type: 'checkbox', checked: draft.groups.includes(item.id) });
    box.addEventListener('change', () => { draft.groups = data.categories.map(c => c.id).filter(id => (id === item.id ? box.checked : draft.groups.includes(id))); });
    return h('label', {}, box, item.label);
  }));

  $('#work-editor-body').replaceChildren(
    h('label', { class: 'field' }, h('span', { class: 'field-label', text: '유튜브 링크' }), linkInput, linkHint),
    h('div', { class: 'grid-2' }, bind('클라이언트', 'client', { placeholder: '예: 한국전력공사' }), bind('영상 제목', 'title')),
    h('div', { class: 'field' }, h('span', { class: 'field-label', text: 'WORKS 분류 (여러 개 선택 가능)' }), checks,
      h('small', { text: '하나도 고르지 않으면 WORKS 에는 나오지 않고, 메인의 세 문장 영역에서만 쓸 수 있습니다.' })),
    bind('작업 NOTE (영상 팝업에 보이는 글)', 'note', { rows: 3 }),
    bind('참여 범위 (일부만 참여한 작업일 때만)', 'role', { placeholder: '예: 2D 제작' }),
    h('div', { class: 'field' }, h('span', { class: 'field-label', text: '썸네일' }),
      h('div', { class: 'thumb-edit' }, thumb,
        h('div', {},
          uploadButton('이미지 올리기', 'image/*', async file => {
            const { blob, ext } = await makeThumbnail(file);
            const path = `assets/work/${draft.id}-${stamp()}.${ext}`;
            pending.set(path, blob);
            previews.set(path, URL.createObjectURL(blob));
            uploaded.push(path);
            draft.image = path;
            refreshThumb();
          }, 'button small ghost'),
          h('button', { class: 'button small ghost', type: 'button', text: '유튜브 썸네일 쓰기', style: 'margin-left:6px', onclick: () => { draft.image = ''; refreshThumb(); } }),
          h('small', { text: '올리지 않으면 유튜브 썸네일이 자동으로 쓰입니다.' })))));
  readLink();

  // 입력 중에는 '저장 안 함' 표시가 켜지지 않도록, 적용을 눌렀을 때만 반영합니다.
  const wasDirty = dirty;
  const form = $('#work-form');
  form.oninput = () => { $('#work-error').textContent = ''; };
  form.onsubmit = event => {
    event.preventDefault();
    if (!draft.youtubeId) { $('#work-error').textContent = '유튜브 링크를 확인해주세요.'; return; }
    if (!draft.title.trim()) { $('#work-error').textContent = '영상 제목을 적어주세요.'; return; }
    draft.title = draft.title.trim();
    draft.client = draft.client.trim();
    let saved = work;
    if (isNew) { data.projects.push(draft); saved = draft; } else Object.assign(work, draft);
    onSave?.(saved);
    dialog.close();
    touch(); renderPanel();
  };
  const discard = () => { uploaded.forEach(path => { pending.delete(path); previews.delete(path); }); dirty = wasDirty; updateState(); };
  $('#work-cancel').onclick = () => { dialog.close(); discard(); };
  dialog.oncancel = discard;
  dialog.showModal();
}

function sectionClients() {
  const nameInput = h('input', { class: 'inline-input', type: 'text', placeholder: '회사·기관 이름', style: 'max-width:220px' });
  const whiteBox = h('input', { type: 'checkbox', checked: true });
  const add = uploadButton('로고 이미지 골라서 추가', 'image/*', async file => {
    const name = nameInput.value.trim() || file.name.replace(/\.[^.]+$/, '');
    const { blob, ext } = await makeLogo(file, whiteBox.checked);
    const path = `assets/clients/logo-${stamp()}.${ext}`;
    addFile(path, blob);
    data.clients.push({ name, image: path });
    renderPanel();
  }, 'button primary');
  const cards = data.clients.map((client, index) => {
    const name = h('input', { class: 'inline-input', type: 'text', value: client.name, ariaLabel: '이름' });
    name.addEventListener('input', () => { client.name = name.value; touch(); });
    return h('li', { class: 'logo-card' },
      h('div', { class: 'logo-view' }, h('img', { src: fileURL(client.image), alt: client.name })),
      name,
      h('div', { class: 'row-actions' },
        ...moveButtons(data.clients, index, client.name),
        confirmButton('삭제', () => { data.clients.splice(index, 1); touch(); renderPanel(); })));
  });
  return [card('로고 추가',
    h('div', { class: 'toolbar' }, nameInput, add, h('div', { class: 'checks' }, h('label', {}, whiteBox, '흰 배경 지우기'))),
    h('p', { class: 'hint', text: '흰 바탕의 캡처 이미지도 그대로 올리면 됩니다. 배경을 투명하게 바꾸고 둘레의 빈 곳을 잘라냅니다.' })),
  card(`등록된 로고 (${data.clients.length}개)`,
    data.clients.length ? h('ul', { class: 'logo-grid' }, cards) : h('p', { class: 'empty', text: '등록된 로고가 없습니다.' }),
    h('p', { class: 'hint', style: 'margin-top:12px', text: '메인 마지막 화면에 세 줄로 나뉘어 흐릅니다. 앞에서부터 차례로 첫째 줄, 둘째 줄, 셋째 줄에 들어갑니다.' }))];
}

/* ---------- 편집 화면: 그 밖 ---------- */
function sectionWorksPage() {
  return [card('WORKS 페이지 제목',
    field('제목', data.text.worksPage, 'title'),
    field('설명', data.text.worksPage, 'lead')),
  card('분류 이름',
    h('div', { class: 'grid-2' }, data.categories.map((item, index) => field(`분류 ${index + 1}`, item, 'label'))),
    h('p', { class: 'hint', text: 'WORKS 의 탭과 메인 첫 화면 아래의 분야 링크에 쓰입니다. 문의 양식의 "영상 종류" 버튼은 따로 고정되어 있습니다.' }))];
}

function sectionReviews() {
  const cards = data.reviews.map((review, index) => {
    const example = h('input', { type: 'checkbox', checked: !!review.example });
    example.addEventListener('change', () => { review.example = example.checked; touch(); });
    return card(`후기 ${index + 1}`,
      h('div', { class: 'grid-2' }, field('분류', review, 'category', { placeholder: '예: 홍보영상' }), field('제목', review, 'title')),
      field('후기 내용', review, 'quote', { rows: 2 }),
      h('div', { class: 'grid-2' }, field('회사·기관', review, 'company'), field('담당자', review, 'author')),
      h('div', { class: 'toolbar' },
        h('div', { class: 'checks' }, h('label', {}, example, '예시로 표시 (실제 후기가 아닐 때 켜두세요)')),
        h('span', { class: 'spacer' }),
        h('div', { class: 'row-actions' }, ...moveButtons(data.reviews, index, `후기 ${index + 1}`),
          confirmButton('삭제', () => { data.reviews.splice(index, 1); touch(); renderPanel(); }))));
  });
  return [h('div', { class: 'toolbar' },
    h('button', { class: 'button primary', type: 'button', text: '후기 추가', onclick: () => { data.reviews.push({ category: '', title: '', quote: '', company: '', author: '', example: false }); touch(); renderPanel(); } }),
    h('span', { class: 'spacer', text: 'CONTACT 페이지에 흐르는 후기입니다.' })),
  ...(cards.length ? cards : [h('p', { class: 'empty', text: '등록된 후기가 없습니다.' })])];
}

function sectionCompany() {
  const c = data.company;
  return [card('연락처',
    h('div', { class: 'grid-2' }, field('문의메일', c, 'email'), field('연락처', c, 'phone')),
    h('p', { class: 'hint', text: '화면에 보이는 메일 주소만 바뀝니다. 문의 양식이 도착하는 메일(FormSubmit 연결)은 따로 설정되어 있습니다.' })),
  card('회사 정보',
    field('모토 (푸터와 CONTACT 에 보이는 두 줄)', c, 'motto', { rows: 2 }),
    field('사업자등록번호', c, 'bizNumber'),
    field('제작실 주소', c, 'studio'),
    field('기획실 주소', c, 'planning')),
  card('인스타그램',
    field('인스타그램 주소', c, 'instagram', { placeholder: 'https://www.instagram.com/…', help: '푸터에 원 안의 아이콘과 아이디로 보이고, 둘 다 이 주소로 연결됩니다. 비워두면 사라집니다.' }),
    h('div', { class: 'field' }, h('span', { class: 'field-label', text: '원 안에 들어갈 아이콘' }),
      h('div', { class: 'toolbar' },
        c.instagramIcon ? h('span', { class: 'icon-preview' }, h('img', { src: fileURL(c.instagramIcon), alt: '' })) : h('span', { class: 'icon-preview', text: '@' }),
        uploadButton('아이콘 파일 올리기', 'image/svg+xml,image/png', async file => {
          const ext = file.type === 'image/svg+xml' ? 'svg' : 'png';
          const path = `assets/brand/instagram-${stamp()}.${ext}`;
          addFile(path, file);
          c.instagramIcon = path;
          renderPanel();
        }, 'button small ghost'),
        c.instagramIcon && h('button', { class: 'button small ghost', type: 'button', text: '아이콘 빼기', onclick: () => { c.instagramIcon = ''; touch(); renderPanel(); } })),
      h('small', { text: '인스타그램 공식 아이콘(검은색 Glyph, SVG 또는 PNG)을 올리면 흰 원 안에 들어갑니다. 올리지 않으면 @ 표시가 보입니다.' })))];
}

/* ---------- 메뉴 ---------- */
const SECTIONS = [
  { group: '메인 페이지' },
  { id: 'hero-video', name: '메인 영상', lead: '메인 첫 화면 배경에 흐르는 영상입니다.', render: sectionHeroVideo },
  { id: 'hero-text', name: '메인 문구', lead: '메인 첫 화면의 제목과 설명입니다.', render: sectionHeroText },
  { id: 'about', name: 'WHY UNDOMEDIA', lead: '두 번째 화면의 글입니다.', render: sectionAbout },
  { id: 'stories', name: '세 문장과 영상', lead: '"언도미디어는 …" 세 문장과, 문장마다 흐르는 영상을 정합니다.', render: sectionStories },
  { id: 'closing', name: '마지막 화면 문구', lead: '고객 로고와 프로젝트 문의가 있는 마지막 화면의 글입니다.', render: sectionClosingText },
  { group: '영상과 로고' },
  { id: 'works', name: 'WORKS 영상', lead: '유튜브에 올린 영상을 링크로 등록하고, 팝업에 보이는 클라이언트와 작업 NOTE 를 적습니다.', render: sectionWorks },
  { id: 'latest', name: 'WORKS 최신 영상', lead: 'WORKS 를 열면 "전체" 탭 맨 위에 먼저 보이는 영상을 고릅니다. 그 아래에 전체 영상이 이어집니다.', render: sectionLatest },
  { id: 'clients', name: '클라이언트 로고', lead: '메인 마지막 화면에 흐르는 로고입니다.', render: sectionClients },
  { group: '그 밖' },
  { id: 'works-page', name: 'WORKS 문구·분류', lead: 'WORKS 페이지의 제목과 분류 이름입니다.', render: sectionWorksPage },
  { id: 'reviews', name: '고객 후기', lead: 'CONTACT 페이지의 고객 후기입니다.', render: sectionReviews },
  { id: 'company', name: '회사 정보·푸터', lead: '모든 페이지 아래(푸터)와 CONTACT 페이지에 보이는 정보입니다.', render: sectionCompany }
];

function renderMenu() {
  $('#menu').replaceChildren(...SECTIONS.map(section => section.group
    ? h('p', { class: 'menu-group', text: section.group })
    : h('button', { type: 'button', text: section.name, ariaCurrent: section.id === current ? 'true' : null, onclick: () => { current = section.id; renderMenu(); renderPanel(); window.scrollTo(0, 0); } })),
  h('button', { type: 'button', text: '내용 파일 내려받기', style: 'margin-top:14px', onclick: downloadData }));
}

function renderPanel() {
  const section = SECTIONS.find(item => item.id === current);
  $('#panel').replaceChildren(h('h1', { text: section.name }), h('p', { class: 'lead', text: section.lead }), ...section.render());
}

function updateState() {
  const state = $('#state');
  const parts = [ONLINE ? (key ? 'GitHub 연결됨' : 'GitHub 연결 전') : folder ? `연결된 폴더: ${folder.name}` : '폴더 연결 전'];
  if (dirty) parts.push('저장하지 않은 변경이 있습니다');
  else if (lastSaved) parts.push(`${lastSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 저장됨`);
  state.textContent = parts.join(' · ');
  state.classList.toggle('unsaved', dirty);
  $('#connect').textContent = ONLINE ? (key ? 'GitHub 연결 바꾸기' : 'GitHub 연결') : folder ? '다른 폴더 연결' : '홈페이지 폴더 연결';
}

/* ---------- 저장 ----------
   홈페이지 폴더를 한 번 연결하면 data.js 와 새 파일들을 그 폴더에 직접 써 넣습니다.
   저장 전의 data.js 는 data.backup.js 로 남겨 둡니다. */
const serialize = () => `// 언도미디어 홈페이지 내용 파일입니다.
// 이 파일은 관리페이지(admin.html)에서 '저장'을 누르면 자동으로 다시 쓰입니다.
// 직접 고칠 수도 있지만, 관리페이지에서 고치는 편이 안전합니다.
window.UNDOMEDIA = ${JSON.stringify(data, null, 2)};
`;

function memory() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('undomedia-admin', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('kv');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function rememberFolder(handle) {
  try { (await memory()).transaction('kv', 'readwrite').objectStore('kv').put(handle, 'folder'); } catch {}
}
async function recallFolder() {
  try {
    const store = (await memory()).transaction('kv').objectStore('kv');
    return await new Promise(resolve => { const request = store.get('folder'); request.onsuccess = () => resolve(request.result || null); request.onerror = () => resolve(null); });
  } catch { return null; }
}

// 고른 폴더가 이 관리페이지의 홈페이지 폴더(admin.html 과 data.js 가 있는 폴더)인지 확인합니다.
// 한 단계 위 폴더를 골랐다면 그 안에서 홈페이지 폴더를 찾아 대신 씁니다.
async function isSiteFolder(handle) {
  try { await handle.getFileHandle('admin.html'); await handle.getFileHandle('data.js'); return true; } catch { return false; }
}
async function findSiteFolder(handle) {
  if (await isSiteFolder(handle)) return handle;
  try {
    for await (const entry of handle.values()) if (entry.kind === 'directory' && await isSiteFolder(entry)) return entry;
  } catch {}
  return null;
}

async function connectFolder() {
  if (!window.showDirectoryPicker) { toast('이 브라우저에서는 폴더에 저장할 수 없습니다. Chrome 에서 열어주세요.', true); return false; }
  let handle;
  try { handle = await window.showDirectoryPicker({ id: 'undomedia-site', mode: 'readwrite' }); } catch { return false; }
  const siteFolder = await findSiteFolder(handle);
  if (!siteFolder) { toast('이 폴더에서 홈페이지 파일을 찾지 못했습니다. admin.html 이 들어 있는 홈페이지 폴더를 골라주세요.', true); return false; }
  folder = siteFolder;
  rememberFolder(siteFolder);
  updateState();
  return true;
}

async function writeFile(path, content) {
  const parts = path.split('/');
  const name = parts.pop();
  let directory = folder;
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true });
  const writable = await (await directory.getFileHandle(name, { create: true })).createWritable();
  await writable.write(content);
  await writable.close();
}

/* ---------- 인터넷에서 저장 (GitHub) ----------
   '연결 열쇠'(GitHub 토큰)는 이 브라우저에만 보관되고, 저장할 때 GitHub 로만 보내집니다.
   저장하면 data.js 와 새 파일이 저장소에 한 번에 올라가고, 1~2분 뒤 홈페이지에 반영됩니다.
   예전 내용은 GitHub 저장소의 기록(History)에 모두 남습니다. */
const KEY_NAME = 'undomedia-admin-key';
const readKey = () => { try { return localStorage.getItem(KEY_NAME) || ''; } catch { return ''; } };
const storeKey = value => { try { value ? localStorage.setItem(KEY_NAME, value) : localStorage.removeItem(KEY_NAME); } catch {} };

async function github(path, options = {}, token = key) {
  const response = await fetch(`https://api.github.com/repos/${REPO.owner}/${REPO.name}${path}`, {
    cache: 'no-store',
    ...options,
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const error = new Error(response.status === 401 ? '연결 열쇠가 맞지 않거나 기간이 끝났습니다. "GitHub 연결"을 눌러 새 열쇠를 넣어주세요.'
      : response.status === 403 || response.status === 404 ? '이 열쇠로는 홈페이지 저장소에 저장할 수 없습니다. 열쇠를 만들 때 homepage 저장소와 Contents 쓰기 권한을 골랐는지 확인해주세요.'
      : `GitHub 가 요청을 받지 못했습니다. (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return options.raw ? response.text() : response.json();
}

// 열쇠가 이 저장소에 쓸 수 있는지 확인합니다.
async function checkKey(token) {
  const repo = await github('', {}, token);
  if (repo.permissions && repo.permissions.push === false) {
    const error = new Error('이 열쇠에는 쓰기 권한이 없습니다. Contents 를 "Read and write" 로 골라 다시 만들어주세요.');
    error.status = 403;
    throw error;
  }
}

// 저장소에 있는 가장 최근 내용을 불러옵니다. (홈페이지에 반영되기 전의 저장분도 포함)
async function loadLatest() {
  const text = await github(`/contents/data.js?ref=${REPO.branch}`, { raw: true, headers: { Accept: 'application/vnd.github.raw+json' } });
  const fresh = JSON.parse(text.slice(text.indexOf('{', text.indexOf('window.UNDOMEDIA')), text.lastIndexOf('}') + 1));
  if (dirty) return; // 불러오는 사이에 고치기 시작했다면 덮어쓰지 않습니다.
  Object.keys(data).forEach(name => delete data[name]);
  Object.assign(data, fresh);
  fillDefaults();
  renderMenu();
  renderPanel();
}

function connectGithub() {
  const dialog = $('#key-dialog');
  const input = $('#key-input');
  const error = $('#key-error');
  input.value = '';
  error.textContent = '';
  $('#key-remove').hidden = !key;
  dialog.showModal();
  return new Promise(resolve => {
    const form = $('#key-form');
    const finish = result => { form.removeEventListener('submit', submit); dialog.removeEventListener('close', closed); if (dialog.open) dialog.close(); resolve(result); };
    const closed = () => finish(false);
    const submit = async event => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) { error.textContent = '연결 열쇠를 붙여 넣어주세요.'; return; }
      error.textContent = '확인하는 중…';
      try {
        await checkKey(value);
        key = value; storeKey(value); updateState();
        toast('GitHub 에 연결했습니다.');
        finish(true);
        if (!dirty) loadLatest().catch(() => {});
      } catch (problem) { error.textContent = problem.message; }
    };
    form.addEventListener('submit', submit);
    dialog.addEventListener('close', closed);
  });
}

const toBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
  reader.readAsDataURL(blob);
});

async function saveOnline(button) {
  if (!key && !(await connectGithub())) return false;
  for (const [path, blob] of pending) {
    if (blob.size > 95 * 1024 * 1024) throw new Error(`${path.split('/').pop()} 파일이 너무 큽니다. 인터넷 홈페이지에는 95MB 보다 작은 파일만 올릴 수 있습니다.`);
  }
  const head = (await github(`/git/ref/heads/${REPO.branch}`)).object.sha;
  const baseTree = (await github(`/git/commits/${head}`)).tree.sha;
  const tree = [{ path: 'data.js', mode: '100644', type: 'blob', content: serialize() }];
  let count = 0;
  for (const [path, blob] of pending) {
    button.textContent = `파일 올리는 중… (${++count}/${pending.size})`;
    const uploaded = await github('/git/blobs', { method: 'POST', body: { content: await toBase64(blob), encoding: 'base64' } });
    tree.push({ path, mode: '100644', type: 'blob', sha: uploaded.sha });
  }
  button.textContent = '저장 중…';
  const newTree = await github('/git/trees', { method: 'POST', body: { base_tree: baseTree, tree } });
  const when = new Date().toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
  const commit = await github('/git/commits', { method: 'POST', body: { message: `관리페이지에서 저장 (${when})`, tree: newTree.sha, parents: [head] } });
  await github(`/git/refs/heads/${REPO.branch}`, { method: 'PATCH', body: { sha: commit.sha } });
  return true;
}

let saving = false;
async function save() {
  if (saving) return;
  if (ONLINE) {
    saving = true;
    const button = $('#save');
    button.disabled = true; button.textContent = '저장 중…';
    try {
      if (await saveOnline(button)) {
        pending.clear();
        dirty = false;
        lastSaved = new Date();
        toast('저장했습니다. 1~2분 뒤 홈페이지에 반영됩니다.');
      }
    } catch (error) {
      if (error.status === 401) { key = ''; storeKey(''); }
      toast(`저장하지 못했습니다. ${error.message}`, true);
    } finally {
      saving = false;
      button.disabled = false; button.textContent = '저장';
      updateState();
    }
    return;
  }
  if (!folder && !(await connectFolder())) return;
  if (folder.queryPermission && (await folder.queryPermission({ mode: 'readwrite' })) !== 'granted'
    && (await folder.requestPermission({ mode: 'readwrite' })) !== 'granted') {
    toast('폴더에 쓸 수 있도록 허용해야 저장할 수 있습니다.', true);
    return;
  }
  // 예전에 한 단계 위 폴더를 연결해 둔 경우에도 올바른 홈페이지 폴더에 저장되도록 다시 확인합니다.
  const siteFolder = await findSiteFolder(folder);
  if (!siteFolder) {
    folder = null; updateState();
    toast('연결된 폴더에서 홈페이지 파일을 찾지 못했습니다. "홈페이지 폴더 연결"을 눌러 다시 연결해주세요.', true);
    return;
  }
  if (siteFolder !== folder) { folder = siteFolder; rememberFolder(siteFolder); }
  saving = true;
  const button = $('#save');
  button.disabled = true; button.textContent = '저장 중…';
  try {
    try {
      const previous = await (await (await folder.getFileHandle('data.js')).getFile()).text();
      await writeFile('data.backup.js', previous);
    } catch {}
    for (const [path, blob] of pending) await writeFile(path, blob);
    await writeFile('data.js', serialize());
    pending.clear();
    dirty = false;
    lastSaved = new Date();
    toast('저장했습니다. 홈페이지를 새로고침하면 반영됩니다.');
  } catch (error) {
    toast(`저장하지 못했습니다. (${error.message})`, true);
  } finally {
    saving = false;
    button.disabled = false; button.textContent = '저장';
    updateState();
  }
}

// 폴더에 직접 저장할 수 없는 브라우저를 위한 길: data.js 를 내려받아 홈페이지 폴더의 파일과 바꿉니다.
function downloadData() {
  const link = h('a', { href: URL.createObjectURL(new Blob([serialize()], { type: 'text/javascript' })), download: 'data.js' });
  document.body.append(link);
  link.click();
  link.remove();
  toast(pending.size ? '내려받았습니다. 새로 올린 영상·이미지는 이 방법으로는 저장되지 않습니다.' : '내려받았습니다. 홈페이지 폴더의 data.js 와 바꿔주세요.');
}

/* ---------- 시작 ---------- */
$('#save').addEventListener('click', save);
$('#connect').addEventListener('click', () => (ONLINE ? connectGithub() : connectFolder()));
$('#key-cancel').addEventListener('click', () => $('#key-dialog').close());
$('#key-remove').addEventListener('click', () => { key = ''; storeKey(''); updateState(); $('#key-dialog').close(); toast('이 브라우저에서 GitHub 연결을 지웠습니다.'); });
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
});
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });

const notice = message => { $('#notice').hidden = false; $('#notice').textContent = message; };
if (!window.UNDOMEDIA) {
  notice('홈페이지 내용 파일(data.js)을 읽지 못했습니다. 관리페이지는 홈페이지 폴더 안의 admin.html 로 열어야 합니다.');
} else if (ONLINE) {
  key = readKey();
  if (key) {
    loadLatest().catch(error => {
      if (error.status === 401) { key = ''; storeKey(''); updateState(); }
      notice(`가장 최근 내용을 불러오지 못했습니다. ${error.message}`);
    });
  } else {
    notice('고친 내용을 저장하려면 먼저 오른쪽 위의 "GitHub 연결"을 눌러 연결 열쇠를 넣어주세요. (이 브라우저에서 한 번만 하면 됩니다)');
  }
} else {
  const link = h('a', { href: ONLINE_ADMIN, text: '인터넷 관리페이지', target: '_blank', rel: 'noopener' });
  $('#notice').hidden = false;
  $('#notice').replaceChildren('이 페이지는 이 컴퓨터의 폴더만 고칩니다. 인터넷에 올라간 홈페이지는 ', link, '에서 고쳐주세요.',
    window.showDirectoryPicker ? '' : ' (이 브라우저에서는 폴더에 저장할 수도 없습니다.)');
  recallFolder().then(handle => { if (handle && !folder) { folder = handle; updateState(); } });
}
renderMenu();
renderPanel();
updateState();
