export const pad2=n=>String(n).padStart(2,'0');
export const dateOf=dt=>`${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())}`;
export const timeOf=dt=>`${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
export const dtOf=d=>new Date(d+'T12:00:00');
export const chartLbl=d=>`${d.getDate()} · ${d.toLocaleDateString('en-PH',{weekday:'short'})}`;

export const mk=d=>{const dt=d?new Date(d+'T12:00:00'):new Date();return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;};
export const mklbl=k=>{const[y,m]=k.split('-');return new Date(y,m-1,1).toLocaleDateString('en-PH',{month:'long',year:'numeric'});};
export const curMk=()=>mk();
export const shiftMonthKey=(k,delta)=>{const[y,m]=k.split('-').map(Number),d=new Date(y,m-1+delta,1,12);return mk(dateOf(d));};

export function daysInMonth(y,m){return new Date(y,m+1,0).getDate();}

export function time12Parts(t){
  const m=minsOfDay(t);if(isNaN(m))return{h:'12',mi:'00',ap:'AM'};
  const h24=Math.floor(m/60),mi=pad2(m%60),ap=h24>=12?'PM':'AM';
  const h12=h24%12||12;return{h:String(h12),mi,ap};
}
export function time12To24(h,mi,ap){let hh=parseInt(h)||12;hh=Math.max(1,Math.min(12,hh));let h24=hh%12;if(ap==='PM')h24+=12;return `${pad2(h24)}:${pad2(parseInt(mi)||0)}`;}
export function fmtTime12(t){const p=time12Parts(t);return `${p.h}:${p.mi} ${p.ap}`;}
export function minsOfDay(t){const m=String(t||'').match(/^(\d{1,2}):(\d{2})$/);if(!m)return NaN;const h=+m[1],mi=+m[2];return h>=0&&h<24&&mi>=0&&mi<60?h*60+mi:NaN;}
export function timePlus(t,minutes){const sm=minsOfDay(t);if(isNaN(sm))return '';const m=((sm+Math.round(minutes))%1440+1440)%1440;return `${pad2(Math.floor(m/60))}:${pad2(m%60)}`;}
export function minutesBetween(start,end){const sm=minsOfDay(start),em=minsOfDay(end);if(isNaN(sm)||isNaN(em))return 0;let mins=em-sm;if(mins<=0)mins+=1440;return mins;}
export function durationLabel(minutes){
  const mins=Math.max(0,Math.round(parseFloat(minutes)||0)),d=Math.floor(mins/1440),h=Math.floor((mins%1440)/60),m=mins%60;
  if(d)return `${d}d${h?` ${h}h`:''}${m?` ${m}m`:''}`;
  if(h&&m)return `${h}h ${m}m`;
  if(h)return `${h}h`;
  return `${m}m`;
}
export function toStr(){ return dateOf(new Date()); }
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
