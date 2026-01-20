/**
 * Netlify Function: /api/chat
 *
 * Env vars required in Netlify:
 *   OPENAI_API_KEY = sk-...
 * Optional:
 *   OPENAI_MODEL   = gpt-5-mini
 */

exports.handler = async (event) => {
  try {
    // Only allow POST
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 501,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "OPENAI_API_KEY not set" }),
      };
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (e) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid JSON" }),
      };
    }

    const message = String(payload.message || "").slice(0, 2000).trim();
    if (!message) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Message required" }),
      };
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

    // Responses API (recommended)
    const body = {
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
      temperature: 0.2,
    };

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
      return {
        statusCode: 502,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Upstream error",
          details: errText.slice(0, 1000),
        }),
      };
    }

    const data = await resp.json();

    // Extract output text robustly
    let reply = "";
    if (typeof data.output_text === "string") reply = data.output_text;

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

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (e) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Function crash", details: String(e) }),
    };
  }
};
