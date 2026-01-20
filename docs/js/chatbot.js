(function(){
  const box = document.getElementById('chatBox');
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('btnSend');

  if(!box || !input || !btn) return;

  function add(role, text){
    const div = document.createElement('div');
    div.className = 'msg ' + (role==='user' ? 'user' : 'assistant');
    div.innerHTML = `<div class="meta">${role==='user' ? 'You' : 'Cadet Coach'}</div><div>${escapeHtml(text).replace(/
/g,'<br/>')}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  async function localFallback(question){
    const kb = await fetch('data/knowledge.json').then(r=>r.json());
    // Simple keyword scoring
    const q = question.toLowerCase();
    const scored = kb.items.map(it=>{
      let score = 0;
      for(const k of it.keywords){
        if(q.includes(k)) score += 2;
      }
      if(q.includes(it.topic.toLowerCase())) score += 1;
      return {it, score};
    }).sort((a,b)=>b.score-a.score);

    const top = scored.slice(0,3).filter(x=>x.score>0).map(x=>x.it);
    if(!top.length){
      return "I can help, but I need one more detail: your grade (8–12) and your target pathway (academy / ROTC / enlistment / guard).

In the meantime: use the 8–12 Roadmap page and verify requirements on official admissions pages.";
    }

    let out = "Here is guidance based on the Cadet Compass knowledge base:

";
    for(const t of top){
      out += `• ${t.answer}
`;
    }
    out += "
Verification rule: requirements and deadlines can change. Use the official links on the Academies/ROTC/Enlistment pages to confirm.";
    return out;
  }

  async function send(){
    const q = input.value.trim();
    if(!q) return;
    input.value='';
    add('user', q);

    // Try Netlify function first
    try{
      const res = await fetch('/api/chat', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({message:q})
      });
      if(res.ok){
        const j = await res.json();
        if(j && j.reply){
          add('assistant', j.reply);
          return;
        }
      }
    }catch(e){ /* fall through */ }

    const fb = await localFallback(q);
    add('assistant', fb);
  }

  btn.addEventListener('click', send);
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });

  add('assistant', 'Ask me about academies, ROTC, enlistment, Guard/Reserve, and what to do next by grade level.');
})();
