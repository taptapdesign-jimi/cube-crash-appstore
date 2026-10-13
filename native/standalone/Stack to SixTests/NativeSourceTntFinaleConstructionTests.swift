import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceTntFinaleConstructionTests:XCTestCase {
    func testActualUIKitGlyphConsumesCapturedPlanWithoutSecondCtorEntropy()throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        var draws=0
        let plan=try XCTUnwrap(NativeSourceSplashGlyphPlan.capture(text:"BOOM",random:{draws+=1;return 0.2},current:{true}))
        XCTAssertEqual(draws,18)
        let color=UIColor(red:241.0/255,green:132.0/255,blue:83.0/255,alpha:1)
        let field=NativeSplashGlyphField(artwork:JimiV9Artwork(resourceRoot:root),text:"BOOM",colors:[color,color],splitIndex:0,
            deferExitRotationCapture:true,sourcePlan:plan,random:{draws+=1;return 0.8})
        let labels=try XCTUnwrap(field.subviews.first).subviews.compactMap{$0 as? UILabel}
        XCTAssertEqual(labels.count,4);XCTAssertEqual(draws,18)
        for (index,label) in labels.enumerated() {
            XCTAssertEqual(label.font.pointSize,CGFloat(plan.sizes[index]),accuracy:0.0001)
            XCTAssertEqual(label.textColor.cgColor.alpha,CGFloat(plan.opacities[index]),accuracy:0.0001)
        }
        XCTAssertTrue(field.captureSourceExitRotations(random:{draws+=1;return 0.2},current:{true}))
        XCTAssertEqual(draws,22)
        XCTAssertTrue(field.captureSourceExitRotations(random:{draws+=1;return 0.2},current:{true}));XCTAssertEqual(draws,22)
    }
    func testGenuineCtorThenDeferredBounceExitAndVisibleSequenceBeforeParentTail()throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),textures=NativeBoardTextures(root:root)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        defer{service.dispose()}
        var draws=0,state:UInt32=7,glyphs:NativeSplashGlyphField?
        let random:()->Double={draws+=1;state=state &* 1664525 &+ 1013904223;return Double(state)/4294967296}
        let construction=try XCTUnwrap(NativeTntFinale.captureSourceConstruction(textures:textures,current:{true},random:random,prepareGlyphs:{
            guard let plan=NativeSourceSplashGlyphPlan.capture(text:"BOOM",random:random,current:{true}) else{return false}
            glyphs=NativeSplashGlyphField(artwork:JimiV9Artwork(resourceRoot:root),text:"BOOM",colors:[.orange],splitIndex:0,
                deferExitRotationCapture:true,sourcePlan:plan)
            return true
        }))
        XCTAssertEqual(draws,282,"Actual DOM glyph18, authored sixteen-die plans240, per-frame initial24; no eager bounce/exit")
        let owner=NativeTntFinale(textures:textures,fontName:"Helvetica",viewport:.init(width:390,height:844),showsTitle:false,
            sourceConstruction:construction,sourceRandom:random,random:{XCTFail("Source cannot draw hidden Raw title or fallback entropy");return 0.5})
        XCTAssertEqual(draws,282)
        var frameSix=0,sequence=0,complete=0
        owner.onGlyphClock={time,finished in
            guard !finished,let glyphs else{return}
            if time>=glyphs.exitStart {XCTAssertTrue(glyphs.captureSourceExitRotations(random:random,current:{true}))}
            glyphs.paint(seconds:time)
        }
        XCTAssertTrue(owner.playSource(service:service,current:{true},frameSix:{frameSix+=1},sequenceComplete:{sequence+=1},completion:{complete+=1}))
        for wall in stride(from:10.0,through:400.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(draws,282);XCTAssertEqual(frameSix,0)
        service.deliver(wallMilliseconds:415);XCTAssertEqual(draws,284)
        for wall in stride(from:420.0,through:520.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(frameSix,1);XCTAssertEqual(sequence,0)
        for wall in stride(from:530.0,through:1000.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(draws,310)
        for wall in stride(from:1010.0,through:1760.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(sequence,1);XCTAssertEqual(complete,0,"Real visible sequence cannot wait for independent4.2s debris tail")
        for wall in stride(from:1770.0,through:4300.0,by:10){service.deliver(wallMilliseconds:wall)}
        XCTAssertEqual(draws,310);XCTAssertEqual(sequence,1);XCTAssertEqual(complete,1)
    }
    func testConstructorResourceRetirementStopsAfterRealDrawWithoutAllocatingFinale() {
        let textures=NativeBoardTextures(root:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"))
        var draws=0
        let construction=NativeTntFinale.captureSourceConstruction(textures:textures,current:{true},random:{draws+=1;textures.dispose();return 0.2},prepareGlyphs:{true})
        XCTAssertNil(construction);XCTAssertEqual(draws,1)
    }
}

@MainActor final class NativeFlowerReplacementInteractionTests:XCTestCase {
 func testDelayedOpacitySweepUsesRetainedBeeDestinationCleanupAfterMainRetiresFaceOwner()async throws {
  try await runFlower(reversed:true,mergeSix:false,sweepRace:"bee",retainedCleanupSweep:true)
 }
 /// Every registry identity traverses the real meter constructor and contact
 /// prefix. The delayed board/opacity sweeps run after both face RAFs delivered,
 /// while gameplay is paused; metadata must not resurrect the retired skin.
 func testDelayedSpawnSafetyCoversEveryRegisteredVariantAndBaseArchetype()async throws {
  let identities=NativeSpecialDiceRegistry.variants.keys.sorted()+NativeWildArchetype.allCases.map(\.rawValue)
  for identity in identities {
   try await runFlower(reversed:true,mergeSix:false,sweepRace:identity)
  }
 }
 func testRetainedDirectCleanupSafetyCoversEveryDirectVariantAndBase()async throws {
  let identities=NativeSpecialDiceRegistry.variants.values.filter{$0.archetype == .star || $0.archetype == .juice}.map(\.id).sorted()+[NativeWildArchetype.star.rawValue,NativeWildArchetype.juice.rawValue]
  for identity in identities {
   try await runFlower(reversed:true,mergeSix:false,sweepRace:identity,retainedCleanupSweep:true)
  }
 }
 func testActualDelayedSpawnSweepsDuringFlowerAndHoneyClearedSix()async throws {
  for variant in ["flower","honey"] {
   try await runFlower(reversed:true,mergeSix:false,sweepRace:variant)
  }
 }
 func testActualDelayedSweepsKeepConsumedSixHiddenForEveryMagnetBacking()async throws {
  for variant in ["wild-magnet","honey","bottle","spaceship"] {
   try await runFlower(reversed:true,mergeSix:false,sweepRace:variant,hideDuringSweep:true)
  }
 }
 func testFlowerReplacementsCanStackAfterActualMountedTransaction()async throws {
  try await runFlower(reversed:false,mergeSix:false)
  try await runFlower(reversed:true,mergeSix:false)
 }
 func testFlowerReplacementsCanMergeSixAfterActualMountedTransaction()async throws {
  try await runFlower(reversed:false,mergeSix:true)
  try await runFlower(reversed:true,mergeSix:true)
 }
 private func runFlower(reversed:Bool,mergeSix:Bool,sweepRace:String?=nil,hideDuringSweep:Bool=false,retainedCleanupSweep:Bool=false)async throws {
  let root=NativeTestResources.root,fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let origin=Date().timeIntervalSince1970*1000
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:origin,sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=tasks
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:origin,visualRandom:{0.2},sourceMicrotaskTasks:tasks)
  let saved=NativeBoardState(tiles:[.init(id:"a",cell:.init(column:0,row:0),value:2),.init(id:"b",cell:.init(column:1,row:0),value:3),.init(id:"c",cell:.init(column:2,row:0),value:2),.init(id:"d",cell:.init(column:3,row:0),value:1),.init(id:"far",cell:.init(column:4,row:8),value:1),.init(id:"locked",cell:.init(column:0,row:1),value:0,locked:true)],board:10,wildMeter:0.95)
  let construction=try XCTUnwrap(NativeSourceInitialBoardConstruction.makeRestoredRegular(root:root,service:service,saved:saved,random:context.mathRandom.next))
  let variant=sweepRace ?? "flower"
  let base=NativeWildArchetype(rawValue:variant)
  let rewardVariant:String?=base == nil ? variant:nil
  let rewardCore:NativeWildArchetype=base ?? NativeSpecialDiceRegistry.variants[variant]!.archetype
  let engine=NativeGameplayEngine(state:try XCTUnwrap(construction.recipe?.state),rewardPicker:{_,_ in .init(rewardCore,variant:rewardVariant)},sourceMathRandom:context.mathRandom)
  engine.sourceOrdinaryStackFacesEnabled=true;engine.sourceStarOrbitCountAtPresentationEnabled=true
  let game=NativeGameplayViewController(engine:engine,resourceRoot:root)
  let audio=NativeGameplayAudioOwner(root:root,enabled:false)
  defer {audio.dispose()}
  var audioReceipt:UInt64=0
  game.onSpecialMoment={variant,moment,index in
   audioReceipt &+= 1
   audio.specialMoment(variant:variant ?? "wild-magnet",moment:moment,index:index,receipt:audioReceipt,generation:engine.state.generation)
  }
  game.captureSourceMagnetCleanup={_,generation in audio.captureMagnetPullCleanup(generation:generation)}
  game.sourceContext=context;game.sourceInitialConstruction=construction
  game.sourceSmallStackPresentationEnabled=true;game.sourceOrdinaryPresentationEnabled=true
  game.sourceDirectPresentationEnabled=true;game.sourceTntPresentationEnabled=true
  game.sourceMagnetPresentationEnabled=rewardCore == .magnet
  game.sourceSpecialIdlePresentationEnabled=true;game.sourceEndgameMutationLedgerEnabled=true
  game.sourceGameplayRuntimeObservationEnabled=true;game.sourceRegularIdlePresentationEnabled=true
  game.sourceOrdinaryEndgamePresentationEnabled=true
  game.loadViewIfNeeded()
  let scope=try XCTUnwrap(game.sourceScope)
  let hudReady=expectation(description:"original HUD upload before mounted Source layout")
  var prepared:NativeSourceHUDStarTexturePreparation.Prepared?
  scope.hudStarTextures.prepare(root:root,current:{scope.current}) {prepared=$0;hudReady.fulfill()}
  await fulfillment(of:[hudReady],timeout:8)
  XCTAssertTrue(game.configureSourceDirectHUDPresentation(prepared:try XCTUnwrap(prepared)))
  let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=game;window.makeKeyAndVisible()
  game.view.frame=window.bounds;game.view.layoutIfNeeded()
  defer {game.dispose();construction.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;window.rootViewController=nil}
  let scene=try XCTUnwrap(game.boardScene)
  var failures:[String]=[];scene.onSourcePresentationFailure={reason,_ in failures.append(reason)}
  func wait(_ label:String,timeout:Double=12,_ predicate:@escaping @MainActor()->Bool)async {
   let end=Date().addingTimeInterval(timeout)
   while !predicate(),Date()<end {try? await Task.sleep(for:.milliseconds(20))}
   XCTAssertTrue(predicate(),label+" failures="+failures.joined(separator:","))
  }
  func move(_ source:NativeCell,_ destination:NativeCell)throws->NativeMoveResult {
   let geometry=try XCTUnwrap(scene.boardGeometry),a=geometry.center(row:source.row,column:source.column),b=geometry.center(row:destination.row,column:destination.column)
   var result:NativeMoveResult?
   tasks.inputTask {XCTAssertTrue(scene.beginDrag(at:a));scene.moveDrag(to:b,now:CACurrentMediaTime());result=scene.finishDrag(at:b,now:CACurrentMediaTime())}
   return try XCTUnwrap(result)
  }
  await wait("Source graph ready"){scene.sourceHUDStarJobsAdmissionOpen && scene.isBoardEntryComplete}
  let resources=NativeWildMeterDropResources(root:root)
  defer {resources.dispose()}
  let meterReady=expectation(description:"actual Source meter resources")
  resources.prepare(arcade:false,capture:.init(id:"flower-test-meter",generation:engine.state.generation,epoch:1)){_ in meterReady.fulfill()}
  await fulfillment(of:[meterReady],timeout:8)
  XCTAssertTrue(game.configureSourceMeterAndStarPresentation(resources:resources,texturesCurrent:{true},selectedAudio:{_,_ in},carrierAudio:{_,_,_ in {}},landingSound:{}))
  XCTAssertTrue(try move(.init(column:0,row:0),.init(column:1,row:0)).accepted)
  await wait("Wild earned and landed"){engine.state.tiles.contains{$0.variant==rewardVariant && $0.gameplayArchetype==rewardCore && $0.isPlayable} && !engine.sourceMeterHandoffInProgress && !engine.sourceMeterSpawnInProgress}
  let flower=try XCTUnwrap(engine.state.tiles.first{$0.variant==rewardVariant && $0.gameplayArchetype==rewardCore})
  if sweepRace != nil,!hideDuringSweep {XCTAssertTrue(scene.scheduleSourceSpawnVisualSafetySweep())}
  let flowerMove=try move(reversed ? .init(column:2,row:0):flower.cell,reversed ? flower.cell:.init(column:2,row:0))
  XCTAssertTrue(flowerMove.accepted,String(describing:flowerMove.events)+scene.sourceTntMainDiagnostic())
  if retainedCleanupSweep {
   await wait("direct main transfers hidden \(variant) to actual cleanup claim") {
    engine.sourceRetainedDirectDestination?.tileID==flower.id
   }
   service.setSourceGlobalPaused(true)
   defer {service.setSourceGlobalPaused(false)}
   let node=try XCTUnwrap(scene.sourceNativeTileNode(flower.id))
   XCTAssertTrue(scene.sourceRetainedDirectCleanupPresentationCurrent(node,scope:scope,generation:engine.state.generation))
   XCTAssertFalse(node.sourceClearedWildSixPresentationCurrent(model:try XCTUnwrap(engine.state.tiles.first{$0.id==flower.id})),"Main has retired the face owner; cleanup is now the authority")
   let texture=node.sourcePaintedNumbersTexture,before=engine.state
   XCTAssertTrue(scene.scheduleSourceSpawnVisualSafetySweep())
   try await Task.sleep(for:.milliseconds(1350))
   XCTAssertTrue(failures.isEmpty,failures.joined(separator:","))
   XCTAssertEqual(engine.state,before)
   XCTAssertTrue(node.isHidden);XCTAssertEqual(node.alpha,0)
   XCTAssertTrue(node.sourcePaintedNumbersTexture === texture)
   XCTAssertTrue(scene.sourceRetainedDirectCleanupPresentationCurrent(node,scope:scope,generation:engine.state.generation))
   node.isHidden=false
   XCTAssertFalse(scene.sourceRetainedDirectCleanupPresentationCurrent(node,scope:scope,generation:engine.state.generation),"Visible state contradicts hidden cleanup ownership")
   node.isHidden=true
   scene.dispose()
   XCTAssertFalse(scene.sourceRetainedDirectCleanupPresentationCurrent(node,scope:scope,generation:engine.state.generation),"Retirement cannot retain safety authority")
   return
  }
  if sweepRace != nil {
   // Wall safety600/1200 runs while real APP global pause keeps main80
   // pending. Independent face RAFs still deliver, as in the source runtime.
   if hideDuringSweep {
    await wait("actual second pull consumes six",timeout:20){engine.pendingSourceMagnetLazyRespawn != nil}
    XCTAssertTrue(scene.sourceNativeTileNode(flower.id)?.isHidden==true)
   }
   service.setSourceGlobalPaused(true)
   defer {service.setSourceGlobalPaused(false)}
   if hideDuringSweep {XCTAssertTrue(scene.scheduleSourceSpawnVisualSafetySweep())}
   await wait("genuine cleared residual six"){scene.sourceNativeTileNode(flower.id)?.sourceResidualWildPresence==true}
   let node=try XCTUnwrap(scene.sourceNativeTileNode(flower.id))
   let texture=node.sourcePaintedNumbersTexture
   try await Task.sleep(for:.milliseconds(1350))
   XCTAssertEqual(node.sourceWildDestinationFrameCount,0)
   XCTAssertTrue(node.sourceClearedWildSixPresentationCurrent(model:try XCTUnwrap(engine.state.tiles.first{$0.id==flower.id})))
   XCTAssertTrue(node.sourcePaintedNumbersTexture === texture)
   if hideDuringSweep {
    XCTAssertTrue(node.isHidden);XCTAssertEqual(node.alpha,0)
    XCTAssertEqual(engine.state.tile(at:flower.cell)?.id,flower.id)
    XCTAssertEqual(engine.state.tile(at:flower.cell)?.value,6)
    XCTAssertFalse(engine.state.tile(at:flower.cell)?.visible ?? true)
   }
   XCTAssertTrue(failures.isEmpty,variant+":"+failures.joined(separator:","))
   return
  }
  await wait("Flower board mutation complete",timeout:20){engine.pendingSpecial==nil && engine.state.tiles.contains{$0.id.hasPrefix("native:") && !$0.isWild && $0.value>0}}
  let ordinary=engine.state.tiles.filter{$0.isPlayable && !$0.isWild}
  for tile in ordinary {
   let node=try XCTUnwrap(scene.sourceNativeTileNode(tile.id))
   XCTAssertTrue(node.sourceMergeSixFaceReady(service:service),"replacement face not merge-ready "+tile.id)
  }
  let pair=try XCTUnwrap(ordinary.flatMap{a in ordinary.filter{$0.id != a.id && (mergeSix ? a.value+$0.value==6:a.value+$0.value<6)}.map{(a,$0)}}.first)
  let result=try move(pair.0.cell,pair.1.cell)
  XCTAssertTrue(result.accepted,"actual replacement drop rejected: "+String(describing:result.events))
  if mergeSix {
   await wait("replacement merge-six main committed"){engine.state.tiles.first{$0.id==pair.1.id}?.value==6 || !engine.state.tiles.contains{$0.id==pair.0.id}}
  } else {
   await wait("replacement stack main committed"){engine.state.tiles.first{$0.id==pair.1.id}?.value==pair.0.value+pair.1.value && !engine.state.tiles.contains{$0.id==pair.0.id}}
  }
  XCTAssertTrue(failures.isEmpty,failures.joined(separator:","))
 }
}
