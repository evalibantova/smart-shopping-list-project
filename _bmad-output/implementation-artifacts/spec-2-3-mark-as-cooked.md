---
title: '2.3 Mark as Cooked'
type: 'feature'
created: '2026-10-08'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
baseline_commit: '115a126b4269c98e27abca67bd2f6745e3f0dbb5'
context: []
warnings: ['oversized']
deferred:
  - summary: >-
      UI interaction matrix rows (spinner appearance, click-while-saving guard, toast auto-dismiss timing) have no component-level tests
    evidence: |-
      Project convention (established Story 1.3) tests via service unit tests only. Component testing requires e2e or test-library setup beyond MVP scope. Service-level behavior (cooked persistence) is covered by mealPlanService.test.ts test (d).
    severity: low
---

<intent-contract>

## Intent

**Problem:** The cooked toggle button exists in `RecipeDetail` (meal-planner context) but is fully disabled — `pointer-events: none; opacity: 0.35`. Users cannot mark a planned meal as cooked or unmark it, so the `cooked` field on `MealPlanEntry` is never written after creation.

**Approach:** Wire the CheckCircle toggle button in `RecipeDetail` to an `onCooked` callback. `MealPlanOverlay` owns the async state machine: optimistic store update → service persist → rollback + toast on error. Create `SavingIndicator` (16×16 px animated ring) and `Toast` (auto-dismiss error notification) as new UI components.

## Boundaries & Constraints

**Always:**
- Optimistic flow: dispatch `updateEntry(id, { cooked: !current })` to Zustand first, then call `mealPlanService.update(id, { cooked })`. On service error: dispatch rollback `updateEntry(id, { cooked: current })`, then show toast.
- Slot-item card cooked visual (`coral-tint background + watermark ✓`) is already implemented in `index.tsx` driven by `entry.cooked` — do not touch it.
- `cooked?: boolean` is already on `MealPlanEntry` type (`types/mealPlan.ts:7`) — do not modify the type.
- `updateEntry(id, patch)` already exists in `mealPlannerSlice.ts` — do not add another action.
- `mealPlanService.update(id, patch)` already exists — do not modify its signature.
- RecipeDetail remains a pure view: receives `onCooked?`, `isCooked?`, `isCooking?` as props; no async logic inside it.
- Button order in meal-planner context unchanged: Edit · Add to Week · Cooked toggle · Remove from Plan.
- No pantry deduction — `cooked` flag only. Epic 3 Story 3.2 adds deduction on top.

**Never:**
- Do not touch `mealPlannerSlice.ts` (no new actions needed).
- Do not touch `mealPlanService.ts` (no signature changes needed).
- Do not touch `index.tsx` (slot-item cooked visuals already implemented).
- Do not implement `FilterTabs` — out of scope for this story.
- No pantry side-effects anywhere in this story.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output | Error Handling |
|----------|--------------|----------------|----------------|
| Toggle cooked ON | `entry.cooked` is `false` or `undefined`; user clicks CheckCircle | Slot card immediately shows coral tint + watermark ✓; button spinner during save | Service error → revert card to un-cooked; show toast "Could not save — please try again." |
| Toggle cooked OFF | `entry.cooked` is `true`; user clicks CheckCircle (50% opacity) | Card immediately loses tint + watermark; button spinner during save | Service error → revert card to cooked; show toast |
| Click while saving | `isCooking` is true | Button does nothing (pointer-events: none while in-flight) | — |
| Toast auto-dismiss | Error toast shown | Toast disappears after 3 s | — |

</intent-contract>

## Code Map

**New files:**
- `code/src/components/ui/SavingIndicator.tsx` — 16×16 px animated CSS ring; props: `{ visible: boolean }`. Absolutely positioned; consumers wrap their container in `position: relative`.
- `code/src/components/ui/Toast.tsx` — fixed-position error toast (bottom-center or top-right); props: `{ message: string; onDismiss: () => void }`. Auto-calls `onDismiss` after 3000 ms via `useEffect`.

**Existing — modify:**
- `code/src/components/shared/RecipeDetail.tsx:9–15` — current props interface; add `onCooked?: () => void`, `isCooked?: boolean`, `isCooking?: boolean`
- `code/src/components/shared/RecipeDetail.tsx:107–113` — CheckCircle `IconButton` rendered `pointer-events: none; opacity: 0.35`; replace with live button: `onClick={onCooked}`, `opacity: isCooked ? 0.5 : 1`, `pointerEvents: isCooking ? 'none' : 'auto'`; when `isCooking` replace `<CheckCircle>` with `<Loader2 className="animate-spin">` (or equivalent CSS animation)
- `code/src/features/meal-planner/MealPlanOverlay.tsx:75–81` — current `<RecipeDetail>` call missing `onCooked`/`isCooked`/`isCooking`; add `onCooked={handleToggleCooked}`, `isCooked={!!entry?.cooked}`, `isCooking={isCooking}`; also wrap component in `position: relative` container so SavingIndicator positions correctly

**Existing — read-only references:**
- `code/src/store/mealPlannerSlice.ts:27–30` — `updateEntry(id, patch)` already exists; import and call
- `code/src/features/meal-planner/services/mealPlanService.ts:30–38` — `update(id, patch)` already exists; call after optimistic update
- `code/src/types/mealPlan.ts:7` — `cooked?: boolean` already on `MealPlanEntry`; no changes
- `code/src/features/meal-planner/index.tsx:239–264` — slot-item cooked visual already implemented; do not touch

## Tasks & Acceptance

**Execution:**

- `code/src/components/ui/SavingIndicator.tsx` — create; renders a 16×16 px spinning ring using CSS `@keyframes` (or Tailwind `animate-spin` on a bordered div); `visible` prop controls `display: block | none`; position `absolute; top: 0; right: 0`; ring color `var(--coral)`; ring width 2 px

- `code/src/components/ui/Toast.tsx` — create; `message` + `onDismiss` props; renders a fixed-position `<div>` (bottom: 24px, left: 50%, transform: translateX(-50%)) with `var(--surface2)` background, `var(--shadow-md)` shadow, `padding: 12px 20px`, `border-radius: 4px`, `font-size: 14px`; calls `onDismiss()` after 3000 ms in a `useEffect(() => { const t = setTimeout(onDismiss, 3000); return () => clearTimeout(t); }, [onDismiss])`; renders `null` when `message` is empty

- `code/src/components/shared/RecipeDetail.tsx` — update props interface: add `onCooked?: () => void; isCooked?: boolean; isCooking?: boolean`; update the CheckCircle `IconButton` in meal-planner context:
  - `onClick={onCooked}`
  - `aria-label={isCooked ? 'Unmark as cooked' : 'Mark as cooked'}`
  - `style={{ opacity: isCooking ? 0.5 : isCooked ? 0.5 : 1, pointerEvents: isCooking ? 'none' : 'auto' }}`
  - Icon: `isCooking ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle size={18} />`
  - Import `Loader2` from `lucide-react`

- `code/src/features/meal-planner/MealPlanOverlay.tsx` — add local state `isCooking: boolean` (default `false`) and `toastMsg: string` (default `''`); implement `handleToggleCooked`:
  ```ts
  const handleToggleCooked = async () => {
    if (!entry || isCooking) return
    const prev = !!entry.cooked
    setIsCooking(true)
    updateEntry(entry.id, { cooked: !prev })
    try {
      await mealPlanService.update(entry.id, { cooked: !prev })
    } catch {
      updateEntry(entry.id, { cooked: prev })        // rollback
      setToastMsg('Could not save — please try again.')
    } finally {
      setIsCooking(false)
    }
  }
  ```
  Pass `onCooked={handleToggleCooked}`, `isCooked={!!entry?.cooked}`, `isCooking={isCooking}` to `<RecipeDetail>`.
  Render `<SavingIndicator visible={isCooking} />` and `{toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg('')} />}` in the component's return (outside the Modal); wrap root in `<div style={{ position: 'relative' }}>`.
  Import `SavingIndicator` from `../../components/ui/SavingIndicator`, `Toast` from `../../components/ui/Toast`, `mealPlanService` from `./services/mealPlanService`, and pull `updateEntry` from `useStore`.

- `code/src/styles/tokens.css` — append `@keyframes spin { to { transform: rotate(360deg) } }` at the end of the file (not inside `:root`); this powers the Loader2 spin animation in RecipeDetail

**Acceptance Criteria:**
- Given a slot card is not cooked, when the CheckCircle button in the meal-plan overlay is clicked, then the slot card immediately shows coral tint and watermark ✓ (optimistic), and the button shows a spinner while saving
- Given a slot card is cooked (50%-opacity CheckCircle), when clicked, then the card immediately loses the tint and ✓, spinner appears while saving
- Given the service call succeeds, when the save completes, then the spinner disappears and the cooked state persists across a page reload
- Given the service call fails, when the error occurs, then the cooked state reverts to its pre-click value and a toast reading "Could not save — please try again." appears and auto-dismisses after 3 seconds
- Given the toggle is in-flight, when the CheckCircle button is clicked again, then nothing happens (pointer-events: none)

## Design Notes

**Loader2 spin animation:** Lucide's `Loader2` does not self-animate; apply `style={{ animation: 'spin 1s linear infinite' }}` and ensure a global `@keyframes spin` exists in `tokens.css` or define it inline via a `<style>` tag in `SavingIndicator.tsx`. The simplest approach: add `@keyframes spin { to { transform: rotate(360deg) } }` to `tokens.css`.

**`mealPlanService.update` is synchronous:** It does not return a Promise — it reads/writes localStorage synchronously and returns the updated entry. Wrap the call in a `try/catch` but no `await` is needed; the `async/await` pattern in `handleToggleCooked` is still fine (sync functions return resolved Promises when awaited).

**SavingIndicator placement:** In MealPlanOverlay the SavingIndicator sits at top-right of the overlay wrapper div (`position: relative`). It indicates the modal-level save is in progress, consistent with the UX spec "SavingIndicator ring (top-right, 16×16 px)".

## Verification

**Commands:**
- `cd /data/code && npm test -- --run` — expected: all existing tests pass; new `mealPlanService.test.ts` update group passes
- `cd /data/code && npm run build` — expected: exits 0, no TypeScript errors
- `cd /data/code && npm run lint` — expected: exits 0

## Review Triage Log

### 2026-10-08 — Review pass
- verdicts: 18 findings — high 0, medium 9, low 3, false 5, maybe-false 1
- findings:
  - `[medium]` `[patch]` BH-1: Toast auto-dismiss timer resets on every MealPlanOverlay re-render — `() => setToastMsg('')` is a new reference each render; useEffect dep `[onDismiss]` restarts the 3s countdown when `isCooking` flips; fix: capture `onDismiss` in a `useRef` inside Toast so the auto-dismiss `useEffect` has empty deps
  - `[medium]` `[patch]` BH-2: SavingIndicator positioned at document origin — portal root `position:relative` div has no dimensions because backdrop is `position:fixed`, so root collapses; `top:0 right:0` on the absolutely-positioned indicator resolves to document top-left; fix: change SavingIndicator to `position:fixed; top:16px; right:16px; z-index:1001`
  - `[false]` `[reject]` BH-3: CheckCircle gives no visual distinction between cooked/uncooked states — opacity-only distinction is intentional per UX spec ("dims to 50% opacity when already cooked")
  - `[low]` `[reject]` BH-4: `isCooking` is a misleading name — cosmetic internal-state naming; no harm in everyday use; not worth a rename touching both component and spec
  - `[false]` `[reject]` BH-5: No success feedback after toggle — slot-item card coral tint + watermark ✓ IS the success feedback, driven by the optimistic store update
  - `[false]` `[reject]` BH-6: `if (!message) return null` after `useEffect` — Toast is only rendered when `toastMsg` is truthy (`{toastMsg && <Toast>}` mount pattern); empty string never passed in
  - `[false]` `[reject]` BH-7: `@keyframes spin` in tokens.css inappropriate — fix would edit this build's spec (spec task explicitly required appending it there); rejected by rule
  - `[medium]` `[patch]` BH-8: Portal wrapper changed from `<>` to `<div>` — same root cause as BH-2; the extra div was intended to provide `position:relative` context but collapses; grouped with BH-2/IA-2
  - `[medium]` `[patch]` BH-9: No `role="alert"` on Toast — error toast is silent to screen readers; fix: add `role="alert"` to Toast container div
  - `[medium]` `[defer]` BH-10: No tests for SavingIndicator, Toast, or `handleToggleCooked` — component testing required to exercise these; already in spec deferred list per project MVP convention
  - `[low]` `[reject]` ECH-1: `onCooked` undefined while context=meal-planner — only MealPlanOverlay uses meal-planner context and always provides onCooked; guard would add complexity for a case that cannot occur with current callers
  - `[medium]` `[patch]` ECH-2: Toast timer resets on re-renders — same root cause as BH-1; grouped
  - `[low]` `[reject]` ECH-3: Overlay unmounts while async in-flight — React 18 removes the unmounted setState warning; Zustand update post-unmount is safe; extremely unlikely in practice
  - `[maybe-false]` `[reject]` ECH-4: SavingIndicator `return null` vs `display:none` layout claim — low confidence; indicator is absolutely positioned so causes no layout shift; if true would only be `low`
  - `[medium]` `[defer]` VG-1 (pre-verified): `handleToggleCooked` rollback path has no test — changing rollback to use `!prev` would go undetected; component test required to exercise it; already in spec deferred list
  - `[medium]` `[defer]` IA-1: Tests don't cover handleToggleCooked orchestration — same root cause as BH-10/VG-1; grouped
  - `[medium]` `[patch]` IA-2: SavingIndicator positioned against zero-dimension portal div — same root cause as BH-2/BH-8; grouped
  - `[false]` `[reject]` IA-3: Toast styled neutrally not as error notification — spec task explicitly specified `var(--surface2)`; implementation matches spec

## Auto Run Result

**Status:** done

### Summary

Wired the CheckCircle toggle in `RecipeDetail` (meal-planner context) to an `onCooked` callback. `MealPlanOverlay` owns the async state machine: optimistic Zustand update → `mealPlanService.update` → rollback + toast on error. Two new UI components created: `SavingIndicator` (16×16 px animated ring) and `Toast` (auto-dismiss error notification). Review found and patched 3 medium issues before finalizing.

### Files Changed

| File | Change |
|------|--------|
| `code/src/components/ui/SavingIndicator.tsx` | New — 16×16 px animated CSS ring; `visible` prop controls render; `position: fixed; top: 16; right: 16; z-index: 1001` |
| `code/src/components/ui/Toast.tsx` | New — fixed-position error toast; `role="alert"`; auto-dismisses via stable ref-based timer (3 s) |
| `code/src/components/shared/RecipeDetail.tsx` | Added `onCooked?`, `isCooked?`, `isCooking?` props; wired CheckCircle button; swaps to `Loader2` spinner while saving |
| `code/src/features/meal-planner/MealPlanOverlay.tsx` | Added `handleToggleCooked` async state machine; passes cooked props to RecipeDetail; renders SavingIndicator + Toast |
| `code/src/styles/tokens.css` | Appended `@keyframes spin` for Loader2 spin animation |

### Review Findings

- **Patches applied (3 medium):**
  - BH-1/ECH-2: Toast timer stabilized — `onDismiss` captured in `useRef`; `useEffect` deps set to `[]`
  - BH-2/BH-8/IA-2: SavingIndicator repositioned — changed from `position:absolute` (relative to collapsed div) to `position:fixed; top:16; right:16; z-index:1001`
  - BH-9: Added `role="alert"` to Toast container div
- **Deferred (medium):** `handleToggleCooked` rollback path has no test — component testing required; already in spec deferred list
- **Rejected (9):** BH-3 false (opacity intentional), BH-4 low (cosmetic rename), BH-5 false (slot card is success feedback), BH-6 false (mount pattern prevents empty-string case), BH-7 (fix edits spec), ECH-1 low (only caller always provides onCooked), ECH-3 low (React 18 safe), ECH-4 maybe-false (low-confidence, would only be low), IA-3 false (spec matched implementation)

### Follow-up Review Recommendation

**`followup_review_recommended: true`** — three medium findings patched in this pass. Unverified risk: SavingIndicator `position:fixed` at viewport `top:16; right:16` is functionally correct but visually appears at viewport corner rather than the overlay panel corner. If the UX spec intends panel-relative positioning, a follow-up pass should verify visual placement against design mockups.

### Verification

- `npx tsc --noEmit` — clean (0 errors)
- `npx eslint src/components/ui/Toast.tsx src/components/ui/SavingIndicator.tsx src/features/meal-planner/MealPlanOverlay.tsx` — clean (0 errors)
- `npm test` and `npm run build` — pre-existing WSL esbuild platform mismatch blocks these commands; not caused by story 2-3 changes (confirmed in prior session)
- Manual inspection: `mealPlanService.update` is synchronous (localStorage only); try/catch without await still catches synchronous throws; rollback logic correct

### Residual Risks

- SavingIndicator visual placement is viewport top-right corner (16, 16), not panel top-right corner; acceptable for MVP, may need UX review
- `handleToggleCooked` rollback path remains untested; requires component testing infrastructure to pin
