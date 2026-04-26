# Mode: tracker — View and manage your application pipeline

## Trigger
`/career-ops tracker`
`/career-ops tracker {status filter}`

## Goal
Show the current state of all applications, flag items needing action, and help manage the pipeline.

## Steps

### 1. Read tracker file
Open `data/tracker.md`

### 2. Parse and display

Group by status and show summary:

```
## Application Pipeline — [Date]

### Summary
| Status | Count |
|--------|-------|
| FOUND | X |
| EVALUATING | X |
| APPLYING | X |
| APPLIED | X |
| INTERVIEW | X |
| OFFER | X |
| REJECTED | X |
| WITHDRAWN | X |

### 🔴 NEEDS ACTION NOW
[Roles where follow-up is due or decision needed]

### 🟡 IN PROGRESS
[Currently being applied to]

### 🟢 APPLIED — Awaiting Response
[Submitted applications with dates]

### 💼 INTERVIEWS
[Active interview processes]

### 📋 PIPELINE (Found/Evaluating)
[Roles identified but not yet applied to]

### ✅ COMPLETED (Offer/Withdrawn/Rejected)
[Archive — last 30 days]
```

### 3. Flag action items

Auto-identify:
- Applied >7 days ago with no response → suggest follow-up
- APPLYING status >3 days → ask if submitted
- INTERVIEW status → ask for update
- OFFER status → congratulate and ask for decision

### 4. Accept updates

User can say things like:
- "Mark [company] as APPLIED" → update tracker
- "I got an interview at [company]" → update + generate interview prep
- "Reject [company] from list" → update to WITHDRAWN
- "[Company] rejected me" → update + ask for feedback to improve

## Tracker file format (`data/tracker.md`)

```markdown
# Application Tracker

Last updated: [date]

| Date Added | Company | Role | Type | Mode | Salary | Score | Status | Applied Date | Notes |
|-----------|---------|------|------|------|--------|-------|--------|-------------|-------|
| 2024-01-15 | BellaNaija | Content Manager | Full-time | Hybrid | ₦280k | 4.2/B | APPLIED | 2024-01-16 | Follow up Jan 23 |
| 2024-01-15 | Upwork Client | Event Planner | Freelance | Remote | $500/event | 3.8/B | APPLYING | — | Cover letter drafted |
```

## Status definitions

| Status | Meaning |
|--------|---------|
| FOUND | Identified, not yet evaluated |
| EVALUATING | Scoring in progress |
| APPLYING | Cover letter/materials being prepared |
| APPLIED | Submitted, waiting for response |
| INTERVIEW | In interview process |
| OFFER | Received an offer |
| REJECTED | Not selected (or rejected after applying) |
| WITHDRAWN | Decided not to pursue |
| STALE | No response after 21 days |
