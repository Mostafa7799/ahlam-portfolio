# Ahlam Abdelwadod – Portfolio

A simple bilingual (English / العربية) portfolio, hosted for free on GitHub Pages.

- **Site:** https://mostafa7799.github.io/dr-ahlam/
- **Admin:** https://mostafa7799.github.io/dr-ahlam/admin.html

All content lives in one file, [`data/data.json`](data/data.json). The site, the CV and the admin page all use it.

## Editing the content (admin page)

1. Open **/admin.html** and paste your GitHub token (see below). It's remembered on that browser until you click **Log out**.
2. Edit anything: name, title, summary, contact details, photo, links, and every section and item. Each text field has EN and AR boxes.
   - Add, delete, reorder or hide sections (hidden sections are left out of the site and the CV).
   - Add, delete or reorder items and bullet points.
   - The right-hand pane shows a live preview. **CV preview** downloads the CV with your unsaved changes.
3. Click **Save** (or press Ctrl/⌘ + S). The live site updates in about 1 minute.

**Export** downloads a backup of `data.json`, and **Import** loads one back.

### Creating the admin token (one time)

1. On GitHub go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access:** *Only select repositories* → `dr-ahlam`.
3. **Permissions → Repository permissions → Contents:** *Read and write*.
4. Generate, copy the token and paste it into the admin page.

The token can only change this one repository. Anyone without it can open admin.html but can't save anything. If a token leaks, delete it on GitHub and make a new one.

## Download CV (ATS-friendly)

The **Download CV** button builds the CV from the same data, so it always matches the site.

- **English:** a direct PDF download with real, selectable text. It follows common ATS (Applicant Tracking System) rules:
  - One column, with no tables, images, icons or text boxes.
  - Standard headings and standard fonts.
  - Contact details in the body, not in a page header.
  - Only English text is used in this file, so fill in the EN fields.
- **Arabic:** opens a print-ready CV page. Choose **Save as PDF** in the print dialog.

Tips for a good ATS score:
- List the newest items first (use the ↑ ↓ buttons).
- Write dates as `MM/YYYY`, and use `Present` for current roles.
- Use the keywords from the job post in your skills and bullet points.

## Running locally

```sh
python3 -m http.server 8000
# open http://localhost:8000 and http://localhost:8000/admin.html
```

## Files

| Path | Purpose |
| --- | --- |
| `index.html`, `assets/js/app.js` | Public portfolio |
| `admin.html`, `assets/js/admin.js` | Admin editor (commits through the GitHub API) |
| `cv.html`, `assets/css/cv.css` | Print-ready CV (used for Arabic) |
| `assets/js/cv.js` | English ATS PDF generator (jsPDF) |
| `assets/js/i18n.js` | Language toggle and shared helpers |
| `data/data.json` | All content |
