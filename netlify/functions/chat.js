/**
 * Netlify Function: /api/chat
 *
 * Purpose: Optional live AI coach. If OPENAI_API_KEY isn't set, the frontend falls back to local guidance.
 *
 * Security: Store OPENAI_API_KEY as an environment variable in Netlify.
 */

export default async (request, context) => {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not set' }), { status: 501 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const message = String(payload?.message || '').slice(0, 2000);
  if (!message) {
    return new Response(JSON.stringify({ error: 'Message required' }), { status: 400 });
  }

  const system = `You are Cadet Coach for a K-12 school advising website.

Rules:
- Do not request sensitive personal data.
- Do not promise eligibility, dollar amounts, or exact deadlines.
- Provide grade-appropriate guidance for grades 8–12.
- Always tell the user to verify requirements on official sources.
- Be concise, structured, and practical.
- If user asks for disallowed content, refuse.`;

  const body = {
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: message }
    ],
    temperature: 0.2
  };

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: 'Upstream error', details: errText.slice(0, 800) }), { status: 502 });
    }

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content || 'No reply.';
    return new Response(JSON.stringify({ reply }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Network error', details: String(e) }), { status: 502 });
  }
};
