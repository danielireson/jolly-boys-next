"""Build the static, typed app payload from the collected CSV and review JSON."""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV = ROOT / 'tmp/csv_data_with_transport_with_beds.csv'
DETAILS = ROOT / 'tmp/data.json'
PLACES = ROOT / 'tmp/places.json'
OUT = ROOT / 'src/properties.json'
PLACE_FIELDS = ['drive_manchester_min', 'drive_manchester_km', 'drive_london_min', 'drive_london_km', 'nearest_shop_name', 'nearest_shop_brand', 'nearest_shop_lat', 'nearest_shop_long', 'nearest_shop_distance_km', 'nearest_shop_drive_km', 'nearest_shop_drive_min']


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


def own_beds(row):
    """Most people who can each sleep alone: a double sleeps 1 alone, a zip and link splits into 2."""
    bedrooms, sleeps = int(row['bedrooms']), int(row['sleeps'])
    if not row['room_layout'].strip():
        return bedrooms, True
    n = lambda key: int(row[key] or 0)
    beds = (n('single_beds') + 2 * n('zip_link_beds') + n('bunk_sleeping_places') + n('sofa_beds_single')
            + n('sofa_beds_double') + n('day_pullout_beds') + n('double_beds'))
    # Every bedroom has at least one bed, even if the layout text didn't parse.
    return min(max(beds, bedrooms), sleeps), False


number_fields = {'search_rank','star_grade','sleeps','bedrooms','bathrooms','max_pets','price_gbp','was_price_gbp','discount_gbp','price_per_person_gbp','security_deposit_gbp','rating_avg','review_count','score_value_for_money','score_comfort_equipment','score_location','score_cleanliness','score_local_amenities','latitude','longitude','nearest_rail_lat','nearest_rail_long','nearest_rail_distance_km','nearest_bus_lat','nearest_bus_long','nearest_bus_distance_km','bus_stops_within_1km','single_beds','zip_link_beds','bunk_beds','double_beds','bed_capacity'}
list_fields = {'image_urls','whats_included','features_all','usps'}
selected = {'region','search_rank','property_code','name','url','property_type','location_town','location_full','county','latitude','longitude','sleeps','bedrooms','bathrooms','max_pets','pets_allowed','available_start_date','price_gbp','was_price_gbp','discount_gbp','price_per_person_gbp','security_deposit_gbp','rating_avg','review_count','score_value_for_money','score_comfort_equipment','score_location','score_cleanliness','score_local_amenities','awards','check_in_time','check_out_time','whats_included','smoking_allowed','parking_available','hot_tub_privacy','features_all','usps','short_description','long_description','room_layout','image_urls','nearest_bus_name','nearest_bus_lat','nearest_bus_long','nearest_bus_distance_km','nearest_rail_name','nearest_rail_lat','nearest_rail_long','nearest_rail_distance_km','bus_stops_within_1km','single_beds','zip_link_beds','bunk_beds','double_beds','bed_capacity'}

with CSV.open(newline='', encoding='utf-8') as file:
    rows = list(csv.DictReader(file))
places = json.loads(PLACES.read_text()) if PLACES.exists() else {}
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
    selected_row['own_beds'], selected_row['own_beds_estimated'] = own_beds(row)
    place = places.get(row['property_code'], {})
    selected_row.update({key: place.get(key) for key in PLACE_FIELDS})
    detail = details.get(row['property_code'], {})
    images = detail.get('search_result', {}).get('images', [])
    selected_row['image_captions'] = [image.get('caption') or row['name'] for image in images]
    reviews = detail.get('reviews') or {}
    selected_row['reviews'] = [{'score': review.get('overall_score'), 'comment': review.get('general_comments') or '', 'date': review.get('customer_departure_date')} for review in reviews.get('reviews', [])[:8] if review.get('general_comments')]
    output.append(selected_row)
OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')))
print(f'Wrote {len(output)} properties to {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024 / 1024:.1f} MB)')
