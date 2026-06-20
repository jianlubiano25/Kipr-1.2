import { S, set, setD } from '../state.js';
import { h, D, Btn, DivHdr, EmptyCard, Sp, metaLine, swRow } from '../utils/domHelpers.js';
import { SCATS, UNITS } from '../constants.js'; // SCATS imported
import { adjStock, delStock, openEdit } from '../actions.js';

export function renderStocks() {
  const isPhone = () => window.innerWidth <= 768; // Define breakpoint for phone
  const data = S.data, stocks = data.stocks || []; const sec = D('sec');
  const toprow = D('row'); toprow.style.marginBottom = '10px';
  toprow.appendChild(h('span', { style: 'font-size:14px;font-weight:700;color:#3a2818' }, 'Pantry & Stocks'));
  const acts = D(''); acts.style.cssText = 'display:flex;gap:6px'; // No margin-bottom here
  acts.appendChild(Btn('bp bsm', '+ Item', () => set({ modal: 'addStock' })));
  toprow.appendChild(acts); sec.appendChild(toprow);

  const needsBuying = stocks.filter(s => s.quantity <= s.minQty);
  if (needsBuying.length) {
    const sl = D('card'); sl.style.cssText = 'border:1.5px dashed var(--amber);background:var(--warn-bg);overflow:hidden'; // Card margin handled by global .card
    const slh = h('button', { cls: 'dash-tips-toggle', style: 'border-bottom:none;background:transparent', onClick: () => set({ shoppingListOpen: !S.shoppingListOpen }) });
    slh.appendChild(h('span', { cls: 'lbl', style: 'color:var(--amber)' }, '🛒 Shopping List'));
    slh.appendChild(h('span', { style: 'font-size:10.5px;color:var(--amber);font-weight:700' }, `${needsBuying.length} items ${S.shoppingListOpen ? '▴' : '▾'}`));
    sl.appendChild(slh);
    if (S.shoppingListOpen) {
      const slp = D('cp'); slp.style.paddingTop = '0';
      needsBuying.forEach(s => {
        const row = D('row'); row.style.cssText = 'padding:7px 0;border-bottom:1px solid rgba(184,114,12,0.1);font-size:12px';
        row.innerHTML = `<span>${s.name}</span><span style="font-weight:800;color:var(--amber)">${s.quantity <= 0 ? 'OUT' : 'LOW'}</span>`;
        slp.appendChild(row);
      });
      sl.appendChild(slp);
    }
    sec.appendChild(sl);
  }

  const chips = D('chips');
  ['All', 'Low Stock', 'Out of Stock'].forEach(s => { const c = D('chip' + (S.stockStatus === s ? ' chip-on' : '')); c.textContent = s === 'All' ? 'All' : s === 'Low Stock' ? 'Low' : 'Out'; c.onclick = () => set({ stockStatus: s }); chips.appendChild(c); });
  ['All', ...SCATS].forEach(cat => { const c = D('chip' + (S.stockCat === cat ? ' chip-on' : '')); c.textContent = cat; c.onclick = () => set({ stockCat: cat }); chips.appendChild(c); });
  sec.appendChild(chips);
  // No margin-bottom here
  const outItems = stocks.filter(s => s.quantity <= 0), lowItems = stocks.filter(s => s.quantity > 0 && s.quantity <= s.minQty);
  const dismissed = (data.stockAlertDismissed || '').split('|').filter(Boolean);
  const notifyOut = outItems.filter(s => !dismissed.includes('out:' + s.id)), notifyLow = lowItems.filter(s => !dismissed.includes('low:' + s.id));
  if (notifyOut.length || notifyLow.length) { // Card margin handled by global .card
    const ac = D('card'); ac.style.cssText = 'background:#fdecea;border:1px solid #f5c2c2';
    const acp = D('cp');
    const close = h('button', {
      cls: 'del', style: 'float:right;margin:-4px -4px 4px 8px;color:#b83030', onClick: () => setD(d => {
        const toAdd = [...notifyOut.map(s => 'out:' + s.id), ...notifyLow.map(s => 'low:' + s.id)];
        return { ...d, stockAlertDismissed: [...new Set([...(d.stockAlertDismissed || '').split('|'), ...toAdd])].filter(Boolean).join('|') };
      })
    }, '×');
    acp.appendChild(close);
    if (notifyOut.length) acp.appendChild(h('div', { style: 'font-size:12.5px;color:#b83030;font-weight:700;margin-bottom:4px' }, `Out of stock: ${notifyOut.map(s => s.name).join(', ')}`));
    if (notifyLow.length) acp.appendChild(h('div', { style: 'font-size:12.5px;color:#b8720c;font-weight:700' }, `Running low: ${notifyLow.map(s => s.name).join(', ')}`));
    ac.appendChild(acp); sec.appendChild(ac);
  }
  let filtered = stocks;
  if (S.stockCat !== 'All') filtered = filtered.filter(s => s.category === S.stockCat);
  if (S.stockStatus === 'All') filtered = filtered.filter(s => s.quantity > 0);
  if (S.stockStatus === 'Low Stock') filtered = filtered.filter(s => s.quantity > 0 && s.quantity <= s.minQty);
  if (S.stockStatus === 'Out of Stock') filtered = filtered.filter(s => s.quantity <= 0);
  if (!filtered.length) { sec.appendChild(EmptyCard('stocks', 'No pantry items tracked yet. Add groceries and household supplies to keep track of your stocks.')); return sec; }

  const byCat = filtered.reduce((acc, s) => { if (!acc[s.category]) acc[s.category] = []; acc[s.category].push(s); return acc; }, {});
  Object.entries(byCat).sort().forEach(([cat, items]) => {
    const card = D('card'); card.appendChild(DivHdr(cat));
    items.forEach(item => {
      const isOut = item.quantity <= 0, isLow = item.quantity > 0 && item.quantity <= item.minQty;
      const status = isOut ? Sp('s-out', 'OUT') : isLow ? Sp('s-low', 'LOW') : Sp('s-ok', 'OK');
      const inner = D('row cr row-line'); inner.style.minHeight = '52px';
      const left = D(''); left.style.flex = '1';
      const nrow = D('row'); nrow.style.marginBottom = '2px';
      const nm = h('span', { style: 'font-size:12.5px;font-weight:700' }, item.name);
      nrow.appendChild(nm); nrow.appendChild(status); left.appendChild(nrow);
      left.appendChild(item.date ? metaLine(item.note ? [item.note] : [], item.date) : h('div', { style: 'font-size:10px;color:#8a7260;margin-top:1px' }, item.note ? `Date not set · ${item.note}` : 'Date not set'));
      const qrow = D(''); qrow.style.cssText = 'font-size:11px;color:#8a7260;margin-top:1px'; qrow.textContent = `${item.quantity} ${item.unit} available · min: ${item.minQty} ${item.unit}`;
      left.appendChild(qrow);
      const right = D(''); right.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0';
      const minusBtn = h('button', { cls: 'qty-btn', onClick: () => adjStock(item.id, -1) }, '-');
      const qv = h('span', { style: `font-weight:800;font-size:15px;min-width:24px;text-align:center;color:${isOut ? '#b83030' : isLow ? '#b8720c' : '#1b4d35'}` }, String(item.quantity));
      const plusBtn = h('button', { cls: 'qty-btn', onClick: () => adjStock(item.id, 1) }, '+');
      right.appendChild(minusBtn); right.appendChild(qv); right.appendChild(plusBtn);
      inner.appendChild(left); inner.appendChild(right);
      card.appendChild(swRow(inner, () => openEdit('stock', item.id), () => delStock(item.id)));
    });
    sec.appendChild(card);
  });
  sec.appendChild(D('')); sec.lastChild.style.height = '18px';
  return sec;
}