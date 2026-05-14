export function SkillStatusCard({ card, onUnlockSkill, isBusy }) {
  const explanation = card.explanations?.[0];
  const canUnlock = card.status === "unlockable";

  return (
    <article className={`skill-card status-${card.status}`}>
      <div className="skill-card-header">
        <div>
          <p className="eyebrow">Skill</p>
          <h3>{formatSkillName(card.skill)}</h3>
        </div>

        <span className={`status-pill status-${card.status}`}>
          {card.displayStatus}
        </span>
      </div>

      <p className="skill-summary">{card.summary}</p>

      <div className="requirement-list">
        <p className="section-label">Requirements</p>

        {card.requirements?.length ? (
          card.requirements.map((requirement) => (
            <div
              className={`requirement requirement-${normalizeResult(
                requirement.result,
              )}`}
              key={requirement.id}
            >
              <div>
                <strong>{toDisplayValue(requirement.displayResult)}</strong>
                <span>{toDisplayValue(requirement.summary)}</span>
              </div>

              {requirement.prerequisiteSkill ? (
                <small>
                  Needs{" "}
                  {formatSkillName(
                    toDisplayValue(requirement.prerequisiteSkill),
                  )}
                </small>
              ) : (
                <small>
                  {formatValue(requirement.actualValue)} /{" "}
                  {formatValue(requirement.requiredValue)}
                </small>
              )}
            </div>
          ))
        ) : (
          <p className="muted">No requirements listed.</p>
        )}
      </div>

      {explanation ? (
        <div className="explanation-box">
          <p className="section-label">Why?</p>
          <p>{explanation.text}</p>
        </div>
      ) : null}

      {canUnlock ? (
        <button
          className="unlock-button"
          type="button"
          onClick={() => onUnlockSkill(card.skill)}
          disabled={isBusy}
        >
          Unlock {formatSkillName(card.skill)}
        </button>
      ) : null}
    </article>
  );
}

function normalizeResult(result) {
  const value = toDisplayValue(result);

  if (!value) return "unknown";

  return value.replace("requirement", "").toLowerCase();
}

function formatSkillName(value) {
  const displayValue = toDisplayValue(value);

  if (!displayValue) return "Unknown Skill";

  return displayValue
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatValue(value) {
  const displayValue = toDisplayValue(value);

  return displayValue || "—";
}

function toDisplayValue(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value;

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    return (
      value.id ??
      value.name ??
      value.value ??
      value.label ??
      value.type ??
      JSON.stringify(value)
    );
  }

  return String(value);
}