(function () {
  const box = document.getElementById("chatBox");
  const input = document.getElementById("chatInput");
  const btn = document.getElementById("btnSend");
  const btnClear = document.getElementById("btnClear");
  const modeDot = document.getElementById("modeDot");
  const modeText = document.getElementById("modeText");
  const modeHint = document.getElementById("modeHint");
  const btnCopyTemplate = document.getElementById("btnCopyTemplate");
  const promptTemplate = document.getElementById("promptTemplate");

  if (!box || !input || !btn) return;

  function setMode(isAIOnline, hintText = "") {
    if (modeDot) {
      modeDot.classList.remove("on", "off");
      modeDot.classList.add(isAIOnline ? "on" : "off");
    }
    if (modeText) modeText.textContent = isAIOnline ? "Mode: AI + local guidance" : "Mode: Local guidance";
    if (modeHint) modeHint.textContent = hintText ? `• ${hintText}` : "";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function add(role, text) {
    const div = document.createElement("div");
    div.className = "msg " + (role === "user" ? "user" : "assistant");

    // Keep bubbles consistent with your CSS
    const label = role === "user" ? "You" : "Cadet Coach";
    div.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:6px; width:100%; ${role === "user" ? "align-items:flex-end;" : ""}">
        <div class="meta">${label}</div>
        <div class="bubble">${escapeHtml(text)}</div>
      </div>
    `;

    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  async function localFallback(question) {
    const kb = await fetch("data/knowledge.json").then((r) => r.json());
    const q = question.toLowerCase();

    const scored = (kb.items || [])
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
        "I can help, but I need one more detail: your grade (8–12) and your target pathway (academy / ROTC / enlistment / guard).\n\n" +
        "In the meantime: use the 8–12 Roadmap page and verify requirements on official program pages."
      );
    }

    let out = "Here is guidance based on the Cadet Compass local knowledge base:\n\n";
    for (const t of top) {
      out += `• ${t.answer}\n`;
    }
    out += "\nVerification rule: requirements and deadlines can change. Use the official links in Student Toolkit to confirm details.";
    return out;
  }

  async function send() {
    const q = input.value.trim();
    if (!q) return;

    input.value = "";
    add("user", q);

    // Try Netlify function first
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });

      if (res.ok) {
        const j = await res.json();
        if (j && j.reply) {
          setMode(true, "AI available");
          add("assistant", j.reply);
          return;
        }
      } else {
        setMode(false, `AI unavailable (${res.status}) — local fallback used`);
      }
    } catch (e) {
      setMode(false, "AI unavailable — local fallback used");
    }

    const fb = await localFallback(q);
    add("assistant", fb);
  }

  btn.addEventListener("click", send);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  if (btnClear) {
    btnClear.addEventListener("click", () => {
      box.innerHTML = "";
      add("assistant", "Ask me about academies, ROTC, enlistment, Guard/Reserve, and what to do next by grade level.");
    });
  }

  // Quick prompt chips
  document.querySelectorAll(".chip[data-prompt]").forEach((el) => {
    el.addEventListener("click", () => {
      const p = el.getAttribute("data-prompt") || "";
      input.value = p;
      input.focus();
    });
  });

  // Copy template
  if (btnCopyTemplate && promptTemplate) {
    btnCopyTemplate.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(promptTemplate.textContent || "");
        btnCopyTemplate.textContent = "Copied";
        setTimeout(() => (btnCopyTemplate.textContent = "Copy template"), 1200);
      } catch {
        alert("Copy failed. Select the text and copy manually.");
      }
    });
  }

  // Initial message
  setMode(false, "AI status not checked yet");
  add("assistant", "Ask me about academies, ROTC, enlistment, Guard/Reserve, and what to do next by grade level.");
})();
