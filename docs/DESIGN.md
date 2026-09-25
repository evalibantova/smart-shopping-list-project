# Design Manual — Meal Planner Prototype

This document describes the visual design system used in the prototype. All new screens and components must follow these rules to maintain visual consistency.

---

## 1. Design Philosophy

- **Flat, no-border UI.** Cards and panels use shadow instead of border to separate surfaces.
- **No rounded corners by default.** All `--radius` tokens are set to `0`. Interactive elements (chips, checkboxes, modals on mobile) may use small radii contextually. Slot-item cards use `border-radius: 4px` as a contextual exception.
- **Icon-only action buttons.** Destructive and contextual actions use 44×44 px icon buttons — no labels — positioned in the top-right of the relevant component for thumb reach.
- **Mobile-first.** Desktop is a secondary breakpoint at 768 px. The primary target is a phone viewport (~375 px wide).
- **Warm, minimal palette.** Backgrounds are warm off-white. Accent is coral/orange. Surfaces are white. No blue.
- **Single-row page headers.** The page title and its primary view controls (week navigator, filter tabs) always share one horizontal flex row — title on the left, controls on the right. **Never stack them into two rows.**
- **No text truncation in content cards.** Recipe names in slot items wrap to up to 2 lines. Never apply `text-overflow: ellipsis` or `overflow: hidden` to recipe names inside the calendar grid.

---

## 2. Color Tokens

Defined as CSS custom properties on `:root`:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#f0ebe2` | Page background (warm off-white) |
| `--surface` | `#ffffff` | Cards, panels, inputs |
| `--surface2` | `#f7f3ee` | Input fill on focus-out, hover states |
| `--surface3` | `#ede8df` | Deeper hover / pressed states |
| `--charcoal` | `#1a1a1a` | Primary text, primary button background, sidebar |
| `--charcoal2` | `#2e2e2e` | Charcoal hover |
| `--coral` | `#f07045` | Accent — active nav, cooked state, progress fills, tags |
| `--coral-dark` | `#d95f35` | Coral hover |
| `--coral-pale` | `rgba(240,112,69,0.12)` | Coral tinted backgrounds |
| `--coral-border` | `rgba(240,112,69,0.3)` | Coral-tinted borders (editing state) |
| `--amber` | `#f5a623` | Warning / partial state |
| `--amber-pale` | `rgba(245,166,35,0.12)` | Amber tinted backgrounds |
| `--red` | `#e05c5c` | Destructive / missing ingredient |
| `--red-pale` | `rgba(224,92,92,0.10)` | Red tinted backgrounds |
| `--border` | `rgba(0,0,0,0.07)` | Subtle dividers (use sparingly) |
| `--border-mid` | `rgba(0,0,0,0.13)` | Checkbox border, slightly stronger divider |
| `--text` | `#1a1a1a` | Primary text |
| `--text-mid` | `rgba(0,0,0,0.52)` | Secondary text |
| `--text-dim` | `rgba(0,0,0,0.32)` | Placeholder, labels, dim metadata |

### Shadow scale

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 4px rgba(0,0,0,0.06), 0 2px 10px rgba(0,0,0,0.05)` | Default card elevation |
| `--shadow` | `0 2px 12px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.05)` | Hover elevation |
| `--shadow-md` | `0 8px 32px rgba(0,0,0,0.12)` | Modals |

---

## 3. Typography

**Font family:** `'Plus Jakarta Sans'`, with system-ui fallback.  
**Base:** 14 px / 1.5 line-height, antialiased.

| Element / Class | Size | Weight | Notes |
|---|---|---|---|
| `h1` | 26 px | 800 | Letter-spacing −0.05em |
| `h2` | 18 px | 700 | Letter-spacing −0.03em |
| `h3` | 15 px | 700 | Letter-spacing −0.02em |
| Page header title (desktop) | 22 px | 800 | Letter-spacing −0.04em. Sits inline (same row) with nav controls — do not make it so large it forces the nav to wrap. |
| Page header title (mobile) | 18 px | 800 | Letter-spacing −0.04em. Must fit on one row alongside the week-nav group at ~375 px viewport width. |
| `.col-label` | 10 px | 700 | Uppercase, 1.5 px letter-spacing — section labels |
| `.label-sm` | 11 px | 600 | 0.04em letter-spacing — metadata |
| `.form-label` | 11 px | 600 | Uppercase, 1 px letter-spacing |
| Body / default | 14 px | 400–500 | |
| Buttons | 13 px | 600 | |
| Small metadata | 11–12 px | 400–500 | |

**Letter-spacing pattern:** headings always use negative letter-spacing for a tight, editorial feel. Labels use positive tracking for legibility at small sizes.

---

## 4. Icons

**Library:** [Lucide React](https://lucide.dev) — consistent stroke-based icons, `strokeWidth={2}` default, `strokeWidth={2.5}` for small emphasis icons (e.g. Check mark).

**Standard icon sizes:**
- Navigation icons: 20 × 20 px
- Action button icons: 18 × 18 px
- Inline / metadata icons: 14–16 px

---

## 5. Layout System

### App shell

```
┌─────────────────────────────────────────┐
│  Sidebar (220 px, charcoal)             │  ← desktop only
├─────────────────────────────────────────┤
│  .main-content (flex: 1, overflow-y)    │
│  ┌──────────────────────────────────┐   │
│  │ .page-header (flex ROW)          │   │
│  │   [Page Title]   [< date-range > 📅] │
│  ├──────────────────────────────────┤   │
│  │ .page-body (flex: 1, overflow)   │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

- `.app` — `display: flex; height: 100vh; overflow: hidden`
- `.page` — `flex: 1; display: flex; flex-direction: column; min-height: 0`
- `.page-header` — `display: flex; flex-direction: row; align-items: center; justify-content: space-between; padding: 14px 16px; flex-shrink: 0` — **title and primary controls share one row**. Never use `flex-direction: column` here.
- `.page-body` — `flex: 1; overflow: hidden; display: flex`

### Sidebar (desktop)

- Width: `220px`, background `--charcoal`
- Brand label: 17 px, weight 800, white
- Nav links: 14 px, weight 500, `rgba(255,255,255,0.5)` inactive → `.active` class uses `--coral` background with white text
- Footer: 11 px, `rgba(255,255,255,0.25)`

### Mobile navigation

Below 768 px, the sidebar collapses to a **fixed bottom bar** (60 px tall, `background: var(--charcoal)`). Nav items become vertical icon + label stacks. Active state: coral icon + coral label text, **no background pill**. Brand and footer are hidden.

**Mobile nav order (left → right):** Recipes · Meal Planner · Pantry · Cook Now · Shopping List

**Mobile nav label rules:**
- Labels are **sentence-case short nouns** — never ALL CAPS, never truncated with ellipsis.
- Maximum 2 words. Preferred labels: `Recipes` · `Meal Planner` · `Pantry` · `Cook Now` · `Shopping List`.
- Font: 10 px, weight 600. Inactive color: `rgba(255,255,255,0.38)`. Active color: `var(--coral)`.
- Icon size: 20 × 20 px. Gap between icon and label: 3 px.

---

## 6. Component Library

### Buttons (`.btn`)

Base: `padding: 9px 18px; border: none; font-size: 13px; font-weight: 600`

| Class | Background | Text | Use |
|---|---|---|---|
| `.btn-primary` | `--charcoal` | white | Primary action |
| `.btn-coral` | `--coral` | white | Highlight action |
| `.btn-secondary` | `--surface` + shadow | `--text-mid` | Secondary |
| `.btn-amber` | `--amber` | white | Warning action |
| `.btn-ghost` | transparent | `--text-dim` | Tertiary / clear |
| `.btn-danger` | `rgba(red,0.1)` | `--red` | Destructive |
| `.btn-sm` | — | — | Modifier: 12 px, 6 px padding |
| `.btn-xs` | — | — | Modifier: 11 px, 4 px padding |

Hover: `opacity: 0.88`. Active: `scale(0.97)`.

### Icon-only action buttons (`.rd-act`)

44 × 44 px, transparent background, no border. Used for contextual actions in recipe detail headers.

| Modifier | Color | Use |
|---|---|---|
| (default) | `--text-dim` | Edit / neutral |
| `.accent` | `--charcoal` | Add to week |
| `.green` | `--coral` | Mark as cooked |
| `.green.active` | `--coral`, opacity 0.5 | Already cooked (non-interactive display) |
| `.danger` | `--red` | Remove / delete |

### Filter tabs (`.filter-tab`)

Pill-row of tabs: `padding: 7px 16px; font-size: 13px`. Active: `background: --coral; color: white`.

### Tags (`.tag-chip`)

Flat colored label — no background, no pill. `font-size: 11px; font-weight: 700`. Color set via inline `style` prop per tag. Dot prefix rendered alongside text.

### Form inputs (`.form-input`)

`background: --surface2; border: none; border-bottom: 2px solid transparent; padding: 9px 12px; font-size: 13px`  
Focus: `border-bottom-color: --coral; background: --surface`

Search input has embedded SVG magnifier icon via `background-image`.

### Modals (`.picker-modal`)

- Backdrop: `rgba(0,0,0,0.4)` + `backdrop-filter: blur(6px)`
- Modal: white, `--shadow-md`, `width: 480px; max-width: 94vw`
- Animation: `slideUp` (fade + translateY 16 px → 0)
- Mobile: full-width, bottom sheet (`border-radius: 16px 16px 0 0`), backdrop aligns to `flex-end`

### Toasts (`.toast`)

Fixed, centered horizontally at `bottom: 28px`. Charcoal background, white text, 13 px. Amber variant: `background: #8a5c00`. Animated in with `toastIn` (fade + slide up 10 px).

### Saving indicator (`.saving-indicator`)

Fixed `top: 14px; right: 18px`. 16 × 16 px spinning ring — `border: 2px solid --border; border-top-color: --accent`. Appears only while API mutations are in flight. `z-index: 9999`.

### Scrollbar

5 px wide, transparent track, `rgba(0,0,0,0.15)` thumb with 10 px radius.

---

## 7. Card Patterns

### Basic card (`.card`)
`background: --surface; box-shadow: --shadow-sm`

### Pantry item (`.pantry-item`)
White card with shadow-sm. Contains: name, quantity+unit, 52 px stock bar (coral/amber/red for hi/mid/lo). Click-to-edit inline — editing state uses `--surface2` background and `--coral-border` left accent.

### Meal slot item (`.slot-item`)
Small card inside the calendar grid:

```css
background: rgba(0,0,0,0.03);
padding: 5px 6px;
border-radius: 4px;          /* contextual exception to the no-radius rule */
display: flex;
align-items: flex-start;
gap: 6px;
```

Layout: circular icon badge (24 px, `border-radius: 50%`, colored tinted background with emoji) on the left; recipe name on the right. Recipe name is **12 px, weight 500, `line-height: 1.35`**.

**Text wrapping rules — strictly enforced:**
- Recipe names **wrap** to up to 2 lines.
- `overflow: hidden` and `text-overflow: ellipsis` are **forbidden** on `.slot-name`. Do not set `white-space: nowrap`.
- Do not set a fixed height on `.slot-item` — let it grow with content.

Cooked state: `background: rgba(240,112,69,0.08)`. The cooked indicator is a **small inline coral `✓`** (`font-size: 12px; color: var(--coral)`) rendered as a `<span>` directly appended after the recipe name text — **not** a `::after` pseudo-element, not a large watermark, not a separate row. It appears on the same visual line as the end of the name.

---

## 8. Meal Planner Grid

7-day horizontal-scrollable calendar grid:

```css
grid-template-columns: 26px repeat(7, minmax(110px, 1fr))
```

- Column 1 (26 px): rotated slot label (`writing-mode: vertical-rl; rotate(180deg); font-size: 9px; uppercase; 1.5 px letter-spacing`)
- Columns 2–8: meal slots, minimum 110 px each → forces horizontal scroll on mobile (~3 days visible at once)
- Row height: `min-height: 100px`, `flex: 1` so rows fill the available vertical space equally
- Today column: `color: --coral` on **both** the day-name label and the date number

### Week navigation bar

The page title and the week nav controls are on the **same single flex row** — never stacked. The `.page-header` is `flex-direction: row; justify-content: space-between`. The title is on the left; the nav group `[< label >] [today]` is on the right.

```
┌─────────────────────────────────────────────┐
│  Meal Planner      [<] [21 – 27 Sep 2026] [>] [📅]  │
└─────────────────────────────────────────────┘
         ↑ left                    ↑ right group
```

Nav elements (right group, left-to-right): `<` (prev) · date range label · `>` (next) · today icon button.

- **Date range format:** `D – D Mon YYYY` — e.g. `21 – 27 Sep 2026`. Rules: day numbers only (no leading zeroes), true en-dash (–) with a space on each side, **3-letter month abbreviation only** (Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec), full 4-digit year. **Never repeat the month on the start date** (wrong: `21 Sep – 27 Sep 2026`). **Never use 4-letter abbreviations** (wrong: `Sept`, `Oct.`).
- Today button: calendar-check icon, always visible; `opacity: 0.3` when already on the current week.

### Slot item icon

Each recipe in a slot is identified by a **circular icon badge** (~24 px diameter, `border-radius: 50%`), not a raw text emoji. The badge has a colored or tinted background with an emoji or food illustration. It sits to the left of the recipe name. Never use a rounded-square or generic avatar shape — the badge must be a full circle.

---

## 9. Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| `< 768px` (mobile) | Bottom nav bar, single-column layouts, bottom-sheet modals. Page header stays a single flex row — title shrinks to 18 px so it fits alongside nav controls. |
| `≥ 768px` (tablet/desktop) | Sidebar restored, two-column layouts (recipe list + detail), modals centered |

**Recipes page mobile:** Detail panel slides in as a full-screen overlay with `transform: translateX(100%)` → `translateX(0)`. Back button appears in header.

---

## 10. Anti-patterns — What NOT to Do

This section documents known failure modes that cause the UI to drift away from the intended design. Treat every item here as a hard rule.

### Header layout

| ❌ Wrong | ✅ Correct |
|---|---|
| `flex-direction: column` on `.page-header` — stacks title above nav | `flex-direction: row; justify-content: space-between` — title left, nav right |
| `h1` at 26 px on mobile causes the nav to wrap to a second line | 18 px on mobile so title + nav fit in ~375 px |
| Adding a bottom border or separate background to the header row | Header shares the page background — no extra surface |

### Date range format

| ❌ Wrong | ✅ Correct |
|---|---|
| `21 Sept – 27 Sept 2026` | `21 – 27 Sep 2026` |
| `Sep 21 – Sep 27, 2026` | `21 – 27 Sep 2026` |
| `21-27 Sep 2026` (hyphen) | `21 – 27 Sep 2026` (en-dash with spaces) |
| Month repeated on start date | Month appears once, at the end |

### Slot item text

| ❌ Wrong | ✅ Correct |
|---|---|
| `text-overflow: ellipsis` — `Scrambled Eggs &…` | Name wraps: `Scrambled Eggs` / `& Bacon` |
| `white-space: nowrap` | Default wrapping |
| Fixed height on `.slot-item` that clips content | Height grows with content |
| ✓ as a large `::after` watermark or overlay | ✓ as a small inline `<span>` after the name text |

### Bottom navigation

| ❌ Wrong | ✅ Correct |
|---|---|
| ALL CAPS labels (`RECIPES`, `COOK NOW`) | Sentence-case (`Recipes`, `Cook Now`) |
| Background pill or highlight on active item | Coral icon + coral label only, no background |
| Labels truncated with `…` | Labels chosen to fit at 10 px — shorten the word, don't truncate |
| Icon size > 20 px on mobile nav | 20 × 20 px |

### General

| ❌ Wrong | ✅ Correct |
|---|---|
| Rounded-square (squircle) slot icon | Full circle (`border-radius: 50%`) |
| Pill-shaped or bordered tags in the recipe list | Flat colored text-only tags (dot + name, no background) |
| Blue used anywhere in the UI | Coral is the only accent. No blue. |
| Shadows replaced with borders | Borders removed; elevation expressed with `--shadow-sm` / `--shadow` |

---

## 11. Animation & Motion

| Animation | Duration | Use |
|---|---|---|
| `fadeIn` | 0.15 s ease | Modal backdrop |
| `slideUp` | 0.20 s ease | Modal card |
| `toastIn` | 0.20 s ease | Toast notification |
| `saving-spin` | 0.7 s linear infinite | Saving indicator ring |
| `pulse-opacity` | 0.8 s ease-in-out infinite | Syncing meal slot watermark |
| Hover opacity | 0.15 s | Buttons, links |
| Button press | `scale(0.97)` 0.1 s | All `.btn` active |
| Stock bar width | 0.3 s | Pantry quantity change |
