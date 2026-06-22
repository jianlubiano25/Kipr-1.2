import { S, set } from '../state.js';
import { h, D, Btn, Inp, Sel, Fg, Mr, DivHdr, metricTiles, Time12Control, dateSpanLabel, iconEl, Sp } from '../utils/domHelpers.js';
import { fmt, fmt2, fmt3 } from '../utils/formatters.js';
import { mk, curMk, mklbl, dateOf, shiftMonthKey, dtOf, toStr, durationLabel, minsOfDay } from '../utils/dateUtils.js';
import { isHomeCookedTx, isGroceryTx, foodSources, homeCategories, homeStores, applianceCategories, SCATS, UNITS, AIRCON_MODES, airconModeLabel, airconRates, airconModeFrom, airconSessionFromParts, applianceSessionEstimate, weatherSettings, themeLabel, themeFromData, mealsDailyChart, electricityDailyChart, electricityReportForMonth, electricityComparisonForMonth, meralcoReadDay, cycleForDate, shiftCycleKey, cycleLabel, cycleDays, meralcoKwhForCycle, applianceMonthly } from '../utils/electricityUtils.js';
import { addTx, addHome, saveEdit, saveBatchEdit, updBal, addPrice, addStock, addBill, addAircon, addTv, addApplianceUsage, addAppliance, saveSettings, saveAirSet, saveAirconProfile, saveTvProfile, openListsDefaults, updateWeather, startActiveSession, openRestorePicker, manualSync, switchProfile, addProfile, renameProfile, deleteProfile, openManageProfiles } from '../actions.js';
import { cloudSave, cloudSignIn, cloudSignOut, syncLabel, syncTimeLabel, restoreFromSnapshot, resetLocalData } from '../supabase.js';
import { APP_VERSION, SCHEMA_VERSION, FCATS, HCATS } from '../constants.js';

const isPhone = () => window.innerWidth <= 768; // Define breakpoint for phone

export function renderModal() {
  if (!S.modal) return null;
  const bg = D('mbg');
  bg.onclick = e => { if (e.target === bg) set({ modal: null }); };
  const box = D('mbox');

  const M = (title, content) => { // Helper function for modal structure
    const tt = D('mt'); tt.textContent = title;
    box.appendChild(tt); box.appendChild(content);
    bg.appendChild(box); return bg;
  };

  let startY = 0, currentY = 0, isDragging = false;
  box.addEventListener('touchstart', e => {
    if (box.scrollTop === 0) {
      startY = e.touches[0].clientY;
      currentY = startY;
      isDragging = true;
      box.style.transition = 'none';
    }
  }, { passive: true });
  box.addEventListener('touchmove', e => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const dy = currentY - startY;
    if (dy > 0) {
      if (e.cancelable) e.preventDefault();
      box.style.transform = `translateY(${dy}px)`;
    } else {
      isDragging = false;
      box.style.transform = '';
    }
  }, { passive: false });
  box.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    box.style.transition = 'transform 0.2s ease-out';
    const dy = currentY - startY;
    if (dy > 100) {
      set({ modal: null });
    } else {
      box.style.transform = '';
    }
  });

  if (S.modal === 'mealsMonthChart') {
    const monthKey = S.chartMonthKey || curMk(), data = S.data, chart = mealsDailyChart(monthKey, data), maxSpend = Math.max(...chart.map(x => x.spend), data.dailyBudget || 1, 1);
    const total = chart.reduce((s, x) => s + x.spend, 0), mealCount = chart.reduce((s, x) => s + x.count, 0), avg = total / chart.length, overDays = chart.filter(x => x.over).length, homeCookedCount = chart.reduce((s, x) => s + x.homeCookedCount, 0);
    if (!S.selectedMealDate || mk(S.selectedMealDate) !== monthKey) S.selectedMealDate = chart.find(x => x.count)?.ds || `${monthKey}-01`;
    const selectedDay = chart.find(x => x.ds === S.selectedMealDate) || chart[0], selectedItems = selectedDay?.items || [];
    const c = D('');
    const nav = D('row'); nav.style.cssText = `gap:8px;margin-bottom:${isPhone() ? '9px' : '0'}`;
    const prev = Btn('bgsm', '<', () => set({ chartMonthKey: shiftMonthKey(monthKey, -1) })); prev.style.width = '36px';
    const next = Btn('bgsm', '>', () => set({ chartMonthKey: shiftMonthKey(monthKey, 1) })); next.style.width = '36px';
    nav.appendChild(prev); nav.appendChild(h('div', { cls: 'sf', style: 'font-size:16px;flex:1;text-align:center;color:#3a2818' }, mklbl(monthKey))); nav.appendChild(next); c.appendChild(nav);
    c.appendChild(h('div', { style: 'font-size:11px;color:#8a7260;line-height:1.5;margin-bottom:10px' }, `${mklbl(monthKey)} · ${mealCount} meal log${mealCount !== 1 ? 's' : ''} · ${fmt(total)} spent · Avg ${fmt(Math.round(avg))}/day · ${overDays} over-budget day${overDays !== 1 ? 's' : ''}`));
    const cal = D(''); cal.style.cssText = 'display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-bottom:10px';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => cal.appendChild(h('div', { style: 'font-size:9px;color:#8a7260;font-weight:800;text-align:center;padding-bottom:2px' }, d)));
    const padStart = chart[0]?.date.getDay() || 0, padEnd = (7 - ((padStart + chart.length) % 7)) % 7;
    for (let i = 0; i < padStart; i++) { const blank = D('calendar-blank'); blank.style.minHeight = '64px'; cal.appendChild(blank); } // No margin-bottom here
    chart.forEach(cd => {
      const isT = cd.ds === toStr(), isSel = cd.ds === S.selectedMealDate, intensity = Math.min(1, cd.spend / maxSpend), cell = D('');
      cell.style.cssText = `min-height:64px;border:1.5px solid ${isSel ? '#1b4d35' : isT ? '#b8720c' : cd.over ? '#f5c2c2' : '#e8e0d5'};background:${cd.count ? cd.over ? `rgba(184,48,48,${0.05 + intensity * .12})` : `rgba(27,77,53,${0.04 + Math.max(intensity, .25) * .1})` : '#fff'};border-radius:7px;padding:5px 4px;display:flex;flex-direction:column;gap:3px;overflow:hidden;cursor:pointer`;
      cell.onclick = () => set({ selectedMealDate: cd.ds });
      const top = D('row'); top.style.cssText = 'align-items:flex-start;gap:2px';
      top.appendChild(h('span', { style: `font-size:11px;font-weight:800;color:${isT ? '#1b4d35' : cd.over ? '#b83030' : '#3a2818'}` }, cd.label));
      cell.appendChild(top);
      cell.appendChild(h('div', { style: `font-size:9px;font-weight:700;color:${cd.over ? '#b83030' : '#3a2818'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis` }, cd.spend ? fmt(cd.spend) : (cd.count ? `${cd.count} meal${cd.count !== 1 ? 's' : ''}` : '')));
      cell.appendChild(h('div', { style: 'font-size:7.5px;color:#8a7260;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, cd.count ? `${cd.count} log${cd.count !== 1 ? 's' : ''}${cd.spend ? ` · ${Math.round(cd.spend / (data.dailyBudget || 1) * 100)}%` : ''}` : 'No meals'));
      const track = D(''); track.style.cssText = 'height:5px;background:#eae2d6;border-radius:3px;overflow:hidden;margin-top:auto';
      const fill = D(''); fill.style.cssText = `height:100%;width:${Math.min(100, cd.spend / maxSpend * 100).toFixed(1)}%;background:${cd.over ? '#d45c5c' : '#2e6e4f'}`; track.appendChild(fill); cell.appendChild(track);
      cal.appendChild(cell);
    }); // No margin-bottom here
    for (let i = 0; i < padEnd; i++) { const blank = D('calendar-blank'); blank.style.minHeight = '64px'; cal.appendChild(blank); }
    c.appendChild(cal);
    const dayCard = D('card'); dayCard.style.marginBottom = '10px'; dayCard.appendChild(DivHdr(`Meals on ${new Date((selectedDay?.ds || toStr()) + 'T12:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`));
    if (selectedItems.length) {
      selectedItems.forEach(item => {
        const row = D('row cr row-line'); row.style.gap = '8px';
        const left = D(''); left.style.cssText = 'min-width:0;flex:1';
        left.appendChild(h('div', { style: 'font-size:12px;font-weight:700;color:#3a2818;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, item.note || item.source));
        left.appendChild(h('div', { style: 'font-size:10px;color:#8a7260;margin-top:1px' }, item.source));
        row.appendChild(left);
        if (item.source !== 'Home-cooked') row.appendChild(h('span', { cls: 'sf', style: `font-size:13px;color:${item.amount ? '#b83030' : '#8a7260'};flex-shrink:0` }, item.amount ? fmt(item.amount) : fmt(0)));
        dayCard.appendChild(row);
      });
    } else {
      const empty = D('empty'); empty.style.cssText = 'padding:14px;color:#8a7260;font-size:12px;text-align:center'; empty.textContent = 'No meal logs for this day.'; dayCard.appendChild(empty);
    }
    c.appendChild(dayCard);
    c.appendChild(Btn('bp bfull', 'Close', () => set({ modal: null })));
    return M('Meals Calendar', c);
  }

  if (S.modal === 'electricityMonthChart') {
    const data = S.data, readDay = meralcoReadDay(data), cycle = cycleForDate(S.chartCycleKey || toStr(), readDay);
    const chart = electricityDailyChart(cycle, data, 'cycle'), maxCost = Math.max(...chart.map(x => x.cost), 1), meralcoDailyKwh = meralcoKwhForCycle(cycle, data) / cycleDays(cycle);
    const totalCost = chart.reduce((s, x) => s + x.cost, 0), totalKwh = chart.reduce((s, x) => s + x.kwh, 0), meralcoKwh = meralcoKwhForCycle(cycle, data);
    const c = D('');
    const nav = D('row'); nav.style.cssText = 'gap:8px;margin-bottom:9px';
    const prev = Btn('bgsm', '<', () => set({ chartCycleKey: shiftCycleKey(cycle.key, -1, readDay) })); prev.style.width = '36px';
    const next = Btn('bgsm', '>', () => set({ chartCycleKey: shiftCycleKey(cycle.key, 1, readDay) })); next.style.width = '36px';
    nav.appendChild(prev); nav.appendChild(h('div', { cls: 'sf', style: 'font-size:14px;flex:1;text-align:center;color:#3a2818' }, cycleLabel(cycle))); nav.appendChild(next); c.appendChild(nav);
    c.appendChild(h('div', { style: 'font-size:11px;color:#8a7260;line-height:1.5;margin-bottom:10px' }, `${cycleLabel(cycle)} · ${fmt2(totalCost)} · ${(meralcoKwh || totalKwh).toFixed(2)} kWh${meralcoKwh ? ' Meralco' : ' estimated'}`));
    const cal = D(''); cal.style.cssText = 'display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-bottom:10px';
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => cal.appendChild(h('div', { style: 'font-size:9px;color:#8a7260;font-weight:800;text-align:center;padding-bottom:2px' }, d))); // No margin-bottom here
    const padStart = cycle.start.getDay(), padEnd = (7 - ((padStart + chart.length) % 7)) % 7;
    for (let i = 0; i < padStart; i++) { const blank = D('calendar-blank'); blank.style.minHeight = '68px'; cal.appendChild(blank); }
    chart.forEach(cd => {
      const isT = cd.ds === toStr(), dt = dtOf(cd.ds), intensity = Math.min(1, cd.cost / maxCost), cell = D('');
      cell.style.cssText = `min-height:68px;border:1px solid ${isT ? '#b8720c' : '#e8e0d5'};background:${cd.cost > 0 ? `rgba(27,77,53,${0.04 + intensity * .08})` : '#fff'};border-radius:7px;padding:5px 4px;display:flex;flex-direction:column;gap:3px;overflow:hidden`;
      const top = D('row'); top.style.cssText = 'align-items:flex-start;gap:2px';
      top.appendChild(h('span', { style: `font-size:11px;font-weight:800;color:${isT ? '#b8720c' : '#3a2818'}` }, String(dt.getDate())));
      top.appendChild(h('span', { style: 'font-size:7px;color:#8a7260;white-space:nowrap' }, dt.toLocaleDateString('en-PH', { month: 'short' })));
      cell.appendChild(top);
      cell.appendChild(h('div', { style: 'font-size:9px;font-weight:700;color:#3a2818;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, cd.meralcoDailyKwh ? `${cd.kwh.toFixed(1)} kWh` : fmt2(cd.cost)));
      cell.appendChild(h('div', { style: 'font-size:7.5px;color:#8a7260;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, cd.meralcoDailyKwh ? fmt2(cd.cost) : `${cd.kwh.toFixed(2)} kWh`));
      const strip = D(''); strip.style.cssText = 'height:5px;background:#eae2d6;border-radius:3px;overflow:hidden;display:flex;margin-top:auto';
      const total = Math.max(cd.airCost + cd.tvCost + cd.applianceCost, 0);
      if (total > 0) {
        const airSeg = D(''); airSeg.style.cssText = `width:${(cd.airCost / total * 100).toFixed(1)}%;background:#b8720c`; strip.appendChild(airSeg);
        const tvSeg = D(''); tvSeg.style.cssText = `width:${(cd.tvCost / total * 100).toFixed(1)}%;background:#2e6e4f`; strip.appendChild(tvSeg);
        const apSeg = D(''); apSeg.style.cssText = `width:${(cd.applianceCost / total * 100).toFixed(1)}%;background:#1a56c4`; strip.appendChild(apSeg);
      }
      cell.appendChild(strip); cal.appendChild(cell); // No margin-bottom here
    });
    for (let i = 0; i < padEnd; i++) { const blank = D('calendar-blank'); blank.style.minHeight = '68px'; cal.appendChild(blank); }
    c.appendChild(cal);
    c.appendChild(Btn('bp bfull', 'Close', () => set({ modal: null })));
    return M('Full Month Chart', c);
  }

  if (S.modal === 'electricityReport') {
    const monthKey = S.chartMonthKey || S.rptMk || curMk(), data = S.data, r = electricityReportForMonth(monthKey, data);
    const c = D(''); // No margin-bottom here
    const nav = D('row'); nav.style.cssText = 'gap:8px;margin-bottom:9px';
    const prev = Btn('bgsm', '<', () => set({ chartMonthKey: shiftMonthKey(monthKey, -1) })); prev.style.width = '36px';
    const next = Btn('bgsm', '>', () => set({ chartMonthKey: shiftMonthKey(monthKey, 1) })); next.style.width = '36px';
    nav.appendChild(prev); nav.appendChild(h('div', { cls: 'sf', style: 'font-size:16px;flex:1;text-align:center;color:#3a2818' }, mklbl(monthKey))); nav.appendChild(next); c.appendChild(nav);
    c.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260;text-align:center;margin:-4px 0 9px' }, `Meralco cycle ${cycleLabel(r.cycle)}`));
    const hero = D('soft-panel-lg');
    hero.appendChild(h('div', { cls: 'lbl' }, 'Usage Overview'));
    hero.appendChild(h('div', { cls: 'sf', style: 'font-size:24px;color:#3a2818;margin-top:2px' }, `${r.totalKwh.toFixed(2)} kWh`));
    hero.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260;margin-top:3px' }, `${fmt2(r.totalCost)} estimated · ${(r.totalKwh / r.days).toFixed(2)} kWh/day · ${r.logs.length} logged session${r.logs.length !== 1 ? 's' : ''}`));
    c.appendChild(hero);
    c.appendChild(metricTiles([
      { label: 'Aircon', value: `${r.airconKwh.toFixed(2)} kWh`, color: '#b8720c' },
      { label: 'TV', value: `${r.tvKwh.toFixed(2)} kWh`, color: '#2e6e4f' },
      { label: 'Appliance', value: `${(r.sessionKwh + r.alwaysKwh).toFixed(2)} kWh`, color: '#1a56c4' }
    ]));
    const breakdown = D('card'); breakdown.style.marginTop = '10px'; breakdown.appendChild(DivHdr('Consumption Breakdown')); // No margin-bottom here
    const bp = D('cp'), parts = [['Aircon', r.airconKwh, r.airconCost, '#b8720c'], ['TV', r.tvKwh, r.tvCost, '#2e6e4f'], ['Appliances', r.sessionKwh, r.sessionCost, '#6b4c36'], ['24/7 Appliances', r.alwaysKwh, r.alwaysCost, '#1a56c4']], max = Math.max(...parts.map(p => p[1]), 1);
    parts.forEach(([label, kwh, cost, color]) => {
      const row = D('rpt-bar-row'); row.appendChild(h('div', { cls: 'rpt-bar-label' }, label));
      const track = D('rpt-bar-track'), fill = D('rpt-bar-fill'); fill.style.cssText = `width:${(kwh / max * 100).toFixed(1)}%;background:${color}`; track.appendChild(fill);
      row.appendChild(track); row.appendChild(h('div', { cls: 'rpt-bar-val' }, `${kwh.toFixed(2)} kWh`)); bp.appendChild(row);
      bp.appendChild(h('div', { style: 'font-size:9.5px;color:#8a7260;text-align:right;margin-top:-4px;margin-bottom:2px' }, fmt2(cost)));
    });
    breakdown.appendChild(bp); c.appendChild(breakdown);
    const top = D('card'); top.appendChild(DivHdr('Most Consumption'));
    if (r.top.length) {
      r.top.slice(0, 6).forEach(item => {
        const row = D('row cr row-line'); row.style.gap = '8px';
        const left = D(''); left.style.cssText = 'flex:1;min-width:0';
        left.appendChild(h('div', { style: 'font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, item.name));
        left.appendChild(h('div', { style: 'font-size:10px;color:#8a7260' }, `${item.type} · ${item.logs ? item.logs + ' log' + (item.logs !== 1 ? 's' : '') : '24/7'}${item.hours ? ` · ${durationLabel(item.hours * 60)}` : ''}`));
        const right = D(''); right.style.cssText = 'text-align:right;flex-shrink:0';
        right.appendChild(h('div', { cls: 'sf', style: 'font-size:14px' }, `${item.kwh.toFixed(2)} kWh`));
        right.appendChild(h('div', { style: 'font-size:9.5px;color:#8a7260' }, fmt2(item.cost)));
        row.appendChild(left); row.appendChild(right); top.appendChild(row);
      });
    } else top.appendChild(Object.assign(D('empty'), { textContent: 'No electricity usage logs for this month.' }));
    c.appendChild(top);
    const recent = D('card'); recent.appendChild(DivHdr('Recent Usage Logs'));
    if (r.logs.length) {
      r.logs.slice(0, 8).forEach(log => {
        const row = D('row cr row-line'); row.style.gap = '8px';
        const left = D(''); left.style.cssText = 'flex:1;min-width:0';
        left.appendChild(h('div', { style: 'font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, `${log.type} · ${log.name}`));
        left.appendChild(h('div', { style: 'font-size:10px;color:#8a7260' }, `${new Date(log.date + 'T12:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}${log.time ? ' · ' + log.time : ''}`));
        row.appendChild(left);
        row.appendChild(h('div', { cls: 'sf', style: 'font-size:13px;flex-shrink:0' }, `${(parseFloat(log.kwh) || 0).toFixed(3)} kWh`));
        recent.appendChild(row);
      });
    } else recent.appendChild(Object.assign(D('empty'), { textContent: 'No session logs yet. 24/7 appliances are still included above.' }));
    c.appendChild(recent);
    c.appendChild(Btn('bp bfull', 'Close', () => set({ modal: null })));
    return M('Electricity Usage Report', c);
  }

  if (S.modal === 'foodReport') {
    const monthKey = S.chartMonthKey || S.rptMk || curMk(), data = S.data;
    const food = (data.transactions || []).filter(t => mk(t.date) === monthKey), paid = food.filter(t => !isHomeCookedTx(t)), mealLogs = food.filter(isHomeCookedTx), groceries = paid.filter(isGroceryTx), meals = paid.filter(t => !isGroceryTx(t)), homeCookedCount = mealLogs.length;
    const total = paid.reduce((s, t) => s + t.amount, 0), mealTotal = meals.reduce((s, t) => s + t.amount, 0), groceryTotal = groceries.reduce((s, t) => s + t.amount, 0);
    const c = D('');
    const nav = D('row'); nav.style.cssText = 'gap:8px;margin-bottom:9px';
    const prev = Btn('bgsm', '<', () => set({ chartMonthKey: shiftMonthKey(monthKey, -1) })); prev.style.width = '36px';
    const next = Btn('bgsm', '>', () => set({ chartMonthKey: shiftMonthKey(monthKey, 1) })); next.style.width = '36px';
    nav.appendChild(prev); nav.appendChild(h('div', { cls: 'sf', style: 'font-size:16px;flex:1;text-align:center;color:#3a2818' }, mklbl(monthKey))); nav.appendChild(next); c.appendChild(nav);
    const hero = D('soft-panel-lg');
    hero.appendChild(h('div', { cls: 'lbl' }, 'Food Overview'));
    hero.appendChild(h('div', { cls: 'sf', style: 'font-size:24px;color:#3a2818;margin-top:2px' }, fmt(total)));
    hero.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260;margin-top:3px' }, `${paid.length} paid log${paid.length !== 1 ? 's' : ''} · ${mealLogs.length} meal log${mealLogs.length !== 1 ? 's' : ''} · ${fmt(Math.round(total / Math.max(1, [...new Set(paid.map(t => t.date))].length)))}/active day`));
    c.appendChild(hero);
    c.appendChild(metricTiles([
      { label: 'Meals', value: fmt(mealTotal), color: '#2e6e4f' },
      { label: 'Groceries', value: fmt(groceryTotal), color: groceryTotal > (data.groceryBudget || 5000) ? '#b83030' : '#1a56c4' },
      { label: 'Meal Logs', value: String(mealLogs.length), color: '#b8720c' }
    ]));
    const bySrc = paid.reduce((acc, t) => { acc[t.source] = (acc[t.source] || 0) + t.amount; return acc; }, {}); // No margin-bottom here
    const srcCard = D('card'); srcCard.style.marginTop = '10px'; srcCard.appendChild(DivHdr('Spending by Source'));
    const sp = D('cp'), maxSrc = Math.max(...Object.values(bySrc), 1);
    Object.entries(bySrc).sort((a, b) => b[1] - a[1]).forEach(([src, amt]) => {
      const row = D('rpt-bar-row'); row.appendChild(h('div', { cls: 'rpt-bar-label' }, src));
      const track = D('rpt-bar-track'), fill = D('rpt-bar-fill'); fill.style.cssText = `width:${(amt / maxSrc * 100).toFixed(1)}%;background:#2e6e4f`; track.appendChild(fill);
      row.appendChild(track); row.appendChild(h('div', { cls: 'rpt-bar-val' }, fmt(amt))); sp.appendChild(row);
    });
    if (!Object.keys(bySrc).length) sp.appendChild(Object.assign(D('empty'), { textContent: 'No paid food expenses this month.' }));
    srcCard.appendChild(sp); c.appendChild(srcCard);
    const mealCard = D('card'); mealCard.appendChild(DivHdr('Meal Logs'));
    if (mealLogs.length) {
      mealLogs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).forEach(t => {
        const row = D('row cr row-line'); row.style.gap = '8px';
        const left = D(''); left.style.cssText = 'flex:1;min-width:0';
        left.appendChild(h('div', { style: 'font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, `Home-cooked${t.note ? ' · ' + t.note : ''}`));
        left.appendChild(h('div', { style: 'font-size:10px;color:#8a7260' }, new Date(t.date + 'T12:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })));
        row.appendChild(left); mealCard.appendChild(row);
      });
    } else mealCard.appendChild(Object.assign(D('empty'), { textContent: 'No Home-cooked meal logs this month.' }));
    c.appendChild(mealCard);
    c.appendChild(Btn('bp bfull', 'Close', () => set({ modal: null })));
    return M('Food Report', c);
  }

  if (S.modal === 'homeReport') {
    const monthKey = S.chartMonthKey || S.rptMk || curMk(), data = S.data, items = (data.homeExpenses || []).filter(e => mk(e.date) === monthKey);
    const total = items.reduce((s, e) => s + e.amount, 0), count = items.length, byCat = items.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {}), byStore = items.reduce((acc, e) => { acc[e.store || 'Unknown'] = (acc[e.store || 'Unknown'] || 0) + e.amount; return acc; }, {}); // No margin-bottom here
    const c = D('');
    const nav = D('row'); nav.style.cssText = 'gap:8px;margin-bottom:9px';
    const prev = Btn('bgsm', '<', () => set({ chartMonthKey: shiftMonthKey(monthKey, -1) })); prev.style.width = '36px';
    const next = Btn('bgsm', '>', () => set({ chartMonthKey: shiftMonthKey(monthKey, 1) })); next.style.width = '36px';
    nav.appendChild(prev); nav.appendChild(h('div', { cls: 'sf', style: 'font-size:16px;flex:1;text-align:center;color:#3a2818' }, mklbl(monthKey))); nav.appendChild(next); c.appendChild(nav);
    const hero = D('soft-panel-lg');
    hero.appendChild(h('div', { cls: 'lbl' }, 'Home Overview'));
    hero.appendChild(h('div', { cls: 'sf', style: 'font-size:24px;color:#3a2818;margin-top:2px' }, fmt(total)));
    hero.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260;margin-top:3px' }, `${count} items · Avg ${fmt(Math.round(total / Math.max(1, count)))}/item`));
    c.appendChild(hero);
    const catCard = D('card'); catCard.appendChild(DivHdr('Spending by Category'));
    const cp = D('cp'), maxCat = Math.max(...Object.values(byCat), 1);
    Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
      const row = D('rpt-bar-row'); row.appendChild(h('div', { cls: 'rpt-bar-label' }, cat));
      const track = D('rpt-bar-track'), fill = D('rpt-bar-fill'); fill.style.cssText = `width:${(amt / maxCat * 100).toFixed(1)}%;background:#1a56c4`; track.appendChild(fill);
      row.appendChild(track); row.appendChild(h('div', { cls: 'rpt-bar-val' }, fmt(amt))); cp.appendChild(row);
    });
    if (!items.length) cp.appendChild(Object.assign(D('empty'), { textContent: 'No home expenses this month.' }));
    catCard.appendChild(cp); c.appendChild(catCard);
    const storeCard = D('card'); storeCard.appendChild(DivHdr('Top Stores'));
    const stp = D('cp'), maxStore = Math.max(...Object.values(byStore), 1);
    Object.entries(byStore).sort((a, b) => b[1] - a[1]).slice(0, 6).forEach(([store, amt]) => {
      const row = D('rpt-bar-row'); row.appendChild(h('div', { cls: 'rpt-bar-label' }, store));
      const track = D('rpt-bar-track'), fill = D('rpt-bar-fill'); fill.style.cssText = `width:${(amt / maxStore * 100).toFixed(1)}%;background:#2e6e4f`; track.appendChild(fill);
      row.appendChild(track); row.appendChild(h('div', { cls: 'rpt-bar-val' }, fmt(amt))); stp.appendChild(row);
    });
    storeCard.appendChild(stp); c.appendChild(storeCard);
    c.appendChild(Btn('bp bfull', 'Close', () => set({ modal: null })));
    return M('Home Report', c);
  }

  if (S.modal === 'billsReport') {
    const monthKey = S.chartMonthKey || S.rptMk || curMk(), data = S.data;
    const bills = (data.bills || []).filter(b => (b.monthlyAmounts?.[monthKey] || 0) > 0); // No margin-bottom here
    const total = bills.reduce((s, b) => s + (b.monthlyAmounts[monthKey] || 0), 0);
    const unpaid = bills.filter(b => !b.paid?.[monthKey]).reduce((s, b) => s + (b.monthlyAmounts[monthKey] || 0), 0);
    const c = D('');
    const nav = D('row'); nav.style.cssText = 'gap:8px;margin-bottom:9px';
    const prev = Btn('bgsm', '<', () => set({ chartMonthKey: shiftMonthKey(monthKey, -1) })); prev.style.width = '36px';
    const next = Btn('bgsm', '>', () => set({ chartMonthKey: shiftMonthKey(monthKey, 1) })); next.style.width = '36px';
    nav.appendChild(prev); nav.appendChild(h('div', { cls: 'sf', style: 'font-size:16px;flex:1;text-align:center;color:#3a2818' }, mklbl(monthKey))); nav.appendChild(next); c.appendChild(nav);
    const hero = D('soft-panel-lg');
    hero.appendChild(h('div', { cls: 'lbl' }, 'Bills Overview'));
    hero.appendChild(h('div', { cls: 'sf', style: 'font-size:24px;color:#3a2818;margin-top:2px' }, fmt(total)));
    hero.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260;margin-top:3px' }, `${bills.length} bill${bills.length !== 1 ? 's' : ''} recorded · ${fmt(unpaid)} still pending`));
    c.appendChild(hero);
    const billCard = D('card'); billCard.appendChild(DivHdr('Monthly Breakdown'));
    if (bills.length) {
      bills.forEach(b => {
        const amount = b.monthlyAmounts?.[monthKey] || 0, paid = !!b.paid?.[monthKey];
        const row = D('row cr row-line'); row.style.gap = '8px';
        const left = D(''); left.style.cssText = 'flex:1;min-width:0';
        left.appendChild(h('div', { style: 'font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, b.name));
        left.appendChild(h('div', { style: `font-size:10px;color:${paid ? '#2e6e4f' : '#b8720c'};font-weight:600` }, paid ? '✓ Paid' : 'Pending Payment'));
        const right = D(''); right.style.cssText = 'text-align:right;flex-shrink:0';
        right.appendChild(h('div', { cls: 'sf', style: 'font-size:15px' }, fmt(amount)));
        row.appendChild(left); row.appendChild(right); billCard.appendChild(row);
      });
    } else billCard.appendChild(Object.assign(D('empty'), { textContent: 'No bills recorded for this month.' }));
    c.appendChild(billCard);
    c.appendChild(Btn('bp bfull', 'Close', () => set({ modal: null })));
    return M('Bills Report', c);
  }

  // Basic logic for "Add Transaction" (Food)
  if (S.modal === 'addTx') {
    const c = D('');
    const isHomeCooked = S.txF.source === 'Home-cooked'; // No margin-bottom here
    if (!isHomeCooked) {
      const ai = Inp('', { type: 'number', inputmode: 'decimal', placeholder: 'e.g. 150', value: S.txF.amount });
      ai.oninput = e => S.txF.amount = e.target.value;
      c.appendChild(Fg('Subtotal (₱)', ai));
      const dii = Inp('', { type: 'number', inputmode: 'decimal', placeholder: 'Optional', value: S.txF.discount });
      dii.oninput = e => S.txF.discount = e.target.value;
      c.appendChild(Fg('Discount (₱)', dii));
    }
    c.appendChild(Fg('Source', Sel(S.txF.source, foodSources(S.data), v => { S.txF.source = v; if (v === 'Home-cooked') { S.txF.amount = ''; S.txF.discount = ''; } set({}); })));
    const isGroceries = S.txF.source === 'Groceries';
    const ni = Inp('', { type: 'text', placeholder: isGroceries ? 'e.g. Eggs, bread, chips' : isHomeCooked ? 'e.g. Pork sinigang, rice' : 'e.g. Pork sinigang', value: S.txF.note });
    ni.oninput = e => S.txF.note = e.target.value;
    c.appendChild(Fg(isGroceries ? 'Pantry Item Name' : isHomeCooked ? 'What did you eat?' : 'Notes (optional)', ni, isHomeCooked ? 'Required for no-expense meal logs.' : ''));

    if (isGroceries) {
      const g2 = D('g2');
      const qfg = D('fg'); qfg.appendChild(h('label', { cls: 'fl' }, 'Qty'));
      const qi = Inp('', { type: 'number', inputmode: 'decimal', value: S.txF.qty || '1' });
      qi.oninput = e => S.txF.qty = e.target.value; qfg.appendChild(qi); g2.appendChild(qfg);
      const ufg = D('fg'); ufg.appendChild(h('label', { cls: 'fl' }, 'Unit'));
      ufg.appendChild(Sel(S.txF.unit || 'pcs', UNITS, v => S.txF.unit = v));
      g2.appendChild(ufg); c.appendChild(g2);
      c.appendChild(Fg('Pantry Category', Sel(S.txF.stockCategory || 'Food Staples', SCATS, v => S.txF.stockCategory = v), 'This grocery will also be added to Pantry & Stocks.'));
    }

    const di = Inp('', { type: 'date', value: S.txF.date });
    di.oninput = e => S.txF.date = e.target.value;
    c.appendChild(Fg('Date', di));
    const ca = Btn('bg', 'Cancel', () => set({ modal: null })); ca.style.flex = '1';
    const sa = Btn('bp', 'Save', addTx); sa.style.flex = '2';
    c.appendChild(Mr(ca, sa)); return M('Log Food Expense', c);
  }

  if (S.modal === 'addPrice') {
    const c = D('');
    const ni = Inp('', { type: 'text', placeholder: 'e.g. Galunggong, Shampoo', value: S.priceF.name }); ni.oninput = e => S.priceF.name = e.target.value; ni.focus(); c.appendChild(Fg('Item Name', ni));
    const g2 = D('g2'); // No margin-bottom here
    const pi = Inp('', { type: 'number', inputmode: 'decimal', placeholder: '0', value: S.priceF.price }); pi.oninput = e => S.priceF.price = e.target.value; g2.appendChild(Fg('Price (₱)', pi));
    g2.appendChild(Fg('Unit', Sel(S.priceF.unit, UNITS, v => S.priceF.unit = v))); c.appendChild(g2);
    const catSel = Sel(S.priceF.category, ['Food', 'Home & Toiletries'], v => { S.priceF.category = v; S.priceF.subcat = v === 'Food' ? FCATS[0] : homeCategories(S.data)[0]; set({}); }); c.appendChild(Fg('Category', catSel));
    c.appendChild(Fg('Subcategory', Sel(S.priceF.subcat, S.priceF.category === 'Food' ? FCATS : homeCategories(S.data), v => S.priceF.subcat = v)));
    c.appendChild(Fg('Store', Sel(S.priceF.store, homeStores(S.data), v => S.priceF.store = v)));
    const ca = Btn('bg', 'Cancel', () => set({ modal: null })); ca.style.flex = '1'; const sa = Btn('bp', 'Save Price', addPrice); sa.style.flex = '2';
    c.appendChild(Mr(ca, sa)); return M('Add Price', c);
  }

  if (S.modal === 'addStock') {
    const c = D('');
    const ni = Inp('', { type: 'text', placeholder: 'e.g. Rice, eggs, shampoo', value: S.stockF.name }); ni.oninput = e => S.stockF.name = e.target.value; ni.focus(); c.appendChild(Fg('Item Name', ni));
    c.appendChild(Fg('Category', Sel(S.stockF.category, SCATS, v => S.stockF.category = v))); // No margin-bottom here
    const g2 = D('g2');
    const qi = Inp('', { type: 'number', inputmode: 'decimal', placeholder: '0', value: S.stockF.quantity }); qi.oninput = e => S.stockF.quantity = e.target.value; g2.appendChild(Fg('Current Qty', qi));
    g2.appendChild(Fg('Unit', Sel(S.stockF.unit, UNITS, v => S.stockF.unit = v))); c.appendChild(g2);
    const mi = Inp('', { type: 'number', inputmode: 'decimal', placeholder: '1', value: S.stockF.minQty }); mi.oninput = e => S.stockF.minQty = e.target.value; c.appendChild(Fg('Min Qty (alert below this)', mi));
    const di = Inp('', { type: 'date', value: S.stockF.date || toStr() }); di.oninput = e => S.stockF.date = e.target.value; c.appendChild(Fg('Date', di));
    const nt = Inp('', { type: 'text', placeholder: 'e.g. Buy at Palengke', value: S.stockF.note }); nt.oninput = e => S.stockF.note = e.target.value; c.appendChild(Fg('Notes (optional)', nt));
    const ca = Btn('bg', 'Cancel', () => set({ modal: null })); ca.style.flex = '1'; const sa = Btn('bp', 'Add Item', addStock); sa.style.flex = '2';
    c.appendChild(Mr(ca, sa)); return M('Add Pantry Item', c);
  }

  if (S.modal === 'addBill') {
    const c = D('');
    const ni = Inp('', { type: 'text', placeholder: 'e.g. Water, Phone Plan', value: S.billF.name }); ni.oninput = e => S.billF.name = e.target.value; ni.focus(); c.appendChild(Fg('Bill Name', ni));
    c.appendChild(h('p', { style: { fontSize: '11.5px', color: '#8a7260', marginBottom: isPhone() ? '12px' : '0', lineHeight: '1.5' } }, 'You\'ll enter the amount each month since bills change.'));
    const ca = Btn('bg', 'Cancel', () => set({ modal: null })); ca.style.flex = '1'; const sa = Btn('bp', 'Add', addBill); sa.style.flex = '2';
    c.appendChild(Mr(ca, sa)); return M('Add Bill', c);
  }

  // Add Home Expense
  if (S.modal === 'addHome') {
    const c = D('');
    const ni = Inp('', { type: 'text', placeholder: 'e.g. Dish soap, Shampoo', value: S.homeF.name });
    ni.oninput = e => S.homeF.name = e.target.value; ni.focus();
    c.appendChild(Fg('Item Name', ni)); // No margin-bottom here
    const calcSub = () => { const gross = (parseFloat(S.homeF.unitPrice) || 0) * (parseFloat(S.homeF.qty) || 1), disc = Math.max(0, parseFloat(S.homeF.discount) || 0), total = Math.max(0, gross - disc); ti.value = total ? total.toFixed(2) : ''; S.homeF.amount = ti.value; };
    const g2 = D('g2');
    const qfg = D('fg'); qfg.appendChild(h('label', { cls: 'fl' }, 'Qty')); const qi = Inp('', { type: 'number', inputmode: 'decimal', value: S.homeF.qty }); qi.oninput = e => { S.homeF.qty = e.target.value; calcSub(); }; qfg.appendChild(qi); g2.appendChild(qfg);
    const upfg = D('fg'); upfg.appendChild(h('label', { cls: 'fl' }, 'Unit Price (₱)')); const ui = Inp('', { type: 'number', inputmode: 'decimal', placeholder: '0', value: S.homeF.unitPrice }); ui.oninput = e => { S.homeF.unitPrice = e.target.value; calcSub(); }; upfg.appendChild(ui); g2.appendChild(upfg); c.appendChild(g2);
    c.appendChild(Fg('Unit', Sel(S.homeF.unit, UNITS, v => S.homeF.unit = v)));
    const df = Inp('', { type: 'number', inputmode: 'decimal', placeholder: 'Optional', value: S.homeF.discount }); df.oninput = e => { S.homeF.discount = e.target.value; calcSub(); };
    c.appendChild(Fg('Discount (₱)', df));
    const ti = Inp('', { type: 'number', inputmode: 'decimal', placeholder: '0', value: S.homeF.amount, readonly: true });
    c.appendChild(Fg('Total (₱)', ti));
    c.appendChild(Fg('Category', Sel(S.homeF.category, homeCategories(S.data), v => S.homeF.category = v)));
    c.appendChild(Fg('Store', Sel(S.homeF.store, homeStores(S.data), v => S.homeF.store = v)));
    const ot = Inp('', { type: 'text', placeholder: 'Optional', value: S.homeF.note }); ot.oninput = e => S.homeF.note = e.target.value; c.appendChild(Fg('Notes', ot));
    const di = Inp('', { type: 'date', value: S.homeF.date }); di.oninput = e => S.homeF.date = e.target.value; c.appendChild(Fg('Date', di));
    const ca = Btn('bg', 'Cancel', () => set({ modal: null })); ca.style.flex = '1';
    const sa = Btn('bp', 'Save', addHome); sa.style.flex = '2';
    c.appendChild(Mr(ca, sa)); return M('Log Home / Toiletries', c);
  }

  // Batch Edit
  if (S.modal === 'batchEdit') {
    const c = D(''), dr = S.batchDraft, t = S.batchType, d = S.data;
    const count = (t === 'food' ? S.selFood : S.selHome).size; // No margin-bottom here
    c.appendChild(h('p', { style: 'font-size:12px;margin-bottom:12px' }, `Editing ${count} items`));
    if (t === 'food') c.appendChild(Fg('Source', Sel('', ['', ...foodSources(d)], v => dr.source = v)));
    else c.appendChild(Fg('Category', Sel('', ['', ...homeCategories(d)], v => dr.category = v, 'compact-select')));
    c.appendChild(Btn('bp bfull', 'Apply Changes', saveBatchEdit));
    return M('Batch Edit', c);
  }

  // Update Balance
  if (S.modal === 'editBal') {
    const c = D(''), f = S.balInput;
    c.appendChild(Fg('New Balance', Inp('', { type: 'number', inputmode: 'decimal', value: f, oninput: e => S.balInput = e.target.value })));
    c.appendChild(Btn('bp bfull', 'Update Wallet', updBal));
    return M('Edit Balance', c);
  }

  // Generic Edit Modal logic (Food, Home, etc)
  if (S.modal === 'edit' && S.editDraft) {
    const dr = S.editDraft, t = S.editType, d = S.data;
    const c = D('');
    if (t === 'food') { // No margin-bottom here
      if (dr.grossAmount === undefined) dr.grossAmount = dr.amount || 0; if (dr.discount === undefined) dr.discount = 0;
      const isHomeCooked = String(dr.source).toLowerCase() === 'home-cooked';
      if (!isHomeCooked) {
        c.appendChild(Fg('Subtotal (₱)', Inp('', { type: 'number', inputmode: 'decimal', value: dr.grossAmount ?? dr.amount, oninput: e => dr.grossAmount = e.target.value })));
        c.appendChild(Fg('Discount (₱)', Inp('', { type: 'number', inputmode: 'decimal', value: dr.discount || '', oninput: e => dr.discount = e.target.value })));
      }
      c.appendChild(Fg('Source', Sel(dr.source, foodSources(d), v => { dr.source = v; if (v === 'Home-cooked') { dr.grossAmount = 0; dr.discount = 0; dr.amount = 0; } set({}); }, 'compact-select')));
      const ni = Inp('', { type: 'text', placeholder: isHomeCooked ? 'What did you eat?' : 'Notes', value: dr.note || '' }); ni.oninput = e => dr.note = e.target.value;
      c.appendChild(Fg(isHomeCooked ? 'What did you eat?' : 'Notes', ni));
      if (dr.source === 'Groceries' || dr.linkedStockId) {
        const g2 = D('g2');
        g2.appendChild(Fg('Qty', Inp('', { type: 'number', value: dr.qty || '1', oninput: e => dr.qty = e.target.value })));
        g2.appendChild(Fg('Unit', Sel(dr.unit, UNITS, v => dr.unit = v, 'compact-select')));
        c.appendChild(g2);
        c.appendChild(Fg('Pantry Category', Sel(dr.stockCategory || 'Food Staples', SCATS, v => dr.stockCategory = v, 'compact-select')));
      } // No margin-bottom here
    } else if (t === 'home') {
      if (!dr.qty) dr.qty = 1; if (!dr.unitPrice) dr.unitPrice = dr.grossAmount || dr.amount || 0; if (!dr.unit) dr.unit = 'pcs'; if (dr.discount === undefined) dr.discount = 0;
      c.appendChild(Fg('Item Name', Inp('', { type: 'text', value: dr.name || '', oninput: e => dr.name = e.target.value })));
      const calcHomeEdit = () => { const total = Math.max(0, (parseFloat(dr.unitPrice) || 0) * (parseFloat(dr.qty) || 1) - (parseFloat(dr.discount) || 0)); ai.value = total.toFixed(2); dr.amount = ai.value; };
      const g2 = D('g2');
      const qi = Inp('', { type: 'number', inputmode: 'decimal', value: dr.qty }); qi.oninput = e => { dr.qty = e.target.value; calcHomeEdit(); }; g2.appendChild(Fg('Qty', qi));
      const ui = Inp('', { type: 'number', inputmode: 'decimal', value: dr.unitPrice }); ui.oninput = e => { dr.unitPrice = e.target.value; calcHomeEdit(); }; g2.appendChild(Fg('Unit Price', ui));
      c.appendChild(g2);
      c.appendChild(Fg('Unit', Sel(dr.unit, UNITS, v => dr.unit = v, 'compact-select')));
      const dii = Inp('', { type: 'number', inputmode: 'decimal', value: dr.discount || '' }); dii.oninput = e => { dr.discount = e.target.value; calcHomeEdit(); }; c.appendChild(Fg('Discount (₱)', dii));
      const ai = Inp('', { type: 'number', inputmode: 'decimal', value: dr.amount, readonly: true }); c.appendChild(Fg('Total (₱)', ai));
      c.appendChild(Fg('Category', Sel(dr.category, homeCategories(d), v => dr.category = v, 'compact-select')));
      c.appendChild(Fg('Store', Sel(dr.store, homeStores(d), v => dr.store = v, 'compact-select')));
      c.appendChild(Fg('Note', Inp('', { type: 'text', value: dr.note || '', oninput: e => dr.note = e.target.value })));
    } else if (t === 'aircon') { // No margin-bottom here
      c.appendChild(Fg('Date', Inp('', { type: 'date', value: dr.date, oninput: e => dr.date = e.target.value })));
      c.appendChild(Fg('Start Time', Time12Control(dr.start, v => dr.start = v)));
      c.appendChild(Fg('End Time', Time12Control(dr.end, v => dr.end = v)));
      c.appendChild(Fg('Mode', Sel(airconModeLabel(dr.mode, dr.sleepMode), AIRCON_MODES, v => { dr.mode = v.toLowerCase(); dr.sleepMode = v.toLowerCase() === 'sleep'; set({ modal: 'edit' }); })));
      c.appendChild(Fg('Set Temp (°C)', Inp('', { type: 'number', inputmode: 'decimal', value: dr.tempC, oninput: e => dr.tempC = e.target.value })));
      c.appendChild(Fg('Room Temp (°C)', Inp('', { type: 'number', inputmode: 'decimal', value: dr.roomTemp, oninput: e => dr.roomTemp = e.target.value })));
      c.appendChild(Fg('Outdoor Temp (°C)', Inp('', { type: 'number', inputmode: 'decimal', value: dr.outdoorTemp, oninput: e => dr.outdoorTemp = e.target.value })));
      c.appendChild(Fg('Outdoor Feels Like (°C)', Inp('', { type: 'number', inputmode: 'decimal', value: dr.outdoorFeels, oninput: e => dr.outdoorFeels = e.target.value })));
      c.appendChild(Fg('Outdoor Humidity (%)', Inp('', { type: 'number', inputmode: 'decimal', value: dr.outdoorHumidity, oninput: e => dr.outdoorHumidity = e.target.value }))); // No margin-bottom here
    } else if (t === 'tv') {
      c.appendChild(Fg('Date', Inp('', { type: 'date', value: dr.date, oninput: e => dr.date = e.target.value })));
      c.appendChild(Fg('Start Time', Time12Control(dr.start, v => dr.start = v)));
      c.appendChild(Fg('End Time', Time12Control(dr.end, v => dr.end = v)));
    } else if (t === 'appliance') {
      if (!dr.qty) dr.qty = 1; if (!dr.sessionMinutes && !dr.alwaysOn) dr.sessionMinutes = 60;
      c.appendChild(Fg('Name', Inp('', { type: 'text', value: dr.name, oninput: e => dr.name = e.target.value })));
      c.appendChild(Fg('Category', Sel(dr.category || 'Others', applianceCategories(d), v => dr.category = v, 'compact-select')));
      const g2 = D('g2');
      g2.appendChild(Fg('Watts (W)', Inp('', { type: 'number', value: dr.watts, oninput: e => dr.watts = e.target.value })));
      g2.appendChild(Fg('Qty', Inp('', { type: 'number', value: dr.qty, oninput: e => dr.qty = e.target.value })));
      c.appendChild(g2); // No margin-bottom here
      const ar = D('row'); ar.style.cssText = 'justify-content:flex-start;gap:8px;margin:3px 0 12px';
      const acb = h('input', { type: 'checkbox', checked: dr.alwaysOn, style: 'width:18px;height:18px' });
      acb.onchange = e => { dr.alwaysOn = e.target.checked; set({}); };
      ar.appendChild(acb); ar.appendChild(h('span', { style: 'font-size:12.5px;font-weight:700;color:#3a2818' }, 'Runs 24/7')); c.appendChild(ar);
      if (!dr.alwaysOn) {
        c.appendChild(Fg('Default Minutes / Log', Inp('', { type: 'number', value: dr.sessionMinutes || 60, oninput: e => dr.sessionMinutes = e.target.value })));
      }
      c.appendChild(Fg('Note', Inp('', { type: 'text', value: dr.note || '', oninput: e => dr.note = e.target.value }))); // No margin-bottom here
    } else if (t === 'applianceUsage') {
      const appliances = (d.appliances || []).filter(a => !a.alwaysOn);
      c.appendChild(Fg('Appliance', Sel(dr.applianceId, appliances.map(a => a.id), v => { dr.applianceId = v; set({ modal: 'edit' }); }, 'compact-select')));
      c.appendChild(Fg('Date', Inp('', { type: 'date', value: dr.date, oninput: e => dr.date = e.target.value })));
      c.appendChild(Fg('Start Time', Time12Control(dr.start, v => dr.start = v)));
      c.appendChild(Fg('End Time', Time12Control(dr.end, v => dr.end = v)));
    } else if (t === 'price') {
      c.appendChild(Fg('Item Name', Inp('', { type: 'text', value: dr.name, oninput: e => dr.name = e.target.value }))); // No margin-bottom here
      c.appendChild(Fg('Price', Inp('', { type: 'number', inputmode: 'decimal', value: dr.price, oninput: e => dr.price = e.target.value })));
      c.appendChild(Fg('Store', Sel(dr.store, homeStores(d), v => dr.store = v, 'compact-select')));
      c.appendChild(Fg('Unit', Sel(dr.unit, UNITS, v => dr.unit = v, 'compact-select')));
      c.appendChild(Fg('Category', Sel(dr.category, ['Food', 'Home'], v => dr.category = v, 'compact-select')));
      if (dr.category === 'Food') {
        c.appendChild(Fg('Subcategory', Sel(dr.subcat, FCATS, v => dr.subcat = v, 'compact-select')));
      } else {
        c.appendChild(Fg('Subcategory', Sel(dr.subcat, HCATS, v => dr.subcat = v, 'compact-select')));
      } // No margin-bottom here
      c.appendChild(Fg('Note', Inp('', { type: 'text', value: dr.note || '', oninput: e => dr.note = e.target.value })));
    } else if (t === 'stock') {
      c.appendChild(Fg('Name', Inp('', { type: 'text', value: dr.name, oninput: e => dr.name = e.target.value })));
      c.appendChild(Fg('Category', Sel(dr.category, SCATS, v => dr.category = v, 'compact-select')));
      const g2 = D('g2');
      g2.appendChild(Fg('Quantity', Inp('', { type: 'number', value: dr.quantity, oninput: e => dr.quantity = e.target.value })));
      g2.appendChild(Fg('Min Qty', Inp('', { type: 'number', value: dr.minQty, oninput: e => dr.minQty = e.target.value })));
      c.appendChild(g2); // No margin-bottom here
      c.appendChild(Fg('Unit', Sel(dr.unit, UNITS, v => dr.unit = v, 'compact-select')));
      c.appendChild(Fg('Date', Inp('', { type: 'date', value: dr.date, oninput: e => dr.date = e.target.value })));
      c.appendChild(Fg('Note', Inp('', { type: 'text', value: dr.note || '', oninput: e => dr.note = e.target.value })));
    } else {
      c.appendChild(Fg('Name', Inp('', { type: 'text', value: dr.name || '', oninput: e => dr.name = e.target.value })));
      c.appendChild(Fg('Amount', Inp('', { type: 'number', inputmode: 'decimal', value: dr.amount, oninput: e => dr.amount = e.target.value })));
    }
    c.appendChild(Fg('Date', Inp('', { type: 'date', value: dr.date, oninput: e => dr.date = e.target.value })));
    c.appendChild(Btn('bp bfull', 'Save Changes', saveEdit));
    return M('Edit ' + t, c);
  }

  if (S.modal === 'airSet') {
    const c = D(''), f = S.airSetF;
    c.appendChild(DivHdr('Meralco Billing')); // No margin-bottom here
    const g1 = D('g2');
    const ri = Inp('', { type: 'number', inputmode: 'decimal', step: '0.0001', value: f.rate }); ri.oninput = e => f.rate = e.target.value;
    g1.appendChild(Fg('Rate (₱/kWh)', ri));
    const mdi = Inp('', { type: 'number', inputmode: 'decimal', value: f.readDay }); mdi.oninput = e => f.readDay = e.target.value;
    g1.appendChild(Fg('Read Day', mdi));
    c.appendChild(g1);
    c.appendChild(DivHdr('Default Preferences'));
    c.appendChild(Fg('Default Aircon Mode', Sel(airconModeLabel(f.defaultMode, f.defaultSleep), AIRCON_MODES, v => { f.defaultMode = v.toLowerCase(); f.defaultSleep = f.defaultMode === 'sleep'; }), 'Used by Start Aircon and new manual aircon sessions.'));
    const dti = Inp('', { type: 'number', inputmode: 'decimal', value: f.defaultTemp }); dti.oninput = e => f.defaultTemp = e.target.value;
    c.appendChild(Fg('Default Set Temp (C)', dti));
    const ca = Btn('bg', 'Cancel', () => set({ modal: null })); ca.style.flex = '1';
    const sa = Btn('bp', 'Save Settings', saveAirSet); sa.style.flex = '2';
    c.appendChild(Mr(ca, sa));
    return M('Electricity Config', c);
  }

  if (S.modal === 'airconProfile') {
    const c = D(''), p = S.airconProfileF;
    const mi = Inp('', { type: 'text', value: p.model || '' }); mi.oninput = e => p.model = e.target.value; c.appendChild(Fg('Indoor Model', mi));
    const oi = Inp('', { type: 'text', value: p.outdoorModel || '' }); oi.oninput = e => p.outdoorModel = e.target.value; c.appendChild(Fg('Outdoor Model', oi));
    const g1 = D('g2');
    const cki = Inp('', { type: 'number', inputmode: 'decimal', step: '0.001', value: p.coolingKw }); cki.oninput = e => p.coolingKw = e.target.value; g1.appendChild(Fg('Cooling kW', cki));
    const rwi = Inp('', { type: 'number', inputmode: 'decimal', step: '0.001', value: p.ratedWatts }); rwi.oninput = e => p.ratedWatts = e.target.value; g1.appendChild(Fg('Rated Watts', rwi));
    c.appendChild(g1);
    const g2 = D('g2');
    const mni = Inp('', { type: 'number', inputmode: 'decimal', step: '0.001', value: p.minWatts }); mni.oninput = e => p.minWatts = e.target.value; g2.appendChild(Fg('Min Watts', mni));
    const mxi = Inp('', { type: 'number', inputmode: 'decimal', step: '0.001', value: p.maxWatts }); mxi.oninput = e => p.maxWatts = e.target.value; g2.appendChild(Fg('Max Watts', mxi));
    c.appendChild(g2);
    const g3 = D('g2');
    const cfi = Inp('', { type: 'number', inputmode: 'decimal', step: '0.001', value: p.cspf }); cfi.oninput = e => p.cspf = e.target.value; g3.appendChild(Fg('CSPF', cfi));
    const dki = Inp('', { type: 'number', inputmode: 'decimal', step: '0.001', value: p.doeMonthlyKwh }); dki.oninput = e => p.doeMonthlyKwh = e.target.value; g3.appendChild(Fg('DOE Monthly kWh', dki));
    c.appendChild(g3);
    c.appendChild(DivHdr('Consumption Rates (kWh/hr)'));
    const sti = Inp('', { type: 'number', inputmode: 'decimal', step: '0.01', value: p.startup }); sti.oninput = e => p.startup = e.target.value; c.appendChild(Fg('Startup Rate (First 15-60m)', sti));
    const gr1 = D('g2');
    const sdi = Inp('', { type: 'number', inputmode: 'decimal', step: '0.01', value: p.sleepDay }); sdi.oninput = e => p.sleepDay = e.target.value; gr1.appendChild(Fg('Sleep Day', sdi));
    const sni = Inp('', { type: 'number', inputmode: 'decimal', step: '0.01', value: p.sleepNight }); sni.oninput = e => p.sleepNight = e.target.value; gr1.appendChild(Fg('Sleep Night', sni));
    c.appendChild(gr1);
    const gr2 = D('g2');
    const edi = Inp('', { type: 'number', inputmode: 'decimal', step: '0.01', value: p.ecoDay }); edi.oninput = e => p.ecoDay = e.target.value; gr2.appendChild(Fg('Eco Day', edi));
    const eni = Inp('', { type: 'number', inputmode: 'decimal', step: '0.01', value: p.ecoNight }); eni.oninput = e => p.ecoNight = e.target.value; gr2.appendChild(Fg('Eco Night', eni));
    c.appendChild(gr2);
    const gr3 = D('g2');
    const ndi = Inp('', { type: 'number', inputmode: 'decimal', step: '0.01', value: p.day }); ndi.oninput = e => p.day = e.target.value; gr3.appendChild(Fg('Normal Day', ndi));
    const nni = Inp('', { type: 'number', inputmode: 'decimal', step: '0.01', value: p.night }); nni.oninput = e => p.night = e.target.value; gr3.appendChild(Fg('Normal Night', nni));
    c.appendChild(gr3);
    c.appendChild(DivHdr('Temperature Co-efficients'));
    const tr1 = D('g2');
    const tbi = Inp('', { type: 'number', inputmode: 'decimal', value: p.tempBaseline }); tbi.oninput = e => p.tempBaseline = e.target.value; tr1.appendChild(Fg('Baseline Temp', tbi));
    const tsi = Inp('', { type: 'number', inputmode: 'decimal', value: p.tempStep }); tsi.oninput = e => p.tempStep = e.target.value; tr1.appendChild(Fg('Step % per C', tsi));
    c.appendChild(tr1);
    const tr2 = D('g2');
    const obi = Inp('', { type: 'number', inputmode: 'decimal', value: p.outdoorBaseline }); obi.oninput = e => p.outdoorBaseline = e.target.value; tr2.appendChild(Fg('Outdoor Baseline', obi));
    const osi = Inp('', { type: 'number', inputmode: 'decimal', value: p.outdoorStep }); osi.oninput = e => p.outdoorStep = e.target.value; tr2.appendChild(Fg('Outdoor Step %', osi));
    c.appendChild(tr2);
    const ca = Btn('bg', 'Cancel', () => set({ modal: null })); ca.style.flex = '1';
    const sa = Btn('bp', 'Save Profile', saveAirconProfile); sa.style.flex = '2';
    c.appendChild(Mr(ca, sa));
    return M('Edit Aircon Profile', c);
  }

  // TV Profile
  if (S.modal === 'tvProfile') {
    const c = D(''), f = S.tvProfileF;
    c.appendChild(Fg('TV Model', Inp('', { type: 'text', value: f.model, oninput: e => f.model = e.target.value }))); // No margin-bottom here
    c.appendChild(Fg('Power Consumption (W)', Inp('', { type: 'number', value: f.watts, oninput: e => f.watts = e.target.value })));
    c.appendChild(Btn('bp bfull', 'Save TV Profile', saveTvProfile));
    return M('TV Profile', c);
  }

  // Add Aircon Session Modal
  if (S.modal === 'addAircon') {
    const c = D('');
    const f = S.airconF;
    const d = S.data;
    const rates = airconRates(d); // No margin-bottom here
    const currentMode = airconModeFrom(f.mode, f.sleepMode);

    c.appendChild(Fg('Date', Inp('', { type: 'date', value: f.date, oninput: e => f.date = e.target.value })));
    c.appendChild(Fg('Start Time', Time12Control(f.start, v => f.start = v)));
    c.appendChild(Fg('End Time', Time12Control(f.end, v => f.end = v)));

    c.appendChild(Fg('Mode', Sel(airconModeLabel(f.mode, f.sleepMode), AIRCON_MODES, v => { f.mode = v.toLowerCase(); f.sleepMode = f.mode === 'sleep'; }), 'Uses the matching day/night kWh/hr rates from Electricity Config.'));
    const ti = Inp('', { type: 'number', inputmode: 'decimal', placeholder: 'e.g. 29', value: f.tempC || '' }); ti.oninput = e => f.tempC = e.target.value; c.appendChild(Fg('Aircon Set Temp (C)', ti, `Adjusts running kWh after the first hour from a ${S.data.airconTempBaseline || 29}C baseline.`));
    const rti = Inp('', { type: 'number', inputmode: 'decimal', placeholder: 'Optional, from digital clock', value: f.roomTemp || '' }); rti.oninput = e => f.roomTemp = e.target.value; c.appendChild(Fg('Current Room Temp (C)', rti, 'Saved as context only for now.'));

    const w = d.weather || {};
    c.appendChild(Fg('Outdoor Temp (°C)', Inp('', { type: 'number', inputmode: 'decimal', value: f.outdoorTemp ?? w.temp ?? '', oninput: e => f.outdoorTemp = e.target.value })));
    c.appendChild(Fg('Outdoor Feels Like (°C)', Inp('', { type: 'number', inputmode: 'decimal', value: f.outdoorFeels ?? w.apparent ?? '', oninput: e => f.outdoorFeels = e.target.value })));
    c.appendChild(Fg('Outdoor Humidity (%)', Inp('', { type: 'number', inputmode: 'decimal', value: f.outdoorHumidity ?? w.humidity ?? '', oninput: e => f.outdoorHumidity = e.target.value })));

    const session = airconSessionFromParts(f.date, f.start, f.end, currentMode, rates, f.tempC, f.outdoorTemp, d);
    if (session && session.minutes > 0) {
      const estCost = session.kwh * d.meralcoRate;
      c.appendChild(h('div', { cls: 'soft-panel', style: 'margin-top:12px' },
        h('div', { cls: 'lbl' }, 'Estimate'),
        h('div', { cls: 'sf', style: 'font-size:18px' }, `${session.kwh.toFixed(3)} kWh · ${fmt2(estCost)}`),
        h('div', { style: 'font-size:10.5px;color:#8a7260' }, `${durationLabel(session.minutes)} · @${d.meralcoRate}/kWh`)
      ));
    }

    const hasActiveAircon = (S.data.activeSessions || []).some(s => s.type === 'aircon');
    const ca = Btn('bg', 'Cancel', () => set({ modal: null })); ca.style.flex = '1';
    const st = Btn('bg', 'Start Timer', () => { startActiveSession('aircon', S.airconF); set({ modal: null }); }, hasActiveAircon); st.style.flex = '1.4';
    const sa = Btn('bp', 'Log Usage', addAircon); sa.style.flex = '1.6'; c.appendChild(Mr(ca, st, sa)); return M('Log Aircon Usage', c);
  }




  // Add TV Session Modal
  if (S.modal === 'addTv') {
    const c = D('');
    const f = S.tvF;
    const d = S.data;

    c.appendChild(Fg('Date', Inp('', { type: 'date', value: f.date, oninput: e => f.date = e.target.value })));
    c.appendChild(Fg('Start Time', Time12Control(f.start, v => f.start = v)));
    c.appendChild(Fg('End Time', Time12Control(f.end, v => f.end = v)));

    const sm = minsOfDay(f.start), em = minsOfDay(f.end);
    let minutes = 0;
    if (!isNaN(sm) && !isNaN(em)) {
      minutes = em - sm;
      if (minutes <= 0) minutes += 1440;
    }
    const hours = minutes / 60;
    const watts = parseFloat(d.tvWatts) || 175;
    const kwh = (watts / 1000) * hours;
    const cost = kwh * d.meralcoRate;

    c.appendChild(h('div', { cls: 'soft-panel', style: 'margin-top:12px' },
      h('div', { cls: 'lbl' }, 'Estimate'),
      h('div', { cls: 'sf', style: 'font-size:18px' }, `${kwh.toFixed(3)} kWh · ${fmt2(cost)}`),
      h('div', { style: 'font-size:10.5px;color:#8a7260' }, `${durationLabel(minutes)} · ${watts}W · @${d.meralcoRate}/kWh`)
    ));

    const hasActiveTv = (S.data.activeSessions || []).some(s => s.type === 'tv');
    const ca = Btn('bg', 'Cancel', () => set({ modal: null })); ca.style.flex = '1';
    const st = Btn('bg', 'Start Timer', () => { startActiveSession('tv'); set({ modal: null }); }, hasActiveTv); st.style.flex = '1.4';
    const sa = Btn('bp', 'Log TV', addTv); sa.style.flex = '1.6'; c.appendChild(Mr(ca, st, sa)); return M('Log TV Usage', c);
  }




  // Log Appliance Session Modal
  if (S.modal === 'logAppliance') {
    const c = D('');
    const f = S.applianceSessionF;
    const d = S.data;
    const appliances = (d.appliances || []).filter(a => !a.alwaysOn);
    const selectedAppliance = appliances.find(a => String(a.id) === String(f.applianceId)) || appliances[0]; // Ensure selectedAppliance is always valid

    c.appendChild(Fg('Appliance', Sel(f.applianceId, appliances.map(a => a.id), v => { f.applianceId = v; set({ modal: 'logAppliance' }); })));
    c.lastChild.querySelector('select').querySelectorAll('option').forEach(op => { const ap = appliances.find(a => a.id === op.value); if (ap) op.textContent = ap.name + (ap.watts ? ` - ${ap.watts}W` : ''); });
    c.appendChild(Fg('Date', Inp('', { type: 'date', value: f.date, oninput: e => f.date = e.target.value })));
    c.appendChild(Fg('Start Time', Time12Control(f.start, v => f.start = v)));
    c.appendChild(Fg('End Time', Time12Control(f.end, v => f.end = v)));

    const sm = minsOfDay(f.start), em = minsOfDay(f.end);
    let minutes = 0;
    if (!isNaN(sm) && !isNaN(em)) {
      minutes = em - sm;
      if (minutes <= 0) minutes += 1440;
    }
    f.minutes = String(minutes);

    if (selectedAppliance) {
      const est = applianceSessionEstimate(selectedAppliance, minutes, d.meralcoRate);
      c.appendChild(h('div', { cls: 'soft-panel', style: 'margin-top:12px' },
        h('div', { cls: 'lbl' }, 'Estimate'),
        h('div', { cls: 'sf', style: 'font-size:18px' }, `${est.kwh.toFixed(3)} kWh · ${fmt2(est.cost)}`),
        h('div', { style: 'font-size:10.5px;color:#8a7260' }, `${durationLabel(minutes)} · ${selectedAppliance.watts}W · ${selectedAppliance.qty}x · @${d.meralcoRate}/kWh`)
      ));
    }

    const ca = Btn('bg', 'Cancel', () => set({ modal: null })); ca.style.flex = '1';
    const st = Btn('bg', 'Start Timer', () => { startActiveSession('appliance', { applianceId: f.applianceId }); set({ modal: null }); }); st.style.flex = '1.4';
    const sa = Btn('bp', 'Log Appliance', addApplianceUsage); sa.style.flex = '1.6'; c.appendChild(Mr(ca, st, sa)); return M('Log Appliance', c);
  }


  // Settings Modal
  if (S.modal === 'settings') {
    const c = D(''), f = S.settingsF; // No margin-bottom here
    const syncCard = D('');
    syncCard.className = 'soft-panel card'; // Added .card class
    syncCard.style.cssText = 'padding:10px 11px;margin-bottom:12px';
    syncCard.appendChild(h('div', { cls: 'settings-theme-title' }, 'Cloud Sync'));
    syncCard.appendChild(h('div', { cls: 'settings-theme-sub', style: 'margin-bottom:7px' }, syncLabel()));
    const syncTimes = D('');
    syncTimes.style.cssText = 'display:grid;grid-template-columns:1fr;gap:2px;font-size:10.5px;color:#8a7260;line-height:1.4;margin-bottom:9px';
    syncTimes.appendChild(h('div', {}, 'Last updated: ' + syncTimeLabel(S.data.modifiedAt))); // No margin-bottom here
    syncTimes.appendChild(h('div', {}, 'Last synced: ' + syncTimeLabel(S.data.syncedAt)));
    syncCard.appendChild(syncTimes);
    if (S.syncErr) syncCard.appendChild(h('div', { style: 'font-size:10.5px;color:#b83030;line-height:1.4;margin-bottom:9px' }, S.syncErr));
    const syncBtns = D('');
    syncBtns.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px';
    if (S.user) {
      syncBtns.appendChild(Btn('bp', 'Sync & Snapshot', manualSync, S.syncSaving));
      syncBtns.appendChild(Btn('bg', 'Sign Out', cloudSignOut, S.syncSaving));
      const recRow = D(''); recRow.style.cssText = 'grid-column: span 2; display: flex; gap: 7px; margin-top: 4px';
      recRow.appendChild(Btn('bgsm', 'Restore from History', openRestorePicker, S.syncSaving));
      recRow.appendChild(Btn('bgsm', 'Reset Device', resetLocalData, S.syncSaving));
      syncBtns.appendChild(recRow);
    } else {
      syncBtns.appendChild(Btn('bp', 'Google Sign In', () => cloudSignIn('google'), S.syncSaving));
      syncBtns.appendChild(Btn('bg', 'Apple Sign In', () => cloudSignIn('apple'), S.syncSaving));
    }
    syncCard.appendChild(syncBtns);
    c.appendChild(syncCard);

    const themeCard = D('settings-theme-card card'); // Added .card class
    const themeCopy = D('');
    if (!f.theme) f.theme = themeFromData(S.data);
    themeCopy.appendChild(h('div', { cls: 'settings-theme-title' }, 'Theme'));
    themeCopy.appendChild(h('div', { cls: 'settings-theme-sub' }, themeLabel(f.theme)));
    const themeRight = D('settings-theme-right');
    const themeToggle = D('theme-segmented');
    [['light', 'sun', 'Light'], ['dark', 'moon', 'Dark'], ['nebula', 'northStar', 'Nebula']].forEach(([value, icon, label]) => {
      const active = f.theme === value;
      const btn = h('button', { cls: 'theme-option' + (active ? ' theme-option-on' : ''), type: 'button', 'aria-pressed': active ? 'true' : 'false', 'aria-label': label, onClick: () => { const newTheme = value; const newDarkMode = (value === 'dark'); setD(d => ({ ...d, theme: newTheme, darkMode: newDarkMode })); set({ settingsF: { ...f, theme: newTheme, darkMode: newDarkMode } }); } });
      btn.appendChild(iconEl(icon, 'theme-option-icon app-icon'));
      themeToggle.appendChild(btn);
    });
    themeCard.appendChild(themeCopy);
    themeRight.appendChild(themeToggle);
    themeCard.appendChild(themeRight);
    c.appendChild(themeCard);
    // No margin-bottom here
    const vInfo = h('div', { style: 'text-align:center;font-size:10px;color:#8a7260;margin:4px 0 16px;opacity:0.6' }, `Kipr v${APP_VERSION} · Schema v${SCHEMA_VERSION}`);
    c.appendChild(vInfo);

    const gk = Inp('', { type: 'password', placeholder: 'AIza...', value: f.geminiKey ?? '' }); gk.oninput = e => f.geminiKey = e.target.value; c.appendChild(Fg('Gemini API Key', gk, 'Stored only in this browser.'));
    c.appendChild(Fg('Weather Provider', Sel(f.weatherProvider || 'open-meteo', ['open-meteo'], v => f.weatherProvider = v), 'Open-Meteo does not need an API key.'));
    const wl = Inp('', { type: 'text', value: f.weatherLabel ?? '' }); wl.oninput = e => f.weatherLabel = e.target.value; c.appendChild(Fg('Location Label', wl));
    const g2 = D('g2');
    const latFg = D('fg'); latFg.appendChild(h('label', { cls: 'fl' }, 'Latitude')); const lati = Inp('', { type: 'number', inputmode: 'decimal', step: '0.00001', value: f.weatherLat ?? '' }); lati.oninput = e => f.weatherLat = e.target.value; latFg.appendChild(lati); g2.appendChild(latFg);
    const lonFg = D('fg'); lonFg.appendChild(h('label', { cls: 'fl' }, 'Longitude')); const loni = Inp('', { type: 'number', inputmode: 'decimal', step: '0.00001', value: f.weatherLon ?? '' }); loni.oninput = e => f.weatherLon = e.target.value; lonFg.appendChild(loni); g2.appendChild(lonFg); c.appendChild(g2);
    const g3 = D('g2');
    const elFg = D('fg'); elFg.appendChild(h('label', { cls: 'fl' }, 'Elevation (m)')); const eli = Inp('', { type: 'number', inputmode: 'decimal', step: '0.1', value: f.weatherElevation ?? '' }); eli.oninput = e => f.weatherElevation = e.target.value; elFg.appendChild(eli); g3.appendChild(elFg);
    const wkFg = D('fg'); wkFg.appendChild(h('label', { cls: 'fl' }, 'Weather API Key')); const wki = Inp('', { type: 'password', placeholder: 'Optional', value: f.weatherApiKey ?? '' }); wki.oninput = e => f.weatherApiKey = e.target.value; wkFg.appendChild(wki); g3.appendChild(wkFg);
    c.appendChild(g3);
    // No margin-bottom here
    c.appendChild(h('p', { style: 'font-size:11px;color:#8a7260;line-height:1.5;margin-bottom:10px' }, 'Coordinates are used to fetch outdoor weather from Open-Meteo to help calibrate aircon consumption.'));
    const pref = Btn('bgfull', 'Lists & Defaults', openListsDefaults); pref.style.marginBottom = '10px'; c.appendChild(pref);
    const acts = D(''); acts.style.cssText = 'display:flex;gap:7px';
    acts.appendChild(Btn('bg', 'Cancel', () => set({ modal: null })));
    acts.appendChild(Btn('bg', 'Refresh Weather', () => updateWeather(true)));
    acts.appendChild(Btn('bp', 'Save Settings', saveSettings));
    c.appendChild(acts);
    return M('Settings', c);
  }

  if (S.modal === 'restorePicker') {
    const c = D('');
    c.appendChild(h('p', { style: { fontSize: '12px', color: '#8a7260', lineHeight: '1.5', marginBottom: isPhone() ? '12px' : '0' } }, 'Select a snapshot from your sync history to restore. This will replace your current device data.'));
    const list = D('card'); // Card margin handled by global .card
    const points = S.restorePoints || [];
    if (points.length) {
      points.forEach(p => {
        const row = D('row cr row-line');
        const left = D(''); left.style.flex = '1';
        left.appendChild(h('div', { style: 'font-size:13px;font-weight:600' }, syncTimeLabel(p.ts)));
        left.appendChild(h('div', { style: 'font-size:10px;color:#8a7260;font-family:monospace' }, p.id.split(':')[1] || p.id));
        row.appendChild(left);
        row.appendChild(Btn('bgsm', 'Restore', () => restoreFromSnapshot(p.id)));
        list.appendChild(row);
      });
    } else list.appendChild(Object.assign(D('empty'), { textContent: 'No history snapshots found.' }));
    c.appendChild(list);
    c.appendChild(Btn('bp bfull', 'Close', () => set({ modal: null })));
    return M('Restore History', c);
  }

  if (S.modal === 'manageProfiles') {
    const c = D('');
    const profiles = S.fullUserData['meta|settings']?.data?.profiles || S.data.profiles || [];
    const activeId = S.fullUserData['meta|settings']?.data?.activeProfileId || S.data.activeProfileId; // No margin-bottom here

    c.appendChild(h('p', { style: 'font-size:12px;color:#8a7260;line-height:1.5;margin-bottom:20px' }, 'Create multiple profiles to isolate different sets of data (e.g., Personal vs Business). Global settings like themes and budgets are shared.')); // Adjusted margin-bottom

    const list = D('card');
    profiles.forEach(p => {
      const isActive = p.id === activeId;
      const row = D('row cr row-line');
      row.style.padding = '10px 12px';

      const left = D(''); left.style.cssText = 'flex:1;min-width:0';
      const nameLine = D('row'); nameLine.style.cssText = 'justify-content:flex-start;gap:8px;align-items:center';
      nameLine.appendChild(h('span', { style: `font-size:14px;font-weight:700;${isActive ? 'color:var(--p-text)' : ''}` }, p.name));
      if (isActive) nameLine.appendChild(Sp('tag-c', 'ACTIVE'));
      left.appendChild(nameLine);

      const acts = D('row'); acts.style.cssText = 'gap:10px;margin-top:5px';
      if (!isActive) {
        acts.appendChild(h('button', { style: 'font-size:11px;color:var(--amber);background:none;border:none;padding:0;cursor:pointer;font-weight:600', onClick: () => switchProfile(p.id) }, 'Switch'));
      }
      acts.appendChild(h('button', { style: 'font-size:11px;color:#8a7260;background:none;border:none;padding:0;cursor:pointer', onClick: () => { const n = prompt('Rename profile:', p.name); if (n && n.trim()) renameProfile(p.id, n.trim()); } }, 'Rename'));
      if (p.id !== 'main') {
        acts.appendChild(h('button', { style: 'font-size:11px;color:#b83030;background:none;border:none;padding:0;cursor:pointer', onClick: () => deleteProfile(p.id) }, 'Delete'));
      }
      left.appendChild(acts);
      row.appendChild(left);
      list.appendChild(row);
    });
    c.appendChild(list);

    const addBtn = Btn('bgfull', '+ Create New Profile', () => { const n = prompt('New Profile Name:'); if (n && n.trim()) addProfile(n.trim()); });
    addBtn.style.marginBottom = '20px'; // Adjusted margin-bottom
    c.appendChild(addBtn);
    c.appendChild(Btn('bp bfull', 'Close', () => set({ modal: null })));
    return M('Manage Profiles', c);
  }

  return null;
}