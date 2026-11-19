// Admin editor: edits data/data.json and commits it to GitHub through the REST API.
(function () {
  const P = window.Portfolio;
  const $ = (id) => document.getElementById(id);
  const esc = P.esc;

  const AUTH_KEY = "portfolio-admin-auth";
  const DATA_PATH = "data/data.json";

  const SECTION_TYPES = {
    services: "Services (cards)",
    cases: "Clinical cases (photo gallery)",
    education: "Education",
    experience: "Experience",
    projects: "Projects",
    certificates: "Certifications",
    skills: "Skills (tags)",
    languages: "Languages (tags)",
    custom: "Custom (timeline)"
  };
  const SECTION_TITLES_AR = {
    services: "الخدمات", cases: "حالات سريرية", education: "التعليم", experience: "الخبرات", projects: "المشاريع", certificates: "الشهادات",
    skills: "المهارات", languages: "اللغات", custom: "قسم جديد"
  };

  let auth = null;          // { owner, repo, branch, token } or null in offline mode
  let state = null;         // the data being edited
  let sha = null;           // sha of data.json on GitHub
  let dirty = false;
  let previewLang = "en";
  let pendingImages = {};   // path -> dataUrl for uploads not yet served by Pages (used in previews)
  let uploadedPaths = new Set(); // images uploaded in this session
  let savedRefs = new Set();     // images referenced by the last loaded/saved data.json
  let casePhotoTarget = null;    // images[] path the case photo picker adds to

  const IMG_DIR = "assets/img/";
  const imgSrc = (path) => pendingImages[path] || path;

  // ---------- helpers ----------
  const bi = () => ({ en: "", ar: "" });
  const timelineItem = () => ({ title: bi(), org: bi(), location: bi(), start: "", end: "", description: bi(), bullets: [], images: [] });
  const listItem = () => ({ name: bi(), level: bi() });
  const serviceItem = () => ({ icon: "tooth", name: bi(), description: bi() });
  const caseItem = () => ({ title: bi(), category: bi(), date: "", description: bi(), images: [] });
  const family = (type) => (type === "cases" ? "cases" : P.isCards(type) ? "cards" : P.isTimeline(type) ? "timeline" : "list");
  const ITEM_FOR = { cards: serviceItem, timeline: timelineItem, list: listItem, cases: caseItem };

  // Stable keys for <details> so open/closed state survives re-renders.
  const uids = new WeakMap();
  let uidCounter = 0;
  const uid = (obj) => { if (!uids.has(obj)) uids.set(obj, "k" + ++uidCounter); return uids.get(obj); };
  const openKeys = new Set(["profile"]);

  function getAt(path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), state);
  }
  function setAt(path, value) {
    const keys = path.split(".");
    const last = keys.pop();
    let o = state;
    keys.forEach((k, i) => {
      if (o[k] == null || typeof o[k] !== "object") o[k] = /^\d+$/.test(keys[i + 1] || last) ? [] : {};
      o = o[k];
    });
    o[last] = value;
  }

  function toast(msg, isError) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast show" + (isError ? " error" : "");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => (t.className = "toast"), isError ? 6000 : 3000);
  }

  function setDirty(v) {
    dirty = v;
    document.body.classList.toggle("is-dirty", v);
  }

  // Normalise data so every field the editor expects exists.
  function normalise(d) {
    d.settings = Object.assign({ themeColor: "#0f766e", defaultLanguage: "en", cvFileName: "CV", portfolioUrl: "" }, d.settings);
    d.profile = Object.assign({
      name: bi(), shortName: bi(), title: bi(), tagline: bi(), summary: bi(),
      phone: "", whatsapp: "", email: "", location: bi(), photo: "", stats: [], links: []
    }, d.profile);
    ["name", "shortName", "title", "tagline", "summary", "location"].forEach((k) => {
      if (typeof d.profile[k] === "string") d.profile[k] = { en: d.profile[k], ar: "" };
    });
    d.sections = (d.sections || []).map((s) => {
      s.title = typeof s.title === "string" ? { en: s.title, ar: "" } : Object.assign(bi(), s.title);
      s.items = (s.items || []).map((it) => Object.assign(ITEM_FOR[family(s.type)](), it));
      if (s.type === "cases" || P.isTimeline(s.type)) {
        s.items.forEach((it) => {
          it.images = (it.images || []).map((im) => ({ src: im.src || "", caption: Object.assign(bi(), im.caption) }));
        });
      }
      return s;
    });
    return d;
  }

  // All uploaded-image paths the data refers to (profile photo, case photos).
  function collectRefs(obj, out) {
    out = out || new Set();
    if (typeof obj === "string") { if (obj.startsWith(IMG_DIR)) out.add(obj); }
    else if (obj && typeof obj === "object") Object.values(obj).forEach((v) => collectRefs(v, out));
    return out;
  }

  // ---------- UTF-8 safe base64 ----------
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  }

  // ---------- GitHub API ----------
  async function gh(method, path, body) {
    const url = `https://api.github.com/repos/${auth.owner}/${auth.repo}/contents/${path}` +
      (method === "GET" ? `?ref=${encodeURIComponent(auth.branch)}&t=${Date.now()}` : "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    let res;
    try {
      res = await fetch(url, {
        method,
        cache: "no-store",
        signal: ctrl.signal,
        headers: {
          Authorization: "Bearer " + auth.token,
          Accept: "application/vnd.github+json"
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new Error(e.name === "AbortError"
        ? "GitHub didn't respond. Check your internet connection and try again."
        : "Couldn't reach GitHub (" + e.message + "). Check your connection, or turn off ad-blockers for this page.");
    } finally {
      clearTimeout(timer);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.message || "GitHub error " + res.status);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  async function fetchRemote() {
    const file = await gh("GET", DATA_PATH);
    return { data: JSON.parse(b64decode(file.content)), sha: file.sha };
  }

  async function putFile(path, contentB64, message, fileSha) {
    const body = { message, content: contentB64, branch: auth.branch };
    if (fileSha) body.sha = fileSha;
    return gh("PUT", path, body);
  }

  // ---------- login ----------
  function defaultRepo() {
    if (location.hostname.endsWith(".github.io")) {
      const owner = location.hostname.split(".")[0];
      const repo = location.pathname.split("/").filter(Boolean)[0];
      return { owner, repo: repo && !repo.endsWith(".html") ? repo : owner + ".github.io", branch: "main" };
    }
    return { owner: "Mostafa7799", repo: "dr-ahlam", branch: "main" };
  }

  function readAuth() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); } catch (e) { return null; }
  }
  function writeAuth(a) {
    try { a ? localStorage.setItem(AUTH_KEY, JSON.stringify(a)) : localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ }
  }

  function friendlyError(err) {
    if (err.status === 401) return "The token is invalid or expired.";
    if (err.status === 403) return "The token doesn't have permission. Give it Contents: Read and write on this repository.";
    if (err.status === 404) return "Repository or data/data.json not found. Check the repository settings and the token's repository access.";
    return err.message || "Something went wrong.";
  }

  async function signIn(a) {
    if (!a.token) { $("loginError").textContent = "Paste your GitHub token first."; return; }
    auth = a;
    const btn = $("loginBtn");
    btn.disabled = true;
    btn.textContent = "Signing in…";
    $("loginError").textContent = "";
    try {
      const remote = await fetchRemote();
      sha = remote.sha;
      writeAuth(a);
      startEditor(remote.data);
    } catch (err) {
      auth = null;
      $("loginError").textContent = friendlyError(err);
      if (err.status === 401) writeAuth(null);
      showLogin();
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign in";
    }
  }

  async function startOffline() {
    auth = null;
    try {
      startEditor(await P.loadData());
      toast("Offline mode: use Export to download data.json.");
    } catch (e) {
      showLogin();
      $("loginError").textContent = "Could not load data/data.json.";
    }
  }

  function startEditor(data) {
    state = normalise(data);
    savedRefs = collectRefs(state);
    previewLang = state.settings.defaultLanguage === "ar" ? "ar" : "en";
    $("saveBtn").textContent = auth ? "Save" : "Download data.json";
    $("logoutBtn").textContent = auth ? "Log out" : "Exit";
    $("previewLangBtn").textContent = previewLang === "ar" ? "English" : "عربي";
    setDirty(false);
    renderEditor();
    $("loginView").hidden = true;
    $("editorView").hidden = false;
    window.scrollTo(0, 0);
    $("preview").src = "index.html?preview=1";
  }

  function showLogin() {
    $("loginView").hidden = false;
    $("editorView").hidden = true;
  }

  // ---------- rendering ----------
  function biField(label, path, opts) {
    opts = opts || {};
    const v = getAt(path) || {};
    const input = (lang) => {
      const dir = lang === "ar" ? "rtl" : "ltr";
      const p = `${path}.${lang}`;
      const val = esc(v[lang] || "");
      const ph = esc((opts.placeholder && opts.placeholder[lang]) || "");
      return `<div class="lang-input ${lang}">${opts.multiline
        ? `<textarea data-path="${p}" dir="${dir}" placeholder="${ph}">${val}</textarea>`
        : `<input type="text" data-path="${p}" dir="${dir}" value="${val}" placeholder="${ph}">`}<span class="lang-tag">${lang.toUpperCase()}</span></div>`;
    };
    return `<div class="field"><span class="field-label">${esc(label)}</span><div class="bi">${input("en")}${input("ar")}</div></div>`;
  }

  function textField(label, path, type, placeholder) {
    return `<div class="field"><label>${esc(label)}</label><input type="${type || "text"}" dir="ltr" data-path="${path}" value="${esc(getAt(path) || "")}" placeholder="${esc(placeholder || "")}"></div>`;
  }

  function controls(path, index, length) {
    return `
      <button class="icon-btn" type="button" data-act="move" data-path="${path}" data-dir="-1" title="Move up" ${index === 0 ? "disabled" : ""}>↑</button>
      <button class="icon-btn" type="button" data-act="move" data-path="${path}" data-dir="1" title="Move down" ${index === length - 1 ? "disabled" : ""}>↓</button>
      <button class="icon-btn danger" type="button" data-act="remove" data-path="${path}" title="Delete">✕</button>`;
  }

  function details(key, summary, body, cls) {
    return `<details class="${cls}" data-key="${key}" ${openKeys.has(key) ? "open" : ""}>
      <summary><span class="chev">▾</span>${summary}</summary>
      <div class="${cls === "panel" ? "panel-body" : "item-body"}">${body}</div>
    </details>`;
  }

  function renderSettings() {
    const s = state.settings;
    return details("settings", `<span class="grow">Settings</span>`, `
      <div class="row-3">
        <div class="field"><label>Theme color</label><input type="color" data-path="settings.themeColor" value="${esc(s.themeColor)}"></div>
        <div class="field"><label>Default language</label>
          <select data-path="settings.defaultLanguage">
            <option value="en" ${s.defaultLanguage !== "ar" ? "selected" : ""}>English</option>
            <option value="ar" ${s.defaultLanguage === "ar" ? "selected" : ""}>العربية</option>
          </select></div>
        ${textField("CV file name", "settings.cvFileName")}
      </div>
      ${textField("Portfolio link (printed in the CV)", "settings.portfolioUrl", "url", "https://mostafa7799.github.io/dr-ahlam/")}`, "panel");
  }

  function renderProfile() {
    const p = state.profile;
    const photoSrc = p.photo ? imgSrc(p.photo) : "";
    const links = (p.links || []).map((l, i) => `
      <div class="list-row">
        <input type="text" data-path="profile.links.${i}.label" value="${esc(l.label)}" placeholder="Label (e.g. LinkedIn)">
        <input type="url" dir="ltr" data-path="profile.links.${i}.url" value="${esc(l.url)}" placeholder="https://…">
        <button class="icon-btn danger" type="button" data-act="remove" data-path="profile.links.${i}" title="Delete">✕</button>
      </div>`).join("");

    const stats = (p.stats || []).map((st, i) => `
      <div class="list-row three">
        <input type="text" data-path="profile.stats.${i}.value" value="${esc(st.value)}" placeholder="Value (e.g. 5+)">
        <input type="text" data-path="profile.stats.${i}.label.en" value="${esc(st.label && st.label.en)}" placeholder="Label (EN)">
        <input type="text" dir="rtl" data-path="profile.stats.${i}.label.ar" value="${esc(st.label && st.label.ar)}" placeholder="الوصف (AR)">
        <span style="display:flex;gap:4px">${controls("profile.stats." + i, i, p.stats.length)}</span>
      </div>`).join("");

    return details("profile", `<span class="grow">Profile</span>`, `
      <div class="field"><span class="field-label">Photo</span>
        <div class="photo-row">
          ${photoSrc ? `<img src="${esc(photoSrc)}" alt="">` : `<div class="ph">None</div>`}
          <button class="btn btn-sm" type="button" data-act="photo">${p.photo ? "Change photo" : "Upload photo"}</button>
          ${p.photo ? `<button class="btn btn-sm btn-danger" type="button" data-act="photo-remove">Remove</button>` : ""}
        </div>
        ${auth ? "" : `<p class="hint">Photo upload needs a GitHub token.</p>`}
      </div>
      ${biField("Full name (used in the CV)", "profile.name")}
      ${biField("Display name (top of the site, e.g. Dr. Ahlam Abdelwadod)", "profile.shortName")}
      ${biField("Job title", "profile.title")}
      ${biField("Tagline (one sentence under the name)", "profile.tagline", { multiline: true })}
      ${biField("Summary / About me", "profile.summary", { multiline: true })}
      <div class="row-3">
        ${textField("Phone", "profile.phone", "tel")}
        ${textField("WhatsApp (with country code)", "profile.whatsapp", "tel", "201xxxxxxxxx")}
        ${textField("Email", "profile.email", "email")}
      </div>
      ${biField("Location", "profile.location")}
      <div class="field"><span class="field-label">Highlights (numbers shown under the name)</span>
        <div class="items">${stats}</div>
        <div><button class="btn btn-sm" type="button" data-act="add" data-path="profile.stats" data-tpl="stat">+ Add highlight</button></div>
      </div>
      <div class="field"><span class="field-label">Links</span>
        <div class="items">${links}</div>
        <div><button class="btn btn-sm" type="button" data-act="add" data-path="profile.links" data-tpl="link">+ Add link</button></div>
      </div>`, "panel");
  }

  function renderTimelineItem(base, it, i, n) {
    const bullets = (it.bullets || []).map((b, j) => `
      <div class="bullet-row">
        <input type="text" data-path="${base}.bullets.${j}.en" value="${esc(b.en)}" placeholder="Bullet (EN)">
        <input type="text" dir="rtl" data-path="${base}.bullets.${j}.ar" value="${esc(b.ar)}" placeholder="نقطة (AR)">
        <button class="icon-btn danger" type="button" data-act="remove" data-path="${base}.bullets.${j}" title="Delete">✕</button>
      </div>`).join("");
    const label = P.tr(it.title, "en") || P.tr(it.org, "en") || "New item";
    return details(uid(it), `<span class="grow">${esc(label)}</span>${controls(base, i, n)}`, `
      ${biField("Title / Degree / Role", base + ".title")}
      ${biField("Organization / School / Issuer", base + ".org")}
      ${biField("Location", base + ".location")}
      <div class="row">
        ${textField("Start (MM/YYYY)", base + ".start", "text", "09/2021")}
        ${textField("End (MM/YYYY or Present)", base + ".end", "text", "Present")}
      </div>
      ${biField("Description", base + ".description", { multiline: true })}
      <div class="field"><span class="field-label">Bullet points</span>
        <div class="items">${bullets}</div>
        <div><button class="btn btn-sm" type="button" data-act="add" data-path="${base}.bullets" data-tpl="bullet">+ Add bullet</button></div>
      </div>
      ${imagesField(base, it.images || [], "Images (e.g. certificate scan) – website only, not in the CV")}`, "item");
  }

  function renderServiceItem(base, it, i, n) {
    const options = Object.keys(window.Icons.SERVICE).map((k) =>
      `<option value="${k}" ${it.icon === k ? "selected" : ""}>${k}</option>`).join("");
    const summary = `<span class="svc-ic">${window.Icons.service(it.icon)}</span><span class="grow">${esc(P.tr(it.name, "en") || "New service")}</span>${controls(base, i, n)}`;
    return details(uid(it), summary, `
      <div class="field"><label>Icon</label>
        <div class="icon-pick"><span class="svc-ic">${window.Icons.service(it.icon)}</span>
        <select data-path="${base}.icon" data-rerender>${options}</select></div></div>
      ${biField("Service name", base + ".name")}
      ${biField("Short description", base + ".description", { multiline: true })}`, "item");
  }

  // Photo list with captions, shared by cases and timeline items (e.g. certificate scans).
  function imagesField(base, imgs, label) {
    const rows = imgs.map((im, k) => `
      <div class="img-row">
        <img src="${esc(imgSrc(im.src))}" alt="" loading="lazy">
        <input type="text" data-path="${base}.images.${k}.caption.en" value="${esc(im.caption.en)}" placeholder="Caption (e.g. Before)">
        <input type="text" dir="rtl" data-path="${base}.images.${k}.caption.ar" value="${esc(im.caption.ar)}" placeholder="الوصف (مثال: قبل)">
        <span style="display:flex;gap:4px">${controls(base + ".images." + k, k, imgs.length)}</span>
      </div>`).join("");
    return `
      <div class="field"><span class="field-label">${esc(label)}</span>
        <div class="items">${rows || `<p class="hint">No photos yet.</p>`}</div>
        <div><button class="btn btn-sm" type="button" data-act="case-photos" data-path="${base}.images">+ Add photos</button></div>
        ${auth ? "" : `<p class="hint">Photo upload needs a GitHub token.</p>`}
      </div>`;
  }

  function renderCaseItem(base, it, i, n) {
    const imgs = it.images || [];
    const cover = imgs[0] ? `<img class="case-thumb" src="${esc(imgSrc(imgs[0].src))}" alt="">` : `<span class="case-thumb ph">📷</span>`;
    const summary = `${cover}<span class="grow">${esc(P.tr(it.title, "en") || "New case")}</span>
      <span class="hidden-tag">${imgs.length} photo${imgs.length === 1 ? "" : "s"}</span>${controls(base, i, n)}`;
    return details(uid(it), summary, `
      ${biField("Case title", base + ".title", { placeholder: { en: "e.g. Composite restoration of a lower molar", ar: "مثال: حشو تجميلي لضرس سفلي" } })}
      <div class="row">
        <div class="field"><span class="field-label">Treatment type</span><div class="bi">
          <div class="lang-input en"><input type="text" data-path="${base}.category.en" value="${esc(it.category.en)}" placeholder="e.g. Restorative"><span class="lang-tag">EN</span></div>
          <div class="lang-input ar"><input type="text" dir="rtl" data-path="${base}.category.ar" value="${esc(it.category.ar)}" placeholder="مثال: علاج تحفظي"><span class="lang-tag">AR</span></div>
        </div></div>
        ${textField("Date (optional)", base + ".date", "text", "03/2025")}
      </div>
      ${biField("Description (what was done, materials, result)", base + ".description", { multiline: true })}
      ${imagesField(base, imgs, "Photos (the first photo is the cover)")}`, "item");
  }

  function renderListItem(base, it, i, n, type) {
    return `
      <div class="list-row three">
        <input type="text" data-path="${base}.name.en" value="${esc(it.name.en)}" placeholder="${type === "languages" ? "Language" : "Skill"} (EN)">
        <input type="text" dir="rtl" data-path="${base}.name.ar" value="${esc(it.name.ar)}" placeholder="الاسم (AR)">
        <input type="text" data-path="${base}.level.en" value="${esc(it.level.en)}" placeholder="Level (optional)">
        <span style="display:flex;gap:4px">${controls(base, i, n)}</span>
      </div>
      ${type === "languages" ? `<input type="text" dir="rtl" data-path="${base}.level.ar" value="${esc(it.level.ar)}" placeholder="المستوى بالعربية (اختياري)" style="margin-top:-4px">` : ""}`;
  }

  function renderSection(s, i, n) {
    const base = "sections." + i;
    const fam = family(s.type);
    const items = s.items.map((it, j) => {
      const path = `${base}.items.${j}`;
      if (fam === "cards") return renderServiceItem(path, it, j, s.items.length);
      if (fam === "cases") return renderCaseItem(path, it, j, s.items.length);
      if (fam === "timeline") return renderTimelineItem(path, it, j, s.items.length);
      return renderListItem(path, it, j, s.items.length, s.type);
    }).join("");
    const typeOptions = Object.keys(SECTION_TYPES).map((t) =>
      `<option value="${t}" ${s.type === t ? "selected" : ""}>${SECTION_TYPES[t]}</option>`).join("");

    const summary = `<span class="grow">${esc(P.tr(s.title, "en") || "Untitled section")}</span>
      ${s.visible === false ? `<span class="hidden-tag">Hidden</span>` : ""}
      ${controls(base, i, n)}`;
    return details(uid(s), summary, `
      <div class="row" style="align-items:end">
        <div class="field"><label>Section type</label><select data-path="${base}.type" data-rerender>${typeOptions}</select></div>
        <label class="check"><input type="checkbox" data-path="${base}.visible" data-rerender ${s.visible !== false ? "checked" : ""}> Show on ${fam === "cards" || fam === "cases" ? "site (not in CV)" : "site and CV"}</label>
      </div>
      ${fam === "cases" ? `<p class="hint">🔒 Only share photos with the patient's written consent. Avoid faces, names and anything that identifies the patient. Photos you delete here are removed from the website files when you click Save.</p>` : ""}
      ${biField("Section title", base + ".title")}
      <div class="field"><span class="field-label">Items</span>
        <div class="items">${items || `<p class="hint">No items yet.</p>`}</div>
        <div><button class="btn btn-sm" type="button" data-act="add" data-path="${base}.items" data-tpl="${fam}">+ Add ${{ cards: "service", cases: "case", timeline: "item" }[fam] || "entry"}</button></div>
      </div>`, "panel");
  }

  function renderEditor() {
    const editor = $("editor");
    editor.querySelectorAll("details[data-key]").forEach((d) => (d.open ? openKeys.add(d.dataset.key) : openKeys.delete(d.dataset.key)));
    const n = state.sections.length;
    editor.innerHTML =
      renderSettings() +
      renderProfile() +
      state.sections.map((s, i) => renderSection(s, i, n)).join("") +
      `<div class="add-section">
        <select id="newSectionType">${Object.keys(SECTION_TYPES).map((t) => `<option value="${t}">${SECTION_TYPES[t]}</option>`).join("")}</select>
        <button class="btn btn-sm btn-primary" type="button" data-act="add-section">+ Add section</button>
      </div>`;
    sendPreview();
  }

  // ---------- preview ----------
  // Swap freshly uploaded images for their local copies until GitHub Pages serves them.
  function previewData() {
    if (!Object.keys(pendingImages).length) return state;
    return JSON.parse(JSON.stringify(state), (k, v) => (typeof v === "string" && pendingImages[v]) || v);
  }

  function sendPreview() {
    const frame = $("preview");
    if (!frame.contentWindow) return;
    try {
      frame.contentWindow.postMessage({ type: "preview", data: previewData(), lang: previewLang }, location.origin === "null" ? "*" : location.origin);
    } catch (e) { /* preview is optional */ }
  }
  let previewTimer = null;
  const schedulePreview = () => { clearTimeout(previewTimer); previewTimer = setTimeout(sendPreview, 250); };

  window.addEventListener("message", (e) => {
    if (e.origin === location.origin && e.data && e.data.type === "preview-ready" && state) sendPreview();
  });

  // ---------- editing events ----------
  function onFieldChange(e) {
    const el = e.target;
    const path = el.dataset && el.dataset.path;
    if (!path) return;
    if (path.endsWith(".type")) return changeSectionType(path, el.value);
    setAt(path, el.type === "checkbox" ? el.checked : el.value);
    setDirty(true);
    if (el.hasAttribute("data-rerender")) renderEditor();
    else {
      updateSummaryLabel(el);
      schedulePreview();
    }
  }

  // Keep the collapsed item/section label in sync while typing, without re-rendering.
  function updateSummaryLabel(el) {
    const path = el.dataset.path;
    if (!/\.(title|org|name)\.en$/.test(path)) return;
    const det = el.closest("details");
    const label = det && det.querySelector(":scope > summary .grow");
    if (!label) return;
    // Item fields inside a section panel (skills, languages) don't own the panel's label.
    const isPanel = det.classList.contains("panel");
    if (isPanel && !/^sections\.\d+\.title\.en$/.test(path)) return;
    const obj = getAt(path.replace(/\.(title|org|name)\.en$/, ""));
    label.textContent = P.tr(obj.title, "en") || P.tr(obj.name, "en") || P.tr(obj.org, "en") || (isPanel ? "Untitled section" : "New item");
  }

  function changeSectionType(path, type) {
    const s = getAt(path.replace(/\.type$/, ""));
    const from = family(s.type);
    const to = family(type);
    s.type = type;
    if (from !== to) {
      // Keep the item names when switching between cards, timeline and list layouts.
      s.items = s.items.map((it) => {
        const name = it.title || it.name || bi();
        const item = ITEM_FOR[to]();
        if (to === "timeline" || to === "cases") item.title = name; else item.name = name;
        if (it.description && to !== "list") item.description = it.description;
        return item;
      });
    }
    setDirty(true);
    renderEditor();
  }

  const TEMPLATES = {
    link: () => ({ label: "", url: "" }),
    bullet: bi,
    timeline: timelineItem,
    list: listItem,
    cards: serviceItem,
    cases: caseItem,
    stat: () => ({ value: "", label: bi() })
  };

  function onAction(e) {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    e.preventDefault();
    const act = btn.dataset.act;
    const path = btn.dataset.path;

    if (act === "add") {
      const arr = getAt(path) || [];
      const item = TEMPLATES[btn.dataset.tpl]();
      arr.push(item);
      setAt(path, arr);
      if (["timeline", "cards", "cases"].includes(btn.dataset.tpl)) openKeys.add(uid(item));
    } else if (act === "remove") {
      if (!confirm("Delete this?")) return;
      const parts = path.split(".");
      const idx = +parts.pop();
      getAt(parts.join(".")).splice(idx, 1);
    } else if (act === "move") {
      const parts = path.split(".");
      const idx = +parts.pop();
      const arr = getAt(parts.join("."));
      const to = idx + +btn.dataset.dir;
      if (to < 0 || to >= arr.length) return;
      arr.splice(to, 0, arr.splice(idx, 1)[0]);
    } else if (act === "add-section") {
      const type = $("newSectionType").value;
      const label = SECTION_TYPES[type].replace(/\s*\(.*\)$/, "");
      const s = {
        id: type + "-" + Date.now().toString(36),
        type,
        visible: true,
        title: { en: type === "custom" ? "New Section" : label, ar: SECTION_TITLES_AR[type] },
        items: []
      };
      state.sections.push(s);
      openKeys.add(uid(s));
    } else if (act === "photo") {
      if (!auth) return toast("Sign in with a GitHub token to upload a photo.", true);
      $("photoInput").click();
      return;
    } else if (act === "case-photos") {
      if (!auth) return toast("Sign in with a GitHub token to upload photos.", true);
      casePhotoTarget = path;
      $("casePhotoInput").click();
      return;
    } else if (act === "photo-remove") {
      state.profile.photo = "";
    } else {
      return;
    }
    setDirty(true);
    renderEditor();
  }

  // ---------- photo upload ----------
  function resizeImage(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => reject(new Error("That file is not a supported image."));
      img.src = URL.createObjectURL(file);
    });
  }

  // Resize in the browser, then commit the JPEG to the repo. Returns its path.
  async function uploadImage(file, path, maxSize, message) {
    const dataUrl = await resizeImage(file, maxSize);
    await putFile(path, dataUrl.split(",")[1], message);
    pendingImages[path] = dataUrl;
    uploadedPaths.add(path);
    return path;
  }

  $("photoInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      toast("Uploading photo…");
      const path = await uploadImage(file, IMG_DIR + "profile-" + Date.now() + ".jpg", 600, "Upload profile photo");
      state.profile.photo = path;
      setDirty(true);
      renderEditor();
      toast("Photo uploaded. Click Save to publish it.");
    } catch (err) {
      toast(friendlyError(err), true);
    }
  });

  $("casePhotoInput").addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const target = casePhotoTarget;
    if (!files.length || !target) return;
    let done = 0;
    try {
      for (const file of files) {
        toast(`Uploading photo ${done + 1} of ${files.length}…`);
        const path = await uploadImage(file, `${IMG_DIR}cases/case-${Date.now()}-${done}.jpg`, 1600, "Upload case photo");
        const arr = getAt(target) || [];
        arr.push({ src: path, caption: bi() });
        setAt(target, arr);
        done++;
        setDirty(true);
        renderEditor();
      }
      toast(`${done} photo${done === 1 ? "" : "s"} uploaded. Click Save to publish.`);
    } catch (err) {
      toast((done ? done + " uploaded, then: " : "") + friendlyError(err), true);
    }
  });

  // After a save, delete uploaded images that nothing refers to any more,
  // so removed patient photos don't stay in the public repository.
  async function removeUnusedImages() {
    const current = collectRefs(state);
    const unused = [...new Set([...savedRefs, ...uploadedPaths])].filter((p) => !current.has(p) && p.startsWith(IMG_DIR));
    let removed = 0;
    for (const path of unused) {
      try {
        const file = await gh("GET", path);
        await gh("DELETE", path, { message: "Remove unused image", sha: file.sha, branch: auth.branch });
        removed++;
      } catch (err) {
        if (err.status !== 404) console.warn("Could not delete " + path, err);
      }
      delete pendingImages[path];
    }
    savedRefs = current;
    uploadedPaths = new Set();
    return removed;
  }

  // ---------- save / export / import ----------
  function serialise() {
    return JSON.stringify(state, null, 2) + "\n";
  }

  function exportJson() {
    const blob = new Blob([serialise()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "data.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function save() {
    if (!auth) { exportJson(); return; }
    const btn = $("saveBtn");
    btn.disabled = true;
    btn.textContent = "Saving…";
    try {
      try {
        const res = await putFile(DATA_PATH, b64encode(serialise()), "Update portfolio content", sha);
        sha = res.content.sha;
      } catch (err) {
        if (err.status !== 409 && err.status !== 422) throw err;
        // The file changed on GitHub since we loaded it.
        const remote = await fetchRemote();
        if (!confirm("The content was changed somewhere else since you opened it. Overwrite it with your version?")) {
          toast("Not saved. Reload the page to get the latest version.", true);
          return;
        }
        const res = await putFile(DATA_PATH, b64encode(serialise()), "Update portfolio content", remote.sha);
        sha = res.content.sha;
      }
      setDirty(false);
      const removed = await removeUnusedImages();
      toast("Saved! The live site updates in about 1 minute." + (removed ? ` Removed ${removed} unused photo${removed === 1 ? "" : "s"}.` : ""));
    } catch (err) {
      toast(friendlyError(err), true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Save";
    }
  }

  $("importInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.profile || !Array.isArray(data.sections)) throw new Error("bad");
      state = normalise(data);
      setDirty(true);
      renderEditor();
      toast("Imported. Review it, then click Save.");
    } catch (err) {
      toast("That file isn't a valid portfolio data.json.", true);
    }
  });

  // ---------- wiring ----------
  const editor = $("editor");
  editor.addEventListener("input", (e) => { if (e.target.type !== "checkbox" && e.target.tagName !== "SELECT") onFieldChange(e); });
  editor.addEventListener("change", (e) => { if (e.target.type === "checkbox" || e.target.tagName === "SELECT") onFieldChange(e); });
  editor.addEventListener("click", onAction);

  $("saveBtn").addEventListener("click", save);
  $("exportBtn").addEventListener("click", exportJson);
  $("cvBtn").addEventListener("click", () => window.CV.download(previewData(), previewLang, { preview: true }));
  $("previewLangBtn").addEventListener("click", () => {
    previewLang = previewLang === "ar" ? "en" : "ar";
    $("previewLangBtn").textContent = previewLang === "ar" ? "English" : "عربي";
    sendPreview();
  });
  $("togglePreviewBtn").addEventListener("click", () => {
    const hidden = document.body.classList.toggle("hide-preview");
    $("togglePreviewBtn").textContent = hidden ? "Show preview" : "Hide preview";
  });
  $("logoutBtn").addEventListener("click", () => {
    if (dirty && !confirm("You have unsaved changes. Leave anyway?")) return;
    writeAuth(null);
    setDirty(false);
    location.reload();
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s" && state) { e.preventDefault(); save(); }
  });
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    signIn({
      owner: $("ownerInput").value.trim(),
      repo: $("repoInput").value.trim(),
      branch: $("branchInput").value.trim() || "main",
      token: $("tokenInput").value.replace(/[^A-Za-z0-9_]/g, "")
    });
  });
  $("offlineBtn").addEventListener("click", startOffline);

  // Show unexpected errors instead of failing silently.
  function reportError(msg) {
    if (!$("loginView").hidden) $("loginError").textContent = "Error: " + msg;
    else toast("Error: " + msg, true);
  }
  window.addEventListener("error", (e) => reportError(e.message));
  window.addEventListener("unhandledrejection", (e) => reportError((e.reason && e.reason.message) || String(e.reason)));

  if (location.protocol === "file:") {
    $("loginError").textContent = "This page was opened as a local file. Open it from the website instead: https://mostafa7799.github.io/dr-ahlam/admin.html";
  }

  // Start: prefill the repo fields, and sign in automatically if a token is saved.
  const saved = readAuth();
  const repo = saved || defaultRepo();
  $("ownerInput").value = repo.owner;
  $("repoInput").value = repo.repo;
  $("branchInput").value = repo.branch;
  if (saved && saved.token) {
    $("tokenInput").value = saved.token;
    signIn(saved);
  }
})();
