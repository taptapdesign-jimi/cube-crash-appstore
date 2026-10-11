const fs=require('node:fs');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {gsap}=require('gsap/dist/gsap');
const source=path=>execFileSync('git',['show',`production-benchmark-v9:${path}`],{encoding:'utf8'});
const nav=source('src/utils/nav-icon-bounce.ts');
const hud=source('src/modules/hud-helpers.ts');
const coordinate=nav.slice(nav.indexOf('function cubicBezierCoordinate'),nav.indexOf('export function getNavIconVisualTarget'))
  .replace(/export /g,'').replace(/: number/g,'');
const helper=hud.slice(hud.indexOf('function playPixiSoftCartoonBounce'),hud.indexOf('function playHudCloseSoftCartoonBounce'))
  .replace('target: any','target').replace('): void',')');
let timeline;
const context={gsap,console,trackTimeline:options=>(timeline=gsap.timeline({...options,paused:true}))};
const constants=nav.slice(nav.indexOf('export const NAV_ICON_TAP_BOUNCE'),nav.indexOf('const activeNavIconTimelines'))
  .replace('export const NAV_ICON_TAP_BOUNCE','globalThis.NAV_ICON_TAP_BOUNCE');
vm.createContext(context);vm.runInContext(constants+coordinate+helper,context);
const rows=[];
for(const [x,y] of [[1,1],[1.25,.9],[.8,1.4]]) {
  const scale={x,y,set(a,b=a){this.x=a;this.y=b;}};
  context.playPixiSoftCartoonBounce({scale,destroyed:false});
  for(let ms=0;ms<=220;ms++){timeline.totalTime(ms/1000,true);rows.push([ms/1000,x,y,scale.x,scale.y]);}
  timeline.kill();
}
gsap.ticker.sleep();
const swift='import Foundation\n\n// Executes immutable-v9 Pixi helper and original GSAP timelines.\nenum NativeHUDTapSourceOracle {\n    static let rows:[[Double]]=[\n'+rows.map(row=>'        ['+row.join(',')+'],').join('\n')+'\n    ]\n}\n';
fs.writeFileSync('native/standalone/Stack to SixTests/NativeHUDTapSourceOracle.swift',swift);
console.log(`PASS exported ${rows.length} immutable-v9 actual GSAP HUD tap poses`);
