import { S, set, billMonthKeys, preferredBillsMonth } from '../state.js';
import { h, D, Btn, Sel, metricTiles } from '../utils/domHelpers.js';
import { fmt, fmt2 } from '../utils/formatters.js';
import { mk, curMk, mklbl } from '../utils/dateUtils.js';
import { electricityComparisonForMonth, cycleLabel, cycleDays } from '../utils/electricityUtils.js';
import { delBill, setBillAmt, setBillKwh, toggleBillPaid } from '../actions.js';

const isPhone = () => window.innerWidth <= 768; // Define breakpoint for phone

export function renderBills() {
  const data = S.data, bills = data.bills || []; const sec = D('sec');
  const toprow = D('row'); toprow.style.marginBottom = '10px';
  const mw = D(''); mw.style.cssText = 'display:flex;align-items:center;gap:7px';
  mw.appendChild(h('span', { style: 'font-size:11px;font-weight:700;color:#8a7260' }, 'Month:'));
  
  // Make month selection dynamic based on all existing bill data (amounts, kWh, and paid status)
  const billMonths = billMonthKeys(data);
  const allM = [...new Set([...billMonths, curMk()])].sort((a, b) => b.localeCompare(a));

  const isMonthKey = (k) => String(k).match(/^\d{4}-\d{2}$/);
  // Sanitize S.billsMk: reset if missing, wrong format (e.g. from Electric tab), or not in the available months
  if (!S.billsMk || !isMonthKey(S.billsMk) || !allM.includes(S.billsMk)) {
    S.billsMk = preferredBillsMonth(data, S.billsMk);
  }

  const bm = S.billsMk;

  const msel = Sel(bm, allM, v => set({ billsMk: v }));
  msel.classList.add('compact-select');
  [...msel.options].forEach(o => { o.text = mklbl(o.value); });
  mw.appendChild(msel); toprow.appendChild(mw); toprow.appendChild(Btn('bp bsm', '+ Bill', () => set({ modal: 'addBill' }))); sec.appendChild(toprow);
  const mTotal = bills.reduce((s, b) => s + (b.monthlyAmounts?.[bm] || 0), 0);
  const mUnpaid = bills.filter(b => !b.paid?.[bm]).reduce((s, b) => s + (b.monthlyAmounts?.[bm] || 0), 0);
  const hero = D('card cg'); hero.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr"><div style="padding:12px 13px;border-right:1px solid rgba(255,255,255,.15)"><div class="lblw">${mklbl(bm)} Bills</div><div class="sf" style="font-size:24px;color:#fff;margin-top:2px">${fmt(mTotal)}</div></div><div style="padding:12px 13px"><div class="lblw">Unpaid</div><div class="sf" style="font-size:24px;color:${mUnpaid > 0 ? '#ffd07a' : '#7fe0b0'};margin-top:2px">${fmt(mUnpaid)}</div></div></div>`;
  sec.appendChild(hero); // Card margin handled by global .card // No margin-bottom here
  sec.appendChild(h('p', { style: 'font-size:11.5px;color:#8a7260;margin-bottom:20px;padding:0 2px;line-height:1.5' }, `Enter the amount for each bill this month — amounts can change every month.`)); // Adjusted margin-bottom
  bills.forEach(bill => {
    const amount = bill.monthlyAmounts?.[bm] || 0; const paid = !!bill.paid?.[bm];
    const name = String(bill.name || '').toLowerCase();
    const isElectric = name.includes('electric') || name.includes('meralco');
    const kwh = isElectric ? (parseFloat(bill.monthlyKwh?.[bm]) || 0) : 0;
    const cmp = isElectric && kwh ? electricityComparisonForMonth(bm, data, kwh) : null;
    const billCycle = cmp?.cycle || null;
    const dailyKwh = kwh && billCycle ? kwh / cycleDays(billCycle) : 0;
    const est = cmp?.est || null;
    const diff = est ? est.totalKwh - kwh : 0;
    const logsPct = est && kwh ? est.totalKwh / kwh * 100 : 0;
    const card = D('card');
    const hdr = D('row section-hdr');
    hdr.appendChild(h('span', { cls: 'section-hdr-title' }, bill.name));
    hdr.appendChild(h('button', { cls: 'del', onClick: () => delBill(bill.id) }, '×'));
    card.appendChild(hdr);
    const ar = D('row cp row-line');
    ar.appendChild(h('span', { style: 'font-size:11.5px;color:#8a7260' }, `Amount for ${mklbl(bm)}:`));
    const inputKey = bill.id + '_' + bm;
    const ai = h('input', { type: 'number', inputmode: 'decimal', placeholder: '0', cls: 'amount-input' });
    ai.value = S.billDraft[inputKey] !== undefined ? S.billDraft[inputKey] : (amount || '');
    ai.addEventListener('input', e => { S.billDraft[inputKey] = e.target.value; });
    ai.addEventListener('blur', e => { delete S.billDraft[inputKey]; setBillAmt(bill.id, bm, e.target.value); });
    ar.appendChild(ai); card.appendChild(ar);
    if (isElectric) {
      const kr = D('row cp row-line');
      const left = D('');
      left.appendChild(h('div', { style: 'font-size:11.5px;color:#8a7260' }, 'Meralco kWh used:'));
      if (kwh) {
        const meta = D('soft-panel');
        meta.style.marginTop = '5px';
        meta.appendChild(h('div', { cls: 'sf', style: 'font-size:14px;color:#3a2818;line-height:1' }, `${kwh.toFixed(2)} kWh`));
        meta.appendChild(h('div', { style: 'font-size:9.5px;color:#8a7260;margin-top:3px;line-height:1.35' }, `${cycleLabel(billCycle)} · ${dailyKwh.toFixed(2)} kWh/day`));
        left.appendChild(meta);
      }
      kr.appendChild(left);
      const kKey = bill.id + '_' + bm + '_kwh';
      const ki = h('input', { type: 'number', inputmode: 'decimal', placeholder: 'e.g. 157', cls: 'amount-input' });
      ki.value = S.billDraft[kKey] !== undefined ? S.billDraft[kKey] : (kwh || '');
      ki.addEventListener('input', e => { S.billDraft[kKey] = e.target.value; });
      ki.addEventListener('blur', e => { delete S.billDraft[kKey]; setBillKwh(bill.id, bm, e.target.value); });
      kr.appendChild(ki); card.appendChild(kr);
      if (est) {
        const cmp = D('cp row-line'); cmp.style.paddingTop = '0';
        cmp.appendChild(metricTiles([
          { label: 'Estimate', value: `${est.totalKwh.toFixed(2)} kWh` },
          { label: 'Diff', value: `${diff >= 0 ? '+' : ''}${diff.toFixed(2)} kWh`, color: Math.abs(diff) > kwh * .2 ? '#b8720c' : '#2e6e4f' },
          { label: 'Logs', value: `${logsPct.toFixed(1)}%`, color: logsPct >= 80 ? '#2e6e4f' : '#b8720c' }
        ], true));
        card.appendChild(cmp);
      }
    }
    const pr = D('row cp'); pr.style.alignItems = 'center';
    const pb = Btn(paid ? 'bgsm' : 'bp', paid ? '✓ Paid' : 'Mark Paid', () => toggleBillPaid(bill.id, bm));
    pb.style.fontSize = '12px';
    pr.appendChild(pb);
    pr.appendChild(h('span', { cls: 'sf', style: `font-size:18px;color:${paid ? '#8a7260' : '#3a2818'}` }, amount ? fmt(amount) : '₱—')); // Card margin handled by global .card // No margin-bottom here
    card.appendChild(pr); sec.appendChild(card); // Card margin handled by global .card
  });
  sec.appendChild(h('button', { cls: 'bgfull', style: 'margin-bottom:20px', onClick: () => set({ modal: 'addBill' }) }, '+ Add a Bill')); // Adjusted margin-bottom
  return sec;
}
