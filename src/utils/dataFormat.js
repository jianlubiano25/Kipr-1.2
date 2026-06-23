import { LIVE_COLLECTIONS, PROFILE_VAL_KEYS } from '../constants.js';

/** True when JSON is a Kipr 1 flat export (root-level transactions/balance). */
export function isFlatExport(data) {
  return !!(data && !data['meta|settings'] && (data.transactions || data.balance !== undefined));
}

/**
 * Convert a Kipr 1 flat backup into Kipr 1.2 namespaced fullUserData.
 * Also stores balanceSnapshot in meta — legacy Kipr never synced balance to Supabase.
 */
export function flatToNamespaced(flatData) {
  const oldFlatData = { ...flatData };
  const fullUserData = {
    'meta|settings': {
      data: {
        activeProfileId: 'main',
        profiles: [{ id: 'main', name: 'Primary' }],
      },
    },
  };

  LIVE_COLLECTIONS.forEach(col => {
    if (oldFlatData[col]) {
      fullUserData[`main:${col}`] = oldFlatData[col];
      delete oldFlatData[col];
    }
  });

  PROFILE_VAL_KEYS.forEach(key => {
    if (oldFlatData[key] !== undefined) {
      fullUserData[`main:${key}`] = oldFlatData[key];
      delete oldFlatData[key];
    }
  });

  Object.assign(fullUserData['meta|settings'].data, oldFlatData);
  fullUserData['meta|settings'].data.profiles =
    fullUserData['meta|settings'].data.profiles || [{ id: 'main', name: 'Primary' }];
  fullUserData['meta|settings'].data.activeProfileId =
    fullUserData['meta|settings'].data.activeProfileId || 'main';

  writeBalanceSnapshot(fullUserData);
  return fullUserData;
}

/** Persist balance in meta so cloud cold-rebuild can recover (old Kipr had no profile row). */
export function writeBalanceSnapshot(fullUserData, activeProfileData) {
  const meta = fullUserData?.['meta|settings']?.data;
  if (!meta) return fullUserData;
  const pId = activeProfileData?.activeProfileId || meta.activeProfileId || 'main';
  const balance = activeProfileData?.balance ?? fullUserData[`${pId}:balance`];
  const balanceBase = activeProfileData?.balanceBase ?? fullUserData[`${pId}:balanceBase`];
  if (balanceBase != null && balanceBase !== '') {
    meta.balanceSnapshot = { balance, balanceBase };
  }
  return fullUserData;
}

export function readBalanceSnapshot(metaSettings, activeData) {
  const snap = metaSettings?.balanceSnapshot;
  if (!snap?.balanceBase && snap?.balanceBase !== 0) return activeData;
  const hasNamespacedBase = activeData.balanceBase != null && activeData.balanceBase !== 0;
  if (!hasNamespacedBase) {
    activeData.balanceBase = snap.balanceBase;
    if (snap.balance != null) activeData.balance = snap.balance;
  }
  return activeData;
}

/** Write normalized profile balance keys + meta snapshot on fullUserData. */
export function syncProfileValsToFull(fullUserData, activeProfileData) {
  const pId = activeProfileData?.activeProfileId || fullUserData?.['meta|settings']?.data?.activeProfileId || 'main';
  PROFILE_VAL_KEYS.forEach(key => {
    if (activeProfileData[key] !== undefined) fullUserData[`${pId}:${key}`] = activeProfileData[key];
  });
  writeBalanceSnapshot(fullUserData, activeProfileData);
  return fullUserData;
}

/** Don't let a stale/missing cloud profile row zero-out a valid local balance. */
export function mergeProfileRow(next, base, row) {
  if (row.collection !== 'profile' || row.deleted || !row.data) return;
  const pId = row.item_id;
  PROFILE_VAL_KEYS.forEach(vk => {
    if (row.data[vk] === undefined) return;
    const key = `${pId}:${vk}`;
    const incoming = row.data[vk];
    const existing = base[key];
    if (vk === 'balanceBase' && typeof existing === 'number' && existing > 0 && (!incoming || incoming === 0)) return;
    if (vk === 'balance' && typeof existing === 'number' && existing !== 0 && incoming === 0) {
      const incBase = row.data.balanceBase;
      if (incBase == null || incBase === 0) return;
    }
    next[key] = incoming;
  });
}
