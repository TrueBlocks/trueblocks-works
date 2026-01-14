# Rules of Engagement for ToDoList.md Creation

## 1. Input Sources
- Use the design conversation above as the primary source for creating `ToDoList.md`.
- Do not hallucinate or assume code behavior. Search the codebase or request user clarification for missing information.
- For third-party libraries or APIs (e.g., React, Mantine), consult latest online documentation or request user clarification.

## 2. File Operations
- Save the To Do list to `./ai/ToDoList.md`, overwriting if it exists.
- Create `./ai` folder and parent directories if missing.
- Remove any temporary files created during operation.

## 3. Table Format
- Use a Markdown table with columns:
  - **Task**: Task description, prefixed with task number (e.g., `1. Move management of X to component Y`).
  - **Step**: Step description, prefixed with step number (e.g., `1. Remove X from previous location`).
  - **Done**: Step completion status, using `✅` for complete, `-` for incomplete. Center-align with `:---:`.
- Ensure table width is < 80 characters, wrapping long descriptions for readability.
- Show the task only the first time it appears.

## 4. Numbering
- Use integers for task numbers (e.g., `1`, `2`).
- Use integers for step numbers, resetting per task (e.g., `1.1`, `1.2`, `2.1`).
- Refer to steps as `task.step` (e.g., `1.4`, `2.1`).

## 5. Completion Tracking
- When all steps in a task are complete and confirmed at checkpoint, keep them in place; do not relocate to a historical table.
- Do not maintain a "Completed Tasks" archive table. The user may remove or reset the entire list between planning cycles.
- If a step is intentionally abandoned, simply omit it from future revisions and mention its removal once in the checkpoint summary.

## 6. Interaction
- For "Where are we?", display the current task and step.
- Request clarification for unclear requirements using: "Please clarify: [specific question]."
- Provide a brief delta summary only (what changed since last checkpoint) to avoid repetition.

## 7. Dependencies
- Order steps to reflect dependencies within tasks. No additional dependency notation needed.
- Use `yarn` exclusively for package/script operations; never use `npm` or `npx`.

## 8. Task Requirements
- Every task must have at least one step. Remove tasks without steps.
- Include a "Checkpoint" row after logical steps, pausing for user confirmation before proceeding.
- A checkpoint must summarize: completed steps (IDs), newly introduced risks, uncovered requirements (if any), and proposed next step.

## 9. Code Generation
- Reference the latest codebase, reloading changed files.
- Adhere to `./frontend/eslint.config.js`, `./frontend/tsconfig.json`, and `.prettierrc` for code style and linting.
- Do not import `React` in TypeScript; it’s implicitly available.
- Use Mantine for styling, avoiding inline styles. Create associated `.css` files for styles.
- Avoid hard-coded visual styles in components.
- Use the `Log` function from `@utils` for logging in TypeScript. Never use `console.log`.
- Format code per Visual Studio Code’s save settings for `.go` and `.tsx`.
- Do not include comments in code, tests, or documentation.
- Do not introduce any lint/security suppression without explicit user approval; propose a fix or alternatives instead.
- When applying a patch, do not replace removed code with comments referring to the removed code unless needed for clarity. Usually, it is not needed and in fact, creates confusion.

## 10. Testing with Vitest
- Do not run any tests during task implementation. The user will run tests and report findings.
- If you must test something, use Vitest for all tests, never Jest.
- Import from Vitest: `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'`.
- For components, use React Testing Library: `import { render, screen, fireEvent } from '@testing-library/react'`.
- For hooks, use: `import { renderHook, act } from '@testing-library/react'`.
- Always avoid writing mocks if at all possible. If you must write a mock, first check in global-mocks.ts and mocks.ts to see if the mod already exists.
- Mock with `vi.mock()`, `vi.fn()`, `vi.spyOn()`.
- Before creating new mocks, check if suitable ones exist in `./frontend/src/__tests__/global-mocks.ts`.
- Strongly avoid defining mocks within individual test files; centralize them in the aforementioned global or general mock files.
- Place tests in `./__tests__/*.test.tsx` or `./__tests__/*.test.ts` adjacent to code in the code file's folder.
- Use the global test utils in in `./frontend/src/__tests__` to initialize tests if available.
- Use `beforeEach`/`afterEach` for setup/teardown.
- Mock timers with `vi.useFakeTimers()`/`vi.useRealTimers()`.
- Test async code with `await` or promises.
- Provide mock context providers for components using contexts such as `MantineProvider` or `AppContextProvider`.
- Generate test code before each checkpoint, but do not run them.
- If adding tests would duplicate existing coverage meaningfully, reference the existing test file and note the additional assertion to add instead of creating near‑duplicate files.
- When you encounter a difficult to solve test, instead of jumping in with hacky solutions that hide the underlying problem...try to fix the underlying problem. Ask questions before proceeding on layers of crud hiding underlying probems.

## 11. Linting
- Complete the entire task implementation first.
- After completing all task steps, run `yarn lint` to check for linting issues.
- Do not run `yarn test` or `yarn start` - the user will handle testing and execution.
- Prefer fixing root causes over adding suppressions; any proposed suppression must cite the rule ID and rationale and await approval.
- Any suppression (if approved) must be the minimal form and include a justification in the PR discussion, not inline unless required by tooling.

## 12. Error Handling
- Pause and notify user if linting fails after running `yarn lint`, awaiting fixes. Do not try to fix lints yourself.
- For build failures, attempt a minimal local fix (one small patch). If uncertainty remains, present options succinctly and pause.

## 13. Prioritization
- If rules conflict, prioritize linting issues, then request user clarification.
- Risk > Correctness > Performance > Micro-optimizations.

## 14. Documentation
- After all other changes are completed for a ToDoList, update any necessary documentation. This includes README.md files and, if found, files in `./book/src`.
- Process documentation changes (this file, `Invoker.md`) belong to Meta Mode; avoid mixing them with functional code alterations in the same checkpoint.

## 15. Coverage Mapping
- Maintain a transient mapping (can be summarized in a checkpoint message) from each explicit design requirement to a Task.step ID.
- Declare "Coverage: COMPLETE" once no requirement lacks a mapping.
- If a requirement is deferred, mark it clearly with rationale and (if known) its future trigger condition.

## 16. Mode Separation
- Design Mode: Clarify and document; no active step execution.
- Planning Mode: Produce/adjust `ToDoList.md` only.
- Execution Mode: Implement steps strictly in listed order unless reordering justified at a checkpoint.
- Meta Mode: Improve process artifacts only; do not change runtime semantics.

## 17. Dependency & Ordering Notes
- List hidden implicit prerequisites (e.g., environment variables, schema migrations) as steps instead of assuming their presence.
- If parallelizable steps exist, note them but still execute sequentially unless user approves parallel execution.

## 18. Logging & Security Exceptions
- Use per-line `//nolint:<rule>` (or language equivalent) with a short reason.
- Avoid repository-wide disables unless explicitly approved.