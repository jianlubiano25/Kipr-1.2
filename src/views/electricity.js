import { S, set } from '../state.js';
import { h, D, Btn, BtnI, Sel, DivHdr, Fg, metricTiles, swRow, Sp, auditDateBadge, Inp, dateBadgeClass, dateSpanLabel, logSortDate } from '../utils/domHelpers.js';
import { fmt, fmt2 } from '../utils/formatters.js';
import { dateOf, timeOf, fmtTime12, durationLabel, toStr, dtOf, curMk } from '../utils/dateUtils.js';
import {
  meralcoReadDay, cycleForDate, cycleLabel, inCycle, cycleDateRange,
  applianceAlwaysOnEstimate, usageCostInRange, usageKwhInRange, airconModeFrom, airconModeLabel,
  timedSessionDraft, applianceSessionDraft, renderWeatherCard, electricityDailyChart,
  electricityCycleEstimate, meralcoKwhForCycle, applianceLabel,
  alwaysOnSinceLabel, meterAudit, usageDateRange, auditApplianceKwhInRange, cycleDays
} from '../utils/electricityUtils.js';
import {
  turnOffAlwaysOnAppliance, openEdit, delAppliance,
  delAircon, delTv, delApplianceUsage,
  stopActiveSession, cancelActiveSession,
  startActiveSession
} from '../actions.js';

import { renderCurrentlyOn } from '../components/electricity.js'; // Corrected path

const isPhone = () => window.innerWidth <= 768; // Define breakpoint for phone

export function renderMeterAudit() {
  const data = S.data, f = S.auditF, a = meterAudit(data, f), card = D('card meter-audit-card');
  const hdr = D('row');
  hdr.className = 'row section-hdr'; hdr.style.cssText = 'cursor:pointer;gap:8px';
  const left = D(''); left.style.cssText = 'flex:1;min-width:0';
  left.appendChild(h('span', { style: 'font-weight:700;font-size:13px' }, 'Meter Audit'));
  if (a.valid) {
    const sub = h('div', { style: 'font-size:10px;color:#8a7260;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, `${a.meterKwh.toFixed(2)} kWh meter · ${a.meterKwh ? Math.round(a.matchPct) + '% matched · ' : ''}${a.gap >= 0 ? '+' : ''}${a.gap.toFixed(2)} kWh gap`);
    left.appendChild(sub);
  }
  hdr.appendChild(left);
  hdr.appendChild(h('span', { style: 'font-size:16px;color:#8a7260;flex-shrink:0' }, S.auditOpen ? '▴' : '▾'));
  hdr.onclick = () => set({ auditOpen: !S.auditOpen });
  card.appendChild(hdr);
  if (!S.auditOpen) return card;
  const cp = D('cp'); // No margin-bottom here
  const grid = D('g2'); grid.style.marginBottom = '8px';
  const addField = (label, key, type = 'text', step = '') => {
    const input = Inp('', { type, value: f[key] || '', ...(step ? { step } : {}) });
    input.oninput = e => S.auditF[key] = e.target.value;
    grid.appendChild(Fg(label, input));
  };
  addField('Start Date', 'startDate', 'date');
  addField('Start Time', 'startTime', 'time');
  addField('End Date', 'endDate', 'date');
  addField('End Time', 'endTime', 'time');
  addField('Start Read', 'startRead', 'number', '0.001');
  addField('End Read', 'endRead', 'number', '0.001');

  cp.appendChild(grid); // No margin-bottom here
  const run = Btn('bgfull', 'Run Audit', () => set({ auditF: { ...S.auditF } })); run.style.marginBottom = '8px'; cp.appendChild(run);
  if (!a.valid) {
    cp.appendChild(h('div', { style: 'font-size:11px;color:#8a7260;line-height:1.5' }, a.error));
    card.appendChild(cp); return card;
  }
  const closeGap = a.meterKwh ? Math.abs(a.gap) <= Math.max(1, a.meterKwh * 0.1) : false;
  const gapColor = closeGap ? '#2e6e4f' : a.gap > 0 ? '#b8720c' : '#8b2d2d';
  cp.appendChild(metricTiles([
    { label: 'Meter', value: `${a.meterKwh.toFixed(2)} kWh`, color: '#3a2818' },
    { label: 'App Est.', value: `${a.estimatedKwh.toFixed(2)} kWh`, color: '#1a56c4' },
    { label: 'Matched', value: a.meterKwh ? `${Math.round(a.matchPct)}%` : '--', color: closeGap ? '#2e6e4f' : gapColor },
    { label: 'Gap', value: `${a.gap >= 0 ? '+' : ''}${a.gap.toFixed(2)} kWh`, color: gapColor }
  ], true));
  cp.appendChild(h('div', { style: { fontSize: '10.5px', color: '#8a7260', lineHeight: '1.5', marginTop: '7px' } }, `${durationLabel(a.hours * 60)} window · ${a.meterKwh ? Math.round(a.matchPct) + '% matched · ' : ''}Sessions ${a.loggedKwh.toFixed(2)} kWh · 24/7 ${a.alwaysKwh.toFixed(2)} kWh · ${fmt2(a.estimatedKwh * a.rate)} estimated. Positive gap means meter used more than logged.`));
  const parts = D('g2'); parts.style.marginTop = '8px';
  [
    ['Aircon', a.airconKwh, a.aircon.length],
    ['TV', a.tvKwh, a.tv.length],
    ['Sessions', a.sessionKwh, a.appliances.length],
    ['24/7', a.alwaysKwh, a.alwaysRows.length]
  ].forEach(([label, kwh, count]) => {
    const box = D('soft-panel'); box.style.padding = '7px';
    box.appendChild(h('div', { cls: 'lbl' }, label));
    box.appendChild(h('div', { cls: 'sf', style: 'font-size:15px;margin-top:1px' }, `${kwh.toFixed(3)} kWh`));
    box.appendChild(h('div', { style: 'font-size:9.5px;color:#8a7260' }, `${count} item${count !== 1 ? 's' : ''}`));
    parts.appendChild(box);
  }); // No margin-bottom here
  cp.appendChild(parts);
  const shortDate = dt => dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const rangeLabel = (s, e) => shortDate(s) === shortDate(e) ? shortDate(s) : `${shortDate(s)}-${shortDate(e)}`;
  const auditInfo = (u) => {
    const r = usageDateRange(u, a.start, a.end);
    if (!r) return { minutes: 0, dateLabel: u.date ? shortDate(dtOf(u.date)) : '', dateClass: u.date ? dateBadgeClass(u.date) : '', time: 'date only', sortAt: u.date ? dtOf(u.date).getTime() : 0 };
    const os = new Date(Math.max(r.s, a.start)), oe = new Date(Math.min(r.e, a.end));
    const minutes = Math.max(0, Math.round((oe - os) / 60000));
    const hasExactTime = !!(u.start || u.end || u.startDate || u.endDate || u.startedAt || u.endedAt);
    const badgeDate = hasExactTime ? dateOf(os) : u.date;
    return {
      minutes: hasExactTime ? minutes : (parseFloat(u.minutes) || minutes),
      dateLabel: hasExactTime ? rangeLabel(os, oe) : shortDate(dtOf(u.date)),
      dateClass: dateBadgeClass(badgeDate),
      time: hasExactTime ? `${fmtTime12(timeOf(os))}-${fmtTime12(timeOf(oe))}` : 'date only',
      sortAt: (hasExactTime ? oe : dtOf(u.date)).getTime()
    };
  };
  const rows = [
    ...a.aircon.map(u => { const info = auditInfo(u); return { type: 'Aircon', name: `${airconModeLabel(u.mode, u.sleepMode)} · ${durationLabel(info.minutes)}`, date: u.date, dateLabel: info.dateLabel, dateClass: info.dateClass, time: info.time, sortAt: info.sortAt, kwh: usageKwhInRange(u, a.start, a.end) }; }),
    ...a.tv.map(u => { const info = auditInfo(u); return { type: 'TV', name: durationLabel(info.minutes), date: u.date, dateLabel: info.dateLabel, dateClass: info.dateClass, time: info.time, sortAt: info.sortAt, kwh: usageKwhInRange(u, a.start, a.end) }; }),
    ...a.appliances.map(u => { const info = auditInfo(u); return { type: 'Appliance', name: `${u.name} · ${durationLabel(info.minutes)}`, date: u.date, dateLabel: info.dateLabel, dateClass: info.dateClass, time: info.time, sortAt: info.sortAt, kwh: auditApplianceKwhInRange(u, a.start, a.end) }; }),
    ...a.alwaysRows.map(u => ({ type: '24/7', name: `${u.name} · ${durationLabel(a.hours * 60)}`, date: 'whole window', dateLabel: rangeLabel(a.start, a.end), dateClass: dateBadgeClass(dateOf(a.start)), time: `${parseFloat(u.watts) || 0}W x ${parseFloat(u.qty) || 1}`, sortAt: a.end.getTime(), kwh: u.kwh }))
  ].sort((x, y) => (y.sortAt || 0) - (x.sortAt || 0) || String(y.time).localeCompare(String(x.time)));
  const list = D(''); list.style.marginTop = '8px';
  rows.forEach(r => {
    const row = D('row'); row.style.cssText = 'border-top:1px solid #e8e0d5;padding:7px 0;gap:8px;align-items:flex-start';
    const left = D(''); left.style.cssText = 'flex:1;min-width:0';
    left.appendChild(h('div', { style: 'font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, `${r.type} · ${r.name}`));
    const meta = D(''); meta.style.cssText = 'font-size:10px;color:#8a7260;margin-top:2px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;line-height:1.35';
    meta.appendChild(auditDateBadge(r));
    meta.appendChild(h('span', {}, r.time));
    left.appendChild(meta);
    row.appendChild(left);
    row.appendChild(h('div', { cls: 'sf', style: 'font-size:13px;flex-shrink:0' }, `${(parseFloat(r.kwh) || 0).toFixed(3)} kWh`));
    list.appendChild(row);
  }); // No margin-bottom here
  if (rows.length) cp.appendChild(list);
  card.appendChild(cp);
  return card;
}

export function renderElectricity() {
  const data = S.data, sec = D('sec');
  const usage = data.airconUsage || [], tvUsage = data.tvUsage || [], appliances = data.appliances || [], applianceUsage = data.applianceUsage || [];
  const readDay = meralcoReadDay(data);
  // Collect all possible dates from all logs to ensure every relevant cycle appears in the selector
  const cycleSeeds = [
    ...usage, ...tvUsage, ...applianceUsage,
    ...applianceUsage.filter(u => u.startDate).map(u => ({ date: u.startDate })),
    ...applianceUsage.filter(u => u.endDate).map(u => ({ date: u.endDate })),
    { date: dateOf(new Date()) }
  ];
  const cycleMap = new Map(cycleSeeds.map(e => {
    const d = e.date || e.startDate || e.endDate;
    const c = cycleForDate(d, readDay);
    return [c.key, c];
  }));
  const cycles = [...cycleMap.values()].sort((a, b) => b.key.localeCompare(a.key));
  
  const isCycleKey = (k) => String(k).match(/^\d{4}-\d{2}-\d{2}$/);
  // Improved sanitization: only reset if the key is invalid OR it's a month key (YYYY-MM) from another tab
  const needsReset = !S.viewMk || !isCycleKey(S.viewMk) || !cycles.some(c => c.key === S.viewMk);
  if (cycles.length && needsReset) S.viewMk = cycleForDate(new Date(), readDay).key;

  const selectedCycle = cycles.find(c => c.key === S.viewMk) || cycleForDate(new Date(), readDay);
  const mUsage = usage.filter(u => inCycle(u, selectedCycle)).sort((a, b) => String(logSortDate(b)).localeCompare(String(logSortDate(a))) || String(b.start || '').localeCompare(String(a.start || '')));
  const mTv = tvUsage.filter(u => inCycle(u, selectedCycle)).sort((a, b) => String(logSortDate(b)).localeCompare(String(logSortDate(a))) || String(b.start || '').localeCompare(String(a.start || '')));
  const mApplianceUsage = applianceUsage.filter(u => inCycle(u, selectedCycle)).sort((a, b) => String(logSortDate(b)).localeCompare(String(logSortDate(a))) || String(b.end || '').localeCompare(String(a.end || '')));
  const selectedRange = cycleDateRange(selectedCycle);
  const mCost = mUsage.reduce((s, u) => s + usageCostInRange(u, selectedRange.start, selectedRange.end), 0);
  const tvCost = mTv.reduce((s, u) => s + usageCostInRange(u, selectedRange.start, selectedRange.end), 0);
  const alwaysOn = appliances.filter(a => a.alwaysOn);
  const alwaysOnCycleEst = alwaysOn.reduce((s, a) => {
    const est = applianceAlwaysOnEstimate(a, selectedRange.start, selectedRange.end, data.meralcoRate);
    return { cost: s.cost + est.cost, kwh: s.kwh + est.kwh };
  }, { cost: 0, kwh: 0 });
  const alwaysOnCost = alwaysOnCycleEst.cost;
  const alwaysOnKwh = alwaysOnCycleEst.kwh;
  const applianceSessionCost = mApplianceUsage.reduce((s, u) => s + usageCostInRange(u, selectedRange.start, selectedRange.end), 0);
  const applianceSessionKwh = mApplianceUsage.reduce((s, u) => s + usageKwhInRange(u, selectedRange.start, selectedRange.end), 0);
  const applianceCost = alwaysOnCost + applianceSessionCost, applianceKwh = alwaysOnKwh + applianceSessionKwh;
  const mHours = mUsage.reduce((s, u) => s + u.hours, 0);
  const airconKwh = mUsage.reduce((s, u) => s + u.kwh, 0);
  const tvHours = mTv.reduce((s, u) => s + u.hours, 0);
  const tvKwh = mTv.reduce((s, u) => s + u.kwh, 0);
  const meralcoCycleKwh = meralcoKwhForCycle(selectedCycle, data);
  const estimatedCycleKwh = airconKwh + tvKwh + applianceKwh;
  const displayCycleKwh = meralcoCycleKwh || estimatedCycleKwh;
  const meralcoDailyKwh = meralcoCycleKwh ? meralcoCycleKwh / cycleDays(selectedCycle) : 0;
  const eChart = electricityDailyChart(selectedCycle, data, '7'); // No margin-bottom here
  const maxECost = Math.max(...eChart.map(x => x.cost), 1);

  const toprow = D('row');
  toprow.classList.add('electric-toprow');

  const cycleSel = Sel(S.viewMk, cycles.map(c => c.key), v => set({ viewMk: v }));
  cycleSel.classList.add('compact-select'); cycleSel.style.maxWidth = '160px';
  [...cycleSel.options].forEach(o => { const c = cycles.find(x => x.key === o.value); if (c) o.text = cycleLabel(c); });
  const titleWrap = D(''); titleWrap.appendChild(h('div', { style: 'font-size:14px;font-weight:700' }, 'Electricity Usage')); titleWrap.appendChild(cycleSel);
  toprow.appendChild(titleWrap);
  const topActs = D(''); topActs.style.cssText = 'display:flex;gap:6px';
  topActs.appendChild(Btn('bgsm', 'Appliances', () => set({ tab: 'appliances' })));
  topActs.appendChild(BtnI('bgsm', 'settings', 'Config', () => {
    const d = S.data;
    set({
      modal: 'airSet', airSetF: {
        monthKey: billMonthFromCycle(selectedCycle),
        rate: String(meralcoRateForMonth(billMonthFromCycle(selectedCycle), d)),
        readDay: String(d.meralcoReadDay || 12),
        defaultMode: airconModeFrom(d.airconDefaultMode, d.airconDefaultSleepMode),
        defaultSleep: d.airconDefaultSleepMode !== false,
        defaultTemp: String(d.airconDefaultTemp || '29')
      }
    });
  }));
  toprow.appendChild(topActs);
  sec.appendChild(toprow);

  const electricSummary = D('electric-summary-section');
  const est = electricityCycleEstimate(selectedCycle, data);
  const projCost = est.projectedKwh * (data.meralcoRate || 14.3345);

  const hero = D('card cg electric-hero-card');
  let heroInner = `<div class="cp"><div class="lblw">${cycleLabel(selectedCycle)} Est. Electricity</div><div class="sf" style="font-size:32px;color:#fff;margin:2px 0">${fmt2(mCost + tvCost + applianceCost)}</div>`;
  if (est.isCurrent && !meralcoCycleKwh) {
    heroInner += `<div style="font-size:11px;color:rgba(255,255,255,.75)">Projected Bill: <strong style="color:#ffd07a">${fmt(projCost)}</strong> (${est.projectedKwh.toFixed(1)} kWh)</div>`;
  } else {
    heroInner += `<div style="font-size:11px;color:rgba(255,255,255,.55)">Total ${displayCycleKwh.toFixed(2)} kWh${meralcoCycleKwh ? ' Meralco' : ' estimated'} · Read day ${readDay}</div>`;
  }
  heroInner += `<div style="font-size:10px;color:rgba(255,255,255,.4);margin-top:4px">24/7 ${fmt2(alwaysOnCost)} · Sessions ${fmt2(applianceSessionCost)} · Aircon ${fmt2(mCost)} · TV ${fmt2(tvCost)}</div></div>`;
  hero.innerHTML = heroInner;
  electricSummary.appendChild(hero);

  electricSummary.appendChild(renderWeatherCard(data, { title: 'Outdoor Weather' })); // No margin-bottom here

  const metrics = D('electric-metrics-grid');
  const kwhCard = D('card electric-kwh-card'); kwhCard.innerHTML = `<div class="cp"><div class="lbl">Total kWh This Cycle</div><div class="sf" style="font-size:24px;margin:2px 0">${displayCycleKwh.toFixed(2)} kWh</div><div style="font-size:10.5px;color:#8a7260">${meralcoCycleKwh ? 'From Meralco bill input' : 'Estimated from logs'} · Aircon ${airconKwh.toFixed(2)} · TV ${tvKwh.toFixed(2)} · Appliances ${applianceKwh.toFixed(2)}</div></div>`;
  const s1 = D('card'); s1.innerHTML = `<div class="cp"><div class="lbl">Always On</div><div class="sf" style="font-size:21px;margin:2px 0">${fmt2(alwaysOnCost)}</div><div style="font-size:10.5px;color:#8a7260">${alwaysOnKwh.toFixed(3)} kWh/cycle</div></div>`;
  const s2 = D('card'); s2.innerHTML = `<div class="cp"><div class="lbl">Appliances</div><div class="sf" style="font-size:21px;margin:2px 0">${fmt2(applianceSessionCost)}</div><div style="font-size:10.5px;color:#8a7260">${mApplianceUsage.length} log${mApplianceUsage.length !== 1 ? 's' : ''} · ${applianceSessionKwh.toFixed(3)} kWh</div></div>`;
  metrics.appendChild(kwhCard); metrics.appendChild(s1); metrics.appendChild(s2);
  electricSummary.appendChild(metrics); sec.appendChild(electricSummary);
  const meterAuditCard = renderMeterAudit();

  let alwaysCard = null; // Card margin handled by global .card
  if (alwaysOn.length) {
    alwaysCard = D('card'); alwaysCard.appendChild(DivHdr('24/7 Appliances'));
    alwaysOn.sort((a, b) => applianceAlwaysOnEstimate(b, selectedRange.start, selectedRange.end, data.meralcoRate).cost - applianceAlwaysOnEstimate(a, selectedRange.start, selectedRange.end, data.meralcoRate).cost).forEach(a => {
      const est = applianceAlwaysOnEstimate(a, selectedRange.start, selectedRange.end, data.meralcoRate); // No margin-bottom here
      const cycleCost = est.cost, cycleKwh = est.kwh;
      const inner = D('row cr row-line'); inner.style.gap = '9px';
      const left = D(''); left.style.cssText = 'flex:1;min-width:0';
      left.appendChild(h('div', { style: 'font-size:12.5px;font-weight:700' }, a.name));
      left.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260' }, `${a.category} · ${applianceLabel(a)} · ${cycleKwh.toFixed(3)} kWh/cycle`));
      left.appendChild(h('div', { style: 'font-size:10px;color:#8a7260;margin-top:2px' }, alwaysOnSinceLabel(a, data)));
      const right = D(''); right.style.cssText = 'text-align:right;flex-shrink:0';
      right.appendChild(h('div', { cls: 'sf', style: 'font-size:15px' }, fmt2(cycleCost)));
      right.appendChild(h('div', { style: 'font-size:9px;color:#8a7260' }, 'cycle est.'));
      inner.appendChild(left); inner.appendChild(right);
      alwaysCard.appendChild(swRow(inner, () => openEdit('appliance', a.id), () => delAppliance(a.id), () => turnOffAlwaysOnAppliance(a.id))); // No margin-bottom here
    });
  }

  const chartActions = D('electric-chart-actions-section');
  const cc = h('div', { 
    cls: 'card electric-chart-card', 
    style: { cursor: 'pointer' }, 
    onClick: () => set({ modal: 'electricityMonthChart', chartCycleKey: selectedCycle.key }) 
  });
  const ccp = D('cp'); ccp.style.paddingBottom = '5px';
  const cr = D('row'); cr.style.marginBottom = '11px';
  const wkCost = eChart.reduce((s, x) => s + x.cost, 0), wkKwh = eChart.reduce((s, x) => s + x.kwh, 0);
  cr.innerHTML = `<span class="lbl">7-Day Electricity</span><span style="font-size:11px;color:#8a7260">${fmt2(wkCost)} · ${wkKwh.toFixed(2)} kWh${meralcoDailyKwh ? ' · ' + meralcoDailyKwh.toFixed(2) + '/day bill avg' : ''}</span>`;
  const bars = D('bw');
  eChart.forEach(cd => {
    const isT = cd.ds === dateOf(new Date()), pct = cd.cost / maxECost;
    const col = D('bc');
    const nl = D(''); nl.style.cssText = 'font-size:7px;color:#8a7260;font-weight:600;text-align:center;height:12px'; if (cd.cost > 0 || cd.meralcoDailyKwh) nl.textContent = cd.meralcoDailyKwh ? cd.meralcoDailyKwh.toFixed(2) + 'k' : cd.cost.toFixed(2); col.appendChild(nl);
    const bg = D('bbg');
    const fill = D('bf'); fill.style.cssText = `height:${Math.max(pct * 100, cd.cost > 0 ? 8 : 0)}%;background:transparent;display:flex;flex-direction:column-reverse;overflow:hidden;${isT ? 'outline:1.5px solid #b8720c;outline-offset:-1.5px;' : ''}`;
    if (cd.cost > 0) {
      const airSeg = D(''); airSeg.style.cssText = `height:${(cd.airCost / cd.cost * 100).toFixed(1)}%;background:#b8720c;width:100%`; fill.appendChild(airSeg);
      const tvSeg = D(''); tvSeg.style.cssText = `height:${(cd.tvCost / cd.cost * 100).toFixed(1)}%;background:#2e6e4f;width:100%`; fill.appendChild(tvSeg);
      const apSeg = D(''); apSeg.style.cssText = `height:${(cd.applianceCost / cd.cost * 100).toFixed(1)}%;background:#1a56c4;width:100%`; fill.appendChild(apSeg);
    }
    bg.appendChild(fill); col.appendChild(bg); // No margin-bottom here
    const lel = D(''); lel.style.cssText = `font-size:7.5px;color:${isT ? '#b8720c' : '#8a7260'};font-weight:${isT ? 800 : 400};text-align:center`; lel.textContent = cd.label; col.appendChild(lel);
    bars.appendChild(col);
  });
  const legend = D(''); legend.style.cssText = 'font-size:10px;color:#8a7260;margin-top:6px;display:flex;gap:10px;align-items:center;flex-wrap:wrap';
  legend.appendChild(h('span', {}, '■ Aircon')); legend.lastChild.style.color = '#b8720c';
  legend.appendChild(h('span', {}, '■ TV')); legend.lastChild.style.color = '#2e6e4f';
  legend.appendChild(h('span', {}, '■ Appliances')); legend.lastChild.style.color = '#1a56c4';
  legend.appendChild(h('span', { style: 'color:#8a7260' }, meralcoDailyKwh ? 'Top labels show Meralco avg kWh/day' : 'Estimated cost from logs'));
  ccp.appendChild(cr); ccp.appendChild(bars); ccp.appendChild(legend);
  cc.appendChild(ccp); chartActions.appendChild(cc);

  const actions = D('electric-actions-grid'); actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px';
  actions.appendChild(Btn('bgfull', '+ Aircon Session', () => { const mode = airconModeFrom(data.airconDefaultMode, data.airconDefaultSleepMode), w = data.weather || {}; set({ modal: 'addAircon', airconF: { ...timedSessionDraft(S.airconF, 480), mode, sleepMode: mode === 'sleep', tempC: data.airconDefaultTemp || S.airconF.tempC || '29', roomTemp: S.airconF.roomTemp || '', outdoorTemp: w.temp ?? S.airconF.outdoorTemp ?? '', outdoorFeels: w.apparent ?? S.airconF.outdoorFeels ?? '', outdoorHumidity: w.humidity ?? S.airconF.outdoorHumidity ?? '' } }); })); // Button margin handled by global .card // No margin-bottom here
  actions.appendChild(Btn('bgfull', 'Start Aircon', () => {
    const mode = airconModeFrom(S.airconF.mode || data.airconDefaultMode, S.airconF.sleepMode || data.airconDefaultSleepMode);
    const d = {
      mode,
      sleepMode: mode === 'sleep',
      tempC: S.airconF.tempC ?? data.airconDefaultTemp ?? '29',
      roomTemp: S.airconF.roomTemp ?? '',
      outdoorTemp: data.weather?.temp ?? S.airconF.outdoorTemp ?? '',
      outdoorFeels: data.weather?.apparent ?? S.airconF.outdoorFeels ?? '',
      outdoorHumidity: data.weather?.humidity ?? S.airconF.outdoorHumidity ?? ''
    };
    startActiveSession('aircon', d);
  }));

  actions.appendChild(Btn('bgfull', '+ TV Hours', () => set({ modal: 'addTv', tvF: timedSessionDraft(S.tvF, 180) })));
  actions.appendChild(Btn('bgfull', 'Start TV', () => startActiveSession('tv')));
  actions.appendChild(Btn('bgfull', '+ Appliance', () => {
    const first = (data.appliances || []).find(a => !a.alwaysOn);
    set({ modal: 'logAppliance', applianceSessionF: applianceSessionDraft(first) });
  }));
  actions.appendChild(Btn('bgfull', 'Manage Appliances', () => set({ tab: 'appliances' })));
  chartActions.appendChild(actions); // No margin-bottom here
  sec.appendChild(chartActions);
  sec.appendChild(renderCurrentlyOn(data));
  if (alwaysCard) sec.appendChild(alwaysCard);

  if (!mUsage.length && !mTv.length && !mApplianceUsage.length && !alwaysOnCost) { sec.appendChild(meterAuditCard); const e = D('card empty'); e.innerHTML = '<div>No electricity usage logged for this month.</div>'; sec.appendChild(e); return sec; }

  if (mUsage.length) {
    const card = D('card electric-history-card'); // No margin-bottom here
    const hdr = h('button', { cls: 'history-toggle', type: 'button', onClick: () => set({ airconHistoryOpen: !S.airconHistoryOpen }), 'aria-expanded': S.airconHistoryOpen ? 'true' : 'false' });
    const title = D(''); title.style.cssText = 'flex:1;min-width:0';
    title.appendChild(h('span', { style: 'font-weight:700;font-size:13px' }, 'Aircon History'));
    title.appendChild(h('div', { style: 'font-size:10px;color:#8a7260;margin-top:1px' }, `${mUsage.length} session${mUsage.length !== 1 ? 's' : ''} this cycle · ${durationLabel(mHours * 60)} · ${fmt2(mCost)}`));
    hdr.appendChild(title);
    hdr.appendChild(h('span', { style: 'font-size:16px;color:#8a7260;flex-shrink:0' }, S.airconHistoryOpen ? '▴' : '▾'));
    card.appendChild(hdr);
    if (S.airconHistoryOpen) {
      mUsage.forEach(u => {
        const inner = D('row cr row-line');
        const left = D('');
        left.appendChild(h('div', { style: 'font-size:13px;font-weight:600' }, `Aircon · ${durationLabel(u.minutes || (u.hours || 0) * 60)} · ${airconModeLabel(u.mode, u.sleepMode)}${u.tempC !== '' && u.tempC != null ? ' · set ' + u.tempC + 'C' : ''}${u.roomTemp !== '' && u.roomTemp != null ? ' · room ' + u.roomTemp + 'C' : ''}`));
        const meta = D(''); meta.style.cssText = 'font-size:10.5px;color:#8a7260;margin-top:2px;display:flex;align-items:center;gap:5px;flex-wrap:wrap';
        meta.appendChild(dateSpanLabel(u));
        meta.appendChild(h('span', {}, `${u.start && u.end ? fmtTime12(u.start) + '-' + fmtTime12(u.end) + ' · ' : ''}${u.kwh.toFixed(2)} kWh${u.outdoorTemp !== '' && u.outdoorTemp != null ? ' · out ' + u.outdoorTemp + 'C' : ''}`));
        left.appendChild(meta);
        const right = D(''); right.style.cssText = 'text-align:right';
        right.appendChild(h('div', { cls: 'sf', style: 'font-size:15px' }, fmt2(u.cost)));
        right.appendChild(h('div', { style: 'font-size:9px;color:#8a7260' }, `@${u.rateAtTime}/kWh`));
        inner.appendChild(left); inner.appendChild(right);
        card.appendChild(swRow(inner, () => openEdit('aircon', u.id), () => delAircon(u.id)));
      });
    }
    sec.appendChild(card);
  }
  if (mTv.length) {
    const tvCard = D('card electric-history-card');
    const tvHdr = h('button', { cls: 'history-toggle', type: 'button', onClick: () => set({ tvHistoryOpen: !S.tvHistoryOpen }), 'aria-expanded': S.tvHistoryOpen ? 'true' : 'false' }); // No margin-bottom here
    const tvTitle = D(''); tvTitle.style.cssText = 'flex:1;min-width:0';
    tvTitle.appendChild(h('span', { style: 'font-weight:700;font-size:13px' }, 'TV History'));
    tvTitle.appendChild(h('div', { style: 'font-size:10px;color:#8a7260;margin-top:1px' }, `${mTv.length} session${mTv.length !== 1 ? 's' : ''} this cycle · ${durationLabel(tvHours * 60)} · ${fmt2(tvCost)}`));
    tvHdr.appendChild(tvTitle);
    tvHdr.appendChild(h('span', { style: 'font-size:16px;color:#8a7260;flex-shrink:0' }, S.tvHistoryOpen ? '▴' : '▾'));
    tvCard.appendChild(tvHdr);
    if (S.tvHistoryOpen) {
      mTv.forEach(u => {
        const inner = D('row cr row-line');
        const left = D('');
        left.appendChild(h('div', { style: 'font-size:13px;font-weight:600' }, `TV · ${durationLabel(u.minutes || (u.hours || 0) * 60)}`));
        const meta = D(''); meta.style.cssText = 'font-size:10.5px;color:#8a7260;margin-top:2px;display:flex;align-items:center;gap:5px;flex-wrap:wrap';
        meta.appendChild(dateSpanLabel(u));
        meta.appendChild(h('span', {}, `${u.start && u.end ? fmtTime12(u.start) + '-' + fmtTime12(u.end) + ' · ' : ''}${u.watts}W · ${u.kwh.toFixed(2)} kWh`));
        left.appendChild(meta);
        const right = D(''); right.style.cssText = 'text-align:right';
        right.appendChild(h('div', { cls: 'sf', style: 'font-size:15px' }, fmt2(u.cost)));
        right.appendChild(h('div', { style: 'font-size:9px;color:#8a7260' }, `@${u.rateAtTime}/kWh`));
        inner.appendChild(left); inner.appendChild(right);
        tvCard.appendChild(swRow(inner, () => openEdit('tv', u.id), () => delTv(u.id)));
      });
    }
    sec.appendChild(tvCard);
  }
  if (mApplianceUsage.length) {
    const applianceAuditSection = D('electric-appliance-audit-section');
    const apHist = D('card electric-history-card');
    const apHdr = h('button', { cls: 'history-toggle', type: 'button', onClick: () => set({ applianceHistoryOpen: !S.applianceHistoryOpen }), 'aria-expanded': S.applianceHistoryOpen ? 'true' : 'false' });
    const apTitle = D(''); apTitle.style.cssText = 'flex:1;min-width:0';
    apTitle.appendChild(h('span', { style: 'font-weight:700;font-size:13px' }, 'Appliance History'));
    apTitle.appendChild(h('div', { style: 'font-size:10px;color:#8a7260;margin-top:1px' }, `${mApplianceUsage.length} log${mApplianceUsage.length !== 1 ? 's' : ''} this cycle · ${applianceSessionKwh.toFixed(3)} kWh · ${fmt2(applianceSessionCost)}`));
    apHdr.appendChild(apTitle);
    apHdr.appendChild(h('span', { style: 'font-size:16px;color:#8a7260;flex-shrink:0' }, S.applianceHistoryOpen ? '▴' : '▾'));
    apHist.appendChild(apHdr);
    if (S.applianceHistoryOpen) {
      mApplianceUsage.forEach(u => {
        const inner = D('row cr row-line');
        const left = D('');
        left.appendChild(h('div', { style: 'font-size:13px;font-weight:600' }, `${u.name} · ${durationLabel(u.minutes)}`));
        const meta = D(''); meta.style.cssText = 'font-size:10.5px;color:#8a7260;margin-top:2px;display:flex;align-items:center;gap:5px;flex-wrap:wrap';
        meta.appendChild(dateSpanLabel(u));
        meta.appendChild(h('span', {}, `${u.start && u.end ? fmtTime12(u.start) + '-' + fmtTime12(u.end) + ' · ' : ''}${u.qty}x ${u.watts}W · ${u.kwh.toFixed(3)} kWh`));
        left.appendChild(meta);
        const right = D(''); right.style.cssText = 'text-align:right';
        right.appendChild(h('div', { cls: 'sf', style: 'font-size:15px' }, fmt2(u.cost)));
        right.appendChild(h('div', { style: 'font-size:9px;color:#8a7260' }, `@${u.rateAtTime}/kWh`));
        inner.appendChild(left); inner.appendChild(right);
        apHist.appendChild(swRow(inner, () => openEdit('applianceUsage', u.id), () => delApplianceUsage(u.id)));
      });
    }
    applianceAuditSection.appendChild(apHist);
    applianceAuditSection.appendChild(meterAuditCard);
    sec.appendChild(applianceAuditSection);
  } else {
    sec.appendChild(meterAuditCard);
  }
  return sec;
}