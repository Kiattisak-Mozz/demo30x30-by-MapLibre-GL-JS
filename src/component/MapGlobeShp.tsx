/* eslint-disable @typescript-eslint/no-unused-vars */
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
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null); // สำหรับจุดที่ค้นหา
  const areaMarkersRef = useRef<maplibregl.Marker[]>([]); // สำหรับหมุดในพื้นที่ Shp

  const [locationGroups, setLocationGroups] = useState<LocationGroup[]>([]);

  // ===== ฟังก์ชันล้างหมุดทั้งหมด =====
  const clearAreaMarkers = () => {
    areaMarkersRef.current.forEach((m) => m.remove());
    areaMarkersRef.current = [];
  };

  // ===== ฟังก์ชันหาจุดกึ่งกลาง (Centroid) แบบง่าย =====
  const getCentroid = (geometry: any) => {
    let coords = geometry.coordinates;
    // ถ้าเป็น MultiPolygon หรือ Polygon ซ้อนกัน ให้ดึงชั้นในสุด
    while (Array.isArray(coords[0][0])) coords = coords[0];

    let lng = 0,
      lat = 0;
    coords.forEach((c: any) => {
      lng += c[0];
      lat += c[1];
    });
    return [lng / coords.length, lat / coords.length];
  };

  const handleResetToGlobe = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [100.5, 13.7],
        zoom: 1.5,
        pitch: 0,
        bearing: 0,
        essential: true,
        duration: 2000,
      });
    }
  };

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

  // ===== Upload & Grouping & Auto Marker =====
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapRef.current) return;

    try {
      const buffer = await file.arrayBuffer();
      const result: any = await shp(buffer);
      const map = mapRef.current;

      clearAreaMarkers(); // ล้างหมุดเก่าก่อน

      const allFeatures: any[] = [];
      const groups: LocationGroup[] = [];
      const geojsonArray = Array.isArray(result) ? result : [result];

      geojsonArray.forEach((collection: any) => {
        const groupName = collection.fileName || "General Areas";
        const groupFeatures = collection.features.map((f: any, i: number) => {
          const centroid = getCentroid(f.geometry);

          // สร้าง Marker สำหรับแต่ละ Area
          const marker = new maplibregl.Marker({ color: "#FFD700", scale: 0.6 })
            .setLngLat(centroid as [number, number])
            .setPopup(
              new maplibregl.Popup().setHTML(
                `<b>${f.properties?.name || f.properties?.NAMETH || "Area"}</b>`,
              ),
            )
            .addTo(map);

          areaMarkersRef.current.push(marker);

          return {
            id: `${groupName}-${i}`,
            name:
              f.properties?.name ||
              f.properties?.NAMETH ||
              f.properties?.Name ||
              `Area ${i + 1}`,
            geometry: f.geometry,
            properties: f.properties,
          };
        });
        groups.push({ folderName: groupName, features: groupFeatures });
        allFeatures.push(...collection.features);
      });

      setLocationGroups(groups);

      // จัดการ Layer
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
          paint: { "fill-color": "#00ffff", "fill-opacity": 0.3 },
        });
        map.addLayer({
          id: "shp-layer-line",
          type: "line",
          source: "uploaded-shp",
          paint: { "line-color": "#ffffff", "line-width": 1.5 },
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

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      attributionControl: false,
      maxZoom: 18,
      style: {
        version: 8,
        // sources: {
        //   satellite: {
        //     type: "raster",
        //     tiles: [
        //       "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        //     ],
        //     tileSize: 256,
        //   },
        // },
        // layers: [{ id: "satellite", type: "raster", source: "satellite" }],
        sources: {
          google: {
            type: "raster",
            tiles: ["https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"],
            tileSize: 256,
          },
        },
        layers: [{ id: "google-layer", type: "raster", source: "google" }],
      },
      center: [100.5, 13.7],
      zoom: 1.5,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.on("load", () => {
      map.setProjection({ type: "globe" });

      const geocoderApi: any = {
        forwardGeocode: async (config: any) => {
          const features = [];
          try {
            const request = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(config.query)}&format=geojson&limit=5`;
            const response = await fetch(request);
            const geojson = await response.json();
            for (const feature of geojson.features) {
              features.push({
                type: "Feature",
                geometry: feature.geometry,
                place_name: feature.properties.display_name,
                center: feature.geometry.coordinates,
                text: feature.properties.display_name,
                place_type: ["place"],
              });
            }
          } catch (e) {
            console.error(e);
          }
          return { features };
        },
      };

      const geocoder = new MaplibreGeocoder(geocoderApi, {
        maplibregl,
        marker: false,
        zoom: 17,
        placeholder: "ค้นหา...",
      });
      map.addControl(geocoder as any, "top-left");

      geocoder.on("result", (e: any) => {
        const [lng, lat] = e.result.center;
        if (searchMarkerRef.current) searchMarkerRef.current.remove();
        searchMarkerRef.current = new maplibregl.Marker({ color: "#00ffff" })
          .setLngLat([lng, lat])
          .addTo(map);
      });

      map.on("click", "shp-layer-fill", (e) => {
        if (!e.features || e.features.length === 0) return;
        const props = e.features[0].properties;
        let html = `<div style="padding:10px; font-size:11px;"><b>Info</b><hr/>`;
        for (const key in props)
          html += `<div><b>${key}:</b> ${props[key]}</div>`;
        html += `</div>`;
        new maplibregl.Popup().setLngLat(e.lngLat).setHTML(html).addTo(map);
      });

      map.on("zoom", () => {
        if (map.getZoom() > 17) map.setZoom(17);
      });
      map.on(
        "mouseenter",
        "shp-layer-fill",
        () => (map.getCanvas().style.cursor = "pointer"),
      );
      map.on(
        "mouseleave",
        "shp-layer-fill",
        () => (map.getCanvas().style.cursor = ""),
      );
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
        .maplibregl-ctrl-geocoder--suggestions { background: white; border-radius: 8px; color: black; }
      `}</style>

      {/* Reset Globe Button */}
      <div
        onClick={handleResetToGlobe}
        style={resetGlobeButtonStyle}
        title="Back to Globe View"
      >
        <div style={{ margin: 2 }}>🌎</div>
      </div>

      {/* Upload Panel */}
      <div style={panelStyle}>
        <strong style={{ fontSize: 13 }}>🛰️ Upload SHP (.zip)</strong>
        <input
          type="file"
          accept=".zip"
          onChange={handleFileUpload}
          style={{ fontSize: 11, marginTop: 8, width: "100%" }}
        />
      </div>

      {/* List Panel */}
      {locationGroups.length > 0 && (
        <div style={listContainerStyle}>
          <h4 style={{ margin: "0 0 12px", color: "#00ffff", fontSize: 14 }}>
            📂 รายชื่อตามกลุ่ม
          </h4>
          <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
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
            onClick={() => {
              setLocationGroups([]);
              clearAreaMarkers();
            }}
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

const resetGlobeButtonStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 110,
  right: 10,
  zIndex: 15,
  background: "#FFF",
  borderRadius: "50%",
  cursor: "pointer",
  fontSize: 20,
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
};

const groupHeaderStyle: React.CSSProperties = {
  background: "#222",
  padding: "5px 10px",
  borderRadius: 5,
  fontSize: 11,
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
};

export default MapGlobeShp;
