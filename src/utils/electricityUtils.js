import { S } from '../state.js';
import { DEFAULT_AIRCON_RATES, AIRCON_MODEL_PROFILE, DEFAULT_WEATHER, LABEL_DEFAULTS, SCATS, UNITS, AIRCON_MODES, GLOBAL_SETTINGS_KEYS } from '../constants.js'; 
import { dateOf, timeOf, dtOf, minsOfDay, timePlus, minutesBetween, daysInMonth, pad2, chartLbl, curMk, mklbl, uid, mk, durationLabel, fmtTime12 } from './dateUtils.js'; // Added pad2, chartLbl, curMk, mklbl
import { h, D, Btn, dateBadgeClass, logSortDate } from './domHelpers.js'; // Added for renderWeatherCard, dateBadgeClass, logSortDate

export { SCATS, UNITS, AIRCON_MODES, dateBadgeClass, logSortDate };

export function stockCatFromHome(cat){return cat==='Cleaning Supplies'?'Cleaning':cat==='Laundry'?'Cleaning':cat==='Toiletries & Personal Care'?'Toiletries':cat==='Medicine & First Aid'?'Medicine':cat==='Kitchen Supplies'?'Kitchen':'Others';}
export function isGroceryTx(t){return t?.source==='Groceries';}
export function isHomeCookedTx(t){return t?.source==='Home-cooked';}
export function noteParts(...parts){return parts.flatMap(p=>String(p||'').split(' · ')).map(p=>p.trim()).filter(Boolean).filter((p,i,a)=>a.findIndex(x=>x.toLowerCase()===p.toLowerCase())===i).join(' · ');}
export function stockFromHome(item,id=uid()){return {id,name:item.name,category:stockCatFromHome(item.category),quantity:parseFloat(item.qty)||1,unit:item.unit||'pcs',minQty:0,date:item.date||dateOf(new Date()),note:noteParts(item.store,item.note)};}
export function groceryName(tx){return String(tx.stockName||tx.note||'Groceries').split(' · ')[0].trim()||'Groceries';}
export function stockCatFromFood(subcat){return subcat==='Condiments & Sauces'?'Condiments':'Food Staples';}
export function stockFromGrocery(tx,id=uid()){return {id,name:groceryName(tx),category:tx.stockCategory||stockCatFromFood(tx.subcat)||'Food Staples',quantity:parseFloat(tx.qty)||1,unit:tx.unit||'pcs',minQty:0,date:tx.date||dateOf(new Date()),note:'From groceries'};}
export function meralcoReadDay(data){return Math.max(1,Math.min(31,parseInt(data?.meralcoReadDay)||12));}
export function cycleForDate(dateLike,readDay=12){
  const dt=dateLike instanceof Date?new Date(dateLike):dtOf(dateLike||dateOf(new Date()));
  const y=dt.getFullYear(),m=dt.getMonth(),day=dt.getDate();
  const thisRead=Math.min(readDay,daysInMonth(y,m));
  const end=day<=thisRead?new Date(y,m,thisRead,12):new Date(y,m+1,Math.min(readDay,daysInMonth(y,m+1)),12);
  const prevRead=Math.min(readDay,daysInMonth(end.getFullYear(),end.getMonth()-1));
  const start=new Date(end.getFullYear(),end.getMonth()-1,prevRead+1,12);
  return{key:dateOf(end),start,end,readDay};
}
export function shiftCycleKey(cycleKey,delta,readDay=meralcoReadDay(S?.data)){
  const base=dtOf(cycleKey||dateOf(new Date()));
  base.setMonth(base.getMonth()+delta);
  const last=daysInMonth(base.getFullYear(),base.getMonth());
  base.setDate(Math.min(readDay,last));
  return cycleForDate(base,readDay).key;
}
export function cycleLabel(c){
  const sameYear=c.start.getFullYear()===c.end.getFullYear();
  const optsStart={month:'short',day:'numeric',...(sameYear?{}:{year:'numeric'})};
  return `${c.start.toLocaleDateString('en-PH',optsStart)}-${c.end.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})}`;
}
export function inCycle(item,cycle){
  const s=dtOf(item.startDate||item.date),e=dtOf(item.endDate||item.date);
  return e>=cycle.start&&s<=cycle.end;
}
export function cycleDays(c){return Math.round((c.end-c.start)/86400000)+1;}

export function isDayMinute(min){const m=((min%1440)+1440)%1440;return m>=360&&m<1080;}
export function airconRates(data=S?.data){
  const d=data||S?.data||{}; return{
    startup:parseFloat(d.airconStartupRate)||DEFAULT_AIRCON_RATES.startup,
    sleepDay:parseFloat(d.airconSleepDayRate)||DEFAULT_AIRCON_RATES.sleepDay,
    sleepNight:parseFloat(d.airconSleepNightRate)||DEFAULT_AIRCON_RATES.sleepNight,
    ecoDay:parseFloat(d.airconEcoDayRate)||DEFAULT_AIRCON_RATES.ecoDay,
    ecoNight:parseFloat(d.airconEcoNightRate)||DEFAULT_AIRCON_RATES.ecoNight,
    day:parseFloat(d.airconDayRate)||DEFAULT_AIRCON_RATES.day,
    night:parseFloat(d.airconNightRate)||DEFAULT_AIRCON_RATES.night
  };
}
export function airconModeFrom(value,sleepMode){
  const raw=String(value||'').toLowerCase();
  if(raw==='eco'||raw==='normal'||raw==='sleep')return raw;
  return sleepMode===false?'normal':'sleep';
}
export function airconModeLabel(value,sleepMode){
  const mode=airconModeFrom(value,sleepMode);
  return mode==='eco'?'Eco':mode==='normal'?'Normal':'Sleep';
}
export function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
export function numIn(v,fallback,min,max){const n=parseFloat(v);return isNaN(n)?fallback:clamp(n,min,max);}
export function airconTempFactor(tempC,data=S?.data){
  const temp=parseFloat(tempC),baseline=parseFloat(data?.airconTempBaseline)||29,step=(parseFloat(data?.airconTempStepPct)||7)/100;
  if(isNaN(temp))return 1;
  return clamp(1+(baseline-temp)*step,0.75,1.35);
}
export function airconOutdoorFactor(outdoorTemp,data=S?.data){
  const temp=parseFloat(outdoorTemp),baseline=parseFloat(data?.airconOutdoorBaseline)||30,step=(parseFloat(data?.airconOutdoorStepPct)||2.5)/100;
  if(isNaN(temp))return 1;
  return clamp(1+(temp-baseline)*step,0.85,1.25);
}
export function airconRateForMinute(min,mode='sleep',rates=airconRates(),tempC='',outdoorTemp='',data=S?.data){
  const day=isDayMinute(min),m=airconModeFrom(mode), r = rates || airconRates(data);
  const base=m==='eco'?(day?r.ecoDay:r.ecoNight):m==='normal'?(day?r.day:r.night):(day?r.sleepDay:r.sleepNight);
  return base*airconTempFactor(tempC,data)*airconOutdoorFactor(outdoorTemp,data);
}
export function airconSessionFromMinutes(startMin,totalMinutes,mode='sleep',date,start,end,rates=airconRates(),tempC='',outdoorTemp='',data=S?.data){
  const mins=Math.max(1,Math.round(totalMinutes));
  let kwh=0;
  const useMode=airconModeFrom(mode);
  const r = rates || airconRates(data);
  for(let i=0;i<mins;i++){
    const runRate=airconRateForMinute(startMin+i,useMode,r,tempC,outdoorTemp,data);
    const phaseRate=i<15?r.startup:i<60?(r.startup*(1-(i-15)/45)+runRate*((i-15)/45)):runRate;
    kwh+=phaseRate/60;
  }
  return{date,start,end,mode:useMode,sleepMode:useMode==='sleep',minutes:mins,hours:mins/60,kwh};
}
export function airconSessionFromParts(date,start,end,mode='sleep',rates=airconRates(S?.data),tempC='',outdoorTemp='',data=S?.data){
  const sm=minsOfDay(start),em=minsOfDay(end);if(isNaN(sm)||isNaN(em))return null;
  let total=em-sm;if(total<=0)total+=1440;
  return airconSessionFromMinutes(sm,total,mode,date,start,end,rates,tempC,outdoorTemp,data);
}
export function airconSessionFromDates(startDt,endDt,mode='sleep',rates=airconRates(),tempC='',outdoorTemp='',data=S?.data){
  const mins=Math.max(1,Math.round((endDt-startDt)/60000));
  let kwh=0;
  const useMode=airconModeFrom(mode);
  const r = rates || airconRates(data);
  for(let i=0;i<mins;i++){
    const dt=new Date(startDt.getTime()+i*60000),runRate=airconRateForMinute(dt.getHours()*60+dt.getMinutes(),useMode,r,tempC,outdoorTemp,data);
    const phaseRate=i<15?r.startup:i<60?(r.startup*(1-(i-15)/45)+runRate*((i-15)/45)):runRate;
    kwh+=phaseRate/60;
  }
  const sd = dateOf(startDt), ed = dateOf(endDt);
  const out = {date:sd,start:timeOf(startDt),end:timeOf(endDt),mode:useMode,sleepMode:useMode==='sleep',minutes:mins,hours:mins/60,kwh};
  if(sd !== ed) { out.startDate = sd; out.endDate = ed; }
  return out;
}
export function applianceMonthly(a,rate=S?.data?.meralcoRate||14.3345){
  const watts=parseFloat(a.watts)||0,qty=parseFloat(a.qty)||1;
  const hours=a.alwaysOn?24:0;
  const days=a.alwaysOn?30:0;
  const kwh=(watts*qty*hours*days)/1000;
  return{watts,qty,hours,days,kwh,cost:kwh*rate};
}
export function applianceAlwaysOnEstimate(a,start,end,rate=S?.data?.meralcoRate||14.3345){
  if(!a.alwaysOn)return{watts:parseFloat(a.watts)||0,qty:parseFloat(a.qty)||1,hours:0,kwh:0,cost:0};
  const since=a.alwaysOnSince?new Date(a.alwaysOnSince):null;
  const activeStart=since&&!isNaN(since)?new Date(Math.max(start,since)):start;
  const hours=Math.max(0,(end-activeStart)/36e5),watts=parseFloat(a.watts)||0,qty=parseFloat(a.qty)||1;
  const kwh=watts*qty*hours/1000;
  return{watts,qty,hours,kwh,cost:kwh*rate};
}
export function alwaysOnStartFor(ap,d,now=new Date()){
  const since=ap.alwaysOnSince?new Date(ap.alwaysOnSince):null;
  if(since&&!isNaN(since)&&since<now)return since;
  const created=ap.createdAt?new Date(ap.createdAt):null;
  if(created&&!isNaN(created)&&created<now)return created;
  const cycle=cycleForDate(now,meralcoReadDay(d));
  return new Date(`${dateOf(cycle.start)}T00:00:00`);
}
export function alwaysOnSinceLabel(ap,d=S?.data){
  const dt=alwaysOnStartFor(ap,d);
  const label=dt.toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})+' · '+fmtTime12(timeOf(dt));
  return `On since ${label}${ap.alwaysOnSince||ap.createdAt?'':' (cycle start)'}`;
}
export function cycleDateRange(cycle){
  const start=new Date(`${dateOf(cycle.start)}T00:00:00`);
  const end=new Date(`${dateOf(cycle.end)}T00:00:00`);
  end.setDate(end.getDate()+1);
  return{start,end};
}
export function applianceLabel(a){
  const e=applianceMonthly(a);
  const mins=parseFloat(a.sessionMinutes)||Math.round((parseFloat(a.hoursPerDay)||1)*60)||60;
  return `${e.qty}x · ${e.watts}W · ${a.alwaysOn?'24/7':`${durationLabel(mins)}/log`}`;
}
export function applianceSessionEstimate(appliance,minutes,rate=14.3345){
  const watts=parseFloat(appliance?.watts)||0,qty=parseFloat(appliance?.qty)||1,mins=parseFloat(minutes)||0;
  const kwh=watts*qty*(mins/60)/1000;
  return{kwh,cost:kwh*rate};
}
export function auditDateTime(date,time,endOfDay=false){
  if(!date)return null;
  const t=time|| (endOfDay?'23:59':'00:00');
  const dt=new Date(`${date}T${t}:00`);
  return isNaN(dt)?null:dt;
}
export function usageDateRange(u,start,end){
  if(u.startedAt||u.endedAt){
    const s=new Date(u.startedAt||`${u.startDate||u.date}T${u.start||'00:00'}:00`);
    let e=new Date(u.endedAt||`${u.endDate||u.date}T${u.end||'23:59'}:00`);
    if(isNaN(s)||isNaN(e))return null;
    if(e<=s)e=new Date(e.getTime()+86400000);
    return{s,e,exact:true};
  }
  if(u.startDate||u.endDate){
    const s=auditDateTime(u.startDate||u.date,u.start||'00:00'),e=auditDateTime(u.endDate||u.date,u.end||'23:59');
    return s&&e?{s,e:e<=s?new Date(e.getTime()+86400000):e,exact:true}:null;
  }
  const hasTime=u.start&&u.end;
  if(hasTime){
    const s=auditDateTime(u.date,u.start),e=auditDateTime(u.date,u.end);
    if(!s||!e)return null;
    if(e<=s)e.setDate(e.getDate()+1);
    return{s,e,exact:true};
  }
  const s=auditDateTime(u.date,'00:00'),e=auditDateTime(u.date,'23:59');
  return s&&e?{s,e,exact:false}:null;
}
export function overlapsRange(s,e,start,end){return s<end&&e>start;}
export function overlapRatio(u,start,end){
  const r=usageDateRange(u,start,end);
  if(!r)return 0;
  const total=Math.max(1,r.e-r.s),overlap=Math.max(0,Math.min(r.e,end)-Math.max(r.s,start));
  return overlap/total;
}
export function usageCostInRange(u,start,end){return (parseFloat(u.cost)||0)*overlapRatio(u,start,end);}
export function usageKwhInRange(u,start,end){return (parseFloat(u.kwh)||0)*overlapRatio(u,start,end);}
export function overlapMinutes(u,start,end){
  const r=usageDateRange(u,start,end);
  if(!r)return 0;
  return Math.max(0,Math.round((Math.min(r.e,end)-Math.max(r.s,start))/60000));
}
export function auditApplianceKwhInRange(u,start,end){
  if(!u?.start&&!u?.end&&!u?.startDate&&!u?.endDate){
    const r=usageDateRange(u,start,end);
    return r&&overlapsRange(r.s,r.e,start,end)?(parseFloat(u.kwh)||0):0;
  }
  return usageKwhInRange(u,start,end);
}
export function meterAudit(data, f){
  const start=auditDateTime(f?.startDate,f?.startTime),end=auditDateTime(f?.endDate,f?.endTime);
  const startRead=parseFloat(f?.startRead),endRead=parseFloat(f?.endRead),rate=parseFloat(data?.meralcoRate)||14.3345;
  if(!start||!end||end<=start)return{valid:false,error:'Enter a valid start and end time.'};
  const meterKwh=!isNaN(startRead)&&!isNaN(endRead)?endRead-startRead:0;
  const hours=(end-start)/36e5;
  const include=(u)=>{const r=usageDateRange(u,start,end);return r&&overlapsRange(r.s,r.e,start,end);};
  const aircon=(data?.airconUsage||[]).filter(include);
  const tv=(data?.tvUsage||[]).filter(include);
  const appliances=(data?.applianceUsage||[]).filter(include);
  const sumInRange=rows=>rows.reduce((s,u)=>s+usageKwhInRange(u,start,end),0);
  const airconKwh=sumInRange(aircon),tvKwh=sumInRange(tv),sessionKwh=appliances.reduce((s,u)=>s+auditApplianceKwhInRange(u,start,end),0);
  const alwaysRows=(data?.appliances||[]).filter(a=>a.alwaysOn).map(a=>{
    const est=applianceAlwaysOnEstimate(a,start,end,rate);
    return{...a,...est};
  }).filter(a=>a.kwh>0);
  const alwaysKwh=alwaysRows.reduce((s,a)=>s+a.kwh,0);
  const loggedKwh=airconKwh+tvKwh+sessionKwh,estimatedKwh=loggedKwh+alwaysKwh;
  const gap=meterKwh?meterKwh-estimatedKwh:0;
  const matchPct=meterKwh>0?estimatedKwh/meterKwh*100:0;
  return{valid:true,start,end,hours,meterKwh,aircon,tv,appliances,alwaysRows,airconKwh,tvKwh,sessionKwh,alwaysKwh,loggedKwh,estimatedKwh,gap,matchPct,rate};
}
export function applianceSessionDraft(appliance,date=dateOf(new Date())){
  const mins=parseFloat(appliance?.sessionMinutes)||60,start=timeOf(new Date());
  return{applianceId:appliance?.id||'',date,start,end:timePlus(start,mins),minutes:String(mins)};
}
export function coffeeAppliance(data){
  return (data?.appliances||[]).find(a=>!a.alwaysOn&&/kettle|water heater|coffee/i.test(`${a.name||''} ${a.category||''} ${a.note||''}`));
}
export function timedSessionDraft(form={},fallbackMinutes=60){
  const start=timeOf(new Date()),mins=minutesBetween(form.start,form.end)||fallbackMinutes;
  return{...form,date:dateOf(new Date()),start,end:timePlus(start,mins)};
}
export function activeElapsedMinutes(s,now=new Date()){return Math.max(1,Math.round((now-new Date(s.startedAt))/60000));}
export function activeEstimate(s,now=new Date(),data=S?.data){
  const mins=activeElapsedMinutes(s,now);
  if(s.type==='aircon'){
    const session=airconSessionFromDates(new Date(s.startedAt),now,airconModeFrom(s.mode,s.sleepMode),airconRates(data),s.tempC,s.outdoorTemp,data);
    return{minutes:mins,kwh:session.kwh,cost:session.kwh*(data?.meralcoRate||14.3345)};
  }
  const watts=parseFloat(s.watts)||0,qty=parseFloat(s.qty)||1,kwh=watts*qty*(mins/60)/1000;
  return{minutes:mins,kwh,cost:kwh*(data?.meralcoRate||14.3345)};
}
export function electricityBill(data){
  return (data?.bills||[]).find(b => {
    const n = String(b.name||'').toLowerCase();
    return n.includes('electric') || n.includes('meralco');
  });
}
export function billMonthFromCycle(cycle){return mk(cycle.key);}
export function billCycleForMonth(monthKey,readDay=meralcoReadDay()){
  const[y,m]=monthKey.split('-').map(Number),last=daysInMonth(y,m-1);
  return cycleForDate(`${monthKey}-${pad2(Math.min(readDay,last))}`,readDay);
}
export function meralcoKwhForCycle(cycle,data=S?.data){
  const bill=electricityBill(data);
  return parseFloat(bill?.monthlyKwh?.[billMonthFromCycle(cycle)])||0;
}
export function electricityCycleEstimate(cycle,data){
  const aircon=(data?.airconUsage||[]).filter(u=>inCycle(u,cycle));
  const tv=(data?.tvUsage||[]).filter(u=>inCycle(u,cycle));
  const applianceSessions=(data?.applianceUsage||[]).filter(u=>inCycle(u,cycle));
  const cr=cycleDateRange(cycle);
  const airconKwh=aircon.reduce((s,u)=>s+usageKwhInRange(u,cr.start,cr.end),0);
  const tvKwh=tv.reduce((s,u)=>s+usageKwhInRange(u,cr.start,cr.end),0);
  const sessionKwh=applianceSessions.reduce((s,u)=>s+usageKwhInRange(u,cr.start,cr.end),0);
  const alwaysKwh=(data?.appliances||[]).filter(a=>a.alwaysOn).reduce((s,a)=>s+applianceAlwaysOnEstimate(a,cr.start,cr.end,data?.meralcoRate||14.3345).kwh,0);
  const variableKwh=airconKwh+tvKwh+sessionKwh;

  const now = new Date();
  const start = new Date(cycle.start);
  const end = new Date(cycle.end);
  const isCurrent = now >= start && now <= end;

  let projectedKwh = variableKwh + alwaysKwh;
  if(isCurrent){
    const elapsedDays = Math.max(0.5, (now - start) / 86400000); // Reverted to 0.5 floor from app.js reference
    const totalDays = Math.round((end - start) / 86400000) + 1;
    projectedKwh = ((variableKwh / elapsedDays) * totalDays) + alwaysKwh;
  }

  return{airconKwh,tvKwh,sessionKwh,alwaysKwh,totalKwh:variableKwh+alwaysKwh,projectedKwh,isCurrent,logs:aircon.length+tv.length+applianceSessions.length};
}
export function electricityDailyChart(cycle,data=S?.data,range='cycle'){
  const usage=data?.airconUsage||[],tvUsage=data?.tvUsage||[],applianceUsage=data?.applianceUsage||[];
  const alwaysOn=(data?.appliances||[]).filter(a=>a.alwaysOn);
  const meralcoKwh=meralcoKwhForCycle(cycle,data),meralcoDailyKwh=meralcoKwh?meralcoKwh/cycleDays(cycle):0;
  let days=[];
  if(range==='7'){
    days=Array.from({length:7},(_,i)=>{const dd=new Date();dd.setDate(dd.getDate()-(6-i));return dd;});
  }else{
    for(let dd=new Date(cycle.start);dd<=cycle.end;dd.setDate(dd.getDate()+1))days.push(new Date(dd));
  }
  return days.map(dd=>{
    const ds=dateOf(dd),air=usage.filter(u=>u.date===ds),tv=tvUsage.filter(u=>u.date===ds);
    const dayStart=new Date(`${ds}T00:00:00`),dayEnd=new Date(dayStart);dayEnd.setDate(dayEnd.getDate()+1);
    const ap=applianceUsage.filter(u=>overlapRatio(u,dayStart,dayEnd)>0);
    const alwaysEst=alwaysOn.reduce((s,a)=>{
      const est=applianceAlwaysOnEstimate(a,dayStart,dayEnd,data?.meralcoRate||14.3345);
      return{cost:s.cost+est.cost,kwh:s.kwh+est.kwh};
    },{cost:0,kwh:0});
    const airCost=air.reduce((s,u)=>s+u.cost,0),tvCost=tv.reduce((s,u)=>s+u.cost,0),apCost=ap.reduce((s,u)=>s+usageCostInRange(u,dayStart,dayEnd),0);
    const airKwh=air.reduce((s,u)=>s+u.kwh,0),tvKwh=tv.reduce((s,u)=>s+u.kwh,0),apKwh=ap.reduce((s,u)=>s+usageKwhInRange(u,dayStart,dayEnd),0);
    const estKwh=airKwh+tvKwh+apKwh+alwaysEst.kwh;
    return{label:range==='7'?chartLbl(dd):String(dd.getDate()),ds,cost:airCost+tvCost+apCost+alwaysEst.cost,kwh:meralcoDailyKwh||estKwh,estimatedKwh:estKwh,meralcoDailyKwh,airCost,tvCost,applianceCost:apCost+alwaysEst.cost,airKwh,tvKwh,applianceKwh:apKwh+alwaysEst.kwh};
  });
}
export function mealsDailyChart(monthKey=curMk(),data=S?.data){
  const [y,m]=monthKey.split('-').map(Number),days=daysInMonth(y,m-1),meals=(data?.transactions||[]).filter(t=>!isGroceryTx(t));
  return Array.from({length:days},(_,i)=>{
    const dd=new Date(y,m-1,i+1,12),ds=dateOf(dd),items=meals.filter(t=>t.date===ds),spend=items.reduce((s,t)=>s+t.amount,0);
    return{ds,date:dd,label:String(i+1),items,count:items.length,spend,over:spend>(data?.dailyBudget||0)&&spend>0};
  });
}
export function electricityComparisonForMonth(monthKey,data=S?.data,actualKwh=0){
  const cycle=billCycleForMonth(monthKey,meralcoReadDay(data));
  const est=electricityCycleEstimate(cycle,data);
  const loggedKwh=est.airconKwh+est.tvKwh+est.sessionKwh;
  return{cycle,est,loggedKwh,diff:actualKwh?Math.abs(est.totalKwh-actualKwh):0};
}
export function electricityReportForMonth(monthKey=curMk(),data){
  const rate=parseFloat(data?.meralcoRate)||14.3345,cycle=billCycleForMonth(monthKey,meralcoReadDay(data)),cycleDayCount=cycleDays(cycle);
  const aircon=(data?.airconUsage||[]).filter(u=>inCycle(u,cycle));
  const tv=(data?.tvUsage||[]).filter(u=>inCycle(u,cycle));
  const sessions=(data?.applianceUsage||[]).filter(u=>inCycle(u,cycle));
  const cr=cycleDateRange(cycle);
  const always=(data?.appliances||[]).filter(a=>a.alwaysOn).map(a=>{
    const est=applianceAlwaysOnEstimate(a,cr.start,cr.end,rate);
    return{name:a.name,category:a.category||'24/7',kwh:est.kwh,cost:est.cost,hours:est.hours,logs:0,type:'24/7'};
  });
  const airconKwh=aircon.reduce((s,u)=>s+(parseFloat(u.kwh)||0),0),airconCost=aircon.reduce((s,u)=>s+(parseFloat(u.cost)||0),0),airconHours=aircon.reduce((s,u)=>s+(parseFloat(u.hours)||parseFloat(u.minutes)/60||0),0);
  const tvKwh=tv.reduce((s,u)=>s+(parseFloat(u.kwh)||0),0),tvCost=tv.reduce((s,u)=>s+(parseFloat(u.cost)||0),0),tvHours=tv.reduce((s,u)=>s+(parseFloat(u.hours)||parseFloat(u.minutes)/60||0),0);
  const sessionKwh=sessions.reduce((s,u)=>s+usageKwhInRange(u,cr.start,cr.end),0),sessionCost=sessions.reduce((s,u)=>s+usageCostInRange(u,cr.start,cr.end),0),sessionHours=sessions.reduce((s,u)=>s+(parseFloat(u.hours)||parseFloat(u.minutes)/60||0)*overlapRatio(u,cr.start,cr.end),0);
  const alwaysKwh=always.reduce((s,u)=>s+u.kwh,0),alwaysCost=always.reduce((s,u)=>s+u.cost,0);
  const applianceGroups=new Map();
  sessions.forEach(u=>{
    const key=u.name||'Appliance',g=applianceGroups.get(key)||{name:key,category:u.category||'Appliance',kwh:0,cost:0,hours:0,logs:0,type:'Appliance'};
    g.kwh+=usageKwhInRange(u,cr.start,cr.end);g.cost+=usageCostInRange(u,cr.start,cr.end);g.hours+=(parseFloat(u.hours)||parseFloat(u.minutes)/60||0)*overlapRatio(u,cr.start,cr.end);g.logs+=1;applianceGroups.set(key,g);
  });
  const top=[
    ...(airconKwh?[{name:'Aircon',category:'Cooling',kwh:airconKwh,cost:airconCost,hours:airconHours,logs:aircon.length,type:'Aircon'}]:[]),
    ...(tvKwh?[{name:'TV',category:'TV',kwh:tvKwh,cost:tvCost,hours:tvHours,logs:tv.length,type:'TV'}]:[]),
    ...always,
    ...applianceGroups.values()
  ].sort((a,b)=>b.kwh-a.kwh);
  const logs=[
    ...aircon.map(u=>({type:'Aircon',name:`${airconModeLabel(u.mode,u.sleepMode)} · ${durationLabel(u.minutes||(u.hours||0)*60)}`,date:u.date,time:u.start&&u.end?`${fmtTime12(u.start)}-${fmtTime12(u.end)}`:'',kwh:u.kwh,cost:u.cost})),
    ...tv.map(u=>({type:'TV',name:durationLabel(u.minutes||(u.hours||0)*60),date:u.date,time:u.start&&u.end?`${fmtTime12(u.start)}-${fmtTime12(u.end)}`:'',kwh:u.kwh,cost:u.cost})),
    ...sessions.map(u=>({type:'Appliance',name:`${u.name} · ${durationLabel(u.minutes)}`,date:u.date,sortDate:logSortDate(u),time:u.start&&u.end?`${fmtTime12(u.start)}-${fmtTime12(u.end)}`:'',kwh:u.kwh,cost:u.cost}))
  ].sort((a,b)=>String(b.sortDate||b.date).localeCompare(String(a.sortDate||a.date))||String(b.time).localeCompare(String(a.time)));
  const totalKwh=airconKwh+tvKwh+sessionKwh+alwaysKwh,totalCost=airconCost+tvCost+sessionCost+alwaysCost;
  return{monthKey,cycle,days:cycleDayCount,aircon,tv,sessions,always,logs,top,airconKwh,airconCost,airconHours,tvKwh,tvCost,tvHours,sessionKwh,sessionCost,sessionHours,alwaysKwh,alwaysCost,totalKwh,totalCost,rate};
}
export function weatherSettings(data){
  const hasExplicitLat = data?.weatherLat !== undefined && data?.weatherLat !== '' && !isNaN(parseFloat(data.weatherLat));
  const hasExplicitLon = data?.weatherLon !== undefined && data?.weatherLon !== '' && !isNaN(parseFloat(data.weatherLon));
  const hasExplicitElevation = data?.weatherElevation !== undefined && data?.weatherElevation !== '' && !isNaN(parseFloat(data.weatherElevation));

  return{
    provider:data?.weatherProvider||DEFAULT_WEATHER.provider,
    label:data?.weatherLabel||DEFAULT_WEATHER.label,
    // Privacy: if user never set coordinates, treat as "not set".
    lat: hasExplicitLat ? parseFloat(data.weatherLat) : NaN,
    lon: hasExplicitLon ? parseFloat(data.weatherLon) : NaN,
    elevation: hasExplicitElevation ? parseFloat(data.weatherElevation) : DEFAULT_WEATHER.elevation,
    apiKey:data?.weatherApiKey||''
  }; 
}
export function weatherSummary(w){
  if(!w)return 'Weather not loaded';
  const parts=[];
  const codeLabel=weatherCodeLabel(w.code);
  if(w.temp!=null)parts.push(`Outdoor ${Number(w.temp).toFixed(1)}C`);
  if(codeLabel)parts.push(codeLabel);
  if(w.apparent!=null)parts.push(`Feels ${Number(w.apparent).toFixed(1)}C`);
  if(w.humidity!=null)parts.push(`Humidity ${Math.round(w.humidity)}%`);
  if(w.uv!=null)parts.push(`UV ${w.uv.toFixed(1)}`);
  if(w.clouds!=null)parts.push(`Clouds ${w.clouds}%`);
  if(w.precip>0)parts.push(`Precip ${w.precip}mm`);
  if(w.visibility!=null)parts.push(`Vis ${Math.round(w.visibility/1000)}km`);
  if(w.pressure!=null)parts.push(`${Math.round(w.pressure)}hPa`);
  if(weatherIsNight(w))parts.push(moonPhaseLabel(w.time));
  if(w.time)parts.push(`Updated ${fmtTime12(String(w.time).slice(11,16))}`);
  return parts.join(' · ')||'Weather not loaded';
}
export function weatherCodeLabel(code){
  const c=Number(code);
  if(c===0)return 'Clear';
  if([1,2,3].includes(c))return ['Mainly clear','Partly cloudy','Overcast'][c-1];
  if([45,48].includes(c))return 'Fog';
  if([51,53,55].includes(c))return 'Drizzle';
  if([56,57].includes(c))return 'Freezing drizzle';
  if([61,63,65].includes(c))return 'Rain';
  if([66,67].includes(c))return 'Freezing rain';
  if([71,73,75,77].includes(c))return 'Snow';
  if([80,81,82].includes(c))return 'Rain showers';
  if([85,86].includes(c))return 'Snow showers';
  if([95,96,99].includes(c))return 'Thunderstorm';
  return '';
}
export function weatherVisualType(code){
  const c=Number(code);
  if([45,48].includes(c))return 'fog';
  if([95,96,99].includes(c))return 'storm';
  if([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(c))return 'rain';
  if([71,73,75,77,85,86].includes(c))return 'snow';
  if([1,2,3].includes(c))return 'cloud';
  return 'clear';
}
export function weatherIsNight(w){
  if(w?.isDay!==undefined&&w?.isDay!==null)return Number(w.isDay)===0;
  const hh=parseInt(String(w?.time||'').slice(11,13));
  return !isNaN(hh)&&(hh<6||hh>=18);
}
export function moonPhaseClass(time){
  const d=time?new Date(time):new Date();
  const days=(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-Date.UTC(2000,0,6))/86400000;
  const phase=((days%29.53058867)+29.53058867)%29.53058867;
  if(phase<1.85||phase>27.68)return 'moon-new';
  if(phase<5.54)return 'moon-wax-crescent';
  if(phase<9.23)return 'moon-first-quarter';
  if(phase<12.92)return 'moon-wax-gibbous';
  if(phase<16.61)return 'moon-full';
  if(phase<20.3)return 'moon-wane-gibbous';
  if(phase<23.99)return 'moon-last-quarter';
  return 'moon-wane-crescent';
}
export function moonPhaseLabel(time){
  return {
    'moon-new':'New Moon',
    'moon-wax-crescent':'Waxing Crescent',
    'moon-first-quarter':'First Quarter',
    'moon-wax-gibbous':'Waxing Gibbous',
    'moon-full':'Full Moon',
    'moon-wane-gibbous':'Waning Gibbous',
    'moon-last-quarter':'Last Quarter',
    'moon-wane-crescent':'Waning Crescent'
  }[moonPhaseClass(time)]||'Moon';
}
export function themeFromData(d){
  const t=d?.theme;
  if(t==='light'||t==='dark'||t==='nebula')return t;
  return d?.darkMode?'dark':'light';
}
export function themeLabel(t){
  return t==='nebula'?'Nebula':t==='dark'?'Dark':'Light';
}
export function weatherVisual(w){
  const night=weatherIsNight(w);
  const theme=themeFromData(S.data);
  // Added clouds-level class to help with daytime visualization
  const clouds = w?.clouds != null ? (w.clouds > 70 ? 'cloudy-heavy' : w.clouds > 30 ? 'cloudy-light' : 'clear-sky') : '';
  const timeClass = night ? 'night' : 'day';
  const wrap=D(`wv ${weatherVisualType(w?.code)} ${timeClass} ${night?moonPhaseClass(w?.time):''} themed-wv wv-t-${theme} wv-t-${theme}-${timeClass} ${clouds} ${theme==='nebula'&&!night?'nebula-day-bright':''}`);
  wrap.setAttribute('aria-hidden','true');
  wrap.innerHTML='<div class="wv-nebula-day-overlay"></div><div class="wv-stars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="wv-glow"></div><div class="wv-sun"><span></span></div><div class="wv-moon"><span></span></div><div class="wv-cloud wv-cloud-a"></div><div class="wv-cloud wv-cloud-b"></div><div class="wv-rain wv-rain-a"></div><div class="wv-rain wv-rain-b"></div><div class="wv-rain wv-rain-c"></div><div class="wv-rain wv-rain-d"></div><div class="wv-rain wv-rain-e"></div><div class="wv-rain wv-rain-f"></div><div class="wv-bolt"></div><div class="wv-fog wv-fog-a"></div><div class="wv-fog wv-fog-b"></div><div class="wv-fog wv-fog-c"></div>';
  return wrap;
}
export function renderWeatherCard(data,{title='Weather', onRefresh}={}) {
  const w=data.weather,ws=weatherSettings(data);
  const hasCoords = Number.isFinite(ws.lat) && Number.isFinite(ws.lon);

  const card=D('card weather-card'),body=D('cp weather-body'),copy=D('weather-copy'),art=D('weather-art');
  copy.appendChild(h('div',{cls:'lbl'},`${title} · ${ws.label}`));

  if(!hasCoords){
    copy.appendChild(h('div',{cls:'sf weather-temp'},'--'));
    copy.appendChild(h('div',{cls:'weather-meta'},'Location not set'));
    art.appendChild(weatherVisual(null));
    if(onRefresh) art.appendChild(Btn('bgsm weather-refresh','Set location',onRefresh));
    body.appendChild(art);body.appendChild(copy);card.appendChild(body);
    return card;
  }

  copy.appendChild(h('div',{cls:'sf weather-temp'},w?.temp!=null?`${Number(w.temp).toFixed(1)}C`:'--'));
  copy.appendChild(h('div',{cls:'weather-meta'},`${w?weatherSummary(w):'Weather not loaded'}`));
  art.appendChild(weatherVisual(w));
  if(onRefresh) art.appendChild(Btn('bgsm weather-refresh','Refresh',onRefresh));
  body.appendChild(art);body.appendChild(copy);card.appendChild(body);
  return card;
}
export function weatherStale(data){const t=Date.parse(data?.weather?.fetchedAt||'');return !t||Date.now()-t>15*60*1000;}
export function labelList(key,data){const d=data;const custom=d?.labels?.[key];return Array.isArray(custom)&&custom.length?custom:LABEL_DEFAULTS[key]||[];}
export function foodSources(data){return labelList('foodSources',data);}
export function homeCategories(data){return labelList('homeCategories',data);}
export function homeStores(data){return labelList('homeStores',data);}
export function applianceCategories(data){return labelList('applianceCategories',data);}
export function parseLabels(v){return [...new Set(String(v||'').split('\n').map(x=>x.trim()).filter(Boolean))];}
export function jclone(v){return JSON.parse(JSON.stringify(v));}
export function expenseTotal(data){return [...(data?.transactions||[]),...(data?.homeExpenses||[])].reduce((s,x)=>s+(parseFloat(x.amount)||0),0);}
export function normalizeBalance(data){
  if(!data) return data;
  if(data.balanceBase===undefined||data.balanceBase===null)data.balanceBase=(parseFloat(data.balance)||0)+expenseTotal(data);
  data.balance=(parseFloat(data.balanceBase)||0)-expenseTotal(data);
  const stocks = data.stocks || [];
  const dismissed = (data.stockAlertDismissed || '').split('|').filter(Boolean);
  const stillProblem = dismissed.filter(key => {
    const [status, id] = key.split(':');
    const s = stocks.find(x => x.id === id);
    if (!s) return false;
    return status === 'out' ? s.quantity <= 0 : (s.quantity > 0 && s.quantity <= s.minQty);
  });
  data.stockAlertDismissed = stillProblem.join('|');
  return data;
}
export function isDaily24hApplianceLog(u){
  const mins=parseFloat(u?.minutes)||((parseFloat(u?.hours)||0)*60);
  return !u?.span&&mins>=1435&&mins<=1445&&u?.date;
}
export function mergeDaily24hApplianceLogs(data){
  const logs=data.applianceUsage||[],targets=logs.filter(isDaily24hApplianceLog);
  if(targets.length<2)return data;

  const targetIds=new Set(targets.map(u=>u.id));
  const deletedIds=[];
  const groups=new Map();
  targets.forEach(u=>{
    const key=[u.applianceId||u.name,u.name,u.category||'',u.watts||'',u.qty||'',u.rateAtTime||''].join('|');
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(u);
  });
  const merged=[];
  groups.forEach(items=>{
    items.sort((a,b)=>a.date.localeCompare(b.date));
    let batch=[];
    const flush=()=>{
      if(!batch.length)return;
      if(batch.length===1){merged.push(batch[0]);batch=[];return;}
      const first=batch[0],last=batch[batch.length-1],end=new Date(`${last.date}T00:00:00`);
      end.setDate(end.getDate()+1);
      const minutes=batch.reduce((s,u)=>s+(parseFloat(u.minutes)||1440),0);
      const kwh=batch.reduce((s,u)=>s+(parseFloat(u.kwh)||0),0);
      const cost=batch.reduce((s,u)=>s+(parseFloat(u.cost)||0),0);
      const startTime=first.start||'00:00',endTime=last.end||'00:00';
      merged.push({...first,date:first.date,startDate:first.date,endDate:dateOf(end),start:startTime,end:endTime,startedAt:new Date(`${first.date}T${startTime}:00`).toISOString(),endedAt:end.toISOString(),minutes,hours:minutes/60,kwh,cost,span:true,note:noteParts(first.note,'Merged 24/7 daily logs')});
      deletedIds.push(...batch.slice(1).map(u=>u.id).filter(Boolean));
      batch=[];
    };
    items.forEach(u=>{
      if(!batch.length){batch=[u];return;}
      const prev=batch[batch.length-1],expected=new Date(`${prev.date}T00:00:00`);
      expected.setDate(expected.getDate()+1);
      if(dateOf(expected)===u.date)batch.push(u);
      else{flush();batch=[u];}
    });
    flush();
  });
  if(!deletedIds.length)return data;
  data.applianceUsage=[...merged,...logs.filter(u=>!targetIds.has(u.id))].sort((a,b)=>String(logSortDate(b)).localeCompare(String(logSortDate(a))));
  data.modifiedAt=new Date().toISOString();
  data.mergedDaily24hAt=data.modifiedAt;
  data._mergedDaily24hDeletedIds=[...(data._mergedDaily24hDeletedIds||[]),...deletedIds];
  return data;
}
export function airconProfile(data){
  const d = data || {};
  return{
    model:d.airconModel||AIRCON_MODEL_PROFILE.model,
    outdoorModel:d.airconOutdoorModel||AIRCON_MODEL_PROFILE.outdoorModel,
    coolingKw:parseFloat(d.airconCoolingKw)||AIRCON_MODEL_PROFILE.coolingKw,
    ratedWatts:parseFloat(d.airconRatedWatts)||AIRCON_MODEL_PROFILE.ratedWatts,
    minWatts:parseFloat(d.airconMinWatts)||AIRCON_MODEL_PROFILE.minWatts,
    maxWatts:parseFloat(d.airconMaxWatts)||AIRCON_MODEL_PROFILE.maxWatts,
    cspf:parseFloat(d.airconCspf)||AIRCON_MODEL_PROFILE.cspf,
    doeMonthlyKwh:parseFloat(d.airconDoeMonthlyKwh)||AIRCON_MODEL_PROFILE.doeMonthlyKwh,
    startup: d.airconStartupRate ?? DEFAULT_AIRCON_RATES.startup, // Use ?? for nullish coalescing
    sleepDay: d.airconSleepDayRate ?? DEFAULT_AIRCON_RATES.sleepDay,
    sleepNight: d.airconSleepNightRate ?? DEFAULT_AIRCON_RATES.sleepNight,
    ecoDay: d.airconEcoDayRate ?? DEFAULT_AIRCON_RATES.ecoDay,
    ecoNight: d.airconEcoNightRate ?? DEFAULT_AIRCON_RATES.ecoNight,
    day: d.airconDayRate ?? DEFAULT_AIRCON_RATES.day,
    night: d.airconNightRate ?? DEFAULT_AIRCON_RATES.night,
    tempBaseline: d.airconTempBaseline ?? 29, // Use ?? for nullish coalescing
    tempStep: d.airconTempStepPct ?? 7, // Use ?? for nullish coalescing
    outdoorBaseline: d.airconOutdoorBaseline ?? 30, // Use ?? for nullish coalescing
    outdoorStep: d.airconOutdoorStepPct ?? 2.5 // Use ?? for nullish coalescing
  };
}

// This function is designed to extract GLOBAL meta settings from a data object.
// It should NOT modify the input data.
export function getGlobalMetaSettings(data){
  const extractedMeta = {};
  GLOBAL_SETTINGS_KEYS.forEach(key => { if (data[key] !== undefined) extractedMeta[key] = data[key]; });
  return extractedMeta;
}
