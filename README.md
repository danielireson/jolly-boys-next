# Jolly boys next year

A static React, TypeScript and CSS app for exploring the 30 September 2026 cottage snapshot. It uses the collected CSV and review JSON in `tmp/`; no backend or account is required.

## Run locally

```sh
npm install
npm run data
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a deployable `dist/` directory. Static hosting works on Netlify, Vercel or GitHub Pages because all routes use query parameters.

## Data and privacy

`scripts/build_data.py` converts booleans and list fields, adds bedroom cards and captions, and writes `src/properties.json`. Run `npm run data` after the source CSV or `tmp/data.json` changes. `npm run check:data` checks the key snapshot facts and Edderton Hall example.

The UI reads only its bundled JSON. Wishlists, notes, votes and recently viewed codes are stored under `cottages:v1` in browser `localStorage`. Search and wishlist links encode their state in the URL. Import and export use local JSON files. Photos are loaded from chooseacottage and map tiles from OpenStreetMap; booking links open cottages.com.

Prices and availability are a dated snapshot. Transport distances are straight-line estimates. The app does not calculate travel times from group members' home locations because those origins have not been provided.
