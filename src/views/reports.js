import { S, set, billMonthKeys } from '../state.js';
import { h, D, Sel, Sp, EmptyCard, dateBadge, metricTiles } from '../utils/domHelpers.js';
import { fmt, fmt2 } from '../utils/formatters.js';
import { mk, curMk, mklbl, dateOf, durationLabel } from '../utils/dateUtils.js';
import {
  electricityReportForMonth, isHomeCookedTx, electricityBill, electricityComparisonForMonth,
  meralcoReadDay, cycleDateRange, applianceAlwaysOnEstimate, usageCostInRange, overlapRatio, cycleLabel, cycleDays
} from '../utils/electricityUtils.js';

export function renderReports() {
  const data = S.data; const sec = D('sec');
  const toprow = D('row'); toprow.style.marginBottom = '11px';
  const mw = D(''); mw.style.cssText = 'display:flex;align-items:center;gap:7px';
  mw.appendChild(h('span', { style: 'font-size:11px;font-weight:700;color:#8a7260' }, 'Month:'));
  const billMonths = billMonthKeys(data);
  const applianceMonths = (data.applianceUsage || []).flatMap(u => [mk(u.date), ...(u.endDate ? [mk(u.endDate)] : [])]);
  const stockMonths = (data.stocks || []).map(s => mk(s.date));
  const allMonths = [...new Set([...(data.transactions || []).map(t => mk(t.date)), ...(data.homeExpenses || []).map(e => mk(e.date)), ...(data.airconUsage || []).map(e => mk(e.date)), ...(data.tvUsage || []).map(e => mk(e.date)), ...applianceMonths, ...billMonths, ...stockMonths, ...Array.from({ length: 3 }, (_, i) => { const d2 = new Date(); d2.setMonth(d2.getMonth() - i); return mk(dateOf(d2)); })])].filter(m => /^\d{4}-\d{2}$/.test(String(m))).sort((a, b) => b.localeCompare(a));
  if (!/^\d{4}-\d{2}$/.test(String(S.rptMk || '')) || !allMonths.includes(S.rptMk)) S.rptMk = allMonths[0] || curMk();
  const rm = S.rptMk;
  const msel = Sel(rm, allMonths, v => set({ rptMk: v }));
  msel.classList.add('compact-select');
  [...msel.options].forEach(o => { o.text = mklbl(o.value); });
  mw.appendChild(msel); toprow.appendChild(mw); sec.appendChild(toprow);

  const foodTx = (data.transactions || []).filter(t => mk(t.date) === rm);
  const homeEx = (data.homeExpenses || []).filter(e => mk(e.date) === rm);
  const airconUsage = (data.airconUsage || []).filter(u => mk(u.date) === rm);
  const tvUsage = (data.tvUsage || []).filter(u => mk(u.date) === rm);
  const monthRange = { start: new Date(`${rm}-01T00:00:00`), end: new Date(`${rm}-01T00:00:00`) };
  monthRange.end.setMonth(monthRange.end.getMonth() + 1);
  const appliances = data.appliances || [], applianceUsage = (data.applianceUsage || []).filter(u => overlapRatio(u, monthRange.start, monthRange.end) > 0);
  const billsTotal = (data.bills || []).reduce((s, b) => s + (b.monthlyAmounts?.[rm] || 0), 0);
  const foodTotal = foodTx.reduce((s, t) => s + t.amount, 0);
  const homeTotal = homeEx.reduce((s, e) => s + e.amount, 0);
  const electricReport = electricityReportForMonth(rm, data);
  const electricityTotal = electricReport.totalCost;
  const grandTotal = foodTotal + homeTotal + billsTotal;

  const hero = D('card cg'); // Card margin handled by global .card
  hero.innerHTML = `<div class="cp"><div class="row" style="margin-bottom:10px"><div><div class="lblw">Total Spending — ${mklbl(rm)}</div><div class="sf" style="font-size:32px;color:#fff;margin:2px 0">${fmt(grandTotal)}</div></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px"><div style="background:rgba(255,255,255,.1);border-radius:8px;padding:8px 5px"><div style="font-size:9px;color:rgba(255,255,255,.55);font-weight:700;text-transform:uppercase;letter-spacing:.3px">Food</div><div class="sf" style="font-size:13px;color:#fff;margin-top:2px">${fmt(foodTotal)}</div></div><div style="background:rgba(255,255,255,.1);border-radius:8px;padding:8px 5px"><div style="font-size:9px;color:rgba(255,255,255,.55);font-weight:700;text-transform:uppercase;letter-spacing:.3px">Home</div><div class="sf" style="font-size:13px;color:#fff;margin-top:2px">${fmt(homeTotal)}</div></div><div style="background:rgba(255,255,255,.1);border-radius:8px;padding:8px 5px"><div style="font-size:9px;color:rgba(255,255,255,.55);font-weight:700;text-transform:uppercase;letter-spacing:.3px">Bills</div><div class="sf" style="font-size:13px;color:#fff;margin-top:2px">${fmt(billsTotal)}</div></div><div style="background:rgba(255,255,255,.1);border-radius:8px;padding:8px 5px"><div style="font-size:9px;color:rgba(255,255,255,.55);font-weight:700;text-transform:uppercase;letter-spacing:.3px">Electric</div><div class="sf" style="font-size:13px;color:#fff;margin-top:2px">${fmt(electricityTotal)}</div></div></div></div>`;
  const foodTile = hero.querySelector('.cp > div:nth-child(2) > div:nth-child(1)');
  const homeTile = hero.querySelector('.cp > div:nth-child(2) > div:nth-child(2)');
  const billsTile = hero.querySelector('.cp > div:nth-child(2) > div:nth-child(3)');
  const electricTile = hero.querySelector('.cp > div:nth-child(2) > div:nth-child(4)');
  if (foodTile) { foodTile.style.cursor = 'pointer'; foodTile.onclick = () => set({ modal: 'foodReport', chartMonthKey: rm }); }
  if (homeTile) { homeTile.style.cursor = 'pointer'; homeTile.onclick = () => set({ modal: 'homeReport', chartMonthKey: rm }); }
  if (billsTile) { billsTile.style.cursor = 'pointer'; billsTile.onclick = () => set({ modal: 'billsReport', chartMonthKey: rm }); }
  if (electricTile) { electricTile.style.cursor = 'pointer'; electricTile.onclick = () => set({ modal: 'electricityReport', chartMonthKey: rm }); }
  sec.appendChild(hero);

  const catData = {};
  foodTx.filter(t => !isHomeCookedTx(t)).forEach(t => { const key = t.source; if (!catData[key]) catData[key] = { amount: 0, type: 'food' }; catData[key].amount += t.amount; });
  homeEx.forEach(e => { const key = e.category; if (!catData[key]) catData[key] = { amount: 0, type: 'home' }; catData[key].amount += e.amount; });
  if (billsTotal > 0) catData['Bills'] = { amount: billsTotal, type: 'bill' };
  if (electricityTotal > 0) catData['Electricity'] = { amount: electricityTotal, type: 'aircon' };
  const sortedCats = Object.entries(catData).sort((a, b) => b[1].amount - a[1].amount);
  const maxCat = sortedCats.length ? sortedCats[0][1].amount : 1; // Card margin handled by global .card
  if (sortedCats.length) {
    const bcard = D('card');
    bcard.appendChild(Object.assign(D('section-hdr'), { innerHTML: '<span class="lbl">Breakdown by Category</span>' }));
    const bcp = D('cp');
    const colors = { 'food': '#2e6e4f', 'home': '#1a56c4', 'bill': '#b8720c', 'aircon': '#e65100' };
    sortedCats.forEach(([cat, { amount, type }]) => {
      const row = D('rpt-bar-row');
      const lbl = D('rpt-bar-label'); lbl.textContent = cat;
      const track = D('rpt-bar-track');
      const fill = D('rpt-bar-fill'); fill.style.cssText = `width:${(amount / maxCat * 100).toFixed(1)}%;background:${colors[type] || '#8a7260'}`;
      track.appendChild(fill);
      const val = D('rpt-bar-val'); val.textContent = fmt(amount);
      const pct = D(''); pct.style.cssText = 'font-size:10px;color:#8a7260;width:35px;text-align:right;flex-shrink:0';
      pct.textContent = grandTotal ? `${(amount / grandTotal * 100).toFixed(0)}%` : '';
      row.appendChild(lbl); row.appendChild(track); row.appendChild(val); row.appendChild(pct); bcp.appendChild(row);
    });
    bcard.appendChild(bcp); sec.appendChild(bcard);
  }

  const paidFoodTx = foodTx.filter(t => !isHomeCookedTx(t));
  if (paidFoodTx.length) {
    const dc = D('card'); dc.appendChild(Object.assign(D('section-hdr'), { innerHTML: '<span class="lbl">Food Spending by Source</span>' }));
    const dcp = D('cp');
    const bySrc = paidFoodTx.reduce((acc, t) => { if (!acc[t.source]) acc[t.source] = 0; acc[t.source] += t.amount; return acc; }, {});
    const maxSrc = Math.max(...Object.values(bySrc), 1);
    Object.entries(bySrc).sort((a, b) => b[1] - a[1]).forEach(([src, amt]) => {
      const row = D('rpt-bar-row');
      const lbl = D('rpt-bar-label'); lbl.textContent = src;
      const track = D('rpt-bar-track'); const fill = D('rpt-bar-fill'); fill.style.cssText = `width:${(amt / maxSrc * 100).toFixed(1)}%;background:#2e6e4f`; track.appendChild(fill);
      row.appendChild(lbl); row.appendChild(track); row.appendChild(h('div', { cls: 'rpt-bar-val' }, fmt(amt))); dcp.appendChild(row);
    });
    dc.appendChild(dcp); sec.appendChild(dc);
  }
  const eBill = electricityBill(data), actualKwh = parseFloat(eBill?.monthlyKwh?.[rm]) || 0;
  if (actualKwh) {
    const cmp = electricityComparisonForMonth(rm, data, actualKwh), eCycle = cmp.cycle, est = cmp.est; // Card margin handled by global .card
    const diff = est.totalKwh - actualKwh, logsPct = actualKwh ? est.totalKwh / actualKwh * 100 : 0, amount = parseFloat(eBill?.monthlyAmounts?.[rm]) || 0, eff = amount ? amount / actualKwh : 0, untracked = Math.max(0, actualKwh - est.totalKwh);
    const ec = D('card'); ec.appendChild(Object.assign(D('section-hdr'), { innerHTML: '<span class="lbl">Electricity Bill Comparison</span>' }));
    const ep = D('cp');
    const actualBox = D('soft-panel-lg');
    actualBox.style.padding = '9px 10px';
    actualBox.appendChild(h('div', { cls: 'lbl', style: 'margin-bottom:2px' }, 'Meralco Actual'));
    actualBox.appendChild(h('div', { cls: 'sf', style: 'font-size:22px;color:#3a2818;line-height:1.05' }, `${actualKwh.toFixed(2)} kWh`));
    actualBox.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260;margin-top:4px' }, `${cycleLabel(eCycle)} · ${(actualKwh / cycleDays(eCycle)).toFixed(2)} kWh/day`));
    ep.appendChild(actualBox);
    const tiles = [
      { label: 'Estimate', value: `${est.totalKwh.toFixed(2)} kWh` },
      { label: 'Diff', value: `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} kWh`, color: Math.abs(diff) > actualKwh * .2 ? '#b8720c' : '#2e6e4f' },
      { label: 'Logs', value: `${logsPct.toFixed(1)}%`, color: logsPct >= 80 ? '#2e6e4f' : '#b8720c' }
    ];
    if (eff) tiles.push({ label: 'Rate', value: `${fmt2(eff)}/kWh` });
    ep.appendChild(metricTiles(tiles));
    ep.appendChild(h('div', { cls: 'lbl', style: 'margin-top:10px' }, 'Estimate Breakdown'));
    const breakdown = [
      { label: 'Aircon', value: `${est.airconKwh.toFixed(2)} kWh`, color: '#b8720c' },
      { label: 'TV', value: `${est.tvKwh.toFixed(2)} kWh`, color: '#2e6e4f' },
      { label: '24/7', value: `${est.alwaysKwh.toFixed(2)} kWh`, color: '#1a56c4' },
      { label: 'Sessions', value: `${est.sessionKwh.toFixed(2)} kWh`, color: '#6b4c36' }
    ];
    if (untracked > 0) breakdown.push({ label: 'Untracked', value: `${untracked.toFixed(2)} kWh`, color: '#b83030' });
    ep.appendChild(metricTiles(breakdown));
    ec.appendChild(ep); sec.appendChild(ec);
  }
  const reportCycle = electricReport.cycle;
  const reportRange = cycleDateRange(reportCycle);
  const allEx = [...foodTx.filter(t => t.amount > 0).map(t => ({ name: t.source + (t.note ? ' — ' + t.note : ''), amount: t.amount, date: t.date, type: 'food' })), ...homeEx.map(e => ({ name: e.name, amount: e.amount, date: e.date, type: 'home' })), ...airconUsage.map(u => ({ name: 'Aircon (' + durationLabel(u.minutes || (u.hours || 0) * 60) + ')', amount: u.cost, date: u.date, type: 'aircon' })), ...tvUsage.map(u => ({ name: 'TV (' + durationLabel(u.minutes || (u.hours || 0) * 60) + ')', amount: u.cost, date: u.date, type: 'tv' })), ...applianceUsage.map(u => ({ name: u.name + ' (' + durationLabel(u.minutes) + ')', amount: usageCostInRange(u, monthRange.start, monthRange.end), date: u.date, type: 'appliance', badge: u.category || 'Appliance' })), ...appliances.filter(a => a.alwaysOn).map(a => ({ name: a.name + ' (24/7)', amount: applianceAlwaysOnEstimate(a, reportRange.start, reportRange.end, data.meralcoRate).cost, date: `${rm}-01`, type: 'appliance', badge: a.category || 'Appliance' }))].sort((a, b) => b.amount - a.amount).slice(0, 10);
  if (allEx.length) { // Card margin handled by global .card
    const ec = D('card');
    ec.appendChild(Object.assign(D('section-hdr'), { innerHTML: '<span class="lbl">Top 10 Expenses This Month</span>' }));
    allEx.forEach(e => {
      const row = D('row cr'); row.style.borderBottom = '1px solid #e8e0d5';
      const left = D('');
      left.appendChild(h('div', { cls: 'row-main-sm' }, e.name));
      const info = D(''); info.style.cssText = 'font-size:10px;color:#8a7260;margin-top:1px;display:flex;gap:5px;align-items:center';
      const bcls = e.type === 'food' ? 'bdg-f' : e.type === 'home' ? 'bdg-h' : e.type === 'tv' ? 'bdg-tv' : e.type === 'appliance' ? 'bdg-ap' : 'bdg-a';
      const blbl = e.type === 'food' ? 'Food' : e.type === 'home' ? 'Home' : e.type === 'tv' ? 'TV' : e.type === 'appliance' ? e.badge || 'Appliance' : 'Aircon';
      info.appendChild(Sp('bdg ' + bcls, blbl));
      info.appendChild(dateBadge(e.date));
      left.appendChild(info);
      row.appendChild(left); row.appendChild(h('span', { cls: 'sf', style: 'font-size:15px' }, fmt(e.amount)));
      ec.appendChild(row);
    });
    sec.appendChild(ec);
  }
  const pantryCount = (data.stocks || []).filter(s => mk(s.date) === rm).length;
  if (!sortedCats.length && !pantryCount) { sec.appendChild(EmptyCard('reports', 'No expenses logged for this month yet.')); }
  return sec;
}
