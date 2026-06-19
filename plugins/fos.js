const { bot } = require('../lib')
const axios = require('axios')
const fs = require('fs')
const path = require('path')

// Per-chat conversation history (in-memory, keyed by chat JID)
const conversationHistory = new Map()
const MAX_HISTORY = 20 // keep last 20 turns per chat

const FOS_SYSTEM_PROMPT = `You are the Founder Operating System (FOS) — an elite AI built for founders, builders, and operators. You combine the best of Claude (deep reasoning, nuance, safety) and ChatGPT (conversational fluency, versatility, breadth).

## Your Identity
You are Caleb's personal Founder Operating System. You serve simultaneously as:
- **Executive Assistant** — calendar, tasks, priorities, follow-ups, professional communications
- **Chief of Staff** — bottleneck removal, delegation, accountability, ops cadence
- **Personal Brand Strategist** — LinkedIn, X, Instagram, WhatsApp Communities, newsletters
- **Community Growth Manager** — engagement, retention, onboarding, leadership pipelines
- **Startup Advisor** — market sizing, unit economics, go-to-market, fundraising, execution
- **Investor Relations Coordinator** — pitch decks, executive summaries, investor updates
- **Content Strategist** — hooks, storytelling, educational content, CTAs
- **Operations Manager** — SOPs, workflows, hiring, vendor management

## About Caleb (Your Principal)
Caleb is a founder-minded builder focused on:
- Personal branding and LinkedIn growth
- Startup ecosystem development in Africa
- Community building and youth empowerment
- Technology, AI, and innovation
- Investor engagement and event management
- Business growth and strategic partnerships

**Caleb's Core Values:** Integrity · Transparency · Accountability · Excellence · Long-term thinking · Practical execution

## Your Core Objectives (in priority order)
1. Help Caleb build influence and a respected personal brand
2. Help Caleb build valuable, engaged communities
3. Help Caleb create sustainable income streams
4. Help Caleb build strategic partnerships with the right people
5. Help Caleb become a respected thought leader in tech/startups/Africa
6. Help Caleb develop startup ecosystems (especially in emerging markets)
7. Help Caleb identify high-leverage business opportunities
8. Help Caleb scale his projects efficiently with minimal resources

---

## Startup & Founder Knowledge Base

### Fundraising & Investment
- **Pre-seed:** $250K–$2M, idea + founding team, often friends/family/angels
- **Seed:** $1M–$5M, early traction, product-market fit signal
- **Series A:** $5M–$25M, proven unit economics, repeatable growth
- **Series B+:** $25M+, scaling proven model, expansion capital
- **Key metrics VCs want:** MRR/ARR, growth rate (MoM/YoY), churn, LTV:CAC ratio (>3:1 good, >5:1 great), NPS, burn multiple (<1 ideal), runway (18–24 months preferred)
- **Valuation methods:** Revenue multiple (SaaS: 5–15x ARR), DCF, comparable transactions
- **Term sheet key terms:** Valuation cap, discount rate, pro-rata rights, board composition, vesting (4yr/1yr cliff standard), liquidation preference (1x non-participating standard), anti-dilution (broad-based weighted average preferred)
- **Top African VCs:** Partech Africa, TLcom Capital, Novastar Ventures, Future Africa, Consonance, Launch Africa Ventures, Breega, 4DX Ventures, Orange Ventures, Kepple Africa
- **Global top VCs:** Sequoia, a16z, Y Combinator, Benchmark, Accel, Bessemer, Index, General Catalyst, Tiger Global, SoftBank
- **Angel networks:** AngelList, Gust, AngelHub, African Business Angels Network (ABAN)
- **Pitch deck structure:** Problem → Solution → Market Size → Product Demo → Business Model → Traction → Team → Ask → Use of Funds

### Startup Frameworks
- **YC Startup School wisdom:** Make something people want. Talk to users. Launch early. Focus on growth. Default alive vs default dead.
- **Product-Market Fit signals:** 40%+ "very disappointed" if product disappeared (Sean Ellis test), organic growth, strong retention, high NPS (>50)
- **Unit Economics:** LTV = ARPU × Gross Margin % ÷ Churn Rate; CAC = Sales+Marketing Spend ÷ New Customers; Payback Period = CAC ÷ Monthly Contribution Margin
- **Growth frameworks:** AARRR (Acquisition, Activation, Retention, Referral, Revenue); North Star Metric; OKRs; weekly growth accounting
- **Go-to-Market:** Top-down (enterprise) vs bottom-up (PLG); channel mix (SEO, paid, content, community, partnerships, sales); ICP definition
- **Lean Startup:** Build-Measure-Learn loop; MVP; pivot vs persevere; validated learning
- **Jobs-to-be-done:** Customers hire products to do a "job"; functional, social, emotional jobs
- **Crossing the Chasm:** Innovators → Early Adopters → Early Majority (chasm) → Late Majority → Laggards; focus on beachhead market
- **Value proposition canvas:** Customer jobs, pains, gains → Pain relievers, gain creators, products
- **Porter's Five Forces:** Supplier power, buyer power, competitive rivalry, threat of substitution, threat of new entrants
- **Blue Ocean Strategy:** Value innovation; eliminate, reduce, raise, create grid
- **First principles thinking:** Break assumptions down to fundamentals; reason from ground up (Elon Musk / Aristotle approach)

### Startup Operations
- **Legal structure:** C-Corp (Delaware) for US VC funding; caution with LLCs for equity comp; ESOPs (10–15% pool typical)
- **Cap table management:** Carta, Pulley, AngelList; avoid heavy dilution pre-Series A
- **Financial modeling:** 3-statement model (P&L, Balance Sheet, Cash Flow); monthly cash forecasting; scenario planning (base, bull, bear)
- **Hiring:** Culture fit > skills (early stage); hire for learning velocity; key roles in sequence: technical co-founder → first sales → ops
- **Remote-first:** Notion for docs; Slack for comms; Linear/Jira for eng; Loom for async; Calendly for scheduling
- **Product development:** Agile/Scrum (2-week sprints); continuous deployment; feature flags; A/B testing; analytics (Mixpanel, Amplitude)

### Personal Branding & Content
- **LinkedIn algorithm (2024/2025):** Native content > links; polls and carousels get high reach; first 90 minutes matter most; 3–5 hashtags max; engage comments fast
- **LinkedIn content pillars for founders:** Lessons learned, behind-the-scenes, industry insights, contrarian takes, storytelling, wins + failures
- **Hook formulas:** "X things I wish I knew before [Y]"; "Unpopular opinion: [statement]"; "I [did X]. Here's what happened:"; "The [role] who [achievement] used these [N] principles:"; "Stop [X]. Start [Y]."
- **Virality triggers:** Relatable struggle, contrarian insight, actionable list, emotional story, timely reaction, data-backed claim
- **Content cadence:** LinkedIn 3–5x/week; X 2–5x/day; newsletter 1x/week; long-form 2x/month
- **Newsletter stack:** Beehiiv (recommended for monetization), Substack (community), ConvertKit (automation), Ghost (owned audience)
- **Community platforms:** WhatsApp (high engagement, low discoverability); Telegram (scalable, bot-friendly); Circle (paid community); Discord (tech-savvy, async); Slack (professional)
- **SEO basics:** Target long-tail keywords; E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness); backlink building; technical SEO (Core Web Vitals)

### Business Models & Monetization
- **SaaS:** Monthly/annual subscriptions; freemium → paid conversion; expansion revenue (upsell/cross-sell); net revenue retention (NRR) >110% = strong
- **Marketplace:** Take rate (transaction fee); liquidity chicken-and-egg problem; supply-side or demand-side first decision
- **B2B Sales:** Enterprise (AE + CS model, 3–9 month cycles); Mid-market (inside sales, 1–3 months); SMB (self-serve / PLG)
- **Pricing psychology:** Anchor pricing, decoy pricing, value-based pricing > cost-plus, annual vs monthly discount (20% typical)
- **Africa-specific models:** Mobile money integration (M-Pesa, Flutterwave, Paystack); agent networks; USSD for feature phone reach; WhatsApp-first distribution; informal sector considerations
- **Revenue streams for founder:** Consulting/advisory, speaking, community memberships, cohort courses, digital products, affiliate partnerships, event sponsorships, angel investing carry

### Key Metrics by Business Type
| Business Type | Key Metrics |
|--------------|-------------|
| SaaS | ARR, MRR, Churn, NRR, LTV:CAC, CAC Payback |
| E-commerce | GMV, AOV, Conversion Rate, ROAS, Return Rate |
| Marketplace | GMV, Take Rate, Liquidity, NPS (both sides) |
| Consumer App | DAU/MAU, Retention D1/D7/D30, LTV, ARPU |
| Media/Content | Subscribers, Open Rate, CPM, RPM, Engagement |
| Community | Members, Active %, Event Attendance, Churn |

### Investor Communication Best Practices
- **Warm intros > cold outreach** — 10x higher response rate
- **Investor update cadence:** Monthly (fundraising mode); quarterly (post-funding)
- **Update format:** Highlight, lowlight, ask, metrics, team, next milestones
- **Due diligence prep:** Data room (cap table, financials, contracts, IP, team, product), reference calls, technical due diligence
- **Negotiation:** Know your walkaway BATNA; time pressure (create urgency); term sheet is not a deal; everything is negotiable

### Africa Startup Ecosystem
- **Key hubs:** Lagos (fintech, e-commerce), Nairobi (fintech, agritech), Cape Town (deep tech), Cairo (e-commerce), Accra (creative economy)
- **Regulatory landscape:** CBN (Nigeria), CMA (Kenya), FSB (South Africa); fintech licensing complexity; data protection laws (NDPR Nigeria, PDPA Kenya)
- **Infrastructure challenges:** Unreliable power → solar/battery backup; internet penetration → mobile-first; payment fragmentation → Flutterwave/Paystack aggregation; logistics → last-mile innovation
- **Funding gap:** Pre-seed and seed stage severely underfunded; corporate venture capital growing; development finance institutions (IFC, AfDB, DFI) filling gaps
- **Top programs:** Google for Startups Africa, Meta Startup Hub, Microsoft for Startups, Norrsken House Nairobi, CcHUB Lagos, Antler Africa, Founder Institute Africa

---

## Behavioral Rules

### Reasoning Protocol
1. **Think before answering** — reason step-by-step for complex questions
2. **Ask clarifying questions** when information is ambiguous or missing
3. **State assumptions** when making them
4. **Identify tradeoffs** — nothing is free; surface the costs of each option
5. **Prioritize accuracy over confidence** — say "I don't know" when uncertain

### Communication Style
- **Professional yet conversational** — like a brilliant friend who happens to be a top consultant
- **Clear and direct** — no fluff, no filler, no corporate speak
- **Strategic** — always connect tactics to objectives
- **Solution-oriented** — problems exist to be solved
- **Adapt to expertise level** — technical with engineers, accessible with non-technical

### Formatting
- Use headers (##, ###) for multi-part answers
- Use bullet points for lists, numbered lists for sequences
- Use **bold** for key terms and emphasis
- Use tables for comparisons
- Use code blocks for technical content
- Keep responses scannable — use white space

### Modes of Operation

**Executive Assistant Mode:** Prioritize urgent/important items. Suggest next actions. Identify bottlenecks. Draft professional communications. Create follow-up systems.

**Content Strategist Mode:** Focus on education + storytelling + actionable insights. Include strong hooks, engagement questions, clear CTAs. Adapt for platform (LinkedIn vs X vs WhatsApp vs newsletter).

**Community Manager Mode:** Increase engagement, design retention systems, create onboarding processes, identify collaboration opportunities, build leadership pipelines.

**Startup Advisor Mode:** Analyze market size, competition, revenue potential, distribution strategy, CAC/LTV, risks, scalability. Always recommend highest-leverage actions.

**Investor Relations Mode:** Focus on ROI, defensibility, traction, market demand, execution risk. Help prepare pitch decks, executive summaries, investor updates, partnership proposals.

### Decision-Making Framework
For every important decision:
1. **Objective:** What are we trying to achieve?
2. **Options:** What are the real choices?
3. **Pros/Cons:** What are the tradeoffs of each?
4. **Risk Assessment:** What could go wrong?
5. **Recommendation:** What is the best option?
6. **Rationale:** Why this option over others?

---

## Response Footer
End EVERY substantive response with this structured footer:

---
**⚡ Immediate Action:** [single most important thing to do right now]
**🎯 Strategic Opportunity:** [biggest leverage point or opportunity in this context]
**⚠️ Potential Risk:** [key risk to watch out for]
**➡️ Recommended Next Step:** [concrete next step to take]`

// Helper: get or initialize conversation history for a chat
function getHistory(jid) {
  if (!conversationHistory.has(jid)) {
    conversationHistory.set(jid, [])
  }
  return conversationHistory.get(jid)
}

// Helper: trim history to MAX_HISTORY turns
function trimHistory(jid) {
  const history = getHistory(jid)
  while (history.length > MAX_HISTORY * 2) {
    history.splice(0, 2) // remove oldest user+assistant pair
  }
}

// Helper: call Anthropic API
async function callClaude(apiKey, messages, model = 'claude-sonnet-4-6') {
  const response = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model,
      max_tokens: 4096,
      system: FOS_SYSTEM_PROMPT,
      messages,
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: 60000,
    }
  )
  return response.data.content[0].text
}

// Helper: build vision message with image
async function buildImageMessage(text, imagePath) {
  const imageData = fs.readFileSync(imagePath)
  const base64 = imageData.toString('base64')
  const ext = path.extname(imagePath).slice(1).toLowerCase()
  const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }
  const mediaType = mimeMap[ext] || 'image/jpeg'

  return {
    role: 'user',
    content: [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      },
      { type: 'text', text: text || 'What do you see in this image?' },
    ],
  }
}

// Main FOS handler
async function fosHandler(message, match, ctx) {
  const apiKey = ctx.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return await message.send(
      '⚠️ *Founder Operating System (FOS)*\n\nANTHROPIC_API_KEY is not configured.\n\nTo activate FOS:\n1. Get your API key at https://console.anthropic.com\n2. Run: `setvar ANTHROPIC_API_KEY = your_key_here`'
    )
  }

  const userText = match || (message.reply_message && message.reply_message.text)
  const hasImage = message.reply_message && message.reply_message.image

  if (!userText && !hasImage) {
    return await message.send(
      `*🧠 Founder Operating System (FOS) — Ready*\n\nI'm your AI-powered founder co-pilot. Ask me anything about:\n\n• 📊 *Startup strategy & fundraising*\n• 💼 *Business operations & growth*\n• ✍️ *Content & personal branding*\n• 🤝 *Investor relations & pitching*\n• 🏘️ *Community building*\n• 📈 *LinkedIn & social media*\n• 🛠️ *Decision-making & problem solving*\n\n*Usage:* \`fos <your question>\`\n*Clear history:* \`fos reset\`\n*Switch model:* \`fos-pro <question>\` (uses Opus)`
    )
  }

  const jid = message.jid || message.id

  // Handle reset command
  if (userText && userText.trim().toLowerCase() === 'reset') {
    conversationHistory.delete(jid)
    return await message.send('✅ *FOS conversation history cleared.*\nFresh start — what are we working on?')
  }

  const history = getHistory(jid)

  try {
    let userMessage

    if (hasImage) {
      const imagePath = await message.reply_message.downloadAndSaveMediaMessage('fos_img')
      userMessage = await buildImageMessage(userText || 'Analyze this image.', imagePath)
      // Clean up temp file
      setTimeout(() => { try { fs.unlinkSync(imagePath) } catch (_) {} }, 10000)
    } else {
      userMessage = { role: 'user', content: userText }
    }

    // Add to history
    history.push(userMessage)
    trimHistory(jid)

    // Determine model
    const model = message._fosProMode ? 'claude-opus-4-8' : 'claude-sonnet-4-6'

    const reply = await callClaude(apiKey, history, model)

    // Save assistant reply to history
    history.push({ role: 'assistant', content: reply })
    trimHistory(jid)

    await message.send(reply, { quoted: message.data })
  } catch (err) {
    const errMsg = err.response?.data?.error?.message || err.message || 'Unknown error'
    console.error('[FOS] API Error:', errMsg)
    await message.send(`❌ *FOS Error:* ${errMsg}\n\nPlease try again or check your API key.`)
    // Remove the failed user message from history
    history.pop()
  }
}

// ─── Command: fos (standard — claude-sonnet-4-6) ─────────────────────────────
bot(
  {
    pattern: 'fos ?(.*)',
    desc: 'Founder Operating System — AI co-pilot for builders and founders',
    type: 'AI',
  },
  async (message, match, ctx) => {
    message._fosProMode = false
    await fosHandler(message, match, ctx)
  }
)

// ─── Command: fos-pro (premium — claude-opus-4-8) ────────────────────────────
bot(
  {
    pattern: 'fos-pro ?(.*)',
    desc: 'FOS Pro — uses claude-opus-4-8 for deep strategic thinking',
    type: 'AI',
  },
  async (message, match, ctx) => {
    message._fosProMode = true
    await fosHandler(message, match, ctx)
  }
)

// ─── Command: caleb (alias) ──────────────────────────────────────────────────
bot(
  {
    pattern: 'caleb ?(.*)',
    desc: 'Caleb AI — Founder Operating System alias',
    type: 'AI',
  },
  async (message, match, ctx) => {
    message._fosProMode = false
    await fosHandler(message, match, ctx)
  }
)

// ─── Command: founder (alias) ────────────────────────────────────────────────
bot(
  {
    pattern: 'founder ?(.*)',
    desc: 'Founder AI — startup advisor and strategic co-pilot',
    type: 'AI',
  },
  async (message, match, ctx) => {
    message._fosProMode = false
    await fosHandler(message, match, ctx)
  }
)

// ─── Command: pitch (specialized pitch deck helper) ──────────────────────────
bot(
  {
    pattern: 'pitch ?(.*)',
    desc: 'AI pitch deck advisor — refine your startup pitch',
    type: 'AI',
  },
  async (message, match, ctx) => {
    const apiKey = ctx.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) return await message.send('⚠️ Set ANTHROPIC_API_KEY to use pitch advisor.')

    const userText = match || (message.reply_message && message.reply_message.text)
    if (!userText) {
      return await message.send(
        `*🎯 Pitch Deck Advisor*\n\nI'll help you craft a world-class pitch.\n\nTell me:\n• What does your startup do?\n• Who are your customers?\n• What's your traction so far?\n• How much are you raising and why?\n\n*Usage:* \`pitch <describe your startup>\``
      )
    }

    const pitchSystemMsg = `${FOS_SYSTEM_PROMPT}\n\n## CURRENT MODE: PITCH ADVISOR\nYou are now in Pitch Advisor mode. Focus exclusively on helping craft, refine, and stress-test startup pitches. Structure your feedback using the standard YC/a16z pitch deck framework: Problem → Solution → Why Now → Market Size → Product → Business Model → Traction → Team → Ask. Be brutally honest and specific. Investors see 1000+ decks — only the clearest, most compelling pitches get meetings.`

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-opus-4-8',
          max_tokens: 4096,
          system: pitchSystemMsg,
          messages: [{ role: 'user', content: userText }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 60000,
        }
      )
      await message.send(response.data.content[0].text, { quoted: message.data })
    } catch (err) {
      await message.send(`❌ Pitch advisor error: ${err.response?.data?.error?.message || err.message}`)
    }
  }
)

// ─── Command: linpost (LinkedIn post generator) ──────────────────────────────
bot(
  {
    pattern: 'linpost ?(.*)',
    desc: 'Generate a high-engagement LinkedIn post',
    type: 'AI',
  },
  async (message, match, ctx) => {
    const apiKey = ctx.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) return await message.send('⚠️ Set ANTHROPIC_API_KEY to use this feature.')

    const topic = match || (message.reply_message && message.reply_message.text)
    if (!topic) {
      return await message.send('*Usage:* `linpost <topic or idea>`\n\n*Example:* `linpost lessons from raising my first $100K`')
    }

    const linkedinPrompt = `${FOS_SYSTEM_PROMPT}\n\n## CURRENT MODE: LINKEDIN POST GENERATOR\nGenerate a high-engagement LinkedIn post about the given topic. Follow these rules:\n1. Start with a powerful hook (first line must stop the scroll)\n2. Use short paragraphs (1-2 sentences max)\n3. Tell a story or share a specific insight\n4. Include a contrarian or surprising angle if possible\n5. End with an engagement question or clear CTA\n6. Add 3-5 relevant hashtags at the end\n7. Aim for 150-300 words (optimal LinkedIn reach)\n8. Write in first person, conversational but professional\n9. No corporate jargon\n\nGenerate 2 variations with different hooks/angles so the user can choose.`

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: linkedinPrompt,
          messages: [{ role: 'user', content: `Write a LinkedIn post about: ${topic}` }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 45000,
        }
      )
      await message.send(response.data.content[0].text, { quoted: message.data })
    } catch (err) {
      await message.send(`❌ Error: ${err.response?.data?.error?.message || err.message}`)
    }
  }
)

// ─── Command: bizplan (business plan generator) ──────────────────────────────
bot(
  {
    pattern: 'bizplan ?(.*)',
    desc: 'Generate a concise business plan or business model canvas',
    type: 'AI',
  },
  async (message, match, ctx) => {
    const apiKey = ctx.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) return await message.send('⚠️ Set ANTHROPIC_API_KEY to use this feature.')

    const idea = match || (message.reply_message && message.reply_message.text)
    if (!idea) {
      return await message.send('*Usage:* `bizplan <business idea>`\n\n*Example:* `bizplan an AI-powered WhatsApp bot for African SMEs`')
    }

    const bizPlanPrompt = `${FOS_SYSTEM_PROMPT}\n\n## CURRENT MODE: BUSINESS PLAN ADVISOR\nCreate a structured, practical business plan / business model canvas for the given idea. Cover: Executive Summary, Problem & Solution, Target Market (TAM/SAM/SOM), Value Proposition, Revenue Model, Go-to-Market Strategy, Competitive Landscape, Key Metrics to Track, Team Requirements, Financial Projections (Year 1-3 estimates), Risks & Mitigants, Funding Requirements, and 90-Day Action Plan. Be specific and data-driven. For African markets, factor in local infrastructure, payment methods, and distribution channels.`

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-opus-4-8',
          max_tokens: 4096,
          system: bizPlanPrompt,
          messages: [{ role: 'user', content: `Create a business plan for: ${idea}` }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 90000,
        }
      )
      await message.send(response.data.content[0].text, { quoted: message.data })
    } catch (err) {
      await message.send(`❌ Error: ${err.response?.data?.error?.message || err.message}`)
    }
  }
)

// ─── Command: vcfind (investor discovery) ────────────────────────────────────
bot(
  {
    pattern: 'vcfind ?(.*)',
    desc: 'Find relevant investors for your startup stage and sector',
    type: 'AI',
  },
  async (message, match, ctx) => {
    const apiKey = ctx.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
    if (!apiKey) return await message.send('⚠️ Set ANTHROPIC_API_KEY to use this feature.')

    const query = match || (message.reply_message && message.reply_message.text)
    if (!query) {
      return await message.send(
        '*Usage:* `vcfind <startup description>`\n\n*Example:* `vcfind seed stage fintech for Nigerian SMEs, raising $500K`'
      )
    }

    const vcPrompt = `${FOS_SYSTEM_PROMPT}\n\n## CURRENT MODE: INVESTOR DISCOVERY\nYou are an investor relations specialist. Based on the startup description, identify the most relevant investors (VCs, angels, family offices, accelerators) with:\n1. Investor name and fund\n2. Stage focus (pre-seed, seed, Series A, etc.)\n3. Sector focus and why they're relevant\n4. Known portfolio companies in this space\n5. How to get a warm intro\n6. Their thesis/what they care about most\n7. Contact/application approach\n\nPrioritize Africa-focused investors when relevant. Include both local and global options. Also recommend accelerators and grant programs that might be relevant.`

    try {
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-opus-4-8',
          max_tokens: 3000,
          system: vcPrompt,
          messages: [{ role: 'user', content: `Find investors for: ${query}` }],
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          timeout: 60000,
        }
      )
      await message.send(response.data.content[0].text, { quoted: message.data })
    } catch (err) {
      await message.send(`❌ Error: ${err.response?.data?.error?.message || err.message}`)
    }
  }
)

// ─── Command: foshelp ────────────────────────────────────────────────────────
bot(
  {
    pattern: 'foshelp',
    desc: 'Show all Founder Operating System commands',
    type: 'AI',
  },
  async (message) => {
    await message.send(
      `*🧠 Founder Operating System (FOS) — Command Reference*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*🤖 AI ASSISTANTS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• \`fos <question>\` — Main FOS (Sonnet model, multi-turn memory)
• \`fos-pro <question>\` — FOS Pro (Opus model, deep reasoning)
• \`caleb <question>\` — FOS alias for Caleb
• \`founder <question>\` — FOS alias (startup-focused framing)
• \`fos reset\` — Clear conversation history

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*💼 STARTUP TOOLS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• \`pitch <startup description>\` — Refine your investor pitch
• \`bizplan <idea>\` — Generate a business plan / BMC
• \`vcfind <startup desc>\` — Discover relevant investors

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*✍️ CONTENT TOOLS*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• \`linpost <topic>\` — Generate LinkedIn posts (2 variants)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*⚙️ SETUP*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Set your Anthropic API key:
  \`setvar ANTHROPIC_API_KEY = sk-ant-...\`
• Get API key: https://console.anthropic.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
*📚 FOS KNOWLEDGE BASE*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOS has deep knowledge of:
✅ VC fundraising & term sheets
✅ Startup frameworks (YC, Lean, JTBD)
✅ Unit economics & financial modeling
✅ Africa startup ecosystem (investors, hubs, regulations)
✅ LinkedIn growth & personal branding
✅ Community building & retention
✅ Content strategy for founders
✅ Go-to-market & growth playbooks
✅ Business model design & pricing
✅ Investor relations & pitch preparation`
    )
  }
)
