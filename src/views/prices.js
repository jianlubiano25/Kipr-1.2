import { S, set } from '../state.js';
import { h, D, Sp, Btn, Inp, swRow, EmptyCard } from '../utils/domHelpers.js';
import { fmt, fmt2 } from '../utils/formatters.js';
import { pGroups } from '../utils/computed.js';
import { openEdit, delPrice } from '../actions.js';

export function renderPrices() {
  const groups = pGroups(); const sec = D('sec');
  const srow = D('row'); srow.style.marginBottom = '8px';
  const applySearch = v => {
    S.pSearch = v;
    sec.querySelectorAll('[data-price-group]').forEach(el => { el.style.display = el.dataset.priceGroup.includes(v.toLowerCase()) ? '' : 'none'; });
  };
  const si = Inp('', { type: 'text', placeholder: 'Search item...', value: S.pSearch }); si.style.flex = '1'; si.oninput = e => applySearch(e.target.value);
  srow.appendChild(si); srow.appendChild(Btn('bp bsm', '+ Add', () => set({ modal: 'addPrice' }))); sec.appendChild(srow);
  const chips = D('chips'); ['All', 'Food', 'Home & Toiletries'].forEach(cat => { const c = D('chip' + (S.pCat === cat ? ' chip-on' : '')); c.textContent = cat; c.onclick = () => set({ pCat: cat }); chips.appendChild(c); }); sec.appendChild(chips);
  if (!groups.length) { sec.appendChild(EmptyCard('prices', 'No prices tracked yet. Add items or use AI Scan!')); return sec; }
  groups.forEach(group => {
    const card = D('card'); card.dataset.priceGroup = group.display.toLowerCase(); if (S.pSearch && !card.dataset.priceGroup.includes(S.pSearch.toLowerCase())) card.style.display = 'none'; const hdr = D('section-hdr-tight');
    const hn = D('section-hdr-title'); hn.style.textTransform = 'capitalize'; hn.textContent = group.display; hdr.appendChild(hn);
    if (group.items.length > 1) { const gs = D(''); gs.style.cssText = 'font-size:10.5px;color:#2e6e4f;font-weight:700;margin-top:1px'; gs.textContent = `Save ${fmt(group.items[group.items.length - 1].price - group.items[0].price)} by choosing cheapest`; hdr.appendChild(gs); }
    card.appendChild(hdr);
    group.items.forEach((item, idx) => {
      const inner = D('row cr row-line' + (idx === 0 ? ' row-highlight' : ''));
      const left = D('');
      if (idx === 0) { const t = D(''); t.style.marginBottom = '2px'; t.appendChild(Sp('tag-c', 'CHEAPEST')); left.appendChild(t); }
      const st = D(''); st.style.cssText = 'font-size:12px;color:#8a7260'; st.textContent = item.store;
      const ut = D(''); ut.style.cssText = 'font-size:10px;color:#8a7260'; ut.textContent = item.unit + (item.subcat ? ' · ' + item.subcat : '');
      left.appendChild(st); left.appendChild(ut);
      const right = D(''); right.style.cssText = 'display:flex;align-items:center;gap:7px';
      right.appendChild(h('span', { cls: 'sf', style: `font-size:18px;color:${idx === 0 ? '#2e6e4f' : '#3a2818'}` }, fmt(item.price)));
      inner.appendChild(left); inner.appendChild(right);
      card.appendChild(swRow(inner, () => openEdit('price', item.id), () => delPrice(item.id)));
    });
    sec.appendChild(card);
  });
  return sec;
}