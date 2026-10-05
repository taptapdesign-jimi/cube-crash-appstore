import { JOURNEY_HUB_WORLD_DEFINITIONS, getJourneyWorldDefinition } from '../modules/journey-world-definitions.js';

export type JimiCardArt = Readonly<{ src: string; src2x?: string; name: string; rarity: 'common' | 'legendary' }>;
/** Supplied by the canonical progression adapter; builders never load or save progress. */
export type JimiBoardSnapshot = Readonly<{
  unlocked: boolean;
  interim?: boolean;
  stars: number;
  card: JimiCardArt;
  viewed?: boolean;
}>;
export type JimiProgressSnapshot = Readonly<Record<number, JimiBoardSnapshot | undefined>>;
export type JimiImageSpec = Readonly<{
  src: string; src2x?: string; x: number; y: number; width: number;
  rotation?: number; opacity?: number; layer?: number;
}>;
export type JimiHomeSlideId = 'journey' | 'arcade' | 'settings';
export const JIMI_DESIGN_WIDTH = 390;
export const JIMI_HOME_SLIDES = Object.freeze([
  { id: 'journey', label: 'Journey', tagline: 'Chart your journey', asset: './assets/journey.png', action: 'open-hub' },
  { id: 'arcade', label: 'Arcade', tagline: 'Merge dice, clear stages', asset: './assets/crash-cubes-homepage.png', action: 'open-arcade' },
  { id: 'settings', label: 'Settings', tagline: 'Tune the game your way', asset: './assets/settings-slider.png', action: 'open-settings' },
] as const);
export const JIMI_LOGO_ASSET = './assets/logo-cube-crash.png';
export const JIMI_HOME_SHARDS = Object.freeze([
  { slot: 'top-left', src: './assets/logo addons/gore ljevo shards.png' },
  { slot: 'top-right', src: './assets/logo addons/shards gore desno.png' },
  { slot: 'bottom-left', src: './assets/logo addons/dole ljevi shards.png' },
  { slot: 'bottom-right', src: './assets/logo addons/dole ljevi shards.png' },
] as const);
export const JIMI_HUB_WORLDS = JOURNEY_HUB_WORLD_DEFINITIONS;
export const JIMI_INTERIM_ASSET = './assets/colelctibles/interim.png';
export const JIMI_CARD_BACK_ASSETS = Object.freeze({ common: './assets/colelctibles/common back.png', legendary: './assets/colelctibles/legendary back.png' });

const cloudRoot = './assets/board transition';
export const JIMI_CLOUD_ASSETS = Object.freeze([
  `${cloudRoot}/oblak-forest1.png`, `${cloudRoot}/oblak-forest2.png`, `${cloudRoot}/oblak+srednji.png`,
  `${cloudRoot}/oblak mali ljevo.png`, `${cloudRoot}/oblak mali desno.png`, `${cloudRoot}/oblak veliki ljevo dole.png`,
]);
// Authored Hub cloud coordinates from JourneyBoardsManager's Hub catalog.
const hubCloudSlots = [
  [5,-70,-6,272,.78,1], [1,-92,58,188,.74,1], [5,100,6,248,.76,1], [2,200,138,166,.72,1],
  [2,-34,76,286,.8,1], [0,214,58,184,.72,1], [5,24,222,214,.78,3], [2,168,240,198,.76,3],
  [3,-22,400,176,.68,3], [2,136,418,236,.78,3], [0,32,576,214,.72,2], [5,198,598,184,.68,2],
  [2,-10,632,198,.62,2],
] as const;
export const JIMI_HUB_CLOUDS = Object.freeze(hubCloudSlots.map(([asset,x,y,width,opacity,worldId]) =>
  Object.freeze({ src: JIMI_CLOUD_ASSETS[asset], x,y,width,opacity,worldId })));
export const JIMI_HUB_BANNERS = Object.freeze({
  1: Object.freeze({ x: 203, y: 81, width: 150, rotation: -15, mirrored: false }),
  2: Object.freeze({ x: 203, y: 75, width: 150, rotation: 8, mirrored: false }),
  3: Object.freeze({ x: -88, y: 69, width: 150, rotation: -6, mirrored: true }),
});

const beachRoot = './assets/journey assets/beach/Beacj world';
const beachDefinition = getJourneyWorldDefinition(2)!;
const density2x = (src: string) => src.replace(/\.png$/, '@2x.png');
const seededUnit = (seed: number) => { const value = Math.sin(seed * 12.9898) * 43758.5453; return value - Math.floor(value); };
const beachMainCloudSlots = [
  [-38,-4,214,2,false], [168,-24,184,null,true], [276,44,146,null,true], [-42,156,176,null,true],
  [54,214,206,null,false], [188,154,170,null,true], [282,248,118,null,true],
] as const;
export const JIMI_BEACH_MAIN = Object.freeze({
  x: 0, y: 122, width: 390, src: `${beachRoot}/beach-main.png`, src2x: `${beachRoot}/beach-main@2x.png`,
  clouds: Object.freeze(beachMainCloudSlots.map(([x,y,width,asset,jitter], index) => Object.freeze({
    src: JIMI_CLOUD_ASSETS[asset ?? Math.floor(seededUnit(index + 101) * JIMI_CLOUD_ASSETS.length)],
    x,y,width: width * (jitter ? .86 + seededUnit(index + 113) * .28 : 1),
    opacity: .72 + seededUnit(index + 127) * .14,
  }))),
});
const propOffsets = [[-4,-12],[0,1],[2,-2],[-2,0],[-2,0],[-2,-3],[2,-2],[-1,0],[0,-2],[-4,0]] as const;
const starOffsets = [[-14,-3],[-8,8],[-10,8],[-12,10],[-10,4],[-12,6],[-10,8],[-8,4],[-10,8],[-12,10]] as const;
const starRoot = './assets/journey assets/level stars';
export const JIMI_LEVEL_STARS = Object.freeze([
  { x:76,y:82,width:23, empty:`${starRoot}/star-empty-left.png`, filled:`${starRoot}/star-filled-left.png` },
  { x:93,y:82,width:29, empty:`${starRoot}/star-empty-center.png`, filled:`${starRoot}/star-filled-center-1.png` },
  { x:116,y:82,width:23, empty:`${starRoot}/star-empty-right-1.png`, filled:`${starRoot}/star-filled-right.png` },
]);
/** Existing 390px map coordinates, with scope offset -1454/-16 and art top138/card top196 applied once. */
export const JIMI_BEACH_UNITS = Object.freeze(beachDefinition.stages.map((card,index) => {
  const stage=index+1; const sand=[2,5,8].includes(stage); const x=index%2===0?18:194; const y=488+index*124;
  const island=`${beachRoot}/${sand?'beach-beach':'beach-water'}${stage}.png`;
  const prop=`${beachRoot}/${sand?'kanta':'kolut'}.png`;
  return Object.freeze({
    boardId:11+index, stage, x,y,width:200,
    island: Object.freeze({src:island,src2x:density2x(island),x:0,y:0,width:200}),
    prop: Object.freeze({src:prop,src2x:density2x(prop),x:(sand?72:61)+propOffsets[index][0],y:(sand?53:52)+propOffsets[index][1],width:sand?56:74,rotation:sand?5:-4}),
    card: Object.freeze({x:card.xPx-x,y:card.topPx+180-y,width:card.widthPx,height:card.heightPx,rotation:card.rotationDeg}),
    clouds:Object.freeze([
      {src:JIMI_CLOUD_ASSETS[5],x:-62,y:86,width:158,opacity:.8},
      {src:JIMI_CLOUD_ASSETS[2],x:54,y:-12,width:124,opacity:.8},
      {src:JIMI_CLOUD_ASSETS[4],x:126,y:74,width:104,opacity:.8},
    ]),
    stars:Object.freeze(JIMI_LEVEL_STARS.map(star=>Object.freeze({...star,x:star.x+starOffsets[index][0],y:star.y+starOffsets[index][1]}))),
  });
}));
