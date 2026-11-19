// Admin editor: edits data/data.json and commits it to GitHub through the REST API.
(function () {
  const P = window.Portfolio;
  const $ = (id) => document.getElementById(id);
  const esc = P.esc;

  const AUTH_KEY = "portfolio-admin-auth";
  const DATA_PATH = "data/data.json";

  const SECTION_TYPES = {
    education: "Education",
    experience: "Experience",
    projects: "Projects",
    certificates: "Certifications",
    skills: "Skills (tags)",
    languages: "Languages (tags)",
    custom: "Custom (timeline)"
  };
  const SECTION_TITLES_AR = {
    education: "التعليم", experience: "الخبرات", projects: "المشاريع", certificates: "الشهادات",
    skills: "المهارات", languages: "اللغات", custom: "قسم جديد"
  };

  let auth = null;          // { owner, repo, branch, token } or null in offline mode
  let state = null;         // the data being edited
  let sha = null;           // sha of data.json on GitHub
  let dirty = false;
  let previewLang = "en";
  let pendingPhoto = null;  // { path, dataUrl } shown in the preview until Pages rebuilds

  // ---------- helpers ----------
  const bi = () => ({ en: "", ar: "" });
  const timelineItem = () => ({ title: bi(), org: bi(), location: bi(), start: "", end: "", description: bi(), bullets: [] });
  const listItem = () => ({ name: bi(), level: bi() });

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
    d.settings = Object.assign({ themeColor: "#0f766e", defaultLanguage: "en", cvFileName: "CV" }, d.settings);
    d.profile = Object.assign({ name: bi(), title: bi(), summary: bi(), phone: "", email: "", location: bi(), photo: "", links: [] }, d.profile);
    ["name", "title", "summary", "location"].forEach((k) => {
      if (typeof d.profile[k] === "string") d.profile[k] = { en: d.profile[k], ar: "" };
    });
    d.sections = (d.sections || []).map((s) => {
      s.title = typeof s.title === "string" ? { en: s.title, ar: "" } : Object.assign(bi(), s.title);
      s.items = (s.items || []).map((it) => Object.assign(P.isTimeline(s.type) ? timelineItem() : listItem(), it));
      return s;
    });
    return d;
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
    const res = await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + auth.token,
        Accept: "application/vnd.github+json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
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
    return { owner: "Mostafa7799", repo: "ahlam-portfolio", branch: "main" };
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
    auth = a;
    $("loginBtn").disabled = true;
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
    } finally {
      $("loginBtn").disabled = false;
    }
  }

  async function startOffline() {
    auth = null;
    try {
      startEditor(await P.loadData());
      toast("Offline mode: use Export to download data.json.");
    } catch (e) {
      $("loginError").textContent = "Could not load data/data.json.";
    }
  }

  function startEditor(data) {
    state = normalise(data);
    previewLang = state.settings.defaultLanguage === "ar" ? "ar" : "en";
    $("loginView").hidden = true;
    $("editorView").hidden = false;
    $("saveBtn").textContent = auth ? "Save" : "Download data.json";
    $("logoutBtn").textContent = auth ? "Log out" : "Exit";
    $("previewLangBtn").textContent = previewLang === "ar" ? "English" : "عربي";
    setDirty(false);
    renderEditor();
    $("preview").src = "index.html?preview=1";
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
      </div>`, "panel");
  }

  function renderProfile() {
    const p = state.profile;
    const photoSrc = pendingPhoto && pendingPhoto.path === p.photo ? pendingPhoto.dataUrl : p.photo;
    const links = (p.links || []).map((l, i) => `
      <div class="list-row">
        <input type="text" data-path="profile.links.${i}.label" value="${esc(l.label)}" placeholder="Label (e.g. LinkedIn)">
        <input type="url" dir="ltr" data-path="profile.links.${i}.url" value="${esc(l.url)}" placeholder="https://…">
        <button class="icon-btn danger" type="button" data-act="remove" data-path="profile.links.${i}" title="Delete">✕</button>
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
      ${biField("Full name", "profile.name")}
      ${biField("Job title", "profile.title")}
      ${biField("Summary / About me", "profile.summary", { multiline: true })}
      <div class="row">
        ${textField("Phone", "profile.phone", "tel")}
        ${textField("Email", "profile.email", "email")}
      </div>
      ${biField("Location", "profile.location")}
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
      </div>`, "item");
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
    const timeline = P.isTimeline(s.type);
    const items = s.items.map((it, j) =>
      timeline ? renderTimelineItem(`${base}.items.${j}`, it, j, s.items.length)
               : renderListItem(`${base}.items.${j}`, it, j, s.items.length, s.type)).join("");
    const typeOptions = Object.keys(SECTION_TYPES).map((t) =>
      `<option value="${t}" ${s.type === t ? "selected" : ""}>${SECTION_TYPES[t]}</option>`).join("");

    const summary = `<span class="grow">${esc(P.tr(s.title, "en") || "Untitled section")}</span>
      ${s.visible === false ? `<span class="hidden-tag">Hidden</span>` : ""}
      ${controls(base, i, n)}`;
    return details(uid(s), summary, `
      <div class="row" style="align-items:end">
        <div class="field"><label>Section type</label><select data-path="${base}.type" data-rerender>${typeOptions}</select></div>
        <label class="check"><input type="checkbox" data-path="${base}.visible" data-rerender ${s.visible !== false ? "checked" : ""}> Show on site and CV</label>
      </div>
      ${biField("Section title", base + ".title")}
      <div class="field"><span class="field-label">Items</span>
        <div class="items">${items || `<p class="hint">No items yet.</p>`}</div>
        <div><button class="btn btn-sm" type="button" data-act="add" data-path="${base}.items" data-tpl="${timeline ? "timeline" : "list"}">+ Add ${timeline ? "item" : "entry"}</button></div>
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
  function previewData() {
    if (!pendingPhoto || state.profile.photo !== pendingPhoto.path) return state;
    const copy = JSON.parse(JSON.stringify(state));
    copy.profile.photo = pendingPhoto.dataUrl;
    return copy;
  }

  function sendPreview() {
    const frame = $("preview");
    if (frame.contentWindow) frame.contentWindow.postMessage({ type: "preview", data: previewData(), lang: previewLang }, location.origin);
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
    if (!/\.title\.en$|\.org\.en$/.test(el.dataset.path)) return;
    const det = el.closest("details");
    const label = det && det.querySelector(":scope > summary .grow");
    if (!label) return;
    const obj = getAt(el.dataset.path.replace(/\.(title|org)\.en$/, ""));
    label.textContent = P.tr(obj.title, "en") || P.tr(obj.org, "en") || (det.classList.contains("panel") ? "Untitled section" : "New item");
  }

  function changeSectionType(path, type) {
    const s = getAt(path.replace(/\.type$/, ""));
    const wasTimeline = P.isTimeline(s.type);
    s.type = type;
    if (wasTimeline !== P.isTimeline(type)) {
      s.items = s.items.map((it) => wasTimeline
        ? Object.assign(listItem(), { name: it.title || bi() })
        : Object.assign(timelineItem(), { title: it.name || bi() }));
    }
    setDirty(true);
    renderEditor();
  }

  const TEMPLATES = {
    link: () => ({ label: "", url: "" }),
    bullet: bi,
    timeline: timelineItem,
    list: listItem
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
      if (btn.dataset.tpl === "timeline") openKeys.add(uid(item));
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
    } else if (act === "photo-remove") {
      state.profile.photo = "";
      pendingPhoto = null;
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

  $("photoInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      toast("Uploading photo…");
      const dataUrl = await resizeImage(file, 600);
      const path = "assets/img/profile-" + Date.now() + ".jpg";
      await putFile(path, dataUrl.split(",")[1], "Upload profile photo");
      pendingPhoto = { path, dataUrl };
      state.profile.photo = path;
      setDirty(true);
      renderEditor();
      toast("Photo uploaded. Click Save to publish it.");
    } catch (err) {
      toast(friendlyError(err), true);
    }
  });

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
      toast("Saved! The live site updates in about 1 minute.");
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
      token: $("tokenInput").value.trim()
    });
  });
  $("offlineBtn").addEventListener("click", startOffline);

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
