/* OTR v3 form engine. Exposes window.Form.
   Builds section cards (view -> Edit -> Save / Cancel) and lists of rows from Schema, so every module page works
   the same way. Saving goes through Store.commit, which records what changed in the profile history. */
window.Form = (() => {
  "use strict";
  const { fieldError, digitsOnly } = UI;
  const S = Schema;
  const MIN_KB = 20, MAX_KB = 500;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
  const labelOf = (f, v) => (typeof f.label === "function" ? f.label(v || {}) : f.label);
  let uid = 0;
  const editors = new Set(); // open editors, for the "unsaved changes" warning
  window.addEventListener("beforeunload", (e) => {
    if ([...editors].some((ed) => ed.dirty)) e.preventDefault();
  });

  // Certificates are verified with e-Sevai from the details entered, or uploaded manually. There is no officer review.
  const DOC_STATUS = {
    VERIFIED: ["Verified (e-Sevai)", "ok", "bi-patch-check-fill"], UPLOADED: ["Uploaded", "info", "bi-cloud-check"], MISSING: ["Not provided", "warn", "bi-exclamation-circle"]
  };
  const docTag = (d) => {
    if (!d) return "";
    const [text, kind, icon] = DOC_STATUS[d.status] || DOC_STATUS.UPLOADED;
    return `<span class="tag tag--${kind}"><i class="bi ${icon}" aria-hidden="true"></i>${esc(d.tag || text)}</span>`;
  };

  /** Text shown for a value (view mode and history). */
  function display(f, v, s) {
    const x = v[f.name];
    if (f.type === "readonly") return f.value(s);
    if (f.type === "period") return S.period(v[f.from], v[f.current] ? S.todayIso() : v[f.to]);
    if (f.type === "years") { const m = S.months(v[f.from], v[f.current] ? S.todayIso() : v[f.to]); return m ? (m / 12).toFixed(1) : ""; }
    if (f.type === "check" || f.type === "switch") return x ? "Yes" : "No";
    if (f.type === "esevai") return x === "VERIFIED" ? "Verified with e-Sevai" : "";
    if (f.type === "date") return S.dmy(x);
    if (["select", "pills", "seg"].includes(f.type)) { const o = S.optionList(f.options, v).find((o) => o.value === x); return o ? o.label : x || ""; }
    return x == null ? "" : String(x);
  }

  // ---------------------------------------------------------------- one form (section or row)
  class Editor {
    /** ctx: { fields, state, docBase, module, page, title, effects, check, gate, gateHint, editable(name)->bool, disabledOptions(name)->Set } */
    constructor(ctx) {
      this.ctx = ctx;
      this.prefix = `f${++uid}`;
      this.files = {};
      this.dirty = false;
      this.el = document.createElement("div");
      this.el.className = "fgrid";
      this.el.innerHTML = (ctx.gate ? `<p class="note note--info fgrid__gate span-4" data-gate-hint><i class="bi bi-info-circle" aria-hidden="true"></i><span>${esc(ctx.gateHint)}</span></p>` : "") +
        ctx.fields.map((f) => this.fieldHtml(f)).join("");
      this.wire();
    }
    id(name) { return `${this.prefix}-${name}`; }
    wrap(name) { return this.el.querySelector(`[data-field="${name}"]`); }
    input(name) { return this.el.querySelector(`[data-name="${name}"]`); }
    /** Element that receives the error message for a field. */
    target(name) {
      const f = this.ctx.fields.find((x) => x.name === name);
      if (!f) return null;
      if (["pills", "seg"].includes(f.type)) return this.el.querySelector(`#${this.id(name)}-group`);
      if (f.type === "esevai") return this.el.querySelector(`#${this.id(name)}-box`);
      return this.input(name);
    }

    fieldHtml(f) {
      const id = this.id(f.name);
      const span = f.span || 1;
      const lab = (txt, forId = id, extra = "") => `<label class="field__label" for="${forId}"${extra}>${esc(txt)}${f.tag ? ` <span class="tag tag--muted">${esc(f.tag)}</span>` : ""}</label>`;
      const fnLabel = typeof f.label === "function" ? ' data-label-fn' : "";
      const hint = f.hint ? `<span class="field__hint">${esc(f.hint)}</span>` : "";
      const open = `<div class="field span-${span}" data-field="${f.name || ""}">`;
      switch (f.type) {
        case "heading":
          return `<p class="fgrid__heading span-4" data-field="${esc(f.label)}" data-heading>${esc(f.label)}</p>`;
        case "readonly":
          return `${open}${lab(f.label)}<input class="input" id="${id}" data-name="${f.name}" type="text" readonly /></div>`;
        case "text": case "upper": case "digits": case "decimal":
          return `${open}${lab(labelOf(f), id, fnLabel)}<input class="input${f.type === "upper" ? " text-upper" : ""}" id="${id}" data-name="${f.name}" type="text" maxlength="${f.max || 100}"${f.type === "digits" ? ' inputmode="numeric"' : f.type === "decimal" ? ' inputmode="decimal"' : ""}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""} />${hint}</div>`;
        case "date":
          return `${open}${lab(f.label)}<input class="input" id="${id}" data-name="${f.name}" type="date" max="${S.todayIso()}" />${hint}</div>`;
        case "select":
          return `${open}${lab(f.label)}<select class="input" id="${id}" data-name="${f.name}"></select>${hint}</div>`;
        case "period": case "years":
          return `${open}${lab(f.label)}<input class="input" id="${id}" data-name="${f.name}" type="text" readonly placeholder="From the dates" /></div>`;
        case "pills":
          return `<fieldset class="field span-${span}" data-field="${f.name}"><legend class="field__label">${esc(f.label)}</legend><div class="pills" id="${id}-group">${S.optionList(f.options).map((o) => `<label class="pill"><input type="radio" name="${id}" data-name="${f.name}" value="${esc(o.value)}" /><span>${esc(o.label)}</span></label>`).join("")}</div></fieldset>`;
        case "seg":
          return `<fieldset class="field span-${span}" data-field="${f.name}"><legend class="field__label">${esc(f.label)}</legend><div class="seg seg--inline" id="${id}-group">${S.optionList(f.options).map((o) => `<label class="seg__option"><input type="radio" name="${id}" data-name="${f.name}" value="${esc(o.value)}" /><span>${o.icon ? `<i class="bi ${o.icon}" aria-hidden="true"></i>` : ""}${esc(o.label)}</span></label>`).join("")}</div></fieldset>`;
        case "check": {
          const box = `<label class="check"><input type="checkbox" id="${id}" data-name="${f.name}" /><span>${esc(f.label)}</span></label>`;
          return `<div class="field span-${span}" data-field="${f.name}">${f.box ? `<div class="consent consent-box">${box}</div>` : box}</div>`;
        }
        case "switch":
          return `<div class="field span-4" data-field="${f.name}"><label class="switch-row"><span class="switch-row__text">${esc(f.label)}</span><span class="switch"><input type="checkbox" role="switch" id="${id}" data-name="${f.name}" /><span class="switch__track"></span></span></label></div>`;
        case "esevai":
          return `<div class="field span-4" data-field="${f.name}"><input type="hidden" data-name="${f.name}" />
            <div class="ekyc-box" id="${id}-box"><i class="bi bi-shield-check" aria-hidden="true"></i>
              <div class="ekyc-box__text"><p class="ekyc-box__title" data-ekyc-title>Verify with e-Sevai</p><p class="ekyc-box__sub" data-ekyc-sub>We check the details you entered with the e-Sevai (Revenue Department) records.</p></div>
              <button type="button" class="btn btn--primary btn--sm" data-ekyc-btn>Verify now</button></div></div>`;
        case "upload": {
          const image = f.kind === "image";
          return `<div class="field span-${span}" data-field="${f.name}">${image ? `<span class="field__label">${esc(f.label)}</span>` : ""}
            <div class="upload${image ? " upload--image" : ""}" data-upload="${f.kind}">
              <input class="upload__input" type="file" id="${id}" data-name="${f.name}" accept="${image ? "image/jpeg" : "application/pdf"}" />
              ${image ? '<img class="upload__preview" alt="" />' : ""}
              <label class="upload__drop" for="${id}"><i class="bi ${f.icon || "bi-cloud-arrow-up"}" aria-hidden="true"></i><span class="upload__text"><span><strong>Choose ${image ? "an image" : `the ${esc(f.label.toLowerCase())}`}</strong> or drag it here</span><span class="upload__meta">${image ? esc(f.hint || "JPG") + " · JPG, 20-500 KB" : "PDF, 20-500 KB"}</span></span></label>
              <div class="upload__file"><i class="bi ${image ? "bi-file-earmark-image" : "bi-file-earmark-pdf"}" aria-hidden="true"></i><span class="upload__name"></span><span class="upload__size"></span><span class="upload__status"></span><button type="button" class="upload__remove" aria-label="Remove ${esc(f.label)}"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div>
            </div></div>`;
        }
        default:
          return "";
      }
    }

    wire() {
      const { fields } = this.ctx;
      fields.forEach((f) => {
        if (f.type === "digits") digitsOnly(this.input(f.name), f.max || 10);
        if (f.type === "decimal") this.input(f.name).addEventListener("input", (e) => {
          const el = e.target;
          el.value = el.value.replace(/[^\d.]/g, "").replace(/^(\d*\.?\d*).*$/, "$1").slice(0, f.max || 6);
        });
        if (f.type === "upload") this.wireUpload(f);
        if (f.type === "esevai") this.wrap(f.name).querySelector("[data-ekyc-btn]").addEventListener("click", () => this.verifyOnline(f));
      });
      const onChange = (e) => {
        this.dirty = true;
        const name = e.target.dataset && e.target.dataset.name;
        fields.filter((f) => f.type === "esevai" && (f.resetOn || []).includes(name)).forEach((f) => this.setEkyc(f, false));
        this.sync();
      };
      this.el.addEventListener("input", onChange);
      this.el.addEventListener("change", onChange);
    }

    // ---- uploads
    wireUpload(f) {
      const u = this.wrap(f.name).querySelector("[data-upload]");
      const input = u.querySelector(".upload__input");
      const take = async (file) => {
        const problem = await this.checkFile(f, file);
        if (problem) { fieldError.show(input, problem); input.value = ""; return; }
        fieldError.clear(input);
        const thumb = f.kind === "image" ? await makeThumb(file) : null;
        this.files[f.name] = { file, thumb, removed: false };
        input.value = "";
        this.dirty = true;
        this.renderUpload(f);
        this.sync();
      };
      input.addEventListener("change", () => input.files[0] && take(input.files[0]));
      const drop = u.querySelector(".upload__drop");
      drop.addEventListener("dragover", (e) => { e.preventDefault(); if (!input.disabled) u.classList.add("is-dragging"); });
      drop.addEventListener("dragleave", () => u.classList.remove("is-dragging"));
      drop.addEventListener("drop", (e) => { e.preventDefault(); u.classList.remove("is-dragging"); if (!input.disabled && e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); });
      u.querySelector(".upload__remove").addEventListener("click", () => {
        this.files[f.name] = { file: null, thumb: null, removed: true };
        this.dirty = true;
        this.renderUpload(f);
        this.sync();
      });
    }
    async checkFile(f, file) {
      const image = f.kind === "image";
      if (image ? file.type !== "image/jpeg" : file.type !== "application/pdf") return image ? "Choose a JPG image." : "Choose a PDF file.";
      if (file.size < MIN_KB * 1024 || file.size > MAX_KB * 1024) return `The file is ${kb(file.size)}. It must be ${MIN_KB}-${MAX_KB} KB.`;
      if (image && f.orientation) {
        const s = await imageSize(file);
        if (!s) return "This image cannot be read. Choose another JPG.";
        if (f.orientation === "portrait" && s.h <= s.w) return "The photo must be taller than it is wide.";
        if (f.orientation === "landscape" && s.w <= s.h) return "The signature must be wider than it is tall.";
      }
      return null;
    }
    docKey(name) { return `${this.ctx.docBase}.${name}`; }
    /** The file now shown: a newly chosen one, or the saved one. */
    current(name) {
      const pending = this.files[name];
      if (pending) return pending.removed ? null : { name: pending.file.name, size: pending.file.size, thumb: pending.thumb, isNew: true };
      return this.ctx.state.docs[this.docKey(name)] || null;
    }
    renderUpload(f) {
      const u = this.wrap(f.name).querySelector("[data-upload]");
      const cur = this.current(f.name);
      u.classList.toggle("has-file", Boolean(cur));
      u.querySelector(".upload__name").textContent = cur ? cur.name : "";
      u.querySelector(".upload__size").textContent = cur && cur.size ? kb(cur.size) : "";
      u.querySelector(".upload__status").innerHTML = cur && !cur.isNew ? docTag(cur) : cur ? '<span class="tag tag--muted">Not saved yet</span>' : "";
      const img = u.querySelector(".upload__preview");
      if (img) { if (cur && cur.thumb) img.src = cur.thumb; else img.removeAttribute("src"); }
    }

    // ---- online certificate check (preview)
    setEkyc(f, verified) {
      this.input(f.name).value = verified ? "VERIFIED" : "";
      const box = this.wrap(f.name).querySelector(".ekyc-box");
      box.classList.toggle("is-verified", verified);
      box.querySelector("[data-ekyc-title]").textContent = verified ? "Verified with e-Sevai" : "Verify with e-Sevai";
      box.querySelector("[data-ekyc-sub]").textContent = verified ? "Preview: the details match the e-Sevai records." : "We check the details you entered with the e-Sevai (Revenue Department) records.";
      box.querySelector("[data-ekyc-btn]").classList.toggle("d-none", verified);
    }
    verifyOnline(f) {
      const no = (this.input(f.check).value || "").trim();
      const problem = !no ? "Enter the certificate number to verify it." : S.R.certNo(no);
      if (problem) return fieldError.showAll([[this.input(f.check), problem]], this.el);
      fieldError.clear(this.target(f.name));
      const btn = this.wrap(f.name).querySelector("[data-ekyc-btn]");
      btn.disabled = true;
      btn.textContent = "Checking...";
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = "Verify now";
        this.setEkyc(f, true);
        this.dirty = true;
        this.sync();
      }, 900);
    }

    // ---- values
    raw() {
      const v = {};
      this.ctx.fields.forEach((f) => {
        if (!f.name || f.type === "readonly") return;
        if (f.type === "pills" || f.type === "seg") {
          const c = this.el.querySelector(`[data-name="${f.name}"]:checked`);
          v[f.name] = c ? c.value : "";
        } else if (f.type === "check" || f.type === "switch") v[f.name] = this.input(f.name).checked;
        else if (f.type === "upload") { const c = this.current(f.name); v[f.name] = c ? c.name : ""; }
        else if (f.type === "period" || f.type === "years") v[f.name] = "";
        else v[f.name] = f.type === "upper" ? this.input(f.name).value.trim().toUpperCase() : this.input(f.name).value.trim();
      });
      return v;
    }
    /** Values to save: fields that are hidden right now are left empty. */
    values() {
      const v = this.raw();
      this.ctx.fields.forEach((f) => {
        if (!f.name || S.visible(f, v, this.ctx.state)) return;
        v[f.name] = f.type === "check" || f.type === "switch" ? false : "";
      });
      return v;
    }
    load(values) {
      const { fields, state } = this.ctx;
      this.files = {};
      fields.forEach((f) => {
        if (!f.name) return;
        const d = typeof f.default === "function" ? f.default(state) : f.default;
        const x = values[f.name] !== undefined ? values[f.name] : d !== undefined ? d : "";
        if (f.type === "readonly") this.input(f.name).value = f.value(state);
        else if (f.type === "pills" || f.type === "seg") this.el.querySelectorAll(`[data-name="${f.name}"]`).forEach((r) => (r.checked = r.value === x));
        else if (f.type === "check" || f.type === "switch") this.input(f.name).checked = Boolean(x);
        else if (f.type === "esevai") this.setEkyc(f, x === "VERIFIED");
        else if (f.type === "upload") this.renderUpload(f);
        else if (f.type === "select") { this.fillOptions(f, values); this.input(f.name).value = x; }
        else if (f.type !== "period" && f.type !== "years") this.input(f.name).value = x;
      });
      fieldError.clearAll(this.el);
      this.sync();
      this.dirty = false;
    }
    fillOptions(f, v) {
      const sel = this.input(f.name);
      const opts = S.optionList(f.options, v);
      const keep = sel.value;
      const used = this.ctx.disabledOptions ? this.ctx.disabledOptions(f.name) : new Set();
      sel.innerHTML = `<option value="">${opts.length || !f.emptyText ? "Select" : esc(f.emptyText)}</option>` +
        opts.map((o) => `<option value="${esc(o.value)}"${used.has(o.value) ? " disabled" : ""}>${esc(o.label)}${used.has(o.value) ? " (already added)" : ""}</option>`).join("");
      sel.value = opts.some((o) => o.value === keep) ? keep : "";
      sel.dataset.empty = opts.length ? "" : "true";
    }

    /** Re-applies what follows from the values: visibility, dependent lists, copies, gate, locks, worked-out fields. */
    sync() {
      const { fields, state, effects, gate, editable } = this.ctx;
      let v = this.raw();
      fields.filter((f) => f.type === "select" && (f.optionsFrom || this.ctx.disabledOptions)).forEach((f) => {
        const sel = this.input(f.name);
        const key = JSON.stringify([f.optionsFrom ? v[f.optionsFrom] : "", [...(this.ctx.disabledOptions ? this.ctx.disabledOptions(f.name) : [])]]);
        if (sel.dataset.depKey !== key) { sel.dataset.depKey = key; this.fillOptions(f, v); }
      });
      if (effects) {
        effects(v, {
          set: (n, x) => { this.input(n).value = x ?? ""; },
          readonly: (n, ro) => {
            const el = this.input(n);
            el.readOnly = ro;
            if (el.tagName === "SELECT") el.dataset.ro = ro ? "1" : ""; // a select cannot be read-only: it is disabled below
          },
          values: () => this.raw()
        }, state);
        v = this.raw();
      }
      fields.forEach((f) => {
        const w = this.wrap(f.name || f.label);
        if (!w) return;
        const show = S.visible(f, v, state);
        w.classList.toggle("d-none", !show);
        if (typeof f.label === "function") { const l = w.querySelector(".field__label"); if (l) l.textContent = labelOf(f, v); }
        if (f.type === "period" || f.type === "years") this.input(f.name).value = display(f, v, state);
      });
      const gated = gate && !v[gate];
      if (gate) this.el.querySelector("[data-gate-hint]").classList.toggle("d-none", !gated);
      fields.forEach((f) => {
        if (!f.name) return;
        const allowed = (!editable || editable(f.name)) && !(gated && f.name !== gate);
        this.el.querySelectorAll(`[data-name="${f.name}"]`).forEach((el) => {
          if (f.type === "select" && el.dataset.empty === "true") { el.disabled = true; return; }
          if (f.type !== "readonly") el.disabled = !allowed || el.dataset.ro === "1";
        });
        if (f.type === "upload") this.wrap(f.name).querySelector("[data-upload]").classList.toggle("is-disabled", !allowed);
        if (f.type === "esevai") this.wrap(f.name).querySelector("[data-ekyc-btn]").disabled = !allowed;
      });
      if (this.onSync) this.onSync(v);
    }

    /** Problems with what is filled in: [[element, message]]. */
    problems() {
      const { fields, state, check } = this.ctx;
      const raw = this.raw();
      const list = [];
      fields.forEach((f) => {
        if (!f.name || !S.visible(f, raw, state) || !raw[f.name] || !f.rules) return;
        const el = this.input(f.name);
        if (el && (el.readOnly || el.disabled)) return;
        for (const rule of f.rules) {
          const msg = rule(raw[f.name], raw);
          if (msg) { list.push([this.target(f.name), msg]); break; }
        }
      });
      fields.filter((f) => f.type === "esevai" && S.visible(f, raw, state)).forEach((f) => {
        if (raw[f.check] && raw[f.name] !== "VERIFIED") list.push([this.target(f.name), 'Verify the certificate with e-Sevai, or choose "Upload manually".']);
      });
      if (check) check(raw).forEach(([name, msg]) => list.push([this.target(name), msg]));
      return list.filter(([el]) => el);
    }
    /** What changed compared with `before`, as history lines. */
    changes(before) {
      const { fields, state } = this.ctx;
      const after = this.values();
      const out = [];
      fields.forEach((f) => {
        if (!f.name || ["readonly", "period", "years"].includes(f.type)) return;
        const b = before[f.name] !== undefined ? display(f, before, state) : "";
        const a = display(f, after, state);
        const fb = f.type === "check" || f.type === "switch" ? (before[f.name] ? "Yes" : "") : b;
        const fa = f.type === "check" || f.type === "switch" ? (after[f.name] ? "Yes" : "") : a;
        if (f.type === "upload" && this.files[f.name] && !this.files[f.name].removed) out.push({ label: labelOf(f, after), from: fb || "", to: `${fa} (new file)` });
        else if (fb !== fa) out.push({ label: labelOf(f, after), from: fb, to: fa });
      });
      return out;
    }
    /** Writes uploaded / removed files into the data. */
    applyDocs(st) {
      const v = this.values();
      this.ctx.fields.filter((f) => f.type === "upload").forEach((f) => {
        const key = this.docKey(f.name);
        const pending = this.files[f.name];
        if (!v[f.name] || (pending && pending.removed)) { delete st.docs[key]; return; }
        if (pending && pending.file) {
          st.docs[key] = { label: labelOf(f, v) + (this.ctx.labelSuffix ? ` (${this.ctx.labelSuffix(v)})` : ""), name: pending.file.name, size: pending.file.size, type: pending.file.type,
            module: this.ctx.module, page: this.ctx.page, uploadedAt: new Date().toISOString(), status: "UPLOADED", thumb: pending.thumb || null };
        }
      });
      this.files = {};
    }
  }

  // ---------------------------------------------------------------- read-only view of saved values
  function viewHtml(fields, v, s, docBase) {
    let html = "";
    let any = false;
    fields.forEach((f) => {
      if (!S.visible(f, v, s) || ["check", "seg", "switch"].includes(f.type)) return;
      if (f.type === "heading") { html += `<p class="kv__heading">${esc(f.label)}</p>`; return; }
      if (f.type === "esevai") { if (v[f.name] === "VERIFIED") html += `<div class="kv__item span-4"><dt>${esc(f.label)}</dt><dd>${docTag({ status: "VERIFIED" })}</dd></div>`; return; }
      const text = display(f, v, s);
      if (text) any = true;
      let dd = text ? esc(text) : '<span class="kv__empty">Not added</span>';
      if (f.type === "upload") {
        const d = s.docs[`${docBase}.${f.name}`];
        dd = d ? `${d.thumb ? `<img class="kv__thumb" src="${d.thumb}" alt="${esc(f.label)}" />` : '<i class="bi bi-file-earmark-pdf kv__fileicon" aria-hidden="true"></i>'}<span class="kv__file">${esc(d.name)}</span> ${docTag(d)}` : '<span class="kv__empty">Not uploaded</span>';
      }
      html += `<div class="kv__item span-${f.type === "upload" && f.kind === "image" ? 1 : Math.min(f.span || 1, 2)}"><dt>${esc(labelOf(f, v))}</dt><dd>${dd}</dd></div>`;
    });
    return { html: `<dl class="kv">${html}</dl>`, any };
  }

  const progressTag = (p) => {
    if (!p.total) return '<span class="tag tag--muted">Nothing to add</span>';
    if (p.filled >= p.total) return '<span class="tag tag--ok"><i class="bi bi-check2" aria-hidden="true"></i>Complete</span>';
    if (!p.filled) return '<span class="tag tag--muted">Not started</span>';
    return `<span class="tag tag--warn">${p.filled} of ${p.total}</span>`;
  };

  function flash(el) {
    el.classList.remove("is-flash");
    void el.offsetWidth;
    el.classList.add("is-flash");
  }

  // ---------------------------------------------------------------- section card
  function section(mount, key, opts = {}) {
    const def = S.SECTIONS[key];
    const mod = S.MODULES.find((m) => m.key === def.module);
    const card = document.createElement("section");
    card.className = "scard";
    card.id = `sec-${key}`;
    card.innerHTML = `
      <header class="scard__head">
        <span class="scard__icon" aria-hidden="true"><i class="bi ${def.icon}"></i></span>
        <div class="scard__titles"><h2 class="scard__title">${esc(def.title)}</h2><p class="scard__desc">${esc(def.desc || "")}</p></div>
        <span data-status></span>
        <button type="button" class="btn btn--outline btn--sm scard__edit" data-edit aria-controls="ed-${key}"><i class="bi bi-pencil" aria-hidden="true"></i><span>Edit</span></button>
      </header>
      <div class="scard__alert d-none" data-alert role="status"></div>
      <div class="scard__view" data-view></div>
      <div class="reveal" id="ed-${key}" data-editor><div class="reveal__inner">
        <form class="scard__form" novalidate>
          <div data-fields></div>
          <footer class="scard__foot">
            <span class="scard__dirty" data-dirty></span>
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn btn--primary" data-save>Save ${esc(def.title.toLowerCase())}</button>
          </footer>
        </form>
      </div></div>`;
    mount.append(card);
    const editorWrap = card.querySelector("[data-editor]");
    editorWrap.inert = true;
    let editor = null;
    let editing = false;

    function render(s) {
      const v = S.valuesOf(s, key);
      // a category that cannot apply to this applicant (e.g. destitute widow for a male applicant): no editing
      if (def.eligible && !def.eligible(s)) {
        card.classList.add("is-na");
        card.querySelector("[data-status]").innerHTML = '<span class="tag tag--muted"><i class="bi bi-slash-circle" aria-hidden="true"></i>Not applicable</span>';
        card.querySelector("[data-view]").innerHTML = `<p class="scard__none">${esc(def.notEligible.replace("{gender}", s.ekyc.genderLabel || "not female"))}</p>`;
        card.querySelector("[data-edit]").classList.add("d-none");
        return;
      }
      card.classList.remove("is-na");
      const cert = S.sectionCert(s, key);
      card.querySelector("[data-status]").innerHTML = (def.optional
        ? v.on ? '<span class="tag tag--ok"><i class="bi bi-check2" aria-hidden="true"></i>Applies</span>' : s.sections[key] ? '<span class="tag tag--muted">Does not apply</span>' : '<span class="tag tag--muted">Not answered</span>'
        : progressTag(S.sectionProgress(s, key))) + (cert ? ` ${docTag(cert)}` : "");
      if (def.toggle && !v.on) card.querySelector("[data-view]").innerHTML = `<p class="scard__none">${s.sections[key] ? "You said this does not apply to you." : "Not filled in yet. Use Edit if this applies to you."}</p>`;
      else card.querySelector("[data-view]").innerHTML = viewHtml(def.fields, v, s, key).html;
      card.querySelector("[data-edit]").classList.toggle("d-none", editing);
    }
    function open() {
      const s = Store.get();
      if (def.eligible && !def.eligible(s)) return;
      editor = new Editor({ fields: def.fields, state: s, docBase: key, module: def.module, page: `${mod.page}#sec-${key}`, effects: def.effects, check: def.check });
      editor.onSync = () => { card.querySelector("[data-dirty]").textContent = editor.dirty ? "Unsaved changes" : ""; };
      card.querySelector("[data-fields]").replaceChildren(editor.el);
      editor.load(S.valuesOf(s, key));
      editors.add(editor);
      editing = true;
      card.classList.add("is-editing");
      card.querySelector("[data-view]").classList.add("d-none");
      card.querySelector("[data-edit]").classList.add("d-none");
      editorWrap.inert = false;
      requestAnimationFrame(() => editorWrap.classList.add("is-open"));
      const first = editor.el.querySelector("input:not([type=hidden]):not([readonly]):not([disabled]), select:not([disabled])");
      if (first) first.focus({ preventScroll: true });
    }
    function close() {
      editors.delete(editor);
      editing = false;
      editorWrap.classList.remove("is-open");
      editorWrap.inert = true;
      card.classList.remove("is-editing");
      card.querySelector("[data-view]").classList.remove("d-none");
      render(Store.get());
    }
    card.querySelector("[data-edit]").addEventListener("click", open);
    card.querySelector("[data-cancel]").addEventListener("click", close);
    card.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const list = editor.problems();
      if (fieldError.showAll(list, editor.el)) return;
      const s = Store.get();
      const before = S.valuesOf(s, key);
      const changes = editor.changes(before);
      const values = editor.values();
      Store.commit({ module: def.module, section: key, title: `${def.title} updated`, changes }, (st) => {
        st.sections[key] = values;
        editor.applyDocs(st);
      });
      editor.dirty = false;
      close();
      UI.toast(`${def.title} saved`);
      if (opts.onSaved) opts.onSaved(card);
    });
    Store.subscribe((s) => { if (!editing) render(s); });
    render(Store.get());
    return { card, open };
  }

  // ---------------------------------------------------------------- list of rows
  function list(mount, key, opts = {}) {
    const def = S.LISTS[key];
    const mod = S.MODULES.find((m) => m.key === def.module);
    const card = document.createElement("section");
    card.className = "scard lcard";
    card.id = `list-${key}`;
    card.innerHTML = `
      <header class="scard__head">
        <span class="scard__icon" aria-hidden="true"><i class="bi ${def.icon}"></i></span>
        <div class="scard__titles"><h2 class="scard__title">${esc(def.title)}</h2><p class="scard__desc">${esc(def.desc || "")}</p></div>
        <span data-status></span>
        <button type="button" class="btn btn--primary btn--sm" data-add><i class="bi bi-plus-lg" aria-hidden="true"></i><span>${esc(def.addLabel)}</span></button>
      </header>
      <p class="lcard__total d-none" data-total></p>
      <div class="item-list" data-rows></div>
      <p class="empty-note" data-empty-note>${esc(def.empty)}</p>`;
    mount.append(card);
    const rowsEl = card.querySelector("[data-rows]");
    const rows = new Map(); // id -> { el, editor, open }

    const savedRows = (s) => (s.rows[key] || []);
    function usedBy(name, exceptId) {
      if (!def.unique || def.unique.field !== name) return new Set();
      const used = new Set();
      rows.forEach((r, id) => {
        if (id === exceptId) return;
        const v = r.editor.raw()[name];
        if (def.unique.values.includes(v)) used.add(v);
      });
      return used;
    }
    function refreshAll() {
      rows.forEach((r) => r.editor.sync());
      const s = Store.get();
      const n = savedRows(s).length;
      card.querySelector("[data-status]").innerHTML = def.optional ? `<span class="tag tag--muted">${n} added</span>` : n ? progressTag(S.listProgress(s, key)) : '<span class="tag tag--muted">Not started</span>';
      card.querySelector("[data-empty-note]").classList.toggle("d-none", rows.size > 0);
      card.querySelector("[data-add]").classList.toggle("d-none", Boolean(def.max && rows.size >= def.max));
      const total = card.querySelector("[data-total]");
      const text = def.total ? def.total(savedRows(s)) : "";
      total.textContent = text;
      total.classList.toggle("d-none", !text);
    }

    function addRow(id, values, openIt) {
      const s = Store.get();
      const isNew = !values;
      const el = document.createElement("article");
      el.className = "item";
      el.dataset.item = id;
      el.innerHTML = `
        <button type="button" class="item__head" aria-expanded="false" aria-controls="row-${id}">
          <span class="item__icon" aria-hidden="true"><i class="bi ${def.rowIcon}"></i></span>
          <span class="item__titles"><span class="item__title" data-title></span><span class="item__sub" data-sub></span></span>
          <span class="item__state" data-state></span>
          <i class="bi bi-chevron-down item__chevron" aria-hidden="true"></i>
        </button>
        <div class="reveal" id="row-${id}" data-body><div class="reveal__inner"><form class="item__body" novalidate>
          <div data-fields></div>
          <div class="item__foot">
            <button type="button" class="btn btn--ghost item__delete" data-delete><i class="bi bi-trash3" aria-hidden="true"></i><span>Delete</span></button>
            <span class="scard__dirty" data-dirty></span>
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn btn--primary" data-save>Save</button>
          </div>
        </form></div></div>`;
      rowsEl.append(el);
      const body = el.querySelector("[data-body]");
      body.inert = true;
      const editor = new Editor({ fields: def.fields, state: s, docBase: `${key}.${id}`, module: def.module, page: `${mod.page}#list-${key}`, check: def.check,
        gate: def.gate, gateHint: def.gateHint, disabledOptions: (name) => usedBy(name, id),
        labelSuffix: (v) => def.summary(v).title });
      editors.add(editor);
      el.querySelector("[data-fields]").replaceChildren(editor.el);
      const r = { el, editor, saved: !isNew };
      rows.set(id, r);
      editor.onSync = (v) => {
        el.querySelector("[data-dirty]").textContent = editor.dirty ? "Unsaved changes" : "";
        if (def.gate) el.querySelector("[data-save]").disabled = !v[def.gate];
        if (def.unique && !r.syncing) { r.syncing = true; rows.forEach((o) => o !== r && o.editor.sync()); r.syncing = false; }
      };
      editor.load(values || {});
      const toggle = (open) => {
        body.inert = !open;
        body.classList.toggle("is-open", open);
        el.classList.toggle("is-open", open);
        el.querySelector(".item__head").setAttribute("aria-expanded", String(open));
      };
      const head = () => {
        const v = r.saved ? values || editor.values() : editor.raw();
        const sm = def.summary(v);
        el.querySelector("[data-title]").textContent = r.saved ? sm.title : `New: ${sm.title}`;
        el.querySelector("[data-sub]").textContent = r.saved ? sm.sub || "Saved" : "Not saved yet";
        el.querySelector("[data-state]").innerHTML = r.saved ? '<span class="tag tag--ok">Saved</span>' : '<span class="tag tag--warn">Draft</span>';
      };
      head();
      const remove = (toastText) => {
        editors.delete(editor);
        rows.delete(id);
        el.remove();
        refreshAll();
        if (toastText) UI.toast(toastText);
      };
      const emptyNew = () => !r.saved && def.gate && !editor.raw()[def.gate];
      el.querySelector(".item__head").addEventListener("click", () => {
        const open = !el.classList.contains("is-open");
        toggle(open);
        if (!open && def.dropEmptyNew && emptyNew()) remove("Empty entry removed");
      });
      if (isNew && def.dropEmptyNew) {
        const watch = new AbortController();
        const leave = (e) => {
          if (!el.isConnected || r.saved) return watch.abort();
          if (!el.contains(e.target) && emptyNew()) { watch.abort(); remove("Empty entry removed"); }
        };
        document.addEventListener("pointerdown", leave, { signal: watch.signal, capture: true });
        document.addEventListener("focusin", leave, { signal: watch.signal });
      }
      el.querySelector("[data-cancel]").addEventListener("click", () => {
        if (!r.saved) return remove();
        editor.load(values);
        toggle(false);
      });
      let armed;
      const del = el.querySelector("[data-delete]");
      del.addEventListener("click", () => {
        if (!r.saved) return remove();
        if (!armed) {
          del.querySelector("span").textContent = "Click again to delete";
          armed = setTimeout(() => { armed = null; del.querySelector("span").textContent = "Delete"; }, 3000);
          return;
        }
        clearTimeout(armed);
        const sm = def.summary(values);
        Store.commit({ module: def.module, title: `${def.title}: ${sm.title} removed`, changes: [{ label: def.title, from: sm.title, to: "" }] }, (st) => {
          st.rows[key] = (st.rows[key] || []).filter((x) => x.id !== id);
          Object.keys(st.docs).forEach((k) => { if (k.startsWith(`${key}.${id}.`)) delete st.docs[k]; });
        });
        remove("Deleted");
      });
      el.querySelector("form").addEventListener("submit", (e) => {
        e.preventDefault();
        if (fieldError.showAll(editor.problems(), editor.el)) return;
        const before = values || {};
        const changes = editor.changes(before);
        const v = editor.values();
        const sm = def.summary(v);
        Store.commit({ module: def.module, title: `${def.title}: ${sm.title} ${r.saved ? "updated" : "added"}`, changes, always: !r.saved }, (st) => {
          const list = st.rows[key] || (st.rows[key] = []);
          const i = list.findIndex((x) => x.id === id);
          if (i >= 0) list[i] = { id, values: v }; else list.push({ id, values: v });
          editor.applyDocs(st);
        });
        values = v;
        r.saved = true;
        editor.ctx.state = Store.get();
        editor.load(v);
        head();
        toggle(false);
        refreshAll();
        UI.toast(`${sm.title} saved`);
        if (opts.onSaved) opts.onSaved(card);
      });
      editor.el.addEventListener("input", () => !r.saved && head());
      editor.el.addEventListener("change", () => !r.saved && head());
      if (openIt) { toggle(true); const first = editor.el.querySelector("select, input:not([type=hidden])"); if (first) first.focus({ preventScroll: true }); }
      return r;
    }

    card.querySelector("[data-add]").addEventListener("click", () => {
      const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      addRow(id, null, true);
      refreshAll();
    });
    savedRows(Store.get()).forEach((row) => addRow(row.id, row.values, false));
    refreshAll();
    Store.subscribe(() => refreshAll());
    return { card };
  }

  // ---------------------------------------------------------------- helpers
  function imageSize(file) {
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => { ok({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(img.src); };
      img.onerror = () => ok(null);
      img.src = URL.createObjectURL(file);
    });
  }
  /** Small copy of an image, kept with the data so it can be shown on other pages. */
  function makeThumb(file) {
    return new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 240 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * k);
        c.height = Math.round(img.naturalHeight * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        ok(c.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = () => ok(null);
      img.src = URL.createObjectURL(file);
    });
  }

  /** Builds a module page: sections and lists in order; after saving one, the next one is brought into view. */
  function page(mount, moduleKey) {
    const mod = S.MODULES.find((m) => m.key === moduleKey);
    const cards = [];
    const next = (card) => {
      const i = cards.indexOf(card);
      const target = cards[i + 1];
      if (!target) return;
      target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      flash(target);
    };
    (mod.order || [...(mod.sections || []).map((k) => ["s", k]), ...(mod.lists || []).map((k) => ["l", k])]).forEach(([t, k]) => {
      const host = typeof mount === "function" ? mount(t, k) : mount;
      cards.push((t === "s" ? section(host, k, { onSaved: next }) : list(host, k, { onSaved: next })).card);
    });
    // deep link: page.html#sec-key opens that section for editing
    const target = location.hash && document.getElementById(location.hash.slice(1));
    if (target) {
      setTimeout(() => {
        target.scrollIntoView({ block: "start" });
        flash(target);
        const edit = target.querySelector("[data-edit]:not(.d-none)");
        if (edit) edit.click();
      }, 50);
    }
    return cards;
  }

  return { section, list, page, display, esc, DOC_STATUS, docTag };
})();
