/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import MaplibreGeocoder from "@maplibre/maplibre-gl-geocoder";
import shp from "shpjs"; // เพิ่มตัวนี้

import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";

const MapGlobeShp = () => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // ฟังก์ชันจัดการไฟล์ .zip (Shapefile)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !mapRef.current) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const buffer = event.target?.result as ArrayBuffer;

        // แปลง Zip (Shapefile) เป็น GeoJSON
        const geojson: any = await shp(buffer);

        // ถ้ามี Source เดิมอยู่แล้วให้ลบออกก่อน
        if (mapRef.current?.getSource("uploaded-shp")) {
          mapRef.current.removeLayer("shp-layer-line");
          mapRef.current.removeLayer("shp-layer-fill");
          mapRef.current.removeSource("uploaded-shp");
        }

        // เพิ่ม Data เข้าไปในแผนที่
        mapRef.current?.addSource("uploaded-shp", {
          type: "geojson",
          data: geojson,
        });

        // วาดส่วนพื้น (Fill)
        mapRef.current?.addLayer({
          id: "shp-layer-fill",
          type: "fill",
          source: "uploaded-shp",
          paint: {
            "fill-color": "#00ffff",
            "fill-opacity": 0.3,
          },
        });

        // วาดเส้นขอบ (Line)
        mapRef.current?.addLayer({
          id: "shp-layer-line",
          type: "line",
          source: "uploaded-shp",
          paint: {
            "line-color": "#00ffff",
            "line-width": 2,
          },
        });

        // Zoom ไปยังพื้นที่ที่อัปโหลด (Fit Bounds)
        const coordinates = geojson.features[0].geometry.coordinates;
        const bounds = new maplibregl.LngLatBounds();

        // คำนวณขอบเขตแบบง่าย (Flatten array ถ้าเป็น MultiPolygon)
        geojson.features.forEach((feature: any) => {
          if (feature.geometry.type === "Polygon") {
            feature.geometry.coordinates[0].forEach((coord: any) =>
              bounds.extend(coord),
            );
          } else if (feature.geometry.type === "MultiPolygon") {
            feature.geometry.coordinates.forEach((poly: any) =>
              poly[0].forEach((coord: any) => bounds.extend(coord)),
            );
          }
        });

        mapRef.current?.fitBounds(bounds, { padding: 50 });
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error parsing shapefile:", error);
      alert("ไฟล์เสีย หรือ รูปแบบไม่ถูกต้อง");
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: "raster",
            // เปลี่ยนเป็น Esri เพื่อความคมชัดตามที่คุยกัน
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

    map.on("load", () => {
      map.setProjection({ type: "globe" });
    });

    mapRef.current = map;
    return () => map.remove();
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* ส่วนปุ่มอัปโหลด */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 10,
          background: "rgba(255,255,255,0.9)",
          padding: "15px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        }}
      >
        <label
          style={{
            display: "block",
            marginBottom: "5px",
            fontWeight: "bold",
            fontSize: "14px",
          }}
        >
          Upload Shapefile (.zip)
        </label>
        <input
          type="file"
          accept=".zip"
          onChange={handleFileUpload}
          style={{ fontSize: "12px" }}
        />
        <p style={{ fontSize: "10px", color: "#666", marginTop: "5px" }}>
          *ต้องมีไฟล์ .shp, .dbf, .shx อยู่ข้างใน zip
        </p>
      </div>

      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
      />
    </div>
  );
};

export default MapGlobeShp;
