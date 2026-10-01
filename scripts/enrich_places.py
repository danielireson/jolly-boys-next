"""Add drive times from Manchester/London and the nearest Booths or Waitrose: -> tmp/places.json.

Usage: python3 scripts/enrich_places.py

Routing uses the public OSRM demo server (OpenStreetMap roads, free-flow speeds, no traffic), so
requests are batched and throttled. Shops come from OpenStreetMap via Overpass and are cached in
tmp/raw/shops.json; delete it to refresh. Results are cached in tmp/places.json and only missing
properties are fetched again.
"""
import csv
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / 'tmp/csv_data_with_transport_with_beds.csv'
SHOPS = ROOT / 'tmp/raw/shops.json'
OUT = ROOT / 'tmp/places.json'

ORIGINS = {'manchester': (53.483959, -2.244644), 'london': (51.509865, -0.118092)}
OSRM = 'https://router.project-osrm.org/table/v1/driving/'
OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
SHOP_QUERY = """[out:json][timeout:120];
nwr["shop"~"^(supermarket|convenience)$"]["brand"~"^(Waitrose|Booths)",i](49.8,-8.7,60.9,1.8);
out center;"""
BATCH = 50
CANDIDATES = 10  # straight-line nearest can be across an estuary, so compare several by road
HEADERS = {'User-Agent': 'jolly-boys-next property search (static data build)'}


def fetch(url, data=None, tries=4):
    for attempt in range(tries):
        try:
            request = urllib.request.Request(url, data=data, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.loads(response.read())
        except Exception as error:
            if attempt == tries - 1:
                raise
            print(f'  retrying after {error}')
            time.sleep(5 * (attempt + 1))


def table(sources, destinations):
    """OSRM durations (min) and distances (km), one row per source."""
    coords = ';'.join(f'{lon:.6f},{lat:.6f}' for lat, lon in sources + destinations)
    query = urllib.parse.urlencode({
        'sources': ';'.join(str(i) for i in range(len(sources))),
        'destinations': ';'.join(str(i) for i in range(len(sources), len(sources) + len(destinations))),
        'annotations': 'duration,distance',
    })
    result = fetch(f'{OSRM}{coords}?{query}')
    time.sleep(1)
    if result.get('code') != 'Ok':
        raise RuntimeError(result)
    to_min = lambda v: None if v is None else round(v / 60)
    to_km = lambda v: None if v is None else round(v / 1000, 1)
    return ([[to_min(v) for v in row] for row in result['durations']],
            [[to_km(v) for v in row] for row in result['distances']])


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(a))


def load_shops():
    if not SHOPS.exists():
        print('Downloading Booths and Waitrose locations from Overpass ...')
        data = urllib.parse.urlencode({'data': SHOP_QUERY}).encode()
        for url in OVERPASS:
            try:
                result = fetch(url, data, tries=2)
                break
            except Exception as error:
                print(f'  {url} failed: {error}')
        else:
            raise SystemExit('Overpass unavailable, try again later')
        SHOPS.parent.mkdir(parents=True, exist_ok=True)
        SHOPS.write_text(json.dumps(result['elements']))
    shops = []
    for element in json.loads(SHOPS.read_text()):
        lat = element.get('lat') or element.get('center', {}).get('lat')
        lon = element.get('lon') or element.get('center', {}).get('lon')
        tags = element.get('tags', {})
        if lat is None or lon is None:
            continue
        brand = 'Booths' if 'booths' in tags.get('brand', '').lower() else 'Waitrose'
        place = tags.get('addr:city') or tags.get('addr:town') or tags.get('addr:suburb') or tags.get('addr:village') or ''
        if not place and '/find-a-store/' in tags.get('website', ''):
            # Many Waitrose branches only carry their store page, e.g. .../find-a-store/west-hampstead
            place = tags['website'].rstrip('/').rsplit('/', 1)[-1].replace('-', ' ').title()
        name = tags.get('name') or brand
        if place and place.lower() not in name.lower():
            name += f', {place}'
        shops.append({'name': name, 'brand': brand, 'lat': round(lat, 6), 'long': round(lon, 6)})
    print(f'Loaded {len(shops)} Booths/Waitrose shops')
    return shops


def main():
    with CSV.open(newline='', encoding='utf-8') as file:
        rows = [{'code': r['property_code'], 'lat': float(r['latitude']), 'lon': float(r['longitude'])}
                for r in csv.DictReader(file)]
    places = json.loads(OUT.read_text()) if OUT.exists() else {}

    todo = [r for r in rows if 'drive_london_min' not in places.get(r['code'], {})]
    for start in range(0, len(todo), BATCH):
        batch = todo[start:start + BATCH]
        print(f'Drive times {start + 1}-{start + len(batch)} of {len(todo)}')
        minutes, km = table(list(ORIGINS.values()), [(r['lat'], r['lon']) for r in batch])
        for i, r in enumerate(batch):
            entry = places.setdefault(r['code'], {})
            for j, origin in enumerate(ORIGINS):
                entry[f'drive_{origin}_min'] = minutes[j][i]
                entry[f'drive_{origin}_km'] = km[j][i]
        OUT.write_text(json.dumps(places, indent=1))

    shops = load_shops()
    # Refresh cached shop names in case the naming rules changed.
    names = {(s['lat'], s['long']): s['name'] for s in shops}
    for entry in places.values():
        key = (entry.get('nearest_shop_lat'), entry.get('nearest_shop_long'))
        if key in names:
            entry['nearest_shop_name'] = names[key]
    todo = [r for r in rows if not places.get(r['code'], {}).get('nearest_shop_name')]
    for n, r in enumerate(todo, 1):
        print(f'Nearest shop {n} of {len(todo)}')
        entry = places.setdefault(r['code'], {})
        near = sorted(((haversine_km(r['lat'], r['lon'], s['lat'], s['long']), s) for s in shops), key=lambda x: x[0])
        near = near[:CANDIDATES]
        minutes, km = table([(r['lat'], r['lon'])], [(s['lat'], s['long']) for _, s in near])
        # Pick the shortest drive; fall back to straight-line order if routing found nothing.
        options = [(km[0][i] if km[0][i] is not None else math.inf, i) for i in range(len(near))]
        best = min(options)[1]
        straight, shop = near[best]
        entry.update({
            'nearest_shop_name': shop['name'], 'nearest_shop_brand': shop['brand'],
            'nearest_shop_lat': shop['lat'], 'nearest_shop_long': shop['long'],
            'nearest_shop_distance_km': round(straight, 1),
            'nearest_shop_drive_km': km[0][best], 'nearest_shop_drive_min': minutes[0][best],
        })
        if n % 20 == 0:
            OUT.write_text(json.dumps(places, indent=1))
    OUT.write_text(json.dumps(places, indent=1))
    print(f'Wrote {len(places)} properties to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
