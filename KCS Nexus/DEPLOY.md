# Mettre le site en ligne rapidement

Ce projet est désormais **statique** (HTML/CSS/JS) et peut être publié sans build.

## Option 1 — Netlify (le plus simple)
1. Va sur https://app.netlify.com/drop
2. Glisse-dépose le dossier du projet (`KcswebSite`) ou un `.zip`.
3. Netlify te génère instantanément une URL publique.

> Le fichier `netlify.toml` est déjà configuré pour servir `index.html`.

## Option 2 — Vercel
1. Push le repo sur GitHub.
2. Importe le repo dans Vercel.
3. Déploie (pas de build requis).

> Le fichier `vercel.json` inclut une réécriture vers `index.html`.

## Option 3 — GitHub Pages
1. Push le repo sur GitHub.
2. Dans **Settings > Pages**, choisis la branche (ex: `main`) et le dossier `/ (root)`.
3. Sauvegarde : une URL GitHub Pages sera générée.

---

## Vérification locale
```bash
python3 -m http.server 4173
```
Puis ouvre `http://localhost:4173`.
