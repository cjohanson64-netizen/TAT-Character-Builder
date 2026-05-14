export async function fetchCharacterState() {
  const response = await fetch("/api/character-builder/state");

  if (!response.ok) {
    throw new Error(`Character state request failed with ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Character state request failed.");
  }

  return data.state;
}

export async function fetchSkillStatus() {
  const response = await fetch("/api/character-builder/skill-status");

  if (!response.ok) {
    throw new Error(`Skill status request failed with ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    const message =
      data?.skillStatus?.error ||
      data?.debug?.diagnostics?.[0]?.message ||
      "Skill status request returned an unsuccessful response.";

    throw new Error(message);
  }

  return {
    state: data.state,
    skillStatus: data.skillStatus,
  };
}

export async function applyCharacterAction(action) {
  const response = await fetch("/api/character-builder/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(action),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error || `Character action failed with ${response.status}`,
    );
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Character action failed.");
  }

  return data.state;
}

export async function getSkillDefinitions() {
  const response = await fetch("/api/character-builder/skills");

  if (!response.ok) {
    throw new Error("Failed to load skill definitions.");
  }

  return response.json();
}

export async function createSkillDefinition(payload) {
  const response = await fetch("/api/character-builder/skills", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create skill definition.");
  }

  return response.json();
}

export async function resetSkillDefinitions() {
  const response = await fetch("/api/character-builder/skills/reset", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to reset skill definitions.");
  }

  return response.json();
}