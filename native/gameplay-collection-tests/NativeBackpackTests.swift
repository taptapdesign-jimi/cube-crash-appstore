import StackToSixGameplay
import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeBackpackTests:XCTestCase {
    func testMountedCollectionArtworkResolutionAndRetinaSnapshot() throws {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        host.view.backgroundColor = .white
        let screen=NativeBackpackView(frame:CGRect(x:0,y:80,width:390,height:680),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        screen.useModalLayout();host.view.addSubview(screen)
        screen.apply([.init(title:"Forest",dice:NativeBackpackCatalog.forest,unlocked:Set(NativeBackpackCatalog.forest.map(\.id)))])
        screen.layoutIfNeeded();screen.grid.layoutIfNeeded()
        for cell in screen.grid.visibleCells {
            let group=try XCTUnwrap(cell.contentView.subviews.first{$0.accessibilityIdentifier=="native.backpack.idle-group"})
            let art=try XCTUnwrap(group.subviews.first{$0.accessibilityIdentifier=="native.backpack.idle-artwork"} as? UIImageView)
            let pixels=try XCTUnwrap(art.image?.cgImage)
            let frame=try XCTUnwrap(group.subviews.first{$0.accessibilityIdentifier=="native.backpack.frame"})
            XCTAssertEqual(frame.layer.contentsScale,window.screen.scale)
            XCTAssertEqual(group.layer.contentsScale,window.screen.scale)
            XCTAssertTrue(frame.layer.allowsEdgeAntialiasing)
            XCTAssertTrue(art.layer.allowsEdgeAntialiasing)
            XCTAssertFalse(group.layer.shouldRasterize,"No low-resolution flattened cache or per-frame CPU raster")
            print("[BackpackRaster] \(cell.accessibilityIdentifier ?? "?") pixels=\(pixels.width)x\(pixels.height) imageScale=\(art.image!.scale) bounds=\(art.bounds) contentsScale=\(art.layer.contentsScale) groupScale=\(group.layer.contentsScale)")
            let id=(cell.accessibilityIdentifier ?? "").replacingOccurrences(of:"native.backpack.die.",with:"")
            group.layer.transform=NativeBackpackArtworkIdleMotion(id:id).poses(scale:1)[1]
        }
        CATransaction.flush()
        let format=UIGraphicsImageRendererFormat();format.scale=3
        let image=UIGraphicsImageRenderer(bounds:window.bounds,format:format).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-quality-current.png"))
    }
    func testLiveCompositorCardEdgeComparison() async throws {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.windowLevel = .alert+1;window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        host.view.backgroundColor = .white
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let screen=NativeBackpackView(frame:CGRect(x:0,y:80,width:390,height:680),assets:assets)
        screen.useModalLayout();host.view.addSubview(screen)
        screen.apply([.init(title:"Forest",dice:NativeBackpackCatalog.forest,unlocked:Set(NativeBackpackCatalog.forest.map(\.id)))])
        screen.layoutIfNeeded();screen.grid.layoutIfNeeded()
        var replacements:[UIView]=[]
        for cell in screen.grid.visibleCells {
            let group=try XCTUnwrap(cell.contentView.subviews.first{$0.accessibilityIdentifier=="native.backpack.idle-group"})
            let frame=try XCTUnwrap(group.subviews.first{$0.accessibilityIdentifier=="native.backpack.frame"})
            let index=try XCTUnwrap(screen.grid.indexPath(for:cell))
            let replacement=UIImageView(image:assets.image("assets/backpack/dice holder\(index.item%2==1 ? " desno":"").png",densityAware:true))
            replacement.contentMode = .scaleAspectFit;replacement.bounds=frame.bounds;replacement.center=frame.center
            frame.isHidden=true;group.insertSubview(replacement,at:0);replacements.append(replacement)
            group.layer.contentsScale=1;group.layer.allowsEdgeAntialiasing=false
            for child in group.subviews {child.layer.allowsEdgeAntialiasing=false;child.layer.minificationFilter = .linear}
            group.layer.transform=NativeBackpackArtworkIdleMotion(id:NativeBackpackCatalog.forest[index.item].id).poses(scale:1)[1]
        }
        CATransaction.flush()
        try "before".write(toFile:"/tmp/backpack-quality-live-phase",atomically:true,encoding:.utf8)
        try await Task.sleep(for:.seconds(8))
        replacements.forEach{$0.removeFromSuperview()}
        for cell in screen.grid.visibleCells {
            let group=try XCTUnwrap(cell.contentView.subviews.first{$0.accessibilityIdentifier=="native.backpack.idle-group"})
            group.layer.contentsScale=window.screen.scale;group.layer.allowsEdgeAntialiasing=true
            for child in group.subviews {child.isHidden=false;child.layer.allowsEdgeAntialiasing=true;child.layer.minificationFilter = .trilinear}
            // Alerts were not requested for this deterministic visual fixture.
            group.subviews.compactMap{$0 as? NativeBackpackAlertView}.forEach{$0.isHidden=true}
        }
        CATransaction.flush()
        try "after".write(toFile:"/tmp/backpack-quality-live-phase",atomically:true,encoding:.utf8)
        try await Task.sleep(for:.seconds(8))
    }
    func testOnlyViewportSeenUnreadCardsAreAdmittedWhileCollectionIsActive() throws {
        var progress=NativeProgressionState();progress.announceJourneyDie("bee",board:1);progress.announceJourneyDie("fish",board:12)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        let screen=NativeBackpackView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        host.view.addSubview(screen);screen.apply(NativeBackpackCatalog.sections(progress));screen.grid.layoutIfNeeded()
        XCTAssertTrue(screen.seenUnreadDice.isEmpty,"Preparation cannot read alerts")
        screen.setAlertsActive(true)
        XCTAssertEqual(screen.seenUnreadDice,["bee"],"Unscrolled Beach remains unread")
        let section=try XCTUnwrap(screen.sections.firstIndex{$0.dice.contains{$0.id=="fish"}})
        let item=try XCTUnwrap(screen.sections[section].dice.firstIndex{$0.id=="fish"})
        screen.setAlertsActive(false)
        screen.grid.scrollToItem(at:IndexPath(item:item,section:section),at:.centeredVertically,animated:false);screen.grid.layoutIfNeeded();screen.scrollViewDidScroll(screen.grid)
        XCTAssertEqual(screen.seenUnreadDice,["bee"],"Covered/background collection cannot read")
        screen.setAlertsActive(true)
        XCTAssertEqual(screen.seenUnreadDice,["bee","fish"])
        XCTAssertEqual(progress.unreadJourneyDice,["bee","fish"],"Visibility only records a receipt; durable read waits for close")
        screen.apply(NativeBackpackCatalog.sections(progress));screen.grid.layoutIfNeeded()
        XCTAssertFalse(screen.seenUnreadDice.contains("fish"),"New visit cannot inherit old viewport receipts")
        let fishPath=IndexPath(item:item,section:section)
        let frame=try XCTUnwrap(screen.grid.layoutAttributesForItem(at:fishPath)).frame
        screen.grid.setContentOffset(CGPoint(x:0,y:frame.minY-screen.bounds.height+4),animated:false)
        screen.grid.layoutIfNeeded();screen.scrollViewDidScroll(screen.grid)
        XCTAssertFalse(screen.seenUnreadDice.contains("fish"),"A four-point edge sliver is not a viewed card")
        screen.grid.scrollToItem(at:fishPath,at:.centeredVertically,animated:false);screen.grid.layoutIfNeeded()
        XCTAssertTrue(screen.seenUnreadDice.contains("fish"),"Visible-cell admission also records cards on active scroll")
        screen.setAlertsActive(false)
    }
    func testUnlockedArtworkUsesWorldsFloatWhileLockedCellsStayStillAndLifecycleRetiresIt() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else {throw XCTSkip("Authored idle motion")}
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        for embedded in [false,true] {
            let screen=NativeBackpackView(frame:embedded ? CGRect(x:24,y:80,width:342,height:650):window.bounds,assets:assets)
            if embedded {screen.useModalLayout()}
            host.view.addSubview(screen)
            var progress=NativeProgressionState();progress.announceJourneyDie("bee",board:1);progress.announceJourneyDie("wild-star",board:2)
            let sections=NativeBackpackCatalog.sections(progress)
            screen.apply(embedded ? [sections[0]]:sections);screen.grid.layoutIfNeeded();screen.setAlertsActive(true)
            let key="backpack.artwork.idle"
            func cell(_ i:Int)throws->UICollectionViewCell {try XCTUnwrap(screen.grid.cellForItem(at:IndexPath(item:i,section:0)))}
            func artwork(_ cell:UICollectionViewCell)throws->UIImageView {try XCTUnwrap(cell.contentView.subviews.flatMap{[$0]+$0.subviews}.first{$0.accessibilityIdentifier=="native.backpack.idle-artwork"} as? UIImageView)}
            let beeCell=try cell(0),beeArt=try artwork(beeCell),starArt=try artwork(cell(1)),lockedArt=try artwork(cell(2))
            let bee=try XCTUnwrap(beeArt.superview),star=try XCTUnwrap(starArt.superview),locked=try XCTUnwrap(lockedArt.superview)
            for (image,id) in [(bee,"bee"),(star,"wild-star")] {
                let motion=try XCTUnwrap(image.layer.animation(forKey:key) as? CAKeyframeAnimation)
                XCTAssertEqual(motion.keyPath,"transform");XCTAssertEqual(motion.duration,NativeBackpackArtworkIdleMotion(id:id).baseDuration/1.4,accuracy:1e-9)
                XCTAssertGreaterThan(motion.repeatCount,100)
                let peak=(motion.values![1] as! NSValue).caTransform3DValue
                XCTAssertLessThan(peak.m42,0);XCTAssertGreaterThan(abs(peak.m13)+abs(peak.m23),0.05)
                XCTAssertNotEqual(peak.m41,0)
            }
            XCTAssertNil(locked.layer.animationKeys())
            XCTAssertTrue(bee.subviews.filter{!($0 is NativeBackpackAlertView)}.allSatisfy{$0.layer.animationKeys()==nil},"Holder and die share their moving parent")
            try await Task.sleep(for:.milliseconds(350))
            XCTAssertLessThan(try XCTUnwrap(bee.layer.presentation()).transform.m42,-0.02,"Actual mounted holder and die float together")
            let begin=try XCTUnwrap(bee.layer.animation(forKey:key)).beginTime
            screen.markRead("bee");screen.layoutIfNeeded();XCTAssertEqual(bee.layer.animation(forKey:key)?.beginTime,begin)
            let painted=try XCTUnwrap(bee.layer.presentation()).transform.m42
            screen.setAlertsActive(false);XCTAssertNil(bee.layer.animationKeys());XCTAssertNil(star.layer.animationKeys())
            XCTAssertEqual(bee.layer.transform.m42,painted,accuracy:0.5,"Exit/detail pause freezes the painted pose without snapping")
            screen.setAlertsActive(true);XCTAssertGreaterThan(try XCTUnwrap(bee.layer.animation(forKey:key)).timeOffset,0,"Resume retains its paused phase")
            screen.isHidden=true;XCTAssertNil(bee.layer.animationKeys());screen.isHidden=false;XCTAssertNotNil(bee.layer.animation(forKey:key))
            screen.collectionView(screen.grid,didEndDisplaying:beeCell,forItemAt:IndexPath(item:0,section:0));XCTAssertNil(bee.layer.animationKeys())
            screen.collectionView(screen.grid,willDisplay:beeCell,forItemAt:IndexPath(item:0,section:0));XCTAssertNotNil(bee.layer.animation(forKey:key))
            beeCell.prepareForReuse();XCTAssertNil(bee.layer.animationKeys());XCTAssertTrue(CATransform3DIsIdentity(bee.layer.transform))
            screen.removeFromSuperview();XCTAssertNil(star.layer.animationKeys());XCTAssertNil(locked.layer.animationKeys())
        }
    }

    func testEveryCollectionIconHasDistinctBoundedThreeDimensionalIdle() {
        let items=NativeBackpackCatalog.arcade+NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        XCTAssertEqual(items.count,18)
        var durations=Set<Double>(),directions=Set<Bool>()
        for item in items {
            let motion=NativeBackpackArtworkIdleMotion(id:item.id)
            XCTAssertEqual(motion.duration*1.4,motion.baseDuration,accuracy:1e-9)
            durations.insert(motion.duration);directions.insert(motion.drift.x>0)
            let poses=motion.poses(scale:1)
            XCTAssertTrue(CATransform3DEqualToTransform(poses[0],poses[4]),"Loop closes without a jump")
            for pose in poses {
                XCTAssertTrue(pose.m11.isFinite && pose.m22.isFinite && pose.m34.isFinite)
                XCTAssertLessThan(abs(pose.m41),5);XCTAssertLessThan(abs(pose.m42),10)
                XCTAssertGreaterThan(pose.m11*pose.m22-pose.m12*pose.m21,0.9,"No edge-on/card collapse")
            }
            XCTAssertLessThan(poses[1].m34,0)
            XCTAssertGreaterThan(abs(poses[1].m13)+abs(poses[1].m23),0.05)
            XCTAssertLessThan(poses[1].m13*poses[2].m13,0,"Yaw reverses through the cycle")
        }
        XCTAssertEqual(durations.count,items.count);XCTAssertEqual(directions.count,2)
    }
    func testArcadeIconsHaveIndependentMountedPosesAndStopOffWindow() async throws {
        guard !UIAccessibility.isReduceMotionEnabled else {throw XCTSkip("Authored idle motion")}
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        let screen=NativeBackpackView(frame:window.bounds,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),arcadeCrate:true)
        host.view.addSubview(screen);screen.apply([]);screen.grid.layoutIfNeeded();screen.setAlertsActive(true)
        let cells=screen.grid.visibleCells
        XCTAssertEqual(cells.count,4)
        let groups=try cells.map {cell in try XCTUnwrap(cell.contentView.subviews.first{$0.accessibilityIdentifier=="native.backpack.idle-group"})}
        let animations=try groups.map {try XCTUnwrap($0.layer.animation(forKey:"backpack.artwork.idle") as? CAKeyframeAnimation)}
        XCTAssertEqual(Set(animations.map(\.duration)).count,4)
        try await Task.sleep(for:.milliseconds(350))
        for group in groups {
            let painted=try XCTUnwrap(group.layer.presentation()).transform
            XCTAssertGreaterThan(abs(painted.m41),0.01)
            XCTAssertGreaterThan(abs(painted.m13)+abs(painted.m23),0.002,"Mounted artwork turns in3D")
        }
        // Render the real four-card layout for visual review at this active pose.
        let renderer=UIGraphicsImageRenderer(bounds:screen.bounds)
        let png=renderer.image {_ in screen.drawHierarchy(in:screen.bounds,afterScreenUpdates:false)}.pngData()
        try png?.write(to:URL(fileURLWithPath:"/tmp/backpack-idle40-arcade.png"))
        screen.setAlertsActive(false)
        XCTAssertTrue(groups.allSatisfy{$0.layer.animation(forKey:"backpack.artwork.idle")==nil})
        screen.setAlertsActive(true)
        XCTAssertTrue(groups.allSatisfy{($0.layer.animation(forKey:"backpack.artwork.idle")?.timeOffset ?? 0)>0})
        screen.removeFromSuperview()
        XCTAssertTrue(groups.allSatisfy{$0.layer.animation(forKey:"backpack.artwork.idle")==nil})
    }

    func testOpeningEveryIntroductionUnitDoesNotRevealItsDieBeforeLandedDrop() throws {
        for board in 1...30 {
            var progression=NativeProgressionState()
            progression.completedJourneyBoards=Set(1..<board)
            progression.highestUnlockedJourneyBoard=board
            progression.lastOpenedJourneyBoard=board
            progression.unlockedSpecialDice=["flower","juice"]
            var stats=NativeBoardStats();stats.timesPlayed=3;progression.boardStats[board]=stats
            XCTAssertTrue(NativeBackpackCatalog.sections(progression).allSatisfy{$0.unlocked.isEmpty},"Unit \(board) is eligibility only")
            if let id=NativeJourneyContent.introductionID(board:board) {
                XCTAssertTrue(progression.announceJourneyDie(id,board:board))
                let sections=NativeBackpackCatalog.sections(progression)
                XCTAssertEqual(sections.reduce(0){$0+$1.count},1)
                XCTAssertTrue(sections.contains{$0.unlocked==[id]})
            }
        }
        var progression=NativeProgressionState()
        progression.announceJourneyDie("bee",board:1)
        progression.completedJourneyBoards=[1];progression.beginAttempt(mode:.journey,board:2)
        let forest=try XCTUnwrap(NativeBackpackCatalog.sections(progression).first)
        XCTAssertEqual(forest.unlocked,["bee"])
        XCTAssertFalse(forest.unlocked.contains("wild-star"))
    }
    func testEveryDiscoveredIntroductionStaysUnlockedAfterReadingAndReloadingUntilDeveloperHide() throws {
        let introductions=(1...30).compactMap{board -> (Int,String)? in
            NativeJourneyContent.introductionID(board:board).map{(board,$0)}
        }
        XCTAssertEqual(introductions.count,14)
        for (board,id) in introductions {
            // DEV Hide can leave a retained board without ordinary progression evidence.
            var progression=NativeProgressionState()
            XCTAssertTrue(NativeBackpackCatalog.sections(progression).allSatisfy{!$0.unlocked.contains(id)},id)
            XCTAssertTrue(progression.announceJourneyDie(id,board:board),id)
            let discovered=NativeBackpackCatalog.sections(progression)
            let section=try XCTUnwrap(discovered.first{$0.dice.contains{$0.id==id}})
            XCTAssertTrue(section.unlocked.contains(id),id)
            XCTAssertTrue(section.unread.contains(id),id)
            XCTAssertEqual(discovered.filter{$0.unlocked.contains(id)}.count,1,id)

            progression.readJourneyDie(id)
            progression=try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(progression))
            let reopened=try XCTUnwrap(NativeBackpackCatalog.sections(progression).first{$0.title==section.title})
            XCTAssertTrue(reopened.unlocked.contains(id),"Reading and reopening must retain \(id)")
            XCTAssertFalse(reopened.unread.contains(id),id)
            XCTAssertFalse(progression.announceJourneyDie(id,board:board),"Reading must not re-arm \(id)")

            progression.resetDeveloperJourneyDieAnnouncement(board:board)
            progression=try JSONDecoder().decode(NativeProgressionState.self,from:JSONEncoder().encode(progression))
            XCTAssertTrue(NativeBackpackCatalog.sections(progression).allSatisfy{!$0.unlocked.contains(id)},"DEV Hide must clear discovery eligibility for \(id)")
            XCTAssertTrue(progression.announceJourneyDie(id,board:board),"DEV Hide must re-arm \(id)")
        }
    }

    func testEveryJourneyIntroductionHasMatchingCollectionAndHUDAlert() throws {
        for board in 1...30 {
            guard let id=NativeJourneyContent.introductionID(board:board) else{continue}
            var progression=NativeProgressionState()
            XCTAssertTrue(progression.announceJourneyDie(id,board:board))
            let engine=NativeGameplayEngine(state:NativeBoardFactory.make(mode:.journey,board:board))
            let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
            let view=SKView(frame:CGRect(x:0,y:0,width:390,height:844));view.presentScene(scene);view.isPaused=true
            scene.unreadJourneyDice={progression.unreadJourneyDice};scene.refreshBackpackAlert()
            let help=try XCTUnwrap(scene.childNode(withName:"//native-game-help"))
            XCTAssertNotNil(help.childNode(withName:"native-game-backpack-alert"),id)
            XCTAssertTrue(NativeBackpackCatalog.sections(progression).contains{$0.unread.contains(id)},id)
            progression.readJourneyDie(id);scene.refreshBackpackAlert()
            XCTAssertNil(help.childNode(withName:"native-game-backpack-alert"),id)
            scene.dispose();view.presentScene(nil)
        }
    }
    func testHUDRepairsDetachedBadgeAndDoesNotDismissAnotherDiscovery() throws {
        let engine=NativeGameplayEngine(state:NativeBoardFactory.make(mode:.journey,board:7))
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        let view=SKView(frame:CGRect(x:0,y:0,width:390,height:844));view.presentScene(scene);view.isPaused=true
        defer{scene.dispose();view.presentScene(nil)}
        var unread:Set<String>=["mushroom"];scene.unreadJourneyDice={unread};scene.refreshBackpackAlert()
        let help=try XCTUnwrap(scene.childNode(withName:"//native-game-help"))
        let old=try XCTUnwrap(help.childNode(withName:"native-game-backpack-alert"))
        old.removeFromParent();scene.refreshBackpackAlert()
        XCTAssertNotNil(help.childNode(withName:"native-game-backpack-alert"))
        scene.setBackpackPresented(true);scene.setBackpackPresented(false)
        unread.insert("barell");scene.refreshBackpackAlert()
        XCTAssertTrue(help.children.contains{$0.name=="native-game-backpack-alert" && $0.action(forKey:"backpack-alert-exit")==nil},"A different landed reward cannot inherit the previous visit's dismissal")
        unread.remove("mushroom");scene.completeBackpackVisit()
        XCTAssertNotNil(help.childNode(withName:"native-game-backpack-alert"))
    }

    func testHUDAlertScopesToCurrentWorldAndClearsWithoutMutatingBoard() throws {
        let engine=NativeGameplayEngine(state:NativeBoardFactory.make(mode:.journey,board:2))
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        let view=SKView(frame:CGRect(x:0,y:0,width:390,height:844));view.presentScene(scene);view.isPaused=true
        defer{scene.dispose();view.presentScene(nil)}
        var unread:Set<String>=[];scene.unreadJourneyDice={unread};let state=engine.state
        let help=try XCTUnwrap(scene.childNode(withName:"//native-game-help") as? SKSpriteNode),closed=help.texture
        unread=["fish"];scene.refreshBackpackAlert();XCTAssertNil(help.childNode(withName:"native-game-backpack-alert"))
        unread.insert("wild-star");scene.refreshBackpackAlert()
        let badge=try XCTUnwrap(help.childNode(withName:"native-game-backpack-alert"))
        XCTAssertTrue(help.texture === closed);XCTAssertGreaterThan(badge.position.x,0);XCTAssertGreaterThan(badge.position.y,0)
        scene.refreshBackpackAlert();XCTAssertTrue(help.childNode(withName:"native-game-backpack-alert") === badge)
        unread.remove("wild-star");scene.refreshBackpackAlert();XCTAssertNil(badge.parent);XCTAssertTrue(help.texture === closed)
        XCTAssertEqual(engine.state,state)
    }
    func testHUDAlertSwapBothDirectionsDefersWhileBackpackIsOpen() async throws {
        let engine=NativeGameplayEngine(state:NativeBoardFactory.make(mode:.journey,board:2))
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let view=SKView(frame:window.bounds);host.view=view;window.rootViewController=host;window.makeKeyAndVisible();view.presentScene(scene)
        defer{scene.dispose();view.presentScene(nil);window.isHidden=true}
        var unread:Set<String>=[];scene.unreadJourneyDice={unread}
        try await Task.sleep(for:.seconds(1))
        let help=try XCTUnwrap(scene.childNode(withName:"//native-game-help") as? SKSpriteNode)
        let originalSize=help.size,originalPosition=help.position
        let closed=help.texture
        unread=["wild-star"];scene.refreshBackpackAlert()
        let badge=try XCTUnwrap(help.childNode(withName:"native-game-backpack-alert"))
        XCTAssertTrue(help.texture === closed);XCTAssertNil(help.action(forKey:"backpack-icon-swap"))
        scene.setBackpackPresented(true)
        scene.setSuspended(true,allowHUDFeedback:true)
        XCTAssertNotNil(help.action(forKey:"backpack-icon-swap"))
        try await Task.sleep(for:.milliseconds(600))
        XCTAssertTrue(help.texture !== closed);XCTAssertNil(help.action(forKey:"backpack-icon-swap"))
        XCTAssertNil(badge.parent,"The finite swap replaces the old badge with the current presentation badge")
        XCTAssertEqual(help.size,originalSize);XCTAssertEqual(help.position,originalPosition)
        XCTAssertLessThan(help.frame.width,40)
        XCTAssertTrue(scene.backpackPresented)
        let openBadge=try XCTUnwrap(help.childNode(withName:"native-game-backpack-alert"))
        unread=[];scene.refreshBackpackAlert()
        XCTAssertNotNil(openBadge.parent)
        scene.setSuspended(false);scene.setBackpackPresented(false)
        try await Task.sleep(for:.milliseconds(550))
        XCTAssertTrue(help.texture === closed);XCTAssertFalse(scene.backpackPresented)
        XCTAssertNil(openBadge.parent);XCTAssertEqual(help.xScale,1,accuracy:0.001);XCTAssertEqual(help.alpha,1)
        XCTAssertEqual(help.size.width,originalSize.width,accuracy:0.001)
        XCTAssertEqual(help.size.height,originalSize.height,accuracy:0.001)
        XCTAssertEqual(help.position,originalPosition)
        XCTAssertNil(help.action(forKey:"backpack-icon-swap"))
    }
    func testHubAndWorldHeaderPreserveClosedArtworkAndRetireAlert() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root),host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        let hub=JimiV9HubView(frame:window.bounds,assets:assets);host.view.addSubview(hub);hub.layoutIfNeeded()
        let original=hub.backpackButton.image(for:.normal)
        hub.setBackpackUnread(true);hub.startIdle()
        XCTAssertFalse(hub.backpackAlert.isHidden);XCTAssertTrue(hub.backpackButton.image(for:.normal) === original)
        XCTAssertGreaterThan(hub.backpackAlert.frame.midX,hub.backpackButton.bounds.midX)
        XCTAssertNotNil(hub.backpackAlert.layer.animation(forKey:NativeBackpackAlertView.motionKey))
        hub.setBackpackUnread(false)
        XCTAssertNotNil(hub.backpackAlert.layer.animation(forKey:NativeBackpackAlertView.exitKey))
        XCTAssertNil(hub.backpackAlert.layer.animation(forKey:NativeBackpackAlertView.motionKey))
        try await Task.sleep(for:.milliseconds(250))
        XCTAssertTrue(hub.backpackAlert.isHidden)
        hub.setBackpackUnread(true)
        XCTAssertFalse(hub.backpackAlert.isHidden)
        XCTAssertEqual(hub.backpackAlert.layer.opacity,1)
        hub.stopIdle();XCTAssertNil(hub.backpackAlert.layer.animation(forKey:NativeBackpackAlertView.motionKey));hub.removeFromSuperview()
        let data:[String:Any]=["version":1,"worldID":1,"requestID":"1","routeGeneration":1,"stateRevision":1,"title":"Forest","contentHeight":1000,"mainFrame":["x":0,"y":100,"width":390,"height":300],"mainParts":[],"units":[["id":"board-2","boardID":2,"frame":["x":30,"y":400,"width":150,"height":200],"cardArt":"assets/colelctibles/Forest/common/02.png","locked":false,"interim":false,"newRibbon":false,"stars":0,"allowedActions":["openCard","play"],"stats":[],"parts":[["asset":"assets/colelctibles/Forest/common/02.png","role":"card","x":20,"y":10,"width":90,"height":133,"rotation":0,"opacity":1,"zIndex":2]]]]]
        let world=try XCTUnwrap(JimiNativeWorldView(snapshot:data,assets:assets))
        world.frame=window.bounds;host.view.addSubview(world);world.layoutIfNeeded();defer{world.cleanup()}
        let worldImage=world.backpackButton.image(for:.normal)
        world.setBackpackUnread(true)
        let prepared=expectation(description:"World prepared");world.prepare{prepared.fulfill()};await fulfillment(of:[prepared],timeout:5)
        let entered=expectation(description:"World entered");world.enter{entered.fulfill()};await fulfillment(of:[entered],timeout:5);world.finishPresentationAdmission()
        XCTAssertTrue(world.backpackButton.image(for:.normal) === worldImage);XCTAssertFalse(world.backpackAlert.isHidden)
        XCTAssertNotNil(world.backpackAlert.layer.animation(forKey:NativeBackpackAlertView.motionKey))
        world.park();XCTAssertNil(world.backpackAlert.layer.animation(forKey:NativeBackpackAlertView.motionKey))
    }

    func testMountedAlertKeepsBoundedTiltThroughBounceRestAndPause() async throws {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let left=NativeBackpackAlertView(),right=NativeBackpackAlertView()
        left.clockwise=false
        for (index,badge) in [left,right].enumerated() {
            badge.bounds=CGRect(x:0,y:0,width:48,height:46);badge.center=CGPoint(x:CGFloat(100+100*index),y:200)
            host.view.addSubview(badge);badge.setUnreadVisible(true);badge.setActive(true)
        }
        defer{left.setActive(false);right.setActive(false);window.isHidden=true}
        // Include the whole 2.4s cycle: its long resting tail used to be flat.
        for _ in 0..<28 {
            try await Task.sleep(for:.milliseconds(100))
            for (badge,direction) in [(left,CGFloat(-1)),(right,CGFloat(1))] {
                let painted=try XCTUnwrap(badge.layer.presentation()).transform
                let angle=atan2(painted.m12,painted.m11)*direction
                XCTAssertGreaterThanOrEqual(angle,5 * .pi/180-0.001)
                XCTAssertLessThanOrEqual(angle,10 * .pi/180+0.001)
            }
        }
        right.clockwise=false
        let changed=try XCTUnwrap(right.layer.animation(forKey:NativeBackpackAlertView.motionKey) as? CAKeyframeAnimation)
        XCTAssertTrue(try XCTUnwrap(changed.values as? [NSValue]).allSatisfy{atan2($0.caTransform3DValue.m12,$0.caTransform3DValue.m11)<0},"Reuse changes direction immediately")
        for badge in [left,right] {
            badge.setActive(false)
            XCTAssertNil(badge.layer.animation(forKey:NativeBackpackAlertView.motionKey))
            XCTAssertEqual(atan2(badge.layer.transform.m12,badge.layer.transform.m11),-.pi/18,accuracy:0.000001)
        }
    }

    func testUnreadGridCornersAndVisibilityLifecycle() throws {
        var progression=NativeProgressionState();progression.lastOpenedJourneyBoard=2
        progression.announceJourneyDie("bee",board:1);progression.announceJourneyDie("wild-star",board:2)
        let screen=NativeBackpackView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        let host=UIViewController(),window=UIWindow(frame:screen.bounds);window.rootViewController=host;window.makeKeyAndVisible();host.view.addSubview(screen)
        defer{screen.setAlertsActive(false);window.isHidden=true}
        screen.apply(NativeBackpackCatalog.sections(progression));screen.setAlertsActive(true);screen.layoutIfNeeded();screen.grid.layoutIfNeeded()
        func badge(_ index:Int)throws->NativeBackpackAlertView {
            let cell=try XCTUnwrap(screen.grid.cellForItem(at:IndexPath(item:index,section:0)))
            return try XCTUnwrap(cell.contentView.subviews.flatMap{[$0]+$0.subviews}.compactMap{$0 as? NativeBackpackAlertView}.first)
        }
        let image=UIGraphicsImageRenderer(bounds:screen.bounds).image{context in screen.layer.render(in:context.cgContext)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-alert-grid.png"))
        let left=try badge(0),right=try badge(1)
        XCTAssertFalse(left.isHidden);XCTAssertFalse(right.isHidden)
        XCTAssertLessThan(left.center.x,40);XCTAssertGreaterThan(right.center.x,100)
        XCTAssertNotNil(left.layer.animation(forKey:NativeBackpackAlertView.motionKey))
        XCTAssertGreaterThanOrEqual(left.cycleRotation,-10 * .pi/180);XCTAssertLessThanOrEqual(left.cycleRotation,-5 * .pi/180)
        XCTAssertGreaterThanOrEqual(right.cycleRotation,5 * .pi/180);XCTAssertLessThanOrEqual(right.cycleRotation,10 * .pi/180)
        for (badge,direction) in [(left,CGFloat(-1)),(right,CGFloat(1))] {
            let motion=try XCTUnwrap(badge.layer.animation(forKey:NativeBackpackAlertView.motionKey) as? CAKeyframeAnimation)
            for value in try XCTUnwrap(motion.values as? [NSValue]) {
                let pose=value.caTransform3DValue
                let angle=atan2(pose.m12,pose.m11)*direction
                XCTAssertGreaterThanOrEqual(angle,5 * .pi/180-0.000001)
                XCTAssertLessThanOrEqual(angle,10 * .pi/180+0.000001)
            }
            let rest=badge.layer.transform
            XCTAssertEqual(atan2(rest.m12,rest.m11),direction * .pi/18,accuracy:0.000001,"A stopped or paused badge keeps its tilt")
        }
        screen.setAlertsActive(false);XCTAssertNil(left.layer.animation(forKey:NativeBackpackAlertView.motionKey));XCTAssertNil(right.layer.animation(forKey:NativeBackpackAlertView.motionKey))
        screen.setAlertsActive(true);screen.markRead("bee")
        XCTAssertTrue(left.isHidden);XCTAssertNil(left.layer.animation(forKey:NativeBackpackAlertView.motionKey));XCTAssertFalse(right.isHidden)
        screen.isHidden=true;XCTAssertNil(right.layer.animation(forKey:NativeBackpackAlertView.motionKey))
        screen.isHidden=false;XCTAssertNotNil(right.layer.animation(forKey:NativeBackpackAlertView.motionKey))
        screen.removeFromSuperview();XCTAssertNil(right.layer.animation(forKey:NativeBackpackAlertView.motionKey))
    }
    func testMainBackpackOpeningDetailReadsOnlySelectedAlert() async throws {
        var progression=NativeProgressionState();progression.lastOpenedJourneyBoard=2
        progression.announceJourneyDie("bee",board:1);progression.announceJourneyDie("wild-star",board:2)
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw CancellationError()},markViewed:{_ in},makeGameplay:{_,_ in UIViewController()},flush:{})
        services.journeyProgression={progression};services.readJourneyDie={id in progression.readJourneyDie(id);return true}
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:services),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=app;window.makeKeyAndVisible();defer{app.dispose();window.isHidden=true}
        app.navigate(.hub,interrupt:true)
        try await waitForRetap{app.hub.scrollView.isUserInteractionEnabled};app.navigate(.backpack)
        try await waitForRetap{app.backpackView?.isUserInteractionEnabled==true}
        XCTAssertEqual(progression.unreadJourneyDice,["bee","wild-star"],"Opening collection does not mark details read")
        app.backpackView?.onDie?(NativeBackpackCatalog.forest[1])
        try await waitForRetap{!progression.unreadJourneyDice.contains("wild-star")}
        XCTAssertEqual(progression.unreadJourneyDice,["bee"])
        XCTAssertEqual(app.backpackView?.sections.first?.unread,["bee"])
    }
    func testGameplayBackpackDetailConsumesOnlySelectedAlert() async throws {
        var progression=NativeProgressionState();progression.lastOpenedJourneyBoard=2
        progression.announceJourneyDie("bee",board:1);progression.announceJourneyDie("wild-star",board:2)
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let controller=NativeGameplayBackpackController(root:NativeTestResources.root,sections:[NativeBackpackCatalog.sections(progression)[0]],includesArcade:false,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        controller.onReadDie={id in progression.readJourneyDie(id);return true}
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true}
        host.present(controller,animated:false)
        try await waitForRetap{controller.screen?.isUserInteractionEnabled==true && controller.view.isUserInteractionEnabled}
        XCTAssertEqual(progression.unreadJourneyDice,["bee","wild-star"])
        controller.screen?.onDie?(NativeBackpackCatalog.forest[1])
        try await waitForRetap{!progression.unreadJourneyDice.contains("wild-star")}
        XCTAssertEqual(progression.unreadJourneyDice,["bee"])
        XCTAssertEqual(controller.screen?.sections.first?.unread,["bee"])
        controller.setForeground(false)
        let badges=controller.screen?.grid.visibleCells.flatMap{$0.contentView.subviews.flatMap{[$0]+$0.subviews}.compactMap{$0 as? NativeBackpackAlertView}} ?? []
        XCTAssertTrue(badges.allSatisfy{$0.layer.animation(forKey:NativeBackpackAlertView.motionKey)==nil})
    }

    private func waitForRetap(_ condition:()->Bool) async throws {
        let deadline=Date().addingTimeInterval(8)
        while !condition(),Date()<deadline {try await Task.sleep(for:.milliseconds(10))}
        XCTAssertTrue(condition())
    }
    private func retapPoint(_ screen:NativeBackpackView,window:UIWindow) throws -> CGPoint {
        screen.layoutIfNeeded();screen.grid.layoutIfNeeded()
        let cell=try XCTUnwrap(screen.grid.cellForItem(at:IndexPath(item:1,section:0)))
        let layer=cell.layer.presentation() ?? cell.layer
        return layer.convert(CGPoint(x:layer.bounds.midX,y:layer.bounds.midY),to:window.layer.presentation() ?? window.layer)
    }
    func testMainBackpackLatePressReopensOnceAndBackgroundCancelsPendingSelection() async throws {
        var progression=NativeProgressionState();progression.lastOpenedJourneyBoard=2
        progression.announceJourneyDie("wild-star",board:2)
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw CancellationError()},markViewed:{_ in},makeGameplay:{_,_ in UIViewController()},flush:{})
        services.journeyProgression={progression}
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=app;window.makeKeyAndVisible()
        defer{app.dispose();window.isHidden=true}
        app.navigate(.hub,interrupt:true)
        try await waitForRetap{app.hub.scrollView.isUserInteractionEnabled};app.navigate(.backpack)
        try await waitForRetap{app.backpackView?.isUserInteractionEnabled==true}
        let screen=try XCTUnwrap(app.backpackView)
        let star=try XCTUnwrap(screen.revealedDie(atWindowPoint:retapPoint(screen,window:window)))
        screen.onDie?(star)
        let old=try XCTUnwrap(app.presentedViewController as? NativeBackpackDetail)
        try await waitForRetap{old.card.isUserInteractionEnabled}
        old.closeTapped()
        XCTAssertEqual(old.exitSelectionPress?.minimumPressDuration,0,"Capture contact before dismissal can swallow touch-up")
        try await Task.sleep(for:.milliseconds(480))
        let point=try retapPoint(screen,window:window)
        old.captureExitSelection(atWindowPoint:point);old.captureExitSelection(atWindowPoint:point)
        XCTAssertTrue(app.presentedViewController === old,"Exit keeps ownership until dismissal")
        try await waitForRetap{(app.presentedViewController as? NativeBackpackDetail).map{$0 !== old} ?? false}
        let next=try XCTUnwrap(app.presentedViewController as? NativeBackpackDetail)
        XCTAssertEqual(next.die.id,star.id);XCTAssertNil(old.preview);XCTAssertNil(old.exitSelectionPress)
        try await waitForRetap{next.card.isUserInteractionEnabled}
        next.closeTapped();try await Task.sleep(for:.milliseconds(480))
        next.captureExitSelection(atWindowPoint:point)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await waitForRetap{app.presentedViewController==nil}
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertNil(app.presentedViewController,"Background cancels queued intent")
    }
    func testGameplayBackpackReturnTailAcceptsOnePressBeforeEnterFinishes() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let controller=NativeGameplayBackpackController(root:NativeTestResources.root,sections:[NativeBackpackCatalog.Section(title:"Forest",dice:NativeBackpackCatalog.forest,unlocked:["wild-star"])],includesArcade:false,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{controller.dispose();host.dismiss(animated:false);window.isHidden=true}
        host.present(controller,animated:false)
        try await waitForRetap{controller.view.isUserInteractionEnabled}
        let screen=try XCTUnwrap(controller.screen),star=NativeBackpackCatalog.forest[1]
        screen.onDie?(star)
        let old=try XCTUnwrap(controller.detail)
        try await waitForRetap{old.card.isUserInteractionEnabled}
        old.closeTapped()
        try await waitForRetap{controller.detail==nil}
        if !UIAccessibility.isReduceMotionEnabled {
            XCTAssertTrue(controller.returnSelectionPress?.isEnabled==true)
            XCTAssertTrue(controller.view.isUserInteractionEnabled)
            XCTAssertFalse(controller.card.isUserInteractionEnabled,"Only selection capture opens before full admission")
            let point=try retapPoint(screen,window:window)
            XCTAssertEqual(screen.revealedDie(atWindowPoint:point)?.id,star.id)
            controller.captureReturnSelection(atWindowPoint:point);controller.captureReturnSelection(atWindowPoint:point)
            XCTAssertNil(controller.detail)
            try await waitForRetap{controller.detail != nil}
            XCTAssertEqual(controller.detail?.die.id,star.id)
            XCTAssertFalse(controller.returnSelectionPress?.isEnabled ?? true)
        }
        controller.dispose();controller.captureReturnSelection(atWindowPoint:.zero)
        XCTAssertNil(controller.detail);XCTAssertNil(controller.returnSelectionPress)
    }

    func testGameplayBackpackDragReturnsSuspendsAndDismisses() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let controller=NativeGameplayBackpackController(root:NativeTestResources.root,sections:[NativeBackpackCatalog.sections(NativeProgressionState())[0]],includesArcade:false,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{controller.dispose();host.dismiss(animated:false);window.isHidden=true}
        var closed=0;controller.onClosed={closed += 1}
        host.present(controller,animated:false)
        let deadline=Date().addingTimeInterval(5)
        while !controller.view.isUserInteractionEnabled,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(controller.view.isUserInteractionEnabled)
        let drag=try XCTUnwrap(controller.modalDrag)
        XCTAssertTrue(drag.pan.view === controller.card)
        drag.begin();drag.move(CGPoint(x:0,y:60))
        XCTAssertGreaterThan(controller.card.layer.transform.m42,0)
        drag.finish(CGPoint(x:0,y:60),cancelled:false)
        XCTAssertEqual(closed,0)
        XCTAssertTrue(CATransform3DEqualToTransform(controller.card.layer.transform,CATransform3DIdentity))
        try await Task.sleep(for:.milliseconds(350))
        drag.begin();drag.move(CGPoint(x:0,y:120));controller.setForeground(false)
        XCTAssertTrue(CATransform3DEqualToTransform(controller.card.layer.transform,CATransform3DIdentity))
        drag.finish(CGPoint(x:0,y:120),cancelled:false);XCTAssertEqual(closed,0)
        controller.setForeground(true)
        drag.begin();drag.move(CGPoint(x:0,y:120));drag.finish(CGPoint(x:0,y:120),cancelled:false)
        XCTAssertFalse(controller.view.isUserInteractionEnabled)
        let closeDeadline=Date().addingTimeInterval(5)
        while closed==0,Date()<closeDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(closed,1);XCTAssertNil(host.presentedViewController)
        XCTAssertNil(controller.modalDrag);XCTAssertNil(drag.pan.view)
        drag.begin();drag.finish(CGPoint(x:0,y:120),cancelled:false);XCTAssertEqual(closed,1)
    }

    func testGameplayBackpackDetailExitsAndReturnsWithoutStackingBackdrop() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let controller=NativeGameplayBackpackController(root:NativeTestResources.root,sections:[NativeBackpackCatalog.sections(NativeProgressionState())[0]],includesArcade:false,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{controller.dispose();host.dismiss(animated:false);window.isHidden=true}
        host.present(controller,animated:false)
        let enterDeadline=Date().addingTimeInterval(5)
        while !controller.view.isUserInteractionEnabled,Date()<enterDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(controller.view.isUserInteractionEnabled)
        let collectionIdle=try XCTUnwrap(controller.heading.superview)
        if !UIAccessibility.isReduceMotionEnabled {
            let animation=try XCTUnwrap(collectionIdle.layer.animation(forKey:"backpack.collection.idle") as? CAKeyframeAnimation)
            XCTAssertEqual(animation.duration,6.8)
            XCTAssertEqual(animation.keyTimes,[0,0.18,0.38,0.58,0.76,0.84,0.89,0.94,1])
        }
        XCTAssertEqual(JimiNativeModalV10.backdropColor.cgColor.alpha,0.5,accuracy:0.00001)
        controller.screen?.onDie?(NativeBackpackCatalog.forest.first{$0.id=="bee"}!)
        XCTAssertTrue(controller.switchingDetail)
        XCTAssertNil(collectionIdle.layer.animation(forKey:"backpack.collection.idle"),"Hidden collection must retire idle during detail exchange")
        XCTAssertFalse(controller.view.isUserInteractionEnabled)
        let detail=try XCTUnwrap(controller.detail)
        XCTAssertTrue(detail.usesParentBackdrop)
        XCTAssertNil(detail.worldIllustration.image,"Gameplay detail must not add an island behind the modal")
        XCTAssertNil(detail.worldIllustrationPath)
        XCTAssertNil(detail.worldIllustration.superview)
        let parentTint=try XCTUnwrap(controller.view.subviews.first{$0.accessibilityIdentifier=="native.gameplay.backpack.backdrop"})
        let detailTint=try XCTUnwrap(detail.view.subviews.first{$0.accessibilityIdentifier=="native.backpack.detail.backdrop"})
        XCTAssertEqual(detailTint.backgroundColor,.clear,"Selected detail must not stack a second tint")
        XCTAssertEqual(parentTint.backgroundColor?.cgColor.alpha ?? 0,0.5,accuracy:0.00001)

        if !UIAccessibility.isReduceMotionEnabled {
            XCTAssertNil(controller.presentedViewController,"Detail waits for 30 percent of collection exit")
            XCTAssertNotNil(controller.card.layer.animation(forKey:"gameplay.backpack.detail.exit"))
            XCTAssertNil(detail.card.layer.animation(forKey:"backpack.detail.enter"))
            let outgoingExchange=try XCTUnwrap(controller.view.layer.sublayers?.compactMap{$0.animation(forKey:"backpack.exchange")}.first)
            XCTAssertEqual(outgoingExchange.duration,0.195,accuracy:0.0001)
            // Pause synchronously while the exchange is certainly pending;
            // a busy Simulator can overshoot an awaited pre-pause wall delay.
            controller.setForeground(false)
            try await Task.sleep(for:.milliseconds(450))
            XCTAssertNil(controller.presentedViewController,"Pending exchange pauses with the modal clock")
            controller.setForeground(true)
        }
        let deadline=Date().addingTimeInterval(8)
        var enterSamples:[CGFloat]=[]
        while !detail.card.isUserInteractionEnabled,Date()<deadline {
            if controller.presentedViewController === detail,let painted=detail.card.layer.presentation() {
                enterSamples.append(painted.transform.m42)
                print("[BACKPACK_ENTER] y=\(painted.transform.m42) alpha=\(painted.opacity) animation=\(detail.card.layer.animation(forKey:"backpack.detail.enter") != nil)")
            }
            try await Task.sleep(for:.milliseconds(16))
        }
        if !UIAccessibility.isReduceMotionEnabled {
            XCTAssertGreaterThan(enterSamples.count,10)
            XCTAssertTrue(enterSamples.contains{$0>35},"First visible frames must retain the authored incoming displacement")
            XCTAssertTrue(enterSamples.contains{abs($0)<5},"Incoming paper must visibly settle")
        }
        XCTAssertTrue(controller.presentedViewController === detail)
        XCTAssertTrue(CATransform3DEqualToTransform(controller.card.layer.transform,JimiNativeModalV10.exitTransform(progress:1,flip:false)))
        XCTAssertTrue(detail.card.isUserInteractionEnabled)
        let image=UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/modal-backpack-detail.png"))
        controller.setForeground(false);XCTAssertEqual(controller.view.layer.speed,0)
        controller.setForeground(true)
        detail.closeTapped()
        if !UIAccessibility.isReduceMotionEnabled {
            XCTAssertNil(controller.card.layer.animation(forKey:"gameplay.backpack.return"),"Collection waits for 40 percent of detail exit")
            let exchange=try XCTUnwrap(controller.view.layer.sublayers?.compactMap{$0.animation(forKey:"backpack.exchange")}.first)
            XCTAssertEqual(exchange.duration,0.26,accuracy:0.0001)
            try await Task.sleep(for:.milliseconds(180))
            XCTAssertNil(controller.card.layer.animation(forKey:"gameplay.backpack.return"))
            try await Task.sleep(for:.milliseconds(230))
            XCTAssertNotNil(controller.card.layer.animation(forKey:"gameplay.backpack.return"))
            XCTAssertNotNil(detail.card.layer.animation(forKey:"backpack.detail.exit"))
        }
        XCTAssertFalse(controller.view.isUserInteractionEnabled,"Overlapping modals must not admit another selection")
        let returnDeadline=Date().addingTimeInterval(5)
        while controller.screen?.isUserInteractionEnabled != true,Date()<returnDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertNil(controller.detail);XCTAssertNil(controller.presentedViewController)
        XCTAssertNil(detail.worldIllustration.superview,"Selected scenery must retire with its detail owner")
        XCTAssertFalse(controller.switchingDetail)
        if !UIAccessibility.isReduceMotionEnabled {XCTAssertNotNil(collectionIdle.layer.animation(forKey:"backpack.collection.idle"))}
        XCTAssertEqual(controller.card.alpha,1)
        XCTAssertTrue(CATransform3DEqualToTransform(controller.card.layer.transform,CATransform3DIdentity))
        XCTAssertTrue(controller.screen?.isUserInteractionEnabled == true)
        // Retiring during the next exit must not publish a late detail.
        controller.screen?.onDie?(NativeBackpackCatalog.forest.first{$0.id=="bee"}!)
        controller.dispose();controller.dispose()
        XCTAssertNil(collectionIdle.layer.animation(forKey:"backpack.collection.idle"))
        try await Task.sleep(for:.milliseconds(850))
        XCTAssertNil(controller.detail);XCTAssertNil(controller.presentedViewController)
    }

    func testModalFirstRowAlertsKeepEveryAnimatedPoseOutsideUnclippedGrid() throws {
        var progression=NativeProgressionState()
        progression.announceJourneyDie("bee",board:1);progression.announceJourneyDie("wild-star",board:2)
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let screen=NativeBackpackView(frame:CGRect(x:24,y:180,width:342,height:470),assets:assets)
        screen.useModalLayout();screen.apply([NativeBackpackCatalog.sections(progression)[0]])
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();host.view.addSubview(screen)
        defer{screen.setAlertsActive(false);window.isHidden=true}
        screen.layoutIfNeeded();screen.grid.layoutIfNeeded();screen.setAlertsActive(true)
        XCTAssertFalse(screen.grid.isScrollEnabled);XCTAssertFalse(screen.grid.bounces)
        XCTAssertFalse(screen.grid.clipsToBounds,"Modal decoration must paint beyond the collection viewport")
        var posed:[(NativeBackpackAlertView,CATransform3D)]=[]
        for item in 0...1 {
            let cell=try XCTUnwrap(screen.grid.cellForItem(at:IndexPath(item:item,section:0)))
            cell.layoutIfNeeded()
            let alert=try XCTUnwrap(cell.contentView.subviews.flatMap{[$0]+$0.subviews}.compactMap{$0 as? NativeBackpackAlertView}.first)
            XCTAssertFalse(alert.isHidden)
            let scale=cell.contentView.bounds.width/153
            XCTAssertEqual(alert.bounds.width,63.8*scale,accuracy:0.001)
            XCTAssertEqual(alert.bounds.height,63.8*scale,accuracy:0.001)
            XCTAssertEqual(alert.center.x,item==0 ? 14*scale:cell.contentView.bounds.width-14*scale,accuracy:0.001)
            XCTAssertEqual(alert.center.y,14*scale,accuracy:0.001)
            let motion=try XCTUnwrap(alert.layer.animation(forKey:NativeBackpackAlertView.motionKey) as? CAKeyframeAnimation)
            let values=try XCTUnwrap(motion.values as? [NSValue]);XCTAssertEqual(values.count,7)
            let bounds=alert.bounds,center=alert.center,cellFrame=cell.frame
            alert.setActive(false)
            var extendsAboveViewport=false
            for value in values {
                alert.layer.transform=value.caTransform3DValue
                let painted=alert.convert(alert.bounds,to:screen.grid)
                extendsAboveViewport = extendsAboveViewport || painted.minY<screen.grid.bounds.minY
                var ancestor=alert.superview
                while let current=ancestor {
                    if current.clipsToBounds || current.layer.masksToBounds {
                        XCTAssertTrue(current.bounds.contains(alert.convert(alert.bounds,to:current)),"Clipping ancestor \(type(of:current)) cuts off first-row alert \(item)")
                    }
                    ancestor=current.superview
                }
                XCTAssertEqual(alert.bounds,bounds);XCTAssertEqual(alert.center,center);XCTAssertEqual(cell.frame,cellFrame)
            }
            XCTAssertTrue(extendsAboveViewport,"Exercise an alert pose beyond the actual viewport")
            posed.append((alert,values[2].caTransform3DValue))
        }
        for (alert,transform) in posed {alert.layer.transform=transform}
        let image=UIGraphicsImageRenderer(bounds:host.view.bounds).image{context in host.view.layer.render(in:context.cgContext)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-alert-unclipped.png"))
        let main=NativeBackpackView(frame:window.bounds,assets:assets)
        XCTAssertTrue(main.grid.isScrollEnabled)
        XCTAssertTrue(main.grid.clipsToBounds,"Main scrolling collection retains viewport clipping")
    }

    func testGameplayBackpackModalFitsWithPaddingAndScopedTitle() throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
        for section in NativeBackpackCatalog.sections(NativeProgressionState()) {
            let controller=NativeGameplayBackpackController(root:NativeTestResources.root,sections:[section],includesArcade:false,motion:motion)
            controller.loadViewIfNeeded();controller.view.frame=CGRect(x:0,y:0,width:390,height:844);controller.view.layoutIfNeeded()
            XCTAssertEqual(controller.modalPresentationStyle,.overFullScreen)
            XCTAssertEqual(controller.heading.text,"Backpack")
            XCTAssertTrue(controller.subtitle.text?.hasPrefix("\(section.title) backpack items\n") == true)
            let attributed=try XCTUnwrap(controller.subtitle.attributedText)
            let paragraph=try XCTUnwrap(attributed.attribute(.paragraphStyle,at:0,effectiveRange:nil) as? NSParagraphStyle)
            XCTAssertEqual(paragraph.minimumLineHeight,26,section.title)
            XCTAssertEqual(paragraph.maximumLineHeight,26,section.title)
            XCTAssertEqual(paragraph.paragraphSpacing,0,section.title)
            XCTAssertLessThanOrEqual(controller.subtitle.bounds.height,78,section.title)
            XCTAssertEqual(controller.card.bounds.width,342)
            XCTAssertGreaterThanOrEqual(controller.card.frame.minX,24)
            XCTAssertLessThanOrEqual(controller.card.frame.maxX,366)
            let screen=try XCTUnwrap(controller.screen);screen.layoutIfNeeded();screen.grid.layoutIfNeeded()
            XCTAssertTrue(screen.header.isHidden)
            XCTAssertEqual(screen.numberOfSections(in:screen.grid),1)
            XCTAssertEqual(screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,referenceSizeForHeaderInSection:0).height,0)
            XCTAssertFalse(screen.grid.isScrollEnabled)
            XCTAssertFalse(screen.grid.bounces)
            XCTAssertLessThanOrEqual(screen.grid.collectionViewLayout.collectionViewContentSize.height+screen.grid.contentInset.top+screen.grid.contentInset.bottom,screen.grid.bounds.height)
            for item in section.dice.indices {
                let attributes=try XCTUnwrap(screen.grid.layoutAttributesForItem(at:IndexPath(item:item,section:0)))
                XCTAssertLessThanOrEqual(attributes.frame.maxY+screen.grid.contentInset.top,screen.grid.bounds.height-screen.grid.contentInset.bottom)
            }
            controller.setForeground(false);XCTAssertEqual(controller.view.layer.speed,0)
            controller.setForeground(true);XCTAssertEqual(controller.view.layer.speed,1)
            if section.title=="Forest" {
                controller.card.alpha=1
                let renderer=UIGraphicsImageRenderer(bounds:controller.view.bounds)
                let image=renderer.image{context in controller.view.layer.render(in:context.cgContext)}
                try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/gameplay-forest-backpack-modal.png"))
            }
            controller.dispose();controller.dispose();XCTAssertNil(screen.onDie)
        }
    }
    func testGameplayWorldScopesExcludeArcadeAndKeepWorldColumns() {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        for section in NativeBackpackCatalog.sections(NativeProgressionState()) {
            let screen=NativeBackpackView(frame:CGRect(x:0,y:0,width:390,height:844),assets:assets)
            screen.apply([section],includesArcade:false)
            XCTAssertEqual(screen.numberOfSections(in:screen.grid),1)
            XCTAssertEqual(screen.collectionView(screen.grid,numberOfItemsInSection:0),section.dice.count)
            XCTAssertEqual(screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,sizeForItemAt:IndexPath(item:0,section:0)).width,153)
            screen.apply(NativeBackpackCatalog.sections(NativeProgressionState()))
            XCTAssertEqual(screen.numberOfSections(in:screen.grid),3)
            XCTAssertEqual(screen.collectionView(screen.grid,numberOfItemsInSection:0),6)
        }
    }
    func testReorderedFirstUnitsMatchBackpackUnlocks() {
        for (board,title,first,second) in [(1,"Forest","bee","wild-star"),(11,"Beach","wild-juice","fish"),(21,"Area 55","robo-cube","kanta")] {
            var progress=NativeProgressionState()
            progress.beginAttempt(mode:.journey,board:board)
            let section=NativeBackpackCatalog.sections(progress).first{$0.title==title}!
            XCTAssertEqual(Array(section.dice.prefix(2).map(\.id)),[first,second])
            XCTAssertEqual(section.dice[0].board,board)
            XCTAssertEqual(section.dice[1].board,board+1)
            XCTAssertTrue(section.unlocked.isEmpty)
            XCTAssertTrue(progress.announceJourneyDie(first,board:board))
            progress.finishAttempt(mode:.journey,board:board,score:100,longestCombo:1,cubesCracked:2,clean:true)
            let next=NativeBackpackCatalog.sections(progress).first{$0.title==title}!
            XCTAssertTrue(next.unlocked.contains(first));XCTAssertFalse(next.unlocked.contains(second))
            XCTAssertTrue(progress.announceJourneyDie(second,board:board+1))
            XCTAssertTrue(NativeBackpackCatalog.sections(progress).first{$0.title==title}!.unlocked.contains(second))
        }
    }
    func testCatalogUsesCanonicalProgressAndExactWorldTotals() {
        XCTAssertEqual(NativeBackpackCatalog.arcade.map(\.id),["cubero","baloon","tnt","wild-magnet"])
        XCTAssertEqual(NativeBackpackCatalog.beach.first{$0.id=="wild-juice"}?.title,"JUICE")
        var progress=NativeProgressionState()
        var sections=NativeBackpackCatalog.sections(progress)
        XCTAssertEqual(sections.map{ $0.dice.count },[6,4,4]);XCTAssertEqual(sections.map(\.count),[0,0,0])
        progress.highestUnlockedJourneyBoard=7
        sections=NativeBackpackCatalog.sections(progress);XCTAssertEqual(sections.map(\.count),[0,0,0])
        progress.highestUnlockedJourneyBoard=24
        XCTAssertEqual(NativeBackpackCatalog.sections(progress).map(\.count),[0,0,0])
        progress.completedJourneyBoards=Set(1...23)
        XCTAssertEqual(NativeBackpackCatalog.sections(progress).map(\.count),[0,0,0])
        for die in NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach {progress.announceJourneyDie(die.id,board:die.board)}
        XCTAssertEqual(NativeBackpackCatalog.sections(progress).map(\.count),[6,4,4])
        XCTAssertEqual(progress.completedJourneyBoards,Set(1...23));XCTAssertTrue(progress.unlockedSpecialDice.isEmpty)
        var legacy=NativeProgressionState();legacy.unlockedSpecialDice=["flower","juice"]
        XCTAssertEqual(NativeBackpackCatalog.sections(legacy).map(\.count),[0,0,0])
    }
    func testGridStartsWithForestAndTwoWorldColumnsAndLockedTapIsInert() throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let screen=NativeBackpackView(frame:CGRect(x:0,y:0,width:390,height:844),assets:assets)
        var progress=NativeProgressionState();progress.lastOpenedJourneyBoard=1
        progress.announceJourneyDie("bee",board:1)
        screen.apply(NativeBackpackCatalog.sections(progress));screen.layoutIfNeeded()
        XCTAssertEqual(screen.grid.frame,screen.bounds)
        XCTAssertEqual(screen.grid.contentOffset.y,-screen.header.bounds.height,accuracy:0.5)
        XCTAssertEqual(screen.header.backgroundColor?.cgColor.alpha ?? 0,0.8,accuracy:0.0001)
        XCTAssertFalse(screen.header.isOpaque)
        screen.grid.layoutIfNeeded()
        let first=try XCTUnwrap(screen.grid.layoutAttributesForItem(at:IndexPath(item:0,section:0)))
        let initial=screen.grid.convert(first.frame,to:screen)
        XCTAssertGreaterThan(initial.minY,screen.header.frame.maxY)
        screen.grid.setContentOffset(CGPoint(x:0,y:first.frame.midY-screen.header.frame.midY),animated:false)
        let underHeader=screen.grid.convert(first.frame,to:screen)
        XCTAssertTrue(underHeader.intersects(screen.header.frame),"Scrolled items remain visible beneath the translucent Journey-style header")
        let underlap=UIGraphicsImageRenderer(bounds:screen.bounds).image{screen.layer.render(in:$0.cgContext)}
        try underlap.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-header-underlap.png"))
        screen.apply(NativeBackpackCatalog.sections(progress));screen.grid.layoutIfNeeded()
        XCTAssertEqual(screen.grid.contentOffset.y,-screen.header.bounds.height,accuracy:0.5)
        XCTAssertEqual(screen.numberOfSections(in:screen.grid),3)
        XCTAssertEqual(screen.collectionView(screen.grid,numberOfItemsInSection:0),6)
        let world=screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,sizeForItemAt:IndexPath(item:0,section:0))
        XCTAssertEqual(world.width,153)
        var opened:[String]=[];screen.onDie={opened.append($0.id)}
        screen.collectionView(screen.grid,didSelectItemAt:IndexPath(item:1,section:0));XCTAssertTrue(opened.isEmpty)
        screen.collectionView(screen.grid,didSelectItemAt:IndexPath(item:0,section:0));XCTAssertEqual(opened,["bee"])
    }
    func testSelectedDieFeedbackUsesWholeCardAndReuseRetiresIt() throws {
        let screen=NativeBackpackView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        var progress=NativeProgressionState();progress.lastOpenedJourneyBoard=1
        progress.announceJourneyDie("bee",board:1)
        screen.apply(NativeBackpackCatalog.sections(progress));screen.grid.layoutIfNeeded()
        let index=IndexPath(item:0,section:0)
        let cell=try XCTUnwrap(screen.grid.cellForItem(at:index))
        var selected=false
        screen.onDie={_ in selected=true}
        screen.collectionView(screen.grid,didSelectItemAt:index)
        XCTAssertTrue(selected)
        let artwork=try XCTUnwrap(cell.contentView.subviews.flatMap{[$0]+$0.subviews}.last)
        XCTAssertNotNil(cell.contentView.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
        XCTAssertNil(artwork.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
        XCTAssertNil(cell.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
        cell.prepareForReuse()
        XCTAssertNil(cell.contentView.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
        XCTAssertNil(artwork.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
    }
    func testBackpackWaitsForHubExitAndReturnsAfterOwnExit() async throws {
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw CancellationError()},markViewed:{_ in},makeGameplay:{_,_ in UIViewController()},flush:{})
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=app;window.makeKeyAndVisible()
        defer{app.dispose();window.isHidden=true}
        try await Task.sleep(for:.seconds(1));app.navigate(.hub)
        try await Task.sleep(for:.seconds(1.6));XCTAssertEqual(app.route,.hub)
        app.hub.backpackButton.sendActions(for:.touchUpInside)
        XCTAssertEqual(app.route,.hub);XCTAssertNil(app.backpackView)
        XCTAssertNotNil(app.hub.backpackButton.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.switchKey))
        let entryDeadline=Date().addingTimeInterval(6)
        while app.backpackView?.isUserInteractionEnabled != true,Date()<entryDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(app.route,.backpack);XCTAssertTrue(app.backpackView?.isUserInteractionEnabled == true)
        let exitTracks=try XCTUnwrap(app.backpackView).tracks(enter:false)
        XCTAssertGreaterThan(exitTracks.count,1)
        for (_,track) in exitTracks {
            XCTAssertEqual(track.tweens.first?.begin,0,"Every visible Backpack part exits immediately on X")
            XCTAssertEqual(track.duration,UIAccessibility.isReduceMotionEnabled ? 0.16:0.40,accuracy:0.001)
        }
        app.backpackView?.close.sendActions(for:.touchUpInside);XCTAssertEqual(app.route,.backpack)
        XCTAssertNotNil(app.backpackView?.close.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
        let returnDeadline=Date().addingTimeInterval(6)
        while (app.route != .hub || !app.hub.isUserInteractionEnabled),Date()<returnDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(app.route,.hub);XCTAssertTrue(app.backpackView?.isHidden == true)
        app.navigate(.backpack);app.navigate(.settings,interrupt:true)
        try await Task.sleep(for:.seconds(1.8));XCTAssertEqual(app.route,.settings);XCTAssertTrue(app.backpackView?.isHidden == true)
        app.settingsView.back.sendActions(for:.touchUpInside)
        XCTAssertNotNil(app.settingsView.back.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
    }
    func testMainBackpackDetailHasNoBottomHUDOrFooterAnimation() async throws {
        for die in [NativeBackpackCatalog.forest.first{$0.id=="bee"}!,NativeBackpackCatalog.beach[1],NativeBackpackCatalog.area[1]] {
            let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
            let detail=NativeBackpackDetail(die:die,assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
            let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            window.rootViewController=host;window.makeKeyAndVisible();host.present(detail,animated:false)
            let deadline=Date().addingTimeInterval(8)
            while !detail.card.isUserInteractionEnabled,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(detail.card.isUserInteractionEnabled)
            XCTAssertNil(detail.worldIllustrationPath);XCTAssertNil(detail.worldIllustration.image)
            XCTAssertNil(detail.worldIllustration.superview)
            let tint=try XCTUnwrap(detail.view.subviews.first{$0.accessibilityIdentifier=="native.backpack.detail.backdrop"})
            XCTAssertEqual(tint.backgroundColor?.cgColor.alpha ?? 0,0.5,accuracy:0.00001)
            for width:CGFloat in [390,320] {
                window.frame.size.width=width;detail.view.frame=window.bounds;detail.view.setNeedsLayout();detail.view.layoutIfNeeded()
                XCTAssertNil(detail.worldIllustration.superview);XCTAssertNil(detail.worldIllustration.image)
            }
            detail.closeTapped()
            XCTAssertNil(detail.worldIllustration.layer.animationKeys())
            XCTAssertEqual(detail.worldIllustration.alpha,1)
            detail.dispose();host.dismiss(animated:false);window.isHidden=true
        }
    }
    func testSelectedDetailOwnsAnimationAndClosesOnce() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let detail=NativeBackpackDetail(die:NativeBackpackCatalog.forest.first{$0.id=="bee"}!,assets:assets,motion:motion)
        var closed=0,opened=0;detail.onClose={closed += 1};detail.onPresentationStarted={opened += 1}
        defer{detail.dispose();window.isHidden=true}
        host.present(detail,animated:false)
        let deadline=Date().addingTimeInterval(5)
        while !detail.card.isUserInteractionEnabled,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(detail.card.isUserInteractionEnabled);XCTAssertEqual(opened,1)
        let paperIdle=try XCTUnwrap(detail.hero.superview)
        if !UIAccessibility.isReduceMotionEnabled {
            let animation=try XCTUnwrap(paperIdle.layer.animation(forKey:"backpack.detail.idle") as? CAKeyframeAnimation)
            XCTAssertEqual(animation.duration,6.8)
            XCTAssertEqual(animation.values?.count,9)
        }
        if !UIAccessibility.isReduceMotionEnabled {XCTAssertTrue(detail.preview?.isPlaying==true)}
        detail.setForeground(false);XCTAssertFalse(detail.preview?.isPlaying==true);detail.setForeground(true)
        if !UIAccessibility.isReduceMotionEnabled {XCTAssertTrue(detail.preview?.isPlaying==true)}
        let pan=try XCTUnwrap(detail.card.gestureRecognizers?.compactMap{$0 as? UIPanGestureRecognizer}.first)
        let drag=try XCTUnwrap(pan.delegate as? JimiNativeModalDrag)
        drag.begin();drag.move(CGPoint(x:0,y:60));drag.finish(CGPoint(x:0,y:60),cancelled:false)
        XCTAssertEqual(closed,0);XCTAssertTrue(detail.card.isUserInteractionEnabled)
        drag.begin();drag.move(CGPoint(x:0,y:120));detail.setForeground(false)
        XCTAssertTrue(CATransform3DEqualToTransform(detail.card.layer.transform,CATransform3DIdentity))
        detail.setForeground(true);XCTAssertEqual(opened,1)
        drag.begin();drag.move(CGPoint(x:0,y:120));drag.finish(CGPoint(x:0,y:120),cancelled:false)
        detail.closeTapped()
        let closedDeadline=Date().addingTimeInterval(5)
        while closed==0,Date()<closedDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(closed,1);XCTAssertNil(detail.hero.image);XCTAssertNil(host.presentedViewController)
        XCTAssertNil(paperIdle.layer.animation(forKey:"backpack.detail.idle"))
    }
    func testCuberoBoardPreviewRunsFromFirstVisibleFrameAndResumes() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let detail=NativeBackpackDetail(die:try XCTUnwrap(NativeBackpackCatalog.arcade.first{$0.id=="cubero"}),assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{detail.dispose();host.dismiss(animated:false);window.isHidden=true}
        host.present(detail,animated:false)
        let deadline=Date().addingTimeInterval(10)
        while detail.preview?.ready != true,Date()<deadline {
            XCTAssertEqual(detail.card.alpha,0,"No static PNG may appear before selected animation is ready")
            try await Task.sleep(for:.milliseconds(20))
        }
        let preview=try XCTUnwrap(detail.preview);XCTAssertTrue(preview.ready);XCTAssertTrue(detail.hero.isHidden)
        XCTAssertTrue(preview.dieNode?.resourcePaths.contains(NativeCuberoIdleMotion.collectionSourcePath)==true)
        XCTAssertFalse(preview.dieNode?.resourcePaths.contains(NativeCuberoIdleMotion.sourcePath)==true)
        XCTAssertNotNil(preview.dieNode);XCTAssertTrue(preview.isPlaying || UIAccessibility.isReduceMotionEnabled)
        try await Task.sleep(for:.milliseconds(200))
        let elapsed=preview.dieNode?.authoredArtworkReceipt.elapsed ?? 0
        if !UIAccessibility.isReduceMotionEnabled {XCTAssertGreaterThan(elapsed,0)}
        detail.setForeground(false);XCTAssertFalse(preview.isPlaying)
        detail.setForeground(true);XCTAssertTrue(preview.isPlaying || UIAccessibility.isReduceMotionEnabled)
        detail.dispose();XCTAssertNil(preview.dieNode);XCTAssertFalse(preview.isPlaying)
    }
    func testCuberoAndBarrelRenderedBodiesShareSubtitleAndBottomSpacing() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        for die in [try XCTUnwrap(NativeBackpackCatalog.arcade.first{$0.id=="cubero"}),NativeBackpackCatalog.forest[5]] {
            let detail=NativeBackpackDetail(die:die,assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
            host.addChild(detail);detail.view.frame=window.bounds;host.view.addSubview(detail.view);detail.didMove(toParent:host)
            detail.view.layoutIfNeeded()
            let deadline=Date().addingTimeInterval(10)
            while detail.preview?.ready != true,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            let preview=try XCTUnwrap(detail.preview),node=try XCTUnwrap(preview.dieNode)
            detail.view.setNeedsLayout();detail.view.layoutIfNeeded();preview.setActive(true);preview.isPaused=true
            let scene=try XCTUnwrap(preview.scene)
            let texture=try XCTUnwrap(preview.texture(from:scene,crop:CGRect(origin:.zero,size:scene.size)))
            try UIImage(cgImage:texture.cgImage()).pngData()?.write(to:URL(fileURLWithPath:"/tmp/cubero-layout-\(die.id).png"))
            let subtitle=try XCTUnwrap(detail.hero.superview?.subviews.compactMap{$0 as? UILabel}.first{$0.numberOfLines==0})
            var report:[String:Any]=["die":die.id,"card":String(describing:detail.card.bounds),"subtitle":String(describing:subtitle.frame),"slot":String(describing:preview.artworkFrame ?? .zero),"body":String(describing:node.collectionBodyBounds),"nodePosition":NSCoder.string(for:node.position),"nodeScale":node.yScale,"previewHidden":preview.isHidden,"previewAlpha":preview.alpha,"elapsed":node.authoredArtworkReceipt.elapsed,"frame":node.authoredArtworkReceipt.frame]
            var sprites:[[String:String]]=[]
            for child in node.childNode(withName:"die-visual")?.children ?? [] {
                guard let sprite=child as? SKSpriteNode else{continue}
                var row:[String:String]=[:]
                row["size"]=String(describing:sprite.size);row["frame"]=String(describing:sprite.frame)
                row["xScale"]=String(Double(sprite.xScale));row["yScale"]=String(Double(sprite.yScale))
                row["hidden"]=String(sprite.isHidden);sprites.append(row)
            }
            report["sprites"]=sprites
            let alpha=NativeArtworkAlphaBounds.measure(UIImage(cgImage:texture.cgImage()))
            let top=alpha.minY*preview.bounds.height,bottom=alpha.maxY*preview.bounds.height
            XCTAssertEqual(top-subtitle.frame.maxY,48,accuracy:4,"Rendered pixels, not just the layout slot")
            XCTAssertEqual(detail.card.bounds.height-bottom,96,accuracy:4)
            XCTAssertEqual(alpha.height*preview.bounds.height,die.id=="cubero" ? 239.4:180,accuracy:4)
            report["paintedTop"]=top;report["paintedBottom"]=bottom;report["subtitleBottom"]=subtitle.frame.maxY
            try JSONSerialization.data(withJSONObject:report,options:.prettyPrinted).write(to:URL(fileURLWithPath:"/tmp/cubero-layout-\(die.id).json"))
            detail.dispose();detail.willMove(toParent:nil);detail.view.removeFromSuperview();detail.removeFromParent()
        }
    }
    func testEverySelectedBoardPresentationPreparesAndRetiresIncludingHoneyBees() async throws {
        let dice=NativeBackpackCatalog.arcade+NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{window.isHidden=true}
        for die in dice {
            let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
            preview.frame=CGRect(x:0,y:0,width:342,height:276);host.view.addSubview(preview)
            let deadline=Date().addingTimeInterval(12)
            while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(preview.ready,die.id)
            let node=try XCTUnwrap(preview.dieNode,die.id)
            if die.id=="barell" {
                XCTAssertTrue(node.resourcePaths.contains("assets/shop/barell/barell.png"))
                XCTAssertFalse(node.resourcePaths.contains("assets/shop/barell/barell-static.png"))
                XCTAssertTrue(node.resourcePaths.contains(NativeDiceSheet.barrel.path))
                XCTAssertTrue(node.authoredArtworkReceipt.running)
                let first=node.authoredArtworkReceipt.frame
                node.tick(0.1,suspended:false,viewportCenter:0)
                XCTAssertNotEqual(node.authoredArtworkReceipt.frame,first,"Full original SVG poses, not a transformed static PNG")
                XCTAssertEqual(node.authoredArtworkReceipt.frame,NativeDiceSheet.barrel.frame(at:node.authoredArtworkReceipt.elapsed))
            }
            if die.id=="laser-gun" {
                XCTAssertTrue(node.resourcePaths.contains("assets/shop/gun/right gun.png"))
                XCTAssertFalse(node.resourcePaths.contains("assets/shop/gun/lasergun1.png"))
                node.paintCollectionPreview(seconds:0)
                let rest=node.collectionBodyBounds.size
                node.paintCollectionPreview(seconds:0.5)
                let float=node.collectionBodyBounds.midY
                XCTAssertEqual(node.collectionBodyBounds.width,rest.width,accuracy:0.0001)
                XCTAssertEqual(node.collectionBodyBounds.height,rest.height,accuracy:0.0001,"One-second pause before the first twitch")
                node.paintCollectionPreview(seconds:0.95)
                XCTAssertEqual(node.collectionBodyBounds.width,rest.width,accuracy:0.0001)
                XCTAssertEqual(node.collectionBodyBounds.height,rest.height,accuracy:0.0001)
                XCTAssertNotEqual(node.collectionBodyBounds.midY,float,"Gentle idle float continues during the twitch pause")
                node.paintCollectionPreview(seconds:1.12)
                let twitch=node.collectionBodyBounds.size
                XCTAssertNotEqual(twitch,rest)
                XCTAssertEqual(node.authoredArtworkReceipt.frame,-1,"Original icon only, with shared Magnet bounce")
                node.paintCollectionPreview(seconds:1.52)
                XCTAssertEqual(node.collectionBodyBounds.width,rest.width,accuracy:0.0001)
                XCTAssertEqual(node.collectionBodyBounds.height,rest.height,accuracy:0.0001)
                node.paintCollectionPreview(seconds:2.4)
                XCTAssertEqual(node.collectionBodyBounds.width,rest.width,accuracy:0.0001)
                XCTAssertEqual(node.collectionBodyBounds.height,rest.height,accuracy:0.0001,"Full one-second rest between completed twitches")
                node.paintCollectionPreview(seconds:2.64)
                XCTAssertEqual(node.collectionBodyBounds.width,twitch.width,accuracy:0.0001)
                XCTAssertEqual(node.collectionBodyBounds.height,twitch.height,accuracy:0.0001)
            }
            if ["tnt","wild-magnet","laser-gun","bottle"].contains(die.id) {
                node.paintCollectionPreview(seconds:0.75)
                let high=node.collectionBodyBounds.midY*node.yScale
                node.paintCollectionPreview(seconds:2.25)
                let low=node.collectionBodyBounds.midY*node.yScale
                XCTAssertEqual(high-low,8,accuracy:0.01,"Same gentle modal-point float, including Bottle over its own tilt")
                node.paintCollectionPreview(seconds:0)
            }
            if die.id=="flower" {XCTAssertEqual(node.children.compactMap{$0 as? SKShapeNode}.count,12)}
            if die.id=="honey" {XCTAssertNotNil(node.childNode(withName:"//native-honey-idle-orbit"))}
            if die.id=="bee" {
                let before=node.collectionBodyBounds
                node.tick(0.12,suspended:false,viewportCenter:0)
                XCTAssertNotEqual(node.collectionBodyBounds,before)
            }
            preview.setActive(true)
            if die.id=="fish" {
                XCTAssertEqual(preview.preferredFramesPerSecond,60)
                XCTAssertEqual(preview.fishOwner?.activeMediaCount,1)
                XCTAssertTrue(preview.fishOwner?.presentation(tileID:node.tileID)?.mediaReady==true)
                XCTAssertTrue(preview.fishOwner?.presentation(tileID:node.tileID)?.usesOriginalSVGFallback==true)
                XCTAssertFalse(preview.fishOwner?.presentation(tileID:node.tileID)?.isHidden ?? true)
            }
            if die.id=="beach-ball",let scene=preview.scene {
                XCTAssertGreaterThan(preview.presentationHeightRatio,1)
                let ground=try XCTUnwrap(preview.groundedBodyY)
                XCTAssertEqual(ground,149.65-206,accuracy:0.01,"Lowest alpha pixel across all84 original frames")
                let low=node.convert(CGPoint(x:0,y:ground),to:scene)
                XCTAssertEqual(low.y,48,accuracy:0.5)
                let highest=try XCTUnwrap(preview.highestBodyY)
                XCTAssertEqual(highest,149.65-4,accuracy:0.01,"Highest jump alpha pixel across all84 original frames")
                let high=node.convert(CGPoint(x:0,y:highest),to:scene)
                XCTAssertEqual(high.y,preview.bounds.height-48,accuracy:0.5)

            }
            preview.setActive(false);XCTAssertFalse(preview.isPlaying)
            preview.dispose();preview.removeFromSuperview();preview.dispose();preview.setActive(true)
            XCTAssertNil(preview.dieNode);XCTAssertNil(preview.scene);XCTAssertFalse(preview.isPlaying)
        }
    }
    func testBallMotionMetadataMatchesEveryOriginalFrame() async throws {
        let root=NativeTestResources.root
        let measured=await Task.detached { () -> CGRect? in
            let sheet=NativeDiceSheet.ball
            guard let image=NativeSelectedFinaleRaster.decode(root:root,candidates:[sheet.path])?.image else{return nil}
            var union:CGRect?
            for index in 0..<sheet.frameCount {
                let rect=CGRect(x:CGFloat(index%sheet.columns)*sheet.cell.width,y:CGFloat(index/sheet.columns)*sheet.cell.height,width:sheet.cell.width,height:sheet.cell.height)
                guard let cell=image.cropping(to:rect) else{return nil}
                let alpha=NativeArtworkAlphaBounds.measure(UIImage(cgImage:cell))
                union=union.map{$0.union(alpha)} ?? alpha
            }
            return union
        }.value
        let bounds=try XCTUnwrap(measured),metadata=NativeDiceSheet.ballMotionBounds
        XCTAssertEqual(bounds.minX,metadata.minX,accuracy:0.00001)
        XCTAssertEqual(bounds.minY,metadata.minY,accuracy:0.00001)
        XCTAssertEqual(bounds.maxX,metadata.maxX,accuracy:0.00001)
        XCTAssertEqual(bounds.maxY,metadata.maxY,accuracy:0.00001)
    }
    func testBallActualPresentationLatency() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let die=try XCTUnwrap(NativeBackpackCatalog.beach.first{$0.id=="beach-ball"})
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
        let start=CACurrentMediaTime()
        let detail=NativeBackpackDetail(die:die,assets:assets,motion:motion)
        var started:Double?
        detail.onPresentationStarted={started=CACurrentMediaTime()-start}
        defer{detail.dispose();host.dismiss(animated:false);window.isHidden=true}
        host.present(detail,animated:false)
        var last=start,maximumGap=CACurrentMediaTime()-start
        while !detail.card.isUserInteractionEnabled,CACurrentMediaTime()-start<10 {
            try await Task.sleep(for:.milliseconds(10))
            let now=CACurrentMediaTime();maximumGap=max(maximumGap,now-last);last=now
        }
        let receipt=["entryStartSeconds":started ?? -1,"maximumMainThreadGapSeconds":maximumGap,"inputReadySeconds":CACurrentMediaTime()-start]
        try JSONSerialization.data(withJSONObject:receipt).write(to:URL(fileURLWithPath:"/tmp/ball-actual-entry.json"))
        XCTAssertLessThan(try XCTUnwrap(started),0.35,"Measure actual modal entry, including first Scene activation")
        XCTAssertLessThan(maximumGap,0.25)
        XCTAssertTrue(detail.card.isUserInteractionEnabled)
    }
    func testBallColdPreparationKeepsMainThreadResponsive() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let die=try XCTUnwrap(NativeBackpackCatalog.beach.first{$0.id=="beach-ball"})
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let start=CACurrentMediaTime()
        let detail=NativeBackpackDetail(die:die,assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        defer{detail.dispose();window.isHidden=true}
        host.addChild(detail);detail.view.frame=window.bounds;host.view.addSubview(detail.view);detail.didMove(toParent:host)
        var last=start,maximumGap=CACurrentMediaTime()-start
        while detail.preview?.ready != true,CACurrentMediaTime()-start<10 {
            try await Task.sleep(for:.milliseconds(10))
            let now=CACurrentMediaTime();maximumGap=max(maximumGap,now-last);last=now
        }
        let elapsed=CACurrentMediaTime()-start
        XCTAssertTrue(detail.preview?.ready==true)
        let receipt=["readySeconds":elapsed,"maximumMainThreadGapSeconds":maximumGap]
        try JSONSerialization.data(withJSONObject:receipt).write(to:URL(fileURLWithPath:"/tmp/ball-cold-preparation.json"))
        XCTAssertLessThan(maximumGap,0.25,"Cold preparation must yield the main run loop")
        XCTAssertLessThan(elapsed,0.75,"Selected Ball must not spend1.5–2seconds preparing its original atlas")
    }
    func testCuberoColdPreparationKeepsMainThreadResponsive() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let die=try XCTUnwrap(NativeBackpackCatalog.arcade.first{$0.id=="cubero"})
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let start=CACurrentMediaTime()
        let detail=NativeBackpackDetail(die:die,assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        defer{detail.dispose();window.isHidden=true}
        host.addChild(detail);detail.view.frame=window.bounds;host.view.addSubview(detail.view);detail.didMove(toParent:host)
        var last=start,maximumGap=CACurrentMediaTime()-start
        while detail.preview?.ready != true,CACurrentMediaTime()-start<10 {
            try await Task.sleep(for:.milliseconds(10))
            let now=CACurrentMediaTime();maximumGap=max(maximumGap,now-last);last=now
        }
        let elapsed=CACurrentMediaTime()-start
        XCTAssertTrue(detail.preview?.ready==true)
        let receipt=["readySeconds":elapsed,"maximumMainThreadGapSeconds":maximumGap]
        try JSONSerialization.data(withJSONObject:receipt).write(to:URL(fileURLWithPath:"/tmp/cubero-cold-preparation.json"))
        XCTAssertLessThan(maximumGap,0.25,"Cold preparation must yield the main run loop")
        XCTAssertLessThan(elapsed,0.75,"Selected Cubero must not spend1.5–2seconds preparing its original atlas")
    }
    func testBallFullJumpKeepsSubtitleGapAndGroundedBottomLikeFlower() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let die=try XCTUnwrap(NativeBackpackCatalog.beach.first{$0.id=="beach-ball"})
        let detail=NativeBackpackDetail(die:die,assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        host.addChild(detail);detail.view.frame=window.bounds;host.view.addSubview(detail.view);detail.didMove(toParent:host)
        defer{detail.dispose();window.isHidden=true}
        let deadline=Date().addingTimeInterval(10)
        while detail.preview?.ready != true,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        detail.view.setNeedsLayout();detail.view.layoutIfNeeded()
        let preview=try XCTUnwrap(detail.preview),node=try XCTUnwrap(preview.dieNode)
        preview.setActive(true);preview.isPaused=true
        let scene=try XCTUnwrap(preview.scene),high=try XCTUnwrap(preview.highestBodyY),ground=try XCTUnwrap(preview.groundedBodyY)
        let subtitle=try XCTUnwrap(detail.hero.superview?.subviews.compactMap{$0 as? UILabel}.first{$0.numberOfLines==0})
        let highestTop=scene.size.height-node.convert(CGPoint(x:0,y:high),to:scene).y
        let landingBottom=scene.size.height-node.convert(CGPoint(x:0,y:ground),to:scene).y
        XCTAssertEqual(highestTop-subtitle.frame.maxY,16,accuracy:0.5)
        XCTAssertEqual(detail.card.bounds.height-landingBottom,96,accuracy:0.5)
        XCTAssertEqual(node.collectionBodyBounds.height*node.yScale,162,accuracy:1,"Original visible Ball size is preserved")
        // Isolate original body pixels from the separately owned idle bubble field.
        node.childNode(withName:"die-visual")?.children.compactMap{$0 as? NativeIdleBubbleField}.forEach{$0.isHidden=true}
        node.tick(12.0/60+0.0001,suspended:false,viewportCenter:scene.size.width/2)
        let landing=try XCTUnwrap(preview.texture(from:scene,crop:CGRect(origin:.zero,size:scene.size)))
        let landingAlpha=NativeArtworkAlphaBounds.measure(UIImage(cgImage:landing.cgImage()))
        XCTAssertEqual(detail.card.bounds.height-landingAlpha.maxY*scene.size.height,96,accuracy:4,"Actual landing pixels")
        try UIImage(cgImage:landing.cgImage()).pngData()?.write(to:URL(fileURLWithPath:"/tmp/ball-envelope-landing.png"))
        node.tick(45.0/60,suspended:false,viewportCenter:scene.size.width/2)
        let peak=try XCTUnwrap(preview.texture(from:scene,crop:CGRect(origin:.zero,size:scene.size)))
        let peakAlpha=NativeArtworkAlphaBounds.measure(UIImage(cgImage:peak.cgImage()))
        XCTAssertEqual(peakAlpha.minY*scene.size.height-subtitle.frame.maxY,16,accuracy:4,"Actual highest-jump pixels")
        try UIImage(cgImage:peak.cgImage()).pngData()?.write(to:URL(fileURLWithPath:"/tmp/ball-envelope-peak.png"))
        let receipt:[String:Double]=["subtitleBottom":Double(subtitle.frame.maxY),"cardHeight":Double(detail.card.bounds.height),"width":Double(preview.bounds.width)]
        try JSONSerialization.data(withJSONObject:receipt).write(to:URL(fileURLWithPath:"/tmp/ball-envelope-geometry.json"))

    }
    func testSelectedFishSamplesEvery60HzFrameAtCurrentAcceleratedRate() async throws {
        let root=NativeTestResources.root,resources=NativeFishSVGResourceLease(resourceRoot:NativeTestResources.root)
        let fish=NativeFishIdlePresentation(resourceRoot:root,svgResources:resources,allowHEVC:false,minimumPaintInterval:0,svgPlaybackRate:1.625)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();host.view.addSubview(fish)
        defer{fish.dispose();resources.dispose();window.isHidden=true}
        fish.prepare()
        let deadline=Date().addingTimeInterval(10)
        while !fish.mediaReady,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(fish.mediaReady)
        let frame=NativeFishIdleFrame.project(center:CGPoint(x:195,y:420),horizontalUnit:CGPoint(x:196,y:420),verticalUnit:CGPoint(x:195,y:419),sceneHeight:844,alpha:1,dragging:false,phaseStarted:true,visible:true,bubbles:[])
        for tick in 0..<20 {
            let delta=tick==0 ? 0:Double(tick)/60+0.000001
            fish.paint(frame,now:100+delta,force:tick==0)
            XCTAssertEqual(fish.originalSVGFrame,Int(floor(delta*1.625/1.125*72+1e-8)))
            XCTAssertFalse(fish.isHidden)
        }
        fish.paint(frame,now:100+1.125/1.625+0.00001)
        XCTAssertEqual(fish.originalSVGFrame,0)
        XCTAssertFalse(fish.isHidden)
        let bubbles=(0..<6).map {NativeFishIdleFrame.Bubble(id:$0,slot:$0,radius:12,color:0xFFE6E1,point:.zero,scale:CGPoint(x:1,y:1),alpha:1,showsHighlight:false,behindArtwork:$0.isMultiple(of:2))}
        let layered=NativeFishIdleFrame.project(center:CGPoint(x:195,y:420),horizontalUnit:CGPoint(x:196,y:420),verticalUnit:CGPoint(x:195,y:419),sceneHeight:844,alpha:1,dragging:false,phaseStarted:true,visible:true,bubbles:bubbles)
        fish.paint(layered,now:102,force:true)
        XCTAssertEqual(fish.subviews.count,3,"Two bubble planes surround the original media plane")
        XCTAssertEqual(fish.subviews.first?.subviews.count,3)
        XCTAssertEqual(fish.subviews.last?.subviews.count,3)
        let rear=try XCTUnwrap(fish.subviews.first),front=try XCTUnwrap(fish.subviews.last)
        XCTAssertTrue((rear.subviews+front.subviews).allSatisfy{$0.layer.sublayers?[1].isHidden==true})
        fish.setSuspended(true);XCTAssertTrue(fish.isHidden)
        fish.setSuspended(false)
        XCTAssertEqual(rear.subviews.count,3);XCTAssertEqual(front.subviews.count,3)
        XCTAssertEqual(fish.bubbleCarrierCount,6,"Rear/front split reuses the same bounded carriers")
    }
    func testDisposedModalRejectsPendingBoardPreparation() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let detail=NativeBackpackDetail(die:try XCTUnwrap(NativeBackpackCatalog.arcade.first{$0.id=="cubero"}),assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        detail.loadViewIfNeeded();let preview=try XCTUnwrap(detail.preview)
        XCTAssertEqual(detail.card.alpha,0);XCTAssertFalse(detail.card.isUserInteractionEnabled)
        detail.dispose();try await Task.sleep(for:.milliseconds(200))
        XCTAssertNil(preview.dieNode);XCTAssertNil(detail.hero.image);XCTAssertFalse(preview.isPlaying)
    }
    func testReferencePreviewAtPhoneSize() throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let host=UIViewController();let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=host;window.makeKeyAndVisible()
        defer{window.isHidden=true}
        let paper=NativeAppPaperSurface(artwork:assets);paper.frame=window.bounds;host.view.addSubview(paper)
        let screen=NativeBackpackView(frame:window.bounds,assets:assets);host.view.addSubview(screen)
        var progress=NativeProgressionState();progress.highestUnlockedJourneyBoard=7
        for die in NativeBackpackCatalog.forest {progress.announceJourneyDie(die.id,board:die.board)}
        screen.apply(NativeBackpackCatalog.sections(progress));host.view.layoutIfNeeded();screen.grid.layoutIfNeeded()
        let image=UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-screen.png"))
        XCTAssertGreaterThan(screen.grid.visibleCells.count,3)
        XCTAssertFalse(screen.includesArcade)
        XCTAssertEqual(screen.numberOfSections(in:screen.grid),3)
        let sectionHeader=try XCTUnwrap(screen.grid.supplementaryView(forElementKind:UICollectionView.elementKindSectionHeader,at:IndexPath(item:0,section:0)))
        let texts=sectionHeader.subviews.compactMap{($0 as? UILabel)?.text}
        XCTAssertTrue(texts.contains("Forest"))
        XCTAssertFalse(texts.contains("Arcade"))
        XCTAssertFalse(texts.contains(where:{$0.contains("Always ready to play")}))
        screen.grid.scrollToItem(at:IndexPath(item:5,section:0),at:.centeredVertically,animated:false);screen.grid.layoutIfNeeded()
        let barrelCell=try XCTUnwrap(screen.grid.cellForItem(at:IndexPath(item:5,section:0)))
        let barrelView=try XCTUnwrap(barrelCell.contentView.subviews.flatMap{[$0]+$0.subviews}.compactMap{$0 as? UIImageView}.filter{!($0 is NativeBackpackAlertView)}.last)
        let barrel=try XCTUnwrap(barrelView.image)
        XCTAssertEqual(barrel.size.width/barrel.size.height,1,accuracy:0.001)
        let barrelVisible=barrelView.bounds.height*NativeBackpackDetail.visibleHeightRatio(barrel)
        XCTAssertEqual(barrelVisible,120*0.855,accuracy:0.5,"Retain the accepted grid-only Barrel reductions; modal size is unchanged")
        screen.grid.scrollToItem(at:IndexPath(item:0,section:1),at:.top,animated:false);screen.grid.layoutIfNeeded()
        let locked=UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}
        try locked.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-locked.png"))
        let cells=screen.grid.visibleCells
        let lockCell=try XCTUnwrap(cells.first)
        let images=lockCell.contentView.subviews.flatMap{[$0]+$0.subviews}.compactMap{$0 as? UIImageView}.filter{!($0 is NativeBackpackAlertView)}
        let frame=lockCell.contentView.subviews.flatMap{[$0]+$0.subviews}.first{$0.accessibilityIdentifier=="native.backpack.frame"}
        XCTAssertEqual(frame?.bounds.size,CGSize(width:155,height:153))
        XCTAssertEqual(images.last?.bounds.size,CGSize(width:70,height:80))
        screen.grid.setContentOffset(CGPoint(x:0,y:-screen.grid.contentInset.top),animated:false);screen.grid.layoutIfNeeded()
        let detail=NativeBackpackDetail(die:NativeBackpackCatalog.forest.first{$0.id=="bee"}!,assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        host.addChild(detail);detail.view.frame=window.bounds;host.view.addSubview(detail.view);detail.didMove(toParent:host);detail.card.alpha=1;detail.view.layoutIfNeeded()
        let modal=UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}
        try modal.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-detail.png"));detail.dispose()
    }
    func testEveryDetailHasNoBadgeUniformBodyBottomGapAndRoundedUnfoldedPaper() {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let dice=NativeBackpackCatalog.arcade+NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        for die in dice {
            let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
            let detail=NativeBackpackDetail(die:die,assets:assets,motion:motion)
            detail.loadViewIfNeeded();detail.view.frame=CGRect(x:0,y:0,width:390,height:844);detail.view.layoutIfNeeded()
            if let image=detail.hero.image {
                let visible=detail.hero.bounds.height*NativeBackpackDetail.visibleHeightRatio(image)
                XCTAssertEqual(visible,die.id=="cubero" ? 239.4:die.id=="wild-magnet" ? 144:die.id=="laser-gun" ? 207:(11...20).contains(die.board) ? 162:180,accuracy:1,die.id)
            }else{XCTFail("Missing artwork \(die.id)")}
            if let image=detail.hero.image {
                let bounds=NativeBackpackDetail.visibleArtworkBounds(image)
                let top=detail.hero.frame.minY+bounds.minY*detail.hero.bounds.height
                let bottom=top+bounds.height*detail.hero.bounds.height
                let subtitle=detail.hero.superview?.subviews.compactMap{$0 as? UILabel}.first{$0.numberOfLines==0}
                let offset:CGFloat=die.id=="beach-ball" ? -32:die.id=="wild-star" ? -24:die.id=="spaceship" ? -16:0
                XCTAssertEqual(top-(subtitle?.frame.maxY ?? 0),48+offset,accuracy:0.1,die.id)
                XCTAssertEqual(detail.card.bounds.height-bottom,96,accuracy:0.1,die.id)
            }
            if let parent=detail.hero.superview,let preview=detail.preview {
                XCTAssertEqual(preview.frame,parent.bounds,die.id)
                if let subtitle=parent.subviews.compactMap({$0 as? UILabel}).first(where:{$0.numberOfLines==0}),
                   let rendererIndex=parent.subviews.firstIndex(of:preview),let textIndex=parent.subviews.firstIndex(of:subtitle) {
                    XCTAssertLessThan(rendererIndex,textIndex,die.id)
                    XCTAssertTrue(preview.frame.contains(subtitle.frame),die.id)
                }
            }
            let titleLabel=detail.hero.superview?.subviews.compactMap{$0 as? UILabel}.first{$0.text==die.title}
            if die.title.contains(" ") {
                let color=titleLabel?.attributedText?.attribute(.foregroundColor,at:0,effectiveRange:nil) as? UIColor
                XCTAssertEqual(color,UIColor(red:232/255,green:116/255,blue:74/255,alpha:1))
            }
            let labels=detail.hero.superview?.subviews.compactMap{$0 as? UILabel} ?? []
            XCTAssertEqual(labels.count,2,die.id)
            let paper=detail.hero.superview?.subviews.first{$0.accessibilityIdentifier=="native.backpack.detail.paper"} as? UIImageView
            XCTAssertEqual(paper?.layer.cornerRadius,40,die.id)
            XCTAssertTrue(paper?.clipsToBounds==true,die.id)
            XCTAssertLessThan(paper?.layer.contentsRect.maxY ?? 1,0.9,die.id)
            detail.dispose()
        }
    }
    func testDetailCleanupTwiceAndBackgroundRetiresArtwork() {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
        let detail=NativeBackpackDetail(die:NativeBackpackCatalog.forest.first{$0.id=="bee"}!,assets:assets,motion:motion)
        detail.loadViewIfNeeded();detail.setForeground(false);detail.setForeground(true);detail.dispose();detail.dispose()
        XCTAssertNil(detail.hero.image);XCTAssertNil(detail.hero.layer.animationKeys())
    }
    private final class WeakLifecycleObject {
        weak var value:AnyObject?
        let name:String
        init(_ value:AnyObject?,_ name:String){self.value=value;self.name=name}
    }
    private func waitForBackpackRetirement(_ objects:[WeakLifecycleObject],context:String) async throws {
        let deadline=Date().addingTimeInterval(8)
        while objects.contains(where:{$0.value != nil}),Date()<deadline {
            autoreleasepool {}
            try await Task.sleep(for:.milliseconds(20))
        }
        for object in objects {XCTAssertNil(object.value,"\(context): retained \(object.name)")}
    }
    private func exerciseMountedBackpackLifecycle(_ die:NativeBackpackCatalog.Die,host:UIViewController,assets:JimiV9Artwork) async throws -> [WeakLifecycleObject] {
        let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
        let detail=NativeBackpackDetail(die:die,assets:assets,motion:motion)
        var closed=0
        detail.onClose={closed += 1}
        defer{detail.dispose();host.dismiss(animated:false)}
        host.present(detail,animated:false)
        let readyDeadline=Date().addingTimeInterval(15)
        while !detail.card.isUserInteractionEnabled,Date()<readyDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(detail.card.isUserInteractionEnabled,"\(die.id): actual modal became interactive")
        let preview=try XCTUnwrap(detail.preview)
        XCTAssertTrue(preview.ready,die.id)
        let node=try XCTUnwrap(preview.dieNode)
        let fish=preview.fishOwner
        let objects=[WeakLifecycleObject(detail,"detail"),WeakLifecycleObject(preview,"preview"),WeakLifecycleObject(node,"node"),WeakLifecycleObject(fish,"Fish owner"),WeakLifecycleObject(preview.groundShadow,"ground shadow"),WeakLifecycleObject(preview.rearCanShadow,"rear can shadow")]
        try await Task.sleep(for:.milliseconds(120))
        detail.setForeground(false)
        let hiddenElapsed=preview.playbackElapsed
        XCTAssertFalse(preview.isPlaying,die.id)
        try await Task.sleep(for:.milliseconds(120))
        XCTAssertEqual(preview.playbackElapsed,hiddenElapsed,accuracy:0.000001,"\(die.id): hidden preview did work")
        detail.setForeground(true)
        try await Task.sleep(for:.milliseconds(160))
        if !UIAccessibility.isReduceMotionEnabled {
            XCTAssertGreaterThan(preview.playbackElapsed,hiddenElapsed,"\(die.id): foreground failed to resume")
        }
        detail.closeTapped()
        let closedDeadline=Date().addingTimeInterval(5)
        while (closed==0 || host.presentedViewController != nil),Date()<closedDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(closed,1,die.id)
        XCTAssertNil(host.presentedViewController,die.id)
        XCTAssertNil(detail.preview,die.id)
        XCTAssertNil(preview.scene,die.id)
        XCTAssertNil(preview.groundShadow,die.id)
        XCTAssertNil(preview.rearCanShadow,die.id)
        XCTAssertNil(preview.dieNode,die.id)
        XCTAssertFalse(preview.isPlaying,die.id)
        XCTAssertEqual(fish?.activeMediaCount ?? 0,0,die.id)
        return objects
    }
    func testMountedAllEighteenBackpackDetailsRetireAndHeavyReopensDoNotRetainOwners() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dismiss(animated:false);window.isHidden=true;window.rootViewController=nil}
        let all=NativeBackpackCatalog.arcade+NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        XCTAssertEqual(all.count,19)
        let heavy=all.filter{["fish","cubero","beach-ball"].contains($0.id)}
        for (index,die) in (all+heavy+heavy).enumerated() {
            let objects=try await exerciseMountedBackpackLifecycle(die,host:host,assets:assets)
            try await waitForBackpackRetirement(objects,context:"pass \(index) \(die.id)")
        }
    }
    func testImmediatelyDisposedBackpackPreparationCannotPublishOrRetainPreview() async throws {
        let all=NativeBackpackCatalog.arcade+NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        for die in all.filter({["fish","cubero","beach-ball"].contains($0.id)}) {
            var publications=0
            var preview:NativeBackpackDicePreview?=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
            let weak=WeakLifecycleObject(preview,"pending preview")
            preview?.onReady={publications += 1}
            preview?.dispose()
            XCTAssertNil(preview?.scene,die.id)
            XCTAssertNil(preview?.dieNode,die.id)
            XCTAssertNil(preview?.fishOwner,die.id)
            preview=nil
            try await waitForBackpackRetirement([weak],context:die.id)
            try await Task.sleep(for:.milliseconds(100))
            XCTAssertEqual(publications,0,"\(die.id): stale preparation published after disposal")
        }
    }

    func testMountedFishPreparationBackgroundBeforeReadyResumesAndCloses() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
        let die=try XCTUnwrap(NativeBackpackCatalog.beach.first{$0.id=="fish"})
        var factoryCalls=0,opened=0,closed=0
        let detail=NativeBackpackDetail(die:die,assets:assets,motion:motion,fishOwnerFactory:{root in
            factoryCalls += 1
            let owner=NativeFishIdleOwner(resourceRoot:root,preferOriginalSVG:true,minimumPaintInterval:0,svgPlaybackRate:1.625)
            // Hold the actual resource lease before any SVG request can start.
            // Its genuine pending waiter must survive background and resume.
            owner.setSuspended(true)
            return owner
        })
        detail.onPresentationStarted={opened += 1};detail.onClose={closed += 1}
        defer{detail.dispose();host.dismiss(animated:false);window.isHidden=true;window.rootViewController=nil}
        host.present(detail,animated:false)
        let pendingDeadline=Date().addingTimeInterval(10)
        while (detail.preview?.fishOwner?.pendingSVGRequests ?? 0)==0,Date()<pendingDeadline {try await Task.sleep(for:.milliseconds(20))}
        let preview=try XCTUnwrap(detail.preview),fish=try XCTUnwrap(preview.fishOwner)
        XCTAssertEqual(factoryCalls,1)
        XCTAssertGreaterThan(fish.pendingSVGRequests,0)
        XCTAssertFalse(preview.ready)
        XCTAssertEqual(opened,0)
        XCTAssertEqual(detail.card.alpha,0)
        detail.setForeground(false)
        let hiddenElapsed=preview.playbackElapsed
        try await Task.sleep(for:.milliseconds(150))
        XCTAssertFalse(preview.ready)
        XCTAssertEqual(fish.selectedSVGFrameCount,0,"Background must not decode the held Fish family")
        XCTAssertGreaterThan(fish.pendingSVGRequests,0,"Foreground must retain the real preparation request")
        XCTAssertEqual(preview.playbackElapsed,hiddenElapsed)
        detail.setForeground(true)
        let readyDeadline=Date().addingTimeInterval(15)
        while !detail.card.isUserInteractionEnabled,Date()<readyDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(preview.ready,"Foreground must resume preparation before presentation starts")
        XCTAssertTrue(detail.card.isUserInteractionEnabled)
        XCTAssertEqual(opened,1)
        XCTAssertEqual(factoryCalls,1,"Resume must reuse the captured Fish owner")
        XCTAssertGreaterThan(fish.selectedSVGFrameCount,0)
        detail.closeTapped()
        let closedDeadline=Date().addingTimeInterval(5)
        while closed==0,Date()<closedDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(closed,1)
        XCTAssertNil(host.presentedViewController)
        XCTAssertNil(preview.scene)
        XCTAssertEqual(fish.activeMediaCount,0)
        XCTAssertEqual(fish.pendingSVGRequests,0)
        XCTAssertEqual(fish.selectedSVGFrameCount,0)
    }

    func testGeneralBackpackPreparationBackgroundInvalidatesAndForegroundRestarts() async throws {
        let all=NativeBackpackCatalog.arcade+NativeBackpackCatalog.beach
        for die in all.filter({["cubero","beach-ball"].contains($0.id)}) {
            var publications=0
            var preview:NativeBackpackDicePreview?=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
            let reference=WeakLifecycleObject(preview,"restarted preview")
            preview?.onReady={publications += 1}
            // Main-actor delivery of base artwork cannot run between init and
            // this synchronous background boundary.
            preview?.setPreparationForeground(false)
            try await Task.sleep(for:.milliseconds(150))
            XCTAssertNil(preview?.dieNode,"\(die.id): background preparation published a node")
            XCTAssertEqual(preview?.playbackElapsed,0)
            XCTAssertFalse(preview?.ready == true)
            XCTAssertEqual(publications,0)
            preview?.setPreparationForeground(true)
            let deadline=Date().addingTimeInterval(15)
            while preview?.ready != true,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(preview?.ready == true,"\(die.id): foreground must restart invalidated preparation")
            XCTAssertNotNil(preview?.dieNode)
            XCTAssertEqual(preview?.bounds,.zero,"Exercise successful readiness before the preview has a layout")
            XCTAssertTrue(preview?.dieNode?.position.x.isFinite == true,die.id)
            XCTAssertTrue(preview?.dieNode?.position.y.isFinite == true,die.id)
            XCTAssertTrue(preview?.dieNode?.xScale.isFinite == true,die.id)
            XCTAssertTrue(preview?.dieNode?.yScale.isFinite == true,die.id)
            preview?.refreshGroundShadow()
            preview?.frame=CGRect(x:0,y:0,width:342,height:360)
            preview?.layoutArtwork();preview?.refreshGroundShadow()
            let shadow=try XCTUnwrap(preview?.groundShadow)
            XCTAssertTrue(shadow.center.x.isFinite && shadow.center.y.isFinite,die.id)
            XCTAssertTrue(shadow.bounds.width.isFinite && shadow.bounds.height.isFinite,die.id)
            XCTAssertGreaterThan(shadow.bounds.width,0)
            XCTAssertTrue(preview?.dieNode?.position.x.isFinite == true,die.id)
            XCTAssertTrue(preview?.dieNode?.position.y.isFinite == true,die.id)
            XCTAssertEqual(publications,1,"\(die.id): only the current preparation may publish")
            preview?.dispose()
            XCTAssertNil(preview?.scene)
            XCTAssertNil(preview?.dieNode)
            preview=nil
            try await waitForBackpackRetirement([reference],context:die.id)
        }
    }

    func testEveryBackpackShadowUsesContactFloorWithFishAndSpaceshipExceptions() async throws {
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true;window.rootViewController=nil}
        let all=NativeBackpackCatalog.arcade+NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        XCTAssertEqual(all.count,19)
        for die in all {
            let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
            defer{preview.dispose();preview.removeFromSuperview()}
            preview.frame=CGRect(x:0,y:0,width:342,height:360)
            preview.artworkFrame=CGRect(x:0,y:48,width:342,height:216)
            host.view.addSubview(preview)
            let deadline=Date().addingTimeInterval(15)
            while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(preview.ready,die.id)
            preview.layoutArtwork();preview.refreshGroundShadow()
            let shadow=try XCTUnwrap(preview.groundShadow,die.id)
            XCTAssertTrue(shadow.superview === preview)
            XCTAssertFalse(shadow.isHidden,die.id)
            XCTAssertNotNil((shadow.subviews.first as? UIImageView)?.image,"\(die.id): original Arcade shadow must contain painted pixels")
            let rasterBounds=shadow.bounds
            let widthFactor:CGFloat=die.id=="kanta" ? 1:die.id=="wild-star" ? 0.81:die.id=="spaceship" ? 0.96:die.id=="bottle" ? 0.8*0.85*0.7:die.id=="bloob-ball" ? 0.85:["beach-ball","wild-juice","robo-cube"].contains(die.id) ? 0.8:1
            let measuredNode=try XCTUnwrap(preview.dieNode)
            let expectedWidth=die.id=="kanta" ? measuredNode.collectionBodyBounds.width*measuredNode.xScale*1.595:228*widthFactor
            XCTAssertEqual(rasterBounds.width,expectedWidth,accuracy:0.01,"Body-relative Bloob footprint; other profiles retain their dimensions")
            XCTAssertEqual(rasterBounds.height,228/1.11*0.15,accuracy:0.01)
            XCTAssertGreaterThan(rasterBounds.width,0)
            XCTAssertGreaterThan(rasterBounds.height,0)
            if die.id=="barell" {
                XCTAssertEqual(shadow.layer.opacity,Float(0.9392857143),accuracy:0.0001,"Barrel matches Flower grounded darkness")
            }
            if ["fish","spaceship","bee","flower","laser-gun"].contains(die.id) {
                XCTAssertEqual(shadow.center.y-rasterBounds.height/2,272,accuracy:0.01,"\(die.id): retained floor264 + gap8")
            }else{
                XCTAssertEqual(shadow.center.y,die.id=="bloob-ball" ? 280:["honey","kanta"].contains(die.id) ? 260:264,accuracy:0.01,"\(die.id): authored shadow floor")
            }
            preview.setActive(true);preview.isPaused=true
            let node=try XCTUnwrap(preview.dieNode)
            for _ in 0..<20 {
                node.tick(1.0/60,suspended:false,viewportCenter:171)
                preview.refreshGroundShadow()
                XCTAssertEqual(shadow.bounds,rasterBounds,"\(die.id): animated size must reuse the same cached raster")
            }
            preview.setActive(false)
            XCTAssertNil(preview.rearCanShadow)
            if die.id=="kanta" {XCTAssertNil(node.collectionRearCanCenter(in:try XCTUnwrap(preview.scene)))}
            let transform=shadow.transform,elapsed=preview.playbackElapsed
            try await Task.sleep(for:.milliseconds(60))
            XCTAssertEqual(shadow.transform,transform,"\(die.id): background must not animate shadow independently")
            XCTAssertEqual(preview.playbackElapsed,elapsed)
            preview.dispose()
            XCTAssertNil(preview.groundShadow)
            XCTAssertNil(shadow.superview)
        }
    }
    func testIndividualShadowResponsesFollowBodyWithoutAnIndependentPulse() async throws {
        let all=NativeBackpackCatalog.arcade+NativeBackpackCatalog.forest+NativeBackpackCatalog.area
        for die in all.filter({["wild-star","flower","bee","laser-gun"].contains($0.id)}) {
            let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
            defer{preview.dispose()}
            preview.frame=CGRect(x:0,y:0,width:342,height:380);preview.artworkFrame=CGRect(x:0,y:48,width:342,height:240)
            let deadline=Date().addingTimeInterval(15)
            while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(preview.ready,die.id);preview.layoutArtwork()
            let shadow=try XCTUnwrap(preview.groundShadow),node=try XCTUnwrap(preview.dieNode)
            preview.paintGroundShadow(seconds:0)
            let initial=shadow.transform,position=node.position
            for time in [0.5,1.0,2.0] {
                preview.paintGroundShadow(seconds:time)
                XCTAssertEqual(shadow.transform.a,initial.a,accuracy:0.00001,"\(die.id): a still body cannot invent an unrelated pulse")
            }
            for hz in [60,120] {
                node.position=position;preview.paintGroundShadow(seconds:0)
                var previous=shadow.transform.d,minimum=previous,maximum=previous
                for frame in 1...hz*2 {
                    let time=Double(frame)/Double(hz)
                    node.position.y=position.y+24*CGFloat(pow(sin(time * .pi/0.6),2))
                    preview.paintGroundShadow(seconds:time)
                    let current=shadow.transform.d
                    XCTAssertLessThan(abs(current-previous),0.1,"\(die.id): no abrupt per-frame collapse")
                    minimum=min(minimum,current);maximum=max(maximum,current);previous=current
                    let sampled=shadow.transform
                    preview.paintGroundShadow(seconds:time)
                    XCTAssertEqual(shadow.transform,sampled,"Same frame cannot advance smoothing twice")
                }
                XCTAssertGreaterThan(maximum-minimum,0.08,"\(die.id): preserve a lively body-driven response")
            }
            XCTAssertEqual(preview.playbackElapsed,0)
        }
    }

    func testMountedOriginalDieMotionStillAnimatesEachShadowAndHiddenClockStops() async throws {
        let all=NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil}
        for die in all.filter({["wild-star","flower","bee","bottle","fish","laser-gun"].contains($0.id)}) {
            let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
            defer{preview.dispose();preview.removeFromSuperview()}
            preview.frame=CGRect(x:0,y:0,width:342,height:380);preview.artworkFrame=CGRect(x:0,y:48,width:342,height:240)
            host.view.addSubview(preview)
            let deadline=Date().addingTimeInterval(15)
            while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(preview.ready,die.id);preview.layoutArtwork();preview.setActive(true)
            let shadow=try XCTUnwrap(preview.groundShadow)
            var smallest:CGFloat=10,largest:CGFloat=0,samples=0
            let until=Date().addingTimeInterval(2.6)
            while Date()<until {
                try await Task.sleep(for:.milliseconds(16))
                smallest=min(smallest,shadow.transform.d);largest=max(largest,shadow.transform.d);samples+=1
            }
            print("[IndividualShadow] \(die.id) samples=\(samples) range=\(largest-smallest) elapsed=\(preview.playbackElapsed)")
            XCTAssertGreaterThan(samples,20)
            XCTAssertGreaterThan(largest-smallest,0.01,"\(die.id): authored motion must still drive a visible shadow response")
            preview.setActive(false)
            let frozen=shadow.transform,elapsed=preview.playbackElapsed
            try await Task.sleep(for:.milliseconds(120))
            XCTAssertEqual(shadow.transform,frozen);XCTAssertEqual(preview.playbackElapsed,elapsed)
        }
    }

    func testFlowerShadowIgnoresRotationAndSquashAndOnlyFollowsVerticalTranslation() async throws {
        let die=try XCTUnwrap(NativeBackpackCatalog.forest.first{$0.id=="flower"})
        let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
        defer{preview.dispose()}
        preview.frame=CGRect(x:0,y:0,width:342,height:380);preview.artworkFrame=CGRect(x:0,y:48,width:342,height:240)
        let deadline=Date().addingTimeInterval(15)
        while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(preview.ready);preview.layoutArtwork();preview.setActive(true);preview.isPaused=true
        let node=try XCTUnwrap(preview.dieNode),shadow=try XCTUnwrap(preview.groundShadow),scene=try XCTUnwrap(preview.scene)
        preview.paintGroundShadow(seconds:0)
        let original=shadow.transform,alpha=shadow.layer.opacity,center=shadow.center
        for frame in 1...11 {
            node.tick(0.02,suspended:false,viewportCenter:171)
            preview.paintGroundShadow(seconds:Double(frame)*0.02)
            XCTAssertEqual(node.collectionFlowerVerticalLift(in:scene) ?? -1,0,accuracy:0.00001)
            XCTAssertEqual(shadow.transform,original,"First SVG anticipation rotates/squashes without lifting: shadow must stay still")
            XCTAssertEqual(shadow.layer.opacity,alpha);XCTAssertEqual(shadow.center,center)
        }
        var minimum=original.d,highestLift:CGFloat=0
        for frame in 12...80 {
            node.tick(0.02,suspended:false,viewportCenter:171)
            preview.paintGroundShadow(seconds:Double(frame)*0.02)
            highestLift=max(highestLift,node.collectionFlowerVerticalLift(in:scene) ?? 0)
            minimum=min(minimum,shadow.transform.d)
            XCTAssertEqual(shadow.center,center,"Shadow cannot travel with petal rotation")
        }
        XCTAssertGreaterThan(highestLift,5)
        XCTAssertLessThan(minimum,original.d-0.05,"Real upward motion still shrinks the shadow")
        XCTAssertGreaterThan(shadow.transform.d,minimum+0.05,"Landing grows the shadow again")
    }

    func testBloobShadowCoversBaseAndFollowsActualRockAndFloat() async throws {
        let die=try XCTUnwrap(NativeBackpackCatalog.area.first{$0.id=="kanta"})
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible();defer{window.isHidden=true}
        let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
        defer{preview.dispose()}
        preview.frame=CGRect(x:0,y:0,width:342,height:380)
        preview.artworkFrame=CGRect(x:0,y:48,width:342,height:240);host.view.addSubview(preview)
        let deadline=Date().addingTimeInterval(15)
        while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(preview.ready);preview.layoutArtwork()
        let shadow=try XCTUnwrap(preview.groundShadow),node=try XCTUnwrap(preview.dieNode)
        XCTAssertEqual(shadow.bounds.width,node.collectionBodyBounds.width*node.xScale*1.595,accuracy:0.001)
        XCTAssertGreaterThan(shadow.bounds.width,190,"Visible soft footprint must not become a tiny spot")
        let raster=shadow.bounds,floor=shadow.center.y
        for hz in [60,120] {
            preview.paintSelectedBounce(seconds:0);preview.paintGroundShadow(seconds:0)
            var previous=shadow.transform.d,previousX=shadow.center.x
            var minScale:CGFloat=1,maxScale:CGFloat=0,minX=previousX,maxX=previousX
            for frame in 1...hz*8 {
                let t=Double(frame)/Double(hz)
                preview.paintSelectedBounce(seconds:t);preview.paintGroundShadow(seconds:t)
                let current=shadow.transform.d,x=shadow.center.x
                XCTAssertLessThan(abs(current-previous),0.008)
                XCTAssertLessThan(abs(x-previousX),1.5,"Smoothly follows the bottom pivot")
                XCTAssertGreaterThan(current,0.78,"Never collapse the grounded ellipse")
                XCTAssertEqual(shadow.bounds,raster);XCTAssertEqual(shadow.center.y,floor)
                minScale=min(minScale,current);maxScale=max(maxScale,current)
                minX=min(minX,x);maxX=max(maxX,x);previous=current;previousX=x
            }
            XCTAssertGreaterThan(maxScale-minScale,0.15,"Float response must be visible")
            XCTAssertGreaterThan(maxX-minX,30,"Rocking must actually move the shadow")
        }
        // Prove the real mounted preview clock also drives UIKit shadow updates.
        preview.setActive(true)
        var samples:[CGFloat]=[]
        for _ in 0..<65 {try await Task.sleep(for:.milliseconds(33));samples.append(shadow.center.x)}
        XCTAssertGreaterThan((samples.max() ?? 0)-(samples.min() ?? 0),15)
        preview.setActive(false);let stopped=shadow.center
        try await Task.sleep(for:.milliseconds(80));XCTAssertEqual(shadow.center,stopped)
        preview.dispose();XCTAssertNil(shadow.superview)
    }
    func testJuiceMinimumShadowStopsHorizontalTravel() async throws {
        let die=try XCTUnwrap(NativeBackpackCatalog.beach.first{$0.id=="wild-juice"})
        let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
        defer{preview.dispose()}
        preview.frame=CGRect(x:0,y:0,width:342,height:380);preview.artworkFrame=CGRect(x:0,y:48,width:342,height:240)
        let deadline=Date().addingTimeInterval(15)
        while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(preview.ready);preview.layoutArtwork()
        let node=try XCTUnwrap(preview.dieNode),shadow=try XCTUnwrap(preview.groundShadow)
        // Move the actual selected body high enough to reach its minimum footprint.
        node.position.y += 240
        for offset:CGFloat in [-20,0,35] {
            node.position.x += offset;preview.refreshGroundShadow()
            XCTAssertEqual(shadow.transform.d,0.4,accuracy:0.00001)
            XCTAssertEqual(shadow.center.x,171,accuracy:0.00001)
        }
    }

    func testBackpackBallAndTNTShadowsTrackActualBodyHeightWithoutIndependentPulse() async throws {
        let dice=[try XCTUnwrap(NativeBackpackCatalog.arcade.first{$0.id=="tnt"})]+NativeBackpackCatalog.beach.filter{$0.id=="beach-ball"}
        for die in dice {
            let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
            defer{preview.dispose()}
            preview.frame=CGRect(x:0,y:0,width:342,height:380)
            preview.artworkFrame=CGRect(x:0,y:48,width:342,height:240)
            let deadline=Date().addingTimeInterval(15)
            while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(preview.ready,die.id)
            preview.layoutArtwork();preview.setActive(true);preview.isPaused=true
            let shadow=try XCTUnwrap(preview.groundShadow),node=try XCTUnwrap(preview.dieNode),scene=try XCTUnwrap(preview.scene)
            let raster=shadow.bounds
            var samples:[(height:CGFloat,scale:CGFloat)]=[]
            let count=die.id=="beach-ball" ? 84:2
            for index in 0..<count {
                if die.id=="beach-ball" {node.tick(1.0/60,suspended:false,viewportCenter:171)}
                else {node.paintCollectionPreview(seconds:index==0 ? 0.75:2.25)}
                preview.refreshGroundShadow()
                let body=node.collectionAnimatedBodyBounds(normalizedBounds:CGRect(x:0,y:0,width:1,height:1))
                let height=node.convert(CGPoint(x:body.midX,y:body.midY),to:scene).y
                samples.append((height,shadow.transform.a))
                XCTAssertEqual(shadow.bounds,raster)
                let fixed=shadow.transform
                preview.refreshGroundShadow();preview.refreshGroundShadow()
                XCTAssertEqual(shadow.transform,fixed,"No new motion may be invented when body pose is unchanged")
            }
            let high=try XCTUnwrap(samples.max{$0.height<$1.height}),low=try XCTUnwrap(samples.min{$0.height<$1.height})
            XCTAssertGreaterThan(high.height-low.height,1,die.id)
            XCTAssertLessThan(high.scale,low.scale,"\(die.id): a higher actual die must cast a smaller shadow")
        }
    }
    func testMountedBackpackShadowScreenshotsAtNarrowAndIPhoneWidths() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dismiss(animated:false);window.isHidden=true;window.rootViewController=nil}
        for width:CGFloat in [320,390] {
            window.frame=CGRect(x:0,y:0,width:width,height:844);host.view.frame=window.bounds
            for die in (NativeBackpackCatalog.forest+NativeBackpackCatalog.beach+NativeBackpackCatalog.area).filter({["fish","beach-ball","bottle","wild-juice","bee","flower","honey","mushroom","barell","kanta","spaceship","wild-star","laser-gun"].contains($0.id)}) {
                let detail=NativeBackpackDetail(die:die,assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
                defer{detail.dispose()}
                host.present(detail,animated:false)
                let deadline=Date().addingTimeInterval(15)
                while !detail.card.isUserInteractionEnabled,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
                XCTAssertTrue(detail.card.isUserInteractionEnabled,"\(die.id) \(width)")
                let preview=try XCTUnwrap(detail.preview),shadow=try XCTUnwrap(preview.groundShadow)
                preview.isPaused=true;preview.refreshGroundShadow();detail.view.layoutIfNeeded()
                print("[BackpackShadow] \(die.id) width=\(width) hidden=\(shadow.isHidden) opacity=\(shadow.layer.opacity) bounds=\(shadow.bounds) position=\(shadow.layer.position) transform=\(shadow.transform) raster=\((shadow.subviews.first as? UIImageView)?.image != nil)")
                if die.id=="beach-ball",width==390 {try (shadow.subviews.first as? UIImageView)?.image?.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-ground-shadow-raster.png"))}
                XCTAssertGreaterThan(shadow.bounds.width,0)
                XCTAssertLessThanOrEqual(shadow.center.y+shadow.bounds.height/2,preview.bounds.height)
                let image=UIGraphicsImageRenderer(bounds:window.bounds).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
                let name="backpack-shadow-\(die.id)-\(Int(width))"
                try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/\(name).png"))
                let attachment=XCTAttachment(image:image);attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)
                detail.dispose()
                await withCheckedContinuation {continuation in host.dismiss(animated:false){continuation.resume()}}
            }
        }
    }

    func testSettledHoneySpaceshipHopMovesWholeBodyAndItsShadow() async throws {
        let all=NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        let dice=all.filter{["honey","spaceship"].contains($0.id)}
        XCTAssertEqual(dice.count,2)
        for die in dice {
            let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
            defer{preview.dispose()}
            preview.frame=CGRect(x:0,y:0,width:342,height:380)
            preview.artworkFrame=CGRect(x:0,y:48,width:342,height:240)
            let deadline=Date().addingTimeInterval(15)
            while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(preview.ready,die.id)
            preview.layoutArtwork();preview.setActive(true);preview.isPaused=true
            let node=try XCTUnwrap(preview.dieNode),shadow=try XCTUnwrap(preview.groundShadow)
            preview.paintSelectedBounce(seconds:0);preview.refreshGroundShadow()
            let base=node.position,baseScale=CGPoint(x:node.xScale,y:node.yScale),restShadow=shadow.transform
            let peak=0.26
            preview.paintSelectedBounce(seconds:peak);preview.refreshGroundShadow()
            let raised=node.position,raisedScale=CGPoint(x:node.xScale,y:node.yScale),raisedShadow=shadow.transform
            XCTAssertEqual(raised.x,base.x,accuracy:0.000001,die.id)
            XCTAssertEqual(raised.y-base.y,8,accuracy:0.000001,"\(die.id): hop moves the whole selected root")
            XCTAssertLessThan(raisedShadow.a,restShadow.a,"\(die.id): original whole-body hop still drives shadow shrink")
            XCTAssertLessThan(raisedShadow.d,restShadow.d)
            preview.refreshGroundShadow();preview.refreshGroundShadow()
            XCTAssertEqual(shadow.transform,raisedShadow,"An unchanged pose cannot invent an independent shadow pulse")
            preview.paintSelectedBounce(seconds:0.9);preview.refreshGroundShadow()
            XCTAssertEqual(node.position,base,die.id)
            XCTAssertEqual(node.xScale,baseScale.x,accuracy:0.000001,die.id)
            XCTAssertEqual(node.yScale,baseScale.y,accuracy:0.000001,die.id)
            XCTAssertEqual(node.zRotation,0,accuracy:0.000001,die.id)
            XCTAssertEqual(shadow.transform.a,restShadow.a,accuracy:0.000001,die.id)
            XCTAssertEqual(shadow.transform.d,restShadow.d,accuracy:0.000001,die.id)
            preview.paintSelectedBounce(seconds:2.32+peak);preview.refreshGroundShadow()
            XCTAssertEqual(node.position.y,raised.y,accuracy:0.000001,"\(die.id): next cycle must use the same captured base")
            XCTAssertEqual(node.xScale,raisedScale.x,accuracy:0.000001,die.id)
            XCTAssertEqual(node.yScale,raisedScale.y,accuracy:0.000001,die.id)
            XCTAssertEqual(shadow.transform.a,raisedShadow.a,accuracy:0.000001,die.id)
            XCTAssertEqual(shadow.transform.d,raisedShadow.d,accuracy:0.000001,die.id)
        }
    }

    func testSelectedKantaTNTMagnetBottleFloatIsContinuousAndBounded() async throws {
        let all=NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach+NativeBackpackCatalog.arcade
        let dice=all.filter{["kanta","tnt","wild-magnet","bottle"].contains($0.id)}
        XCTAssertEqual(dice.count,4)
        for die in dice {
            let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
            defer{preview.dispose()}
            preview.frame=CGRect(x:0,y:0,width:342,height:380);preview.artworkFrame=CGRect(x:0,y:48,width:342,height:240)
            let deadline=Date().addingTimeInterval(15)
            while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(preview.ready,die.id);preview.layoutArtwork();preview.setActive(true);preview.isPaused=true
            let node=try XCTUnwrap(preview.dieNode),shadow=try XCTUnwrap(preview.groundShadow)
            preview.paintSelectedBounce(seconds:0);preview.refreshGroundShadow()
            let base=node.position,scale=node.xScale,rest=shadow.transform
            if die.id=="kanta" {
                let body=node.collectionAnimatedBodyBounds(normalizedBounds:CGRect(x:0,y:0,width:1,height:1))
                let center=node.convert(CGPoint(x:body.midX,y:body.midY),to:try XCTUnwrap(preview.scene))
                XCTAssertEqual(shadow.center.x,center.x,accuracy:0.001)
            }
            for fps in [60,120] {
                var previous=base,previousAngle:CGFloat=0
                for frame in 0...(fps*36/5) {
                    preview.paintSelectedBounce(seconds:Double(frame)/Double(fps))
                    XCTAssertEqual(node.position.x,base.x,accuracy:0.00001)
                    XCTAssertGreaterThanOrEqual(node.position.y-base.y,-0.00001)
                    XCTAssertLessThanOrEqual(node.position.y-base.y,20.00001)
                    XCTAssertLessThanOrEqual(abs(node.zRotation),14*CGFloat.pi/180+0.00001)
                    XCTAssertLessThan(abs(node.position.y-previous.y),0.6)
                    XCTAssertLessThan(abs(node.zRotation-previousAngle),0.009)
                    XCTAssertEqual(node.xScale,scale,accuracy:0.000001);XCTAssertEqual(node.yScale,scale,accuracy:0.000001)
                    previous=node.position;previousAngle=node.zRotation
                }
            }
            preview.paintSelectedBounce(seconds:0.9);XCTAssertEqual(node.zRotation,14*CGFloat.pi/180,accuracy:0.000001)
            preview.paintSelectedBounce(seconds:2.7);XCTAssertEqual(node.zRotation,-14*CGFloat.pi/180,accuracy:0.000001)
            preview.paintSelectedBounce(seconds:1.8);preview.paintGroundShadow(seconds:1.8)
            XCTAssertEqual(node.position.y-base.y,20,accuracy:0.000001)
            XCTAssertLessThan(shadow.transform.d,rest.d,die.id)
            preview.paintSelectedBounce(seconds:3.6);XCTAssertEqual(node.position,base)
            preview.dispose();XCTAssertNil(preview.scene);XCTAssertNil(shadow.superview)
        }
    }
    func testSelectedBloobBallFloatPreservesSizeAndGroundedShadow() async throws {
        let die=try XCTUnwrap(NativeBackpackCatalog.area.first{$0.id=="bloob-ball"})
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
        defer{preview.dispose();window.isHidden=true;window.rootViewController=nil}
        preview.frame=CGRect(x:0,y:0,width:342,height:360)
        preview.artworkFrame=CGRect(x:0,y:48,width:342,height:216);host.view.addSubview(preview)
        let deadline=Date().addingTimeInterval(15)
        while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(preview.ready);preview.layoutArtwork();preview.setActive(true);preview.isPaused=true
        let node=try XCTUnwrap(preview.dieNode),shadow=try XCTUnwrap(preview.groundShadow)
        preview.paintSelectedBounce(seconds:0);preview.paintGroundShadow(seconds:0)
        let base=node.position,scale=node.xScale,raster=shadow.bounds,floor=shadow.center.y
        let lowWidth=shadow.transform.a,lowAlpha=shadow.layer.opacity
        var previous=base,peak:CGFloat=0,highWidth:CGFloat=1,highAlpha:Float=1
        for frame in 1...456 {
            let t=Double(frame)/120
            preview.paintSelectedBounce(seconds:t);preview.paintGroundShadow(seconds:t)
            peak=max(peak,node.position.y-base.y)
            XCTAssertLessThan(abs(node.position.y-previous.y),0.4)
            XCTAssertLessThanOrEqual(abs(node.position.x-base.x),2.401)
            XCTAssertLessThanOrEqual(abs(node.zRotation),5*CGFloat.pi/180+0.00001)
            XCTAssertEqual(node.xScale,scale,accuracy:0.000001);XCTAssertEqual(node.yScale,scale,accuracy:0.000001)
            XCTAssertEqual(shadow.bounds,raster);XCTAssertEqual(shadow.center.y,floor,accuracy:0.001)
            if frame==228 {highWidth=shadow.transform.a;highAlpha=shadow.layer.opacity}
            previous=node.position
        }
        XCTAssertEqual(peak,24,accuracy:0.01)
        XCTAssertEqual(node.position.x,base.x,accuracy:0.0001);XCTAssertEqual(node.position.y,base.y,accuracy:0.0001)
        XCTAssertEqual(raster.width,193.8,accuracy:0.001);XCTAssertEqual(floor,280,accuracy:0.001)
        XCTAssertLessThan(highWidth,lowWidth);XCTAssertLessThan(highAlpha,lowAlpha)
        XCTAssertGreaterThan(highWidth,lowWidth*0.65)
        preview.dispose();XCTAssertNil(preview.scene);XCTAssertNil(shadow.superview)
    }
    func testSelectedShadowFortyPercentGainIsAppliedAfterBlur() throws {
        func peakAlpha(_ gain:CGFloat)throws->Double {
            let shadow=NativeArcadeThumbShadow(frame:CGRect(x:0,y:0,width:180,height:28),alphaGain:gain)
            shadow.layoutIfNeeded()
            let image=try XCTUnwrap((shadow.subviews.first as? UIImageView)?.image?.cgImage)
            let width=image.width,height=image.height
            var pixels=[UInt8](repeating:0,count:width*height*4)
            pixels.withUnsafeMutableBytes { bytes in
                let context=CGContext(data:bytes.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,
                    space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
                context.draw(image,in:CGRect(x:0,y:0,width:width,height:height))
            }
            return Double(stride(from:3,to:pixels.count,by:4).map{pixels[$0]}.max() ?? 0)
        }
        for base in [CGFloat(1),1.5,3] {
            let original=try peakAlpha(base),darkened=try peakAlpha(base*1.4)
            XCTAssertGreaterThan(original,0)
            XCTAssertEqual(darkened/original,1.4,accuracy:0.04,"Visible blurred pixels must gain40percent, not clip the unblurred gradient")
            let reduced=try peakAlpha(base*1.4*0.8)
            XCTAssertEqual(reduced/darkened,0.8,accuracy:0.04,"Latest20percent reduction must affect the actual blurred pixels")
        }
    }

}
