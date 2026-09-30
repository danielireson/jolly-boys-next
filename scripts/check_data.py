"""Check the source snapshot against the search acceptance examples."""
import json
from pathlib import Path

rows = json.loads((Path(__file__).resolve().parents[1] / 'src/properties.json').read_text())
assert len(rows) == 197
assert sum(p['max_single_sleepers'] is None for p in rows) == 20
private = [p for p in rows if p['sleeps'] >= 6 and p['hot_tub_privacy'] == 'Private']
assert sum(p['max_single_sleepers'] is not None and p['max_single_sleepers'] >= 6 for p in private) == 94
assert sum(p['single_beds'] is not None and p['single_beds'] >= 6 for p in private) == 67
edderton = next(p for p in rows if p['name'] == 'Edderton Hall Country House')
assert (edderton['bedrooms'], len(edderton['bedroom_cards'])) == (12, 12)
assert (edderton['single_beds'], edderton['bunk_beds'], edderton['double_beds']) == (13, 1, 5)
assert (edderton['price_gbp'], edderton['available_start_date']) == (5765, '2027-09-10')
assert edderton['nearest_rail_name'].startswith('Welshpool') and round(edderton['nearest_rail_distance_km'], 1) == 4.2
print('Data checks passed: 197 listings, 20 unknown beds, 94/67 filtered listings, Edderton details')
