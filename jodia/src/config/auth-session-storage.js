// Remember the Supabase session, never the password, QR secret or OTP.
// This controls storage only. MFA/AAL2 and database policies still decide access.
const preferenceKey = 'denr-remember-session';
const memory = new Map();
const sessionKeys = new Set();
let rememberChoice;

function browserStorage(name) {
  try { return globalThis[name] || null; }
  catch { return null; }
}

function read(storage, key) {
  try { return storage?.getItem(key) ?? null; }
  catch { return null; }
}

function remove(storage, key) {
  try { storage?.removeItem(key); }
  catch { /* Browser storage may be blocked. */ }
}

export const AuthSessionStorage = {
  isRemembered() {
    if (rememberChoice !== undefined) return rememberChoice;
    const tabChoice = read(browserStorage('sessionStorage'), preferenceKey);
    return (tabChoice ?? read(browserStorage('localStorage'), preferenceKey)) === 'true';
  },

  setRememberMe(enabled) {
    const remember = enabled === true;
    const local = browserStorage('localStorage');
    if (remember) {
      try {
        if (!local) throw new Error('Storage unavailable');
        local.setItem(preferenceKey, 'true');
      } catch {
        throw new Error('This browser cannot remember sign-ins. Uncheck Remember me and try again.');
      }
    } else {
      // Explicit false distinguishes opting out from a pre-checkbox session.
      try { local?.setItem(preferenceKey, 'false'); } catch { /* Use this tab only. */ }
    }
    rememberChoice = remember;
    try { browserStorage('sessionStorage')?.setItem(preferenceKey, String(rememberChoice)); }
    catch { /* In-memory sign-in remains available when browser storage is blocked. */ }
  },

  clearPreference() {
    rememberChoice = false;
    remove(browserStorage('localStorage'), preferenceKey);
    remove(browserStorage('sessionStorage'), preferenceKey);
  },

  clear() {
    for (const key of sessionKeys) this.removeItem(key);
    this.clearPreference();
  },

  getItem(key) {
    sessionKeys.add(key);
    const local = browserStorage('localStorage');
    const tab = browserStorage('sessionStorage');
    const saved = read(this.isRemembered() ? local : tab, key);
    if (saved !== null) return saved;

    // Before this checkbox existed, the SDK used localStorage by default.
    // Preserve that existing session in the current tab without opting in.
    if (!this.isRemembered() && rememberChoice === undefined
        && read(local, preferenceKey) === null && read(tab, preferenceKey) === null) {
      const previous = read(local, key);
      if (previous !== null) {
        this.setItem(key, previous);
        return previous;
      }
    }
    return memory.get(key) ?? null;
  },

  setItem(key, value) {
    sessionKeys.add(key);
    const local = browserStorage('localStorage');
    const tab = browserStorage('sessionStorage');
    const remember = this.isRemembered();
    if (remember) {
      try {
        if (!local) throw new Error('Storage unavailable');
        local.setItem(key, value);
        local.setItem(preferenceKey, 'true');
        remove(tab, key);
        memory.delete(key);
        return;
      } catch {
        // Never retain an older token if a refreshed session cannot be saved.
        remove(local, key);
        this.setRememberMe(false);
      }
    }
    remove(local, key);
    try {
      if (!tab) throw new Error('Storage unavailable');
      tab.setItem(key, value);
      memory.delete(key);
    } catch { memory.set(key, value); }
  },

  removeItem(key) {
    remove(browserStorage('localStorage'), key);
    remove(browserStorage('sessionStorage'), key);
    memory.delete(key);
  }
};
