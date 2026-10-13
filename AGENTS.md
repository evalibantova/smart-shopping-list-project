# Agent Instructions

## Overview

Meal Planner & Shopping List web app — a React prototype for planning weekly meals and auto-generating a shopping list from recipe ingredients. See `CONTEXT.md` for the full project vision and design decisions.

## Off-limits

- Do not edit files under `design-v1/` — reference screenshots only
- `design-v2/` holds the interactive HTML mockup of the Edit Recipe modal (the ledger input style and modal design now implemented in `code/`). Treat it as reference; the live implementation and `docs/DESIGN.md` are the source of truth
---

# Project File Tree

```
data/
├── AGENTS.md                        # This file — project map for AI agents
├── CLAUDE.md                        # Auto-loads AGENTS.md at session start
├── CONTEXT.md                       # Project vision, core pillars, design decisions, and status
├── shopping-list-claude.bat         # Windows batch script to launch Claude Code for this project
├── shopping-list-pitch.html         # Self-contained pitch/presentation page for the app concept
├── shopping-list.sublime-project    # Sublime Text project config
├── shopping-list.sublime-workspace  # Sublime Text workspace state
├── code/                            # Production source code (not yet started — placeholder)
├── design-v2/                       # Interactive HTML mockup of the Edit Recipe modal (ledger input style)
│   └── edit-recipe-modal.html
├── design-v1/                       # Reference screenshots from the initial design pass
│   ├── cook-now-list.png
│   ├── cook-now-recipe-detail.png
│   ├── meal-planner-add-recipe-modal.png
│   ├── meal-planner-recipe-detail-modal.png
│   ├── new-recipe-modal.png
│   ├── pantry-edit-item.png
│   ├── pantry-new-item-modal.png
│   ├── pantry.png
│   ├── recipe-detail.png
│   ├── recipes-list.png
│   ├── shopping-list-checked.png
│   └── shopping-list.png
└── docs/
    ├── ALPHA-DEPLOY.md              # Step-by-step tracker for shipping the first alpha to hosting
    ├── BACKEND-STACK.md             # Backend tech stack decision (Slim v4 + MySQL)
    ├── DESIGN.md                    # Design system: colors, typography, component styles
    ├── COOKBOOK-IMPORT-WIRING.md    # The cookbook seed (cookbookSeed.json, source of truth) and how it is loaded
    ├── FUNCTIONALITY.md             # Feature spec: recipes, meal planner, shopping list, pantry
    ├── FUTURE-FEATURES.md           # Post-MVP feature backlog and AI chatbot architecture plan
    └── STACK.md                     # Frontend tech stack decisions with rationale
```