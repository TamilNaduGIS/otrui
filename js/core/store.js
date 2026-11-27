/* OTR v3 data service (UI preview). Exposes window.Store.
   Every page reads and writes the applicant's data only through this file, so that connecting the real API later
   means replacing this file, not the pages. In the preview the data is SAMPLE data kept in this browser
   (localStorage); the sign-in session is kept per tab (sessionStorage).
   Every change is a commit: it updates the data and, when something changed, adds a version to the history. */
window.Store = (() => {
  "use strict";
  const KEY = "otr-v3-demo";
  const SESSION = "otr-v3-session";
  const VERSION = 2;
  const listeners = new Set();
  const now = () => new Date().toISOString();
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const mask = (m) => `+91 ${m.slice(0, 2)}XXXXXX${m.slice(-2)}`;

  function seed(reg = {}) {
    const ts = now();
    const account = {
      username: reg.username || "testuser1",
      mobile: reg.mobile || "9876543210",
      email: reg.email || "applicant@example.com",
      aadhaarLast4: String(reg.aadhaar || "234567890123").slice(-4),
      fileRef: reg.fileRef || "REG2026112600001",
      status: "INACTIVE",
      otrNo: null, validUntil: null, activatedOn: null, payment: null,
      createdAt: ts, passwordChangedAt: ts
    };
    const ekyc = {
      name: "SAMPLE APPLICANT", dob: "2001-05-14", gender: "M", genderLabel: "Male",
      address: { line1: "12, Gandhi Street", village: "Mylapore", taluk: "Mylapore", district: "Chennai", pin: "600004" }
    };
    return {
      account, ekyc,
      sections: {}, // values per section key
      rows: { education: [], experience: [], otherDocs: [] },
      docs: {}, // uploaded files (metadata) by document key
      history: [
        { id: 2, ts, by: "You", module: "registration", title: "Aadhaar e-KYC completed", changes: [
          { label: "Name as per Aadhaar", to: ekyc.name }, { label: "Date of birth", to: "14-05-2001" }, { label: "Gender", to: ekyc.genderLabel }] },
        { id: 1, ts, by: "You", module: "registration", title: "Account created", changes: [
          { label: "Username", to: account.username }, { label: "Mobile number", to: mask(account.mobile) }, { label: "Email", to: account.email }] }
      ],
      seq: 2
    };
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: state }));
    } catch {
      // storage full (large previews): keep working in memory for this page
    }
  }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === VERSION && s.data) return s.data;
    } catch {
      /* fall through to a fresh sample */
    }
    return null;
  }
  let state = load() || seed();
  persist();
  const emit = () => listeners.forEach((f) => f(clone(state)));
  // another tab changed the data
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    state = load() || state;
    emit();
  });

  return {
    /** A copy of the current data. */
    get: () => clone(state),
    /**
     * Applies `mutate` to the data. `entry` ({ module, title, changes:[{label, from, to}] }) is added to the history
     * when it has changes or `always` is set.
     */
    commit(entry, mutate) {
      mutate(state);
      if (entry && (entry.always || (entry.changes && entry.changes.length))) {
        const { always, ...e } = entry;
        state.history.unshift({ id: ++state.seq, ts: now(), by: "You", changes: [], ...e });
      }
      persist();
      emit();
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** New account from the registration page. */
    register(reg) {
      state = seed(reg);
      persist();
      emit();
    },
    reset() {
      state = seed();
      persist();
      emit();
    },
    mask,
    session: {
      start(username) { sessionStorage.setItem(SESSION, JSON.stringify({ username, at: now() })); },
      get() {
        try { return JSON.parse(sessionStorage.getItem(SESSION)); } catch { return null; }
      },
      end() { sessionStorage.removeItem(SESSION); }
    }
  };
})();
