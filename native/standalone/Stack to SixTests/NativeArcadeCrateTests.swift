import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeArcadeCrateTests: XCTestCase {
    func testHubBoxAppendsJourneyDiscoveriesAcrossReopen()async throws {
        enum Unused:Error {case route}
        var progression=NativeProgressionState()
        _=progression.announceJourneyDie("robo-cube",board:21)
        var services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw Unused.route},markViewed:{_ in},makeGameplay:{_,_ in throw Unused.route},flush:{})
        services.journeyProgression={progression}
        let root=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let window=UIWindow(frame:UIDevice.current.userInterfaceIdiom == .pad ? UIScreen.main.bounds:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=root;window.makeKeyAndVisible()
        defer{root.dispose();window.isHidden=true;window.rootViewController=nil}
        func wait(_ predicate:()->Bool)async throws {
            let end=Date().addingTimeInterval(15)
            while !predicate(),Date()<end {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(predicate())
        }
        try await wait{root.home.isUserInteractionEnabled && !root.transitioning}
        root.home.onActivate?(1)
        try await wait{root.route == .arcadeHub && !root.transitioning}
        for count in [5,6] {
            root.arcadeHub.onCrate?()
            try await wait{root.route == .backpack && !root.transitioning}
            let screen=try XCTUnwrap(root.backpackView)
            XCTAssertEqual(screen.arcadeDice.map(\.id),NativeBackpackCatalog.arcade.map(\.id)+(count==5 ? ["robo-cube"]:["robo-cube","bee"]))
            XCTAssertEqual(screen.grid.numberOfItems(inSection:0),count)
            screen.close.sendActions(for:.touchUpInside)
            try await wait{root.route == .arcadeHub && !root.transitioning}
            if count==5 {_=progression.announceJourneyDie("bee",board:1)}
        }
        XCTAssertEqual(progression.journeyDiceUnlockOrder,["robo-cube","bee"])
        XCTAssertTrue(progression.completedJourneyBoards.isEmpty)
    }

    func testExpandedGameplayBoxScrollsWithoutShrinkingAndOpensLastDie()async throws {
        var progression=NativeProgressionState()
        for board in [21,1,11]+Array(2...30).filter{![11,21].contains($0)} {
            if let id=NativeJourneyContent.introductionID(board:board) {_=progression.announceJourneyDie(id,board:board)}
        }
        let dice=NativeBackpackCatalog.box(progression),assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        XCTAssertEqual(dice.count,22)
        let controller=NativeGameplayBackpackController(root:NativeTestResources.root,sections:[],includesArcade:true,arcadeDice:dice,motion:NativeRouteMotion(home:JimiV9HomeView(frame:.zero,assets:assets),hub:JimiV9HubView(frame:.zero,assets:assets)))
        let window=UIWindow(frame:UIDevice.current.userInterfaceIdiom == .pad ? UIScreen.main.bounds:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible()
        defer{controller.dispose();window.isHidden=true;window.rootViewController=nil}
        func wait(_ predicate:()->Bool)async throws {
            let end=Date().addingTimeInterval(15)
            while !predicate(),Date()<end {try await Task.sleep(for:.milliseconds(20))}
            XCTAssertTrue(predicate())
        }
        try await wait{controller.view.isUserInteractionEnabled && controller.screen?.entrySelectionEnabled==false}
        let screen=try XCTUnwrap(controller.screen)
        screen.grid.layoutIfNeeded()
        XCTAssertEqual(screen.grid.numberOfItems(inSection:0),22)
        XCTAssertTrue(screen.grid.isScrollEnabled)
        let last=IndexPath(item:21,section:0)
        let side=screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,sizeForItemAt:last).width
        XCTAssertEqual(side,floor((screen.bounds.width-48-32)/3),accuracy:0.001)
        XCTAssertGreaterThan(screen.grid.contentSize.height,screen.grid.bounds.height)
        let output="/tmp/progressive-box-\(UIDevice.current.userInterfaceIdiom == .pad ? "ipad":"iphone")"
        try UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}.pngData()?.write(to:URL(fileURLWithPath:output+"-top.png"))
        screen.grid.scrollToItem(at:last,at:.centeredVertically,animated:false);screen.grid.layoutIfNeeded()
        let cell=try XCTUnwrap(screen.grid.cellForItem(at:last))
        XCTAssertEqual(cell.accessibilityIdentifier,"native.backpack.die.\(dice[21].id)")
        let offset=screen.grid.contentOffset
        try UIGraphicsImageRenderer(bounds:window.bounds).image{window.layer.render(in:$0.cgContext)}.pngData()?.write(to:URL(fileURLWithPath:output+"-bottom.png"))
        screen.collectionView(screen.grid,didSelectItemAt:last)
        try await wait{controller.detail?.card.isUserInteractionEnabled == true}
        try XCTUnwrap(controller.detail).closeTapped()
        try await wait{controller.detail == nil && controller.view.isUserInteractionEnabled}
        XCTAssertEqual(screen.grid.contentOffset.y,offset.y,accuracy:0.01)
        XCTAssertEqual(screen.arcadeDice.map(\.id),dice.map(\.id))
    }

    func testMountedCrateScreenAndGameplayModalCaptureViewportEvidence() async throws {
        enum Unused: Error { case unavailable }
        let services = NativeAppServices(settings: { [:] }, setPreference: { _, _ in }, worldSnapshot: { _, _, _ in throw Unused.unavailable }, markViewed: { _ in }, makeGameplay: { _, _ in throw Unused.unavailable }, flush: {})
        func waitFor(_ predicate: () -> Bool) async throws {
            let end = Date().addingTimeInterval(8)
            while !predicate(), Date() < end { try await Task.sleep(for: .milliseconds(20)) }
            XCTAssertTrue(predicate())
        }
        func capture(_ view: UIView, _ filename: String) throws {
            let image = UIGraphicsImageRenderer(bounds: view.bounds).image { _ in
                XCTAssertTrue(view.drawHierarchy(in: view.bounds, afterScreenUpdates: true))
            }
            try XCTUnwrap(image.pngData()).write(to: URL(fileURLWithPath: "/tmp/" + filename))
            let attachment = XCTAttachment(image: image)
            attachment.name = filename; attachment.lifetime = .keepAlways; add(attachment)
        }
        func verifyCells(_ screen: NativeBackpackView, in viewport: UIView) throws {
            screen.layoutIfNeeded(); screen.grid.layoutIfNeeded()
            XCTAssertEqual(screen.grid.numberOfSections, 1)
            XCTAssertEqual(screen.grid.numberOfItems(inSection: 0), 4)
            for item in 0..<4 {
                let path = IndexPath(item: item, section: 0)
                let cell = try XCTUnwrap(screen.grid.cellForItem(at: path))
                let frame = cell.convert(cell.bounds, to: viewport)
                XCTAssertGreaterThanOrEqual(frame.minX, -0.001)
                XCTAssertLessThanOrEqual(frame.maxX, viewport.bounds.width + 0.001)
                XCTAssertGreaterThanOrEqual(frame.minY, -0.001)
                XCTAssertLessThanOrEqual(frame.maxY, viewport.bounds.height + 0.001)
                XCTAssertTrue(screen.grid.bounds.insetBy(dx:-0.001,dy:-0.001).contains(screen.grid.convert(cell.bounds,from:cell)))
                XCTAssertEqual(cell.accessibilityIdentifier, "native.backpack.die.\(NativeBackpackCatalog.arcade[item].id)")
            }
        }
        for size in [CGSize(width: 390, height: 844), CGSize(width: 320, height: 568)] {
            let root = NativeAppController(resourceRoot: NativeTestResources.root, services: services)
            let window = UIWindow(frame: CGRect(origin: .zero, size: size))
            window.rootViewController = root; window.makeKeyAndVisible(); root.loadViewIfNeeded()
            defer { root.dispose(); window.isHidden = true }
            try await waitFor { (!root.home.isEntering && root.home.isUserInteractionEnabled) }
            root.home.onActivate?(1)
            try await waitFor { root.route == .arcadeHub && !root.transitioning && root.arcadeHub.hub.scrollView.isUserInteractionEnabled }
            root.arcadeHub.onCrate?()
            try await waitFor { root.route == .backpack && root.backpackView?.isUserInteractionEnabled == true }
            let screen = try XCTUnwrap(root.backpackView)
            try verifyCells(screen, in: root.view)
            let suffix = size.width == 390 ? "" : "-320"
            try capture(root.view, "arcade-crate-screen" + suffix + ".png")
            let assets = JimiV9Artwork(resourceRoot: NativeTestResources.root)
            let modal = NativeGameplayBackpackController(root: NativeTestResources.root, sections: [], includesArcade: true, motion: NativeRouteMotion(home: JimiV9HomeView(frame: .zero, assets: assets), hub: JimiV9HubView(frame: .zero, assets: assets)))
            root.present(modal, animated: false)
            try await waitFor { modal.view.window != nil && modal.view.isUserInteractionEnabled && modal.card.alpha == 1 }
            let embedded = try XCTUnwrap(modal.screen)
            XCTAssertEqual(modal.heading.text, "Box")
            try verifyCells(embedded, in: modal.view)
            try capture(modal.view, "arcade-gameplay-crate-modal" + suffix + ".png")
            modal.dispose(); root.dismiss(animated: false)
        }
    }

    func testFullscreenCrateReusesArcadeSectionHeadingAndCountWithoutDescription() throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let screen=NativeBackpackView(frame:.init(x:0,y:0,width:390,height:844),assets:assets,title:"Box",arcadeCrate:true)
        screen.apply([]);screen.layoutIfNeeded();screen.grid.layoutIfNeeded()
        let header=screen.collectionView(screen.grid,viewForSupplementaryElementOfKind:UICollectionView.elementKindSectionHeader,at:.init(item:0,section:0))
        func labels(_ view:UIView)->[UILabel] {view.subviews.flatMap{($0 as? UILabel).map{[$0]} ?? labels($0)}}
        let text=labels(header).compactMap(\.text).filter{!$0.isEmpty}
        XCTAssertEqual(Set(text),Set(["Arcade","4 / 4"]))
        XCTAssertEqual(screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,referenceSizeForHeaderInSection:0).height,100)
        screen.useModalLayout()
        XCTAssertEqual(screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,referenceSizeForHeaderInSection:0).height,0)
    }

    func testGameplayCrateAndJourneyEmbeddedCellsFitTheirOwnViewport() throws {
        let assets = JimiV9Artwork(resourceRoot: NativeTestResources.root)
        let sections = NativeBackpackCatalog.sections(NativeProgressionState())
        func modal(arcade: Bool) -> NativeGameplayBackpackController {
            NativeGameplayBackpackController(root: NativeTestResources.root, sections: arcade ? [] : [sections[0]], includesArcade: arcade, motion: NativeRouteMotion(home: JimiV9HomeView(frame: .zero, assets: assets), hub: JimiV9HubView(frame: .zero, assets: assets)))
        }
        let crate = modal(arcade: true), journey = modal(arcade: false)
        defer { crate.dispose(); journey.dispose() }
        for controller in [crate, journey] {
            controller.loadViewIfNeeded()
            controller.view.frame = CGRect(x: 0, y: 0, width: 390, height: 844)
            controller.view.setNeedsLayout(); controller.view.layoutIfNeeded()
        }
        XCTAssertEqual(crate.heading.text, "Box")
        XCTAssertEqual(journey.heading.text, "Backpack")
        let crateScreen = try XCTUnwrap(crate.screen), journeyScreen = try XCTUnwrap(journey.screen)
        let path = IndexPath(item: 0, section: 0)
        XCTAssertEqual(crateScreen.collectionView(crateScreen.grid, numberOfItemsInSection: 0), 4)
        // Each modal fits its own subtitle/available height; the cell size may differ.
        for screen in [crateScreen,journeyScreen] {
            let size=screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,sizeForItemAt:path)
            let columns:CGFloat=screen.arcadeCrate ? 3:2
            let rows=ceil(CGFloat(screen.collectionView(screen.grid,numberOfItemsInSection:0))/columns)
            XCTAssertGreaterThan(size.width,0);XCTAssertEqual(size.width,size.height)
            XCTAssertLessThanOrEqual(rows*size.height+max(0,rows-1)*16,screen.bounds.height-32+0.1)
            XCTAssertLessThanOrEqual(size.width*columns+(columns-1)*16,screen.bounds.width-48)
        }
        XCTAssertLessThan(crate.card.bounds.height, journey.card.bounds.height)
        var selected: [NativeBackpackCatalog.Die] = []
        crateScreen.onDie = { selected.append($0) }
        for index in NativeBackpackCatalog.arcade.indices {
            crateScreen.collectionView(crateScreen.grid, didSelectItemAt: IndexPath(item: index, section: 0))
        }
        XCTAssertEqual(selected, NativeBackpackCatalog.arcade)
    }

    func testArcadeHUDCrateStaysOpenUntilExplicitCloseWithoutChangingBoard() async throws {
        let engine=NativeGameplayEngine(state:NativeBoardFactory.make(mode:.arcade,board:1,arcadeVariant:.endurance))
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),view=SKView(frame:CGRect(x:0,y:0,width:390,height:844))
        host.view=view;window.rootViewController=host;window.makeKeyAndVisible();view.presentScene(scene)
        defer{scene.dispose();view.presentScene(nil);window.isHidden=true}
        try await Task.sleep(for:.seconds(1))
        let help=try XCTUnwrap(scene.childNode(withName:"//native-game-help") as? SKSpriteNode)
        let closed=help.texture,size=help.size,before=engine.state
        XCTAssertEqual(size.width,36.8*0.8,accuracy:0.001);XCTAssertEqual(size.height,36.8*0.8,accuracy:0.001)
        scene.setBackpackPresented(true);scene.setSuspended(true,allowHUDFeedback:true)
        let open=help.texture
        XCTAssertTrue(scene.backpackPresented);XCTAssertFalse(open === closed);XCTAssertEqual(help.size,size)
        scene.refreshBackpackAlert(allowSuspendedPresentation:true)
        XCTAssertTrue(help.texture === open);XCTAssertNil(help.childNode(withName:"native-game-backpack-alert"))
        try await Task.sleep(for:.milliseconds(550))
        scene.setBackpackPresented(false);scene.setSuspended(true,allowHUDFeedback:true)
        try await Task.sleep(for:.milliseconds(550))
        XCTAssertFalse(scene.backpackPresented);XCTAssertTrue(help.texture === closed);XCTAssertEqual(engine.state,before)
    }

    func testArcadeHubBoxSpeechOnceAtAcceptedIconOpen() async throws {
        enum Unused:Error {case unavailable}
        let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw Unused.unavailable},markViewed:{_ in},makeGameplay:{_,_ in throw Unused.unavailable},flush:{})
        let root=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=root;window.makeKeyAndVisible()
        defer{root.dispose();window.isHidden=true}
        root.navigate(.arcadeHub,interrupt:true)
        let deadline=Date().addingTimeInterval(8)
        while !(root.route == .arcadeHub && !root.transitioning && root.arcadeHub.hub.scrollView.isUserInteractionEnabled),Date()<deadline {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(root.route,.arcadeHub);XCTAssertTrue(root.arcadeHub.hub.scrollView.isUserInteractionEnabled)
        var speech=0;root.onFeedback={if $0 == "collection-icon-speech" {speech += 1}}
        root.arcadeHub.hub.backpackButton.sendActions(for:.touchUpInside)
        root.arcadeHub.hub.backpackButton.sendActions(for:.touchUpInside)
        XCTAssertEqual(speech,1)
        let finish=Date().addingTimeInterval(8)
        while root.route != .backpack,Date()<finish {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertEqual(root.route,.backpack)
    }
    func testAcceptedGameplayCollectionOpensSpeakOnceForBackpackAndBox() async throws {
        enum Unused:Error {case unavailable}
        for mode in [NativeRunMode.journey,.arcade] {
            let services=NativeAppServices(settings:{[:]},setPreference:{_,_ in},worldSnapshot:{_,_,_ in throw Unused.unavailable},markViewed:{_ in},makeGameplay:{_,_ in throw Unused.unavailable},flush:{})
            let root=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
            let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=root;window.makeKeyAndVisible()
            let game=NativeGameplayViewController(engine:NativeGameplayEngine(state:NativeBoardFactory.make(mode:mode,board:1)),resourceRoot:NativeTestResources.root)
            root.addChild(game);game.view.frame=root.view.bounds;root.view.addSubview(game.view);game.didMove(toParent:root)
            game.boardScene?.layout(size:game.view.bounds.size,insets:.zero,animateEntry:false)
            let owner=NativeScoreOwner(gameplay:game,root:NativeTestResources.root,progression:{NativeProgressionState()})
            defer{owner.dispose();game.dispose();root.dispose();window.isHidden=true}
            var speech=0;owner.onFeedback={if $0 == "collection-icon-speech" {speech += 1}}
            owner.presentBackpack();owner.presentBackpack()
            XCTAssertEqual(speech,1);XCTAssertNotNil(game.presentedViewController)
            try await Task.sleep(for:.milliseconds(100))
        }
    }
    func testPureDiceRejectsProgrammaticGameplayCrateWithoutChangingBoard() {
        let engine = NativeGameplayEngine(state: NativeBoardFactory.make(mode: .arcade, board: 1, arcadeVariant: .pureDice))
        let gameplay = NativeGameplayViewController(engine: engine, resourceRoot: NativeTestResources.root)
        gameplay.loadViewIfNeeded()
        let before = engine.state
        let owner = NativeScoreOwner(gameplay: gameplay, root: NativeTestResources.root, progression: { NativeProgressionState() })
        var cues:[String]=[];owner.onFeedback={cues.append($0)}
        owner.presentBackpack()
        XCTAssertTrue(cues.isEmpty)
        XCTAssertNil(gameplay.presentedViewController)
        XCTAssertEqual(engine.state, before)
        owner.dispose(); gameplay.dispose()
    }

    func testCrateKeepsArcadeIdentityWithForestCellGeometry() throws {
        let assets = JimiV9Artwork(resourceRoot: NativeTestResources.root)
        let frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        let crate = NativeBackpackView(frame: frame, assets: assets, title: "Box", arcadeCrate: true)
        let forest = NativeBackpackView(frame: frame, assets: assets)
        let items = NativeBackpackCatalog.arcade
        XCTAssertEqual(items.map(\.id),["cubero","baloon","tnt","wild-magnet"])
        // Matching content in a normal Journey-style section isolates the
        // visual recipe from item identity and per-item artwork proportions.
        let section = NativeBackpackCatalog.Section(title: "Forest", dice: items, unlocked: Set(items.map(\.id)))
        forest.apply([section], includesArcade: false)
        crate.apply([section], includesArcade: false)
        crate.layoutIfNeeded(); forest.layoutIfNeeded()
        crate.grid.layoutIfNeeded(); forest.grid.layoutIfNeeded()
        XCTAssertEqual(crate.numberOfSections(in: crate.grid), 1)
        XCTAssertEqual(crate.collectionView(crate.grid, numberOfItemsInSection: 0), 4)
        XCTAssertTrue(crate.sections.isEmpty)
        XCTAssertEqual(crate.close.accessibilityLabel, "Close Box")
        XCTAssertTrue(crate.header.subviews.compactMap { $0 as? UILabel }.contains { $0.text == "Box" })
        var selected: [NativeBackpackCatalog.Die] = []
        crate.onDie = { selected.append($0) }
        for index in items.indices {
            let path = IndexPath(item: index, section: 0)
            let crateSize = crate.collectionView(crate.grid, layout: crate.grid.collectionViewLayout, sizeForItemAt: path)
            let forestSize = forest.collectionView(forest.grid, layout: forest.grid.collectionViewLayout, sizeForItemAt: path)
            XCTAssertEqual(crateSize, forestSize)
            let crateCell = crate.collectionView(crate.grid, cellForItemAt: path)
            let forestCell = forest.collectionView(forest.grid, cellForItemAt: path)
            crateCell.frame = CGRect(origin: .zero, size: crateSize)
            forestCell.frame = CGRect(origin: .zero, size: forestSize)
            crateCell.layoutIfNeeded(); forestCell.layoutIfNeeded()
            let crateImages = crateCell.contentView.subviews.flatMap{[$0]+$0.subviews}.compactMap { $0 as? UIImageView }.filter{!($0 is NativeBackpackAlertView)}
            let forestImages = forestCell.contentView.subviews.flatMap{[$0]+$0.subviews}.compactMap { $0 as? UIImageView }.filter{!($0 is NativeBackpackAlertView)}
            XCTAssertEqual(crateCell.contentView.subviews.first?.bounds,forestCell.contentView.subviews.first?.bounds)
            let ratio:CGFloat=items[index].id=="wild-magnet" ? 0.8:items[index].id=="tnt" ? 0.95:1
            XCTAssertEqual(try XCTUnwrap(crateImages.last).bounds.width,try XCTUnwrap(forestImages.last).bounds.width*ratio,accuracy:0.01)
            XCTAssertEqual(try XCTUnwrap(crateImages.last).bounds.height,try XCTUnwrap(forestImages.last).bounds.height*ratio,accuracy:0.01)
            XCTAssertEqual(crateImages.map(\.center), forestImages.map(\.center))
            XCTAssertEqual(crateImages.first?.image?.pngData(), forestImages.first?.image?.pngData())
            XCTAssertEqual(crateCell.accessibilityIdentifier, "native.backpack.die.\(items[index].id)")
            crate.collectionView(crate.grid, didSelectItemAt: path)
        }
        XCTAssertEqual(selected, items)
        let first = try XCTUnwrap(crate.grid.layoutAttributesForItem(at: IndexPath(item: 0, section: 0)))
        let second = try XCTUnwrap(crate.grid.layoutAttributesForItem(at: IndexPath(item: 1, section: 0)))
        let third = try XCTUnwrap(crate.grid.layoutAttributesForItem(at: IndexPath(item: 2, section: 0)))
        XCTAssertEqual(first.frame.minY, second.frame.minY, accuracy: 0.001)
        XCTAssertGreaterThan(second.frame.minX, first.frame.minX)
        XCTAssertEqual(third.frame.minY,first.frame.minY,accuracy:0.001)
        XCTAssertGreaterThan(third.frame.minX,second.frame.minX)
        let fourth=try XCTUnwrap(crate.grid.layoutAttributesForItem(at:IndexPath(item:3,section:0)))
        XCTAssertGreaterThan(fourth.frame.minY,first.frame.minY)
        XCTAssertEqual(fourth.frame.minX,first.frame.minX,accuracy:0.001)
        let normal = NativeBackpackView(frame: frame, assets: assets)
        normal.apply([section])
        XCTAssertEqual(normal.numberOfSections(in: normal.grid), 1)
        XCTAssertEqual(normal.collectionView(normal.grid, layout: normal.grid.collectionViewLayout, sizeForItemAt: IndexPath(item: 0, section: 0)).width, first.frame.width)
    }
}
