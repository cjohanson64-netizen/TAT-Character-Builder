import { useEffect, useMemo, useState } from "react";
import {
  createSkillDefinition,
  getSkillDefinitions,
  resetSkillDefinitions,
} from "../api/characterBuilderApi";

const STAT_OPTIONS = [
  "strength",
  "defense",
  "intelligence",
  "resistance",
  "speed",
  "dexterity",
];

const OPERATOR_OPTIONS = [">=", ">", "<=", "<", "==", "!="];

const CLASS_OPTIONS = ["warrior", "mage", "rogue", "cleric"];

const DAMAGE_TYPES = [
  "physical",
  "fire",
  "ice",
  "lightning",
  "poison",
  "holy",
  "shadow",
  "arcane",
  "true",
];

const TARGET_OPTIONS = ["self", "ally", "enemy"];

const BUFF_OPTIONS = [
  "strengthUp",
  "defenseUp",
  "speedUp",
  "resistanceUp",
  "regeneration",
  "shielded",
  "focused",
];

const AILMENT_OPTIONS = [
  "burning",
  "frozen",
  "stunned",
  "poisoned",
  "weakened",
  "silenced",
  "slowed",
  "bleeding",
];

const EMPTY_FORM = {
  name: "",
  description: "",
  statRequirementEnabled: true,
  requiredStat: "strength",
  statOperator: ">=",
  statValue: 8,
  skillRequirementEnabled: false,
  requiredSkillId: "",
  levelRequirementEnabled: false,
  levelOperator: ">=",
  levelValue: 1,
  classRequirementEnabled: false,
  characterClass: "warrior",
  skillPoints: 0,
  healthPoints: 0,
  baseDamage: 0,
  baseHealAmount: 0,
  damageType: "physical",
  target: "enemy",
  buffs: [],
  statusAilments: [],
};

export function SkillBuilderPanel({ onSkillDefinitionsChanged }) {
  const [skills, setSkills] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function loadSkills() {
    const result = await getSkillDefinitions();
    setSkills(result.skills ?? []);
  }

  useEffect(() => {
    loadSkills().catch((requestError) => {
      setError(requestError.message);
    });
  }, []);

  const prerequisiteOptions = useMemo(
    () => skills.map((skill) => ({ id: skill.id, name: skill.name })),
    [skills],
  );

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = buildSkillPayload(form);

      const result = await createSkillDefinition(payload);
      setSkills(result.skills ?? []);

      setForm(EMPTY_FORM);
      onSkillDefinitionsChanged?.();

      setIsSubmitting(false);
    } catch (requestError) {
      setError(requestError.message);
      setIsSubmitting(false);
    }
  }

  async function handleResetSkills() {
    try {
      setIsSubmitting(true);
      setError(null);

      const result = await resetSkillDefinitions();
      setSkills(result.skills ?? []);
      onSkillDefinitionsChanged?.();

      setIsSubmitting(false);
    } catch (requestError) {
      setError(requestError.message);
      setIsSubmitting(false);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function toggleListValue(field, value) {
    setForm((current) => {
      const currentValues = current[field] ?? [];
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value];

      return {
        ...current,
        [field]: nextValues,
      };
    });
  }

  return (
    <section className="panel skill-builder-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">User Skill Builder</p>
          <h2>Create a Skill</h2>
          <p className="muted">
            React collects raw fields. Python stores them. TAT interprets what
            they mean.
          </p>
        </div>

        <button type="button" onClick={handleResetSkills} disabled={isSubmitting}>
          Reset Skills
        </button>
      </div>

      {error ? <div className="inline-error">{error}</div> : null}

      <form className="skill-builder-form" onSubmit={handleSubmit}>
        <fieldset className="form-section">
          <legend>Identity</legend>

          <label>
            <span>Skill Name</span>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Fire Slash"
              required
            />
          </label>

          <label>
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="A flaming weapon strike."
              rows={3}
            />
          </label>
        </fieldset>

        <fieldset className="form-section">
          <legend>Requirements</legend>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.statRequirementEnabled}
              onChange={(event) =>
                updateField("statRequirementEnabled", event.target.checked)
              }
            />
            <span>Require a stat value</span>
          </label>

          {form.statRequirementEnabled ? (
            <div className="form-grid three">
              <label>
                <span>Stat</span>
                <select
                  value={form.requiredStat}
                  onChange={(event) =>
                    updateField("requiredStat", event.target.value)
                  }
                >
                  {STAT_OPTIONS.map((stat) => (
                    <option key={stat} value={stat}>
                      {formatLabel(stat)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Operator</span>
                <select
                  value={form.statOperator}
                  onChange={(event) =>
                    updateField("statOperator", event.target.value)
                  }
                >
                  {OPERATOR_OPTIONS.map((operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Value</span>
                <input
                  type="number"
                  min="0"
                  value={form.statValue}
                  onChange={(event) =>
                    updateField("statValue", Number(event.target.value))
                  }
                />
              </label>
            </div>
          ) : null}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.skillRequirementEnabled}
              onChange={(event) =>
                updateField("skillRequirementEnabled", event.target.checked)
              }
            />
            <span>Require another skill</span>
          </label>

          {form.skillRequirementEnabled ? (
            <label>
              <span>Required Skill</span>
              <select
                value={form.requiredSkillId}
                onChange={(event) =>
                  updateField("requiredSkillId", event.target.value)
                }
              >
                <option value="">Choose a skill</option>
                {prerequisiteOptions.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.levelRequirementEnabled}
              onChange={(event) =>
                updateField("levelRequirementEnabled", event.target.checked)
              }
            />
            <span>Require a level</span>
          </label>

          {form.levelRequirementEnabled ? (
            <div className="form-grid two">
              <label>
                <span>Operator</span>
                <select
                  value={form.levelOperator}
                  onChange={(event) =>
                    updateField("levelOperator", event.target.value)
                  }
                >
                  {OPERATOR_OPTIONS.map((operator) => (
                    <option key={operator} value={operator}>
                      {operator}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Level</span>
                <input
                  type="number"
                  min="1"
                  value={form.levelValue}
                  onChange={(event) =>
                    updateField("levelValue", Number(event.target.value))
                  }
                />
              </label>
            </div>
          ) : null}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.classRequirementEnabled}
              onChange={(event) =>
                updateField("classRequirementEnabled", event.target.checked)
              }
            />
            <span>Require a character class</span>
          </label>

          {form.classRequirementEnabled ? (
            <label>
              <span>Class</span>
              <select
                value={form.characterClass}
                onChange={(event) =>
                  updateField("characterClass", event.target.value)
                }
              >
                {CLASS_OPTIONS.map((characterClass) => (
                  <option key={characterClass} value={characterClass}>
                    {formatLabel(characterClass)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </fieldset>

        <fieldset className="form-section">
          <legend>Cost</legend>

          <div className="form-grid two">
            <label>
              <span>Skill Point Cost</span>
              <input
                type="number"
                min="0"
                value={form.skillPoints}
                onChange={(event) =>
                  updateField("skillPoints", Number(event.target.value))
                }
              />
            </label>

            <label>
              <span>HP Cost</span>
              <input
                type="number"
                min="0"
                value={form.healthPoints}
                onChange={(event) =>
                  updateField("healthPoints", Number(event.target.value))
                }
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="form-section">
          <legend>Effects</legend>

          <div className="form-grid two">
            <label>
              <span>Base Damage</span>
              <input
                type="number"
                min="0"
                value={form.baseDamage}
                onChange={(event) =>
                  updateField("baseDamage", Number(event.target.value))
                }
              />
            </label>

            <label>
              <span>Base Heal Amount</span>
              <input
                type="number"
                min="0"
                value={form.baseHealAmount}
                onChange={(event) =>
                  updateField("baseHealAmount", Number(event.target.value))
                }
              />
            </label>
          </div>

          <div className="form-grid two">
            <label>
              <span>Damage Type</span>
              <select
                value={form.damageType}
                onChange={(event) =>
                  updateField("damageType", event.target.value)
                }
              >
                {DAMAGE_TYPES.map((damageType) => (
                  <option key={damageType} value={damageType}>
                    {formatLabel(damageType)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Target</span>
              <select
                value={form.target}
                onChange={(event) => updateField("target", event.target.value)}
              >
                {TARGET_OPTIONS.map((target) => (
                  <option key={target} value={target}>
                    {formatLabel(target)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="option-cluster">
            <p className="section-label">Buffs</p>
            <div className="chip-grid">
              {BUFF_OPTIONS.map((buff) => (
                <label className="chip-checkbox" key={buff}>
                  <input
                    type="checkbox"
                    checked={form.buffs.includes(buff)}
                    onChange={() => toggleListValue("buffs", buff)}
                  />
                  <span>{formatLabel(buff)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="option-cluster">
            <p className="section-label">Status Ailments</p>
            <div className="chip-grid">
              {AILMENT_OPTIONS.map((ailment) => (
                <label className="chip-checkbox" key={ailment}>
                  <input
                    type="checkbox"
                    checked={form.statusAilments.includes(ailment)}
                    onChange={() =>
                      toggleListValue("statusAilments", ailment)
                    }
                  />
                  <span>{formatLabel(ailment)}</span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <button className="submit-skill-button" type="submit" disabled={isSubmitting}>
          Create Skill
        </button>
      </form>

      <div className="created-skills-list">
        <p className="section-label">Stored Raw Skill Definitions</p>

        {skills.length ? (
          skills.map((skill) => (
            <article className="created-skill-card" key={skill.id}>
              <strong>{skill.name}</strong>
              <span>{skill.id}</span>
            </article>
          ))
        ) : (
          <p className="muted">No skills have been created yet.</p>
        )}
      </div>
    </section>
  );
}

function buildSkillPayload(form) {
  return {
    name: form.name,
    description: form.description,
    requirements: {
      stats: form.statRequirementEnabled
        ? [
            {
              stat: form.requiredStat,
              operator: form.statOperator,
              value: form.statValue,
            },
          ]
        : [],
      skills:
        form.skillRequirementEnabled && form.requiredSkillId
          ? [
              {
                skillId: form.requiredSkillId,
                status: "learned",
              },
            ]
          : [],
      level: form.levelRequirementEnabled
        ? {
            operator: form.levelOperator,
            value: form.levelValue,
          }
        : null,
      characterClass: form.classRequirementEnabled
        ? form.characterClass
        : null,
    },
    cost: {
      skillPoints: form.skillPoints,
      healthPoints: form.healthPoints,
    },
    effects: {
      baseDamage: form.baseDamage,
      baseHealAmount: form.baseHealAmount,
      damageType: form.damageType,
      buffs: form.buffs,
      statusAilments: form.statusAilments,
      target: form.target,
    },
  };
}

function formatLabel(value) {
  if (!value) return "Unknown";

  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
}