import XCTest
import UIKit
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
    func testGridHasThreeArcadeAndTwoWorldColumnsAndLockedTapIsInert() {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let screen=NativeBackpackView(frame:CGRect(x:0,y:0,width:390,height:844),assets:assets)
        var progress=NativeProgressionState();progress.lastOpenedJourneyBoard=1
        screen.apply(NativeBackpackCatalog.sections(progress));screen.layoutIfNeeded()
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
        let entryDeadline=Date().addingTimeInterval(6)
        while app.backpackView?.isUserInteractionEnabled != true,Date()<entryDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(app.route,.backpack);XCTAssertTrue(app.backpackView?.isUserInteractionEnabled == true)
        app.backpackView?.close.sendActions(for:.touchUpInside);XCTAssertEqual(app.route,.backpack)
        let returnDeadline=Date().addingTimeInterval(6)
        while (app.route != .hub || !app.hub.isUserInteractionEnabled),Date()<returnDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(app.route,.hub);XCTAssertTrue(app.backpackView?.isHidden == true)
        app.navigate(.backpack);app.navigate(.settings,interrupt:true)
        try await Task.sleep(for:.seconds(1.8));XCTAssertEqual(app.route,.settings);XCTAssertTrue(app.backpackView?.isHidden == true)
    }
    func testSelectedDetailOwnsAnimationAndClosesOnce() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=host;window.makeKeyAndVisible()
        let detail=NativeBackpackDetail(die:NativeBackpackCatalog.forest[1],assets:assets,motion:motion)
        var closed=0;detail.onClose={closed += 1}
        defer{detail.dispose();window.isHidden=true}
        host.present(detail,animated:false)
        let deadline=Date().addingTimeInterval(5)
        while !detail.card.isUserInteractionEnabled,Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(detail.card.isUserInteractionEnabled)
        if !UIAccessibility.isReduceMotionEnabled {XCTAssertNotNil(detail.hero.layer.animation(forKey:"backpack.detail.frames"))}
        detail.setForeground(false);XCTAssertNil(detail.hero.layer.animationKeys());detail.setForeground(true)
        detail.closeTapped();detail.closeTapped()
        let closedDeadline=Date().addingTimeInterval(5)
        while closed==0,Date()<closedDeadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(closed,1);XCTAssertNil(detail.hero.image);XCTAssertNil(host.presentedViewController)
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
            XCTAssertEqual(visibleHeights[0],visibleHeights[1],accuracy:0.5)
            XCTAssertEqual(visibleHeights[0],visibleHeights[2],accuracy:0.5)
            let tnt=try XCTUnwrap(arcadeImages[0].image)
            let previous=min(60/tnt.size.width,80/tnt.size.height)*tnt.size.height*NativeBackpackDetail.visibleHeightRatio(tnt)
            XCTAssertEqual(visibleHeights[0],previous*1.10,accuracy:0.5)
        }
        screen.grid.scrollToItem(at:IndexPath(item:0,section:2),at:.top,animated:false);screen.grid.layoutIfNeeded()
        let locked=UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}
        try locked.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-locked.png"))
        let cells=screen.grid.visibleCells
        let lockCell=try XCTUnwrap(cells.first)
        let images=lockCell.contentView.subviews.compactMap{$0 as? UIImageView}
        XCTAssertEqual(images.first?.bounds.size,CGSize(width:155,height:153))
        XCTAssertEqual(images.last?.bounds.size,CGSize(width:70,height:80))
        screen.grid.setContentOffset(.zero,animated:false);screen.grid.layoutIfNeeded()
        let detail=NativeBackpackDetail(die:NativeBackpackCatalog.forest[1],assets:assets,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        host.addChild(detail);detail.view.frame=window.bounds;host.view.addSubview(detail.view);detail.didMove(toParent:host);detail.card.alpha=1;detail.view.layoutIfNeeded()
        let modal=UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}
        try modal.pngData()?.write(to:URL(fileURLWithPath:"/tmp/backpack-detail.png"));detail.dispose()
    }
    func testEveryDetailUsesVisible180PointArtworkAndTextHuggingBadge() {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let dice=NativeBackpackCatalog.arcade+NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach
        for die in dice {
            let motion=NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets))
            let detail=NativeBackpackDetail(die:die,assets:assets,motion:motion)
            detail.loadViewIfNeeded();detail.view.frame=CGRect(x:0,y:0,width:390,height:844);detail.view.layoutIfNeeded()
            if let image=detail.hero.image {
                let visible=detail.hero.bounds.height*NativeBackpackDetail.visibleHeightRatio(image)
                XCTAssertEqual(visible,180,accuracy:1,die.id)
            }else{XCTFail("Missing artwork \(die.id)")}
            XCTAssertLessThan(detail.badge.bounds.width,detail.card.bounds.width*0.65,die.id)
            XCTAssertGreaterThanOrEqual(detail.badge.bounds.width,detail.badge.intrinsicContentSize.width+20,die.id)
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
