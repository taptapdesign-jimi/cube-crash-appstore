/* Development-only audit of captured Native typography. Does not change the app. */
let titleMode=false,titleSize='',titleFamily='';
function headingFamily(s,t){
 if(t.button||s.category==='Effects'||s.id.includes('cleared')||/^\+?[\d., /]+$/.test(t.text)||t.text==='TAP TO COLLECT')return '';
 if(s.category==='Backpack · Kockice details'&&t.size>=28)return 'Kockice details';
 if(t.role==='Navigacijski naslov')return 'Navigacija';
 if(t.role==='Naslov sekcije')return 'Sekcije';
 if(s.id.startsWith('reward')&&t.size>=40)return 'Reward hero';
 if(s.id.startsWith('result')&&t.size>=40)return 'Result hero';
 if(t.role==='Naslov modala'||(s.category==='Modal'&&t.size>=28))return 'Modal';
 if(t.size>=28&&t.text.length>1)return s.id.includes('tutorial')?'Tutorial':'Ostali naslovi';
 return '';
}
const headings=data.flatMap(s=>s.texts.map(t=>({s,t,family:headingFamily(s,t)}))).filter(x=>x.family);
const auditPanel=document.createElement('section');auditPanel.className='audit';auditPanel.id='title-audit';
auditPanel.innerHTML=`<h2>Titlovi po veličini</h2><p>Odaberi veličinu i vidi točno gdje se koristi — svaki red vodi do označenog naslova na originalnoj snimci. Veličine prikazujemo u <b>px</b> kao logičke dizajnerske vrijednosti. Brojevi ostaju isti; Native pretvorbu preuzimam ja.</p><div class="audit-controls"><button id="all-elements" aria-pressed="true">Svi elementi</button><button id="titles-mode" aria-pressed="false">Samo titlovi</button><select id="title-family" aria-label="Obitelj naslova"><option value="">Sve obitelji naslova</option>${[...new Set(headings.map(x=>x.family))].map(f=>`<option>${esc(f)}</option>`).join('')}</select></div><div class="size-chips" id="title-sizes"></div><p id="title-summary" class="audit-summary"></p><div id="title-comparison" class="audit-table"></div><details open><summary>Usklađenost: preporuke i namjerne razlike</summary><p>Procjena se odnosi na ovu snimku biblioteke. Uspoređuju se iste uloge; veći hero naslov nije automatski pogreška. Pozadinski navigacijski naslovi iza modala izostavljeni su; uspoređuje se samo sadržaj modala. Aplikacija nije izmijenjena.</p><div class="audit-findings"><article class="finding"><strong>Navigacija · veličina usklađena</strong><p>Svi navigacijski naslovi: 28 px prema tvojoj odluci. Journey, Arcade i svjetovi koriste ExtraBold #AD8775; Settings i Backpack Bold. Settings također koristi #AD8775. Veličina i boja su usklađene; težina ostaje različita.</p><button data-audit-jump="settings">Pogledaj Settings</button><button data-audit-jump="backpack">Pogledaj Backpack</button></article><article class="finding"><strong>Modal · nekoliko veličina</strong><p>Stage, Backpack info i Arcade opcije: 28 px. Exit i drugi standardni modali mogu ostati 32 px; Stage grupa usklađena je prema tvojoj odluci.</p><button data-audit-family="Modal">Usporedi modale</button></article><article class="finding"><strong>Modal · sitna HEX razlika</strong><p>#AD8675 i #AD8775 razlikuju se za samo 1 u zelenom kanalu. Vrlo blago odstupanje; kandidat za zajednički token boje.</p><button id="copy-title-audit">Copy audit prompt</button></article><article class="finding intentional"><strong>Namjerna hijerarhija · bez alarma</strong><p>Reward 44 px; result 40 / 56 px; sekcija 28 px. Različite uloge opravdavaju različite veličine. Narančasti tutorial, Wee Bee naglasak i animirani CLEARED glifovi nisu standardni smeđi modalni naslovi.</p></article></div></details>`;
document.querySelector('.intro').after(auditPanel);
const titleToolbar=document.createElement('button');titleToolbar.className='title-mode-button';titleToolbar.textContent='Titlovi po veličini';titleToolbar.onclick=()=>{setTitleMode(true);auditPanel.scrollIntoView({behavior:'smooth',block:'start'})};document.querySelector('.toolbar').append(titleToolbar);
function titleAuditMatches(s,t){return !titleMode||!!headingFamily(s,t)&&(!titleSize||Math.abs(t.size-Number(titleSize))<.001)&&(!titleFamily||headingFamily(s,t)===titleFamily)}
function setTitleMode(value){titleMode=value;if(value){$('#ctas').checked=false;$('#category').value='';$('#search').value=''}filter()}
function auditBadge(x){if(x.family==='Navigacija')return x.t.size!==28?'Odstupanje veličine':!x.t.font.includes('ExtraBold')||x.t.color!=='#AD8775'?'28 px usklađeno · druga težina / boja':'Usklađeno · 28 / ExtraBold';if(x.t.text.startsWith('Stage '))return 'Usklađena Stage grupa · 28 px';if(x.s.id.startsWith('arcade-mode-'))return 'Usklađena Arcade grupa · 28 px';if(x.family==='Modal')return x.t.size!==32?'Provjeriti veličinu':x.t.color==='#AD8675'?'Sitna HEX razlika':'Standard / semantička boja';return 'Zasebna hijerarhija'}
function refreshTitleAudit(){
 $('#all-elements').setAttribute('aria-pressed',String(!titleMode));$('#titles-mode').setAttribute('aria-pressed',String(titleMode));
 const sizes=[...new Set(headings.filter(x=>!titleFamily||x.family===titleFamily).map(x=>x.t.size))].sort((a,b)=>a-b);
 $('#title-sizes').innerHTML=[['','Sve veličine'],...sizes.map(n=>[n,`${fmt(n)} px`])].map(([n,label])=>`<button data-title-size="${n}" aria-pressed="${titleMode&&String(n)===titleSize}">${label} <small>(${headings.filter(x=>(!titleFamily||x.family===titleFamily)&&(!n||x.t.size===n)).length})</small></button>`).join('');
 const rows=headings.filter(x=>!document.getElementById(x.t.id).classList.contains('hidden'));
 $('#title-summary').textContent=titleMode?`${rows.length} lokacija naslova${titleSize?' · točno '+fmt(titleSize)+' px':''}${titleFamily?' · '+titleFamily:''}`:'Uključi „Samo titlovi” ili odaberi veličinu za usporedbu.';
 $('#title-comparison').innerHTML=!titleMode?'':rows.length?`<table><thead><tr><th>Stvarni izrez</th><th>Naslov / lokacija</th><th>Font / boja</th><th>Usporedba iste uloge</th></tr></thead><tbody>${rows.map(({s,t,family})=>{const r=t.rect,x=Math.max(0,r.x-6),y=Math.max(0,r.y-5);return `<tr><td><svg class="audit-preview" viewBox="${x} ${y} ${Math.min(390-x,r.width+12)} ${r.height+10}" role="img" aria-label="${esc(t.text)} na ${esc(s.name)}"><image href="${s.screenshot}" width="390" height="844"/></svg></td><td><b>${esc(t.text)}</b><small>${esc(s.name)} · ${family}</small><small>${esc(s.route)}</small><small>${esc(t.reference)} · x ${fmt(r.x)}, y ${fmt(r.y)}</small><button class="locate" data-title-locate="${t.id}">Označi na ekranu ↘</button></td><td>${fmt(t.size)} px · ${esc(t.font)}<small>${esc(t.colorDescription)}</small></td><td>${auditBadge({s,t,family})}</td></tr>`}).join('')}</tbody></table>`:'<p>Nema naslova za odabrane filtre.</p>';
}
$('#all-elements').onclick=()=>{titleSize='';titleFamily='';$('#title-family').value='';setTitleMode(false)};
$('#titles-mode').onclick=()=>setTitleMode(true);
$('#title-family').onchange=e=>{titleFamily=e.target.value;titleSize='';setTitleMode(true)};
auditPanel.addEventListener('click',e=>{const size=e.target.closest('[data-title-size]'),loc=e.target.closest('[data-title-locate]'),jump=e.target.closest('[data-audit-jump]'),family=e.target.closest('[data-audit-family]');if(size){titleSize=size.dataset.titleSize;setTitleMode(true)}if(loc){const pair=find(loc.dataset.titleLocate);select(...pair,true);history.replaceState(null,'','#'+pair[1].id)}if(jump){titleSize='';titleFamily='Navigacija';$('#title-family').value=titleFamily;setTitleMode(true);const pair=headings.find(x=>x.s.id===jump.dataset.auditJump);select(pair.s,pair.t,true)}if(family){titleFamily=family.dataset.auditFamily;titleSize='';$('#title-family').value=titleFamily;setTitleMode(true)}});
$('#copy-title-audit').onclick=()=>copy(`Stack to Six Native — title consistency audit, snapshot 2026-10-26\nCompare same semantic roles; preserve deliberate hero hierarchy.\nNavigation: all titles 28 logical px. Journey / Arcade / world titles Baloo2-ExtraBold #AD8775; Settings / Backpack Baloo2-Bold; Settings #AD8775. Size standardized by user; font weights and colors preserved.\nModals: Stage 28 px, numbers 28 px, stat labels 18 px; Exit 32 px; Backpack info 28 px; Arcade options 28 px (intentional group standard). Browns #AD8675 vs #AD8775 differ by one green-channel value.\nReference: DESIGN SYSTEM → Titlovi po veličini.\nChange requested: [TYPE WHAT YOU WANT TO CHANGE HERE]`);
$('#search').addEventListener('input',e=>{const m=e.target.value.trim().match(/^(?:titlovi|naslovi|titles)(?:\s+(\d+)(?:\s*px)?)?$/i)||e.target.value.trim().match(/^(\d+)\s*px$/i);if(m){titleSize=m[1]||'';setTitleMode(true)}});
refreshTitleAudit();
$('#ctas').addEventListener('change',()=>{if($('#ctas').checked){titleMode=false;titleSize='';titleFamily='';$('#title-family').value='';filter()}});
// Sidebar destinations must remain reachable even when hidden by audit/search filters.
$('#nav').addEventListener('click',e=>{
 const link=e.target.closest('a[href^="#"]');if(!link)return;
 const scene=data.find(s=>s.id===decodeURIComponent(link.getAttribute('href').slice(1)));if(!scene)return;
 e.preventDefault();
 titleMode=false;titleSize='';titleFamily='';$('#title-family').value='';
 $('#search').value='';$('#category').value='';$('#ctas').checked=false;filter();
 const target=scene.texts.find(t=>scene.category==='CTA'&&t.button?.kind==='CTA')||scene.texts.find(t=>t.role==='Naslov modala')||scene.texts.find(t=>t.role==='Navigacijski naslov')||scene.texts[0];
 if(target)select(scene,target);
 document.getElementById(scene.id).scrollIntoView({behavior:'instant',block:'start'});
 history.replaceState(null,'','#'+scene.id);
 $('#nav').querySelectorAll('a').forEach(a=>{if(a===link)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});
});
