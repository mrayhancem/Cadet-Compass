(function () {
  const box = document.getElementById("chatBox");
  const input = document.getElementById("chatInput");
  const btnSend = document.getElementById("btnSend");
  const btnClear = document.getElementById("btnClear");
  const btnCopyTemplate = document.getElementById("btnCopyTemplate");

  const modeDot = document.getElementById("modeDot");
  const modeText = document.getElementById("modeText");
  const modeHint = document.getElementById("modeHint");

  const promptTemplateEl = document.getElementById("promptTemplate");

  if (!box || !input || !btnSend) return;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    }[c]));
  }

  function addMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = "msg " + (role === "user" ? "user" : "assistant");

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = role === "user" ? "You" : "Cadet Coach";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerHTML = escapeHtml(text).replace(/\n/g, "<br/>");

    // Layout: user messages right-aligned; assistant left-aligned.
    // We keep meta above bubble for both roles for consistency.
    const inner = document.createElement("div");
    inner.style.display = "flex";
    inner.style.flexDirection = "column";
    inner.style.gap = "4px";

    inner.appendChild(meta);
    inner.appendChild(bubble);

    msg.appendChild(inner);
    box.appendChild(msg);
    box.scrollTop = box.scrollHeight;
  }

  function setMode(online, hintText) {
    if (!modeDot || !modeText) return;
    modeDot.classList.remove("on", "off");
    modeDot.classList.add(online ? "on" : "off");
    modeText.textContent = online ? "Mode: AI + local guidance" : "Mode: Local guidance";
    if (modeHint) modeHint.textContent = hintText ? `• ${hintText}` : "";
  }

  async function detectMode() {
    // We call GET /api/chat.
    // Your function returns 405 for non-POST, which still confirms it exists.
    try {
      const res = await fetch("/api/chat", { method: "GET" });
      if (res.status === 405) {
        setMode(true, "Netlify function reachable");
        return true;
      }
      // If it's something else but not a network error, the route still exists.
      if (res.status >= 200 && res.status < 500) {
        setMode(true, `Function responded (${res.status})`);
        return true;
      }
      setMode(false, `Unexpected response (${res.status})`);
      return false;
    } catch (e) {
      setMode(false, "No function (or blocked)");
      return false;
    }
  }

  async function loadKnowledgeBase() {
    // Support either filename (in case you renamed it).
    const candidates = [
      "./data/knowledge.json",
      "./data/knowledge_base.json",
      "./data/knowledge_base_v1.json",
    ];

    for (const path of candidates) {
      try {
        const r = await fetch(path, { cache: "no-store" });
        if (!r.ok) continue;
        const j = await r.json();
        if (j && j.items && Array.isArray(j.items)) return j;
      } catch (e) { /* try next */ }
    }

    return { items: [] };
  }

  async function localFallback(question) {
    const kb = await loadKnowledgeBase();
    const items = kb.items || [];

    const q = question.toLowerCase();

    // Simple keyword scoring
    const scored = items.map((it) => {
      const topic = String(it.topic || "");
      const keywords = Array.isArray(it.keywords) ? it.keywords : [];
      let score = 0;

      for (const k of keywords) {
        const kk = String(k || "").toLowerCase();
        if (kk && q.includes(kk)) score += 2;
      }
      if (topic && q.includes(topic.toLowerCase())) score += 1;

      return { it, score };
    }).sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 3).filter((x) => x.score > 0).map((x) => x.it);

    if (!top.length) {
      return [
        "I can help, but I need two details:",
        "1) your grade (8–12)",
        "2) your target pathway (academy / ROTC / enlistment / guard-reserve)",
        "",
        "In the meantime:",
        "• Use the 8–12 Roadmap page to plan the next 60 days.",
        "• Verify requirements on official admissions/recruiting pages (links in Student Toolkit).",
      ].join("\n");
    }

    let out = "Here is guidance based on the Cadet Compass local knowledge base:\n\n";
    for (const t of top) {
      const ans = String(t.answer || "").trim();
      if (ans) out += `• ${ans}\n`;
    }

    out += "\nVerification rule: requirements and deadlines can change. Use the official links in Student Toolkit to confirm details.";
    return out.trim();
  }

  async function callAi(question) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`API error ${res.status}: ${txt.slice(0, 250)}`);
    }

    const j = await res.json();
    if (!j || !j.reply) throw new Error("No reply field in response.");
    return String(j.reply);
  }

  async function send() {
    const q = (input.value || "").trim();
    if (!q) return;

    input.value = "";
    addMessage("user", q);

    // Try AI first (if function exists); if any error, fallback.
    try {
      const reply = await callAi(q);
      addMessage("assistant", reply);
      setMode(true, "AI response delivered");
      return;
    } catch (e) {
      // Fallback to local
      const fb = await localFallback(q);
      addMessage("assistant", fb);
      setMode(false, "AI unavailable; local fallback used");
      return;
    }
  }

  function clearChat() {
    box.innerHTML = "";
    addMessage("assistant", "Ask me about academies, ROTC, enlistment, Guard/Reserve, and what to do next by grade level.");
  }

  async function copyTemplate() {
    if (!promptTemplateEl) return;
    const text = promptTemplateEl.textContent || "";
    try {
      await navigator.clipboard.writeText(text.trim());
      addMessage("assistant", "Template copied. Paste it into the chat and fill in the blanks.");
    } catch (e) {
      // Clipboard may be blocked; provide a workaround message.
      addMessage("assistant", "Copy failed (browser blocked clipboard). Select the template text and copy manually.");
    }
  }

  // Events
  btnSend.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  if (btnClear) btnClear.addEventListener("click", clearChat);
  if (btnCopyTemplate) btnCopyTemplate.addEventListener("click", copyTemplate);

  // Quick prompt chips
  const chips = document.querySelectorAll(".chip[data-prompt]");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const p = chip.getAttribute("data-prompt");
      if (!p) return;
      input.value = p;
      input.focus();
    });
  });

  // Initial
  addMessage("assistant", "Ask me about academies, ROTC, enlistment, Guard/Reserve, and what to do next by grade level.");
  detectMode();
})();
