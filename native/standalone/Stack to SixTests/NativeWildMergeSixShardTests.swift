import XCTest
import SpriteKit
import JavaScriptCore
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeWildMergeSixShardTests:XCTestCase {
    private static let sourceOracle = #"""
const console={log(){},warn(){},error(){}};
let nodes=[],timers=[],selectedFamily='',selectedPattern=0;
class Container {constructor(){this.children=[];}addChild(n){n.parent=this;this.children.push(n);}sortChildren(){}destroy(){}}
function attachFxContainerActivity(){};function releaseFxContainerActivity(){};
function trackDelayedCall(ttl,cb){timers.push(ttl);}
function trackTween(node,config){node.tweens.push(config);}
const pool={acquire(){let g={tweens:[],poly(points){this.points=points;return this;},fill(value){this.fillValue=value;return this;},clear(){},rect(){return this;},updateBounds(){}};nodes.push(g);return g;},getStats(){return{};}};
function getColor(type){return ({wildMagnet:0xF26034,regular:0xD4A584,wildStar:0xFFCB47,wildJuice:0xF99D77,wildTnt:0xE85C3A})[type];}
function getParams(type){return {lineAlpha:1,baseTile:96,spread:type==='wildMagnet'?6.888:6.72,travelDuration:type==='wildMagnet'?0.35:0.4,fadeDelay:0.15,fadeDelayMultiplier:0.1,fadeDuration:0.25,ttl:type==='wildMagnet'?1:1.2,speed:1};}
const variantPalettes={"fish": [16557168, 16608056], "kanta": [14988936, 9895420], "bee": [16509127, 14517604], "laser-gun": [16700570, 9955837], "spaceship": [15912360, 9105150], "bottle": [11656393, 16764535], "honey": [15841913, 16633688], "flower": [16764359, 16551029], "barell": [15324870, 15444315], "mushroom": [15184786, 16743264], "robo-cube": [9564927, 16434056], "cubero": [16683312], "beach-ball": [14521579, 4966908, 16640908, 16619421]};
function selectPattern(type){let suffix=type==='wildMagnetPull'?'MagnetPull':type==='wildMagnet'?'MagnetOrganic':type==='wildStar'?'StarOrganic':'JuiceOrganic';let data=eval('woodenPatternWild'+suffix+(selectedPattern+1));return {patternName:'test',patternData:data,pool,template:{}};}
function oracle(family,variant,pattern,seed){nodes=[];timers=[];selectedPattern=pattern;let draws=0;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;draws++;return seed/4294967296;};let colors=variantPalettes[variant];let opts={skipStars:true,isPullAnimation:family==='magnetPull',colors,color:colors?colors[0]:undefined,sizeScale:variant==='barell'?0.7:1};let board=new Container(),tile={x:0,y:0};let fn=family==='magnet'||family==='magnetPull'?wildMagnetMerge6ShardsTemplated:family==='star'?wildStarMerge6ShardsTemplated:family==='juice'?wildJuiceMerge6ShardsTemplated:wildTntMerge6ShardsTemplated;fn(board,tile,opts);return JSON.stringify({draws,ttl:timers[0],shards:nodes.map(n=>({points:n.points,color:n.fillValue.color,alpha:n.alpha,rotation:n.rotation,depth:n.zIndex||0,dx:n.tweens[0].x,dy:n.tweens[0].y,travelDuration:n.tweens[0].duration,travelDelay:n.tweens[0].delay,fadeDelay:n.tweens[1].delay}))});}
const woodenPatternWildMagnetOrganic1 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle (radius = tileSize * 0.28)
  // Minimum distance now: 0.059+ (ensures 40%+ beyond multiplier circle)
  // Top-right cluster (dense, organic variation) - OSCILLATING distances (40%+ increase)
  { angle: 22,  distance: 0.059, size: 1.5, speed: 0.88, alpha: 1.0 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 33,  distance: 0.216, size: 1.1, speed: 1.02, alpha: 1.0 },  // 🔥 Far (0.154 * 1.4 = 0.216)
  { angle: 47,  distance: 0.108, size: 1.4, speed: 0.92, alpha: 1.0 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 58,  distance: 0.219, size: 1.0, speed: 1.08, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 28,  distance: 0.078, size: 1.3, speed: 0.95, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  
  // Bottom-left cluster (dense, organic variation) - OSCILLATING distances (40%+ increase, far ones 20% closer)
  { angle: 202, distance: 0.196, size: 1.3, speed: 0.95, alpha: 1.0 },  // 🔥 Far (0.245 * 0.8 = 0.196, 20% closer)
  { angle: 213, distance: 0.088, size: 1.2, speed: 1.05, alpha: 1.0 }, // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 228, distance: 0.243, size: 1.5, speed: 0.98, alpha: 1.0 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 238, distance: 0.069, size: 1.1, speed: 1.12, alpha: 1.0 },  // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 208, distance: 0.186, size: 1.25, speed: 1.0, alpha: 1.0 }, // 🔥 Mid-far (0.133 * 1.4 = 0.186)
  
  // Sparse scattered shards (organic gaps, OSCILLATING distances) - wide range (40%+ increase, far ones 20% closer)
  { angle: 97,  distance: 0.251, size: 0.95, speed: 1.18, alpha: 1.0 }, // 🔥 Very far (0.314 * 0.8 = 0.251, 20% closer)
  { angle: 157, distance: 0.049, size: 1.05, speed: 0.92, alpha: 1.0 }, // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 277, distance: 0.204, size: 1.15, speed: 1.25, alpha: 1.0 }, // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 318, distance: 0.118, size: 0.98, speed: 1.03, alpha: 1.0 }, // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 8,   distance: 0.227, size: 1.08, speed: 1.15, alpha: 1.0 }, // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 347, distance: 0.098, size: 1.22, speed: 0.96, alpha: 1.0 }, // 🔥 Close (0.070 * 1.4 = 0.098)
  { angle: 125, distance: 0.274, size: 1.12, speed: 1.08, alpha: 1.0 }, // 🔥 Very far (0.343 * 0.8 = 0.274, 20% closer)
  { angle: 265, distance: 0.078, size: 1.05, speed: 1.12, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 42,  distance: 0.188, size: 1.18, speed: 0.99, alpha: 1.0 }  // 🔥 Far (0.235 * 0.8 = 0.188, 20% closer)
];
const woodenPatternWildMagnetOrganic2 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle
  // 🔥 ORGANIC RANDOM: Completely random angles and distances - no X pattern, pure organic chaos
  // Random angles (not in clusters) with oscillating distances (40%+ increase)
  { angle: 17,  distance: 0.059, size: 1.4, speed: 0.93, alpha: 1.0 },   // 🔥 Random angle, close (0.042 * 1.4 = 0.059)
  { angle: 73,  distance: 0.212, size: 1.15, speed: 1.08, alpha: 1.0 }, // 🔥 Random angle, far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 134, distance: 0.108, size: 1.45, speed: 0.97, alpha: 1.0 }, // 🔥 Random angle, close (0.077 * 1.4 = 0.108)
  { angle: 201, distance: 0.235, size: 1.05, speed: 1.15, alpha: 1.0 }, // 🔥 Random angle, far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 256, distance: 0.078, size: 1.25, speed: 0.88, alpha: 1.0 },  // 🔥 Random angle, close (0.056 * 1.4 = 0.078)
  { angle: 312, distance: 0.225, size: 1.3, speed: 1.02, alpha: 1.0 },  // 🔥 Random angle, mid-far (0.161 * 1.4 = 0.225)
  
  // More random angles - organic spread (40%+ increase, far ones 20% closer)
  { angle: 48,  distance: 0.219, size: 1.18, speed: 0.96, alpha: 1.0 },  // 🔥 Random angle, far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 89,  distance: 0.078, size: 1.32, speed: 1.02, alpha: 1.0 }, // 🔥 Random angle, close (0.056 * 1.4 = 0.078)
  { angle: 156, distance: 0.258, size: 1.08, speed: 1.11, alpha: 1.0 }, // 🔥 Random angle, far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 223, distance: 0.049, size: 1.22, speed: 0.94, alpha: 1.0 },  // 🔥 Random angle, very close (0.035 * 1.4 = 0.049)
  { angle: 278, distance: 0.196, size: 1.15, speed: 1.05, alpha: 1.0 }, // 🔥 Random angle, far (0.245 * 0.8 = 0.196, 20% closer)
  
  // More random angles - continued organic chaos (40%+ increase, far ones 20% closer)
  { angle: 34,  distance: 0.069, size: 1.12, speed: 1.05, alpha: 1.0 },  // 🔥 Random angle, close (0.049 * 1.4 = 0.069)
  { angle: 107, distance: 0.243, size: 1.25, speed: 0.92, alpha: 1.0 }, // 🔥 Random angle, far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 181, distance: 0.088, size: 1.05, speed: 1.18, alpha: 1.0 },  // 🔥 Random angle, close (0.063 * 1.4 = 0.088)
  { angle: 245, distance: 0.204, size: 1.2, speed: 0.98, alpha: 1.0 },  // 🔥 Random angle, far (0.255 * 0.8 = 0.204, 20% closer)
  
  // Final random angles - complete organic spread (40%+ increase, far ones 20% closer)
  { angle: 62,  distance: 0.118, size: 1.35, speed: 0.99, alpha: 1.0 },  // 🔥 Random angle, close (0.084 * 1.4 = 0.118)
  { angle: 129, distance: 0.266, size: 1.08, speed: 1.22, alpha: 1.0 }, // 🔥 Random angle, far (0.333 * 0.8 = 0.266, 20% closer)
  { angle: 197, distance: 0.059, size: 1.18, speed: 1.03, alpha: 1.0 }, // 🔥 Random angle, close (0.042 * 1.4 = 0.059)
  { angle: 264, distance: 0.227, size: 1.28, speed: 0.91, alpha: 1.0 },  // 🔥 Random angle, far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 331, distance: 0.098, size: 1.22, speed: 1.08, alpha: 1.0 }  // 🔥 Random angle, close (0.070 * 1.4 = 0.098)
];
const woodenPatternWildMagnetOrganic3 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle
  // Irregular angles and OSCILLATING distances - maximum organic chaos, wide distance range (40%+ increase)
  { angle: 9,   distance: 0.049, size: 1.35, speed: 0.87, alpha: 1.0 },  // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 35,  distance: 0.251, size: 1.08, speed: 1.12, alpha: 1.0 }, // 🔥 Far (0.314 * 0.8 = 0.251, 20% closer)
  { angle: 64,  distance: 0.078, size: 1.48, speed: 0.94, alpha: 1.0 },  // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 91,  distance: 0.219, size: 1.18, speed: 1.22, alpha: 1.0 }, // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 115, distance: 0.059, size: 1.05, speed: 0.91, alpha: 1.0 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 144, distance: 0.235, size: 1.25, speed: 1.08, alpha: 1.0 }, // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 171, distance: 0.108, size: 1.32, speed: 1.19, alpha: 1.0 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 195, distance: 0.274, size: 1.12, speed: 1.03, alpha: 1.0 },  // 🔥 Very far (0.343 * 0.8 = 0.274, 20% closer)
  { angle: 224, distance: 0.069, size: 1.42, speed: 0.96, alpha: 1.0 }, // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 248, distance: 0.212, size: 1.02, speed: 1.28, alpha: 1.0 }, // 🔥 Far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 275, distance: 0.088, size: 1.22, speed: 0.99, alpha: 1.0 }, // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 301, distance: 0.258, size: 1.38, speed: 1.14, alpha: 1.0 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 329, distance: 0.039, size: 1.08, speed: 0.89, alpha: 1.0 },   // 🔥 Very close (0.028 * 1.4 = 0.039)
  { angle: 353, distance: 0.204, size: 1.28, speed: 1.07, alpha: 1.0 }, // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 49,  distance: 0.118, size: 1.15, speed: 1.25, alpha: 1.0 }, // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 19,  distance: 0.243, size: 1.28, speed: 0.93, alpha: 1.0 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 76,  distance: 0.078, size: 1.15, speed: 1.16, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 133, distance: 0.227, size: 1.32, speed: 1.01, alpha: 1.0 }, // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 189, distance: 0.059, size: 1.08, speed: 1.09, alpha: 1.0 }, // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 259, distance: 0.266, size: 1.25, speed: 0.96, alpha: 1.0 }   // 🔥 Very far (0.333 * 0.8 = 0.266, 20% closer)
];
const woodenPatternWildMagnetPull1 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle, far ones 20% closer
  // Random angles with oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 14,  distance: 0.049, size: 1.4, speed: 0.93, alpha: 1.0 },   // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 67,  distance: 0.212, size: 1.15, speed: 1.08, alpha: 1.0 },  // 🔥 Far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 123, distance: 0.108, size: 1.45, speed: 0.97, alpha: 1.0 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 198, distance: 0.235, size: 1.05, speed: 1.15, alpha: 1.0 },  // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 251, distance: 0.078, size: 1.25, speed: 0.88, alpha: 1.0 },  // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 309, distance: 0.225, size: 1.3, speed: 1.02, alpha: 1.0 },  // 🔥 Mid-far (0.161 * 1.4 = 0.225)
  { angle: 45,  distance: 0.196, size: 1.18, speed: 0.96, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.196, 20% closer)
  { angle: 88,  distance: 0.078, size: 1.32, speed: 1.02, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 152, distance: 0.258, size: 1.08, speed: 1.11, alpha: 1.0 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 221, distance: 0.049, size: 1.22, speed: 0.94, alpha: 1.0 },  // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 275, distance: 0.196, size: 1.15, speed: 1.05, alpha: 1.0 }, // 🔥 Far (0.245 * 0.8 = 0.196, 20% closer)
  { angle: 32,  distance: 0.069, size: 1.12, speed: 1.05, alpha: 1.0 },   // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 104, distance: 0.243, size: 1.25, speed: 0.92, alpha: 1.0 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 179, distance: 0.088, size: 1.05, speed: 1.18, alpha: 1.0 },   // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 243, distance: 0.204, size: 1.2, speed: 0.98, alpha: 1.0 },  // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 59,  distance: 0.118, size: 1.35, speed: 0.99, alpha: 1.0 },  // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 127, distance: 0.266, size: 1.08, speed: 1.22, alpha: 1.0 }, // 🔥 Far (0.333 * 0.8 = 0.266, 20% closer)
  { angle: 195, distance: 0.059, size: 1.18, speed: 1.03, alpha: 1.0 }  // 🔥 Close (0.042 * 1.4 = 0.059)
];
const woodenPatternWildMagnetPull2 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle
  // Maximum chaos - random angles, oscillating distances (40%+ increase)
  { angle: 7,   distance: 0.039, size: 1.35, speed: 0.87, alpha: 1.0 },   // 🔥 Very close (0.028 * 1.4 = 0.039)
  { angle: 41,  distance: 0.251, size: 1.08, speed: 1.12, alpha: 1.0 },  // 🔥 Far (0.314 * 0.8 = 0.251, 20% closer)
  { angle: 78,  distance: 0.078, size: 1.48, speed: 0.94, alpha: 1.0 },   // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 112, distance: 0.219, size: 1.18, speed: 1.22, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 146, distance: 0.059, size: 1.05, speed: 0.91, alpha: 1.0 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 183, distance: 0.235, size: 1.25, speed: 1.08, alpha: 1.0 }, // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 217, distance: 0.108, size: 1.32, speed: 1.19, alpha: 1.0 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 254, distance: 0.274, size: 1.12, speed: 1.03, alpha: 1.0 },  // 🔥 Very far (0.343 * 0.8 = 0.274, 20% closer)
  { angle: 289, distance: 0.069, size: 1.42, speed: 0.96, alpha: 1.0 }, // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 326, distance: 0.212, size: 1.02, speed: 1.28, alpha: 1.0 }, // 🔥 Far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 23,  distance: 0.088, size: 1.22, speed: 0.99, alpha: 1.0 },  // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 56,  distance: 0.258, size: 1.38, speed: 1.14, alpha: 1.0 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 94,  distance: 0.049, size: 1.08, speed: 0.89, alpha: 1.0 },   // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 131, distance: 0.204, size: 1.28, speed: 1.07, alpha: 1.0 }, // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 168, distance: 0.118, size: 1.15, speed: 1.25, alpha: 1.0 }, // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 205, distance: 0.243, size: 1.28, speed: 0.93, alpha: 1.0 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 242, distance: 0.078, size: 1.15, speed: 1.16, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 278, distance: 0.227, size: 1.32, speed: 1.01, alpha: 1.0 }, // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 315, distance: 0.059, size: 1.08, speed: 1.09, alpha: 1.0 }, // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 352, distance: 0.266, size: 1.25, speed: 0.96, alpha: 1.0 }   // 🔥 Very far (0.333 * 0.8 = 0.266, 20% closer)
];
const woodenPatternWildMagnetPull3 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle
  // Scattered organic debris - varied angles and distances (40%+ increase)
  { angle: 19,  distance: 0.059, size: 1.4, speed: 0.93, alpha: 1.0 },   // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 61,  distance: 0.212, size: 1.15, speed: 1.08, alpha: 1.0 },  // 🔥 Far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 103, distance: 0.108, size: 1.45, speed: 0.97, alpha: 1.0 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 145, distance: 0.235, size: 1.05, speed: 1.15, alpha: 1.0 }, // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 187, distance: 0.078, size: 1.25, speed: 0.88, alpha: 1.0 },  // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 229, distance: 0.225, size: 1.3, speed: 1.02, alpha: 1.0 },  // 🔥 Mid-far (0.161 * 1.4 = 0.225)
  { angle: 271, distance: 0.219, size: 1.18, speed: 0.96, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 313, distance: 0.078, size: 1.32, speed: 1.02, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 355, distance: 0.258, size: 1.08, speed: 1.11, alpha: 1.0 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 37,  distance: 0.049, size: 1.22, speed: 0.94, alpha: 1.0 },   // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 79,  distance: 0.196, size: 1.15, speed: 1.05, alpha: 1.0 },  // 🔥 Far (0.245 * 0.8 = 0.196, 20% closer)
  { angle: 121, distance: 0.069, size: 1.12, speed: 1.05, alpha: 1.0 },  // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 163, distance: 0.243, size: 1.25, speed: 0.92, alpha: 1.0 },  // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 205, distance: 0.088, size: 1.05, speed: 1.18, alpha: 1.0 },   // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 247, distance: 0.204, size: 1.2, speed: 0.98, alpha: 1.0 },   // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 289, distance: 0.118, size: 1.35, speed: 0.99, alpha: 1.0 },   // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 331, distance: 0.266, size: 1.08, speed: 1.22, alpha: 1.0 }, // 🔥 Far (0.333 * 0.8 = 0.266, 20% closer)
  { angle: 13,  distance: 0.059, size: 1.18, speed: 1.03, alpha: 1.0 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 55,  distance: 0.227, size: 1.28, speed: 0.91, alpha: 1.0 }    // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
];
const woodenPatternWildStarOrganic1 = [
  // Stellar explosion - oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 15,  distance: 0.059, size: 1.800, speed: 0.88, alpha: 1.0 },   // 🔥 Close
  { angle: 45,  distance: 0.212, size: 1.320, speed: 1.02, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 75,  distance: 0.108, size: 1.680, speed: 0.92, alpha: 1.0 }, // 🔥 Close
  { angle: 105, distance: 0.235, size: 1.200, speed: 1.08, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 135, distance: 0.078, size: 1.560, speed: 0.95, alpha: 1.0 }, // 🔥 Close
  { angle: 165, distance: 0.196, size: 1.440, speed: 1.05, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 195, distance: 0.243, size: 1.800, speed: 0.98, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 225, distance: 0.069, size: 1.320, speed: 1.12, alpha: 1.0 },  // 🔥 Close
  { angle: 255, distance: 0.186, size: 1.500, speed: 1.0, alpha: 1.0 }, // 🔥 Mid-far
  { angle: 285, distance: 0.251, size: 1.140, speed: 1.18, alpha: 1.0 }, // 🔥 Very far (20% closer)
  { angle: 315, distance: 0.049, size: 1.260, speed: 0.92, alpha: 1.0 }, // 🔥 Very close
  { angle: 345, distance: 0.204, size: 1.380, speed: 1.25, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 30,  distance: 0.118, size: 1.176, speed: 1.03, alpha: 1.0 }, // 🔥 Close
  { angle: 60,  distance: 0.227, size: 1.296, speed: 1.15, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 90,  distance: 0.098, size: 1.464, speed: 0.96, alpha: 1.0 }, // 🔥 Close
  { angle: 120, distance: 0.274, size: 1.344, speed: 1.08, alpha: 1.0 }, // 🔥 Very far (20% closer)
  { angle: 150, distance: 0.078, size: 1.260, speed: 1.12, alpha: 1.0 }, // 🔥 Close
  { angle: 180, distance: 0.188, size: 1.416, speed: 0.99, alpha: 1.0 }  // 🔥 Far (20% closer)
];
const woodenPatternWildStarOrganic2 = [
  // Radiant burst - random angles, oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 12,  distance: 0.059, size: 1.680, speed: 0.93, alpha: 1.0 },   // 🔥 Close
  { angle: 51,  distance: 0.212, size: 1.380, speed: 1.08, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 89,  distance: 0.108, size: 1.740, speed: 0.97, alpha: 1.0 }, // 🔥 Close
  { angle: 127, distance: 0.235, size: 1.260, speed: 1.15, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 165, distance: 0.078, size: 1.500, speed: 0.88, alpha: 1.0 },  // 🔥 Close
  { angle: 203, distance: 0.225, size: 1.560, speed: 1.02, alpha: 1.0 },  // 🔥 Mid-far
  { angle: 241, distance: 0.196, size: 1.416, speed: 0.96, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 279, distance: 0.078, size: 1.584, speed: 1.02, alpha: 1.0 }, // 🔥 Close
  { angle: 317, distance: 0.258, size: 1.296, speed: 1.11, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 355, distance: 0.049, size: 1.464, speed: 0.94, alpha: 1.0 },  // 🔥 Very close
  { angle: 33,  distance: 0.196, size: 1.380, speed: 1.05, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 71,  distance: 0.069, size: 1.344, speed: 1.05, alpha: 1.0 },  // 🔥 Close
  { angle: 109, distance: 0.243, size: 1.500, speed: 0.92, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 147, distance: 0.088, size: 1.260, speed: 1.18, alpha: 1.0 },   // 🔥 Close
  { angle: 185, distance: 0.204, size: 1.440, speed: 0.98, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 223, distance: 0.118, size: 1.620, speed: 0.99, alpha: 1.0 },  // 🔥 Close
  { angle: 261, distance: 0.266, size: 1.296, speed: 1.22, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 299, distance: 0.059, size: 1.416, speed: 1.03, alpha: 1.0 }, // 🔥 Close
  { angle: 337, distance: 0.227, size: 1.536, speed: 0.91, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 18,  distance: 0.098, size: 1.464, speed: 1.08, alpha: 1.0 }  // 🔥 Close
];
const woodenPatternWildStarOrganic3 = [
  // Cosmic spread - varied angles, oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 8,   distance: 0.049, size: 1.620, speed: 0.87, alpha: 1.0 },  // 🔥 Very close
  { angle: 38,  distance: 0.251, size: 1.296, speed: 1.12, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 68,  distance: 0.078, size: 1.776, speed: 0.94, alpha: 1.0 },  // 🔥 Close
  { angle: 98,  distance: 0.219, size: 1.416, speed: 1.22, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 128, distance: 0.059, size: 1.260, speed: 0.91, alpha: 1.0 },  // 🔥 Close
  { angle: 158, distance: 0.235, size: 1.500, speed: 1.08, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 188, distance: 0.108, size: 1.584, speed: 1.19, alpha: 1.0 }, // 🔥 Close
  { angle: 218, distance: 0.274, size: 1.344, speed: 1.03, alpha: 1.0 },  // 🔥 Very far (20% closer)
  { angle: 248, distance: 0.069, size: 1.704, speed: 0.96, alpha: 1.0 }, // 🔥 Close
  { angle: 278, distance: 0.212, size: 1.224, speed: 1.28, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 308, distance: 0.088, size: 1.464, speed: 0.99, alpha: 1.0 }, // 🔥 Close
  { angle: 338, distance: 0.258, size: 1.656, speed: 1.14, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 23,  distance: 0.039, size: 1.296, speed: 0.89, alpha: 1.0 },   // 🔥 Very close
  { angle: 53,  distance: 0.204, size: 1.536, speed: 1.07, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 83,  distance: 0.118, size: 1.380, speed: 1.25, alpha: 1.0 }, // 🔥 Close
  { angle: 113, distance: 0.243, size: 1.536, speed: 0.93, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 143, distance: 0.078, size: 1.380, speed: 1.16, alpha: 1.0 }, // 🔥 Close
  { angle: 173, distance: 0.227, size: 1.584, speed: 1.01, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 203, distance: 0.059, size: 1.296, speed: 1.09, alpha: 1.0 }  // 🔥 Close
];
const woodenPatternWildJuiceOrganic1 = [
  // Juice explosion - oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 22,  distance: 0.059, size: 1.800, speed: 0.88, alpha: 1.0 },   // 🔥 Close
  { angle: 56,  distance: 0.212, size: 1.320, speed: 1.02, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 90,  distance: 0.108, size: 1.680, speed: 0.92, alpha: 1.0 }, // 🔥 Close
  { angle: 124, distance: 0.235, size: 1.200, speed: 1.08, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 158, distance: 0.078, size: 1.560, speed: 0.95, alpha: 1.0 }, // 🔥 Close
  { angle: 192, distance: 0.196, size: 1.440, speed: 1.05, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 226, distance: 0.243, size: 1.800, speed: 0.98, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 260, distance: 0.069, size: 1.320, speed: 1.12, alpha: 1.0 },  // 🔥 Close
  { angle: 294, distance: 0.186, size: 1.500, speed: 1.0, alpha: 1.0 }, // 🔥 Mid-far
  { angle: 328, distance: 0.251, size: 1.140, speed: 1.18, alpha: 1.0 }, // 🔥 Very far (20% closer)
  { angle: 2,   distance: 0.049, size: 1.260, speed: 0.92, alpha: 1.0 }, // 🔥 Very close
  { angle: 36,  distance: 0.204, size: 1.380, speed: 1.25, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 70,  distance: 0.118, size: 1.176, speed: 1.03, alpha: 1.0 }, // 🔥 Close
  { angle: 104, distance: 0.227, size: 1.296, speed: 1.15, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 138, distance: 0.098, size: 1.464, speed: 0.96, alpha: 1.0 }, // 🔥 Close
  { angle: 172, distance: 0.274, size: 1.344, speed: 1.08, alpha: 1.0 }, // 🔥 Very far (20% closer)
  { angle: 206, distance: 0.078, size: 1.260, speed: 1.12, alpha: 1.0 }, // 🔥 Close
  { angle: 240, distance: 0.188, size: 1.416, speed: 0.99, alpha: 1.0 }  // 🔥 Far (20% closer)
];
const woodenPatternWildJuiceOrganic2 = [
  // Bubbly burst - random angles, oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 14,  distance: 0.059, size: 1.680, speed: 0.93, alpha: 1.0 },   // 🔥 Close
  { angle: 48,  distance: 0.212, size: 1.380, speed: 1.08, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 82,  distance: 0.108, size: 1.740, speed: 0.97, alpha: 1.0 }, // 🔥 Close
  { angle: 116, distance: 0.235, size: 1.260, speed: 1.15, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 150, distance: 0.078, size: 1.500, speed: 0.88, alpha: 1.0 },  // 🔥 Close
  { angle: 184, distance: 0.225, size: 1.560, speed: 1.02, alpha: 1.0 },  // 🔥 Mid-far
  { angle: 218, distance: 0.196, size: 1.416, speed: 0.96, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 252, distance: 0.078, size: 1.584, speed: 1.02, alpha: 1.0 }, // 🔥 Close
  { angle: 286, distance: 0.258, size: 1.296, speed: 1.11, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 320, distance: 0.049, size: 1.464, speed: 0.94, alpha: 1.0 },  // 🔥 Very close
  { angle: 354, distance: 0.196, size: 1.380, speed: 1.05, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 28,  distance: 0.069, size: 1.344, speed: 1.05, alpha: 1.0 },  // 🔥 Close
  { angle: 62,  distance: 0.243, size: 1.500, speed: 0.92, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 96,  distance: 0.088, size: 1.260, speed: 1.18, alpha: 1.0 },   // 🔥 Close
  { angle: 130, distance: 0.204, size: 1.440, speed: 0.98, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 164, distance: 0.118, size: 1.620, speed: 0.99, alpha: 1.0 },  // 🔥 Close
  { angle: 198, distance: 0.266, size: 1.296, speed: 1.22, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 232, distance: 0.059, size: 1.416, speed: 1.03, alpha: 1.0 }, // 🔥 Close
  { angle: 266, distance: 0.227, size: 1.536, speed: 0.91, alpha: 1.0 }  // 🔥 Far (20% closer)
];
const woodenPatternWildJuiceOrganic3 = [
  // Fizzy spread - varied angles, oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 11,  distance: 0.049, size: 1.620, speed: 0.87, alpha: 1.0 },  // 🔥 Very close
  { angle: 41,  distance: 0.251, size: 1.296, speed: 1.12, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 71,  distance: 0.078, size: 1.776, speed: 0.94, alpha: 1.0 },  // 🔥 Close
  { angle: 101, distance: 0.219, size: 1.416, speed: 1.22, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 131, distance: 0.059, size: 1.260, speed: 0.91, alpha: 1.0 },  // 🔥 Close
  { angle: 161, distance: 0.235, size: 1.500, speed: 1.08, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 191, distance: 0.108, size: 1.584, speed: 1.19, alpha: 1.0 }, // 🔥 Close
  { angle: 221, distance: 0.274, size: 1.344, speed: 1.03, alpha: 1.0 },  // 🔥 Very far (20% closer)
  { angle: 251, distance: 0.069, size: 1.704, speed: 0.96, alpha: 1.0 }, // 🔥 Close
  { angle: 281, distance: 0.212, size: 1.224, speed: 1.28, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 311, distance: 0.088, size: 1.464, speed: 0.99, alpha: 1.0 }, // 🔥 Close
  { angle: 341, distance: 0.258, size: 1.656, speed: 1.14, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 26,  distance: 0.039, size: 1.296, speed: 0.89, alpha: 1.0 },   // 🔥 Very close
  { angle: 56,  distance: 0.204, size: 1.536, speed: 1.07, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 86,  distance: 0.118, size: 1.380, speed: 1.25, alpha: 1.0 }, // 🔥 Close
  { angle: 116, distance: 0.243, size: 1.536, speed: 0.93, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 146, distance: 0.078, size: 1.380, speed: 1.16, alpha: 1.0 }, // 🔥 Close
  { angle: 176, distance: 0.227, size: 1.584, speed: 1.01, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 206, distance: 0.059, size: 1.296, speed: 1.09, alpha: 1.0 }  // 🔥 Close
];
const woodenPatternWildStarOrganic4 = [
  // Nova burst - varied angles, oscillating distances (40%+ increase, far ones 20% closer) - 🔥 USER REQUEST: 20% larger shards
  { angle: 5,   distance: 0.071, size: 1.62, speed: 0.85, alpha: 1.0 },  // 🔥 Close
  { angle: 35,  distance: 0.254, size: 1.296, speed: 1.15, alpha: 1.0 }, // 🔥 Far
  { angle: 65,  distance: 0.130, size: 1.776, speed: 0.90, alpha: 1.0 },  // 🔥 Close
  { angle: 95,  distance: 0.263, size: 1.416, speed: 1.25, alpha: 1.0 }, // 🔥 Far
  { angle: 125, distance: 0.071, size: 1.26, speed: 0.88, alpha: 1.0 },  // 🔥 Close
  { angle: 155, distance: 0.282, size: 1.5, speed: 1.10, alpha: 1.0 }, // 🔥 Far
  { angle: 185, distance: 0.130, size: 1.584, speed: 1.22, alpha: 1.0 }, // 🔥 Close
  { angle: 215, distance: 0.329, size: 1.344, speed: 1.05, alpha: 1.0 },  // 🔥 Very far
  { angle: 245, distance: 0.083, size: 1.704, speed: 0.93, alpha: 1.0 }, // 🔥 Close
  { angle: 275, distance: 0.254, size: 1.224, speed: 1.30, alpha: 1.0 }, // 🔥 Far
  { angle: 305, distance: 0.106, size: 1.464, speed: 0.97, alpha: 1.0 }, // 🔥 Close
  { angle: 335, distance: 0.310, size: 1.656, speed: 1.17, alpha: 1.0 }, // 🔥 Far
  { angle: 20,  distance: 0.047, size: 1.296, speed: 0.87, alpha: 1.0 },   // 🔥 Very close
  { angle: 50,  distance: 0.245, size: 1.536, speed: 1.08, alpha: 1.0 }, // 🔥 Far
  { angle: 80,  distance: 0.142, size: 1.38, speed: 1.28, alpha: 1.0 }, // 🔥 Close
  { angle: 110, distance: 0.292, size: 1.536, speed: 0.95, alpha: 1.0 }, // 🔥 Far
  { angle: 140, distance: 0.094, size: 1.38, speed: 1.19, alpha: 1.0 }, // 🔥 Close
  { angle: 170, distance: 0.272, size: 1.584, speed: 1.02, alpha: 1.0 }, // 🔥 Far
  { angle: 200, distance: 0.071, size: 1.296, speed: 1.11, alpha: 1.0 }, // 🔥 Close
  { angle: 230, distance: 0.245, size: 1.44, speed: 0.99, alpha: 1.0 }  // 🔥 Far
];
const woodenPatternWildStarOrganic5 = [
  // Galactic spread - varied angles, oscillating distances (40%+ increase, far ones 20% closer) - 🔥 USER REQUEST: 20% larger shards
  { angle: 7,   distance: 0.059, size: 1.62, speed: 0.84, alpha: 1.0 },  // 🔥 Very close
  { angle: 37,  distance: 0.301, size: 1.296, speed: 1.13, alpha: 1.0 }, // 🔥 Far
  { angle: 67,  distance: 0.094, size: 1.776, speed: 0.91, alpha: 1.0 },  // 🔥 Close
  { angle: 97,  distance: 0.263, size: 1.416, speed: 1.23, alpha: 1.0 }, // 🔥 Far
  { angle: 127, distance: 0.071, size: 1.26, speed: 0.89, alpha: 1.0 },  // 🔥 Close
  { angle: 157, distance: 0.282, size: 1.5, speed: 1.09, alpha: 1.0 }, // 🔥 Far
  { angle: 187, distance: 0.130, size: 1.584, speed: 1.21, alpha: 1.0 }, // 🔥 Close
  { angle: 217, distance: 0.329, size: 1.344, speed: 1.04, alpha: 1.0 },  // 🔥 Very far
  { angle: 247, distance: 0.083, size: 1.704, speed: 0.94, alpha: 1.0 }, // 🔥 Close
  { angle: 277, distance: 0.254, size: 1.224, speed: 1.29, alpha: 1.0 }, // 🔥 Far
  { angle: 307, distance: 0.106, size: 1.464, speed: 0.98, alpha: 1.0 }, // 🔥 Close
  { angle: 337, distance: 0.310, size: 1.656, speed: 1.16, alpha: 1.0 }, // 🔥 Far
  { angle: 25,  distance: 0.047, size: 1.296, speed: 0.88, alpha: 1.0 },   // 🔥 Very close
  { angle: 55,  distance: 0.245, size: 1.536, speed: 1.09, alpha: 1.0 }, // 🔥 Far
  { angle: 85,  distance: 0.142, size: 1.38, speed: 1.27, alpha: 1.0 }, // 🔥 Close
  { angle: 115, distance: 0.292, size: 1.536, speed: 0.94, alpha: 1.0 }, // 🔥 Far
  { angle: 145, distance: 0.094, size: 1.38, speed: 1.18, alpha: 1.0 }, // 🔥 Close
  { angle: 175, distance: 0.272, size: 1.584, speed: 1.03, alpha: 1.0 }, // 🔥 Far
  { angle: 205, distance: 0.071, size: 1.296, speed: 1.10, alpha: 1.0 }  // 🔥 Close
];
const woodenPatternWildJuiceOrganic4 = [
  // Splash burst - varied angles, oscillating distances (40%+ increase, far ones 20% closer) - 🔥 USER REQUEST: 20% larger shards
  { angle: 6,   distance: 0.071, size: 1.62, speed: 0.86, alpha: 1.0 },  // 🔥 Close
  { angle: 36,  distance: 0.254, size: 1.296, speed: 1.14, alpha: 1.0 }, // 🔥 Far
  { angle: 66,  distance: 0.130, size: 1.776, speed: 0.91, alpha: 1.0 },  // 🔥 Close
  { angle: 96,  distance: 0.263, size: 1.416, speed: 1.24, alpha: 1.0 }, // 🔥 Far
  { angle: 126, distance: 0.071, size: 1.26, speed: 0.90, alpha: 1.0 },  // 🔥 Close
  { angle: 156, distance: 0.282, size: 1.5, speed: 1.11, alpha: 1.0 }, // 🔥 Far
  { angle: 186, distance: 0.130, size: 1.584, speed: 1.20, alpha: 1.0 }, // 🔥 Close
  { angle: 216, distance: 0.329, size: 1.344, speed: 1.06, alpha: 1.0 },  // 🔥 Very far
  { angle: 246, distance: 0.083, size: 1.704, speed: 0.92, alpha: 1.0 }, // 🔥 Close
  { angle: 276, distance: 0.254, size: 1.224, speed: 1.31, alpha: 1.0 }, // 🔥 Far
  { angle: 306, distance: 0.106, size: 1.464, speed: 0.96, alpha: 1.0 }, // 🔥 Close
  { angle: 336, distance: 0.310, size: 1.656, speed: 1.18, alpha: 1.0 }, // 🔥 Far
  { angle: 21,  distance: 0.047, size: 1.296, speed: 0.85, alpha: 1.0 },   // 🔥 Very close
  { angle: 51,  distance: 0.245, size: 1.536, speed: 1.07, alpha: 1.0 }, // 🔥 Far
  { angle: 81,  distance: 0.142, size: 1.38, speed: 1.26, alpha: 1.0 }, // 🔥 Close
  { angle: 111, distance: 0.292, size: 1.536, speed: 0.93, alpha: 1.0 }, // 🔥 Far
  { angle: 141, distance: 0.094, size: 1.38, speed: 1.17, alpha: 1.0 }, // 🔥 Close
  { angle: 171, distance: 0.272, size: 1.584, speed: 1.04, alpha: 1.0 }, // 🔥 Far
  { angle: 201, distance: 0.071, size: 1.296, speed: 1.12, alpha: 1.0 }, // 🔥 Close
  { angle: 231, distance: 0.245, size: 1.44, speed: 1.00, alpha: 1.0 }  // 🔥 Far
];
const woodenPatternWildJuiceOrganic5 = [
  // Foam explosion - varied angles, oscillating distances (40%+ increase, far ones 20% closer) - 🔥 USER REQUEST: 20% larger shards
  { angle: 9,   distance: 0.059, size: 1.62, speed: 0.83, alpha: 1.0 },  // 🔥 Very close
  { angle: 39,  distance: 0.301, size: 1.296, speed: 1.12, alpha: 1.0 }, // 🔥 Far
  { angle: 69,  distance: 0.094, size: 1.776, speed: 0.92, alpha: 1.0 },  // 🔥 Close
  { angle: 99,  distance: 0.263, size: 1.416, speed: 1.22, alpha: 1.0 }, // 🔥 Far
  { angle: 129, distance: 0.071, size: 1.26, speed: 0.91, alpha: 1.0 },  // 🔥 Close
  { angle: 159, distance: 0.282, size: 1.5, speed: 1.10, alpha: 1.0 }, // 🔥 Far
  { angle: 189, distance: 0.130, size: 1.584, speed: 1.19, alpha: 1.0 }, // 🔥 Close
  { angle: 219, distance: 0.329, size: 1.344, speed: 1.05, alpha: 1.0 },  // 🔥 Very far
  { angle: 249, distance: 0.083, size: 1.704, speed: 0.95, alpha: 1.0 }, // 🔥 Close
  { angle: 279, distance: 0.254, size: 1.224, speed: 1.30, alpha: 1.0 }, // 🔥 Far
  { angle: 309, distance: 0.106, size: 1.464, speed: 0.99, alpha: 1.0 }, // 🔥 Close
  { angle: 339, distance: 0.310, size: 1.656, speed: 1.15, alpha: 1.0 }, // 🔥 Far
  { angle: 24,  distance: 0.047, size: 1.296, speed: 0.86, alpha: 1.0 },   // 🔥 Very close
  { angle: 54,  distance: 0.245, size: 1.536, speed: 1.08, alpha: 1.0 }, // 🔥 Far
  { angle: 84,  distance: 0.142, size: 1.38, speed: 1.25, alpha: 1.0 }, // 🔥 Close
  { angle: 114, distance: 0.292, size: 1.536, speed: 0.96, alpha: 1.0 }, // 🔥 Far
  { angle: 144, distance: 0.094, size: 1.38, speed: 1.16, alpha: 1.0 }, // 🔥 Close
  { angle: 174, distance: 0.272, size: 1.584, speed: 1.02, alpha: 1.0 }, // 🔥 Far
  { angle: 204, distance: 0.071, size: 1.296, speed: 1.11, alpha: 1.0 }  // 🔥 Close
];
function wildMagnetMerge6ShardsTemplated(board, tile, opts = {}) {
  if (!board || !tile) {
    console.warn('⚠️ wildMagnetMerge6ShardsTemplated: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  const customShardColors = Array.isArray(opts.colors) && opts.colors.length ? opts.colors : null;

  // 🔥 FIX: Use pull-specific patterns for pull animations, regular patterns for main merge
  const mergeType = opts.isPullAnimation ? 'wildMagnetPull' : 'wildMagnet';
  const patternInfo = selectPattern(mergeType);
  
  if (!patternInfo) {
    console.error('❌ wildMagnetMerge6ShardsTemplated: No pattern selected - template manager may not be initialized');
    // 🔥 FALLBACK: Use woodShardsAtTile for reliability
    console.log('🔄 Falling back to woodShardsAtTile');
    woodShardsAtTile(board, tile, {
      enhanced: true,
      wild: true,
      wildMagnet: true,
      isWildJuice: false,
      count: 30,
      intensity: 1.9,
      spread: 0.3,
      size: 1.5,
      speed: 0.85,
      vanishDelay: 0.0,
      vanishJitter: 0.02,
      color: customShardColors?.[0] ?? opts.color,
      colors: customShardColors,
    });
    return;
  }
  
  const { patternName, patternData, pool, template } = patternInfo;
  const params = getParams('wildMagnet');
  const redColor = customShardColors?.[0] ?? opts.color ?? getColor('wildMagnet');
  const brownColor = customShardColors?.[1] ?? customShardColors?.[0] ?? getColor('regular');
  
  console.log(`🎨 wildMagnetMerge6ShardsTemplated: Using pattern: ${patternName} (${patternData.length} shards)`, {
    redColor: `0x${redColor.toString(16)}`,
    brownColor: `0x${brownColor.toString(16)}`,
    poolSize: pool.getStats?.()?.poolSize || 'unknown',
    boardVisible: board.visible,
    boardAlpha: board.alpha
  });
  
  // Get position
  let x, y;
  if (tile.x !== undefined && tile.y !== undefined) {
    x = tile.x;
    y = tile.y;
  } else {
    const pos = centerInBoard(board, tile, params.tileSize || 96);
    x = pos.x;
    y = pos.y;
  }
  
  console.log(`🎨 wildMagnetMerge6ShardsTemplated: Position: (${x}, ${y})`);
  
  // Create layer
  const layer = new Container();
  attachFxContainerActivity(layer, opts.activityLeaseLabel ?? 'special-merge6-shards');
  layer.x = x;
  layer.y = y;
  layer.visible = true;
  layer.alpha = 1.0;
  layer.zIndex = opts.zIndex ?? 9993;
  
  // 🔥 CRITICAL: Add layer to board BEFORE creating shards
  board.addChild(layer);
  
  // 🔥 CRITICAL: Force sort to ensure zIndex is respected
  try {
    board.sortableChildren = true;
    board.sortChildren?.();
  } catch (e) {
    console.warn('⚠️ Failed to sort board children:', e);
  }
  
  console.log(`🎨 wildMagnetMerge6ShardsTemplated: Layer created and added to board`, {
    layerX: layer.x,
    layerY: layer.y,
    layerVisible: layer.visible,
    layerAlpha: layer.alpha,
    layerZIndex: layer.zIndex,
    layerInBoard: board.children.includes(layer),
    boardChildrenCount: board.children.length
  });
  
  // Track shards for cleanup
  const shardsInLayer = [];
  const baseTile = params.baseTile || 96;
  
  // Spawn each shard according to pattern
  patternData.forEach((shardDef, index) => {
    // 🔥 POOLING: Acquire Graphics from pattern-specific pool
    // pool.acquire() already calls reset() which handles all cleanup and reset
    const shard = pool.acquire();
    
    // Only set pattern-specific alpha (reset() already set it to 1.0)
    shard.alpha = shardDef.alpha || 1.0;
    
    // 🔥 COLOR MIX: 38% brown (regular), 62% red (wild magnet)
    const useBrown = Math.random() < 0.38; // 38% chance for brown
    const shardColor = useBrown ? brownColor : redColor;
    
    // Draw shard (filled polygon shape - same as non-templated version)
    // 🔥 CRITICAL FIX: Use filled polygons instead of lines for visibility
    // Wild-magnet uses same size as regular merge
    const baseSize = (8 + Math.random() * 10) * (shardDef.size || 1.0) * 2.4; // Match regular merge size
    const width = baseSize;
    const height = width * (0.8 + Math.random() * 1.4);
    
    // Create irregular polygon shape (same as non-templated woodShardsAtTile)
    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points
    
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      points.push(px, py);
    }
    
    // Draw filled polygon using PixiJS v8 API
    try {
      shard.poly(points).fill({ color: shardColor, alpha: params.lineAlpha || 0.85 });
    } catch (e) {
      // Fallback to rect if poly fails
      console.warn('⚠️ Failed to draw poly, using rect fallback:', e);
      shard.clear();
      const size = Math.max(4, Math.max(...points.map((p, i) => Math.abs(p))) * 2);
      shard.rect(-size/2, -size/2, size, size).fill({ color: shardColor, alpha: params.lineAlpha || 0.85 });
    }
    
    // 🔥 CRITICAL: Force bounds update AFTER drawing
    try {
      if (typeof shard.updateBounds === 'function') {
        shard.updateBounds();
      }
    } catch (e) {
      console.warn('⚠️ Failed to update shard bounds:', e);
    }
    
    // 🔥 CRITICAL: Set rotation BEFORE adding to layer (matches non-templated behavior)
    shard.rotation = Math.random() * Math.PI;
    
    // 🔥 CRITICAL: Add to layer BEFORE animation (ensures shard is in render tree)
    layer.addChild(shard);
    shardsInLayer.push(shard);
    
    // 🔥 DEBUG: Log first shard for verification
    if (index === 0) {
      console.log(`🎨 wildMagnetMerge6ShardsTemplated: First shard created`, {
        shardVisible: shard.visible,
        shardAlpha: shard.alpha,
        shardX: shard.x,
        shardY: shard.y,
        shardRotation: shard.rotation,
        shardInLayer: layer.children.includes(shard),
        layerChildrenCount: layer.children.length,
        shardColor: `0x${shardColor.toString(16)}`,
        isBrown: useBrown
      });
    }
    
    // Calculate travel distance (pattern distance is normalized 0-1)
    // 🔥 FIX: Add larger random offset for brown shards to prevent overlap with red shards
    // Brown shards get z-index offset to render behind red shards, plus position offset
    const angleOffset = useBrown ? (Math.random() - 0.5) * 25 : 0; // ±12.5 degrees for brown shards (larger offset)
    const distanceOffset = useBrown ? (Math.random() - 0.5) * 0.08 : 0; // ±4% distance offset for brown shards (larger offset)
    const angle = ((shardDef.angle + angleOffset) * Math.PI) / 180;
    const distance = (shardDef.distance + distanceOffset) * baseTile * (params.spread || 1.0);
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    
    // 🔥 FIX: Set z-index offset for brown shards (render behind red shards)
    // Red shards: zIndex = 0 (default, on top)
    // Brown shards: zIndex = -1 (behind red shards)
    if (useBrown) {
      shard.zIndex = -1; // Brown shards render behind red shards
    } else {
      shard.zIndex = 0; // Red shards render on top
    }
    
    // Animate shard
    // 🔥 FIX: Add stagger delay for organic feel - shards don't all go at once
    // Each shard gets a small random delay (0-0.08s) to create organic, non-uniform explosion
    const staggerDelay = Math.random() * 0.08; // 0-80ms stagger for organic feel
    const travelDur = (params.travelDuration || 0.35) * shardDef.speed * (params.speed || 1.0);
    const fadeDelay = (params.fadeDelay ?? 0.15) + (params.fadeDelayMultiplier ?? 0.1) * Math.random();
    const fadeDur = params.fadeDuration ?? 0.25;
    
    trackTween(shard, {
      delay: staggerDelay, // 🔥 Organic stagger - shards don't all start at once
      x: targetX,
      y: targetY,
      duration: travelDur,
      ease: 'power2.out'
    });
    
    trackTween(shard, {
      alpha: 0,
      delay: fadeDelay,
      duration: fadeDur,
      ease: 'power2.in'
    });
  });
  
  console.log(`🎨 wildMagnetMerge6ShardsTemplated: Created ${shardsInLayer.length} shards in layer`);
  
  // Cleanup layer after TTL
  const ttl = params.ttl || 1.0;
  trackDelayedCall(ttl, () => {
    console.log(`🎨 wildMagnetMerge6ShardsTemplated: Cleaning up ${shardsInLayer.length} shards after TTL ${ttl}s`);
    
    // Return all shards to pool
    shardsInLayer.forEach((shard, idx) => {
      try {
        gsap.killTweensOf(shard);
        gsap.killTweensOf(shard.x);
        gsap.killTweensOf(shard.y);
        gsap.killTweensOf(shard.alpha);
        gsap.killTweensOf(shard.scale);
        gsap.killTweensOf(shard.rotation);
        
        if (shard.parent === layer) {
          layer.removeChild(shard);
        }
        pool.release(shard);
      } catch (e) {
        console.warn(`⚠️ Error cleaning up shard ${idx}:`, e);
      }
    });
    
    // Destroy layer
    try {
      releaseFxContainerActivity(layer);
      layer.destroy({ children: false });
    } catch (e) {
      console.warn('⚠️ Error destroying layer:', e);
    }
  });
}

function wildStarMerge6ShardsTemplated(board, tile, opts = {}) {
  if (!board || !tile) {
    console.warn('⚠️ wildStarMerge6ShardsTemplated: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  console.log('⭐ wildStarMerge6ShardsTemplated: Called', { board: !!board, tile: !!tile, opts });

  // Select pattern from template
  const patternInfo = selectPattern('wildStar');
  
  if (!patternInfo) {
    console.error('❌ wildStarMerge6ShardsTemplated: No pattern selected - template manager may not be initialized');
    console.error('❌ Debug info:', {
      activeTemplate: getActiveTemplate()?.name,
      patternMap: getActiveTemplate()?.patternMap,
      wildStarPatterns: getActiveTemplate()?.patternMap?.wildStar
    });
    // 🔥 FALLBACK: Use woodShardsAtTile for reliability
    console.log('🔄 Falling back to woodShardsAtTile');
    woodShardsAtTile(board, tile, {
      enhanced: true,
      wild: true,
      wildMagnet: false,
      isWildJuice: false,
      skipStars: opts.skipStars,
      count: 18,
      intensity: 1.35,
      spread: 0.7,
      size: 1.3,
      speed: 1.0,
      vanishDelay: 0.0,
      vanishJitter: 0.02
    });
    return;
  }
  
  const { patternName, patternData, pool, template } = patternInfo;
  const params = getParams('wildStar');
  const shardPalette = Array.isArray(opts.colors) && opts.colors.length
    ? opts.colors.filter((color) => Number.isFinite(color))
    : [];
  const yellowColor = opts.color ?? shardPalette[0] ?? getColor('wildStar'); // 🔥 ORIGINAL COLOR: Yellow (#FFCB47), override for special dice
  
  console.log(`⭐ wildStarMerge6ShardsTemplated: Using pattern: ${patternName} (${patternData.length} shards)`, {
    yellowColor: `0x${yellowColor.toString(16)}`,
    poolSize: pool.getStats?.()?.poolSize || 'unknown',
    boardVisible: board.visible,
    boardAlpha: board.alpha,
    params: params,
    patternDataLength: patternData.length,
    spread: params.spread,
    baseTile: params.baseTile || 96,
    maxDistance: Math.max(...patternData.map(s => s.distance)) * (params.baseTile || 96) * (params.spread || 1.0)
  });
  
  // Get position
  let x, y;
  if (tile.x !== undefined && tile.y !== undefined) {
    x = tile.x;
    y = tile.y;
  } else {
    const pos = centerInBoard(board, tile, params.tileSize || 96);
    x = pos.x;
    y = pos.y;
  }
  
  // Create layer
  const layer = new Container();
  attachFxContainerActivity(layer, opts.activityLeaseLabel ?? 'special-merge6-shards');
  layer.x = x;
  layer.y = y;
  layer.visible = true;
  layer.alpha = 1.0;
  layer.zIndex = opts.zIndex ?? 9993;
  
  // 🔥 CRITICAL: Add layer to board BEFORE creating shards
  board.addChild(layer);
  
  // 🔥 CRITICAL: Force sort to ensure zIndex is respected
  try {
    board.sortableChildren = true;
    board.sortChildren?.();
  } catch (e) {
    console.warn('⚠️ Failed to sort board children:', e);
  }
  
  // Track shards for cleanup
  const shardsInLayer = [];
  const baseTile = params.baseTile || 96;
  
  // Spawn each shard according to pattern
  patternData.forEach((shardDef, index) => {
    // 🔥 POOLING: Acquire Graphics from pattern-specific pool
    const shard = pool.acquire();
    
    // Only set pattern-specific alpha (reset() already set it to 1.0)
    shard.alpha = shardDef.alpha || 1.0;
    
    // Draw shard (filled polygon shape)
    const baseSize = (6 + Math.random() * 8) * (shardDef.size || 1.0) * 2.4;
    const width = baseSize;
    const height = width * (0.8 + Math.random() * 1.4);
    
    // Create irregular polygon shape
    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points
    
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      points.push(px, py);
    }
    
    // Draw filled polygon using PixiJS v8 API - 🔥 ORIGINAL COLOR: Yellow
    const shardColor = shardPalette.length ? shardPalette[index % shardPalette.length] : yellowColor;
    try {
      shard.poly(points).fill({ color: shardColor, alpha: params.lineAlpha || 0.9 });
    } catch (e) {
      // Fallback to rect if poly fails
      console.warn('⚠️ Failed to draw poly, using rect fallback:', e);
      shard.clear();
      const size = Math.max(4, Math.max(...points.map((p, i) => Math.abs(p))) * 2);
      shard.rect(-size/2, -size/2, size, size).fill({ color: shardColor, alpha: params.lineAlpha || 0.9 });
    }
    
    // 🔥 CRITICAL: Force bounds update AFTER drawing
    try {
      if (typeof shard.updateBounds === 'function') {
        shard.updateBounds();
      }
    } catch (e) {
      console.warn('⚠️ Failed to update shard bounds:', e);
    }
    
    // 🔥 CRITICAL: Ensure shard is visible and properly positioned
    shard.visible = true;
    shard.alpha = shardDef.alpha || 1.0;
    shard.x = 0;
    shard.y = 0;
    
    // 🔥 CRITICAL: Set rotation BEFORE adding to layer
    shard.rotation = Math.random() * Math.PI;
    
    // 🔥 CRITICAL: Add to layer BEFORE animation (ensures shard is in render tree)
    layer.addChild(shard);
    shardsInLayer.push(shard);
    
    // 🔥 CRITICAL: Force render update (ensures shard is drawn before animation starts)
    try {
      if (layer.parent) {
        layer.parent.sortableChildren = true;
      }
    } catch (e) {
      console.warn('⚠️ Failed to set sortableChildren:', e);
    }
    
    // Calculate travel distance (pattern distance is normalized 0-1)
    // 🔥 FIX: Add stagger delay for organic feel
    const staggerDelay = Math.random() * 0.08; // 0-80ms stagger for organic feel
    const angle = (shardDef.angle * Math.PI) / 180;
    const distance = shardDef.distance * baseTile * (params.spread || 1.0);
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    
    // 🔥 DEBUG: Log first shard animation details
    if (index === 0) {
      console.log(`⭐ wildStarMerge6ShardsTemplated: First shard animation`, {
        shardDefDistance: shardDef.distance,
        baseTile: baseTile,
        spread: params.spread || 1.0,
        calculatedDistance: distance,
        targetX: targetX,
        targetY: targetY,
        angle: shardDef.angle,
        travelDur: (params.travelDuration || 0.4) * shardDef.speed * (params.speed || 1.0),
        shardVisible: shard.visible,
        shardAlpha: shard.alpha,
        shardInLayer: layer.children.includes(shard)
      });
    }
    
    // Animate shard
    const travelDur = (params.travelDuration || 0.4) * shardDef.speed * (params.speed || 1.0);
    const fadeDelay = (params.fadeDelay ?? 0.15) + (params.fadeDelayMultiplier ?? 0.1) * Math.random();
    const fadeDur = params.fadeDuration ?? 0.25;
    
    trackTween(shard, {
      delay: staggerDelay, // 🔥 Organic stagger
      x: targetX,
      y: targetY,
      duration: travelDur,
      ease: 'power2.out'
    });
    
    trackTween(shard, {
      alpha: 0,
      delay: fadeDelay,
      duration: fadeDur,
      ease: 'power2.in'
    });
  });
  
  console.log(`⭐ wildStarMerge6ShardsTemplated: Created ${shardsInLayer.length} shards in layer`, {
    layerX: layer.x,
    layerY: layer.y,
    layerVisible: layer.visible,
    layerAlpha: layer.alpha,
    layerZIndex: layer.zIndex,
    layerInBoard: board.children.includes(layer),
    layerChildrenCount: layer.children.length,
    firstShardVisible: shardsInLayer[0]?.visible,
    firstShardAlpha: shardsInLayer[0]?.alpha,
    firstShardInLayer: shardsInLayer[0] ? layer.children.includes(shardsInLayer[0]) : false
  });
  
  // Cleanup layer after TTL
  const ttl = params.ttl || 1.2;
  trackDelayedCall(ttl, () => {
    // Return all shards to pool
    shardsInLayer.forEach((shard, idx) => {
      try {
        gsap.killTweensOf(shard);
        gsap.killTweensOf(shard.x);
        gsap.killTweensOf(shard.y);
        gsap.killTweensOf(shard.alpha);
        gsap.killTweensOf(shard.scale);
        gsap.killTweensOf(shard.rotation);
        
        if (shard.parent === layer) {
          layer.removeChild(shard);
        }
        pool.release(shard);
      } catch (e) {
        console.warn(`⚠️ Error cleaning up shard ${idx}:`, e);
      }
    });
    
    // Destroy layer
    try {
      releaseFxContainerActivity(layer);
      layer.destroy({ children: false });
    } catch (e) {
      console.warn('⚠️ Error destroying layer:', e);
    }
  });
}

function wildJuiceMerge6ShardsTemplated(board, tile, opts = {}) {
  if (!board || !tile) {
    console.warn('⚠️ wildJuiceMerge6ShardsTemplated: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  // Select pattern from template
  const patternInfo = selectPattern('wildJuice');
  
  if (!patternInfo) {
    console.error('❌ wildJuiceMerge6ShardsTemplated: No pattern selected - template manager may not be initialized');
    console.error('❌ Debug info:', {
      activeTemplate: getActiveTemplate()?.name,
      patternMap: getActiveTemplate()?.patternMap,
      wildJuicePatterns: getActiveTemplate()?.patternMap?.wildJuice
    });
    // 🔥 FALLBACK: Use woodShardsAtTile for reliability
    woodShardsAtTile(board, tile, {
      enhanced: true,
      wild: true,
      wildMagnet: false,
      isWildJuice: true,
      count: 18,
      intensity: 1.35,
      spread: 0.7,
      size: 1.3,
      speed: 1.0,
      vanishDelay: 0.0,
      vanishJitter: 0.02
    });
    return;
  }
  
  const { patternName, patternData, pool, template } = patternInfo;
  const params = getParams('wildJuice');
  const orangeColor = opts.color ?? getColor('wildJuice'); // 🔥 ORIGINAL COLOR: Orange (#F99D77), override for special dice
  const shardColors = Array.isArray(opts.colors) && opts.colors.length
    ? opts.colors.filter((color) => Number.isFinite(color))
    : null;

  // Get position
  let x, y;
  if (tile.x !== undefined && tile.y !== undefined) {
    x = tile.x;
    y = tile.y;
  } else {
    const pos = centerInBoard(board, tile, params.tileSize || 96);
    x = pos.x;
    y = pos.y;
  }
  
  // Create layer
  const layer = new Container();
  attachFxContainerActivity(layer, opts.activityLeaseLabel ?? 'special-merge6-shards');
  layer.x = x;
  layer.y = y;
  layer.visible = true;
  layer.alpha = 1.0;
  layer.zIndex = opts.zIndex ?? 9993;
  
  // 🔥 CRITICAL: Add layer to board BEFORE creating shards
  board.addChild(layer);
  
  // 🔥 CRITICAL: Force sort to ensure zIndex is respected
  try {
    board.sortableChildren = true;
    board.sortChildren?.();
  } catch (e) {
    console.warn('⚠️ Failed to sort board children:', e);
  }
  
  // Track shards for cleanup
  const shardsInLayer = [];
  const baseTile = params.baseTile || 96;
  
  // Spawn each shard according to pattern
  patternData.forEach((shardDef, index) => {
    // 🔥 POOLING: Acquire Graphics from pattern-specific pool
    const shard = pool.acquire();
    
    // Only set pattern-specific alpha (reset() already set it to 1.0)
    shard.alpha = shardDef.alpha || 1.0;
    
    // Draw shard (filled polygon shape)
    const baseSize = (6 + Math.random() * 8) * (shardDef.size || 1.0) * 2.4;
    const width = baseSize;
    const height = width * (0.8 + Math.random() * 1.4);
    
    // Create irregular polygon shape
    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4); // 4-7 points
    
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      points.push(px, py);
    }
    
    // Draw filled polygon using PixiJS v8 API - 🔥 ORIGINAL COLOR: Orange
    const shardColor = shardColors?.length
      ? shardColors[index % shardColors.length]
      : orangeColor;
    try {
      shard.poly(points).fill({ color: shardColor, alpha: params.lineAlpha || 0.9 });
    } catch (e) {
      // Fallback to rect if poly fails
      console.warn('⚠️ Failed to draw poly, using rect fallback:', e);
      shard.clear();
      const size = Math.max(4, Math.max(...points.map((p, i) => Math.abs(p))) * 2);
      shard.rect(-size/2, -size/2, size, size).fill({ color: shardColor, alpha: params.lineAlpha || 0.9 });
    }
    
    // 🔥 CRITICAL: Force bounds update AFTER drawing
    try {
      if (typeof shard.updateBounds === 'function') {
        shard.updateBounds();
      }
    } catch (e) {
      console.warn('⚠️ Failed to update shard bounds:', e);
    }
    
    // 🔥 CRITICAL: Ensure shard is visible and properly positioned
    shard.visible = true;
    shard.alpha = shardDef.alpha || 1.0;
    shard.x = 0;
    shard.y = 0;
    
    // 🔥 CRITICAL: Set rotation BEFORE adding to layer
    shard.rotation = Math.random() * Math.PI;
    
    // 🔥 CRITICAL: Add to layer BEFORE animation (ensures shard is in render tree)
    layer.addChild(shard);
    shardsInLayer.push(shard);
    
    // 🔥 CRITICAL: Force render update (ensures shard is drawn before animation starts)
    try {
      if (layer.parent) {
        layer.parent.sortableChildren = true;
      }
    } catch (e) {
      console.warn('⚠️ Failed to set sortableChildren:', e);
    }
    
    // Calculate travel distance (pattern distance is normalized 0-1)
    // 🔥 FIX: Add stagger delay for organic feel
    const staggerDelay = Math.random() * 0.08; // 0-80ms stagger for organic feel
    const angle = (shardDef.angle * Math.PI) / 180;
    const distance = shardDef.distance * baseTile * (params.spread || 1.0);
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    
    // Animate shard
    const travelDur = (params.travelDuration || 0.4) * shardDef.speed * (params.speed || 1.0);
    const fadeDelay = (params.fadeDelay ?? 0.15) + (params.fadeDelayMultiplier ?? 0.1) * Math.random();
    const fadeDur = params.fadeDuration ?? 0.25;
    
    trackTween(shard, {
      delay: staggerDelay, // 🔥 Organic stagger
      x: targetX,
      y: targetY,
      duration: travelDur,
      ease: 'power2.out'
    });
    
    trackTween(shard, {
      alpha: 0,
      delay: fadeDelay,
      duration: fadeDur,
      ease: 'power2.in'
    });
  });
  
  // Cleanup layer after TTL
  const ttl = params.ttl || 1.2;
  trackDelayedCall(ttl, () => {
    // Return all shards to pool
    shardsInLayer.forEach((shard, idx) => {
      try {
        gsap.killTweensOf(shard);
        gsap.killTweensOf(shard.x);
        gsap.killTweensOf(shard.y);
        gsap.killTweensOf(shard.alpha);
        gsap.killTweensOf(shard.scale);
        gsap.killTweensOf(shard.rotation);
        
        if (shard.parent === layer) {
          layer.removeChild(shard);
        }
        pool.release(shard);
      } catch (e) {
        console.warn(`⚠️ Error cleaning up shard ${idx}:`, e);
      }
    });
    
    // Destroy layer
    try {
      releaseFxContainerActivity(layer);
      layer.destroy({ children: false });
    } catch (e) {
      console.warn('⚠️ Error destroying layer:', e);
    }
  });
}

function wildTntMerge6ShardsTemplated(board, tile, opts = {}) {
  if (!board || !tile) {
    console.warn('⚠️ wildTntMerge6ShardsTemplated: Missing board or tile', { board: !!board, tile: !!tile });
    return;
  }

  const patternInfo = selectPattern('wildTnt');
  const sizeScale = Number.isFinite(opts.sizeScale) ? Math.max(0.1, Number(opts.sizeScale)) : 1;
  if (!patternInfo) {
    console.error('❌ wildTntMerge6ShardsTemplated: No pattern selected - falling back to woodShardsAtTile');
    woodShardsAtTile(board, tile, {
      enhanced: true,
      wild: true,
      wildMagnet: false,
      isWildJuice: false,
      count: 18,
      intensity: 1.35,
      spread: 0.7,
      size: 1.3,
      visualSizeScale: sizeScale,
      speed: 1.0,
      vanishDelay: 0.0,
      vanishJitter: 0.02
    });
    return;
  }

  const { patternName, patternData, pool, template } = patternInfo;
  const params = getParams('wildTnt');
  const tntColor = opts.color ?? getColor('wildTnt'); // Variant override or core orange-red.
  const shardColors = Array.isArray(opts.colors) && opts.colors.length
    ? opts.colors.filter((color) => Number.isFinite(color))
    : null;

  let x, y;
  if (tile.x !== undefined && tile.y !== undefined) {
    x = tile.x;
    y = tile.y;
  } else {
    const pos = centerInBoard(board, tile, params.tileSize || 96);
    x = pos.x;
    y = pos.y;
  }

  const layer = new Container();
  attachFxContainerActivity(layer, opts.activityLeaseLabel ?? 'special-merge6-shards');
  layer.x = x;
  layer.y = y;
  layer.visible = true;
  layer.alpha = 1.0;
  layer.zIndex = opts.zIndex ?? 9993;
  board.addChild(layer);
  try {
    board.sortableChildren = true;
    board.sortChildren?.();
  } catch (e) {}

  const shardsInLayer = [];
  const baseTile = params.baseTile || 96;

  patternData.forEach((shardDef, index) => {
    const shard = pool.acquire();
    shard.alpha = shardDef.alpha || 1.0;
    const baseSize = (6 + Math.random() * 8) * (shardDef.size || 1.0) * 2.4 * sizeScale;
    const width = baseSize;
    const height = width * (0.8 + Math.random() * 1.4);
    const points = [];
    const numPoints = 4 + Math.floor(Math.random() * 4);
    for (let j = 0; j < numPoints; j++) {
      const angle = (j / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const radius = (0.3 + Math.random() * 0.7) * Math.min(width, height) / 2;
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    try {
      const shardColor = shardColors?.[index % shardColors.length] ?? tntColor;
      shard.poly(points).fill({ color: shardColor, alpha: params.lineAlpha || 0.9 });
    } catch (e) {
      shard.clear();
      const size = Math.max(4, Math.max(...points.map((p, i) => Math.abs(p))) * 2);
      const shardColor = shardColors?.[index % shardColors.length] ?? tntColor;
      shard.rect(-size/2, -size/2, size, size).fill({ color: shardColor, alpha: params.lineAlpha || 0.9 });
    }
    try { if (typeof shard.updateBounds === 'function') shard.updateBounds(); } catch (e) {}
    shard.visible = true;
    shard.alpha = shardDef.alpha || 1.0;
    shard.x = 0;
    shard.y = 0;
    shard.rotation = Math.random() * Math.PI;
    layer.addChild(shard);
    shardsInLayer.push(shard);

    const staggerDelay = Math.random() * 0.08;
    const angle = (shardDef.angle * Math.PI) / 180;
    const distance = shardDef.distance * baseTile * (params.spread || 1.0);
    const targetX = Math.cos(angle) * distance;
    const targetY = Math.sin(angle) * distance;
    const travelDur = (params.travelDuration || 0.4) * shardDef.speed * (params.speed || 1.0);
    const fadeDelay = (params.fadeDelay ?? 0.15) + (params.fadeDelayMultiplier ?? 0.1) * Math.random();
    const fadeDur = params.fadeDuration ?? 0.25;

    trackTween(shard, { delay: staggerDelay, x: targetX, y: targetY, duration: travelDur, ease: 'power2.out' });
    trackTween(shard, { alpha: 0, delay: fadeDelay, duration: fadeDur, ease: 'power2.in' });
  });

  const ttl = params.ttl || 1.2;
  trackDelayedCall(ttl, () => {
    shardsInLayer.forEach((shard, idx) => {
      try {
        gsap.killTweensOf(shard);
        gsap.killTweensOf(shard.x);
        gsap.killTweensOf(shard.y);
        gsap.killTweensOf(shard.alpha);
        gsap.killTweensOf(shard.scale);
        gsap.killTweensOf(shard.rotation);
        if (shard.parent === layer) layer.removeChild(shard);
        pool.release(shard);
      } catch (e) {}
    });
    releaseFxContainerActivity(layer);
    try { layer.destroy({ children: false }); } catch (e) {}
  });
}

"""#
    func testAllThirteenVariantProfilesMatchImmutableV9ConstructionAndRandomOrder()throws {
        let context=try XCTUnwrap(JSContext());context.evaluateScript(Self.sourceOracle)
        XCTAssertNil(context.exception)
        let variants:[String?]=[nil]+NativeSpecialDiceRegistry.variants.keys.sorted().map{Optional($0)}
        for variant in variants {
            let archetype=variant.flatMap{NativeSpecialDiceRegistry.variants[$0]?.archetype} ?? .star
            let profile=try XCTUnwrap(NativeWildMergeSixShardProfile.make(archetype:archetype,variant:variant))
            for pattern in profile.patterns.indices {
                var seed:UInt32=123,draws=0
                let plan=try NativeWildMergeSixShardPlan(profile:profile,pattern:pattern,random:{seed=seed &* 1664525 &+ 1013904223;draws+=1;return Double(seed)/4294967296},current:{true},acquire:{_ in},materialize:{_,_ in},register:{_,_ in})
                let json=try XCTUnwrap(context.objectForKeyedSubscript("oracle")?.call(withArguments:[profile.family.rawValue,variant ?? "",pattern,123])?.toString())
                XCTAssertNil(context.exception)
                let data=try XCTUnwrap(json.data(using:.utf8)),expected=try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any])
                XCTAssertEqual(expected["draws"] as? Int,draws,"\(variant ?? "core") pattern\(pattern)")
                XCTAssertEqual(expected["ttl"] as? Double,profile.ttl)
                let shards=try XCTUnwrap(expected["shards"] as? [[String:Any]])
                XCTAssertEqual(shards.count,plan.shards.count)
                for (actual,oracle) in zip(plan.shards,shards) {
                    XCTAssertEqual(oracle["color"] as? UInt32,actual.color)
                    let points=try XCTUnwrap(oracle["points"] as? [Double]);XCTAssertEqual(points.count,actual.points.count)
                    for (a,b) in zip(actual.points,points){XCTAssertEqual(a,b,accuracy:1e-9)}
                    for (key,value) in [("alpha",actual.alpha),("rotation",actual.rotation),("depth",actual.depth),("dx",actual.dx),("dy",actual.dy),("travelDuration",actual.travelDuration),("travelDelay",actual.travelDelay),("fadeDelay",actual.fadeDelay)] {
                        XCTAssertEqual(try XCTUnwrap(oracle[key] as? Double),value,accuracy:1e-9,"\(variant ?? "core") \(key)")
                    }
                }
            }
        }
        XCTAssertNil(NativeWildMergeSixShardProfile.make(archetype:.tnt,variant:nil))
        XCTAssertEqual(NativeWildMergeSixShardProfile.make(archetype:.tnt,variant:"beach-ball")?.family,.juice)
        XCTAssertEqual(NativeWildMergeSixShardProfile.make(archetype:.tnt,variant:"barell")?.sizeScale,0.7)
    }
    func testWildTTLFreezesWithGlobalAnimationPauseAndDisposalCannotStealReusedPool()throws {
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),scheduler=NativeSharedSmokeValueRootScheduler(runtime:runtime)
        let canvas=SKNode(),pool=NativeSharedVectorSpritePool(),profile=try XCTUnwrap(NativeWildMergeSixShardProfile.make(archetype:.star,variant:"kanta"))
        var releases=0
        func make()throws->NativeWildMergeSixShardOwner {
            try .init(profile:profile,pattern:0,pool:pool,canvas:canvas,origin:CGPoint(x:80,y:90),renderScale:0.4,depth:9993,generation:1,scheduler:scheduler,current:{true},random:{0.3},acquireActivity:{_ in {releases+=1}})
        }
        let old=try make();let count=old.activeShardCount;XCTAssertGreaterThan(count,0)
        for ms in stride(from:0,through:500,by:10){runtime.deliver(wallMilliseconds:Double(ms))}
        runtime.setGlobalPaused(true);runtime.deliver(wallMilliseconds:2000)
        XCTAssertEqual(old.activeShardCount,count);XCTAssertEqual(releases,0)
        old.dispose();XCTAssertEqual(releases,1);XCTAssertEqual(pool.activeCount,0)
        let replacement=try make(),node=try XCTUnwrap(replacement.layer.children.first)
        old.dispose();XCTAssertTrue(node.parent === replacement.layer);XCTAssertEqual(releases,1)
        runtime.setGlobalPaused(false)
        for ms in stride(from:2010,through:3500,by:10){runtime.deliver(wallMilliseconds:Double(ms))}
        XCTAssertTrue(replacement.disposed);XCTAssertNil(replacement.layer.parent);XCTAssertEqual(pool.activeCount,0);XCTAssertEqual(releases,2)
        runtime.dispose();replacement.dispose();XCTAssertEqual(releases,2)
    }
    func testHostileFirstMathDrawStopsConstructionAndReleasesCapturedResourcesExactlyOnce()throws {
        let runtime=NativeSourceAnimationRuntime(wallOriginMilliseconds:0),scheduler=NativeSharedSmokeValueRootScheduler(runtime:runtime)
        let canvas=SKNode(),pool=NativeSharedVectorSpritePool(),profile=try XCTUnwrap(NativeWildMergeSixShardProfile.make(archetype:.star,variant:"kanta"))
        var current=true,draws=0,releases=0
        XCTAssertThrowsError(try NativeWildMergeSixShardOwner(profile:profile,pattern:0,pool:pool,canvas:canvas,
            origin:.zero,renderScale:1,depth:9993,generation:1,scheduler:scheduler,current:{current},
            random:{draws+=1;current=false;return 0.3},acquireActivity:{_ in {releases+=1}}))
        XCTAssertEqual(draws,1);XCTAssertEqual(releases,1);XCTAssertEqual(pool.activeCount,0)
        XCTAssertTrue(canvas.children.isEmpty);runtime.dispose();XCTAssertEqual(releases,1)
    }
}
