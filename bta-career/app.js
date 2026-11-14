
(() => {
  "use strict";
  const D = window.BTA_DATA || {};
  const KEY = "btaCareerStateV1";
  const SNAP_KEY = "btaCareerSnapshotsV1";
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const $ = (s, root=document) => root.querySelector(s);
  const uid = (p="id") => p + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,8);
  const num = v => Number(v || 0);
  const clamp = (n,a=0,b=100) => Math.min(b, Math.max(a,n));
  const esc = s => String(s ?? "").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const fmtMoney = (n,c="€") => !n ? "—" : new Intl.NumberFormat("tr-TR",{maximumFractionDigits:1}).format(n) + " " + c;
  const fmtInt = n => new Intl.NumberFormat("tr-TR").format(num(n));
  const today = () => new Date().toISOString().slice(0,10);

  const fresh = () => ({
    version: 1,
    activePlayer: null,
    activeManager: null,
    archives: { player: [], manager: [] },
    customClubs: [],
    customRecords: { player: [], manager: [] },
    settings: { managerObjectives: true },
    lastSaved: null
  });

  let state = load();
  let view = "home";
  let tab = "overview";
  let recordFilter = { scope:"player", category:"all", search:"" };

  function load(){
    try{
      const x = JSON.parse(localStorage.getItem(KEY) || "null");
      if(x && x.version === 1) return {...fresh(), ...x, archives:{player:x.archives?.player||[],manager:x.archives?.manager||[]}, customRecords:{player:x.customRecords?.player||[],manager:x.customRecords?.manager||[]}};
    }catch(e){}
    return fresh();
  }

  function save(reason="Güncellendi"){
    state.lastSaved = new Date().toISOString();
    try{
      localStorage.setItem(KEY, JSON.stringify(state));
      dailySnapshot();
      renderSavePill(reason);
    }catch(e){
      toast("Kayıt alanı doldu. Fotoğraf boyutunu küçült veya JSON yedeği al.", "err");
    }
  }

  function dailySnapshot(){
    const arr = getSnapshots();
    if(!arr.length || arr[0].date !== today()){
      const snap = {id:uid("snap"), date:today(), createdAt:new Date().toISOString(), state:JSON.parse(JSON.stringify(state))};
      arr.unshift(snap); arr.splice(8);
      try{ localStorage.setItem(SNAP_KEY, JSON.stringify(arr)); }catch(e){}
    }
  }
  function getSnapshots(){ try{return JSON.parse(localStorage.getItem(SNAP_KEY)||"[]")}catch(e){return[]} }

  function renderSavePill(text){
    const el = $("#savePill");
    if(el){ el.className="save-pill ok"; el.textContent = text + " · " + new Date().toLocaleTimeString("tr-TR",{hour:"2-digit",minute:"2-digit"}); }
  }

  function toast(msg,type="ok"){
    const z=$("#toast"); if(!z)return;
    const t=document.createElement("div"); t.className="toast "+type; t.textContent=msg; z.appendChild(t);
    setTimeout(()=>t.remove(),3200);
  }

  function modal(title, body, onOpen){
    const m=$("#modal");
    m.innerHTML = '<div class="modal"><div class="modal-head"><h2>'+esc(title)+'</h2><button class="icon-btn modal-close" data-close>✕</button></div><div class="modal-body">'+body+'</div></div>';
    m.classList.add("open"); m.setAttribute("aria-hidden","false");
    $$("[data-close]",m).forEach(b=>b.onclick=closeModal);
    if(onOpen) onOpen(m);
  }
  function closeModal(){ const m=$("#modal"); m.classList.remove("open");m.setAttribute("aria-hidden","true");setTimeout(()=>m.innerHTML="",180); }

  function allClubs(){
    return [...(D.clubs||[]), ...(state.customClubs||[])];
  }
  function clubById(id){ return allClubs().find(c=>c.id===id) || null; }
  function clubName(id,fallback="Bilinmeyen Kulüp"){ return clubById(id)?.name || fallback; }
  function findClubByName(name){
    const n=(name||"").trim().toLowerCase();
    return allClubs().find(c=>c.name.toLowerCase()===n) || allClubs().find(c=>c.name.toLowerCase().includes(n));
  }
  function clubOptions(selected=""){
    return allClubs().slice().sort((a,b)=>a.name.localeCompare(b.name,"tr")).map(c=>'<option value="'+esc(c.id)+'" '+(c.id===selected?"selected":"")+'>'+esc(c.name)+' — '+esc(c.country)+'</option>').join("");
  }
  function trophyOptions(selected=""){
    return (D.trophies||[]).map(t=>'<option value="'+esc(t.id)+'" '+(t.id===selected?"selected":"")+'>'+esc(t.name)+' · '+esc(t.country||t.region||"")+'</option>').join("");
  }
  function awardOptions(selected=""){
    return (D.awards||[]).map(a=>'<option value="'+esc(a.id)+'" '+(a.id===selected?"selected":"")+'>'+esc(a.name)+'</option>').join("");
  }

  function topbar(){
    return '<div class="topbar"><div class="topbar-inner">'+
      '<div class="brand" data-nav="home"><div class="brandmark">BTA</div><div><div class="brandtext">BTA <span>KARİYER TAKİBİ</span></div><div class="subbrand">FC 27 Kariyer Müzesi</div></div></div>'+
      '<div class="top-actions"><div id="savePill" class="save-pill ok">Otomatik kayıt açık</div>'+
      '<button class="icon-btn" data-nav="archive" title="Efsaneler Arşivi">🏛️ <span class="btn-label">Arşiv</span></button>'+
      '<button class="icon-btn" data-nav="settings" title="Veri ve Ayarlar">⚙️ <span class="btn-label">Ayarlar</span></button></div></div></div>';
  }

  function footer(){ return '<div class="footer-note">BTA KARİYER TAKİBİ · Veriler bu cihazdaki tarayıcıda saklanır. Düzenli JSON yedeği alman önerilir.</div>'; }

  function app(){
    $("#app").innerHTML = topbar() + '<div class="shell" id="content"></div>';
    bindGlobal();
    render();
  }

  function bindGlobal(){
    $$("[data-nav]").forEach(el=>el.onclick=()=>{ view=el.dataset.nav; tab="overview"; render(); });
    $("#modal").onclick=e=>{ if(e.target.id==="modal") closeModal(); };
  }

  function render(){
    const c=$("#content");
    if(view==="home") c.innerHTML=home();
    else if(view==="player") c.innerHTML=state.activePlayer?playerPage():home();
    else if(view==="manager") c.innerHTML=state.activeManager?managerPage():home();
    else if(view==="archive") c.innerHTML=archivePage();
    else if(view==="settings") c.innerHTML=settingsPage();
    c.innerHTML += footer();
    bindView();
    renderSavePill(state.lastSaved ? "Kaydedildi" : "Otomatik kayıt açık");
    window.scrollTo({top:0,behavior:"instant"});
  }

  function home(){
    const p=state.activePlayer, m=state.activeManager;
    return '<section class="hero"><div class="eyebrow">🏆 KENDİ FUTBOL TARİHİNİ YAZ</div>'+
      '<h1>Kariyerin geçip gitmesin. <em>Mirasını kaydet.</em></h1>'+
      '<p>Oyuncu veya teknik direktör olarak her sezonunu, transferlerini, kupalarını, rekorlarını ve yükselişini tek yerde tut. Yıllar sonra dönüp baktığında sadece skorları değil, bütün hikâyeyi gör.</p>'+
      '<div class="hero-statline"><span class="mini-chip">'+fmtInt(D.clubs?.length)+' kulüp</span><span class="mini-chip">'+fmtInt(D.playerRecords?.length)+' oyuncu rekoru</span><span class="mini-chip">'+fmtInt(D.managerRecords?.length)+' teknik direktör rekoru</span><span class="mini-chip">'+fmtInt(D.trophies?.length)+' kupa</span><span class="mini-chip">Ücretsiz · Local-first</span></div></section>'+
      '<div class="mode-grid">'+modeCard("player",p)+modeCard("manager",m)+'</div>'+
      '<section class="section"><div class="section-title"><div><h2>Efsaneler Arşivi</h2><p>Emekli ettiğin kariyerler burada ömür boyu kalır.</p></div><button class="btn ghost" data-nav="archive">Arşivi Aç →</button></div>'+
      '<div class="quick-grid">'+
      stat("Oyuncu Arşivi",state.archives.player.length,"tamamlanmış kariyer")+
      stat("Hoca Arşivi",state.archives.manager.length,"tamamlanmış kariyer")+
      stat("Aktif Kariyer",(p?1:0)+(m?1:0),"en fazla 2")+
      stat("Kayıt Sistemi","Açık","bu cihazda kalıcı")+'</div></section>';
  }

  function modeCard(type,career){
    const player=type==="player";
    const title=player?"OYUNCU KARİYERİ":"TEKNİK DİREKTÖR KARİYERİ";
    const icon=player?"⚽":"🧠";
    const txt=player?"Gol, asist, OVR, piyasa değeri, kupalar, bireysel ödüller ve efsane rekorları.":"Kulüp yönetimi, transfer kârı, akademi, menajer OVR, itibar ve dünya rekorları.";
    const current=career ? (player?clubName(career.currentClubId):clubName(career.currentClubId)) : "";
    return '<article class="mode-card"><div class="mode-icon">'+icon+'</div><h2>'+title+'</h2><p>'+txt+'</p><div class="mode-meta"><div class="mode-status">'+
      (career?'<strong>'+esc(career.profile.firstName+" "+career.profile.lastName)+'</strong>'+esc(current)+' · '+esc(career.currentSeason||career.profile.startSeason):
      '<strong>Henüz kariyer yok</strong>Tek aktif kariyer hakkı')+
      '</div><button class="btn primary" data-mode="'+type+'">'+(career?"Kaldığın Yerden Devam Et":"Yeni Kariyer Oluştur")+'</button></div></article>';
  }

  function stat(label,val,sub=""){ return '<div class="stat-card"><div class="stat-label">'+esc(label)+'</div><div class="stat-value">'+esc(val)+'</div><div class="stat-sub">'+esc(sub)+'</div></div>'; }

  function bindView(){
    $$("[data-nav]").forEach(el=>el.onclick=()=>{view=el.dataset.nav;tab="overview";render();});
    $$("[data-mode]").forEach(b=>b.onclick=()=>openMode(b.dataset.mode));
    $$("[data-tab]").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();});
    const back=$("#backHome"); if(back)back.onclick=()=>{view="home";render()};
    bindPlayerActions(); bindManagerActions(); bindArchiveActions(); bindSettingsActions();
  }

  function openMode(type){
    const career=type==="player"?state.activePlayer:state.activeManager;
    if(career){ view=type; tab="overview"; render(); return; }
    type==="player" ? newPlayerModal() : newManagerModal();
  }

  function photoField(id="photo"){
    return '<div class="field span2"><label>Fotoğraf (isteğe bağlı, cihazında saklanır)</label><input class="input" id="'+id+'" type="file" accept="image/*"><div class="hint">Çok büyük fotoğraf seçme; 1.5 MB altı ideal.</div></div>';
  }

  function newPlayerModal(){
    modal("Yeni Oyuncu Kariyeri",
      '<form id="playerCreate"><div class="form-grid">'+
      field("Ad","firstName","text","Bekir",true)+field("Soyad","lastName","text","Aksekili",true)+
      field("Doğum Tarihi","birthDate","date","",false)+field("Uyruk","nationality","text","Türkiye",true)+
      '<div class="field"><label>Mevki</label><select class="select" name="position">'+["ST","CF","LW","RW","CAM","CM","CDM","LB","RB","CB","GK"].map(x=>'<option>'+x+'</option>').join("")+'</select></div>'+
      field("Forma No","shirtNo","number","10",false)+
      field("Başlangıç Sezonu","startSeason","text","2026/27",true)+
      '<div class="field"><label>Başlangıç Kulübü</label><select class="select" name="clubId" required>'+clubOptions("tr-galatasaray")+'</select></div>'+
      field("Başlangıç OVR","ovr","number","70",true)+field("Piyasa Değeri (milyon €)","market","number","5",false)+
      '<div class="field span2"><label>Kişilik</label><select class="select" name="personality"><option>Takımın Kalbi</option><option>Başı Buyruk</option><option>Virtüöz</option></select></div>'+
      photoField()+'</div><div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Kariyeri Başlat</button></div></form>',
      m=>{
        $("#playerCreate",m).onsubmit=async e=>{
          e.preventDefault(); const f=new FormData(e.currentTarget);
          const photo=await readPhoto($("#photo",m));
          state.activePlayer={
            id:uid("pc"),status:"active",createdAt:new Date().toISOString(),profile:{
              firstName:f.get("firstName"),lastName:f.get("lastName"),birthDate:f.get("birthDate"),nationality:f.get("nationality"),
              position:f.get("position"),shirtNo:num(f.get("shirtNo")),startSeason:f.get("startSeason"),personality:f.get("personality"),photo,
              startOvr:num(f.get("ovr")),startMarket:num(f.get("market"))
            },
            currentClubId:f.get("clubId"), currentSeason:f.get("startSeason"), currentOvr:num(f.get("ovr")), currentMarket:num(f.get("market")),
            seasons:[], transfers:[], trophyWins:[], awardWins:[], completedRecords:[], recordTargets:[], manualRecords:[],
            social:{fans:50,coach:50,teammates:50,sponsor:50,privateLife:50}, socialLog:[], decisions:[], contracts:[], offers:[],
            customBadges:[], createdStory:[], lastUpdated:new Date().toISOString()
          };
          save("Oyuncu kariyeri oluşturuldu"); closeModal(); view="player";tab="overview";render();
        };
      });
  }

  function newManagerModal(){
    modal("Yeni Teknik Direktör Kariyeri",
      '<form id="managerCreate"><div class="form-grid">'+
      field("Ad","firstName","text","Bekir",true)+field("Soyad","lastName","text","Aksekili",true)+
      field("Doğum Tarihi","birthDate","date","",false)+field("Uyruk","nationality","text","Türkiye",true)+
      field("Başlangıç Sezonu","startSeason","text","2026/27",true)+
      '<div class="field"><label>Başlangıç Kulübü</label><select class="select" name="clubId" required>'+clubOptions("tr-corum-fk")+'</select></div>'+
      photoField()+'</div><div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Kariyeri Başlat</button></div></form>',
      m=>{
        $("#managerCreate",m).onsubmit=async e=>{
          e.preventDefault(); const f=new FormData(e.currentTarget), photo=await readPhoto($("#photo",m));
          state.activeManager={
            id:uid("mc"),status:"active",createdAt:new Date().toISOString(),profile:{firstName:f.get("firstName"),lastName:f.get("lastName"),birthDate:f.get("birthDate"),nationality:f.get("nationality"),startSeason:f.get("startSeason"),photo},
            currentClubId:f.get("clubId"),currentSeason:f.get("startSeason"),managerOvr:60,reputation:50,careerPoints:0,
            seasons:[],transfers:[],academy:[],squad:[],trophyWins:[],completedRecords:[],recordTargets:[],manualRecords:[],
            nationalJobs:[],favorites:[],legends:[],stints:[{clubId:f.get("clubId"),startSeason:f.get("startSeason"),endSeason:null}],
            generatedStories:[],lastUpdated:new Date().toISOString()
          };
          save("Teknik direktör kariyeri oluşturuldu");closeModal();view="manager";tab="overview";render();
        };
      });
  }

  function field(label,name,type="text",value="",req=false){
    return '<div class="field"><label>'+esc(label)+'</label><input class="input" name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'" '+(req?"required":"")+'></div>';
  }
  function readPhoto(input){
    return new Promise(resolve=>{
      const f=input?.files?.[0]; if(!f){resolve("");return;}
      if(f.size>1800000){toast("Fotoğraf 1.8 MB'den büyük. Daha küçük bir fotoğraf seç.", "err");resolve("");return;}
      const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>resolve("");r.readAsDataURL(f);
    });
  }

  function playerTotals(p=state.activePlayer){
    const t={apps:0,goals:0,assists:0,trophies:p?.trophyWins?.length||0,awards:p?.awardWins?.length||0,leagueGoals:0,continentalGoals:0,nationalGoals:0,seasons:p?.seasons?.length||0,clubs:1};
    const clubs=new Set([p?.currentClubId].filter(Boolean));
    (p?.seasons||[]).forEach(s=>(s.competitions||[]).forEach(c=>{
      t.apps+=num(c.apps);t.goals+=num(c.goals);t.assists+=num(c.assists);
      const ty=(c.type||"").toLowerCase();
      if(ty==="lig")t.leagueGoals+=num(c.goals);
      if(ty==="avrupa")t.continentalGoals+=num(c.goals);
      if(ty==="milli")t.nationalGoals+=num(c.goals);
    }));
    (p?.transfers||[]).forEach(x=>{if(x.toClubId)clubs.add(x.toClubId)});
    t.clubs=clubs.size; return t;
  }

  function managerTotals(m=state.activeManager){
    const t={wins:0,draws:0,losses:0,gf:0,ga:0,points:0,trophies:m?.trophyWins?.length||0,seasons:m?.seasons?.length||0,leagueTitles:0,uclTitles:0,domesticCups:0,net:0,income:0,spend:0};
    (m?.seasons||[]).forEach(s=>{t.wins+=num(s.w);t.draws+=num(s.d);t.losses+=num(s.l);t.gf+=num(s.gf);t.ga+=num(s.ga);t.points+=num(s.points)});
    (m?.transfers||[]).forEach(x=>{t.spend+=num(x.buyFee);t.income+=num(x.sellFee)});
    t.net=t.income-t.spend;
    (m?.trophyWins||[]).forEach(w=>{
      const tr=(D.trophies||[]).find(x=>x.id===w.trophyId);
      if(tr?.category==="Lig")t.leagueTitles++;
      if(tr?.name?.includes("Şampiyonlar Ligi"))t.uclTitles++;
      if(tr?.category==="Kupa")t.domesticCups++;
    });
    return t;
  }

  function chart(points, labels, suffix=""){
    const vals=points.map(num); if(!vals.length)return '<div class="empty"><div class="big">📈</div>Henüz grafik verisi yok.</div>';
    const w=460,h=160,p=18,min=Math.min(...vals),max=Math.max(...vals),range=Math.max(1,max-min);
    const coords=vals.map((v,i)=>[p+(w-2*p)*(i/Math.max(1,vals.length-1)),h-p-(h-2*p)*((v-min)/range)]);
    const path=coords.map((c,i)=>(i?"L":"M")+c[0].toFixed(1)+" "+c[1].toFixed(1)).join(" ");
    return '<svg class="chart" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+
      [40,80,120].map(y=>'<line class="grid" x1="0" y1="'+y+'" x2="'+w+'" y2="'+y+'"/>').join("")+
      '<path class="line" d="'+path+'"/>'+coords.map((c,i)=>'<circle class="dot" cx="'+c[0]+'" cy="'+c[1]+'" r="4"/><text x="'+c[0]+'" y="'+(c[1]-9)+'" text-anchor="middle">'+esc(vals[i]+suffix)+'</text>').join("")+
      '</svg>';
  }

  function careerTabs(type){
    const player=type==="player";
    const tabs=player?[
      ["overview","Genel"],["seasons","Sezonlar"],["transfers","Transferler"],["trophies","Kupa Müzesi"],["records","Rekorlar"],["achievements","Başarılar"],["story","Hikâye"],["social","İtibar"],["legacy","Kariyer Mirası"]
    ]:[
      ["overview","Genel"],["seasons","Sezonlar"],["transfers","Transferler"],["academy","Akademi"],["stars","Yıldızlar"],["trophies","Kupa Müzesi"],["clubrecords","Kulüp Rekorları"],["records","Hoca Rekorları"],["national","Milli Takım"],["story","Hikâye"],["legacy","Kariyer Mirası"]
    ];
    return '<div class="tabs-wrap"><div class="tabs">'+tabs.map(x=>'<button class="tab '+(tab===x[0]?"active":"")+'" data-tab="'+x[0]+'">'+x[1]+'</button>').join("")+'</div></div>';
  }

  function playerPage(){
    const p=state.activePlayer,t=playerTotals(p),c=clubById(p.currentClubId);
    const profile='<div class="panel profile-card"><div class="profile-banner"></div><div class="profile-content"><div class="avatar-wrap">'+(p.profile.photo?'<img src="'+p.profile.photo+'" alt="">':esc((p.profile.firstName||"B")[0]+(p.profile.lastName||"T")[0]))+'</div>'+
      '<div class="profile-name">'+esc(p.profile.firstName+" "+p.profile.lastName)+'</div><div class="profile-line">'+esc(c?.name||"Kulüp")+' · '+esc(p.profile.position)+' · #'+esc(p.profile.shirtNo||"—")+'</div>'+
      '<div class="profile-tags"><span class="tag">⭐ '+esc(p.currentOvr)+' OVR</span><span class="tag">💶 '+fmtMoney(p.currentMarket,"M€")+'</span><span class="tag">'+esc(p.profile.personality)+'</span></div></div></div>';
    const points=[p.profile.startOvr,...p.seasons.map(s=>s.ovrEnd).filter(Boolean)];
    const mv=[p.profile.startMarket,...p.seasons.map(s=>s.marketEnd).filter(v=>v!==""&&v!=null)].map(num);
    const charts='<div class="chart-grid"><div class="panel chart-box"><div class="chart-head"><div class="chart-title">OVR Gelişimi</div><div class="chart-last">'+esc(p.currentOvr)+'</div></div>'+chart(points,p.seasons.map(s=>s.season))+'</div>'+
      '<div class="panel chart-box"><div class="chart-head"><div class="chart-title">Piyasa Değeri</div><div class="chart-last">'+fmtMoney(p.currentMarket,"M€")+'</div></div>'+chart(mv,[],"")+'</div></div>';
    let body='<button id="backHome" class="btn ghost sm">← Ana Sayfa</button><div class="career-head">'+profile+charts+'</div>'+careerTabs("player");
    body += playerTabContent(p,t);
    return body;
  }

  function playerTabContent(p,t){
    if(tab==="overview"){
      return '<div class="stat-grid">'+stat("Maç",fmtInt(t.apps))+stat("Gol",fmtInt(t.goals))+stat("Asist",fmtInt(t.assists))+stat("Kupa",fmtInt(t.trophies))+'</div>'+
      '<div class="two-col section"><div class="panel"><div class="section-title"><div><h3>Kariyer Hikâyesi</h3><p>Verilerine göre otomatik oluşan editoryal özet.</p></div></div>'+storyList(playerStories(p).slice(-4).reverse())+'</div>'+
      '<div class="panel"><h3>İlişkiler</h3>'+socialBars(p.social)+'</div></div>'+
      '<div class="section quick-grid">'+stat("Kulüp",t.clubs)+stat("Sezon",t.seasons)+stat("Bireysel Ödül",t.awards)+stat("Tamamlanan Rekor",p.completedRecords.length)+'</div>';
    }
    if(tab==="seasons") return playerSeasons(p);
    if(tab==="transfers") return playerTransfers(p);
    if(tab==="trophies") return trophyMuseum("player",p);
    if(tab==="records") return recordsPage("player",p);
    if(tab==="achievements") return playerAchievements(p,t);
    if(tab==="story") return '<div class="panel"><div class="section-title"><div><h2>Kariyer Hikâyem</h2><p>İstatistiklerin gerçek; bu metinler site tarafından otomatik oluşturulur.</p></div></div>'+storyList(playerStories(p))+'</div>';
    if(tab==="social") return playerSocial(p);
    if(tab==="legacy") return playerLegacy(p,t);
    return "";
  }

  function playerSeasons(p){
    return '<div class="section-title"><div><h2>Sezonlar</h2><p>Maç maç değil; sezon sonunda turnuva bazlı gir.</p></div><button class="btn primary" id="addPlayerSeason">+ Sezon Ekle</button></div>'+
      (p.seasons.length?'<div class="list">'+p.seasons.slice().reverse().map(s=>{
        const st=seasonTotals(s);
        return '<div class="list-row"><div class="list-main"><div class="list-title">'+esc(s.season)+' · '+esc(clubName(s.clubId))+'</div><div class="list-sub">'+st.apps+' maç · '+st.goals+' gol · '+st.assists+' asist · OVR '+esc(s.ovrStart||"—")+' → '+esc(s.ovrEnd||"—")+'</div></div><div class="list-actions"><button class="btn sm" data-edit-player-season="'+s.id+'">Düzenle</button><button class="btn danger sm" data-del-player-season="'+s.id+'">Sil</button></div></div>';
      }).join("")+'</div>':'<div class="empty"><div class="big">📅</div>İlk sezonunu bitirdiğinde buraya ekle.</div>');
  }
  function seasonTotals(s){ return (s.competitions||[]).reduce((a,c)=>({apps:a.apps+num(c.apps),goals:a.goals+num(c.goals),assists:a.assists+num(c.assists)}),{apps:0,goals:0,assists:0}); }

  function playerSeasonModal(existing=null){
    const p=state.activePlayer, s=existing||{};
    const comps=s.competitions||[];
    const get=(type,k)=>comps.find(x=>x.type===type)?.[k]||"";
    modal(existing?"Sezonu Düzenle":"Sezon Sonu Kaydı",
      '<form id="playerSeasonForm"><div class="form-grid">'+
      field("Sezon","season","text",s.season||p.currentSeason||"2026/27",true)+
      '<div class="field"><label>Kulüp</label><select class="select" name="clubId">'+clubOptions(s.clubId||p.currentClubId)+'</select></div>'+
      field("Sezon Başlangıç OVR","ovrStart","number",s.ovrStart||p.currentOvr,false)+field("Sezon Sonu OVR","ovrEnd","number",s.ovrEnd||p.currentOvr,true)+
      field("Piyasa Değeri Başlangıç (M€)","marketStart","number",s.marketStart??p.currentMarket,false)+field("Piyasa Değeri Sonu (M€)","marketEnd","number",s.marketEnd??p.currentMarket,false)+
      statFields("Lig","lig",get)+statFields("Avrupa","avrupa",get)+statFields("Yerel Kupa","kupa",get)+statFields("Milli Takım","milli",get)+
      '<div class="field span2"><label>Sezon Notu</label><textarea class="textarea" name="note">'+esc(s.note||"")+'</textarea></div>'+
      '</div><div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Kaydet</button></div></form>',
      m=>{
        $("#playerSeasonForm",m).onsubmit=e=>{
          e.preventDefault();const f=new FormData(e.currentTarget);
          const season={
            id:existing?.id||uid("ps"),season:f.get("season"),clubId:f.get("clubId"),
            ovrStart:num(f.get("ovrStart")),ovrEnd:num(f.get("ovrEnd")),marketStart:num(f.get("marketStart")),marketEnd:num(f.get("marketEnd")),
            competitions:["lig","avrupa","kupa","milli"].map(type=>({type,name:type==="lig"?"Lig":type==="avrupa"?"Avrupa":type==="kupa"?"Yerel Kupa":"Milli Takım",apps:num(f.get(type+"Apps")),goals:num(f.get(type+"Goals")),assists:num(f.get(type+"Assists"))})),
            note:f.get("note"),closed:true,updatedAt:new Date().toISOString()
          };
          if(existing){p.seasons[p.seasons.findIndex(x=>x.id===existing.id)]=season}else p.seasons.push(season);
          p.currentOvr=season.ovrEnd||p.currentOvr;p.currentMarket=season.marketEnd;p.currentClubId=season.clubId;p.currentSeason=nextSeason(season.season);
          applySeasonSocial(p,season);save("Sezon kaydedildi");closeModal();render();
        }
      });
  }
  function statFields(title,type,get){
    return '<div class="field span2"><label>'+title+' İstatistikleri</label><div class="form-grid">'+
      '<input class="input" name="'+type+'Apps" type="number" min="0" placeholder="Maç" value="'+esc(get(type,"apps"))+'">'+
      '<input class="input" name="'+type+'Goals" type="number" min="0" placeholder="Gol" value="'+esc(get(type,"goals"))+'">'+
      '<input class="input" name="'+type+'Assists" type="number" min="0" placeholder="Asist" value="'+esc(get(type,"assists"))+'"></div></div>';
  }
  function nextSeason(s){
    const m=String(s).match(/(\d{4})\D+(\d{2,4})/); if(!m)return s;
    const a=+m[1]+1,b=(m[2].length===2?String((+m[2]+1)%100).padStart(2,"0"):+m[2]+1);return a+"/"+b;
  }
  function applySeasonSocial(p,s){
    const t=seasonTotals(s), eff={fans:0,coach:0,teammates:0,sponsor:0,privateLife:0};
    eff.fans+=Math.min(10,Math.floor(t.goals/8));eff.coach+=Math.min(8,Math.floor((t.goals+t.assists)/12));eff.teammates+=Math.min(8,Math.floor(t.assists/6));eff.sponsor+=Math.min(6,Math.floor(t.goals/12));
    Object.keys(eff).forEach(k=>p.social[k]=clamp(p.social[k]+eff[k]));
    p.socialLog.push({id:uid("sl"),date:new Date().toISOString(),text:s.season+" sezon performansı",effects:eff});
  }

  function playerTransfers(p){
    return '<div class="section-title"><div><h2>Transfer Geçmişi</h2><p>Hangi kulübe, kaç paraya ve hangi OVR ile gittiğini unutma.</p></div><button class="btn primary" id="addPlayerTransfer">+ Transfer Ekle</button></div>'+
      (p.transfers.length?'<div class="list">'+p.transfers.slice().reverse().map(x=>'<div class="list-row"><div class="list-main"><div class="list-title">'+esc(clubName(x.fromClubId))+' → '+esc(clubName(x.toClubId))+'</div><div class="list-sub">'+esc(x.season)+' · '+fmtMoney(x.fee,x.currency||"M€")+' · '+x.ovr+' OVR · piyasa '+fmtMoney(x.market,x.currency||"M€")+'</div></div><div class="list-actions"><button class="btn danger sm" data-del-player-transfer="'+x.id+'">Sil</button></div></div>').join("")+'</div>':'<div class="empty"><div class="big">✈️</div>Henüz transfer yok.</div>');
  }
  function playerTransferModal(){
    const p=state.activePlayer;
    modal("Oyuncu Transferi",
      '<form id="playerTransferForm"><div class="form-grid">'+
      '<div class="field"><label>Eski Kulüp</label><select class="select" name="from">'+clubOptions(p.currentClubId)+'</select></div>'+
      '<div class="field"><label>Yeni Kulüp</label><select class="select" name="to">'+clubOptions("")+'</select></div>'+
      field("Sezon","season","text",p.currentSeason,true)+field("Bonservis (M€)","fee","number","0",false)+field("OVR","ovr","number",p.currentOvr,true)+field("Piyasa Değeri (M€)","market","number",p.currentMarket,false)+
      '<div class="field"><label>Para Birimi</label><select class="select" name="currency"><option>M€</option><option>M£</option><option>M$</option></select></div>'+
      '<div class="field span2"><label>Not</label><textarea class="textarea" name="note"></textarea></div></div>'+
      '<div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Transferi Kaydet</button></div></form>',
      m=>$("#playerTransferForm",m).onsubmit=e=>{
        e.preventDefault();const f=new FormData(e.currentTarget);
        const x={id:uid("pt"),fromClubId:f.get("from"),toClubId:f.get("to"),season:f.get("season"),fee:num(f.get("fee")),currency:f.get("currency"),ovr:num(f.get("ovr")),market:num(f.get("market")),note:f.get("note"),date:new Date().toISOString()};
        p.transfers.push(x);p.currentClubId=x.toClubId;p.currentOvr=x.ovr;p.currentMarket=x.market;
        p.social.fans=clamp(p.social.fans-4);p.social.sponsor=clamp(p.social.sponsor+4);
        save("Transfer kaydedildi");closeModal();render();
      });
  }

  function trophyWinsFor(career){ return career.trophyWins||[]; }
  function trophyMuseum(type,career){
    const wins=trophyWinsFor(career), counts={};wins.forEach(w=>counts[w.trophyId]=(counts[w.trophyId]||0)+1);
    const total=(D.trophies||[]).length, unlocked=Object.keys(counts).length, pct=total?Math.round(unlocked/total*100):0;
    return '<div class="section-title"><div><h2>Kupa Müzesi</h2><p>Kazandıkların parlar; henüz kazanmadıkların kilitli kalır.</p></div><button class="btn primary" id="addTrophyWin">🏆 Kupa Kazandım</button></div>'+
      '<div class="panel soft"><div class="progress-row"><div class="progress-top"><span>Koleksiyon Tamamlama</span><strong>'+pct+'% · '+unlocked+'/'+total+'</strong></div><div class="progress-track"><div class="progress-fill" style="width:'+pct+'%"></div></div></div></div>'+
      '<div class="trophy-grid section">'+(D.trophies||[]).map(t=>{
        const n=counts[t.id]||0;return '<div class="trophy-card '+(n?"won":"locked")+'">'+(n?'<span class="trophy-count">x'+n+'</span>':'')+'<div class="trophy-icon">'+(n?"🏆":"🔒")+'</div><div class="trophy-name">'+esc(t.name)+'</div><div class="trophy-sub">'+esc(t.country||t.region||"")+'</div></div>';
      }).join("")+'</div>';
  }
  function trophyWinModal(type){
    const career=type==="player"?state.activePlayer:state.activeManager;
    modal("Kupa Koleksiyonuna Ekle",
      '<form id="trophyForm"><div class="form-grid"><div class="field span2"><label>Kupa</label><select class="select" name="trophyId">'+trophyOptions()+'</select></div>'+
      field("Sezon","season","text",career.currentSeason||career.profile.startSeason,true)+
      '<div class="field"><label>Kulüp / Milli Takım</label><select class="select" name="clubId">'+clubOptions(career.currentClubId)+'</select></div></div>'+
      '<div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Müzeye Ekle</button></div></form>',
      m=>$("#trophyForm",m).onsubmit=e=>{
        e.preventDefault();const f=new FormData(e.currentTarget);
        career.trophyWins.push({id:uid("tw"),trophyId:f.get("trophyId"),season:f.get("season"),clubId:f.get("clubId"),date:new Date().toISOString()});
        save("Kupa müzeye eklendi");closeModal();render();
      });
  }

  function recordsPage(scope,career){
    const all=[...(scope==="player"?D.playerRecords:D.managerRecords),...(state.customRecords[scope]||[])];
    const cats=[...new Set(all.map(r=>r.category))];
    const q=(recordFilter.scope===scope?recordFilter.search:"").toLowerCase(), cat=recordFilter.scope===scope?recordFilter.category:"all";
    const list=all.filter(r=>(cat==="all"||r.category===cat)&&(!q||(r.title+" "+r.holder+" "+r.description).toLowerCase().includes(q)));
    recordFilter.scope=scope;
    const metrics=scope==="player"?playerMetricMap(career):managerMetricMap(career);
    return '<div class="section-title"><div><h2>'+(scope==="player"?"Efsanelerin Rekorları":"Teknik Direktör Rekorları")+'</h2><p>Gerçek futbol tarihine karşı kendi kariyerini oyna.</p></div><button class="btn" id="addCustomRecord">+ Özel Rekor</button></div>'+
      '<div class="record-toolbar"><input class="input search" id="recordSearch" placeholder="Rekor, isim veya turnuva ara..." value="'+esc(recordFilter.search)+'"><select class="select" id="recordCategory" style="max-width:180px"><option value="all">Tüm kategoriler</option>'+cats.map(c=>'<option value="'+esc(c)+'" '+(cat===c?"selected":"")+'>'+esc(c)+'</option>').join("")+'</select></div>'+
      '<div class="record-list">'+list.map(r=>{
        const target=career.recordTargets.includes(r.id),done=career.completedRecords.includes(r.id),progress=r.metric?num(metrics[r.metric]):0;
        const pct=r.value?clamp(progress/num(r.value)*100):0;
        return '<div class="record-card '+(target?"target":"")+'"><div class="record-head"><div><div class="record-title">'+esc(r.title)+'</div><div class="record-holder">'+esc(r.holder||"Kişisel Hedef")+(r.value!=null?" · "+esc(r.value+" "+r.unit):"")+'</div></div><span class="badge '+(done?"green":r.disputed?"red":"gold")+'">'+(done?"✓ Başardın":r.disputed?"Notlu":"Doğrulanmış")+'</span></div>'+
        '<div class="record-desc">'+esc(r.description||"")+(r.note?'<br><em>'+esc(r.note)+'</em>':'')+'</div>'+
        (r.metric&&r.value?'<div class="progress-row"><div class="progress-top"><span>İlerleme</span><strong>'+fmtInt(progress)+' / '+fmtInt(r.value)+'</strong></div><div class="progress-track"><div class="progress-fill" style="width:'+pct+'%"></div></div></div>':'')+
        '<div class="record-foot"><span class="badge">'+esc(r.difficulty||"zor")+'</span><div class="list-actions"><button class="btn sm" data-target-record="'+r.id+'">'+(target?"Hedeften Çıkar":"Hedef Seç")+'</button><button class="btn sm '+(done?"primary":"")+'" data-done-record="'+r.id+'">'+(done?"Tamamlandı ✓":"Başardım")+'</button></div></div></div>';
      }).join("")+'</div>';
  }

  function playerMetricMap(p){
    const t=playerTotals(p), maxO=Math.max(p.profile.startOvr||0,...p.seasons.map(s=>num(s.ovrEnd)));
    return {
      career_goals:t.goals,career_assists:t.assists,career_matches:t.apps,career_league_goals:t.leagueGoals,career_continental_goals:t.continentalGoals,career_national_goals:t.nationalGoals,
      career_trophies:t.trophies,career_awards:t.awards,career_clubs:t.clubs,career_seasons:t.seasons,career_ballon_dor:p.awardWins.filter(x=>x.awardId==="ballon-dor").length,
      career_league_titles:p.trophyWins.filter(w=>(D.trophies||[]).find(t=>t.id===w.trophyId)?.category==="Lig").length,
      career_continental_titles:p.trophyWins.filter(w=>(D.trophies||[]).find(t=>t.id===w.trophyId)?.category==="Kıta").length,
      career_national_titles:p.trophyWins.filter(w=>(D.trophies||[]).find(t=>t.id===w.trophyId)?.category==="Milli Takım").length,
      season_goals:Math.max(0,...p.seasons.map(s=>seasonTotals(s).goals)),season_assists:Math.max(0,...p.seasons.map(s=>seasonTotals(s).assists)),
      season_league_goals:Math.max(0,...p.seasons.map(s=>num(s.competitions.find(c=>c.type==="lig")?.goals))),season_league_assists:Math.max(0,...p.seasons.map(s=>num(s.competitions.find(c=>c.type==="lig")?.assists))),
      season_continental_goals:Math.max(0,...p.seasons.map(s=>num(s.competitions.find(c=>c.type==="avrupa")?.goals))),
      career_max_transfer_fee:Math.max(0,...p.transfers.map(x=>num(x.fee))),max_ovr:maxO
    };
  }
  function managerMetricMap(m){
    const t=managerTotals(m);
    return {
      career_league_titles:t.leagueTitles,career_ucl_titles:t.uclTitles,career_continental_titles:m.trophyWins.filter(w=>(D.trophies||[]).find(x=>x.id===w.trophyId)?.category==="Kıta").length,
      career_domestic_cups:t.domesticCups,career_national_titles:m.trophyWins.filter(w=>(D.trophies||[]).find(x=>x.id===w.trophyId)?.category==="Milli Takım").length,
      season_wins:Math.max(0,...m.seasons.map(s=>num(s.w))),season_points:Math.max(0,...m.seasons.map(s=>num(s.points))),season_goals_for:Math.max(0,...m.seasons.map(s=>num(s.gf))),season_goals_against:Math.min(...m.seasons.map(s=>num(s.ga)).filter(Boolean),999),
      season_trophies:Math.max(0,...m.seasons.map(s=>num(s.trophiesCount))),career_league_title_countries:new Set(m.trophyWins.filter(w=>(D.trophies||[]).find(x=>x.id===w.trophyId)?.category==="Lig").map(w=>clubById(w.clubId)?.country).filter(Boolean)).size,
      career_world_cups:m.trophyWins.filter(w=>(D.trophies||[]).find(x=>x.id===w.trophyId)?.name==="FIFA Dünya Kupası").length
    };
  }

  function customRecordModal(scope){
    modal("Özel Rekor Ekle",
      '<form id="customRecordForm"><div class="form-grid">'+field("Rekor Başlığı","title","text","Kulüp tarihinin en çok gollü sezonu",true)+field("Rekor Sahibi / Referans","holder","text","Kulüp Rekoru",true)+field("Hedef Değer","value","number","100",false)+field("Birim","unit","text","gol",false)+
      '<div class="field span2"><label>Açıklama</label><textarea class="textarea" name="description"></textarea></div><div class="field"><label>Zorluk</label><select class="select" name="difficulty"><option>kolay</option><option selected>zor</option><option>efsanevi</option></select></div><div class="field"><label>Kategori</label><input class="input" name="category" value="özel"></div></div>'+
      '<div class="modal-actions"><button class="btn ghost" type="button" data-close>Vazgeç</button><button class="btn primary">Ekle</button></div></form>',
      m=>$("#customRecordForm",m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.customRecords[scope].push({id:uid(scope==="player"?"p-custom":"m-custom"),scope,category:f.get("category"),title:f.get("title"),holder:f.get("holder"),value:num(f.get("value"))||null,unit:f.get("unit"),description:f.get("description"),difficulty:f.get("difficulty"),metric:null,disputed:false,source:"Kullanıcı"});save("Özel rekor eklendi");closeModal();render();}
    );
  }

  function playerAchievements(p,t){
    const metrics={...playerMetricMap(p),career_awards:t.awards};
    const unlocked=(D.badges||[]).filter(b=>num(metrics[b.metric])>=num(b.value));
    return '<div class="section-title"><div><h2>Başarılar ve Rozetler</h2><p>Kupa ve tarihî rekorlardan ayrı kişisel kilometre taşları.</p></div><button class="btn" id="addAwardWin">+ Bireysel Ödül</button></div>'+
      '<div class="quick-grid">'+stat("Açılan Rozet",unlocked.length,(D.badges||[]).length+" toplam")+stat("Bireysel Ödül",p.awardWins.length)+stat("Ballon d'Or",p.awardWins.filter(x=>x.awardId==="ballon-dor").length)+stat("Hedef Rekor",p.recordTargets.length)+'</div>'+
      '<div class="trophy-grid section">'+(D.badges||[]).map(b=>{const ok=num(metrics[b.metric])>=num(b.value);return '<div class="trophy-card '+(ok?"won":"locked")+'"><div class="trophy-icon">'+esc(b.icon||"🏅")+'</div><div class="trophy-name">'+esc(b.name)+'</div><div class="trophy-sub">'+(ok?"Açıldı":"Kilitli")+'</div></div>'}).join("")+'</div>'+
      '<div class="section panel"><h3>Kazanılan Bireysel Ödüller</h3>'+(p.awardWins.length?'<div class="list">'+p.awardWins.slice().reverse().map(x=>'<div class="list-row"><div class="list-main"><div class="list-title">'+esc((D.awards||[]).find(a=>a.id===x.awardId)?.name||x.awardId)+'</div><div class="list-sub">'+esc(x.season)+' · '+esc(clubName(x.clubId))+'</div></div><button class="btn danger sm" data-del-award="'+x.id+'">Sil</button></div>').join("")+'</div>':'<div class="empty">Henüz bireysel ödül yok.</div>')+'</div>';
  }
  function awardModal(){
    const p=state.activePlayer;
    modal("Bireysel Ödül Ekle",'<form id="awardForm"><div class="form-grid"><div class="field span2"><label>Ödül</label><select class="select" name="awardId">'+awardOptions()+'</select></div>'+field("Sezon","season","text",p.currentSeason,true)+'<div class="field"><label>Kulüp</label><select class="select" name="clubId">'+clubOptions(p.currentClubId)+'</select></div></div><div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Ekle</button></div></form>',
    m=>$("#awardForm",m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);p.awardWins.push({id:uid("aw"),awardId:f.get("awardId"),season:f.get("season"),clubId:f.get("clubId")});save("Bireysel ödül eklendi");closeModal();render();});
  }

  function socialBars(s){
    const map=[["Taraftar","fans"],["Teknik Direktör","coach"],["Takım Arkadaşları","teammates"],["Sponsor","sponsor"],["Özel Hayat","privateLife"]];
    return '<div class="meter-grid">'+map.map(([n,k])=>'<div class="meter '+(s[k]>=70?"good":s[k]<40?"bad":"mid")+'"><div class="m-name">'+n+'</div><div class="m-val">'+s[k]+'</div><div class="progress-track"><div class="progress-fill" style="width:'+s[k]+'%"></div></div></div>').join("")+'</div>';
  }
  function playerSocial(p){
    return '<div class="section-title"><div><h2>İtibar ve İlişkiler</h2><p>NSS tarzı beş ilişki barı; kararların ve sezon performansın etkiler.</p></div><button class="btn primary" id="newDecision">🎲 Karar Olayı</button></div>'+socialBars(p.social)+
      '<div class="section panel"><h3>Olay Günlüğü</h3>'+(p.socialLog.length?'<div class="list">'+p.socialLog.slice().reverse().map(x=>'<div class="list-row"><div class="list-main"><div class="list-title">'+esc(x.text)+'</div><div class="list-sub">'+new Date(x.date).toLocaleDateString("tr-TR")+'</div></div></div>').join("")+'</div>':'<div class="empty">Henüz ilişki olayı yok.</div>')+'</div>';
  }
  function decisionModal(){
    const p=state.activePlayer, all=D.decisions||[], d=all[Math.floor(Math.random()*all.length)];
    if(!d)return;
    modal(d.title,'<p>'+esc(d.text)+'</p><div class="list">'+d.options.map((o,i)=>'<button class="list-row" style="width:100%;text-align:left;color:inherit" data-decision-option="'+i+'"><div class="list-main"><div class="list-title">'+esc(o.label)+'</div><div class="list-sub">'+Object.entries(o.effects||{}).map(([k,v])=>(v>0?"+":"")+v+" "+k).join(" · ")+'</div></div></button>').join("")+'</div>',
    m=>$$("[data-decision-option]",m).forEach(b=>b.onclick=()=>{const o=d.options[+b.dataset.decisionOption];Object.entries(o.effects||{}).forEach(([k,v])=>p.social[k]=clamp(p.social[k]+v));p.decisions.push({id:uid("dec"),decisionId:d.id,option:o.label,story:o.story,date:new Date().toISOString()});p.socialLog.push({id:uid("sl"),date:new Date().toISOString(),text:d.title+" — "+o.label,effects:o.effects});save("Karar uygulandı");closeModal();render();}));
  }

  function playerStories(p){
    const stories=[{date:p.profile.startSeason,title:"Profesyonel Yolculuk Başladı",text:clubName(p.currentClubId)+" ile başlayan yolculukta "+p.profile.personality+" karakteri kariyerinin temelini oluşturdu."}];
    p.seasons.forEach(s=>{const t=seasonTotals(s);let tone=p.profile.personality==="Başı Buyruk"?"sahnenin merkezine yürüdü":p.profile.personality==="Virtüöz"?"oyunuyla fark yarattı":"takımını öne koydu";stories.push({date:s.season,title:clubName(s.clubId)+" Sezonu",text:t.apps+" maçta "+t.goals+" gol ve "+t.assists+" asist üretti; "+tone+". Sezonu "+(s.ovrEnd||p.currentOvr)+" OVR ile tamamladı."})});
    p.transfers.forEach(x=>stories.push({date:x.season,title:"Yeni Bir Sayfa: "+clubName(x.toClubId),text:fmtMoney(x.fee,x.currency||"M€")+" bonservisle "+clubName(x.fromClubId)+" kulübünden "+clubName(x.toClubId)+" kulübüne transfer oldu."}));
    p.decisions.forEach(x=>stories.push({date:new Date(x.date).toLocaleDateString("tr-TR"),title:"Kariyer Kararı",text:x.story}));
    return stories;
  }
  function storyList(arr){return arr.length?arr.map(s=>'<div class="story"><div class="story-date">'+esc(s.date)+'</div><div class="story-title">'+esc(s.title)+'</div><p>'+esc(s.text)+'</p></div>').join(""):'<div class="empty">Hikâye henüz başlamadı.</div>';}

  function playerLegacy(p,t){
    const score=clamp(Math.round(t.goals*.08+t.assists*.06+t.trophies*4+t.awards*6+p.completedRecords.length*3+Math.max(0,p.currentOvr-65)*1.2),0,100);
    const title=score>=90?"Futbol Tarihinin Efsanesi":score>=75?"Dünya Yıldızı":score>=55?"Kulüp Efsanesi":score>=35?"Kariyer Oyuncusu":"Yükselen İsim";
    return '<div class="legacy-hero"><div class="eyebrow">KARİYER MİRASI — CANLI ÖNİZLEME</div><div class="legacy-score">'+score+'</div><div class="legacy-title">'+title+'</div><p>Bu sayfa kariyerin boyunca otomatik büyür. Emekli olduğunda aynı özet Efsaneler Arşivine kilitlenir.</p></div>'+
      '<div class="quick-grid section">'+stat("Toplam Gol",t.goals)+stat("Toplam Asist",t.assists)+stat("Kupalar",t.trophies)+stat("Rekorlar",p.completedRecords.length)+'</div>'+
      '<div class="two-col section"><div class="panel"><h3>Kulüp Yolculuğu</h3>'+timelinePlayer(p)+'</div><div class="panel"><h3>Final Durumu</h3>'+socialBars(p.social)+'</div></div>'+
      '<div class="section danger-zone"><h3>Kariyeri Bitir</h3><p>Emekli olursan bu kariyer salt okunur şekilde Efsaneler Arşivine taşınır ve yeni oyuncu kariyeri açabilirsin.</p><button class="btn danger" id="retirePlayer">Oyuncu Kariyerinden Emekli Ol</button></div>';
  }
  function timelinePlayer(p){
    const rows=[{t:p.profile.startSeason,a:"Başlangıç",b:clubName(p.transfers[0]?.fromClubId||p.currentClubId)}];
    p.transfers.forEach(x=>rows.push({t:x.season,a:"Transfer",b:clubName(x.toClubId)+" · "+fmtMoney(x.fee,x.currency||"M€")}));
    return '<div class="list">'+rows.map(r=>'<div class="list-row"><span class="badge gold">'+esc(r.t)+'</span><div class="list-main"><div class="list-title">'+esc(r.a)+'</div><div class="list-sub">'+esc(r.b)+'</div></div></div>').join("")+'</div>';
  }

  function managerScore(m){
    let points=0; const tier=clubById(m.currentClubId)?.tier||3;
    m.seasons.forEach(s=>{
      const mult=1+(tier-1)*.22;
      let base=Math.max(0,12-num(s.position)*1.5)+num(s.w)*.22+num(s.trophiesCount)*12;
      points+=Math.round(base*mult);
    });
    m.trophyWins.forEach(w=>{const tr=(D.trophies||[]).find(t=>t.id===w.trophyId);points+=num(tr?.prestige||2)*10*(1+(tier-1)*.15)});
    const ovr=clamp(Math.round(58+points/90),0,99), reputation=clamp(Math.round(45+points/65),0,100);
    const attrs=managerAttributes(m);
    return {points:Math.round(points),ovr,reputation,attrs,title:ovr>=92?"Yaşayan Efsane":ovr>=85?"Dünya Çapında Hoca":ovr>=75?"Başarılı Teknik Direktör":ovr>=65?"Yükselen Yıldız":"Çaylak Antrenör"};
  }
  function managerAttributes(m){
    const t=managerTotals(m), games=t.wins+t.draws+t.losses,wr=games?t.wins/games:0;
    const dev=m.transfers.length?m.transfers.reduce((a,x)=>a+Math.max(0,num(x.sellOvr)-num(x.buyOvr)),0)/m.transfers.length:0;
    const profit=Math.max(0,t.net);
    return {transfer:clamp(Math.round(50+dev*2+Math.min(25,profit/10))),youth:clamp(50+m.academy.length*4),tactics:clamp(Math.round(45+wr*45+(t.gf-t.ga)/Math.max(1,games))),trophy:clamp(45+t.trophies*5),man:clamp(50+m.favorites.length*2+m.legends.length*3)};
  }

  function managerPage(){
    const m=state.activeManager,t=managerTotals(m),s=managerScore(m);m.managerOvr=s.ovr;m.reputation=s.reputation;m.careerPoints=s.points;
    const c=clubById(m.currentClubId);
    const profile='<div class="panel profile-card"><div class="profile-banner"></div><div class="profile-content"><div class="avatar-wrap">'+(m.profile.photo?'<img src="'+m.profile.photo+'" alt="">':esc((m.profile.firstName||"B")[0]+(m.profile.lastName||"T")[0]))+'</div>'+
      '<div class="profile-name">'+esc(m.profile.firstName+" "+m.profile.lastName)+'</div><div class="profile-line">'+esc(c?.name||"Kulüp")+' · '+esc(s.title)+'</div><div class="profile-tags"><span class="tag">🧠 '+s.ovr+' OVR</span><span class="tag">🌍 '+s.reputation+' İtibar</span><span class="tag">🏅 '+s.points+' Puan</span></div></div></div>';
    const ovrHist=m.seasons.map((x,i)=>clamp(60+Math.round((i+1)*((s.ovr-60)/Math.max(1,m.seasons.length))),0,99));
    const repHist=m.seasons.map((x,i)=>clamp(50+Math.round((i+1)*((s.reputation-50)/Math.max(1,m.seasons.length))),0,100));
    const charts='<div class="chart-grid"><div class="panel chart-box"><div class="chart-head"><div class="chart-title">Menajer OVR</div><div class="chart-last">'+s.ovr+'</div></div>'+chart(ovrHist.length?ovrHist:[60],[])+'</div>'+
      '<div class="panel chart-box"><div class="chart-head"><div class="chart-title">Dünya İtibarı</div><div class="chart-last">'+s.reputation+'</div></div>'+chart(repHist.length?repHist:[50],[])+'</div></div>';
    let body='<button id="backHome" class="btn ghost sm">← Ana Sayfa</button><div class="career-head">'+profile+charts+'</div>'+careerTabs("manager");
    body+=managerTabContent(m,t,s);return body;
  }

  function managerTabContent(m,t,s){
    if(tab==="overview"){
      return '<div class="stat-grid">'+stat("Menajer OVR",s.ovr,s.title)+stat("Kariyer Puanı",s.points,"asla azalmaz")+stat("İtibar",s.reputation+"/100")+stat("Net Transfer",fmtMoney(t.net,"M€"),t.net>=0?"kâr":"zarar")+'</div>'+
      '<div class="two-col section"><div class="panel"><h3>Teknik Direktör Özellikleri</h3>'+attrBars(s.attrs)+'</div><div class="panel"><h3>Son Hikâye</h3>'+storyList(managerStories(m).slice(-3).reverse())+'</div></div>'+
      '<div class="quick-grid section">'+stat("Galibiyet",t.wins)+stat("Kupa",t.trophies)+stat("Sezon",t.seasons)+stat("Geliştirilen Oyuncu",m.transfers.filter(x=>num(x.sellOvr)>num(x.buyOvr)).length)+'</div>';
    }
    if(tab==="seasons")return managerSeasons(m);
    if(tab==="transfers")return managerTransfers(m,t);
    if(tab==="academy")return academyPage(m);
    if(tab==="stars")return starsPage(m);
    if(tab==="trophies")return trophyMuseum("manager",m);
    if(tab==="clubrecords")return clubRecordsPage(m);
    if(tab==="records")return recordsPage("manager",m);
    if(tab==="national")return nationalPage(m);
    if(tab==="story")return '<div class="panel"><div class="section-title"><div><h2>Teknik Direktör Hikâyesi</h2><p>Sezon, transfer ve kupa verilerinden otomatik oluşur.</p></div></div>'+storyList(managerStories(m))+'</div>';
    if(tab==="legacy")return managerLegacy(m,t,s);
    return "";
  }
  function attrBars(a){
    const names=[["Transfer Yeteneği","transfer"],["Genç Geliştirme","youth"],["Taktik","tactics"],["Kupa Uzmanlığı","trophy"],["İnsan Yönetimi","man"]];
    return names.map(([n,k])=>'<div class="progress-row"><div class="progress-top"><span>'+n+'</span><strong>'+a[k]+'</strong></div><div class="progress-track"><div class="progress-fill" style="width:'+a[k]+'%"></div></div></div>').join("");
  }

  function managerSeasons(m){
    return '<div class="section-title"><div><h2>Menajer Sezonları</h2><p>Lig konumu, sonuçlar, goller ve sezonun yıldızı.</p></div><button class="btn primary" id="addManagerSeason">+ Sezon Ekle</button></div>'+
      (m.seasons.length?'<div class="list">'+m.seasons.slice().reverse().map(s=>'<div class="list-row"><div class="list-main"><div class="list-title">'+esc(s.season)+' · '+esc(clubName(s.clubId))+' · '+esc(s.position)+'.</div><div class="list-sub">'+s.points+' puan · '+s.w+'G '+s.d+'B '+s.l+'M · '+s.gf+'-'+s.ga+' · Sezon yıldızı: '+esc(s.starPlayer||"—")+'</div></div><div class="list-actions"><button class="btn sm" data-edit-manager-season="'+s.id+'">Düzenle</button><button class="btn danger sm" data-del-manager-season="'+s.id+'">Sil</button></div></div>').join("")+'</div>':'<div class="empty"><div class="big">📋</div>İlk sezonunu tamamlayınca kaydet.</div>');
  }
  function managerSeasonModal(existing=null){
    const m=state.activeManager,s=existing||{};
    modal(existing?"Menajer Sezonunu Düzenle":"Menajer Sezon Sonu",
      '<form id="managerSeasonForm"><div class="form-grid">'+field("Sezon","season","text",s.season||m.currentSeason,true)+'<div class="field"><label>Kulüp</label><select class="select" name="clubId">'+clubOptions(s.clubId||m.currentClubId)+'</select></div>'+
      field("Lig Sırası","position","number",s.position||"1",true)+field("Puan","points","number",s.points||"",false)+field("Galibiyet","w","number",s.w||"",false)+field("Beraberlik","d","number",s.d||"",false)+field("Mağlubiyet","l","number",s.l||"",false)+field("Atılan Gol","gf","number",s.gf||"",false)+field("Yenen Gol","ga","number",s.ga||"",false)+
      field("Sezonun Yıldızı","starPlayer","text",s.starPlayer||"",false)+field("Yıldız Gol","starGoals","number",s.starGoals||"",false)+field("Yıldız Asist","starAssists","number",s.starAssists||"",false)+
      field("Bu Sezon Kupa Sayısı","trophiesCount","number",s.trophiesCount||"0",false)+
      '<div class="field span2"><label>Yönetim Hedefi / Not</label><textarea class="textarea" name="note">'+esc(s.note||"")+'</textarea></div></div>'+
      '<div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Kaydet</button></div></form>',
      x=>$("#managerSeasonForm",x).onsubmit=e=>{
        e.preventDefault();const f=new FormData(e.currentTarget);
        const se={id:existing?.id||uid("ms"),season:f.get("season"),clubId:f.get("clubId"),position:num(f.get("position")),points:num(f.get("points")),w:num(f.get("w")),d:num(f.get("d")),l:num(f.get("l")),gf:num(f.get("gf")),ga:num(f.get("ga")),starPlayer:f.get("starPlayer"),starGoals:num(f.get("starGoals")),starAssists:num(f.get("starAssists")),trophiesCount:num(f.get("trophiesCount")),note:f.get("note")};
        if(existing)m.seasons[m.seasons.findIndex(z=>z.id===existing.id)]=se;else m.seasons.push(se);
        m.currentClubId=se.clubId;m.currentSeason=nextSeason(se.season);const sc=managerScore(m);m.managerOvr=sc.ovr;m.careerPoints=sc.points;m.reputation=sc.reputation;
        save("Menajer sezonu kaydedildi");closeModal();render();
      });
  }

  function managerTransfers(m,t){
    return '<div class="section-title"><div><h2>Transfer Merkezi</h2><p>Alış, satış, OVR gelişimi ve yatırım kalitesi.</p></div><button class="btn primary" id="addManagerTransfer">+ Oyuncu Yatırımı Ekle</button></div>'+
      '<div class="quick-grid">'+stat("Toplam Harcama",fmtMoney(t.spend,"M€"))+stat("Satış Geliri",fmtMoney(t.income,"M€"))+stat("Net",fmtMoney(t.net,"M€"),t.net>=0?"kâr":"zarar")+stat("Kayıt",m.transfers.length)+'</div>'+
      '<div class="section">'+(m.transfers.length?'<div class="table-wrap"><table class="table"><thead><tr><th>Oyuncu</th><th>Alış</th><th>Satış</th><th>OVR</th><th>Gelişim</th><th>Sonuç</th><th></th></tr></thead><tbody>'+
      m.transfers.map(x=>{const profit=num(x.sellFee)-num(x.buyFee),dev=num(x.sellOvr)-num(x.buyOvr),score=transferScore(x);return '<tr><td><strong>'+esc(x.player)+'</strong><br><span class="list-sub">'+esc(x.position||"")+'</span></td><td>'+fmtMoney(x.buyFee,"M€")+'</td><td>'+fmtMoney(x.sellFee,"M€")+'</td><td>'+esc(x.buyOvr||"—")+' → '+esc(x.sellOvr||"—")+'</td><td class="'+(dev>=0?"pos":"neg")+'">'+(dev>=0?"+":"")+dev+'</td><td><span class="badge '+(score>=70?"green":score<40?"red":"gold")+'">'+transferLabel(score)+'</span><br><span class="'+(profit>=0?"pos":"neg")+'">'+(profit>=0?"+":"")+fmtMoney(profit,"M€")+'</span></td><td><button class="btn danger sm" data-del-manager-transfer="'+x.id+'">Sil</button></td></tr>'}).join("")+
      '</tbody></table></div>':'<div class="empty"><div class="big">💼</div>Henüz transfer yatırım kaydı yok.</div>')+'</div>';
  }
  function transferScore(x){
    const profit=num(x.sellFee)-num(x.buyFee),dev=num(x.sellOvr)-num(x.buyOvr),years=num(x.years);
    return clamp(Math.round(50+profit*.5+dev*3+Math.min(15,years*3)),0,100);
  }
  function transferLabel(s){return s>=85?"Transfer Dehası":s>=70?"Harika İş":s>=55?"Başarılı":s>=40?"Ortalama":"Zayıf Yatırım";}
  function managerTransferModal(){
    modal("Oyuncu Transfer Yatırımı",
      '<form id="managerTransferForm"><div class="form-grid">'+field("Oyuncu","player","text","",true)+field("Mevki","position","text","ST",false)+field("Alış Bedeli (M€)","buyFee","number","0",false)+field("Satış Bedeli (M€)","sellFee","number","0",false)+field("Alış OVR","buyOvr","number","68",false)+field("Satış / Son OVR","sellOvr","number","",false)+field("Kulüpte Sezon","years","number","1",false)+field("Sezon","season","text",state.activeManager.currentSeason,false)+'<div class="field span2"><label>Not</label><textarea class="textarea" name="note"></textarea></div></div>'+
      '<div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Kaydet</button></div></form>',
      m=>$("#managerTransferForm",m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.activeManager.transfers.push({id:uid("mt"),player:f.get("player"),position:f.get("position"),buyFee:num(f.get("buyFee")),sellFee:num(f.get("sellFee")),buyOvr:num(f.get("buyOvr")),sellOvr:num(f.get("sellOvr")),years:num(f.get("years")),season:f.get("season"),note:f.get("note")});save("Transfer yatırımı kaydedildi");closeModal();render();}
    );
  }

  function academyPage(m){
    return '<div class="section-title"><div><h2>Altyapı Akademisi</h2><p>16 yaşında çıkardığın çocuğu 88 OVR'a taşıdıysan unutulmasın.</p></div><button class="btn primary" id="addAcademy">+ Akademi Oyuncusu</button></div>'+
      (m.academy.length?'<div class="record-list">'+m.academy.map(x=>'<div class="record-card"><div class="record-title">'+esc(x.player)+' · '+esc(x.position)+'</div><div class="record-holder">'+esc(x.age)+' yaş · '+esc(x.startOvr)+' OVR başlangıç</div><div class="record-desc">'+esc(x.startSeason)+' · Son OVR '+esc(x.endOvr||"—")+' · Satış '+fmtMoney(x.saleFee,"M€")+'</div><div class="record-foot"><span class="badge '+(num(x.endOvr)-num(x.startOvr)>=15?"green":"")+'">+'+(num(x.endOvr)-num(x.startOvr))+' gelişim</span><button class="btn danger sm" data-del-academy="'+x.id+'">Sil</button></div></div>').join("")+'</div>':'<div class="empty"><div class="big">🌱</div>Akademiden çıkan ilk oyuncunu ekle.</div>');
  }
  function academyModal(){
    modal("Akademi Oyuncusu",'<form id="academyForm"><div class="form-grid">'+field("Oyuncu","player","text","",true)+field("Mevki","position","text","CM",true)+field("Yaş","age","number","16",true)+field("Başlangıç OVR","startOvr","number","62",true)+field("Son / Satış OVR","endOvr","number","",false)+field("Satış Bedeli (M€)","saleFee","number","0",false)+field("Çıkış Sezonu","startSeason","text",state.activeManager.currentSeason,false)+'</div><div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Kaydet</button></div></form>',
    m=>$("#academyForm",m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.activeManager.academy.push({id:uid("ac"),player:f.get("player"),position:f.get("position"),age:num(f.get("age")),startOvr:num(f.get("startOvr")),endOvr:num(f.get("endOvr")),saleFee:num(f.get("saleFee")),startSeason:f.get("startSeason")});save("Akademi oyuncusu kaydedildi");closeModal();render();});
  }

  function starsPage(m){
    const stars=m.seasons.filter(s=>s.starPlayer).map(s=>({season:s.season,name:s.starPlayer,goals:s.starGoals,assists:s.starAssists}));
    return '<div class="section-title"><div><h2>Yıldızlar ve Efsaneler</h2><p>Sezon yıldızları, favorilerin ve kulüp efsanelerin.</p></div><button class="btn primary" id="addLegend">+ Efsane / Favori Ekle</button></div>'+
      '<div class="three-col"><div class="panel"><h3>Sezonun Yıldızları</h3>'+(stars.length?stars.slice().reverse().map(x=>'<div class="list-row"><div class="list-main"><div class="list-title">'+esc(x.name)+'</div><div class="list-sub">'+esc(x.season)+' · '+x.goals+' gol · '+x.assists+' asist</div></div></div>').join(""):'<div class="empty">Sezon kaydıyla oluşur.</div>')+'</div>'+
      '<div class="panel"><h3>Favori Oyuncular</h3>'+(m.favorites.length?m.favorites.map(x=>'<div class="list-row"><div class="list-main"><div class="list-title">⭐ '+esc(x.name)+'</div><div class="list-sub">'+esc(x.note||"")+'</div></div></div>').join(""):'<div class="empty">Favorin yok.</div>')+'</div>'+
      '<div class="panel"><h3>Kulüp Efsaneleri</h3>'+(m.legends.length?m.legends.map(x=>'<div class="list-row"><div class="list-main"><div class="list-title">🏛️ '+esc(x.name)+'</div><div class="list-sub">'+esc(x.title||"Kulüp Efsanesi")+'</div></div></div>').join(""):'<div class="empty">Henüz efsane seçmedin.</div>')+'</div></div>';
  }
  function legendModal(){
    modal("Favori / Efsane Oyuncu",'<form id="legendForm"><div class="form-grid">'+field("Oyuncu Adı","name","text","",true)+'<div class="field"><label>Tür</label><select class="select" name="kind"><option value="favorite">Favori Oyuncu</option><option value="legend">Kulüp Efsanesi</option></select></div>'+field("Özel Unvan / Not","note","text","Efsane Kaptan",false)+'</div><div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Ekle</button></div></form>',
    m=>$("#legendForm",m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget),obj={id:uid("lg"),name:f.get("name"),note:f.get("note"),title:f.get("note")};if(f.get("kind")==="favorite")state.activeManager.favorites.push(obj);else state.activeManager.legends.push(obj);save("Oyuncu müzeye eklendi");closeModal();render();});
  }

  function clubRecordsPage(m){
    const records=(D.clubHistory||[]).filter(r=>r.clubId===m.currentClubId);
    return '<div class="section-title"><div><h2>'+esc(clubName(m.currentClubId))+' Tarihî Hedefleri</h2><p>Kulüp değiştirince bu sayfa yeni kulübün tarihine döner.</p></div><button class="btn" id="changeClub">Kulüp Değiştir</button></div>'+
      (records.length?'<div class="record-list">'+records.map(r=>'<div class="record-card"><div class="record-title">'+esc(r.title)+'</div><div class="record-holder">'+esc(r.holder||"")+(r.value!=null?" · "+esc(r.value):"")+'</div><div class="record-desc">Kaynak: '+esc(r.source||"Kaynak notu yok")+'</div></div>').join("")+'</div>':'<div class="empty"><div class="big">🏟️</div>Bu kulüp için hazır tarihî kayıt yok. Teknik direktör rekorları bölümünden kendi hedefini ekleyebilirsin.</div>');
  }
  function changeClubModal(){
    const m=state.activeManager;
    modal("Yeni Kulübe Geç",'<form id="clubChangeForm"><div class="form-grid"><div class="field span2"><label>Yeni Kulüp</label><select class="select" name="clubId">'+clubOptions()+'</select></div>'+field("Geçiş Sezonu","season","text",m.currentSeason,true)+'</div><div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Göreve Başla</button></div></form>',
    x=>$("#clubChangeForm",x).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);const prev=m.stints[m.stints.length-1];if(prev)prev.endSeason=f.get("season");m.currentClubId=f.get("clubId");m.currentSeason=f.get("season");m.stints.push({clubId:f.get("clubId"),startSeason:f.get("season"),endSeason:null});save("Yeni kulübe geçildi");closeModal();render();});
  }

  function nationalPage(m){
    return '<div class="section-title"><div><h2>Milli Takım Kariyeri</h2><p>Kulüp kariyerinden ayrı, aynı teknik direktörün milli takım dönemleri.</p></div><button class="btn primary" id="addNationalJob">+ Milli Takım Görevi</button></div>'+
      (m.nationalJobs.length?'<div class="list">'+m.nationalJobs.map(x=>'<div class="list-row"><div class="list-main"><div class="list-title">🌍 '+esc(x.team)+'</div><div class="list-sub">'+esc(x.startSeason)+' — '+esc(x.endSeason||"Devam ediyor")+' · '+esc(x.trophies||"Kupa yok")+'</div></div><button class="btn danger sm" data-del-national="'+x.id+'">Sil</button></div>').join("")+'</div>':'<div class="empty"><div class="big">🌐</div>Henüz milli takım görevi yok.</div>');
  }
  function nationalModal(){
    modal("Milli Takım Görevi",'<form id="nationalForm"><div class="form-grid"><div class="field"><label>Milli Takım</label><select class="select" name="team">'+(D.nations||[]).map(n=>'<option>'+esc(n.name)+'</option>').join("")+'</select></div>'+field("Başlangıç Sezonu","startSeason","text",state.activeManager.currentSeason,true)+field("Bitiş Sezonu","endSeason","text","",false)+field("Başarı / Kupalar","trophies","text","",false)+'</div><div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Kaydet</button></div></form>',
    m=>$("#nationalForm",m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.activeManager.nationalJobs.push({id:uid("nat"),team:f.get("team"),startSeason:f.get("startSeason"),endSeason:f.get("endSeason"),trophies:f.get("trophies")});save("Milli takım görevi kaydedildi");closeModal();render();});
  }

  function managerStories(m){
    const arr=[{date:m.profile.startSeason,title:"Teknik Direktörlük Kariyeri Başladı",text:clubName(m.stints[0]?.clubId||m.currentClubId)+" ile profesyonel teknik direktörlük yolculuğu başladı."}];
    m.stints.slice(1).forEach(x=>arr.push({date:x.startSeason,title:"Yeni Görev: "+clubName(x.clubId),text:"Kariyerinde yeni bir sayfa açtı ve "+clubName(x.clubId)+" teknik direktörlüğünü devraldı."}));
    m.seasons.forEach(s=>arr.push({date:s.season,title:clubName(s.clubId)+" ile Sezon Sonu",text:"Ligi "+s.position+". sırada "+s.points+" puanla tamamladı; "+s.w+" galibiyet aldı ve "+s.gf+" gol attı."+ (s.trophiesCount?" Sezonu "+s.trophiesCount+" kupayla kapattı.":"")}));
    m.transfers.filter(x=>transferScore(x)>=80).forEach(x=>arr.push({date:x.season||"Transfer",title:"Transfer Dehası: "+x.player,text:x.player+" yatırımında OVR "+x.buyOvr+"'dan "+x.sellOvr+"'a çıktı; mali sonuç "+fmtMoney(num(x.sellFee)-num(x.buyFee),"M€")+" oldu."}));
    return arr;
  }

  function managerLegacy(m,t,s){
    const score=clamp(Math.round(s.ovr*.55+s.reputation*.2+Math.min(25,t.trophies*3+m.completedRecords.length*2)),0,100);
    return '<div class="legacy-hero"><div class="eyebrow">TEKNİK DİREKTÖR KARİYER MİRASI</div><div class="legacy-score">'+score+'</div><div class="legacy-title">'+esc(s.title)+'</div><p>'+m.stints.length+' kulüp dönemi · '+t.trophies+' kupa · '+t.wins+' galibiyet · '+fmtMoney(t.net,"M€")+' net transfer sonucu.</p></div>'+
      '<div class="quick-grid section">'+stat("Kariyer Puanı",s.points)+stat("Menajer OVR",s.ovr)+stat("İtibar",s.reputation)+stat("Kırılan Rekor",m.completedRecords.length)+'</div>'+
      '<div class="two-col section"><div class="panel"><h3>Kulüp Yolculuğu</h3><div class="list">'+m.stints.map(x=>'<div class="list-row"><span class="badge gold">'+esc(x.startSeason)+'</span><div class="list-main"><div class="list-title">'+esc(clubName(x.clubId))+'</div><div class="list-sub">'+esc(x.endSeason||"Devam ediyor")+'</div></div></div>').join("")+'</div></div><div class="panel"><h3>Özellikler</h3>'+attrBars(s.attrs)+'</div></div>'+
      '<div class="section danger-zone"><h3>Kariyeri Bitir</h3><p>Emekli olduğunda bu kariyer Efsaneler Arşivine sabitlenir ve yeni teknik direktör kariyeri açabilirsin.</p><button class="btn danger" id="retireManager">Teknik Direktörlükten Emekli Ol</button></div>';
  }

  function archivePage(){
    const all=[...state.archives.player.map(x=>({...x,_type:"player"})),...state.archives.manager.map(x=>({...x,_type:"manager"}))].sort((a,b)=>new Date(b.retiredAt)-new Date(a.retiredAt));
    return '<section class="hero" style="padding-bottom:16px"><div class="eyebrow">🏛️ EFSANELER ARŞİVİ</div><h1 style="font-size:clamp(36px,5vw,58px)">Bitirdiğin kariyerler <em>kaybolmaz.</em></h1><p>Eski kariyerlerine gir, o yıllarda neler yaptığını tekrar gör. Karşılaştırmayı sen yap; site sadece hikâyeyi korur.</p></section>'+
      (all.length?'<div class="archive-grid">'+all.map(x=>archiveCard(x)).join("")+'</div>':'<div class="empty"><div class="big">🏛️</div>Henüz emekli edilmiş kariyer yok.</div>');
  }
  function archiveCard(a){
    if(a._type==="player"){
      const t=playerTotals(a.data);return '<article class="archive-card"><span class="badge gold">OYUNCU</span><h3>'+esc(a.data.profile.firstName+" "+a.data.profile.lastName)+'</h3><p>'+esc(a.data.profile.startSeason)+' → '+esc(a.endSeason||a.data.currentSeason)+' · '+t.goals+' gol · '+t.assists+' asist · '+t.trophies+' kupa</p><button class="btn sm" data-view-archive="'+a.id+'">Kariyer Mirasını Aç</button></article>';
    }
    const t=managerTotals(a.data),s=managerScore(a.data);return '<article class="archive-card"><span class="badge gold">TEKNİK DİREKTÖR</span><h3>'+esc(a.data.profile.firstName+" "+a.data.profile.lastName)+'</h3><p>'+esc(a.data.profile.startSeason)+' → '+esc(a.endSeason||a.data.currentSeason)+' · '+t.trophies+' kupa · '+s.ovr+' OVR · '+s.points+' puan</p><button class="btn sm" data-view-archive="'+a.id+'">Kariyer Mirasını Aç</button></article>';
  }
  function archiveDetail(id){
    const a=[...state.archives.player,...state.archives.manager].find(x=>x.id===id);if(!a)return;
    const isP=state.archives.player.includes(a),d=a.data;
    const t=isP?playerTotals(d):managerTotals(d),s=isP?null:managerScore(d);
    modal("Arşiv — "+d.profile.firstName+" "+d.profile.lastName,
      '<div class="legacy-hero"><div class="eyebrow">'+(isP?"OYUNCU KARİYERİ":"TEKNİK DİREKTÖR KARİYERİ")+'</div><div class="legacy-score">'+(isP?d.currentOvr:s.ovr)+'</div><div class="legacy-title">'+esc(isP?clubName(d.currentClubId):s.title)+'</div><p>'+esc(d.profile.startSeason)+' → '+esc(a.endSeason||d.currentSeason)+'</p></div>'+
      '<div class="quick-grid section">'+(isP?stat("Gol",t.goals)+stat("Asist",t.assists)+stat("Kupa",t.trophies)+stat("Rekor",d.completedRecords.length):stat("Galibiyet",t.wins)+stat("Kupa",t.trophies)+stat("Kariyer Puanı",s.points)+stat("Rekor",d.completedRecords.length))+'</div>'+
      '<div class="section panel"><h3>Hikâye</h3>'+storyList(isP?playerStories(d):managerStories(d))+'</div>');
  }

  function settingsPage(){
    const snaps=getSnapshots();
    return '<section class="hero" style="padding-bottom:10px"><div class="eyebrow">⚙️ VERİ VE AYARLAR</div><h1 style="font-size:clamp(34px,5vw,56px)">Kariyerini <em>koru.</em></h1><p>Verilerin ücretsiz olarak bu cihazdaki tarayıcıda tutulur. JSON yedeğini indirirsen cihaz değiştirsen bile geri yükleyebilirsin.</p></section>'+
      '<div class="two-col"><div class="panel"><h3>Yedekleme</h3><div class="switchline"><div><strong>JSON Yedeği İndir</strong><div class="list-sub">Tüm aktif ve arşiv kariyerlerini tek dosya yapar.</div></div><button class="btn primary" id="exportJson">İndir</button></div>'+
      '<div class="switchline"><div><strong>JSON Yedeği Geri Yükle</strong><div class="list-sub">Mevcut verilerin üzerine yazar; önce otomatik snapshot alınır.</div></div><label class="btn"><input id="importJson" type="file" accept=".json,application/json" hidden>Dosya Seç</label></div>'+
      '<div class="switchline"><div><strong>Yeni Özel Kulüp</strong><div class="list-sub">Seed listesinde olmayan herhangi bir kulübü ekle.</div></div><button class="btn" id="addCustomClub">Kulüp Ekle</button></div></div>'+
      '<div class="panel"><h3>Yerel Snapshotlar</h3>'+(snaps.length?'<div class="list">'+snaps.map(s=>'<div class="list-row"><div class="list-main"><div class="list-title">'+esc(s.date)+'</div><div class="list-sub">'+new Date(s.createdAt).toLocaleString("tr-TR")+'</div></div><button class="btn sm" data-restore-snap="'+s.id+'">Geri Yükle</button></div>').join("")+'</div>':'<div class="empty">Henüz snapshot yok.</div>')+'</div></div>'+
      '<div class="section danger-zone"><h3>Aktif Kariyerleri Silme</h3><p>Silinen kariyer arşive gitmez. İki kez onay ister.</p><div class="list-actions" style="justify-content:flex-start">'+(state.activePlayer?'<button class="btn danger" id="deletePlayer">Aktif Oyuncu Kariyerini Sil</button>':'')+(state.activeManager?'<button class="btn danger" id="deleteManager">Aktif Hoca Kariyerini Sil</button>':'')+'</div></div>';
  }
  function customClubModal(){
    modal("Özel Kulüp Ekle",'<form id="customClubForm"><div class="form-grid">'+field("Kulüp Adı","name","text","",true)+field("Ülke","country","text","Türkiye",true)+field("Lig","league","text","Özel Lig",false)+'<div class="field"><label>Kulüp Ölçeği</label><select class="select" name="tier"><option value="1">1 — Dünya devi</option><option value="2">2 — Büyük</option><option value="3" selected>3 — Orta</option><option value="4">4 — Küçük</option><option value="5">5 — Alt lig / mütevazı</option></select></div></div><div class="modal-actions"><button type="button" class="btn ghost" data-close>Vazgeç</button><button class="btn primary">Ekle</button></div></form>',
    m=>$("#customClubForm",m).onsubmit=e=>{e.preventDefault();const f=new FormData(e.currentTarget);state.customClubs.push({id:uid("custom-club"),name:f.get("name"),country:f.get("country"),league:f.get("league"),tier:num(f.get("tier")),confederation:"Özel"});save("Özel kulüp eklendi");closeModal();render();});
  }

  function bindPlayerActions(){
    if(view!=="player"||!state.activePlayer)return;const p=state.activePlayer;
    const a=$("#addPlayerSeason");if(a)a.onclick=()=>playerSeasonModal();
    $$("[data-edit-player-season]").forEach(b=>b.onclick=()=>playerSeasonModal(p.seasons.find(x=>x.id===b.dataset.editPlayerSeason)));
    $$("[data-del-player-season]").forEach(b=>b.onclick=()=>{if(confirm("Bu sezon kaydını silmek istediğine emin misin?")){p.seasons=p.seasons.filter(x=>x.id!==b.dataset.delPlayerSeason);save("Sezon silindi");render()}});
    const tr=$("#addPlayerTransfer");if(tr)tr.onclick=playerTransferModal;
    $$("[data-del-player-transfer]").forEach(b=>b.onclick=()=>{if(confirm("Transfer kaydı silinsin mi?")){p.transfers=p.transfers.filter(x=>x.id!==b.dataset.delPlayerTransfer);save("Transfer silindi");render()}});
    const tw=$("#addTrophyWin");if(tw)tw.onclick=()=>trophyWinModal("player");
    bindRecordActions("player",p);
    const aw=$("#addAwardWin");if(aw)aw.onclick=awardModal;
    $$("[data-del-award]").forEach(b=>b.onclick=()=>{p.awardWins=p.awardWins.filter(x=>x.id!==b.dataset.delAward);save("Ödül silindi");render()});
    const de=$("#newDecision");if(de)de.onclick=decisionModal;
    const rt=$("#retirePlayer");if(rt)rt.onclick=()=>retireCareer("player");
  }

  function bindManagerActions(){
    if(view!=="manager"||!state.activeManager)return;const m=state.activeManager;
    const s=$("#addManagerSeason");if(s)s.onclick=()=>managerSeasonModal();
    $$("[data-edit-manager-season]").forEach(b=>b.onclick=()=>managerSeasonModal(m.seasons.find(x=>x.id===b.dataset.editManagerSeason)));
    $$("[data-del-manager-season]").forEach(b=>b.onclick=()=>{if(confirm("Bu sezon silinsin mi?")){m.seasons=m.seasons.filter(x=>x.id!==b.dataset.delManagerSeason);save("Sezon silindi");render()}});
    const tr=$("#addManagerTransfer");if(tr)tr.onclick=managerTransferModal;
    $$("[data-del-manager-transfer]").forEach(b=>b.onclick=()=>{if(confirm("Transfer yatırımı silinsin mi?")){m.transfers=m.transfers.filter(x=>x.id!==b.dataset.delManagerTransfer);save("Transfer kaydı silindi");render()}});
    const ac=$("#addAcademy");if(ac)ac.onclick=academyModal;
    $$("[data-del-academy]").forEach(b=>b.onclick=()=>{m.academy=m.academy.filter(x=>x.id!==b.dataset.delAcademy);save("Akademi kaydı silindi");render()});
    const lg=$("#addLegend");if(lg)lg.onclick=legendModal;
    const tw=$("#addTrophyWin");if(tw)tw.onclick=()=>trophyWinModal("manager");
    const cc=$("#changeClub");if(cc)cc.onclick=changeClubModal;
    bindRecordActions("manager",m);
    const nj=$("#addNationalJob");if(nj)nj.onclick=nationalModal;
    $$("[data-del-national]").forEach(b=>b.onclick=()=>{m.nationalJobs=m.nationalJobs.filter(x=>x.id!==b.dataset.delNational);save("Milli takım görevi silindi");render()});
    const rt=$("#retireManager");if(rt)rt.onclick=()=>retireCareer("manager");
  }

  function bindRecordActions(scope,career){
    const s=$("#recordSearch");if(s)s.oninput=()=>{recordFilter.search=s.value;render();};
    const c=$("#recordCategory");if(c)c.onchange=()=>{recordFilter.category=c.value;render();};
    $$("[data-target-record]").forEach(b=>b.onclick=()=>{const id=b.dataset.targetRecord;career.recordTargets=career.recordTargets.includes(id)?career.recordTargets.filter(x=>x!==id):[...career.recordTargets,id];save("Rekor hedefleri güncellendi");render();});
    $$("[data-done-record]").forEach(b=>b.onclick=()=>{const id=b.dataset.doneRecord;career.completedRecords=career.completedRecords.includes(id)?career.completedRecords.filter(x=>x!==id):[...career.completedRecords,id];save("Rekor durumu güncellendi");render();});
    const ar=$("#addCustomRecord");if(ar)ar.onclick=()=>customRecordModal(scope);
  }

  function retireCareer(type){
    if(!confirm("Kariyeri emekli edip Efsaneler Arşivi'ne taşımak istiyor musun? Bu kariyer artık aktif olmayacak."))return;
    const data=JSON.parse(JSON.stringify(type==="player"?state.activePlayer:state.activeManager));
    const item={id:uid("archive"),retiredAt:new Date().toISOString(),endSeason:data.currentSeason,data};
    state.archives[type].push(item); if(type==="player")state.activePlayer=null;else state.activeManager=null;
    save("Kariyer Efsaneler Arşivi'ne taşındı");view="archive";tab="overview";render();toast("Kariyer arşivlendi 🏛️");
  }

  function bindArchiveActions(){
    if(view!=="archive")return;$$("[data-view-archive]").forEach(b=>b.onclick=()=>archiveDetail(b.dataset.viewArchive));
  }
  function bindSettingsActions(){
    if(view!=="settings")return;
    const ex=$("#exportJson");if(ex)ex.onclick=exportJson;
    const im=$("#importJson");if(im)im.onchange=importJson;
    const cc=$("#addCustomClub");if(cc)cc.onclick=customClubModal;
    $$("[data-restore-snap]").forEach(b=>b.onclick=()=>{const s=getSnapshots().find(x=>x.id===b.dataset.restoreSnap);if(s&&confirm(s.date+" tarihli yedek geri yüklensin mi?")){state=s.state;save("Snapshot geri yüklendi");render();}});
    const dp=$("#deletePlayer");if(dp)dp.onclick=()=>deleteActive("player");
    const dm=$("#deleteManager");if(dm)dm.onclick=()=>deleteActive("manager");
  }
  function deleteActive(type){
    if(!confirm("DİKKAT: Bu aktif kariyer Efsaneler Arşivi'ne gitmeden silinecek. Devam?"))return;
    if(!confirm("Son onay: Bu işlem geri alınamaz. Yine de sil?"))return;
    if(type==="player")state.activePlayer=null;else state.activeManager=null;save("Aktif kariyer silindi");render();toast("Kariyer silindi");
  }
  function exportJson(){
    const blob=new Blob([JSON.stringify({app:"BTA KARİYER TAKİBİ",exportedAt:new Date().toISOString(),state},null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="BTA-Kariyer-Yedek-"+today()+".json";a.click();URL.revokeObjectURL(a.href);toast("JSON yedeği indirildi");
  }
  function importJson(e){
    const f=e.target.files?.[0];if(!f)return;const r=new FileReader();
    r.onload=()=>{try{const j=JSON.parse(r.result),s=j.state||j;if(!s||s.version!==1)throw new Error();const snaps=getSnapshots();snaps.unshift({id:uid("snap"),date:today(),createdAt:new Date().toISOString(),state:JSON.parse(JSON.stringify(state))});localStorage.setItem(SNAP_KEY,JSON.stringify(snaps.slice(0,8)));state=s;save("JSON yedeği geri yüklendi");render();toast("Yedek başarıyla geri yüklendi");}catch(err){toast("Bu dosya geçerli bir BTA yedeği değil.","err")}};r.readAsText(f);
  }

  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
  app();
})();
