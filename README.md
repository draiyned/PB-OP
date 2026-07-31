# Open Play Generator By draiyned 

A pickleball open-play court rotation manager. Pure HTML, CSS, and vanilla JavaScript —
no frameworks, no build step, no CDN, no dependencies of any kind.

## Files
- `index.html` — page shell
- `style.css` — all styling
- `app.js` — all app logic and rendering (plain JavaScript, no JSX/React/Babel)

## Run locally
Because there are no external scripts or fetch-based loading, this works either way:

**Option A — just open the file**
Double-click `index.html`, or drag it into a browser tab. It should work directly.

**Option B — serve it (recommended for consistency across browsers)**
```bash
cd path/to/this/folder
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```
or, with Node:
```bash
npx serve .
```

## Deploy to GitHub Pages
1. Push `index.html`, `style.css`, and `app.js` to a repo (keep them at the repo root, or in `/docs` if that's your configured Pages folder).
2. In the repo: **Settings → Pages → Source**, pick the branch/folder containing `index.html`.
3. Your site will be live at `https://<username>.github.io/<repo>/`.

## Deploy to Vercel
1. Push the repo to GitHub (or drag-and-drop the folder into the Vercel dashboard).
2. In Vercel: **Add New Project → Import** the repo.
3. Framework preset: **Other** (static HTML/CSS/JS, no build command needed).
4. Deploy.

## Why this version instead of the React/Babel/Tailwind one
The earlier version loaded React, Babel Standalone, and Tailwind from CDNs at runtime.
That's convenient, but it has two failure modes this version removes entirely:
- It needs internet access to those CDNs, and can be blocked by browser content-blocking
  (ad blockers, Brave Shields, etc.) or restrictive networks.
- Babel Standalone loaded the app code via a background `fetch()`, which some browsers
  block when the page is opened directly as a `file://` URL.

This version has zero external requests and uses a plain `<script src="app.js">` tag,
so both of those failure modes are gone.
