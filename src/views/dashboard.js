import { S, set } from '../state.js';
import { calc } from '../utils/computed.js';
import { h, D, Sp, Btn, BtnI, balanceDisplay, balanceToggleBtn, dateBadge, swRow, getActiveProfileName } from '../utils/domHelpers.js';
import { fmt, fmt2 } from '../utils/formatters.js';
import { 
  cycleForDate, meralcoReadDay, inCycle, cycleDateRange, applianceAlwaysOnEstimate, 
  usageCostInRange, airconModeFrom, timedSessionDraft, applianceSessionDraft, isHomeCookedTx, 
  cycleLabel, renderWeatherCard, noteParts, logSortDate 
} from '../utils/electricityUtils.js';
import { curMk, dateOf, durationLabel, toStr } from '../utils/dateUtils.js';
import { renderCurrentlyOn, renderCoffeeCounter } from '../components/electricity.js';
import { openEdit, delTx, delHome, delApplianceUsage, delAircon, delTv, updateWeather } from '../actions.js';

const isPhone = () => window.innerWidth <= 768; // Define breakpoint for phone

export function renderDash() {
  const { avgD, runwayMonths, avgMonthlyExpense, historyMonths, todayS, groceryMonth, chart, maxS } = calc();
  const data = S.data;
  const eCycle = cycleForDate(new Date(), meralcoReadDay(data));
  const airconCost = (data.airconUsage || []).filter(u => inCycle(u, eCycle)).reduce((s, u) => s + u.cost, 0);
  const tvCost = (data.tvUsage || []).filter(u => inCycle(u, eCycle)).reduce((s, u) => s + u.cost, 0);
  const eRange = cycleDateRange(eCycle);
  const cycleAlwaysOnEst = (data.appliances || []).filter(a => a.alwaysOn).reduce((s, a) => {
    const est = applianceAlwaysOnEstimate(a, eRange.start, eRange.end, data.meralcoRate);
    return { cost: s.cost + est.cost, kwh: s.kwh + est.kwh };
  }, { cost: 0, kwh: 0 });
  const applianceSessionCost = (data.applianceUsage || []).filter(u => inCycle(u, eCycle)).reduce((s, u) => s + usageCostInRange(u, eRange.start, eRange.end), 0);
  const applianceCost = cycleAlwaysOnEst.cost + applianceSessionCost;

  const runway = Math.floor(runwayMonths * 30);
  const rwPct = Math.min((runway / 365) * 100, 100);
  const rwCol = runway > 120 ? '#6ce0a0' : runway > 60 ? '#f6d060' : '#f07070'; // No margin-bottom here
  const sec = D('sec');
  const topSection = D('dash-top-section'); topSection.classList.add('mb-20'); // Spacing handled by CSS


  const hero = D('card cg dash-balance-card'); const hcp = D('cp');
  const hrow = D('row'); hrow.style.marginBottom = '9px';
  const hl = D('');
  hl.appendChild(Object.assign(D('lblw'), { textContent: 'Current Balance' }));
  const balLine = D('bal-line bal-line-hero');
  const bv = D('sf'); bv.style.cssText = 'font-size:33px;color:#fff;display:block;line-height:1.05;margin:2px 0'; bv.textContent = balanceDisplay(data.balance);
  balLine.appendChild(bv); balLine.appendChild(balanceToggleBtn('bal-toggle-hero'));
  const bs = D(''); bs.style.cssText = 'font-size:11px;color:rgba(255,255,255,.55);margin-top:2px;line-height:1.45'; bs.textContent = `Avg monthly expenses ${fmt(Math.round(avgMonthlyExpense))}${historyMonths ? ` from ${historyMonths} month${historyMonths !== 1 ? 's' : ''}` : ''} · ~${runwayMonths.toFixed(1)} months runway`;
  hl.appendChild(balLine); hl.appendChild(bs);
  const eb = h('button', { cls: 'btn bg', style: 'color:rgba(255,255,255,.85);border-color:rgba(255,255,255,.25);padding:5px 10px;font-size:11px', onClick: () => set({ balInput: String(data.balance), modal: 'editBal' }) }, 'Edit');
  hrow.appendChild(hl); hrow.appendChild(eb); hcp.appendChild(hrow); // No margin-bottom here
  const rrow = D('row');
  rrow.style.marginBottom = '4px';
  rrow.appendChild(h('span',{style:'font-size:10px;color:rgba(255,255,255,.45)'},'Runway vs 12 months'));
  rrow.appendChild(h('span',{style:'font-size:10px;color:rgba(255,255,255,.45)'},`${runwayMonths.toFixed(1)} / 12`));

  const rb = D('rbar'); const rf = D('rf'); rf.style.cssText = `width:${rwPct}%;background:${rwCol}`; rb.appendChild(rf);
  hcp.appendChild(rrow); hcp.appendChild(rb); hero.appendChild(hcp);
  topSection.appendChild(renderWeatherCard(data, { title: 'Weather', onRefresh: () => updateWeather(true) })); // Card margin handled by global .card
  topSection.appendChild(hero);

  const g2 = D('g2 dash-meal-grocery-grid');
  const ob = todayS > data.dailyBudget;
  const c1 = D('card'); c1.innerHTML = `<div class="cp"><div class="lbl">Today's Meals</div><div class="sf" style="font-size:23px;color:${ob ? '#b83030' : '#3a2818'};margin:2px 0">${fmt(todayS)}</div><div style="font-size:10.5px;color:#8a7260">Daily: ${fmt(data.dailyBudget)} · Monthly: ${fmt(data.dailyBudget * 30)}</div>${ob ? '<div style="font-size:10px;color:#b83030;font-weight:700;margin-top:1px">Over budget</div>' : ''}</div>`;
  const c2 = D('card'); c2.innerHTML = `<div class="cp"><div class="lbl">Groceries This Month</div><div class="sf" style="font-size:23px;color:${groceryMonth > (data.groceryBudget || 5000) ? '#b83030' : '#3a2818'};margin:2px 0">${fmt(groceryMonth)}</div><div style="font-size:10.5px;color:#8a7260">Monthly budget: ${fmt(data.groceryBudget || 5000)}</div></div>`;
  g2.appendChild(c1); g2.appendChild(c2); topSection.appendChild(g2); sec.appendChild(topSection); // No margin-bottom here

  const opsSection = D('dash-ops-section');
  const electricStack = D('dash-electricity-stack');
  const acCard = h('div', {
    cls: 'card dash-electricity-card', 
    style: { cursor: 'pointer' }, 
    onClick: () => set({ modal: 'electricityMonthChart', chartCycleKey: eCycle.key }) 
  });
  const acp = D('cp');
  acp.innerHTML = `<div class="lbl">Electricity Cycle · ${cycleLabel(eCycle)}</div><div class="sf" style="font-size:23px;margin:2px 0">${fmt2(airconCost + tvCost + applianceCost)}</div><div style="font-size:10.5px;color:#8a7260">24/7 ${fmt2(cycleAlwaysOnEst.cost)} · Sessions ${fmt2(applianceSessionCost)} · Aircon ${fmt2(airconCost)} · TV ${fmt2(tvCost)}</div>`;
  acCard.appendChild(acp); electricStack.appendChild(acCard);

  const eActs = D('dash-electricity-actions'); eActs.classList.add('dash-electricity-actions'); // Spacing via CSS

  // Match the old app behavior:
  // - Button opens a modal that has a start timer button (active session)
  //   and a log usage button (manual log).
  // - Aircon/TV open the corresponding "add*" modal.
  // - Appliance opens the "logAppliance" modal.

  const eBtn = (label, fn, dis = false) => { const b = Btn('bgfull', label, fn, dis); b.style.cssText = 'width:100%;padding:10px 4px;font-size:12px'; return b; };

  eActs.appendChild(
    eBtn('+ Aircon', () => {
      const mode = airconModeFrom(data.airconDefaultMode, data.airconDefaultSleepMode);
      const w = data.weather || {};
      set({
        modal: 'addAircon',
        airconF: {
          ...timedSessionDraft(S.airconF, 480),
          mode,
          sleepMode: mode === 'sleep',
          tempC: data.airconDefaultTemp || S.airconF.tempC || '29',
          roomTemp: S.airconF.roomTemp || '',
          outdoorTemp: w.temp ?? S.airconF.outdoorTemp ?? '',
          outdoorFeels: w.apparent ?? S.airconF.outdoorFeels ?? '',
          outdoorHumidity: w.humidity ?? S.airconF.outdoorHumidity ?? ''
        }
      });
    })
  );

  eActs.appendChild(
    eBtn('+ TV', () => set({ modal: 'addTv', tvF: timedSessionDraft(S.tvF, 180) }))
  );

  eActs.appendChild(
    eBtn(
      '+ Appliance',
      () => {
        const first = (data.appliances || []).find(a => !a.alwaysOn);
        set({ modal: 'logAppliance', applianceSessionF: applianceSessionDraft(first) });
      },
      !(data.appliances || []).some(a => !a.alwaysOn)
    )
  );

  electricStack.appendChild(eActs);

  const coffeeCard = renderCoffeeCounter(data); if (coffeeCard) electricStack.appendChild(coffeeCard);
  opsSection.appendChild(electricStack); // No margin-bottom here
  opsSection.appendChild(renderCurrentlyOn(data)); opsSection.style.marginBottom = '20px'; sec.appendChild(opsSection); // Explicit margin for the ops section container

  const activitySection = D('dash-activity-section');
  const chartExpenseStack = D('dash-chart-expenses-stack'); chartExpenseStack.style.marginBottom = '20px'; // Explicit margin for the chart/expense stack container
  const cc = h('div', { 
    cls: 'card dash-meals-chart', 
    style: { cursor: 'pointer' }, 
    onClick: () => set({ modal: 'mealsMonthChart', chartMonthKey: curMk(), selectedMealDate: toStr() }) 
  });
  const ccp = D('cp'); ccp.style.paddingBottom = '5px';
  const cr = D('row'); cr.style.marginBottom = '11px'; cr.innerHTML = `<span class="lbl">7-Day Meals Spending / Logs</span><span style="font-size:11px;color:#8a7260">Avg ${fmt(Math.round(avgD))}/day</span>`;
  const bars = D('bw'); bars.style.height = '82px';
  chart.forEach(cd => {
    const isT = cd.ds === toStr(), pct = cd.spend / maxS, over = cd.spend > data.dailyBudget && cd.spend > 0;
    const col = D('bc');
    const nl = D(''); nl.style.cssText = 'font-size:7.5px;color:#8a7260;font-weight:600;text-align:center;height:12px'; 
    if (cd.spend > 0) nl.textContent = Math.round(cd.spend);
    col.appendChild(nl);
    const bg = D('bbg'); bg.style.position = 'relative'; // Ensure relative positioning for absolute pips
    // Meal Blocks (Visual frequency pips inside the bar)
    if (cd.count > 0) {
      const pips = D(''); pips.style.cssText = 'position:absolute;bottom:0;left:0;right:0;display:flex;flex-direction:column-reverse;gap:1.5px;padding:2px;z-index:3;pointer-events:none';
      const displayCount = Math.min(cd.count, 5);
      let pipColor = 'rgba(255,255,255,0.7)'; // Default for paid meals, contrasting white
      if (cd.homeCookedCount > 0) {
        pipColor = '#1a56c4'; // Blue for home-cooked meals
      } else if (over) {
        pipColor = '#d45c5c'; // Red for over budget paid meals
      } else {
        pipColor = '#2e6e4f'; // Green for within budget paid meals
      }
      for (let j = 0; j < displayCount; j++) {
        pips.appendChild(h('div', { style: `height:4px;background:${pipColor};border-radius:1px` }));
      }
      bg.appendChild(pips);
    }
    const fill = D('bf'); fill.style.cssText = `height:${Math.max(pct * 100, cd.spend > 0 ? 8 : 0)}%;background:${over ? '#d45c5c' : isT ? '#1b4d35' : '#2e6e4f'}`; bg.appendChild(fill); col.appendChild(bg);
    const lel = D(''); lel.style.cssText = `font-size:7.5px;color:${isT ? '#1b4d35' : '#8a7260'};font-weight:${isT ? 800 : 400};text-align:center`; lel.textContent = cd.label; col.appendChild(lel);
    bars.appendChild(col);
  });
  const legend = D(''); legend.style.cssText = 'font-size:10px;color:#8a7260;margin-top:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
  legend.appendChild(h('span', { style: 'color:#2e6e4f' }, '🟢 Within budget'));
  legend.appendChild(h('span', { style: 'color:#d45c5c' }, '🔴 Over budget'));
  legend.appendChild(h('span', { style: 'color:#1a56c4' }, '🔵 Home-cooked')); // No margin-bottom here
  ccp.appendChild(cr); ccp.appendChild(bars); ccp.appendChild(legend);
  cc.appendChild(ccp); chartExpenseStack.appendChild(cc); activitySection.appendChild(chartExpenseStack);
  const lb = Btn('bp bfull dash-log-food-btn', '+ Log Food / Expense', () => set({ modal: 'addTx', txF: { ...S.txF, date: dateOf(new Date()) } })); lb.style.marginBottom = '4px'; // Keep small margin for button
  const qa = D('dash-quick-actions'); qa.style.cssText = 'display:flex;gap:8px;margin-bottom:20px'; // Explicit margin for quick actions
  const q1 = BtnI('bg bfull', 'home', 'Log Home', () => set({ modal: 'addHome', homeF: { ...S.homeF, date: dateOf(new Date()) } }));
  const q2 = BtnI('bg bfull', 'reports', 'Reports', () => set({ tab: 'reports' }));
  qa.appendChild(lb); qa.appendChild(q1); qa.appendChild(q2); activitySection.appendChild(qa);

  const mealLogs = (data.transactions || []).filter(isHomeCookedTx).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7); // Card margin handled by global .card
  if (mealLogs.length) {
    const mc = D('card dash-recent-meals-card'); mc.appendChild(Object.assign(D('section-hdr'), { innerHTML: '<span class="lbl">Recent Meal Logs</span>' }));
    mealLogs.forEach(tx => {
      const row = D('row cr row-line');
      const left = D(''); left.style.cssText = 'flex:1;min-width:0';
      left.appendChild(h('div', { cls: 'row-main' }, `Home-cooked${tx.note ? ' · ' + tx.note : ''}`));
      const info = D('meta-line'); info.style.gap = '4px';
      info.appendChild(Sp('bdg bdg-f', 'Meal Log'));
      info.appendChild(dateBadge(tx.date));
      left.appendChild(info);
      row.appendChild(left); mc.appendChild(swRow(row, () => openEdit('food', tx.id), () => delTx(tx.id)));
    });
    activitySection.appendChild(mc);
  }

  const allApplianceLogs = [
    ...(data.applianceUsage || []).map(u => ({ ...u, _logType: 'appliance' })),
    ...(data.airconUsage || []).map(u => ({ ...u, _logType: 'aircon', category: 'Aircon' })),
    ...(data.tvUsage || []).map(u => ({ ...u, _logType: 'tv', name: data.tvModel || 'TV', category: 'TV' }))
  ];
  const applianceLogs = allApplianceLogs.sort((a, b) => String(logSortDate(b)).localeCompare(String(logSortDate(a)))).slice(0, 10);
  if (applianceLogs.length) { // No margin-bottom here
    const ac = D('card dash-recent-appliances-card'); ac.appendChild(Object.assign(D('section-hdr'), { innerHTML: '<span class="lbl">Recent Appliance Logs</span>' }));
    applianceLogs.forEach(u => {
      const row = D('row cr row-line');
      const left = D(''); left.style.cssText = 'flex:1;min-width:0';
      left.appendChild(h('div', { cls: 'row-main-sm' }, u.name));
      const info = D('meta-line'); info.style.gap = '4px';
      info.appendChild(Sp('bdg bdg-ap', u.category || 'Appliance'));
      info.appendChild(dateBadge(u.date));
      if (u.minutes || u.hours) info.appendChild(h('span', { cls: 'meta-clip' }, durationLabel(u.minutes || (u.hours * 60))));
      left.appendChild(info);
      row.appendChild(left);
      row.appendChild(h('span', { cls: 'sf', style: 'font-size:13px;flex-shrink:0' }, fmt2(u.cost)));
      ac.appendChild(swRow(row, () => openEdit(u._logType === 'aircon' ? 'airconUsage' : u._logType === 'tv' ? 'tvUsage' : 'applianceUsage', u.id), () => {
        if (u._logType === 'aircon') delAircon(u.id);
        else if (u._logType === 'tv') delTv(u.id);
        else delApplianceUsage(u.id);
      }));
    });
    activitySection.appendChild(ac);
  }

  // Recent (Excluded Aircon and Home-cooked meal logs from recent deductions list)
  const paidFood=(data.transactions||[]).filter(t=>!isHomeCookedTx(t));
  const allTx = [
    ...paidFood.map(t => ({ ...t, type: 'food' })), // No margin-bottom here
    ...(data.homeExpenses || []).map(e => ({ ...e, type: 'home' }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  if(allTx.length){
    const rc=D('card dash-recent-expenses-card'); // Card margin handled by global .card
    rc.appendChild(Object.assign(D('section-hdr'),{innerHTML:'<span class="lbl">Recent Expenses</span>'}));
    allTx.forEach(tx=>{
      const row=D('row cr row-line');row.style.cssText='justify-content:flex-start;gap:9px';
      const left=D('');left.style.cssText='flex:1;min-width:0';
      const nm=D('row-main');nm.style.cssText='font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';nm.textContent=tx.type==='food'?tx.source:tx.name;
      const info=D('meta-line');
      const bcls=tx.type==='food'?'bdg-f':tx.type==='home'?'bdg-h':'bdg-a';
      info.appendChild(Sp('bdg '+bcls,tx.type==='food'?'Food':tx.type==='home'?'Home':'Aircon'));
      info.appendChild(dateBadge(tx.date));
      const noteText=tx.type==='home'?noteParts(tx.store,tx.note):tx.note;
      if(noteText)info.appendChild(h('span',{cls:'meta-clip'},noteText));
      left.appendChild(nm);left.appendChild(info);
      const right=D('');right.style.cssText='display:flex;align-items:center;gap:6px;flex-shrink:0';
      const amt = D(''); amt.style.cssText = `font-weight:700;color:${tx.amount ? '#b83030' : '#8a7260'};font-size:13px;white-space:nowrap;text-align:right;line-height:1.25`;
      amt.textContent = tx.amount ? '-' + fmt(tx.amount) : fmt(0);
      right.appendChild(amt);
      row.appendChild(left);row.appendChild(right);rc.appendChild(swRow(row,()=>openEdit(tx.type,tx.id),()=>tx.type==='food'?delTx(tx.id):delHome(tx.id)));
    });
    activitySection.appendChild(rc);
  }
  sec.appendChild(activitySection);

  // Tips
  const tips=[['🥚','Eggs (₱8–10/pc) — cheapest complete protein. 3/day = ₱25 viand.'],['🐟','Galunggong / Sardines (₱25–50) — cheap, nutritious, easy to cook.'],['🫘','Monggo, Sitaw, Ampalaya (₱30–50/kg) — nutrient-dense vegetables.'],['🥬','Kangkong + Malunggay (₱10–20/bundle) — most nutritious green veg.'],['🍚','Sinangag + egg + leftovers = complete meal for ₱15–25.'],['🛒','Palengke is 20–40% cheaper than supermarket. Go before 9am.']]; // Card margin handled by global .card
  const tc=D('card dash-budget-tips-card');tc.style.marginBottom='18px';
  const th=h('button',{cls:'dash-tips-toggle',onClick:()=>set({tipsOpen:!S.tipsOpen}),type:'button','aria-expanded':S.tipsOpen?'true':'false'});
  th.appendChild(h('span',{cls:'lbl'},'💡 Healthy Budget Tips'));
  th.appendChild(h('span',{style:'font-size:10.5px;color:#8a7260;font-weight:700'},`${tips.length} tips ${S.tipsOpen?'▴':'▾'}`));
  tc.appendChild(th);
  if(S.tipsOpen){
    const tcp=D('cp dash-tips-body');tips.forEach(([ic,tx])=>{const r=D('tip-r');r.appendChild(h('span',{style:'font-size:15px'},ic));r.appendChild(h('span',{style:'font-size:11.5px;color:#3a2818;line-height:1.5'},tx));tcp.appendChild(r);});tc.appendChild(tcp);
  }
  sec.appendChild(tc);
  return sec;
}