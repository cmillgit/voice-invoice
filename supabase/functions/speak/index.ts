// speak — turns the agent's reply text into natural speech via ElevenLabs, replacing
// the browser's robotic SpeechSynthesis voice. Returns raw audio/mpeg bytes; the
// frontend plays them directly (see src/features/invoice/speech-out.ts).

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};

const VOICE_ID = Deno.env.get('ELEVENLABS_VOICE_ID') ?? 'enzbGixeo55iqn1QxbbC';
const MODEL_ID = Deno.env.get('ELEVENLABS_MODEL_ID') ?? 'eleven_turbo_v2_5';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const apiKey = Deno.env.get('ELEVEN_LABS_API_KEY');
    if (!apiKey) {
      return json({ error: 'Server not configured: ELEVEN_LABS_API_KEY is not set.' }, 500);
    }

    const { text } = await req.json();
    if (!text || typeof text !== 'string') {
      return json({ error: 'Missing "text".' }, 400);
    }
    // Agent replies are short by design (see parse-invoice's agent_message rule);
    // this is just a hard safety cap on cost/abuse, not a normal-path limit.
    const trimmed = text.slice(0, 2000);

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text: trimmed,
          model_id: MODEL_ID,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      },
    );

    if (!elevenRes.ok || !elevenRes.body) {
      const detail = await elevenRes.text().catch(() => '');
      return json({ error: `ElevenLabs request failed (${elevenRes.status}): ${detail.slice(0, 300)}` }, 502);
    }

    return new Response(elevenRes.body, {
      headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return json({ error: message }, 500);
  }
});
