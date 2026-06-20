import { S, set, scrollByTab, rememberContentScroll, onStateUpdate, initializeState } from './state.js';
import { TABS, SCREEN_LABELS } from './constants.js';
import { h, D, iconEl, balanceDisplay, balanceToggleBtn, closeSwipe, getActiveProfileName } from './utils/domHelpers.js';
import { themeFromData } from './utils/electricityUtils.js';
import { initCloud } from './supabase.js';
import { ensureWeather, ensureLiveTick } from './actions.js';
import { renderDrawer } from './components/drawer.js';

// Modals
import { renderModal } from './modals/modalRenderer.js';

// Views
import { renderDash } from './views/dashboard.js';
import { renderFood } from './views/food.js';
import { renderHome } from './views/home.js';
import { renderBills } from './views/bills.js';
import { renderPrices } from './views/prices.js';
import { renderScan } from './views/scan.js';
import { renderElectricity } from './views/electricity.js';
import { renderAppliances } from './views/appliances.js';
import { renderListsDefaults } from './views/lists.js';
import { renderReports } from './views/reports.js';
import { renderStocks } from './views/stocks.js';

// Inject consistent weather day background style
const style = document.createElement('style');
style.textContent = `
  .wv.day { 
    background: linear-gradient(155deg, #28a9cf 0.84%, #1982d3) !important; 
  }
  .theme-dark .weather-card, .theme-nebula .weather-card { opacity: 0.9; }
  /* General card styling for spacing and padding */
  /* Card spacing is controlled by styles.css (single source of truth). */

  .cp { /* Card Padding - common inner content wrapper */
    padding: 22px; /* Spacious card content */
  }
`;
document.head.appendChild(style);

let firstRender = true;
export function render() {
  try {
    const theme = themeFromData(S.data);
    const darkMode = theme === 'dark';
    const nebulaMode = theme === 'nebula';

    // Splash removal trigger - ensure this happens even if sub-renders fail
    const splash = document.getElementById('splash');
    if (splash && !splash.classList.contains('splash-hide') && !splash.dataset.hiding) {
      splash.dataset.hiding = '1';
      splash.classList.toggle('theme-dark', darkMode);
      splash.classList.toggle('theme-nebula', nebulaMode);

      // Fail-safe: some runtimes (Live Server reload, fetch blocking, etc.) can prevent render from
      // being called; reduce the wait so refresh won't leave the user stuck.
      const started = window.__kiprSplashStartedAt || Date.now();
      const wait = Math.max(120 - (Date.now() - started), 0);
      setTimeout(() => {
        splash.classList.add('splash-hide');
        document.body.classList.add('app-ready');
        setTimeout(() => splash.remove(), 200);
      }, wait);
    }

    console.log('[Kipr] Rendering tab:', S.tab);

    // Guard: If an input is focused, don't re-render from background ticks
    if (
      document.activeElement &&
      ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) &&
      !S.modal &&
      !firstRender
    ) {
      return;
    }

    rememberContentScroll();
    ensureLiveTick();

    const appBg = nebulaMode ? '#0B0E1A' : darkMode ? '#15181e' : '#f4f0ea';

    // Reactive theme enforcement for runtime changes
    document.documentElement.style.backgroundColor = appBg;
    document.body.style.backgroundColor = appBg;
    document.body.classList.remove('theme-dark', 'theme-nebula');
    if (darkMode) document.body.classList.add('theme-dark');
    if (nebulaMode) document.body.classList.add('theme-nebula');

    const root = document.getElementById('app');
    if (!root) return;

    root.classList.remove('theme-dark', 'theme-nebula');
    if (darkMode) root.classList.add('theme-dark');
    if (nebulaMode) root.classList.add('theme-nebula');

    firstRender = false;

    root.style.background = appBg;
    const tabKey = S.tab;

    const app = D('bt-app' + (nebulaMode ? ' theme-nebula' : darkMode ? ' theme-dark' : ''));
    app.style.cssText = `margin:0 auto;height:100vh;height:100svh;background:${appBg};display:flex;flex-direction:column;overflow:hidden;min-height:0`;
    app.addEventListener('touchstart', (e) => {
      if (!e.target.closest('.sw')) closeSwipe();
    }, { passive: true });

    app.appendChild(renderDrawer({ darkMode, nebulaMode }));

    const hdr = h('div', { cls: 'hdr' });
    const hrow = h('div', { cls: 'hrow' });

    hrow.appendChild(
      h(
        'button',
        {
          cls: 'h-menu',
          onClick: () => set({ drawerOpen: true }),
          'aria-label': 'Open menu'
        },
        iconEl('menu', 'h-menu-icon app-icon')
      )
    );

    const hmid = D('h-mid');
    hmid.appendChild(Object.assign(D('htitle'), { textContent: SCREEN_LABELS[S.tab] || 'kipr' }));

    // Display active profile name in sub-header
    hmid.appendChild(
      Object.assign(D('hsub'), { textContent: `${getActiveProfileName(S.data)} · Budget · Prices · Savings` })
    );

    const hbal = D('h-bal');
    hbal.appendChild(Object.assign(D('hbl'), { textContent: 'Balance' }));
    const hbalLine = D('bal-line bal-line-head');
    hbalLine.appendChild(Object.assign(D('hbv'), { textContent: balanceDisplay(S.data.balance) }));
    hbalLine.appendChild(balanceToggleBtn('bal-toggle-head'));
    hbal.appendChild(hbalLine);

    hrow.appendChild(hmid);
    hrow.appendChild(hbal);
    hdr.appendChild(hrow);
    app.appendChild(hdr);

    // Content Routing
    let content;
    if (S.tab === 'dash') content = renderDash();
    else if (S.tab === 'food') content = renderFood();
    else if (S.tab === 'home') content = renderHome();
    else if (S.tab === 'bills') content = renderBills();
    else if (S.tab === 'prices') content = renderPrices();
    else if (S.tab === 'scan') content = renderScan();
    else if (S.tab === 'aircon') content = renderElectricity();
    else if (S.tab === 'appliances') content = renderAppliances();
    else if (S.tab === 'lists') content = renderListsDefaults();
    else if (S.tab === 'reports') content = renderReports();
    else if (S.tab === 'stocks') content = renderStocks();
    else content = D('empty', 'Tab under construction'); // Fallback for any unhandled tabs

    content.style.flex = '1';
    content.style.minHeight = '0';
    content.style.overflowY = 'auto';
    content.dataset.tab = tabKey;
    content.addEventListener('scroll', () => {
      scrollByTab[tabKey] = content.scrollTop;
    }, { passive: true });

    app.appendChild(content);

    // Tab bar
    const tb = D('tabbar');
    TABS.forEach(t => {
      const on = S.tab === t.id;
      const b = D('tb' + (on ? ' tb-on' : ''));
      b.appendChild(iconEl(t.icon, 'tb-ic app-icon'));
      b.appendChild(Object.assign(D('tb-lb' + (on ? ' tb-lb-on' : '')), { textContent: t.label }));
      b.onclick = () => set({ tab: t.id });
      tb.appendChild(b);
    });
    app.appendChild(tb);

    const modal = renderModal();
    if (modal) app.appendChild(modal);

    // Modal Layer
    root.replaceChildren(app);

    if (scrollByTab[tabKey] !== undefined) {
      const top = scrollByTab[tabKey];
      requestAnimationFrame(() => {
        content.scrollTop = top;
        setTimeout(() => {
          if (content?.isConnected) content.scrollTop = top;
        }, 0);
      });
    }
  } catch (err) {
    console.error('[Kipr] render() failed:', err);
    const root = document.getElementById('app');
    if (root) {
      root.replaceChildren(D('empty', 'Render failed — check console'));
      root.style.padding = '16px';
    }
  }
}

try {
  // Safety valve: if splash isn't gone in 5 seconds, force it
  setTimeout(() => {
    const s = document.getElementById('splash');
    if (s) {
      s.classList.add('splash-hide');
      setTimeout(() => s.remove(), 400);
    }
  }, 5000);

  onStateUpdate(render);

  // Ensure DOM is ready before initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
  } else {
    startApp();
  }

  function startApp() {
    initializeState();
    render(); // First render to trigger splash removal logic

    // Delay cloud and weather to prevent blocking splash removal
    setTimeout(() => {
      initCloud();
      ensureWeather();
      setInterval(ensureWeather, 300000);
    }, 800);
  }
} catch (fatal) {
  console.error('FATAL BOOT ERROR:', fatal);
  alert('Kipr failed to start: ' + fatal.message);
}

