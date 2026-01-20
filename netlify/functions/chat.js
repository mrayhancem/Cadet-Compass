/**
 * Netlify Function: /.netlify/functions/chat
 * Optional live AI coach. If OPENAI_API_KEY isn't set, frontend falls back to local guidance.
 *
 * Env vars (Netlify):
 * - OPENAI_API_KEY   (required for AI mode)
 * - OPENAI_MODEL     (recommended: gpt-5-mini)
 */

exports.handler = async (event) => {
  // Allow only POST
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  // Parse JSON
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "Invalid JSON" });
  }

  const message = String(payload?.message || "").trim().slice(0, 2000);
  if (!message) {
    return json(400, { error: "Message required" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Frontend should interpret this and fall back locally
    return json(501, { error: "OPENAI_API_KEY not set" });
  }

  const model = (process.env.OPENAI_MODEL || "gpt-5-mini").trim();

  // System guardrails: safe advising + verification
  const system = [
    "You are Cadet Coach for a Grades 8–12 military pathway advising website.",
    "",
    "Rules:",
    "- Do not request or store sensitive personal data (full name, address, SSN, medical details).",
    "- Do not promise eligibility, dollar amounts, or exact deadlines.",
    "- Provide grade-appropriate guidance for grades 8–12.",
    "- Always tell the user to verify requirements on official sources (academies/ROTC/branch/recruiter pages).",
    "- Be concise, structured, and practical: bullets, short headings, next steps, risks, what to verify.",
    "- If asked for disallowed or unsafe instructions, refuse and redirect to safe guidance."
  ].join("\n");

  // Log marker so you can see invocations in Netlify function logs
  console.log("[cadet-compass] chat invoked", { model });

  try {
    // Use Responses API (recommended for gpt-5 family)
    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: message }
        ],
        // Keep it stable and “advisor-like”
        temperature: 0.2,
        max_output_tokens: 700
      })
    });

    const text = await resp.text();

    if (!resp.ok) {
      // Return OpenAI error text in a safe, truncated way for debugging
      console.error("[cadet-compass] upstream error", {
        status: resp.status,
        body: text.slice(0, 900)
      });

      return json(502, {
        error: "Upstream error",
        status: resp.status,
        details: text.slice(0, 900)
      });
    }

    const data = JSON.parse(text);

    // Extract output text robustly
    const reply = extractResponseText(data) || "No reply.";

    return json(200, { reply });
  } catch (e) {
    console.error("[cadet-compass] network/runtime error", String(e));
    return json(502, { error: "Network error", details: String(e) });
  }
};

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(obj)
  };
}

// Works across Responses API shapes
function extractResponseText(data) {
  // Common: data.output_text
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  // Fallback: search through output array
  const out = data?.output;
  if (Array.isArray(out)) {
    for (const item of out) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string" && c.text.trim()) {
          return c.text.trim();
        }
      }
    }
  }

  return "";
}
