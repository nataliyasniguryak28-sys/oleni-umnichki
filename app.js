(() => {
  const BASE = (window.DATABASE_URL || '').replace(/\/$/, '');
  const $ = (id) => document.getElementById(id);
  const state = { girls: {}, activeId: localStorage.getItem('ou_active_girl') || '' };

  const esc = (s='') => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const slug = (s) => s.trim().toLowerCase().replace(/[^a-zа-яёіїєґ0-9]+/gi,'-').replace(/^-|-$/g,'') + '-' + Math.random().toString(36).slice(2,6);
  const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD locally
  const monday = (d=new Date()) => { const x=new Date(d); const day=x.getDay()||7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day+1); return x; };
  const dateKey = (d) => d.toLocaleDateString('sv-SE');
  const fmt = n => Number(n).toFixed(1).replace('.', ',');
  const fmtDate = d => new Intl.DateTimeFormat('ru-RU',{day:'2-digit',month:'2-digit'}).format(d);

  async function api(path, options={}) {
    if (!BASE) throw new Error('Нет DATABASE_URL');
    const res = await fetch(`${BASE}/${path}.json`, {headers:{'Content-Type':'application/json'}, ...options});
    if (!res.ok) throw new Error(`Firebase: ${res.status}`);
    return res.json();
  }
  const put = (path,data) => api(path,{method:'PUT',body:JSON.stringify(data)});
  const patch = (path,data) => api(path,{method:'PATCH',body:JSON.stringify(data)});

  function toast(msg){ const el=$('toast'); el.textContent=msg; el.classList.remove('hidden'); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.add('hidden'),2400); }
  function setConn(ok,msg){ const el=$('connectionBadge'); el.textContent=msg; el.className='badge '+(ok?'ok':'err'); }

  async function loadAll(){
    try{
      const data = await api('girls');
      state.girls = data || {};
      setConn(true,'● Общая база онлайн');
      renderAll();
    }catch(e){ setConn(false,'⚠ Нет связи с базой'); toast('Не удалось подключиться к Firebase'); console.error(e); }
  }

  function activeGirl(){ return state.activeId && state.girls[state.activeId] ? state.girls[state.activeId] : null; }

  function renderAll(){ renderSelect(); renderActive(); renderRankings(); renderAttendance(); }

  function renderSelect(){
    const sel=$('girlSelect');
    const entries=Object.entries(state.girls).sort((a,b)=>(a[1].name||'').localeCompare(b[1].name||'','ru'));
    sel.innerHTML='<option value="">Выбери имя…</option>'+entries.map(([id,g])=>`<option value="${esc(id)}">${esc(g.name||'Без имени')}</option>`).join('');
    if(state.activeId && state.girls[state.activeId]) sel.value=state.activeId;
  }

  function renderActive(){
    const g=activeGirl(), line=$('activeGirlLine'), hint=$('weightHint'), tw=$('todayWeight');
    const disabled=!g; $('weightInput').disabled=disabled; $('drinkInput').disabled=disabled; $('mlInput').disabled=disabled;
    $('weightForm').querySelector('button').disabled=disabled; $('alcoholForm').querySelector('button').disabled=disabled;
    if(!g){ line.classList.add('hidden'); hint.textContent='Сначала выбери себя.'; tw.textContent=''; return; }
    line.classList.remove('hidden'); line.innerHTML=`Сегодня отчитывается: <strong>${esc(g.name)}</strong> 💅`;
    const weights=g.weights||{}; const keys=Object.keys(weights).sort(); const lastKey=keys[keys.length-1];
    hint.textContent= lastKey ? `Последняя запись: ${fmt(weights[lastKey])} кг (${lastKey.split('-').reverse().join('.')})` : 'Это будет твой первый вес.';
    if(weights[today()]!=null) tw.textContent=`Сегодня уже записано: ${fmt(weights[today()])} кг`;
    else tw.textContent='Сегодня вес ещё не записан.';
  }

  async function addGirl(){
    const name=prompt('Как зовут участницу?'); if(!name || !name.trim()) return;
    const id=slug(name); const girl={name:name.trim(),createdAt:Date.now(),weights:{},alcohol:{}};
    try{ await put(`girls/${id}`,girl); state.girls[id]=girl; state.activeId=id; localStorage.setItem('ou_active_girl',id); renderAll(); toast('Участница добавлена ✨'); }
    catch(e){ toast('Не удалось добавить. Проверь базу Firebase.'); }
  }

  function previousWeight(g, beforeDate){
    const w=g.weights||{}; const keys=Object.keys(w).filter(k=>k<beforeDate).sort(); if(!keys.length) return null; const k=keys[keys.length-1]; return Number(w[k]);
  }

  async function saveWeight(e){
    e.preventDefault(); const g=activeGirl(); if(!g) return;
    const val=Number(String($('weightInput').value).replace(',','.')); if(!val) return;
    const d=today(); const prev=previousWeight(g,d);
    try{
      await put(`girls/${state.activeId}/weights/${d}`,val);
      g.weights=g.weights||{}; g.weights[d]=val; $('weightInput').value=''; renderAll();
      showWeightResult(g.name,val,prev);
    }catch(err){ toast('Вес не сохранился. Проверь Firebase.'); }
  }

  function showWeightResult(name,val,prev){
    let html='';
    if(prev==null){
      html=`<div class="result"><div class="emoji">✨</div><h3>Старт записан!</h3><p>${esc(name)}, сегодня ${fmt(val)} кг. Теперь есть от чего плясать 😏</p></div>`;
    } else {
      const diff=val-prev;
      if(diff<0){
        html=`<div class="confetti"></div><div class="result"><div class="medal">🏅</div><h3>КРАСИВАЯ СУЧКА</h3><div class="delta good">−${fmt(Math.abs(diff))} кг</div><p>${esc(name)}, вот это работа! 🔥</p></div>`;
      } else if(diff>0){
        html=`<div class="result"><img class="victoria-img" src="assets/viktoria.jpg" alt="Виктория"><div class="emoji">👀</div><div class="big-quote">«Та иди ты нах» 😂</div><div class="delta bad">+${fmt(diff)} кг</div><p>Виктория всё увидела.</p></div>`;
      } else {
        html=`<div class="result"><div class="emoji">😐</div><h3>Работаем усердней</h3><div class="delta">0,0 кг</div><p>Вес стоит. Завтра ждём минус 😏</p></div>`;
      }
    }
    $('modalContent').innerHTML=html; $('resultModal').classList.remove('hidden');
  }

  async function saveAlcohol(e){
    e.preventDefault(); const g=activeGirl(); if(!g) return;
    const drink=$('drinkInput').value.trim(); const ml=Number($('mlInput').value); if(!drink||!ml) return;
    const d=today(); const id=Date.now().toString(); const item={drink,ml,ts:Date.now()};
    try{
      await put(`girls/${state.activeId}/alcohol/${d}/${id}`,item);
      g.alcohol=g.alcohol||{}; g.alcohol[d]=g.alcohol[d]||{}; g.alcohol[d][id]=item;
      $('drinkInput').value=''; $('mlInput').value=''; renderRankings(); toast(`Записано: ${ml} мл. Барная бухгалтерия довольна 😂`);
    }catch(err){ toast('Не удалось сохранить алкоголь.'); }
  }

  function renderRankings(){
    const start=monday(), end=new Date(start); end.setDate(end.getDate()+6);
    $('weekLabel').textContent=`${fmtDate(start)} — ${fmtDate(end)}`;
    const s=dateKey(start), e=dateKey(end);
    const wr=[], ar=[];
    for(const [id,g] of Object.entries(state.girls)){
      const weights=g.weights||{}; const wk=Object.keys(weights).filter(k=>k>=s&&k<=e).sort();
      if(wk.length){ const first=Number(weights[wk[0]]), last=Number(weights[wk[wk.length-1]]), delta=last-first; wr.push({name:g.name,delta,first,last,count:wk.length}); }
      let total=0, drinks=0; const alc=g.alcohol||{};
      Object.keys(alc).filter(k=>k>=s&&k<=e).forEach(k=>Object.values(alc[k]||{}).forEach(it=>{total+=Number(it.ml||0);drinks++;}));
      if(total>0) ar.push({name:g.name,total,drinks});
    }
    wr.sort((a,b)=>a.delta-b.delta);
    $('weightRanking').classList.toggle('empty',!wr.length);
    $('weightRanking').innerHTML=wr.length?wr.map((r,i)=>`<div class="rank-row"><div class="rank-pos">${i===0?'👑':i+1}</div><div><div class="rank-name">${esc(r.name)}</div><div class="rank-sub">${fmt(r.first)} → ${fmt(r.last)} кг · записей: ${r.count}</div></div><div class="rank-score ${r.delta<0?'good':r.delta>0?'bad':''}">${r.delta>0?'+':''}${fmt(r.delta)} кг</div></div>`).join(''):'Пока нет данных этой недели.';
    ar.sort((a,b)=>b.total-a.total);
    $('alcoholRanking').classList.toggle('empty',!ar.length);
    $('alcoholRanking').innerHTML=ar.length?ar.map((r,i)=>`<div class="rank-row"><div class="rank-pos">${i===0?'🍾':i+1}</div><div><div class="rank-name">${esc(r.name)}</div><div class="rank-sub">записей: ${r.drinks}</div></div><div class="rank-score">${Math.round(r.total)} мл</div></div>`).join(''):'Пока все приличные 😇';
  }

  function renderAttendance(){
    const d=today(); const rows=Object.values(state.girls).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));
    const el=$('attendance'); el.classList.toggle('empty',!rows.length);
    el.innerHTML=rows.length?rows.map(g=>{ const has=g.weights&&g.weights[d]!=null; return `<div class="att-row"><div class="att-name">${esc(g.name)}</div><div class="att-status ${has?'done':'miss'}">${has?`✅ ${fmt(g.weights[d])} кг`:'Работаем усердней 😏'}</div></div>`; }).join(''):'Добавьте участниц.';
  }

  $('girlSelect').addEventListener('change',e=>{ state.activeId=e.target.value; localStorage.setItem('ou_active_girl',state.activeId); renderActive(); });
  $('addGirlBtn').addEventListener('click',addGirl);
  $('weightForm').addEventListener('submit',saveWeight);
  $('alcoholForm').addEventListener('submit',saveAlcohol);
  document.querySelectorAll('[data-close]').forEach(x=>x.addEventListener('click',()=>$('resultModal').classList.add('hidden')));

  loadAll();
  setInterval(loadAll,30000);
})();
