const video = document.getElementById('video');
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d');
const preloadOverlay = document.getElementById('preloadOverlay');
const preloadText = document.getElementById('preloadText');
const preloadFill = document.getElementById('preloadFill');
const preloadPercent = document.getElementById('preloadPercent');
const statusEl = document.getElementById('status');
const startBtn = document.getElementById('startBtn');
const soundBtn = document.getElementById('soundBtn');
const bgm = document.getElementById('bgm');
const letterOverlay = document.getElementById('letterOverlay');
const letterTitle = document.getElementById('letterTitle');
const letterBody = document.getElementById('letterBody');
const closeLetterBtn = document.getElementById('closeLetterBtn');
const memoryPage = document.getElementById('memoryPage');
const memoryBgVideo = document.getElementById('memoryBgVideo');
const artTitle = document.getElementById('artTitle');
const artSubtitle = document.getElementById('artSubtitle');
const timelineRoot = document.getElementById('timelineRoot');
const bgmControlBtn = document.getElementById('bgmControlBtn');
const floatingDecor = document.getElementById('floatingDecor');
const mediaLightbox = document.getElementById('mediaLightbox');
const closeLightboxBtn = document.getElementById('closeLightboxBtn');
const lightboxContent = document.getElementById('lightboxContent');
const hudEl = document.querySelector('.hud');

const stages = {
  DETECT: 'detect',
  TRANSITION: 'transition',
  DRAW: 'draw',
  FIREWORKS: 'fireworks',
  LETTER: 'letter',
  MEMORY: 'memory',
};

const state = {
  stage: stages.DETECT,
  tips: [],
  prevTips: new Map(),
  prevDistance: null,
  sparkHeat: 0,
  touchFrames: 0,
  pairStableFrames: 0,
  fireworksTimer: 0,
  fireworksSpawnAcc: 0,
  drawTrail: [],
  guideCells: [],
  guideCoveredCount: 0,
  drawProgress: 0,
  progressMilestone: 0,
  transitionTimer: 0,
  transitionDuration: 0,
  transitionNext: null,
  transitionMessage: '',
  transitionOnFinish: null,
  transitionFxAcc: 0,
  memoryFloatAcc: 0,
};

const particles = [];
const bursts = [];

const physics = {
  gravity: 720,
  drag: 1.85,
  ambientFade: 0.2,
};

let hands = null;
let camera = null;
let lastTime = performance.now();
let rafId = null;
let appReady = false;

let audioCtx = null;
let soundEnabled = true;
let memoriesData = [];
let memoryConfig = null;
let letterConfig = null;
let chapterObserver = null;
let activeBgmSrc = '';
let memoryHeartTimer = null;
let easterObserver = null;
let memoryScrollHandler = null;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.guideCells = createGuide2026Grid();
  resetGuideProgress();
}

function resetGuideProgress() {
  for (const cell of state.guideCells) cell.hit = false;
  state.guideCoveredCount = 0;
  state.drawProgress = 0;
  state.progressMilestone = 0;
}

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function setBgmVolume(v) {
  bgm.volume = clamp(v, 0, 1);
}

function getFireworkBgmUrl() {
  return memoryConfig?.bgm || './assets/bgm.mp3';
}

function getMemoryBgmUrl() {
  return memoryConfig?.memoryBgm || './assets/bgm-memory.mp3';
}

function defaultLetterConfig() {
  return {
    title: '请在 assets/letter.json 配置信件标题',
    paragraphs: ['请在 JSON 中填写正文段落。'],
    buttonText: '收下这封信',
  };
}

function applyLetterContent() {
  const conf = letterConfig || defaultLetterConfig();
  letterTitle.textContent = conf.title || '';
  closeLetterBtn.textContent = conf.buttonText || '收下这封信';

  letterBody.innerHTML = '';
  const paragraphs = Array.isArray(conf.paragraphs) ? conf.paragraphs : [];
  for (const text of paragraphs) {
    const p = document.createElement('p');
    p.textContent = text;
    letterBody.appendChild(p);
  }
}

async function loadLetterConfig() {
  let raw;
  try {
    const res = await fetch('./assets/letter.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('not found');
    raw = await res.json();
  } catch {
    raw = defaultLetterConfig();
  }

  letterConfig = {
    title: raw?.title || defaultLetterConfig().title,
    paragraphs: Array.isArray(raw?.paragraphs) ? raw.paragraphs : defaultLetterConfig().paragraphs,
    buttonText: raw?.buttonText || '收下这封信',
  };

  applyLetterContent();
}

function setBgmSourceIfNeeded(src) {
  if (!src || activeBgmSrc === src) return;
  activeBgmSrc = src;
  bgm.src = src;
  bgm.load();
}

function updatePreloadProgress(done, total, text = '') {
  const progress = total > 0 ? clamp(done / total, 0, 1) : 1;
  preloadFill.style.width = `${(progress * 100).toFixed(1)}%`;
  preloadPercent.textContent = `${Math.round(progress * 100)}%`;
  if (text) preloadText.textContent = text;
}

function preloadAsset(url, typeHint = 'image') {
  if (!url) return Promise.resolve();

  return new Promise((resolve) => {
    const cleanResolve = () => resolve();

    if (typeHint === 'video') {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.muted = true;
      v.src = url;
      v.onloadeddata = cleanResolve;
      v.onerror = cleanResolve;
      return;
    }

    if (typeHint === 'audio') {
      const a = new Audio();
      a.preload = 'auto';
      a.src = url;
      a.oncanplaythrough = cleanResolve;
      a.onerror = cleanResolve;
      return;
    }

    const img = new Image();
    img.onload = cleanResolve;
    img.onerror = cleanResolve;
    img.src = url;
  });
}

async function playBgm() {
  try {
    await bgm.play();
    bgmControlBtn.textContent = '⏸ 暂停 BGM';
  } catch {
    bgmControlBtn.textContent = '▶️ 播放 BGM';
  }
}

function stopBgm() {
  bgm.pause();
  bgmControlBtn.textContent = '▶️ 播放 BGM';
}

function playTone(freq, duration = 0.12, type = 'sine', volume = 0.04) {
  if (!soundEnabled) return;
  ensureAudioContext();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playIgniteSound() {
  playTone(520, 0.08, 'triangle', 0.05);
  setTimeout(() => playTone(760, 0.09, 'triangle', 0.05), 80);
  setTimeout(() => playTone(980, 0.12, 'triangle', 0.045), 150);
}

function playCompleteSound() {
  playTone(440, 0.12, 'sine', 0.045);
  setTimeout(() => playTone(660, 0.12, 'sine', 0.045), 130);
  setTimeout(() => playTone(880, 0.2, 'sine', 0.05), 260);
}

function playCheerSound() {
  playTone(620, 0.07, 'triangle', 0.045);
  setTimeout(() => playTone(820, 0.08, 'triangle', 0.045), 80);
  setTimeout(() => playTone(1040, 0.1, 'triangle', 0.04), 160);
}

function playBoomSound() {
  playTone(rand(90, 130), 0.2, 'sawtooth', 0.04);
}

function addParticle(x, y, vx, vy, life, size, hueShift = 0) {
  particles.push({ x, y, vx, vy, life, maxLife: life, size, hueShift, trail: [] });
}

function emitFingerAura(tip, energy = 1, warmHue = true) {
  const count = Math.floor(2 + energy * 3);
  const hueBase = warmHue ? 42 : 205;
  for (let i = 0; i < count; i += 1) {
    const a = rand(0, Math.PI * 2);
    const speed = rand(24, 96 + energy * 60);
    addParticle(
      tip.x + Math.cos(a) * rand(0, 8),
      tip.y + Math.sin(a) * rand(0, 8),
      Math.cos(a) * speed,
      Math.sin(a) * speed - rand(8, 58),
      rand(0.24, 0.56),
      rand(0.9, 2),
      hueBase + rand(-15, 15)
    );
  }
}

function emitFrictionSparks(p1, p2, intensity) {
  const midX = (p1.x + p2.x) * 0.5;
  const midY = (p1.y + p2.y) * 0.5;
  const nx = p2.y - p1.y;
  const ny = -(p2.x - p1.x);
  const len = Math.hypot(nx, ny) || 1;
  const tx = nx / len;
  const ty = ny / len;

  const count = Math.floor(4 + intensity * 15);
  for (let i = 0; i < count; i += 1) {
    const side = Math.random() > 0.5 ? 1 : -1;
    const speed = rand(130, 520 + intensity * 540);
    const spread = rand(-0.5, 0.5);
    addParticle(
      midX + rand(-4, 4),
      midY + rand(-4, 4),
      tx * speed * side + spread * speed,
      ty * speed * side + rand(-110, 95),
      rand(0.45, 1.1),
      rand(1.2, 2.9),
      rand(-6, 14)
    );
  }

  if (intensity > 0.72 && Math.random() < 0.1) {
    launchBurst(midX, midY, 0.65);
  }
}

function emitBrushSpark(x, y) {
  for (let i = 0; i < 4; i += 1) {
    const a = rand(0, Math.PI * 2);
    const s = rand(55, 190);
    addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - rand(20, 80), rand(0.35, 0.7), rand(1, 2), rand(14, 26));
  }
}

function emitTouchFireByTips(baseIntensity = 0.35) {
  if (state.tips.length < 2) return;
  const [a, b] = state.tips;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d > 112) return;
  const intensity = clamp((1 - d / 112) * baseIntensity + 0.2, 0.2, 0.95);
  emitFrictionSparks(a, b, intensity);
}

function launchBurst(x, y, scale = 1) {
  const count = Math.floor(rand(36, 74) * scale);
  for (let i = 0; i < count; i += 1) {
    const a = rand(0, Math.PI * 2);
    const speed = rand(120, 450) * scale;
    addParticle(x, y, Math.cos(a) * speed, Math.sin(a) * speed - rand(40, 190), rand(0.85, 1.7), rand(1.3, 3.8), rand(0, 45));
  }
  bursts.push({ x, y, age: 0, life: 0.4 + 0.15 * scale });
}

function addDigitBitmapCells(cells, ox, oy, unit, bitmap, digitTag) {
  for (let row = 0; row < bitmap.length; row += 1) {
    const line = bitmap[row];
    for (let col = 0; col < line.length; col += 1) {
      if (line[col] !== '1') continue;
      cells.push({
        x: ox + col * unit,
        y: oy + row * unit,
        w: unit,
        h: unit,
        hit: false,
        digit: digitTag,
      });
    }
  }
}

function createGuide2026Grid() {
  const cells = [];
  const scale = clamp(Math.min(window.innerWidth, window.innerHeight) / 780, 0.72, 1.45);
  const unit = 17 * scale;
  const digitGap = 30 * scale;

  const two = [
    '111111',
    '000011',
    '000011',
    '111111',
    '110000',
    '110000',
    '111111',
    '000000',
  ];
  const zero = [
    '111111',
    '110011',
    '110011',
    '110011',
    '110011',
    '110011',
    '111111',
    '000000',
  ];
  const six = [
    '111111',
    '110000',
    '110000',
    '111111',
    '110011',
    '110011',
    '111111',
    '000000',
  ];

  const digitW = two[0].length * unit;
  const total = digitW * 4 + digitGap * 3;
  const left = window.innerWidth * 0.5 - total * 0.5;
  const top = window.innerHeight * 0.24;

  addDigitBitmapCells(cells, left + (digitW + digitGap) * 0, top, unit, two, '2-1');
  addDigitBitmapCells(cells, left + (digitW + digitGap) * 1, top, unit, zero, '0');
  addDigitBitmapCells(cells, left + (digitW + digitGap) * 2, top, unit, two, '2-2');
  addDigitBitmapCells(cells, left + (digitW + digitGap) * 3, top, unit, six, '6');

  return cells;
}

function defaultMemories() {
  return {
    page: {
      heroTitle: '',
      heroSubtitle: '',
    },
    bgm: './assets/bgm.mp3',
    memoryBgm: './assets/bgm-memory.mp3',
    enableBackgroundVideo: false,
    backgroundVideo: '',
    chapters: [],
  };
}

function normalizeMemoriesConfig(raw) {
  const fallback = defaultMemories();
  const source = raw && typeof raw === 'object' ? raw : {};

  // 兼容旧版: 只有 items
  if (Array.isArray(source.items)) {
    return {
      page: {
        heroTitle: fallback.page.heroTitle,
        heroSubtitle: fallback.page.heroSubtitle,
      },
      bgm: source.bgm || fallback.bgm,
      memoryBgm: source.memoryBgm || source.bgm || fallback.memoryBgm,
      enableBackgroundVideo: source.enableBackgroundVideo === true,
      backgroundVideo: source.backgroundVideo || fallback.backgroundVideo,
      chapters: [
        {
          time: '我们的回忆',
          title: '点点滴滴，都值得珍藏',
          text: '这些画面，是我们一起走过的光。',
          items: source.items,
        },
      ],
    };
  }

  const chapters = Array.isArray(source.chapters) && source.chapters.length
    ? source.chapters
    : fallback.chapters;

  return {
    page: {
      heroTitle:
        source.page?.heroTitle ||
        source.heroTitle ||
        fallback.page.heroTitle,
      heroSubtitle:
        source.page?.heroSubtitle ||
        source.heroSubtitle ||
        fallback.page.heroSubtitle,
    },
    bgm: source.bgm || fallback.bgm,
    memoryBgm: source.memoryBgm || source.bgm || fallback.memoryBgm,
    enableBackgroundVideo: source.enableBackgroundVideo === true,
    backgroundVideo: source.backgroundVideo || fallback.backgroundVideo,
    chapters,
  };
}

async function loadMemories() {
  let raw;
  try {
    const res = await fetch('./assets/memories.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('not found');
    raw = await res.json();
  } catch {
    raw = defaultMemories();
  }

  memoryConfig = normalizeMemoriesConfig(raw);
  memoriesData = memoryConfig.chapters;

  artTitle.textContent = memoryConfig.page.heroTitle;
  artSubtitle.textContent = memoryConfig.page.heroSubtitle;

  setupMemoryBackgroundVideo();
  renderMemories();
  setupArtTitleReveal();
  setupChapterObserver();
}

async function preloadInitialResources() {
  startBtn.disabled = true;
  startBtn.textContent = '资源加载中...';
  updatePreloadProgress(0, 1, '读取配置中...');

  await Promise.all([loadMemories(), loadLetterConfig()]);

  const unique = new Map();
  const addEntry = (url, type) => {
    if (!url) return;
    const key = `${type}:${url}`;
    if (!unique.has(key)) unique.set(key, { url, type });
  };

  addEntry(getFireworkBgmUrl(), 'audio');
  addEntry(getMemoryBgmUrl(), 'audio');
  if (memoryConfig?.enableBackgroundVideo) {
    addEntry(memoryConfig?.backgroundVideo, 'video');
  }
  for (const chapter of memoriesData) {
    for (const item of chapter.items || []) {
      addEntry(item.src, item.type === 'video' ? 'video' : 'image');
    }
  }

  const entries = Array.from(unique.values());
  let done = 0;
  updatePreloadProgress(done, Math.max(entries.length, 1), '预加载素材中...');

  await Promise.all(
    entries.map(async (entry) => {
      await preloadAsset(entry.url, entry.type);
      done += 1;
      updatePreloadProgress(done, entries.length, `已加载 ${done}/${entries.length}`);
    })
  );

  updatePreloadProgress(entries.length, Math.max(entries.length, 1), '加载完成，可开启摄像头');
  appReady = true;
  startBtn.disabled = false;
  startBtn.textContent = '开启摄像头';
  setTimeout(() => preloadOverlay.classList.add('hide'), 220);
}

function setupMemoryBackgroundVideo() {
  if (!memoryConfig?.enableBackgroundVideo) {
    memoryPage.classList.remove('with-bg-video');
    memoryBgVideo.pause();
    memoryBgVideo.removeAttribute('src');
    return;
  }

  const bgVideo = memoryConfig?.backgroundVideo;
  if (!bgVideo) {
    memoryPage.classList.remove('with-bg-video');
    memoryBgVideo.pause();
    memoryBgVideo.removeAttribute('src');
    return;
  }

  memoryBgVideo.src = bgVideo;
  memoryBgVideo.muted = true;
  memoryBgVideo.loop = true;
  memoryBgVideo.play().catch(() => {});
  memoryPage.classList.add('with-bg-video');
}

function setupArtTitleReveal() {
  const text = artTitle.dataset.rawText || artTitle.textContent.trim();
  artTitle.dataset.rawText = text;
  artTitle.classList.remove('reveal');
  artTitle.innerHTML = '';

  Array.from(text).forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.style.transitionDelay = `${i * 36}ms`;
    span.textContent = ch;
    artTitle.appendChild(span);
  });

  requestAnimationFrame(() => {
    artTitle.classList.add('reveal');
  });
}

function triggerCinematicCut() {
  memoryPage.classList.remove('cinematic-cut');
  requestAnimationFrame(() => {
    memoryPage.classList.add('cinematic-cut');
  });
  setTimeout(() => memoryPage.classList.remove('cinematic-cut'), 520);
}

function setupChapterObserver() {
  if (chapterObserver) chapterObserver.disconnect();
  const chapters = timelineRoot.querySelectorAll('.timeline-chapter');
  let activeIndex = -1;

  chapterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        const idx = Number(entry.target.dataset.index || 0);
        if (idx !== activeIndex) {
          activeIndex = idx;
          triggerCinematicCut();
          playTone(560 + idx * 55, 0.08, 'triangle', 0.03);
        }
      });
    },
    { threshold: 0.35 }
  );

  chapters.forEach((el) => chapterObserver.observe(el));
}

function renderMemories() {
  timelineRoot.innerHTML = '';

  memoriesData.forEach((chapter, idx) => {
    const wrap = document.createElement('section');
    wrap.className = 'timeline-chapter';
    wrap.dataset.index = String(idx);

    const dot = document.createElement('span');
    dot.className = 'timeline-dot';
    wrap.appendChild(dot);

    const card = document.createElement('div');
    card.className = 'chapter-card';

    const head = document.createElement('div');
    head.className = 'chapter-head';
    head.innerHTML = `
      <span class="chapter-time">${chapter.time || `Chapter ${idx + 1}`}</span>
      <h3 class="chapter-title">${chapter.title || '我们的故事'}</h3>
      <p class="chapter-text">${chapter.text || ''}</p>
    `;
    card.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'chapter-media-grid';
    (chapter.items || []).forEach((item) => {
      const mediaCard = document.createElement('article');
      mediaCard.className = 'memory-card';

      if (item.type === 'video') {
        const v = document.createElement('video');
        v.src = item.src;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.autoplay = true;
        mediaCard.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.title || 'memory';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.fetchPriority = 'low';
        mediaCard.appendChild(img);
      }

      const mask = document.createElement('div');
      mask.className = 'memory-mask';
      mask.textContent = `${item.title || '我们的回忆'} · ${item.desc || ''}`;
      mediaCard.appendChild(mask);
      mediaCard.addEventListener('click', () => openLightbox(item));
      grid.appendChild(mediaCard);
    });

    if (!grid.children.length) {
      const empty = document.createElement('p');
      empty.className = 'chapter-text';
      empty.textContent = '这一章还没有素材，稍后在 memories.json 里继续添加。';
      card.appendChild(empty);
    }

    card.appendChild(grid);
    wrap.appendChild(card);
    timelineRoot.appendChild(wrap);
  });

  const easter = document.createElement('section');
  easter.className = 'memory-easter';
  easter.id = 'memoryEaster';
  easter.innerHTML = `
    <div class="memory-easter-inner">
      <h3>💖 小彩蛋</h3>
      <p>你已经翻到了故事的最后一页，但我们的故事还会一直写下去 (｡•ᴗ-)_旦~</p>
      <button id="easterBtn" type="button">点我放飞爱心雨</button>
    </div>
  `;
  timelineRoot.appendChild(easter);

  const easterBtn = document.getElementById('easterBtn');
  if (easterBtn) {
    easterBtn.addEventListener('click', () => {
      for (let i = 0; i < 66; i += 1) {
        setTimeout(() => spawnFloatingHeart(true), i * 35);
      }
      playCheerSound();
    });
  }

  setupEasterObserver();
}

function openLightbox(item) {
  lightboxContent.innerHTML = '';
  if (item.type === 'video') {
    const v = document.createElement('video');
    v.src = item.src;
    v.controls = true;
    v.autoplay = true;
    v.playsInline = true;
    lightboxContent.appendChild(v);
  } else {
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = item.title || 'memory';
    lightboxContent.appendChild(img);
  }
  mediaLightbox.classList.add('show');
  mediaLightbox.setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
  mediaLightbox.classList.remove('show');
  mediaLightbox.setAttribute('aria-hidden', 'true');
  lightboxContent.innerHTML = '';
}

function spawnFloatingHeart(isBurst = false) {
  const el = document.createElement('span');
  el.className = 'floating-heart';
  const symbols = ['❤', '♡', '✦', '❣', '💗'];
  el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
  el.style.left = `${rand(3, 97)}vw`;
  el.style.bottom = `${isBurst ? rand(-2, 20) : rand(-8, 12)}vh`;
  el.style.animationDuration = `${isBurst ? rand(5, 8) : rand(7, 13)}s`;
  el.style.opacity = `${isBurst ? rand(0.65, 0.95) : rand(0.45, 0.8)}`;
  floatingDecor.appendChild(el);
  setTimeout(() => el.remove(), 12000);
}

function setupEasterObserver() {
  if (easterObserver) easterObserver.disconnect();
  const target = document.getElementById('memoryEaster');
  if (!target) return;

  easterObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        target.classList.add('show');
        playTone(980, 0.1, 'triangle', 0.04);
      }
    },
    { root: memoryPage, threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
  );

  easterObserver.observe(target);

  if (memoryScrollHandler) {
    memoryPage.removeEventListener('scroll', memoryScrollHandler);
  }

  memoryScrollHandler = () => {
    const nearBottom =
      memoryPage.scrollTop + memoryPage.clientHeight >=
      memoryPage.scrollHeight - 32;
    if (nearBottom) {
      target.classList.add('show');
    }
  };

  memoryPage.addEventListener('scroll', memoryScrollHandler, { passive: true });
}

function startMemoryAmbientEffects() {
  if (memoryHeartTimer) clearInterval(memoryHeartTimer);
  for (let i = 0; i < 12; i += 1) {
    setTimeout(() => spawnFloatingHeart(false), i * 120);
  }
  memoryHeartTimer = setInterval(() => {
    if (state.stage !== stages.MEMORY) return;
    spawnFloatingHeart(false);
  }, 260);
}

async function enterMemoryPage() {
  state.stage = stages.MEMORY;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  particles.length = 0;
  bursts.length = 0;
  state.tips = [];
  state.prevTips.clear();

  hudEl.style.display = 'none';
  letterOverlay.classList.remove('show');
  letterOverlay.setAttribute('aria-hidden', 'true');
  video.style.display = 'none';
  canvas.style.display = 'none';

  if (camera && typeof camera.stop === 'function') {
    try {
      camera.stop();
    } catch {
      // ignore
    }
  }

  if (hands && typeof hands.close === 'function') {
    try {
      await hands.close();
    } catch {
      // ignore
    }
  }

  if (video.srcObject && typeof video.srcObject.getTracks === 'function') {
    for (const track of video.srcObject.getTracks()) track.stop();
    video.srcObject = null;
  }

  await loadMemories();
  memoryPage.classList.add('show');
  memoryPage.setAttribute('aria-hidden', 'false');
  memoryPage.scrollTop = 0;
  startMemoryAmbientEffects();
  setBgmSourceIfNeeded(getMemoryBgmUrl());
  setBgmVolume(0.42);
  await playBgm();
}

function startTransition(nextStage, duration, message, onFinish = null) {
  state.stage = stages.TRANSITION;
  state.transitionTimer = 0;
  state.transitionDuration = duration;
  state.transitionNext = nextStage;
  state.transitionMessage = message;
  state.transitionOnFinish = onFinish;
  state.transitionFxAcc = 0;
}

function updateTransition(dt) {
  if (state.tips.length >= 1) {
    for (const tip of state.tips) emitFingerAura(tip, 0.4, true);
  }
  if (state.tips.length >= 2) {
    const [a, b] = state.tips;
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 130) {
      emitFrictionSparks(a, b, clamp(1 - d / 130, 0.18, 0.65));
    }
  }

  state.transitionTimer += dt;
  state.transitionFxAcc += dt;

  while (state.transitionFxAcc > 0.18) {
    state.transitionFxAcc -= 0.18;
    launchBurst(rand(80, window.innerWidth - 80), rand(70, window.innerHeight * 0.42), rand(0.45, 0.9));
  }

  if (state.transitionTimer >= state.transitionDuration) {
    const next = state.transitionNext;
    state.stage = next;
    const onFinish = state.transitionOnFinish;
    state.transitionOnFinish = null;
    state.transitionMessage = '';
    state.transitionNext = null;
    if (typeof onFinish === 'function') onFinish();
  }
}

function markGuideCoverage(x, y) {
  if (!state.guideCells.length) return;
  const tolerance = clamp(Math.min(window.innerWidth, window.innerHeight) * 0.024, 8, 18);

  for (const cell of state.guideCells) {
    if (cell.hit) continue;
    if (
      x >= cell.x - tolerance &&
      x <= cell.x + cell.w + tolerance &&
      y >= cell.y - tolerance &&
      y <= cell.y + cell.h + tolerance
    ) {
      cell.hit = true;
      state.guideCoveredCount += 1;
    }
  }

  state.drawProgress = state.guideCells.length
    ? state.guideCoveredCount / state.guideCells.length
    : 0;
}

function updateDetectionAndIgnite(dt) {
  if (state.tips.length >= 1) {
    for (const tip of state.tips) emitFingerAura(tip, 0.45, false);
  }

  if (state.tips.length < 2) {
    state.sparkHeat *= Math.pow(0.02, dt);
    state.prevDistance = null;
    state.touchFrames = 0;
    state.pairStableFrames = 0;
    return;
  }

  state.pairStableFrames += 1;
  const [a, b] = state.tips;
  const distance = Math.hypot(b.x - a.x, b.y - a.y);

  const prevA = state.prevTips.get(a.id) || a;
  const prevB = state.prevTips.get(b.id) || b;
  const vax = (a.x - prevA.x) / dt;
  const vay = (a.y - prevA.y) / dt;
  const vbx = (b.x - prevB.x) / dt;
  const vby = (b.y - prevB.y) / dt;

  const relativeSpeed = Math.hypot(vax - vbx, vay - vby);
  const distanceDiff = state.prevDistance == null ? 0 : Math.abs(distance - state.prevDistance) / dt;
  const stablePair = state.pairStableFrames > 8;

  if (distance >= 96) {
    const auraEnergy = clamp(1 - distance / 370, 0.2, 0.85);
    emitFingerAura(a, auraEnergy, true);
    emitFingerAura(b, auraEnergy, true);
    state.touchFrames = 0;
  } else if (stablePair) {
    state.touchFrames += 1;
  }

  const rubDistance = stablePair ? clamp(1 - distance / 96, 0, 1) : 0;
  const rubVelocity = stablePair ? clamp(relativeSpeed / 900, 0, 1) : 0;
  const squeeze = stablePair ? clamp(distanceDiff / 600, 0, 1) : 0;
  const rubIntensity = rubDistance * (0.62 * rubVelocity + 0.38 * squeeze);

  state.sparkHeat = clamp(state.sparkHeat * Math.pow(0.16, dt) + rubIntensity * 1.25, 0, 1.8);

  if (stablePair && state.sparkHeat > 0.16 && rubIntensity > 0.05) {
    emitFrictionSparks(a, b, clamp(state.sparkHeat, 0, 1));
  }

  if (stablePair && state.touchFrames > 14 && state.sparkHeat > 1.24 && Math.random() < 0.05) {
    launchBurst((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 - 18, 0.8);
    playIgniteSound();
    playCheerSound();
    startTransition(stages.DRAW, 1.1, '点燃成功！准备涂亮 2026 的格子', () => {
      state.drawTrail.length = 0;
      resetGuideProgress();
    });
  }

  state.prevDistance = distance;
}

function updateDrawStage() {
  if (state.tips.length >= 1) {
    for (const tip of state.tips) emitFingerAura(tip, 0.35, true);
  }

  if (state.tips.length < 2) return;
  const [a, b] = state.tips;
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  if (distance > 130) return;

  emitTouchFireByTips(0.42);

  const midX = (a.x + b.x) * 0.5;
  const midY = (a.y + b.y) * 0.5;
  state.drawTrail.push({ x: midX, y: midY });
  if (state.drawTrail.length > 900) state.drawTrail.shift();
  emitBrushSpark(midX, midY);
  markGuideCoverage(midX, midY);

  const milestone = Math.floor(state.drawProgress * 4);
  if (milestone > state.progressMilestone) {
    state.progressMilestone = milestone;
    launchBurst(midX, midY - 12, 0.72);
    playTone(600 + milestone * 120, 0.09, 'triangle', 0.04);
  }

  if (state.drawProgress >= 1) {
    playCompleteSound();
    playCheerSound();
    startTransition(stages.FIREWORKS, 1.25, '2026 格子已全部点亮！准备全屏烟花庆祝', () => {
      state.fireworksTimer = 0;
      state.fireworksSpawnAcc = 0;
      launchBurst(window.innerWidth * 0.5, window.innerHeight * 0.35, 1.2);
    });
  }
}

function updateFireworksStage(dt) {
  state.fireworksTimer += dt;
  state.fireworksSpawnAcc += dt;

  while (state.fireworksSpawnAcc > 0.12) {
    state.fireworksSpawnAcc -= 0.12;
    launchBurst(rand(70, window.innerWidth - 70), rand(50, window.innerHeight * 0.58), rand(0.9, 1.45));
    if (Math.random() < 0.35) playBoomSound();
  }

  emitTouchFireByTips(0.34);

  if (state.fireworksTimer > 6.4) {
    playCompleteSound();
    startTransition(stages.LETTER, 1, '烟花谢幕后，信件正在送达...', () => {
      letterOverlay.classList.add('show');
      letterOverlay.setAttribute('aria-hidden', 'false');
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    const dragFactor = Math.exp(-physics.drag * dt);
    p.vx *= dragFactor;
    p.vy *= dragFactor;
    p.vy += physics.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 12) p.trail.shift();
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  for (let i = bursts.length - 1; i >= 0; i -= 1) {
    bursts[i].age += dt;
    if (bursts[i].age > bursts[i].life) bursts.splice(i, 1);
  }
}

function drawBackground() {
  ctx.fillStyle = `rgba(7, 7, 13, ${physics.ambientFade})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (video.readyState >= 2) {
    ctx.save();
    ctx.globalAlpha = 0.11;
    ctx.scale(-1, 1);
    ctx.drawImage(video, -window.innerWidth, 0, window.innerWidth, window.innerHeight);
    ctx.restore();
  }
}

function drawBursts() {
  for (const b of bursts) {
    const t = b.age / b.life;
    const r = 28 + t * 76;
    const alpha = (1 - t) * 0.36;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    g.addColorStop(0, `rgba(255, 242, 180, ${alpha})`);
    g.addColorStop(0.35, `rgba(255, 190, 90, ${alpha * 0.8})`);
    g.addColorStop(1, 'rgba(255, 100, 40, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  for (const p of particles) {
    const t = clamp(p.life / p.maxLife, 0, 1);
    for (let i = 1; i < p.trail.length; i += 1) {
      const a = p.trail[i - 1];
      const b = p.trail[i];
      const segT = i / p.trail.length;
      ctx.strokeStyle = `hsla(${p.hueShift}, 100%, 68%, ${t * segT * 0.46})`;
      ctx.lineWidth = p.size * segT;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.fillStyle = `hsla(${p.hueShift}, 100%, ${52 + t * 30}%, ${0.14 + t * 0.95})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.45 + t * 0.85), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFingerHints() {
  for (const tip of state.tips) {
    ctx.fillStyle = 'rgba(255, 232, 145, 0.95)';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 4.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGuideAndTrail() {
  if (state.stage !== stages.DRAW) return;
  const cells = state.guideCells;
  if (!cells.length) return;

  ctx.save();
  ctx.setLineDash([6, 8]);
  ctx.lineDashOffset = -performance.now() * 0.02;
  ctx.lineWidth = 2;
  for (const cell of cells) {
    if (cell.hit) {
      ctx.fillStyle = 'rgba(255, 172, 74, 0.7)';
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      ctx.strokeStyle = 'rgba(255, 248, 215, 0.9)';
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      ctx.strokeStyle = 'rgba(255, 236, 188, 0.8)';
    }
    ctx.strokeRect(cell.x, cell.y, cell.w, cell.h);
  }
  ctx.restore();

  const progress = clamp(state.drawProgress, 0, 1);
  ctx.fillStyle = 'rgba(255, 242, 202, 0.95)';
  ctx.font = '600 16px sans-serif';
  ctx.fillText(`涂格子进度 ${(progress * 100).toFixed(0)}%`, 20, window.innerHeight - 24);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(20, window.innerHeight - 14, Math.min(window.innerWidth - 40, 260), 6);
  ctx.fillStyle = 'rgba(255, 181, 92, 0.95)';
  ctx.fillRect(20, window.innerHeight - 14, Math.min(window.innerWidth - 40, 260) * progress, 6);
}

function updateStatusText() {
  if (state.stage === stages.TRANSITION) {
    statusEl.textContent = state.transitionMessage;
    return;
  }
  if (state.stage === stages.DRAW) {
    statusEl.textContent = `已点燃！请把 2026 的格子全部点亮（当前 ${(state.drawProgress * 100).toFixed(0)}%）`;
    return;
  }
  if (state.stage === stages.FIREWORKS) {
    statusEl.textContent = '太棒了！全屏烟花庆祝中...';
    return;
  }
  if (state.stage === stages.LETTER) {
    statusEl.textContent = '新年信件已送达 💌';
    return;
  }
  if (state.stage === stages.MEMORY) {
    statusEl.textContent = '正在浏览甜蜜回忆';
    return;
  }

  if (state.tips.length === 0) {
    statusEl.textContent = '第1步：先伸出手指（至少一只）';
  } else if (state.tips.length === 1) {
    statusEl.textContent = '已识别1只食指：继续伸出另一只食指';
  } else {
    const [a, b] = state.tips;
    const distance = Math.hypot(b.x - a.x, b.y - a.y);
    if (state.pairStableFrames <= 8) {
      statusEl.textContent = '检测双食指中，请保持手部稳定';
    } else if (distance >= 110) {
      statusEl.textContent = '第2步：请慢慢把两只食指靠近';
    } else if (state.sparkHeat < 0.16) {
      statusEl.textContent = '第3步：已靠近，来回摩擦即可点燃';
    } else {
      statusEl.textContent = '燃烧中：继续摩擦，马上进入 2026 涂格子';
    }
  }
}

function animate(now) {
  const dt = clamp((now - lastTime) / 1000, 1 / 240, 0.05);
  lastTime = now;

  drawBackground();

  if (state.stage === stages.DETECT) updateDetectionAndIgnite(dt);
  if (state.stage === stages.TRANSITION) updateTransition(dt);
  if (state.stage === stages.DRAW) updateDrawStage();
  if (state.stage === stages.FIREWORKS) updateFireworksStage(dt);
  if (state.stage === stages.MEMORY) {
    state.memoryFloatAcc += dt;
    while (state.memoryFloatAcc > 0.35) {
      state.memoryFloatAcc -= 0.35;
      spawnFloatingHeart();
    }
  }

  updateParticles(dt);
  drawBursts();
  drawParticles();
  drawGuideAndTrail();
  drawFingerHints();
  updateStatusText();

  for (const tip of state.tips) state.prevTips.set(tip.id, { x: tip.x, y: tip.y });

  rafId = requestAnimationFrame(animate);
}

function onResults(results) {
  const tips = [];
  if (results.multiHandLandmarks && results.multiHandedness) {
    const seen = new Set();
    for (let i = 0; i < results.multiHandLandmarks.length; i += 1) {
      const hand = results.multiHandLandmarks[i];
      const handedness = results.multiHandedness[i];
      const label = handedness.label || `hand-${i}`;
      if (seen.has(label)) continue;
      seen.add(label);

      const tip = hand[8];
      tips.push({
        id: label,
        x: (1 - tip.x) * window.innerWidth,
        y: tip.y * window.innerHeight,
      });
    }
  }

  tips.sort((a, b) => a.x - b.x);
  state.tips = tips.slice(0, 2);
}

async function initCameraAndHands() {
  if (!window.Hands) throw new Error('手势识别库加载失败，请检查网络连接。');

  hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.65,
    minTrackingConfidence: 0.65,
  });
  hands.onResults(onResults);

  camera = new Camera(video, {
    width: 1280,
    height: 720,
    onFrame: async () => {
      await hands.send({ image: video });
    },
  });

  await camera.start();
}

async function start() {
  if (!appReady) {
    statusEl.textContent = '资源还在加载中，请稍候...';
    return;
  }

  startBtn.disabled = true;
  startBtn.textContent = '启动中...';
  ensureAudioContext();
  setBgmSourceIfNeeded(getFireworkBgmUrl());
  setBgmVolume(0.35);
  bgm.currentTime = 0;
  playBgm();

  try {
    await initCameraAndHands();
    statusEl.textContent = '摄像头已开启：先伸手指，再靠近摩擦';
    startBtn.remove();
  } catch (err) {
    statusEl.textContent = `启动失败：${err.message || err}`;
    startBtn.disabled = false;
    startBtn.textContent = '重试开启摄像头';
  }
}

soundBtn.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundBtn.classList.toggle('muted', !soundEnabled);
  soundBtn.textContent = soundEnabled ? '🔊 音效开' : '🔇 音效关';
});

closeLetterBtn.addEventListener('click', () => {
  enterMemoryPage();
});

bgmControlBtn.addEventListener('click', async () => {
  if (bgm.paused) {
    await playBgm();
  } else {
    stopBgm();
  }
});

closeLightboxBtn.addEventListener('click', closeLightbox);
mediaLightbox.addEventListener('click', (e) => {
  if (e.target === mediaLightbox) closeLightbox();
});

window.addEventListener('resize', resize);
startBtn.addEventListener('click', start);

resize();
rafId = requestAnimationFrame(animate);
preloadInitialResources();
