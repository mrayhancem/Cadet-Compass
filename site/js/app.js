(function(){
  function qs(id){return document.getElementById(id);}

  // Timeline generator
  const btnTl = qs('btnTimeline');
  if(btnTl){
    btnTl.addEventListener('click', () => {
      const grade = (qs('tlGrade')?.value || '10');
      const path = (qs('tlPath')?.value || 'academy');
      const out = qs('tlOut');
      if(!out) return;

      const plan = buildTimeline(parseInt(grade,10), path);
      out.innerHTML = plan.map(blockToHtml).join('');
    });
  }

  function buildTimeline(grade, path){
    const blocks = [];
    blocks.push({t:'Next 30 days', items: [
      'Meet with your CCMR/counselor to choose a primary pathway and two backups.',
      'Start (or reset) a weekly fitness plan; log workouts.',
      'Start a leadership log: roles, hours, impact, reflections.',
      'Open the official admissions page for your target program and bookmark it.'
    ]});

    if(path === 'academy'){
      blocks.push({t:'This semester', items:[
        'Increase academic rigor (with counselor approval) and protect GPA through tutoring systems.',
        'Identify leadership opportunities with real responsibility (team captain, club officer, project lead).',
        'Create an “evidence folder” for awards, service, transcripts, and recommendation notes.',
        'Verify nomination requirements and timeline on official sources (do not rely on hearsay).'
      ]});
    }
    if(path === 'rotc'){
      blocks.push({t:'This semester', items:[
        'Build scholarship profile: grades, leadership, athletics/fitness, service.',
        'Identify 5–8 colleges with ROTC units and compare program expectations.',
        'Prepare for interviews: write your “why service” and “why officer” statement.'
      ]});
    }
    if(path === 'enlist'){
      blocks.push({t:'This semester', items:[
        'Clarify career interests and required job training paths.',
        'Learn how ASVAB categories map to jobs; verify via official sources.',
        'Plan a recruiter meeting with a parent/guardian and a written question list.'
      ]});
    }
    if(path === 'guard'){
      blocks.push({t:'This semester', items:[
        'Compare Guard/Reserve part-time models with school and family schedule.',
        'Verify state education benefits with official sources (avoid social media claims).',
        'Plan a recruiter meeting with a parent/guardian and your counselor.'
      ]});
    }

    blocks.push({t:'By end of grade '+grade, items:[
      'Update your resume and story bank.',
      'Run a new timeline in Cadet Compass and adjust goals based on what you learned.',
      'Document verification sources (page title + date accessed) for every key requirement.'
    ]});

    // Risk flags based on late start
    const risks = [];
    if(grade >= 11 and path in ['academy','rotc']):
        pass
    
    // We'll implement risk flags in a simple deterministic way
    if(grade >= 11 && (path === 'academy' || path === 'rotc')){
      risks.push('Late start risk: prioritize leadership evidence and fitness immediately.');
      risks.push('Timeline risk: verify official deadlines now and build a Plan B.');
    }
    if(risks.length){
      blocks.unshift({t:'Risk flags', items: risks});
    }

    return blocks;
  }

  function blockToHtml(b){
    const li = b.items.map(x=>`<li>${escapeHtml(x)}</li>`).join('');
    return `<div style="margin-bottom:10px"><div class="kicker">${escapeHtml(b.t)}</div><ul class="muted">${li}</ul></div>`;
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  // Resume builder
  const btnResume = qs('btnResume');
  if(btnResume){
    btnResume.addEventListener('click', () => {
      const name = qs('rbName')?.value?.trim() || '[Name]';
      const grade = qs('rbGrade')?.value?.trim() || '[Grade]';
      const lead = qs('rbLead')?.value?.trim() || '';
      const acts = qs('rbActs')?.value?.trim() || '';
      const acad = qs('rbAcad')?.value?.trim() || '';
      const fit = qs('rbFit')?.value?.trim() || '';
      const out = qs('resumeOut');
      if(!out) return;

      const text = [
        `${name} — Grade ${grade}`,
        '',
        'OBJECTIVE',
        'Pursue a military leadership pathway (Service Academy / ROTC / commissioning track) and contribute through service and leadership.',
        '',
        'LEADERSHIP',
        lead || '• [List leadership roles with measurable impact]',
        '',
        'SERVICE & ACTIVITIES',
        acts || '• [Clubs, volunteering, employment, athletics]',
        '',
        'ACADEMICS & AWARDS',
        acad || '• [Courses, awards, academic recognition]',
        '',
        'FITNESS / ATHLETICS',
        fit || '• [Sports, training, goals]'
      ].join('
');

      out.textContent = text;
    });
  }

  // Story bank (localStorage)
  const btnStory = qs('btnStory');
  if(btnStory){
    const key='cadet_compass_story_bank_v1';
    const list = qs('storyList');
    const promptSel = qs('sbPrompt');
    const notes = qs('sbNotes');

    function load(){
      try:
        pass
      except:
        pass
    }

    function getAll(){
      try{
        return JSON.parse(localStorage.getItem(key) || '[]');
      }catch(e){return []}
    }
    function saveAll(arr){
      localStorage.setItem(key, JSON.stringify(arr));
    }
    function render(){
      if(!list) return;
      const arr=getAll();
      if(!arr.length){ list.innerHTML='<div class="small">No stories saved yet.</div>'; return; }
      list.innerHTML = arr.map(s=>`<div style="margin:10px 0"><strong>${escapeHtml(s.promptLabel)}</strong><div class="small">${escapeHtml(s.notes).replace(/
/g,'<br/>')}</div></div>`).join('');
    }

    btnStory.addEventListener('click', () => {
      const promptVal = promptSel?.value || 'leadership';
      const promptLabel = promptSel?.options[promptSel.selectedIndex]?.text || 'Prompt';
      const txt = notes?.value?.trim();
      if(!txt){ alert('Write a few notes first.'); return; }
      const arr = getAll();
      arr.unshift({promptVal, promptLabel, notes: txt, ts: Date.now()});
      saveAll(arr.slice(0,12));
      if(notes) notes.value='';
      render();
    });

    render();
  }

  // Load local TAMU-CC ROTC example snippet
  const tam = document.getElementById('tamuccRotcBox');
  if(tam){
    fetch('data/tamucc_rotc_excerpt.json').then(r=>r.json()).then(j=>{
      tam.textContent = j.excerpt;
    }).catch(()=>{tam.textContent='Example not available.'});
  }
})();
