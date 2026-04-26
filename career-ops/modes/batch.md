# Mode: batch — Evaluate multiple job listings at once

## Trigger
`/career-ops batch`
User provides a list of URLs or pastes multiple JDs

## Goal
Process 5-20 job listings efficiently and return a ranked shortlist.

## Input formats accepted
1. List of URLs (one per line)
2. Multiple JDs pasted together (separated by "---")
3. A file path to a text file with URLs

## Steps

### 1. Collect all listings
Ask user to paste all URLs or JDs if not provided.
Confirm count: "Found X listings. Starting batch evaluation..."

### 2. Evaluate each listing
For each listing, run a quick version of evaluate mode:
- Extract key info (role, company, salary, mode, industry)
- Score all 5 dimensions
- Calculate final score
- Flag any red flags

Skip deep analysis at this stage — that comes after shortlisting.

### 3. Rank and filter

Present results as ranked table:

```
## Batch Evaluation Results — [Date]
Processed: X listings

### SHORTLIST — Apply to these (Score 3.5+)
| Rank | Score | Grade | Company | Role | Salary | Mode | Industry |
|------|-------|-------|---------|------|--------|------|---------|
| 1 | 4.8 | A | [Company] | [Role] | ₦350k | Hybrid | Events |
| 2 | 4.3 | B | [Company] | [Role] | $1500 | Remote | Fashion |
...

### BORDERLINE — Review these (Score 2.5-3.4)
[same table, fewer rows]

### SKIP — Below threshold (<2.5 or D grade)
[company, role, reason — one line each]

---
Total: X shortlisted | X borderline | X skipped
```

### 4. Ask for next steps

"Which would you like to apply to? I can:
- Generate cover letters for all shortlisted roles at once
- Deep-evaluate any specific listing
- Add all to tracker"

### 5. Batch cover letter generation

If user says "apply to all shortlisted" or selects multiple:
Generate cover letters one by one, each tailored to its JD.
Save each to `output/coverletter-[company]-[role]-[date].md`
Present each for review before moving to next.

### 6. Update tracker
Add all evaluated listings to `data/tracker.md` with appropriate status:
- Shortlisted → EVALUATING
- Applying → APPLYING
- Skipped → add with WITHDRAWN status and reason

## Efficiency tips for batch runs
- Process up to 10 listings before pausing for user review
- Group similar roles together in output
- Highlight the top 3 regardless of how many listings were processed
