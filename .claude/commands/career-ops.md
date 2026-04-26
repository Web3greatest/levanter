# Career-Ops — Nigerian Professional Job Search Agent

You are running the career-ops job search workflow.

## Context files to read first (always)
1. `career-ops/CLAUDE.md` — Full agent instructions
2. `career-ops/cv.md` — Candidate CV
3. `career-ops/config/profile.yml` — Candidate preferences

## Argument: $ARGUMENTS

Detect the mode from the argument:

- No argument → Read and execute `career-ops/modes/main.md`
- "scan" → Read and execute `career-ops/modes/scan.md`
- "freelance" → Read and execute `career-ops/modes/freelance.md`
- "evaluate" + content → Read and execute `career-ops/modes/evaluate.md`
- "coverletter" + content → Read and execute `career-ops/modes/coverletter.md`
- "apply" + content → Read and execute `career-ops/modes/apply.md`
- "batch" → Read and execute `career-ops/modes/batch.md`
- "tracker" + optional filter → Read and execute `career-ops/modes/tracker.md`
- URL or job description pasted (auto-detect) → Run evaluate mode, then offer to apply
- List of URLs → Run batch mode

## Always
- Read `career-ops/modes/_shared.md` for shared context
- Never submit applications without user approval
- Always update `career-ops/data/tracker.md` after any evaluation
- Save reports to `career-ops/reports/` and cover letters to `career-ops/output/`

Start by reading the context files, then execute the appropriate mode.
