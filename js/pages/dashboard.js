/* OTR dashboard: completion, status and activation, module cards, next steps, verification and recent changes. */
(() => {
  "use strict";
  if (!window.Shell) return; // not signed in: on the way to the sign-in page
  const { $ } = UI;
  const S = Schema, esc = Form.esc;
  const dmy = (iso) => (iso ? new Date(iso).toLocaleDateString("en-GB").replace(/\//g, "-") : "");
  const ago = (ts) => {
    const m = Math.round((Date.now() - new Date(ts)) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} h ago` : dmy(ts);
  };
  const ICON = { registration: "bi-person-plus", profile: "bi-person-vcard", education: "bi-mortarboard", community: "bi-people", documents: "bi-folder2-open", verification: "bi-shield-check", activation: "bi-lightning-charge", account: "bi-key" };

  function render() {
    const s = Store.get();
    const a = s.account;
    const pct = S.completion(s);
    const items = S.verificationItems(s);
    const n = (k) => items.filter((i) => i.status === k).length;
    const name = (s.sections.personal && s.sections.personal.fullName) || s.ekyc.name;
    const active = a.status === "ACTIVE";
    const f = S.fee(s);
    const steps = S.nextSteps(s).slice(0, 4);
    const mods = S.MODULES.filter((m) => ["profile", "education", "community", "documents", "verification", "history"].includes(m.key));

    $("dash").innerHTML = `
    <div class="dash-hero">
      <section class="card hero-card" aria-labelledby="heroName">
        <div class="hero-card__avatar" aria-hidden="true">${s.docs["photos.photo"] && s.docs["photos.photo"].thumb ? `<img src="${s.docs["photos.photo"].thumb}" alt="" />` : esc(name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2))}</div>
        <div class="hero-card__text">
          <p class="hero-card__hello">Welcome back</p>
          <h1 class="hero-card__name" id="heroName">${esc(name)}</h1>
          <div class="hero-card__meta"><span>OTR No <strong>${esc(a.otrNo)}</strong></span><span>File ref. <strong>${esc(a.fileRef)}</strong></span><span>Username <strong>${esc(a.username)}</strong></span></div>
          <div class="hero-card__actions">
            ${steps.length ? `<a class="btn btn--primary" href="${steps[0].page}"><i class="bi bi-arrow-right-circle" aria-hidden="true"></i>Continue: ${esc(steps[0].title)}</a>` : '<a class="btn btn--primary" href="verification.html"><i class="bi bi-shield-check" aria-hidden="true"></i>See verification</a>'}
            <a class="btn btn--outline" href="history.html"><i class="bi bi-clock-history" aria-hidden="true"></i>Profile history</a>
          </div>
        </div>
        <div class="ring" style="--p:${pct.overall.pct}" role="img" aria-label="Profile ${pct.overall.pct}% complete"><div class="ring__inner"><div><div class="ring__pct">${pct.overall.pct}%</div><div class="ring__label">complete</div></div></div></div>
      </section>

      <section class="card status-card" id="activate" aria-labelledby="statusTitle">
        <div class="card__head"><h2 class="card__title" id="statusTitle"><i class="bi bi-lightning-charge" aria-hidden="true"></i>OTR status</h2>
          <span class="status-chip ${active ? "status-chip--active" : "status-chip--inactive"}">${active ? "Active" : "Inactive"}</span></div>
        ${active ? `
          <div class="status-card__row"><span>OTR number</span><strong class="status-card__otr">${esc(a.otrNo)}</strong></div>
          <div class="status-card__row"><span>Valid until</span><strong>${dmy(a.validUntil)}</strong></div>
          <div class="status-card__row"><span>Activation fee</span><strong>${a.payment.amount ? Shell.rupees(a.payment.amount) + " paid" : "No fee (" + esc(a.payment.rule) + ")"}</strong></div>
          <div class="status-card__row"><span>Transaction reference</span><strong>${esc(a.payment.txn || "Not applicable")}</strong></div>
          <div class="note note--ok"><i class="bi bi-patch-check" aria-hidden="true"></i><span>You can now apply for TNUSRB recruitments with your OTR number. You can still update your details, except your Aadhaar number.</span></div>` : `
          <div class="status-card__row"><span>OTR number</span><strong class="status-card__otr">${esc(a.otrNo)}</strong></div>
          <div class="status-card__row"><span>Applicable rule</span><strong>${esc(f.rule)}</strong></div>
          <div class="status-card__row"><span>Activation fee</span><strong>${f.amount ? Shell.rupees(f.amount) : "No fee"}</strong></div>
          <div class="status-card__row"><span>Profile complete</span><strong>${pct.overall.pct}%</strong></div>
          <p class="modal__lead">Your OTR number is issued. Accept the declaration and pay the fee to activate it; it is then valid for 5 years. You can still update your details afterwards, except your Aadhaar number.</p>
          <button type="button" class="btn btn--primary btn--block" id="dashActivate"><i class="bi bi-lightning-charge-fill" aria-hidden="true"></i>Review &amp; activate</button>`}
      </section>
    </div>

    <p class="group-title">Your OTR modules</p>
    <div class="mod-grid">
      ${mods.map((m) => {
        const p = pct[m.key];
        let foot = "";
        if (p) foot = `<span>${p.pct >= 100 ? "Complete" : p.pct ? "In progress" : "Not started"}</span><strong>${p.pct}%</strong>`;
        if (m.key === "verification") foot = `<span>${n("MISSING") ? `${n("MISSING")} certificate${n("MISSING") === 1 ? "" : "s"} not provided` : "All certificates provided"}</span><strong>${n("VERIFIED")} verified</strong>`;
        if (m.key === "history") foot = `<span>Last change ${ago(s.history[0].ts)}</span><strong>${s.history.length} versions</strong>`;
        return `<a class="card mod-card${p && p.pct >= 100 ? " is-done" : ""}" href="${m.page}">
          <div class="mod-card__top"><span class="mod-card__icon" aria-hidden="true"><i class="bi ${p && p.pct >= 100 ? "bi-check-lg" : m.icon}"></i></span>
            <div><p class="mod-card__title">${esc(m.title)}</p><p class="mod-card__desc">${esc(m.desc)}</p></div></div>
          ${p ? `<div class="progress"><span class="progress__bar" style="width:${p.pct}%"></span></div>` : ""}
          <div class="mod-card__foot">${foot}</div></a>`;
      }).join("")}
    </div>

    <div class="dash-cols">
      <section class="card" aria-labelledby="stepsTitle">
        <div class="card__head"><h2 class="card__title" id="stepsTitle"><i class="bi bi-signpost-2" aria-hidden="true"></i>Next steps</h2></div>
        ${steps.length ? `<ul class="steps-list">${steps.map((x) => `<li><a href="${x.page}"><i class="bi ${x.icon}" aria-hidden="true"></i>
          <span class="steps-list__text">${esc(x.title)}<small>${x.left ? `${x.left} detail${x.left === 1 ? "" : "s"} still to add` : "Not added yet"}</small></span><i class="bi bi-chevron-right" aria-hidden="true"></i></a></li>`).join("")}</ul>`
          : `<div class="note note--ok"><i class="bi bi-check2-circle" aria-hidden="true"></i><span>${active ? "Your profile is complete and your OTR is active." : "Your profile is complete. Review it and activate your OTR."}</span></div>`}
      </section>
      <div class="app-main">
        <section class="card" aria-labelledby="verTitle">
          <div class="card__head"><h2 class="card__title" id="verTitle"><i class="bi bi-shield-check" aria-hidden="true"></i>Verification</h2><a class="card__link" href="verification.html">View all</a></div>
          <div class="vcounts">
            <div class="vcount vcount--ok"><strong>${n("VERIFIED")}</strong><span>Verified</span></div>
            <div class="vcount vcount--info"><strong>${n("UPLOADED")}</strong><span>Uploaded</span></div>
            <div class="vcount vcount--warn"><strong>${n("MISSING")}</strong><span>Not provided</span></div>
          </div>
        </section>
        <section class="card" aria-labelledby="actTitle">
          <div class="card__head"><h2 class="card__title" id="actTitle"><i class="bi bi-clock-history" aria-hidden="true"></i>Recent changes</h2><a class="card__link" href="history.html">Full history</a></div>
          <ul class="timeline">${s.history.slice(0, 5).map((h) => `<li class="timeline__item">
            <span class="timeline__dot${h.module === "activation" ? " timeline__dot--gold" : h.module === "verification" ? " timeline__dot--ok" : ""}" aria-hidden="true"><i class="bi ${ICON[h.module] || "bi-pencil"}"></i></span>
            <div class="timeline__body"><p class="timeline__title">${esc(h.title)}</p><p class="timeline__meta">${ago(h.ts)} · ${h.changes.length} change${h.changes.length === 1 ? "" : "s"}</p></div></li>`).join("")}</ul>
        </section>
      </div>
    </div>`;
    const btn = $("dashActivate");
    if (btn) btn.addEventListener("click", Shell.openActivation);
  }
  Store.subscribe(render);
  render();
  if (location.hash === "#activate" && Store.get().account.status !== "ACTIVE") setTimeout(Shell.openActivation, 200);
})();
