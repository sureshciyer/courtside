import { useState } from "react";
import Home from "./screens/Home.jsx";
import Setup from "./screens/Setup.jsx";
import Capture from "./screens/Capture.jsx";
import Summary from "./screens/Summary.jsx";
import History from "./screens/History.jsx";
import ExportScreen from "./screens/Export.jsx";
import Patterns from "./screens/Patterns.jsx";
import Report from "./screens/Report.jsx";
import CustomReport from "./screens/CustomReport.jsx";
import SettingsScreen from "./screens/Settings.jsx";
import Scouting from "./screens/Scouting.jsx";
import Reflection from "./screens/Reflection.jsx";
import ReflectionTrends from "./screens/ReflectionTrends.jsx";
import QuickLog from "./screens/QuickLog.jsx";
import Insights from "./screens/Insights.jsx";
import EditMatch from "./screens/EditMatch.jsx";
import PreMatchPlan from "./screens/PreMatchPlan.jsx";
import OpponentReflections from "./screens/OpponentReflections.jsx";

const SCREENS = {
  home: Home,
  setup: Setup,
  capture: Capture,
  summary: Summary,
  history: History,
  exportScreen: ExportScreen,
  patterns: Patterns,
  report: Report,
  customReport: CustomReport,
  scouting: Scouting,
  reflection: Reflection,
  reflectionTrends: ReflectionTrends,
  quickLog: QuickLog,
  insights: Insights,
  editMatch: EditMatch,
  preMatchPlan: PreMatchPlan,
  opponentReflections: OpponentReflections,
  settings: SettingsScreen,
};

export default function App() {
  const [screen, setScreen] = useState("home");
  const Current = SCREENS[screen] || Home;
  return <Current setScreen={setScreen} />;
}
