import { LIVE_COLLECTIONS, PROFILE_VAL_KEYS } from '../constants.js';
import { jclone } from '../utils/electricityUtils.js';

// Kipr 1 expected format: flat JSON with root-level collections and profile values.
// Current app already knows how to import this via utils/dataFormat.js::isFlatExport/flatToNamespaced.
export function exportKipr1FlatFromFull(fullUserData, activeProfileId = 'main') {
  const flat = {};

  // Collections (transactions, homeExpenses, etc.)
  LIVE_COLLECTIONS.forEach(col => {
    const namespacedKey = `${activeProfileId}:${col}`;
    const v = fullUserData?.[namespacedKey];
    if (v !== undefined) flat[col] = jclone(v);
  });

  // Profile values (balance, balanceBase)
  PROFILE_VAL_KEYS.forEach(key => {
    const namespacedKey = `${activeProfileId}:${key}`;
    const v = fullUserData?.[namespacedKey];
    if (v !== undefined) flat[key] = jclone(v);
  });

  // Legacy app used meta settings as top-level fields.
  // Keep the common global keys needed by the older UI.
  const metaData = fullUserData?.['meta|settings']?.data || {};
  // Put all scalar/global settings at root (minus profiles/activeProfileId to avoid confusion).
  Object.keys(metaData).forEach(k => {
    if (k === 'profiles' || k === 'activeProfileId') return;
    const v = metaData[k];
    // Avoid exporting big nested structures that the old app can't understand.
    // But safe to include budgets/labels/rates/theme/weather keys.
    if (v !== undefined) flat[k] = jclone(v);
  });

  // Back-compat markers
  flat.version = 'kipr1';
  return flat;
}

