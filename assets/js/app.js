// Public portfolio: renders everything from data/data.json.
(function () {
  const P = window.Portfolio;
  const I = window.Icons.UI;
  const esc = P.esc;
  const app = document.getElementById("app");
  const nav = document.getElementById("nav");
  const navLinks = document.getElementById("navLinks");
  const navToggle = document.getElementById("navToggle");
  const langBtn = document.getElementById("langBtn");
  const isPreview = new URLSearchParams(location.search).has("preview");

  let data = null;
  let lang = "en";

  const t = (v) => P.tr(v, lang);
  const ui = (k) => P.ui(k, lang);
  const TYPE_ICON = { education: I.cap, experience: I.briefcase, projects: I.book, certificates: I.award, custom: I.check };
  const waLink = (n) => "https://wa.me/" + String(n || "").replace(/\D/g, "");
  const hasItems = (s) => s.visible !== false && (s.items || []).length > 0;

  function displayName(p) {
    return t(p.shortName) || t(p.name);
  }

  // Highlight the last word of the name in the accent color.
  function nameHtml(name) {
    const words = name.trim().split(/\s+/);
    if (words.length < 2) return esc(name);
    const last = words.pop();
    return `${esc(words.join(" "))} <span class="accent">${esc(last)}</span>`;
  }

  function sectionHead(eyebrow, title) {
    return `<div class="section-head reveal"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(title)}</h2></div>`;
  }

  // ---------- hero ----------
  function renderHero(p) {
    const photo = p.photo
      ? `<img src="${esc(p.photo)}" alt="${esc(displayName(p))}">`
      : `<div class="photo-placeholder">${window.Icons.SERVICE.tooth}</div>`;

    const stats = (p.stats || []).filter((s) => s.value || t(s.label));
    const edu = (data.sections || []).find((s) => s.type === "education" && hasItems(s));
    const firstEdu = edu && edu.items[0];
    const loc = t(p.location);

    return `
      <section class="hero" id="top">
        <div class="container hero-grid">
          <div class="hero-text">
            <span class="pill reveal">${window.Icons.SERVICE.tooth}${esc(t(p.title))}</span>
            <h1 class="reveal">${nameHtml(displayName(p))}</h1>
            ${t(p.tagline) ? `<p class="lead reveal">${esc(t(p.tagline))}</p>` : ""}
            <div class="hero-actions reveal">
              <button class="btn btn-primary" type="button" data-action="cv">${I.download}${ui("downloadCv")}</button>
              <a class="btn" href="#contact">${I.mail}${ui("contactMe")}</a>
            </div>
            ${stats.length ? `<ul class="stats reveal">${stats.map((s) =>
              `<li class="stat"><strong>${esc(s.value)}</strong><span>${esc(t(s.label))}</span></li>`).join("")}</ul>` : ""}
          </div>
          <div class="hero-visual reveal">
            <div class="photo-frame">${photo}</div>
            ${loc ? `<div class="float-card fc-1"><span class="ic">${I.pin}</span><div><strong>${esc(t(p.title))}</strong><span>${esc(loc)}</span></div></div>` : ""}
            ${firstEdu ? `<div class="float-card fc-2"><span class="ic">${I.cap}</span><div><strong>${esc(t(firstEdu.title))}</strong><span>${esc(t(firstEdu.org))}</span></div></div>` : ""}
          </div>
        </div>
      </section>`;
  }

  // ---------- about ----------
  function renderAbout(p, alt) {
    const summary = t(p.summary);
    const facts = [
      [I.user, ui("fullName"), `<b>${esc(t(p.name))}</b>`],
      t(p.title) && [window.Icons.SERVICE.tooth, ui("specialty"), `<b>${esc(t(p.title))}</b>`],
      t(p.location) && [I.pin, ui("location"), `<b>${esc(t(p.location))}</b>`],
      p.phone && [I.phone, ui("phone"), `<a class="ltr" href="tel:${esc(p.phone)}">${esc(p.phone)}</a>`],
      p.email && [I.mail, ui("email"), `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`]
    ].concat((p.links || []).filter((l) => l.url).map((l) =>
      [I.link, esc(l.label || "Link"), `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.url.replace(/^https?:\/\/(www\.)?/, ""))}</a>`]
    )).filter(Boolean);

    return `
      <section class="band${alt ? " alt" : ""}" id="about">
        <div class="container about-grid">
          <div class="about-text">
            ${sectionHead(ui("aboutEyebrow"), ui("about"))}
            ${summary ? `<p class="reveal">${esc(summary)}</p>` : ""}
          </div>
          <aside class="facts reveal">
            <h3>${ui("quickFacts")}</h3>
            <ul>${facts.map(([ic, label, val]) => `<li><span class="ic">${ic}</span><div><small>${label}</small>${val}</div></li>`).join("")}</ul>
          </aside>
        </div>
      </section>`;
  }

  // ---------- sections ----------
  function renderTimeline(s) {
    return `<ol class="timeline">${s.items.map((it) => {
      const title = t(it.title) || t(it.org);
      const org = [t(it.title) ? t(it.org) : "", t(it.location)].filter(Boolean).join(" · ");
      const date = P.dateRange(it, lang);
      const bullets = (it.bullets || []).map(t).filter(Boolean);
      return `
        <li class="tl reveal">
          <span class="tl-dot">${TYPE_ICON[s.type] || I.check}</span>
          <div class="tl-card">
            <div class="tl-top"><h3>${esc(title)}</h3>${date ? `<span class="tl-date">${I.calendar}${esc(date)}</span>` : ""}</div>
            ${org ? `<p class="tl-org">${esc(org)}</p>` : ""}
            ${t(it.description) ? `<p class="tl-desc">${esc(t(it.description))}</p>` : ""}
            ${bullets.length ? `<ul class="tl-bullets">${bullets.map((b) => `<li>${I.check}<span>${esc(b)}</span></li>`).join("")}</ul>` : ""}
          </div>
        </li>`;
    }).join("")}</ol>`;
  }

  function renderServices(s) {
    return `<div class="services">${s.items.map((it) => `
      <article class="service reveal">
        <span class="service-icon">${window.Icons.service(it.icon)}</span>
        <h3>${esc(t(it.name))}</h3>
        ${t(it.description) ? `<p>${esc(t(it.description))}</p>` : ""}
      </article>`).join("")}</div>`;
  }

  function renderSkills(s) {
    return `<ul class="skills">${s.items.filter((it) => t(it.name)).map((it) => `
      <li class="skill reveal"><span class="ic">${I.check}</span><span>${esc(t(it.name))}</span>${t(it.level) ? `<small>${esc(t(it.level))}</small>` : ""}</li>`).join("")}</ul>`;
  }

  function renderLanguages(s) {
    return `<ul class="langs">${s.items.filter((it) => t(it.name)).map((it) => `
      <li class="lang-card reveal"><span class="ic">${I.globe}</span><div><strong>${esc(t(it.name))}</strong>${t(it.level) ? `<span>${esc(t(it.level))}</span>` : ""}</div></li>`).join("")}</ul>`;
  }

  function renderSection(s, alt) {
    let body;
    if (P.isCards(s.type)) body = renderServices(s);
    else if (P.isTimeline(s.type)) body = renderTimeline(s);
    else if (s.type === "languages") body = renderLanguages(s);
    else body = renderSkills(s);
    return `
      <section class="band${alt ? " alt" : ""}" id="${esc(s.id)}">
        <div class="container">
          ${sectionHead(ui("eyebrow_" + s.type), t(s.title))}
          ${body}
        </div>
      </section>`;
  }

  // ---------- contact ----------
  function renderContact(p) {
    const rows = [
      p.whatsapp && `<a href="${waLink(p.whatsapp)}" target="_blank" rel="noopener"><span class="ic">${I.whatsapp}</span><div><small>${ui("whatsapp")}</small><b class="ltr">+${esc(String(p.whatsapp).replace(/\D/g, ""))}</b></div></a>`,
      p.phone && `<a href="tel:${esc(p.phone)}"><span class="ic">${I.phone}</span><div><small>${ui("phone")}</small><b class="ltr">${esc(p.phone)}</b></div></a>`,
      p.email && `<a href="mailto:${esc(p.email)}"><span class="ic">${I.mail}</span><div><small>${ui("email")}</small><b>${esc(p.email)}</b></div></a>`,
      t(p.location) && `<div><span class="ic">${I.pin}</span><div><small>${ui("location")}</small><b>${esc(t(p.location))}</b></div></div>`
    ].filter(Boolean);

    return `
      <section class="contact" id="contact">
        <div class="container">
          <div class="contact-card reveal">
            <div style="position:relative;z-index:1">
              <span class="eyebrow">${ui("contactEyebrow")}</span>
              <h2>${ui("contactTitle")}</h2>
              <p>${ui("contactText")}</p>
              <div class="hero-actions">
                ${p.whatsapp ? `<a class="btn btn-wa" href="${waLink(p.whatsapp)}" target="_blank" rel="noopener">${I.whatsapp}${ui("chatWhatsapp")}</a>` : ""}
                <button class="btn btn-light" type="button" data-action="cv">${I.download}${ui("downloadCv")}</button>
              </div>
            </div>
            <ul class="contact-list">${rows.map((r) => `<li>${r}</li>`).join("")}</ul>
          </div>
        </div>
      </section>`;
  }

  // ---------- page ----------
  function render() {
    if (!data) return;
    const p = data.profile || {};
    const name = displayName(p);
    P.applyDir(lang);
    if (data.settings && data.settings.themeColor) {
      document.documentElement.style.setProperty("--accent", data.settings.themeColor);
    }
    document.title = name + (t(p.title) ? " | " + t(p.title) : "");

    const sections = (data.sections || []).filter(hasItems);

    // Navigation: About, the first few sections, Contact.
    document.getElementById("brandMark").innerHTML = window.Icons.SERVICE.tooth;
    document.getElementById("brandName").textContent = name;
    langBtn.textContent = ui("langToggle");
    navToggle.innerHTML = I.menu;
    navLinks.innerHTML = [`<a href="#about">${ui("about")}</a>`]
      .concat(sections.slice(0, 4).map((s) => `<a href="#${esc(s.id)}">${esc(t(s.title))}</a>`))
      .concat(`<a href="#contact">${ui("contact")}</a>`).join("");

    app.innerHTML =
      renderHero(p) +
      renderAbout(p, false) +
      sections.map((s, i) => renderSection(s, i % 2 === 0)).join("") +
      renderContact(p);

    document.getElementById("footer").innerHTML = `
      <div class="container">
        <a class="brand" href="#top"><span class="brand-mark">${window.Icons.SERVICE.tooth}</span><span class="brand-name">${esc(name)}</span></a>
        <span>© ${new Date().getFullYear()} ${esc(t(p.name))}. ${ui("rights")}</span>
      </div>`;

    reveal();
  }

  // Fade sections in as they scroll into view.
  let observer = null;
  function reveal() {
    const els = app.querySelectorAll(".reveal");
    if (isPreview || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    if (observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); observer.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach((el) => observer.observe(el));
  }

  function closeMenu() {
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.innerHTML = I.menu;
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-action='cv']")) window.CV.download(data, lang);
    if (e.target.closest(".nav-links a")) closeMenu();
  });

  navToggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.innerHTML = open ? I.close : I.menu;
  });

  window.addEventListener("scroll", () => nav.classList.toggle("scrolled", window.scrollY > 8), { passive: true });

  langBtn.addEventListener("click", () => {
    lang = lang === "ar" ? "en" : "ar";
    if (!isPreview) P.setLang(lang);
    closeMenu();
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
    document.documentElement.classList.add("no-anim");
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
