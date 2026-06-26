import { S, set, setD } from '../state.js';
import { h, D, iconEl, Sel, Btn, Inp } from '../utils/domHelpers.js';
import { themeFromData } from '../utils/electricityUtils.js';
import { syncLabel, exportData, exportDataKipr1, importData, openSettings, switchProfile, openManageProfiles } from '../actions.js';
import { APP_VERSION, SCHEMA_VERSION } from '../constants.js';

export function renderDrawer({ darkMode, nebulaMode } = {}) {
  const drawer = D('drawer' + (S.drawerOpen ? ' open' : ''));
  const dov = D('dov' + (S.drawerOpen ? ' show' : ''));
  dov.onclick = () => set({ drawerOpen: false });
  const dhdr = D('dr-hdr');
  const logoBtn = h('button', { cls: 'dr-logo-btn', type: 'button', onClick: () => set({ tab: 'dash', drawerOpen: false }), 'aria-label': 'Go to Overview' });
  logoBtn.appendChild(h('img', { cls: 'dr-logo', src: darkMode || nebulaMode ? 'Kipr-logo-lightg.webp' : 'Kipr-logo-org.webp', alt: 'kipr' }));
  dhdr.appendChild(logoBtn);
  const themeActions = D('drawer-theme-actions');
  const themeBtn = h('button', { cls: 'drawer-theme-btn', type: 'button', title: darkMode ? 'Switch to light mode' : 'Switch to dark mode', 'aria-label': darkMode ? 'Switch to light mode' : 'Switch to dark mode', onClick: e => { e.stopPropagation(); const next = darkMode ? 'light' : 'dark'; setD(d => ({ ...d, theme: next, darkMode: next === 'dark' })); } });
  themeBtn.appendChild(iconEl(darkMode ? 'sun' : 'moon', 'drawer-theme-icon app-icon'));
  themeActions.appendChild(themeBtn);
  const nebulaBtn = h('button', { cls: 'drawer-theme-btn drawer-nebula-btn' + (nebulaMode ? ' drawer-theme-active' : ''), type: 'button', title: nebulaMode ? 'Switch to light mode' : 'Switch to Nebula theme', 'aria-label': nebulaMode ? 'Switch to light mode' : 'Switch to Nebula theme', onClick: e => { e.stopPropagation(); const next = nebulaMode ? 'light' : 'nebula'; setD(d => ({ ...d, theme: next, darkMode: next === 'dark' })); } });
  nebulaBtn.appendChild(iconEl('northStar', 'drawer-theme-icon app-icon'));
  themeActions.appendChild(nebulaBtn);
  dhdr.appendChild(themeActions);
  drawer.appendChild(dhdr);

  // Profile Section
  const pSec = D('dr-profile-sec');
  pSec.style.cssText = 'padding:14px; border-bottom:1px solid var(--dr-border); margin-bottom:4px';
  
  const pList = S.fullUserData['meta|settings']?.data?.profiles || S.data.profiles || [{id: 'main', name: 'Primary'}];
  const activeProfile = pList.find(p => p.id === (S.fullUserData['meta|settings']?.data?.activeProfileId || S.data.activeProfileId)) || pList[0];

  const pRow = D('dr-profile-row');
  pRow.style.cssText = 'display:flex; align-items:center; gap:12px;';

  // Profile image acts as a switcher
  const pImg = h('button', {
    cls: 'dr-profile-image',
    style: {
      width: '42px', height: '42px', borderRadius: '50%',
      backgroundColor: darkMode || nebulaMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      color: darkMode || nebulaMode ? '#fff' : '#3a2818',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '20px', fontWeight: '800', textTransform: 'uppercase',
      flexShrink: '0', border: pList.length > 1 ? '2.5px solid var(--amber)' : 'none',
      cursor: pList.length > 1 ? 'pointer' : 'default', padding: '0'
    },
    onClick: (e) => {
      if (pList.length <= 1) return;
      // Cycle to the next profile
      const currentId = activeProfile.id;
      const curIdx = pList.findIndex(p => p.id === currentId);
      const nextIdx = (curIdx + 1) % pList.length;
      set({ drawerOpen: false }); // Close drawer for clean transition
      switchProfile(pList[nextIdx].id);
    }
  });
  pImg.textContent = activeProfile.name.charAt(0);
  pRow.appendChild(pImg);

  const pInfo = D('dr-profile-info');
  pInfo.style.cssText = 'display:flex; flex-direction:column; min-width:0;';
  const pName = Object.assign(D('dr-profile-name'), { textContent: activeProfile.name });
  pName.style.cssText = `font-size:15px; font-weight:700; color:${darkMode || nebulaMode ? '#fff' : '#3a2818'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
  
  const pLinks = D('dr-profile-links');
  pLinks.style.cssText = 'display:flex; gap:8px; margin-top:2px;';
  const linkSty = 'font-size:11px; color:var(--amber); background:none; border:none; padding:0; cursor:pointer; font-weight:600; text-decoration:underline;';
  
  pLinks.appendChild(h('button', { style: linkSty, onClick: openManageProfiles }, 'Manage Profiles'));

  pInfo.appendChild(pName); pInfo.appendChild(pLinks);
  pRow.appendChild(pInfo);
  pSec.appendChild(pRow);
  drawer.appendChild(pSec);

  const items = D('dr-items');
  const drItem = (icon, lbl, sub, fn, active) => {
    const it = h('button', { cls: 'dr-item' + (active ? ' dr-item-active' : ''), onClick: fn });
    it.appendChild(iconEl(icon, 'dr-item-icon app-icon'));
    const tx = D(''); tx.appendChild(Object.assign(D('dr-item-lbl'), { textContent: lbl })); if (sub) tx.appendChild(Object.assign(D('dr-item-sub'), { textContent: sub })); it.appendChild(tx); return it;
  };
  items.appendChild(drItem('overview', 'Overview', 'Dashboard & balance', () => set({ tab: 'dash', drawerOpen: false }), S.tab === 'dash'));
  items.appendChild(drItem('food', 'Food Expenses', 'Daily meal tracking', () => set({ tab: 'food', drawerOpen: false }), S.tab === 'food'));
  items.appendChild(drItem('home', 'Home & Toiletries', 'Household spending', () => set({ tab: 'home', drawerOpen: false }), S.tab === 'home'));
  items.appendChild(drItem('bills', 'Bills', 'Monthly bills tracker', () => set({ tab: 'bills', drawerOpen: false }), S.tab === 'bills'));
  items.appendChild(drItem('prices', 'Price Comparison', 'Track & compare prices', () => set({ tab: 'prices', drawerOpen: false }), S.tab === 'prices'));
  items.appendChild(drItem('scan', 'AI Scanner', 'Scan receipts & tags', () => set({ tab: 'scan', drawerOpen: false }), S.tab === 'scan'));
  items.appendChild(drItem('electric', 'Electricity Usage', 'Appliances, aircon & TV', () => set({ tab: 'aircon', drawerOpen: false }), S.tab === 'aircon'));
  items.appendChild(drItem('appliance', 'Appliance Manager', 'Add, edit, delete appliances', () => set({ tab: 'appliances', drawerOpen: false }), S.tab === 'appliances'));
  items.appendChild(drItem('overview', 'Lists & Defaults', 'Budgets and labels', () => set({ tab: 'lists', drawerOpen: false }), S.tab === 'lists'));
  items.appendChild(D('dr-sep'));
  items.appendChild(drItem('reports', 'Reports', 'Monthly spending breakdown', () => set({ tab: 'reports', drawerOpen: false }), S.tab === 'reports'));
  items.appendChild(drItem('stocks', 'Pantry & Stocks', 'Track what you have at home', () => set({ tab: 'stocks', drawerOpen: false }), S.tab === 'stocks'));
  items.appendChild(D('dr-sep'));
  const exp = drItem('upload', 'Export Data (Kipr 1.2)', 'Save Kipr 1.2 backup', exportData); items.appendChild(exp);
  const exp1 = drItem('upload', 'Export Data (Kipr 1)', 'Save Kipr 1 backup (current profile)', exportDataKipr1); items.appendChild(exp1);
  const imp = drItem('download', 'Import Data', 'Restore from backup', () => {

    set({ drawerOpen: false }); // Close drawer immediately to free up the UI for dialogs
    const fi = h('input', { type: 'file', accept: '.json', onchange: e => { importData(e); e.target.value = ''; } });
    fi.click();
  }); items.appendChild(imp);
  items.appendChild(D('dr-sep'));
  items.appendChild(drItem('cloud', 'Cloud Sync', syncLabel(), openSettings, false));
  items.appendChild(drItem('settings', 'Settings', 'API keys & location', openSettings, false));
  drawer.appendChild(items);

  const vInfo = h('div', { style: 'text-align:center;font-size:10px;color:#8a7260;margin:12px 0;opacity:0.5;padding:0 20px' }, `kipr v${APP_VERSION} · Schema v${SCHEMA_VERSION}`);
  drawer.appendChild(vInfo);

  const frag = document.createDocumentFragment(); frag.appendChild(dov); frag.appendChild(drawer);
  return frag;
}