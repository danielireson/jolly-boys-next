# Jolly boys next year

A static React, TypeScript and CSS app for exploring the 30 September 2026 property snapshot. It uses the collected CSV and review JSON in `tmp/`; no backend or account is required.

## Run locally

```sh
npm install
npm run data
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates a deployable `dist/` directory. Static hosting works on Netlify, Vercel or GitHub Pages because all routes use query parameters.

## Data and privacy

`scripts/build_data.py` converts booleans and list fields, adds bedroom cards and captions, and writes `src/properties.json`. `scripts/enrich_places.py` (`npm run places`) adds drive times from Manchester and London and the nearest Booths or Waitrose, writing `tmp/places.json`. Routes come from the public OSRM demo server (OpenStreetMap roads, free-flow speeds, no traffic) and shops from OpenStreetMap via Overpass. Results are cached, so only new properties are fetched. Run `npm run data` after the source CSV or `tmp/data.json` changes. `npm run check:data` checks the key snapshot facts and Edderton Hall example.

The UI reads only its bundled JSON. Wishlists, notes, votes and recently viewed codes are stored under `properties:v1` in browser `localStorage` (data saved under the old `cottages:v1` key is carried over). Search and wishlist links encode their state in the URL. Import and export use local JSON files. Photos are loaded from chooseacottage and map tiles from OpenStreetMap; booking links open cottages.com.

Prices and availability are a dated snapshot. Rail and bus distances are straight-line estimates. Drive times and supermarket distances are road estimates without traffic.
