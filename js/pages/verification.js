/* Verification: how far each check has come. Mobile, email and Aadhaar are verified by OTP; certificates are verified
   with e-Sevai from the details the applicant enters, or uploaded manually. No officer review. */
(() => {
  "use strict";
  if (!window.Shell) return; // not signed in: on the way to the sign-in page
  const { $ } = UI;
  const S = Schema, esc = Form.esc;
  let filter = "ALL";
  const ICON = { Identity: "bi-person-check", Certificates: "bi-file-earmark-text", "Photo & signature": "bi-person-bounding-box", "Other documents": "bi-file-earmark" };

  function steps(s, items) {
    const certs = items.filter((i) => i.esevai);
    const missing = certs.filter((i) => i.status === "MISSING");
    const photos = ["photos.photo", "photos.signature", "photos.thumb"].filter((k) => s.docs[k]).length;
    const active = s.account.status === "ACTIVE";
    return [
      { title: "Contact details", text: "Mobile and email verified by OTP.", done: true },
      { title: "Aadhaar e-KYC", text: "Identity confirmed with UIDAI.", done: true },
      { title: "Certificates", text: missing.length ? `${missing.length} not verified or uploaded yet.` : "All verified with e-Sevai or uploaded.", done: !missing.length },
      { title: "Photo & signature", text: photos === 3 ? "Photo, signature and thumb uploaded." : `${photos} of 3 uploaded.`, done: photos === 3 },
      { title: "OTR activation", text: active ? `Active, OTR No ${s.account.otrNo}.` : `OTR No ${s.account.otrNo} is issued. Pay the activation fee to activate it.`, done: active }
    ];
  }

  function action(i) {
    if (!i.page) return "";
    if (i.status === "MISSING") return `<a class="btn btn--primary btn--sm" href="${esc(i.page)}">Verify with e-Sevai</a>`;
    if (i.esevai && i.status === "UPLOADED") return `<a class="btn btn--ghost btn--sm" href="${esc(i.page)}">Verify with e-Sevai instead</a>`;
    return `<a class="btn btn--ghost btn--sm" href="${esc(i.page)}">Open</a>`;
  }

  function render() {
    const s = Store.get();
    const items = S.verificationItems(s);
    const st = steps(s, items);
    const firstOpen = st.findIndex((x) => !x.done);
    $("vflow").innerHTML = st.map((x, i) => `<div class="vstep${x.done ? " is-done" : i === firstOpen ? " is-current" : ""}">
      <span class="vstep__no">${x.done ? '<i class="bi bi-check-lg" aria-hidden="true"></i>' : i + 1}</span>
      <p class="vstep__title">${esc(x.title)}</p><p class="vstep__text">${esc(x.text)}</p></div>`).join("");
    const n = (k) => items.filter((i) => i.status === k).length;
    $("vcounts").innerHTML = `<div class="vcount vcount--ok"><strong>${n("VERIFIED")}</strong><span>Verified</span></div>
      <div class="vcount vcount--info"><strong>${n("UPLOADED")}</strong><span>Uploaded</span></div>
      <div class="vcount vcount--warn"><strong>${n("MISSING")}</strong><span>Not provided</span></div>`;
    $("vfilter").innerHTML = [["ALL", "All"], ["VERIFIED", "Verified"], ["UPLOADED", "Uploaded"], ["MISSING", "Not provided"]]
      .map(([v, l]) => `<label class="seg__option"><input type="radio" name="vfilter" value="${v}"${filter === v ? " checked" : ""} /><span>${l}</span></label>`).join("");
    const order = { MISSING: 0, UPLOADED: 1, VERIFIED: 2 };
    const shown = items.filter((i) => filter === "ALL" || i.status === filter).sort((a, b) => order[a.status] - order[b.status]);
    $("vlist").innerHTML = shown.length ? shown.map((i) => `<div class="vitem${i.status === "MISSING" ? " is-missing" : ""}">
        <span class="vitem__icon" aria-hidden="true"><i class="bi ${ICON[i.group] || "bi-file-earmark"}"></i></span>
        <div class="vitem__text"><p class="vitem__label">${esc(i.label)}</p><p class="vitem__detail">${[i.detail, i.how].filter(Boolean).map(esc).join(" · ")}</p></div>
        <div class="vitem__actions">${Form.docTag({ status: i.status, tag: i.tag })}${action(i)}</div></div>`).join("")
      : '<p class="empty-note">Nothing here.</p>';
  }
  $("vfilter").addEventListener("change", (e) => { filter = e.target.value; render(); });
  Store.subscribe(render);
  render();
})();
