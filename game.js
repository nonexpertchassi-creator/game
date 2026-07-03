/* =========================================================
   🏭 방치형 공장 타이쿤  —  Idle Factory Tycoon
   순수 바닐라 JS. 저장/오프라인 수익/재투자 포함.
   ========================================================= */

(() => {
  'use strict';

  const SAVE_KEY = 'factory_tycoon_save_v1';

  // 생산 라인 정의. 앞선 라인일수록 싸고 빠르지만 수익이 낮음.
  // baseCost: 1개 구매 기본가 / costMul: 살 때마다 가격 상승률
  // baseRev : 1개당 사이클 수익 / time: 사이클 시간(초)
  const LINE_DEFS = [
    { id: 'screw',   name: '나사 공장',     icon: '🔩', baseCost: 4,        costMul: 1.07, baseRev: 1,          time: 0.8,  mgrCost: 1e3 },
    { id: 'bolt',    name: '볼트 조립소',   icon: '⚙️', baseCost: 60,       costMul: 1.08, baseRev: 12,        time: 3,    mgrCost: 1.5e4 },
    { id: 'gear',    name: '기어 제작소',   icon: '🛠️', baseCost: 720,      costMul: 1.09, baseRev: 90,        time: 6,    mgrCost: 2e5 },
    { id: 'board',   name: '회로기판 공장', icon: '🔌', baseCost: 8640,     costMul: 1.10, baseRev: 720,       time: 12,   mgrCost: 3e6 },
    { id: 'arm',     name: '로봇팔 조립',   icon: '🦾', baseCost: 1.036e5,  costMul: 1.11, baseRev: 6480,      time: 24,   mgrCost: 5e7 },
    { id: 'drone',   name: '드론 생산라인', icon: '🚁', baseCost: 1.244e6,  costMul: 1.12, baseRev: 58320,     time: 48,   mgrCost: 8e8 },
    { id: 'car',     name: '전기차 공장',   icon: '🚗', baseCost: 1.49e7,   costMul: 1.13, baseRev: 524880,   time: 96,   mgrCost: 1.2e10 },
    { id: 'rocket',  name: '로켓 제조소',   icon: '🚀', baseCost: 1.79e8,   costMul: 1.14, baseRev: 4723920,  time: 192,  mgrCost: 2e11 },
  ];

  // 보유 수량 마일스톤마다 생산량 ×2
  const MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000];

  // ---------- 상태 ----------
  let state;

  function freshState() {
    return {
      money: 4,
      lifetime: 0,          // 재투자 이후 누적 수익 (프레스티지 계산용)
      fame: 0,              // 명성(프레스티지 포인트)
      buyMode: 1,
      lastTick: Date.now(),
      lines: LINE_DEFS.map(d => ({
        id: d.id,
        count: d.id === 'screw' ? 1 : 0, // 첫 라인은 1개 제공
        progress: 0,        // 0~1
        running: false,     // 현재 사이클 진행 중 여부
        hasManager: false,
      })),
    };
  }

  function def(id) { return LINE_DEFS.find(d => d.id === id); }
  function ls(id) { return state.lines.find(l => l.id === id); }

  // ---------- 계산 헬퍼 ----------
  function milestoneMult(count) {
    let m = 1;
    for (const ms of MILESTONES) if (count >= ms) m *= 2;
    return m;
  }
  function nextMilestone(count) {
    for (const ms of MILESTONES) if (count < ms) return ms;
    return null;
  }
  function fameMult() { return 1 + state.fame * 0.02; } // 명성 1당 +2%

  function cycleRevenue(line) {
    const d = def(line.id);
    return d.baseRev * line.count * milestoneMult(line.count) * fameMult();
  }

  // n개 구매 총비용 (등비수열 합)
  function costFor(line, n) {
    const d = def(line.id);
    const r = d.costMul;
    const a = d.baseCost * Math.pow(r, line.count);
    return a * (Math.pow(r, n) - 1) / (r - 1);
  }

  // 예산으로 살 수 있는 최대 개수
  function maxAffordable(line) {
    const d = def(line.id);
    const r = d.costMul;
    const a = d.baseCost * Math.pow(r, line.count);
    if (state.money < a) return 0;
    // a*(r^n - 1)/(r-1) <= money  =>  n <= log_r( money*(r-1)/a + 1 )
    const n = Math.floor(Math.log(state.money * (r - 1) / a + 1) / Math.log(r));
    return Math.max(0, n);
  }

  function amountToBuy(line) {
    if (state.buyMode === 'max') return Math.max(1, maxAffordable(line));
    return state.buyMode;
  }

  function isUnlocked(index) {
    if (index === 0) return true;
    // 이전 라인을 1개 이상 보유하면 해금
    return state.lines[index - 1].count > 0;
  }

  function perSecond() {
    let total = 0;
    for (const line of state.lines) {
      if (line.count > 0 && line.hasManager) {
        total += cycleRevenue(line) / def(line.id).time;
      }
    }
    return total;
  }

  // ---------- 숫자 포맷 ----------
  const UNITS = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag'];
  function fmt(n) {
    if (n < 1000) return '₩' + Math.floor(n).toLocaleString();
    let u = 0;
    while (n >= 1000 && u < UNITS.length - 1) { n /= 1000; u++; }
    return '₩' + n.toFixed(2) + UNITS[u];
  }
  function fmtPlain(n) {
    if (n < 1000) return Math.floor(n).toString();
    let u = 0;
    while (n >= 1000 && u < UNITS.length - 1) { n /= 1000; u++; }
    return n.toFixed(2) + UNITS[u];
  }
  function fmtTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  }

  // ---------- 재투자(프레스티지) ----------
  // 누적 수익이 클수록 얻는 명성 증가. sqrt 스케일.
  function fameGain() {
    const base = 1e6; // 100만원부터 명성 발생
    if (state.lifetime < base) return 0;
    return Math.floor(Math.sqrt(state.lifetime / base) * 5);
  }

  function doPrestige() {
    const gain = fameGain();
    if (gain <= 0) return;
    if (!confirm(`재투자하면 지금까지의 진행이 초기화되지만,\n명성 +${gain} 을 영구히 얻어\n모든 수익이 ×${(1 + (state.fame + gain) * 0.02).toFixed(2)} 로 늘어납니다.\n\n진행할까요?`)) return;
    const keepFame = state.fame + gain;
    const buyMode = state.buyMode;
    state = freshState();
    state.fame = keepFame;
    state.buyMode = buyMode;
    toast(`♻️ 재투자 완료! 명성 +${gain}`, 'gold');
    saveGame();
    renderAll();
  }

  // ---------- 액션 ----------
  function buyLine(id) {
    const line = ls(id);
    const idx = state.lines.indexOf(line);
    if (!isUnlocked(idx)) return;
    const n = amountToBuy(line);
    if (n <= 0) return;
    const cost = costFor(line, n);
    if (state.money < cost) return;
    state.money -= cost;
    const before = line.count;
    line.count += n;
    // 마일스톤 돌파 알림
    const nm = nextMilestone(before);
    if (nm && line.count >= nm) toast(`⭐ ${def(id).name} ${nm}개 돌파! 생산량 ×2`, 'gold');
    updateLineDOM(id);
    refreshHeader();
  }

  function hireManager(id) {
    const line = ls(id);
    const d = def(id);
    if (line.hasManager || state.money < d.mgrCost) return;
    state.money -= d.mgrCost;
    line.hasManager = true;
    if (!line.running && line.count > 0) startCycle(line);
    toast(`👔 ${d.name} 매니저 고용! 자동 생산 시작`, 'good');
    updateLineDOM(id);
    refreshHeader();
  }

  function startCycle(line) {
    if (line.count <= 0) return;
    line.running = true;
    line.progress = 0;
  }

  // 아이콘 클릭 → 수동 사이클 시작 (매니저 없을 때)
  function clickLine(id) {
    const line = ls(id);
    if (line.count <= 0) return;
    if (line.running) return;
    startCycle(line);
    updateLineDOM(id);
  }

  function completeCycle(line) {
    const rev = cycleRevenue(line);
    state.money += rev;
    state.lifetime += rev;
    spawnFloat(line.id, '+' + fmt(rev));
    if (line.hasManager) {
      line.progress = 0; // 자동 반복
    } else {
      line.running = false;
      line.progress = 0;
    }
  }

  // ---------- 메인 루프 ----------
  let lastFrame = performance.now();
  function tick(now) {
    const dt = Math.min(0.25, (now - lastFrame) / 1000); // 프레임당 최대 0.25초
    lastFrame = now;
    let changedMoney = false;

    for (const line of state.lines) {
      if (!line.running || line.count <= 0) continue;
      const d = def(line.id);
      line.progress += dt / d.time;
      while (line.progress >= 1) {
        line.progress -= 1;
        completeCycle(line);
        changedMoney = true;
        if (!line.running) break;
      }
      updateProgressDOM(line.id);
    }

    if (changedMoney) refreshHeader();
    state.lastTick = Date.now();
    requestAnimationFrame(tick);
  }

  // ---------- 오프라인 수익 ----------
  function applyOffline() {
    const now = Date.now();
    const elapsed = Math.min((now - state.lastTick) / 1000, 60 * 60 * 8); // 최대 8시간
    if (elapsed < 5) return;
    let earned = 0;
    for (const line of state.lines) {
      if (line.count > 0 && line.hasManager) {
        earned += (cycleRevenue(line) / def(line.id).time) * elapsed;
      }
    }
    if (earned <= 0) return;
    state.money += earned;
    state.lifetime += earned;
    showOfflineModal(earned, elapsed);
  }

  // =========================================================
  //  렌더링
  // =========================================================
  const linesEl = document.getElementById('lines');
  const moneyEl = document.getElementById('money');
  const perSecEl = document.getElementById('per-second');
  const prestigeBonusEl = document.getElementById('prestige-bonus');
  const prestigeGainEl = document.getElementById('prestige-gain');
  const prestigeBtn = document.getElementById('prestige-btn');

  function renderAll() {
    linesEl.innerHTML = '';
    state.lines.forEach((line, idx) => {
      linesEl.appendChild(buildLineEl(line, idx));
    });
    refreshHeader();
  }

  function buildLineEl(line, idx) {
    const d = def(line.id);
    const el = document.createElement('div');
    el.className = 'line';
    el.id = 'line-' + line.id;
    el.innerHTML = `
      <div class="line-icon-wrap" data-click="${line.id}">
        <span class="ico">${d.icon}</span>
        <span class="count-badge">${line.count}</span>
      </div>
      <div class="line-mid">
        <div class="line-name">
          <span>${d.name}</span>
          <span class="mult-tag">×${fmtPlain(milestoneMult(line.count))}</span>
        </div>
        <div class="line-sub"></div>
        <div class="progress-track">
          <div class="progress-fill"></div>
          <div class="progress-label"></div>
        </div>
      </div>
      <div class="line-actions">
        <button class="buy-btn" data-buy="${line.id}">
          <div class="bt-top">구매 <span class="bt-amt"></span></div>
          <div class="bt-cost"></div>
        </button>
        <button class="mgr-btn" data-mgr="${line.id}"></button>
      </div>
    `;
    return el;
  }

  function updateLineDOM(id) {
    const line = ls(id);
    const idx = state.lines.indexOf(line);
    const d = def(id);
    const el = document.getElementById('line-' + id);
    if (!el) return;

    const unlocked = isUnlocked(idx);
    el.classList.toggle('locked', !unlocked);

    el.querySelector('.count-badge').textContent = line.count;
    el.querySelector('.mult-tag').textContent = '×' + fmtPlain(milestoneMult(line.count));

    // 서브 정보
    const sub = el.querySelector('.line-sub');
    const nm = nextMilestone(line.count);
    const revEach = cycleRevenue(line);
    sub.innerHTML = line.count > 0
      ? `사이클당 <b>${fmt(revEach)}</b> · ${d.time}s${nm ? ` · 다음 보너스 ${nm}개` : ' · MAX'}`
      : (unlocked ? `첫 라인을 구매하세요 · 사이클 ${d.time}s` : `🔒 이전 라인을 먼저 보유하세요`);

    // 아이콘 스핀
    const iconWrap = el.querySelector('.line-icon-wrap');
    iconWrap.classList.toggle('spinning', line.running && line.hasManager);

    // 구매 버튼
    const n = amountToBuy(line);
    const cost = costFor(line, n);
    const buyBtn = el.querySelector('.buy-btn');
    buyBtn.querySelector('.bt-amt').textContent = state.buyMode === 'max' ? `×${n}` : `×${n}`;
    buyBtn.querySelector('.bt-cost').textContent = fmt(cost);
    const canBuy = unlocked && state.money >= cost && n > 0;
    buyBtn.classList.toggle('can-buy', canBuy);
    buyBtn.disabled = !canBuy;
    el.classList.toggle('affordable-glow', canBuy && line.count === 0);

    // 매니저 버튼
    const mgrBtn = el.querySelector('.mgr-btn');
    if (line.hasManager) {
      mgrBtn.className = 'mgr-btn owned';
      mgrBtn.textContent = '👔 자동화 완료';
      mgrBtn.disabled = true;
    } else {
      mgrBtn.className = 'mgr-btn';
      mgrBtn.innerHTML = `👔 매니저 ${fmt(d.mgrCost)}`;
      mgrBtn.disabled = !unlocked || state.money < d.mgrCost || line.count === 0;
    }

    updateProgressDOM(id);
  }

  function updateProgressDOM(id) {
    const line = ls(id);
    const el = document.getElementById('line-' + id);
    if (!el) return;
    const fill = el.querySelector('.progress-fill');
    const label = el.querySelector('.progress-label');
    fill.style.width = (line.progress * 100).toFixed(1) + '%';
    if (line.count === 0) {
      label.textContent = '';
    } else if (line.running) {
      const remain = def(id).time * (1 - line.progress);
      label.textContent = remain.toFixed(1) + 's';
    } else {
      label.textContent = '클릭하여 생산 ▶';
    }
  }

  function refreshHeader() {
    moneyEl.textContent = fmt(state.money);
    perSecEl.textContent = fmt(perSecond()) + '/초';
    prestigeBonusEl.textContent = '×' + fameMult().toFixed(2);
    const gain = fameGain();
    prestigeGainEl.textContent = '+' + gain;
    prestigeBtn.disabled = gain <= 0;
    // 모든 구매/매니저 버튼 활성 상태 갱신
    for (const line of state.lines) refreshButtonsOnly(line.id);
  }

  // 헤더 갱신 시 버튼 활성/비활성만 빠르게 반영 (전체 재계산 없이)
  function refreshButtonsOnly(id) {
    const line = ls(id);
    const idx = state.lines.indexOf(line);
    const d = def(id);
    const el = document.getElementById('line-' + id);
    if (!el) return;
    const unlocked = isUnlocked(idx);
    const n = amountToBuy(line);
    const cost = costFor(line, n);
    const buyBtn = el.querySelector('.buy-btn');
    const canBuy = unlocked && state.money >= cost && n > 0;
    buyBtn.classList.toggle('can-buy', canBuy);
    buyBtn.disabled = !canBuy;
    if (state.buyMode === 'max') {
      buyBtn.querySelector('.bt-amt').textContent = `×${n}`;
      buyBtn.querySelector('.bt-cost').textContent = fmt(cost);
    }
    const mgrBtn = el.querySelector('.mgr-btn');
    if (!line.hasManager) {
      mgrBtn.disabled = !unlocked || state.money < d.mgrCost || line.count === 0;
    }
  }

  // 떠오르는 수익 텍스트
  function spawnFloat(id, text) {
    const el = document.getElementById('line-' + id);
    if (!el) return;
    const wrap = el.querySelector('.line-icon-wrap');
    const f = document.createElement('div');
    f.className = 'float-gain';
    f.textContent = text;
    f.style.left = '30px';
    f.style.top = '6px';
    wrap.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }

  // 토스트
  const toastsEl = document.getElementById('toasts');
  function toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    toastsEl.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  // 오프라인 모달
  function showOfflineModal(earned, elapsed) {
    document.getElementById('offline-amount').textContent = fmt(earned);
    document.getElementById('offline-time').textContent = `자리 비운 시간: ${fmtTime(elapsed)}`;
    document.getElementById('offline-modal').classList.remove('hidden');
  }

  // =========================================================
  //  저장 / 로드
  // =========================================================
  function saveGame() {
    state.lastTick = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
    catch (e) { /* 저장 실패 무시 */ }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) { state = freshState(); return; }
      const saved = JSON.parse(raw);
      state = freshState();
      // 안전 병합
      state.money = saved.money ?? state.money;
      state.lifetime = saved.lifetime ?? 0;
      state.fame = saved.fame ?? 0;
      state.buyMode = saved.buyMode ?? 1;
      state.lastTick = saved.lastTick ?? Date.now();
      if (Array.isArray(saved.lines)) {
        for (const sl of saved.lines) {
          const line = ls(sl.id);
          if (!line) continue;
          line.count = sl.count ?? 0;
          line.hasManager = !!sl.hasManager;
          line.running = line.hasManager && line.count > 0; // 매니저 있으면 재개
          line.progress = 0;
        }
      }
    } catch (e) {
      state = freshState();
    }
  }

  function resetGame() {
    if (!confirm('정말 모든 진행을 삭제하고 처음부터 시작할까요?\n(명성도 사라집니다)')) return;
    localStorage.removeItem(SAVE_KEY);
    state = freshState();
    renderAll();
    toast('🗑️ 초기화 완료', '');
  }

  // =========================================================
  //  이벤트 바인딩
  // =========================================================
  function bindEvents() {
    // 라인 목록 클릭 위임
    linesEl.addEventListener('click', (e) => {
      const buy = e.target.closest('[data-buy]');
      if (buy) { buyLine(buy.dataset.buy); return; }
      const mgr = e.target.closest('[data-mgr]');
      if (mgr) { hireManager(mgr.dataset.mgr); return; }
      const clickable = e.target.closest('[data-click]');
      if (clickable) { clickLine(clickable.dataset.click); return; }
    });

    // 구매 모드
    document.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelector('.seg-btn.active')?.classList.remove('active');
        btn.classList.add('active');
        const m = btn.dataset.mode;
        state.buyMode = m === 'max' ? 'max' : parseInt(m, 10);
        state.lines.forEach(l => updateLineDOM(l.id));
      });
    });

    document.getElementById('prestige-btn').addEventListener('click', doPrestige);
    document.getElementById('save-btn').addEventListener('click', () => { saveGame(); toast('💾 저장 완료', 'good'); });
    document.getElementById('reset-btn').addEventListener('click', resetGame);
    document.getElementById('offline-close').addEventListener('click', () => {
      document.getElementById('offline-modal').classList.add('hidden');
      renderAll();
    });

    // 주기적 자동 저장 + 전체 리렌더(마일스톤/버튼 상태)
    setInterval(saveGame, 15000);
    setInterval(() => state.lines.forEach(l => updateLineDOM(l.id)), 1000);
    window.addEventListener('beforeunload', saveGame);
  }

  // =========================================================
  //  시작
  // =========================================================
  function init() {
    loadGame();
    applyOffline();
    renderAll();
    bindEvents();
    requestAnimationFrame((t) => { lastFrame = t; requestAnimationFrame(tick); });
  }

  init();
})();
