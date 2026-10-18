import XCTest
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeArcadeCrateTests: XCTestCase {
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
            XCTAssertEqual(screen.grid.numberOfItems(inSection: 0), 3)
            for item in 0..<3 {
                let path = IndexPath(item: item, section: 0)
                let cell = try XCTUnwrap(screen.grid.cellForItem(at: path))
                let frame = cell.convert(cell.bounds, to: viewport)
                XCTAssertGreaterThanOrEqual(frame.minX, -0.001)
                XCTAssertLessThanOrEqual(frame.maxX, viewport.bounds.width + 0.001)
                XCTAssertGreaterThanOrEqual(frame.minY, -0.001)
                XCTAssertLessThanOrEqual(frame.maxY, viewport.bounds.height + 0.001)
                XCTAssertTrue(screen.grid.bounds.insetBy(dx: -0.001, dy: -0.001).contains(cell.frame))
                XCTAssertEqual(cell.accessibilityIdentifier, "native.backpack.die.\(NativeBackpackCatalog.arcade[item].id)")
            }
        }
        for size in [CGSize(width: 390, height: 844), CGSize(width: 320, height: 568)] {
            let root = NativeAppController(resourceRoot: NativeTestResources.root, services: services)
            let window = UIWindow(frame: CGRect(origin: .zero, size: size))
            window.rootViewController = root; window.makeKeyAndVisible(); root.loadViewIfNeeded()
            defer { root.dispose(); window.isHidden = true }
            try await waitFor { root.home.isUserInteractionEnabled }
            root.home.onActivate?(1)
            try await waitFor { root.route == .arcadeHub && root.arcadeHub.hub.scrollView.isUserInteractionEnabled }
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
            XCTAssertEqual(modal.heading.text, "Dice Box")
            try verifyCells(embedded, in: modal.view)
            try capture(modal.view, "arcade-gameplay-crate-modal" + suffix + ".png")
            modal.dispose(); root.dismiss(animated: false)
        }
    }

    func testFullscreenCrateReusesArcadeSectionHeadingAndCountWithoutDescription() throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let screen=NativeBackpackView(frame:.init(x:0,y:0,width:390,height:844),assets:assets,title:"Dice Box",arcadeCrate:true)
        screen.apply([]);screen.layoutIfNeeded();screen.grid.layoutIfNeeded()
        let header=screen.collectionView(screen.grid,viewForSupplementaryElementOfKind:UICollectionView.elementKindSectionHeader,at:.init(item:0,section:0))
        func labels(_ view:UIView)->[UILabel] {view.subviews.flatMap{($0 as? UILabel).map{[$0]} ?? labels($0)}}
        let text=labels(header).compactMap(\.text).filter{!$0.isEmpty}
        XCTAssertEqual(Set(text),Set(["Arcade","3 / 3"]))
        XCTAssertEqual(screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,referenceSizeForHeaderInSection:0).height,100)
        screen.useModalLayout()
        XCTAssertEqual(screen.collectionView(screen.grid,layout:screen.grid.collectionViewLayout,referenceSizeForHeaderInSection:0).height,0)
    }

    func testGameplayCrateMatchesJourneyEmbeddedCellSizes() throws {
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
        XCTAssertEqual(crate.heading.text, "Dice Box")
        XCTAssertEqual(journey.heading.text, "Backpack")
        let crateScreen = try XCTUnwrap(crate.screen), journeyScreen = try XCTUnwrap(journey.screen)
        let path = IndexPath(item: 0, section: 0)
        XCTAssertEqual(crateScreen.collectionView(crateScreen.grid, numberOfItemsInSection: 0), 3)
        XCTAssertEqual(crateScreen.collectionView(crateScreen.grid, layout: crateScreen.grid.collectionViewLayout, sizeForItemAt: path), journeyScreen.collectionView(journeyScreen.grid, layout: journeyScreen.grid.collectionViewLayout, sizeForItemAt: path))
        XCTAssertLessThan(crate.card.bounds.height, journey.card.bounds.height)
        var selected: [NativeBackpackCatalog.Die] = []
        crateScreen.onDie = { selected.append($0) }
        for index in NativeBackpackCatalog.arcade.indices {
            crateScreen.collectionView(crateScreen.grid, didSelectItemAt: IndexPath(item: index, section: 0))
        }
        XCTAssertEqual(selected, NativeBackpackCatalog.arcade)
    }

    func testPureDiceRejectsProgrammaticGameplayCrateWithoutChangingBoard() {
        let engine = NativeGameplayEngine(state: NativeBoardFactory.make(mode: .arcade, board: 1, arcadeVariant: .pureDice))
        let gameplay = NativeGameplayViewController(engine: engine, resourceRoot: NativeTestResources.root)
        gameplay.loadViewIfNeeded()
        let before = engine.state
        let owner = NativeScoreOwner(gameplay: gameplay, root: NativeTestResources.root, progression: { NativeProgressionState() })
        owner.presentBackpack()
        XCTAssertNil(gameplay.presentedViewController)
        XCTAssertEqual(engine.state, before)
        owner.dispose(); gameplay.dispose()
    }

    func testCrateKeepsArcadeIdentityWithForestCellGeometry() throws {
        let assets = JimiV9Artwork(resourceRoot: NativeTestResources.root)
        let frame = CGRect(x: 0, y: 0, width: 390, height: 844)
        let crate = NativeBackpackView(frame: frame, assets: assets, title: "Dice Box", arcadeCrate: true)
        let forest = NativeBackpackView(frame: frame, assets: assets)
        let items = NativeBackpackCatalog.arcade
        // Matching content in a normal Journey-style section isolates the
        // visual recipe from item identity and per-item artwork proportions.
        let section = NativeBackpackCatalog.Section(title: "Forest", dice: items, unlocked: Set(items.map(\.id)))
        forest.apply([section], includesArcade: false)
        crate.apply([section], includesArcade: false)
        crate.layoutIfNeeded(); forest.layoutIfNeeded()
        crate.grid.layoutIfNeeded(); forest.grid.layoutIfNeeded()
        XCTAssertEqual(crate.numberOfSections(in: crate.grid), 1)
        XCTAssertEqual(crate.collectionView(crate.grid, numberOfItemsInSection: 0), 3)
        XCTAssertTrue(crate.sections.isEmpty)
        XCTAssertEqual(crate.close.accessibilityLabel, "Close Dice Box")
        XCTAssertTrue(crate.header.subviews.compactMap { $0 as? UILabel }.contains { $0.text == "Dice Box" })
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
            let crateImages = crateCell.contentView.subviews.compactMap { $0 as? UIImageView }
            let forestImages = forestCell.contentView.subviews.compactMap { $0 as? UIImageView }
            XCTAssertEqual(crateImages.first?.bounds,forestImages.first?.bounds)
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
        XCTAssertGreaterThan(third.frame.minY, first.frame.minY)
        XCTAssertEqual(third.frame.minX, first.frame.minX, accuracy: 0.001)
        let normal = NativeBackpackView(frame: frame, assets: assets)
        normal.apply([section])
        XCTAssertEqual(normal.numberOfSections(in: normal.grid), 1)
        XCTAssertEqual(normal.collectionView(normal.grid, layout: normal.grid.collectionViewLayout, sizeForItemAt: IndexPath(item: 0, section: 0)).width, first.frame.width)
    }
}
