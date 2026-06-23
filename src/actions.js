import { S, set, setD, sk, sd, migrate, getActiveProfileData } from './state.js';
import {
  stockFromGrocery, stockFromHome, airconModeFrom, airconSessionFromParts, airconRates, applianceSessionEstimate, foodSources, homeCategories, homeStores, applianceCategories,
  parseLabels, airconProfile, meralcoReadDay, cycleForDate, activeElapsedMinutes, coffeeAppliance, weatherSettings, weatherStale, noteParts, numIn, expenseTotal, stockCatFromFood, 
  airconSessionFromDates, themeFromData, applianceSessionDraft, alwaysOnStartFor, jclone, getGlobalMetaSettings, meralcoRateForMonth, billMonthFromCycle
} from './utils/electricityUtils.js';
import { dateOf, timeOf, timePlus, minutesBetween, curMk, uid, minsOfDay, mk } from './utils/dateUtils.js'; 
import { h } from './utils/domHelpers.js';
import { fmt } from './utils/formatters.js';
import { resizeImage } from './utils/imageUtils.js';
import { cloudSave, cloudSignIn, cloudSignOut, cloudLoad, supa, liveChannel, syncLabel, syncTimeLabel, fetchSyncSessions, liveApplying, queueCloudSave, touchData, wipeCloudRecords } from './supabase.js';
export async function openRestorePicker() {
  if(!supa || !S.user) { alert("Please sign in to view history snapshots."); return; }
  set({ syncSaving: true, syncErr: '' });
  const points = await fetchSyncSessions();
  set({ syncSaving: false, modal: 'restorePicker', restorePoints: points });
}
export const manualSync = () => cloudSave(S.fullUserData, null, true);
export { cloudSave, cloudSignIn, cloudSignOut, cloudLoad, supa, liveChannel, syncLabel, syncTimeLabel };
import { flatToNamespaced, isFlatExport, syncProfileValsToFull } from './utils/dataFormat.js';
import { MODELS, SCAN_PROMPT, LABEL_DEFAULTS, AIRCON_MODEL_PROFILE, DEFAULT_WEATHER, DEFAULT_AIRCON_RATES, LIVE_COLLECTIONS, PROFILE_VAL_KEYS } from './constants.js';
export function addTx(){
  const isFreeMeal=S.txF.source==='Home-cooked';
  const gross=isFreeMeal?0:Math.max(0,parseFloat(S.txF.amount)||0),discount=isFreeMeal?0:Math.max(0,parseFloat(S.txF.discount)||0),amt=Math.max(0,gross-discount);
  if((!isFreeMeal&&(!gross||gross<=0||amt<=0))||(isFreeMeal&&!S.txF.note.trim()))return;
  const isGroceries=S.txF.source==='Groceries',stockId=isGroceries?uid():null;
  const tx={id:uid(),amount:amt,grossAmount:gross,discount,source:S.txF.source,note:S.txF.note,date:S.txF.date,...(isGroceries?{qty:parseFloat(S.txF.qty)||1,unit:S.txF.unit||'pcs',stockCategory:S.txF.stockCategory||'Food Staples',linkedStockId:stockId}:{})};
  setD(d=>({...d,balance:d.balance-amt,transactions:[tx,...d.transactions],stocks:isGroceries?[...(d.stocks||[]),stockFromGrocery(tx,stockId)]:(d.stocks||[])}));
  set({txF:{amount:'',discount:'',source:'Carinderia',note:'',date:dateOf(new Date()),qty:'1',unit:'pcs',stockCategory:'Food Staples'},modal:null});
}
export function delTx(id){const tx=(S.data.transactions||[]).find(t=>t.id===id);if(!tx)return;setD(d=>({...d,balance:d.balance+tx.amount,transactions:(d.transactions||[]).filter(t=>t.id!==id),stocks:tx.linkedStockId?(d.stocks||[]).filter(s=>s.id!==tx.linkedStockId):(d.stocks||[])}));}
export function addHome(){
  const qty=parseFloat(S.homeF.qty)||1,unitPrice=parseFloat(S.homeF.unitPrice||S.homeF.amount),gross=unitPrice*qty,discount=Math.max(0,parseFloat(S.homeF.discount)||0),amt=Math.max(0,gross-discount);if(!amt||!S.homeF.name)return;
  const stockId=uid();
  const item={id:uid(),amount:amt,grossAmount:gross,discount,unitPrice,qty,unit:S.homeF.unit||'pcs',linkedStockId:stockId,category:S.homeF.category,name:S.homeF.name,store:S.homeF.store,note:S.homeF.note,date:S.homeF.date};
  setD(d=>({...d,balance:d.balance-amt,homeExpenses:[item,...(d.homeExpenses||[])],stocks:[...(d.stocks||[]),stockFromHome(item,stockId)]}));
  set({homeF:{amount:'',unitPrice:'',discount:'',qty:'1',unit:'pcs',category:'Cleaning Supplies',name:'',store:'Supermarket',note:'',date:dateOf(new Date())},modal:null});
}
export function delHome(id){const e=(S.data.homeExpenses||[]).find(x=>x.id===id);if(!e)return;setD(d=>({...d,balance:d.balance+e.amount,homeExpenses:(d.homeExpenses||[]).filter(x=>x.id!==id),stocks:e.linkedStockId?(d.stocks||[]).filter(s=>s.id!==e.linkedStockId):(d.stocks||[])}));}
export function toggleSel(type,id){
  const key=type==='food'?'selFood':'selHome';
  const next=new Set(S[key]);next.has(id)?next.delete(id):next.add(id);set({[key]:next});
}
export function clearMulti(type){
  if(type==='food')set({multiFood:false,selFood:new Set()});
  else set({multiHome:false,selHome:new Set()});
}
export function delSelected(type){
  const ids=type==='food'?S.selFood:S.selHome;if(!ids.size)return;
  if(type==='food'){
    const txs=(S.data.transactions||[]).filter(t=>ids.has(t.id));
    const total=txs.reduce((s,t)=>s+t.amount,0),stockIds=new Set(txs.map(t=>t.linkedStockId).filter(Boolean));
    setD(d=>({...d,balance:d.balance+total,transactions:(d.transactions||[]).filter(t=>!ids.has(t.id)),stocks:(d.stocks||[]).filter(s=>!stockIds.has(s.id))}));
  }else{
    const items=(S.data.homeExpenses||[]).filter(e=>ids.has(e.id));
    const total=items.reduce((s,e)=>s+e.amount,0),stockIds=new Set(items.map(e=>e.linkedStockId).filter(Boolean));
    setD(d=>({...d,balance:d.balance+total,homeExpenses:(d.homeExpenses||[]).filter(e=>!ids.has(e.id)),stocks:(d.stocks||[]).filter(s=>!stockIds.has(s.id))}));
  }
  clearMulti(type);
}
export function openBatchEdit(type){const ids=type==='food'?S.selFood:S.selHome;if(!ids.size)return;set({modal:'batchEdit',batchType:type,batchDraft:{note:'',date:''}});}
export function addPrice(){
  const price=parseFloat(S.priceF.price);if(!S.priceF.name||!price)return;
  setD(d=>({...d,priceItems:[...(d.priceItems||[]),{id:uid(),...S.priceF,price,addedAt:new Date().toISOString()}]}));
  set({priceF:{name:'',store:'Palengke',price:'',unit:'pcs',category:'Food',subcat:'Ulam (Viand)',note:''},modal:null});
}
export function delPrice(id){setD(d=>({...d,priceItems:d.priceItems.filter(p=>p.id!==id)}));}
export function addStock(){
  if(!S.stockF.name)return;
  const item={id:uid(),name:S.stockF.name,category:S.stockF.category,quantity:parseFloat(S.stockF.quantity)||0,unit:S.stockF.unit||'pcs',minQty:parseFloat(S.stockF.minQty)||0,date:S.stockF.date||dateOf(new Date()),note:S.stockF.note};
  setD(d=>({...d,stocks:[...(d.stocks||[]),item]}));
  set({stockF:{name:'',category:'Food Staples',quantity:'',unit:'pcs',minQty:'1',date:dateOf(new Date()),note:''},modal:null});
}
export function delStock(id){setD(d=>({...d,stocks:(d.stocks||[]).filter(s=>s.id!==id)}));}
export function adjStock(id,delta){setD(d=>({...d,stocks:(d.stocks||[]).map(s=>s.id===id?{...s,quantity:Math.max(0,s.quantity+delta)}:s)}));}
export function addAircon(){
  const d=S.data,rates=airconRates(d);
  const mode=airconModeFrom(S.airconF.mode,S.airconF.sleepMode);
  const tempC=parseFloat(S.airconF.tempC);
  const roomTemp=parseFloat(S.airconF.roomTemp);
  const outdoorTemp=parseFloat(S.airconF.outdoorTemp),outdoorFeels=parseFloat(S.airconF.outdoorFeels),outdoorHumidity=parseFloat(S.airconF.outdoorHumidity);
  const session=airconSessionFromParts(S.airconF.date,S.airconF.start,S.airconF.end,mode,rates,isNaN(tempC)?'':tempC,isNaN(outdoorTemp)?'':outdoorTemp,d);if(!session)return;
  const cycle=cycleForDate(new Date(S.airconF.date), meralcoReadDay(d));
  const rate=meralcoRateForMonth(billMonthFromCycle(cycle), d);
  const cost=session.kwh*rate;
  const entry={id:uid(),...session,hours:parseFloat(session.hours.toFixed(2)),kwh:session.kwh,cost,rateAtTime:rate,ratesAtTime:rates,tempC:isNaN(tempC)?'':tempC,roomTemp:isNaN(roomTemp)?'':roomTemp,outdoorTemp:isNaN(outdoorTemp)?'':outdoorTemp,outdoorFeels:isNaN(outdoorFeels)?'':outdoorFeels,outdoorHumidity:isNaN(outdoorHumidity)?'':outdoorHumidity,weatherAtTime:d.weather||null,formula:'two-phase-inverter'};
  setD(d=>({...d,airconUsage:[entry,...(d.airconUsage||[])]}));
  set({airconF:{date:dateOf(new Date()),start:S.airconF.start,end:S.airconF.end,mode,sleepMode:mode==='sleep',tempC:S.airconF.tempC,roomTemp:S.airconF.roomTemp,outdoorTemp:S.airconF.outdoorTemp,outdoorFeels:S.airconF.outdoorFeels,outdoorHumidity:S.airconF.outdoorHumidity},modal:null});
}
export function delAircon(id){setD(d=>({...d,airconUsage:S.data.airconUsage.filter(x=>x.id!==id)}));}
export function addTv(){
  const sm=minsOfDay(S.tvF.start),em=minsOfDay(S.tvF.end);if(isNaN(sm)||isNaN(em))return;
  let mins=em-sm;if(mins<=0)mins+=1440;
  const h=mins/60;
  const d=S.data,watts=parseFloat(d.tvWatts)||175;
  const cycle=cycleForDate(new Date(S.tvF.date), meralcoReadDay(d));
  const rate=meralcoRateForMonth(billMonthFromCycle(cycle), d);
  const kwh=(watts/1000)*h,cost=kwh*rate;
  const entry={id:uid(),date:S.tvF.date,start:S.tvF.start,end:S.tvF.end,minutes:mins,hours:h,watts,kwh,cost,rateAtTime:rate};
  setD(d=>({...d,tvUsage:[entry,...(d.tvUsage||[])]}));
  set({tvF:{date:dateOf(new Date()),start:S.tvF.start,end:S.tvF.end},modal:null});
}
export function delTv(id){setD(d=>({...d,tvUsage:(d.tvUsage||[]).filter(x=>x.id!==id)}));}
export function addAppliance(){
  const watts=parseFloat(S.applianceF.watts),qty=parseFloat(S.applianceF.qty)||1;
  const sessionMinutes=S.applianceF.alwaysOn?0:(parseFloat(S.applianceF.sessionMinutes)||0);
  if(!S.applianceF.name||!watts||watts<=0||qty<=0||(!S.applianceF.alwaysOn&&!sessionMinutes))return;
  const now=new Date().toISOString();
  const item={id:uid(),createdAt:now,name:S.applianceF.name,category:S.applianceF.category,watts,qty,hoursPerDay:S.applianceF.alwaysOn?24:0,daysPerMonth:S.applianceF.alwaysOn?30:0,sessionMinutes,alwaysOn:!!S.applianceF.alwaysOn,alwaysOnSince:S.applianceF.alwaysOn?now:'',note:S.applianceF.note};
  setD(d=>({...d,appliances:[item,...(d.appliances||[])]}));
  set({applianceF:{name:'',category:'Others',watts:'',qty:'1',sessionMinutes:'60',alwaysOn:false,note:''},modal:null});
}
export function delAppliance(id){setD(d=>({...d,appliances:(d.appliances||[]).filter(x=>x.id!==id)}));}
export function alwaysOnUsageEntries(ap,start,end,rate){
  const watts=parseFloat(ap.watts)||0,qty=parseFloat(ap.qty)||1,minutes=Math.max(1,Math.round((end-start)/60000));
  const kwh=watts*qty*(minutes/60)/1000;
  return [{
    id:uid(),applianceId:ap.id,name:ap.name,category:ap.category||'Others',
    date:dateOf(start),startDate:dateOf(start),endDate:dateOf(end),start:timeOf(start),end:timeOf(end),
    startedAt:start.toISOString(),endedAt:end.toISOString(),
    minutes,hours:minutes/60,watts,qty,kwh,cost:kwh*rate,rateAtTime:rate,
    span:true,note:'24/7 until turned off'
  }];
}
export function turnOffAlwaysOnAppliance(id){
  const now=new Date();
  setD(d=>{
    const ap=(d.appliances||[]).find(x=>x.id===id);
    if(!ap||!ap.alwaysOn)return d;
    const start=alwaysOnStartFor(ap,d,now);
    const cycle=cycleForDate(now, meralcoReadDay(d));
    const rate=meralcoRateForMonth(billMonthFromCycle(cycle), d);
    const entries=alwaysOnUsageEntries(ap,start,now,rate);
    const appliances=(d.appliances||[]).map(x=>x.id===id?{...x,alwaysOn:false,hoursPerDay:0,daysPerMonth:0,sessionMinutes:parseFloat(x.sessionMinutes)||60,alwaysOnSince:'',note:noteParts(x.note,'Turned off '+now.toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}))}:x);
    return{...d,appliances,applianceUsage:[...entries,...(d.applianceUsage||[])]};
  });
}
export function addApplianceUsage(){
  const appliances=S.data.appliances||[];
  const ap=appliances.find(a=>a.id===S.applianceSessionF.applianceId)||appliances.find(a=>!a.alwaysOn);
  const start=S.applianceSessionF.start||'19:00',end=S.applianceSessionF.end||timePlus(start,parseFloat(ap?.sessionMinutes)||60)||'20:00';
  const minutes=minutesBetween(start,end);
  if(!ap||ap.alwaysOn||!minutes)return;
  const cycle=cycleForDate(new Date(S.applianceSessionF.date), meralcoReadDay(S.data));
  const rate=meralcoRateForMonth(billMonthFromCycle(cycle), S.data);
  const est=applianceSessionEstimate(ap,minutes,rate);
  const entry={id:uid(),applianceId:ap.id,name:ap.name,category:ap.category,date:S.applianceSessionF.date,start,end,minutes,hours:minutes/60,watts:parseFloat(ap.watts)||0,qty:parseFloat(ap.qty)||1,kwh:est.kwh,cost:est.cost,rateAtTime:rate};
  setD(d=>({...d,applianceUsage:[entry,...(d.applianceUsage||[])]}));
  set({applianceSessionF:{applianceId:ap.id,date:dateOf(new Date()),start,end:timePlus(start,ap.sessionMinutes||minutes),minutes:String(ap.sessionMinutes||minutes)},modal:null});
}
export function delApplianceUsage(id){setD(d=>({...d,applianceUsage:(d.applianceUsage||[]).filter(x=>x.id!==id)}));}
export function startActiveSession(type,opts={}){
  const d=S.data;
  const exists=(d.activeSessions||[]).some(s=>s.type===type&&(type!=='appliance'||s.applianceId===opts.applianceId));
  if(exists)return;
  if(type==='aircon'){
    const mode=airconModeFrom(opts.mode||d.airconDefaultMode,opts.sleepMode??d.airconDefaultSleepMode),tempC=parseFloat(opts.tempC??d.airconDefaultTemp);
    const w=d.weather||{};
    const outdoorTemp=opts.outdoorTemp??w.temp??'',outdoorFeels=opts.outdoorFeels??w.apparent??'',outdoorHumidity=opts.outdoorHumidity??w.humidity??'';
    const s={id:uid(),type,name:'Aircon',startedAt:new Date().toISOString(),mode,sleepMode:mode==='sleep',tempC:isNaN(tempC)?'':tempC,roomTemp:opts.roomTemp??'',outdoorTemp,outdoorFeels,outdoorHumidity,weatherAtStart:w};
    setD(d=>({...d,activeSessions:[s,...(d.activeSessions||[])]}));
  }else if(type==='tv'){
    const watts=parseFloat(d.tvWatts)||175;
    const s={id:uid(),type,name:'TV',startedAt:new Date().toISOString(),watts,qty:1};
    setD(d=>({...d,activeSessions:[s,...(d.activeSessions||[])]}));
  }else if(type==='appliance'){
    const ap=(d.appliances||[]).find(a=>a.id===opts.applianceId);
    if(!ap||ap.alwaysOn)return;
    const s={id:uid(),type,name:ap.name,applianceId:ap.id,category:ap.category,startedAt:new Date().toISOString(),watts:parseFloat(ap.watts)||0,qty:parseFloat(ap.qty)||1};
    setD(d=>({...d,activeSessions:[s,...(d.activeSessions||[])]}));
  }
}
export function cancelActiveSession(id){setD(d=>({...d,activeSessions:(d.activeSessions||[]).filter(s=>s.id!==id)}));}
export function stopActiveSession(id){
  const active=(S.data.activeSessions||[]).find(s=>s.id===id);if(!active)return;
  const now=new Date();
  const cycle=cycleForDate(now, meralcoReadDay(S.data));
  const rate=meralcoRateForMonth(billMonthFromCycle(cycle), S.data);
  setD(d=>{
    const activeSessions=(d.activeSessions||[]).filter(s=>s.id!==id);
    if(active.type==='aircon'){
      const mode=airconModeFrom(active.mode,active.sleepMode);
      const startDt=new Date(active.startedAt);
      const session=airconSessionFromDates(startDt,now,mode,airconRates(d),active.tempC,active.outdoorTemp,d);
      const entry={id:uid(),...session,startedAt:startDt.toISOString(),endedAt:now.toISOString(),hours:parseFloat(session.hours.toFixed(2)),kwh:session.kwh,cost:session.kwh*rate,rateAtTime:rate,ratesAtTime:airconRates(d),tempC:active.tempC??'',roomTemp:active.roomTemp??'',outdoorTemp:active.outdoorTemp??'',outdoorFeels:active.outdoorFeels??'',outdoorHumidity:active.outdoorHumidity??'',weatherAtTime:active.weatherAtStart||d.weather||null,formula:'two-phase-inverter'};
      return{...d,activeSessions,airconUsage:[entry,...(d.airconUsage||[])]};
    }
    const minutes=activeElapsedMinutes(active,now);
    if(active.type==='tv'){
      const startDt=new Date(active.startedAt),watts=parseFloat(active.watts)||parseFloat(d.tvWatts)||175,kwh=watts*(minutes/60)/1000;
      const entry={id:uid(),date:dateOf(startDt),start:timeOf(startDt),end:timeOf(now),startedAt:startDt.toISOString(),endedAt:now.toISOString(),minutes,hours:minutes/60,watts,kwh,cost:kwh*rate,rateAtTime:rate};
      return{...d,activeSessions,tvUsage:[entry,...(d.tvUsage||[])]};
    }
    const ap=(d.appliances||[]).find(a=>a.id===active.applianceId);
    const watts=parseFloat(ap?.watts)||parseFloat(active.watts)||0,qty=parseFloat(ap?.qty)||parseFloat(active.qty)||1,kwh=watts*qty*(minutes/60)/1000;
    const startDt=new Date(active.startedAt);
    const entry={id:uid(),applianceId:active.applianceId,name:ap?.name||active.name,category:ap?.category||active.category||'Others',date:dateOf(startDt),start:timeOf(startDt),end:timeOf(now),startedAt:startDt.toISOString(),endedAt:now.toISOString(),minutes,hours:minutes/60,watts,qty,kwh,cost:kwh*rate,rateAtTime:rate};
    return{...d,activeSessions,applianceUsage:[entry,...(d.applianceUsage||[])]};
  });
}
export function saveAirSet() {
  const f = S.airSetF;
  const d = S.data;
  const newRate = parseFloat(f.rate) || d.meralcoRate || 14.3345;
  const monthKey = f.monthKey || S.billsMk || curMk();

  setD(d => {
    const monthlyRates = { ...(d.monthlyRates || {}) };
    monthlyRates[monthKey] = newRate;
    
    const newReadDay = numIn(f.readDay, d.meralcoReadDay || 12, 1, 31);
    const recalculateUsage = (usages) => (usages || []).map(u => {
       const uCycle = cycleForDate(new Date(u.date || u.startDate || u.startedAt || new Date()), newReadDay);
       if (billMonthFromCycle(uCycle) === monthKey) {
           return { ...u, cost: (parseFloat(u.kwh)||0) * newRate, rateAtTime: newRate };
       }
       return u;
    });

    return { 
      ...d, 
      meralcoRate: newRate, // update global fallback
      monthlyRates,
      meralcoReadDay: newReadDay,
      airconDefaultMode: airconModeFrom(f.defaultMode, f.defaultSleep),
      airconDefaultSleepMode: airconModeFrom(f.defaultMode, f.defaultSleep) === 'sleep',
      airconDefaultTemp: numIn(f.defaultTemp, 29, 16, 32),
      airconUsage: recalculateUsage(d.airconUsage),
      tvUsage: recalculateUsage(d.tvUsage),
      applianceUsage: recalculateUsage(d.applianceUsage)
    };
  });
  set({ modal: null });
}
export function openAirconProfile(){
  const p=airconProfile(S.data);
  set({modal:'airconProfile',airconProfileF:{
    model:p.model,
    outdoorModel:p.outdoorModel,
    coolingKw:String(p.coolingKw),
    ratedWatts:String(p.ratedWatts),
    minWatts:String(p.minWatts),
    maxWatts:String(p.maxWatts),
    cspf:String(p.cspf),
    doeMonthlyKwh:String(p.doeMonthlyKwh),
    startup:String(p.startup),
    sleepDay:String(p.sleepDay),
    sleepNight:String(p.sleepNight),
    ecoDay:String(p.ecoDay),
    ecoNight:String(p.ecoNight),
    day:String(p.day),
    night:String(p.night),
    tempBaseline:String(p.tempBaseline),
    tempStep:String(p.tempStep),
    outdoorBaseline:String(p.outdoorBaseline),
    outdoorStep:String(p.outdoorStep)
  }});
}
export function saveAirconProfile(){
  const p=S.airconProfileF||{};
  const d=S.data;
  setD(d=>({...d,
    airconModel:p.model||AIRCON_MODEL_PROFILE.model,
    airconOutdoorModel:p.outdoorModel||AIRCON_MODEL_PROFILE.outdoorModel,
    airconCoolingKw:parseFloat(p.coolingKw)||AIRCON_MODEL_PROFILE.coolingKw,
    airconRatedWatts:parseFloat(p.ratedWatts)||AIRCON_MODEL_PROFILE.ratedWatts,
    airconMinWatts:parseFloat(p.minWatts)||AIRCON_MODEL_PROFILE.minWatts,
    airconMaxWatts:parseFloat(p.maxWatts)||AIRCON_MODEL_PROFILE.maxWatts,
    airconCspf:parseFloat(p.cspf)||AIRCON_MODEL_PROFILE.cspf,
    airconDoeMonthlyKwh:parseFloat(p.doeMonthlyKwh)||AIRCON_MODEL_PROFILE.doeMonthlyKwh,
    airconStartupRate: parseFloat(p.startup) || d.airconStartupRate || DEFAULT_AIRCON_RATES.startup,
    airconSleepDayRate: parseFloat(p.sleepDay) || d.airconSleepDayRate || DEFAULT_AIRCON_RATES.sleepDay,
    airconSleepNightRate: parseFloat(p.sleepNight) || d.airconSleepNightRate || DEFAULT_AIRCON_RATES.sleepNight,
    airconEcoDayRate: parseFloat(p.ecoDay) || d.airconEcoDayRate || DEFAULT_AIRCON_RATES.ecoDay,
    airconEcoNightRate: parseFloat(p.ecoNight) || d.airconEcoNightRate || DEFAULT_AIRCON_RATES.ecoNight,
    airconDayRate: parseFloat(p.day) || d.airconDayRate || DEFAULT_AIRCON_RATES.day,
    airconNightRate: parseFloat(p.night) || d.airconNightRate || DEFAULT_AIRCON_RATES.night,
    airconTempBaseline: parseFloat(p.tempBaseline) || d.airconTempBaseline || 29,
    airconTempStepPct: parseFloat(p.tempStep) || d.airconTempStepPct || 7,
    airconOutdoorBaseline: parseFloat(p.outdoorBaseline) || d.airconOutdoorBaseline || 30,
    airconOutdoorStepPct: parseFloat(p.outdoorStep) || d.airconOutdoorStepPct || 2.5
  }));
  set({modal:null});
}
export function openTvProfile(){
  set({modal:'tvProfile',tvProfileF:{model:S.data.tvModel||'Xiaomi TV A Pro 65 2025',watts:String(S.data.tvWatts||175)}});
}
export function saveTvProfile(){
  const p=S.tvProfileF||{};
  setD(d=>({...d,tvModel:p.model||'TV',tvWatts:numIn(p.watts,d.tvWatts||175,1,1000)}));
  set({modal:null});
}
export function openSettings(){
  const d=S.data, ws=weatherSettings(d);
  const theme=themeFromData(S.data);
  set({modal:'settings',drawerOpen:false,settingsF:{
    geminiKey:S.geminiKey,
    theme,
    darkMode:theme==='dark',
    weatherProvider:ws.provider,
    weatherLabel:ws.label,
    weatherLat:String(ws.lat),
    weatherLon:String(ws.lon),
    weatherElevation:String(ws.elevation),
    weatherApiKey:ws.apiKey||''
  }});
}
export function openListsDefaults(){
  const d=S.data;
  set({tab:'lists',modal:null,drawerOpen:false,listsF:{
    foodSources:foodSources(d).join('\n'),
    homeCategories:homeCategories(d).join('\n'),
    homeStores:homeStores(d).join('\n'),
    applianceCategories:applianceCategories(d).join('\n'),
    dailyBudget:String(d.dailyBudget||380),
    groceryBudget:String(d.groceryBudget||5000)
  }});
}
export function saveListsDefaults(){
  const f=S.listsF||{};
  const labels={
    foodSources:parseLabels(f.foodSources),
    homeCategories:parseLabels(f.homeCategories),
    homeStores:parseLabels(f.homeStores),
    applianceCategories:parseLabels(f.applianceCategories)
  };
  Object.keys(LABEL_DEFAULTS).forEach(k=>{if(!labels[k].length)labels[k]=LABEL_DEFAULTS[k];});
  setD(d=>({...d,labels,dailyBudget:numIn(f.dailyBudget,d.dailyBudget||380,50,2000),groceryBudget:numIn(f.groceryBudget,d.groceryBudget||5000,0,50000)}));
  set({modal:null});
}
export function saveSettings(){
  const f=S.settingsF||{},key=(f.geminiKey||'').trim();
  sk(key);
  const old=weatherSettings(S.data);
  const next={provider:f.weatherProvider||'open-meteo',label:f.weatherLabel||DEFAULT_WEATHER.label,lat:parseFloat(f.weatherLat)||DEFAULT_WEATHER.lat,lon:parseFloat(f.weatherLon)||DEFAULT_WEATHER.lon,elevation:parseFloat(f.weatherElevation)||DEFAULT_WEATHER.elevation,apiKey:f.weatherApiKey||''};
  const changed=old.lat!==next.lat||old.lon!==next.lon||old.provider!==next.provider;
  const theme=['light','dark','nebula'].includes(f.theme)?f.theme:(f.darkMode?'dark':'light');
  setD(d=>({...d,theme,darkMode:theme==='dark',weatherProvider:next.provider,weatherLabel:next.label,weatherLat:next.lat,weatherLon:next.lon,weatherElevation:next.elevation,weatherApiKey:next.apiKey,weather:changed?null:d.weather}));
  set({geminiKey:key,modal:null,weatherErr:''});
  setTimeout(()=>updateWeather(true),50);
}
export function exportData(){
  const blob=new Blob([JSON.stringify(S.fullUserData,null,2)],{type:'application/json'}); // Export full user data
  const a=h('a',{href:URL.createObjectURL(blob),download:`kipr-${dateOf(new Date())}.json`});
  a.click();
}
export function importData(e) {
  const reader = new FileReader();
  set({ syncDisabled: true }); 
  reader.onload = async ev => {
    try{
      let importedData = JSON.parse(ev.target.result);
      if (isFlatExport(importedData)) {
        importedData = flatToNamespaced(importedData);
      }

      // Strip sync metadata so cloudLoad triggers a fresh merge/replace prompt if user signs in
      delete importedData.syncedAt;
      if (importedData['meta|settings']?.data) delete importedData['meta|settings'].data.syncedAt;

      const isUser = !!(supa && S.user);
      let msg = 'Overwrite current device data with this backup?';
      if (isUser) msg += '\n\nSince you are signed in, this will also WIPE your current Cloud records and replace them with this backup to ensure a clean sync.';

      if (confirm(msg)) {
        set({ syncSaving: true });

        if (isUser) {
          const res = await wipeCloudRecords();
          if (!res.ok) { 
            alert("Failed to clear cloud records. Import cancelled."); 
            set({ syncSaving: false, syncDisabled: false }); 
            return; 
          }
        }

        const startActiveData = getActiveProfileData(importedData);
        const mks = [
          ...(startActiveData.transactions || []).map(t => mk(t.date)), 
          ...(startActiveData.homeExpenses || []).map(e => mk(e.date)), 
          ...(startActiveData.airconUsage || []).map(u => mk(u.date)),
          ...(startActiveData.tvUsage || []).map(u => mk(u.date)),
          ...(startActiveData.applianceUsage || []).flatMap(u => [
            mk(u.date), ...(u.endDate ? [mk(u.endDate)] : [])
          ]),
          ...(startActiveData.bills || []).flatMap(b => [ 
            ...Object.keys(b.monthlyAmounts || b.amounts || {}), 
            ...Object.keys(b.monthlyKwh || b.monthlyKwhs || {}), 
            ...Object.keys(b.paid || {}) 
          ]).map(k => (typeof k === 'string' && /^\d{4}-\d{2}$/.test(k)) ? k : (String(k).match(/^\d{4}-\d{2}-\d{2}$/) ? mk(k) : null)) 
        ].filter(v => v && typeof v === 'string' && v.match(/^\d{4}-\d{2}$/)).sort();
        
        const latest = mks.length ? mks[mks.length - 1] : curMk();

        // Apply timestamps and structure correctly
        const touchedData = touchData(importedData);
        const touchedActive = getActiveProfileData(touchedData);
        syncProfileValsToFull(touchedData, touchedActive);

        sd(touchedData);
        S.fullUserData = touchedData;
        S.data = touchedActive;
        
        if (isUser) {
          await cloudSave(touchedData, null, true);
        } else {
          touchedData.syncedAt = null;
          sd(touchedData);
        }
        
        set({ tab: 'dash', drawerOpen: false, modal: null, viewMk: latest, billsMk: latest, rptMk: latest, billDraft: {}, data: touchedActive, fullUserData: touchedData, syncDisabled: false });
        setTimeout(() => alert('Data imported successfully!'), 100);
      } else {
        set({ syncDisabled: false });
      }
    } catch (e) {
      alert('Invalid file');
      set({ syncDisabled: false });
    }
  };reader.readAsText(e.target.files[0]);
}
export function setBillAmt(id,m,val){setD(d=>({...d,bills:(d.bills||[]).map(b=>b.id===id?{...b,monthlyAmounts:{...(b.monthlyAmounts||{}),[m]:parseFloat(val)||0}}:b)}));}
export function setBillKwh(id,m,val){setD(d=>({...d,bills:(d.bills||[]).map(b=>b.id===id?{...b,monthlyKwh:{...(b.monthlyKwh||{}),[m]:parseFloat(val)||0}}:b)}));}

export function billExpenseMetaForMonth(bill, monthKey){
  const nameLower = String(bill?.name || '').toLowerCase();
  const isElectric = nameLower.includes('electric') || nameLower.includes('meralco');
  const isWifi = nameLower.includes('wifi') || nameLower.includes('internet');
  const source = 'Bills';
  const type = isElectric ? 'electricity' : isWifi ? 'wifi' : 'bill';
  if (type === 'bill') return null;
  // Stable id so we can delete/undo precisely.
  return {
    type,
    linkedBillId: bill?.id || '',
    billName: bill?.name || '',
    monthKey,
    // Put marker into note so it’s visible/editable for debugging.
    note: `Bill: ${bill?.name || type} · ${monthKey}`,
    // Use source+type marker to locate transactions.
    marker: `Bills:${type}:${monthKey}`,
    source
  };
}


export function toggleBillPaid(id,m){
  const bill = (S.data.bills || []).find(b => b.id === id);
  const alreadyPaid = !!bill?.paid?.[m];
  const nextPaid = !alreadyPaid;

  // Apply paid toggle first
  setD(d => ({
    ...d,
    bills: (d.bills || []).map(b => b.id === id ? { ...b, paid: { ...(b.paid || {}), [m]: nextPaid } } : b)
  }));

  // Create/undo expense logs for the bill
  const amount = parseFloat(bill?.monthlyAmounts?.[m] || 0);
  if (!amount) return;

  const meta = (function(){
    const nameLower = String(bill?.name || '').toLowerCase();
    const isElectric = nameLower.includes('electric') || nameLower.includes('meralco');
    const isWifi = nameLower.includes('wifi') || nameLower.includes('internet');
    if (!(isElectric || isWifi)) return null;
    const type = isElectric ? 'electricity' : 'wifi';
    return {
      type,
      marker: `Bills:${type}:${m}`,
      billName: bill?.name || type,
      source: 'Bills',
      monthKey: m
    };
  })();

  // Store bill logs as HOME expenses with category = 'Bills' so they appear in Home Reports/breakdowns.
  // If unmarked: revert by deleting those marker expenses.
  if (nextPaid) {
    // Deduplicate: ensure there is at most one marker expense for this bill marker.
    // (Prevents duplicates if UI state got out of sync, or when toggling around a previous log.)
    setD(d => {
      const items = d.homeExpenses || [];
      const toRemove = items.filter(e => e?.billLogMarker && e.billLogMarker === meta?.marker);
      if (!toRemove.length) return d;
      const totalToRemove = toRemove.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
      const keep = items.filter(e => !(e?.billLogMarker && e.billLogMarker === meta?.marker));
      const removedStockIds = new Set(toRemove.map(e => e.linkedStockId).filter(Boolean));
      return {
        ...d,
        balance: d.balance + totalToRemove,
        homeExpenses: keep,
        // Keep stock wiring consistent
        stocks: (d.stocks || []).filter(s => !removedStockIds.has(s.id))
      };
    });

    const homeItem = {
      id: uid(),
      amount,
      grossAmount: amount,
      discount: 0,
      unitPrice: amount,
      qty: 1,
      unit: 'pcs',
      linkedStockId: uid(),
      // Match existing home-items taxonomy: category should be 'Bills', store should be 'Others'
      category: 'Bills',
      name: meta?.billName ? `Bill: ${meta.billName}` : 'Bill',
      store: 'Others',
      // Normalize note marker formatting so it displays like: "Electricity · Bills : 2026-06" (without chaining the raw marker string)
      note: meta?.billName
        ? `${meta.billName} · ${meta.type === 'electricity' ? 'Bills : ' + m : meta.type === 'wifi' ? 'WiFi : ' + m : 'Bills : ' + m}`
        : noteParts('Bill', meta?.marker),
      // Use today's date so the receipt/scan association can target the logged entry.
      date: dateOf(new Date()),
      // Marker fields for identification
      billLog: true,
      billLogMarker: meta?.marker,
      billLogMonth: m,
      billLogType: meta?.type
    };

    setD(d => ({
      ...d,
      balance: d.balance - amount,
      homeExpenses: [homeItem, ...(d.homeExpenses || [])],
      // Keep stock wiring consistent with other home expenses
      stocks: [
        ...(d.stocks || []),
        stockFromHome(homeItem, homeItem.linkedStockId)
      ]
    }));
  } else {
    setD(d => {
      const items = d.homeExpenses || [];
      const toRemove = items.filter(e => e?.billLogMarker && e.billLogMarker === meta?.marker);
      if (!toRemove.length) return d;
      const total = toRemove.reduce((s,t)=>s+(parseFloat(t.amount)||0),0);
      const keep = items.filter(e => !(e?.billLogMarker && e.billLogMarker === meta?.marker));
      const removedStockIds = new Set(toRemove.map(e => e.linkedStockId).filter(Boolean));
      return {
        ...d,
        balance: d.balance + total,
        homeExpenses: keep,
        stocks: (d.stocks || []).filter(s => !removedStockIds.has(s.id))
      };
    });
  }

}

export function addBill(){const name=(S.billF.name||'').trim();if(!name)return;setD(d=>({...d,bills:[...(d.bills||[]),{id:uid(),name,monthlyAmounts:{},...(name.toLowerCase().includes('electric')?{monthlyKwh:{}}:{}),paid:{}}]}));set({billF:{name:''},modal:null});}
export function delBill(id){setD(d=>({...d,bills:(d.bills||[]).filter(b=>b.id!==id)}));}
export function updBal(){const v=parseFloat(S.balInput.replace(/,/g,''));if(!isNaN(v)){setD(d=>({...d,balance:v,balanceBase:v+expenseTotal(d)}));set({modal:null});}}
export function openEdit(type,id){
  let item;
  if(type==='food')item=(S.data.transactions||[]).find(t=>t.id===id);
  else if(type==='home')item=(S.data.homeExpenses||[]).find(e=>e.id===id);
  else if(type==='aircon')item=(S.data.airconUsage||[]).find(e=>e.id===id);
  else if(type==='tv')item=(S.data.tvUsage||[]).find(e=>e.id===id);
  else if(type==='appliance')item=(S.data.appliances||[]).find(a=>a.id===id);
  else if(type==='applianceUsage')item=(S.data.applianceUsage||[]).find(u=>u.id===id);
  else if(type==='price')item=(S.data.priceItems||[]).find(p=>p.id===id);
  else if(type==='stock')item=(S.data.stocks||[]).find(s=>s.id===id);
  if(!item)return;
  set({modal:'edit',editType:type,editId:id,editDraft:{...item}});
}
export function saveEdit(){
  const {editType:t,editId:id,editDraft:dr}=S;
  if(t==='food'){
    const old=(S.data.transactions||[]).find(x=>x.id===id);
    if(!old)return;
    const isFreeMeal=dr.source==='Home-cooked';
    const gross=isFreeMeal?0:Math.max(0,parseFloat(dr.grossAmount??dr.amount)||0);
    const discount=isFreeMeal?0:Math.max(0,parseFloat(dr.discount)||0);
    const newAmt=Math.max(0,gross-discount);
    const delta=newAmt-old.amount;
    setD(d=>{
      let stocks=[...(d.stocks||[])];
      let updated={...old,...dr,grossAmount:gross,discount,amount:newAmt};
      if(updated.source==='Groceries'&&!updated.linkedStockId){
        const stockId=uid();
        updated={...updated,linkedStockId:stockId,qty:parseFloat(updated.qty)||1,unit:updated.unit||'pcs',stockCategory:updated.stockCategory||'Food Staples'};
        stocks.push(stockFromGrocery(updated,stockId));
      }else if(updated.source!=='Groceries'&&updated.linkedStockId){
        stocks=stocks.filter(s=>s.id!==updated.linkedStockId);
        const{linkedStockId,stockName,stockCategory,qty,unit,subcat,...rest}=updated;
        updated=rest;
      }else if(updated.source==='Groceries'&&updated.linkedStockId){
        stocks=stocks.map(s=>s.id===updated.linkedStockId?{...s,...stockFromGrocery(updated,updated.linkedStockId)}:s);
      }
      return {...d,balance:d.balance-delta,transactions:d.transactions.map(x=>x.id===id?updated:x),stocks};
    });
  } else if(t==='home'){
    const old=(S.data.homeExpenses||[]).find(x=>x.id===id);
    const qty=parseFloat(dr.qty)||1;
    const unitPrice=parseFloat(dr.unitPrice)||parseFloat(dr.amount)||old.unitPrice||old.amount;
    const gross=unitPrice*qty,discount=Math.max(0,parseFloat(dr.discount)||0);
    const newAmt=Math.max(0,gross-discount);
    const delta=newAmt-old.amount;
    const updated={...old,...dr,qty,unitPrice,grossAmount:gross,discount,amount:newAmt,unit:dr.unit||old.unit||'pcs'};
    setD(d=>{
      let stocks=d.stocks||[];
      if(updated.linkedStockId){
        const stock=stockFromHome(updated,updated.linkedStockId);
        stocks=stocks.some(s=>s.id===updated.linkedStockId)?stocks.map(s=>s.id===updated.linkedStockId?{...s,...stock}:s):[...stocks,stock];
      }
      return {...d,balance:d.balance-delta,homeExpenses:(d.homeExpenses||[]).map(x=>x.id===id?updated:x),stocks};
    });
  } else if(t==='aircon'){
    const old=(S.data.airconUsage||[]).find(x=>x.id===id);
    const rates=airconRates(S.data); // Pass S.data explicitly
    const mode=airconModeFrom(dr.mode,dr.sleepMode);
    const tempC=parseFloat(dr.tempC);
    const roomTemp=parseFloat(dr.roomTemp);
    const outdoorTemp=parseFloat(dr.outdoorTemp);
    const session=airconSessionFromParts(dr.date||old.date,dr.start||old.start||'22:00',dr.end||old.end||'06:00',mode,rates,isNaN(tempC)?'':tempC,isNaN(outdoorTemp)?'':outdoorTemp,S.data);
    if(!session)return;
    const cycle=cycleForDate(new Date(dr.date||old.date), meralcoReadDay(S.data));
    const rate=meralcoRateForMonth(billMonthFromCycle(cycle), S.data);
    const newCost=session.kwh*rate;
    setD(d=>({...d,airconUsage:(d.airconUsage||[]).map(x=>x.id===id?{...old,...dr,...session,mode,sleepMode:mode==='sleep',hours:parseFloat(session.hours.toFixed(2)),kwh:session.kwh,cost:newCost,rateAtTime:rate,ratesAtTime:rates,tempC:isNaN(tempC)?'':tempC,roomTemp:isNaN(roomTemp)?'':roomTemp,formula:'two-phase-inverter'}:x)}));
  } else if(t==='tv'){
    const old=(S.data.tvUsage||[]).find(x=>x.id===id);
    if(!dr.start)dr.start=old.start||'19:00';if(!dr.end)dr.end=old.end||timePlus(dr.start,(parseFloat(dr.hours)||1)*60)||'22:00';
    const sm=minsOfDay(dr.start),em=minsOfDay(dr.end);if(isNaN(sm)||isNaN(em))return; // Ensure minsOfDay is used
    let minutes=em-sm;if(minutes<=0)minutes+=1440;
    const hours=minutes/60,watts=parseFloat(dr.watts)||S.data.tvWatts||175;
    const cycle=cycleForDate(new Date(dr.date||old.date), meralcoReadDay(S.data));
    const rate=meralcoRateForMonth(billMonthFromCycle(cycle), S.data);
    const kwh=(watts/1000)*hours,cost=kwh*rate;
    setD(d=>({...d,tvUsage:(d.tvUsage||[]).map(x=>x.id===id?{...old,...dr,minutes,hours,watts,kwh,cost,rateAtTime:rate}:x)}));
  } else if(t==='appliance'){
    const old=(S.data.appliances||[]).find(x=>x.id===id);
    const watts=parseFloat(dr.watts)||0,qty=parseFloat(dr.qty)||1;
    const sessionMinutes=dr.alwaysOn?0:(parseFloat(dr.sessionMinutes)||0);
    if(!dr.name||!watts||(!dr.alwaysOn&&!sessionMinutes))return;
    const nowIso=new Date().toISOString(); // Use nowIso consistently
    const alwaysOnSince=dr.alwaysOn?(old?.alwaysOn&&old?.alwaysOnSince?old.alwaysOnSince:nowIso):'';
    const name=dr.name,category=dr.category||old.category||'Others';
    setD(d=>({
      ...d,
      appliances:(d.appliances||[]).map(x=>x.id===id?{...x,...dr,name,category,createdAt:x.createdAt||old.createdAt||nowIso,watts,qty,hoursPerDay:dr.alwaysOn?24:0,daysPerMonth:dr.alwaysOn?30:0,sessionMinutes,alwaysOn:!!dr.alwaysOn,alwaysOnSince}:x),
      activeSessions:(d.activeSessions||[]).map(s=>s.applianceId===id?{...s,name,category,watts,qty}:s),
      applianceUsage:(d.applianceUsage||[]).map(u=>u.applianceId===id?{...u,name,category}:u)
    }));
  } else if(t==='applianceUsage'){
    const old=(S.data.applianceUsage||[]).find(x=>x.id===id);
    const appliance=(S.data.appliances||[]).find(a=>a.id===(dr.applianceId||old.applianceId));
    const start=dr.start||old.start||'19:00',end=dr.end||old.end||timePlus(start,parseFloat(old.minutes)||parseFloat(appliance?.sessionMinutes)||60)||'20:00'; // Ensure timePlus is used
    const minutes=old.span?(parseFloat(dr.minutes)||old.minutes):(minutesBetween(start,end)||parseFloat(dr.minutes)||old.minutes);
    const watts=parseFloat(appliance?.watts)||parseFloat(dr.watts)||old.watts||0;
    const qty=parseFloat(appliance?.qty)||parseFloat(dr.qty)||old.qty||1;
    const dateUsed=old.span?old.date:(dr.date||old.date);
    const cycle=cycleForDate(new Date(dateUsed), meralcoReadDay(S.data));
    const rate=meralcoRateForMonth(billMonthFromCycle(cycle), S.data);
    const kwh=watts*qty*(minutes/60)/1000,cost=kwh*rate;
    setD(d=>({...d,applianceUsage:(d.applianceUsage||[]).map(x=>x.id===id?{...old,...dr,applianceId:appliance?.id||old.applianceId,name:appliance?.name||dr.name||old.name,category:appliance?.category||old.category,date:dateUsed,startDate:old.startDate,endDate:old.endDate,span:old.span,start,end,minutes,hours:minutes/60,watts,qty,kwh,cost,rateAtTime:rate}:x)}));
  } else if(t==='price'){
    setD(d=>({...d,priceItems:d.priceItems.map(p=>p.id===id?{...p,...dr,price:parseFloat(dr.price)||p.price}:p)}));
  } else if(t==='stock'){
    setD(d=>({...d,stocks:(d.stocks||[]).map(s=>s.id===id?{...s,...dr,quantity:parseFloat(dr.quantity)||0,minQty:parseFloat(dr.minQty)||0}:s)}));
  }
  set({modal:null,editType:null,editId:null,editDraft:null});
}
export function saveBatchEdit(){
  const type=S.batchType,dr=S.batchDraft||{},ids=type==='food'?S.selFood:S.selHome;
  if(!ids?.size){set({modal:null,batchType:null,batchDraft:null});return;}
  if(type==='food'){
    setD(d=>{
      let stocks=[...(d.stocks||[])];
      const transactions=(d.transactions||[]).map(t=>{
        if(!ids.has(t.id))return t;
        let next={...t,source:dr.source||t.source,date:dr.date||t.date,note:dr.note?dr.note:t.note};
        if(next.source==='Groceries'&&!next.linkedStockId){
          const stockId=uid();
          next={...next,linkedStockId:stockId,qty:parseFloat(next.qty)||1,unit:next.unit||'pcs',stockCategory:next.stockCategory||'Food Staples'};
          stocks.push(stockFromGrocery(next,stockId));
        }else if(next.source!=='Groceries'&&next.linkedStockId){
          stocks=stocks.filter(s=>s.id!==next.linkedStockId);
          const{linkedStockId,stockName,stockCategory,qty,unit,subcat,...rest}=next;
          next=rest;
        }else if(next.source==='Groceries'&&next.linkedStockId){
          stocks=stocks.map(s=>s.id===next.linkedStockId?{...s,...stockFromGrocery(next,next.linkedStockId)}:s);
        }
        return next;
      });
      return {...d,transactions,stocks};
    });
  }else{
    setD(d=>{
      const homeExpenses=(d.homeExpenses||[]).map(e=>ids.has(e.id)?{...e,category:dr.category||e.category,store:dr.store||e.store,date:dr.date||e.date,note:dr.note?dr.note:e.note}:e);
      const byStock=new Map(homeExpenses.filter(e=>ids.has(e.id)&&e.linkedStockId).map(e=>[e.linkedStockId,e]));
      const stocks=(d.stocks||[]).map(s=>byStock.has(s.id)?{...s,...stockFromHome(byStock.get(s.id),s.id)}:s);
      return {...d,homeExpenses,stocks};
    });
  }
  clearMulti(type);set({modal:null,batchType:null,batchDraft:null});
}

export function retryDelayFromError(err){
  const retry=err?.details?.find?.(d=>d['@type']?.includes('RetryInfo'))?.retryDelay;
  if(!retry)return '';
  return ` Try again in about ${retry.replace('s',' seconds')}.`;
}
export function quotaMessage(err,attempted){
  const msg=err?.message||'Quota limit reached.';
  const quota=err?.details?.find?.(d=>d['@type']?.includes('QuotaFailure'))?.violations?.[0];
  const quotaId=quota?.quotaId?` (${quota.quotaId})`:'';
  const model=quota?.quotaDimensions?.model||attempted||'Gemini';
  return `${model} quota reached${quotaId}.${retryDelayFromError(err)} Google applies limits per project, so changing keys in the same project may not help.`;
}
export function scanQty(item){
  const direct=parseFloat(item.qty??item.quantity);
  if(direct>0)return direct;
  const text=[item.note,item.unit].filter(Boolean).join(' ');
  const match=text.match(/(?:x|qty[:\s]*)(\d+(?:\.\d+)?)/i);
  return match?parseFloat(match[1]):1;
}
export function scanTotal(item){
  return (parseFloat(item.price)||0)*scanQty(item);
}
export async function doScan(){
  if(!S.geminiKey){set({scanErr:'Set your Gemini API key in Settings to enable AI scanning.'});return;}
  if(!S.scanImg)return;
  set({scanning:true,scanErr:'',scanData:null});
  const quotaErrors=[];
  const scanPromptWithContext = `Today's Date: ${dateOf(new Date())}. ${SCAN_PROMPT}`;
  for(const model of MODELS){
    try{
      const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${S.geminiKey}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:S.scanMime,data:S.scanImg}},{text:scanPromptWithContext}]}],generationConfig:{temperature:0.1,maxOutputTokens:900,responseMimeType:'application/json'}})});
      const json=await res.json();
      if(json.error){const msg=(json.error.message||'').toLowerCase();if(json.error.code===429||msg.includes('quota')||msg.includes('resource_exhausted')){quotaErrors.push(quotaMessage(json.error,model));continue;}set({scanErr:'API Error: '+json.error.message,scanning:false});return;}
      const raw=json.candidates?.[0]?.content?.parts?.[0]?.text||'[]';
      set({scanData:JSON.parse(raw.replace(/```json|```/g,'').trim()),scanning:false});return;
    }catch(e){
      const msg=(e.message||'').toLowerCase();
      if(msg.includes('quota')||msg.includes('resource_exhausted')||msg.includes('exceeded'))continue;
      set({scanErr:'Scan error: '+e.message,scanning:false});return;
    }
  }
  set({scanErr:quotaErrors[0]||'No available Gemini model could scan this image. Check your AI Studio quota page or try again later.',scanning:false});
}
export function addScanned(item,idx,dest){
  const price=parseFloat(item.price),qty=scanQty(item),total=scanTotal(item);if(!item.name||!price)return;
  const key=`${idx}:${dest}`,qtyNote=qty>1?`${qty} x ${fmt(price)}`:'';
  const note=[qtyNote,item.note,`From scan${item.store?' · '+item.store:''}`].filter(Boolean).join(' · ');
  if(dest==='price'){
    setD(d=>({...d,priceItems:[...(d.priceItems||[]),{id:uid(),name:item.name,store:item.store||'Unknown',price,unit:item.unit||'pcs',category:item.category||'Food',subcat:item.subcat||'Others',note:note||'From scan',addedAt:new Date().toISOString()}]}));
  } else if(dest==='food'){
    const d=S.data, source=foodSources(d).includes(item.store)&&item.store!=='Others'?item.store:'Groceries',isGrocery=source==='Groceries',stockId=isGrocery?uid():null;
    const tx={id:uid(),amount:total,source,note:[item.name,note].filter(Boolean).join(' · '),...(isGrocery?{stockName:item.name,qty,unit:item.unit||'pcs',stockCategory:stockCatFromFood(item.subcat),subcat:item.subcat||'',linkedStockId:stockId}:{}),date:dateOf(new Date())};
    setD(d=>({...d,balance:d.balance-total,transactions:[tx,...(d.transactions||[])],stocks:isGrocery?[...(d.stocks||[]),stockFromGrocery(tx,stockId)]:(d.stocks||[])}));
  } else if(dest==='home'){
    const d=S.data, hcats=homeCategories(d),cat=hcats.includes(item.subcat)?item.subcat:(hcats.includes(item.category)?item.category:'Toiletries & Personal Care'),stockId=uid();
    const homeItem={id:uid(),amount:total,unitPrice:price,qty,unit:item.unit||'pcs',linkedStockId:stockId,category:cat,name:item.name,store:item.store||'Others',note:note||'From scan',date:dateOf(new Date())};
    setD(d=>({...d,balance:d.balance-total,homeExpenses:[homeItem,...(d.homeExpenses||[])],stocks:[...(d.stocks||[]),stockFromHome(homeItem,stockId)]}));
  }
  set(s => ({ addedIdx: new Set([...s.addedIdx, key]) }));
}
export async function updateWeather(force=false){
  if(S.weatherLoading||(!force&&!weatherStale(S.data)))return;
  const ws=weatherSettings(S.data);
  if(ws.provider!=='open-meteo')return;
  if(!Number.isFinite(ws.lat)||!Number.isFinite(ws.lon))return;
  try{
    set({ weatherLoading: true });
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(ws.lat)}&longitude=${encodeURIComponent(ws.lon)}&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,wind_gusts_10m,weather_code,is_day,uv_index,cloud_cover,precipitation,visibility,surface_pressure&timezone=Asia%2FManila&forecast_days=1`;
    const res=await fetch(url);
    if(!res.ok)throw new Error('Weather request failed');
    const json=await res.json(),cur=json.current||{};
    const weather={source:'Open-Meteo',label:ws.label,lat:ws.lat,lon:ws.lon,modelLat:json.latitude,modelLon:json.longitude,elevation:json.elevation??ws.elevation,temp:cur.temperature_2m,humidity:cur.relative_humidity_2m,apparent:cur.apparent_temperature,wind:cur.wind_speed_10m,gusts:cur.wind_gusts_10m,visibility:cur.visibility,pressure:cur.surface_pressure,code:cur.weather_code,isDay:cur.is_day,uv:cur.uv_index,clouds:cur.cloud_cover,precip:cur.precipitation,time:cur.time,fetchedAt:new Date().toISOString()};
    setD(d=>({...d,weather})); set({ weatherLoading: false, weatherErr: '' });
  }catch(e){
    set({ weatherLoading: false, weatherErr: e.message||'Weather unavailable' });
  }
}
let lastWeatherCheck = 0;
export function ensureWeather(){
  if(S.modal||S.weatherLoading||(Date.now()-lastWeatherCheck<30000))return;
  if(weatherStale(S.data)){
    lastWeatherCheck=Date.now();
    updateWeather();
  }
}
let liveTick=null;
export function ensureLiveTick(){
  const hasActive=(S.data.activeSessions||[]).length>0;
  if(hasActive&&!liveTick)liveTick=setInterval(()=>{
    if((S.data.activeSessions||[]).length&&!S.modal) set({}); // Trigger render via empty update
  },5000);


  if(!hasActive&&liveTick){clearInterval(liveTick);liveTick=null;}
}
export function logCoffeeBoil(){
  const ap=coffeeAppliance(S.data);
  const fallback = (S.data.appliances||[]).find(a=>!a.alwaysOn);
  if(!ap) return set({modal:'logAppliance',applianceSessionF:applianceSessionDraft(fallback)});
  const cycle=cycleForDate(new Date(), meralcoReadDay(S.data));
  const rate=meralcoRateForMonth(billMonthFromCycle(cycle), S.data);
  const mins=parseFloat(ap.sessionMinutes)||3,start=timeOf(new Date()),end=timePlus(start,mins),est=applianceSessionEstimate(ap,mins,rate);
  const entry={id:uid(),applianceId:ap.id,name:ap.name,category:ap.category,date:dateOf(new Date()),start,end,minutes:mins,hours:mins/60,watts:parseFloat(ap.watts)||0,qty:parseFloat(ap.qty)||1,kwh:est.kwh,cost:est.cost,rateAtTime:rate,note:'Coffee boil'};
  setD(d=>({...d,applianceUsage:[entry,...(d.applianceUsage||[])]}));
}

export async function addProfile(name) {
  if (!name) return;
  const newId = uid();
  const newProfile = {id: newId, name};

  const oldFullUserData = jclone(S.fullUserData);

  // Ensure meta|settings.data exists before modifying
  S.fullUserData['meta|settings'] = S.fullUserData['meta|settings'] || { data: {} };
  S.fullUserData['meta|settings'].data = S.fullUserData['meta|settings'].data || { profiles: [], activeProfileId: 'main' };
  S.fullUserData['meta|settings'].data.profiles = [...(S.fullUserData['meta|settings'].data.profiles || []), newProfile];
  
  sd(S.fullUserData); // Save the updated fullUserData to local storage
  if(!liveApplying) queueCloudSave(S.fullUserData, oldFullUserData); // Queue cloud save
  set({ fullUserData: S.fullUserData }); // Trigger UI re-render and ensure fullUserData is passed
}

export async function switchProfile(id) {
  // Ensure meta|settings.data exists for lookup
  const profiles = S.fullUserData['meta|settings']?.data?.profiles || [];
  const profile = profiles.find(p => p.id === id);
  if(!profile) return;
  
  const oldFullUserData = jclone(S.fullUserData);

  // Ensure meta|settings.data exists
  S.fullUserData['meta|settings'] = S.fullUserData['meta|settings'] || { data: {} };
  S.fullUserData['meta|settings'].data = S.fullUserData['meta|settings'].data || { profiles: [], activeProfileId: 'main' };
  S.fullUserData['meta|settings'].data.activeProfileId = id;
  
  const nextData = getActiveProfileData(S.fullUserData);
  sd(S.fullUserData);
  set({ drawerOpen: false, fullUserData: { ...S.fullUserData }, data: nextData });
  if(!liveApplying) cloudSave(S.fullUserData, oldFullUserData); // Save immediately to prevent race condition on reload
}

export function renameProfile(id, newName) {
  if (!newName || !id) return;

  const oldFullUserData = jclone(S.fullUserData);

  // Ensure meta|settings.data exists
  S.fullUserData['meta|settings'] = S.fullUserData['meta|settings'] || { data: {} };
  S.fullUserData['meta|settings'].data = S.fullUserData['meta|settings'].data || { profiles: [], activeProfileId: 'main' };
  S.fullUserData['meta|settings'].data.profiles = (S.fullUserData['meta|settings'].data.profiles || []).map(p => p.id === id ? { ...p, name: newName } : p);

  const nextData = getActiveProfileData(S.fullUserData);
  sd(S.fullUserData);
  set({ fullUserData: { ...S.fullUserData }, data: nextData });
  if(!liveApplying) queueCloudSave(S.fullUserData, oldFullUserData); // Queue cloud save
}

export async function deleteProfile(id) {
  // Ensure meta|settings.data exists for checks
  const currentMetaSettingsData = S.fullUserData['meta|settings']?.data;
  if (!currentMetaSettingsData || !currentMetaSettingsData.profiles) {
    alert("No profiles to delete.");
    return;
  }

  const currentProfiles = currentMetaSettingsData.profiles;

  // Prevent deleting if it's the only profile or the 'main' profile
  if (currentProfiles.length <= 1) {
    alert("Cannot delete the last profile.");
    return;
  }
  if (id === 'main') {
    alert("Cannot delete the 'Primary' profile.");
    return;
  }

  const profileName = currentProfiles.find(p => p.id === id)?.name;
  if (!confirm(`Are you sure you want to delete the profile "${profileName}"? This will delete all associated data.`)) {
    return;
  }

  const oldFullUserData = jclone(S.fullUserData);
  const updatedProfiles = (S.fullUserData['meta|settings'].data.profiles || []).filter(p => p.id !== id);
  let newActiveProfileId = S.fullUserData['meta|settings'].data.activeProfileId;

  // Clear all namespaced data for the deleted profile from S.fullUserData
  [...LIVE_COLLECTIONS, ...PROFILE_VAL_KEYS].forEach(key => {
    const namespacedKey = `${id}:${key}`;
    delete S.fullUserData[namespacedKey];
  });

  S.fullUserData['meta|settings'].data.profiles = updatedProfiles; // Update profiles list

  if (newActiveProfileId === id) { // If the active profile is deleted, switch to 'main' or the first available
    newActiveProfileId = updatedProfiles.find(p => p.id === 'main')?.id || updatedProfiles[0]?.id || 'main';
  }
  S.fullUserData['meta|settings'].data.activeProfileId = newActiveProfileId;
  const nextData = getActiveProfileData(S.fullUserData);
  sd(S.fullUserData);
  set({ fullUserData: { ...S.fullUserData }, data: nextData });
  if(!liveApplying) cloudSave(S.fullUserData, oldFullUserData); // Save immediately
}

export function openManageProfiles() {
  set({ modal: 'manageProfiles', drawerOpen: false });
}
