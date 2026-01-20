/**
 * Netlify Function: /api/chat
 * OpenAI Responses API with continuation support.
 *
 * Env vars:
 * - OPENAI_API_KEY
 * - OPENAI_MODEL (example: gpt-5-mini)
 */

export default async (request, context) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY not set" }, 501);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const message = String(payload?.message || "").slice(0, 4000).trim();
  if (!message) {
    return json({ error: "Message required" }, 400);
  }

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";

  // Optional: client can send prior assistant text to request continuation
  const mode = String(payload?.mode || "answer"); // "answer" | "continue"
  const prior = String(payload?.prior || "").slice(0, 12000);

  const system = `You are Cadet Coach for a K-12 school advising website.

Rules:
- Do not request sensitive personal data.
- Do not promise eligibility, dollar amounts, or exact deadlines.
- Provide grade-appropriate guidance for grades 8–12.
- Always tell the user to verify requirements on official sources.
- Be concise, structured, and practical (use bullets).
- If user asks for disallowed content, refuse.`;

  // If continuing, instruct the model to ONLY continue (no restart).
  const userText =
    mode === "continue"
      ? `Continue your previous answer EXACTLY where you left off.
Do NOT repeat earlier content. Continue from the last visible characters below:

[LAST OUTPUT START]
${prior}
[LAST OUTPUT END]

Now continue:`
      : message;

  const body = {
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: userText }] },
    ],

    // Increased for long advisory responses
    max_output_tokens: 1400,
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
      return json(
        {
          error: "Upstream error",
          status: resp.status,
          model,
          details: rawText.slice(0, 1200),
        },
        502
      );
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return json(
        { error: "Bad upstream JSON", model, details: rawText.slice(0, 1200) },
        502
      );
    }

    // Extract reply text (Responses API)
    const reply = extractReply(data).trim() || "No reply.";

    // Determine if output likely cut off
    const truncated =
      data?.incomplete === true ||
      data?.status === "incomplete" ||
      String(data?.finish_reason || "").includes("length");

    return json({ reply, model, truncated: !!truncated }, 200);
  } catch (e) {
    return json({ error: "Network error", model, details: String(e) }, 502);
  }
};

function extractReply(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }
  if (!Array.isArray(data?.output)) return "";
  const chunks = [];
  for (const item of data.output) {
    if (!item || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
  }
  return chunks.join("\n");
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
