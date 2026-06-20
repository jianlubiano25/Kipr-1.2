import { S, set } from '../state.js';
import { h, D, Btn, BtnI } from '../utils/domHelpers.js';
import { fmt, fmt2 } from '../utils/formatters.js';
import { resizeImage } from '../utils/imageUtils.js';
import { doScan, addScanned, openSettings, scanQty, scanTotal } from '../actions.js';

export function renderScan() {
  const sec = D('sec'); const card = D('card'); const cp = D('cp');
  cp.appendChild(h('span', { cls: 'sf', style: 'font-size:17px;display:block;margin-bottom:4px' }, '📸 AI Scan'));
  cp.appendChild(h('p', { style: 'font-size:12px;color:#8a7260;line-height:1.6;margin-bottom:12px' }, 'Upload a receipt, order screenshot, price tag, menu, or market sign. Save results to food expenses, home expenses, or price comparison.'));
  if (S.geminiKey) {
    cp.appendChild(Object.assign(D('qtip'), { innerHTML: '<strong>Gemini Limits:</strong> Usage is counted per Google Cloud project and per model. The app tries Flash-Lite first, then Flash fallbacks. If quota is reached, wait for the retry time or check AI Studio rate limits.' }));
    const ok = D('row status-good-panel');
    ok.appendChild(h('span', { style: 'font-size:11px;color:#2e6e4f;font-weight:700' }, 'Gemini Active'));
    ok.appendChild(h('button', { style: 'font-size:10.5px;color:#8a7260;background:none;border:none;cursor:pointer', onClick: openSettings }, 'Settings'));
    cp.appendChild(ok);
  } else {
    const notice = D('qtip');
    notice.innerHTML = '<strong>AI Scan needs a Gemini API key.</strong> The rest of the app works without it. Add your key in Settings when you want receipt and price scanning.';
    cp.appendChild(notice);
    const sb = Btn('bgfull', 'Open Settings', openSettings); sb.style.marginBottom = '11px'; cp.appendChild(sb);
  }
  const fi = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
  fi.onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    set({ scanData: null, scanErr: 'Optimizing...', addedIdx: new Set() });
    try { const url = await resizeImage(file); set({ scanImg: url.split(',')[1], scanMime: url.split(';')[0].split(':')[1], scanErr: '' }); }
    catch (err) { set({ scanErr: 'Image error: ' + err.message }); }
  };
  cp.appendChild(fi);
  if (!S.scanImg) { cp.appendChild(BtnI('bp bfull', 'camera', 'Choose Photo / Take a Picture', () => fi.click())); }
  else {
    cp.appendChild(h('img', { src: `data:${S.scanMime};base64,${S.scanImg}`, cls: 'si' }));
    const br = D(''); br.style.cssText = 'display:flex;gap:7px';
    const sb = BtnI('ba', 'search', S.scanning ? 'Analyzing...' : 'Scan Prices', doScan, S.scanning || !S.geminiKey); sb.style.cssText = 'flex:1;padding:11px';
    br.appendChild(sb); br.appendChild(BtnI('bgsm', 'close', '', () => set({ scanImg: null, scanData: null, scanErr: '', addedIdx: new Set() })));
    cp.appendChild(br);
  }
  card.appendChild(cp); sec.appendChild(card);
  if (S.scanErr) { const err = D('aerr'); err.textContent = S.scanErr; sec.appendChild(err); }
  if (S.scanData !== null) {
    const rc = D('card'); rc.appendChild(Object.assign(D('section-hdr-tight'), { innerHTML: `<span class="lbl">Extracted: ${S.scanData.length} item${S.scanData.length !== 1 ? 's' : ''}</span>` }));
    if (!S.scanData.length) rc.appendChild(Object.assign(D('cp muted'), { style: 'text-align:center', textContent: 'No prices found. Try a clearer photo.' }));
    else S.scanData.forEach((item, idx) => {
      const qty = scanQty(item), total = scanTotal(item);
      const row = D('cr row-line'); row.style.padding = '10px 13px';
      const left = D(''); left.style.flex = '1';
      left.appendChild(h('div', { style: 'font-size:12.5px;font-weight:700;text-transform:capitalize' }, item.name));
      left.appendChild(h('div', { style: 'font-size:10.5px;color:#8a7260' }, `${item.store || 'Unknown'} · ${item.unit || 'pcs'} · ${item.subcat || item.category}${qty > 1 ? ' · x' + qty : ''}`));
      const priceBox = D(''); priceBox.style.cssText = 'text-align:right;flex-shrink:0';
      priceBox.appendChild(h('div', { cls: 'sf', style: 'font-size:16px' }, fmt(total)));
      if (qty > 1) priceBox.appendChild(h('div', { style: 'font-size:10px;color:#8a7260' }, `${qty} x ${fmt(item.price)}`));
      const top = D('row'); top.appendChild(left); top.appendChild(priceBox);
      const acts = D(''); acts.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px';
      [['food', 'Food'], ['home', 'Home'], ['price', 'Price']].forEach(([dest, label]) => {
        const added = S.addedIdx.has(`${idx}:${dest}`);
        acts.appendChild(Btn(added ? 'bgsm' : 'bsm', added ? '✓ ' + label : '+ ' + label, () => addScanned(item, idx, dest), added));
      });
      row.appendChild(top); row.appendChild(acts); rc.appendChild(row);
    });
    sec.appendChild(rc);
  }
  return sec;
}