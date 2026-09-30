import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import type { Property } from "./types";
import { money } from "./data";

// The map starts inside a hidden container in list view, so resize and recentre once it's shown.
function AutoSize({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    let hidden = !el.clientWidth;
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (hidden && el.clientWidth) map.setView(center, zoom);
      hidden = !el.clientWidth;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [map]);
  return null;
}
function FitOne({ property }: { property?: Property }) {
  const map = useMap();
  useEffect(() => {
    if (property) map.flyTo([property.latitude, property.longitude], 11);
  }, [property, map]);
  return null;
}
function Pins({
  rows,
  hovered,
  onHover,
  onOpen,
}: {
  rows: Property[];
  hovered: string | null;
  onHover: (id: string | null) => void;
  onOpen: (p: Property) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const items = useMemo(() => {
    if (zoom >= 9) return rows.map((p) => ({ lat: p.latitude, lng: p.longitude, props: [p] }));
    const cell = zoom < 6 ? 1.2 : zoom < 8 ? 0.45 : 0.2;
    const groups = new Map<string, { lat: number; lng: number; props: Property[] }>();
    rows.forEach((p) => {
      const key = `${Math.floor(p.latitude / cell)}:${Math.floor(p.longitude / cell)}`;
      const group = groups.get(key);
      if (group) group.props.push(p);
      else groups.set(key, { lat: p.latitude, lng: p.longitude, props: [p] });
    });
    return [...groups.values()];
  }, [rows, zoom]);
  return (
    <>
      {items.map((item) => {
        const p = item.props[0];
        const active = item.props.some((x) => x.property_code === hovered);
        const cluster = item.props.length > 1;
        const html = `<div class="map-pin ${active ? "active" : ""} ${cluster ? "cluster" : ""}">${cluster ? item.props.length : money(p.price_gbp)}</div>`;
        const icon = L.divIcon({
          html,
          className: "pin-wrap",
          iconSize: [cluster ? 46 : 82, 35],
          iconAnchor: [cluster ? 23 : 41, 35],
        });
        return (
          <Marker
            key={item.props.map((x) => x.property_code).join("-")}
            position={[item.lat, item.lng]}
            icon={icon}
            eventHandlers={{
              mouseover: () => onHover(p.property_code),
              mouseout: () => onHover(null),
              click: () => {
                if (cluster) map.flyTo([item.lat, item.lng], zoom + 2);
                else onOpen(p);
              },
            }}
          >
            {!cluster && (
              <Popup>
                <div className="map-popup">
                  <img src={p.image_urls[0]} alt={p.image_captions[0] || p.name} />
                  <strong>{p.name}</strong>
                  <span>
                    {p.location_full} · {money(p.price_gbp)} for 7 nights
                  </span>
                  <button onClick={() => onOpen(p)}>View cottage</button>
                </div>
              </Popup>
            )}
          </Marker>
        );
      })}
    </>
  );
}
export default function MapView({
  rows,
  hovered,
  onHover,
  onOpen,
  property,
  transport = false,
}: {
  rows: Property[];
  hovered: string | null;
  onHover: (id: string | null) => void;
  onOpen: (p: Property) => void;
  property?: Property;
  transport?: boolean;
}) {
  const center: [number, number] = property
    ? [property.latitude, property.longitude]
    : [53.55, -2.55];
  return (
    <MapContainer center={center} zoom={property ? 11 : 6} scrollWheelZoom className="map-canvas">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <AutoSize center={center} zoom={property ? 11 : 6} />
      <FitOne property={property} />
      {transport && property ? (
        <>
          <Marker
            position={[property.latitude, property.longitude]}
            icon={L.divIcon({
              html: '<div class="place-pin">⌂</div>',
              className: "pin-wrap",
              iconSize: [38, 38],
            })}
          >
            <Popup>{property.name}</Popup>
          </Marker>
          {property.nearest_rail_lat && property.nearest_rail_long && (
            <Marker
              position={[property.nearest_rail_lat, property.nearest_rail_long]}
              icon={L.divIcon({
                html: '<div class="transport-pin">🚆</div>',
                className: "pin-wrap",
                iconSize: [38, 38],
              })}
            >
              <Popup>{property.nearest_rail_name}</Popup>
            </Marker>
          )}
          {property.nearest_bus_lat && property.nearest_bus_long && (
            <Marker
              position={[property.nearest_bus_lat, property.nearest_bus_long]}
              icon={L.divIcon({
                html: '<div class="transport-pin">🚌</div>',
                className: "pin-wrap",
                iconSize: [38, 38],
              })}
            >
              <Popup>{property.nearest_bus_name}</Popup>
            </Marker>
          )}
        </>
      ) : (
        <Pins
          rows={rows}
          hovered={hovered}
          onHover={onHover}
          onOpen={onOpen}
        />
      )}
    </MapContainer>
  );
}
