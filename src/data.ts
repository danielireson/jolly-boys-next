import raw from "./properties.json";
import type { Property, Search, Filters } from "./types";
export const properties = raw as Property[];
export const categories = [
  ["All", "all", "⌂"],
  ["Pool", "pool", "◉"],
  ["Coastal", "coastal_within_5mi", "≈"],
  ["Sea view", "feature_sea_view", "◭"],
  ["Rural", "rural", "♧"],
  ["Luxury", "luxury", "✧"],
  ["Games room", "games_room", "⚄"],
  ["Cinema", "feature_cinema_room", "▣"],
  ["Pet-friendly", "pets_allowed", "♶"],
  ["Barn conversion", "feature_barn_conversion", "⌑"],
  ["Historic", "feature_historical_property", "♜"],
  ["Working farm", "feature_working_farm", "♣"],
  ["Waterside", "feature_waterside_breaks", "⌁"],
  ["Sauna", "feature_sauna", "♨"],
] as const;
export const amenities = [
  ["Pool", "pool"],
  ["Games room", "games_room"],
  ["EV charger", "ev_charger"],
  ["Enclosed garden", "enclosed_garden"],
  ["Wi-Fi", "wifi"],
  ["Dishwasher", "dishwasher"],
  ["Parking", "parking_available"],
  ["Woodburner", "open_fire_woodburner"],
  ["BBQ", "bbq"],
  ["Sauna", "feature_sauna"],
  ["Cinema room", "feature_cinema_room"],
  ["Sea view", "feature_sea_view"],
  ["Cot", "cot"],
  ["Highchair", "highchair"],
  ["Washing machine", "washing_machine"],
] as const;
export const defaultFilters: Filters = {
  priceMin: 0,
  priceMax: 30000,
  bedrooms: 0,
  bathrooms: 0,
  ownBeds: 0,
  strict: false,
  includeUnknown: false,
  privateHotTub: false,
  railKm: 0,
  busKm: 0,
  amenities: [],
  favourite: false,
  minRating: 0,
  minCleanliness: 0,
  levelAccess: false,
  groundFloor: false,
  wheelchair: false,
  pets: false,
  keyword: "",
};
export const defaultSearch: Search = {
  where: "",
  startMin: "2027-09-04",
  startMax: "2027-09-18",
  guests: 6,
  everyoneBed: false,
  category: "all",
  sort: "recommended",
  filters: defaultFilters,
  view: "list",
};
export const money = (n: number | null | undefined) =>
  n == null ? "—" : "£" + Math.round(n).toLocaleString("en-GB");
export const dateText = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export const has = (p: Property, key: string) => p[key] === true;
export function isFavourite(p: Property) {
  return has(p, "feature_customers_choice") || p.awards.includes("Customers' Choice");
}
export function match(p: Property, s: Search, ignoreCategory = false) {
  const f = s.filters;
  if (
    s.where &&
    ![p.region, p.county, p.location_town, p.location_full].some((v) =>
      v.toLowerCase().includes(s.where.toLowerCase()),
    )
  )
    return false;
  if (
    p.available_start_date < s.startMin ||
    p.available_start_date > s.startMax ||
    p.sleeps < s.guests
  )
    return false;
  if (!ignoreCategory && s.category !== "all" && !has(p, s.category)) return false;
  if (
    s.everyoneBed &&
    p.max_single_sleepers !== null &&
    (s.filters.strict ? p.single_beds : p.max_single_sleepers)! < s.guests
  )
    return false;
  if (s.everyoneBed && p.max_single_sleepers === null && !f.includeUnknown) return false;
  const price = p.price_gbp;
  if (
    price < f.priceMin ||
    price > f.priceMax ||
    p.bedrooms < f.bedrooms ||
    p.bathrooms < f.bathrooms
  )
    return false;
  const beds = f.strict ? p.single_beds : p.max_single_sleepers;
  if (f.ownBeds > 0 && beds !== null && beds < f.ownBeds) return false;
  if (f.ownBeds > 0 && beds === null && !f.includeUnknown) return false;
  if (f.privateHotTub && p.hot_tub_privacy !== "Private") return false;
  if (
    f.railKm > 0 &&
    (p.nearest_rail_distance_km === null || p.nearest_rail_distance_km > f.railKm)
  )
    return false;
  if (f.busKm > 0 && (p.nearest_bus_distance_km === null || p.nearest_bus_distance_km > f.busKm))
    return false;
  if (f.amenities.some((key) => !has(p, key))) return false;
  if (f.favourite && !isFavourite(p)) return false;
  if (f.minRating && (p.rating_avg === null || p.rating_avg < f.minRating)) return false;
  if (f.minCleanliness && (p.score_cleanliness === null || p.score_cleanliness < f.minCleanliness))
    return false;
  if (
    (f.levelAccess && !has(p, "level_access")) ||
    (f.groundFloor && !has(p, "ground_floor_bedroom")) ||
    (f.wheelchair && !has(p, "feature_wheelchair_accessible")) ||
    (f.pets && !has(p, "pets_allowed"))
  )
    return false;
  if (
    f.keyword &&
    ![p.long_description, p.room_layout, p.features_all.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(f.keyword.toLowerCase())
  )
    return false;
  return true;
}
export function sorted(rows: Property[], sort: string) {
  const copy = [...rows];
  const n = (x: number | null) => x ?? -1;
  return copy.sort((a, b) =>
    sort === "price"
      ? a.price_gbp - b.price_gbp
      : sort === "rating"
        ? n(b.rating_avg) - n(a.rating_avg)
        : sort === "rail"
          ? (a.nearest_rail_distance_km ?? 999) - (b.nearest_rail_distance_km ?? 999)
          : sort === "discount"
            ? (b.discount_gbp ?? 0) - (a.discount_gbp ?? 0)
            : a.search_rank - b.search_rank,
  );
}
export function activeCount(f: Filters) {
  return Object.entries(f).filter(
    ([k, v]) => JSON.stringify(v) !== JSON.stringify(defaultFilters[k as keyof Filters]),
  ).length;
}
