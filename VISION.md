# VoiceInvoice — Product Vision

> **Status:** Living document. This is the alignment artifact future development sessions build against.
> It must only ever diverge from reality *deliberately*. If a decision changes during later work,
> this document is updated in the same session that changes it. Treat its accuracy as a maintained
> invariant, not a one-time output.
>
> **Last updated:** 2026-06-13 · **Phase:** Build in progress (foundation through deterministic invoicing landed)

> **Build status (2026-06-13):** Scaffolded React + Vite + TS app with the design system, email/password
> auth gate, app shell (Invoice · Clients tabs), full Clients CRUD (rates + synonyms), and the invoice
> flow — live preview, deterministic DB-computed totals, approval → write, date-based numbering — all
> verified end-to-end against Supabase. **Done:** roadmap steps 0–4. **Next:** step 5 (agent Edge
> Function for voice→structured extraction) and step 6 (PDF). See §10 for what's decided vs. open.

---

## 1. The user

**A single user: the builder's father.** He runs a small service business and invoices his own
clients. He has chronic neck and nerve pain that makes typing and fine-motor work slow and painful,
especially when he's tired after a day of physical work. That pain is the entire reason this product
exists — it is not a convenience feature, it is the point.

Today his workflow is:

- Invoices are built **by hand in Microsoft Word**, sometimes against a client's own template.
- Client name, address, and account ID are **manually pasted** into a template each time.
- Job descriptions are typed out; **totals are calculated by hand**.
- Clients use **different rate structures**, which makes the manual math error-prone.
- There is **no structured record** of past invoices — tracking appears to live in a paper notebook.

VoiceInvoice replaces all of that.

### Who logs in

Single-user for the foreseeable future. During development, **the builder is the only account**.
Once an MVP exists, auth will be configured for the father (it may already be provisioned in the
existing auth/config groundwork). There is **no multi-user, multi-business, or multi-tenant
requirement** — but data should still be cleanly scoped to a user so that turning on a second login
later is config, not a rebuild.

---

## 2. Problems being solved

1. **Typing is painful and slow.** The primary interaction must be voice, with typing always
   available as a fallback — never a requirement.
2. **Manual math produces errors.** Totals must be computed deterministically by the application,
   never by an LLM, and never by hand.
3. **Re-entering known client data is wasted effort.** Client contact info and rate structures are
   set up ahead of time so the app already knows them; an invoice references a client, it doesn't
   re-describe one.
4. **No durable record.** Every invoice becomes a structured database record for tracking and later
   reference, replacing the notebook.
5. **Inconsistent, hand-built documents.** Invoices are generated from a consistent template, not
   reassembled by hand each time.

---

## 3. Core principles (non-negotiable)

These constraints shape everything downstream. Violating one is a design bug.

- **Voice-first, never voice-only.** Every voice action has a visible, typeable equivalent.
- **Deterministic money.** All rate and total calculation is done by the backend, not the LLM. The
  LLM extracts and structures intent; it never produces a number that lands on an invoice.
- **The document is the source of truth at approval time.** The user approves the *rendered invoice
  preview*, not a verbal summary. What he sees is exactly what gets written.
- **No silent writes.** Nothing is written to the database, and no document is finalized, without an
  explicit user button press. The agent proposes; the user commits.
- **The agent never interrupts.** It does not barge in with voice or actions while the user is
  speaking or mid-dictation.
- **Full inputs or no write.** A client's profile defines the fields required to invoice them. The
  agent cannot write an invoice record until every required field for that client is satisfied.

---

## 4. The end-to-end experience

### 4.1 Invoice creation — the core loop

The marquee flow. The feel should be: *talk naturally, watch the invoice assemble itself, glance at
it, approve it.*

1. **Initiate voice.** The user taps the **microphone button** to begin dictation.
2. **Dictate freely.** He speaks the invoice conversationally — client, date, the work done, what's
   being charged — in whatever order is natural. He is not filling in a form and is not being
   interrogated turn-by-turn before he's said his piece.
3. **Mic controls (hard UX requirement).** The mic button **pauses and resumes** transcription at
   any point, **preserving already-transcribed words** across pauses. Transcription accumulates in
   an editable field. **Nothing is submitted to the agent until the user presses Send.** This makes
   each turn a deliberate act, gives him time to fix transcription errors by typing, and guarantees
   the agent never acts on a half-formed thought.
4. **Agent processes the turn.** On Send, the agent:
   - resolves the client (including via natural-language synonyms — see §6),
   - extracts jobs, quantities, and which rate structure applies,
   - pulls the client's stored defaults and required fields,
   - makes a **best guess** on anything ambiguous and **flags that guess** rather than stopping,
   - asks a **follow-up question** only for information that is genuinely missing and required.
5. **Live preview re-renders.** After **each conversational turn**, the on-screen invoice preview
   re-renders to reflect everything known so far (not keystroke-by-keystroke during dictation —
   per turn, on Send). The user watches the invoice take shape in real time.
6. **Agent output.** The agent responds with **both written and spoken** output — a short summary of
   what it did and any clarifying question or flagged assumption. Voice output never talks over him.
7. **Iterate.** He keeps dictating corrections and additions ("no, that's two hours not three";
   "add materials, forty dollars") until the preview is right.
8. **Approve.** When the preview is correct, he presses the **approval button on the preview itself**
   (see §4.3). This — and only this — writes the invoice record to the database and assigns its ID.
9. **Official document.** After the write, the **finalized invoice** is generated in the proper
   template and presented on the frontend **for download**.

### 4.2 Handling missing / ambiguous information

- **Missing required field** → the agent asks a focused follow-up question. It does not let an
  incomplete invoice be approved (the approval/write is blocked until required fields are satisfied).
- **Ambiguous input** (e.g. he says "two units" but the client bills per square foot) → the agent
  makes its **best guess, applies it, and visibly flags it** in the review preview for him to catch
  and correct. It does not halt the flow on every ambiguity.
- **Override by typing** is always available. If voice is fighting him on a value, he can type it.

### 4.3 The review-and-approve moment (the trust gate)

This is the most important screen in the product. The **live document preview is the point of
approval** — there is no separate "summary screen" that could disagree with the rendered invoice.

- The preview is a **generic mock invoice** built from the dictated inputs, rendered as it will
  actually look, with the **line items and rates shown in a table** so the cost flow is easy to read
  top-to-bottom (description · quantity · rate · amount → subtotal → materials → total).
- The agent **may also summarize** the invoice by voice/text, but **approval is executed by the user
  pressing a button**, never by the agent.
- Pressing approve **writes the record and assigns the invoice ID**. Up to that press, nothing is
  persisted as an invoice.

### 4.4 Client setup

Clients are set up **ahead of time** so the invoicing flow can assume they exist.

- A **dedicated tab** in the app holds a table mirroring the client master fields.
- The user populates a client either by **typing into the table** or by **dictating to the agent**
  using the same mic/Send/preview patterns as invoice creation.
- A **submit button** writes the entry to the client master table.
- Setup captures, at minimum: contact info (name, address, account ID), the client's **default rate
  structure(s)**, the **required fields** needed to invoice them, and **natural-language synonyms**
  used to recognize the client and its concepts in speech.
- **Client creation is not part of the voice invoicing flow.** Invoicing runs against clients that
  already exist; setup is its own deliberate activity.

### 4.5 Finding and adjusting

- Past invoices are queryable structured records (the durable replacement for the notebook).
- **Client profiles are editable**, and **new rate structures can be added** over time, through the
  same setup surface.
- **Editing/voiding/versioning already-issued invoices is out of scope for phase 1** (see §9).

---

## 5. Rate structures & money (deterministic)

**All calculation is deterministic and lives in the backend. The LLM never computes a billed
number.** The agent's job is to turn speech into a structured, validated set of inputs (client, jobs,
quantities, which rate applies); the backend turns those inputs into money.

### Phase 1 supported structures

- **Hourly** — quantity (hours) × hourly rate.
- **Per square foot** — quantity (sq ft) × rate per sq ft.
- **Materials** — added as a **lump-sum cost category** (not itemized, not marked up in phase 1).

A single invoice may contain **multiple line items**. (Genuinely *mixed* multi-structure invoices,
per-job flat rates, and tiered rates are **planned but deferred** — see §9.)

### Defaults vs. overrides

- A client's **default rate structure(s)** live in the client master.
- The flow supports **job-level alternate rate structures** when the user **explicitly states one**,
  overriding the client default for that line item.

### No tax in phase 1

Sales tax is **explicitly ignored for now**. Invoices are labor/service + materials only. (If tax is
needed later it is a structural addition, noted as a future item.)

### How rate config is stored (decided direction)

Calculation must be deterministic and backend-owned. There are two ways to get there, and we are
choosing one on purpose:

- **❌ Store an executable formula string per client** (e.g. `rate_expression = "quantity * 3.50"`)
  and concatenate + `EXECUTE` it at calc time. **Rejected.** The stored string stops being *data* and
  becomes *executable code*: whatever sits in that column becomes part of the SQL program the database
  runs. The database cannot distinguish "the rate formula intended" from arbitrary SQL in that field,
  so a malformed entry produces a broken or silently-wrong *program* instead of a clean validation
  error — and the day a second account (the father, or any future writer) can edit that field, it is a
  live injection vulnerability. For something whose only job is correct money, "the rate field can
  alter query behavior" is exactly the wrong property.

- **✅ Store structured rate parameters the backend interprets.** Rate config is inert data, not code:
  a validated `rate_type` (a closed enum — `hourly`, `per_sqft`, plus `materials` as a lump sum) and
  numeric `rate` value(s). Calculation is a fixed, parameterized query that branches on `rate_type`
  and binds the client's numbers as **parameters, never as concatenated text**. Same deterministic
  result, same SQL backend the builder wanted — but the set of operations is closed and authored by
  us, so there is nothing to inject *into*; a bad value fails validation as data.

This preserves the builder's "deterministic SQL math" intent while keeping client rate config as data.
The exact schema is still an architecture-session task; **the constraint is: no stored executable SQL
/ no string-eval of per-client formulas.** (See §10.)

---

## 6. Memory & state

Two distinct things, kept distinct on purpose:

- **Conversation-level state** — what's been said so far in the *current* invoice being built. This
  is required and ephemeral to the session/draft.
- **Persistent layer = structured data, not vague "AI memory."** Persistence in phase 1 means:
  - **Invoice history** (the records themselves), and
  - **Client profiles** (client master).
  - Plus a **natural-language synonym layer** so the agent can resolve spoken references to the right
    structured record. This is intentionally **wider than client identity** and covers at least three
    kinds of reference:
    - **Client identity** — aliases/nicknames for a client (e.g. "the Johnson account") → the client
      record.
    - **Job / work types** — spoken descriptions of work (e.g. "drywall," "the flooring job") → the
      service and its associated rate type.
    - **Rate language** — shorthand for which rate to apply (e.g. "the usual," "standard rate") → the
      client's stored default rate structure.

    Synonyms likely span the client master plus related synonym fields/tables; the exact shape is an
    architecture-session task. The product requirement is that the agent can map natural speech onto
    structured records across these reference types.

We are **not** building a free-floating AI memory feature. The agent "remembers" by reading
structured rows.

---

## 7. Invoice document (phase 1)

### Template

- **One generic VoiceInvoice template**, used for **both** the live frontend mock preview **and** the
  finalized downloadable invoice. They are the same design so there's no surprise between preview and
  final.
- **Per-client / client-branded templates are a planned feature, explicitly deferred.** The data
  model must not assume a single template forever — design so that swapping/adding templates later is
  additive.

### Fields

Document fields are designed at product level here; **the binding requirement is that every field on
the document maps cleanly to a backend database field** (no display-only data that can't be traced to
a record). Phase-1 fields:

- **Invoice number** (assigned on approval — see numbering below)
- **Issue date**
- **Client block:** name, address, account ID
- **Line items table** — the cost flow, shown as a table so it's easy to scan:
  `description · quantity · rate · amount`
- **Materials** — lump-sum line
- **Subtotal**
- **Total**

No tax line in phase 1. Letterhead/logo, PO numbers, payment terms, and a distinct service-vs-issue
date are **not** in phase 1 but are natural future additions — design fields so they can be added
without reshaping the document.

### Numbering

- Phase 1 uses a **simple date-related numbering scheme** (e.g. `YYYYMMDD-NN`), assigned at the
  moment of approval/write.
- **Flagged to change:** this will likely be replaced to match **how the father actually numbers his
  invoices** today. Treat the scheme as swappable, not load-bearing.

---

## 8. Platforms & aesthetic

### Platforms

- **Desktop is the primary development target.** Build and refine desktop first.
- **Mobile-optimized version comes after** the desktop experience is judged good enough. Don't let
  mobile constraints compromise the desktop build, but don't make desktop choices that make a later
  mobile version impossible.

### Design language

The product should feel like it came out of a **Fortune 500 technology company**: professional,
understated, modern, and quietly confident. The aesthetic is **linear and angular** — structure and
restraint over decoration.

**Principles**

- **Understated and content-first.** The invoice and the conversation are the heroes. Chrome
  recedes. No gradients-for-the-sake-of-it, no playful illustration, no visual noise.
- **Linear / angular geometry.** Crisp edges, minimal or small corner radii, clean 1px dividers,
  strong alignment to a grid. Structure is communicated through spacing and rule lines, not
  shadows and color.
- **Generous, disciplined spacing.** A consistent spacing scale and a clear typographic hierarchy do
  the heavy lifting. Let the layout breathe.
- **Restrained palette.** A near-neutral base (white / near-black / grays) with a **single, sober
  accent** color used sparingly for primary actions and key state. High contrast for legibility.
- **Typography.** A clean, professional sans-serif. Tabular/monospaced figures for all money and
  quantities so columns align and numbers are unambiguous.
- **Calm, purposeful motion.** Transitions are quick, subtle, and functional (e.g. the preview
  updating). Nothing bouncy or attention-seeking.
- **Clarity of state.** The mic's listening/paused state, "unsent transcript pending," "agent
  thinking," and "saved/approved" are all communicated unmistakably but without drama.

**Signature surfaces to get right**

- **The mic button** — the primary control. Clear, obvious affordance for start / pause / resume,
  with unmistakable state. It is the front door to the whole product.
- **The live invoice preview** — the centerpiece. A clean, document-like rendering with the line-item
  table front and center, updating calmly after each turn. This is what earns the user's trust.
- **The approval button** — visually distinct as the single committing action, never ambiguous with
  ordinary chat actions.

---

## 9. Accessibility (drives design, not an afterthought)

The user's chronic neck/nerve pain is a primary design driver, not a compliance checkbox.

- **Minimize required typing and fine-motor precision.** Voice is the default path end to end —
  invoicing *and* client setup.
- **Large, forgiving touch/click targets**, especially the mic and approval buttons. No tiny
  controls, no precision dragging required.
- **Reduce interaction count.** Fewer, larger, deliberate actions (talk → Send → approve) beat many
  small ones.
- **Readable by default.** High contrast, comfortable type sizes, money/quantities in aligned
  tabular figures.
- **Forgiving correction.** Pause/resume dictation, edit transcript before Send, override any value
  by typing, iterate on the preview freely — mistakes are cheap to fix without starting over.
- **No time pressure.** Nothing auto-submits; the agent never rushes or interrupts him.

---

## 10. Decided vs. open

### Decided (phase 1)

- Single user (builder during dev; father later). No multi-tenant requirement.
- Voice-first with full typed fallback; **mic button** with pause/resume preserving transcript;
  **Send** commits a turn; agent has **voice + text** output and never interrupts.
- Conversational invoice creation: dictate → agent fills/asks/flags → preview re-renders per turn.
- **Live document preview is the approval terminal**; approval is a **user button press** that writes
  the record and assigns the ID.
- Deterministic backend calculation; LLM never produces billed numbers.
- Phase-1 rates: **hourly**, **per square foot**, **materials as lump sum**. Multiple line items
  allowed. Client defaults with explicit job-level overrides.
- **No tax**, **no email**, **no invoice editing/voiding/versioning** in phase 1.
- One generic template for preview and final document; fields map cleanly to the DB; line items
  rendered as a **table**.
- Simple **date-based invoice numbering** for now.
- Client setup via a dedicated **tab/table**, typed or dictated, committed with a submit button.
  Client creation is **not** part of the voice invoicing flow.
- Persistence = invoice history + client profiles. Not a vague AI memory feature.
- **NL synonym layer is wide:** resolves client identity, job/work types, and rate language onto
  structured records.
- **Rate config stored as structured parameters** (validated `rate_type` enum + numeric values),
  interpreted by a fixed parameterized backend query. **No stored executable SQL / no string-eval of
  per-client formulas.** (Exact schema is still an architecture task.)
- Aesthetic: professional, understated, modern, **linear/angular**, Fortune-500-tech.
- **Desktop first**, mobile later.

### Open / deferred (revisit deliberately)

- **Email delivery** of the PDF (from-address, body, sender copy, bounce/wrong-recipient handling,
  recall/reissue) — future phase.
- **Additional rate structures:** per-job flat, tiered (graduated vs. cliff — must be specified when
  built), genuinely mixed multi-structure invoices.
- **Materials markup** and itemized materials.
- **Tax.**
- **Per-client / branded invoice templates.**
- **Invoice numbering scheme** — replace with the father's real-world convention.
- **Invoice editing / voiding / versioning / corrections** — explicitly out of phase 1; will need an
  immutable-with-corrections design when added.
- **Letterhead/logo, PO numbers, payment terms, distinct service date** on the document.
- **Rate-config schema** — the *approach* is decided (structured parameters, no stored executable
  SQL — see §5); the exact table/column shape is an architecture-session task.
- **Synonym schema** — the *scope* is decided (client identity + job/work types + rate language); the
  exact fields/tables are an architecture-session task.
- **Mobile-specific UX.**

---

## 11. Explicit non-goals

- Not a general-purpose accounting or bookkeeping suite.
- Not multi-user, multi-business, or a SaaS product.
- Not a payments/collections system.
- Not an AI that decides what to charge — it structures the user's stated intent; the user and the
  deterministic backend own the money.
- Not a CRM. Client master exists to enable invoicing, nothing more.

---

## 12. Context already handled (FYI)

- **Stack is fixed:** React frontend + Supabase (Postgres + Auth) backend. Not designed in this
  session — noted so the vision stays grounded in what's buildable.
- **Supabase project is provisioned** — keys/credentials are in the auth/config kickoff file. The
  actual app, database schema, RLS policies, table grants, and the dev user account were built during
  the 2026-06-13 build session (the earlier "groundwork done" was just the provisioned project +
  credentials). Schema lives in `supabase/migrations/`. RLS is on, scoped per user; `authenticated`
  has table grants; functions are `search_path`-hardened.
- **Security follow-ups (not blocking):** the plaintext secrets in the kickoff doc (DB password +
  `sb_secret_…`) should be rotated; enable Supabase Auth leaked-password protection in the dashboard.
