// Netlify Functions (Node) runtime supports global fetch in modern runtimes.
export default async (request, context) => {
  // CORS (optional; same-origin requests typically fine, but safe to include)
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (request.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not set" }), {
      status: 501,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const message = String(payload?.message || "").trim().slice(0, 2000);
  if (!message) {
    return new Response(JSON.stringify({ error: "Message required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const system = `You are Cadet Coach for a Grades 8–12 military-pathway advising website (Texas context allowed).

Rules:
- Do not request or store sensitive personal data.
- Do not promise eligibility, dollar amounts, or exact deadlines.
- Provide grade-appropriate guidance (8–12) with practical next steps.
- Always include: what to verify on official sources (academy/ROTC/branch sites).
- Be concise, structured, and practical.
- If asked for disallowed/unsafe content, refuse and redirect to safe guidance.`;

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";

  // Responses API request body (recommended in OpenAI quickstart)
  // We ask for a single, structured response and keep it short.
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
    // Keep it stable for advising:
    temperature: 0.2,
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

    const raw = await resp.text();

    if (!resp.ok) {
      // Return the upstream payload (trimmed) to make debugging easy in Netlify function logs.
      return new Response(
        JSON.stringify({
          error: "Upstream error",
          status: resp.status,
          details: raw.slice(0, 1200),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse the response
    const data = JSON.parse(raw);

    // OpenAI quickstart shows `response.output_text` usage in SDKs; for raw JSON,
    // the "output_text" field is commonly present.
    const reply =
      (typeof data?.output_text === "string" && data.output_text.trim()) ||
      "No reply.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Network error", details: String(e) }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};
