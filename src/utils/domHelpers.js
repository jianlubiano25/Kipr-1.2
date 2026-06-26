import { S, set, sbHidden } from '../state.js'; // Added set, sbHidden
import { fmt } from './formatters.js';
import { dtOf, fmtTime12, time12Parts, time12To24 } from './dateUtils.js';
import { noteParts } from './electricityUtils.js'; // metaParts uses noteParts

export const ICONS={
  overview:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V20h14v-9.5"/><path d="M9.5 20v-5h5v5"/></svg>',
  food:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8"/><path d="M4.5 3v5.5a2.5 2.5 0 0 0 5 0V3"/><path d="M7 11v10"/><path d="M16.5 3v18"/><path d="M16.5 3c2.2 1.6 3.5 3.9 3.5 6.5 0 2.2-1.2 3.5-3.5 3.5"/></svg>',
  home:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21h16"/><path d="M6 21V9.5L12 5l6 4.5V21"/><path d="M9 21v-6h6v6"/></svg>',
  bills:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8"/><path d="M9 2h6v4H9z"/><path d="M6 5h12v16H6z"/><path d="M9 11h6"/><path d="M9 15h6"/></svg>',
  prices:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13 13 20 4 11V4h7l9 9Z"/><path d="M7.5 7.5h.01"/></svg>',
  scan:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 10h8"/><path d="M8 14h6"/></svg>',
  electric:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z"/></svg>',
  appliance:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7V3"/><path d="M17 7V3"/><path d="M8 7h8a3 3 0 0 1 3 3v3a7 7 0 0 1-14 0v-3a3 3 0 0 1 3-3Z"/><path d="M12 20v2"/></svg>',
  reports:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16"/><path d="M7 16V9"/><path d="M12 16V5"/><path d="M17 16v-3"/></svg>',
  stocks:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/></svg>',
  upload:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg>',
  download:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/></svg>',
  cloud:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 18H8a5 5 0 1 1 .8-9.9A6.5 6.5 0 0 1 21 11.5 3.5 3.5 0 0 1 17.5 18Z"/></svg>',
  settings:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="m4.93 4.93 2.12 2.12"/><path d="m16.95 16.95 2.12 2.12"/><path d="M2 12h3"/><path d="M19 12h3"/><path d="m4.93 19.07 2.12-2.12"/><path d="m16.95 7.05 2.12-2.12"/></svg>',
  menu:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>',
  sun:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  moon:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.4 14.5A8.3 8.3 0 0 1 9.5 3.6 8.3 8.3 0 1 0 20.4 14.5Z"/></svg>',
  northStar:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 14.2 9.8 21.5 12 14.2 14.2 12 21.5 9.8 14.2 2.5 12 9.8 9.8 12 2.5Z"/><path d="M12 8.5v7"/><path d="M8.5 12h7"/></svg>',
  edit:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>',
  trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/></svg>',
  camera:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>',
  check:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  warning:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/></svg>'
};

export const h=(tag,attrs,...ch)=>{
  const el=document.createElement(tag);
  if(attrs)for(const[k,v]of Object.entries(attrs)){
    if(k==='cls')el.className=v;
    else if(k.startsWith('on')&&typeof v==='function')el.addEventListener(k.slice(2).toLowerCase(),v);
    else if(k==='style'&&typeof v==='object')Object.assign(el.style,v);
    else if(v!=null&&v!==false)el.setAttribute(k,v);
  }
  for(const c of ch.flat(Infinity)){if(c==null||c===false)continue;if(typeof c==='string'||typeof c==='number')el.appendChild(document.createTextNode(String(c)));else if(c instanceof Node)el.appendChild(c);}
  return el;
};
export const D=(cls,...c)=>h('div',{cls},...c);
export const Sp=(cls,t)=>h('span',{cls},t);

export const Btn=(cls,t,fn,dis)=>h('button',{cls:'btn '+cls,onClick:fn,...(dis?{disabled:true}:{})},t);
export const BtnI=(cls,ic,t,fn,dis)=>Btn(cls,iconLabel(ic,t),fn,dis);
export const Inp=(cls,opts)=>h('input',{cls:'inp '+cls,...opts});
export const Sel=(val,opts,fn,cls='',optItems)=>{const el=h('select',{cls:'sel '+cls});(optItems||opts).forEach(o=>{const v=o.value??o,t=o.text??o;const op=h('option',{value:v},t);if(v===val)op.selected=true;el.appendChild(op);});el.addEventListener('change',e=>fn(e.target.value));return el;};
export const Fg=(lbl,el,sub,id=null)=>{const f=D('fg');if(id)f.id=id;f.appendChild(h('label',{cls:'fl'},lbl));f.appendChild(el);if(sub)f.appendChild(h('div',{cls:'tiny-muted',style:'margin-top:2px'},sub));return f;};
export const Mr=(...bs)=>{const r=D('mr');bs.forEach(b=>r.appendChild(b));return r;};
export const DivHdr=(t)=>{const d=D('section-hdr');d.appendChild(h('span',{cls:'section-hdr-title'},t));return d;};

export function iconEl(name,cls='app-icon'){
  const el=h('span',{cls});
  el.innerHTML=ICONS[name]||ICONS.overview;
  return el;
}
export function iconLabel(icon,label){
  const frag=document.createDocumentFragment();
  frag.appendChild(iconEl(icon,'btn-icon app-icon'));
  frag.appendChild(document.createTextNode(label));
  return frag;
}

export const balanceDisplay=n=>S.balanceHidden?'₱••••••':fmt(n);
export function balanceToggleBtn(extraCls=''){
  const btn=h('button',{
    cls:`bal-toggle ${extraCls}`.trim(),
    type:'button',
    title:S.balanceHidden?'Show balance':'Hide balance',
    'aria-label':S.balanceHidden?'Show balance':'Hide balance',
    onClick:e=>{e.stopPropagation();const hidden=!S.balanceHidden;sbHidden(hidden);set({balanceHidden:hidden});}
  });
  btn.innerHTML=S.balanceHidden
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6.5 0 10 6 10 6a17.9 17.9 0 0 1-3.1 3.7"/><path d="M6.5 6.8C3.6 8.7 2 12 2 12s3.5 6 10 6a9.9 9.9 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  return btn;
}

export function dateBadgeClass(date){
  const dt=dtOf(date),week=Math.min(5,Math.max(1,Math.ceil(dt.getDate()/7)));
  return `bdg bdg-w${week}`;
}
export function dateBadge(date){
  const dt=dtOf(date);
  return Sp(dateBadgeClass(date),dt.toLocaleDateString('en-PH',{month:'short',day:'numeric'}));
}
export function dateSpanLabel(u){
  const start=u.startDate||u.date,end=u.endDate||u.date;
  if(!start || !end || end === start) return dateBadge(start || toStr());
  const frag = document.createDocumentFragment();
  frag.appendChild(dateBadge(start));
  const arrow = h('span', { style: 'margin: 0 2px; color: #8a7260; opacity: 0.5' }, '→');
  frag.appendChild(arrow);
  frag.appendChild(dateBadge(end));
  return frag;
}
export function auditDateBadge(r){
  if(r.dateLabel)return Sp(r.dateClass||'bdg bdg-w3',r.dateLabel);
  if(r.date&&r.date!=='whole window')return dateBadge(r.date);
  return Sp(r.dateClass||'bdg bdg-w3','Audit Window');
}
export function auditDateText(r){
  return r.dateLabel||((r.date&&r.date!=='whole window')?r.date:'Meter window');
}
export function logSortDate(u){return u?.endDate||u?.date||'';}
export function metaLine(parts=[],date){
  const meta=D('meta-line');
  if(date)meta.appendChild(dateBadge(date));
  const arr = Array.isArray(parts) ? parts : String(parts||'').split(' · ').filter(Boolean);
  arr.filter(Boolean).forEach(p=>meta.appendChild(h('span',{cls:'meta-clip'},p)));
  return meta;
}
export function categoryBadge(cat){
  const slug=String(cat||'Others').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'others';
  return h('span',{cls:`cat-badge cat-${slug}`},cat||'Others');
};
export function EmptyCard(icon,title){
  const e=D('card empty');
  e.appendChild(iconEl(icon,'empty-icon app-icon'));
  e.appendChild(h('div',{},title));
  return e;
}
export function metricTiles(items,compact=false){
  const grid=D('metric-grid');
  grid.style.setProperty('--metric-count',items.length);
  grid.style.setProperty('--metric-gap',compact?'4px':'6px');
  grid.style.setProperty('--metric-top',compact?'6px':'8px');
  items.forEach(it=>{
    const tile=D('metric-tile'+(compact?' metric-tile-compact':''));
    tile.appendChild(h('div',{cls:'metric-label'+(compact?' metric-label-compact':'')},it.label));
    const value=h('div',{cls:'sf metric-value'+(compact?' metric-value-compact':'')},it.value);
    if(it.color)value.style.color=it.color;
    tile.appendChild(value);
    grid.appendChild(tile);
  });
  return grid;
};
export function Time12Control(value,onChange){
  const p=time12Parts(value),wrap=D('');
  wrap.style.cssText='display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px';
  const hours=Array.from({length:12},(_,i)=>String(i+1));
  const mins=Array.from({length:12},(_,i)=>String(i*5).padStart(2,'0'));
  let hh=p.h,mm=p.mi,ap=p.ap;
  if(!mins.includes(mm))mins.push(mm),mins.sort();
  const hs=Sel(hh,hours,v=>{hh=v;onChange(time12To24(hh,mm,ap));});
  const ms=Sel(mm,mins,v=>{mm=v;onChange(time12To24(hh,mm,ap));});
  const as=Sel(ap,['AM','PM'],v=>{ap=v;onChange(time12To24(hh,mm,ap));});
  wrap.appendChild(hs);wrap.appendChild(ms);wrap.appendChild(as);
  return wrap;
};

let openSw=null;
export function closeSwipe(){if(openSw){const c=openSw.querySelector('.swc');if(c)c.style.transform='';openSw=null;}}
export function swRow(content,onEdit,onDel,onOff){
  const wrap=D('sw');
  const acts=D('swa');
  if(onOff){const ob=h('button',{cls:'sw-off',onClick:(e)=>{e.stopPropagation();closeSwipe();onOff();}});ob.innerHTML='⏻<span style="font-size:10px">Off</span>';acts.appendChild(ob);}
  if(onEdit){const eb=h('button',{cls:'sw-edit',onClick:(e)=>{e.stopPropagation();closeSwipe();onEdit();}});eb.appendChild(iconEl('edit','sw-action-icon app-icon'));eb.appendChild(h('span',{cls:'sw-action-label'},'Edit'));acts.appendChild(eb);}
  const db=h('button',{cls:'sw-del',onClick:(e)=>{e.stopPropagation();closeSwipe();onDel();}});db.appendChild(iconEl('trash','sw-action-icon app-icon'));db.appendChild(h('span',{cls:'sw-action-label'},'Delete'));acts.appendChild(db);
  const sc=D('swc');sc.appendChild(content);
  wrap.appendChild(acts);wrap.appendChild(sc);
  const AW=(onOff?62:0)+(onEdit?62:0)+62;

  // Gesture state
  let sx=0,sy=0,gk=false,ih=false,mouseDown=false,mouseDragged=false;

  const setOpenState = (open)=>{
    if(open){
      sc.style.transition='transform .15s ease';
      sc.style.transform=`translateX(-${AW}px)`;
      openSw=wrap;
    }else{
      sc.style.transition='transform .15s ease';
      sc.style.transform='';
      if(openSw===wrap) openSw=null;
    }
  };

  const moveSwipe=(x,y,prevent)=>{
    const dx=x-sx,dy=y-sy;
    if(!gk&&(Math.abs(dx)>4||Math.abs(dy)>4)){ih=Math.abs(dx)>Math.abs(dy);gk=true;}
    if(!ih)return;
    if(prevent)prevent();

    const isOpen=openSw===wrap;
    // If already open, allow dragging back towards center (dx positive)
    const base=isOpen?-AW:0;
    const off=Math.max(Math.min(base+dx,0),-AW);
    sc.style.transform=`translateX(${off}px)`;

    if(dx<0&&openSw&&openSw!==wrap)closeSwipe();
  };

  const endSwipe=(x)=>{
    if(!ih)return;
    sc.style.transition='transform .15s ease';
    const dx=x-sx;
    const isOpen=openSw===wrap;
    if(!isOpen&&dx<-40){setOpenState(true);}
    else if(isOpen&&dx>40){setOpenState(false);}
    else if(!isOpen){setOpenState(false);}
    else{setOpenState(true);}
  };

  sc.addEventListener('touchstart',e=>{
    // On touch start, only start gesture if not already opened by a different row
    if(openSw && openSw!==wrap) closeSwipe();
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;
    gk=false;ih=false;
    mouseDragged=false;
    sc.style.transition='none';
  },{passive:true});

  sc.addEventListener('touchmove',e=>{
    moveSwipe(e.touches[0].clientX,e.touches[0].clientY,()=>e.preventDefault());
  },{passive:false});

  sc.addEventListener('touchend',e=>{
    endSwipe(e.changedTouches[0].clientX);
    // If gesture was tiny, do a clean reset
    if(Math.abs(e.changedTouches[0].clientX - sx) < 8 && openSw===wrap) setOpenState(false);
  },{passive:true});

  sc.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='mouse'||e.button!==0)return;
    if(openSw && openSw!==wrap) closeSwipe();
    sx=e.clientX;sy=e.clientY;gk=false;ih=false;
    mouseDown=true;mouseDragged=false;
    sc.style.transition='none';
    sc.setPointerCapture?.(e.pointerId);
  });

  sc.addEventListener('pointermove',e=>{
    if(!mouseDown||e.pointerType!=='mouse')return;
    moveSwipe(e.clientX,e.clientY,()=>e.preventDefault());
    if(ih)mouseDragged=true;
  });

  sc.addEventListener('pointerup',e=>{
    if(!mouseDown||e.pointerType!=='mouse')return;
    mouseDown=false;
    endSwipe(e.clientX);
    sc.releasePointerCapture?.(e.pointerId);
  });

  sc.addEventListener('pointercancel',e=>{if(e.pointerType==='mouse')mouseDown=false;});

  sc.addEventListener('click',e=>{
    if(mouseDragged){
      e.preventDefault();
      e.stopPropagation();
      mouseDragged=false;
    }
  },true);

  // Also ensure when the row is removed/rebuilt it never leaves an open swipe.
  // (Avoids “closes after initial swipe” on some rerenders.)
  wrap.addEventListener('focusout',()=>{if(openSw===wrap) setOpenState(false);});

  return wrap;
}

export function getActiveProfileName(data) {
  return (data.profiles || []).find(p => p.id === data.activeProfileId)?.name || 'Primary';
}
