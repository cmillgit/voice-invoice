# voice-invoice

A voice-first invoicing app for Miller Painting. Hold a button, speak the job details, and the app transcribes your speech, interprets it with AI, generates a PDF invoice, and emails it to the client — all from your phone in under 30 seconds.

## Tech Stack

- **Next.js 14** (App Router, TypeScript, Tailwind CSS)
- **Supabase** — PostgreSQL database for clients and invoices
- **OpenAI Whisper** — speech-to-text transcription
- **Anthropic Claude** — invoice interpretation from natural language
- **Resend** — transactional email with PDF attachment
- **@react-pdf/renderer** — server-side PDF generation

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key
- An [OpenAI](https://platform.openai.com) API key (for Whisper)
- A [Resend](https://resend.com) account with a verified sending domain

## Setup

**1. Clone and install**

```bash
git clone https://github.com/cmillgit/voice-invoice.git
cd voice-invoice
npm install
```

**2. Configure environment variables**

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in your keys (see `.env.local.example` for all required variables).

**3. Set up the database**

- Create a new project at [supabase.com](https://supabase.com)
- Go to **SQL Editor → New query**
- Paste the contents of `supabase/migrations/001_initial_schema.sql` and click **Run**

**4. Seed at least one client**

In the Supabase Table Editor, insert a row into the `clients` table. Example:

| Field | Value |
|-------|-------|
| name | John Smith |
| email | john@example.com |
| account_id | SMITH-001 |
| rate_type | day |
| default_rate | 400 |

**5. Run locally**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) on your phone or in Chrome DevTools mobile emulation.

## Usage

1. Hold the mic button and describe the job:
   *"Invoice John Smith, 3 days labor at $400 a day, main bedroom paint job"*
2. Release — the app transcribes and interprets your speech
3. Review the invoice preview card
4. Tap **Send Invoice** and confirm — the PDF is emailed and saved

## Deployment (Vercel)

```bash
npm install -g vercel
vercel
```

Set all environment variables from `.env.local` in the Vercel dashboard under **Project Settings → Environment Variables**. Set `NEXT_PUBLIC_APP_URL` to your Vercel domain.

## Architecture

Voice input is captured via the browser's `MediaRecorder` API and sent as audio to `/api/transcribe`, which forwards it to OpenAI Whisper and returns a text transcript. That transcript is sent to `/api/interpret` along with the client list and current invoice state; Claude interprets the natural language and returns structured invoice data (client, line items, totals). When the user confirms, `/api/send-invoice` generates a PDF with `@react-pdf/renderer`, emails it via Resend, and saves the invoice to Supabase. All AI and email calls happen server-side in Next.js API routes — nothing sensitive touches the browser.
