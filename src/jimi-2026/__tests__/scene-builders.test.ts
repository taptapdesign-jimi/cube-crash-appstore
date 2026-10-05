import fs from 'node:fs';
import path from 'node:path';
import { buildHomeScene, buildHubScene, buildBeachScene, buildCardScene, buildCardPreviewScene } from '../scene-builders';
import { JIMI_BEACH_UNITS, JIMI_BEACH_MAIN, JIMI_HUB_CLOUDS, JIMI_HOME_SLIDES, type JimiBoardSnapshot, type JimiProgressSnapshot } from '../scene-catalog';
import { resolveJourneyCardAsset } from '../../modules/journey-card-assets';

function completed(boardId:number,stars=2):JimiBoardSnapshot {
  const asset=resolveJourneyCardAsset(boardId,0);
  return Object.freeze({unlocked:true,interim:false,stars,viewed:true,card:Object.freeze({src:asset.path1x,src2x:asset.path2x,name:'Fishy',rarity:asset.rarity})});
}

test('Home has three original art/CTA slides and semantic selector buttons, only Journey initially visible',()=>{
  const root=buildHomeScene();
  expect(root.dataset.jimiScene).toBe('home');
  expect([...root.querySelectorAll<HTMLElement>('.jimi-home-slide')].map(el=>[el.dataset.slideId,el.hidden])).toEqual([['journey',false],['arcade',true],['settings',true]]);
  expect([...root.querySelectorAll('.jimi-home-tab')].map(el=>el.textContent)).toEqual(['Journey','Arcade','Settings']);
  for(const slide of JIMI_HOME_SLIDES) {
    const panel=root.querySelector(`[data-slide-id="${slide.id}"].jimi-home-slide`)!;
    expect(panel.querySelector('img')!.getAttribute('src')).toBe(slide.asset);
    expect(panel.querySelector('.jimi-primary-button')!.getAttribute('data-jimi-action')).toBe(slide.action);
  }
  expect(root.querySelector('.jimi-logo-image')!.getAttribute('src')).toBe('./assets/logo-cube-crash.png');
});

test('Hub keeps canonical Forest/Area55/Beach order, authored flags and all thirteen clouds without inventing progress',()=>{
  const root=buildHubScene({});
  expect([...root.querySelectorAll<HTMLElement>('.jimi-hub-world')].map(el=>el.dataset.worldId)).toEqual(['1','3','2']);
  expect(root.querySelectorAll('.jimi-cloud')).toHaveLength(13);
  expect(JIMI_HUB_CLOUDS).toHaveLength(13);
  expect([...root.querySelectorAll('.jimi-hub-count')].map(el=>el.textContent)).toEqual(['—/10','—/10','—/10']);
  expect(root.querySelector('[data-world-id="3"] .jimi-hub-flag')!.getAttribute('style')).toContain('scaleX(-1)');
});

test('Beach contains main plus ten complete Units, all original island/prop/cloud assets, and authored positions',()=>{
  const root=buildBeachScene({});
  expect(root.querySelectorAll('.jimi-beach-unit')).toHaveLength(10);
  expect(root.querySelectorAll('.jimi-cloud')).toHaveLength(37);
  expect(JIMI_BEACH_MAIN.y).toBe(122);
  expect(JIMI_BEACH_UNITS[0]).toMatchObject({boardId:11,x:18,y:488,card:{x:18,y:-71,width:90,height:133,rotation:-6}});
  expect(JIMI_BEACH_UNITS[9]).toMatchObject({boardId:20,x:194,y:1604,card:{x:32,y:-57}});
  for(const unit of JIMI_BEACH_UNITS) {
    expect(unit.island.src).toContain([2,5,8].includes(unit.stage)?`beach-beach${unit.stage}.png`:`beach-water${unit.stage}.png`);
    const card=root.querySelector<HTMLButtonElement>(`.jimi-board-card[data-board-id="${unit.boardId}"]`)!;
    expect(card.disabled).toBe(true); expect(card.dataset.progressKnown).toBe('false'); expect(card.querySelector('img')).toBeNull();
  }
});

test('injected completed/interim/locked states select one semantic action and do not mutate the snapshot',()=>{
  const first=completed(11); const second=Object.freeze({...completed(12),unlocked:false,interim:true});
  const progress:JimiProgressSnapshot=Object.freeze({11:first,12:second}); const before=JSON.stringify(progress);
  const root=buildBeachScene(progress);
  expect(root.querySelector('.jimi-board-card[data-board-id="11"]')!.getAttribute('data-jimi-action')).toBe('open-card');
  expect(root.querySelector('.jimi-board-card[data-board-id="12"]')!.getAttribute('data-jimi-action')).toBe('play-board');
  expect(root.querySelector('[data-jimi-unit="board-11"] .jimi-card-image')!.getAttribute('src')).toBe(first.card.src);
  expect(root.querySelector('[data-jimi-unit="board-12"] .jimi-card-image')!.getAttribute('src')).toBe('./assets/colelctibles/interim.png');
  expect(root.querySelectorAll('.jimi-level-star')).toHaveLength(6); expect(JSON.stringify(progress)).toBe(before);
});

test('normal detail never reveals unknown/locked card; explicit preview has neither earned stars nor Play',()=>{
  expect(buildCardScene(11,undefined).querySelector('.jimi-card-rotor')).toBeNull();
  const board=completed(11); const normal=buildCardScene(11,board); const preview=buildCardPreviewScene(11,board.card);
  expect(normal.querySelectorAll('.jimi-card-rotor > button')).toHaveLength(2);
  expect(normal.querySelector('.jimi-card-stage')!.getAttribute('data-jimi-unit')).toBe('detail-card');
  expect(normal.querySelector('.jimi-card-rotor')!.hasAttribute('data-jimi-unit')).toBe(false);
  expect(normal.querySelector('[data-jimi-action="play-board"]')!.getAttribute('data-board-id')).toBe('11');
  expect(preview.dataset.preview).toBe('true'); expect(preview.textContent).toContain('not an unlocked reward');
  expect(preview.querySelector('[data-jimi-action="play-board"]')).toBeNull(); expect(preview.querySelector('.jimi-card-stars')).toBeNull();
});

test('every referenced source and density asset exists without copying or modifying assets',()=>{
  const progress=Object.fromEntries(Array.from({length:10},(_,i)=>[i+11,completed(i+11)]));
  for(const root of [buildHomeScene(),buildHubScene(progress),buildBeachScene(progress),buildCardScene(11,progress[11])]) {
    for(const img of root.querySelectorAll('img')) {
      const sources=[img.getAttribute('src')!,...(img.getAttribute('srcset')||'').split(',').filter(Boolean).map(entry=>decodeURI(entry.trim().replace(/\s+[123]x$/,'')))];
      for(const src of sources) expect(fs.existsSync(path.resolve(process.cwd(),src))).toBe(true);
    }
  }
});

test('catalog/builders own no legacy manager, persistence, listeners, timers or animation machinery',()=>{
  const code=['scene-catalog.ts','scene-builders.ts'].map(name=>fs.readFileSync(path.resolve(__dirname,'..',name),'utf8')).join('\n');
  expect(code).not.toMatch(/journey-boards-manager|localStorage|addEventListener|requestAnimationFrame|setTimeout|gsap|\.animate\(/);
});
