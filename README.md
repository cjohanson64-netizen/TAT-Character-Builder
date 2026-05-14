# TAT Character + Skill Builder

A small experimental character and skill builder app built to stress test **TAT (TryAngleTree)** as the semantic interpretation layer between Python and React.

The project follows a strict architecture rule:

```txt
Python owns raw data and API orchestration.
TAT owns semantics, relationships, requirements, and interpretation.
React owns rendering and user interaction.
````

## Overview

This app lets a character train stats, unlock skills, and create new custom skills through a React form.

User-created skills flow through the system like this:

```txt
React form
→ Python stores raw skill data
→ Python generates injectable TAT facts
→ TAT receives those facts through @inject
→ TAT returns a projected graph
→ React renders the projected view
```

The goal is not just to build a skill builder, but to test how far TAT can go as the source of semantic truth for app behavior.

## Current Features

* Character runtime state panel
* Trainable character stats
* Health Points and Skill Points
* Level, XP, class, buffs, and ailments
* Skill status cards
* Skill unlock actions
* User-created skill form
* Generated TAT skill-definition fragments
* TAT runtime injection for:

  * character runtime facts
  * user-created skill definitions
* React-rendered projection of user-created skills
* Fast compiled TAT runner using Node

## Tech Stack

* **React + Vite** for the frontend
* **Python + Flask** for backend API orchestration
* **TAT** for semantic graph interpretation
* **Node** for running the compiled TAT JSON runner

## Project Architecture

```txt
frontend/
  React UI components
  form inputs
  rendering only

backend/
  Flask API
  raw character state
  raw skill definition storage
  generated TAT fragments

tat/
  authored TAT files
  generated runtime TAT files

tat-library/
  TAT parser/runtime
  compiled JSON runner
```

## Core Rule

The app is intentionally designed so that Python and React do not decide game meaning.

Examples of things TAT should own:

* whether a skill is locked, ready, learned, or usable
* whether requirements are met
* what a cost means
* what effects mean
* how skill relationships are interpreted
* what should be projected for React

Python may store values like:

```json
{
  "strength": 10,
  "skillPoints": 3
}
```

But Python should not decide:

```json
{
  "canUseSkill": true
}
```

React may render a card, button, or form, but React should not decide whether a skill is ready or valid.

## Running the App

### Backend

```bash
python backend/app.py
```

The Flask backend runs at:

```txt
http://127.0.0.1:5050
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Build the TAT Runner

After changing TAT runtime/library code, rebuild the compiled runner:

```bash
npm run build:tat-runner
```

## Useful API Routes

```txt
GET  /api/health
GET  /api/character-builder/state
POST /api/character-builder/action
GET  /api/character-builder/skill-status
GET  /api/character-builder/skills
POST /api/character-builder/skills
POST /api/character-builder/skills/reset
```

## Current Milestone

The app currently proves that user-authored skills can be created through React, stored by Python as raw data, injected into TAT, and rendered back in React from TAT-projected graph data.

The next major step is generic TAT interpretation of user-created skill requirements, costs, and effects.

## Next Goals

* Interpret user-created skill requirements in TAT
* Project user-created skills as full status cards
* Add learned/ready/locked states for custom skills
* Interpret skill point and health point costs
* Interpret damage, healing, buffs, ailments, and targets
* Reduce hardcoded sample skill logic over time
* Move toward fully user-authored skill graphs