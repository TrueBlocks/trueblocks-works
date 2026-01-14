# Invocation Guide

This file tells the assistant exactly how to pivot from a free‑form design conversation into a structured implementation planning cycle that produces and maintains `./ai/ToDoList.md`.

## 1. Modes
- Design Mode: Exploring, gathering constraints, producing or refining design docs (e.g. `DataDirRefactor.md`). No task table edits unless stabilizing scope.
- Planning Mode: Converting finalized design decisions into an actionable, checkpointed ToDoList.
- Execution Mode: Applying code/doc/test changes following the ToDoList steps, emitting checkpoints at required triggers.
- Meta Mode: Refining process artifacts (`Rules.md`, `Invoker.md`, templates) without changing runtime behavior.

## 2. When to Switch to Planning Mode
Switch when ALL are true:
1. Core problem statement is stable (no open “unknown / TBD” items bigger than a single step).
2. High‑risk architectural choices are documented or explicitly deferred.
3. User signals readiness (explicit request OR phrase like “switch to planning” / “create ToDoList”).

If any precondition missing: stay in Design Mode and request the missing clarification.

## 3. Planning Mode Inputs
- Latest design doc(s) in `./ai` plus any addenda.
- Current repository state (read relevant files instead of guessing).
- `./ai/Rules.md` (authoritative formatting & operational rules).
- Conversation transcript (recent decisions override earlier tentative ideas).

## 4. Required Outputs
1. Fresh or updated `./ai/ToDoList.md` complying with Rules.
2. Each task decomposed into minimally coherent, independently checkable steps.
3. Explicit “Checkpoint” row after meaningful completion clusters.
4. Coverage confirmation statement (every design requirement mapped to at least one step).

## 5. Task & Step Construction Heuristics
- Prefer vertical slices (end‑to‑end thin paths) over broad horizontal scaffolding unless a shared foundation is mandatory.
- One step = a narrowly scoped change you can implement without running full build/tests until the task checkpoint (typically a few minutes, not long involved refactors). Defer batch build/test validation to the checkpoint unless an immediate compile sanity check is trivial.
- Merge trivial adjacent steps; split steps that would touch > ~6 files or multiple subsystems.
- Surface risky / order‑sensitive steps earlier with exploratory validation artifacts (temporary test / spike) when needed.

## 6. Checkpoint Triggers (Emit Status & Pause if User Interaction Expected)
- After completing all steps under a task before proceeding to next task.
- On first test failure trace (summarize failure cause, do not continue blindly).
- Before adopting or adding a new dependency.

## 7. Coverage Verification Procedure
For every explicit design requirement or user mandate:
1. Map to a Task.step ID.
2. If unmapped, either add a step or record a deliberate deferral with reason.
3. State “Coverage: COMPLETE” or list gaps.

## 8. Failure Handling During Execution Mode
- Build fails: fix within the same turn if clearly local; otherwise summarize root cause & request decision when branching options exist.
- Lint fails: address unless change would contradict an accepted design trade‑off (then escalate for confirmation).
- Test flake suspicion: re‑run once; if nondeterministic, mark as flake, capture seed/log pointer.

## 9. Meta Mode Entry
Enter Meta Mode only when functional objectives are complete and remaining work concerns process doc clarity, future efficiency, or rule refinement. Do not alter runtime semantics while in Meta Mode.

## 10. Minimal Invocation Algorithm (Planning Mode)
1. Read `Rules.md` (ensure still aligned—if not, propose deltas first or enter Meta Mode).
2. Collect design constraints (read or re‑read active design docs & key code files implicated by scope).
3. Enumerate requirements (explicit + implicit stability/perf/testing obligations).
4. Group into tasks; order by risk + dependency.
5. Decompose into steps; insert checkpoints; ensure numbering.
6. Generate `ToDoList.md` (overwrite or surgically update preserving completed table).
7. Produce coverage confirmation summary.
8. Await user acknowledgement or start Execution Mode if prior auto‑proceed permission exists.

## 11. Prohibited While Planning
- Guessing unstated behaviors without inspection.
- Implementing code before ToDoList is accepted (unless user grants fast‑track).
- Collapsing multiple risk‑bearing changes into a single opaque step.

## 12. Example Abridged Step Pattern
Task: Internalize path X
Steps:
1. Add accessor
2. Refactor call sites
3. Remove legacy helper
4. Update tests
5. Checkpoint

## 13. Updating Existing ToDoList
- Always overwrite `ToDoList.md` when entering Planning Mode with a new task. Previous completed lists are considered historical.
- Do not maintain a historical "Completed Tasks" table; keep only the active task list for the current execution window.
- If scope expands mid‑execution, append new tasks at the end; do not renumber existing tasks.
- If a step becomes obsolete, note its removal succinctly in the next checkpoint summary (no need for a dedicated removed section) and exclude it from future tables.

## 14. Lint / Security Exceptions
- No lint or security suppression (per‑line, file, or global) may be added without explicit user approval. Default action: fix the underlying issue or propose alternatives.

## 15. Exit Criteria (Refactor / Feature Complete)
All tasks show ✅ for every step, all checkpoints passed, coverage mapping shows no gaps, and no open risk notes remain.

**Final Validation (required at end of entire ToDoList):**
1. Run `yarn lint --fix` — must pass with no errors
2. Run `yarn type-check` — must pass with no errors

Both commands must succeed before declaring the ToDoList complete. Do not run these validation commands during intermediate checkpoints — only at the very end after all tasks are complete.
