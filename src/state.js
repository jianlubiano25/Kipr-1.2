import { SCHEMA_VERSION, DEFAULT_APPLIANCES, DEFAULT_WEATHER, LABEL_DEFAULTS, AIRCON_MODEL_PROFILE, SK, GK, BK, DEFAULT_AIRCON_RATES, LIVE_COLLECTIONS, GLOBAL_SETTINGS_KEYS, PROFILE_VAL_KEYS } from './constants.js';
import { dateOf, curMk, uid, mk } from './utils/dateUtils.js';
import { normalizeBalance, mergeDaily24hApplianceLogs, noteParts, expenseTotal, jclone, getGlobalMetaSettings } from './utils/electricityUtils.js';
import { flatToNamespaced, isFlatExport, readBalanceSnapshot, syncProfileValsToFull } from './utils/dataFormat.js';
import { touchData, queueCloudSave, liveApplying } from './supabase.js';

let updateListener = () => {};
export function onStateUpdate(fn) { updateListener = fn; }

export const INIT={
  schemaVersion:SCHEMA_VERSION,
  balance:0,balanceBase:null,transactions:[],homeExpenses:[],priceItems:[],stocks:[],bills:[],dailyBudget:380,groceryBudget:5000,
  airconUsage:[],tvUsage:[],meralcoRate:14.3345,monthlyRates:{},
  airconStartupRate:1.20,airconSleepDayRate:0.62,airconSleepNightRate:0.48,airconEcoDayRate:0.55,airconEcoNightRate:0.42,airconDayRate:0.85,airconNightRate:0.58,airconDefaultSleepMode:true,airconDefaultMode:'sleep',airconDefaultTemp:'29',
  airconModel:AIRCON_MODEL_PROFILE.model,airconTempBaseline:29,airconTempStepPct:7,airconOutdoorBaseline:30,airconOutdoorStepPct:2.5,
  airconOutdoorModel:AIRCON_MODEL_PROFILE.outdoorModel,airconCoolingKw:AIRCON_MODEL_PROFILE.coolingKw,airconRatedWatts:AIRCON_MODEL_PROFILE.ratedWatts,airconMinWatts:AIRCON_MODEL_PROFILE.minWatts,airconMaxWatts:AIRCON_MODEL_PROFILE.maxWatts,airconCspf:AIRCON_MODEL_PROFILE.cspf,airconDoeMonthlyKwh:AIRCON_MODEL_PROFILE.doeMonthlyKwh,
  weatherProvider:DEFAULT_WEATHER.provider,weatherLabel:'',weatherLat:'',weatherLon:'',weatherElevation:'',weatherApiKey:'',weather:null,
  labels:LABEL_DEFAULTS,
  tvModel:'Xiaomi TV A Pro 65 2025',tvWatts:175,meralcoReadDay:12,appliances:DEFAULT_APPLIANCES,applianceUsage:[],activeSessions:[],stockAlertDismissed:'', // These are part of INIT for a single profile
  activeProfileId: 'main', // Default for initial load, will be overwritten by meta|settings
  profiles: [{id: 'main', name: 'Primary'}], // Default for initial load, will be overwritten by meta|settings
};
export function getActiveProfileData(fullData) {
  const metaSettings = fullData['meta|settings']?.data || {};
  const activeProfileId = metaSettings.activeProfileId || 'main';
  let activeData = jclone(INIT); // Start with a clean base for the active profile

  // Apply global meta settings (profiles, activeProfileId, etc.)
  activeData = { ...activeData, ...metaSettings };

  // Apply profile-specific collections
  LIVE_COLLECTIONS.forEach(colName => {
    const namespacedColKey = `${activeProfileId}:${colName}`;
    if (fullData[namespacedColKey]) {
      activeData[colName] = fullData[namespacedColKey];
    }
  });
  // Apply profile-specific values (balance, etc.)
  PROFILE_VAL_KEYS.forEach(key => {
    const namespacedKey = `${activeProfileId}:${key}`;
    if (fullData[namespacedKey] !== undefined) {
      activeData[key] = fullData[namespacedKey];
    }
  });
  readBalanceSnapshot(metaSettings, activeData);
  activeData.schemaVersion = SCHEMA_VERSION;
  activeData.syncedAt = fullData.syncedAt; // Inherit syncedAt from full data
  activeData.modifiedAt = fullData.modifiedAt; // Inherit modifiedAt from full data

  // Explicitly ensure that transactional collections don't leak from meta settings
  LIVE_COLLECTIONS.forEach(col => {
    if (fullData['meta|settings']?.data?.[col]) delete activeData[col];
    if (!activeData[col]) activeData[col] = []; // Ensure it's always an array
  });

  return migrate(activeData);
}

export function billMonthKeys(data){
  return [...new Set((data?.bills || []).flatMap(b => [
    ...Object.keys(b.monthlyAmounts || b.amounts || {}),
    ...Object.keys(b.monthlyKwh || b.monthlyKwhs || {}),
    ...Object.keys(b.paid || {})
  ]).filter(k => typeof k === 'string' && /^\d{4}-\d{2}$/.test(k)))].sort();
}
export function latestBillMonth(data){
  const months = billMonthKeys(data);
  return months.length ? months[months.length - 1] : '';
}
export function hasBillDataForMonth(data, monthKey){
  if(!/^\d{4}-\d{2}$/.test(String(monthKey || '')))return false;
  return (data?.bills || []).some(b =>
    Object.prototype.hasOwnProperty.call(b.monthlyAmounts || {}, monthKey) ||
    Object.prototype.hasOwnProperty.call(b.monthlyKwh || {}, monthKey) ||
    Object.prototype.hasOwnProperty.call(b.paid || {}, monthKey)
  );
}
export function preferredBillsMonth(data, current=curMk()){
  const latest = latestBillMonth(data);
  if(!/^\d{4}-\d{2}$/.test(String(current || '')))return latest || curMk();
  if(latest && !hasBillDataForMonth(data, current))return latest;
  return current;
}
export function mergeMissingBillHistory(primary, fallback){
  // Deep clone both inputs to ensure full mutability of all nested properties.
  const out = jclone(primary);
  fallback = jclone(fallback || {});
  const billKey = b => {
    const name = String(b?.name || '').toLowerCase();
    return name.includes('electric') || name.includes('meralco') ? 'electricity' : String(b?.id || name);
  };
  const byKey = new Map(out.bills.map(b => [billKey(b), b]));
  (fallback?.bills || []).forEach(oldBill => {
    const key = billKey(oldBill);
    let bill = byKey.get(key); // Get the mutable bill object from 'out'
    if(!bill){
      out.bills.push(jclone(oldBill)); // If bill doesn't exist in primary, add a deep clone of oldBill
      return;
    }
    // Ensure bill object itself is mutable (it should be from the map already, but defensive shallow copy)
    bill = { ...bill }; 
    bill.monthlyAmounts = { ...(oldBill.monthlyAmounts || oldBill.amounts || {}), ...(bill.monthlyAmounts || bill.amounts || {}) };
    bill.paid = { ...(oldBill.paid || {}), ...(bill.paid || {}) };
    const oldKwh = oldBill.monthlyKwh || oldBill.monthlyKwhs || {}; // Read from oldBill (fallback)
    if (Object.keys(oldKwh).length || bill.monthlyKwh) {
      bill.monthlyKwh = { ...(oldKwh), ...(bill.monthlyKwh || bill.monthlyKwhs || {}) };
    }
    byKey.set(key, bill); // Update the map with the modified bill
  });
  out.bills = Array.from(byKey.values()); // Reconstruct the bills array from the map to reflect all changes
  return out;
}

export let S = {
  tab:'dash',
  fullUserData: {},
  data: INIT,
  balanceHidden: false,
  tipsOpen:false,
  shoppingListOpen:false,
  airconHistoryOpen:true,tvHistoryOpen:true,applianceHistoryOpen:true,
  user:null,syncErr:'',syncSaving:false,
  modal:null,viewMk: '', billsMk: '', chartCycleKey:'',chartMonthKey: '', selectedMealDate: '',
  auditOpen:false,
  airconProfileOpen:false,
  airTimer:null,weatherLoading:false,weatherErr:'',
  syncDisabled:false,
  // forms
  txF:{amount:'',discount:'',source:'Carinderia',note:'',date:'',qty:'1',unit:'pcs',stockCategory:'Food Staples'},
  homeF:{amount:'',unitPrice:'',discount:'',qty:'1',unit:'pcs',category:'Cleaning Supplies',name:'',store:'Supermarket',note:'',date:''},
  priceF:{name:'',store:'Palengke',price:'',unit:'pcs',category:'Food',subcat:'Ulam (Viand)',note:''},
  stockF:{name:'',category:'Food Staples',quantity:'',unit:'pcs',minQty:'1',date:'',note:''},
  airconF:{date:'',start:'22:00',end:'06:00',mode:'sleep',sleepMode:true,tempC:'29',roomTemp:'',outdoorTemp:'',outdoorFeels:'',outdoorHumidity:''},
  tvF:{date:'',start:'19:00',end:'22:00'},
  applianceF:{name:'',category:'Others',watts:'',qty:'1',sessionMinutes:'60',alwaysOn:false,note:''},
  applianceSessionF:{applianceId:'',date:'',start:'19:00',end:'20:00',minutes:''},
  auditF:{startDate:'2026-05-31',startTime:'16:05',startRead:'43183',endDate:'2026-06-02',endTime:'18:03',endRead:'43199'},
  airSetF:{rate:'',readDay:'',startup:'',sleepDay:'',sleepNight:'',ecoDay:'',ecoNight:'',day:'',night:'',defaultMode:'sleep',defaultSleep:true,defaultTemp:'',tempBaseline:'29',tempStep:'7',outdoorBaseline:'30',outdoorStep:'2.5',tvWatts:''},
  airconProfileF:{model:'',outdoorModel:'',coolingKw:'',ratedWatts:'',minWatts:'',maxWatts:'',cspf:'',doeMonthlyKwh:''},
  tvProfileF:{model:'',watts:''},
  settingsF:{geminiKey:'',weatherProvider:'open-meteo',weatherLabel:'',weatherLat:'',weatherLon:'',weatherElevation:'',weatherApiKey:''},
  listsF:{foodSources:'',homeCategories:'',homeStores:'',applianceCategories:'',dailyBudget:'380',groceryBudget:'5000'},
  billF:{name:''},
  balInput:'',
  // scan
  scanImg:null,scanMime:'',scanning:false,scanData:null,scanErr:'',addedIdx:new Set(),
  // filters
  pCat:'All',pSearch:'',homeCat:'All',stockCat:'All',stockStatus:'All',
  multiFood:false,multiHome:false,selFood:new Set(),selHome:new Set(),
  // edit
  editType:null,editId:null,editDraft:null,batchType:null,batchDraft:null,
  // bill drafts (no re-render on type)
  billDraft:{},
  restoreDraft:{date:'',time:'00:00'},
  // reports
  rptMk: '',
};
export const scrollByTab={};

export function rememberContentScroll(){
  const cur=document.querySelector('#app .sec');
  if(cur?.dataset?.tab)scrollByTab[cur.dataset.tab]=cur.scrollTop;
}

export function set(p){
  rememberContentScroll();
  if(typeof p==='function') Object.assign(S,p(S)); // Ensure function is called
  else Object.assign(S,p);
  updateListener();
}
export function initializeState() {
  try {
    const today = dateOf(new Date());
    const nowMk = curMk();
    
    const defaultMeta = { activeProfileId: 'main', profiles: [{id: 'main', name: 'Primary'}] };
    let stored = ld();
    if (!stored || Object.keys(stored).length === 0) stored = { 'meta|settings': { data: defaultMeta } };
    
    // Ensure structure exists
    S.fullUserData = (stored['meta|settings']) ? stored : { 'meta|settings': { data: defaultMeta } };
    S.data = getActiveProfileData(S.fullUserData);

    // Set dynamic defaults
    S.geminiKey = lk() || '';
    S.balanceHidden = lbHidden();
    S.viewMk = nowMk;
    S.billsMk = preferredBillsMonth(S.data);
    S.chartMonthKey = nowMk;
    S.rptMk = nowMk;
    S.selectedMealDate = today;

    // Set form defaults
    S.txF.date = today;
    S.homeF.date = today;
    S.stockF.date = today;
    S.airconF.date = today;
    S.tvF.date = today;
    S.applianceSessionF.date = today;
    S.restoreDraft.date = today;
  } catch (e) {
    console.error("Failed to initialize state:", e);
    alert("App initialization error. See console.");
  }
}

export function setD(fn){
  rememberContentScroll();
  const prevActiveProfileData = S.data; // The current active profile's data *before* changes
  const oldFullUserData = jclone(S.fullUserData); // Snapshot of the entire user data before changes

  // 1. Apply changes to the active profile's data
  const newActiveProfileData = touchData(normalizeBalance(fn(prevActiveProfileData)));

  // 2. Update S.fullUserData with the new active profile's data
  const activeProfileId = newActiveProfileData.activeProfileId || 'main';
  const updatedFullUserData = { ...S.fullUserData };

  // Update meta settings in fullUserData
  updatedFullUserData['meta|settings'] = { data: getGlobalMetaSettings(newActiveProfileData) };

  // Update namespaced collections for the active profile in fullUserData
  LIVE_COLLECTIONS.forEach(colName => {
    const namespacedColKey = `${activeProfileId}:${colName}`;
    updatedFullUserData[namespacedColKey] = newActiveProfileData[colName] || []; // Ensure it's an array
  });
  syncProfileValsToFull(updatedFullUserData, newActiveProfileData);

  S.fullUserData = updatedFullUserData; // Update the global full user data
  S.data = newActiveProfileData; // Update S.data (the active view)
  sd(S.fullUserData); // Save the entire full user data to local storage (this was missing in the original setD)

  if(!liveApplying)queueCloudSave(S.fullUserData, oldFullUserData);
  updateListener();
}

export function migrate(d) {
  if(!d.transactions)d.transactions=[];
  if(!d.stocks)d.stocks=[];if(!d.homeExpenses)d.homeExpenses=[];
  d.schemaVersion=SCHEMA_VERSION;
  if(!d.groceryBudget)d.groceryBudget=5000;
  if(!d.labels)d.labels=JSON.parse(JSON.stringify(LABEL_DEFAULTS));
  Object.keys(LABEL_DEFAULTS).forEach(k=>{if(!Array.isArray(d.labels[k])||!d.labels[k].length)d.labels[k]=LABEL_DEFAULTS[k];});
  if((d.labels.foodSources||[]).includes('Palengke/Home-cooked')){
    d.labels.foodSources=(d.labels.foodSources||[]).flatMap(x=>x==='Palengke/Home-cooked'?['Palengke','Home-cooked']:[x]);
  }

  // Normalize Bills structure and ensure ID stability for Electricity features
  const sourceBills = Array.isArray(d.bills) ? d.bills : [];
  if (!sourceBills.length) sourceBills.push(...JSON.parse(JSON.stringify(INIT.bills)));

  d.bills = sourceBills.map(b => {
    const name = String(b.name || '').toLowerCase();
    const isElectric = name.includes('electric') || name.includes('meralco');
    // Ensure Electricity always gets ID 'b1' so features populate correctly
    const id = isElectric ? 'b1' : (b.id || uid());
    return {
      monthlyAmounts: {}, paid: {}, monthlyKwh: {}, ...b,
      id,
      monthlyAmounts: b.monthlyAmounts || b.amounts || {},
      paid: b.paid || {},
      ...(isElectric ? { monthlyKwh: b.monthlyKwh || b.monthlyKwhs || {} } : { monthlyKwh: undefined })
    };
  });

  if(!d.airconUsage)d.airconUsage=[];if(!d.tvUsage)d.tvUsage=[];if(!d.meralcoRate||d.meralcoRate===12.03)d.meralcoRate=14.3345;
  if(!d.monthlyRates)d.monthlyRates={};
  if(!d.meralcoReadDay)d.meralcoReadDay=12;
  if(!d.applianceUsage)d.applianceUsage=[];
  if(!d.activeSessions)d.activeSessions=[];
  d.homeExpenses=(d.homeExpenses||[]).map(e=>({...e,note:noteParts(e.note)}));
  const stockDateById=new Map([...(d.transactions||[]),...(d.homeExpenses||[])].filter(x=>x.linkedStockId&&x.date).map(x=>[x.linkedStockId,x.date]));
  d.stocks=(d.stocks||[]).map(s=>({...s,date:s.date||stockDateById.get(s.id)||'',note:noteParts(s.note)}));
  if(!d.appliances)d.appliances=JSON.parse(JSON.stringify(DEFAULT_APPLIANCES));
  d.appliances=(d.appliances||[]).map(a=>{
    const isDefaultKettle=a.id==='ap2'||/kettle water heater/i.test(a.name||'');
    const rawMins=parseFloat(a.sessionMinutes);
    return{...a,qty:parseFloat(a.qty)||1,sessionMinutes:a.alwaysOn?0:(isDefaultKettle&&(!rawMins||rawMins===7)?3:(rawMins||Math.max(1,Math.round((parseFloat(a.hoursPerDay)||1)*60))))};
  });
  if(!d.airTimer)d.airTimer=null;
  delete d.airconStartupKwh;delete d.airconRunningKwh;if(!d.tvWatts||d.tvWatts===100)d.tvWatts=175;if(!d.tvModel)d.tvModel='Xiaomi TV A Pro 65 2025';
  if(!d.airconStartupRate||d.airconStartupRate===0.75)d.airconStartupRate=DEFAULT_AIRCON_RATES.startup;
  if(!d.airconSleepDayRate||d.airconSleepDayRate===0.30||d.airconSleepDayRate===0.60)d.airconSleepDayRate=DEFAULT_AIRCON_RATES.sleepDay;
  if(!d.airconSleepNightRate||d.airconSleepNightRate===0.22||d.airconSleepNightRate===0.42)d.airconSleepNightRate=DEFAULT_AIRCON_RATES.sleepNight;
  if(!d.airconEcoDayRate||d.airconEcoDayRate===0.52)d.airconEcoDayRate=DEFAULT_AIRCON_RATES.ecoDay;
  if(!d.airconEcoNightRate||d.airconEcoNightRate===0.36)d.airconEcoNightRate=DEFAULT_AIRCON_RATES.ecoNight;
  if(!d.airconDayRate||d.airconDayRate===0.75)d.airconDayRate=DEFAULT_AIRCON_RATES.day;
  if(!d.airconNightRate||d.airconNightRate===0.36||d.airconNightRate===0.55)d.airconNightRate=DEFAULT_AIRCON_RATES.night;
  if(!d.airconModel)d.airconModel=AIRCON_MODEL_PROFILE.model;if(!d.airconTempBaseline)d.airconTempBaseline=29;if(!d.airconTempStepPct)d.airconTempStepPct=7;if(!d.airconOutdoorBaseline)d.airconOutdoorBaseline=30;if(!d.airconOutdoorStepPct)d.airconOutdoorStepPct=2.5;
  if(!d.airconOutdoorModel)d.airconOutdoorModel=AIRCON_MODEL_PROFILE.outdoorModel;if(!d.airconCoolingKw)d.airconCoolingKw=AIRCON_MODEL_PROFILE.coolingKw;if(!d.airconRatedWatts)d.airconRatedWatts=AIRCON_MODEL_PROFILE.ratedWatts;if(!d.airconMinWatts)d.airconMinWatts=AIRCON_MODEL_PROFILE.minWatts;if(!d.airconMaxWatts)d.airconMaxWatts=AIRCON_MODEL_PROFILE.maxWatts;if(!d.airconCspf)d.airconCspf=AIRCON_MODEL_PROFILE.cspf;if(!d.airconDoeMonthlyKwh)d.airconDoeMonthlyKwh=AIRCON_MODEL_PROFILE.doeMonthlyKwh;
  if(!d.weatherProvider)d.weatherProvider=DEFAULT_WEATHER.provider;
  if(!d.weatherLabel)d.weatherLabel='';
  // Leave coordinates unset by default (privacy). If user explicitly sets coordinates, keep them.
  if(d.weatherLat===undefined||d.weatherLat===null||d.weatherLat==='') d.weatherLat='';
  if(d.weatherLon===undefined||d.weatherLon===null||d.weatherLon==='') d.weatherLon='';
  if(!d.weatherElevation)d.weatherElevation='';
  if(d.darkMode===undefined)d.darkMode=false;
  if(!d.theme)d.theme=d.darkMode?'dark':'light';
  if(!['light','dark','nebula'].includes(d.theme))d.theme=d.darkMode?'dark':'light';
  d.darkMode=d.theme==='dark';
  if(d.airconDefaultSleepMode===undefined)d.airconDefaultSleepMode=true;
  if(!d.airconDefaultMode)d.airconDefaultMode=d.airconDefaultSleepMode===false?'normal':'sleep';
  // Ensure airconDefaultTemp is always a string for consistency with input fields
  if(d.airconDefaultTemp===undefined)d.airconDefaultTemp='29';
  if(d.stockAlertDismissed===undefined)d.stockAlertDismissed='';
  const out = normalizeBalance(mergeDaily24hApplianceLogs(d));
  return out;
}

export function ld(){
  try{
    const s=localStorage.getItem(SK);
    if(!s || s === 'undefined' || s === 'null') return {};
    const rawData = JSON.parse(s);
    if (!rawData) return {};
    // Check if it's already in the multi-profile namespaced format
    if (rawData && rawData['meta|settings'] && rawData['meta|settings'].data) return rawData;
    if (isFlatExport(rawData)) return flatToNamespaced(rawData);
    return rawData;
  }catch(e){console.error("Error loading local data:", e); return {};}
}
export function sd(fullUserData){try{localStorage.setItem(SK,JSON.stringify(fullUserData));}catch{}}
export function lk(){return localStorage.getItem(GK)||'';}
export function sk(k){k?localStorage.setItem(GK,k):localStorage.removeItem(GK);}
export function lbHidden(){try{return localStorage.getItem(BK)==='1';}catch{return false;}}
export function sbHidden(v){try{v?localStorage.setItem(BK,'1'):localStorage.removeItem(BK);}catch{}}