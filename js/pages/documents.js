/* Documents: photo, signature and thumb impression; every uploaded file; other documents.
   Certificates are verified with e-Sevai from the details entered, or uploaded manually (no officer review). */
(() => {
  "use strict";
  if (!window.Shell) return; // not signed in: on the way to the sign-in page
  const { $ } = UI;
  const S = Schema, esc = Form.esc;
  const FILTERS = [["all", "All"], ["profile", "Profile"], ["education", "Education"], ["community", "Community"], ["documents", "Documents"]];
  let filter = "all";

  function render() {
    const s = Store.get();
    const p = S.completion(s).documents;
    $("pagePct").innerHTML = `<strong>${p.pct}%</strong><span>of this module<br />complete</span>`;
    const all = Object.entries(s.docs).map(([key, d]) => ({ key, ...d, moduleTitle: (S.MODULES.find((m) => m.key === d.module) || {}).title || "" }))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    const items = S.verificationItems(s);
    const photos = ["photos.photo", "photos.signature", "photos.thumb"].filter((k) => s.docs[k]).length;
    $("docStats").innerHTML = [
      ["Files uploaded", all.length], ["Verified with e-Sevai", items.filter((i) => i.esevai && i.status === "VERIFIED").length],
      ["Certificates not provided", items.filter((i) => i.status === "MISSING").length], ["Photo, signature & thumb", `${photos} of 3`]
    ].map(([label, count]) => `<div class="doc-stat"><strong>${count}</strong><span>${label}</span></div>`).join("");
    $("docFilter").innerHTML = FILTERS.map(([v, l]) => `<label class="seg__option"><input type="radio" name="docFilter" value="${v}"${filter === v ? " checked" : ""} /><span>${l}</span></label>`).join("");
    const rows = all.filter((d) => filter === "all" || d.module === filter);
    $("docTable").innerHTML = rows.length ? `<div class="dtable-wrap"><table class="dtable">
      <thead><tr><th scope="col">Document</th><th scope="col">Section</th><th scope="col">Uploaded</th><th scope="col">Status</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead>
      <tbody>${rows.map((d) => `<tr data-doc="${esc(d.key)}">
        <td><div class="dtable__name">${d.thumb ? `<img src="${d.thumb}" alt="" />` : '<i class="bi bi-file-earmark-pdf" aria-hidden="true"></i>'}<span>${esc(d.label)}<br /><span class="dtable__file">${esc(d.name)} · ${Math.round(d.size / 1024)} KB</span></span></div></td>
        <td>${esc(d.moduleTitle)}</td>
        <td>${new Date(d.uploadedAt).toLocaleDateString("en-GB").replace(/\//g, "-")}</td>
        <td>${Form.docTag({ status: "UPLOADED" })}</td>
        <td><div class="vitem__actions">${d.thumb ? `<button type="button" class="btn btn--ghost btn--sm" data-view="${esc(d.key)}">View</button>` : ""}
          <a class="btn btn--outline btn--sm" href="${esc(d.page || "#")}">Replace</a></div></td>
      </tr>`).join("")}</tbody></table></div>`
      : `<p class="empty-note">${all.length ? "No documents in this section." : "No documents yet. Upload certificates in each section, and your photo and signature above."}</p>`;
  }
  $("docFilter").addEventListener("change", (e) => { filter = e.target.value; render(); });

  // image preview
  const viewer = document.createElement("dialog");
  viewer.className = "modal";
  viewer.innerHTML = '<div class="modal__head"><h2 class="modal__title" data-title></h2><button type="button" class="modal__close" aria-label="Close"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div><div class="modal__body modal__body--center"><img data-img class="doc-preview" alt="" /><p class="modal__lead">Preview copy. The full file is kept on the server in the live system.</p></div>';
  document.body.append(viewer);
  viewer.querySelector(".modal__close").addEventListener("click", () => viewer.close());
  $("docTable").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    const d = Store.get().docs[b.dataset.view];
    viewer.querySelector("[data-title]").textContent = d.label;
    viewer.querySelector("[data-img]").src = d.thumb;
    viewer.querySelector("[data-img]").alt = d.label;
    viewer.showModal();
  });

  Store.subscribe(render);
  Form.page((type, key) => $(key === "otherDocs" ? "other" : "cards"), "documents");
  render();
})();
