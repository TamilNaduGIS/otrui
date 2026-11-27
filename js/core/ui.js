/* OTR v2 shared UI helpers, used by every page. Exposes window.UI.
   - alertBox: message above a form
   - fieldError: message directly below a field (red border, aria-invalid, aria-describedby)
   - fieldError messages disappear as soon as the field is corrected */
window.UI = (() => {
  "use strict";
  const $ = (id) => document.getElementById(id);

  const ICONS = { error: "bi-exclamation-circle-fill", success: "bi-check-circle-fill", info: "bi-info-circle-fill" };
  /** Shows text in the alert element `id` (type: error | success | info). Empty text hides it. */
  function alertBox(id, text, type = "info") {
    const box = $(id);
    const base = box.dataset.baseClass ?? (box.dataset.baseClass = box.className.replace(/\b(d-none|alert(--\w+)?)\b/g, "").trim());
    if (!text) {
      box.className = `${base} d-none`;
      box.textContent = "";
      return;
    }
    box.className = `${base} alert alert--${type}`;
    box.innerHTML = `<i class="bi ${ICONS[type]}" aria-hidden="true"></i><span></span>`;
    box.querySelector("span").textContent = text;
  }

  // A message goes below the field's wrapper, and below its hint when it has one.
  const WRAPPERS = ".input-wrap, .input-group, .captcha, .choice-group, .consent, .otp-row, .upload, .pills, .seg";
  const fieldError = {
    show(el, text) {
      if (typeof el === "string") el = $(el);
      if (!el) return;
      fieldError.clear(el);
      let anchor = el;
      for (let n = el.parentElement; n && !n.classList.contains("field"); n = n.parentElement) if (n.matches(WRAPPERS)) anchor = n;
      if (anchor.nextElementSibling && anchor.nextElementSibling.classList.contains("field__hint")) anchor = anchor.nextElementSibling;
      const msg = document.createElement("div");
      msg.className = "field-error";
      msg.id = `${el.id}Error`;
      msg.textContent = text;
      anchor.after(msg);
      el.classList.add("is-invalid");
      el.setAttribute("aria-invalid", "true");
      el.dataset.describedby = el.getAttribute("aria-describedby") || "";
      el.setAttribute("aria-describedby", `${el.dataset.describedby} ${msg.id}`.trim());
    },
    clear(el) {
      if (!el || !el.classList || !el.classList.contains("is-invalid")) return;
      el.classList.remove("is-invalid");
      el.removeAttribute("aria-invalid");
      const before = el.dataset.describedby;
      if (before) el.setAttribute("aria-describedby", before);
      else el.removeAttribute("aria-describedby");
      const msg = $(`${el.id}Error`);
      if (msg) msg.remove();
    },
    clearAll(scope = document) {
      scope.querySelectorAll(".is-invalid").forEach(fieldError.clear);
    },
    /** list: [[element or id, text], ...]. Shows them all, focuses the first. Returns true when there was something to show. */
    showAll(list, scope = document) {
      fieldError.clearAll(scope);
      list.forEach(([el, text]) => fieldError.show(el, text));
      if (!list.length) return false;
      const first = typeof list[0][0] === "string" ? $(list[0][0]) : list[0][0];
      const target = first.matches("input, select, textarea, button") ? first : first.querySelector("input:not([disabled]), select, button");
      first.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target) target.focus({ preventScroll: true });
      return true;
    }
  };
  // Correcting a field removes its message (also for radio groups and checkboxes inside a marked wrapper).
  ["input", "change"].forEach((type) =>
    document.addEventListener(type, (e) => {
      for (let n = e.target; n && n.classList; n = n.parentElement) fieldError.clear(n);
    }, true)
  );

  /** Show / hide password button: <button data-toggle-password="inputId">. */
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toggle-password]");
    if (!btn) return;
    const input = $(btn.dataset.togglePassword);
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.setAttribute("aria-pressed", String(show));
    btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    btn.querySelector(".bi").className = `bi ${show ? "bi-eye-slash" : "bi-eye"}`;
  });

  /** Keeps only digits, up to `max`. */
  const digitsOnly = (input, max) => input.addEventListener("input", () => { input.value = input.value.replace(/\D/g, "").slice(0, max); });

  /** Disables `btn` and counts down; afterwards it reads `doneLabel` again. Returns a function that stops the countdown. */
  function resendTimer(btn, seconds = 30, doneLabel = "Resend OTP") {
    let left = seconds;
    btn.disabled = true;
    btn.textContent = `Resend in ${left}s`;
    const id = setInterval(() => {
      if (--left > 0) return void (btn.textContent = `Resend in ${left}s`);
      clearInterval(id);
      btn.disabled = false;
      btn.textContent = doneLabel;
    }, 1000);
    return () => clearInterval(id);
  }

  // Password rules (same as the server): 8-64 characters with upper case, lower case, number and special character.
  const PASSWORD_RULES = {
    len: (p) => p.length >= 8 && p.length <= 64,
    upper: (p) => /[A-Z]/.test(p),
    lower: (p) => /[a-z]/.test(p),
    digit: (p) => /\d/.test(p),
    special: (p) => /[^A-Za-z0-9]/.test(p)
  };
  const passwordOk = (p) => Object.values(PASSWORD_RULES).every((rule) => rule(p));
  /** Ticks the <li data-rule="..."> items in `list` while the password is typed. */
  function watchPasswordRules(input, list) {
    input.addEventListener("input", () =>
      list.querySelectorAll("[data-rule]").forEach((li) => li.classList.toggle("is-ok", PASSWORD_RULES[li.dataset.rule](input.value)))
    );
  }

  /** Short message at the bottom of the screen. */
  let toastTimer;
  function toast(text) {
    let t = $("toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "toast";
      t.className = "toast";
      t.setAttribute("role", "status");
      t.setAttribute("aria-live", "polite");
      document.body.append(t);
    }
    t.innerHTML = '<i class="bi bi-check-circle-fill" aria-hidden="true"></i><span></span>';
    t.querySelector("span").textContent = text;
    t.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-shown"), 2600);
  }

  return { $, alertBox, fieldError, digitsOnly, resendTimer, passwordOk, watchPasswordRules, toast };
})();
