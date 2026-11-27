/* Community & reservation: community (with sub-caste) and nativity certificates, then the special categories. */
(() => {
  "use strict";
  if (!window.Shell) return; // not signed in: on the way to the sign-in page
  const pagePct = () => {
    const p = Schema.completion(Store.get()).community;
    UI.$("pagePct").innerHTML = `<strong>${p.pct}%</strong><span>of this module<br />complete</span>`;
  };
  Store.subscribe(pagePct);
  pagePct();
  const special = ["pstm", "exsm", "widow", "pwbd", "sports", "ncc"];
  Form.page((type, key) => UI.$(special.includes(key) ? "special" : "cards"), "community");
})();
