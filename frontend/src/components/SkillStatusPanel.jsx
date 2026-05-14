import { useEffect, useState } from "react";
import {
  applyCharacterAction,
  fetchSkillStatus,
} from "../api/characterBuilderApi";
import { CharacterStatePanel } from "./CharacterStatePanel";
import { SkillStatusCard } from "./SkillStatusCard";
import { UserSkillProjectionPanel } from "./UserSkillProjectionPanel";

export function SkillStatusPanel() {
  const [characterState, setCharacterState] = useState(null);
  const [skillStatus, setSkillStatus] = useState(null);
  const [status, setStatus] = useState("loading");
  const [actionStatus, setActionStatus] = useState("idle");
  const [error, setError] = useState(null);

  async function loadSkillStatus({ showLoading = true } = {}) {
    try {
      if (showLoading) {
        setStatus("loading");
      }

      setError(null);

      const data = await fetchSkillStatus();

      setCharacterState(data.state);
      setSkillStatus(data.skillStatus);
      setStatus("success");
    } catch (requestError) {
      setError(requestError.message);
      setStatus("error");
    }
  }

  async function runAction(action) {
    try {
      setActionStatus("running");
      setError(null);

      const updatedState = await applyCharacterAction(action);

      setCharacterState(updatedState);

      await loadSkillStatus({ showLoading: false });
      setActionStatus("idle");
    } catch (requestError) {
      setError(requestError.message);
      setActionStatus("idle");
    }
  }

  async function handleTrainStat(stat) {
    await runAction({
      actionType: "trainStat",
      target: stat,
      amount: 1,
    });
  }

  async function handleUnlockSkill(skillId) {
    await runAction({
      actionType: "unlockSkill",
      target: skillId,
    });
  }

  async function handleReset() {
    await runAction({
      actionType: "resetCharacter",
    });
  }

  useEffect(() => {
    let isMounted = true;

    fetchSkillStatus()
      .then((data) => {
        if (!isMounted) return;

        setCharacterState(data.state);
        setSkillStatus(data.skillStatus);
        setStatus("success");
      })
      .catch((requestError) => {
        if (!isMounted) return;

        setError(requestError.message);
        setStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <section className="panel">
        <p className="eyebrow">TAT Projection</p>
        <h2>Loading skill status…</h2>
        <p className="muted">
          Python is calling the TAT runner and preparing the semantic view.
        </p>
      </section>
    );
  }

  if (status === "error") {
    return (
      <section className="panel error-panel">
        <p className="eyebrow">TAT Projection</p>
        <h2>Unable to load skill status</h2>
        <p>{error}</p>
        <button type="button" onClick={() => loadSkillStatus()}>
          Try again
        </button>
      </section>
    );
  }

  const cards = (skillStatus?.cards ?? []).map((card) => ({
    ...card,
    status: toSemanticId(card.status),
  }));
  const isBusy = actionStatus === "running";

  return (
    <div className="dashboard-grid">
      <CharacterStatePanel
        state={characterState}
        onTrainStat={handleTrainStat}
        onReset={handleReset}
        isBusy={isBusy}
      />

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">TAT → Python → React</p>
            <h2>Skill Status Projection</h2>
            <p className="muted">
              These cards are mapped from TAT’s semantic skill status graph.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadSkillStatus()}
            disabled={isBusy}
          >
            Refresh
          </button>
        </div>

        {error ? <p className="inline-error">{error}</p> : null}

        <div className="status-summary">
          <SummaryItem
            label="Unlocked"
            value={cards.filter((card) => card.status === "unlocked").length}
          />
          <SummaryItem
            label="Unlockable"
            value={cards.filter((card) => card.status === "unlockable").length}
          />
          <SummaryItem
            label="Locked"
            value={cards.filter((card) => card.status === "locked").length}
          />
          <SummaryItem label="Total" value={cards.length} />
        </div>

        <div className="skill-card-grid">
          {cards.map((card) => (
            <SkillStatusCard
              card={card}
              key={card.id}
              onUnlockSkill={handleUnlockSkill}
              isBusy={isBusy}
            />
          ))}
        </div>
        <UserSkillProjectionPanel userSkills={skillStatus.userSkills ?? []} />
      </section>
    </div>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="summary-item">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function toSemanticId(value) {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value;

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    return (
      value.id ?? value.name ?? value.value ?? value.label ?? value.type ?? ""
    );
  }

  return String(value);
}
