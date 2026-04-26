# Mode: main — Career-Ops command center

## Trigger
`/career-ops` (no arguments)

## Output

Display this menu:

```
╔══════════════════════════════════════════════════════════╗
║           CAREER-OPS — Job Search Command Center         ║
║           Nigerian Professional Edition                   ║
╚══════════════════════════════════════════════════════════╝

Target: Events | Fashion | Lifestyle | Business
Market: Lagos Hybrid + International Remote
Min: ₦200,000/month | $800+/month international
Mode: Full-time + Freelance (both active)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

QUICK ACTIONS:
  /career-ops {paste job URL or JD}  → Full pipeline (evaluate → cover letter → tracker)

SEARCH:
  /career-ops scan                   → Search Nigerian + international job boards
  /career-ops freelance              → Find fast-income freelance gigs

EVALUATE:
  /career-ops evaluate {URL or JD}   → Score a single opportunity
  /career-ops batch                  → Score multiple opportunities at once

APPLY:
  /career-ops coverletter {job}      → Generate tailored cover letter
  /career-ops apply {job}            → Full application package

TRACK:
  /career-ops tracker                → View application pipeline
  /career-ops tracker applied        → See submitted applications
  /career-ops tracker interviews     → See active interviews

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SETUP (do this first!):
  → Edit cv.md with your full CV
  → Edit config/profile.yml with your details and target roles
  → Then you're ready to start!

Current pipeline status:
```
[Read data/tracker.md and show quick summary counts]
```
```

## Auto-detect

If user pastes something that looks like a job URL (contains: linkedin.com/jobs, jobberman.com, greenhouse.io, ashbyhq.com, lever.co, etc.) → automatically run evaluate mode.

If user pastes a block of text that looks like a job description (contains keywords like "responsibilities", "requirements", "qualifications", "apply") → automatically run evaluate mode.

If user pastes a list of URLs → automatically run batch mode.
