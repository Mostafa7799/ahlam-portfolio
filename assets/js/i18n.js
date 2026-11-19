// Shared helpers: language handling, UI labels and data loading.
(function () {
  const UI = {
    en: {
      downloadCv: "Download CV",
      contact: "Contact",
      call: "Call",
      email: "Email",
      about: "About Me",
      present: "Present",
      langToggle: "عربي",
      loading: "Loading…",
      loadError: "Could not load the portfolio data.",
      printCv: "Print / Save as PDF",
      back: "Back to portfolio",
      phone: "Phone",
      location: "Location",
      summary: "Summary"
    },
    ar: {
      downloadCv: "تحميل السيرة الذاتية",
      contact: "تواصل",
      call: "اتصال",
      email: "البريد",
      about: "نبذة عني",
      present: "حتى الآن",
      langToggle: "English",
      loading: "جارٍ التحميل…",
      loadError: "تعذّر تحميل بيانات الموقع.",
      printCv: "طباعة / حفظ PDF",
      back: "العودة إلى الموقع",
      phone: "الهاتف",
      location: "العنوان",
      summary: "الملخص"
    }
  };

  const LANG_KEY = "portfolio-lang";

  function readStored() {
    try { return localStorage.getItem(LANG_KEY); } catch (e) { return null; }
  }

  function getLang(fallback) {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    const lang = fromUrl || readStored() || fallback || "en";
    return lang === "ar" ? "ar" : "en";
  }

  function setLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* private mode */ }
    applyDir(lang);
  }

  function applyDir(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }

  // Pick the right language from a {en, ar} value, falling back to the other one.
  function tr(value, lang) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    return value[lang] || value[lang === "ar" ? "en" : "ar"] || "";
  }

  function ui(key, lang) {
    return (UI[lang] && UI[lang][key]) || UI.en[key] || key;
  }

  async function loadData() {
    const res = await fetch("data/data.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function dateRange(item, lang) {
    const start = (item.start || "").trim();
    let end = (item.end || "").trim();
    if (/^present$/i.test(end)) end = ui("present", lang);
    if (start && end) return start + " – " + end;
    return start || end;
  }

  const TIMELINE_TYPES = ["education", "experience", "projects", "certificates", "custom"];
  const isTimeline = (type) => TIMELINE_TYPES.includes(type);

  window.Portfolio = { getLang, setLang, applyDir, tr, ui, loadData, esc, dateRange, isTimeline };
})();
