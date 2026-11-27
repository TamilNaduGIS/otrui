/* OTR v2 registration: UI behaviour only (no server calls yet).
   Step 1 mobile + email OTP, step 2 Aadhaar OTP + consent, step 3 username + password.
   In this preview any 6-digit OTP is accepted and the Aadhaar details are sample data. */
(() => {
  "use strict";
  const { $, alertBox, fieldError, digitsOnly, resendTimer, passwordOk, watchPasswordRules } = UI;
  const show = (text, type) => alertBox("formAlert", text, type);
  const form = $("regForm");
  const sections = [...form.querySelectorAll(".step")];
  const stepItems = [...document.querySelectorAll(".steps__item")];
  const LAST = stepItems.length - 1; // index of the account step; the next section is the "done" screen
  const RESEND_SEC = 30;

  const FIELDS = {
    mobile: { name: "mobile number", test: /^[6-9]\d{9}$/, bad: "Enter a valid 10-digit mobile number.", mask: (v) => `+91 ${v.slice(0, 2)}XXXXXX${v.slice(-2)}` },
    email: { name: "email", test: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, bad: "Enter a valid email address.", mask: (v) => v.replace(/^(.).*(@.*)$/, "$1****$2") },
    aadhaar: { name: "Aadhaar number", test: /^[2-9]\d{11}$/, bad: "Enter a valid 12-digit Aadhaar number.", mask: () => "your Aadhaar-linked mobile" }
  };
  const verified = { mobile: false, email: false, aadhaar: false };
  const stopTimer = {}; // per field: stops its resend countdown
  let current = 0;

  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const val = (id) => $(id).value.trim();
  const sendBtn = (f) => form.querySelector(`[data-send="${f}"]`);
  const otpRow = (f) => form.querySelector(`[data-otp-row="${f}"]`);
  const otpInput = (f) => $(`otp${cap(f)}`);
  function status(f, text, ok) {
    const el = form.querySelector(`[data-status="${f}"]`);
    el.textContent = text;
    el.classList.toggle("is-ok", Boolean(ok));
  }

  // ---------- steps
  function go(step, initial = false) {
    current = step;
    sections.forEach((s) => s.classList.toggle("d-none", Number(s.dataset.step) !== step));
    stepItems.forEach((li, i) => {
      li.classList.toggle("is-current", i === step);
      li.classList.toggle("is-done", i < step);
      const btn = li.querySelector("button");
      btn.disabled = i >= step;
      if (i === step) btn.setAttribute("aria-current", "step"); else btn.removeAttribute("aria-current");
    });
    const finished = step > LAST;
    document.querySelector(".reg").classList.toggle("is-finished", finished);
    $("stepCount").textContent = finished ? "Registration complete" : `Step ${step + 1} of ${LAST + 1}`;
    $("stepTitle").textContent = sections[step].dataset.title;
    $("btnBack").classList.toggle("d-none", step === 0);
    $("btnNext").innerHTML = step === LAST ? "Create account" : 'Continue<i class="bi bi-arrow-right" aria-hidden="true"></i>';
    show("");
    fieldError.clearAll();
    if (initial) return;
    $("stepTitle").focus({ preventScroll: true });
    document.querySelector(".reg").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  stepItems.forEach((li, i) => li.querySelector("button").addEventListener("click", () => go(i)));
  $("btnBack").addEventListener("click", () => go(current - 1));

  // ---------- verify with OTP
  function resetSendButton(f, label = "Send OTP") {
    if (stopTimer[f]) stopTimer[f]();
    const btn = sendBtn(f);
    btn.disabled = false;
    btn.textContent = label;
  }
  function countdown(f) {
    if (stopTimer[f]) stopTimer[f]();
    stopTimer[f] = resendTimer(sendBtn(f), RESEND_SEC);
  }
  function sendOtp(f) {
    if (verified[f]) return change(f);
    const v = val(f);
    if (!FIELDS[f].test.test(v)) return fieldError.showAll([[f, v ? FIELDS[f].bad : `Enter your ${FIELDS[f].name}.`]]);
    fieldError.clear($(f));
    otpRow(f).classList.remove("d-none");
    otpInput(f).value = "";
    status(f, `OTP sent to ${FIELDS[f].mask(v)}. Preview: any 6 digits work.`);
    countdown(f);
    otpInput(f).focus();
  }
  function checkOtp(f) {
    const input = otpInput(f);
    if (!/^\d{6}$/.test(input.value)) return fieldError.showAll([[input, "Enter the 6-digit OTP."]]);
    verified[f] = true;
    if (stopTimer[f]) stopTimer[f]();
    otpRow(f).classList.add("d-none");
    $(f).readOnly = true;
    $(f).closest(".field").classList.add("is-verified");
    fieldError.clear($(f));
    resetSendButton(f, "Change");
    status(f, `${cap(FIELDS[f].name)} verified`, true);
    if (f === "aadhaar") showKyc();
  }
  function change(f) {
    verified[f] = false;
    $(f).readOnly = false;
    $(f).closest(".field").classList.remove("is-verified");
    resetSendButton(f);
    status(f, "");
    if (f === "aadhaar") {
      $("kyc").classList.add("d-none");
      $("consentBox").classList.add("d-none");
      $("consent").checked = false;
    }
    $(f).focus();
  }
  /** e-KYC details read from the UIDAI response (the preview uses a sample response with the same structure). */
  let kyc = null;
  function showKyc() {
    kyc = Ekyc.parse(Ekyc.SAMPLE_RESPONSE);
    $("kycName").textContent = kyc.name;
    $("kycDob").textContent = kyc.dob.split("-").reverse().join("-");
    $("kycGender").textContent = kyc.genderLabel;
    // C/O names the father only for S/O and D/O; otherwise show it as "Care of".
    $("kycCareLabel").textContent = kyc.fatherName ? "Father's name" : "Care of";
    $("kycFather").textContent = kyc.fatherName || kyc.careOf || "Not given";
    $("kycDistrict").textContent = kyc.address.district || "Not given";
    $("kycAddress").textContent = Ekyc.formatAddress(kyc.address);
    $("kyc").classList.remove("d-none");
    $("consentBox").classList.remove("d-none");
  }
  Object.keys(FIELDS).forEach((f) => {
    sendBtn(f).addEventListener("click", () => sendOtp(f));
    form.querySelector(`[data-check="${f}"]`).addEventListener("click", () => checkOtp(f));
    digitsOnly(otpInput(f), 6);
    otpInput(f).addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); checkOtp(f); }
    });
    // An OTP belongs to the value it was sent for: editing the value cancels it.
    $(f).addEventListener("input", () => {
      if (verified[f] || otpRow(f).classList.contains("d-none")) return;
      otpRow(f).classList.add("d-none");
      resetSendButton(f);
      status(f, "Changed. Send a new OTP.");
    });
  });
  digitsOnly($("mobile"), 10);
  digitsOnly($("aadhaar"), 12);

  // ---------- account
  $("username").addEventListener("input", (e) => { e.target.value = e.target.value.toLowerCase().replace(/\s/g, ""); });
  watchPasswordRules($("password"), $("pwdRules"));
  $("refreshCaptcha").addEventListener("click", () => { $("captchaInput").value = ""; $("captchaInput").focus(); });
  document.querySelectorAll("[data-copy]").forEach((btn) => btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($(btn.dataset.copy).textContent);
      btn.innerHTML = '<i class="bi bi-check2" aria-hidden="true"></i><span>Copied</span>';
    } catch {
      btn.querySelector("span").textContent = "Select and copy the number";
    }
  }));
  /** RF + year of birth + gender + serial, shown part by part. */
  function showRef(ref) {
    $("fileRef").textContent = ref;
    const m = /^RF(\d{4})([MFT])(\d{5})$/.exec(ref);
    $("refParts").innerHTML = m ? [["RF", "Reference"], [m[1], "Year of birth"], [m[2], { M: "Male", F: "Female", T: "Transgender" }[m[2]]], [m[3], "Serial"]]
      .map(([v, l]) => `<span class="ref-part"><strong>${v}</strong><small>${l}</small></span>`).join("") : "";
  }

  // ---------- checks per step
  function needVerified(f, list) {
    const v = val(f);
    if (verified[f]) return;
    if (!v) list.push([f, `Enter your ${FIELDS[f].name}.`]);
    else if (!FIELDS[f].test.test(v)) list.push([f, FIELDS[f].bad]);
    else list.push([f, `Verify your ${FIELDS[f].name} with an OTP.`]);
  }
  const CHECKS = [
    (list) => { needVerified("mobile", list); needVerified("email", list); },
    (list) => {
      needVerified("aadhaar", list);
      if (verified.aadhaar && !$("consent").checked) list.push(["consent", "Tick the box to give your consent."]);
    },
    (list) => {
      const u = val("username");
      if (!u) list.push(["username", "Choose a username."]);
      else if (!/^[a-z0-9]{6,20}$/.test(u)) list.push(["username", "Use 6-20 lower-case letters or numbers."]);
      const p = $("password").value;
      if (!p) list.push(["password", "Create a password."]);
      else if (!passwordOk(p)) list.push(["password", "The password must meet all the rules below."]);
      if (!$("confirmPassword").value) list.push(["confirmPassword", "Re-enter the password."]);
      else if ($("confirmPassword").value !== p) list.push(["confirmPassword", "The passwords do not match."]);
      if (!val("captchaInput")) list.push(["captchaInput", "Enter the security code shown in the image."]);
    }
  ];

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const list = [];
    CHECKS[current](list);
    if (fieldError.showAll(list, sections[current])) return;
    if (current === LAST) {
      // In the live system the server issues both numbers when it creates the account.
      const account = Store.register({ username: val("username"), mobile: val("mobile"), email: val("email"), aadhaar: val("aadhaar"), ekyc: kyc });
      Store.session.start(val("username"));
      $("otrNo").textContent = account.otrNo;
      showRef(account.fileRef);
    }
    go(current + 1);
  });

  go(0, true);
})();
