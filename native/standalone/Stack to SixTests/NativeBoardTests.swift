import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeBoardTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    private func tile(_ id: String, _ column: Int, _ value: Int) -> NativeTile {
        NativeTile(id: id, cell: NativeCell(column: column, row: 0), value: value)
    }
    private func scene(_ tiles: [NativeTile]) -> NativeBoardScene {
        let engine = NativeGameplayEngine(state: NativeBoardState(columns: 5, rows: 9, tiles: tiles))
        let scene = NativeBoardScene(engine: engine, resourceRoot: root, size: CGSize(width: 390,height: 844))
        scene.layout(size: scene.size, insets: UIEdgeInsets(top: 47,left: 0,bottom: 34,right: 0))
        return scene
    }
    private func center(_ scene: NativeBoardScene, _ column: Int) throws -> CGPoint {
        try XCTUnwrap(scene.boardGeometry).center(row: 0,column: column)
    }

    func testGeometryPreservesLogicalGridAndRejectsGapAutoAim() {
        let geometry = NativeBoardGeometry(columns: 5, rows: 9, bounds: CGRect(x: 24,y: 107,width: 342,height: 571))
        XCTAssertEqual(geometry.stride / geometry.tileSize,148.0/128,accuracy: 0.000001)
        for row in 0..<9 { for column in 0..<5 {
            let hit = geometry.cell(at: geometry.center(row: row,column: column))
            XCTAssertEqual(hit?.row,row); XCTAssertEqual(hit?.column,column)
        } }
        let first = geometry.center(row: 0,column: 0)
        let gap = CGPoint(x: first.x + geometry.tileSize/2 + 10*geometry.scale,y: first.y)
        XCTAssertNil(geometry.cell(at: gap))
        XCTAssertNil(geometry.cell(at: CGPoint(x: geometry.origin.x-1,y: first.y)))
        XCTAssertGreaterThan(geometry.center(row: 0,column: 0).y,geometry.center(row: 8,column: 0).y)
    }

    func testRealNativeDragKeepsImmediateContactAndPickupThroughOwnedAbsorb() async throws {
        let scene=scene([tile("a",0,1),tile("b",1,2),tile("c",2,2),tile("d",3,4),tile("e",4,1)])
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller;window.makeKeyAndVisible();renderer.presentScene(scene)
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let absorbed=expectation(description:"Real source absorb removes carrier"),firstDebit=expectation(description:"Captured first postcheck debits once"),secondDebit=expectation(description:"Captured next postcheck debits once")
        var firstFinished=false,secondFinished=false
        scene.onGameplayEvent={event in if event.kind == .removed,event.tileIDs==["a"] {absorbed.fulfill()}}
        scene.onStateChange={state in
            if state.moves==49,!firstFinished {firstFinished=true;firstDebit.fulfill()}
            if state.moves==48,!secondFinished {secondFinished=true;secondDebit.fulfill()}
        }
        XCTAssertTrue(scene.beginDrag(at:try center(scene,0)))
        XCTAssertFalse(scene.beginDrag(at:try center(scene,1)),"Second pointer cannot replace captured drag")
        scene.moveDrag(to:try center(scene,1));let first=try XCTUnwrap(scene.finishDrag(at:center(scene,1),now:1))
        XCTAssertTrue(first.accepted);XCTAssertEqual(scene.engine.state.tiles.first {$0.id=="b"}?.value,3)
        XCTAssertEqual(scene.engine.state.tiles.first {$0.id=="a"}?.pendingRemoval,true)
        XCTAssertEqual(scene.engine.state.moves,50,"Moves waits for the actual conditional postcheck")
        XCTAssertNil(scene.finishDrag(at:try center(scene,1),now:1))
        XCTAssertTrue(scene.beginDrag(at:try center(scene,1)),"Source permits pickup through the80ms drop handoff")
        scene.moveDrag(to:try center(scene,2))
        await fulfillment(of:[absorbed,firstDebit],timeout:3)
        XCTAssertNil(scene.engine.state.tiles.first {$0.id=="a"})
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:center(scene,2),now:1.3)).accepted,"Held pickup survives captured absorb/postcheck")
        XCTAssertEqual(scene.engine.state.tiles.first {$0.id=="c"}?.value,5)
        XCTAssertEqual(scene.engine.state.moves,49)
        await fulfillment(of:[secondDebit],timeout:3)
        XCTAssertEqual(scene.engine.state.moves,48)
    }

    func testRejectedDropKeepsBoardAndBackgroundCancelsPointer() throws {
        let scene = scene([tile("a",0,4),tile("b",1,3)])
        defer { scene.dispose() }
        let before = scene.engine.state
        XCTAssertTrue(scene.beginDrag(at: try center(scene,0)))
        scene.moveDrag(to: try center(scene,1))
        let result = try XCTUnwrap(scene.finishDrag(at: center(scene,1),now: 1))
        XCTAssertFalse(result.accepted)
        XCTAssertEqual(scene.engine.state,before)
        XCTAssertTrue(scene.beginDrag(at: try center(scene,0)))
        scene.setSuspended(true)
        XCTAssertNil(scene.finishDrag(at: try center(scene,1),now: 2))
        XCTAssertEqual(scene.engine.state,before)
        scene.setSuspended(false)
        XCTAssertTrue(scene.beginDrag(at: try center(scene,0)))
    }

    func testTutorialGuidedPickupAndPointerReceiptsStayAuthoritative() throws {
        var tutorial = NativeTutorialState(); tutorial.guidedPair = ["a","b"]
        let engine = NativeGameplayEngine(state: NativeBoardState(columns: 5,rows: 9,
            tiles: [tile("a",0,2),tile("b",1,3),tile("other",2,1)],tutorial: tutorial))
        let scene = NativeBoardScene(engine: engine,resourceRoot: root,size: CGSize(width: 390,height: 844))
        scene.layout(size: scene.size,insets: UIEdgeInsets(top: 47,left: 0,bottom: 34,right: 0))
        defer { scene.dispose() }
        var pointerReceipts: [Bool] = []; scene.onPointerState = { pointerReceipts.append($0) }
        XCTAssertFalse(scene.beginDrag(at: try center(scene,2)),"Unguided pickup must remain rejected by the tutorial decision owner")
        XCTAssertEqual(pointerReceipts,[])
        XCTAssertTrue(scene.beginDrag(at: try center(scene,0)))
        scene.moveDrag(to: try center(scene,2))
        let rejected = try XCTUnwrap(scene.finishDrag(at: center(scene,2),now: 1))
        XCTAssertFalse(rejected.accepted)
        XCTAssertEqual(engine.state.tiles.first { $0.id == "a" }?.value,2)
        XCTAssertEqual(pointerReceipts,[true,false])
        XCTAssertTrue(scene.beginDrag(at: try center(scene,0)))
        scene.setSuspended(true); scene.cancelDrag()
        XCTAssertEqual(pointerReceipts,[true,false,true,false],"Background and duplicate cancel release one accepted pointer once")
        XCTAssertNil(scene.finishDrag(at: try center(scene,1),now: 2))
    }

    func testForegroundCannotResumeModalCoveredNativeBoardController() {
        let engine = NativeGameplayEngine(state: NativeBoardState(tiles: [tile("a",0,1),tile("b",1,2)]))
        let controller = NativeGameplayViewController(engine: engine,resourceRoot: root)
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844))
        window.rootViewController = controller; window.makeKeyAndVisible(); controller.view.layoutIfNeeded()
        defer { controller.dispose(); window.isHidden = true }
        controller.setSuspended(true)
        NotificationCenter.default.post(name: UIApplication.willResignActiveNotification,object: nil)
        NotificationCenter.default.post(name: UIApplication.didBecomeActiveNotification,object: nil)
        XCTAssertEqual(controller.boardScene?.isPaused,true,"Foreground activation cannot override a modal's explicit board cover")
        controller.setSuspended(false)
        XCTAssertEqual(controller.boardScene?.isPaused,false)
    }

    func testFinalPairPublishesOneTerminalAfterVisualExitAndNoSpawn() async throws {
        let scene = scene([tile("a",0,1),tile("b",1,5)])
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844))
        let controller = UIViewController(), renderer = SKView(frame: window.bounds)
        controller.view = renderer; window.rootViewController = controller; window.makeKeyAndVisible()
        renderer.presentScene(scene)
        defer { scene.dispose(); renderer.presentScene(nil); window.isHidden = true }
        var terminalCount = 0
        let terminal = expectation(description: "Terminal follows last visual exit")
        scene.onTerminal = { result in XCTAssertEqual(result.kind,.complete); terminalCount += 1; terminal.fulfill() }
        let absorbed=expectation(description:"Ordinary final6 commits from its real80ms absorb")
        scene.onGameplayEvent={event in if event.kind == .merged {absorbed.fulfill()}}
        XCTAssertTrue(scene.beginDrag(at: try center(scene,0)))
        scene.moveDrag(to: try center(scene,1))
        let result = try XCTUnwrap(scene.finishDrag(at: center(scene,1),now: 1))
        XCTAssertTrue(result.accepted)
        XCTAssertEqual(result.resolution.kind,.wait)
        XCTAssertEqual(scene.engine.state.moves,50)
        XCTAssertEqual(scene.engine.state.score,0)
        XCTAssertNotNil(scene.engine.pendingOrdinarySix)
        XCTAssertFalse(result.events.contains { $0.kind == .spawned })
        scene.evaluate(); scene.evaluate()
        XCTAssertEqual(terminalCount,0,"Captured final6 waits source absorb and visual cleanup")
        await fulfillment(of:[absorbed],timeout:2)
        XCTAssertEqual(scene.engine.state.moves,49)
        XCTAssertTrue(scene.navigationLocked)
        XCTAssertFalse(scene.beginDrag(at: try center(scene,0)))
        await fulfillment(of: [terminal],timeout: 3)
        scene.evaluate(); XCTAssertEqual(terminalCount,1)
    }

    func testNoMovesCandidateLocksNavigationButKeepsPickupPlayable() throws {
        let scene = scene([tile("a",0,4),tile("b",1,3)])
        defer { scene.dispose() }
        scene.evaluate()
        XCTAssertTrue(scene.navigationLocked)
        XCTAssertNotNil(scene.action(forKey: "no-moves-confirm"))
        XCTAssertTrue(scene.beginDrag(at: try center(scene,0)))
        XCTAssertFalse(scene.navigationLocked)
        XCTAssertNil(scene.action(forKey: "no-moves-confirm"))
        scene.dispose(); scene.dispose()
        XCTAssertFalse(scene.hasActions())
        XCTAssertEqual(scene.children.count,0)
    }

    func testRegistryAndAuthoredAtlasRestWindows() {
        XCTAssertEqual(Set(NativeDiceArtwork.variants.keys),Set(NativeSpecialDiceRegistry.variants.keys))
        XCTAssertEqual(NativeDiceSheet.juice.frame(at: 1.39),83)
        XCTAssertEqual(NativeDiceSheet.juice.frame(at: 1.5),0)
        XCTAssertEqual(NativeDiceSheet.juice.frame(at: 2.0),0)
        XCTAssertEqual(NativeDiceSheet.barrel.frame(at: 1.75),0)
        XCTAssertEqual(NativeDiceSheet.barrel.frame(at: 0.4),26)
        XCTAssertEqual(NativeBoardMotion.Ease.power2Out.sample(0.5),0.875,accuracy: 0.0000001)
        XCTAssertEqual(NativeBoardMotion.Ease.backOut(1.8).sample(1),1)
        XCTAssertEqual(NativeFlowerMotion.sample(seconds: 0).scaleX,1)
        XCTAssertEqual(NativeFlowerMotion.sample(seconds: 1.6).translateY,0)
        XCTAssertEqual(NativeFlowerMotion.sample(seconds: 1.6*0.43).translateY,-10,accuracy: 0.00001)
        XCTAssertEqual(NativeFlowerMotion.sample(seconds: 1.6*0.69).rotationDegrees,20,accuracy: 0.00001)
    }

    func testLateAtlasCompletionAfterDisposeCannotResurrectRenderer() async throws {
        let textures = NativeBoardTextures(root: root)
        var completions = 0
        textures.prepare(.star) { _ in completions += 1 }
        textures.dispose(); textures.dispose()
        try await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertEqual(completions,0)
        XCTAssertNil(textures.texture("assets/tile.png"))
    }

    func testTntLanesMatchPreservedTypeScriptOwner() {
        // Captured by executing the original createTntDiceDebrisPlans with
        // recorded random=0.5. This is a cross-language oracle, not a copy
        // of the Swift separation algorithm.
        let expected: [(Double,Double)] = [(-38,4),(0,48),
            (24.846410188755804,-66.91387629000137),(69.64033349170334,-42.715490738356344),
            (-87.96398703066039,2.1026334038989725),(88.34356992357033,5.796037468647082),
            (-57.259061174466545,50.142046827890965),(57.32731258335204,45.01327577790789),
            (-27.73256314099738,90.49283263547684),(31.94786794265705,88.09324548228325),
            (-96.97173967933942,80.52136818253298),(91.14587785856885,81.84131730506353),
            (38,-4),(100.32825897811269,-82.19018173576109),(-111,63),(-74,42)]
        let plans = NativeTntFinale.makeDiePlans(random: { 0.5 })
        XCTAssertEqual(plans.count,16)
        for (index,point) in expected.enumerated() {
            XCTAssertEqual(plans[index].startX,point.0,accuracy: 0.0000001)
            XCTAssertEqual(plans[index].startY,point.1,accuracy: 0.0000001)
        }
        XCTAssertEqual(plans[14].duration,0.6127407407407407,accuracy: 0.0000001)
        XCTAssertEqual(plans[14].size,36); XCTAssertEqual(plans[15].size,36)
        XCTAssertEqual(NativeTntFinale.duration,4.2)
    }

    func testActualPreservedAtlasDecodeAndSharedSubtextures() async throws {
        let textures = NativeBoardTextures(root: root)
        defer { textures.dispose() }
        var first: [SKTexture] = [], second: [SKTexture] = []
        let complete = expectation(description: "Eligible native WebP decode")
        complete.expectedFulfillmentCount = 2
        textures.prepare(.star) { frames in first = frames; complete.fulfill() }
        textures.prepare(.star) { frames in second = frames; complete.fulfill() }
        await fulfillment(of: [complete],timeout: 5)
        XCTAssertEqual(first.count,120)
        XCTAssertEqual(second.count,120)
        if let a = first.first, let b = second.first { XCTAssertTrue(a === b) }
    }

    func testUnavailableTntSkinRejectsBeforeAnyStateOrRandomMutation() throws {
        let source = NativeTile(id: "gun",cell: NativeCell(column: 0,row: 0),value: 3,archetype: .tnt,variant: "laser-gun")
        let scene = scene([source,tile("target",1,2),tile("other",2,3)])
        defer { scene.dispose() }
        let before = scene.engine.state
        XCTAssertTrue(scene.beginDrag(at: try center(scene,0)))
        scene.moveDrag(to: try center(scene,1))
        let result = try XCTUnwrap(scene.finishDrag(at: center(scene,1),now: 1))
        XCTAssertFalse(result.accepted)
        XCTAssertEqual(scene.engine.state,before)
        XCTAssertNil(scene.engine.pendingSpecial)
        XCTAssertEqual(result.events.last?.reason,"native_special_presentation_not_ready")
    }

    func testBackgroundSettlesStagedNativeMagnetAndRetiresOldVisualCallbacks() throws {
        let source = NativeTile(id: "magnet",cell: NativeCell(column: 0,row: 0),value: 3,archetype: .magnet)
        let scene = scene([source,tile("target",1,2),tile("pull1",2,3),tile("pull2",3,1),tile("pull3",4,2)])
        defer { scene.dispose() }
        XCTAssertTrue(scene.beginDrag(at: try center(scene,0)))
        scene.moveDrag(to: try center(scene,1))
        let result = try XCTUnwrap(scene.finishDrag(at: center(scene,1),now: 1))
        XCTAssertTrue(result.accepted); XCTAssertEqual(result.resolution.kind,.wait)
        XCTAssertNotNil(scene.engine.pendingSpecial)
        // Root may settle first when its app observer flushes the save store.
        scene.engine.cancelForBackground()
        scene.setSuspended(true)
        XCTAssertNil(scene.engine.pendingSpecial)
        XCTAssertTrue(scene.engine.state.validationIssues().isEmpty)
        XCTAssertFalse(scene.engine.state.tiles.contains { $0.resolutionOwned })
        scene.setSuspended(false)
        XCTAssertFalse(scene.navigationLocked)
        let playable = try XCTUnwrap(scene.engine.state.activeTiles.first)
        let point = try XCTUnwrap(scene.boardGeometry).center(row: playable.cell.row,column: playable.cell.column)
        XCTAssertTrue(scene.beginDrag(at: point))
    }


    func testFinalWildPairWaitsForAllAuthoredHudStarScoreArrivals() async throws {
        let star = NativeTile(id: "star",cell: NativeCell(column: 0,row: 0),value: 3,starOrbitCount: 3,archetype: .star)
        let scene = scene([star,tile("target",1,4)])
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844))
        let controller = UIViewController(),renderer = SKView(frame: window.bounds)
        controller.view = renderer; window.rootViewController = controller; window.makeKeyAndVisible(); renderer.presentScene(scene)
        defer { scene.dispose(); renderer.presentScene(nil); window.isHidden = true }
        let finished = expectation(description: "Final score includes every actual 98% star arrival")
        var terminalCount = 0,arrivalCount = 0,mergeScore = 0
        let absorbed=expectation(description:"FinalWild real80ms main gameplay receipt")
        scene.onGameplayEvent = {event in
            if event.kind == .hudStarArrived {arrivalCount+=1}
            if event.kind == .merged {mergeScore=scene.engine.state.score;absorbed.fulfill()}
        }
        scene.onTerminal = { _ in
            terminalCount += 1
            XCTAssertEqual(arrivalCount,3); XCTAssertTrue(scene.engine.pendingHUDStars.isEmpty)
            XCTAssertEqual(scene.engine.state.score,mergeScore+300); finished.fulfill()
        }
        XCTAssertTrue(scene.beginDrag(at: try center(scene,0)))
        scene.moveDrag(to: try center(scene,1))
        let result = try XCTUnwrap(scene.finishDrag(at: center(scene,1),now: 1))
        XCTAssertTrue(result.accepted);XCTAssertEqual(result.resolution.kind,.wait)
        XCTAssertEqual(result.state.score,0);XCTAssertEqual(scene.engine.pendingHUDStars.count,0)
        await fulfillment(of:[absorbed],timeout:2)
        XCTAssertEqual(scene.engine.pendingHUDStars.count,3);XCTAssertEqual(terminalCount,0)
        await fulfillment(of: [finished],timeout: 5)
        scene.evaluate(); XCTAssertEqual(terminalCount,1)
    }

    func testRealTntReturnReleasesOrdinaryDragBeforeCapturedImpactsAndMeterFinish() async throws {
        var tiles = [NativeTile(id:"tnt",cell:NativeCell(column:0,row:0),value:3,archetype:.tnt),tile("destination",1,2)]
        for index in 0..<8 { tiles.append(NativeTile(id:"ordinary-\(index)",cell:NativeCell(column:index%5,row:1+index/5),value:1)) }
        let engine = NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:tiles))
        let scene = NativeBoardScene(engine:engine,resourceRoot:root,size:CGSize(width:390,height:844))
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0))
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller = UIViewController(),renderer = SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller;window.makeKeyAndVisible();renderer.presentScene(scene)
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let ordinary = expectation(description:"Real first TNT impact leaves unrelated ordinary stacks playable")
        let settled = expectation(description:"Captured board and delayed rewards settle after intervening ordinary revision")
        var didOrdinary = false,captured:NativeSpecialMovePlan?,ordinaryMoves = 0,charged = Set<String>()
        scene.onGameplayEvent = { event in
            if event.kind == .specialReserved { captured=engine.pendingSpecial }
            if event.kind == .meterRewardCommitted { if let id=event.reason {charged.insert(id)} }
            if event.kind == .specialImpact && !didOrdinary {
                didOrdinary=true
                DispatchQueue.main.async {
                    guard let plan=captured,let geometry=scene.boardGeometry else {XCTFail("Missing captured plan");ordinary.fulfill();return}
                    let reserved=Set(plan.targets.map(\.id)),available=engine.state.tiles.filter { !$0.isWild && $0.isPlayable && !reserved.contains($0.id) && $0.value <= 3 }
                    guard available.count>=2 else {XCTFail("Missing unrelated ordinary pair");ordinary.fulfill();return}
                    XCTAssertNotNil(engine.pendingSpecial)
                    let a=available[0],b=available[1]
                    XCTAssertTrue(scene.beginDrag(at:geometry.center(row:a.cell.row,column:a.cell.column)))
                    let target=geometry.center(row:b.cell.row,column:b.cell.column)
                    scene.moveDrag(to:target);let result=scene.finishDrag(at:target,now:2)
                    XCTAssertEqual(result?.accepted,true);ordinaryMoves=engine.state.moves
                    ordinary.fulfill()
                }
            }
        }
        var finished=false
        scene.onStateChange = { _ in
            if didOrdinary && engine.pendingSpecial == nil && engine.pendingMeterRewards.isEmpty && engine.pendingOrdinaryStack == nil && engine.pendingOrdinaryPostchecks.isEmpty && charged.count==2 && !finished {
                finished=true;XCTAssertEqual(engine.state.moves,ordinaryMoves-1,"Captured ordinary postcheck debits independently of TNT owner");settled.fulfill()
            }
        }
        XCTAssertTrue(scene.beginDrag(at:try center(scene,0)));scene.moveDrag(to:try center(scene,1))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:center(scene,1),now:1)).accepted)
        await fulfillment(of:[ordinary,settled],timeout:6)
        XCTAssertEqual(charged.count,2);XCTAssertNil(engine.pendingSpecial);XCTAssertTrue(engine.pendingMeterRewards.isEmpty)
    }
    func testAuthoredTntVariantUsesItsRealFrameSixReceiptAndCancelsOnBackground() async throws {
        let source=NativeTile(id:"flower",cell:NativeCell(column:0,row:0),value:3,archetype:.tnt,variant:"flower")
        let scene=scene([source,tile("target",1,2),tile("one",2,3),tile("two",3,1),tile("three",4,2)])
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller;window.makeKeyAndVisible();renderer.presentScene(scene)
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let activated=expectation(description:"Authored family starts only after the real 80ms absorb activation")
        var beginReturn:(() -> Void)?,finished:(() -> Void)?,variants:[String] = [],cancellations:[String?] = []
        scene.authoredTntPresentationReady = {$0=="flower"}
        scene.onAuthoredTntPresentation = {variant,_,generation,ready,completion in
            variants.append(variant);XCTAssertEqual(generation,scene.engine.state.generation);beginReturn=ready;finished=completion;activated.fulfill();return true
        }
        scene.onSpecialPresentationCancelled = {cancellations.append($0)}
        XCTAssertTrue(scene.beginDrag(at:try center(scene,0)));scene.moveDrag(to:try center(scene,1))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:center(scene,1),now:1)).accepted)
        XCTAssertEqual(variants,[])
        await fulfillment(of:[activated],timeout:2)
        XCTAssertEqual(variants,["flower"]);XCTAssertNotNil(beginReturn);XCTAssertNotNil(scene.engine.pendingSpecial)
        // No unrelated timer may fake frame-six readiness in an authored family.
        scene.setSuspended(true);let settled=scene.engine.state
        XCTAssertEqual(cancellations.count,1);XCTAssertEqual(cancellations[0],"flower");XCTAssertNil(scene.engine.pendingSpecial)
        beginReturn?();finished?();scene.setSuspended(false)
        XCTAssertEqual(scene.engine.state,settled,"Stale UIKit readiness cannot choose or commit another target")
    }
    func testInitialRoundGatePaintsPaperBeforeBoardAndReleasesEntryOnlyOnce() throws {
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:[tile("a",0,1),tile("b",1,2)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        var release:(() -> Void)?,requests=0,entries=0
        controller.beforeInitialBoardEntry = { ready in requests += 1;release=ready }
        controller.onBoardEntry = {_,_ in entries += 1}
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
        defer {controller.dispose();window.isHidden=true}
        controller.view.frame=window.bounds;controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let renderer=try XCTUnwrap(controller.view.subviews.compactMap {$0 as? SKView}.first)
        XCTAssertEqual(requests,1);XCTAssertEqual(entries,0);XCTAssertNil(renderer.scene);XCTAssertTrue(renderer.isHidden)
        let paper=try XCTUnwrap(controller.view.subviews.compactMap {$0 as? NativeAppPaperSurface}.first)
        paper.layoutIfNeeded()
        let texture=try XCTUnwrap(paper.subviews.compactMap {$0 as? UIImageView}.first)
        XCTAssertNotNil(texture.image);XCTAssertEqual(texture.frame,paper.bounds)
        XCTAssertTrue(controller.view.subviews.first === paper)
        controller.view.setNeedsLayout();controller.view.layoutIfNeeded();XCTAssertEqual(requests,1)
        release?();controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        XCTAssertNotNil(renderer.scene);XCTAssertFalse(renderer.isHidden);XCTAssertEqual(entries,1)
        release?();controller.view.setNeedsLayout();controller.view.layoutIfNeeded();XCTAssertEqual(entries,1)
    }
    func testDisposedInitialRoundGateCannotReviveItsBoard() throws {
        let controller=NativeGameplayViewController(engine:NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:[tile("a",0,1)])),resourceRoot:root)
        var release:(() -> Void)?;controller.beforeInitialBoardEntry = {release=$0}
        controller.loadViewIfNeeded();controller.view.frame=CGRect(x:0,y:0,width:390,height:844);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        let renderer=try XCTUnwrap(controller.view.subviews.compactMap {$0 as? SKView}.first)
        XCTAssertNotNil(release);controller.dispose();release?()
        XCTAssertNil(renderer.scene);XCTAssertNil(controller.boardScene)
    }

    func testActualControllerRoutesFinalKantaToAuthoredOwnerBeforeTerminal() async throws {
        let kanta=NativeTile(id:"k",cell:NativeCell(column:0,row:0),value:6,archetype:.star,variant:"kanta")
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[kanta,tile("d",1,2)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let entered=expectation(description:"Real board entry admits finalKanta input")
        controller.onBoardEntry={duration,_ in DispatchQueue.main.asyncAfter(deadline:.now()+duration+0.1) {entered.fulfill()}}
        var terminals=0,captures=0,fade=[Double]()
        let walking=expectation(description:"Actual80ms absorb launches finalKanta walking owner")
        let terminal=expectation(description:"FinalKanta result waits its real authored exit")
        controller.onTerminal={result in XCTAssertEqual(result.kind,.complete);terminals+=1;terminal.fulfill()}
        controller.onSpecialFadeCapture={variant,generation in XCTAssertEqual(variant,"kanta");XCTAssertEqual(generation,engine.state.generation);captures+=1;walking.fulfill();return {fade.append($0)}}
        window.rootViewController=controller;window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        defer {controller.dispose();window.isHidden=true}
        await fulfillment(of:[entered],timeout:4)
        let scene=try XCTUnwrap(controller.boardScene)
        XCTAssertTrue(scene.beginDrag(at:try center(scene,0)));scene.moveDrag(to:try center(scene,1))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:center(scene,1),now:1)).accepted)
        XCTAssertEqual(engine.state.moves,50,"Final Wild main counters also wait source80ms")
        await fulfillment(of:[walking],timeout:2)
        XCTAssertEqual(controller.view.subviews.filter {$0.accessibilityIdentifier=="native-kanta-finale"}.count,1,"A connected native finale must replace the fallback smoke route")
        XCTAssertEqual(captures,1);XCTAssertEqual(terminals,0);XCTAssertTrue(engine.state.tiles.isEmpty)
        await fulfillment(of:[terminal],timeout:5)
        XCTAssertEqual(terminals,1);XCTAssertEqual(fade.last ?? -1,1,accuracy:0.000001)
    }

    func testActualControllerRoutesFinalCuberoFrom80msToLastClothCleanup() async throws {
        let cubero=NativeTile(id:"c",cell:NativeCell(column:0,row:0),value:6,archetype:.star,variant:"cubero")
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[cubero,tile("d",1,2)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let entered=expectation(description:"Actual board entry admits Cubero drag"),merged=expectation(description:"Captured Cubero commit at source80ms"),terminal=expectation(description:"Last authored Cubero cloth owns final result handoff")
        controller.onBoardEntry={duration,_ in DispatchQueue.main.asyncAfter(deadline:.now()+duration+0.1) {entered.fulfill()}}
        var terminals=0
        controller.onGameplayEvent={event in if event.kind == .merged {merged.fulfill()}}
        controller.onTerminal={result in XCTAssertEqual(result.kind,.complete);terminals+=1;terminal.fulfill()}
        window.rootViewController=controller;window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        defer {controller.dispose();window.isHidden=true}
        await fulfillment(of:[entered],timeout:4)
        let scene=try XCTUnwrap(controller.boardScene)
        XCTAssertTrue(scene.beginDrag(at:try center(scene,0)));scene.moveDrag(to:try center(scene,1))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:center(scene,1),now:1)).accepted)
        XCTAssertEqual(engine.state.moves,50);XCTAssertEqual(terminals,0)
        await fulfillment(of:[merged],timeout:2)
        XCTAssertEqual(engine.state.moves,49);XCTAssertEqual(terminals,0)
        XCTAssertEqual(controller.view.subviews.filter {$0.accessibilityIdentifier=="native-cubero-finale"}.count,1)
        await fulfillment(of:[terminal],timeout:5)
        XCTAssertEqual(terminals,1);XCTAssertNil(engine.pendingDirectWild)
        XCTAssertTrue(controller.view.subviews.filter {$0.accessibilityIdentifier=="native-cubero-finale"}.isEmpty)
    }

    func testActualControllerRoutesFinalMushroomToItsLastSporeReceipt() async throws {
        try await verifyFinalJuiceVariant("mushroom",identifier:"native-mushroom-finale")
    }
    func testActualControllerRoutesFinalRoboThroughHeadAndNeonExit() async throws {
        try await verifyFinalJuiceVariant("robo-cube",identifier:"native-robo-finale")
    }
    private func verifyFinalJuiceVariant(_ variant:String,identifier:String) async throws {
        let special=NativeTile(id:"j",cell:NativeCell(column:0,row:0),value:6,archetype:.juice,variant:variant)
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[special,tile("d",1,2)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let entered=expectation(description:"Source board entry admits \(variant)"),merged=expectation(description:"Source80ms \(variant) gameplay commit"),terminal=expectation(description:"Authored \(variant) last visual receipt")
        controller.onBoardEntry={duration,_ in DispatchQueue.main.asyncAfter(deadline:.now()+duration+0.1) {entered.fulfill()}}
        var terminals=0
        controller.onGameplayEvent={event in if event.kind == .merged {merged.fulfill()}}
        controller.onTerminal={result in XCTAssertEqual(result.kind,.complete);terminals+=1;terminal.fulfill()}
        window.rootViewController=controller;window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        defer {controller.dispose();window.isHidden=true}
        await fulfillment(of:[entered],timeout:4)
        let scene=try XCTUnwrap(controller.boardScene)
        XCTAssertTrue(scene.beginDrag(at:try center(scene,0)));scene.moveDrag(to:try center(scene,1))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:center(scene,1),now:1)).accepted)
        XCTAssertEqual(engine.state.moves,50);XCTAssertEqual(terminals,0)
        await fulfillment(of:[merged],timeout:2)
        XCTAssertEqual(engine.state.moves,49);XCTAssertEqual(terminals,0)
        XCTAssertEqual(controller.view.subviews.filter {$0.accessibilityIdentifier==identifier}.count,1)
        await fulfillment(of:[terminal],timeout:8)
        XCTAssertEqual(terminals,1);XCTAssertNil(engine.pendingDirectWild)
        XCTAssertTrue(controller.view.subviews.filter {$0.accessibilityIdentifier==identifier}.isEmpty)
    }

    func testMissingFinaleRosterRejectsBeforeMutationAndRandomDraws() throws {
        let cubero=NativeTile(id:"c",cell:NativeCell(column:0,row:0),value:6,archetype:.star,variant:"cubero")
        let scene=scene([cubero,tile("d",1,2)]),before=scene.engine.state
        defer {scene.dispose()}
        XCTAssertTrue(scene.beginDrag(at:try center(scene,0)));scene.moveDrag(to:try center(scene,1))
        let result=try XCTUnwrap(scene.finishDrag(at:center(scene,1),now:1))
        XCTAssertFalse(result.accepted);XCTAssertEqual(result.resolution.reason,"native_finale_presentation_not_ready");XCTAssertEqual(scene.engine.state,before)
    }

    func testDirectStarCommitsAtAbsorbThenReleasesOrdinaryInputBeforeWildGate() async throws {
        let star=NativeTile(id:"s",cell:NativeCell(column:0,row:0),value:6,archetype:.star)
        let otherWild=NativeTile(id:"w",cell:NativeCell(column:4,row:1),value:6,archetype:.juice)
        let scene=scene([star,tile("d",1,2),tile("a",2,1),tile("b",3,1),tile("e",4,3),otherWild])
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:CGRect(x:0,y:0,width:390,height:844))
        controller.view=renderer;window.rootViewController=controller;window.makeKeyAndVisible();renderer.presentScene(scene)
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let absorbed=expectation(description:"Actual80ms native absorb commits gameplay")
        let released=expectation(description:"Source900ms Wild-only gate releases once")
        var didAbsorb=false,didRelease=false
        scene.onGameplayEvent={event in if event.kind == .merged,event.archetype == .star {didAbsorb=true;absorbed.fulfill()}}
        scene.onStateChange={_ in if didAbsorb,!didRelease,scene.engine.pendingDirectWild == nil {didRelease=true;released.fulfill()}}
        XCTAssertTrue(scene.beginDrag(at:try center(scene,0)));scene.moveDrag(to:try center(scene,1))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:center(scene,1),now:1)).accepted)
        XCTAssertEqual(scene.engine.state.moves,50);XCTAssertEqual(scene.engine.state.score,0);XCTAssertNotNil(scene.engine.pendingDirectWild)
        XCTAssertFalse(scene.beginDrag(at:try center(scene,2)),"Before absorb every pointer is owned by the captured direct transaction")
        await fulfillment(of:[absorbed],timeout:2)
        XCTAssertEqual(scene.engine.state.moves,49);XCTAssertTrue(scene.engine.directWildGameplayCommitted)
        let wildPoint=try XCTUnwrap(scene.boardGeometry).center(row:1,column:4)
        XCTAssertFalse(scene.beginDrag(at:wildPoint),"Authored visual gate still protects all Wild/Special")
        XCTAssertTrue(scene.beginDrag(at:try center(scene,2)));scene.moveDrag(to:try center(scene,3))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:center(scene,3),now:1.2)).accepted)
        XCTAssertEqual(scene.engine.state.moves,49,"Ordinary contact does not debit before its captured postcheck")
        await fulfillment(of:[released],timeout:3)
        XCTAssertNil(scene.engine.pendingDirectWild);XCTAssertEqual(scene.engine.state.moves,48)
    }

    func testBackgroundCommitsUnpaintedDirectJuiceOnceAndInvalidatesCallbacks() throws {
        let juice=NativeTile(id:"j",cell:NativeCell(column:0,row:0),value:6,archetype:.juice)
        let scene=scene([juice,tile("d",1,2),tile("a",2,1),tile("b",3,3)]),before=scene.engine.state
        defer {scene.dispose()}
        XCTAssertTrue(scene.beginDrag(at:try center(scene,0)));scene.moveDrag(to:try center(scene,1))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:center(scene,1),now:1)).accepted)
        XCTAssertEqual(scene.engine.state,before);XCTAssertNotNil(scene.engine.pendingDirectWild)
        scene.setSuspended(true)
        XCTAssertNil(scene.engine.pendingDirectWild);XCTAssertEqual(scene.engine.state.moves,49)
        let settled=scene.engine.state
        scene.setSuspended(false);scene.setSuspended(true);scene.setSuspended(false)
        XCTAssertEqual(scene.engine.state,settled);XCTAssertTrue(scene.beginDrag(at:try center(scene,2)));scene.cancelDrag()
    }

    func testPreparedNextGenerationWaitsForItsOwnReleaseAcrossBackground() throws {
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[tile("a",0,1),tile("b",1,2)]))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root)
        controller.loadViewIfNeeded();controller.view.frame=CGRect(x:0,y:0,width:390,height:844);controller.view.setNeedsLayout();controller.view.layoutIfNeeded()
        defer {controller.dispose()}
        var entries=0;controller.onBoardEntry={_,_ in entries+=1}
        engine.restart(state:NativeBoardState(tiles:[tile("new-a",0,2),tile("new-b",1,3)]))
        let release=try XCTUnwrap(controller.prepareNextBoardEntry())
        XCTAssertEqual(entries,0);XCTAssertNil(controller.prepareNextBoardEntry())
        let scene=try XCTUnwrap(controller.boardScene)
        XCTAssertFalse(scene.beginDrag(at:try center(scene,0)))
        controller.setSuspended(true);controller.setSuspended(false)
        XCTAssertEqual(entries,0);XCTAssertFalse(scene.beginDrag(at:try center(scene,0)))
        release();release();XCTAssertEqual(entries,1)
        engine.restart(state:NativeBoardState(tiles:[tile("next-a",0,1),tile("next-b",1,4)]));controller.refreshFromEngine()
        release();XCTAssertEqual(entries,1,"A prior-generation visual receipt cannot admit this board")
        let nextRelease=try XCTUnwrap(controller.prepareNextBoardEntry());controller.dispose();nextRelease()
        XCTAssertNil(controller.boardScene);XCTAssertEqual(entries,1)
    }

    func testActualControllerLaserCommitsOnlyCapturedNativeBeamContactsAndLastOpen() async throws {
        let laser=NativeTile(id:"laser",cell:NativeCell(column:0,row:0),value:6,archetype:.tnt,variant:"laser-gun")
        let remaining=[tile("d",1,1),tile("a",2,2),tile("b",3,3),tile("c",4,4),NativeTile(id:"e",cell:NativeCell(column:0,row:1),value:5)]
        let engine=NativeGameplayEngine(state:NativeBoardState(tiles:[laser]+remaining),recordedRandomChoices:Array(repeating:0.5,count:200))
        let controller=NativeGameplayViewController(engine:engine,resourceRoot:root),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let entered=expectation(description:"Real Laser board entry")
        controller.onBoardEntry={duration,_ in DispatchQueue.main.asyncAfter(deadline:.now()+duration+0.1) {entered.fulfill()}}
        var contacts=[Int](),settled=false
        let complete=expectation(description:"Captured native beams and actual last open settle Laser owner")
        controller.onSpecialMoment={variant,moment,index in if variant=="laser-gun",moment=="impact" {contacts.append(index)}}
        controller.onStateChange={_ in if contacts.count==4,engine.pendingSpecial == nil,!settled {settled=true;complete.fulfill()}}
        window.rootViewController=controller;window.makeKeyAndVisible();controller.view.layoutIfNeeded()
        defer {controller.dispose();window.isHidden=true}
        await fulfillment(of:[entered],timeout:4)
        let scene=try XCTUnwrap(controller.boardScene)
        XCTAssertTrue(scene.beginDrag(at:try center(scene,0)));scene.moveDrag(to:try center(scene,1))
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:center(scene,1),now:1)).accepted)
        XCTAssertEqual(engine.state.moves,50);XCTAssertEqual(contacts,[])
        await fulfillment(of:[complete],timeout:10)
        XCTAssertEqual(contacts,[0,1,2,3]);XCTAssertEqual(engine.state.moves,49)
        XCTAssertNil(engine.pendingSpecial);XCTAssertTrue(engine.pendingMeterRewards.isEmpty)
        XCTAssertFalse(scene.navigationLocked);XCTAssertNil(engine.state.terminal)
    }
}
