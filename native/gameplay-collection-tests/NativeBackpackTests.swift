import StackToSixGameplay
import XCTest
import UIKit
import SpriteKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeBackpackTests:XCTestCase {
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
        while !controller.view.isUserInteractionEnabled,Date()<returnDeadline {try await Task.sleep(for:.milliseconds(20))}
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
            XCTAssertEqual((screen.grid.collectionViewLayout as? UICollectionViewFlowLayout)?.sectionInset.left,24)
            XCTAssertEqual(screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,sizeForItemAt:IndexPath(item:0,section:0)).width,139)
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
            XCTAssertEqual(section.unlocked,[first])
            progress.finishAttempt(mode:.journey,board:board,score:100,longestCombo:1,cubesCracked:2,clean:true)
            let next=NativeBackpackCatalog.sections(progress).first{$0.title==title}!
            XCTAssertTrue(next.unlocked.contains(first));XCTAssertTrue(next.unlocked.contains(second))
        }
    }
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
    func testGridStartsWithForestAndTwoWorldColumnsAndLockedTapIsInert() throws {
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
        XCTAssertEqual(screen.numberOfSections(in:screen.grid),3)
        XCTAssertEqual(screen.collectionView(screen.grid,numberOfItemsInSection:0),6)
        let world=screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,sizeForItemAt:IndexPath(item:0,section:0))
        XCTAssertEqual(world.width,153)
        var opened:[String]=[];screen.onDie={opened.append($0.id)}
        screen.collectionView(screen.grid,didSelectItemAt:IndexPath(item:1,section:0));XCTAssertTrue(opened.isEmpty)
        screen.collectionView(screen.grid,didSelectItemAt:IndexPath(item:0,section:0));XCTAssertEqual(opened,["wild-star"])
    }
    func testSelectedDieFeedbackUsesWholeCardAndReuseRetiresIt() throws {
        let screen=NativeBackpackView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        var progress=NativeProgressionState();progress.lastOpenedJourneyBoard=1
        screen.apply(NativeBackpackCatalog.sections(progress));screen.grid.layoutIfNeeded()
        let index=IndexPath(item:0,section:0)
        let cell=try XCTUnwrap(screen.grid.cellForItem(at:index))
        var selected=false
        screen.onDie={_ in selected=true}
        screen.collectionView(screen.grid,didSelectItemAt:index)
        XCTAssertTrue(selected)
        let artwork=try XCTUnwrap(cell.contentView.subviews.last)
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
        XCTAssertFalse(screen.includesArcade)
        XCTAssertEqual(screen.numberOfSections(in:screen.grid),3)
        let sectionHeader=try XCTUnwrap(screen.grid.supplementaryView(forElementKind:UICollectionView.elementKindSectionHeader,at:IndexPath(item:0,section:0)))
        let texts=sectionHeader.subviews.compactMap{($0 as? UILabel)?.text}
        XCTAssertTrue(texts.contains("Forest"))
        XCTAssertFalse(texts.contains("Arcade"))
        XCTAssertFalse(texts.contains(where:{$0.contains("Always ready to play")}))
        screen.grid.scrollToItem(at:IndexPath(item:5,section:0),at:.centeredVertically,animated:false);screen.grid.layoutIfNeeded()
        let barrelCell=try XCTUnwrap(screen.grid.cellForItem(at:IndexPath(item:5,section:0)))
        let barrelView=try XCTUnwrap(barrelCell.contentView.subviews.last as? UIImageView)
        let barrel=try XCTUnwrap(barrelView.image)
        XCTAssertEqual(barrel.size.width/barrel.size.height,1,accuracy:0.001)
        let barrelVisible=barrelView.bounds.height*NativeBackpackDetail.visibleHeightRatio(barrel)
        XCTAssertEqual(barrelVisible,120*0.855,accuracy:0.5,"Retain the accepted grid-only Barrel reductions; modal size is unchanged")
        screen.grid.scrollToItem(at:IndexPath(item:0,section:1),at:.top,animated:false);screen.grid.layoutIfNeeded()
        let locked=UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}
        try locked.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-locked.png"))
        let cells=screen.grid.visibleCells
        let lockCell=try XCTUnwrap(cells.first)
        let images=lockCell.contentView.subviews.compactMap{$0 as? UIImageView}
        XCTAssertEqual(images.first?.bounds.size,CGSize(width:155,height:153))
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
    func testMountedAllSeventeenBackpackDetailsRetireAndHeavyReopensDoNotRetainOwners() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        defer{host.dismiss(animated:false);window.isHidden=true;window.rootViewController=nil}
        let all=NativeBackpackCatalog.arcade+NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        XCTAssertEqual(all.count,17)
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
        let all=NativeBackpackCatalog.arcade+NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        XCTAssertEqual(all.count,17)
        for die in all {
            let preview=NativeBackpackDicePreview(die:die,root:NativeTestResources.root)
            defer{preview.dispose()}
            preview.frame=CGRect(x:0,y:0,width:342,height:360)
            preview.artworkFrame=CGRect(x:0,y:48,width:342,height:216)
            let deadline=Date().addingTimeInterval(15)
            while !preview.ready,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(preview.ready,die.id)
            preview.layoutArtwork();preview.refreshGroundShadow()
            let shadow=try XCTUnwrap(preview.groundShadow,die.id)
            XCTAssertTrue(shadow.superview === preview)
            XCTAssertFalse(shadow.isHidden,die.id)
            XCTAssertNotNil((shadow.subviews.first as? UIImageView)?.image,"\(die.id): original Arcade shadow must contain painted pixels")
            let rasterBounds=shadow.bounds
            let widthFactor:CGFloat=die.id=="kanta" ? 0.7:die.id=="spaceship" ? 0.96:die.id=="bottle" ? 0.8*0.85:["beach-ball","wild-juice"].contains(die.id) ? 0.8:1
            XCTAssertEqual(rasterBounds.width,228*widthFactor,accuracy:0.01,"Sequential per-die width adjustments retain the shared Laser profile")
            XCTAssertEqual(rasterBounds.height,228/1.11*0.15,accuracy:0.01)
            XCTAssertGreaterThan(rasterBounds.width,0)
            XCTAssertGreaterThan(rasterBounds.height,0)
            if ["fish","spaceship","bee","flower","laser-gun"].contains(die.id) {
                XCTAssertEqual(shadow.center.y-rasterBounds.height/2,272,accuracy:0.01,"\(die.id): retained floor264 + gap8")
            }else{
                XCTAssertEqual(shadow.center.y,["honey","kanta"].contains(die.id) ? 260:264,accuracy:0.01,"\(die.id): shadow overlaps the body floor without a gap")
            }
            preview.setActive(true);preview.isPaused=true
            let node=try XCTUnwrap(preview.dieNode)
            for _ in 0..<20 {
                node.tick(1.0/60,suspended:false,viewportCenter:171)
                preview.refreshGroundShadow()
                XCTAssertEqual(shadow.bounds,rasterBounds,"\(die.id): animated size must reuse the same cached raster")
            }
            preview.setActive(false)
            if die.id=="kanta" {
                let rear=try XCTUnwrap(preview.rearCanShadow)
                XCTAssertFalse(rear.isHidden)
                XCTAssertLessThan(rear.center.x,shadow.center.x)
                XCTAssertEqual(rear.center.y,shadow.center.y-16,accuracy:0.001)
                let rearBody=try XCTUnwrap(node.collectionRearCanCenter(in:try XCTUnwrap(preview.scene)))
                XCTAssertEqual(rear.center.x,rearBody.x,accuracy:0.001)
                XCTAssertEqual(rear.bounds.width,228*0.7*0.8,accuracy:0.001)
                XCTAssertEqual(rear.transform,shadow.transform)
            }else{XCTAssertNil(preview.rearCanShadow)}
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
        let dice=[NativeBackpackCatalog.arcade[0]]+NativeBackpackCatalog.beach.filter{$0.id=="beach-ball"}
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
                XCTAssertEqual(shadow.center.x,center.x+34,accuracy:0.001)
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
            preview.paintSelectedBounce(seconds:1.8);preview.refreshGroundShadow()
            XCTAssertEqual(node.position.y-base.y,20,accuracy:0.000001)
            XCTAssertLessThan(shadow.transform.d,rest.d)
            preview.paintSelectedBounce(seconds:3.6);XCTAssertEqual(node.position,base)
            preview.dispose();XCTAssertNil(preview.scene);XCTAssertNil(shadow.superview)
        }
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
