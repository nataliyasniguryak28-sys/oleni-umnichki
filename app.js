const BASE=(window.DATABASE_URL||"").replace(/\/+$/,"");
const $=id=>document.getElementById(id);
let girls={},active=localStorage.getItem("girl")||"";

const today=()=>new Date().toLocaleDateString("sv-SE");
const fmt=n=>Number(n).toFixed(1).replace(".",",");

async function db(path,opt={}){
  const r=await fetch(`${BASE}/${path}.json`,{
    headers:{"Content-Type":"application/json"},...opt
  });
  if(!r.ok)throw Error(r.status);
  return r.json();
}
const put=(p,v)=>db(p,{method:"PUT",body:JSON.stringify(v)});

function toast(t){
  const e=$("toast");
  e.textContent=t;
  e.classList.add("show");
  setTimeout(()=>e.classList.remove("show"),2500);
}

function draw(){
  const s=$("girlSelect");
  s.innerHTML='<option value="">Выбери своё имя</option>'+
    Object.entries(girls).map(([id,g])=>
      `<option value="${id}">${g.name||id}</option>`).join("");
  s.value=active;
  showGirl();
  ranking();
  attendance();
}

function showGirl(){
  const g=girls[active];
  if(!g){
    $("activeGirlLine").classList.add("hidden");
    return;
  }

  $("activeGirlLine").classList.remove("hidden");
  $("activeGirl").textContent=g.name;

  const w=g.weights||{};
  const keys=Object.keys(w).sort();
  const last=keys[keys.length-1];

  $("weightHint").textContent=last
    ?`Последняя запись: ${fmt(w[last])} кг`
    :"Это будет первая запись";

  $("todayWeight").textContent=w[today()]!=null
    ?`Сегодня: ${fmt(w[today()])} кг`
    :"Сегодня вес ещё не записан";
}

async function load(){
  try{
    girls=await db("girls")||{};
    $("connectionBadge").textContent="🟢 Общая база подключена";
    $("connectionBadge").className="badge ok";
    draw();
  }catch(e){
    $("connectionBadge").textContent="⚠️ Нет связи с общей базой";
    $("connectionBadge").className="badge err";
  }
}

$("girlSelect").onchange=e=>{
  active=e.target.value;
  localStorage.setItem("girl",active);
  showGirl();
};

$("addGirlBtn").onclick=async()=>{
  const name=prompt("Имя участницы?");
  if(!name)return;

  const id="g"+Date.now();
  const g={name:name.trim(),weights:{},alcohol:{}};

  await put(`girls/${id}`,g);
  girls[id]=g;
  active=id;
  localStorage.setItem("girl",id);
  draw();
};

$("weightForm").onsubmit=async e=>{
  e.preventDefault();
  const g=girls[active];
  if(!g)return toast("Сначала выбери себя");

  const v=Number($("weightInput").value.replace(",","."));
  if(!v)return;

  const d=today();
  const w=g.weights||{};
  const prev=Object.keys(w).filter(x=>x<d).sort().pop();
  const old=prev?Number(w[prev]):null;

  await put(`girls/${active}/weights/${d}`,v);
  g.weights=g.weights||{};
  g.weights[d]=v;
  $("weightInput").value="";
  draw();

  let h;
  if(old===null){
    h=`<div class="emoji">⚖️</div><h3>Старт записан!</h3>
       <p>${fmt(v)} кг</p>`;
  }else if(v<old){
    h=`<div class="medal">🏅</div>
       <h2>КРАСИВАЯ СУЧКА</h2>
       <p>Минус ${fmt(old-v)} кг 🎉</p>`;
  }else if(v>old){
    h=`<div class="emoji">👀</div>
       <h2>Та иди ты нах 😂</h2>
       <p>Плюс ${fmt(v-old)} кг</p>`;
  }else{
    h=`<div class="emoji">😐</div>
       <h2>Работаем усердней</h2>
       <p>Вес без изменений</p>`;
  }

  $("modalContent").innerHTML=h;
  $("resultModal").classList.remove("hidden");
};

$("alcoholForm").onsubmit=async e=>{
  e.preventDefault();
  const g=girls[active];
  if(!g)return toast("Сначала выбери себя");

  const drink=$("drinkInput").value.trim();
  const ml=Number($("mlInput").value);
  if(!drink||!ml)return;

  const d=today(),id=Date.now();
  const item={drink,ml};

  await put(`girls/${active}/alcohol/${d}/${id}`,item);

  g.alcohol=g.alcohol||{};
  g.alcohol[d]=g.alcohol[d]||{};
  g.alcohol[d][id]=item;

  $("drinkInput").value="";
  $("mlInput").value="";
  ranking();
  toast(`Записано ${ml} мл 😂`);
};

function week(){
  const x=new Date(),day=x.getDay()||7;
  x.setHours(0,0,0,0);
  x.setDate(x.getDate()-day+1);
  const y=new Date(x);
  y.setDate(y.getDate()+6);
  return[
    x.toLocaleDateString("sv-SE"),
    y.toLocaleDateString("sv-SE")
  ];
}

function ranking(){
  const [a,b]=week();
  $("weekLabel").textContent=`${a} — ${b}`;

  let wr=[],ar=[];

  Object.values(girls).forEach(g=>{
    const w=g.weights||{};
    const k=Object.keys(w).filter(d=>d>=a&&d<=b).sort();

    if(k.length>1)
      wr.push({
        name:g.name,
        diff:Number(w[k[k.length-1]])-Number(w[k[0]])
      });

    let ml=0;
    const al=g.alcohol||{};

    Object.keys(al).filter(d=>d>=a&&d<=b).forEach(d=>
      Object.values(al[d]||{}).forEach(x=>ml+=Number(x.ml||0))
    );

    if(ml)ar.push({name:g.name,ml});
  });

  wr.sort((x,y)=>x.diff-y.diff);
  ar.sort((x,y)=>y.ml-x.ml);

  $("weightRanking").innerHTML=wr.length
    ?wr.map((x,i)=>`<div class="rank-row">
       ${i===0?"👑":i+1+"."} <b>${x.name}</b> —
       ${x.diff>0?"+":""}${fmt(x.diff)} кг</div>`).join("")
    :'<div class="empty">Пока нет результатов</div>';

  $("alcoholRanking").innerHTML=ar.length
    ?ar.map((x,i)=>`<div class="rank-row">
       ${i===0?"🍾👑":i+1+"."} <b>${x.name}</b> —
       ${x.ml} мл</div>`).join("")
    :'<div class="empty">Пока все приличные 😇</div>';
}

function attendance(){
  const d=today();

  $("attendance").innerHTML=Object.values(girls).map(g=>{
    const w=g.weights||{};
    return `<div class="att-row">
      ${w[d]!=null?"✅":"👀"} <b>${g.name}</b> —
      ${w[d]!=null?fmt(w[d])+" кг":"Работаем усердней — вес не внесён"}
    </div>`;
  }).join("");
}

document.querySelectorAll("[data-close]").forEach(b=>
  b.onclick=()=>$("resultModal").classList.add("hidden")
);

load();
setInterval(load,30000);
