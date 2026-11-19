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

  function buildPdf(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const p = data.profile || {};
    const name = en(p.name);

    doc.setProperties({ title: name + " - CV", author: name, subject: "Curriculum Vitae" });

    const M = 18;                                   // margin
    const W = doc.internal.pageSize.getWidth() - M * 2;
    const H = doc.internal.pageSize.getHeight();
    let y = M;

    const ensure = (h) => { if (y + h > H - M) { doc.addPage(); y = M; } };

    function text(str, { size = 10.5, bold = false, gap = 1.4, indent = 0, color = 20 } = {}) {
      if (!str) return;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      doc.setTextColor(color);
      const lh = size * 0.3528 * 1.35;               // pt -> mm, with line spacing
      doc.splitTextToSize(str, W - indent).forEach((line) => {
        ensure(lh);
        doc.text(line, M + indent, y + lh * 0.75);
        y += lh;
      });
      y += gap;
    }

    function heading(str) {
      ensure(14);
      y += 3;
      text(str.toUpperCase(), { size: 11.5, bold: true, gap: 0.8 });
      doc.setDrawColor(120);
      doc.setLineWidth(0.3);
      doc.line(M, y, M + W, y);
      y += 3;
    }

    // Header: name, title and contact details in the body (not in a PDF header/footer).
    text(name, { size: 20, bold: true, gap: 0.5 });
    text(en(p.title), { size: 12, gap: 1.5, color: 60 });
    const contact = [clean(p.phone), clean(p.email), en(p.location)]
      .concat((p.links || []).map((l) => clean(l.url)))
      .filter(Boolean);
    text(contact.join(" | "), { size: 10, gap: 1, color: 60 });

    const summary = en(p.summary);
    if (summary) {
      heading("Summary");
      text(summary);
    }

    (data.sections || []).filter((s) => s.visible !== false && (s.items || []).length).forEach((s) => {
      const title = en(s.title) || s.id;
      if (P.isTimeline(s.type)) {
        heading(title);
        s.items.forEach((it) => {
          const t = en(it.title);
          const org = [en(it.org), en(it.location)].filter(Boolean).join(", ");
          if (!t && !org) return;
          // Title on its own line, then "Organization, Location | dates" as plain text:
          // no right-aligned columns, so ATS parsers read it in order.
          ensure(14);
          text(t || org, { bold: true, gap: 0.4 });
          const meta = [t ? org : "", dateRange(it)].filter(Boolean).join(" | ");
          text(meta, { gap: 0.6, color: 60 });
          text(en(it.description), { gap: 0.6 });
          (it.bullets || []).map(en).filter(Boolean).forEach((b) => {
            text("- " + b, { indent: 3, gap: 0.3 });
          });
          y += 2.5;
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
        text(list.join(", "));
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
