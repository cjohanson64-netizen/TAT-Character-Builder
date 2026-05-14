import "./App.css";
import { SkillStatusPanel } from "./components/SkillStatusPanel";
import { SkillBuilderPanel } from "./components/SkillBuilderPanel";

function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Character + Skill Builder</p>
        <h1>TAT Runtime Skill Projection</h1>
        <p>
          Python owns runtime orchestration, TAT owns semantic interpretation,
          and React renders the projected view.
        </p>
      </section>

      <div className="app-section-grid">
        <SkillStatusPanel />
        <SkillBuilderPanel />
      </div>
    </main>
  );
}

export default App;