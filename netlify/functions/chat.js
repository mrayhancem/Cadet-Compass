/**
 * Netlify Function: /api/chat
 * Uses OpenAI Responses API.
 *
 * Env vars in Netlify:
 * - OPENAI_API_KEY
 * - OPENAI_MODEL (example: gpt-5-mini)
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
  } catch {
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

  const system = `You are Cadet Coach for a K-12 school advising website.

Rules:
- Do not request sensitive personal data.
- Do not promise eligibility, dollar amounts, or exact deadlines.
- Provide grade-appropriate guidance for grades 8–12.
- Always tell the user to verify requirements on official sources.
- Be concise, structured, and practical.
- If user asks for disallowed content, refuse.`;

  const body = {
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: message }] },
    ],
    max_output_tokens: 700,
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

    const rawText = await resp.text();

    if (!resp.ok) {
      return new Response(
        JSON.stringify({
          error: "Upstream error",
          status: resp.status,
          model,
          details: rawText.slice(0, 1200),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return new Response(
        JSON.stringify({
          error: "Bad upstream JSON",
          model,
          details: rawText.slice(0, 1200),
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    // --- Correct reply extraction for Responses API ---
    let reply = "";

    // Preferred: convenience field
    if (typeof data.output_text === "string" && data.output_text.trim()) {
      reply = data.output_text.trim();
    } else if (Array.isArray(data.output)) {
      // Fallback: gather output_text chunks from the structured output array
      const chunks = [];
      for (const item of data.output) {
        if (!item || !Array.isArray(item.content)) continue;
        for (const part of item.content) {
          if (part?.type === "output_text" && typeof part.text === "string") {
            chunks.push(part.text);
          }
        }
      }
      reply = chunks.join("\n").trim();
    }

    if (!reply) reply = "No reply.";

    return new Response(JSON.stringify({ reply, model }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Network error", model, details: String(e) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
};
