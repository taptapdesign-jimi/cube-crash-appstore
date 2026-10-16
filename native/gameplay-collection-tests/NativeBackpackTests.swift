import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeBackpackTests:XCTestCase {
    func testCatalogUsesCanonicalProgressAndExactWorldTotals() {
        XCTAssertEqual(NativeBackpackCatalog.arcade.map(\.id),["tnt","wild-magnet","cubero"])
        XCTAssertEqual(NativeBackpackCatalog.beach.first{$0.id=="wild-juice"}?.title,"JUICE")
        var progress=NativeProgressionState()
        var sections=NativeBackpackCatalog.sections(progress)
        XCTAssertEqual(sections.map{ $0.dice.count },[6,4,4]);XCTAssertEqual(sections.map(\.count),[0,0,0])
        progress.highestUnlockedJourneyBoard=7
        sections=NativeBackpackCatalog.sections(progress);XCTAssertEqual(sections.map(\.count),[6,0,0])
        progress.highestUnlockedJourneyBoard=24
        XCTAssertEqual(NativeBackpackCatalog.sections(progress).map(\.count),[0,4,0])
        progress.completedJourneyBoards=Set(1...23)
        XCTAssertEqual(NativeBackpackCatalog.sections(progress).map(\.count),[6,4,4])
        XCTAssertEqual(progress.completedJourneyBoards,Set(1...23));XCTAssertTrue(progress.unlockedSpecialDice.isEmpty)
        var legacy=NativeProgressionState();legacy.unlockedSpecialDice=["flower","juice"]
        XCTAssertEqual(NativeBackpackCatalog.sections(legacy).map(\.count),[1,0,1])
    }
    func testGridHasThreeArcadeAndTwoWorldColumnsAndLockedTapIsInert() throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let screen=NativeBackpackView(frame:CGRect(x:0,y:0,width:390,height:844),assets:assets)
        var progress=NativeProgressionState();progress.lastOpenedJourneyBoard=1
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
        XCTAssertEqual(screen.numberOfSections(in:screen.grid),4)
        XCTAssertEqual(screen.collectionView(screen.grid,numberOfItemsInSection:0),3)
        let world=screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,sizeForItemAt:IndexPath(item:0,section:1))
        XCTAssertEqual(world.width,153)
        var opened:[String]=[];screen.onDie={opened.append($0.id)}
        screen.collectionView(screen.grid,didSelectItemAt:IndexPath(item:1,section:1));XCTAssertTrue(opened.isEmpty)
        screen.collectionView(screen.grid,didSelectItemAt:IndexPath(item:0,section:1));XCTAssertEqual(opened,["wild-star"])
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
        XCTAssertNotNil(app.hub.backpackButton.imageView?.layer.animation(forKey:NativeHubBackpackFeedback.animationKey))
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
    func testSelectedDetailOwnsAnimationAndClosesOnce() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let detail=NativeBackpackDetail(die:NativeBackpackCatalog.forest[1],assets:assets,motion:motion)
        var closed=0,opened=0;detail.onClose={closed += 1};detail.onPresentationStarted={opened += 1}
        defer{detail.dispose();window.isHidden=true}
        host.present(detail,animated:false)
        let deadline=Date().addingTimeInterval(5)
        while !detail.card.isUserInteractionEnabled,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(detail.card.isUserInteractionEnabled);XCTAssertEqual(opened,1)
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
    }
    func testCuberoBoardPreviewRunsFromFirstVisibleFrameAndResumes() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let detail=NativeBackpackDetail(die:NativeBackpackCatalog.arcade[2],assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
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
        for die in [NativeBackpackCatalog.arcade[2],NativeBackpackCatalog.forest[5]] {
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
            XCTAssertEqual(detail.card.bounds.height-bottom,64,accuracy:4)
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
        XCTAssertEqual(detail.card.bounds.height-landingBottom,64,accuracy:0.5)
        XCTAssertEqual(node.collectionBodyBounds.height*node.yScale,162,accuracy:1,"Original visible Ball size is preserved")
        // Isolate original body pixels from the separately owned idle bubble field.
        node.childNode(withName:"die-visual")?.children.compactMap{$0 as? NativeIdleBubbleField}.forEach{$0.isHidden=true}
        node.tick(12.0/60+0.0001,suspended:false,viewportCenter:scene.size.width/2)
        let landing=try XCTUnwrap(preview.texture(from:scene,crop:CGRect(origin:.zero,size:scene.size)))
        let landingAlpha=NativeArtworkAlphaBounds.measure(UIImage(cgImage:landing.cgImage()))
        XCTAssertEqual(detail.card.bounds.height-landingAlpha.maxY*scene.size.height,64,accuracy:4,"Actual landing pixels")
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
    }
    func testDisposedModalRejectsPendingBoardPreparation() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let detail=NativeBackpackDetail(die:NativeBackpackCatalog.arcade[2],assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
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
        screen.apply(NativeBackpackCatalog.sections(progress));host.view.layoutIfNeeded();screen.grid.layoutIfNeeded()
        let image=UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}
        try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-screen.png"))
        XCTAssertGreaterThan(screen.grid.visibleCells.count,3)
        let arcadeImages=(0...2).compactMap { index in screen.grid.cellForItem(at:IndexPath(item:index,section:0))?.contentView.subviews.last as? UIImageView }
        XCTAssertEqual(arcadeImages.count,3)
        let visibleHeights=arcadeImages.compactMap { imageView -> CGFloat? in
            guard let image=imageView.image else{return nil}
            return min(imageView.bounds.width/image.size.width,imageView.bounds.height/image.size.height)*image.size.height*NativeBackpackDetail.visibleHeightRatio(image)
        }
        if visibleHeights.count==3 {
            XCTAssertEqual(visibleHeights[0]*0.9,visibleHeights[1],accuracy:0.5)
            XCTAssertEqual(visibleHeights[1],visibleHeights[2],accuracy:0.5)
            let cubero=arcadeImages[2],image=try XCTUnwrap(cubero.image)
            let alpha=NativeBackpackDetail.visibleArtworkBounds(image)
            let visibleRect=CGRect(x:cubero.frame.minX+alpha.minX*cubero.bounds.width,y:cubero.frame.minY+alpha.minY*cubero.bounds.height,width:alpha.width*cubero.bounds.width,height:alpha.height*cubero.bounds.height)
            let cellBounds=try XCTUnwrap(cubero.superview).bounds
            XCTAssertEqual(visibleRect.midX,cellBounds.midX,accuracy:0.5)
            XCTAssertEqual(visibleRect.midY,cellBounds.midY,accuracy:0.5)
            XCTAssertTrue(cellBounds.insetBy(dx:4,dy:4).contains(visibleRect))
            let tnt=try XCTUnwrap(arcadeImages[0].image)
            let previous=min(60/tnt.size.width,80/tnt.size.height)*tnt.size.height*NativeBackpackDetail.visibleHeightRatio(tnt)
            XCTAssertEqual(visibleHeights[0],previous*1.10,accuracy:0.5)
        }
        screen.grid.scrollToItem(at:IndexPath(item:5,section:1),at:.centeredVertically,animated:false);screen.grid.layoutIfNeeded()
        let barrelCell=try XCTUnwrap(screen.grid.cellForItem(at:IndexPath(item:5,section:1)))
        let barrelView=try XCTUnwrap(barrelCell.contentView.subviews.last as? UIImageView)
        let barrel=try XCTUnwrap(barrelView.image)
        XCTAssertEqual(barrel.size.width/barrel.size.height,1,accuracy:0.001)
        let barrelVisible=barrelView.bounds.height*NativeBackpackDetail.visibleHeightRatio(barrel)
        XCTAssertEqual(barrelVisible,120,accuracy:0.5)
        screen.grid.scrollToItem(at:IndexPath(item:0,section:2),at:.top,animated:false);screen.grid.layoutIfNeeded()
        let locked=UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}
        try locked.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-locked.png"))
        let cells=screen.grid.visibleCells
        let lockCell=try XCTUnwrap(cells.first)
        let images=lockCell.contentView.subviews.compactMap{$0 as? UIImageView}
        XCTAssertEqual(images.first?.bounds.size,CGSize(width:155,height:153))
        XCTAssertEqual(images.last?.bounds.size,CGSize(width:70,height:80))
        screen.grid.setContentOffset(CGPoint(x:0,y:-screen.grid.contentInset.top),animated:false);screen.grid.layoutIfNeeded()
        let detail=NativeBackpackDetail(die:NativeBackpackCatalog.forest[1],assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
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
                XCTAssertEqual(detail.card.bounds.height-bottom,64,accuracy:0.1,die.id)
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
        let detail=NativeBackpackDetail(die:NativeBackpackCatalog.forest[1],assets:assets,motion:motion)
        detail.loadViewIfNeeded();detail.setForeground(false);detail.setForeground(true);detail.dispose();detail.dispose()
        XCTAssertNil(detail.hero.image);XCTAssertNil(detail.hero.layer.animationKeys())
    }
}
