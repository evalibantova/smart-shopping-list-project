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
| `--surface2` | `#f7f3ee` | Hover tint (inputs, steppers), tag panel background |
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
- `.page` — `flex: 1; display: flex; flex-direction: column; min-height: 0; overflow-y: auto` — the page itself scrolls by default.
- `.page--fit` — modifier that sets `overflow-y: hidden` on `.page`. Use on pages where a full-height inner panel owns the scroll boundary (e.g. Meal Planner's `planner-grid-wrapper`). Without this modifier the page scrolls itself and the inner panel never fills the viewport height.
- `.page-header` — `display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; flex-shrink: 0` — **title and primary controls share one row**. Never use `flex-direction: column` here.
  - **Padding rule (enforced in CSS, do not override per-page):** both sides `max(24px, env(safe-area-inset-*) + 24px)` — symmetric 24 px minimum, extended automatically on notched devices. List rows inside the page use the same `24px` horizontal padding to align content with the header. Children have `flex-shrink: 0` so buttons are never compressed; only the `h1` title is allowed to shrink.
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

### Buttons (`<Button>` component)

Implemented via `Button.tsx` using `class-variance-authority`. All sizes must have **visible horizontal padding** — never use a size that makes a button look like a plain label or a flush rectangle against the screen edge.

**Sizes:**

| `size` prop | Height | H-padding | Font | Use |
|---|---|---|---|---|
| `default` (omit prop) | 40 px | 18 px | 13 px / 600 | Page-level actions (headers, modals) |
| `sm` | 32 px | 14 px | 12 px / 600 | Compact actions in cards or toolbars |
| `xs` | 24 px | 12 px | 12 px / 600 | Inline row actions (save/cancel/delete in edit rows) |

**Padding rule:** Every size must feel comfortably padded — text should not crowd the button edge. 18 px / 14 px / 12 px are the minimums; do not reduce them. For page-header buttons, always use the default size so they have the same visual weight as other primary page actions.

**Intents:**

| `intent` prop | Background | Text | Use |
|---|---|---|---|
| `primary` | `--charcoal` | white | Primary action |
| `coral` | `--coral` | white | Highlight / confirm action |
| `secondary` | `--surface` + shadow | `--text-mid` | Secondary |
| `amber` | `--amber-pale` | `--amber` | Warning action |
| `ghost` | transparent | `--text-dim` | Tertiary / cancel |
| `danger` | `--red-pale` | `--red` | Destructive |

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

**Selectable tags** (recipe form): unselected tags stay flat, with `--text-mid` text. A selected tag gets a background tinted 14% in its own color, its text in the tag color, and a trailing ✓. Selectable tags are real `<button>`s with `aria-pressed` and a coral focus ring. A tinted background on *selected* tags is the only exception to "no background" on tags.

### Form inputs (`.field`) — the ledger style

One look for every text, number, select and textarea field in the app. Like the line on a handwritten recipe card:

| State | Look |
|---|---|
| Rest | transparent, `border-bottom: 2px dotted --text-dim`, `padding: 9px 12px`, 14 px |
| Hover | `background: --surface2` |
| Focus | `background: --coral-pale; border-bottom: 2px solid --coral` |

- **Square corners, no fill, no outline** — the underline is the only chrome. Don't add borders or boxed fills to individual fields.
- **Labels** (`.form-label`): 11 px, 600, uppercase, 1 px tracking, `--text-mid`. An optional count sits after it in `--text-dim` (`.form-label-count`).
- **Stepper** (`.field-group` + `NumberInput`): `− [value] +` sharing one dotted underline; the underline and tint react to focus-within. Used for small counts (servings), not for amounts.
- **Quantity + unit** (`.qty-unit`): a right-aligned number field (tabular numerals) with the unit attached as a `--text-mid` 12 px suffix, one shared underline. Used for ingredient amounts — no stepper buttons.
- **Search field** (`.field-search`): a `.field` with a leading magnifier icon (Lucide, 14 px) positioned inside the left padding.
- **Title field** (`.rf-title`): the recipe name in the recipe form uses `.field` at 20 px / 800 / −0.04em and grows with its content, so one line sits on the underline.
- **Emoji badge** (`.rf-emoji`): a 52 px circle filled with `--coral-pale`, matching the circular meal-slot icons.
- **Unlinked ingredient** (typed text not yet bound to an ingredient): `--amber-pale` fill and a solid `--amber` underline; focus still shows coral.

### Modals (`Modal` component)

Every dialog uses the shared `Modal` component (`components/ui/Modal.tsx`) — don't hand-roll backdrop or card markup.

- Backdrop: `rgba(0,0,0,0.4)` + `backdrop-filter: blur(6px)`
- Modal: white, `--shadow-md`, `width: 480px; max-width: 94vw`
- Header: title at 18 px / 700 / −0.03em with a close icon button; `padding: 16px 16px 12px`, **no divider line**
- Body: scrolls vertically, never horizontally; `padding: 4px 16px 16px`. The `flush` prop removes the padding for full-bleed lists (recipe picker), whose search field stays sticky at the top.
- Footer (when present): right-aligned actions, `padding: 12px 16px`, separated from the body by a 1 px shadow line (`0 -1px 0 --border`) instead of a border. Confirm = `coral` button, cancel = `ghost`.
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
- **Row heights:** `grid-template-rows: auto 1fr 1fr 1fr` — the day-header row is auto-height; the three slot rows each take one-third of remaining vertical space so the grid fills the full page height. The outer grid wrapper must be `flex: 1; min-height: 0` and the grid itself must be `min-height: 100%` for this to work. Slot cells keep `min-height: 100px` as a floor.
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

**Recipes page mobile:** The right (detail) panel is hidden on mobile via `.recipe-detail-panel { display: none }` — the list takes full width. Tapping a recipe triggers a full-screen overlay (`position: fixed; inset: 0`) that slides in with `transform: translateX(100%)` → `translateX(0)`. A back button (chevron-left) appears in the overlay header.

---

## 10. Anti-patterns — What NOT to Do

This section documents known failure modes that cause the UI to drift away from the intended design. Treat every item here as a hard rule.

### Header layout

| ❌ Wrong | ✅ Correct |
|---|---|
| `flex-direction: column` on `.page-header` — stacks title above nav | `flex-direction: row; justify-content: space-between` — title left, nav right |
| `h1` at 26 px on mobile causes the nav to wrap to a second line | 18 px on mobile so title + nav fit in ~375 px |
| Adding a bottom border or separate background to the header row | Header shares the page background — no extra surface |
| Overriding `.page-header` padding inline or per-page (`style={{ padding: … }}`) | Let the CSS rule apply — it uses `max()` + `env(safe-area-inset-right)` to guarantee 20px minimum right clearance |
| Putting a flex-shrink button directly in `.page-header` without ensuring `flex-shrink: 0` | The CSS already sets `flex-shrink: 0` on all `.page-header > *`; only `h1` is allowed to shrink |

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

### Buttons

| ❌ Wrong | ✅ Correct |
|---|---|
| `size="sm"` on a page-header button — looks cramped, mismatched with title weight | Omit `size` (default) for all page-header buttons |
| Reducing px values below minimums (`default < 18px`, `sm < 14px`, `xs < 12px`) | Keep the spec values — buttons must feel padded at every size |
| Using `xs` in a page header to save space | Use `default`; if the header is tight, shorten the button label |

### General

| ❌ Wrong | ✅ Correct |
|---|---|
| Rounded-square (squircle) slot icon | Full circle (`border-radius: 50%`) |
| Pill-shaped or bordered tags in the recipe list | Flat colored text-only tags (dot + name, no background) |
| Blue used anywhere in the UI | Coral is the only accent. No blue. |
| Shadows replaced with borders | Borders removed; elevation expressed with `--shadow-sm` / `--shadow` |
| Filled grey, outlined or shadowed input boxes | The ledger `.field` (dotted underline, coral on focus) everywhere |
| Inline-styled `<input>`/`<select>` with their own border | `className="field"` |
| Hand-built modal backdrop/card markup | The shared `Modal` component |

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
