# GetBakinGood: A simple guide to get baking right, on your very first try

This repo contains:

- **Excel dashboard** (`data/GetBakinGood.xlsx`) — the editable “source of truth” for presets + conversion rules.
- **Static website** (`public/`) — a clean web UI that loads JSON exported from the Excel file.
- **Exporter script** (`scripts/export_presets.py`) — converts Excel tables → JSON used by the site.

---

## 1) Local preview (website)

From the repo root:

```bash
cd public
python -m http.server 8787
```

Open `http://localhost:8787`

> Why a local server? Browsers block `fetch()` for local files opened as `file://`.

---

## 2) Edit presets / rules (Excel → website)

1. Open `data/GetBakinGood.xlsx`
2. Update:
   - `Presets` sheet (dish list)
   - `Rules` sheet (device + mode conversions)
3. Export JSON:

```bash
python scripts/export_presets.py --xlsx data/GetBakinGood.xlsx --out data --public public/data
```

4. Refresh the local preview.

---

## 3) Deploy on Cloudflare Pages (GitHub)

### A) Create a GitHub repo

```bash
git init
git add .
git commit -m "Initial commit: GetBakinGood"
git branch -M main
```

Create an empty repository on GitHub, then:

```bash
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

### B) Connect Cloudflare Pages

In Cloudflare Dashboard → **Pages** → **Create a project** → connect your GitHub repo.

Use:

- **Framework preset:** None
- **Build command:** (leave empty)
- **Build output directory:** `public`

Deploy. Your site will be live on a `*.pages.dev` URL.

---

## 4) Folder structure

```
.
├─ data/
│  ├─ GetBakinGood.xlsx
│  ├─ presets.json
│  └─ conversion_rules.json
├─ public/
│  ├─ index.html
│  ├─ styles.css
│  ├─ app.js
│  ├─ favicon.svg
│  └─ data/
│     ├─ GetBakinGood.xlsx
│     ├─ presets.json
│     └─ conversion_rules.json
└─ scripts/
   └─ export_presets.py
```

---

## Notes & safety

- These are **starting-point** conversions. Device models vary; check early on your first attempt.
- For meat/fish, use an instant-read thermometer and follow trusted food-safety guidance.
