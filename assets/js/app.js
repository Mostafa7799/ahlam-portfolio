// Public portfolio: renders everything from data/data.json.
(function () {
  const P = window.Portfolio;
  const app = document.getElementById("app");
  const langBtn = document.getElementById("langBtn");
  const isPreview = new URLSearchParams(location.search).has("preview");

  let data = null;
  let lang = "en";

  const ICONS = {
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.18 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
  };

  function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  }

  function renderHero(p) {
    const name = P.tr(p.name, lang);
    const avatar = p.photo
      ? `<img class="avatar" src="${P.esc(p.photo)}" alt="${P.esc(name)}">`
      : `<div class="avatar" aria-hidden="true">${P.esc(initials(name))}</div>`;

    const contacts = [];
    if (p.phone) contacts.push(`<li>${ICONS.phone}<a class="ltr-num" href="tel:${P.esc(p.phone)}">${P.esc(p.phone)}</a></li>`);
    if (p.email) contacts.push(`<li>${ICONS.mail}<a href="mailto:${P.esc(p.email)}">${P.esc(p.email)}</a></li>`);
    const loc = P.tr(p.location, lang);
    if (loc) contacts.push(`<li>${ICONS.pin}<span>${P.esc(loc)}</span></li>`);
    (p.links || []).filter((l) => l.url).forEach((l) => {
      contacts.push(`<li>${ICONS.link}<a href="${P.esc(l.url)}" target="_blank" rel="noopener">${P.esc(l.label || l.url)}</a></li>`);
    });

    return `
      <section class="hero">
        <div class="hero-card">
          ${avatar}
          <div>
            <h1>${P.esc(name)}</h1>
            <p class="title">${P.esc(P.tr(p.title, lang))}</p>
            <ul class="contact-list">${contacts.join("")}</ul>
            <div class="hero-actions">
              <button class="btn btn-primary" type="button" data-action="cv">${ICONS.download}${P.ui("downloadCv", lang)}</button>
              ${p.email ? `<a class="btn" href="mailto:${P.esc(p.email)}">${ICONS.mail}${P.ui("contact", lang)}</a>` : ""}
            </div>
          </div>
        </div>
      </section>`;
  }

  function renderTimelineItem(it) {
    const title = P.tr(it.title, lang);
    const org = [P.tr(it.org, lang), P.tr(it.location, lang)].filter(Boolean).join(" · ");
    const desc = P.tr(it.description, lang);
    const bullets = (it.bullets || []).map((b) => P.tr(b, lang)).filter(Boolean);
    const date = P.dateRange(it, lang);
    return `
      <li class="tl-item">
        <div class="tl-head">
          <span class="tl-title">${P.esc(title)}</span>
          ${date ? `<span class="tl-date">${P.esc(date)}</span>` : ""}
        </div>
        ${org ? `<div class="tl-org">${P.esc(org)}</div>` : ""}
        ${desc ? `<p class="tl-desc">${P.esc(desc)}</p>` : ""}
        ${bullets.length ? `<ul>${bullets.map((b) => `<li>${P.esc(b)}</li>`).join("")}</ul>` : ""}
      </li>`;
  }

  function renderSection(s) {
    const items = s.items || [];
    if (!items.length) return "";
    let body;
    if (P.isTimeline(s.type)) {
      body = `<ul class="timeline">${items.map(renderTimelineItem).join("")}</ul>`;
    } else {
      body = `<ul class="chips">${items.map((it) => {
        const level = P.tr(it.level, lang);
        return `<li class="chip">${P.esc(P.tr(it.name, lang))}${level ? `<small>${P.esc(level)}</small>` : ""}</li>`;
      }).join("")}</ul>`;
    }
    return `<section class="section" id="${P.esc(s.id)}"><h2>${P.esc(P.tr(s.title, lang))}</h2>${body}</section>`;
  }

  function render() {
    if (!data) return;
    const p = data.profile || {};
    P.applyDir(lang);
    if (data.settings && data.settings.themeColor) {
      document.documentElement.style.setProperty("--accent", data.settings.themeColor);
    }
    const name = P.tr(p.name, lang);
    document.title = name + " | Portfolio";
    document.getElementById("brand").textContent = name;
    langBtn.textContent = P.ui("langToggle", lang);

    const summary = P.tr(p.summary, lang);
    app.innerHTML =
      renderHero(p) +
      (summary ? `<section class="section" id="about"><h2>${P.ui("about", lang)}</h2><p class="summary">${P.esc(summary)}</p></section>` : "") +
      (data.sections || []).filter((s) => s.visible !== false).map(renderSection).join("");

    document.getElementById("footer").textContent = "© " + new Date().getFullYear() + " " + name;
  }

  app.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action='cv']");
    if (btn) window.CV.download(data, lang);
  });

  langBtn.addEventListener("click", () => {
    lang = lang === "ar" ? "en" : "ar";
    if (!isPreview) P.setLang(lang);
    render();
  });

  // The admin page shows this page in an iframe and sends unsaved data for a live preview.
  window.addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== "preview") return;
    data = e.data.data;
    if (e.data.lang) lang = e.data.lang;
    render();
  });

  if (isPreview) {
    window.parent.postMessage({ type: "preview-ready" }, location.origin);
  }

  P.loadData()
    .then((d) => {
      if (data) return; // preview data already arrived
      data = d;
      lang = P.getLang(d.settings && d.settings.defaultLanguage);
      render();
    })
    .catch(() => {
      if (!data) app.innerHTML = `<div class="state">${P.ui("loadError", P.getLang())}</div>`;
    });
})();
