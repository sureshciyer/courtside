import { useState } from "react";
import Home from "./screens/Home.jsx";
import Setup from "./screens/Setup.jsx";
import Capture from "./screens/Capture.jsx";
import Summary from "./screens/Summary.jsx";
import History from "./screens/History.jsx";
import ExportScreen from "./screens/Export.jsx";
import Patterns from "./screens/Patterns.jsx";

const SCREENS = {
  home: Home,
  setup: Setup,
  capture: Capture,
  summary: Summary,
  history: History,
  exportScreen: ExportScreen,
  patterns: Patterns,
};

export default function App() {
  const [screen, setScreen] = useState("home");
  const Current = SCREENS[screen] || Home;
  return (
    <div style={{ maxWidth: 420, margin: "0 auto", minHeight: "100vh", fontFamily: "Outfit,sans-serif" }}>
      <Current setScreen={setScreen} />
    </div>
  );
}
