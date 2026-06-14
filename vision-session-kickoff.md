# Product Vision Session — Invoicing Assistant (working name TBD)

Before any code or architecture, I want to spend this session interactively developing the full vision of what I want this product to *be* from the user's perspective. Your job in this session is to interview me — ask sharp, targeted questions that surface the product's real shape, edge cases, and priorities — and then synthesize everything into a single markdown vision document. **Do not design the architecture, stack, or schema in this session, and don't write application code.** The goal is alignment on *what we're building and why*, so that later architecture, plumbing, and UX decisions are grounded in a clear picture rather than guesses.

## The core idea

A personal invoicing application for a single user — my dad — who runs a small business and has chronic neck and nerve pain that makes typing and fine-motor tasks slow and painful, especially when he's tired after work. Today, creating an invoice means manually pasting client name, address, and account ID into a template, writing job descriptions, and calculating totals by hand — and his clients use different rate structures, which makes the math error-prone.

The vision is to remove that friction. He should be able to create an invoice largely by voice — something like speaking the client, the date, the work done, and what's being charged — and have the app populate a correct invoice from stored client information, calculate totals reliably, and update visibly in real time. He reviews it, and with a confirmation it saves a copy, emails the PDF to the client, assigns a unique ID, and records it in a structured database for tracking and later adjustment. Clients (their contact info and rate structures) are set up ahead of time so the app already knows them. We've established that rate calculation must be deterministic — the app computes totals, not an LLM — and that there should be a clear review/confirmation gate before anything is sent.

That's the starting sketch. I want you to pull on it and make it real.

## How I want this session to go

- Interview me to build a vivid, concrete picture of the user-facing product. Probe the things that actually shape the build: how my dad would naturally interact with it, what the invoice creation flow should feel like end to end, what happens when information is missing or ambiguous, how client setup should work, what the review-and-send moment looks like, how he'd find or adjust past invoices, what mobile-vs-desktop usage looks like, and where accessibility for his condition should drive design choices. Don't limit yourself to that list — ask whatever you need to understand the product deeply.
- Ask questions in focused batches, not all at once, and build on my answers. Push back where my thinking is vague or where I'm hand-waving past something important — particularly anything around rate structures, error/ambiguity handling, and the trust required for something that emails clients on his behalf.
- Where I'm undecided, help me reason to a default rather than leaving it open.

## The deliverable

A single, well-structured markdown file capturing the full product vision — the user, the problems being solved, the end-to-end experience, key flows, accessibility priorities, explicit non-goals, and any open questions we deliberately deferred. This document is the alignment artifact that future development sessions will build against, so make it clear, organized, and honest about what's decided versus still open.

**Keep this a living document.** It should only ever diverge from reality deliberately. If decisions change during later development, the vision doc gets updated in the same session that changes them — it must not be allowed to drift into a stale artifact that future sessions can no longer trust. Treat the document's accuracy as a maintained invariant, not a one-time output.

## Context / FYI

- Stack is fixed as **React** frontend + **Supabase** (Postgres + Auth) backend. You don't need to design around this yet — just be aware of it so the vision stays grounded in what's buildable.
- The workspace already contains a markdown file documenting the **auth/config setup** I've completed (Supabase keys, RLS, environment configuration). You don't need to act on it this session; it's just there so you know that groundwork is handled.
- Assume I'm technically competent — skip tutorial explanations, be direct, and tell me if something I want is a bad idea.

---

**Start by asking me your first round of questions.**
