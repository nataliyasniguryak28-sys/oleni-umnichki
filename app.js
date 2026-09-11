(() => {
  const BASE = (window.DATABASE_URL || '').replace(/\/+$/, '');
  const $ = id => document.getElementById(id);

  const DEFAULT_GIRLS = ['Римма','Вика','Яна','Наташа','Оля','Люда','Валюшка','Таня'];

  const VICTORIA_IMG = "girl.jpg";

  const PLUS_PHRASES = [
    "Работаем, жирная жопа",
    "Сколько можно жрать",
    "Посрать не пробовала",
    "Твой вес больше твоего желания похудеть",
    "Скоро будешь в двери боком входить",
    "Нихуя ты нажрала",
    "Та ну нах"
  ];

  const MINUS_PHRASES = [
    "Всем сучкам назло ушла в минус",
    "Королева красоты",
    "Ты лучшая и все это знают",
    "Унитаз тебе вчера пошёл на пользу",
    "Нихуя себе ты дала жару",
    "Ещё чуть-чуть — и ты у цели",
    "Я в шоке, отправляю тебе чмоки 💋"
  ];

  function phraseOfDay(list, name, date=today()){
    const seed = Array.from(`${date}|${name}`).reduce((a,c)=>((a*31)+c.charCodeAt(0))>>>0,7);
    return list[seed % list.length];
  }

  const state = {
    girls: {},
    activeId: localStorage.getItem('ou_active_girl') || ''
  };

  const esc = (s='') => String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  const slug = (s) => {
    const base = String(s).trim().toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu,'-')
      .replace(/^-+|-+$/g,'');
    return base || ('girl-' + Math.random().toString(36).slice(2,8));
  };

  const today = () => new Date().toLocaleDateString('sv-SE');

  const monday = (d = new Date()) => {
    const x = new Date(d);
    const day = x.getDay() || 7;
    x.setHours(0,0,0,0);
    x.setDate(x.getDate() - day + 1);
    return x;
  };

  const dateKey = d => d.toLocaleDateString('sv-SE');
  const fmt = n => Number(n).toFixed(1).replace('.', ',');
  const fmtDate = d => new Intl.DateTimeFormat('ru-RU', {
    day:'2-digit', month:'2-digit'
  }).format(d);

  async function api(path, options={}) {
    if (!BASE) throw new Error('Нет DATABASE_URL');
    const res = await fetch(`${BASE}/${path}.json`, {
      headers:{'Content-Type':'application/json'},
      ...options
    });
    if (!res.ok) throw new Error(`Firebase: ${res.status}`);
    return res.json();
  }

  const put = (path, data) => api(path, {
    method:'PUT',
    body:JSON.stringify(data)
  });

  function toast(msg){
    const el = $('toast');
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function setConn(ok, msg){
    const el = $('connectionBadge');
    if(!el) return;
    el.textContent = msg;
    el.className = 'badge ' + (ok ? 'ok' : 'err');
  }

  function activeGirl(){
    return state.activeId && state.girls[state.activeId]
      ? state.girls[state.activeId]
      : null;
  }

  async function ensureDefaultGirls(){
    if (Object.keys(state.girls).length) return;

    for (const name of DEFAULT_GIRLS){
      const id = slug(name);
      state.girls[id] = {
        name,
        createdAt: Date.now(),
        weights: {},
        alcohol: {}
      };
      await put(`girls/${id}`, state.girls[id]);
    }
  }

  async function loadAll(){
    try{
      const data = await api('girls');
      state.girls = data || {};

      await ensureDefaultGirls();

      setConn(true, '🟢 Общая база подключена');
      renderAll();
    }catch(e){
      console.error(e);
      setConn(false, '⚠️ Нет связи с общей базой');
      toast('Не удалось подключиться к Firebase');
    }
  }

  function renderAll(){
    renderSelect();
    renderActive();
    renderRankings();
    renderAttendance();
  }

  function renderSelect(){
    const sel = $('girlSelect');
    if(!sel) return;

    const entries = Object.entries(state.girls)
      .sort((a,b) => (a[1].name||'').localeCompare(b[1].name||'','ru'));

    sel.innerHTML =
      '<option value="">Выбери своё имя</option>' +
      entries.map(([id,g]) =>
        `<option value="${esc(id)}">${esc(g.name || id)}</option>`
      ).join('');

    if (state.activeId && state.girls[state.activeId]){
      sel.value = state.activeId;
    }
  }

  function renderActive(){
    const g = activeGirl();
    const line = $('activeGirlLine');
    const hint = $('weightHint');
    const tw = $('todayWeight');
    if(!line || !hint || !tw) return;

    if(!g){
      line.classList.add('hidden');
      return;
    }

    line.classList.remove('hidden');
    $('activeGirl').textContent = g.name || '';

    const weights = g.weights || {};
    const keys = Object.keys(weights).sort();
    const lastKey = keys[keys.length - 1];

    hint.textContent = lastKey
      ? `Последняя запись: ${fmt(weights[lastKey])} кг`
      : 'Это будет твоя первая запись веса';

    if(weights[today()] != null){
      tw.textContent = `Сегодня уже записано: ${fmt(weights[today()])} кг`;
    } else {
      tw.textContent = 'Сегодня вес ещё не записан';
    }
  }

  async function addGirl(){
    const name = prompt('Как зовут участницу?');
    if(!name || !name.trim()) return;

    let id = slug(name);
    while(state.girls[id]) id += '-' + Math.random().toString(36).slice(2,5);

    const girl = {
      name:name.trim(),
      createdAt:Date.now(),
      weights:{},
      alcohol:{}
    };

    try{
      await put(`girls/${id}`, girl);
      state.girls[id] = girl;
      state.activeId = id;
      localStorage.setItem('ou_active_girl', id);
      renderAll();
      toast('Участница добавлена');
    }catch(e){
      console.error(e);
      toast('Не удалось добавить участницу');
    }
  }

  function previousWeight(g, beforeDate){
    const w = g.weights || {};
    const keys = Object.keys(w)
      .filter(k => k < beforeDate)
      .sort();

    if(!keys.length) return null;
    return Number(w[keys[keys.length - 1]]);
  }

  async function saveWeight(e){
    e.preventDefault();

    const g = activeGirl();
    if(!g){
      toast('Сначала выбери своё имя');
      return;
    }

    const raw = String($('weightInput').value).replace(',','.');
    const val = Number(raw);
    if(!val || val < 30 || val > 250){
      toast('Проверь вес');
      return;
    }

    const d = today();
    const prev = previousWeight(g, d);

    try{
      await put(`girls/${state.activeId}/weights/${d}`, val);

      g.weights = g.weights || {};
      g.weights[d] = val;

      $('weightInput').value = '';
      renderAll();
      showWeightResult(g.name, val, prev);
    }catch(err){
      console.error(err);
      toast('Вес не сохранился');
    }
  }

  function showWeightResult(name, val, prev){
    let html = '';

    if(prev == null){
      html = `
        <div class="result">
          <div class="emoji">⚖️</div>
          <h3>Старт записан!</h3>
          <p>${esc(name)}, сегодня ${fmt(val)} кг.</p>
        </div>`;
    } else {
      const diff = val - prev;

      if(diff < 0){
        const phrase = phraseOfDay(MINUS_PHRASES, name);
        html = `
          <div class="result">
            <div class="speech">${esc(phrase)}</div>
            <div class="character-wrap">
              <div class="fireworks"><span>🎆</span><span>✨</span><span>🎇</span><span>💥</span></div>
              <img class="victoria-img" src="${VICTORIA_IMG}" alt="Фото">
            </div>
            <div class="medal">🏅</div>
            <h3>КРАСИВАЯ СУЧКА</h3>
            <p>Минус ${fmt(Math.abs(diff))} кг 😎</p>
          </div>`;
      } else if(diff > 0){
        const phrase = phraseOfDay(PLUS_PHRASES, name);
        html = `
          <div class="result">
            <div class="speech">${esc(phrase)}</div>
            <div class="character-wrap">
              <img class="victoria-img fainting" src="${VICTORIA_IMG}" alt="Фото">
            </div>
            <div class="emoji">😵‍💫</div>
            <p>Плюс ${fmt(diff)} кг.</p>
          </div>`;
      } else {
        html = `
          <div class="result">
            <div class="emoji">😐</div>
            <h3>Работаем усердней</h3>
            <p>Вес без изменений: ${fmt(val)} кг.</p>
          </div>`;
      }
    }

    $('modalContent').innerHTML = html;
    $('resultModal').classList.remove('hidden');
  }

  async function saveAlcohol(e){
    e.preventDefault();

    const g = activeGirl();
    if(!g){
      toast('Сначала выбери своё имя');
      return;
    }

    const drink = $('drinkInput').value.trim();
    const ml = Number($('mlInput').value);

    if(!drink || !ml || ml < 1){
      toast('Заполни напиток и мл');
      return;
    }

    const d = today();
    const id = Date.now().toString();
    const item = {drink, ml, ts:Date.now()};

    try{
      await put(`girls/${state.activeId}/alcohol/${d}/${id}`, item);

      g.alcohol = g.alcohol || {};
      g.alcohol[d] = g.alcohol[d] || {};
      g.alcohol[d][id] = item;

      $('drinkInput').value = '';
      $('mlInput').value = '';

      renderRankings();
      toast(`Записано: ${ml} мл. Барная бухгалтерия 😂`);
    }catch(err){
      console.error(err);
      toast('Не удалось сохранить алкоголь');
    }
  }

  function renderRankings(){
    const start = monday();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    $('weekLabel').textContent = `${fmtDate(start)} — ${fmtDate(end)}`;

    const s = dateKey(start);
    const e = dateKey(end);
    const wr = [];
    const ar = [];

    for(const [,g] of Object.entries(state.girls)){
      const weights = g.weights || {};
      const wk = Object.keys(weights)
        .filter(k => k >= s && k <= e)
        .sort();

      if(wk.length){
        const first = Number(weights[wk[0]]);
        const last = Number(weights[wk[wk.length - 1]]);
        wr.push({
          name:g.name,
          delta:last-first,
          records:wk.length
        });
      }

      let total = 0;
      let drinks = 0;
      const alc = g.alcohol || {};

      Object.keys(alc)
        .filter(k => k >= s && k <= e)
        .forEach(k => {
          Object.values(alc[k] || {}).forEach(it => {
            total += Number(it.ml || 0);
            drinks += 1;
          });
        });

      if(total > 0){
        ar.push({name:g.name,total,drinks});
      }
    }

    wr.sort((a,b) => a.delta - b.delta);
    ar.sort((a,b) => b.total - a.total);

    $('weightRanking').innerHTML = wr.length
      ? wr.map((r,i) => `
          <div class="rank-row">
            <span class="rank-pos">${i===0?'👑':(i+1)+'.'}</span>
            <b>${esc(r.name)}</b>
            — ${r.delta < 0 ? '−' : r.delta > 0 ? '+' : ''}${fmt(Math.abs(r.delta))} кг
          </div>`).join('')
      : '<div class="empty">Пока нет записей веса за эту неделю</div>';

    $('alcoholRanking').innerHTML = ar.length
      ? ar.map((r,i) => `
          <div class="rank-row">
            <span class="rank-pos">${i===0?'🍾👑':(i+1)+'.'}</span>
            <b>${esc(r.name)}</b>
            — ${Math.round(r.total)} мл
          </div>`).join('')
      : '<div class="empty">На этой неделе пока все приличные 😇</div>';
  }

  function renderAttendance(){
    const d = today();

    const rows = Object.values(state.girls)
      .sort((a,b) => (a.name||'').localeCompare(b.name||'','ru'))
      .map(g => {
        const has = g.weights && g.weights[d] != null;
        return `
          <div class="att-row">
            ${has ? '✅' : '👀'}
            <b>${esc(g.name || '')}</b>
            — ${has ? `${fmt(g.weights[d])} кг` : 'Работаем усердней — вес не внесён'}
          </div>`;
      });

    $('attendance').innerHTML = rows.join('');
  }

  $('girlSelect').addEventListener('change', e => {
    state.activeId = e.target.value;
    localStorage.setItem('ou_active_girl', state.activeId);
    renderActive();
  });

  $('addGirlBtn').addEventListener('click', addGirl);
  $('weightForm').addEventListener('submit', saveWeight);
  $('alcoholForm').addEventListener('submit', saveAlcohol);

  document.querySelectorAll('[data-close]').forEach(x => {
    x.addEventListener('click', () => $('resultModal').classList.add('hidden'));
  });

  $('resultModal').addEventListener('click', e => {
    if(e.target === $('resultModal')) $('resultModal').classList.add('hidden');
  });

  loadAll();
  setInterval(loadAll, 30000);
})();

