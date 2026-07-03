/* =========================================================
   🏭 방치형 공장 타이쿤  —  Idle Factory Tycoon  v5
   🌍 자연(랜덤 채집) → 🎒 가방 → 🔧 파트 → 🏗️ 조립 → 🛒 판매
   🔬 연구 트리 / 📜 퀘스트 / 💎 잼 상점
   ========================================================= */

(() => {
  'use strict';

  const SAVE_KEY = 'factory_tycoon_save_v4';
  const OLD_V3_KEY = 'factory_tycoon_save_v3';

  // =========================================================
  //  원자재 (🎒 가방에 쌓임)
  // =========================================================
  const MATERIAL_DEFS = [
    { id: 'iron',     name: '철광석', icon: '🪨', price: 1 },
    { id: 'coal',     name: '석탄',   icon: '⚫', price: 2 },
    { id: 'copper',   name: '구리',   icon: '🟠', price: 4 },
    { id: 'graphite', name: '흑연',   icon: '✏️', price: 6 },
    { id: 'gold',     name: '금',     icon: '🪙', price: 25 },
    { id: 'wood',     name: '목재',   icon: '🪵', price: 2 },
    { id: 'stone',    name: '돌',     icon: '🗿', price: 1.5 },
    { id: 'rubber',   name: '고무',   icon: '🛞', price: 5 },
    { id: 'sand',     name: '모래',   icon: '🏖️', price: 2 },
    { id: 'salt',     name: '소금',   icon: '🧂', price: 3 },
    { id: 'pearl',    name: '진주',   icon: '🦪', price: 40 },
  ];
  function mdef(id) { return MATERIAL_DEFS.find(m => m.id === id); }
  function isMaterial(id) { return !!mdef(id); }

  // =========================================================
  //  생산 라인 정의
  //  cat: zone(자연·랜덤 채집) / part(파트) / asm(조립)
  //  zone: yields 확률표 → 🎒 가방으로
  //  part/asm: inputs { 재료id 또는 라인id: 개수/생산품1개 }
  // =========================================================
  const LINE_DEFS = [
    // 🌍 자연 — 랜덤 채집 (구매자/품질 없음, 산출물은 가방으로)
    { id: 'mine',   cat: 'zone', name: '광산',       icon: '⛰️', research: null,       baseCost: 4,    costMul: 1.07, time: 0.8, mgrCost: 800,
      yields: [ { m: 'iron', p: 0.55 }, { m: 'coal', p: 0.20 }, { m: 'copper', p: 0.15 }, { m: 'graphite', p: 0.07 }, { m: 'gold', p: 0.03 } ] },
    { id: 'forest', cat: 'zone', name: '숲',         icon: '🌲', research: 'forestry', baseCost: 600,  costMul: 1.08, time: 1.2, mgrCost: 6e4,
      yields: [ { m: 'wood', p: 0.60 }, { m: 'stone', p: 0.30 }, { m: 'rubber', p: 0.10 } ] },
    { id: 'sea',    cat: 'zone', name: '바다',       icon: '🌊', research: 'marine',   baseCost: 5000, costMul: 1.08, time: 1.5, mgrCost: 5e5,
      yields: [ { m: 'sand', p: 0.65 }, { m: 'salt', p: 0.25 }, { m: 'pearl', p: 0.10 } ] },
    // 🔧 파트
    { id: 'screw',     cat: 'part', name: '나사 공장',     item: '나사',   icon: '🔩', inputs: { iron: 1 },                          research: null,       baseCost: 60,   costMul: 1.08, price: 5,    time: 1.2, mgrCost: 5e3 },
    { id: 'gear',      cat: 'part', name: '기어 제작소',   item: '기어',   icon: '⚙️', inputs: { iron: 3, coal: 1 },                 research: 'mech',     baseCost: 800,  costMul: 1.09, price: 25,   time: 3,   mgrCost: 8e4 },
    { id: 'furniture', cat: 'part', name: '가구 공방',     item: '가구',   icon: '🪑', inputs: { wood: 4, stone: 1 },                research: 'forestry', baseCost: 1200, costMul: 1.09, price: 30,   time: 4,   mgrCost: 1e5 },
    { id: 'chip',      cat: 'part', name: 'CPU 공장',      item: 'CPU',    icon: '💾', inputs: { sand: 2, copper: 1, graphite: 1 },  research: 'elec',     baseCost: 2e4,  costMul: 1.10, price: 60,   time: 6,   mgrCost: 2e6 },
    { id: 'battery',   cat: 'part', name: '배터리 공장',   item: '배터리', icon: '🔋', inputs: { copper: 3, graphite: 2 },           research: 'chem',     baseCost: 8e4,  costMul: 1.10, price: 80,   time: 8,   mgrCost: 8e6 },
    { id: 'code',      cat: 'part', name: '소프트웨어 랩', item: '코드',   icon: '💻', inputs: {},                                   research: 'sw',       baseCost: 3e5,  costMul: 1.11, price: 150,  time: 10,  mgrCost: 3e7 },
    // 🏗️ 조립
    { id: 'arm',    cat: 'asm', name: '로봇팔 조립',   item: '로봇팔', icon: '🦾', inputs: { screw: 5, gear: 3, chip: 1 },                          research: 'robotics', baseCost: 2e6, costMul: 1.12, price: 500,   time: 20,  mgrCost: 2e8 },
    { id: 'drone',  cat: 'asm', name: '드론 생산라인', item: '드론',   icon: '🚁', inputs: { screw: 3, battery: 2, chip: 2, code: 1, rubber: 2 },   research: 'aero',     baseCost: 1e7, costMul: 1.12, price: 1400,  time: 30,  mgrCost: 1e9 },
    { id: 'car',    cat: 'asm', name: '전기차 공장',   item: '전기차', icon: '🚗', inputs: { gear: 20, battery: 10, chip: 4, code: 2, rubber: 8 },  research: 'auto',     baseCost: 8e7, costMul: 1.13, price: 6000,  time: 60,  mgrCost: 8e9 },
    { id: 'rocket', cat: 'asm', name: '로켓 제조소',   item: '로켓',   icon: '🚀', inputs: { gear: 100, battery: 50, chip: 30, code: 20, gold: 10 }, research: 'space',    baseCost: 1e9, costMul: 1.14, price: 40000, time: 150, mgrCost: 5e10 },
  ];

  const CATS = [
    { id: 'zone', label: '🌍 자연 (랜덤 채집)' },
    { id: 'part', label: '🔧 파트' },
    { id: 'asm',  label: '🏗️ 조립' },
  ];

  // =========================================================
  //  🔬 연구 트리
  // =========================================================
  const RESEARCH_DEFS = [
    { id: 'mech',     name: '기계공학',   icon: '⚙️', cost: 3e3,   duration: 30,   needs: [],                   unlocksLines: ['gear'],                desc: '석탄 제련로로 정밀 기어 가공' },
    { id: 'forestry', name: '임업',       icon: '🌲', cost: 1e4,   duration: 45,   needs: ['mech'],             unlocksLines: ['forest', 'furniture'], desc: '숲에서 목재·돌·고무 채집' },
    { id: 'marine',   name: '해양학',     icon: '🌊', cost: 8e4,   duration: 90,   needs: ['mech'],             unlocksLines: ['sea'],                 desc: '바다에서 모래·소금·진주 채취' },
    { id: 'elec',     name: '전자공학',   icon: '💾', cost: 5e5,   duration: 120,  needs: ['marine'],           unlocksLines: ['chip'],                desc: '모래(실리콘)·구리·흑연으로 CPU 제조' },
    { id: 'chem',     name: '전기화학',   icon: '🔋', cost: 2e6,   duration: 180,  needs: ['elec'],             unlocksLines: ['battery'],             desc: '구리·흑연 기반 배터리 셀' },
    { id: 'sw',       name: '소프트웨어', icon: '💻', cost: 8e6,   duration: 300,  needs: ['elec'],             unlocksLines: ['code'],                desc: '재료 없이 가치를 만드는 코드' },
    { id: 'robotics', name: '로보틱스',   icon: '🦾', cost: 4e7,   duration: 480,  needs: ['elec', 'mech'],     unlocksLines: ['arm'],                 desc: '나사+기어+CPU로 로봇팔 조립' },
    { id: 'aero',     name: '항공역학',   icon: '🚁', cost: 2e8,   duration: 600,  needs: ['robotics', 'chem'], unlocksLines: ['drone'],               desc: '배터리 동력 비행체' },
    { id: 'auto',     name: '자동차공학', icon: '🚗', cost: 2e9,   duration: 900,  needs: ['aero', 'sw'],       unlocksLines: ['car'],                 desc: '전기차 대량 생산 체계' },
    { id: 'space',    name: '항공우주',   icon: '🚀', cost: 3e10,  duration: 1200, needs: ['auto'],             unlocksLines: ['rocket'],              desc: '인류를 우주로 (금 도금 회로!)' },
  ];

  const MILESTONES = [25, 50, 100, 150, 200, 300, 400, 500, 750, 1000];

  // ---------- 상태 ----------
  let state;

  function freshLines() {
    return LINE_DEFS.map(d => ({
      id: d.id,
      count: (d.id === 'mine' || d.id === 'screw') ? 1 : 0, // 광산+나사 공장으로 시작
      progress: 0,
      running: false,
      starved: false,
      hasManager: false,
      inventory: 0,
      buyerLv: 1,
      qualityLv: 0,
      selling: true,
    }));
  }

  function freshState() {
    return {
      money: 10,
      gems: 0,
      lifetime: 0,
      fame: 0,
      buyMode: 1,
      lastTick: Date.now(),
      materials: {},             // 🎒 { materialId: qty }
      upgrades: { speed: 0, sell: 0, offline: 0, brand: 0, lab: 0 },
      researched: {},
      activeResearch: null,
      claimed: {},
      stats: { totalSold: 0, prestiges: 0 },
      lines: freshLines(),
    };
  }

  function def(id) { return LINE_DEFS.find(d => d.id === id); }
  function ls(id) { return state.lines.find(l => l.id === id); }
  function rdef(id) { return RESEARCH_DEFS.find(r => r.id === id); }
  function isZone(d) { return d.cat === 'zone'; }

  // 재고 조회/차감 (재료면 가방, 아니면 라인 재고)
  function getStock(id) {
    return isMaterial(id) ? (state.materials[id] || 0) : ls(id).inventory;
  }
  function subStock(id, amt) {
    if (isMaterial(id)) state.materials[id] = (state.materials[id] || 0) - amt;
    else ls(id).inventory -= amt;
  }
  function stockName(id) { return isMaterial(id) ? mdef(id).name : def(id).item; }
  function stockIcon(id) { return isMaterial(id) ? mdef(id).icon : def(id).icon; }

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
  function fameMult() { return 1 + state.fame * 0.02; }
  function priceBoost() { return (1 + 0.2 * state.upgrades.brand) * fameMult(); }
  function cycleTime(d) { return d.time * Math.pow(0.9, state.upgrades.speed); }
  function itemsPerCycle(line) { return line.count * milestoneMult(line.count); }
  function itemPrice(line) {
    return def(line.id).price * Math.pow(1.25, line.qualityLv) * priceBoost();
  }
  function materialPrice(mid) { return mdef(mid).price * priceBoost(); }
  function qualityCost(line) {
    return def(line.id).baseCost * 25 * Math.pow(3.2, line.qualityLv);
  }
  function sellRate(line) {
    const d = def(line.id);
    return (3 / d.time) * Math.pow(1.7, line.buyerLv - 1) * (1 + 0.25 * state.upgrades.sell);
  }
  function buyerCost(line) {
    return def(line.id).baseCost * 12 * Math.pow(2.3, line.buyerLv - 1);
  }
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
  function lineResearched(d) { return !d.research || !!state.researched[d.research]; }
  function managerCount() { return state.lines.filter(l => l.hasManager).length; }
  function buyerLvSum() { return state.lines.reduce((s, l) => s + (l.count > 0 && !isZone(def(l.id)) ? l.buyerLv : 0), 0); }
  function qualityLvSum() { return state.lines.reduce((s, l) => s + l.qualityLv, 0); }
  function researchedCount() { return Object.keys(state.researched).length; }
  function researchSpeed() { return 1 + 0.25 * state.upgrades.lab; }

  // ---------- 숫자 포맷 ----------
  const UNITS = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag'];
  function fmtNum(n) {
    if (n < 1000) return Math.floor(n).toString();
    let u = 0;
    while (n >= 1000 && u < UNITS.length - 1) { n /= 1000; u++; }
    return n.toFixed(n < 100 ? 2 : 1) + UNITS[u];
  }
  // 소수점이 의미 있는 값(판매 속도 등) — "0개" 버그 수정
  function fmtQty(n) {
    if (n >= 100) return fmtNum(n);
    if (n >= 10) return (Math.round(n * 10) / 10).toString();
    return (Math.round(n * 100) / 100).toString();
  }
  function fmt(n) { return '₩' + fmtNum(n); }
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    if (m > 0) return `${m}분 ${s}초`;
    return `${s}초`;
  }

  // =========================================================
  //  📜 퀘스트
  // =========================================================
  const QUESTS = [
    { id: 'q_mine10',    name: '첫 곡괭이질',   desc: '광산 설비 10대 보유',            gems: 2,  prog: () => [ls('mine').count, 10] },
    { id: 'q_screw',     name: '제조업 진출',   desc: '나사 공장 설비 5대 보유',        gems: 2,  prog: () => [ls('screw').count, 5] },
    { id: 'q_rsch_mech', name: '유레카!',       desc: '기계공학 연구 완료',             gems: 3,  prog: () => [state.researched.mech ? 1 : 0, 1] },
    { id: 'q_mgr1',      name: '첫 채용',       desc: '매니저 1명 고용',                gems: 3,  prog: () => [managerCount(), 1] },
    { id: 'q_forestry',  name: '숲으로',        desc: '임업 연구 완료',                 gems: 3,  prog: () => [state.researched.forestry ? 1 : 0, 1] },
    { id: 'q_sold100k',  name: '장사 좀 되네',  desc: '누적 판매 수익 ₩100K 달성',      gems: 4,  prog: () => [state.stats.totalSold, 1e5] },
    { id: 'q_gold50',    name: '골드 러시',     desc: '금 50개 보유',                   gems: 5,  prog: () => [state.materials.gold || 0, 50] },
    { id: 'q_mine100',   name: '광산왕',        desc: '광산 설비 100대 보유',           gems: 5,  prog: () => [ls('mine').count, 100] },
    { id: 'q_mgr3',      name: '경영진 구성',   desc: '매니저 3명 고용',                gems: 5,  unlocks: 'speed', prog: () => [managerCount(), 3] },
    { id: 'q_buyer10',   name: '영업왕',        desc: '구매자 레벨 합계 10 달성',       gems: 5,  unlocks: 'sell',  prog: () => [buyerLvSum(), 10] },
    { id: 'q_quality5',  name: '품질 장인',     desc: '품질 레벨 합계 5 달성',          gems: 5,  unlocks: 'brand', prog: () => [qualityLvSum(), 5] },
    { id: 'q_pearl30',   name: '진주 사냥꾼',   desc: '진주 30개 보유',                 gems: 6,  prog: () => [state.materials.pearl || 0, 30] },
    { id: 'q_rsch_elec', name: '실리콘 밸리',   desc: '전자공학 연구 완료',             gems: 5,  unlocks: 'lab',   prog: () => [state.researched.elec ? 1 : 0, 1] },
    { id: 'q_chip',      name: '반도체 강국',   desc: 'CPU 공장 설비 1대 보유',         gems: 4,  prog: () => [ls('chip').count, 1] },
    { id: 'q_sold10m',   name: '중견기업',      desc: '누적 판매 수익 ₩10M 달성',       gems: 8,  prog: () => [state.stats.totalSold, 1e7] },
    { id: 'q_arm',       name: '자동화 시대',   desc: '로봇팔 조립 설비 1대 보유',      gems: 6,  prog: () => [ls('arm').count, 1] },
    { id: 'q_prestige',  name: '다시 태어나다', desc: '재투자 1회 달성',                gems: 10, unlocks: 'warp', prog: () => [state.stats.prestiges, 1] },
    { id: 'q_sold1b',    name: '대기업',        desc: '누적 판매 수익 ₩1B 달성',        gems: 12, prog: () => [state.stats.totalSold, 1e9] },
    { id: 'q_car',       name: '모빌리티 혁명', desc: '전기차 공장 설비 1대 보유',      gems: 10, prog: () => [ls('car').count, 1] },
    { id: 'q_rsch_all',  name: '기술 특이점',   desc: '모든 연구 완료',                 gems: 20, prog: () => [researchedCount(), RESEARCH_DEFS.length] },
    { id: 'q_rocket',    name: '우주 시대',     desc: '로켓 제조소 설비 1대 보유',      gems: 15, prog: () => [ls('rocket').count, 1] },
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
  //  💎 상점
  // =========================================================
  const SHOP = [
    { id: 'speed',   name: '고속 컨베이어',   icon: '⚡', max: 5,
      desc: '모든 라인의 사이클 시간 -10% (누적)',
      costs: [5, 10, 20, 35, 60],
      effect: lv => `현재: 사이클 시간 ×${Math.pow(0.9, lv).toFixed(2)}` },
    { id: 'sell',    name: '마케팅 캠페인',   icon: '📣', max: 5,
      desc: '모든 라인의 판매 속도 +25% (누적)',
      costs: [4, 8, 15, 25, 40],
      effect: lv => `현재: 판매 속도 +${lv * 25}%` },
    { id: 'brand',   name: '프리미엄 브랜드', icon: '🏅', max: 5,
      desc: '모든 생산품·원자재 판매가 +20% (누적)',
      costs: [5, 10, 18, 30, 50],
      effect: lv => `현재: 판매가 +${lv * 20}%` },
    { id: 'lab',     name: '연구소 확장',     icon: '🧪', max: 5,
      desc: '연구 속도 +25% (누적)',
      costs: [4, 8, 15, 25, 40],
      effect: lv => `현재: 연구 속도 +${lv * 25}%` },
    { id: 'offline', name: '야간 근무조',     icon: '🌙', max: 4,
      desc: '오프라인 수익 한도 +2시간',
      costs: [6, 12, 24, 48],
      effect: lv => `현재: 최대 ${8 + lv * 2}시간` },
    { id: 'warp',    name: '타임 워프',       icon: '⏩', max: Infinity, consumable: true,
      desc: '즉시 2시간만큼 자동 생산·판매·연구를 진행 (소모성)',
      costs: [8],
      effect: () => '' },
  ];

  function shopCost(item) {
    if (item.consumable) return item.costs[0];
    const lv = state.upgrades[item.id];
    return lv >= item.max ? null : item.costs[lv];
  }

  // =========================================================
  //  공급망
  // =========================================================
  function cycleNeeds(line) {
    const d = def(line.id);
    const out = itemsPerCycle(line);
    const needs = {};
    for (const [inId, qty] of Object.entries(d.inputs || {})) needs[inId] = qty * out;
    return needs;
  }

  function hasMaterials(line) {
    const needs = cycleNeeds(line);
    for (const [inId, amt] of Object.entries(needs)) {
      if (getStock(inId) < amt) return false;
    }
    return true;
  }

  function tryStartCycle(line) {
    if (line.count <= 0 || line.running) return false;
    if (!hasMaterials(line)) { line.starved = true; return false; }
    const needs = cycleNeeds(line);
    for (const [inId, amt] of Object.entries(needs)) subStock(inId, amt);
    line.starved = false;
    line.running = true;
    line.progress = 0;
    return true;
  }

  // 🌍 랜덤 채집: n개를 확률표에 따라 분배 (소량이면 개별 룰렛, 대량이면 기대값+지터)
  function rollYields(d, n) {
    const out = {};
    if (n <= 20) {
      for (let i = 0; i < n; i++) {
        let r = Math.random();
        for (const y of d.yields) {
          if (r < y.p) { out[y.m] = (out[y.m] || 0) + 1; break; }
          r -= y.p;
        }
      }
    } else {
      for (const y of d.yields) {
        const q = n * y.p * (0.7 + 0.6 * Math.random());
        if (q > 0) out[y.m] = q;
      }
    }
    return out;
  }

  // =========================================================
  //  액션
  // =========================================================
  function buyLine(id) {
    const line = ls(id);
    const d = def(id);
    if (!lineResearched(d)) return;
    const n = amountToBuy(line);
    if (n <= 0) return;
    const cost = costFor(line, n);
    if (state.money < cost) return;
    state.money -= cost;
    const before = line.count;
    line.count += n;
    const nm = nextMilestone(before);
    if (nm && line.count >= nm) toast(`⭐ ${d.name} 설비 ${nm}대 돌파! 생산량 ×2`, 'gold');
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
    tryStartCycle(line);
    toast(`👔 ${d.name} 매니저 고용! 자동 생산 시작`, 'good');
    updateLineDOM(id);
    refreshHeader();
  }

  function toggleSelling(id) {
    const line = ls(id);
    if (line.count <= 0 || isZone(def(id))) return;
    line.selling = !line.selling;
    toast(line.selling ? `🛒 ${def(id).name} 판매 재개` : `🚫 ${def(id).name} 판매 중지 (재고 비축)`, '');
    updateLineDOM(id);
  }

  function clickLine(id) {
    const line = ls(id);
    if (line.count <= 0 || line.running) return;
    if (!tryStartCycle(line)) {
      const needs = cycleNeeds(line);
      const lack = Object.entries(needs)
        .filter(([inId, amt]) => getStock(inId) < amt)
        .map(([inId, amt]) => `${stockName(inId)} ${fmtNum(amt)}개`).join(', ');
      toast(`❌ ${def(id).name} 재료 부족: ${lack}`, '');
    }
    updateLineDOM(id);
  }

  // 🎒 가방에서 원자재 전량 판매
  function sellMaterial(mid) {
    const qty = Math.floor(state.materials[mid] || 0);
    if (qty <= 0) return;
    const gain = qty * materialPrice(mid);
    state.materials[mid] -= qty;
    state.money += gain;
    state.lifetime += gain;
    state.stats.totalSold += gain;
    incomeAcc += gain;
    toast(`💰 ${mdef(mid).icon} ${mdef(mid).name} ${fmtNum(qty)}개 판매! +${fmt(gain)}`, 'good');
    renderBag();
    refreshHeader();
  }

  function completeCycle(line) {
    const d = def(line.id);
    const made = itemsPerCycle(line);
    if (isZone(d)) {
      const got = rollYields(d, made);
      const parts = [];
      for (const [mid, q] of Object.entries(got)) {
        state.materials[mid] = (state.materials[mid] || 0) + q;
        parts.push(`+${fmtNum(Math.max(1, q))}${mdef(mid).icon}`);
      }
      spawnFloat(line.id, parts.slice(0, 3).join(' '));
      renderBagSoon();
    } else {
      line.inventory += made;
      spawnFloat(line.id, `+${fmtNum(made)}개 📦`);
    }
    line.running = false;
    line.progress = 0;
    if (line.hasManager) tryStartCycle(line);
  }

  // ---------- 재투자 ----------
  function fameGain() {
    const base = 1e6;
    if (state.lifetime < base) return 0;
    return Math.floor(Math.sqrt(state.lifetime / base) * 5);
  }

  function doPrestige() {
    const gain = fameGain();
    if (gain <= 0) return;
    if (!confirm(`재투자하면 공장/자금/가방이 초기화되지만,\n명성 +${gain} 을 영구히 얻어\n판매가가 ×${(1 + (state.fame + gain) * 0.02).toFixed(2)} 로 늘어납니다.\n(💎 잼, 🔬 연구, 퀘스트, 상점 업그레이드는 유지)\n\n진행할까요?`)) return;
    state.fame += gain;
    state.lifetime = 0;
    state.money = 10;
    state.materials = {};
    state.lines = freshLines();
    state.stats.prestiges += 1;
    toast(`♻️ 재투자 완료! 명성 +${gain}`, 'gold');
    saveGame();
    renderAll();
  }

  // ---------- 🔬 연구 ----------
  function canStartResearch(r) {
    return !state.researched[r.id]
      && !state.activeResearch
      && r.needs.every(n => state.researched[n])
      && state.money >= r.cost;
  }

  function startResearch(id) {
    const r = rdef(id);
    if (!r || !canStartResearch(r)) return;
    state.money -= r.cost;
    state.activeResearch = { id, progress: 0 };
    toast(`🔬 "${r.name}" 연구 시작!`, 'good');
    saveGame();
    renderResearch();
    refreshHeader();
  }

  function finishResearch() {
    const r = rdef(state.activeResearch.id);
    state.researched[r.id] = true;
    state.activeResearch = null;
    toast(`🎓 "${r.name}" 연구 완료! ${r.unlocksLines.map(l => def(l).name).join(', ')} 해금`, 'gold');
    saveGame();
    renderAll();
  }

  function skipResearch() {
    if (!state.activeResearch) return;
    const SKIP_COST = 5;
    if (state.gems < SKIP_COST) return;
    state.gems -= SKIP_COST;
    finishResearch();
  }

  function progressResearch(dt) {
    if (!state.activeResearch) return;
    const r = rdef(state.activeResearch.id);
    state.activeResearch.progress += (dt * researchSpeed()) / r.duration;
    if (state.activeResearch.progress >= 1) finishResearch();
  }

  // ---------- 💎 상점 ----------
  function buyShopItem(id) {
    const item = SHOP.find(s => s.id === id);
    if (!item || !questUnlockedShopItem(id)) return;
    const cost = shopCost(item);
    if (cost === null || state.gems < cost) return;

    if (item.consumable) {
      state.gems -= cost;
      const earned = simulate(2 * 3600);
      toast(`⏩ 타임 워프! ${fmt(earned)} 획득`, 'gem');
    } else {
      state.gems -= cost;
      state.upgrades[id] += 1;
      toast(`${item.icon} ${item.name} Lv.${state.upgrades[id]} 구매!`, 'gem');
    }
    saveGame();
    renderAll();
  }

  // =========================================================
  //  연속 근사 시뮬레이션 (오프라인 / 타임 워프)
  // =========================================================
  function simulate(elapsed) {
    const STEPS = 100;
    const dt = elapsed / STEPS;
    let earned = 0;
    const ordered = [...state.lines].sort((a, b) =>
      CATS.findIndex(c => c.id === def(a.id).cat) - CATS.findIndex(c => c.id === def(b.id).cat));

    for (let s = 0; s < STEPS; s++) {
      for (const line of ordered) {
        const d = def(line.id);
        if (line.count <= 0 || !lineResearched(d)) continue;
        if (line.hasManager) {
          let want = (itemsPerCycle(line) / cycleTime(d)) * dt;
          for (const [inId, qty] of Object.entries(d.inputs || {})) {
            if (qty > 0) want = Math.min(want, getStock(inId) / qty);
          }
          if (want > 0) {
            for (const [inId, qty] of Object.entries(d.inputs || {})) subStock(inId, want * qty);
            if (isZone(d)) {
              for (const y of d.yields) state.materials[y.m] = (state.materials[y.m] || 0) + want * y.p;
            } else {
              line.inventory += want;
            }
          }
        }
        if (!isZone(d) && line.selling && line.inventory > 0) {
          const sold = Math.min(line.inventory, sellRate(line) * dt);
          line.inventory -= sold;
          earned += sold * itemPrice(line);
        }
      }
      progressResearch(dt);
    }
    state.money += earned;
    state.lifetime += earned;
    state.stats.totalSold += earned;
    return earned;
  }

  // =========================================================
  //  🚛 긴급 대량 주문 (파트/조립 라인만)
  // =========================================================
  let activeOrder = null;
  let nextOrderAt = Date.now() + 60000 + Math.random() * 60000;

  function updateOrders(now) {
    if (activeOrder && now >= activeOrder.expires) {
      activeOrder = null;
      nextOrderAt = now + 60000 + Math.random() * 90000;
      renderOrderBanner();
      return;
    }
    if (!activeOrder && now >= nextOrderAt) {
      const candidates = state.lines.filter(l =>
        !isZone(def(l.id)) && l.count > 0 && l.inventory > Math.max(10, sellRate(l) * 10));
      if (candidates.length === 0) { nextOrderAt = now + 30000; return; }
      const line = candidates[Math.floor(Math.random() * candidates.length)];
      activeOrder = {
        lineId: line.id,
        mult: Math.round((1.5 + Math.random()) * 10) / 10,
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
    toast(`🚛 ${def(line.id).item} ${fmtNum(qty)}개 일괄 판매! +${fmt(gain)}`, 'gold');
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
        <div class="order-desc">${d.icon} <b>${d.item}</b> 재고 전량(${fmtNum(line.inventory)}개)을
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
  let incomeAcc = 0;
  let incomePerSec = 0;

  function tick(now) {
    const dt = Math.min(0.25, (now - lastFrame) / 1000);
    lastFrame = now;

    for (const line of state.lines) {
      if (line.count <= 0) continue;
      const d = def(line.id);

      if (line.running) {
        line.progress += dt / cycleTime(d);
        if (line.progress >= 1) completeCycle(line);
        updateProgressDOM(line.id);
      } else if (line.hasManager && line.starved) {
        if (tryStartCycle(line)) updateLineDOM(line.id);
      }

      if (!isZone(d) && line.selling && line.inventory > 0) {
        const sold = Math.min(line.inventory, sellRate(line) * dt);
        line.inventory -= sold;
        const gain = sold * itemPrice(line);
        state.money += gain;
        state.lifetime += gain;
        state.stats.totalSold += gain;
        incomeAcc += gain;
      }
    }

    progressResearch(dt);

    state.lastTick = Date.now();
    requestAnimationFrame(tick);
  }

  // ---------- 오프라인 수익 ----------
  function applyOffline() {
    const now = Date.now();
    const cap = (8 + state.upgrades.offline * 2) * 3600;
    const elapsed = Math.min((now - state.lastTick) / 1000, cap);
    if (elapsed < 5) return;
    const earned = simulate(elapsed);
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
  const researchBadgeEl = document.getElementById('research-badge');
  const bagChipsEl = document.getElementById('bag-chips');

  function renderAll() {
    linesEl.innerHTML = '';
    for (const cat of CATS) {
      const header = document.createElement('div');
      header.className = 'cat-header';
      header.textContent = cat.label;
      linesEl.appendChild(header);
      for (const line of state.lines) {
        if (def(line.id).cat === cat.id) linesEl.appendChild(buildLineEl(line));
      }
    }
    state.lines.forEach(l => updateLineDOM(l.id));
    renderBag();
    renderResearch();
    renderQuests();
    renderShop();
    renderOrderBanner();
    refreshHeader();
  }

  // ---------- 🎒 가방 ----------
  let bagDirty = false;
  function renderBagSoon() { bagDirty = true; } // 1초 주기에서 갱신

  function renderBag() {
    bagDirty = false;
    // 해금된 자연 구역의 재료 + 보유 중인 재료 표시
    const visible = new Set();
    for (const line of state.lines) {
      const d = def(line.id);
      if (isZone(d) && lineResearched(d)) d.yields.forEach(y => visible.add(y.m));
    }
    for (const m of MATERIAL_DEFS) if ((state.materials[m.id] || 0) >= 1) visible.add(m.id);

    if (visible.size === 0) {
      bagChipsEl.innerHTML = '<span class="bag-empty">아직 채집한 재료가 없어요 — 광산을 클릭해보세요!</span>';
      return;
    }
    bagChipsEl.innerHTML = MATERIAL_DEFS
      .filter(m => visible.has(m.id))
      .map(m => {
        const qty = Math.floor(state.materials[m.id] || 0);
        return `<span class="bag-chip" title="${m.name} · 개당 ${fmt(materialPrice(m.id))}">
          ${m.icon} ${m.name} <span class="bc-qty">${fmtNum(qty)}</span>
          <span class="bc-price">${fmt(materialPrice(m.id))}</span>
          <button class="bag-sell-btn" data-sell-mat="${m.id}" ${qty <= 0 ? 'disabled' : ''}>💰 판매</button>
        </span>`;
      }).join('');
  }

  function buildLineEl(line) {
    const d = def(line.id);
    const zone = isZone(d);
    const el = document.createElement('div');
    el.className = 'line';
    el.id = 'line-' + line.id;
    el.innerHTML = `
      <div class="line-icon-wrap" data-click="${line.id}" title="클릭하면 한 사이클 ${zone ? '채집' : '생산'}">
        <span class="ico">${d.icon}</span>
        <span class="count-badge">0대</span>
      </div>
      <div class="line-mid">
        <div class="line-name">
          <span>${d.name}</span>
          <span class="mult-tag">×1</span>
        </div>
        <div class="line-sub"></div>
        ${zone ? '<div class="line-yields"></div>' : '<div class="line-inputs"></div><div class="line-inv"></div>'}
        <div class="lock-research-note hidden"></div>
        <div class="progress-track">
          <div class="progress-fill"></div>
          <div class="progress-label"></div>
          <span class="worker">${zone ? '⛏️' : '👷'}</span>
        </div>
        ${zone ? '' : `
        <div class="delivery-track" data-sell-toggle="${line.id}" title="클릭하면 판매 ON/OFF">
          <span class="deliver-hint"></span>
          <span class="truck">🚚</span>
        </div>`}
      </div>
      <div class="line-actions">
        <button class="buy-btn" data-buy="${line.id}">
          <div class="bt-top">⚙️ 설비 <span class="bt-amt"></span></div>
          <div class="bt-cost"></div>
        </button>
        ${zone ? '' : `
        <button class="buyer-btn" data-buyer="${line.id}"></button>
        <button class="quality-btn" data-quality="${line.id}"></button>`}
        <button class="mgr-btn" data-mgr="${line.id}"></button>
      </div>
    `;
    return el;
  }

  function inputsHTML(line) {
    const d = def(line.id);
    const entries = Object.entries(d.inputs || {});
    if (entries.length === 0) return line.count > 0 ? '🌿 투입 재료 없음' : '';
    return '투입/사이클: ' + entries.map(([inId, qty]) => {
      const need = qty * Math.max(1, itemsPerCycle(line));
      const ok = getStock(inId) >= need;
      return `<span class="${ok ? 'in-ok' : 'in-lack'}">${stockIcon(inId)}${stockName(inId)} ${fmtNum(need)}</span>`;
    }).join(' + ');
  }

  function yieldsHTML(d) {
    return '산출: ' + d.yields.map(y => {
      const m = mdef(y.m);
      const rare = y.p <= 0.1;
      return `<span class="${rare ? 'y-rare' : ''}">${m.icon}${m.name} ${Math.round(y.p * 100)}%</span>`;
    }).join(' · ');
  }

  function updateLineDOM(id) {
    const line = ls(id);
    const d = def(id);
    const zone = isZone(d);
    const el = document.getElementById('line-' + id);
    if (!el) return;

    const researched = lineResearched(d);
    el.classList.toggle('locked-research', !researched);
    el.classList.toggle('starved', researched && line.count > 0 && line.starved && !line.running);

    el.querySelector('.count-badge').textContent = fmtNum(line.count) + '대';
    el.querySelector('.mult-tag').textContent = '×' + fmtNum(milestoneMult(line.count));

    const lockNote = el.querySelector('.lock-research-note');
    if (!researched) {
      const r = rdef(d.research);
      lockNote.textContent = `🔬 "${r.name}" 연구 완료 시 해금`;
      lockNote.classList.remove('hidden');
    } else {
      lockNote.classList.add('hidden');
    }

    const sub = el.querySelector('.line-sub');
    const nm = nextMilestone(line.count);
    if (line.count > 0) {
      sub.innerHTML = `설비 <b>${fmtNum(line.count)}대</b> → 사이클(${cycleTime(d).toFixed(1)}s)당 <b>${fmtNum(itemsPerCycle(line))}개</b> ${zone ? '채집' : d.item + ' 생산'}${nm ? ` · ⭐${nm}대에 ×2` : ''}`;
    } else {
      sub.innerHTML = researched ? `설비를 구매하면 ${zone ? '채집' : d.item + ' 생산'} 시작 · 사이클 ${cycleTime(d).toFixed(1)}s` : '';
    }

    if (zone) {
      el.querySelector('.line-yields').innerHTML = researched ? yieldsHTML(d) : '';
    } else {
      el.querySelector('.line-inputs').innerHTML = researched ? inputsHTML(line) : '';
      const inv = el.querySelector('.line-inv');
      inv.innerHTML = line.count > 0
        ? `📦 재고 <b>${fmtNum(line.inventory)}개</b> · 개당 ${fmt(itemPrice(line))} · <span class="sell-info">🛒 초당 ${fmtQty(sellRate(line))}개 (Lv.${line.buyerLv})</span>`
        : '';
    }

    el.querySelector('.line-icon-wrap').classList.toggle('spinning', line.running && line.hasManager);

    const n = amountToBuy(line);
    const cost = costFor(line, n);
    const buyBtn = el.querySelector('.buy-btn');
    buyBtn.querySelector('.bt-amt').textContent = `×${n}`;
    buyBtn.querySelector('.bt-cost').textContent = fmt(cost);
    const canBuy = researched && state.money >= cost && n > 0;
    buyBtn.classList.toggle('can-buy', canBuy);
    buyBtn.disabled = !canBuy;
    el.classList.toggle('affordable-glow', canBuy && line.count === 0);

    if (!zone) {
      const buyerBtn = el.querySelector('.buyer-btn');
      if (line.count > 0) {
        const bc = buyerCost(line);
        buyerBtn.innerHTML = `🛒 구매자 Lv.${line.buyerLv + 1} · ${fmt(bc)}`;
        buyerBtn.disabled = state.money < bc;
      } else {
        buyerBtn.innerHTML = '🛒 구매자';
        buyerBtn.disabled = true;
      }

      const qBtn = el.querySelector('.quality-btn');
      if (line.count > 0) {
        const qc = qualityCost(line);
        qBtn.innerHTML = `💠 품질 Lv.${line.qualityLv + 1} · ${fmt(qc)}`;
        qBtn.disabled = state.money < qc;
      } else {
        qBtn.innerHTML = '💠 품질';
        qBtn.disabled = true;
      }

      const dt = el.querySelector('.delivery-track');
      const delivering = line.count > 0 && line.selling && line.inventory > 0.5;
      dt.classList.toggle('delivering', delivering);
      dt.classList.toggle('sell-off', line.count > 0 && !line.selling);
      dt.querySelector('.deliver-hint').textContent =
        line.count === 0 ? ''
        : !line.selling ? '🚫 판매 중지 (재고 비축 중) — 클릭해서 재개'
        : delivering ? `배송 중 · ${fmt(sellRate(line) * itemPrice(line))}/초`
        : '재고 대기 중';
    }

    const mgrBtn = el.querySelector('.mgr-btn');
    if (line.hasManager) {
      mgrBtn.className = 'mgr-btn owned';
      mgrBtn.textContent = '👔 자동화 완료';
      mgrBtn.disabled = true;
    } else {
      mgrBtn.className = 'mgr-btn';
      mgrBtn.innerHTML = `👔 매니저 ${fmt(d.mgrCost)}`;
      mgrBtn.disabled = !researched || state.money < d.mgrCost || line.count === 0;
    }

    updateProgressDOM(id);
  }

  function updateProgressDOM(id) {
    const line = ls(id);
    const el = document.getElementById('line-' + id);
    if (!el) return;
    const pct = (line.progress * 100).toFixed(1);
    el.querySelector('.progress-fill').style.width = pct + '%';

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
    } else if (line.starved) {
      label.textContent = '⏸ 재료 부족';
    } else {
      label.textContent = isZone(def(id)) ? '클릭하여 채집 ▶' : '클릭하여 생산 ▶';
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

    const canResearch = !state.activeResearch &&
      RESEARCH_DEFS.some(r => canStartResearch(r));
    researchBadgeEl.classList.toggle('hidden', !canResearch);
  }

  // ---------- 🔬 연구 렌더 ----------
  const researchListEl = document.getElementById('research-list');
  function renderResearch() {
    researchListEl.innerHTML = '';
    for (const r of RESEARCH_DEFS) {
      const done = !!state.researched[r.id];
      const active = state.activeResearch?.id === r.id;
      const prereqOk = r.needs.every(n => state.researched[n]);
      const el = document.createElement('div');
      el.className = 'research' + (done ? ' done' : active ? ' active-rsch' : (!prereqOk ? ' locked-rsch' : ''));
      const unlockNames = r.unlocksLines.map(lid => `${def(lid).icon}${def(lid).name}`).join(', ');
      const missing = r.needs.filter(n => !state.researched[n]).map(n => rdef(n).name);

      let right;
      if (done) {
        right = '<span class="rsch-done-tag">✅ 완료</span>';
      } else if (active) {
        const remain = r.duration * (1 - state.activeResearch.progress) / researchSpeed();
        right = `<button class="rsch-skip-btn" data-skip-research="1" ${state.gems < 5 ? 'disabled' : ''}>💎 5로 즉시 완료</button>
                 <span class="rsch-time">⏳ ${fmtTime(remain)} 남음</span>`;
      } else {
        right = `<span class="rsch-cost">${fmt(r.cost)}</span>
                 <span class="rsch-time">⏱️ ${fmtTime(r.duration / researchSpeed())}</span>
                 <button class="rsch-start-btn" data-research="${r.id}" ${canStartResearch(r) ? '' : 'disabled'}>연구 시작</button>`;
      }

      el.innerHTML = `
        <div class="rsch-icon">${done ? '🎓' : (prereqOk ? r.icon : '🔒')}</div>
        <div>
          <div class="rsch-name">${r.name}</div>
          <div class="rsch-desc">${r.desc} · 해금: <b>${unlockNames}</b></div>
          ${missing.length && !done ? `<div class="rsch-req">🔒 선행 연구 필요: ${missing.join(', ')}</div>` : ''}
          ${active ? `
            <div class="rsch-progress-track"><div class="rsch-progress-fill" style="width:${(state.activeResearch.progress * 100).toFixed(1)}%"></div></div>
            <div class="rsch-progress-text">연구 중... ${(state.activeResearch.progress * 100).toFixed(0)}%</div>` : ''}
        </div>
        <div class="rsch-right">${right}</div>
      `;
      researchListEl.appendChild(el);
    }
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
      let fromV3 = false;
      if (!raw) {
        raw = localStorage.getItem(OLD_V3_KEY);
        fromV3 = !!raw;
      }
      if (!raw) return;
      const saved = JSON.parse(raw);

      state.money = saved.money ?? state.money;
      state.gems = saved.gems ?? 0;
      state.lifetime = saved.lifetime ?? 0;
      state.fame = saved.fame ?? 0;
      state.buyMode = saved.buyMode ?? 1;
      state.lastTick = saved.lastTick ?? Date.now();
      if (saved.materials) state.materials = saved.materials;
      if (saved.upgrades) Object.assign(state.upgrades, saved.upgrades);
      if (saved.claimed) state.claimed = saved.claimed;
      if (saved.stats) Object.assign(state.stats, saved.stats);
      if (saved.researched) state.researched = saved.researched;
      if (saved.activeResearch && rdef(saved.activeResearch.id)) state.activeResearch = saved.activeResearch;

      if (Array.isArray(saved.lines)) {
        for (const sl of saved.lines) {
          let targetId = sl.id;
          if (fromV3) {
            // v3 채집 라인 → v4 자연 구역 매핑
            if (sl.id === 'iron') targetId = 'mine';
            else if (sl.id === 'sand' || sl.id === 'copper') targetId = 'sea';
          }
          const line = ls(targetId);
          if (!line) continue;
          line.count = Math.max(line.count, sl.count ?? 0);
          line.hasManager = line.hasManager || !!sl.hasManager;
          if (!isZone(def(targetId))) {
            line.inventory = Math.max(line.inventory, sl.inventory ?? 0);
            line.buyerLv = Math.max(line.buyerLv, sl.buyerLv ?? 1);
            line.qualityLv = Math.max(line.qualityLv, sl.qualityLv ?? 0);
            line.selling = sl.selling ?? true;
          } else if (fromV3 && sl.inventory > 0) {
            // 구 채집 라인의 재고를 가방으로 이동
            const mid = sl.id === 'iron' ? 'iron' : (sl.id === 'sand' ? 'sand' : 'copper');
            state.materials[mid] = (state.materials[mid] || 0) + sl.inventory;
          }
          line.progress = 0;
          line.running = false;
        }
      }

      if (fromV3) {
        // 구 'materials' 연구 → 해양학으로 승계
        if (state.researched.materials) {
          delete state.researched.materials;
          state.researched.marine = true;
        }
        localStorage.removeItem(OLD_V3_KEY);
        toast('🔄 기존 세이브를 이어받았어요! 새 기능: 🌍 랜덤 채집 + 🎒 가방', 'good');
      }

      for (const line of state.lines) {
        if (line.hasManager && line.count > 0) tryStartCycle(line);
      }
      for (const q of QUESTS) if (questDone(q)) notifiedQuests.add(q.id);
    } catch (e) {
      state = freshState();
    }
  }

  function resetGame() {
    if (!confirm('정말 모든 진행을 삭제하고 처음부터 시작할까요?\n(명성·💎 잼·연구·퀘스트도 모두 사라집니다)')) return;
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(OLD_V3_KEY);
    state = freshState();
    notifiedQuests.clear();
    activeOrder = null;
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
      const sellToggle = e.target.closest('[data-sell-toggle]');
      if (sellToggle) { toggleSelling(sellToggle.dataset.sellToggle); return; }
      const clickable = e.target.closest('[data-click]');
      if (clickable) { clickLine(clickable.dataset.click); return; }
    });

    document.getElementById('bag-chips').addEventListener('click', (e) => {
      const sell = e.target.closest('[data-sell-mat]');
      if (sell) sellMaterial(sell.dataset.sellMat);
    });

    document.getElementById('research-list').addEventListener('click', (e) => {
      const start = e.target.closest('[data-research]');
      if (start) { startResearch(start.dataset.research); return; }
      const skip = e.target.closest('[data-skip-research]');
      if (skip) { skipResearch(); return; }
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

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelector('.tab-btn.active')?.classList.remove('active');
        btn.classList.add('active');
        for (const page of document.querySelectorAll('.tab-page')) {
          page.classList.toggle('hidden', page.id !== 'tab-' + btn.dataset.tab);
        }
        if (btn.dataset.tab === 'research') renderResearch();
        if (btn.dataset.tab === 'quests') renderQuests();
        if (btn.dataset.tab === 'shop') renderShop();
      });
    });

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

    // 1초 주기 갱신
    setInterval(() => {
      incomePerSec = incomeAcc;
      incomeAcc = 0;
      state.lines.forEach(l => updateLineDOM(l.id));
      if (bagDirty) renderBag();
      checkQuestNotify();
      updateOrders(Date.now());
      if (activeOrder) renderOrderBanner();
      if (!document.getElementById('tab-research').classList.contains('hidden')) renderResearch();
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
