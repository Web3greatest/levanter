# Mode: evaluate — Score and analyze a job opportunity

## Trigger
`/career-ops evaluate {job URL or job description}`
Or: User pastes a job description or URL directly.

## Steps

### 1. Extract job details
If URL provided: fetch the page and extract all details.
If JD pasted: parse directly.

Extract:
- Company name & industry
- Role title
- Location / work mode (remote/hybrid/onsite)
- Salary (if stated)
- Key responsibilities
- Required skills/experience
- Application deadline
- Contact/application method

### 2. Score the opportunity (5-point scale)

Calculate each dimension:

**Role-CV Match (30%)**
- Read cv.md and compare skills to JD requirements
- Score 5: 80%+ match | 4: 60-79% | 3: 40-59% | 2: 20-39% | 1: <20%

**Compensation (20%)**
- For ₦ roles: Score 5 if ₦300k+ | 4 if ₦250-299k | 3 if ₦200-249k | 2 if ₦150-199k | 1 if <₦150k or unstated (flag)
- For $ roles: Score 5 if $2000+ | 4 if $1500-1999 | 3 if $800-1499 | 2 if $500-799 | 1 if <$500

**Industry Fit (20%)**
- Score 5: Events/Fashion/Lifestyle/Creative — perfect fit
- Score 4: Marketing/PR/Media — strong adjacent
- Score 3: General business/consulting — workable
- Score 2: Tech/Finance but creative team — possible
- Score 1: No creative or events connection

**Work Mode (15%)**
- Score 5: International remote (USD) OR Hybrid Lagos (great commute area)
- Score 4: Fully remote Nigeria
- Score 3: Hybrid Lagos (farther location)
- Score 2: Onsite Lagos (close)
- Score 1: Onsite outside Lagos / No remote option

**Growth Potential (15%)**
- Score 5: Established company, clear progression, skills development
- Score 4: Growing company with good trajectory
- Score 3: Stable but limited growth
- Score 2: Startup with risk but upside
- Score 1: Red flags (no reviews, vague role, demanding with low pay)

### 3. Calculate final score
`Final = (Match×0.30) + (Comp×0.20) + (Industry×0.20) + (Mode×0.15) + (Growth×0.15)`

Grade: A (4.5+) | B (3.5-4.4) | C (2.5-3.4) | D (<2.5 — do not apply)

### 4. Red flag check
Flag these immediately:
- Salary below ₦200k (Nigerian) or $800 (international)
- "Work from home" with no equipment provided
- Commission-only with no base
- Unpaid trial/test period longer than 2 hours
- No company name / anonymous listing
- Requirements list is 5x longer than responsibilities
- "Unlimited vacation" without other benefits

### 5. Generate report

Save to `reports/YYYY-MM-DD-[company]-[role].md`:

```markdown
# [Company] — [Role Title]
**Date Evaluated:** [date]
**Source:** [URL or "pasted JD"]
**Status:** EVALUATING

## The Role
[2-3 sentence summary]

## Score Card
| Dimension | Score | Weight | Weighted |
|-----------|-------|--------|---------|
| Role-CV Match | X/5 | 30% | X |
| Compensation | X/5 | 20% | X |
| Industry Fit | X/5 | 20% | X |
| Work Mode | X/5 | 15% | X |
| Growth Potential | X/5 | 15% | X |
| **TOTAL** | | | **X/5 — Grade [A/B/C/D]** |

## Why Apply / Why Not
[2-3 bullet points each]

## Key Skills Match
✅ [Skill from JD that matches CV]
✅ [Skill from JD that matches CV]
⚠️ [Skill gap — manageable]
❌ [Hard gap — be honest]

## Compensation Analysis
[Details on pay, whether it meets threshold, negotiation room]

## Red Flags
[Any flagged items or "None identified"]

## Recommendation
**[APPLY / SKIP / APPLY ONLY IF {condition}]**
[1-2 sentence reasoning]
```

### 6. Update tracker
Add entry to `data/tracker.md` with status EVALUATING (or SKIP if D grade).

### 7. Present to user
Show the full report and ask:
"**Grade [X] — Recommendation: [APPLY/SKIP]**. Want me to [generate a cover letter / skip this one]?"
