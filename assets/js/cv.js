// ATS-friendly CV.
// English: a real-text PDF built with jsPDF (single column, standard headings, no images/tables).
// Arabic: jsPDF cannot shape Arabic text, so we open cv.html, which the browser prints to PDF.
(function () {
  const P = window.Portfolio;
  const PREVIEW_KEY = "cv-preview-data";

  // jsPDF's built-in Helvetica only covers Latin-1, so map common typographic characters
  // and drop anything else (e.g. Arabic text left in an English field).
  function clean(s) {
    return String(s || "")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "")
      .replace(/[ \t]+/g, " ")
      .trim();
  }

  // English-only value: never fall back to Arabic in the English CV.
  const en = (v) => clean(typeof v === "string" ? v : v && v.en);

  function dateRange(it) {
    const start = clean(it.start);
    const end = clean(it.end);
    if (start && end) return start + " - " + end;
    return start || end;
  }

  // Public portfolio address: the saved setting, or this site's own address when served online.
  function portfolioUrl(data) {
    const saved = data.settings && data.settings.portfolioUrl;
    if (saved) return saved.trim();
    if (/^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname)) {
      return location.origin + location.pathname.replace(/[^/]*$/, "");
    }
    return "";
  }

  // Egyptian mobile numbers in international format (+20 1xx xxx xxxx) for recruiters abroad.
  function intlPhone(phone) {
    const d = phone.replace(/\D/g, "");
    if (/^01\d{9}$/.test(d)) return { text: `+20 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}`, url: "tel:+20" + d.slice(1) };
    return { text: phone, url: "tel:" + phone.replace(/[^\d+]/g, "") };
  }

  const shortUrl = (u) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    const n = m ? parseInt(m[1], 16) : 0x0e7c86;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // Layout rules kept for ATS parsers: one column, real text in reading order, standard
  // headings, standard font, no tables/images/icons, and contact details in the body
  // (not in a page header or footer). Colour and links don't affect parsing.
  function buildPdf(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
    const p = data.profile || {};
    const name = en(p.name);
    const url = portfolioUrl(data);

    const ACCENT = hexToRgb(data.settings && data.settings.themeColor);
    const INK = [24, 33, 43];
    const NAVY = [15, 42, 61];
    const GREY = [85, 96, 108];
    const RULE = [205, 212, 218];

    const skills = [];
    (data.sections || []).forEach((s) => {
      if (s.type === "skills" && s.visible !== false) (s.items || []).forEach((it) => en(it.name) && skills.push(en(it.name)));
    });
    doc.setProperties({
      title: name + " - CV",
      subject: (en(p.title) || "Curriculum Vitae") + " - CV",
      author: name,
      keywords: skills.join(", "),
      creator: url || "Portfolio"
    });

    const ML = 17, MT = 16, MB = 16;
    const PW = doc.internal.pageSize.getWidth();
    const PH = doc.internal.pageSize.getHeight();
    const W = PW - ML * 2;
    let y = MT;

    const lineH = (size, k) => size * 0.3528 * (k || 1.32);   // pt -> mm with line spacing
    const ensure = (h) => { if (y + h > PH - MB) { doc.addPage(); y = MT; } };
    const font = (size, style, color) => {
      doc.setFont("helvetica", style || "normal");
      doc.setFontSize(size);
      doc.setTextColor.apply(doc, color || INK);
    };

    // Wrapped paragraph. `hang` = extra indent for wrapped lines (used by bullets).
    function para(str, opts) {
      opts = opts || {};
      if (!str) return;
      const size = opts.size || 10;
      font(size, opts.style, opts.color);
      const lh = lineH(size, opts.k);
      const x = ML + (opts.indent || 0);
      doc.splitTextToSize(str, W - (opts.indent || 0)).forEach((line) => {
        ensure(lh);
        doc.text(line, x, y + lh * 0.78);
        y += lh;
      });
      y += opts.gap == null ? 1.2 : opts.gap;
    }

    function bullet(str) {
      const size = 10, lh = lineH(size), indent = 5;
      font(size);
      const lines = doc.splitTextToSize(str, W - indent);
      lines.forEach((line, i) => {
        ensure(lh);
        if (i === 0) doc.text("\u2022", ML + 1.2, y + lh * 0.78);
        doc.text(line, ML + indent, y + lh * 0.78);
        y += lh;
      });
      y += 0.5;
    }

    function heading(str) {
      ensure(18);                     // keep a heading with the first lines below it
      y += 4;
      font(11, "bold", ACCENT);
      doc.text(str.toUpperCase(), ML, y + 3.6);
      y += 5.2;
      doc.setDrawColor.apply(doc, RULE);
      doc.setLineWidth(0.3);
      doc.line(ML, y, ML + W, y);
      y += 3.2;
    }

    // Contact details as one centred line of " | "-separated text. The font shrinks a little
    // to keep everything on one line; only if it still can't fit does it wrap onto a second
    // centred line. Linked segments are clickable but remain plain, readable text.
    function contactBlock(segments) {
      const SEP = "  |  ";
      const segWidth = (seg) => {
        let w = 0;
        if (seg.label) { font(size, "bold"); w += doc.getTextWidth(seg.label + ": "); }
        font(size, "normal");
        return w + doc.getTextWidth(seg.text);
      };
      const lineWidth = (line) => { font(size, "normal"); return line.reduce((w, seg, i) => w + segWidth(seg) + (i ? doc.getTextWidth(SEP) : 0), 0); };

      let size = 9.5;
      while (size > 8 && lineWidth(segments) > W) size -= 0.25;
      const lines = [[]];
      segments.forEach((seg) => {
        const cur = lines[lines.length - 1];
        if (cur.length && lineWidth(cur.concat(seg)) > W) lines.push([seg]); else cur.push(seg);
      });

      const lh = lineH(size);
      lines.forEach((line) => {
        let x = ML + (W - lineWidth(line)) / 2;
        const base = y + lh * 0.78;
        line.forEach((seg, i) => {
          if (i) { font(size, "normal", GREY); doc.text(SEP, x, base); x += doc.getTextWidth(SEP); }
          if (seg.label) {
            font(size, "bold", GREY);
            doc.text(seg.label + ": ", x, base);
            x += doc.getTextWidth(seg.label + ": ");
          }
          font(size, "normal", seg.url ? ACCENT : GREY);
          doc.text(seg.text, x, base);
          if (seg.url) doc.link(x, y, doc.getTextWidth(seg.text), lh, { url: seg.url });
          x += doc.getTextWidth(seg.text);
        });
        y += lh;
      });
    }

    // ---------- header (centred) ----------
    const CX = ML + W / 2;
    font(22, "bold", NAVY);
    doc.splitTextToSize(name, W).forEach((line) => { doc.text(line, CX, y + 7.2, { align: "center" }); y += 9; });
    if (en(p.title)) { font(12.5, "normal", ACCENT); doc.text(en(p.title), CX, y + 4.4, { align: "center" }); y += 7; }

    const phone = clean(p.phone), email = clean(p.email), loc = en(p.location);
    const contact = [];
    if (phone) contact.push(intlPhone(phone));
    if (email) contact.push({ text: email, url: "mailto:" + email });
    if (loc) contact.push({ text: loc });
    if (url) contact.push({ label: "Portfolio", text: shortUrl(url), url });
    (p.links || []).filter((l) => clean(l.url)).forEach((l) => {
      contact.push({ label: clean(l.label) || "Link", text: shortUrl(clean(l.url)), url: clean(l.url) });
    });
    if (contact.length) contactBlock(contact);

    y += 2.5;
    doc.setDrawColor.apply(doc, ACCENT);
    doc.setLineWidth(0.7);
    doc.line(ML, y, ML + W, y);
    y += 1.5;

    // ---------- summary ----------
    const summary = en(p.summary);
    if (summary) {
      heading("Professional Summary");
      para(summary, { size: 10, k: 1.4 });
    }

    // ---------- sections ----------
    (data.sections || []).filter((s) => s.visible !== false && !P.isPortfolioOnly(s.type) && (s.items || []).length).forEach((s) => {
      const title = en(s.title) || s.id;
      if (P.isTimeline(s.type)) {
        heading(title);
        s.items.forEach((it, i) => {
          const t = en(it.title);
          const org = [en(it.org), en(it.location)].filter(Boolean).join(", ");
          if (!t && !org) return;
          if (i) y += 2.2;
          // Title on its own line, then "Organization, Location | dates": no side-by-side
          // columns, so parsers read everything in order.
          ensure(15);
          para(t || org, { size: 10.5, style: "bold", color: NAVY, gap: 0.3 });
          const meta = [t ? org : "", dateRange(it)].filter(Boolean).join("  |  ");
          if (meta) para(meta, { size: 9.5, style: "italic", color: GREY, gap: 0.8 });
          if (en(it.description)) para(en(it.description), { size: 10, gap: 0.6 });
          (it.bullets || []).map(en).filter(Boolean).forEach(bullet);
        });
      } else {
        const list = s.items
          .map((it) => {
            const n = en(it.name);
            const lvl = en(it.level);
            return n && lvl ? n + " (" + lvl + ")" : n;
          })
          .filter(Boolean);
        if (!list.length) return;
        heading(title);
        para(list.join(", "), { size: 10, k: 1.4 });
      }
    });

    return doc;
  }

  function fileName(data) {
    const base = (data.settings && data.settings.cvFileName) || "CV";
    return base.replace(/[^\w\-]+/g, "_") + ".pdf";
  }

  function download(data, lang, opts) {
    opts = opts || {};
    if (!data) return;
    if (lang === "ar" || !window.jspdf) {
      let url = "cv.html?lang=" + (lang === "ar" ? "ar" : "en") + "&print=1";
      if (opts.preview) {
        try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(data)); url += "&preview=1"; } catch (e) { /* ignore */ }
      }
      window.open(url, "_blank");
      return;
    }
    buildPdf(data).save(fileName(data));
  }

  window.CV = { download, buildPdf, PREVIEW_KEY };
})();
