/* OTR v3 data service (UI preview). Exposes window.Store.
   Every page reads and writes the applicant's data only through this file, so that connecting the real API later
   means replacing this file, not the pages. In the preview the data is SAMPLE data kept in this browser
   (localStorage); the sign-in session is kept per tab (sessionStorage).
   Every change is a commit: it updates the data and, when something changed, adds a version to the history. */
window.Store = (() => {
  "use strict";
  const KEY = "otr-v3-demo";
  const SESSION = "otr-v3-session";
  const VERSION = 3;
  const SERIALS = "otr-v3-serials"; // last serial per year of birth + gender (kept across demo resets)
  const listeners = new Set();
  const now = () => new Date().toISOString();
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const mask = (m) => `+91 ${m.slice(0, 2)}XXXXXX${m.slice(-2)}`;
  const dmy = (iso) => (iso ? iso.split("-").reverse().join("-") : "");

  /**
   * File reference number: RF + year of birth (4) + gender (M/F/T) + serial (5), e.g. RF2001M00001.
   * The serial runs per year of birth and gender. In the live system the server issues it inside the
   * registration transaction (a database sequence per prefix), never the browser.
   */
  function fileRef(ekyc) {
    const yob = (ekyc.dob || "").slice(0, 4) || "0000";
    const prefix = `RF${yob}${ekyc.gender || "X"}`;
    let map = {};
    try { map = JSON.parse(localStorage.getItem(SERIALS)) || {}; } catch { map = {}; }
    map[prefix] = (map[prefix] || 0) + 1;
    try { localStorage.setItem(SERIALS, JSON.stringify(map)); } catch { /* preview only */ }
    return `${prefix}${String(map[prefix]).padStart(5, "0")}`;
  }
  /**
   * OTR number, same format as before (src/apps/otr/modules/registration/otr-number.ts): 3 digits, gender letter,
   * 3 digits, 1 letter or digit, e.g. 470M285K; neighbouring digits never repeat or run up / down.
   */
  function otrNumber(g) {
    const ok = (b) => [...b].every((c, i) => i === 0 || Math.abs(Number(c) - Number(b[i - 1])) > 1);
    const block = () => { let b; do b = String(Math.floor(Math.random() * 1000)).padStart(3, "0"); while (!ok(b)); return b; };
    return block() + (g || "M") + block() + "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)];
  }

  function seed(reg = {}) {
    const ts = now();
    const ekyc = reg.ekyc || Ekyc.parse(Ekyc.SAMPLE_RESPONSE);
    const account = {
      username: reg.username || "testuser1",
      mobile: reg.mobile || "9876543210",
      email: reg.email || "applicant@example.com",
      aadhaarLast4: String(reg.aadhaar || ekyc.uidLast4 || "0123").slice(-4),
      fileRef: fileRef(ekyc),
      otrNo: otrNumber(ekyc.gender), // issued at registration; becomes usable once activated
      status: "INACTIVE",
      validUntil: null, activatedOn: null, payment: null,
      createdAt: ts, passwordChangedAt: ts
    };
    return {
      account, ekyc,
      sections: {}, // values per section key
      rows: { education: [], experience: [], otherDocs: [] },
      docs: {}, // uploaded files (metadata) by document key
      history: [
        { id: 2, ts, by: "You", module: "registration", title: "Aadhaar e-KYC completed", changes: [
          { label: "Name as per Aadhaar", to: ekyc.name }, { label: "Date of birth", to: dmy(ekyc.dob) }, { label: "Gender", to: ekyc.genderLabel },
          { label: "Care of (C/O)", to: ekyc.careOf }, { label: "District", to: ekyc.address.district }] },
        { id: 1, ts, by: "You", module: "registration", title: "Account created", changes: [
          { label: "OTR No", to: account.otrNo }, { label: "File reference number", to: account.fileRef },
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
      return clone(state.account);
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
