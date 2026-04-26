# Mode: scan — Search job boards for relevant openings

## Trigger
`/career-ops scan`
`/career-ops scan {specific industry or role type}`

## Goal
Search across Nigerian + international job boards and return a ranked list of opportunities matching the candidate profile.

## Search parameters (from profile.yml)
- Industries: Events, Fashion, Lifestyle, Business, Creative
- Locations: Lagos (hybrid/onsite) + Fully Remote (any location)
- Employment: Full-time + Contract/Freelance
- Salary: ₦200k+ Nigerian | $800+ international
- Date: Last 30 days preferred

## Step 1: Nigerian job board searches

**Jobberman (jobberman.com):**
Search queries:
- "Events Manager Lagos"
- "Brand Manager Lagos"
- "Fashion Marketing Lagos"
- "Lifestyle Brand Lagos"
- "PR Manager Lagos"
- "Creative Director Lagos"
- "Content Manager Lagos events fashion"
Filter: Full-time | Contract | Last 30 days | Lagos

**MyJobMag (myjobmag.com):**
- "Events Coordinator"
- "Fashion Brand Manager"
- "Marketing Manager Lagos"
Filter: Lagos | ₦200k+

**LinkedIn Jobs (nigeria filter):**
- "Events Manager" + Lagos + Posted last month
- "Brand Manager" + Lagos + Fashion/Lifestyle + Posted last month
- "Creative Manager" + Lagos + Remote + Posted last month

**HotNigerianJobs / NGCareers:**
- Browse: Marketing & Communications | Events | Fashion & Beauty

## Step 2: International remote searches

**We Work Remotely (weworkremotely.com):**
- Marketing & Sales → Africa-focused roles
- Design → Fashion/Lifestyle brands
- Management → Events

**Remote OK (remoteok.com):**
- Tags: marketing, events, creative, fashion

**LinkedIn Remote:**
- "Marketing Manager" + Remote + Fashion | Lifestyle | Events
- "Events Manager" + Remote + Africa | Nigeria

**Contra (contra.com):**
- Browse: Events | Marketing | Creative

## Step 3: Filter and rank results

For each opening found, run quick scan:
1. Does salary meet threshold? (flag if unstated)
2. Is work mode compatible? (remote/hybrid Lagos)
3. Is industry a match? (events/fashion/lifestyle/business)
4. Posted in last 30 days?

Only surface results that pass all 4 checks.

## Step 4: Present results

Format:

```
## Job Scan Results — [Date]
Searched: [list of boards]

### A-TIER — Apply immediately
| # | Role | Company | Mode | Salary | Posted | Board |
|---|------|---------|------|--------|--------|-------|
| 1 | ... | ... | Remote | ₦Xk | 3d ago | Jobberman |

### B-TIER — Good fit, lower priority
[same table]

### FREELANCE/CONTRACT
[same table]

### INTERNATIONAL REMOTE
[same table]

### FLAGGED — Needs more info before deciding
[roles where salary unstated or other question marks]

---
**Next step:** Run `/career-ops evaluate [URL]` on any A-tier role.
Or: `/career-ops apply [number]` to start the full application for one.
```

## Step 5: Update tracker

Add all A-tier and B-tier findings to `data/tracker.md` as status: FOUND.

## Notes on Nigerian job search
- Many Lagos companies post on Instagram/Twitter first — check @jobberman_ng, @myjobmag
- Company Slack communities: check Lagos Tech Girls, Creative Hub Lagos, Fashion Business Network
- WhatsApp job groups: ask network contacts for access
- Facebook groups: "Jobs in Lagos", "Nigerian Fashion Industry Jobs"
