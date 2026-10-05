import {
  JIMI_HOME_SLIDES, JIMI_LOGO_ASSET, JIMI_HOME_SHARDS, JIMI_HUB_WORLDS, JIMI_HUB_CLOUDS, JIMI_HUB_BANNERS,
  JIMI_BEACH_MAIN, JIMI_BEACH_UNITS, JIMI_INTERIM_ASSET, JIMI_CARD_BACK_ASSETS,
  type JimiImageSpec, type JimiBoardSnapshot, type JimiProgressSnapshot, type JimiCardArt,
} from './scene-catalog.js';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node=document.createElement(tag); node.className=className; if(text!==undefined) node.textContent=text; return node;
}
function button(action:string,label:string,className='jimi-button'): HTMLButtonElement {
  const node=element('button',className,label); node.type='button'; node.dataset.jimiAction=action; return node;
}
function image(src:string,className:string,alt='',src2x?:string):HTMLImageElement {
  const node=element('img',className); node.src=src; node.alt=alt; node.draggable=false; node.decoding='async';
  if(src2x) node.srcset=`${encodeURI(src)} 1x, ${encodeURI(src2x)} 2x`; return node;
}
function place(node:HTMLElement,x:number,y:number,width:number,height?:number):void {
  Object.assign(node.style,{position:'absolute',left:`${x}px`,top:`${y}px`,width:`${width}px`});
  if(height!==undefined) node.style.height=`${height}px`;
}
function art(spec:JimiImageSpec,className:string,layer:number):HTMLImageElement {
  const node=image(spec.src,`jimi-art ${className}`,'',spec.src2x); place(node,spec.x,spec.y,spec.width);
  node.style.zIndex=String(layer); node.style.pointerEvents='none';
  if(spec.rotation) node.style.transform=`rotate(${spec.rotation}deg)`;
  if(spec.opacity!==undefined) node.style.opacity=String(spec.opacity); return node;
}
function scene(name:string,title:string,backAction?:string):HTMLElement {
  const root=element('section',`jimi-scene jimi-${name}`); root.dataset.jimiScene=name; root.setAttribute('aria-label',title);
  if(backAction) { const header=element('header','jimi-scene-header'); header.dataset.jimiUnit='header';
    header.append(button(backAction,'Back','jimi-back-button'),element('h1','jimi-scene-title',title)); root.append(header); }
  return root;
}
function map(root:HTMLElement,height:number):HTMLElement {
  const scroll=element('div','jimi-scroll'); const content=element('div','jimi-map'); content.style.height=`${height}px`;
  scroll.append(content); root.append(scroll); return content;
}

export function buildHomeScene():HTMLElement {
  const root=scene('home','Stack to Six'); root.dataset.slideId='journey';
  const logo=element('div','jimi-home-logo'); logo.dataset.jimiUnit='logo';
  for(const shard of JIMI_HOME_SHARDS) logo.append(image(shard.src,`jimi-logo-shard jimi-logo-shard-${shard.slot}`));
  logo.append(image(JIMI_LOGO_ASSET,'jimi-logo-image','Stack to Six')); root.append(logo);
  const slides=element('div','jimi-home-slides'); const tabs=element('nav','jimi-home-tabs'); tabs.setAttribute('aria-label','Homepage');
  for(const slide of JIMI_HOME_SLIDES) {
    const panel=element('section','jimi-home-slide'); panel.dataset.slideId=slide.id; panel.hidden=slide.id!=='journey';
    const hero=button(slide.action,'','jimi-home-hero'); hero.setAttribute('aria-label',slide.label); hero.dataset.jimiUnit=`hero-${slide.id}`;
    const heroImage=image(slide.asset,'jimi-hero-image',slide.label,slide.asset.replace('.png','@2x.png'));
    heroImage.srcset+=`, ${encodeURI(slide.asset.replace('.png','@3x.png'))} 3x`; hero.append(heroImage);
    const cta=button(slide.action,slide.label,'jimi-primary-button'); cta.dataset.jimiUnit=`cta-${slide.id}`;
    panel.append(hero,element('p','jimi-home-tagline',slide.tagline),cta); slides.append(panel);
    const tab=button('home-slide',slide.label,'jimi-home-tab'); tab.dataset.slideId=slide.id; tab.setAttribute('aria-pressed',String(slide.id==='journey')); tabs.append(tab);
  }
  tabs.dataset.jimiUnit='navigation'; root.append(slides,tabs); return root;
}

export function buildHubScene(progress:JimiProgressSnapshot):HTMLElement {
  const root=scene('hub','Worlds','home'); const content=map(root,820);
  for(const world of JIMI_HUB_WORLDS) {
    const x=world.hub.side==='left'?world.hub.edgePx:390-world.hub.edgePx-world.hub.widthPx;
    const unit=button('open-world','','jimi-hub-world'); unit.dataset.jimiUnit=`world-${world.id}`; unit.dataset.worldId=String(world.id);
    unit.setAttribute('aria-label',world.name); place(unit,x,world.hub.topPx,world.hub.widthPx,world.hub.heightPx);
    for(const cloud of JIMI_HUB_CLOUDS.filter(c=>c.worldId===world.id)) unit.append(art({...cloud,x:cloud.x-x,y:cloud.y-world.hub.topPx},'jimi-cloud',0));
    const bannerSpec=JIMI_HUB_BANNERS[world.id as 1|2|3]; const banner=element('span','jimi-hub-banner');
    place(banner,bannerSpec.x,bannerSpec.y,bannerSpec.width,bannerSpec.width*49/105); banner.style.transform=`rotate(${bannerSpec.rotation}deg)`;
    const flag=image(world.hub.bannerAsset,'jimi-hub-flag','',world.hub.bannerAsset2x); if(bannerSpec.mirrored) flag.style.transform='scaleX(-1)';
    const states=Array.from({length:10},(_,i)=>progress[(world.id-1)*10+i+1]);
    const known=states.every(Boolean); const complete=states.filter(state=>state?.unlocked===true && state.interim!==true).length;
    unit.dataset.progressKnown=String(known); banner.append(flag,element('span','jimi-hub-count',known?`${complete}/10`:'—/10'));
    const mainArt=art({src:world.asset,src2x:world.asset2x,x:0,y:0,width:world.hub.widthPx},'jimi-hub-image',2);
    mainArt.style.height=`${world.hub.heightPx}px`; mainArt.style.objectFit='contain';
    unit.append(banner,mainArt); content.append(unit);
  }
  return root;
}

export function buildBeachScene(progress:JimiProgressSnapshot):HTMLElement {
  const root=scene('beach','Beach','hub'); root.dataset.worldId='2'; const content=map(root,1900);
  const main=element('div','jimi-beach-main'); main.dataset.jimiUnit='beach-main'; place(main,JIMI_BEACH_MAIN.x,JIMI_BEACH_MAIN.y,390,390);
  for(const cloud of JIMI_BEACH_MAIN.clouds) main.append(art(cloud,'jimi-cloud',0));
  main.append(art({...JIMI_BEACH_MAIN,x:0,y:0},'jimi-beach-main-image',2)); content.append(main);
  for(const spec of JIMI_BEACH_UNITS) {
    const state=progress[spec.boardId]; const completed=state?.unlocked===true; const interim=!completed&&state?.interim===true;
    const unit=element('div','jimi-beach-unit'); unit.dataset.jimiUnit=`board-${spec.boardId}`; unit.dataset.boardId=String(spec.boardId); place(unit,spec.x,spec.y,spec.width,200);
    for(const cloud of spec.clouds) unit.append(art(cloud,'jimi-cloud',0)); unit.append(art(spec.island,'jimi-island',1),art(spec.prop,'jimi-prop',3));
    if(completed||interim) for(const [index,star] of spec.stars.entries()) unit.append(art({...star,src:completed&&index<Math.max(0,Math.min(3,state!.stars))?star.filled:star.empty},'jimi-level-star',4));
    const card=button(completed?'open-card':interim?'play-board':'locked-card','','jimi-board-card'); card.dataset.boardId=String(spec.boardId); card.dataset.presentation=completed?'unlocked':interim?'interim':'locked'; card.dataset.progressKnown=String(!!state);
    place(card,spec.card.x,spec.card.y,spec.card.width,spec.card.height); card.style.transform=`rotate(${spec.card.rotation}deg)`; card.style.zIndex='5';
    card.setAttribute('aria-label',completed?state!.card.name:`Beach Stage ${String(spec.stage).padStart(2,'0')}${interim?' Play':state?' Locked':' Progress unavailable'}`);
    if(completed) card.append(image(state!.card.src,'jimi-card-image',state!.card.name,state!.card.src2x));
    else if(interim) card.append(image(JIMI_INTERIM_ASSET,'jimi-card-image','Play',JIMI_INTERIM_ASSET.replace('.png','@2x.png')));
    else { card.disabled=true; card.append(element('span','jimi-stage-number',String(spec.stage).padStart(2,'0'))); }
    unit.append(card); content.append(unit);
  }
  return root;
}

function buildKnownCardScene(boardId:number,card:JimiCardArt,stars:number|null,preview:boolean):HTMLElement {
  const root=scene('card',preview?'Artwork preview':card.name,'close-card'); root.dataset.boardId=String(boardId);
  if(preview) { root.dataset.preview='true'; root.append(element('p','jimi-preview-label','Artwork preview — not an unlocked reward')); }
  const stage=element('div','jimi-card-stage'); stage.dataset.jimiUnit='detail-card';
  const rotor=element('div','jimi-card-rotor');
  const front=button('flip-card','','jimi-card-front'); front.setAttribute('aria-label',`Flip ${card.name}`); front.append(image(card.src,'jimi-card-image',card.name,card.src2x));
  const back=button('flip-card','','jimi-card-back'); back.setAttribute('aria-label','Show card artwork');
  back.append(image(JIMI_CARD_BACK_ASSETS[card.rarity],'jimi-card-back-image'),element('strong','jimi-card-name',card.name));
  if(stars!==null) back.append(element('span','jimi-card-stars',`${Math.max(0,Math.min(3,stars))} / 3 stars`));
  rotor.append(front,back); stage.append(rotor); root.append(stage);
  if(!preview) { const play=button('play-board','Play','jimi-primary-button'); play.dataset.boardId=String(boardId); play.dataset.jimiUnit='detail-cta'; root.append(play); }
  return root;
}

export function buildCardScene(boardId:number,board:JimiBoardSnapshot|undefined):HTMLElement {
  if(board?.unlocked) return buildKnownCardScene(boardId,board.card,board.stars,false);
  const root=scene('card','Card unavailable','close-card'); root.dataset.boardId=String(boardId);
  root.append(element('p','jimi-card-unavailable','This card is not unlocked.')); return root;
}

/** A separately labelled art inspection surface; never creates an unlock or a Play route. */
export function buildCardPreviewScene(boardId:number,card:JimiCardArt):HTMLElement {
  return buildKnownCardScene(boardId,card,null,true);
}
