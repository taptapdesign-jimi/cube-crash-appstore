import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeFishIdleTests:XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    private struct Matrix:Decodable {let a,b,c,d,tx,ty:Double}
    private struct Gold:Decodable {let width,height,alpha,opacity:Double,matrix:Matrix,css:[Double],facing:Bool}
    func testPoseAndOpacityMatchExecutedImmutableV9WorldMatrixAtThreeViewportFamilies() throws {
        let gold=try JSONDecoder().decode([Gold].self,from:Data(NativeFishIdleSourceOracle.json.utf8))
        XCTAssertEqual(gold.count,64)
        XCTAssertEqual(NativeFishIdlePresentation.logicalMediaSize.width,272*128.0/224,accuracy:1e-12)
        XCTAssertEqual(NativeFishIdlePresentation.logicalMediaSize.height,160,accuracy:1e-12)
        for fixture in gold {
            let m=fixture.matrix,center=CGPoint(x:m.tx,y:fixture.height-m.ty)
            let pose=NativeFishIdleFrame.project(center:center,horizontalUnit:CGPoint(x:center.x+m.a,y:center.y-m.b),verticalUnit:CGPoint(x:center.x+m.c,y:center.y-m.d),sceneHeight:fixture.height,alpha:fixture.alpha*0.7*0.8,dragging:false,phaseStarted:true,visible:true,bubbles:[])
            let transform=pose.transform,w=NativeFishIdlePresentation.logicalMediaSize.width,h=NativeFishIdlePresentation.logicalMediaSize.height
            let actual=[transform.a,transform.b,transform.c,transform.d,pose.point.x-transform.a*w/2-transform.c*h/2,pose.point.y-transform.b*w/2-transform.d*h/2]
            for (value,source) in zip(actual,fixture.css) {XCTAssertEqual(value,source,accuracy:1e-10)}
            XCTAssertEqual(pose.alpha,fixture.opacity,accuracy:1e-12)
            XCTAssertEqual(center.x>fixture.width/2,fixture.facing)
        }
    }
    func testOriginalFramesStayVisibleThroughPointerWithoutPNGHandoffOrPhaseReset() async throws {
        let fish=NativeTile(id:"fish",cell:NativeCell(column:0,row:0),value:0,archetype:.juice,variant:"fish")
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:[fish,NativeTile(id:"a",cell:NativeCell(column:1,row:0),value:1),NativeTile(id:"b",cell:NativeCell(column:2,row:0),value:2)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        defer {controller.dispose();window.isHidden=true}
        let host=try XCTUnwrap(controller.view.subviews.compactMap {$0 as? NativeFishIdleOwner}.first)
        let deadline=CACurrentMediaTime()+8
        while host.presentation(tileID:"fish")?.mediaReady != true,CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(25))}
        let owner=try XCTUnwrap(host.presentation(tileID:"fish")),scene=try XCTUnwrap(controller.boardScene)
        XCTAssertTrue(owner.mediaReady,"Actual unchanged original SVG must prepare and enter its captured phase")
        XCTAssertEqual(owner.playbackRate,0);XCTAssertEqual(owner.bubbleCarrierCount,6)
        XCTAssertTrue(owner.usesOriginalSVGFallback,"Board Fish must avoid video queue replacement at each loop")
        XCTAssertEqual(owner.retainedItemCount,0)
        XCTAssertEqual(host.selectedSVGFrameCount,72)
        let node=try XCTUnwrap(scene.childNode(withName:"//native-die-fish") as? NativeDiceNode)
        let field=try XCTUnwrap(node.visual.children.compactMap {$0 as? NativeIdleBubbleField}.first)
        XCTAssertTrue(field.isHidden,"The same bubble producer is mirrored once above source foreground video")
        let entryDeadline=CACurrentMediaTime()+3
        while (!scene.isBoardEntryComplete || owner.isHidden),CACurrentMediaTime()<entryDeadline {try await Task.sleep(for:.milliseconds(25))}
        XCTAssertTrue(scene.isBoardEntryComplete,"Wait for the actual authored entry completion and input admission");XCTAssertFalse(owner.isHidden)
        let face=try XCTUnwrap(node.visual.children.compactMap {$0 as? SKSpriteNode}.first)
        XCTAssertTrue(face.isHidden)
        // A sibling stack/merge suspends shared registry motion, never this
        // admitted direct-media identity or its already hidden static base.
        scene.onSpecialIdleSuspended?(true)
        XCTAssertFalse(owner.isHidden);XCTAssertEqual(owner.playbackRate,0)
        controller.refreshFromEngine()
        XCTAssertTrue(host.presentation(tileID:"fish") === owner)
        XCTAssertTrue(face.isHidden)
        scene.onSpecialIdleSuspended?(false)
        XCTAssertFalse(owner.isHidden);XCTAssertEqual(owner.playbackRate,0)
        let point=scene.boardGeometry!.center(row:0,column:0)
        XCTAssertTrue(scene.beginDrag(at:point));XCTAssertFalse(owner.isHidden);XCTAssertTrue(face.isHidden);XCTAssertEqual(owner.playbackRate,0)
        XCTAssertEqual(field.activeCount,0);XCTAssertTrue(field.isHidden)
        let held=owner.originalSVGFrame
        try await Task.sleep(for:.milliseconds(120))
        XCTAssertFalse(owner.isHidden);XCTAssertTrue(face.isHidden)
        XCTAssertNotEqual(owner.originalSVGFrame,held,"The same SVG clock keeps swimming while held")
        let image=UIGraphicsImageRenderer(size:window.bounds.size).image{window.layer.render(in:$0.cgContext)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/fishy-drag-svg.png"))
        XCTAssertEqual(scene.finishDrag(at:point,now:1)?.accepted,false)
        XCTAssertFalse(owner.isHidden,"Source media resumes on pointer-up while actual snapback still owns emitter restart")
        XCTAssertFalse(field.isRunning)
        let snapbackDeadline=CACurrentMediaTime()+2
        while !field.isRunning,CACurrentMediaTime()<snapbackDeadline {try await Task.sleep(for:.milliseconds(25))}
        XCTAssertTrue(field.isRunning,"Actual snapback must resume its bubble owner")
        controller.setSuspended(true)
        XCTAssertFalse(owner.isHidden,"Foreground modal pause retains the painted Fishy pose")
        let pausedFrame=owner.originalSVGFrame
        try await Task.sleep(for:.milliseconds(100))
        XCTAssertEqual(owner.originalSVGFrame,pausedFrame)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertTrue(owner.isHidden);XCTAssertEqual(owner.playbackRate,0)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        controller.setSuspended(false)
        engine.restart(state:NativeBoardState(columns:5,rows:9,tiles:[NativeTile(id:"a2",cell:NativeCell(column:1,row:0),value:1),NativeTile(id:"b2",cell:NativeCell(column:2,row:0),value:2)]))
        controller.refreshFromEngine()
        XCTAssertEqual(host.activeMediaCount,0);XCTAssertEqual(owner.retainedItemCount,0);XCTAssertEqual(owner.playbackRate,0)
    }
    func testConsumedFishMergeDoesNotLeaveOriginalBoardSVGVisible() async throws {
        let tiles=[NativeTile(id:"fish",cell:.init(column:0,row:0),value:6,starOrbitCount:1,archetype:.star,variant:"fish"),
                   NativeTile(id:"destination",cell:.init(column:1,row:0),value:2),
                   NativeTile(id:"a",cell:.init(column:3,row:3),value:1),NativeTile(id:"b",cell:.init(column:4,row:4),value:2)]
        let engine=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        defer {controller.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        let scene=try XCTUnwrap(controller.boardScene)
        let media=try XCTUnwrap(controller.view.subviews.compactMap{$0 as? NativeFishIdleOwner}.first)
        try await waitForFishBoundary {scene.isBoardEntryComplete && media.presentation(tileID:"fish")?.mediaReady==true && media.presentation(tileID:"fish")?.isHidden==false}
        let owner=try XCTUnwrap(media.presentation(tileID:"fish"))
        let source=try XCTUnwrap(scene.sourceNativeTileNode("fish")),destination=try XCTUnwrap(scene.sourceNativeTileNode("destination"))
        let from=scene.convert(source.position,from:try XCTUnwrap(source.parent)),to=scene.convert(destination.position,from:try XCTUnwrap(destination.parent))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await waitForFishBoundary {engine.state.tiles.allSatisfy{$0.id != "fish"} && media.presentation(tileID:"fish")==nil}
        XCTAssertTrue(owner.isHidden || owner.superview==nil,"Consumed board Fishy must not remain beside the separate finale")
        XCTAssertEqual(media.activeMediaCount,0)
    }
    func testBeachBallBlastKeepsSurvivingFishSVGVisibleAndTracksItsActualHolder() async throws {
        try await exerciseSurvivingFishDuringBlast(variant:"beach-ball")
    }
    func testFlowerBlastKeepsSurvivingFishSVGVisibleAndTracksItsActualHolder() async throws {
        try await exerciseSurvivingFishDuringBlast(variant:"flower")
    }
    private func exerciseSurvivingFishDuringBlast(variant:String) async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("fish-blast-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        let fish=NativeTile(id:"fish",cell:.init(column:4,row:6),value:6,starOrbitCount:1,archetype:.star,variant:"fish")
        let tiles=[NativeTile(id:"blast",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:variant),
                   NativeTile(id:"destination",cell:.init(column:1,row:0),value:2),fish]+(0..<6).map {
            NativeTile(id:"target-\($0)",cell:.init(column:$0%5,row:2+$0/5),value:1+$0%5)
        }
        var saved=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        saved.progression.firstPlayTutorialComplete=true
        saved.arcadeRun = .init(tiles:tiles,mode:.arcade,board:3,stage:3,generation:9,moves:37,score:123)
        saved.arcadeRunSavedAt=Date().timeIntervalSince1970
        try store.save(saved)
        let controller=NativeStandaloneViewController(resourceRoot:root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible();controller.loadViewIfNeeded()
        defer {controller.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        let app=try XCTUnwrap(controller.children.first as? NativeAppController)
        try await waitForFishBoundary(variant+" blast Home") { !app.home.isHidden }
        app.navigate(.gameplay,interrupt:true)
        try await waitForFishBoundary(variant+" blast board entry") {app.children.compactMap{$0 as? NativeGameplayViewController}.first?.boardScene?.isBoardEntryComplete==true}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scene=try XCTUnwrap(game.boardScene)
        let media=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeFishIdleOwner}.first)
        try await waitForFishBoundary(variant+" blast Fish media ready") {media.presentation(tileID:"fish")?.mediaReady==true && media.presentation(tileID:"fish")?.isHidden==false && !game.engine.hasUnsavableSourceGameplayState && game.beforeSourceGameplayAdmission==nil}
        let owner=try XCTUnwrap(media.presentation(tileID:"fish")),holder=try XCTUnwrap(scene.sourceNativeTileNode("fish"))
        let rest=holder.position
        let originalPaint=scene.onFishIdleFrames
        var outwardSamples=0,returnSamples=0,maxDisplacement=CGFloat.zero
        var lastBlastDisplacement=CGFloat.zero,sourceBlastSamples=0
        func diagnostic()->String {
            "variant=\(variant) outward=\(outwardSamples) returning=\(returnSamples) maxDisplacement=\(maxDisplacement) sourceSamples=\(sourceBlastSamples) " +
            "shortActive=\(scene.sourceShortWildBoardBlastActiveCount) pendingSpecial=\(String(describing:game.engine.pendingSpecial)) pendingDirect=\(String(describing:game.engine.pendingDirectWild)) " +
            "unsavable=\(game.engine.hasUnsavableSourceGameplayState) flags=\(game.engine.flags) failure=\(String(describing:game.sourcePresentationFailure)) " +
            "navigationLocked=\(scene.navigationLocked) entry=\(scene.isBoardEntryComplete) sceneAdmission=\(scene.sourceAnimationBindingAdmissionOpen) holderPosition=\(holder.position) holderOwners=\(holder.sourceOuterOwners)"
        }
        scene.onFishIdleFrames={ [weak scene,weak media,weak owner,weak holder] frames,generation,force in
            originalPaint?(frames,generation,force)
            guard let scene,let media,let owner,let holder else{return}
            let tntOutward=holder.action(forKey:"tnt-blast") != nil
            let tntReturn=holder.action(forKey:"tnt-return") != nil
            let sourceBlast=scene.sourceShortWildBoardBlastActiveCount>0
            guard tntOutward || tntReturn || sourceBlast else{return}
            let displacement=hypot(holder.position.x-rest.x,holder.position.y-rest.y)
            if tntOutward {outwardSamples+=1}
            if tntReturn {returnSamples+=1}
            // Beach Ball is a Juice archetype: its actual APP timeline owns
            // the short blast, while Flower retains TNT's keyed action owner.
            // Count painted outward/return travel instead of requiring an
            // unrelated SpriteKit action to exist on Source-driven holders.
            if sourceBlast,!tntOutward,!tntReturn {
                sourceBlastSamples+=1
                if displacement>lastBlastDisplacement+0.001 {outwardSamples+=1}
                if displacement<lastBlastDisplacement-0.001 {returnSamples+=1}
            }
            lastBlastDisplacement=displacement
            guard let frame=frames["fish"] else {XCTFail("Moving survivor lost its Fishy frame");return}
            XCTAssertTrue(frame.visible,"A board blast moves surviving artwork; it must not suppress it")
            XCTAssertTrue(media.presentation(tileID:"fish") === owner,"The same prepared SVG must survive the blast")
            XCTAssertFalse(owner.isHidden,"Actual mounted Fishy SVG disappeared during \(variant)")
            XCTAssertGreaterThan(owner.alpha,0.99)
            XCTAssertEqual(owner.center.x,frame.point.x,accuracy:0.001)
            XCTAssertEqual(owner.center.y,frame.point.y,accuracy:0.001)
            let center=holder.visual.convert(CGPoint.zero,to:scene)
            XCTAssertEqual(frame.point.x,center.x,accuracy:0.001)
            XCTAssertEqual(frame.point.y,scene.size.height-center.y,accuracy:0.001)
            maxDisplacement=max(maxDisplacement,hypot(holder.position.x-rest.x,holder.position.y-rest.y))
        }
        let source=try XCTUnwrap(scene.sourceNativeTileNode("blast")),destination=try XCTUnwrap(scene.sourceNativeTileNode("destination"))
        let from=scene.convert(source.position,from:try XCTUnwrap(source.parent)),to=scene.convert(destination.position,from:try XCTUnwrap(destination.parent))
        XCTAssertTrue(scene.beginDrag(at:from));scene.moveDrag(to:to,now:CACurrentMediaTime())
        try await Task.sleep(for:.milliseconds(160))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted)
        try await waitForFishBoundary(variant+" blast outward/return owner completion",diagnostic:diagnostic) {
            game.sourcePresentationFailure != nil ||
            (outwardSamples>0 && game.engine.pendingSpecial==nil && game.engine.pendingDirectWild==nil &&
             scene.sourceShortWildBoardBlastActiveCount==0 && !game.engine.hasUnsavableSourceGameplayState)
        }
        scene.onFishIdleFrames=originalPaint
        XCTAssertNil(game.sourcePresentationFailure)
        XCTAssertGreaterThan(outwardSamples,2,"Exercise actual authored outward motion")
        XCTAssertGreaterThan(returnSamples,2,"Exercise actual authored return motion")
        XCTAssertGreaterThan(maxDisplacement,10,"A stationary SVG cannot satisfy the survivor contract")
        XCTAssertTrue(scene.sourceNativeTileNode("fish") === holder)
        XCTAssertEqual(holder.position.x,rest.x,accuracy:0.001);XCTAssertEqual(holder.position.y,rest.y,accuracy:0.001)
        XCTAssertTrue(media.presentation(tileID:"fish") === owner);XCTAssertFalse(owner.isHidden)
        XCTAssertEqual(game.engine.state.tiles.first{$0.id=="fish"}?.cell,fish.cell)
        controller.dispose()
        XCTAssertEqual(media.activeMediaCount,0,"Route retirement releases surviving SVG and its prepared lease")
    }
    func testBeach15RestoredFishOutgoingAfterOrdinaryAndJuiceMergesSavesAndExits() async throws {
        try await exerciseBeach15SparseFish(reverse:false,bottlePull:false)
    }
    func testBeach15RestoredFishIncomingAfterOrdinaryAndJuiceMergesSavesAndExits() async throws {
        try await exerciseBeach15SparseFish(reverse:true,bottlePull:false)
    }
    func testBeach15BottlePullRetiresRestoredFishAndStillSavesAndExits() async throws {
        try await exerciseBeach15SparseFish(reverse:false,bottlePull:true)
    }
    private func exerciseBeach15SparseFish(reverse:Bool,bottlePull:Bool) async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("beach15-fish-sparse-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        // The last durable physical run contained a restored Fish and a Bottle.
        // Add the separately reported Juice and three ordinary dice; no fault is
        // inferred from that older durable snapshot or fabricated runtime flags.
        let tiles:[NativeTile]=[
            .init(id:"g3-5",cell:.init(column:0,row:1),value:6,archetype:.star,variant:"fish"),
            .init(id:"juice",cell:.init(column:4,row:7),value:6,archetype:.juice),
            .init(id:"bottle",cell:.init(column:0,row:2),value:6,archetype:.magnet,variant:"bottle"),
            .init(id:"a",cell:.init(column:3,row:1),value:1),
            .init(id:"b",cell:.init(column:4,row:1),value:2),
            .init(id:"c",cell:.init(column:1,row:2),value:4)]
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        seed.progression.firstPlayTutorialComplete=true
        seed.progression.completedJourneyBoards=Set(1..<15)
        seed.progression.beginAttempt(mode:.journey,board:15)
        seed.journeyRuns[15] = .init(tiles:tiles,mode:.journey,board:15,stage:15,generation:3,moves:25,score:3478)
        seed.journeyRunSavedAt[15]=Date().timeIntervalSince1970
        let expectedIDs=Set(tiles.map(\.id))
        let resumable=try XCTUnwrap(seed.resumedRun(mode:.journey,board:15),"A sparse saved attempt must pass actual resume policy before mounting")
        XCTAssertEqual(Set(resumable.tiles.map(\.id)),expectedIDs)
        try store.save(seed)
        let controller=NativeStandaloneViewController(resourceRoot:root,store:store,sourceVisualRandom:{0.1},completeNativeGameplayEnabled:true)
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer {controller.dispose();window.isHidden=true;previous?.makeKeyAndVisible();try? FileManager.default.removeItem(at:directory)}
        controller.loadViewIfNeeded()
        let app=try XCTUnwrap(controller.children.first as? NativeAppController)
        try await waitForFishBoundary("Beach15 Home") {!app.home.isHidden}
        app.navigate(.world(2),interrupt:true)
        try await waitForFishBoundary("Beach15 World ready") {app.world?.isReadyForInput==true}
        app.world?.onRequest?("continue",15)
        try await waitForFishBoundary("Beach15 gameplay child") {app.children.contains(where:{$0 is NativeGameplayViewController})}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let scene=try XCTUnwrap(game.boardScene)
        guard Set(game.engine.state.tiles.map(\.id))==expectedIDs else {
            XCTFail("Beach15 mounted a different roster: "+game.engine.state.tiles.map(\.id).joined(separator:","))
            throw CancellationError()
        }
        XCTAssertEqual(game.engine.state.board,15)
        let media=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeFishIdleOwner}.first)
        try await waitForFishBoundary("Beach15 restored Fish entry and media") {
            scene.isBoardEntryComplete && game.beforeSourceGameplayAdmission==nil &&
            !game.engine.hasUnsavableSourceGameplayState && media.presentation(tileID:"g3-5")?.isHidden==false
        }
        let fishNode=try XCTUnwrap(scene.sourceNativeTileNode("g3-5"))
        func point(_ id:String)throws->CGPoint {
            let node=try XCTUnwrap(scene.sourceNativeTileNode(id))
            return scene.convert(node.position,from:try XCTUnwrap(node.parent))
        }
        func settled() async throws {
            if let direct=game.engine.pendingDirectWild,game.engine.directWildGameplayCommitted {
                print("[Beach15FishPickup] awaiting-authored-FX owner=\(direct.id) family=\(direct.archetype) savable=\(!game.engine.hasUnsavableSourceGameplayState) fishCanDrag=\(game.engine.canBeginDrag(tileID:"g3-5")) nodeMode=\(fishNode.sourceEventMode)")
            }
            try await waitForFishBoundary("Beach15 Source transaction and authored FX owner settled") {
                game.sourcePresentationFailureGeneration != nil ||
                (!game.engine.hasUnsavableSourceGameplayState && game.engine.pendingDirectWild==nil && game.engine.pendingHUDStars.isEmpty &&
                 scene.sourceMagnetActualPullOwnerCount==0 && scene.sourceMagnetSurvivorPendingInputIDs.isEmpty &&
                 !scene.navigationLocked && !game.engine.isDragging)
            }
            XCTAssertNil(game.sourcePresentationFailureGeneration,"Sparse Beach15 must settle its genuine Source owners")
        }
        func pickupFish(_ stage:String) async throws {
            func diagnostic()->String {
                let model=game.engine.state.tiles.first{$0.id=="g3-5"}
                let drop=scene.sourceWildDropTileMarkers(fishNode)
                return "stage=\(stage) coreCanDrag=\(game.engine.canBeginDrag(tileID:"g3-5")) flags=\(game.engine.flags) " +
                    "direct=\(String(describing:game.engine.pendingDirectWild)) committed=\(game.engine.directWildGameplayCommitted) " +
                    "model=\(String(describing:model)) nodeMode=\(fishNode.sourceEventMode) nodeGeneration=\(fishNode.sourceGeneration) " +
                    "grid=\(String(describing:fishNode.sourceGridCell)) position=\(fishNode.position) scale=\(fishNode.xScale),\(fishNode.yScale) " +
                    "owners=\(fishNode.sourceOuterOwners) drop=\(String(describing:drop)) shortBlast=\(scene.sourceShortWildBoardBlastActiveCount) " +
                    "navigationLocked=\(scene.navigationLocked) sceneAdmission=\(scene.sourceAnimationBindingAdmissionOpen)"
            }
            // The exact Direct owner has already retired in settled(); assert
            // Core admission separately from actual painted-node hit dispatch.
            XCTAssertTrue(game.engine.canBeginDrag(tileID:"g3-5"),diagnostic())
            let origin=try point("g3-5")
            let picked=scene.beginDrag(at:origin)
            if !picked {print("[Beach15FishPickup] scene-rejected point=\(origin) "+diagnostic())}
            XCTAssertTrue(picked,"Restored Fish must remain pickable at "+stage)
            XCTAssertTrue(game.engine.isDragging)
            XCTAssertEqual(scene.finishDrag(at:origin,now:CACurrentMediaTime())?.accepted,false)
            try await settled()
            try await waitForFishBoundary("Beach15 rejected Fish pickup snapback") {!fishNode.sourceOuterOwners.snapBack && !fishNode.sourceOuterOwners.pickupScale}
            XCTAssertEqual(fishNode.sourceEventMode,"static")
        }
        func drag(_ source:String,_ destination:String) async throws {
            let from=try point(source),to=try point(destination)
            XCTAssertTrue(scene.beginDrag(at:from),"Actual Source pickup failed: "+source)
            scene.moveDrag(to:to,now:CACurrentMediaTime())
            try await Task.sleep(for:.milliseconds(160))
            XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:to,now:CACurrentMediaTime())).accepted,
                          "Actual Source contact failed: "+source+" -> "+destination)
            try await settled()
        }
        try await pickupFish("initial restored board")
        try await drag("a","b")
        try await pickupFish("after ordinary stack")
        if bottlePull {
            // Fish is the nearest actual pull target; it must be consumed, not
            // left as an inert retained skin after Bottle's helper continuation.
            try await drag("bottle","c")
            XCTAssertFalse(game.engine.state.tiles.contains{$0.id=="g3-5"})
            try await waitForFishBoundary("Beach15 consumed Fish media retired") {media.presentation(tileID:"g3-5")==nil}
        } else {
            try await drag("juice","c")
            try await pickupFish("after Juice merge")
            XCTAssertTrue(scene.sourceNativeTileNode("g3-5") === fishNode)
            let ordinary=try XCTUnwrap(game.engine.state.activeTiles.first{!$0.isWild && !$0.locked && (1...5).contains($0.value)})
            try await drag(reverse ? ordinary.id:"g3-5",reverse ? "g3-5":ordinary.id)
            try await waitForFishBoundary("Beach15 consumed Fish media retired") {media.presentation(tileID:"g3-5")==nil}
        }
        try await settled()
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        let persisted=try XCTUnwrap(store.load()?.journeyRuns[15])
        XCTAssertEqual(persisted,game.engine.state,"The real save boundary must accept the settled sparse board")
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        game.onExit?()
        try await waitForFishBoundary("Beach15 Exit modal") {game.presentedViewController is JimiNativeEndRunModal}
        let exit=try XCTUnwrap(game.presentedViewController as? JimiNativeEndRunModal)
        try await waitForFishBoundary("Beach15 Exit modal input") {exit.view.isUserInteractionEnabled}
        exit.buttons[1].sendActions(for:.touchUpInside)
        try await waitForFishBoundary("Beach15 Exit to World") {!app.children.contains(where:{$0 is NativeGameplayViewController}) && app.world != nil}
        XCTAssertEqual(try store.load()?.journeyRuns[15],persisted,"Exit must preserve the exact accepted saved board")
    }
    private func waitForFishBoundary(_ predicate:()->Bool) async throws {
        try await waitForFishBoundary("Mounted Fishy transaction boundary",predicate)
    }
    private func waitForFishBoundary(_ label:String,diagnostic:(()->String)?=nil,_ predicate:()->Bool) async throws {
        let deadline=CACurrentMediaTime()+35
        while !predicate() {
            guard CACurrentMediaTime()<deadline else {XCTFail(label+" timed out"+(diagnostic.map{" "+$0()} ?? ""));throw CancellationError()}
            try await Task.sleep(for:.milliseconds(20))
        }
    }
    func testTwoBoardFishShareOriginalFramesAndNeverRenderEmptyAtLoopWrap() async throws {
        let tiles=[NativeTile(id:"f1",cell:.init(column:0,row:0),value:0,archetype:.juice,variant:"fish"),
                   NativeTile(id:"f2",cell:.init(column:4,row:5),value:0,archetype:.juice,variant:"fish"),
                   NativeTile(id:"a",cell:.init(column:2,row:0),value:1),NativeTile(id:"b",cell:.init(column:3,row:0),value:2)]
        let engine=NativeGameplayEngine(state:.init(columns:5,rows:9,tiles:tiles))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller
        window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        defer {controller.dispose();window.isHidden=true}
        let host=try XCTUnwrap(controller.view.subviews.compactMap {$0 as? NativeFishIdleOwner}.first)
        let deadline=CACurrentMediaTime()+8
        while (host.presentation(tileID:"f1")?.mediaReady != true || host.presentation(tileID:"f2")?.mediaReady != true || controller.boardScene?.isBoardEntryComplete != true),CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(25))}
        XCTAssertEqual(host.activeMediaCount,2);XCTAssertEqual(host.selectedSVGFrameCount,72)
        let owners=try ["f1","f2"].map {try XCTUnwrap(host.presentation(tileID:$0))}
        let format=UIGraphicsImageRendererFormat();format.scale=1;format.opaque=false
        let renderer=UIGraphicsImageRenderer(size:NativeFishIdlePresentation.logicalMediaSize,format:format)
        for owner in owners {
            XCTAssertTrue(owner.usesOriginalSVGFallback);XCTAssertEqual(owner.retainedItemCount,0)
            var seen=Set<Int>()
            // Three full source cycles, including the exact71→0 boundary.
            let start=CACurrentMediaTime()
            for tick in 0..<216 {
                let pointer=NativeFishIdleFrame.project(center:.init(x:150,y:400),horizontalUnit:.init(x:151,y:400),verticalUnit:.init(x:150,y:399),sceneHeight:844,alpha:1,dragging:tick%20<10,phaseStarted:true,visible:true,bubbles:[])
                owner.paint(pointer,now:start+Double(tick)/64,force:true)
                XCTAssertFalse(owner.isHidden);XCTAssertTrue(owner.mediaReady)
                seen.insert(try XCTUnwrap(owner.originalSVGFrame))
                let image=try XCTUnwrap(renderer.image {owner.layer.render(in:$0.cgContext)}.cgImage)
                var pixels=[UInt8](repeating:0,count:image.width*image.height*4)
                let occupied=pixels.withUnsafeMutableBytes {bytes -> Int in
                    let context=CGContext(data:bytes.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
                    context.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
                    return stride(from:3,to:bytes.count,by:4).reduce(0){$0+(bytes[$1]>16 ? 1:0)}
                }
                XCTAssertGreaterThan(occupied,500,"Fish must retain visible pixels through wrap, tick \(tick)")
            }
            XCTAssertEqual(seen.count,72)
        }
        XCTAssertEqual(engine.state.tiles,tiles,"Presentation sampling must not mutate the board")
        controller.dispose();XCTAssertEqual(host.activeMediaCount,0);XCTAssertEqual(host.selectedSVGFrameCount,0)
    }
    func testRestoredSourceFishAdvanceFromAcceptedClockWithoutManualPaint() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("fish-source-clock-"+UUID().uuidString)
        let store=NativeSaveStore(directory:directory)
        var saved=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
        saved.progression.firstPlayTutorialComplete=true
        saved.arcadeRun = .init(tiles:[.init(id:"f1",cell:.init(column:0,row:5),value:6,starOrbitCount:1,archetype:.star,variant:"fish"),.init(id:"f2",cell:.init(column:4,row:7),value:6,starOrbitCount:1,archetype:.star,variant:"fish"),.init(id:"a",cell:.init(column:1,row:0),value:1),.init(id:"b",cell:.init(column:2,row:0),value:2)],mode:.arcade,board:1,generation:9,moves:30)
        try store.save(saved)
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
        service.sourceMicrotaskTasks=tasks
        let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
        let bootstrap=try NativeBootstrap(root:root,store:store,showStudioIntro:false,sourceContext:context)
        bootstrap.sourceInitialWildResumeEnabled=true;bootstrap.sourceSpecialIdlePresentationEnabled=true
        let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer {bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;try? FileManager.default.removeItem(at:directory)}
        let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
        let deadline=CACurrentMediaTime()+15
        while app.children.compactMap({$0 as? NativeGameplayViewController}).first==nil,CACurrentMediaTime()<deadline {try await Task.sleep(for:.milliseconds(20))}
        let game=try XCTUnwrap(app.children.compactMap{$0 as? NativeGameplayViewController}.first)
        let media=try XCTUnwrap(game.view.subviews.compactMap{$0 as? NativeFishIdleOwner}.first)
        var wall=0.0
        while (media.presentation(tileID:"f1")?.mediaReady != true || media.presentation(tileID:"f2")?.mediaReady != true),CACurrentMediaTime()<deadline {
            wall+=20;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(20))
        }
        let owners=try ["f1","f2"].map {try XCTUnwrap(media.presentation(tileID:$0))}
        var frames=[Set<Int>(),Set<Int>()]
        for _ in 0..<120 {
            wall+=20;service.deliver(wallMilliseconds:wall);try await Task.sleep(for:.milliseconds(20))
            for (i,owner) in owners.enumerated() {XCTAssertFalse(owner.isHidden);if let frame=owner.originalSVGFrame {frames[i].insert(frame)}}
        }
        for (i,seen) in frames.enumerated() {
            let node=try XCTUnwrap(game.boardScene?.sourceNativeTileNode(i==0 ? "f1":"f2"))
            XCTAssertGreaterThan(seen.count,20,"Accepted board clock must animate each Fish: \(node.authoredArtworkReceipt)")
        }
    }
    func testMissingMediaKeepsOriginalStaticArtworkAndReleasesFailedPlayerItems() {
        let host=NativeFishIdleOwner(resourceRoot:root.appendingPathComponent("missing-original-media"),mediaPolicy:NativeFishMediaPolicy())
        let frame=NativeFishIdleFrame.project(center:CGPoint(x:90,y:100),horizontalUnit:CGPoint(x:91,y:100),verticalUnit:CGPoint(x:90,y:99),sceneHeight:844,alpha:1,dragging:false,phaseStarted:true,visible:true,bubbles:[])
        var failures=0;host.onMediaReady={id,generation,ready in XCTAssertEqual(id,"f");XCTAssertEqual(generation,7);XCTAssertFalse(ready);failures+=1}
        host.paint(["f":frame],generation:7,force:true)
        let player=host.presentation(tileID:"f")
        XCTAssertEqual(failures,1);XCTAssertEqual(player?.retainedItemCount,0);XCTAssertEqual(player?.mediaReady,false);XCTAssertEqual(player?.isHidden,true)
        host.paint([:],generation:8,force:true);XCTAssertEqual(host.activeMediaCount,0)
        host.dispose();host.dispose();host.paint(["f":frame],generation:9,force:true)
        XCTAssertEqual(host.activeMediaCount,0);XCTAssertEqual(failures,1)
    }
    func testActualNativeBranchProjectionPreservesShakeAndSourceDragFacingWithoutASecondIdleOwner() throws {
        let scene=SKScene(size:CGSize(width:390,height:844)),canvas=SKNode();scene.addChild(canvas);canvas.position=CGPoint(x:8,y:-6)
        let textures=NativeBoardTextures(root:root),fish=NativeDiceNode(id:"f",value:0,kind:"wild-juice",variant:"fish",depth:1,locked:false,textures:textures)
        canvas.addChild(fish);fish.position=CGPoint(x:260,y:300);fish.setScale(0.4);fish.alpha=0.8;fish.visual.alpha=0.7
        defer {fish.dispose();textures.dispose()}
        fish.setDragging(true)
        let pose=try XCTUnwrap(fish.fishFrame(in:scene,visible:true))
        XCTAssertEqual(pose.point.x,268,accuracy:1e-5);XCTAssertEqual(pose.point.y,550,accuracy:1e-5)
        XCTAssertEqual(pose.transform.a,-0.432,accuracy:1e-5);XCTAssertEqual(pose.transform.d,0.432,accuracy:1e-5)
        XCTAssertEqual(pose.alpha,0.56,accuracy:1e-5);XCTAssertTrue(pose.dragging);XCTAssertEqual(pose.bubbles.count,0)
        let face=try XCTUnwrap(fish.visual.children.compactMap {$0 as? SKSpriteNode}.first)
        XCTAssertEqual(face.xScale,-1)
        fish.position.x=90;_ = fish.fishFrame(in:scene,visible:true);XCTAssertEqual(face.xScale,1)
        fish.setDragging(false);fish.setFishMediaReady(true);XCTAssertTrue(face.isHidden)
        fish.setFishMediaReady(false);XCTAssertFalse(face.isHidden)
    }
    func testMediaVisibilityPreservesPaintedFacingAndPointerReleaseAloneRestoresRestFacing()throws {
        let scene=SKScene(size:.init(width:390,height:844)),canvas=SKNode();scene.addChild(canvas)
        let textures=NativeBoardTextures(root:root)
        let fish=NativeDiceNode(id:"f",value:6,kind:"wild",variant:"fish",depth:1,locked:false,textures:textures)
        defer{fish.dispose();textures.dispose()};canvas.addChild(fish);fish.position = .init(x:260,y:300)
        let face=try XCTUnwrap(fish.visual.children.compactMap{$0 as? SKSpriteNode}.first)
        face.xScale = -1;fish.setFishMediaReady(true)
        XCTAssertTrue(face.isHidden);XCTAssertEqual(face.xScale,-1,"Media readiness owns visibility, not the repaired face's sign")
        fish.setFishMediaReady(false);XCTAssertFalse(face.isHidden);XCTAssertEqual(face.xScale,-1)
        fish.setDragging(true);_ = fish.fishFrame(in:scene,visible:true)
        XCTAssertEqual(face.xScale,-1);XCTAssertFalse(face.isHidden)
        fish.setFishMediaReady(true);XCTAssertTrue(face.isHidden);XCTAssertEqual(face.xScale,-1)
        fish.setDragging(false)
        XCTAssertEqual(face.xScale,1,"Actual pointer release restores the authored resting direction")
        XCTAssertTrue(face.isHidden,"The ready media still hides its static base on release")
        fish.setDragging(true);fish.position.x=90;_ = fish.fishFrame(in:scene,visible:true)
        XCTAssertEqual(face.xScale,1);XCTAssertTrue(face.isHidden)
    }
}
