export function UserSkillProjectionPanel({ userSkills = [] }) {
  return (
    <section className="user-skill-projection">
      <div className="projection-header">
        <div>
          <p className="section-label">TAT-Projected User Skills</p>
          <p className="muted">
            These skills were created through React, stored by Python, injected
            into TAT, and returned through the projected graph.
          </p>
        </div>
      </div>

      {userSkills.length ? (
        <div className="user-skill-grid">
          {userSkills.map((skill) => (
            <article className="user-skill-card" key={skill.id}>
              <div>
                <h3>{skill.label}</h3>
                <p>{skill.description || "No description provided."}</p>
              </div>

              <UserSkillSection
                title="Requirements"
                items={skill.requirements}
                renderItem={renderRequirement}
              />

              <UserSkillSection
                title="Cost"
                items={skill.costs}
                renderItem={renderCost}
              />

              <UserSkillSection
                title="Effects"
                items={skill.effects}
                renderItem={renderEffect}
              />
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">No user-created skills are present in the TAT graph yet.</p>
      )}
    </section>
  );
}

function UserSkillSection({ title, items, renderItem }) {
  return (
    <div className="user-skill-section">
      <p className="section-label">{title}</p>

      {items.length ? (
        <div className="user-skill-detail-list">
          {items.map((item) => (
            <div className="user-skill-detail" key={item.id}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">None</p>
      )}
    </div>
  );
}

function renderRequirement(requirement) {
  if (requirement.kind === "statRequirement") {
    return (
      <>
        <strong>{formatLabel(requirement.stat)}</strong>
        <span>{formatRequirementValue(requirement)}</span>
      </>
    );
  }

  if (requirement.kind === "skillRequirement") {
    return (
      <>
        <strong>Skill</strong>
        <span>
          {formatLabel(requirement.requiredSkill)} {formatLabel(requirement.requiredStatus)}
        </span>
      </>
    );
  }

  if (requirement.kind === "levelRequirement") {
    return (
      <>
        <strong>Level</strong>
        <span>{formatRequirementValue(requirement)}</span>
      </>
    );
  }

  if (requirement.kind === "classRequirement") {
    return (
      <>
        <strong>Class</strong>
        <span>{formatLabel(requirement.requiredClass)}</span>
      </>
    );
  }

  return (
    <>
      <strong>{formatLabel(requirement.kind)}</strong>
      <span>{requirement.label}</span>
    </>
  );
}

function renderCost(cost) {
  return (
    <>
      <strong>{formatCostLabel(cost.kind)}</strong>
      <span>{cost.value}</span>
    </>
  );
}

function renderEffect(effect) {
  if (effect.kind === "damageEffect") {
    return (
      <>
        <strong>Damage</strong>
        <span>
          {effect.baseDamage} {formatLabel(effect.damageType)}
        </span>
      </>
    );
  }

  if (effect.kind === "healEffect") {
    return (
      <>
        <strong>Heal</strong>
        <span>
          {effect.baseHealAmount} HP
        </span>
      </>
    );
  }

  if (effect.kind === "buffEffect") {
    return (
      <>
        <strong>Buff</strong>
        <span>
          {formatLabel(effect.buff)} → {formatLabel(effect.target)}
        </span>
      </>
    );
  }

  if (effect.kind === "statusAilmentEffect") {
    return (
      <>
        <strong>Ailment</strong>
        <span>
          {formatLabel(effect.ailment)} → {formatLabel(effect.target)}
        </span>
      </>
    );
  }

  return (
    <>
      <strong>{formatLabel(effect.kind)}</strong>
      <span>{effect.label}</span>
    </>
  );
}

function formatLabel(value) {
  if (!value) return "Unknown";

  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function formatRequirementValue(requirement) {
  const value = requirement.requiredValue;

  if (requirement.operator === ">=") return `${value}+`;
  if (requirement.operator === ">") return `>${value}`;
  if (requirement.operator === "<=") return `≤${value}`;
  if (requirement.operator === "<") return `<${value}`;
  if (requirement.operator === "==") return `${value}`;
  if (requirement.operator === "!=") return `Not ${value}`;

  return value;
}

function formatCostLabel(kind) {
  if (kind === "skillPointCost") return "Skill Points";
  if (kind === "healthPointCost") return "Health Points";

  return formatLabel(kind);
}