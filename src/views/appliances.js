import { S, set } from '../state.js';
import { h, D, Btn, DivHdr, swRow, categoryBadge, EmptyCard } from '../utils/domHelpers.js';
import { fmt2 } from '../utils/formatters.js';
import { curMk, mklbl } from '../utils/dateUtils.js';
import {
  applianceMonthly, applianceSessionEstimate, applianceSessionDraft, applianceLabel,
  airconProfile, airconModeLabel, alwaysOnSinceLabel, usageCostInRange, overlapRatio
} from '../utils/electricityUtils.js';
import {
  openAirconProfile, openTvProfile, openEdit, delAppliance, turnOffAlwaysOnAppliance,
  startActiveSession
} from '../actions.js';

export function renderAppliances() {
  const data = S.data, appliances = data.appliances || [], usage = data.applianceUsage || [], sec = D('sec');
  const always = appliances.filter(a => a.alwaysOn);
  const session = appliances.filter(a => !a.alwaysOn);
  const alwaysCost = always.reduce((s, a) => s + applianceMonthly(a, data.meralcoRate).cost, 0);
  const curRange = { start: new Date(`${curMk()}-01T00:00:00`), end: new Date(`${curMk()}-01T00:00:00`) };
  curRange.end.setMonth(curRange.end.getMonth() + 1);
  const monthUsage = usage.filter(u => overlapRatio(u, curRange.start, curRange.end) > 0);
  const sessionCost = monthUsage.reduce((s, u) => s + usageCostInRange(u, curRange.start, curRange.end), 0);

  const top = D('row'); top.style.marginBottom = '10px';
  top.appendChild(h('span', { style: 'font-size:14px;font-weight:700' }, 'Appliance Manager'));
  top.appendChild(Btn('bp bsm', '+ Add', () => set({ modal: 'addAppliance' })));
  sec.appendChild(top);

  const hero = D('card cg'); hero.innerHTML = `<div class="cp"><div class="lblw">Configured Appliance Estimate</div><div class="sf" style="font-size:30px;color:#fff;margin:2px 0">${fmt2(alwaysCost + sessionCost)}</div><div style="font-size:11px;color:rgba(255,255,255,.55)">24/7 monthly ${fmt2(alwaysCost)} · ${mklbl(curMk())} logged ${fmt2(sessionCost)}</div></div>`; // Card margin handled by global .card
  sec.appendChild(hero);

  const quick = D(''); quick.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px';
  const first = session[0];
  quick.appendChild(Btn('bgfull', 'Log Appliance', () => set({ modal: 'logAppliance', applianceSessionF: applianceSessionDraft(first) }), !first));
  quick.appendChild(Btn('bgfull', 'Electricity Overview', () => set({ tab: 'aircon' })));
  sec.appendChild(quick);

  const builtIn = D('card'); builtIn.appendChild(DivHdr('Built-in Appliances'));
  const ap = airconProfile(data);
  const builtRow = (cat, name, meta, editFn) => {
    const inner = D('row cr row-line'); inner.style.gap = '9px';
    const left = D(''); left.style.cssText = 'flex:1;min-width:0';
    const title = D(''); title.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0';
    title.appendChild(categoryBadge(cat));
    title.appendChild(h('span', { style: 'font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, name));
    left.appendChild(title);
    left.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260;margin-top:2px;line-height:1.45' }, meta));
    const edit = Btn('bgsm', 'Edit', editFn); edit.style.flexShrink = '0';
    inner.appendChild(left); inner.appendChild(edit); builtIn.appendChild(inner);
  };
  builtRow('Aircon', ap.model, `${ap.ratedWatts}W rated · CSPF ${ap.cspf} · Default ${airconModeLabel(data.airconDefaultMode, data.airconDefaultSleepMode)} ${data.airconDefaultTemp || 29}C`, openAirconProfile);
  builtRow('TV', data.tvModel || 'TV', `${data.tvWatts || 175}W · Used by TV logs and timers`, openTvProfile);
  sec.appendChild(builtIn);

  const alwaysCard = D('card'); alwaysCard.appendChild(DivHdr('24/7 Appliances'));
  if (always.length) {
    always.sort((a, b) => applianceMonthly(b, data.meralcoRate).cost - applianceMonthly(a, data.meralcoRate).cost).forEach(a => {
      const est = applianceMonthly(a, data.meralcoRate);
      const inner = D('row cr row-line'); inner.style.gap = '9px';
      const left = D(''); left.style.cssText = 'flex:1;min-width:0';
      const title = D(''); title.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0';
      title.appendChild(categoryBadge(a.category));
      title.appendChild(h('span', { style: 'font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, a.name));
      if (a.watts) title.appendChild(h('span', { cls: 'bdg bdg-ap' }, `${a.watts}W`));
      left.appendChild(title);
      left.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260;margin-top:2px' }, `${applianceLabel(a)} · ${est.kwh.toFixed(3)} kWh/month`));
      left.appendChild(h('div', { style: 'font-size:10px;color:#8a7260;margin-top:2px' }, alwaysOnSinceLabel(a, data)));
      if (a.note) left.appendChild(h('div', { style: 'font-size:10px;color:#8a7260;font-style:italic' }, a.note));
      const right = D(''); right.style.cssText = 'text-align:right;flex-shrink:0';
      right.appendChild(h('div', { cls: 'sf', style: 'font-size:15px' }, fmt2(est.cost)));
      right.appendChild(h('div', { style: 'font-size:9px;color:#8a7260' }, 'monthly'));
      inner.appendChild(left); inner.appendChild(right);
      alwaysCard.appendChild(swRow(inner, () => openEdit('appliance', a.id), () => delAppliance(a.id), () => turnOffAlwaysOnAppliance(a.id)));
    });
  } else alwaysCard.appendChild(Object.assign(D('empty'), { textContent: 'No 24/7 appliances configured.' }));
  sec.appendChild(alwaysCard);

  const sessionCard = D('card'); sessionCard.appendChild(DivHdr('Appliances'));
  if (session.length) {
    session.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).forEach(a => {
      const est = applianceSessionEstimate(a, a.sessionMinutes, data.meralcoRate);
      const inner = D('row cr row-line'); inner.style.gap = '9px';
      const left = D(''); left.style.cssText = 'flex:1;min-width:0';
      const title = D(''); title.style.cssText = 'display:flex;align-items:center;gap:6px;min-width:0';
      title.appendChild(categoryBadge(a.category));
      title.appendChild(h('span', { style: 'font-size:12.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, a.name));
      if (a.watts) title.appendChild(h('span', { cls: 'bdg bdg-ap' }, `${a.watts}W`));
      left.appendChild(title);
      left.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260;margin-top:2px' }, `${applianceLabel(a)} · ${est.kwh.toFixed(3)} kWh/log`));
      if (a.note) left.appendChild(h('div', { style: 'font-size:10px;color:#8a7260;font-style:italic' }, a.note));
      const right = D(''); right.style.cssText = 'text-align:right;flex-shrink:0';
      right.appendChild(h('div', { cls: 'sf', style: 'font-size:15px' }, fmt2(est.cost)));
      right.appendChild(h('button', { cls: 'btn bsm', style: 'margin-top:4px', onClick: () => set({ modal: 'logAppliance', applianceSessionF: applianceSessionDraft(a) }) }, 'Log'));
      right.appendChild(h('button', { cls: 'btn bgsm', style: 'margin-top:4px;margin-left:4px', onClick: () => startActiveSession('appliance', { applianceId: a.id }) }, 'Start'));
      inner.appendChild(left); inner.appendChild(right);
      sessionCard.appendChild(swRow(inner, () => openEdit('appliance', a.id), () => delAppliance(a.id)));
    });
  } else sessionCard.appendChild(Object.assign(D('empty'), { textContent: 'No appliances configured.' }));
  sec.appendChild(sessionCard);

  sec.appendChild(D('')); sec.lastChild.style.height = '18px';
  return sec;
}