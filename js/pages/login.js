/* OTR v2 login page: UI behaviour only (no server calls yet).
   - switch between Password and OTP sign-in (keyboard: arrow keys on the tabs)
   - field checks with the message directly below the field
   Server integration comes in a later step. */
(() => {
  "use strict";
  const { $, alertBox, fieldError, digitsOnly } = UI;
  const show = (text, type) => alertBox("loginAlert", text, type);
  const tabs = [$("tabPassword"), $("tabOtp")];
  const panels = { tabPassword: $("panelPassword"), tabOtp: $("panelOtp") };
  let otpMode = false;

  // ---------- Password / OTP switch
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      panels[t.id].classList.toggle("d-none", !on);
    });
    otpMode = tab.id === "tabOtp";
    if (focus) tab.focus();
    show("");
    fieldError.clearAll();
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(t, false));
    t.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true);
    });
  });

  // ---------- security code (placeholder image until the server is connected)
  $("refreshCaptcha").addEventListener("click", () => {
    $("captchaInput").value = "";
    $("captchaInput").focus();
  });

  // ---------- OTP (UI preview)
  $("btnSendOtp").addEventListener("click", () => {
    fieldError.clearAll();
    const id = $("loginIdentifier");
    if (id.value.trim().length < 3) return fieldError.showAll([[id, "Enter your registered ID first."]]);
    const to = $("otpChannel").value === "EMAIL" ? "registered email" : "registered mobile number";
    show(`Preview only: an OTP would now be sent to your ${to}.`, "info");
    $("otpStatus").textContent = "Did not get it? Check the mobile number or email, then send again.";
    $("loginOtp").focus();
  });
  digitsOnly($("loginOtp"), 6);

  // already signed in: straight to the dashboard
  if (Store.session.get()) location.replace("dashboard.html");
  if (new URLSearchParams(location.search).has("next")) show("Please sign in to continue.", "info");

  // ---------- submit
  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    show("");
    const problems = [];
    if ($("loginIdentifier").value.trim().length < 3) problems.push(["loginIdentifier", "Enter your mobile number, email, username or file reference number."]);
    if (otpMode) {
      if (!/^\d{6}$/.test($("loginOtp").value)) problems.push(["loginOtp", "Enter the 6-digit OTP."]);
    } else {
      if (!$("loginPassword").value) problems.push(["loginPassword", "Enter your password."]);
      if (!$("captchaInput").value.trim()) problems.push(["captchaInput", "Enter the security code shown in the image."]);
    }
    if (fieldError.showAll(problems)) return;
    // Preview: any registered ID with any password and code signs in.
    Store.session.start($("loginIdentifier").value.trim());
    const next = new URLSearchParams(location.search).get("next");
    location.href = next && /^[a-z-]+\.html(#[\w-]*)?$/.test(next) ? next : "dashboard.html";
  });
})();
