/**
 * Netlify Function: /api/chat
 *
 * Purpose: Live AI coach (optional). If OPENAI_API_KEY isn't set,
 * the frontend falls back to local guidance.
 *
 * Notes:
 * - Uses OpenAI "Responses" API (recommended for newer models).
 * - Avoids unsupported parameters (e.g., temperature for some models like gpt-5-mini).
 */

export default async (request, context) => {
  // Only allow POST
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

  const system = `You are Cadet Coach for a K-12 school advising website.

Rules:
- Do not request sensitive personal data.
- Do not promise eligibility, dollar amounts, or exact deadlines.
- Provide grade-appropriate guidance for grades 8–12.
- Always tell the user to verify requirements on official sources.
- Be concise, structured, and practical.
- If user asks for disallowed content, refuse.`;

  const model = (process.env.OPENAI_MODEL || "gpt-5-mini").trim();

  // OpenAI Responses API body
  // IMPORTANT: Do NOT send "temperature" if using models that don't support it.
  const body = {
    model,
    input: [
      {
        role: "system",
        content: [{ type: "text", text: system }],
      },
      {
        role: "user",
        content: [{ type: "text", text: message }],
      },
    ],
    // Keep it controlled and safe; adjust as needed
    max_output_tokens: 600,
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
          details: errText.slice(0, 1200),
          model,
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data = await resp.json();

    // Responses API convenience field (usually present)
    let reply = data?.output_text;

    // Fallback extraction if output_text isn't present
    if (!reply) {
      try {
        const out = data?.output || [];
        // find first message-like output
        const msg = out.find((x) => x.type === "message");
        const parts = msg?.content || [];
        reply = parts
          .filter((p) => p.type === "output_text" || p.type === "text")
          .map((p) => p.text || "")
          .join("\n")
          .trim();
      } catch (e) {
        // ignore
      }
    }

    if (!reply) reply = "No reply.";

    return new Response(JSON.stringify({ reply, model }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Network error", details: String(e), model }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
