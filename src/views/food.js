import { S, set } from '../state.js';
import { h, D, Btn, BtnI, Sel, DivHdr, EmptyCard, metaLine, swRow } from '../utils/domHelpers.js';
import { fmt, fmt2 } from '../utils/formatters.js';
import { mk, curMk, mklbl, dateOf } from '../utils/dateUtils.js';
import { isHomeCookedTx, isGroceryTx } from '../utils/electricityUtils.js';
import { openBatchEdit, delSelected, clearMulti, openEdit, delTx, toggleSel } from '../actions.js';

const isPhone = () => window.innerWidth <= 768; // Define breakpoint for phone

export function renderFood() {
  const data = S.data;
  const transactions = data.transactions || [];
  // Reverted: only show months that have logs
  const months = [...new Set(transactions.map(t => mk(t.date)))].sort((a, b) => b.localeCompare(a));
  const allM = months.length ? months : [curMk()];

  const isMonthKey = (k) => String(k).match(/^\d{4}-\d{2}$/);
  // Sanitize S.viewMk: reset if it's missing, wrong format (e.g. from Electric tab), or not in the logs
  if (!S.viewMk || !isMonthKey(S.viewMk) || !allM.includes(S.viewMk)) S.viewMk = allM[0];

  const sec = D('sec');
  const toprow = D('row'); toprow.style.marginBottom = isPhone() ? '11px' : '0';
  const mw = D(''); mw.style.cssText = 'display:flex;align-items:center;gap:7px';
  mw.appendChild(h('span', { style: 'font-size:11px;font-weight:700;color:#8a7260' }, 'Month:')); // Keep small margin
  const msel = Sel(S.viewMk, allM, v => set({ viewMk: v })); // Keep small margin
  msel.classList.add('compact-select');
  [...msel.options].forEach(o => { o.text = mklbl(o.value); });
  mw.appendChild(msel); toprow.appendChild(mw);
  const fa = D(''); fa.style.cssText = 'display:flex;gap:6px';
  if (S.multiFood) { fa.appendChild(Btn('bgsm', 'Edit', () => openBatchEdit('food'), !S.selFood.size)); fa.appendChild(Btn('bgsm', 'Delete', () => delSelected('food'), !S.selFood.size)); fa.appendChild(Btn('bgsm', 'Done', () => clearMulti('food'))); }
  else { fa.appendChild(Btn('bgsm', 'Select', () => set({ multiFood: true, selFood: new Set() }))); fa.appendChild(BtnI('bgsm', 'stocks', 'Pantry', () => set({ tab: 'stocks' }))); fa.appendChild(Btn('bp bsm', '+ Add', () => set({ modal: 'addTx', txF: { ...S.txF, date: dateOf(new Date()) } }))); }
  toprow.appendChild(fa); sec.appendChild(toprow);
  const mTx = transactions.filter(t => mk(t.date) === S.viewMk); // Card margin handled by global .card
  const homeCookedTx = mTx.filter(isHomeCookedTx), expenseTx = mTx.filter(t => !isHomeCookedTx(t)); // Card margin handled by global .card
  const mealTx = expenseTx.filter(t => !isGroceryTx(t)), groceryTx = expenseTx.filter(isGroceryTx); // Card margin handled by global .card
  const mTotal = expenseTx.reduce((s, t) => s + t.amount, 0), mealTotal = mealTx.reduce((s, t) => s + t.amount, 0), groceryTotal = groceryTx.reduce((s, t) => s + t.amount, 0);
  const mDays = [...new Set(mealTx.map(t => t.date))].length; // Card margin handled by global .card
  const msc = D('card cg'); msc.innerHTML = `<div class="cp"><div class="row" style="margin-bottom:9px"><div><div class="lblw">Food Spending — ${mklbl(S.viewMk)}</div><div class="sf" style="font-size:28px;color:#fff;margin:2px 0">${fmt(mTotal)}</div><div style="font-size:11px;color:rgba(255,255,255,.55)">${expenseTx.length} expense${expenseTx.length !== 1 ? 's' : ''} · ${homeCookedTx.length} meal log${homeCookedTx.length !== 1 ? 's' : ''}</div></div><div style="text-align:right"><div class="lblw">Meal Avg/Day</div><div class="sf" style="font-size:20px;color:#fff;margin-top:3px">${fmt(mDays ? Math.round(mealTotal / mDays) : 0)}</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><div style="background:rgba(255,255,255,.1);border-radius:8px;padding:7px"><div class="lblw">Meals</div><div class="sf" style="font-size:16px;color:#fff">${fmt(mealTotal)}</div></div><div style="background:rgba(255,255,255,.1);border-radius:8px;padding:7px"><div class="lblw">Groceries</div><div class="sf" style="font-size:16px;color:${groceryTotal > (data.groceryBudget || 5000) ? '#b83030' : '#fff'}">${fmt(groceryTotal)}</div><div style="font-size:9.5px;color:rgba(255,255,255,.55)">Budget ${fmt(data.groceryBudget || 5000)}</div></div></div></div>`;
  sec.appendChild(msc);
  if (!mTx.length) { sec.appendChild(EmptyCard('food', 'No food expenses logged for this month.')); return sec; }
  if (homeCookedTx.length) {
    const mc = D('card'); mc.appendChild(DivHdr('Meal Logs'));
    homeCookedTx.sort((a, b) => b.date.localeCompare(a.date)).forEach(tx => {
      const inner = D('row cr row-line'); inner.style.cssText = 'justify-content:flex-start;gap:9px';
      if (S.multiFood) inner.appendChild(h('input', { type: 'checkbox', checked: S.selFood.has(tx.id), style: 'width:18px;height:18px;flex:0 0 18px', onClick: e => { e.stopPropagation(); toggleSel('food', tx.id); } }));
      const left = D(''); left.style.cssText = 'flex:1;min-width:0';
      left.appendChild(h('div', { cls: 'row-main' }, `Home-cooked${tx.note ? ' · ' + tx.note : ''}`));
      left.appendChild(metaLine([], tx.date));
      inner.appendChild(left);
      mc.appendChild(S.multiFood ? inner : swRow(inner, () => openEdit('food', tx.id), () => delTx(tx.id)));
    });
    sec.appendChild(mc);
  }
  const grouped = expenseTx.reduce((acc, tx) => { if (!acc[tx.date]) acc[tx.date] = []; acc[tx.date].push(tx); return acc; }, {});
  Object.keys(grouped).sort((a, b) => b.localeCompare(a)).forEach(ds => {
    const txs = grouped[ds], mealTotal = txs.filter(t => !isGroceryTx(t)).reduce((s, t) => s + t.amount, 0), groceryTotal = txs.filter(isGroceryTx).reduce((s, t) => s + t.amount, 0), over = mealTotal > data.dailyBudget;
    const card = D('card');
    const hdr = D('row section-hdr');
    hdr.appendChild(h('span', { cls: 'section-hdr-title' }, new Date(ds + 'T12:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })));
    hdr.appendChild(h('span', { cls: 'sf', style: `font-size:16px;color:${over ? '#b83030' : '#2e6e4f'}` }, `${fmt(mealTotal)} meals${groceryTotal ? ' · ' + fmt(groceryTotal) + ' grocery' : ''}${over ? ' · Over' : ''}`));
    card.appendChild(hdr);
    txs.forEach(tx => {
      const inner = D('row cr row-line');
      inner.style.justifyContent = 'flex-start'; inner.style.gap = '9px';
      if (S.multiFood) inner.appendChild(h('input', { type: 'checkbox', checked: S.selFood.has(tx.id), style: 'width:18px;height:18px;flex:0 0 18px', onClick: e => { e.stopPropagation(); toggleSel('food', tx.id); } }));
      const left = D(''); left.style.cssText = 'flex:1;min-width:0';
      left.appendChild(h('div', { cls: 'row-main-sm' }, tx.source));
      left.appendChild(metaLine([tx.note, tx.discount ? `Discount ${fmt(tx.discount)}` : ''], tx.date));
      const right = D(''); right.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0';
      right.appendChild(h('span', { style: 'font-weight:700;font-size:13px' }, fmt(tx.amount)));
      const row = S.multiFood ? inner : swRow(inner, () => openEdit('food', tx.id), () => delTx(tx.id));
      inner.appendChild(left);
      inner.appendChild(right);
      card.appendChild(row);
    });
    const foot = D(''); foot.style.cssText = 'padding:5px 13px;display:flex;justify-content:flex-end';
    foot.appendChild(h('span', { style: `font-size:10.5px;color:${over ? '#b83030' : '#8a7260'}` }, over ? `Meals ₱${(mealTotal - data.dailyBudget).toFixed(0)} over budget` : `Meals ₱${(data.dailyBudget - mealTotal).toFixed(0)} remaining`));
    card.appendChild(foot);
    sec.appendChild(card);
  });
  return sec;
}
