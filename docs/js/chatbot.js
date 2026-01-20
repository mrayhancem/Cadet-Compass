(function () {
  const box = document.getElementById("chatBox");
  const input = document.getElementById("chatInput");
  const btn = document.getElementById("btnSend");
  const btnClear = document.getElementById("btnClear");

  const modeDot = document.getElementById("modeDot");
  const modeText = document.getElementById("modeText");
  const modeHint = document.getElementById("modeHint");

  const chips = document.querySelectorAll(".chip");
  const btnCopyTemplate = document.getElementById("btnCopyTemplate");
  const promptTemplate = document.getElementById("promptTemplate");

  if (!box || !input || !btn) return;

  let lastAssistantText = ""; // used for continuation
  let kbCache = null;

  function setMode(aiOk, hint) {
    if (modeDot) {
      modeDot.classList.toggle("on", !!aiOk);
      modeDot.classList.toggle("off", !aiOk);
    }
    if (modeText) modeText.textContent = aiOk ? "Mode: AI + local guidance" : "Mode: Local guidance";
    if (modeHint) modeHint.textContent = hint ? ` • ${hint}` : "";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function add(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "user" : "assistant");
    div.innerHTML = `
      <div class="bubble">
        <div class="meta">${role === "user" ? "You" : "Cadet Coach"}</div>
        <div>${escapeHtml(text).replace(/\n/g, "<br/>")}</div>
      </div>
    `;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  async function loadKb() {
    if (kbCache) return kbCache;
    kbCache = await fetch("./data/knowledge.json").then((r) => r.json());
    return kbCache;
  }

  async function localFallback(question) {
    const kb = await loadKb();
    const q = question.toLowerCase();

    const scored = kb.items
      .map((it) => {
        let score = 0;
        for (const k of it.keywords || []) {
          if (q.includes(String(k).toLowerCase())) score += 2;
        }
        if (q.includes(String(it.topic || "").toLowerCase())) score += 1;
        return { it, score };
      })
      .sort((a, b) => b.score - a.score);

    const top = scored.slice(0, 3).filter((x) => x.score > 0).map((x) => x.it);

    if (!top.length) {
      return (
        "I can help, but I need one more detail: your grade (8–12) and your target pathway " +
        "(academy / ROTC / enlistment / guard).\n\n" +
        "In the meantime: use the 8–12 Roadmap page and verify requirements on official pages."
      );
    }

    let out = "Here is guidance based on the Cadet Compass local knowledge base:\n\n";
    for (const t of top) out += `• ${t.answer}\n`;
    out += "\nVerification rule: requirements and deadlines can change. Use official links in Student Toolkit to confirm.";
    return out;
  }

  async function callApi(message, mode = "answer", prior = "") {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, mode, prior }),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
    }
    return res.json();
  }

  function ensureContinueButton(show) {
    let btnCont = document.getElementById("btnContinue");
    if (!show) {
      if (btnCont) btnCont.remove();
      return;
    }
    if (btnCont) return;

    btnCont = document.createElement("button");
    btnCont.id = "btnContinue";
    btnCont.className = "btn";
    btnCont.type = "button";
    btnCont.textContent = "Continue";
    btnCont.style.marginLeft = "6px";

    // Insert next to Send/Clear
    const row = btn.parentElement;
    if (row) row.appendChild(btnCont);

    btnCont.addEventListener("click", async () => {
      if (!lastAssistantText) return;
      btnCont.disabled = true;
      btnCont.textContent = "Continuing...";

      try {
        const j = await callApi("continue", "continue", lastAssistantText);
        add("assistant", j.reply);
        lastAssistantText = (lastAssistantText + "\n" + j.reply).slice(-12000);
        setMode(true, "AI available");
        ensureContinueButton(!!j.truncated);
      } catch {
        // If AI fails, no continuation; keep UX clean
        setMode(false, "AI unavailable — local only");
        ensureContinueButton(false);
      } finally {
        btnCont.disabled = false;
        btnCont.textContent = "Continue";
      }
    });
  }

  async function send() {
    const q = input.value.trim();
    if (!q) return;

    input.value = "";
    add("user", q);

    // Try AI first
    try {
      const j = await callApi(q, "answer", "");
      add("assistant", j.reply);
      lastAssistantText = j.reply.slice(-12000);
      setMode(true, "AI available");
      ensureContinueButton(!!j.truncated);
      return;
    } catch {
      // Fall through to local
    }

    const fb = await localFallback(q);
    add("assistant", fb);
    lastAssistantText = fb.slice(-12000);
    setMode(false, "AI unavailable — local fallback used");
    ensureContinueButton(false);
  }

  // Events
  btn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      box.innerHTML = "";
      lastAssistantText = "";
      ensureContinueButton(false);
      add("assistant", "Ask me about academies, ROTC, enlistment, Guard/Reserve, and what to do next by grade level.");
    });
  }

  chips.forEach((c) => {
    c.addEventListener("click", () => {
      const p = c.getAttribute("data-prompt") || "";
      input.value = p;
      input.focus();
    });
  });

  if (btnCopyTemplate && promptTemplate) {
    btnCopyTemplate.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(promptTemplate.textContent.trim());
        btnCopyTemplate.textContent = "Copied";
        setTimeout(() => (btnCopyTemplate.textContent = "Copy template"), 1200);
      } catch {
        // no-op
      }
    });
  }

  // Initial assistant message
  setMode(false, "checking…");
  add("assistant", "Ask me about academies, ROTC, enlistment, Guard/Reserve, and what to do next by grade level.");

  // Quick health check (optional): make a tiny call so the dot flips green if working
  (async () => {
    try {
      const j = await callApi("Say: Ready.", "answer", "");
      // We do NOT print this health-check reply
      setMode(true, "AI available");
    } catch {
      setMode(false, "AI unavailable — local only");
    }
  })();
})();
