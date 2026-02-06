/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import MaplibreGeocoder from "@maplibre/maplibre-gl-geocoder"; // นำเข้า Geocoder
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css"; // นำเข้า CSS ของช่องค้นหา

function App() {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
          },
        },
        layers: [
          { id: "satellite-layer", type: "raster", source: "satellite" },
        ],
      },
      center: [100.5, 13.7],
      zoom: 1,
    });

    // --- ส่วนที่เพิ่มเข้ามาสำหรับการค้นหา ---
    const geocoderApi = {
      forwardGeocode: async (config: any) => {
        const features = [];
        try {
          // ใช้ Nominatim API ของ OpenStreetMap (ฟรีและไม่ต้องใช้ Key)
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${config.query}&format=geojson&addressdetails=1&limit=5`,
          );
          const geojson = await response.json();
          for (const feature of geojson.features) {
            const center = [
              feature.geometry.coordinates[0],
              feature.geometry.coordinates[1],
            ];
            const point = {
              type: "Feature",
              geometry: { type: "Point", coordinates: center },
              place_name: feature.properties.display_name,
              properties: feature.properties,
              text: feature.properties.display_name,
              place_type: ["place"],
              center: center,
            };
            features.push(point);
          }
        } catch (e) {
          console.error(`Failed to forwardGeocode with error: ${e}`);
        }
        return { features };
      },
    };

    const geocoder = new MaplibreGeocoder(geocoderApi, {
      maplibregl: maplibregl,
      placeholder: "ค้นหาสถานที่...",
      marker: true, // ปักหมุดเมื่อค้นหาเจอ
    });

    map.addControl(geocoder as any, "top-left"); // วางช่องค้นหาไว้มุมซ้ายบน
    // ------------------------------------

    map.on("load", () => {
      map.setProjection({ type: "globe" });
    });

    mapRef.current = map;
    return () => map.remove();
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{ width: "100vw", height: "100vh", backgroundColor: "#000" }}
    />
  );
}

export default App;
