# Story 2.1 — Weekly Calendar Grid: Acceptance Criteria

## AC1 — Calendar Structure
- The Meal Planner page renders a 7-column grid covering Monday through Sunday.
- Three meal rows appear: Breakfast, Lunch, Dinner (in that order, top to bottom).
- Each meal row has a rotated vertical label (9 px, uppercase) in a narrow 26 px label column on the left.
- Each day column is at minimum 110 px wide.
- Each row cell (meal slot) has a minimum height of 100 px.
- The grid has a total of 21 cells (7 days × 3 meals).

## AC2 — Week Navigation
- The page header contains a week navigation group on the right side.
- Navigation group order (left to right): prev-week button (`<`) · date range label · next-week button (`>`) · today button (CalendarCheck icon).
- Clicking `<` navigates to the previous week; the date range label updates.
- Clicking `>` navigates to the next week; the date range label updates.
- Clicking the today button always returns to the current week regardless of how many weeks away the view is.
- The today button is always visible (never hidden).
- The today button is visually dimmed (opacity 0.3) when the currently displayed week is the current week.
- The today button is at full opacity when displaying any week other than the current week.

## AC3 — Today Highlighting
- The column for today's date is visually distinguished: both the day name label and the date number are rendered in coral (`#f07045`).
- No other column uses coral for the day/date labels.
- When the viewed week does not include today (user navigated away), no column is highlighted in coral.

## AC4 — Mobile Horizontal Scroll
- The calendar grid is wrapped in a container with `overflow-x: auto` (or `overflow-x: scroll`), enabling horizontal scroll on narrow screens.
- At a viewport of ~375 px, approximately 3 day columns are visible; the user must scroll to see the remaining columns.
- The page body does not truncate the grid; it scrolls the grid horizontally rather than hiding columns.

## AC5 — Empty Slot Appearance
- A slot with no planned meals shows a centered `+` button (`.slot-add`).
- The empty slot has a faint background (lighter than the grid background).
- Clicking the `+` button is a valid interaction point (button element is present and focusable).

## AC6 — Page Header Layout
- The page header is a single horizontal flex row — never stacked vertically.
- The page title "Meal Planner" is on the left.
- The week navigation group (`< date > 📅`) is on the right.
- On mobile (< 768 px), the header remains a single row; the title shrinks to 18 px so it fits alongside the nav controls.

## AC7 — Slot Items (Populated)
- When a meal is planned for a slot, a `.slot-item` card appears in that cell.
- Each card contains a circular emoji badge (24 px diameter, `border-radius: 50%`) on the left.
- The recipe name appears to the right of the badge at 12 px / weight 500 and wraps to at most 2 lines.
- Recipe name text must NOT use `text-overflow: ellipsis`, `white-space: nowrap`, or a fixed height that clips content.
- A cooked meal card has a light coral-tinted background (`rgba(240,112,69,0.08)`).
- A cooked meal shows a small inline coral `✓` `<span>` directly after the recipe name (not a pseudo-element or overlay).
- A `+` add control appears at the bottom of any slot that already has items, allowing a second recipe to be added.

## AC8 — Date Range Format
- The date range label follows the pattern `D – D Mon YYYY` (en-dash `–` with a space on each side).
- Day numbers have no leading zeroes (e.g. `1` not `01`).
- The month is a 3-letter abbreviation only (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec).
- The month and year appear only once, at the end of the range (e.g. `21 – 27 Sep 2026`, never `21 Sep – 27 Sep 2026`).
- The week always starts on Monday and ends on Sunday.
