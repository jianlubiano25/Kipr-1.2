import { S, set } from '../state.js';
import { h, D, Btn, BtnI, Sel, EmptyCard, metaLine, swRow } from '../utils/domHelpers.js';
import { fmt, fmt2 } from '../utils/formatters.js';
import { mk, curMk, mklbl, dateOf } from '../utils/dateUtils.js';
import { homeCategories, noteParts } from '../utils/electricityUtils.js';
import { openBatchEdit, delSelected, clearMulti, openEdit, delHome, toggleSel } from '../actions.js';

export function renderHome() {
  const isPhone = () => window.innerWidth <= 768; // Define breakpoint for phone
  const data = S.data, expenses = data.homeExpenses || [];
  
  // Reverted: only show months that have logs
  const months = [...new Set(expenses.map(e => mk(e.date)))].sort((a, b) => b.localeCompare(a)); // No margin-bottom here
  const allM = months.length ? months : [curMk()];

  const isMonthKey = (k) => String(k).match(/^\d{4}-\d{2}$/);
  // Sanitize month key for rendering without mutating state during render.
  const viewMk = (!S.viewMk || !isMonthKey(S.viewMk) || !allM.includes(S.viewMk)) ? allM[0] : S.viewMk;
  // If it's invalid, update via state setter (safe) so subsequent renders are consistent.
  if (viewMk !== S.viewMk) set({ viewMk });


  const sec = D('sec');
  const toprow = D('row'); toprow.style.marginBottom = isPhone() ? '11px' : '0';
  const mw = D(''); mw.style.cssText = 'display:flex;align-items:center;gap:7px';
  mw.appendChild(h('span', { style: 'font-size:11px;font-weight:700;color:#8a7260' }, 'Month:'));
  const msel = Sel(S.viewMk, allM, v => set({ viewMk: v }));
  msel.classList.add('compact-select');
  [...msel.options].forEach(o => { o.text = mklbl(o.value); });
  mw.appendChild(msel); toprow.appendChild(mw);
  const ha = D(''); ha.style.cssText = 'display:flex;gap:6px';
  if (S.multiHome) { ha.appendChild(Btn('bgsm', 'Edit', () => openBatchEdit('home'), !S.selHome.size)); ha.appendChild(Btn('bgsm', 'Delete', () => delSelected('home'), !S.selHome.size)); ha.appendChild(Btn('bgsm', 'Done', () => clearMulti('home'))); }
  else { ha.appendChild(Btn('bgsm', 'Select', () => set({ multiHome: true, selHome: new Set() }))); ha.appendChild(BtnI('bgsm', 'stocks', 'Stocks', () => set({ tab: 'stocks' }))); ha.appendChild(Btn('bp bsm', '+ Add', () => set({ modal: 'addHome', homeF: { ...S.homeF, date: dateOf(new Date()) } }))); }
  toprow.appendChild(ha); sec.appendChild(toprow); // Keep small margin // No margin-bottom here
  const mExp = expenses.filter(e => mk(e.date) === (S.viewMk || viewMk));


  // Build chips from category list + any dynamic categories present in this month
  // (needed for auto-added bill logs like "Bills" built from AI scan / bill pay)
  const monthCats = [...new Set(mExp.map(e => e.category).filter(Boolean))].sort();
  const chipCats = Array.from(new Set(['All', ...homeCategories(), ...monthCats])).sort((a, b) => (a === 'All' ? -1 : b === 'All' ? 1 : a.localeCompare(b)));

  const chips = D('chips');
  chips.style.marginBottom = '20px';
  chipCats.forEach(cat => {
    const c = D('chip' + (S.homeCat === cat ? ' chip-on' : ''));
    c.textContent = cat;
    c.onclick = () => set({ homeCat: cat });
    chips.appendChild(c);
  });
  sec.appendChild(chips); // Added margin-bottom
  const mTotal = mExp.reduce((s, e) => s + e.amount, 0);
  const msc = D('card cg'); msc.innerHTML = `<div class="cp"><div class="lblw">Home & Toiletries — ${mklbl(S.viewMk)}</div><div class="sf" style="font-size:28px;color:#fff;margin:2px 0">${fmt(mTotal)}</div><div style="font-size:11px;color:rgba(255,255,255,.55)">${mExp.length} item${mExp.length !== 1 ? 's' : ''}</div></div>`; // Card margin handled by global .card
  sec.appendChild(msc);
  const filtered = mExp.filter(e => S.homeCat === 'All' || e.category === S.homeCat);
  if (!filtered.length) { sec.appendChild(EmptyCard('home', `No home expenses${S.homeCat !== 'All' ? ' for ' + S.homeCat : ''} this month.`)); return sec; }
  const byCat = filtered.reduce((acc, e) => { if (!acc[e.category]) acc[e.category] = []; acc[e.category].push(e); return acc; }, {});
  Object.entries(byCat).sort().forEach(([cat, items]) => {
    const total = items.reduce((s, e) => s + e.amount, 0);
    const card = D('card'); const hdr = D('row section-hdr');
    hdr.appendChild(h('span', { cls: 'section-hdr-title' }, cat));
    hdr.appendChild(h('span', { cls: 'sf', style: 'font-size:16px;color:#1a56c4' }, fmt(total)));
    card.appendChild(hdr);
    items.sort((a, b) => b.date.localeCompare(a.date)).forEach(item => {
      const inner = D('row cr row-line');
      inner.style.justifyContent = 'flex-start'; inner.style.gap = '9px';
if (S.multiHome) {
        const checked = S.selHome.has(item.id);
        const cb = h('input', {
          type: 'checkbox',
          checked,
          style: 'width:18px;height:18px;flex:0 0 18px;accent-color:#1b4d35',
          onClick: e => {
            e.stopPropagation();
            const nextChecked = e.target.checked;
            if (nextChecked !== S.selHome.has(item.id)) toggleSel('home', item.id);
          }
        });
        inner.appendChild(cb);
      }
      const left = D(''); left.style.cssText = 'flex:1;min-width:0';
      const nm = D('row-main-sm'); nm.textContent = item.name;
      const qty = parseFloat(item.qty) || 1, unitPrice = parseFloat(item.unitPrice) || item.amount;
      const details = noteParts(item.store, item.note, item.discount ? 'Discount ' + fmt(item.discount) : '', qty > 1 ? `${qty} x ${fmt(unitPrice)}` : '');
      left.appendChild(nm); // This line is correct
      left.appendChild(metaLine(details, item.date));
      const right = D(''); right.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0';
      right.appendChild(h('span', { style: 'font-weight:700;font-size:13px' }, fmt(item.amount)));
      inner.appendChild(left); inner.appendChild(right);
      card.appendChild(S.multiHome ? inner : swRow(inner, () => openEdit('home', item.id), () => delHome(item.id)));
    });
    sec.appendChild(card);
  });
  return sec;
}
