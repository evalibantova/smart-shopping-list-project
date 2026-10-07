# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-navigable-app-shell.md`
  summary: No lockfile (package-lock.json) — installs are non-reproducible across machines
  evidence: node_modules are pre-populated for this environment; no lockfile was generated. A clean `npm install` on another machine may install different patch versions. Resolve by committing a lockfile generated after confirming dependency resolution.
