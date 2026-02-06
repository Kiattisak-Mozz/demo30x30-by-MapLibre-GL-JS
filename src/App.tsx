import MapGlobe from "./component/MapGlobe";
import MapGlobeShp from "./component/MapGlobeShp";

function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* ส่วนหัวหรือเมนู (ถ้ามี) */}
      <div
        style={{
          position: "absolute",
          zIndex: 1,
          color: "white",
          padding: "10px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "20px" }}>My 3D Globe Search</h1>
      </div>

      {/* แผนที่เต็มจอ */}
      {/* <MapGlobe /> */}
      <MapGlobeShp />
    </div>
  );
}

export default App;
