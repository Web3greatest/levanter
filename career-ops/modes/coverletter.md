# Mode: coverletter — Generate a personalized cover letter

## Trigger
`/career-ops coverletter {job description or report file}`
Or: Called automatically after evaluate mode recommends applying.

## Steps

### 1. Load context
Read:
- `cv.md` — skills, experience, achievements
- `config/profile.yml` — preferences, contact details
- The job's evaluation report (if exists in `reports/`)
- The original JD (re-fetch if URL, or use what was pasted)

### 2. Research the company (if URL available)
- Visit company website / LinkedIn
- Note: company mission, recent projects, tone of brand, industry position
- Find: hiring manager name if listed (use "Hiring Manager" if not)

### 3. Build the cover letter

**Structure (250-350 words):**

---

**PARAGRAPH 1 — THE HOOK (2-3 sentences)**
Open with something specific to THIS company and role.
Do NOT start with "I am writing to apply for..."
Options:
- Reference a specific company project/event/campaign you admire
- Reference a problem they solve that you care about
- Reference a recent company news/launch
- Reference your personal connection to the industry

**PARAGRAPH 2 — YOUR VALUE MATCH (3-4 sentences)**
Connect 2-3 specific skills/experiences from your CV to the JD requirements.
Use numbers and outcomes where possible.
Format: "[I did X] which gave me [skill Y] — directly applicable to [requirement Z from JD]"

**PARAGRAPH 3 — WHY THIS COMPANY SPECIFICALLY (2-3 sentences)**
Show you've done homework. Reference:
- Their specific work in the industry
- Their growth or direction
- Why this role excites you (be specific to THEIR context, not generic)

**PARAGRAPH 4 — CLOSING CTA (2 sentences)**
- Express enthusiasm (not desperation)
- Clear call to action: "I'd love to discuss how I can contribute to [specific thing]. Available for a call at your convenience."

---

**Tone rules:**
- Warm and professional (not stiff corporate)
- Confident (not boastful)
- Nigerian context: it's OK to acknowledge Lagos/Nigerian market knowledge
- No clichés: "hard worker", "team player", "passionate about..." — show don't tell

### 4. Format output

```
[Your Name]
[Your Email] | [Your Phone]
Lagos, Nigeria | [Date]

[Hiring Manager Name or "Hiring Team"]
[Company Name]

Dear [Name/Hiring Team],

[Cover letter body — 250-350 words]

Warm regards,
[Your Name]
```

### 5. Save and present

Save to `output/coverletter-[company]-[role]-[date].md`

Present to user with:
"Here's your cover letter for [Role] at [Company]. **Review before sending.** Want any adjustments?"

List any optional tweaks:
- "More formal?"
- "Emphasize [specific skill] more?"
- "Shorter version?"
- "Add [specific achievement]?"

### 6. Update tracker
Update status to APPLYING in `data/tracker.md`

## Cover Letter Quality Checklist
Before presenting, verify:
- [ ] Does NOT start with "I am writing to apply..."
- [ ] References something SPECIFIC to the company (not generic)
- [ ] Mentions at least 2 specific skills from the JD
- [ ] Includes at least 1 quantified achievement
- [ ] 250-350 words (count them)
- [ ] Includes correct contact details from profile.yml
- [ ] Correct company name and role title
- [ ] Professional but warm tone
