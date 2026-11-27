/* OTR v3 definitions: modules, sections, fields, rules, completion, fee and verification items. Exposes window.Schema.
   One place describes every form, so every page behaves the same and the dashboard can work out completion
   without opening the pages. All fields are optional; rules only check the format of what is filled in. */
window.Schema = (() => {
  "use strict";
  const THIS_YEAR = new Date().getFullYear();
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const dmy = (iso) => (iso ? iso.split("-").reverse().join("-") : "");

  // ---------- rules: (value, values) -> message or null
  const R = {
    name: (v) => (/^[A-Za-z .'-]{2,100}$/.test(v) ? null : "Use letters, spaces and . ' - only."),
    certNo: (v) => (/^[A-Za-z0-9\-/ ]{4,30}$/.test(v) ? null : "Use 4-30 letters, digits, - or /."),
    past: (v) => (v <= todayIso() ? null : "The date cannot be in the future."),
    pin: (v) => (/^6\d{5}$/.test(v) ? null : "Enter a 6-digit Tamil Nadu PIN code starting with 6."),
    year: (v) => (Number(v) >= 1950 && Number(v) <= THIS_YEAR ? null : `Enter a year between 1950 and ${THIS_YEAR}.`),
    range: (a, b, msg) => (v) => (Number(v) >= a && Number(v) <= b ? null : msg),
    pattern: (re, msg) => (v) => (re.test(v) ? null : msg),
    after: (other, msg) => (v, vals) => (!vals[other] || v >= vals[other] ? null : msg)
  };

  const AUTHORITIES = ["Tahsildar", "Zonal Deputy Tahsildar", "RDO", "District Collector"];
  const COMMUNITIES = [
    { value: "OC", label: "OC" }, { value: "BC", label: "BC" }, { value: "BCM", label: "BCM" }, { value: "MBC_DNC", label: "MBC/DNC" },
    { value: "SC", label: "SC" }, { value: "SCA", label: "SCA" }, { value: "ST", label: "ST" }
  ];
  // Sample lists for the preview; the official lists will come from the server's lookup tables.
  const SUB_CASTES = {
    OC: ["Other"],
    BC: ["Agamudayar", "Kongu Vellalar", "Nadar, Shanar and Gramani", "Senaithalaivar", "Yadhava", "Other"],
    BCM: ["Ansar", "Dekkani Muslims", "Dudekula", "Labbais", "Mapilla", "Sheik", "Syed", "Other"],
    MBC_DNC: ["Ambalakarar", "Boyar", "Kallar", "Maravar", "Vanniakula Kshatriya", "Other"],
    SC: ["Adi Dravida", "Devendrakula Velalar", "Kuravan", "Paraiyan", "Other"],
    SCA: ["Adi Andhra", "Arunthathiyar", "Chakkiliyan", "Madari", "Madiga", "Pagadai", "Thoti"],
    ST: ["Irular", "Kattunayakan", "Kurumans", "Malayali", "Toda", "Other"]
  };
  const VERIFY_CHOICE = [
    { value: "esevai", label: "Verify with e-Sevai", icon: "bi-shield-check" },
    { value: "upload", label: "Upload manually", icon: "bi-cloud-arrow-up" }
  ];

  /** Certificate details, then verify them with e-Sevai or upload the certificate. `p` prefixes the field names. */
  function certificate(p, docLabel, { when = () => true, place = true, esevai = true, authority = "select" } = {}) {
    const fields = [
      { name: `${p}CertNo`, label: "Certificate number", type: "text", max: 30, rules: [R.certNo], when },
      { name: `${p}IssueDate`, label: "Issue date", type: "date", rules: [R.past], when }
    ];
    if (place) fields.push({ name: `${p}Place`, label: "Place of issue", type: "text", max: 100, placeholder: "e.g. Mylapore", when });
    fields.push(authority === "select"
      ? { name: `${p}IssuedBy`, label: "Issued by", type: "select", options: AUTHORITIES, when }
      : { name: `${p}IssuedBy`, label: "Issued by", type: "text", max: 150, placeholder: authority, when });
    if (esevai) {
      fields.push(
        { name: `${p}Verify`, label: "How do you want to verify it?", type: "seg", options: VERIFY_CHOICE, default: "esevai", span: 4, when },
        { name: `${p}Esevai`, label: docLabel, type: "esevai", check: `${p}CertNo`, resetOn: [`${p}CertNo`, `${p}IssueDate`, `${p}Place`, `${p}IssuedBy`], span: 4, when: (v, s) => when(v, s) && v[`${p}Verify`] === "esevai" },
        { name: `${p}File`, label: docLabel, type: "upload", kind: "pdf", span: 4, when: (v, s) => when(v, s) && v[`${p}Verify`] === "upload" }
      );
    } else {
      fields.push({ name: `${p}File`, label: docLabel, type: "upload", kind: "pdf", span: 4, when });
    }
    return fields;
  }
  /** A special category: "applies to me" switch, then its fields. */
  const on = (v) => Boolean(v.on);
  function category(key, title, desc, icon, fields) {
    return { key, module: "community", title, desc, icon, optional: true, toggle: true,
      fields: [{ name: "on", label: "This applies to me", type: "switch", span: 4 }, ...fields.map((f) => ({ ...f, when: f.when ? (v, s) => on(v) && f.when(v, s) : on }))] };
  }

  // ---------- sections (each is edited and saved on its own)
  const SECTIONS = {
    personal: {
      module: "profile", title: "Personal details", icon: "bi-person",
      desc: "Name, date of birth and gender come from Aadhaar.",
      fields: [
        { name: "aadhaarName", label: "Name as per Aadhaar", type: "readonly", tag: "From Aadhaar", value: (s) => s.ekyc.name },
        { name: "fullName", label: "Full name", type: "upper", max: 100, rules: [R.name], placeholder: "With initials expanded" },
        { name: "dob", label: "Date of birth", type: "readonly", tag: "From Aadhaar", value: (s) => dmy(s.ekyc.dob) },
        { name: "gender", label: "Gender", type: "readonly", tag: "From Aadhaar", value: (s) => s.ekyc.genderLabel },
        { name: "fatherName", label: "Father's name", type: "upper", max: 100, rules: [R.name] },
        { name: "motherName", label: "Mother's name", type: "upper", max: 100, rules: [R.name] },
        { name: "religion", label: "Religion", type: "select", options: ["Hindu", "Christian", "Muslim", "Sikh", "Buddhist", "Jain", "Other"] },
        { name: "maritalStatus", label: "Marital status", type: "select", options: [{ value: "UNM", label: "Unmarried" }, { value: "MAR", label: "Married" }, { value: "WID", label: "Widow" }, { value: "DIV", label: "Divorced" }] },
        { name: "nationality", label: "Nationality", type: "select", options: ["Indian"], default: "Indian" }
      ]
    },
    address: {
      module: "profile", title: "Address", icon: "bi-geo-alt",
      desc: "Permanent address, and where letters should reach you.",
      fields: [
        { type: "heading", label: "Permanent address" },
        { name: "permSameAadhaar", label: "Same as my Aadhaar address", type: "check", span: 4 },
        { name: "permLine1", label: "Door no. and street", type: "text", max: 200, span: 2 },
        { name: "permVillage", label: "Village / town", type: "text", max: 100 },
        { name: "permTaluk", label: "Taluk", type: "text", max: 100 },
        { name: "permDistrict", label: "District", type: "text", max: 100 },
        { name: "permPin", label: "PIN code", type: "digits", max: 6, rules: [R.pin] },
        { type: "heading", label: "Communication address" },
        { name: "commSamePerm", label: "Same as permanent address", type: "check", span: 4 },
        { name: "commLine1", label: "Door no. and street", type: "text", max: 200, span: 2 },
        { name: "commVillage", label: "Village / town", type: "text", max: 100 },
        { name: "commTaluk", label: "Taluk", type: "text", max: 100 },
        { name: "commDistrict", label: "District", type: "text", max: 100 },
        { name: "commPin", label: "PIN code", type: "digits", max: 6, rules: [R.pin] }
      ],
      /** "Same as" boxes copy and lock the address. */
      effects(v, api, s) {
        const parts = ["Line1", "Village", "Taluk", "District", "Pin"];
        const a = s.ekyc.address;
        const fromAadhaar = { Line1: a.line1, Village: a.village, Taluk: a.taluk, District: a.district, Pin: a.pin };
        parts.forEach((p) => {
          if (v.permSameAadhaar) api.set(`perm${p}`, fromAadhaar[p]);
          api.readonly(`perm${p}`, Boolean(v.permSameAadhaar));
        });
        const now = api.values();
        parts.forEach((p) => {
          if (v.commSamePerm) api.set(`comm${p}`, now[`perm${p}`]);
          api.readonly(`comm${p}`, Boolean(v.commSamePerm));
        });
      }
    },
    identity: {
      module: "profile", title: "Identification & income", icon: "bi-person-lines-fill",
      desc: "Two visible identification marks, and your family's annual income with its certificate.",
      fields: [
        { name: "idMark1", label: "Identification mark 1", type: "text", max: 150, span: 2, placeholder: "e.g. A mole on the right cheek" },
        { name: "idMark2", label: "Identification mark 2", type: "text", max: 150, span: 2, placeholder: "e.g. A scar on the left forearm" },
        { type: "heading", label: "Annual family income" },
        { name: "income", label: "Annual income (₹)", type: "digits", max: 10, placeholder: "e.g. 250000" },
        ...certificate("income", "Income certificate")
      ]
    },
    community: {
      module: "community", title: "Community", icon: "bi-people",
      desc: "Your community and sub-caste, with the community certificate.",
      fields: [
        { name: "community", label: "Community", type: "select", options: COMMUNITIES },
        { name: "subCaste", label: "Sub-caste", type: "select", optionsFrom: "community", options: (v) => SUB_CASTES[v.community] || [], emptyText: "Choose the community first" },
        { name: "subCasteOther", label: "Sub-caste name", type: "upper", max: 100, when: (v) => v.subCaste === "Other", placeholder: "As in the certificate" },
        { type: "heading", label: "Community certificate", when: (v) => Boolean(v.community) },
        ...certificate("comm", "Community certificate", { when: (v) => Boolean(v.community) })
      ]
    },
    nativity: {
      module: "community", title: "Nativity", icon: "bi-house-check",
      desc: "Nativity certificate issued by the Revenue Department of Tamil Nadu.",
      fields: certificate("nat", "Nativity certificate")
    },
    pstm: category("pstm", "Persons Studied in Tamil Medium (PSTM)", "You studied in Tamil medium up to the required qualification.", "bi-translate", [
      { name: "upto", label: "Studied in Tamil up to", type: "select", options: ["SSLC", "HSC", "Diploma", "UG Degree", "PG Degree"] },
      { name: "institution", label: "Institution", type: "text", max: 150 },
      ...certificate("pstm", "PSTM certificate", { esevai: false, place: false, authority: "Head of the institution" })
    ]),
    exsm: category("exsm", "Ex-serviceman", "You served in the Indian armed forces.", "bi-shield", [
      { name: "serviceNo", label: "Service number", type: "text", max: 30, rules: [R.certNo] },
      { name: "branch", label: "Branch", type: "select", options: ["Army", "Navy", "Air Force"] },
      { name: "from", label: "Date of enrolment", type: "date", rules: [R.past] },
      { name: "to", label: "Date of discharge", type: "date", rules: [R.past, R.after("from", "This date must be after the date of enrolment.")] },
      { name: "period", label: "Period of service", type: "period", from: "from", to: "to" },
      { name: "file", label: "Discharge certificate", type: "upload", kind: "pdf", span: 4 }
    ]),
    widow: category("widow", "Destitute widow", "For women applicants with a destitute widow certificate.", "bi-person-heart", [
      ...certificate("widow", "Destitute widow certificate")
    ]),
    pwbd: category("pwbd", "Person with Benchmark Disability (PwBD)", "A disability of 40% or more, certified by a medical board.", "bi-universal-access", [
      { name: "type", label: "Type of disability", type: "select", options: ["Locomotor disability", "Low vision", "Blindness", "Hearing impairment", "Speech and language disability", "Intellectual disability", "Multiple disabilities", "Other"] },
      { name: "percent", label: "Disability (%)", type: "digits", max: 3, placeholder: "40-100", rules: [R.range(40, 100, "Enter a value from 40 to 100.")] },
      { name: "udid", label: "UDID number", type: "text", max: 18, placeholder: "18 characters", rules: [R.pattern(/^[A-Za-z0-9]{18}$/, "The UDID number has 18 letters and digits.")] },
      ...certificate("pwbd", "Disability certificate", { esevai: false, place: false, authority: "e.g. District Medical Board" })
    ]),
    sports: category("sports", "Sports", "You represented your district, state or country in a sport.", "bi-trophy", [
      { name: "sport", label: "Sport / game", type: "text", max: 60 },
      { name: "level", label: "Level", type: "select", options: ["District", "State", "National", "International"] },
      { name: "result", label: "Achievement", type: "select", options: ["Participated", "First place", "Second place", "Third place"] },
      { name: "year", label: "Year", type: "digits", max: 4, rules: [R.year] },
      { name: "file", label: "Sports certificate", type: "upload", kind: "pdf", span: 4 }
    ]),
    ncc: category("ncc", "NCC", "You hold an NCC certificate.", "bi-award", [
      { name: "cert", label: "Certificate", type: "pills", options: ["A", "B", "C"] },
      { name: "year", label: "Year of passing", type: "digits", max: 4, rules: [R.year] },
      { name: "unit", label: "Unit / directorate", type: "text", max: 100, span: 2 },
      { name: "file", label: "NCC certificate", type: "upload", kind: "pdf", span: 4 }
    ]),
    photos: {
      module: "documents", title: "Photo, signature & thumb impression", icon: "bi-person-bounding-box",
      desc: "Clear scans on a plain light background. JPG, 20-500 KB each.",
      fields: [
        { name: "photo", label: "Photo", type: "upload", kind: "image", orientation: "portrait", hint: "Passport size, taller than wide", icon: "bi-person-bounding-box" },
        { name: "signature", label: "Signature", type: "upload", kind: "image", orientation: "landscape", hint: "Black or blue ink, wider than tall", icon: "bi-pen" },
        { name: "thumb", label: "Left thumb impression", type: "upload", kind: "image", hint: "Left thumb, clear ridges", icon: "bi-fingerprint" },
        { name: "consent", label: "I confirm that the photo, signature and left thumb impression are my own, recent and clear. I understand that images that are not mine, or are unclear, can lead to my application being rejected.", type: "check", span: 4, box: true }
      ],
      check: (v) => (v.consent ? [] : [["consent", "Tick the box to confirm the images are yours."]])
    }
  };
  Object.entries(SECTIONS).forEach(([key, s]) => (s.key = key));

  // ---------- lists (rows that are added, saved and deleted one by one)
  const ONCE_ONLY = ["SSLC", "HSC", "Diploma"];
  const LISTS = {
    education: {
      key: "education", module: "education", title: "Qualifications", icon: "bi-mortarboard", rowIcon: "bi-mortarboard",
      desc: "Add each qualification separately. SSLC, HSC and Diploma can be added only once.",
      addLabel: "Add qualification", empty: "No qualifications yet.",
      gate: "qual", gateHint: "Choose the qualification first. SSLC, HSC and Diploma can be added only once.",
      unique: { field: "qual", values: ONCE_ONLY }, dropEmptyNew: true,
      fields: [
        { name: "qual", label: "Qualification", type: "select", options: ["SSLC", "HSC", "Diploma", "UG Degree", "PG Degree", "Doctorate"] },
        { name: "board", label: "Board / university", type: "text", max: 200, span: 2 },
        { name: "certNo", label: "Certificate number", type: "text", max: 30, rules: [R.certNo] },
        { name: "institution", label: "Institution name", type: "text", max: 200, span: 2 },
        { name: "instPlace", label: "Institution place", type: "text", max: 100, span: 2, placeholder: "Town, district" },
        { name: "course", label: "Course name", type: "text", max: 60, span: 2, placeholder: "e.g. B.Sc.", when: (v) => !["SSLC", "HSC"].includes(v.qual) },
        { name: "branch", label: "Branch / subject", type: "text", max: 100, span: 2, placeholder: "e.g. Physics", when: (v) => !["SSLC", "HSC"].includes(v.qual) },
        { name: "yearFrom", label: "Year joined", type: "digits", max: 4, rules: [R.year] },
        { name: "yearPassed", label: "Year passed", type: "digits", max: 4, rules: [R.year, (v, all) => (all.yearFrom && Number(v) < Number(all.yearFrom) ? "The year passed must be after the year joined." : null)] },
        { name: "medium", label: "Medium of study", type: "pills", options: ["Tamil", "English", "Other"], span: 2 },
        { name: "resultType", label: "Result as", type: "seg", options: [{ value: "MARKS", label: "Marks" }, { value: "PERCENTAGE", label: "Percentage" }, { value: "CGPA", label: "CGPA" }], default: "MARKS", span: 2 },
        { name: "marksGot", label: "Marks obtained", type: "decimal", max: 6, when: (v) => v.resultType === "MARKS" },
        { name: "marksMax", label: "Maximum marks", type: "decimal", max: 6, when: (v) => v.resultType === "MARKS" },
        { name: "score", label: (v) => (v.resultType === "CGPA" ? "CGPA (out of 10)" : "Percentage"), type: "decimal", max: 5, when: (v) => v.resultType !== "MARKS",
          rules: [(v, all) => (all.resultType === "CGPA" ? (Number(v) <= 10 ? null : "CGPA cannot be more than 10.") : Number(v) <= 100 ? null : "Enter a percentage from 0 to 100.")] },
        { name: "file", label: "Certificate", type: "upload", kind: "pdf", span: 4 }
      ],
      check(v) {
        const list = [];
        if (v.resultType === "MARKS" && v.marksGot && v.marksMax && Number(v.marksGot) > Number(v.marksMax)) list.push(["marksGot", "Marks obtained cannot be more than the maximum."]);
        if (v.resultType === "MARKS" && Boolean(v.marksGot) !== Boolean(v.marksMax)) list.push([v.marksGot ? "marksMax" : "marksGot", "Enter both marks obtained and maximum marks."]);
        return list;
      },
      summary(v) {
        const result = v.resultType === "MARKS" && v.marksGot && v.marksMax ? `${((v.marksGot / v.marksMax) * 100).toFixed(1)}%` : v.resultType === "CGPA" && v.score ? `CGPA ${v.score}` : v.score ? `${v.score}%` : "";
        return { title: [v.qual || "Qualification", v.course].filter(Boolean).join(" · "), sub: [v.institution || v.board, v.yearPassed, result, v.medium && `${v.medium} medium`].filter(Boolean).join(" · ") };
      }
    },
    experience: {
      key: "experience", module: "profile", title: "Work experience", icon: "bi-briefcase", rowIcon: "bi-briefcase", optional: true,
      desc: "Each job with its dates and experience certificate or NOC.", addLabel: "Add experience", empty: "No work experience added.",
      fields: [
        { name: "type", label: "Employer type", type: "select", options: ["State Government", "Central Government", "State PSU", "Central PSU", "Local body", "Government aided", "Private", "On contract", "Outsourced", "Other"] },
        { name: "org", label: "Department / organisation", type: "text", max: 150 },
        { name: "post", label: "Designation", type: "text", max: 100 },
        { name: "empId", label: "Employee ID", type: "text", max: 30 },
        { name: "from", label: "From date", type: "date", rules: [R.past] },
        { name: "to", label: "To date", type: "date", rules: [R.past, R.after("from", "This date must be after the from date.")], when: (v) => !v.current },
        { name: "period", label: "Period", type: "period", from: "from", to: "to", current: "current" },
        { name: "years", label: "Years of experience", type: "years", from: "from", to: "to", current: "current" },
        { name: "current", label: "I currently work here", type: "check", span: 2 },
        { name: "file", label: "Experience certificate / NOC", type: "upload", kind: "pdf", span: 4 }
      ],
      summary: (v) => ({ title: [v.post, v.org].filter(Boolean).join(", ") || "Work experience", sub: [v.type, Schema.period(v.from, v.current ? todayIso() : v.to)].filter(Boolean).join(" · ") }),
      total(rows) {
        const m = rows.reduce((sum, r) => sum + Schema.months(r.values.from, r.values.current ? todayIso() : r.values.to), 0);
        return rows.length ? `Total experience: ${Schema.describeMonths(m)}` : "";
      }
    },
    otherDocs: {
      key: "otherDocs", module: "documents", title: "Other documents", icon: "bi-files", rowIcon: "bi-file-earmark-text", optional: true, max: 3,
      desc: "Up to 3 more PDF documents that support your application.", addLabel: "Add document", empty: "No other documents.",
      fields: [
        { name: "title", label: "Document name", type: "text", max: 100, span: 2, placeholder: "e.g. Conduct certificate" },
        { name: "file", label: "Document", type: "upload", kind: "pdf", span: 4 }
      ],
      summary: (v) => ({ title: v.title || "Document", sub: v.file || "No file yet" })
    }
  };

  // ---------- modules (left menu and pages)
  const MODULES = [
    { key: "dashboard", title: "Dashboard", page: "dashboard.html", icon: "bi-grid-1x2", group: "Overview" },
    { key: "profile", title: "Candidate profile", page: "profile.html", icon: "bi-person-vcard", group: "My profile", sections: ["personal", "address", "identity"], lists: ["experience"], desc: "Personal and contact details" },
    { key: "education", title: "Education", page: "education.html", icon: "bi-mortarboard", group: "My profile", lists: ["education"], desc: "Qualification and institution details" },
    { key: "community", title: "Community & reservation", page: "community.html", icon: "bi-people", group: "My profile", sections: ["community", "nativity", "pstm", "exsm", "widow", "pwbd", "sports", "ncc"], desc: "Community and reservation details" },
    { key: "documents", title: "Documents", page: "documents.html", icon: "bi-folder2-open", group: "My profile", sections: ["photos"], lists: ["otherDocs"], desc: "Upload and document management" },
    { key: "verification", title: "Verification", page: "verification.html", icon: "bi-shield-check", group: "Status", desc: "Validation and verification workflow" },
    { key: "history", title: "Profile history", page: "history.html", icon: "bi-clock-history", group: "Status", desc: "Versions and change tracking" },
    { key: "security", title: "Sign-in & security", page: "security.html", icon: "bi-key", group: "Account", desc: "Password and sign-in activity" }
  ];
  const PROFILE_MODULES = ["profile", "education", "community", "documents"];

  // ---------- helpers used by pages and the form engine
  const optionList = (opts, v) => (typeof opts === "function" ? opts(v) : opts || []).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const visible = (f, v, s) => !f.when || f.when(v, s);
  const COUNTED = ["text", "upper", "digits", "decimal", "date", "select", "pills", "upload", "esevai"];
  /** Values of a section as saved (defaults applied). */
  function valuesOf(s, key) {
    const def = SECTIONS[key];
    const saved = (s.sections && s.sections[key]) || {};
    const v = {};
    def.fields.forEach((f) => { if (f.name) v[f.name] = saved[f.name] !== undefined ? saved[f.name] : f.default !== undefined ? f.default : f.type === "check" || f.type === "switch" ? false : ""; });
    return v;
  }
  function count(fields, v, s) {
    let filled = 0, total = 0;
    fields.forEach((f) => {
      if (!COUNTED.includes(f.type) || !visible(f, v, s)) return;
      total++;
      if (v[f.name]) filled++;
    });
    return { filled, total };
  }
  /** Completion of one section: { filled, total, saved }. */
  function sectionProgress(s, key) {
    const def = SECTIONS[key];
    const v = valuesOf(s, key);
    const c = count(def.fields, v, s);
    return { ...c, saved: Boolean(s.sections && s.sections[key]) };
  }
  function listProgress(s, key) {
    const rows = (s.rows && s.rows[key]) || [];
    let filled = 0, total = 0;
    rows.forEach((r) => { const c = count(LISTS[key].fields, r.values, s); filled += c.filled; total += c.total; });
    return { filled, total, rows: rows.length };
  }
  /** Percentage per profile module, plus the overall figure. */
  function completion(s) {
    const out = {};
    PROFILE_MODULES.forEach((m) => {
      const mod = MODULES.find((x) => x.key === m);
      let filled = 0, total = 0;
      (mod.sections || []).forEach((k) => {
        if (SECTIONS[k].optional) return;
        const p = sectionProgress(s, k);
        filled += p.filled; total += p.total;
      });
      (mod.lists || []).forEach((k) => {
        if (LISTS[k].optional) return;
        const p = listProgress(s, k);
        // a required list with no rows counts as one empty item
        if (!p.rows) { total += 1; return; }
        filled += p.filled; total += p.total;
      });
      if (m === "profile") { filled += 3; total += 3; } // mobile, email, Aadhaar: verified at registration
      out[m] = { filled, total, pct: total ? Math.round((filled / total) * 100) : 0 };
    });
    const all = PROFILE_MODULES.reduce((a, m) => ({ filled: a.filled + out[m].filled, total: a.total + out[m].total }), { filled: 0, total: 0 });
    out.overall = { ...all, pct: all.total ? Math.round((all.filled / all.total) * 100) : 0 };
    return out;
  }
  /** Sections and lists not yet complete, in page order (for "next steps"). */
  function nextSteps(s) {
    const steps = [];
    PROFILE_MODULES.forEach((m) => {
      const mod = MODULES.find((x) => x.key === m);
      (mod.sections || []).forEach((k) => {
        if (SECTIONS[k].optional) return;
        const p = sectionProgress(s, k);
        if (p.filled < p.total) steps.push({ module: m, page: `${mod.page}#sec-${k}`, title: SECTIONS[k].title, icon: SECTIONS[k].icon, left: p.total - p.filled });
      });
      (mod.lists || []).forEach((k) => {
        if (LISTS[k].optional) return;
        const p = listProgress(s, k);
        if (!p.rows || p.filled < p.total) steps.push({ module: m, page: `${mod.page}#list-${k}`, title: LISTS[k].title, icon: LISTS[k].icon, left: p.rows ? p.total - p.filled : null });
      });
    });
    return steps;
  }

  /** Activation fee (same rules as the server). */
  function fee(s) {
    const c = valuesOf(s, "community");
    const gender = s.ekyc.gender;
    const marital = valuesOf(s, "personal").maritalStatus;
    const label = (COMMUNITIES.find((x) => x.value === c.community) || {}).label || "Not selected";
    const has = (k) => Boolean(valuesOf(s, k).on);
    if (["SC", "SCA", "ST"].includes(c.community)) return { rule: "Exempt: SC / SCA / ST", amount: 0, label };
    if (has("pwbd")) return { rule: "Exempt: PwBD", amount: 0, label };
    if (has("widow") && gender === "F" && marital === "WID") return { rule: "Exempt: destitute widow", amount: 0, label };
    if (has("exsm")) return { rule: "Exempt: ex-serviceman", amount: 0, label };
    if (gender === "F" || gender === "T") return { rule: "Concession: women / transgender", amount: 100, label };
    if (["BC", "BCM", "MBC_DNC"].includes(c.community)) return { rule: "Concession: BC / BCM / MBC-DNC", amount: 125, label };
    return { rule: "Standard fee", amount: 150, label };
  }

  /**
   * Certificates that can be verified with e-Sevai from the details entered, or uploaded manually.
   * status: VERIFIED (e-Sevai), UPLOADED (manual copy) or MISSING (neither yet). No officer review.
   */
  const CERT_SLOTS = [
    { section: "community", p: "comm", label: "Community certificate", page: "community.html#sec-community", applies: (s) => Boolean(valuesOf(s, "community").community) },
    { section: "nativity", p: "nat", label: "Nativity certificate", page: "community.html#sec-nativity", applies: () => true },
    { section: "identity", p: "income", label: "Income certificate", page: "profile.html#sec-identity", applies: () => true },
    { section: "widow", p: "widow", label: "Destitute widow certificate", page: "community.html#sec-widow", applies: (s) => Boolean(valuesOf(s, "widow").on) }
  ];
  function certStatus(s, slot) {
    const v = valuesOf(s, slot.section);
    const doc = s.docs[`${slot.section}.${slot.p}File`];
    if (v[`${slot.p}Verify`] === "esevai" && v[`${slot.p}Esevai`] === "VERIFIED") return { status: "VERIFIED", detail: v[`${slot.p}CertNo`], how: "Verified with e-Sevai" };
    if (v[`${slot.p}Verify`] === "upload" && doc) return { status: "UPLOADED", detail: doc.name, how: "Uploaded by you" };
    return { status: "MISSING", detail: v[`${slot.p}CertNo`] ? `Certificate no. ${v[`${slot.p}CertNo`]}` : "", how: "Not verified or uploaded yet" };
  }
  /** Status of the certificate in a section, or null when the section has none. */
  const sectionCert = (s, key) => {
    const slot = CERT_SLOTS.find((x) => x.section === key);
    return slot && slot.applies(s) ? certStatus(s, slot) : null;
  };
  function verificationItems(s) {
    const items = [
      { key: "mobile", group: "Identity", label: "Mobile number", detail: Store.mask(s.account.mobile), status: "VERIFIED", tag: "Verified (OTP)", how: "OTP at registration" },
      { key: "email", group: "Identity", label: "Email", detail: s.account.email, status: "VERIFIED", tag: "Verified (OTP)", how: "OTP at registration" },
      { key: "aadhaar", group: "Identity", label: "Aadhaar e-KYC", detail: `XXXX XXXX ${s.account.aadhaarLast4}`, status: "VERIFIED", tag: "Verified (UIDAI)", how: "UIDAI OTP" }
    ];
    const slotDocs = new Set();
    CERT_SLOTS.forEach((slot) => {
      if (!slot.applies(s)) return;
      slotDocs.add(`${slot.section}.${slot.p}File`);
      items.push({ key: slot.section, group: "Certificates", label: slot.label, page: slot.page, esevai: true, ...certStatus(s, slot) });
    });
    Object.entries(s.docs || {}).forEach(([key, d]) => {
      if (slotDocs.has(key)) return;
      const photo = ["photos.photo", "photos.signature", "photos.thumb"].includes(key);
      items.push({ key, group: photo ? "Photo & signature" : "Other documents", label: d.label, detail: d.name, status: "UPLOADED", how: "Uploaded by you", page: d.page });
    });
    return items;
  }

  const period = (from, to) => {
    if (!from || !to || to < from) return "";
    const f = new Date(from), t = new Date(to);
    let m = (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth());
    if (t.getDate() < f.getDate()) m--;
    if (m < 1) return "Less than a month";
    const y = Math.floor(m / 12), mo = m % 12;
    return [y && `${y} year${y === 1 ? "" : "s"}`, mo && `${mo} month${mo === 1 ? "" : "s"}`].filter(Boolean).join(" ");
  };
  const describeMonths = (m) => {
    if (m < 1) return "less than a month";
    const y = Math.floor(m / 12), mo = m % 12;
    return [y && `${y} year${y === 1 ? "" : "s"}`, mo && `${mo} month${mo === 1 ? "" : "s"}`].filter(Boolean).join(" ");
  };
  const months = (from, to) => {
    if (!from || !to || to < from) return 0;
    const f = new Date(from), t = new Date(to);
    let m = (t.getFullYear() - f.getFullYear()) * 12 + (t.getMonth() - f.getMonth());
    if (t.getDate() < f.getDate()) m--;
    return Math.max(0, m);
  };

  return { SECTIONS, LISTS, MODULES, PROFILE_MODULES, R, optionList, visible, valuesOf, sectionProgress, listProgress, completion, nextSteps, fee, verificationItems, sectionCert, CERT_SLOTS, period, months, describeMonths, dmy, todayIso };
})();
