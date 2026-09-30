"""Build the static, typed app payload from the collected CSV and review JSON."""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / 'tmp/csv_data_with_transport_with_beds.csv'
DETAILS = ROOT / 'tmp/data.json'
OUT = ROOT / 'src/properties.json'


def convert(value):
    if value == 'True': return True
    if value == 'False': return False
    return value


def bedroom_cards(layout):
    cards = []
    for line in layout.splitlines():
        match = re.match(r'^Bedroom\s+(\d+)\s*:\s*(.*)$', line, re.I)
        if match:
            cards.append({'number': int(match.group(1)), 'description': match.group(2).strip()})
    return sorted(cards, key=lambda card: card['number'])


number_fields = {'search_rank','star_grade','sleeps','bedrooms','bathrooms','max_pets','price_gbp','was_price_gbp','discount_gbp','price_per_person_gbp','security_deposit_gbp','rating_avg','review_count','score_value_for_money','score_comfort_equipment','score_location','score_cleanliness','score_local_amenities','latitude','longitude','nearest_rail_lat','nearest_rail_long','nearest_rail_distance_km','nearest_bus_lat','nearest_bus_long','nearest_bus_distance_km','bus_stops_within_1km','single_beds','zip_link_beds','bunk_beds','double_beds','max_single_sleepers','bed_capacity'}
list_fields = {'image_urls','whats_included','features_all','usps'}
selected = {'region','search_rank','property_code','name','url','property_type','location_town','location_full','county','latitude','longitude','sleeps','bedrooms','bathrooms','max_pets','pets_allowed','available_start_date','price_gbp','was_price_gbp','discount_gbp','price_per_person_gbp','security_deposit_gbp','rating_avg','review_count','score_value_for_money','score_comfort_equipment','score_location','score_cleanliness','score_local_amenities','awards','check_in_time','check_out_time','whats_included','smoking_allowed','parking_available','hot_tub_privacy','features_all','usps','short_description','long_description','room_layout','image_urls','nearest_bus_name','nearest_bus_lat','nearest_bus_long','nearest_bus_distance_km','nearest_rail_name','nearest_rail_lat','nearest_rail_long','nearest_rail_distance_km','bus_stops_within_1km','single_beds','zip_link_beds','bunk_beds','double_beds','max_single_sleepers','bed_capacity'}

with CSV.open(newline='', encoding='utf-8') as file:
    rows = list(csv.DictReader(file))
details = {entry['search_result']['code']: entry for entry in json.loads(DETAILS.read_text())}
output = []
for row in rows:
    selected_row = {key: convert(value) for key, value in row.items() if key in selected or (key in row and (key.startswith('feature_') or key in {'pool','games_room','ev_charger','enclosed_garden','wifi','dishwasher','parking_available','open_fire_woodburner','bbq','coastal_within_5mi','rural','luxury','level_access','ground_floor_bedroom'}))}
    for key in number_fields:
        if key in selected_row:
            value = selected_row[key]
            selected_row[key] = (float(value) if '.' in value else int(value)) if value != '' else None
    for key in list_fields:
        selected_row[key] = selected_row.get(key, '').split('|') if selected_row.get(key) else []
    selected_row['bedroom_cards'] = bedroom_cards(row['room_layout'])
    detail = details.get(row['property_code'], {})
    images = detail.get('search_result', {}).get('images', [])
    selected_row['image_captions'] = [image.get('caption') or row['name'] for image in images]
    reviews = detail.get('reviews') or {}
    selected_row['reviews'] = [{'score': review.get('overall_score'), 'comment': review.get('general_comments') or '', 'date': review.get('customer_departure_date')} for review in reviews.get('reviews', [])[:8] if review.get('general_comments')]
    output.append(selected_row)
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')))
print(f'Wrote {len(output)} properties to {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024 / 1024:.1f} MB)')
