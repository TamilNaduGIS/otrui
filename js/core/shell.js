/* OTR v3 app shell for the signed-in pages. Exposes window.Shell.
   - fixed header: username, OTR No, status, Activate badge, sign out (and the menu button on small screens)
   - left menu of the sub-modules with completion / status badges
   - activation modal (fee, checklist, declaration, payment)
   - Back / Next between the profile modules, footer with "Reset demo data"
   A page only provides <main id="main" data-module="..."> with its own content. */
window.Shell = (() => {
  "use strict";
  const S = Schema;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const rupees = (n) => `₹${Number(n).toFixed(2)}`;
  const main = document.getElementById("main");
  const current = main.dataset.module;

  // ---------- signed in?
  if (!Store.session.get()) {
    location.replace(`index.html?next=${encodeURIComponent(location.pathname.split("/").pop() + location.hash)}`);
    document.documentElement.hidden = true;
    return null; // page scripts check for the shell and stop
  }

  // ---------- build the frame around <main>
  const header = document.createElement("header");
  header.className = "site-header site-header--fixed app-header";
  header.id = "siteHeader";
  header.innerHTML = `
    <div class="site-header__inner site-header__inner--wide">
      <button type="button" class="app-menu-btn" id="menuBtn" aria-label="Open the menu" aria-controls="appNav" aria-expanded="false"><i class="bi bi-list" aria-hidden="true"></i></button>
      <a class="brand" href="dashboard.html" aria-label="TNUSRB One-Time Registration, dashboard">
        <span class="brand__mark" aria-hidden="true">OTR</span>
        <span class="brand__text"><span class="brand__gov">Government of Tamil Nadu</span><span class="brand__name">Tamil Nadu Uniformed Services Recruitment Board</span></span>
      </a>
      <div class="account-bar">
        <div class="account-bar__item"><span class="account-bar__label">Username</span><span class="account-bar__value" id="hdrUsername"></span></div>
        <div class="account-bar__item"><span class="account-bar__label">OTR No</span><span class="account-bar__value" id="hdrOtrNo"></span></div>
        <div class="account-bar__item account-bar__item--status"><span class="account-bar__label">Status</span>
          <span class="account-bar__status"><span class="status-chip" id="hdrStatus"></span>
          <button type="button" class="activate-badge" id="btnActivate"><i class="bi bi-lightning-charge-fill" aria-hidden="true"></i>Activate</button></span></div>
        <button type="button" class="btn btn--ghost btn--sm account-bar__signout" id="btnSignOut" title="Sign out"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span>Sign out</span></button>
      </div>
    </div>`;
  const band = document.createElement("div");
  band.className = "app-band";
  band.setAttribute("aria-hidden", "true");
  const body = document.createElement("div");
  body.className = "app-body";
  const nav = document.createElement("aside");
  nav.className = "app-nav";
  nav.id = "appNav";
  nav.setAttribute("aria-label", "OTR modules");
  const scrim = document.createElement("div");
  scrim.className = "app-scrim";
  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<div class="site-footer__inner site-footer__inner--wide">
    <span>&copy; 2026 Tamil Nadu Uniformed Services Recruitment Board, Government of Tamil Nadu</span>
    <span class="app-footer__demo">Preview with sample data · <button type="button" class="link-btn" id="btnResetDemo">Reset demo data</button></span></div>`;
  main.classList.add("app-main");
  main.before(header, band, body);
  body.append(nav, main);
  body.after(footer);
  document.body.append(scrim);
  const skip = document.createElement("a");
  skip.className = "skip-link";
  skip.href = "#main";
  skip.textContent = "Skip to the content";
  document.body.prepend(skip);
  main.tabIndex = -1;

  // Back / Next between the profile modules
  const flowOrder = ["dashboard", ...S.PROFILE_MODULES];
  const fi = flowOrder.indexOf(current);
  if (fi > 0) {
    const prev = S.MODULES.find((m) => m.key === flowOrder[fi - 1]);
    const nextKey = flowOrder[fi + 1];
    const next = nextKey ? S.MODULES.find((m) => m.key === nextKey) : null;
    const flow = document.createElement("nav");
    flow.className = "page-flow";
    flow.setAttribute("aria-label", "Move between sections");
    flow.innerHTML = `<a class="btn btn--ghost" href="${prev.page}"><i class="bi bi-arrow-left" aria-hidden="true"></i>${esc(prev.title)}</a>` +
      (next ? `<a class="btn btn--primary" href="${next.page}" data-next-module>Next: ${esc(next.title)}<i class="bi bi-arrow-right" aria-hidden="true"></i></a>`
        : '<a class="btn btn--primary" href="dashboard.html#activate" data-next-module>Review &amp; activate<i class="bi bi-arrow-right" aria-hidden="true"></i></a>');
    main.append(flow);
  }

  // ---------- menu
  function renderNav(s) {
    const pct = S.completion(s);
    const items = S.verificationItems(s);
    const missing = items.filter((i) => i.status === "MISSING").length;
    let html = "";
    let group = null;
    S.MODULES.forEach((m) => {
      if (m.group !== group) { group = m.group; html += `<p class="app-nav__group">${esc(group)}</p>`; }
      let badge = "";
      if (pct[m.key]) badge = pct[m.key].pct >= 100 ? '<span class="nav-badge nav-badge--ok" title="Complete"><i class="bi bi-check-lg" aria-hidden="true"></i></span>' : `<span class="nav-badge">${pct[m.key].pct}%</span>`;
      if (m.key === "verification") badge = missing ? `<span class="nav-badge nav-badge--warn" title="Certificates not provided">${missing}</span>` : '<span class="nav-badge nav-badge--ok" title="All certificates provided"><i class="bi bi-check-lg" aria-hidden="true"></i></span>';
      if (m.key === "dashboard" && s.account.status !== "ACTIVE") badge = `<span class="nav-badge">${pct.overall.pct}%</span>`;
      const done = pct[m.key] && pct[m.key].pct >= 100;
      html += `<a class="app-nav__link${m.key === current ? " is-current" : ""}${done ? " is-done" : ""}" href="${m.page}"${m.key === current ? ' aria-current="page"' : ""}>
        <i class="bi ${m.icon}" aria-hidden="true"></i><span class="app-nav__label">${esc(m.title)}</span>${badge}</a>`;
    });
    nav.innerHTML = `<div class="app-nav__card">${html}</div>
      <div class="app-nav__card app-nav__overall"><div class="who__progress-row"><span>Profile complete</span><strong>${pct.overall.pct}%</strong></div>
      <div class="progress"><span class="progress__bar" style="width:${pct.overall.pct}%"></span></div></div>`;
  }
  function renderHeader(s) {
    const a = s.account;
    document.getElementById("hdrUsername").textContent = a.username;
    const no = document.getElementById("hdrOtrNo");
    no.textContent = a.otrNo || "Not issued yet";
    no.classList.toggle("is-pending", !a.otrNo);
    const st = document.getElementById("hdrStatus");
    st.textContent = a.status === "ACTIVE" ? "Active" : "Inactive";
    st.className = `status-chip ${a.status === "ACTIVE" ? "status-chip--active" : "status-chip--inactive"}`;
    document.getElementById("btnActivate").classList.toggle("d-none", a.status === "ACTIVE");
  }
  const render = (s) => { renderHeader(s); renderNav(s); };
  Store.subscribe(render);
  render(Store.get());

  // header shadow, sign out, demo reset
  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 4);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  document.getElementById("btnSignOut").addEventListener("click", () => { Store.session.end(); location.href = "index.html"; });
  document.getElementById("btnResetDemo").addEventListener("click", () => {
    if (!confirm("Clear all sample data and start again?")) return;
    Store.reset();
    location.href = "dashboard.html";
  });

  // ---------- menu as a drawer on small screens
  const menuBtn = document.getElementById("menuBtn");
  function drawer(open) {
    document.body.classList.toggle("nav-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    if (open) nav.querySelector(".app-nav__link")?.focus();
  }
  menuBtn.addEventListener("click", () => drawer(!document.body.classList.contains("nav-open")));
  scrim.addEventListener("click", () => drawer(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("nav-open")) { drawer(false); menuBtn.focus(); } });

  // ---------- activation
  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.id = "activateModal";
  modal.setAttribute("aria-labelledby", "activateTitle");
  // Declaration and consent shown before payment (wording to be confirmed by TNUSRB before go-live).
  const CONSENT_VERSION = "2026.1";
  const TERMS = [
    "I declare that all the details in my One-Time Registration (OTR) profile, and the documents I have uploaded or verified, are true, complete and correct to the best of my knowledge.",
    "I understand that if any detail is found to be false, incorrect or hidden at any stage, my OTR may be cancelled, my application for any recruitment may be rejected, and action may be taken under the law.",
    "I understand that my OTR number is valid for 5 years from the date of activation. It does not by itself make me eligible for any post; eligibility is decided for each recruitment as per its notification.",
    "I consent to the Tamil Nadu Uniformed Services Recruitment Board processing my personal data, including the details received through my Aadhaar e-KYC and the certificates verified through e-Sevai, for registration, verification and recruitment, in line with the Digital Personal Data Protection Act, 2023. My Aadhaar number is not stored in clear text.",
    "I agree that SMS and email sent to my registered mobile number and email are valid communication, and I will keep them up to date.",
    "I understand that the activation fee is paid online through the authorised payment gateway and is not refundable or transferable once paid.",
    "I may update my details after activation, except my Aadhaar number. Every change is recorded in my profile history and may be checked during recruitment."
  ];
  modal.innerHTML = `
    <div class="modal__head"><h2 class="modal__title" id="activateTitle">Activate your OTR</h2>
      <button type="button" class="modal__close" data-close aria-label="Close"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>
    <div data-view="pay">
      <div class="modal__body">
        <p class="modal__lead">Your OTR number <strong data-otr-pending></strong> becomes active once you accept the declaration and pay the activation fee. It is then valid for 5 years.</p>
        <div class="act-summary">
          <p class="checklist__title">Your details</p>
          <dl class="kv kv--2" data-summary></dl>
        </div>
        <div class="fee-card">
          <div class="fee-card__row"><span>Community</span><strong data-fee="label"></strong></div>
          <div class="fee-card__row"><span>Applicable rule</span><strong data-fee="rule"></strong></div>
          <div class="fee-card__total"><span>Activation fee</span><strong data-fee="amount"></strong></div>
        </div>
        <div class="checklist"><p class="checklist__title">Profile completion</p><ul class="checklist__list" data-checklist></ul></div>
        <section class="terms" aria-labelledby="termsTitle">
          <p class="checklist__title" id="termsTitle">Declaration and consent <span class="terms__ver">Version ${CONSENT_VERSION}</span></p>
          <ol class="terms__list" tabindex="0" aria-label="Declaration and consent text">${TERMS.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
        </section>
        <div class="terms__checks">
          <label class="check"><input type="checkbox" data-consent="declare" /><span>I have read the declaration. The details in my profile are true, complete and correct.</span></label>
          <label class="check"><input type="checkbox" data-consent="data" /><span>I consent to my personal data, including my Aadhaar e-KYC details, being used for registration, verification and recruitment as described above.</span></label>
          <label class="check" data-fee-only><input type="checkbox" data-consent="fee" /><span>I understand that the activation fee is not refundable or transferable once paid.</span></label>
        </div>
      </div>
      <div class="modal__foot"><button type="button" class="btn btn--ghost" data-close>Not now</button>
        <button type="button" class="btn btn--primary" data-pay disabled><i class="bi bi-credit-card" aria-hidden="true"></i><span data-pay-text></span></button></div>
    </div>
    <div data-view="done" class="d-none">
      <div class="modal__body modal__body--center">
        <div class="done__icon" aria-hidden="true"><i class="bi bi-check-lg"></i></div>
        <p class="modal__lead">Your OTR is now active.</p>
        <div class="done__ref"><span class="done__ref-label">Your OTR number</span><span class="done__ref-value" data-otr-no></span><span class="done__ref-label" data-valid></span></div>
      </div>
      <div class="modal__foot"><button type="button" class="btn btn--primary" data-close>Done</button></div>
    </div>`;
  document.body.append(modal);
  const q = (sel) => modal.querySelector(sel);
  const consents = () => [...modal.querySelectorAll("[data-consent]")].filter((c) => !c.closest(".d-none"));
  const allAccepted = () => consents().every((c) => c.checked);

  function fillActivation(root, s) {
    const f = S.fee(s);
    const pct = S.completion(s);
    const p = S.valuesOf(s, "personal");
    q("[data-otr-pending]").textContent = s.account.otrNo;
    q("[data-summary]").innerHTML = [
      ["Name", p.fullName || s.ekyc.name], ["Date of birth", S.dmy(s.ekyc.dob)], ["Gender", s.ekyc.genderLabel], ["Father's name", p.fatherName],
      ["Mobile", Store.mask(s.account.mobile)], ["Email", s.account.email]
    ].map(([k, v]) => `<div class="kv__item"><dt>${k}</dt><dd>${v ? esc(v) : '<span class="kv__empty">Not added</span>'}</dd></div>`).join("");
    root.querySelector('[data-fee="label"]').textContent = f.label;
    root.querySelector('[data-fee="rule"]').textContent = f.rule;
    root.querySelector('[data-fee="amount"]').textContent = f.amount ? rupees(f.amount) : "No fee";
    root.querySelector("[data-pay-text]").textContent = f.amount ? `Pay ${rupees(f.amount)}` : "Activate now";
    q("[data-fee-only]").classList.toggle("d-none", !f.amount);
    root.querySelector("[data-checklist]").innerHTML = S.PROFILE_MODULES.map((m) => {
      const mod = S.MODULES.find((x) => x.key === m);
      return `<li class="${pct[m].pct >= 100 ? "is-ok" : ""}"><a href="${mod.page}">${esc(mod.title)}</a><span class="checklist__pct">${pct[m].pct}%</span></li>`;
    }).join("");
    root.querySelector("[data-pay]").disabled = !allAccepted();
  }
  function openActivation() {
    const s = Store.get();
    if (s.account.status === "ACTIVE") return;
    modal.querySelectorAll("[data-consent]").forEach((c) => (c.checked = false));
    fillActivation(modal, s);
    q('[data-view="pay"]').classList.remove("d-none");
    q('[data-view="done"]').classList.add("d-none");
    modal.showModal();
  }
  const dmyDate = (d) => d.toLocaleDateString("en-GB").replace(/\//g, "-");
  /** Records the consent, pays (preview) and activates the OTR number issued at registration. */
  function pay(btn, done) {
    btn.disabled = true;
    btn.querySelector("[data-pay-text]").textContent = "Processing...";
    setTimeout(() => {
      const s = Store.get();
      const f = S.fee(s);
      const until = new Date();
      until.setFullYear(until.getFullYear() + 5);
      const at = new Date().toISOString();
      Store.commit({ module: "activation", title: "OTR activated", changes: [
        { label: "Status", from: "Inactive", to: "Active" }, { label: "Valid until", from: "", to: dmyDate(until) },
        { label: "Declaration and consent", from: "", to: `Accepted (version ${CONSENT_VERSION})` },
        { label: "Activation fee", from: "", to: f.amount ? `${rupees(f.amount)} paid` : `No fee (${f.rule})` }] }, (st) => {
        st.account.status = "ACTIVE";
        st.account.validUntil = until.toISOString().slice(0, 10);
        st.account.activatedOn = at;
        st.account.consent = { version: CONSENT_VERSION, at };
        st.account.payment = { amount: f.amount, rule: f.rule, txn: f.amount ? `TXN${Date.now().toString().slice(-10)}` : null, date: at };
      });
      done(s.account.otrNo, dmyDate(until));
    }, 1200);
  }
  modal.addEventListener("change", (e) => { if (e.target.matches("[data-consent]")) q("[data-pay]").disabled = !allAccepted(); });
  q("[data-pay]").addEventListener("click", () => pay(q("[data-pay]"), (no, until) => {
    q("[data-otr-no]").textContent = no;
    q("[data-valid]").textContent = `Valid until ${until}`;
    q('[data-view="pay"]').classList.add("d-none");
    q('[data-view="done"]').classList.remove("d-none");
  }));
  modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => modal.close()));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
  document.getElementById("btnActivate").addEventListener("click", openActivation);

  return { render, openActivation, fillActivation, pay, esc, rupees, dmyDate };
})();
