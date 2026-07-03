/* =========================================================
   🏭 방치형 공장 타이쿤  —  Idle Factory Tycoon  v2
   생산 → 📦 재고 → 🛒 구매자 판매 파이프라인
   💎 잼 / 📜 퀘스트 / 특수 업그레이드 상점
   ========================================================= */

(() => {
  'use strict';

  const SAVE_KEY = 'factory_tycoon_save_v2';
  const OLD_SAVE_KEY = 'factory_tycoon_save_v1';

  // 생산 라인 정의.
  // baseCost: 설비 1대 기본가 / costMul: 살 때마다 가격 상승률
  // price   : 생산품 1개 판매가 / time: 사이클 시간(초)
  // 사이클마다 (설비 수 × 마일스톤 배수)개의 생산품이 재고로 들어감.
  const LINE_DEFS = [
    { id: 'screw',  name: '나사 공장',     item: '나사',     icon: '🔩', baseCost: 4,       costMul: 1.07, price: 1,        time: 0.8,  mgrCost: 1e3 },
    { id: 'bolt',   name: '볼트 조립소',   item: '볼트',     icon: '⚙️', baseCost: 60,      costMul: 1.08, price: 12,       time: 3,    mgrCost: 1.5e4 },
    { id: 'gear',   name: '기어 제작소',   item: '기어',     icon: '🛠️', baseCost: 720,     costMul: 1.09, price: 90,       time: 6,    mgrCost: 2e5 },
    { id: 'board',  name: '회로기판 공장', item: '회로기판', icon: '🔌', baseCost: 8640,    costMul: 1.10, price: 720,      time: 12,   mgrCost: 3e6 },
    { id: 'arm',    name: '로봇팔 조립',   item: '로봇팔',   icon: '🦾', baseCost: 1.036e5, costMul: 1.11, price: 6480,     time: 24,   mgrCost: 5e7 },
    { id: 'drone',  name: '드론 생산라인', item: '드론',     icon: '🚁', baseCost: 1.244e6, costMul: 1.12, price: 58320,    time: 48,   mgrCost: 8e8 },
    { id: 'car',    name: '전기차 공장',   item: '전기차',   icon: '🚗', baseCost: 1.49e7,  costMul: 1.13, price: 524880,   time: 96,   mgrCost: 1.2e10 },
    { id: 'rocket', name: '로켓 제조소',   item: '로켓',     icon: '🚀', baseCost: 1.79e8,  costMul: 1.14, price: 4723920,  time: 192,  mgrCost: 2e11 },
  ];

  // 설비 보유 수 마일스톤마다 사이클당 생산 개수 ×2
  const MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000];

  // ---------- 상태 ----------
  let state;

  function freshLines() {
    return LINE_DEFS.map(d => ({
      id: d.id,
      count: d.id === 'screw' ? 1 : 0, // 첫 라인은 설비 1대 제공
      progress: 0,
      running: false,
      hasManager: false,
      inventory: 0,   // 📦 쌓인 생산품
      buyerLv: 1,     // 🛒 구매자 레벨 (판매 속도)
      qualityLv: 0,   // 💠 품질 레벨 (판매가 +25%씩)
    }));
  }

  function freshState() {
    return {
      money: 4,
      gems: 0,
      lifetime: 0,          // 이번 회차 누적 수익 (프레스티지 계산용)
      fame: 0,              // 명성(프레스티지 포인트)
      buyMode: 1,
      lastTick: Date.now(),
      upgrades: { speed: 0, sell: 0, offline: 0, brand: 0 }, // 💎 상점 업그레이드 레벨
      claimed: {},          // 수령한 퀘스트 { questId: true }
      stats: { totalSold: 0, prestiges: 0 }, // 전체 기간 통계 (재투자에도 유지)
      lines: freshLines(),
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
  function fameMult() { return 1 + state.fame * 0.02; } // 명성 1당 판매가 +2%

  // 사이클 시간 (⚡ 고속 컨베이어 업그레이드 반영)
  function cycleTime(d) { return d.time * Math.pow(0.9, state.upgrades.speed); }

  // 사이클당 생산 개수
  function itemsPerCycle(line) { return line.count * milestoneMult(line.count); }

  // 생산품 1개 판매가 (💠 품질 × 🏅 브랜드 × 명성 반영)
  function itemPrice(line) {
    return def(line.id).price
      * Math.pow(1.25, line.qualityLv)
      * (1 + 0.2 * state.upgrades.brand)
      * fameMult();
  }

  // 💠 품질 다음 레벨 비용
  function qualityCost(line) {
    return def(line.id).baseCost * 25 * Math.pow(3.2, line.qualityLv);
  }

  // 초당 판매 개수 (구매자 레벨 + 📣 마케팅 업그레이드 반영)
  function sellRate(line) {
    const d = def(line.id);
    const base = 3 / d.time; // 설비 3대 분량의 생산 속도에서 시작
    return base * Math.pow(1.7, line.buyerLv - 1) * (1 + 0.25 * state.upgrades.sell);
  }

  // 구매자 다음 레벨 비용
  function buyerCost(line) {
    return def(line.id).baseCost * 12 * Math.pow(2.3, line.buyerLv - 1);
  }

  // n대 구매 총비용 (등비수열 합)
  function costFor(line, n) {
    const d = def(line.id);
    const r = d.costMul;
    const a = d.baseCost * Math.pow(r, line.count);
    return a * (Math.pow(r, n) - 1) / (r - 1);
  }

  function maxAffordable(line) {
    const d = def(line.id);
    const r = d.costMul;
    const a = d.baseCost * Math.pow(r, line.count);
    if (state.money < a) return 0;
    return Math.max(0, Math.floor(Math.log(state.money * (r - 1) / a + 1) / Math.log(r)));
  }

  function amountToBuy(line) {
    if (state.buyMode === 'max') return Math.max(1, maxAffordable(line));
    return state.buyMode;
  }

  function isUnlocked(index) {
    if (index === 0) return true;
    return state.lines[index - 1].count > 0;
  }

  function managerCount() { return state.lines.filter(l => l.hasManager).length; }
  function buyerLvSum() { return state.lines.reduce((s, l) => s + (l.count > 0 ? l.buyerLv : 0), 0); }
  function qualityLvSum() { return state.lines.reduce((s, l) => s + l.qualityLv, 0); }

  // ---------- 숫자 포맷 ----------
  const UNITS = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag'];
  function fmtNum(n) {
    if (n < 1000) return Math.floor(n).toString();
    let u = 0;
    while (n >= 1000 && u < UNITS.length - 1) { n /= 1000; u++; }
    return n.toFixed(n < 100 ? 2 : 1) + UNITS[u];
  }
  function fmt(n) { return '₩' + fmtNum(n); }
  function fmtTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  }

  // =========================================================
  //  📜 퀘스트 정의
  //  prog() → [현재값, 목표값]. unlocks: 상점 아이템 해금
  // =========================================================
  const QUESTS = [
    { id: 'q_screw10',  name: '첫 걸음',        desc: '나사 공장 설비 10대 보유',        gems: 2,  prog: () => [ls('screw').count, 10] },
    { id: 'q_bolt',     name: '사업 확장',      desc: '볼트 조립소 설비 1대 보유',       gems: 2,  prog: () => [ls('bolt').count, 1] },
    { id: 'q_mgr1',     name: '첫 채용',        desc: '매니저 1명 고용',                 gems: 3,  prog: () => [managerCount(), 1] },
    { id: 'q_sold100k', name: '장사 좀 되네',   desc: '누적 판매 수익 ₩100K 달성',       gems: 4,  prog: () => [state.stats.totalSold, 1e5] },
    { id: 'q_gear',     name: '정밀 공학',      desc: '기어 제작소 설비 1대 보유',       gems: 3,  prog: () => [ls('gear').count, 1] },
    { id: 'q_screw100', name: '나사 대량 생산', desc: '나사 공장 설비 100대 보유',       gems: 5,  prog: () => [ls('screw').count, 100] },
    { id: 'q_mgr3',     name: '경영진 구성',    desc: '매니저 3명 고용',                 gems: 5,  unlocks: 'speed', prog: () => [managerCount(), 3] },
    { id: 'q_buyer10',  name: '영업왕',         desc: '구매자 레벨 합계 10 달성',        gems: 5,  unlocks: 'sell',  prog: () => [buyerLvSum(), 10] },
    { id: 'q_quality5', name: '품질 장인',      desc: '품질 레벨 합계 5 달성',           gems: 5,  unlocks: 'brand', prog: () => [qualityLvSum(), 5] },
    { id: 'q_sold10m',  name: '중견기업',       desc: '누적 판매 수익 ₩10M 달성',        gems: 8,  prog: () => [state.stats.totalSold, 1e7] },
    { id: 'q_arm',      name: '자동화 시대',    desc: '로봇팔 조립 설비 1대 보유',       gems: 6,  prog: () => [ls('arm').count, 1] },
    { id: 'q_prestige', name: '다시 태어나다',  desc: '재투자 1회 달성',                 gems: 10, unlocks: 'warp', prog: () => [state.stats.prestiges, 1] },
    { id: 'q_sold1b',   name: '대기업',         desc: '누적 판매 수익 ₩1B 달성',         gems: 12, prog: () => [state.stats.totalSold, 1e9] },
    { id: 'q_rocket',   name: '우주 시대',      desc: '로켓 제조소 설비 1대 보유',       gems: 15, prog: () => [ls('rocket').count, 1] },
  ];

  function questDone(q) {
    const [cur, goal] = q.prog();
    return cur >= goal;
  }
  function questUnlockedShopItem(shopId) {
    const q = QUESTS.find(q => q.unlocks === shopId);
    return q ? !!state.claimed[q.id] : true;
  }
  function claimableCount() {
    return QUESTS.filter(q => !state.claimed[q.id] && questDone(q)).length;
  }

  // =========================================================
  //  💎 상점 정의
  // =========================================================
  const SHOP = [
    { id: 'speed',   name: '고속 컨베이어', icon: '⚡', max: 5,
      desc: '모든 라인의 사이클 시간 -10% (누적)',
      costs: [5, 10, 20, 35, 60],
      effect: lv => `현재: 사이클 시간 ×${Math.pow(0.9, lv).toFixed(2)}` },
    { id: 'sell',    name: '마케팅 캠페인', icon: '📣', max: 5,
      desc: '모든 라인의 판매 속도 +25% (누적)',
      costs: [4, 8, 15, 25, 40],
      effect: lv => `현재: 판매 속도 +${lv * 25}%` },
    { id: 'brand',   name: '프리미엄 브랜드', icon: '🏅', max: 5,
      desc: '모든 생산품 판매가 +20% (누적)',
      costs: [5, 10, 18, 30, 50],
      effect: lv => `현재: 판매가 +${lv * 20}%` },
    { id: 'offline', name: '야간 근무조',   icon: '🌙', max: 4,
      desc: '오프라인 수익 한도 +2시간',
      costs: [6, 12, 24, 48],
      effect: lv => `현재: 최대 ${8 + lv * 2}시간` },
    { id: 'warp',    name: '타임 워프',     icon: '⏩', max: Infinity, consumable: true,
      desc: '즉시 2시간만큼 자동 생산·판매를 진행 (소모성, 매니저 있는 라인만)',
      costs: [8],
      effect: () => '' },
  ];

  function shopCost(item) {
    if (item.consumable) return item.costs[0];
    const lv = state.upgrades[item.id];
    return lv >= item.max ? null : item.costs[lv];
  }

  // =========================================================
  //  액션
  // =========================================================
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
    const nm = nextMilestone(before);
    if (nm && line.count >= nm) toast(`⭐ ${def(id).name} 설비 ${nm}대 돌파! 생산량 ×2`, 'gold');
    updateLineDOM(id);
    refreshHeader();
  }

  function upgradeBuyer(id) {
    const line = ls(id);
    if (line.count <= 0) return;
    const cost = buyerCost(line);
    if (state.money < cost) return;
    state.money -= cost;
    line.buyerLv += 1;
    toast(`🛒 ${def(id).name} 구매자 Lv.${line.buyerLv}! 판매 속도 상승`, 'good');
    updateLineDOM(id);
    refreshHeader();
  }

  function upgradeQuality(id) {
    const line = ls(id);
    if (line.count <= 0) return;
    const cost = qualityCost(line);
    if (state.money < cost) return;
    state.money -= cost;
    line.qualityLv += 1;
    toast(`💠 ${def(id).name} 품질 Lv.${line.qualityLv}! 판매가 +25%`, 'good');
    updateLineDOM(id);
    refreshHeader();
  }

  function hireManager(id) {
    const line = ls(id);
    const d = def(id);
    if (line.hasManager || state.money < d.mgrCost || line.count <= 0) return;
    state.money -= d.mgrCost;
    line.hasManager = true;
    if (!line.running) startCycle(line);
    toast(`👔 ${d.name} 매니저 고용! 자동 생산 시작`, 'good');
    updateLineDOM(id);
    refreshHeader();
  }

  function startCycle(line) {
    if (line.count <= 0) return;
    line.running = true;
    line.progress = 0;
  }

  function clickLine(id) {
    const line = ls(id);
    if (line.count <= 0 || line.running) return;
    startCycle(line);
    updateLineDOM(id);
  }

  // 사이클 완료 → 재고 적립
  function completeCycle(line) {
    const made = itemsPerCycle(line);
    line.inventory += made;
    spawnFloat(line.id, `+${fmtNum(made)}개 📦`);
    if (line.hasManager) {
      line.progress = 0;
    } else {
      line.running = false;
      line.progress = 0;
    }
  }

  // ---------- 재투자(프레스티지) ----------
  function fameGain() {
    const base = 1e6;
    if (state.lifetime < base) return 0;
    return Math.floor(Math.sqrt(state.lifetime / base) * 5);
  }

  function doPrestige() {
    const gain = fameGain();
    if (gain <= 0) return;
    if (!confirm(`재투자하면 공장/자금이 초기화되지만,\n명성 +${gain} 을 영구히 얻어\n판매가가 ×${(1 + (state.fame + gain) * 0.02).toFixed(2)} 로 늘어납니다.\n(💎 잼, 퀘스트, 상점 업그레이드는 유지)\n\n진행할까요?`)) return;
    state.fame += gain;
    state.lifetime = 0;
    state.money = 4;
    state.lines = freshLines();
    state.stats.prestiges += 1;
    toast(`♻️ 재투자 완료! 명성 +${gain}`, 'gold');
    saveGame();
    renderAll();
  }

  // ---------- 💎 상점 구매 ----------
  function buyShopItem(id) {
    const item = SHOP.find(s => s.id === id);
    if (!item || !questUnlockedShopItem(id)) return;
    const cost = shopCost(item);
    if (cost === null || state.gems < cost) return;

    if (item.consumable) {
      state.gems -= cost;
      const earned = runWarp(2 * 3600); // 2시간
      toast(`⏩ 타임 워프! ${fmt(earned)} 획득`, 'gem');
    } else {
      state.gems -= cost;
      state.upgrades[id] += 1;
      toast(`${item.icon} ${item.name} Lv.${state.upgrades[id]} 구매!`, 'gem');
    }
    saveGame();
    renderAll();
  }

  // 매니저 있는 라인의 생산+판매를 elapsed초만큼 즉시 진행. 번 돈을 반환.
  function runWarp(elapsed) {
    let earned = 0;
    for (const line of state.lines) {
      if (line.count <= 0) continue;
      const d = def(line.id);
      if (line.hasManager) {
        line.inventory += (elapsed / cycleTime(d)) * itemsPerCycle(line);
      }
      const sold = Math.min(line.inventory, sellRate(line) * elapsed);
      line.inventory -= sold;
      const gain = sold * itemPrice(line);
      earned += gain;
    }
    state.money += earned;
    state.lifetime += earned;
    state.stats.totalSold += earned;
    return earned;
  }

  // ---------- 🚛 긴급 대량 주문 이벤트 ----------
  // 랜덤 주기로 재고가 쌓인 라인에 프리미엄 가격 주문이 옴 (수락 시 재고 전량 판매)
  let activeOrder = null; // { lineId, mult, expires }
  let nextOrderAt = Date.now() + 60000 + Math.random() * 60000;

  function updateOrders(now) {
    if (activeOrder && now >= activeOrder.expires) {
      activeOrder = null;
      nextOrderAt = now + 60000 + Math.random() * 90000;
      renderOrderBanner();
      return;
    }
    if (!activeOrder && now >= nextOrderAt) {
      // 재고가 10초 판매 분량 이상 쌓인 라인 중 하나를 랜덤 선택
      const candidates = state.lines.filter(l =>
        l.count > 0 && l.inventory > Math.max(10, sellRate(l) * 10));
      if (candidates.length === 0) {
        nextOrderAt = now + 30000; // 나중에 재시도
        return;
      }
      const line = candidates[Math.floor(Math.random() * candidates.length)];
      activeOrder = {
        lineId: line.id,
        mult: Math.round((1.5 + Math.random()) * 10) / 10, // ×1.5 ~ ×2.5
        expires: now + 20000,
      };
      toast('🚛 긴급 대량 주문이 도착했어요!', 'gold');
      renderOrderBanner();
    }
  }

  function acceptOrder() {
    if (!activeOrder) return;
    const line = ls(activeOrder.lineId);
    const qty = line.inventory;
    if (qty <= 0) { activeOrder = null; renderOrderBanner(); return; }
    const gain = qty * itemPrice(line) * activeOrder.mult;
    line.inventory = 0;
    state.money += gain;
    state.lifetime += gain;
    state.stats.totalSold += gain;
    incomeAcc += gain;
    toast(`🚛 ${def(line.id).name} ${fmtNum(qty)}개 일괄 판매! +${fmt(gain)}`, 'gold');
    activeOrder = null;
    nextOrderAt = Date.now() + 90000 + Math.random() * 90000;
    renderOrderBanner();
    updateLineDOM(line.id);
    refreshHeader();
  }

  function renderOrderBanner() {
    const el = document.getElementById('order-banner');
    if (!activeOrder) { el.classList.add('hidden'); el.innerHTML = ''; return; }
    const line = ls(activeOrder.lineId);
    const d = def(line.id);
    const remain = Math.max(0, Math.ceil((activeOrder.expires - Date.now()) / 1000));
    const estimate = line.inventory * itemPrice(line) * activeOrder.mult;
    el.innerHTML = `
      <div>
        <div class="order-title">🚛 긴급 대량 주문!</div>
        <div class="order-desc">${d.icon} <b>${d.name}</b> 재고 전량(${fmtNum(line.inventory)}개)을
          개당 <b>×${activeOrder.mult}</b> 가격에 매입 희망 → 약 <b>${fmt(estimate)}</b></div>
        <div class="order-timer">⏱️ ${remain}초 후 주문 취소</div>
      </div>
      <button class="order-accept-btn" data-accept-order="1">판매하기</button>
    `;
    el.classList.remove('hidden');
  }

  // ---------- 퀘스트 수령 ----------
  function claimQuest(id) {
    const q = QUESTS.find(q => q.id === id);
    if (!q || state.claimed[id] || !questDone(q)) return;
    state.claimed[id] = true;
    state.gems += q.gems;
    toast(`📜 퀘스트 "${q.name}" 완료! 💎 +${q.gems}`, 'gem');
    if (q.unlocks) {
      const item = SHOP.find(s => s.id === q.unlocks);
      if (item) toast(`🔓 상점에 "${item.name}" 해금!`, 'gem');
    }
    saveGame();
    renderQuests();
    renderShop();
    refreshHeader();
  }

  // =========================================================
  //  메인 루프
  // =========================================================
  let lastFrame = performance.now();
  let incomeAcc = 0;        // 최근 1초간 번 돈
  let incomePerSec = 0;     // 표시용 ₩/초

  function tick(now) {
    const dt = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;

    for (const line of state.lines) {
      if (line.count <= 0) continue;
      const d = def(line.id);

      // 생산 진행
      if (line.running) {
        line.progress += dt / cycleTime(d);
        while (line.progress >= 1) {
          line.progress -= 1;
          completeCycle(line);
          if (!line.running) break;
        }
        updateProgressDOM(line.id);
      }

      // 🛒 판매 (재고가 있으면 구매자가 자동으로 사감)
      if (line.inventory > 0) {
        const sold = Math.min(line.inventory, sellRate(line) * dt);
        line.inventory -= sold;
        const gain = sold * itemPrice(line);
        state.money += gain;
        state.lifetime += gain;
        state.stats.totalSold += gain;
        incomeAcc += gain;
      }
    }

    state.lastTick = Date.now();
    requestAnimationFrame(tick);
  }

  // ---------- 오프라인 수익 ----------
  function applyOffline() {
    const now = Date.now();
    const cap = (8 + state.upgrades.offline * 2) * 3600;
    const elapsed = Math.min((now - state.lastTick) / 1000, cap);
    if (elapsed < 5) return;
    const earned = runWarp(elapsed);
    if (earned <= 0) return;
    showOfflineModal(earned, elapsed);
  }

  // =========================================================
  //  렌더링
  // =========================================================
  const linesEl = document.getElementById('lines');
  const moneyEl = document.getElementById('money');
  const perSecEl = document.getElementById('per-second');
  const gemsEl = document.getElementById('gems');
  const prestigeBonusEl = document.getElementById('prestige-bonus');
  const prestigeGainEl = document.getElementById('prestige-gain');
  const prestigeBtn = document.getElementById('prestige-btn');
  const questBadgeEl = document.getElementById('quest-badge');

  function renderAll() {
    linesEl.innerHTML = '';
    state.lines.forEach(line => linesEl.appendChild(buildLineEl(line)));
    state.lines.forEach(l => updateLineDOM(l.id));
    renderQuests();
    renderShop();
    refreshHeader();
  }

  function buildLineEl(line) {
    const d = def(line.id);
    const el = document.createElement('div');
    el.className = 'line';
    el.id = 'line-' + line.id;
    el.innerHTML = `
      <div class="line-icon-wrap" data-click="${line.id}" title="클릭하면 한 사이클 생산">
        <span class="ico">${d.icon}</span>
        <span class="count-badge">0대</span>
      </div>
      <div class="line-mid">
        <div class="line-name">
          <span>${d.name}</span>
          <span class="mult-tag">×1</span>
        </div>
        <div class="line-sub"></div>
        <div class="line-inv"></div>
        <div class="progress-track">
          <div class="progress-fill"></div>
          <div class="progress-label"></div>
          <span class="worker">👷</span>
        </div>
        <div class="delivery-track">
          <span class="deliver-hint"></span>
          <span class="truck">🚚</span>
        </div>
      </div>
      <div class="line-actions">
        <button class="buy-btn" data-buy="${line.id}">
          <div class="bt-top">⚙️ 설비 <span class="bt-amt"></span></div>
          <div class="bt-cost"></div>
        </button>
        <button class="buyer-btn" data-buyer="${line.id}"></button>
        <button class="quality-btn" data-quality="${line.id}"></button>
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

    el.querySelector('.count-badge').textContent = fmtNum(line.count) + '대';
    el.querySelector('.mult-tag').textContent = '×' + fmtNum(milestoneMult(line.count));

    // 생산 정보
    const sub = el.querySelector('.line-sub');
    const nm = nextMilestone(line.count);
    if (line.count > 0) {
      sub.innerHTML = `설비 <b>${fmtNum(line.count)}대</b> → 사이클(${cycleTime(d).toFixed(1)}s)당 ${d.item} <b>${fmtNum(itemsPerCycle(line))}개</b> 생산${nm ? ` · ⭐${nm}대에 ×2` : ''}`;
    } else {
      sub.innerHTML = unlocked ? `설비를 구매하면 ${d.item} 생산 시작 · 사이클 ${cycleTime(d).toFixed(1)}s` : '🔒 이전 라인 설비를 먼저 보유하세요';
    }

    // 재고/판매 정보
    const inv = el.querySelector('.line-inv');
    if (line.count > 0) {
      inv.innerHTML = `📦 재고 <b>${fmtNum(line.inventory)}개</b> · 개당 ${fmt(itemPrice(line))} · <span class="sell-info">🛒 초당 ${fmtNum(sellRate(line))}개 판매 (Lv.${line.buyerLv})</span>`;
    } else {
      inv.innerHTML = '';
    }

    // 아이콘 스핀 (매니저 자동 생산 중일 때, 이모지만 회전)
    el.querySelector('.line-icon-wrap').classList.toggle('spinning', line.running && line.hasManager);

    // 설비 구매 버튼
    const n = amountToBuy(line);
    const cost = costFor(line, n);
    const buyBtn = el.querySelector('.buy-btn');
    buyBtn.querySelector('.bt-amt').textContent = `×${n}`;
    buyBtn.querySelector('.bt-cost').textContent = fmt(cost);
    const canBuy = unlocked && state.money >= cost && n > 0;
    buyBtn.classList.toggle('can-buy', canBuy);
    buyBtn.disabled = !canBuy;
    el.classList.toggle('affordable-glow', canBuy && line.count === 0);

    // 구매자 버튼
    const buyerBtn = el.querySelector('.buyer-btn');
    if (line.count > 0) {
      const bc = buyerCost(line);
      buyerBtn.innerHTML = `🛒 구매자 Lv.${line.buyerLv + 1} · ${fmt(bc)}`;
      buyerBtn.disabled = state.money < bc;
    } else {
      buyerBtn.innerHTML = '🛒 구매자';
      buyerBtn.disabled = true;
    }

    // 품질 버튼
    const qBtn = el.querySelector('.quality-btn');
    if (line.count > 0) {
      const qc = qualityCost(line);
      qBtn.innerHTML = `💠 품질 Lv.${line.qualityLv + 1} · ${fmt(qc)}`;
      qBtn.disabled = state.money < qc;
    } else {
      qBtn.innerHTML = '💠 품질';
      qBtn.disabled = true;
    }

    // 🚚 배송 트랙: 재고가 팔리는 중이면 트럭이 달림
    const dt = el.querySelector('.delivery-track');
    const delivering = line.count > 0 && line.inventory > 0.5;
    dt.classList.toggle('delivering', delivering);
    dt.querySelector('.deliver-hint').textContent =
      line.count === 0 ? '' : (delivering ? `배송 중 · ${fmt(sellRate(line) * itemPrice(line))}/초` : '재고 대기 중');

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
    const pct = (line.progress * 100).toFixed(1);
    el.querySelector('.progress-fill').style.width = pct + '%';

    // 👷 노동자가 진행바 끝을 따라 이동
    const worker = el.querySelector('.worker');
    if (line.count > 0) {
      worker.style.display = '';
      worker.style.left = pct + '%';
      worker.classList.toggle('working', line.running);
    } else {
      worker.style.display = 'none';
    }

    const label = el.querySelector('.progress-label');
    if (line.count === 0) {
      label.textContent = '';
    } else if (line.running) {
      label.textContent = (cycleTime(def(id)) * (1 - line.progress)).toFixed(1) + 's';
    } else {
      label.textContent = '클릭하여 생산 ▶';
    }
  }

  function refreshHeader() {
    moneyEl.textContent = fmt(state.money);
    perSecEl.textContent = fmt(incomePerSec) + '/초';
    gemsEl.textContent = '💎 ' + state.gems;
    prestigeBonusEl.textContent = '×' + fameMult().toFixed(2);
    const gain = fameGain();
    prestigeGainEl.textContent = '+' + gain;
    prestigeBtn.disabled = gain <= 0;

    const cc = claimableCount();
    questBadgeEl.textContent = cc;
    questBadgeEl.classList.toggle('hidden', cc === 0);
  }

  // ---------- 퀘스트 렌더 ----------
  const questListEl = document.getElementById('quest-list');
  function renderQuests() {
    questListEl.innerHTML = '';
    const sorted = [...QUESTS].sort((a, b) => {
      const rank = q => state.claimed[q.id] ? 2 : (questDone(q) ? 0 : 1);
      return rank(a) - rank(b);
    });
    for (const q of sorted) {
      const claimed = !!state.claimed[q.id];
      const done = questDone(q);
      const [cur, goal] = q.prog();
      const pct = Math.min(100, (cur / goal) * 100);
      const el = document.createElement('div');
      el.className = 'quest' + (claimed ? ' claimed' : (done ? ' done-claimable' : ''));
      el.innerHTML = `
        <div>
          <div class="quest-name">
            <span>${claimed ? '✅' : (done ? '🎉' : '📜')} ${q.name}</span>
            ${q.unlocks ? `<span class="quest-unlock-tag">🔓 ${SHOP.find(s => s.id === q.unlocks).name} 해금</span>` : ''}
          </div>
          <div class="quest-desc">${q.desc}</div>
          ${!claimed ? `
          <div class="quest-progress-track"><div class="quest-progress-fill" style="width:${pct}%"></div></div>
          <div class="quest-progress-text">${fmtNum(Math.min(cur, goal))} / ${fmtNum(goal)}</div>` : ''}
        </div>
        <div class="quest-right">
          <span class="quest-reward">💎 ${q.gems}</span>
          ${claimed ? '<span class="claimed-tag">수령 완료</span>'
            : (done ? `<button class="claim-btn" data-claim="${q.id}">보상 받기</button>` : '')}
        </div>
      `;
      questListEl.appendChild(el);
    }
  }

  // ---------- 상점 렌더 ----------
  const shopListEl = document.getElementById('shop-list');
  function renderShop() {
    shopListEl.innerHTML = '';
    for (const item of SHOP) {
      const unlocked = questUnlockedShopItem(item.id);
      const lv = item.consumable ? null : state.upgrades[item.id];
      const cost = shopCost(item);
      const maxed = !item.consumable && lv >= item.max;
      const lockQuest = QUESTS.find(q => q.unlocks === item.id);

      const el = document.createElement('div');
      el.className = 'shop-item' + (unlocked ? '' : ' locked-item');
      el.innerHTML = `
        <div class="shop-icon">${unlocked ? item.icon : '🔒'}</div>
        <div>
          <div class="shop-name">
            <span>${item.name}</span>
            ${!item.consumable ? `<span class="shop-level">Lv.${lv}/${item.max}</span>` : '<span class="shop-level">소모성</span>'}
          </div>
          <div class="shop-desc">
            ${item.desc}
            ${!unlocked && lockQuest ? `<br><span class="lock-req">🔒 퀘스트 "${lockQuest.name}" (${lockQuest.desc}) 달성 시 해금</span>` : ''}
          </div>
          ${unlocked && !item.consumable && lv > 0 ? `<div class="shop-effect">${item.effect(lv)}</div>` : ''}
        </div>
        ${maxed ? '<span class="shop-maxed">MAX</span>'
          : `<button class="shop-buy-btn" data-shop="${item.id}" ${(!unlocked || state.gems < cost) ? 'disabled' : ''}>💎 ${cost}</button>`}
      `;
      shopListEl.appendChild(el);
    }
  }

  // ---------- 이펙트 ----------
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

  const toastsEl = document.getElementById('toasts');
  function toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    toastsEl.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function showOfflineModal(earned, elapsed) {
    document.getElementById('offline-amount').textContent = fmt(earned);
    document.getElementById('offline-time').textContent = `자리 비운 시간: ${fmtTime(elapsed)}`;
    document.getElementById('offline-modal').classList.remove('hidden');
  }

  // 퀘스트 달성 감지 → 토스트 알림 (탭 배지 갱신은 refreshHeader에서)
  const notifiedQuests = new Set();
  function checkQuestNotify() {
    for (const q of QUESTS) {
      if (!state.claimed[q.id] && !notifiedQuests.has(q.id) && questDone(q)) {
        notifiedQuests.add(q.id);
        toast(`📜 퀘스트 달성! "${q.name}" — 퀘스트 탭에서 💎 받기`, 'gem');
      }
    }
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
    state = freshState();
    try {
      let raw = localStorage.getItem(SAVE_KEY);
      let isOld = false;
      if (!raw) {
        raw = localStorage.getItem(OLD_SAVE_KEY); // v1 세이브 이어받기
        isOld = !!raw;
      }
      if (!raw) return;
      const saved = JSON.parse(raw);
      state.money = saved.money ?? state.money;
      state.gems = saved.gems ?? 0;
      state.lifetime = saved.lifetime ?? 0;
      state.fame = saved.fame ?? 0;
      state.buyMode = saved.buyMode ?? 1;
      state.lastTick = saved.lastTick ?? Date.now();
      if (saved.upgrades) Object.assign(state.upgrades, saved.upgrades);
      if (saved.claimed) state.claimed = saved.claimed;
      if (saved.stats) Object.assign(state.stats, saved.stats);
      if (Array.isArray(saved.lines)) {
        for (const sl of saved.lines) {
          const line = ls(sl.id);
          if (!line) continue;
          line.count = sl.count ?? 0;
          line.hasManager = !!sl.hasManager;
          line.inventory = sl.inventory ?? 0;
          line.buyerLv = sl.buyerLv ?? 1;
          line.qualityLv = sl.qualityLv ?? 0;
          line.running = line.hasManager && line.count > 0;
          line.progress = 0;
        }
      }
      if (isOld) {
        localStorage.removeItem(OLD_SAVE_KEY);
        toast('🔄 기존 세이브를 이어받았어요! 새 기능: 재고·구매자·퀘스트·💎', 'good');
      }
      // 이미 달성돼 있던 퀘스트는 재알림 방지
      for (const q of QUESTS) if (questDone(q)) notifiedQuests.add(q.id);
    } catch (e) {
      state = freshState();
    }
  }

  function resetGame() {
    if (!confirm('정말 모든 진행을 삭제하고 처음부터 시작할까요?\n(명성·💎 잼·퀘스트도 모두 사라집니다)')) return;
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(OLD_SAVE_KEY);
    state = freshState();
    notifiedQuests.clear();
    renderAll();
    toast('🗑️ 초기화 완료');
  }

  // =========================================================
  //  이벤트 바인딩
  // =========================================================
  function bindEvents() {
    linesEl.addEventListener('click', (e) => {
      const buy = e.target.closest('[data-buy]');
      if (buy) { buyLine(buy.dataset.buy); return; }
      const buyer = e.target.closest('[data-buyer]');
      if (buyer) { upgradeBuyer(buyer.dataset.buyer); return; }
      const quality = e.target.closest('[data-quality]');
      if (quality) { upgradeQuality(quality.dataset.quality); return; }
      const mgr = e.target.closest('[data-mgr]');
      if (mgr) { hireManager(mgr.dataset.mgr); return; }
      const clickable = e.target.closest('[data-click]');
      if (clickable) { clickLine(clickable.dataset.click); return; }
    });

    document.getElementById('quest-list').addEventListener('click', (e) => {
      const claim = e.target.closest('[data-claim]');
      if (claim) claimQuest(claim.dataset.claim);
    });

    document.getElementById('shop-list').addEventListener('click', (e) => {
      const buy = e.target.closest('[data-shop]');
      if (buy) buyShopItem(buy.dataset.shop);
    });

    document.getElementById('order-banner').addEventListener('click', (e) => {
      if (e.target.closest('[data-accept-order]')) acceptOrder();
    });

    // 탭 전환
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelector('.tab-btn.active')?.classList.remove('active');
        btn.classList.add('active');
        for (const page of document.querySelectorAll('.tab-page')) {
          page.classList.toggle('hidden', page.id !== 'tab-' + btn.dataset.tab);
        }
        if (btn.dataset.tab === 'quests') renderQuests();
        if (btn.dataset.tab === 'shop') renderShop();
      });
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

    // 1초 주기: 수익/초 계산, 라인 갱신, 퀘스트/주문 체크
    setInterval(() => {
      incomePerSec = incomeAcc;
      incomeAcc = 0;
      state.lines.forEach(l => updateLineDOM(l.id));
      checkQuestNotify();
      updateOrders(Date.now());
      if (activeOrder) renderOrderBanner(); // 남은 시간 갱신
      refreshHeader();
    }, 1000);

    setInterval(saveGame, 15000);
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
