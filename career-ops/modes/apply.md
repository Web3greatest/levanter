# Mode: apply — Prepare full application package for a specific job

## Trigger
`/career-ops apply {job URL or report filename}`

## Goal
Produce a complete, ready-to-submit application package:
1. Tailored cover letter
2. CV review with JD-specific keyword notes
3. Application checklist
4. Follow-up timeline

## Steps

### 1. Load all context
- Read `cv.md`
- Read `config/profile.yml`
- Read evaluation report from `reports/` (run evaluate mode first if not done)
- Re-read the original JD

### 2. Run evaluate mode if not done
If no report exists for this job, run full evaluation first.
Do NOT proceed if grade is D. Flag and ask user.

### 3. Generate tailored cover letter
Execute `modes/coverletter.md` instructions fully.

### 4. CV keyword audit
Compare JD requirements to CV:

```markdown
## CV Keyword Audit for [Company] — [Role]

### Keywords TO ADD to your CV (if truthful):
- "[JD keyword]" → Add to [section of CV]
- ...

### Keywords ALREADY IN your CV:
- "[Skill]" — appears in [section] ✅

### Gaps (skills not in CV and you don't have):
- "[Skill]" — be honest, don't fabricate
```

Present this as advice — user should only add keywords that are truthful.

### 5. Application checklist

```markdown
## Application Checklist — [Company] [Role]

**Required documents:**
- [ ] Updated CV (PDF)
- [ ] Cover letter (see output/coverletter-...)
- [ ] Portfolio link (if requested)
- [ ] References (if requested)

**Application method:** [Email / Portal URL / LinkedIn Easy Apply]
**Send to:** [email@company.com or portal name]
**Subject line (if email):** "Application: [Role Title] — [Your Name]"

**Before submitting, verify:**
- [ ] Cover letter has correct company name
- [ ] CV is up to date
- [ ] All links in CV work
- [ ] No typos in contact details
- [ ] File names are professional: "YourName_CV.pdf" not "CV_final_v3.pdf"
- [ ] Cover letter is attached (don't just put it in email body if they want attachment)

**Deadline:** [date or "Not stated — apply within 48 hours"]
```

### 6. Follow-up plan

```markdown
## Follow-up Timeline

- **Day 0:** Submit application
- **Day 7:** If no response, send polite follow-up email
- **Day 14:** If still no response, connect with hiring manager on LinkedIn
- **Day 21:** Mark as STALE in tracker if no response

Follow-up email template:
---
Subject: Following up — [Role] Application — [Your Name]

Dear [Name/Team],

I wanted to follow up on my application for the [Role] position submitted on [date].
I remain very interested in joining [Company] and would welcome the opportunity to discuss how my experience in [key skill] could contribute to your team.

Please let me know if you need any additional information.

Thank you for your time.

Warm regards,
[Your Name]
---
```

### 7. Update tracker
Update status from EVALUATING to APPLYING in `data/tracker.md`.

### 8. Present full package to user

Show:
1. Cover letter (full text)
2. CV keyword audit
3. Application checklist
4. Follow-up timeline

End with: "**Ready to submit? Review everything above. Once you've sent it, tell me and I'll mark it as APPLIED and set your follow-up reminder.**"

## CRITICAL REMINDER
This tool PREPARES applications. It does NOT submit them.
The candidate reviews and submits manually.
