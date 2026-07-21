import { useMatchStore } from "../store/useMatchStore.js";
import { Screen, TopBar, Card } from "../components/ui.jsx";
import { hasReflection } from "../constants/reflection.js";

// Insights hub — single home-screen entry for every analysis view.
// Each row explains WHEN to use that view, so the five report screens
// stop competing for attention on the home screen.

const ENTRIES = [
  {
    screen: "report",
    icon: "📊",
    title: "Full performance report",
    blurb: "The complete picture — every stat, chart and recommendation. Print or PDF for the coach.",
  },
  {
    screen: "customReport",
    icon: "📋",
    title: "Custom report",
    blurb: "Same report, but pick only the sections you want before printing.",
  },
  {
    screen: "patterns",
    icon: "🧠",
    title: "Patterns & tactical intelligence",
    blurb: "Rally-level tactics: what wins points, what leaks them, and goal tracking.",
  },
  {
    screen: "scouting",
    icon: "🎯",
    title: "Scouting dossier",
    blurb: "Per-opponent profiles — history, notes and AI insights before a rematch.",
  },
  {
    screen: "reflectionTrends",
    icon: "📝",
    title: "Reflection trends",
    blurb: "How the player felt over time — self-ratings, feelings mix, big-point mindset.",
  },
];

export default function Insights({ setScreen }) {
  const matches = useMatchStore((s) => s.matches);
  const reflectedCount = matches.filter(hasReflection).length;
  const totalRallies = matches.reduce((a, m) => a + m.rallies.length, 0);

  return (
    <Screen>
      <TopBar
        title="Insights & reports"
        subtitle={`${matches.length} match${matches.length !== 1 ? "es" : ""} · ${totalRallies} rallies · ${reflectedCount} reflected`}
        onBack={() => setScreen("home")}
      />

      <div className="flex flex-col gap-2">
        {ENTRIES.map((e) => (
          <Card key={e.screen} className="!p-0 overflow-hidden">
            <button
              onClick={() => setScreen(e.screen)}
              className="w-full text-left p-4 hover:bg-neutral-800/60 transition active:scale-[0.99] flex items-start gap-3"
            >
              <span className="text-2xl leading-none mt-0.5">{e.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-[15px] text-white">{e.title}</span>
                <span className="block text-[11px] text-neutral-500 leading-relaxed mt-0.5">{e.blurb}</span>
              </span>
              <span className="text-neutral-600 mt-1">→</span>
            </button>
          </Card>
        ))}
      </div>
    </Screen>
  );
}
