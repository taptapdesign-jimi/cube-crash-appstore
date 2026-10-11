import XCTest
import SpriteKit
import JavaScriptCore
@testable import Stack_to_Six

/// Runs the immutable production-benchmark-v9 actual startTntBoardBlast body.
@MainActor final class NativeTntBoardBlastTests:XCTestCase {
    private static let sourceScript = #"""
(function(){const results=[];
for(const seed of [1,7,42,1337])for(const rest of [[0,0],[40,-60],[0.25,0.25]]){
let state=seed>>>0,draws=0;const saved=Math.random;
Math.random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const tile={x:rest[0],y:rest[1],value:3},allBlastTiles=[tile],TILE=80,blastStrength=TILE*0.4,blastCenter={x:0,y:0},board={};
const tntBlastWobbleTweens=[],blastReturnHandles=[],tweens=[];
const centerInBoard=(board,tile)=>({x:tile.x,y:tile.y});
const isTileBoardBlastDisplacing=()=>false,isWildLikeSpecial=()=>false,markTileBoardBlastDisplacing=()=>{};
const gsap={killTweensOf(){},set(tile,values){Object.assign(tile,values)}};
const trackTween=(tile,values)=>{tweens.push(values);return values;};
try {
                  allBlastTiles.forEach((tile) => {
                    if (!tile || tile.destroyed) return;
                    if (tile._ccWildSpawnDropping === true) return;
                    if (isTileBoardBlastDisplacing(tile)) return;
                    // User requested: move only active cubes (no locked/ghost placeholders).
                    if (tile.locked) return;
                    const tileValue = (tile.value | 0);
                    const isWildLike = isWildLikeSpecial(tile.special);
                    if (!isWildLike && tileValue <= 0) return;
                    const origX = tile.x ?? 0;
                    const origY = tile.y ?? 0;
                    const tileCenter = centerInBoard(board, tile, TILE);
                    const dx = tileCenter.x - blastCenter.x;
                    const dy = tileCenter.y - blastCenter.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    // Ensure every tile moves: if tile is exactly on blast center,
                    // assign a random outward direction instead of skipping.
                    let dirX = 0;
                    let dirY = 0;
                    if (distance < 1) {
                      const angle = Math.random() * Math.PI * 2;
                      dirX = Math.cos(angle);
                      dirY = Math.sin(angle);
                    } else {
                      dirX = dx / distance;
                      dirY = dy / distance;
                    }
                    const blastDist = blastStrength * (1 + Math.random() * 0.3);
                    const blastX = origX + dirX * blastDist;
                    const blastY = origY + dirY * blastDist;

                    markTileBoardBlastDisplacing(tile, origX, origY);
                    try { gsap.killTweensOf(tile); } catch {}
                    gsap.set(tile, { x: origX, y: origY });

	                    const returnDuration = 0.58 + Math.random() * 0.12;
	                    const returnElastic = 0.14 + Math.random() * 0.08;
	                    const blastDuration = 0.62 + Math.random() * 0.14;
                    const wobbleAmp = TILE * (0.03 + Math.random() * 0.05);
                    const wobbleDur = 0.7 + Math.random() * 0.5;
                    const wobbleElastic = 0.35 + Math.random() * 0.2;

                    trackTween(tile, {
                      x: blastX,
                      y: blastY,
                      duration: blastDuration,
                      ease: `elastic.out(1, ${returnElastic})`,
                      overwrite: 'auto'
                    });

                    const wobble = trackTween(tile, {
                      x: blastX + (Math.random() - 0.5) * wobbleAmp,
                      y: blastY + (Math.random() - 0.5) * wobbleAmp,
                      duration: wobbleDur,
                      delay: blastDuration,
                      repeat: -1,
                      yoyo: true,
                      ease: `elastic.inOut(1, ${wobbleElastic})`
                    });
                    try { tntBlastWobbleTweens.push(wobble); } catch {}

                    blastReturnHandles.push({
                      tile,
                      wobble,
                      origX,
                      origY,
                      returnDuration,
                      returnElastic
                    });
                  });
const handle=blastReturnHandles[0];results.push({seed,rest,draws,state,blast:tweens[0],wobble:tweens[1],returnDuration:handle.returnDuration,returnElastic:handle.returnElastic});
}finally{Math.random=saved;}}
return JSON.stringify(results);})()
"""#
    func testRecipeMatchesActualV9JavaScriptCoreDrawOrderAndReflectedGeometry()throws {
        let context=try XCTUnwrap(JSContext())
        let string=try XCTUnwrap(context.evaluateScript(Self.sourceScript)?.toString())
        XCTAssertNil(context.exception)
        let rows=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(string.utf8)) as? [[String:Any]])
        for row in rows {
            var state=(row["seed"] as! NSNumber).uint32Value,draws=0
            let rest=row["rest"] as! [Double]
            let plan=try XCTUnwrap(NativeTntBoardBlastPlan.make(rest:.init(x:rest[0],y:-rest[1]),center:.zero,tileSize:80,random:{
                draws+=1;state=1664525 &* state &+ 1013904223;return Double(state)/4294967296
            },current:{true}))
            let blast=row["blast"] as! [String:Any],wobble=row["wobble"] as! [String:Any]
            func number(_ object:[String:Any],_ key:String)->Double {(object[key] as! NSNumber).doubleValue}
            XCTAssertEqual(draws,(row["draws"] as! NSNumber).intValue);XCTAssertEqual(state,(row["state"] as! NSNumber).uint32Value)
            XCTAssertEqual(plan.blast.x,number(blast,"x"),accuracy:1e-10);XCTAssertEqual(plan.blast.y,-number(blast,"y"),accuracy:1e-10)
            XCTAssertEqual(plan.wobble.x,number(wobble,"x"),accuracy:1e-10);XCTAssertEqual(plan.wobble.y,-number(wobble,"y"),accuracy:1e-10)
            XCTAssertEqual(plan.blastDuration,number(blast,"duration"),accuracy:1e-12)
            XCTAssertEqual(plan.wobbleDuration,number(wobble,"duration"),accuracy:1e-12)
            XCTAssertEqual(plan.returnDuration,number(row,"returnDuration"),accuracy:1e-12)
            XCTAssertEqual(plan.returnElastic,number(row,"returnElastic"),accuracy:1e-12)
            XCTAssertEqual(wobble["ease"] as? String,"elastic.inOut(1, \(plan.wobbleElastic))")
        }
    }
    func testReentrantRandomRetirementStopsBeforeFurtherDrawOrSceneMutation() {
        var alive=true,draws=0
        let plan=NativeTntBoardBlastPlan.make(rest:.init(x:40,y:0),center:.zero,tileSize:80,
            random:{draws+=1;alive=false;return 0.5},current:{alive})
        XCTAssertNil(plan);XCTAssertEqual(draws,1)
    }
    func testAlreadyRetiredAndInvalidDrawRefuse() {
        var draws=0
        XCTAssertNil(NativeTntBoardBlastPlan.make(rest:.zero,center:.zero,tileSize:80,random:{draws+=1;return 0.5},current:{false}))
        XCTAssertEqual(draws,0)
        XCTAssertNil(NativeTntBoardBlastPlan.make(rest:.zero,center:.zero,tileSize:80,random:{.nan},current:{true}))
    }

    // Actual immutable v9 helper, TypeScript annotations removed by its compiler.
    // helper SHA256 edc05716ad2a7a4c391c6ddd4eac714b12923ff267601d9c8f076122f5468141
    private static let beachBallSourceScript = #"""
(function(){const results=[];for(const seed of [1,42,1337])for(const positions of [[[0,0]],[[20,30],[140,-70],[-5,80]],[[0,0],[0.25,0.25],[150,0]]]){let state=seed>>>0,draws=0,dateCalls=0;const originalRandom=Math.random,originalDate=Date.now;Math.random=()=>{draws++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};Date.now=()=>100000+(dateCalls++)*17;const input=positions.map(([x,y])=>({x,y,value:3})),dst={},src={},STATE={tiles:input},tiles=input,TILE=80,board={sortChildren(){}};const centerInBoard=(board,tile)=>tile===dst?{x:0,y:0}:{x:tile.x,y:tile.y};const isTileBoardBlastDisplacing=()=>false,isWildLikeSpecial=()=>false,clearTileBoardBlastDisplacement=()=>{},markTileBoardBlastDisplacing=()=>{},makeBoard={syncTileZIndex(){}};const gsap={killTweensOf(){},set(tile,values){Object.assign(tile,values)}},out=[];const trackTimeline=()=>({to(tile,values){out.push(values);return this}}),devLog=()=>{},devWarn=()=>{};try{const playShortWildMerge6TileBlast = (label, options = {}) => {
    const heldHandles = [];
    try {
        const blastCenter = centerInBoard(board, dst, TILE);
        const blastStrength = TILE * 0.52;
        const blastDuration = 0.40;
        const returnDelay = 0.10;
        const returnDuration = 0.64;
        const allTiles = Array.from(new Set([
            ...(Array.isArray(STATE?.tiles) ? STATE.tiles : []),
            ...(Array.isArray(tiles) ? tiles : [])
        ]));
        let blastCount = 0;
        const blastTargets = [];
        let maxDistance = 1;
        allTiles.forEach((tile) => {
            if (!tile || tile.destroyed || tile === dst || tile === src)
                return;
            if (tile._ccWildSpawnDropping === true)
                return;
            if (isTileBoardBlastDisplacing(tile))
                return;
            if (tile.locked)
                return;
            const tileValue = (tile.value | 0);
            const isWildLike = isWildLikeSpecial(tile.special);
            if (!isWildLike && tileValue <= 0)
                return;
            const origX = tile.x ?? 0;
            const origY = tile.y ?? 0;
            const tileCenter = centerInBoard(board, tile, TILE);
            const dx = tileCenter.x - blastCenter.x;
            const dy = tileCenter.y - blastCenter.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            let dirX = 0;
            let dirY = 0;
            if (distance < 1) {
                const angle = Math.random() * Math.PI * 2;
                dirX = Math.cos(angle);
                dirY = Math.sin(angle);
            }
            else {
                const jitterAngle = (Math.random() - 0.5) * 0.58;
                const baseAngle = Math.atan2(dy, dx) + jitterAngle;
                dirX = Math.cos(baseAngle);
                dirY = Math.sin(baseAngle);
            }
            maxDistance = Math.max(maxDistance, distance);
            blastTargets.push({ tile, origX, origY, dirX, dirY, distance });
        });
        blastTargets.forEach(({ tile, origX, origY, dirX, dirY, distance }) => {
            const waveProgress = Math.min(1, distance / maxDistance);
            const waveDelay = (waveProgress * 0.26) + (Math.random() * 0.035);
            const blastDist = blastStrength * (0.86 + Math.random() * 0.52);
            const blastX = origX + dirX * blastDist;
            const blastY = origY + dirY * blastDist;
            const tileBlastDuration = blastDuration * (0.88 + Math.random() * 0.22);
            const tileReturnDuration = returnDuration * (0.9 + Math.random() * 0.22);
            let zIndexRestored = false;
            const restoreZIndex = () => {
                if (zIndexRestored || tile.destroyed)
                    return;
                zIndexRestored = true;
                try {
                    makeBoard.syncTileZIndex(tile, board);
                }
                catch { }
            };
            const finishBlastTile = () => {
                clearTileBoardBlastDisplacement(tile, origX, origY);
                restoreZIndex();
            };
            markTileBoardBlastDisplacing(tile, origX, origY);
            try {
                gsap.killTweensOf(tile);
            }
            catch { }
            gsap.set(tile, { x: origX, y: origY, zIndex: 320 });
            const timeline = trackTimeline({
                onComplete: () => {
                    if (!options.holdForExternalReturn)
                        finishBlastTile();
                },
                onInterrupt: finishBlastTile
            })
                .to(tile, {
                x: blastX,
                y: blastY,
                duration: tileBlastDuration,
                delay: waveDelay,
                ease: 'back.out(2.9)',
                overwrite: 'auto'
            });
            if (options.holdForExternalReturn) {
                heldHandles.push({
                    tile,
                    origX,
                    origY,
                    // Beach Ball releases TNT gameplay at the start of its visual
                    // sequence. Do not let that early handoff overwrite this
                    // tile's outward wave before it actually reaches the spread.
                    returnNotBeforeMs: Date.now() + Math.round((waveDelay + tileBlastDuration) * 1000),
                    returnDuration: 0.82 + Math.random() * 0.10,
                    returnElastic: 0.22 + Math.random() * 0.05,
                    returnAmplitude: 1.02 + Math.random() * 0.08,
                });
            }
            else {
                timeline.to(tile, {
                    x: origX,
                    y: origY,
                    duration: tileReturnDuration,
                    delay: returnDelay,
                    ease: `elastic.out(1, ${0.30 + Math.random() * 0.12})`,
                    overwrite: 'auto'
                });
            }
            blastCount += 1;
        });
        // Every target has its temporary z-index now. Sorting once avoids
        // repeatedly reordering the complete board during the same merge.
        if (blastCount > 0) {
            try {
                board?.sortChildren?.();
            }
            catch { }
        }
        devLog(`✨ ${label} merge 6 - Cubero-profile tile blast started`, {
            blastCount,
            holdForExternalReturn: options.holdForExternalReturn === true,
            waveDelayMaxSeconds: 0.295,
            blastStrengthTiles: 0.52,
        });
    }
    catch (e) {
        devWarn(`⚠️ ${label} tile blast animation failed:`, e);
    }
    return heldHandles;
};
const handles=playShortWildMerge6TileBlast('Beach Ball',{holdForExternalReturn:true});results.push({seed,positions,draws,state,dateCalls,out,handles:handles.map(({tile,...rest})=>rest)});}finally{Math.random=originalRandom;Date.now=originalDate;}}return JSON.stringify(results);})()
"""#
    func testBeachBallHeldWaveMatchesActualSourceTwoPassRNGAndDateOrder() throws {
        let js=try XCTUnwrap(JSContext()),encoded=try XCTUnwrap(js.evaluateScript(Self.beachBallSourceScript)?.toString())
        XCTAssertNil(js.exception)
        let rows=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(encoded.utf8)) as? [[String:Any]])
        for row in rows {
            var state=(row["seed"] as! NSNumber).uint32Value,draws=0,dates=0
            let rests=(row["positions"] as! [[Double]]).map{CGPoint(x:$0[0],y:-$0[1])}
            let plans=try XCTUnwrap(NativeShortWildBoardBlastPlan.make(rests:rests,center:.zero,tileSize:80,random:{
                draws+=1;state=1664525 &* state &+ 1013904223;return Double(state)/4294967296
            },dateMilliseconds:{defer{dates+=1};return Double(100000+dates*17)},current:{true}))
            XCTAssertEqual(draws,(row["draws"] as! NSNumber).intValue);XCTAssertEqual(state,(row["state"] as! NSNumber).uint32Value)
            XCTAssertEqual(dates,(row["dateCalls"] as! NSNumber).intValue)
            let out=row["out"] as! [[String:Any]],handles=row["handles"] as! [[String:Any]]
            func number(_ object:[String:Any],_ key:String)->Double {(object[key] as! NSNumber).doubleValue}
            for (index,plan) in plans.enumerated() {
                XCTAssertEqual(plan.blast.x,number(out[index],"x"),accuracy:1e-10);XCTAssertEqual(plan.blast.y,-number(out[index],"y"),accuracy:1e-10)
                XCTAssertEqual(plan.waveDelay,number(out[index],"delay"),accuracy:1e-12);XCTAssertEqual(plan.blastDuration,number(out[index],"duration"),accuracy:1e-12)
                XCTAssertEqual(plan.returnDuration,number(handles[index],"returnDuration"),accuracy:1e-12)
                XCTAssertEqual(plan.returnElastic,number(handles[index],"returnElastic"),accuracy:1e-12)
                XCTAssertEqual(plan.returnAmplitude,number(handles[index],"returnAmplitude"),accuracy:1e-12)
                XCTAssertEqual(plan.returnNotBeforeMilliseconds,number(handles[index],"returnNotBeforeMs"))
            }
        }
    }
    func testBeachBallReentrantDateRefusesBeforeHeldReturnDraws() {
        var alive=true,draws=0,dates=0
        XCTAssertNil(NativeShortWildBoardBlastPlan.make(rests:[.zero,.init(x:80,y:0)],center:.zero,tileSize:80,
            random:{draws+=1;return 0.5},dateMilliseconds:{dates+=1;alive=false;return 100000},current:{alive}))
        XCTAssertEqual(draws,6);XCTAssertEqual(dates,1)
    }
    func testUnheldStarJuiceWaveMatchesActualSourceWithoutDateOrHeldDraws() throws {
        let script=Self.beachBallSourceScript.replacingOccurrences(of:"{holdForExternalReturn:true}",with:"{holdForExternalReturn:false}")
        let js=try XCTUnwrap(JSContext()),encoded=try XCTUnwrap(js.evaluateScript(script)?.toString())
        XCTAssertNil(js.exception)
        let rows=try XCTUnwrap(JSONSerialization.jsonObject(with:Data(encoded.utf8)) as? [[String:Any]])
        for row in rows {
            var state=(row["seed"] as! NSNumber).uint32Value,draws=0,dates=0
            let rests=(row["positions"] as! [[Double]]).map{CGPoint(x:$0[0],y:-$0[1])}
            let plans=try XCTUnwrap(NativeShortWildBoardBlastPlan.make(rests:rests,center:.zero,tileSize:80,random:{
                draws+=1;state=1664525 &* state &+ 1013904223;return Double(state)/4294967296
            },dateMilliseconds:{dates+=1;return 100000},current:{true},held:false))
            XCTAssertEqual(draws,(row["draws"] as! NSNumber).intValue);XCTAssertEqual(state,(row["state"] as! NSNumber).uint32Value)
            XCTAssertEqual(dates,0);XCTAssertEqual((row["dateCalls"] as! NSNumber).intValue,0)
            let out=row["out"] as! [[String:Any]]
            func number(_ object:[String:Any],_ key:String)->Double {(object[key] as! NSNumber).doubleValue}
            for (index,plan) in plans.enumerated() {
                let outward=out[index*2],back=out[index*2+1]
                XCTAssertEqual(plan.blast.x,number(outward,"x"),accuracy:1e-10);XCTAssertEqual(plan.blast.y,-number(outward,"y"),accuracy:1e-10)
                XCTAssertEqual(plan.waveDelay,number(outward,"delay"),accuracy:1e-12);XCTAssertEqual(plan.blastDuration,number(outward,"duration"),accuracy:1e-12)
                XCTAssertEqual(plan.returnDelay,number(back,"delay"),accuracy:1e-12);XCTAssertEqual(plan.returnDuration,number(back,"duration"),accuracy:1e-12)
                XCTAssertEqual(back["ease"] as? String,"elastic.out(1, \(plan.returnElastic))")
                XCTAssertEqual(plan.returnAmplitude,1);XCTAssertNil(plan.returnNotBeforeMilliseconds)
            }
        }
    }
    func testActualFinaleSourceParentOwnsFrameSixAndModalPause() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        let textures=NativeBoardTextures(root:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"))
        XCTAssertNotNil(textures.texture("assets/shop/explosion pack/animation/tnt6.png"),"Genuine frame-six callback requires its actual authored frame")
        let owner=NativeTntFinale(textures:textures,fontName:"Helvetica",viewport:.init(width:320,height:640),random:{0.5})
        var frameSix=0,complete=0,lastPaint=0.0
        owner.onGlyphClock={seconds,disposed in if !disposed {lastPaint=seconds}}
        XCTAssertTrue(owner.playSource(service:service,current:{true},frameSix:{frameSix+=1},completion:{complete+=1}))
        for wall in stride(from:10.0,through:500.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(frameSix,0)
        XCTAssertTrue(service.setSourceGlobalPaused(true));let held=lastPaint
        for wall in stride(from:510.0,through:1000.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(lastPaint,held);XCTAssertEqual(frameSix,0)
        XCTAssertTrue(service.setSourceGlobalPaused(false))
        for wall in stride(from:1010.0,through:1100.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(frameSix,1);XCTAssertEqual(complete,0)
        for wall in stride(from:1110.0,through:4800.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(frameSix,1);XCTAssertEqual(complete,1);XCTAssertEqual(service.activeParticipantCount,0)
        owner.dispose();XCTAssertEqual(complete,1)
    }
    func testActualFinaleDestructionCancelsParentWithoutFabricatingCompletion() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        let owner=NativeTntFinale(textures:NativeBoardTextures(root:URL(fileURLWithPath:"/tmp/native-tnt-clock-no-assets")),fontName:"Helvetica",viewport:.init(width:320,height:640),random:{0.5})
        var frameSix=0,complete=0
        XCTAssertTrue(owner.playSource(service:service,current:{true},frameSix:{frameSix+=1},completion:{complete+=1}))
        service.deliver(wallMilliseconds:100);owner.dispose()
        for wall in stride(from:110.0,through:5000.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(frameSix,0);XCTAssertEqual(complete,0);XCTAssertEqual(service.activeParticipantCount,0)
    }

    func testActualTntReturnStartsFromPaintedPoseAndCancellationCannotFinish() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        let node=NativeDiceNode(id:"source-tnt-return",value:2,kind:"regular",variant:nil,depth:1,locked:false,textures:NativeBoardTextures(root:URL(fileURLWithPath:"/tmp/native-tnt-clock-no-assets")))
        let rest=CGPoint(x:40,y:60);node.position=rest
        let plan=NativeTntBoardBlastPlan.make(rest:rest,center:.zero,tileSize:64,random:{0.5},current:{true})!
        let owner=NativeSourceTntBoardBlastOwner(service:service);defer{owner.dispose();node.dispose()}
        XCTAssertTrue(owner.start(node:node,plan:plan,current:{true}))
        for wall in stride(from:10.0,through:500.0,by:10){service.deliver(wallMilliseconds:wall)}
        let painted=node.position;XCTAssertNotEqual(painted,rest)
        var finished=0
        XCTAssertTrue(owner.beginReturn{finished+=1})
        XCTAssertEqual(node.position,painted)
        for wall in stride(from:510.0,through:1300.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(node.position,rest);XCTAssertEqual(finished,1)
        XCTAssertEqual(service.activeParticipantCount,0)
        XCTAssertTrue(owner.start(node:node,plan:plan,current:{true}))
        XCTAssertTrue(owner.beginReturn{finished+=1});owner.dispose()
        for wall in stride(from:1310.0,through:2300.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(finished,1);XCTAssertEqual(service.activeParticipantCount,0)
    }

    func testMissingFrameSixCannotManufactureAnEarlySourceFrameCompletion() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        let owner=NativeTntFinale(textures:NativeBoardTextures(root:URL(fileURLWithPath:"/tmp/native-tnt-clock-no-assets")),fontName:"Helvetica",viewport:.init(width:320,height:640),random:{0.5})
        var frameSix=0,complete=0
        XCTAssertTrue(owner.playSource(service:service,current:{true},frameSix:{frameSix+=1},completion:{complete+=1}))
        for wall in stride(from:10.0,through:4300.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(frameSix,0);XCTAssertEqual(complete,1,"Only genuine parent completion remains available to the caller fallback")
    }

}
