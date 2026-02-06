/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import MaplibreGeocoder from "@maplibre/maplibre-gl-geocoder";
import shp from "shpjs";

import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";

interface LocationGroup {
  folderName: string;
  features: any[];
}

const MapGlobeShp = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);

  // ===== Utils: Zoom to Feature =====
  const zoomToFeature = (geometry: any) => {
    if (!mapRef.current) return;
    const bounds = new maplibregl.LngLatBounds();
    const extend = (c: any) =>
      Array.isArray(c[0]) ? c.forEach(extend) : bounds.extend(c);
    extend(geometry.coordinates);

    mapRef.current.fitBounds(bounds, {
      padding: 80,
      duration: 1200,
      maxZoom: 17,
    });
  };

  // ===== Upload & Grouping Logic =====
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapRef.current) return;

    try {
      const buffer = await file.arrayBuffer();
      const result: any = await shp(buffer);
      const map = mapRef.current;
      const allFeatures: any[] = [];
      const groups: LocationGroup[] = [];
      const geojsonArray = Array.isArray(result) ? result : [result];

      geojsonArray.forEach((collection: any) => {
        const groupName = collection.fileName || "General Areas";
        const groupFeatures = collection.features.map((f: any, i: number) => ({
          id: `${groupName}-${i}`,
          name:
            f.properties?.name ||
            f.properties?.NAMETH ||
            f.properties?.Name ||
            `Area ${i + 1}`,
          geometry: f.geometry,
          properties: f.properties, // เก็บ properties ไว้ใช้ตอนคลิก
        }));
        groups.push({ folderName: groupName, features: groupFeatures });
        allFeatures.push(...collection.features);
      });

      setLocationGroups(groups);

      if (map.getSource("uploaded-shp")) {
        (map.getSource("uploaded-shp") as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: allFeatures,
        });
      } else {
        map.addSource("uploaded-shp", {
          type: "geojson",
          data: { type: "FeatureCollection", features: allFeatures },
        });
        map.addLayer({
          id: "shp-layer-fill",
          type: "fill",
          source: "uploaded-shp",
          paint: { "fill-color": "#00ffff", "fill-opacity": 0.4 },
        });
        map.addLayer({
          id: "shp-layer-line",
          type: "line",
          source: "uploaded-shp",
          paint: { "line-color": "#ffffff", "line-width": 2 },
        });
      }

      const allBounds = new maplibregl.LngLatBounds();
      allFeatures.forEach((f) => {
        const extend = (c: any) =>
          Array.isArray(c[0]) ? c.forEach(extend) : allBounds.extend(c);
        extend(f.geometry.coordinates);
      });
      map.fitBounds(allBounds, { padding: 60, maxZoom: 17 });
    } catch (err) {
      alert("ไฟล์เสีย หรือโครงสร้าง Zip ไม่ถูกต้อง");
    }
  };

  // ===== Init Map & Interaction =====
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      attributionControl: false,
      maxZoom: 18,
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
        layers: [{ id: "satellite", type: "raster", source: "satellite" }],
      },
      center: [100.5, 13.7],
      zoom: 1.5,
    });

    const geocoderApi: any = {
      forwardGeocode: async (config: any) => {
        const features = [];
        try {
          const request = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(config.query)}&format=geojson&addressdetails=1&limit=5`;
          const response = await fetch(request);
          const geojson = await response.json();
          for (const feature of geojson.features) {
            features.push({
              type: "Feature",
              geometry: feature.geometry,
              place_name: feature.properties.display_name,
              properties: feature.properties,
              text: feature.properties.display_name,
              place_type: ["place"],
              center: feature.geometry.coordinates,
            });
          }
        } catch (e) {
          console.error(e);
        }
        return { features };
      },
    };

    map.on("load", () => {
      map.setProjection({ type: "globe" });

      map.on("zoom", () => {
        if (map.getZoom() > 17) map.setZoom(17);
      });

      const geocoder = new MaplibreGeocoder(geocoderApi, {
        maplibregl: maplibregl,
        marker: false,
        showResultsWhileTyping: true,
        zoom: 17,
        placeholder: "ค้นหาสถานที่...",
      });
      map.addControl(geocoder as any, "top-left");

      geocoder.on("result", (e: any) => {
        const [lng, lat] = e.result.center;
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = new maplibregl.Marker({ color: "#00ffff" })
          .setLngLat([lng, lat])
          .addTo(map);
      });

      // ==========================================
      // ส่วนที่เพิ่มใหม่: คลิกที่พื้นที่เพื่อดูข้อมูล
      // ==========================================
      map.on("click", "shp-layer-fill", (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const props = feature.properties;

        // สร้างตารางข้อมูลจาก Properties ทั้งหมด
        let htmlContent = `<div style="padding:10px; font-family: sans-serif; min-width:150px;">
                            <h3 style="margin:0 0 10px 0; font-size:14px; color:#007bff; border-bottom:1px solid #ddd;">ข้อมูลพื้นที่</h3>
                            <table style="width:100%; font-size:12px; border-collapse: collapse;">`;

        for (const key in props) {
          htmlContent += `<tr>
                            <td style="font-weight:bold; padding:4px 0; border-bottom:1px solid #eee;">${key}</td>
                            <td style="padding:4px 0 4px 10px; border-bottom:1px solid #eee; color:#555;">${props[key]}</td>
                          </tr>`;
        }
        htmlContent += `</table></div>`;

        new maplibregl.Popup({ closeButton: true, className: "custom-popup" })
          .setLngLat(e.lngLat)
          .setHTML(htmlContent)
          .addTo(map);
      });

      // เปลี่ยน Cursor เมื่อเอาเมาส์ไปวางบนพื้นที่
      map.on("mouseenter", "shp-layer-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "shp-layer-fill", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;
    return () => map.remove();
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        backgroundColor: "#000",
      }}
    >
      <style>{`
        .maplibregl-ctrl-geocoder { min-width: 300px; z-index: 20; }
        .maplibregl-ctrl-geocoder--suggestions { background: white; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); color: black; }
        .maplibregl-popup-content { border-radius: 12px; padding: 0; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
      `}</style>

      <div style={panelStyle}>
        <strong style={{ fontSize: 13 }}>🛰️ Upload SHP (.zip)</strong>
        <input
          type="file"
          accept=".zip"
          onChange={handleFileUpload}
          style={{ fontSize: 11, marginTop: 8, width: "100%" }}
        />
      </div>

      {locationGroups.length > 0 && (
        <div style={listContainerStyle}>
          <h4 style={{ margin: "0 0 12px", color: "#00ffff", fontSize: 14 }}>
            📂 รายชื่อตามกลุ่ม
          </h4>
          <div style={{ maxHeight: "65vh", overflowY: "auto" }}>
            {locationGroups.map((group) => (
              <div key={group.folderName} style={{ marginBottom: 10 }}>
                <div style={groupHeaderStyle}>📁 {group.folderName}</div>
                {group.features.map((loc) => (
                  <div
                    key={loc.id}
                    onClick={() => zoomToFeature(loc.geometry)}
                    style={listItemStyle}
                  >
                    └ {loc.name}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button
            onClick={() => setLocationGroups([])}
            style={clearButtonStyle}
          >
            ล้างข้อมูล
          </button>
        </div>
      )}

      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
};

// ===== Styles =====
const panelStyle: React.CSSProperties = {
  position: "absolute",
  top: 10,
  right: 10,
  zIndex: 10,
  background: "#fff",
  padding: "12px 15px",
  borderRadius: 10,
  width: 220,
  boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
};

const listContainerStyle: React.CSSProperties = {
  position: "absolute",
  top: 100,
  right: 10,
  zIndex: 10,
  background: "rgba(10, 10, 10, 0.9)",
  color: "#fff",
  padding: 15,
  borderRadius: 12,
  width: 240,
  border: "1px solid #333",
};

const groupHeaderStyle: React.CSSProperties = {
  background: "#222",
  padding: "5px 10px",
  borderRadius: 5,
  fontSize: 11,
  fontWeight: "bold",
  color: "#00ffff",
  marginBottom: 5,
  borderLeft: "3px solid #00ffff",
};

const listItemStyle: React.CSSProperties = {
  padding: "6px 12px",
  cursor: "pointer",
  fontSize: 12,
  color: "#ccc",
  borderBottom: "1px solid #1a1a1a",
  transition: "0.2s",
};

const clearButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 12,
  padding: 8,
  background: "#d90429",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: "bold",
};

export default MapGlobeShp;
