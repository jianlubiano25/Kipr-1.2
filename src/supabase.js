import { SUPABASE_URL, SUPABASE_KEY, LIVE_SYNC_TABLE, LIVE_COLLECTIONS, LIVE_PENDING_KEY, SCHEMA_VERSION, SK, GLOBAL_SETTINGS_KEYS, PROFILE_VAL_KEYS } from './constants.js';
import { S, set, sd, INIT, mergeMissingBillHistory, migrate, preferredBillsMonth, getActiveProfileData } from './state.js'; 
import { jclone, normalizeBalance, mergeDaily24hApplianceLogs, getGlobalMetaSettings } from './utils/electricityUtils.js';
export let supa=null;
export let cloudSaveTimer=null;
export let cloudLoadedFor='';
export let liveChannel=null;
export let liveApplying=false;

export const stableJson = (obj) => JSON.stringify(obj ?? null);
export function touchData(data){
  return{...data,schemaVersion:SCHEMA_VERSION,modifiedAt:new Date().toISOString()};
}
export function pendingRows(){try{return JSON.parse(localStorage.getItem(LIVE_PENDING_KEY)||'[]');}catch{return[];}}
export function savePendingRows(rows){try{rows.length?localStorage.setItem(LIVE_PENDING_KEY,JSON.stringify(rows)):localStorage.removeItem(LIVE_PENDING_KEY);}catch{}}
export function liveRow(collection,itemId,data,deleted=false,updatedAt=new Date().toISOString()){
  if(!S.user?.id || !collection || !itemId || itemId === 'undefined') return null;
  // Prefix non-meta collections with the active profile ID if not already prefixed
  const isGlobal = collection === 'meta' || collection === 'profile';
  const hasPrefix = String(collection).includes(':');
  const profileNamespace = S.data.activeProfileId || 'main';
  const finalCollection = (isGlobal || hasPrefix) ? collection : `${profileNamespace}:${collection}`;
  return{user_id:S.user.id,collection:finalCollection,item_id:String(itemId),data:deleted?null:data,deleted,updated_at:updatedAt};
}
export function rowsFromData(data,full=false,previous=null){
  const now = new Date().toISOString(), rows = [];

  // Determine if `data` is a full namespaced object or a single profile's view
  const isFullUserData = data['meta|settings'] !== undefined;
  const activeProfileId = isFullUserData ? (data['meta|settings']?.data?.activeProfileId || 'main') : (data.activeProfileId || 'main');

  // Handle meta settings (global, not namespaced by profile)
  const currentMeta = isFullUserData ? (data['meta|settings']?.data || {}) : getGlobalMetaSettings(data); // Extract meta from active profile view if not full
  const previousMeta = previous ? (previous['meta|settings']?.data || {}) : (previous ? getGlobalMetaSettings(previous) : {});

  if (full || !previous || stableJson(currentMeta) !== stableJson(previousMeta)) {
    const r = liveRow('meta', 'settings', currentMeta, false, now);
    if (r) rows.push(r);
  }

  // Handle profile-specific values (balance, etc.)
  if (isFullUserData) {
    const profileIds = new Set(Object.keys(data).filter(k => k.includes(':') && !k.startsWith('meta')).map(k => k.split(':')[0]));
    profileIds.forEach(pId => {
      const pVals = {};
      PROFILE_VAL_KEYS.forEach(vk => {
        const val = data[`${pId}:${vk}`];
        if (val !== undefined) pVals[vk] = val;
      });
      const prevPVals = {};
      PROFILE_VAL_KEYS.forEach(vk => {
        const val = previous?.[`${pId}:${vk}`];
        if (val !== undefined) prevPVals[vk] = val;
      });
      if (full || !previous || stableJson(pVals) !== stableJson(prevPVals)) {
        const r = liveRow('profile', pId, pVals, false, now);
        if (r) rows.push(r);
      }
    });
  } else {
    const pVals = {};
    PROFILE_VAL_KEYS.forEach(vk => { if (data[vk] !== undefined) pVals[vk] = data[vk]; });
    const r = liveRow('profile', activeProfileId, pVals, false, now);
    if (r) rows.push(r);
  }

  // Filter to ensure we only process actual array collections to avoid .map errors on numeric values
  const collectionsToProcess = isFullUserData 
    ? Object.keys(data).filter(k => k.includes(':') && LIVE_COLLECTIONS.includes(k.split(':')[1])) 
    : LIVE_COLLECTIONS;

  // Iterate over all namespaced collections in `data` (S.fullUserData)
  collectionsToProcess.forEach(collectionKey => {
    let currentCollectionItems = []; // Default to empty array
    let previousCollectionItems = []; // Default to empty array
    let finalCollectionKey = collectionKey;

    if (isFullUserData) {
      const rawCur = data[collectionKey];
      const rawPrev = previous?.[collectionKey];
      currentCollectionItems = Array.isArray(rawCur) ? rawCur : [];
      previousCollectionItems = Array.isArray(rawPrev) ? rawPrev : [];
    } else {
      finalCollectionKey = `${activeProfileId}:${collectionKey}`;
      const rawCur = data[collectionKey];
      const rawPrev = previous?.[collectionKey];
      currentCollectionItems = Array.isArray(rawCur) ? rawCur : [];
      previousCollectionItems = Array.isArray(rawPrev) ? rawPrev : [];
    }

    // Safety check: only map if it's an array to prevent "map is not a function"
    const oldById = new Map((Array.isArray(previousCollectionItems) ? previousCollectionItems : [])
      .map(x => x?.id ? [String(x.id), x] : null).filter(Boolean));
    const nextById = new Map((Array.isArray(currentCollectionItems) ? currentCollectionItems : [])
      .map(x => x?.id ? [String(x.id), x] : null).filter(Boolean));

    currentCollectionItems.forEach(item => {
      if (!item?.id) return;
      const old = oldById.get(String(item.id));
      if (full || !old || stableJson(item) !== stableJson(old)) { // Use finalCollectionKey
        const r = liveRow(finalCollectionKey, String(item.id), item, false, now);
        if (r) rows.push(r);
      }
    });

    if (previous) { // Check for deleted items in this specific namespaced collection
      previousCollectionItems.forEach(item => {
        if (item?.id && !nextById.has(String(item.id))) { // Use finalCollectionKey
          const r = liveRow(finalCollectionKey, String(item.id), null, true, now);
          if (r) rows.push(r);
        }
      });
    }
  });
  // It should be cleared after a save.
  // When generating rows for fullUserData, we need to consider which profile these deleted IDs belong to.
  // For simplicity, let's assume these are always for the active profile when they are generated.
  // When uploading deletes caused by 24/7 daily log merging, base it on the FULL dataset being uploaded,
  // not on the current active profile view (`S.data`), otherwise snapshot/save can generate wrong delete rows.
  const deletedIds = Array.isArray(data?._mergedDaily24hDeletedIds)
    ? data._mergedDaily24hDeletedIds
    : Array.isArray(data?.['meta|settings']?.data?._mergedDaily24hDeletedIds)
      ? data['meta|settings'].data._mergedDaily24hDeletedIds
      : [];

  if (deletedIds.length) {
    // Derive active profile from the FULL dataset, since this function may be called
    // while active profile view differs (e.g. during imports/restores).
    const activeProfileId = isFullUserData
      ? (data['meta|settings']?.data?.activeProfileId || 'main')
      : (data.activeProfileId || 'main');

    deletedIds.forEach(id => {
      rows.push(liveRow(`${activeProfileId}:applianceUsage`, String(id), null, true, now));
    });
  }
  return rows.filter(Boolean);
}
export function applyLiveRows(base,rows){
  // `base` here is expected to be S.fullUserData or an empty object.
  // It should not be jclone(INIT) as INIT is for a single profile.
  let next = { ...base };
  const latest = new Map();

  rows.forEach(r => {
    const key = r.collection + '|' + r.item_id;
    const ts = Date.parse(r.updated_at || '') || 0;
    const old = latest.get(key);
    const oldTs = Date.parse(old?.updated_at || '') || 0;
    if (!old || ts >= oldTs) {
      latest.set(key, r);
    }
  });

  // Process meta settings
  const metaRow = latest.get('meta|settings');
  if (metaRow) {
    if (!metaRow.deleted && metaRow.data) {
      next['meta|settings'] = { data: metaRow.data };
    } else if (metaRow.deleted) {
      delete next['meta|settings'];
    }
  }

  // Process incoming profile values (balance, etc.)
  latest.forEach(r => {
    if (r.collection === 'profile') {
      const pId = r.item_id;
      if (!r.deleted && r.data) {
        PROFILE_VAL_KEYS.forEach(vk => { if (r.data[vk] !== undefined) next[`${pId}:${vk}`] = r.data[vk]; });
      }
    }
  });

  // Collect all unique namespaced collection keys present in the incoming rows
  const affectedCollectionKeys = new Set();
  latest.forEach(r => {
    if (r.collection !== 'meta|settings' && r.collection !== 'profile') {
      let finalCollectionKey = r.collection;
      // Handle old, un-namespaced collections
      if (!r.collection.includes(':') && LIVE_COLLECTIONS.includes(r.collection)) {
        finalCollectionKey = `main:${r.collection}`;
      }
      affectedCollectionKeys.add(finalCollectionKey);
    }
  });

  // For each affected collection, rebuild it from the latest rows
  affectedCollectionKeys.forEach(collectionKey => {
    const itemsForThisCollection = [];
    latest.forEach(r => {
      let rCollectionKey = r.collection;
      if (!r.collection.includes(':') && LIVE_COLLECTIONS.includes(r.collection)) rCollectionKey = `main:${r.collection}`;
      if (rCollectionKey === collectionKey && !r.deleted && r.data !== null) itemsForThisCollection.push(r.data);
    });
    next[collectionKey] = itemsForThisCollection;
  });

  // _mergedDaily24hDeletedIds is an internal flag, should not be part of fullUserData directly
  // It's handled by rowsFromData when generating delete rows.
  return next; // Return the full namespaced data, migration happens on active profile data
}
export function syncTimeLabel(value){
  const t=Date.parse(value||'');
  if(isNaN(t))return'Never';
  return new Date(t).toLocaleString('en-PH',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
}
export function syncLabel(){
  if(!supa)return'Sync unavailable';
  if(S?.syncSaving)return'Syncing...';
  if(S?.syncErr)return'Sync error';

  if(S?.user){
    // For a short time after success, show sync timestamp; then fall back.
    if(S?.lastSyncMessageUntil && Date.now() < S.lastSyncMessageUntil){
      const last = S?.data?.syncedAt;
      if(last) return `Synced successfully at ${syncTimeLabel(last)}`;
    }

    if(pendingRows().length) return `Signed in · ${pendingRows().length} pending sync`;
    return `Signed in as ${S.user.email||'Apple/Google account'}`;
  }
  return'Not signed in';
}



export function queueCloudSave(data=S.data,previous=null){
  if(!supa||!S?.user)return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer=setTimeout(()=>cloudSave(data,previous),700);
}
export async function upsertLiveRows(rows){
  const validRows = rows.filter(r => {
    if (!r) return false;
    const userOk = typeof r.user_id === 'string' ? r.user_id.length > 0 : !!r.user_id;
    const collectionOk = typeof r.collection === 'string' ? r.collection.trim().length > 0 : !!r.collection;
    const itemIdOk = typeof r.item_id === 'string' ? r.item_id.trim().length > 0 && r.item_id !== 'undefined' : !!r.item_id;
    return userOk && collectionOk && itemIdOk;
  });

  let pending = pendingRows();
  if(!validRows.length && !pending.length) return {ok:true};
  
  let toSend = [...pending, ...validRows];
  // Deduplicate: Keep only the latest entry for each (collection, item_id) in the batch
  const map = new Map();
  toSend.forEach(r => map.set(`${r.collection}|${r.item_id}`, r));
  const uniqueRows = Array.from(map.values());

  // Error-focused diagnostics
  if (uniqueRows.length) {
    const sample = uniqueRows.slice(0, 5).map(r => ({
      collection: r.collection,
      item_id: r.item_id,
      deleted: !!r.deleted,
      dataType: r.data === null ? 'null' : typeof r.data
    }));
    console.debug('[cloud upsert] uniqueRows=', uniqueRows.length, 'sample=', sample);
  }

  const UPSERT_BATCH_SIZE = 40;
  const chunks = [];
  for (let i = 0; i < uniqueRows.length; i += UPSERT_BATCH_SIZE) {
    chunks.push(uniqueRows.slice(i, i + UPSERT_BATCH_SIZE));
  }

  // Clear pending only after we successfully upsert all batches.
  const pendingBackup = pending;
  try {
    for (let i = 0; i < chunks.length; i++) {
      const batch = chunks[i];
      const { error } = await supa.from(LIVE_SYNC_TABLE).upsert(batch, { onConflict: 'user_id,collection,item_id' });
      if (error) {
        // Preserve payload for later inspection
        savePendingRows(uniqueRows);
        console.error('[cloud upsert] batch error at', i + 1, 'of', chunks.length, 'error=', error);
        return { ok: false, error };
      }
    }
    savePendingRows([]);
    return { ok: true };
  } catch (e) {
    savePendingRows(uniqueRows);
    console.error('[cloud upsert] exception=', e);
    return { ok: false, error: e };
  }
}
export async function cloudSave(data=S.fullUserData,previous=null,createSnapshot=false){
  const s = supa;
  if(!s||!S?.user)return;
  set({ syncSaving: true, syncErr: '' }); // S.data is the active view, S.fullUserData is the full data

  // `data` parameter here is expected to be S.fullUserData
  const rows = rowsFromData(data, !previous, previous).filter(r => r && r.item_id && r.item_id !== 'undefined');
  
  if (createSnapshot) {
    const snap = liveRow('meta', `snapshot:${new Date().toISOString()}`, data, false); // Snapshot full data
    if (snap) rows.push(snap);
  }

  const result=await upsertLiveRows(rows);
  if(!result.ok) set({ syncSaving: false, syncErr: result.error?.message||'Sync queued until online' });
  else { 
    const now = new Date().toISOString();
    // Mutate the local fullUserData so references in S are preserved but values updated
    S.fullUserData.syncedAt = now;
    // Show "Synced successfully at ..." briefly in the Cloud Sync label
    S.lastSyncMessageUntil = Date.now() + 5000;

    if (S.fullUserData['meta|settings']?.data) {
      S.fullUserData['meta|settings'].data._mergedDaily24hDeletedIds = [];
    }
    const nextActive = getActiveProfileData(S.fullUserData);
    // Update both states to trigger UI reactivity for timestamps
    set({ fullUserData: { ...S.fullUserData }, data: nextActive, syncSaving: false, syncErr: '' });
    sd(S.fullUserData);
  }
}
export async function cloudLoad(force = false){
  // Prevent prompts/replacements while a sync/save is in progress
  // (Sync & Snapshot calls cloudSave which sets syncSaving=true.)
  if(S?.syncSaving) return;
  if (cloudSaveTimer) return;
  const s = supa;

  if(!s||!S?.user||S.syncDisabled)return;
  if(!force && cloudLoadedFor===S.user.id)return;
  cloudLoadedFor=S.user.id;
  set({ syncSaving: true, syncErr: '' });
  const {data:rows,error}=await s.from(LIVE_SYNC_TABLE).select('collection,item_id,data,deleted,updated_at').eq('user_id',S.user.id).order('updated_at',{ascending:false});
  if(error){cloudLoadedFor=''; set({ syncSaving: false, syncErr: error.message }); return;}

  if(rows?.length){
    // 1. Build the data state as it exists purely in the cloud
    const cloudFullData = jclone(applyLiveRows({}, rows));
    const hasLocal = (S.data.transactions?.length > 0 || S.data.homeExpenses?.length > 0 || (S.data.applianceUsage || []).length > 0 || (S.data.activeSessions || []).length > 0 || !!S.data.modifiedAt);

    const isAlreadySynced = !!S.fullUserData?.syncedAt;
    
    let finalFullData = cloudFullData;

    if (!isAlreadySynced && hasLocal) {
      const msg = "Cloud data found for this account. How would you like to proceed?\n\n" +
                  "• Click 'OK' for CLEAN DATA (Wipe this device and start fresh with Cloud version).\n" +
                  "• Click 'Cancel' for KEEP CURRENT / MERGE (Keep your current device data and combine it with the Cloud version).\n\n" +
                  "Note: Merging might cause duplicates if the same records exist in both places.";

      // Offer clearer options.
      // We can't do a custom modal easily with plain confirm(), so use a 2-step confirm:
      // 1) First confirm: use Cloud or not.
      // 2) Second confirm: if not using Cloud, choose between Merge vs Use Device.
      //
      // Flow:
      // - OK on first confirm => use CLEAN Cloud (wipe device)
      // - Cancel on first confirm => device handling:
      //     - OK on second confirm => MERGE (keep both; may duplicate)
      //     - Cancel on second confirm => USE DEVICE (overwrite Cloud; no merge)
      const useCloud = confirm(msg);
      if (useCloud) {
        if (confirm("Backup your current device data to a file before wiping it?")) {
           const blob=new Blob([JSON.stringify(S.fullUserData,null,2)],{type:'application/json'});
           const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
           a.download=`kipr-pre-sync-backup-${new Date().toISOString().split('T')[0]}.json`;
           a.click();
           URL.revokeObjectURL(a.href);
        }
        finalFullData = cloudFullData;
      } else {
        const doMerge = confirm("Keep your current device data, then merge it into Cloud?\n\nOK = MERGE (may create duplicates).\nCancel = USE DEVICE (overwrite Cloud with device; no merge). ");
        if (doMerge) {
          // Merge local S.fullUserData into cloudFullData using atomic rows
          const localRows = rowsFromData(S.fullUserData, true);
          const mergedRows = [...rows, ...localRows];
          finalFullData = applyLiveRows({}, mergedRows);
        } else {
          // Use device as the source of truth (overwrite cloud on next full save)
          finalFullData = jclone(S.fullUserData);
        }
      }
    }

    const activeProfileData = jclone(getActiveProfileData(finalFullData));
    const merged = mergeMissingBillHistory(activeProfileData, jclone(S.data));
    finalFullData = { ...finalFullData }; // ensure not holding frozen refs
    const activeProfileData2 = jclone(merged);
    
    
    liveApplying = true; 
    S.fullUserData = finalFullData;
    S.data = activeProfileData; 
    sd(S.fullUserData); 
    liveApplying = false;

    set({ fullUserData: { ...S.fullUserData }, data: activeProfileData, syncSaving: false, syncErr: '', billsMk: preferredBillsMonth(activeProfileData, S.billsMk) });
    await cloudSave(S.fullUserData); 
  }else {
    const hasLocal = (S.data.transactions?.length > 0 || S.data.homeExpenses?.length > 0 || (S.data.applianceUsage || []).length > 0);
    const isAlreadySynced = !!S.data.syncedAt;

    if (hasLocal && !isAlreadySynced) { // If local data exists and cloud is empty, prompt to upload
      const msg = "This cloud account is empty. Do you want to upload your current device data to the cloud?\n\n" +
                  "• Click 'OK' to UPLOAD (Save your local data to the Cloud).\n" +
                  "• Click 'Cancel' to START FRESH (Wipe this device and start with an empty account).";

      if (confirm(msg)) {
        await cloudSave(S.fullUserData, null, true); // Force full upload of current fullUserData
      } else {
        localStorage.removeItem(SK);
        S.fullUserData = {}; // Clear full user data
        S.data = jclone(INIT); // Reset active view
        sd(S.fullUserData); // Save empty full user data
        set({ data: S.data, fullUserData: S.fullUserData });
      }
    } else {
      await cloudSave(S.fullUserData, null, true); // If both empty, or cloud has data, just do a full sync
    }
    set({ syncSaving: false });
  } // Closing brace for the 'else' block of 'if(rows?.length)'
  startLiveSync();
}
export function startLiveSync(){
  const s = supa;
  if(!s||!S?.user||liveChannel)return;
  liveChannel=s.channel('kipr-live-'+S.user.id)
    .on('postgres_changes',{event:'*',schema:'public',table:LIVE_SYNC_TABLE,filter:`user_id=eq.${S.user.id}`},payload=>{
      const row=payload.new||payload.old;
      if(!row || liveApplying || S.syncDisabled) return;
      
      liveApplying=true;
      const nextFull = applyLiveRows(S.fullUserData, [row]);
      const nextActive = getActiveProfileData(nextFull);
      sd(nextFull);
      set({ data: nextActive, fullUserData: nextFull });
      liveApplying=false;
    })
    .subscribe();
}
export async function initCloud(){
  if(!window.supabase)return;
  if(!supa) supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const {data: {session}}=await supa.auth.getSession();
  if(session?.user) { set({ user: session.user }); cloudLoad(); }
  // 2. Setup listener for auth events (sign in, sign out, etc)
supa.auth.onAuthStateChange((event,session)=>{
    const user=session?.user||null;
    if (user !== S.user) set({ user, syncErr: '', syncSaving: false, fullUserData: {} }); // Clear fullUserData on user change

    // After OAuth, Supabase can leave tokens in the URL hash.
    // Strip the hash (and query params that might contain oauth artifacts)
    // right after auth state change to avoid token leakage in browser history.
    try {
      const url = new URL(window.location.href);
      // Remove hash-based oauth tokens
      if (url.hash) url.hash = '';
      // Also clear any oauth-related query params if present
      const oauthKeys = ['access_token','refresh_token','error','error_description'];
      oauthKeys.forEach(k => url.searchParams.delete(k));
      // Only replace when changed
      if (url.toString() !== window.location.href) window.history.replaceState({}, document.title, url.toString());
    } catch {}

    if(!user&&liveChannel){supa.removeChannel(liveChannel);liveChannel=null;cloudLoadedFor='';}

    if(user && event==='SIGNED_IN') cloudLoad();
    if(event==='SIGNED_OUT'){ cloudLoadedFor=''; set({user:null, syncErr:'', syncSaving:false}); }
  });

  window.addEventListener('online',()=>{if(S.user)cloudSave(S.fullUserData);});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.user){cloudLoadedFor='';cloudLoad();}});
}
export async function cloudSignIn(provider){
  if(!supa){alert('Supabase did not load. Check your internet connection.');return;}
  // Security/privacy: avoid using the current URL (which can be localhost during dev
  // and may surface OAuth tokens in the address bar). Instead, redirect to the
  // clean origin (no hash) of the currently running page.
  const redirectTo = window.location.origin + window.location.pathname;
  const {error}=await supa.auth.signInWithOAuth({provider,options:{redirectTo}});
  if(error){set({ syncErr: error.message }); alert(error.message);}
}
export async function cloudSignOut(){
  if(!supa)return;

  if (confirm("Backup your current data to a file before signing out?")) {
    const blob=new Blob([JSON.stringify(S.fullUserData,null,2)],{type:'application/json'}); // Backup full data
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download=`kipr-signout-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const clear = confirm("Clear all local data from this device? \n\n'OK' to Wipe Device (Recommended if you are switching to a different account). \n'Cancel' to keep your data for offline use.");
  if (clear) {
    localStorage.removeItem(SK);
    localStorage.removeItem(LIVE_PENDING_KEY);
    savePendingRows([]); 
  } else {
    // Strip sync association so switching accounts prompts correctly next time
    S.fullUserData.syncedAt = null; // Clear syncedAt from fullUserData
    sd(S.fullUserData);
  }

  cloudLoadedFor = '';
  if(liveChannel){supa.removeChannel(liveChannel);liveChannel=null;}
  set({ fullUserData: {} }); // Clear fullUserData on sign out
  try { await supa.auth.signOut(); } catch (e) { console.warn("Cloud signout error:", e); }

  if (clear) set({ data: jclone(INIT) });
  set({user:null, syncErr:'', syncSaving:false});
  
  // Small delay to ensure state updates commit before refresh
  setTimeout(() => location.reload(), 100);
}

export async function resetLocalData() {
  const msg = "Wipe all data on this device and start fresh?\n\n" +
              "This will delete your local history. If you are signed in, you will be signed out to prevent old cloud data from being restored immediately.";
  if (confirm(msg)) {
    if (S.user) { try { await supa.auth.signOut(); } catch(e){} }
    localStorage.removeItem(SK);
    localStorage.removeItem(LIVE_PENDING_KEY);
    savePendingRows([]); 
    location.reload();
  }
}

export async function wipeCloudRecords() {
  if (!supa || !S.user) return { ok: false };
  const { error } = await supa.from(LIVE_SYNC_TABLE).delete().eq('user_id', S.user.id);
  return { ok: !error, error };
}

export async function fetchSyncSessions() {
  if(!supa || !S?.user) return [];
  // Look for full state snapshots in the meta collection
  const { data, error } = await supa.from(LIVE_SYNC_TABLE)
    .select('item_id, updated_at')
    .eq('user_id', S.user.id)
    .eq('collection', 'meta')
    .like('item_id', 'snapshot:%')
    .order('updated_at', { ascending: false });
  if (error) return [];
  
  return data.map(r => ({ id: r.item_id, ts: r.updated_at }));
}

export async function restoreFromSnapshot(snapshotId) {
  const s = supa;
  if(!s || !S?.user) return;
  set({ syncSaving: true, syncErr: '' });
  
  // Fetch the specific snapshot row
  const { data: rows, error } = await s.from(LIVE_SYNC_TABLE)
    .select('data, updated_at')
    .eq('user_id', S.user.id)
    .eq('item_id', snapshotId)
    .limit(1);

  if(error) { set({ syncSaving: false, syncErr: error.message }); return; }

  if(rows?.length && rows[0].data) {
    // Snapshot rows store `data` as the full namespaced object.
    const restoredFullUserData = rows[0].data;
    const normalizedFull = normalizeBalance(mergeDaily24hApplianceLogs(restoredFullUserData));
    if(confirm(`Restore state from ${new Date(rows[0].updated_at).toLocaleString()}? \n\nThis will replace your current data and sync this version back to the cloud.`)) {
      const currentFullUserData = jclone(S.fullUserData);
      // Replace FULL state
      S.fullUserData = normalizedFull;
      S.data = getActiveProfileData(normalizedFull);

      // Important: perform full-save so it writes the FULL namespaced structure back.
      await cloudSave(S.fullUserData, currentFullUserData, true);

      set({ modal: null, syncSaving: false });
    } else {
      set({ syncSaving: false });
    }
  } else {
    set({ syncSaving: false, syncErr: 'Snapshot data not found.' });
  }
}
