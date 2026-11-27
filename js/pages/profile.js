/* Candidate profile: contact & sign-in (changes by OTP apply at once), then personal details, address,
   identification & income and work experience (each saved on its own by the form engine). */
(() => {
  "use strict";
  if (!window.Shell) return; // not signed in: on the way to the sign-in page
  const { $, fieldError, digitsOnly, resendTimer, toast } = UI;
  const S = Schema, esc = Form.esc;

  const pagePct = () => {
    const p = S.completion(Store.get()).profile;
    $("pagePct").innerHTML = `<strong>${p.pct}%</strong><span>of this module<br />complete</span>`;
  };
  Store.subscribe(pagePct);
  pagePct();

  // ---------- contact card
  const CONTACT = {
    mobile: { label: "Mobile number", test: /^[6-9]\d{9}$/, bad: "Enter a valid 10-digit mobile number.", show: (v) => Store.mask(v), input: 'inputmode="numeric" maxlength="10" placeholder="10-digit mobile number"' },
    email: { label: "Email", test: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, bad: "Enter a valid email address.", show: (v) => v, input: 'type="email" maxlength="120" placeholder="name@example.com"' }
  };
  const card = $("sec-contact");
  function renderContact() {
    const s = Store.get();
    card.innerHTML = `
      <header class="scard__head">
        <span class="scard__icon" aria-hidden="true"><i class="bi bi-telephone"></i></span>
        <div class="scard__titles"><h2 class="scard__title" id="contactTitle">Contact &amp; sign-in</h2><p class="scard__desc">Verified at registration. A new mobile number or email needs an OTP.</p></div>
        <span class="tag tag--ok"><i class="bi bi-check2" aria-hidden="true"></i>Verified</span>
      </header>
      <div class="scard__view">
        <dl class="kv">
          ${["mobile", "email"].map((k) => `<div class="kv__item"><dt>${CONTACT[k].label}</dt><dd>${esc(CONTACT[k].show(s.account[k]))} <span class="tag tag--ok"><i class="bi bi-patch-check-fill" aria-hidden="true"></i>Verified</span>
            <button type="button" class="link-btn" data-change="${k}">Change</button></dd></div>`).join("")}
          <div class="kv__item"><dt>Aadhaar number</dt><dd>XXXX XXXX ${esc(s.account.aadhaarLast4)} <span class="tag tag--ok"><i class="bi bi-patch-check-fill" aria-hidden="true"></i>UIDAI verified</span></dd></div>
          <div class="kv__item"><dt>Username</dt><dd>${esc(s.account.username)} <a class="link-btn" href="security.html">Password &amp; security</a></dd></div>
        </dl>
        ${["mobile", "email"].map((k) => `
        <div class="reveal" id="chg-${k}"><div class="reveal__inner"><div class="reveal__body">
          <div class="sub-card">
            <p class="sub-card__title">Change ${CONTACT[k].label.toLowerCase()}</p>
            <div class="fgrid">
              <div class="field span-2"><label class="field__label" for="new-${k}">New ${CONTACT[k].label.toLowerCase()}</label>
                <div class="input-group"><input class="input" id="new-${k}" ${CONTACT[k].input} /><button type="button" class="btn btn--outline verify-btn" data-send="${k}">Send OTP</button></div></div>
              <div class="field span-2"><label class="field__label" for="otp-${k}">OTP</label>
                <div class="otp-row"><input class="input otp-input" id="otp-${k}" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="Enter OTP" />
                <button type="button" class="btn btn--primary" data-confirm="${k}">Verify &amp; update</button></div>
                <span class="field__hint">Preview: any 6 digits work.</span></div>
            </div>
          </div>
        </div></div></div>`).join("")}
      </div>`;
    card.querySelectorAll(".reveal").forEach((r) => (r.inert = true));
    digitsOnly($("new-mobile"), 10);
    ["mobile", "email"].forEach((k) => digitsOnly($(`otp-${k}`), 6));
  }
  const stop = {};
  card.addEventListener("click", (e) => {
    const change = e.target.closest("[data-change]");
    const send = e.target.closest("[data-send]");
    const confirm = e.target.closest("[data-confirm]");
    if (change) {
      const k = change.dataset.change;
      const r = $(`chg-${k}`);
      const open = !r.classList.contains("is-open");
      r.classList.toggle("is-open", open);
      r.inert = !open;
      change.textContent = open ? "Cancel" : "Change";
      if (open) $(`new-${k}`).focus();
    }
    if (send) {
      const k = send.dataset.send;
      const v = $(`new-${k}`).value.trim();
      if (!CONTACT[k].test.test(v)) return fieldError.showAll([[`new-${k}`, v ? CONTACT[k].bad : `Enter the new ${CONTACT[k].label.toLowerCase()}.`]]);
      if (stop[k]) stop[k]();
      stop[k] = resendTimer(send);
      $(`otp-${k}`).focus();
      toast(`OTP sent to ${CONTACT[k].show(v)}`);
    }
    if (confirm) {
      const k = confirm.dataset.confirm;
      const v = $(`new-${k}`).value.trim();
      const list = [];
      if (!CONTACT[k].test.test(v)) list.push([`new-${k}`, v ? CONTACT[k].bad : `Enter the new ${CONTACT[k].label.toLowerCase()}.`]);
      if (!/^\d{6}$/.test($(`otp-${k}`).value)) list.push([`otp-${k}`, "Enter the 6-digit OTP."]);
      if (fieldError.showAll(list)) return;
      if (stop[k]) stop[k]();
      const old = Store.get().account[k];
      Store.commit({ module: "profile", title: `${CONTACT[k].label} changed`, changes: [{ label: CONTACT[k].label, from: CONTACT[k].show(old), to: CONTACT[k].show(v) }] }, (st) => { st.account[k] = v; });
      renderContact();
      toast(`${CONTACT[k].label} updated`);
    }
  });
  renderContact();

  // ---------- the editable sections
  Form.page($("cards"), "profile");
})();
