/* OTR v3 Aadhaar e-KYC response reader. Exposes window.Ekyc.
   The UIDAI KYC response carries <UidData uid=".."><Poi dob gender name/><Poa co dist house lm pc state street subdist vtc/>.
   parse() reads those attributes (it also works on a response that is cut short or wrapped in other XML) and returns
   what the OTR uses: name, date of birth, gender, father's name (from "co" when it is S/O or D/O), district and address.
   SAMPLE_RESPONSE has the real structure with made-up values; the preview never holds a real person's data. */
window.Ekyc = (() => {
  "use strict";
  const SAMPLE_RESPONSE =
    '<KycRes ret="Y"><Rar>...</Rar><UidData tkn="SAMPLE-TOKEN" uid="XXXXXXXX0123">' +
    '<Poi dob="14-05-2001" gender="M" name="SAMPLE APPLICANT" />' +
    '<Poa co="S/O Sample Father" country="India" dist="Chennai" house="No 12" lm="Near Kapaleeshwarar Temple" pc="600004" state="Tamil Nadu" street="Gandhi Street" subdist="Mylapore" vtc="Mylapore" />' +
    "<LData /><Pht>...</Pht></UidData></KycRes>";

  const ENTITIES = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
  const decode = (v) => v.replace(/&(amp|quot|apos|lt|gt);/g, (m) => ENTITIES[m]);
  /** Attributes of the first <tag ...> in the text. */
  function attrs(xml, tag) {
    const m = new RegExp(`<${tag}\\b([^>]*?)\\/?>`).exec(xml);
    const out = {};
    if (m) m[1].replace(/([\w:-]+)\s*=\s*"([^"]*)"/g, (_, k, v) => { out[k] = decode(v).trim(); });
    return out;
  }
  /** "25-05-1988" (or "1988-05-25", or a year alone) -> "1988-05-25". */
  function isoDate(d) {
    if (/^\d{2}-\d{2}-\d{4}$/.test(d)) return d.split("-").reverse().join("-");
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    if (/^\d{4}$/.test(d)) return `${d}-01-01`;
    return "";
  }
  const GENDER = { M: "Male", F: "Female", T: "Transgender" };
  // co="S/O Vedappan" -> relation S/O, name Vedappan. Only S/O and D/O give the father's name.
  const CARE_OF = /^\s*(S\/O|D\/O|W\/O|H\/O|C\/O)\s*[:.\-]?\s*/i;

  function parse(xml) {
    const poi = attrs(xml, "Poi");
    const poa = attrs(xml, "Poa");
    const uid = attrs(xml, "UidData");
    if (!poi.name) throw new Error("The e-KYC response has no identity details.");
    const g = (poi.gender || "").toUpperCase().charAt(0);
    const co = poa.co || "";
    const rel = CARE_OF.exec(co);
    const relation = rel ? rel[1].toUpperCase() : "";
    const careOfName = co.replace(CARE_OF, "").trim();
    return {
      name: poi.name,
      dob: isoDate(poi.dob || ""),
      gender: GENDER[g] ? g : "",
      genderLabel: GENDER[g] || "",
      careOf: co,
      relation,
      fatherName: relation === "S/O" || relation === "D/O" ? careOfName : "",
      uidLast4: (uid.uid || "").slice(-4),
      address: {
        house: poa.house || "", street: poa.street || "", landmark: poa.lm || "", vtc: poa.vtc || poa.po || "",
        taluk: poa.subdist || "", district: poa.dist || "", state: poa.state || "", pin: poa.pc || "", country: poa.country || ""
      }
    };
  }
  /** One line, without repeating a part that is the same as the one before (town and taluk are often equal). */
  const formatAddress = (a) => [a.house, a.street, a.landmark, a.vtc, a.taluk, a.district, a.state]
    .filter((x, i, all) => x && x.toLowerCase() !== String(all[i - 1] || "").toLowerCase()).join(", ") + (a.pin ? ` - ${a.pin}` : "");

  return { SAMPLE_RESPONSE, parse, formatAddress, isoDate };
})();
