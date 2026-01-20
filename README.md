# Cadet Compass (Track III – Educator)

Cadet Compass is a free-hosted website (GitHub Pages + Netlify) that helps grades 8–12 explore military pathways:
Service Academies, ROTC, enlistment, National Guard, and Reserves.

## What’s inside
- `site/` – static website (works on GitHub Pages)
- `netlify/functions/chat.js` – optional AI coach (Netlify Function). If no API key is set, the website uses local guidance.
- `netlify.toml` – Netlify configuration for serverless functions

## Deploy (recommended path)
### A) Frontend on GitHub Pages (free)
1. Create a GitHub repo named `cadet-compass`.
2. Upload the contents of `site/` to the repo root OR keep `site/` and configure GitHub Pages to publish `/site`.
3. Enable **Settings → Pages**.

### B) AI coach on Netlify (free)
1. Create a Netlify account.
2. “Add new site” → “Import from Git.” Select your repo.
3. In Netlify build settings:
   - Publish directory: `site`
   - Functions directory: `netlify/functions`
4. In Netlify: **Site settings → Environment variables**
   - `OPENAI_API_KEY` = your key
   - (optional) `OPENAI_MODEL` = `gpt-4o-mini` (or another supported model)

### Important privacy note
Do not enter personally identifying student information into the chat.

## Local preview
Open `site/index.html` in a browser.

## Edit content
- Text: edit the `.html` files in `site/`.
- Knowledge base: `site/data/knowledge_base.json`.

