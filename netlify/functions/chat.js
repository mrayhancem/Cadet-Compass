/**
 * Netlify Function: /api/chat
 *
 * Purpose: Optional live AI coach.
 * - If OPENAI_API_KEY isn't set, the frontend should fall back to local guidance.
 *
 * Env vars in Netlify:
 *   OPENAI_API_KEY = sk-...
 *   OPENAI_MODEL   = gpt-5-mini (recommended) OR any supported model
 */

export default async (request, context) => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
      status: 501,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const message = String(payload?.message || "").slice(0, 2000).trim();
  if (!message) {
    return new Response(JSON.stringify({ error: "Message required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";

  const system = `You are Cadet Coach for a Texas student advising website about military pathways (Grades 8–12).

Rules:
- Do not request sensitive personal data.
- Do not promise eligibility, dollar amounts, or exact deadlines.
- Provide grade-appropriate guidance for grades 8–12.
- Always tell the user to verify requirements on official sources.
- Be concise, structured, and practical.
- If user asks for disallowed content, refuse and redirect to safe guidance.`;

  // Use Responses API (recommended for newer models)
  const body = {
    model,
    input: [
      { role: "system", content: system },
      { role: "user", content: message },
    ],
    // Keep deterministic, counselor-style.
    temperature: 0.2,
  };

  try {
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({
          error: "Upstream error",
          details: errText.slice(0, 800),
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data = await resp.json();

    // Responses API can return output in different shapes; handle common patterns.
    let reply = "";

    // 1) Many responses include output_text
    if (typeof data.output_text === "string") reply = data.output_text;

    // 2) Or they include output array with message content parts
    if (!reply && Array.isArray(data.output)) {
      const parts = [];
      for (const o of data.output) {
        if (o && o.type === "message" && Array.isArray(o.content)) {
          for (const c of o.content) {
            if (c && c.type === "output_text" && typeof c.text === "string") {
              parts.push(c.text);
            }
          }
        }
      }
      reply = parts.join("\n").trim();
    }

    if (!reply) reply = "No reply.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Network error", details: String(e) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};
