/* OTR v2 forgot password: UI behaviour only (no server calls yet).
   1. registered ID + where to send the OTP   2. OTP + new password   3. done
   The OTP message never says whether the ID exists (the server answers the same way for any ID).
   In this preview any 6-digit OTP is accepted. */
(() => {
  "use strict";
  const { $, alertBox, fieldError, digitsOnly, resendTimer, passwordOk, watchPasswordRules } = UI;
  const show = (text, type) => alertBox("fpAlert", text, type);
  const form = $("fpForm");
  const stages = [...form.querySelectorAll(".fp-stage")];
  const TEXT = {
    request: ["Reset your password", "Enter your registered ID. We will send you an OTP to set a new password."],
    reset: ["Set a new password", "Enter the OTP and choose a new password."],
    done: ["Password changed", "Your password has been changed. Sign in with your new password."]
  };
  let stage = "request";
  let stopTimer = null;

  const channel = () => form.querySelector('input[name="channel"]:checked').value;

  function go(next) {
    stage = next;
    stages.forEach((s) => s.classList.toggle("d-none", s.dataset.stage !== next));
    $("fpTitle").textContent = TEXT[next][0];
    $("fpSubtitle").textContent = TEXT[next][1];
    const icon = form.querySelector(".fp-card__icon");
    icon.classList.toggle("is-done", next === "done");
    icon.querySelector(".bi").className = `bi ${next === "done" ? "bi-check-lg" : "bi-key"}`;
    $("backLink").classList.toggle("d-none", next === "done");
    fieldError.clearAll();
    $("fpTitle").focus({ preventScroll: true });
  }

  function startResendTimer() {
    if (stopTimer) stopTimer();
    stopTimer = resendTimer($("btnResend"));
  }

  function sendOtp() {
    const id = $("identifier").value.trim();
    if (id.length < 3) return fieldError.showAll([["identifier", "Enter your mobile number, email, username or file reference number."]]);
    const where = channel() === "EMAIL" ? "registered email" : "registered mobile number";
    $("sentTo").textContent = `If ${id} is registered, an OTP has been sent to its ${where}.`;
    show("");
    go("reset");
    $("otp").value = "";
    startResendTimer();
  }

  function resetPassword() {
    const list = [];
    if (!/^\d{6}$/.test($("otp").value)) list.push(["otp", "Enter the 6-digit OTP."]);
    const p = $("newPassword").value;
    if (!p) list.push(["newPassword", "Create a new password."]);
    else if (!passwordOk(p)) list.push(["newPassword", "The password must meet all the rules below."]);
    if (!$("confirmPassword").value) list.push(["confirmPassword", "Re-enter the new password."]);
    else if ($("confirmPassword").value !== p) list.push(["confirmPassword", "The passwords do not match."]);
    if (fieldError.showAll(list)) return;
    if (stopTimer) stopTimer();
    show("");
    go("done");
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (stage === "request") sendOtp();
    else if (stage === "reset") resetPassword();
  });

  $("btnResend").addEventListener("click", () => {
    startResendTimer();
    show("A new OTP has been sent. Use the latest one.", "info");
    $("otp").focus();
  });

  $("btnChangeId").addEventListener("click", () => {
    if (stopTimer) stopTimer();
    show("");
    go("request");
    $("identifier").focus();
  });

  digitsOnly($("otp"), 6);
  watchPasswordRules($("newPassword"), $("pwdRules"));
})();
