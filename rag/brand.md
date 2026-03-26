---
name: "DocRAG"
tagline: "Ask your documents. Get cited answers."
version: 1
language: en
---

# DocRAG

## Strategy

### Overview

DocRAG is an open-source reference implementation that shows how to build document Q&A with precise, clickable citations — powered by SuperDoc.

It exists because every RAG demo stops at "here's an answer." DocRAG goes further: it scrolls you to the exact paragraph, comment, or tracked change where the answer lives. That's the part that's hard. That's the part SuperDoc makes easy.

**The problem it solves:** Document RAG pipelines treat `.docx` files as flat text. They strip comments, ignore tracked changes, and lose the structure that makes documents useful. When you ask a question and get an answer, there's no way to verify it — no citation, no source, no proof. You're trusting a black box.

**The transformation:**
- Before: "The AI says X" → manually search 200 pages to verify
- After: "The AI says X `[3]`" → click → scroll to the exact tracked change in the original document

**Long-term ambition:** The definitive reference for building document-aware AI applications on SuperDoc.

### Positioning

**Category:** Open-source RAG reference implementation for Word documents.

**What DocRAG is NOT:**
- Not a product. Not SaaS. Not a startup.
- Not a generic chatbot wrapper.
- Not a PDF tool.
- Not a toy demo with fake data and no real architecture.

**Competitive landscape:**
The "chat with your documents" space has 50+ tools (ChatPDF, NotebookLM, Unriddle, Humata). They all share the same limitation: documents go in, flat text comes out. Citations mean "page 12" at best. Comments and tracked changes — the parts where real decisions happen — are invisible.

DocRAG doesn't compete with these tools. It shows developers how to build something better.

**Structural differentials:**
- Preserves full document semantics: paragraphs, comments, tracked changes, and their positions
- Citations resolve to exact elements, not pages or chunks
- Click-to-scroll navigation into a live document viewer
- Production architecture: Cloudflare Workers, PostgreSQL + pgvector, R2 — not a notebook hack
- Open-source and forkable — use it as a starting point, not a dependency

**Territory:** The space between "RAG tutorial" and "production document platform." Serious enough to fork. Clear enough to learn from.

### Personality

**Archetype:** The Engineer's Notebook — precise, generous, quietly impressive.

**Attributes:** Technical, clear, minimal, credible, generous, sharp.

**What DocRAG is:**
- A working system you can deploy today
- Honest about what it does and what it doesn't
- Built to be read, forked, and extended
- Proof that document RAG can be done right

**What DocRAG is not:**
- Flashy
- Salesy
- Oversimplified
- A pitch deck dressed as code

### Promise

The code is real. The architecture is production-grade. The citations actually work.

**Base message:** DocRAG shows what's possible when your RAG pipeline understands documents — not just text.

**Synthesizing phrase:** Documents have structure. Your RAG pipeline should too.

### Guardrails

**Tone:** Technical, direct, minimal, confident, generous.

**What DocRAG cannot be:**
- A marketing demo that only works in a screencast
- Vaporware with aspirational screenshots
- Enterprise-speak aimed at buyers instead of builders
- Anything that requires a "book a demo" button

**Litmus test:** If a senior engineer wouldn't share it with their team, it's not good enough.

---

## Voice

### Identity

We build reference implementations that show how document AI should work. Not abstractions. Not wrappers. Working systems with real architectures that you can deploy, read, and extend.

DocRAG is what happens when you stop treating Word documents as flat text. Comments become searchable. Tracked changes become citable. Every answer links back to its source — not a page number, but the exact element in the original document.

We're not selling anything. We're showing what SuperDoc makes possible.

**Essence:** Cited, not claimed.

### Tagline & Slogans

**Primary tagline:** Ask your documents. Get cited answers.
*Use on: README header, landing page hero, social cards.*

**Alternatives:**
- Document Q&A with proof.
- RAG that cites its sources.
- Every answer has an address.

**Slogans for different contexts:**
- README: "Open-source document Q&A with clickable citations — powered by SuperDoc."
- GitHub description: "Reference RAG implementation with precise document citations."
- Technical talks: "Your RAG pipeline drops comments and tracked changes. This one doesn't."
- Social: "Click the citation. See the source. That's how document RAG should work."
- Developer pitch: "Fork it. Deploy it. Ship document Q&A that actually cites its sources."

### Message Pillars

**Precision**
- Citations resolve to exact paragraphs, comments, and tracked changes.
- Click a citation, scroll to the source. No manual searching.

**Structure**
- Documents aren't flat text. DocRAG preserves comments, tracked changes, and element positions.
- Your RAG pipeline should understand document structure, not destroy it.

**Credibility**
- Production architecture: Cloudflare Workers, PostgreSQL + pgvector, R2, Claude, OpenAI embeddings.
- Not a notebook. Not a tutorial. A deployable system.

**Openness**
- Open-source. Forkable. Designed to be a starting point.
- Read the code. Understand the patterns. Build your own.

### Phrases

- "Every answer has an address."
- "Cited, not claimed."
- "Documents have structure. Your RAG pipeline should too."
- "Click the citation. See the source."
- "Comments are content. Tracked changes are context. DocRAG indexes both."
- "The answer is on page 47 somewhere" is not a citation."
- "Fork it. Ship it. Cite it."

### Tonal Rules

1. Write like a README, not a landing page.
2. Technical precision over marketing polish.
3. Short sentences. Active voice. No filler.
4. Show the architecture. Show the code. Let the work speak.
5. Generous with knowledge — explain the "why," not just the "how."
6. Confident, not boastful. The demo speaks for itself.
7. Respect the reader's intelligence. No hand-holding, no overselling.
8. Specifics over superlatives. "Navigates to the exact paragraph" not "powerful AI-driven experience."
9. Acknowledge limitations openly. What it doesn't do is as important as what it does.
10. If it sounds like a SaaS landing page, rewrite it.

**Identity boundaries:**
- We are not a product company pitching enterprise buyers.
- We are not a tutorial that oversimplifies to the point of uselessness.
- We are not a wrapper around an API call.
- We are not competing with ChatPDF. We're showing developers how to build something better.

| We Say | We Never Say |
|---|---|
| "Citations resolve to exact elements" | "AI-powered intelligent document search" |
| "Fork it, deploy it" | "Request a demo" |
| "Preserves comments and tracked changes" | "Leverages cutting-edge NLP" |
| "Built on Cloudflare Workers" | "Enterprise-grade cloud infrastructure" |
| "Open-source reference implementation" | "Industry-leading solution" |
| "Click to scroll to the source" | "Seamless document experience" |
| "Production architecture" | "Best-in-class platform" |

---

## Visual

### Colors

**Primary:** `#000000` — Black. Text, headings, primary UI.
**Secondary:** `#FAFAFA` — Near-white. Backgrounds, cards.
**Accent:** `#0070F3` — Vercel blue. Links, CTAs, interactive elements.
**Muted:** `#888888` — Gray. Secondary text, borders, metadata.
**Success:** `#50E3C2` — Teal. Status indicators, citations found.
**Surface:** `#F5F5F5` — Light gray. Code blocks, sidebar backgrounds.

**Usage rules:**
- Accent color for interactive elements only — links, buttons, citation highlights.
- Black and white carry 90% of the interface. Color is punctuation, not decoration.
- Avoid warm colors. The palette is cool and neutral.

**Avoid:** Gradients, neon colors, brand purples/oranges that signal "startup energy."

### Typography

**Display:** Inter — Semi-bold (600). Headings, hero text, navigation.
**Body:** Inter — Regular (400). Paragraphs, descriptions, documentation.
**Mono:** JetBrains Mono — Regular (400). Code blocks, technical specs, citations, terminal output.

**Rules:**
- Display and body are the same family. Hierarchy comes from weight and size, not font changes.
- Mono is used generously — this is a technical product. Code is not decorative.
- Default body size: 16px. Line height: 1.6. Generous whitespace.

### Style

**Design keywords:** Minimal, systematic, technical, clean, spacious, monochrome, precise.

**Reference brands:** Vercel (developer tools aesthetic), Linear (information density done right), Resend (technical product, clean presentation), Stripe Docs (generous technical documentation).

**Direction:** The visual identity communicates system and precision. Every element earns its place. Whitespace is a feature. The interface should feel like well-organized source code — structured, scannable, nothing wasted.
