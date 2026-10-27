/* Compact category navigation; every title is a keyboard-accessible accordion. */
(()=>{
 const nav=document.getElementById('nav');
 for(const [index,heading] of [...nav.querySelectorAll(':scope > strong')].entries()){
  const links=[];let next=heading.nextElementSibling;
  while(next&&next.tagName==='A'){links.push(next);next=next.nextElementSibling}
  const button=document.createElement('button');button.type='button';button.className='nav-group-toggle';button.innerHTML=`<span>${esc(heading.textContent)}</span><span class="nav-chevron" aria-hidden="true">⌄</span>`;
  const body=document.createElement('div');body.className='nav-group-body';body.id='nav-group-'+index;
  button.setAttribute('aria-controls',body.id);button.setAttribute('aria-expanded','true');heading.replaceWith(button);button.after(body);links.forEach(a=>body.append(a));
  button.onclick=()=>{body.hidden=!body.hidden;button.setAttribute('aria-expanded',String(!body.hidden))};
  if(links.length>1&&links.every(a=>a.getAttribute('href').startsWith('#dice-detail'))){
   const more=document.createElement('div');more.id='nav-dice-more';more.className='nav-dice-more';more.hidden=true;links.slice(1).forEach(a=>more.append(a));
   const toggle=document.createElement('button');toggle.type='button';toggle.className='nav-see-all';toggle.setAttribute('aria-controls',more.id);toggle.setAttribute('aria-expanded','false');
   function expanded(value){more.hidden=!value;toggle.setAttribute('aria-expanded',String(value));toggle.textContent=value?'Prikaži manje ↑':`Vidi sve kockice (${links.length}) ↓`}
   links[0].after(toggle,more);toggle.onclick=()=>expanded(more.hidden);
   expanded(links.slice(1).some(a=>a.getAttribute('href')===location.hash||a.getAttribute('href')===('#'+location.hash.slice(1).split('-text-')[0])));
  }
 }
})();
