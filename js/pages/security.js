/* Sign-in & security: change password, account details, devices where the applicant is signed in. */
(() => {
  "use strict";
  if (!window.Shell) return; // not signed in: on the way to the sign-in page
  const { $, alertBox, fieldError, passwordOk, watchPasswordRules, toast } = UI;
  const esc = Form.esc;
  const date = (iso) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  function renderAccount() {
    const s = Store.get();
    const a = s.account;
    $("accInfo").innerHTML = `<dl class="kv kv--2">
      <div class="kv__item"><dt>Username</dt><dd>${esc(a.username)}</dd></div>
      <div class="kv__item"><dt>File reference number</dt><dd>${esc(a.fileRef)}</dd></div>
      <div class="kv__item"><dt>Account created</dt><dd>${date(a.createdAt)}</dd></div>
      <div class="kv__item"><dt>Password last changed</dt><dd>${date(a.passwordChangedAt)}</dd></div></dl>`;
  }

  // sample devices for the preview
  let others = [{ device: "Chrome on Android", place: "Chennai, Tamil Nadu", at: Date.now() - 3 * 864e5 }];
  function renderSessions() {
    const here = Store.session.get();
    $("sessions").innerHTML = `<div class="sess"><span class="sess__icon" aria-hidden="true"><i class="bi bi-laptop"></i></span>
        <div class="sess__text">This device <small>Signed in ${here ? date(here.at) : "now"}</small></div><span class="tag tag--ok">Current</span></div>` +
      others.map((o) => `<div class="sess"><span class="sess__icon" aria-hidden="true"><i class="bi bi-phone"></i></span>
        <div class="sess__text">${esc(o.device)}<small>${esc(o.place)} · last active ${date(o.at)}</small></div></div>`).join("");
    $("btnSignOutOthers").disabled = !others.length;
  }
  $("btnSignOutOthers").addEventListener("click", () => {
    others = [];
    Store.commit({ module: "account", title: "Signed out of other devices", always: true }, () => {});
    renderSessions();
    toast("Signed out of other devices");
  });

  watchPasswordRules($("newPassword"), $("pwdRules"));
  $("pwdForm").addEventListener("submit", (e) => {
    e.preventDefault();
    alertBox("pwdAlert", "");
    const cur = $("curPassword").value, next = $("newPassword").value, conf = $("confirmPassword").value;
    const list = [];
    if (!cur) list.push(["curPassword", "Enter your current password."]);
    if (!next) list.push(["newPassword", "Create a new password."]);
    else if (!passwordOk(next)) list.push(["newPassword", "The password must meet all the rules below."]);
    else if (next === cur) list.push(["newPassword", "Choose a password different from the current one."]);
    if (!conf) list.push(["confirmPassword", "Re-enter the new password."]);
    else if (conf !== next) list.push(["confirmPassword", "The passwords do not match."]);
    if (fieldError.showAll(list)) return;
    Store.commit({ module: "account", title: "Password changed", always: true }, (st) => { st.account.passwordChangedAt = new Date().toISOString(); });
    e.target.reset();
    document.querySelectorAll("#pwdRules .is-ok").forEach((li) => li.classList.remove("is-ok"));
    alertBox("pwdAlert", "Your password has been changed. Use it the next time you sign in.", "success");
  });

  Store.subscribe(renderAccount);
  renderAccount();
  renderSessions();
})();
