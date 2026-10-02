import '@testing-library/jest-dom/vitest'

// React 19 schedules re-renders via queueMicrotask when useSyncExternalStore
// subscriptions fire (e.g. Zustand setState). In jsdom tests without act(),
// these microtasks run *after* synchronous test assertions, causing reactive
// tests to see stale DOM.
//
// Override queueMicrotask to run the callback synchronously so that any
// Zustand-triggered re-render is flushed before the next test assertion.
// React's own executionContext guards prevent re-entrant render issues.
globalThis.queueMicrotask = (fn: VoidFunction): void => {
  fn()
}
