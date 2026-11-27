/* Profile history: every saved change is a version; open one to see each field's old and new value. */
(() => {
  "use strict";
  if (!window.Shell) return; // not signed in: on the way to the sign-in page
  const { $ } = UI;
  const esc = Form.esc;
  const MODULES = [["all", "All"], ["registration", "Registration"], ["profile", "Profile"], ["education", "Education"], ["community", "Community"], ["documents", "Documents"], ["activation", "Activation"], ["account", "Account"]];
  const ICON = { registration: "bi-person-plus", profile: "bi-person-vcard", education: "bi-mortarboard", community: "bi-people", documents: "bi-folder2-open", verification: "bi-shield-check", activation: "bi-lightning-charge", account: "bi-key" };
  let mod = "all";
  const open = new Set();

  const day = (ts) => new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const time = (ts) => new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  $("histFilter").innerHTML = MODULES.map(([v, l]) => `<label class="pill"><input type="radio" name="histFilter" value="${v}"${v === mod ? " checked" : ""} /><span>${l}</span></label>`).join("");

  function matches(h, q) {
    if (mod !== "all" && h.module !== mod) return false;
    if (!q) return true;
    const text = [h.title, ...h.changes.flatMap((c) => [c.label, c.from, c.to])].join(" ").toLowerCase();
    return text.includes(q);
  }
  function render() {
    const s = Store.get();
    const q = $("histSearch").value.trim().toLowerCase();
    const list = s.history.filter((h) => matches(h, q));
    $("histCount").textContent = `${s.history.length} version${s.history.length === 1 ? "" : "s"}`;
    let html = "", lastDay = "";
    list.forEach((h) => {
      const d = day(h.ts);
      if (d !== lastDay) { html += `<p class="hist-day">${d}</p>`; lastDay = d; }
      const isOpen = open.has(h.id);
      html += `<article class="version${isOpen ? " is-open" : ""}">
        <button type="button" class="version__head" data-version="${h.id}" aria-expanded="${isOpen}" aria-controls="v-${h.id}">
          <span class="timeline__dot${h.module === "activation" ? " timeline__dot--gold" : h.module === "verification" ? " timeline__dot--ok" : ""}" aria-hidden="true"><i class="bi ${ICON[h.module] || "bi-pencil"}"></i></span>
          <span class="version__no">v${h.id}</span>
          <span class="version__title">${esc(h.title)}<br /><span class="timeline__meta">${h.changes.length} change${h.changes.length === 1 ? "" : "s"} · by ${esc(h.by)}</span></span>
          <span class="version__time">${time(h.ts)}</span>
          <i class="bi bi-chevron-down item__chevron" aria-hidden="true"></i>
        </button>
        <div class="version__body${isOpen ? "" : " d-none"}" id="v-${h.id}">
          ${h.changes.length ? `<table class="diff"><thead><tr><th scope="col">Field</th><th scope="col">Before</th><th scope="col">After</th></tr></thead><tbody>
            ${h.changes.map((c) => `<tr><td>${esc(c.label)}</td><td>${c.from ? `<span class="diff__from">${esc(c.from)}</span>` : '<span class="diff__none">Empty</span>'}</td><td>${c.to ? `<span class="diff__to">${esc(c.to)}</span>` : '<span class="diff__none">Removed</span>'}</td></tr>`).join("")}
          </tbody></table>` : '<p class="scard__none">No field values recorded for this event.</p>'}
        </div></article>`;
    });
    $("histList").innerHTML = html || '<p class="empty-note">No versions match.</p>';
  }
  $("histList").addEventListener("click", (e) => {
    const b = e.target.closest("[data-version]");
    if (!b) return;
    const id = Number(b.dataset.version);
    if (open.has(id)) open.delete(id); else open.add(id);
    render();
  });
  $("histFilter").addEventListener("change", (e) => { mod = e.target.value; render(); });
  $("histSearch").addEventListener("input", render);

  // download all versions as CSV
  $("btnCsv").addEventListener("click", () => {
    const s = Store.get();
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Version", "Date", "Time", "Module", "Event", "Field", "Before", "After"].map(cell).join(",")];
    s.history.forEach((h) => (h.changes.length ? h.changes : [{}]).forEach((c) =>
      lines.push([`v${h.id}`, day(h.ts), time(h.ts), h.module, h.title, c.label, c.from, c.to].map(cell).join(","))));
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `otr-profile-history-${s.account.fileRef}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  Store.subscribe(render);
  render();
})();
