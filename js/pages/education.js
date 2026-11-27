/* Education: qualifications with institution details, each added and saved on its own. */
(() => {
  "use strict";
  if (!window.Shell) return; // not signed in: on the way to the sign-in page
  const pagePct = () => {
    const p = Schema.completion(Store.get()).education;
    UI.$("pagePct").innerHTML = `<strong>${p.pct}%</strong><span>of this module<br />complete</span>`;
  };
  Store.subscribe(pagePct);
  pagePct();
  Form.page(UI.$("cards"), "education");
})();
