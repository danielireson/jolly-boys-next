import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Map as MapIcon,
  List,
  X,
  ChevronLeft,
  ChevronRight,
  Train,
  Car,
  ShoppingBasket,
  BedDouble,
  Star,
  Check,
  ArrowLeft,
} from "lucide-react";
import MapView from "./MapView";
import type { Property, Search, Store } from "./types";
import {
  properties,
  categories,
  amenities,
  defaultFilters,
  defaultSearch,
  money,
  dateText,
  duration,
  toQuery,
  fromQuery,
  searchKeys,
  match,
  sorted,
  isFavourite,
} from "./data";
import "leaflet/dist/leaflet.css";
import "./style.css";

const STORE_KEY = "properties:v1";
const OLD_STORE_KEY = "cottages:v1";
const blankStore: Store = { recent: [] };
function readStore(): Store {
  try {
    // Carry over recently viewed items saved before the rename.
    const old = localStorage.getItem(OLD_STORE_KEY);
    if (old !== null) {
      if (localStorage.getItem(STORE_KEY) === null) localStorage.setItem(STORE_KEY, old);
      localStorage.removeItem(OLD_STORE_KEY);
    }
    return { ...blankStore, ...JSON.parse(localStorage.getItem(STORE_KEY) || "{}") };
  } catch {
    return blankStore;
  }
}
function parseSearch(): Search {
  const q = new URLSearchParams(location.search);
  // Older links stored the whole search as JSON in ?s=
  try {
    const raw = q.get("s");
    if (raw) {
      const s = JSON.parse(raw);
      return {
        ...defaultSearch,
        ...s,
        view: s.view === "map" ? "map" : "list",
        filters: { ...defaultFilters, ...s.filters },
      };
    }
  } catch {}
  return fromQuery(q);
}
function getPage() {
  const q = new URLSearchParams(location.search);
  return {
    listing: q.get("listing"),
  };
}
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const focusable = [
          ...ref.current.querySelectorAll<HTMLElement>("button,input,select,textarea,a[href]"),
        ].filter((x) => !x.hasAttribute("disabled"));
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <header className="modal-head">
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
          <strong>{title}</strong>
          <span />
        </header>
        {children}
      </div>
    </div>
  );
}
function Carousel({ p, hero = false }: { p: Property; hero?: boolean }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const swiped = useRef(false);
  const imgs = p.image_urls;
  const step = (by: number) => setIndex((i) => (i + by + imgs.length) % imgs.length);
  return (
    <div
      className={`carousel ${hero ? "hero-carousel" : ""}`}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
        swiped.current = false;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null || imgs.length < 2) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) < 40) return;
        swiped.current = true;
        step(dx < 0 ? 1 : -1);
      }}
      onClickCapture={(e) => {
        // A swipe still fires a click on the photo; don't open the listing.
        if (swiped.current) {
          e.stopPropagation();
          swiped.current = false;
        }
      }}
    >
      <img
        loading={hero ? "eager" : "lazy"}
        src={imgs[index] || ""}
        alt={p.image_captions[index] || `${p.name} photo ${index + 1}`}
      />
      {imgs.length > 1 && (
        <>
          <button
            className="carousel-prev"
            aria-label="Previous photo"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="carousel-next"
            aria-label="Next photo"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
          >
            <ChevronRight size={18} />
          </button>
          <div className="dots" aria-label={`Photo ${index + 1} of ${imgs.length}`}>
            {imgs.slice(Math.max(0, index - 2), Math.min(imgs.length, index + 3)).map((_, i) => (
              <b key={i} className={Math.max(0, index - 2) + i === index ? "on" : ""} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
function Card({
  p,
  onOpen,
  onHover,
}: {
  p: Property;
  onOpen: (p: Property) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <article
      className="card"
      onMouseEnter={() => onHover(p.property_code)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="card-photo" onClick={() => onOpen(p)}>
        <Carousel p={p} />
        {isFavourite(p) && <span className="photo-badge">Guest favourite</span>}
        {!!p.discount_gbp && p.discount_gbp > 0 && (
          <span className="discount-badge">{money(p.discount_gbp)} off</span>
        )}
      </div>
      <button className="card-body" onClick={() => onOpen(p)}>
        <div className="card-title">
          <strong>{p.location_full}</strong>
          <span>{p.review_count ? `★ ${p.rating_avg} (${p.review_count})` : "New"}</span>
        </div>
        <p className="card-name">{p.name}</p>
        <p>
          {p.bedrooms} bedrooms · {p.sleeps} guests · Beds: {p.own_beds}
          {p.own_beds_estimated ? "+" : ""} own
        </p>
        <p>
          <Train size={14} />
          {p.nearest_rail_name
            ? `${p.nearest_rail_distance_km?.toFixed(1)} km to station`
            : "Station unknown"}
        </p>
        <p className="card-price">
          {p.was_price_gbp && p.was_price_gbp > p.price_gbp && <del>{money(p.was_price_gbp)}</del>}{" "}
          <strong>{money(p.price_gbp)}</strong> for 7 nights
        </p>
        <small>{dateText(p.available_start_date)} · 7 nights</small>
      </button>
    </article>
  );
}
function Listing({
  p,
  onBack,
  store,
  onStore,
}: {
  p: Property;
  onBack: () => void;
  store: Store;
  onStore: (s: Store) => void;
}) {
  const [gallery, setGallery] = useState(false),
    [amenityModal, setAmenityModal] = useState(false),
    [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!store.recent.includes(p.property_code))
      onStore({ ...store, recent: [p.property_code, ...store.recent].slice(0, 12) });
  }, [p.property_code]);
  const labels = amenities.filter(([, key]) => p[key] === true).map(([label]) => label);
  return (
    <>
      <main className="listing wrap">
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={18} /> All properties
        </button>
        <div className="listing-heading">
          <div>
            <h1>{p.name}</h1>
            <p>
              {p.review_count
                ? `★ ${p.rating_avg} · ${p.review_count} reviews · `
                : "New listing · "}
              {p.location_full}
            </p>
          </div>
        </div>
        <div className="photo-grid">
          {p.image_urls.slice(0, 5).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={p.image_captions[i] || `${p.name} photo ${i + 1}`}
              loading={i ? "lazy" : "eager"}
              onClick={() => setGallery(true)}
            />
          ))}
          <button onClick={() => setGallery(true)}>Show all photos</button>
        </div>
        <div className="listing-columns">
          <div className="listing-main">
            <section className="property-intro">
              <h2>Entire house in {p.location_town}</h2>
              <p>
                {p.sleeps} guests · {p.bedrooms} bedrooms · {p.bathrooms} bathrooms
              </p>
              <div className="highlights">
                {isFavourite(p) && (
                  <div>
                    <Star />{" "}
                    <span>
                      <strong>Guest favourite</strong>
                      <small>Loved by recent guests</small>
                    </span>
                  </div>
                )}
                {p.hot_tub_privacy === "Private" && (
                  <div>
                    <span className="highlight-icon">♨</span>
                    <span>
                      <strong>Private hot tub</strong>
                      <small>Only for your group</small>
                    </span>
                  </div>
                )}
                <div>
                  <BedDouble />
                  <span>
                    <strong>
                      Own beds for {p.own_beds_estimated ? `at least ${p.own_beds}` : p.own_beds}
                    </strong>
                    <small>
                      {p.own_beds_estimated
                        ? "One per bedroom · no layout available"
                        : `${p.single_beds ?? 0} singles · ${p.zip_link_beds ?? 0} zip & link · ${p.double_beds ?? 0} doubles`}
                    </small>
                  </span>
                </div>
              </div>
            </section>
            <section>
              <h2>About this place</h2>
              <p className={`description ${expanded ? "expanded" : ""}`}>
                {p.long_description || p.short_description}
              </p>
              <button className="text-button" onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show less" : "Show more"}
              </button>
            </section>
            <section>
              <h2>Where you'll sleep</h2>
              {p.bedroom_cards.length ? (
                <div className="bedroom-scroller">
                  {p.bedroom_cards.map((card) => (
                    <div className="bedroom-card" key={card.number}>
                      <BedDouble size={29} />
                      <strong>Bedroom {card.number}</strong>
                      <p>{card.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>Bedroom layout is unknown for this property.</p>
              )}
              <p className="bed-summary">
                {p.single_beds === null
                  ? "Bed details unknown"
                  : `${p.single_beds} singles · ${p.bunk_beds ?? 0} bunks · ${p.double_beds ?? 0} doubles · ${p.zip_link_beds ?? 0} zip & link`}
              </p>
            </section>
            <section>
              <h2>What this place offers</h2>
              <div className="amenity-list">
                {labels.slice(0, 10).map((label) => (
                  <div key={label}>
                    <Check size={18} />
                    {label}
                  </div>
                ))}
              </div>
              <button className="outline-button" onClick={() => setAmenityModal(true)}>
                Show all {labels.length} amenities
              </button>
            </section>
            <section>
              <h2>Reviews</h2>
              {p.review_count ? (
                <>
                  <h3>
                    ★ {p.rating_avg} · {p.review_count} reviews
                  </h3>
                  <div className="scores">
                    {[
                      ["Cleanliness", p.score_cleanliness],
                      ["Location", p.score_location],
                      ["Comfort", p.score_comfort_equipment],
                      ["Value", p.score_value_for_money],
                      ["Local amenities", p.score_local_amenities],
                    ].map(([label, score]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <i>
                          <b style={{ width: `${Number(score || 0) * 20}%` }} />
                        </i>
                        <strong>{score}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="reviews">
                    {p.reviews.slice(0, 4).map((r, i) => (
                      <blockquote key={i}>
                        <strong>
                          ★ {r.score} · {r.date && dateText(r.date)}
                        </strong>
                        <p>{r.comment}</p>
                      </blockquote>
                    ))}
                  </div>
                </>
              ) : (
                <p>New listing · no reviews yet.</p>
              )}
            </section>
            <section>
              <h2>Where you'll be</h2>
              <p>{p.location_full}</p>
              <div className="detail-map">
                <MapView
                  rows={[p]}
                  hovered={null}
                  onHover={() => {}}
                  onOpen={() => {}}
                  property={p}
                  transport
                />
              </div>
              <p>
                <Train size={17} /> {p.nearest_rail_name || "Station unknown"} ·{" "}
                {p.nearest_rail_distance_km?.toFixed(1) ?? "—"} km
              </p>
              <p>
                🚌 {p.nearest_bus_name || "Bus stop unknown"} ·{" "}
                {p.nearest_bus_distance_km?.toFixed(1) ?? "—"} km
              </p>
              <p>
                <Car size={17} /> Manchester · {duration(p.drive_manchester_min)} (
                {p.drive_manchester_km?.toFixed(0) ?? "—"} km)
              </p>
              <p>
                <Car size={17} /> London · {duration(p.drive_london_min)} (
                {p.drive_london_km?.toFixed(0) ?? "—"} km)
              </p>
              <p>
                <ShoppingBasket size={17} />{" "}
                {p.nearest_shop_name
                  ? `${p.nearest_shop_name} · ${(p.nearest_shop_drive_km ?? p.nearest_shop_distance_km)?.toFixed(1)} km${p.nearest_shop_drive_min != null ? ` drive (${duration(p.nearest_shop_drive_min)})` : ""}`
                  : "Nearest Booths or Waitrose unknown"}
              </p>
              <small>
                Rail and bus distances are straight-line; drive times are estimates without traffic.
              </small>
            </section>
            <section>
              <h2>Things to know</h2>
              <div className="things-grid">
                <div>
                  <strong>House rules</strong>
                  <p>
                    Check-in: {p.check_in_time || "See provider"}
                    <br />
                    Check-out: {p.check_out_time || "See provider"}
                    <br />
                    Pets: {p.pets_allowed ? "Allowed" : "Not allowed"}
                    <br />
                    Smoking: {p.smoking_allowed ? "Allowed" : "Not allowed"}
                  </p>
                </div>
                <div>
                  <strong>Included</strong>
                  <p>{p.whats_included.join(", ") || "See provider"}</p>
                </div>
                <div>
                  <strong>Security deposit</strong>
                  <p>{p.security_deposit_gbp ? money(p.security_deposit_gbp) : "See provider"}</p>
                </div>
              </div>
            </section>
          </div>
          <aside className="booking-card">
            <div className="booking-price">
              {p.was_price_gbp && p.was_price_gbp > p.price_gbp && (
                <del>{money(p.was_price_gbp)}</del>
              )}{" "}
              <strong>{money(p.price_gbp)}</strong> <span>for 7 nights</span>
            </div>
            <p>{dateText(p.available_start_date)} · 7 nights</p>
            {!!p.security_deposit_gbp && (
              <div className="booking-line">
                <span>Security deposit</span>
                <span>{money(p.security_deposit_gbp)}</span>
              </div>
            )}
            <a
              className="primary booking-cta"
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Check availability on cottages.com
            </a>
            <small>Prices as of 30 Sep 2026 · availability may change.</small>
          </aside>
        </div>
      </main>
      <div className="mobile-booking">
        <span>
          <strong>{money(p.price_gbp)}</strong> · 7 nights
        </span>
        <a className="primary" href={p.url} target="_blank" rel="noopener noreferrer">
          Check availability
        </a>
      </div>
      {gallery && (
        <Modal title={`Photos · ${p.name}`} onClose={() => setGallery(false)} wide>
          <div className="gallery">
            {p.image_urls.map((url, i) => (
              <figure key={i}>
                <img
                  src={url}
                  alt={p.image_captions[i] || `${p.name} photo ${i + 1}`}
                  loading="lazy"
                />
                <figcaption>{p.image_captions[i]}</figcaption>
              </figure>
            ))}
          </div>
        </Modal>
      )}
      {amenityModal && (
        <Modal title="All amenities" onClose={() => setAmenityModal(false)}>
          <div className="amenity-modal">
            {labels.map((label) => (
              <div key={label}>
                <Check size={18} />
                {label}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

const noMaxPrice = defaultFilters.priceMax;
const priceSteps = [2000, 2500, 3000, 3500, 4000, 5000, 6000, 8000, 10000, 15000];

function App() {
  const [search, setSearch] = useState<Search>(parseSearch);
  const [page, setPage] = useState(getPage);
  const [store, setStore] = useState<Store>(readStore);
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }, [store]);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    q.delete("s");
    searchKeys.forEach((key) => q.delete(key));
    toQuery(search).forEach((value, key) => q.set(key, value));
    const query = q.toString();
    history.replaceState({}, "", query ? `?${query}` : location.pathname);
  }, [search]);
  useEffect(() => {
    const onPop = () => {
      setPage(getPage());
      setSearch(parseSearch());
    };
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const go = (params: Record<string, string | null>) => {
    const q = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(params)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    history.pushState({}, "", q.size ? `?${q}` : location.pathname);
    setPage(getPage());
    scrollTo(0, 0);
  };
  const rows = useMemo(
    () =>
      sorted(
        properties.filter((p) => match(p, search)),
        search.sort,
      ),
    [search],
  );
  const categoryCounts = useMemo(
    () =>
      Object.fromEntries(
        categories.map(([, key]) => [
          key,
          properties
            .filter((p) => match(p, search, true))
            .filter((p) => key === "all" || p[key] === true).length,
        ]),
      ),
    [search],
  );
  const listing = page.listing && properties.find((p) => p.property_code === page.listing);
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <button className="brand" aria-label="All properties" onClick={() => go({ listing: null })}>
            <img src={`${import.meta.env.BASE_URL}logo.jpg`} alt="" />
          </button>
        </div>
      </header>
      {listing ? (
        <Listing
          p={listing}
          onBack={() => go({ listing: null })}
          store={store}
          onStore={setStore}
        />
      ) : (
        <>
          <nav className="category-bar" aria-label="Property categories">
            <div className="category-scroll wrap">
              {categories
                .filter(([, key]) => key === "all" || categoryCounts[key] > 0)
                .map(([label, key, icon]) => (
                  <button
                    key={key}
                    className={search.category === key ? "active" : ""}
                    onClick={() => setSearch({ ...search, category: key })}
                  >
                    <span>{icon}</span>
                    {label}
                  </button>
                ))}
            </div>
          </nav>
          <div className="toolbar wrap">
            <div>
              <h1>
                {rows.length} {rows.length === 1 ? "property" : "properties"}
              </h1>
              <p>7 nights around September 2027 · England, Scotland & Wales</p>
            </div>
            <div className="toolbar-actions">
              <div className="price-filter" role="group" aria-label="Total price for 7 nights">
                <span>Price for 7 nights</span>
                <select
                  aria-label="Minimum price"
                  value={search.filters.priceMin}
                  onChange={(e) =>
                    setSearch({
                      ...search,
                      filters: { ...search.filters, priceMin: Number(e.target.value) },
                    })
                  }
                >
                  <option value={0}>No min</option>
                  {priceSteps
                    .filter((n) => n < search.filters.priceMax)
                    .map((n) => (
                      <option key={n} value={n}>
                        {money(n)}
                      </option>
                    ))}
                </select>
                –
                <select
                  aria-label="Maximum price"
                  value={search.filters.priceMax}
                  onChange={(e) =>
                    setSearch({
                      ...search,
                      filters: { ...search.filters, priceMax: Number(e.target.value) },
                    })
                  }
                >
                  {priceSteps
                    .filter((n) => n > search.filters.priceMin)
                    .map((n) => (
                      <option key={n} value={n}>
                        {money(n)}
                      </option>
                    ))}
                  <option value={noMaxPrice}>No max</option>
                </select>
              </div>
              <label className="sort-control">
                Sort{" "}
                <select
                  value={search.sort}
                  onChange={(e) => setSearch({ ...search, sort: e.target.value })}
                >
                  <option value="recommended">Recommended</option>
                  <option value="price">Price</option>
                  <option value="rating">Rating</option>
                  <option value="rail">Distance to station</option>
                  <option value="discount">Biggest discount</option>
                </select>
              </label>
              <div className="view-switch">
                <button
                  className={search.view === "list" ? "active" : ""}
                  onClick={() => setSearch({ ...search, view: "list" })}
                >
                  <List size={17} /> List
                </button>
                <button
                  className={search.view === "map" ? "active" : ""}
                  onClick={() => setSearch({ ...search, view: "map" })}
                >
                  <MapIcon size={17} /> Map
                </button>
              </div>
            </div>
          </div>
          <div className="active-chips wrap">
            {search.where && (
              <button onClick={() => setSearch({ ...search, where: "" })}>{search.where} ×</button>
            )}
            {search.everyoneBed && (
              <button onClick={() => setSearch({ ...search, everyoneBed: false })}>
                Everyone has a bed ×
              </button>
            )}
            {search.filters.privateHotTub && (
              <button
                onClick={() =>
                  setSearch({ ...search, filters: { ...search.filters, privateHotTub: false } })
                }
              >
                Private hot tub ×
              </button>
            )}
            {(search.filters.priceMin > 0 || search.filters.priceMax < noMaxPrice) && (
              <button
                onClick={() =>
                  setSearch({
                    ...search,
                    filters: { ...search.filters, priceMin: 0, priceMax: noMaxPrice },
                  })
                }
              >
                {search.filters.priceMin ? money(search.filters.priceMin) : "Any"} –{" "}
                {search.filters.priceMax < noMaxPrice ? money(search.filters.priceMax) : "any"}{" "}
                total ×
              </button>
            )}
          </div>
          {store.recent.length > 0 && (
            <section className="recently-viewed wrap">
              <h2>Recently viewed</h2>
              <div>
                {store.recent.slice(0, 6).map((code) => {
                  const p = properties.find((item) => item.property_code === code);
                  return p ? (
                    <button key={code} onClick={() => go({ listing: code })}>
                      <img src={p.image_urls[0]} alt="" loading="lazy" />
                      <span>{p.name}</span>
                    </button>
                  ) : null;
                })}
              </div>
            </section>
          )}
          <div className={`results-layout ${search.view}`}>
            <div className="results-list">
              {rows.length ? (
                <div className="card-grid">
                  {rows.map((p) => (
                    <Card
                      key={p.property_code}
                      p={p}
                      onOpen={(p) => go({ listing: p.property_code })}
                      onHover={setHovered}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-results">
                  <h2>No properties found</h2>
                  <p>Try a wider date range or clear some filters.</p>
                  <button className="primary" onClick={() => setSearch({ ...defaultSearch })}>
                    Clear search
                  </button>
                </div>
              )}
            </div>
            <div className="results-map">
              <MapView
                rows={rows}
                hovered={hovered}
                onHover={setHovered}
                onOpen={(p) => go({ listing: p.property_code })}
              />
            </div>
          </div>
          <button
            className="mobile-map-toggle"
            onClick={() => setSearch({ ...search, view: search.view === "map" ? "list" : "map" })}
          >
            {search.view === "map" ? (
              <>
                <List size={17} /> List
              </>
            ) : (
              <>
                <MapIcon size={17} /> Map
              </>
            )}
          </button>
        </>
      )}
      <footer className="site-footer">
        <div className="wrap">
          <span>Jolly boys next year · Big properties with hot tubs in England, Scotland & Wales</span>
          <span>
            Prices are a snapshot from 30 Sep 2026 for 7 nights in September 2027. Always check
            the live price and availability on cottages.com before you book.
          </span>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const splash = document.getElementById("splash");
if (splash)
  setTimeout(() => {
    splash.classList.add("hide");
    splash.addEventListener("transitionend", () => splash.remove(), { once: true });
  }, Math.max(0, 2500 - performance.now()));
