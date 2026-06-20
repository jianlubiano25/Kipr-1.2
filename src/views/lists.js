import { S, set } from '../state.js';
import { h, D, Btn, DivHdr, Fg } from '../utils/domHelpers.js';
import { fmt, fmt2 } from '../utils/formatters.js';
import { foodSources, homeCategories, homeStores, applianceCategories } from '../utils/electricityUtils.js';
import { saveListsDefaults } from '../actions.js';

const isPhone = () => window.innerWidth <= 768; // Define breakpoint for phone

export function renderListsDefaults() {
  const data = S.data, sec = D('sec');
  if (!S.listsF || !S.listsF.foodSources) {
    S.listsF = {
      foodSources: foodSources(data).join('\n'),
      homeCategories: homeCategories(data).join('\n'),
      homeStores: homeStores(data).join('\n'),
      applianceCategories: applianceCategories(data).join('\n'),
      dailyBudget: String(data.dailyBudget || 380),
      groceryBudget: String(data.groceryBudget || 5000)
    };
  }
  const f = S.listsF;
  const hero = D('card cg'); hero.innerHTML = `<div class="cp"><div class="lblw">Lists & Defaults</div><div class="sf" style="font-size:26px;color:#fff;margin:3px 0">Personalize Your Tracker</div><div style="font-size:11px;color:rgba(255,255,255,.58);line-height:1.45">Budgets, food sources, home categories, stores, and appliance categories used across forms and reports.</div></div>`;
  sec.appendChild(hero);

  const budgetBox = (label, key, min, max, step) => {
    const box = D('card'); box.style.marginBottom = '0'; box.appendChild(DivHdr(label)); const cp = D('cp'); const row = D('row'); row.style.marginBottom = '7px';
    const val = h('span', { cls: 'sf amber-c', style: 'font-size:18px' }, fmt(f[key] || 0));
    row.appendChild(h('span', { cls: 'lbl' }, 'Default')); row.appendChild(val); cp.appendChild(row);
    const slider = h('input', { type: 'range', min, max, step, value: f[key] });
    slider.oninput = e => { f[key] = e.target.value; val.textContent = fmt(e.target.value); };
    cp.appendChild(slider);
    const range = D('row'); range.style.marginTop = '3px'; range.innerHTML = `<span style="font-size:10px;color:#8a7260">${fmt(min)} min</span><span style="font-size:10px;color:#8a7260">${fmt(max)}</span>`;
    cp.appendChild(range); box.appendChild(cp); return box;
  };
  const budgetGrid = D(''); budgetGrid.style.cssText = `display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:${isPhone() ? '20px' : '0'}`; // Adjusted margin-bottom
  budgetGrid.appendChild(budgetBox('Daily Meals Budget', 'dailyBudget', 150, 700, 10));
  budgetGrid.appendChild(budgetBox('Groceries Budget', 'groceryBudget', 1000, 15000, 500));
  sec.appendChild(budgetGrid);

  const ta = (key, label, sub) => {
    const card = D('card'); card.appendChild(DivHdr(label));
    const cp = D('cp');
    if (sub) cp.appendChild(h('p', { style: 'font-size:11px;color:#8a7260;line-height:1.5;margin-bottom:9px' }, sub));
    const el = h('textarea', { cls: 'inp', rows: '6', style: 'resize:vertical;line-height:1.45;min-height:118px', value: f[key] || '' });
    el.value = f[key] || ''; el.oninput = e => f[key] = e.target.value; cp.appendChild(el);
    cp.appendChild(h('div', { style: 'font-size:10px;color:#8a7260;margin-top:6px' }, 'One label per line.'));
    card.appendChild(cp); sec.appendChild(card);
  };
  ta('foodSources', 'Food Sources', 'Keep Groceries if you want food entries to add pantry stock.');
  ta('homeCategories', 'Home Categories', 'Used by home expenses, price scans, and reports.');
  ta('homeStores', 'Home Stores', 'Reusable store choices for home items and prices.');
  ta('applianceCategories', 'Appliance Categories', 'Used in Appliance Manager and report badges.');

  const save = Btn('bp bfull', 'Save Lists & Defaults', saveListsDefaults); save.style.marginBottom = isPhone() ? '20px' : '0'; sec.appendChild(save); // Adjusted margin-bottom
  return sec;
}