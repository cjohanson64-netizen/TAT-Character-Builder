export function CharacterStatePanel({ state, onTrainStat, onReset, isBusy }) {
  const stats = state?.stats ?? {};
  const character = state?.character ?? {};
  const status = state?.status ?? {};
  const resources = state?.resources ?? {};

  return (
    <section className="panel character-panel">
      <div className="panel-header character-panel-header">
        <div>
          <p className="eyebrow">Python Runtime State</p>
          <h2>{character.name}</h2>
          <p>
            Level {character.level} · XP {character.experiencePoints} ·{" "}
            {formatLabel(character.characterClass)}
          </p>
        </div>

        <button type="button" onClick={onReset} disabled={isBusy}>
          Reset
        </button>
      </div>

      <div className="runtime-summary-grid">
        <article className="runtime-summary-card">
          <span>HP</span>
          <strong>
            {resources.healthPoints?.current ?? 0} /{" "}
            {resources.healthPoints?.max ?? 0}
          </strong>
        </article>

        <article className="runtime-summary-card">
          <span>SP</span>
          <strong>
            {resources.skillPoints?.current ?? 0} /{" "}
            {resources.skillPoints?.max ?? 0}
          </strong>
        </article>
      </div>

      <article className="runtime-status-card">
        <span>Status</span>

        <div className="runtime-status-lines">
          <p>
            <strong>Buffs</strong>
            {(status.buffs ?? []).length ? status.buffs.join(", ") : "None"}
          </p>

          <p>
            <strong>Ailments</strong>
            {(status.ailments ?? []).length
              ? status.ailments.join(", ")
              : "None"}
          </p>
        </div>
      </article>

      <div className="stat-grid">
        {Object.entries(stats).map(([stat, value]) => (
          <article className="stat-card" key={stat}>
            <div>
              <span>{formatStatName(stat)}</span>
              <strong>{value}</strong>
            </div>

            <button
              type="button"
              onClick={() => onTrainStat(stat)}
              disabled={isBusy}
            >
              Train +1
            </button>
          </article>
        ))}
      </div>

      <p className="boundary-note">
        Python mutates these values. TAT still owns what the values mean.
      </p>
    </section>
  );
}

function formatStatName(value) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatLabel(value) {
  if (!value) return "Unknown";

  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}