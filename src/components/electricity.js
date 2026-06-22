import { S, set } from '../state.js';
import { h, D, Btn, BtnI, Sel, DivHdr, Fg, Inp, metricTiles, Time12Control, swRow, Sp, auditDateBadge } from '../utils/domHelpers.js';
import { fmt, fmt2 } from '../utils/formatters.js';
import { mk, curMk, mklbl, dateOf, timeOf, fmtTime12, durationLabel, dtOf } from '../utils/dateUtils.js';
import {
  meralcoReadDay, cycleForDate, shiftCycleKey, cycleLabel, inCycle, cycleDateRange,
  applianceAlwaysOnEstimate, usageCostInRange, usageKwhInRange, airconModeFrom, airconModeLabel,
  timedSessionDraft, applianceSessionDraft, renderWeatherCard, electricityDailyChart,
  electricityCycleEstimate, meralcoKwhForCycle, airconRates, applianceLabel,
  alwaysOnSinceLabel, meterAudit, auditDateTime, usageDateRange, auditApplianceKwhInRange,
  dateBadgeClass, cycleDays, activeElapsedMinutes, activeEstimate, coffeeAppliance
} from '../utils/electricityUtils.js';
import {
  turnOffAlwaysOnAppliance, openEdit, delApplianceUsage, delAircon, delTv, startActiveSession, delAppliance,
  stopActiveSession, cancelActiveSession, logCoffeeBoil
} from '../actions.js';

export function renderCoffeeCounter(data=S.data){
  const ap=coffeeAppliance(data);
  if(!ap)return null;
  const today=(data.applianceUsage||[]).filter(u=>u.date===dateOf(new Date())&&String(u.applianceId)===String(ap.id));
  const count=today.length,kwh=today.reduce((s,u)=>s+(parseFloat(u.kwh)||0),0),cost=today.reduce((s,u)=>s+(parseFloat(u.cost)||0),0);
  const card=D('card dash-coffee-card');const cp=D('cp');
  const row=D('row');row.style.cssText='gap:9px;align-items:center';
  const left=D('');left.style.cssText='flex:1;min-width:0';
  left.appendChild(h('div',{class:'lbl'},'Coffee Counter'));
  left.appendChild(h('div',{class:'sf',style:'font-size:22px;margin:2px 0'},`${count} today`));
  left.appendChild(h('div',{style:'font-size:10.5px;color:#8a7260'},`${ap.name} · ${durationLabel(ap.sessionMinutes||3)} each · ${kwh.toFixed(3)} kWh · ${fmt2(cost)}`));
  const btn=Btn('bp','+ Coffee',logCoffeeBoil);btn.style.cssText='padding:9px 12px;font-size:12px;flex-shrink:0';
  row.appendChild(left);row.appendChild(btn);cp.appendChild(row);card.appendChild(cp);
  return card;
}

export function renderCurrentlyOn(data=S.data){
  const active=data.activeSessions||[],liveCard=D('card dash-currently-on-card');
  liveCard.appendChild(DivHdr('Currently On'));
  if(active.length){
    active.forEach(s=>{
      const est=activeEstimate(s,new Date(),data);
      const inner=D('row cr row-line');inner.style.gap='9px';
      const left=D('');left.style.cssText='flex:1;min-width:0';
      const nRow=D('row');nRow.style.cssText='justify-content:flex-start;gap:6px';
      nRow.appendChild(h('span',{style:'font-size:12.5px;font-weight:700'},s.name));
      if(s.watts) nRow.appendChild(Sp('bdg bdg-ap',`${s.watts}W`));
      left.appendChild(nRow);
      left.appendChild(h('div',{style:'font-size:10.5px;color:#8a7260'},`${s.type==='aircon'?'Aircon · '+airconModeLabel(s.mode,s.sleepMode)+(s.tempC?' '+s.tempC+'°C':''):s.type==='tv'?'TV':'Appliance'} · on since ${fmtTime12(timeOf(new Date(s.startedAt)))} · ${durationLabel(est.minutes)}${s.outdoorTemp!==''&&s.outdoorTemp!=null?' · out '+s.outdoorTemp+'°C':''}`));
      const right=D('');right.style.cssText='text-align:right;flex-shrink:0';
      right.appendChild(h('div',{cls:'sf',style:'font-size:15px'},`${est.kwh.toFixed(3)} kWh`));
      right.appendChild(h('div',{style:'font-size:10px;color:#8a7260'},fmt2(est.cost)));
      const stop=Btn('ba bsm','Off',()=>stopActiveSession(s.id));stop.style.marginTop='4px';
      const cancel=Btn('bgsm','Cancel',()=>cancelActiveSession(s.id));cancel.style.marginTop='4px';cancel.style.marginLeft='4px';
      right.appendChild(stop);right.appendChild(cancel);
      inner.appendChild(left);inner.appendChild(right);liveCard.appendChild(inner);
    });
  }else{
    const empty=D('empty');empty.style.cssText='padding:16px;color:#8a7260;font-size:12px;text-align:center';empty.textContent='Nothing is currently running.';liveCard.appendChild(empty);
  }
  return liveCard;
}

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
  const cp = D('cp');
  const grid = D('g2'); grid.style.marginBottom = '8px';
  const addField = (label, key, type = 'text', step = '') => {
    const input = h('input', { cls: 'inp', type, value: f[key] || '', ...(step ? { step } : {}) });
    input.oninput = e => S.auditF[key] = e.target.value;
    grid.appendChild(Fg(label, input));
  };
  addField('Start Date', 'startDate', 'date');
  addField('Start Time', 'startTime', 'time');
  addField('End Date', 'endDate', 'date');
  addField('End Time', 'endTime', 'time');
  addField('Start Read', 'startRead', 'number', '0.001');
  addField('End Read', 'endRead', 'number', '0.001');

  cp.appendChild(grid);
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
  cp.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260;line-height:1.5;margin-top:7px' }, `${durationLabel(a.hours * 60)} window · ${a.meterKwh ? Math.round(a.matchPct) + '% matched · ' : ''}Sessions ${a.loggedKwh.toFixed(2)} kWh · 24/7 ${a.alwaysKwh.toFixed(2)} kWh · ${fmt2(a.estimatedKwh * a.rate)} estimated. Positive gap means meter used more than logged.`));
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
  });
  cp.appendChild(parts);
  const shortDate = dt => dt.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const rangeLabel = (s, e) => shortDate(s) === shortDate(e) ? shortDate(s) : `${shortDate(s)}-${shortDate(e)}`;
  const auditInfo = (u) => {
    const r = usageDateRange(u, a.start, a.end);
    if (!r) return { minutes: 0, dateLabel: u.date ? shortDate(dtOf(u.date)) : '', dateClass: u.date ? dateBadgeClass(u.date) : '', time: 'date only', sortAt: u.date ? dtOf(u.date).getTime() : 0 };
    const os = new Date(Math.max(r.s.getTime(), a.start.getTime())), oe = new Date(Math.min(r.e.getTime(), a.end.getTime()));
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
  });
  if (rows.length) cp.appendChild(list);
  card.appendChild(cp);
  return card;
}