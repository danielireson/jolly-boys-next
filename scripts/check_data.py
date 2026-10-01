"""Check the source snapshot against the search acceptance examples."""
import json
from pathlib import Path

rows = json.loads((Path(__file__).resolve().parents[1] / 'src/properties.json').read_text())
assert len(rows) == 197
assert sum(p['own_beds_estimated'] for p in rows) == 20
assert all(p['bedrooms'] <= p['own_beds'] <= p['sleeps'] for p in rows)
assert all(p['drive_manchester_min'] and p['drive_london_min'] for p in rows)
assert sum(bool(p['nearest_shop_name']) for p in rows) > 150
dairy = next(p for p in rows if p['name'] == 'Dairy House Farm')
assert dairy['own_beds'] == 6
edderton = next(p for p in rows if p['name'] == 'Edderton Hall Country House')
assert (edderton['bedrooms'], len(edderton['bedroom_cards'])) == (12, 12)
assert (edderton['single_beds'], edderton['bunk_beds'], edderton['double_beds']) == (13, 1, 5)
assert edderton['own_beds'] == 20
assert (edderton['price_gbp'], edderton['available_start_date']) == (5765, '2027-09-10')
assert edderton['nearest_rail_name'].startswith('Welshpool') and round(edderton['nearest_rail_distance_km'], 1) == 4.2
assert 60 < edderton['drive_manchester_min'] < 180
print('Data checks passed: 197 listings, own beds within bedrooms..sleeps, drive times and shops, Edderton details')
