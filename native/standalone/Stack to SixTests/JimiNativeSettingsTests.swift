import XCTest
import UIKit
import SpriteKit
import WebKit
import StackToSixNativeState
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
private final class SettingsRouteWebView: WKWebView {
    var scripts: [String] = []
    override func evaluateJavaScript(_ script: String, completionHandler: (@MainActor @Sendable (Any?, Error?) -> Void)? = nil) {
        scripts.append(script); completionHandler?(true, nil)
    }
}

@MainActor
final class JimiNativeSettingsTests: XCTestCase {
    func testPrivacyCloseAndDeveloperBackEmitOnceAtActivation() {
        let art=JimiV9Artwork(resourceRoot:NativeTestResources.root),settings=JimiNativeSettingsView(frame:.zero,assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
        var developerBack=0;settings.onDeveloperClose={developerBack += 1}
        settings.setDeveloperPanelVisible(true);settings.back.sendActions(for:.touchUpInside)
        XCTAssertEqual(developerBack,1)
        let privacy=JimiNativePrivacyController(assets:art);privacy.loadViewIfNeeded()
        var closes=0;privacy.onCloseRequested={closes += 1}
        privacy.close.sendActions(for:.touchUpInside);privacy.close.sendActions(for:.touchUpInside)
        XCTAssertEqual(closes,1)
        privacy.viewDidDisappear(false);XCTAssertNil(privacy.onCloseRequested)
    }
    override func setUpWithError() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator only; never drive the physical phone")
        #endif
        guard ["1018BE2D-491B-465F-8F75-3E5BEB38C22A", "8EB29A64-6C35-4FB7-A749-DE12906E3899"].contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else { throw XCTSkip("Isolated Settings/Developer QA Simulator only") }
    }
    func testAcceptedStatusChangesBounceOnlyChangedVisibleLabelsAndCancelOnExit() throws {
        let view = JimiNativeSettingsView(frame: CGRect(x:0,y:0,width:390,height:844), assets:JimiV9Artwork(resourceRoot:root))
        let window = UIWindow(frame:view.bounds); let host = UIViewController()
        window.rootViewController = host; host.view.addSubview(view); window.isHidden = false
        defer { window.isHidden = true }
        var value = preferences
        XCTAssertTrue(view.apply(value))
        let labels = try view.rows.map { row in try XCTUnwrap(row.subviews.compactMap { $0 as? UILabel }.first { $0.accessibilityIdentifier?.hasPrefix("native.settings.status.") == true }) }
        let key = NativeHubBackpackFeedback.animationKey
        XCTAssertTrue(labels.allSatisfy { $0.layer.animation(forKey:key) == nil })
        value["musicEnabled"] = false
        XCTAssertTrue(view.apply(value)); XCTAssertEqual(labels[1].text,"OFF")
        XCTAssertEqual(labels[1].frame.minX,0,accuracy:0.001)
        XCTAssertLessThan(labels[1].bounds.width,100,"Text bounces around its own glyphs, not the wide row")
        if !UIAccessibility.isReduceMotionEnabled {
            XCTAssertNotNil(labels[1].layer.animation(forKey:key))
            let animation = labels[1].layer.animation(forKey:key)
            XCTAssertTrue(view.apply(value))
            XCTAssertEqual(labels[1].layer.animation(forKey:key)?.beginTime,animation?.beginTime,"Unchanged snapshots do not replay")
            XCTAssertNil(labels[0].layer.animation(forKey:key)); XCTAssertNil(labels[2].layer.animation(forKey:key))
            value["musicEnabled"] = true
            XCTAssertTrue(view.apply(value)); XCTAssertEqual(labels[1].text,"ON")
            XCTAssertEqual(labels[1].layer.animationKeys()?.filter { $0 == key }.count,1,"Rapid changes replace one finite animation")
        }
        _ = view.tracks(enter:false)
        XCTAssertTrue(labels.allSatisfy { $0.layer.animation(forKey:key) == nil })
        view.removeFromSuperview()
        XCTAssertTrue(labels.allSatisfy { $0.layer.animation(forKey:key) == nil })
    }
    private var root: URL { NativeTestResources.root }
    private var preferences: [String: Any] { ["presentationEpoch": 10, "gameSoundsEnabled": false, "musicEnabled": true, "hapticsEnabled": true, "developerToolsAvailable": true] }

    func testDeveloperEntryUsesPWAArtworkAndReturnsToSettingsWithoutLeavingRoute() {
        let settings=JimiNativeSettingsView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:root))
        var value=preferences;value["firstPlayRequired"]=false
        XCTAssertTrue(settings.apply(value));settings.layoutSubviews()
        settings.header.layoutIfNeeded()
        XCTAssertEqual(settings.header.frame.minX,0)
        XCTAssertEqual(settings.header.bounds.width,settings.bounds.width)
        XCTAssertNil(settings.header.viewWithTag(99))
        XCTAssertEqual(settings.header.layer.shadowOpacity,0.16,accuracy:0.001)
        XCTAssertEqual(settings.header.layer.shadowOffset,CGSize(width:0,height:4))
        XCTAssertEqual(settings.header.layer.shadowPath?.boundingBox,settings.header.bounds)
        let paper=NativeAppPaperSurface(artwork:JimiV9Artwork(resourceRoot:root))
        paper.frame=settings.bounds;paper.layoutIfNeeded()
        let image=UIGraphicsImageRenderer(bounds:settings.bounds).image{context in
            paper.layer.render(in:context.cgContext)
            settings.layer.render(in:context.cgContext)
        }
        let attachment=XCTAttachment(image:image);attachment.name="Settings shared Journey navigation header";attachment.lifetime = .keepAlways;add(attachment)
        XCTAssertFalse(settings.developer.isHidden);XCTAssertNotNil(settings.developer.image(for:.normal))
        XCTAssertEqual(settings.developer.convert(settings.developer.bounds,to:settings).maxX,366,accuracy:0.001)
        settings.onDeveloper={epoch in XCTAssertEqual(epoch,10);settings.setDeveloperPanelVisible(true)}
        settings.developer.sendActions(for:.touchUpInside)
        XCTAssertTrue(settings.developerPanelVisible);XCTAssertTrue(settings.developer.isHidden)
        var commands=0,exits=0
        settings.onPreference={key,enabled,epoch in
            XCTAssertEqual(key,"firstPlayRequired");XCTAssertTrue(enabled);XCTAssertEqual(epoch,10);commands += 1
        }
        settings.onBack={exits += 1}
        settings.firstPlay.sendActions(for:.touchUpInside);XCTAssertEqual(commands,1)
        settings.back.sendActions(for:.touchUpInside)
        XCTAssertFalse(settings.developerPanelVisible);XCTAssertEqual(exits,0)
        settings.back.sendActions(for:.touchUpInside);XCTAssertEqual(exits,1)
        settings.setDeveloperPanelVisible(true);value["developerToolsAvailable"]=false
        XCTAssertTrue(settings.apply(value));XCTAssertFalse(settings.developerPanelVisible)
    }

    func testEveryNativeDeveloperButtonDispatchesOnlyWhilePanelIsVisibleAndFitsSmallPhone() {
        let settings = JimiNativeSettingsView(frame: CGRect(x: 0,y: 0,width: 320,height: 568),assets: JimiV9Artwork(resourceRoot: root))
        XCTAssertTrue(settings.apply(preferences))
        var actions: [NativeDeveloperAction] = []
        settings.onDeveloperAction = { action, epoch in XCTAssertEqual(epoch,10); actions.append(action) }
        for button in settings.developerButtons { button.sendActions(for: .touchUpInside) }
        XCTAssertTrue(actions.isEmpty)
        settings.setDeveloperPanelVisible(true); settings.layoutSubviews()
        XCTAssertEqual(settings.developerButtons.compactMap { $0.title(for: .normal) },["Show Card","Hide Card","Legendary Card","Reset Stage","New Card","Clean Stage","End Game","LAST MERGE"])
        for button in settings.developerButtons {
            XCTAssertFalse(button.isHidden); XCTAssertGreaterThanOrEqual(button.cartoonBounceFrame.minX,24)
            XCTAssertLessThanOrEqual(button.cartoonBounceFrame.maxX,296); XCTAssertGreaterThanOrEqual(button.bounds.height,44)
            button.sendActions(for: .touchUpInside)
        }
        XCTAssertEqual(actions,NativeDeveloperAction.allCases)
        XCTAssertGreaterThan(settings.scroll.contentSize.height,settings.scroll.bounds.height)
        XCTAssertLessThanOrEqual(settings.firstPlay.frame.maxY,settings.scroll.contentSize.height)
        settings.back.sendActions(for: .touchUpInside)
        for button in settings.developerButtons { XCTAssertTrue(button.isHidden); button.sendActions(for: .touchUpInside) }
        XCTAssertEqual(actions.count,8)
    }

    func testDeveloperPreviewCloseReleasesOnceEvenBeforeAssetsAreReady() {
        var releases = 0
        let content = UIViewController()
        let preview = NativeDeveloperPreviewHost(preview: content,release: { releases += 1 })
        preview.loadViewIfNeeded()
        XCTAssertTrue(content.parent === preview)
        preview.finish(); preview.finish()
        XCTAssertEqual(releases,1); XCTAssertNil(content.parent)
    }

    func testDeveloperHideAllRevokesEveryWorldBackpackUnlockDurably() throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer {try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        var profile=NativeSaveEnvelope()
        profile.progression.completedJourneyBoards=Set(1...30)
        profile.progression.beginAttempt(mode:.journey,board:1)
        profile.progression.beginAttempt(mode:.journey,board:24)
        profile.progression.highestUnlockedJourneyBoard=30
        profile.progression.unlockedSpecialDice=["flower","juice"]
        for board in 1...30 {
            if let id=NativeJourneyContent.introductionID(board:board) {
                XCTAssertTrue(profile.progression.announceJourneyDie(id,board:board))
            }
        }
        profile.progression.readJourneyDie("bee")
        try store.save(profile)
        let owner=try NativeBootstrap(root:root,store:store,showStudioIntro:false)
        defer {owner.dispose()}
        try owner.applyDeveloperProgress(.hide,values:Set((1...30).map(String.init)))
        let saved=try XCTUnwrap(store.load())
        XCTAssertEqual(NativeBackpackCatalog.sections(saved.progression).map(\.count),[0,0,0])
        XCTAssertFalse(saved.progression.hasUnlockedWildStar)
        XCTAssertTrue(saved.progression.announcedJourneyDice.isEmpty)
        XCTAssertTrue(saved.progression.unreadJourneyDice.isEmpty)
        var replay=saved.progression
        XCTAssertTrue(replay.announceJourneyDie("bee",board:1))
        XCTAssertEqual(replay.unreadJourneyDice,["bee"])
        XCTAssertNil(saved.progression.lastOpenedJourneyBoard)
        XCTAssertEqual((1...3).compactMap{saved.progression.interimBoard(world:$0)},[1,11,21])
    }

    func testDeveloperShowRevealsMatchingBackpackDiceAndHideRearmsThem() throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("dev-backpack-\(UUID().uuidString)")
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        let owner=try NativeBootstrap(root:root,store:store,showStudioIntro:false)
        defer{owner.dispose()}
        try owner.applyDeveloperProgress(.show,values:["22"])
        var saved=try XCTUnwrap(store.load())
        XCTAssertEqual(saved.progression.announcedJourneyDice,["kanta"])
        XCTAssertTrue(NativeBackpackCatalog.sections(saved.progression).contains{$0.unlocked.contains("kanta")})
        try owner.applyDeveloperProgress(.show,values:Set((1...30).map(String.init)))
        saved=try XCTUnwrap(store.load())
        let expected=Set((NativeBackpackCatalog.forest+NativeBackpackCatalog.area+NativeBackpackCatalog.beach).map(\.id))
        XCTAssertEqual(saved.progression.announcedJourneyDice,expected)
        XCTAssertEqual(NativeBackpackCatalog.sections(saved.progression).reduce(0){$0+$1.count},expected.count)
        try owner.applyDeveloperProgress(.hide,values:["22"])
        saved=try XCTUnwrap(store.load())
        XCTAssertFalse(saved.progression.announcedJourneyDice.contains("kanta"))
        XCTAssertEqual(saved.progression.announcedJourneyDice.count,expected.count-1)
        try owner.applyDeveloperProgress(.show,values:["22"])
        XCTAssertEqual(try store.load()?.progression.announcedJourneyDice,expected)
    }

    func testDeveloperProgressCommitsOnlySelectedStagesAndExplicitArcadeReset() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("native-dev-test-\(UUID().uuidString)")
        let store = NativeSaveStore(directory: directory)
        defer { try? FileManager.default.removeItem(at: directory) }
        var profile = NativeSaveEnvelope()
        profile.progression.firstPlayTutorialComplete = true
        profile.progression.completedJourneyBoards = [1,2,11]
        var stats = NativeBoardStats(); stats.highScore = 7777; stats.awardedStars=3; stats.starRankingVersion=0
        profile.progression.boardStats = [1:stats,2:stats,11:stats]
        let run = NativeBoardState(tiles: [NativeTile(id: "keep",cell: .init(column: 0,row: 0),value: 2)],mode: .arcade,moves:49)
        profile.arcadeRun = run; profile.journeyRuns[2] = NativeBoardState(tiles: run.tiles,board: 2,moves:49)
        try store.save(profile)
        let owner = try NativeBootstrap(root: root,store: store,showStudioIntro: false)
        let host = UIViewController(); host.loadViewIfNeeded(); owner.start(in: host)
        defer { owner.dispose() }
        try owner.applyDeveloperProgress(.hide,values: ["2"])
        var saved = try XCTUnwrap(store.load())
        XCTAssertEqual(saved.progression.completedJourneyBoards,[1,11]); XCTAssertEqual(saved.journeyRuns,profile.journeyRuns)
        XCTAssertNil(saved.progression.boardStats[2]); XCTAssertEqual(saved.progression.boardStats[11],stats); XCTAssertEqual(saved.arcadeRun,run)
        try owner.applyDeveloperProgress(.show,values: ["2"])
        XCTAssertEqual(try store.load()?.progression.completedJourneyBoards,profile.progression.completedJourneyBoards)
        try owner.applyDeveloperProgress(.reset,values: ["2"])
        saved = try XCTUnwrap(store.load())
        XCTAssertNil(saved.journeyRuns[2])
        XCTAssertEqual(saved.progression.boardStats[2]?.highScore,0)
        XCTAssertEqual(saved.progression.boardStats[2]?.awardedStars,1,"Completed stages retain the existing minimum-star normalization")
        XCTAssertEqual(saved.progression.boardStats[11],stats); XCTAssertEqual(saved.arcadeRun,run)
        XCTAssertEqual(saved.settings,profile.settings); XCTAssertTrue(saved.progression.firstPlayTutorialComplete)
        try owner.applyDeveloperProgress(.reset,values: ["arcade"])
        saved = try XCTUnwrap(store.load()); XCTAssertNil(saved.arcadeRun)
        XCTAssertEqual(saved.progression.completedJourneyBoards,[1,2,11])
    }

    func testDeveloperMenuHasNoRetiredDiceRevealCommands() {
        XCTAssertNil(NativeDeveloperAction(rawValue: "new-dice"))
        XCTAssertNil(NativeDeveloperAction(rawValue: "forest-unlock"))
        let settings = JimiNativeSettingsView(frame: .zero, assets: JimiV9Artwork(resourceRoot: root))
        let identifiers = settings.developerButtons.compactMap(\.accessibilityIdentifier)
        XCTAssertFalse(identifiers.contains("native.settings.developer.new-dice"))
        XCTAssertFalse(identifiers.contains("native.settings.developer.forest-unlock"))
    }

    func testActualDeveloperLastMergeReopensSharedSourceAndPreservesNormalProfile() async throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("native-dev-root-\(UUID().uuidString)")
        let store = NativeSaveStore(directory: directory)
        var profile = NativeSaveEnvelope(); profile.progression.firstPlayTutorialComplete = true
        profile.progression.completedJourneyBoards = [1,2]; profile.progression.lastOpenedJourneyBoard = 3
        try store.save(profile)
        let host = NativeStandaloneViewController(resourceRoot: root,store: store,completeNativeGameplayEnabled: true)
        let previous = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows).first(where: \.isKeyWindow)
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844))
        window.windowScene = previous?.windowScene; window.rootViewController = host; window.makeKeyAndVisible()
        defer { host.dispose(); window.isHidden = true; previous?.makeKeyAndVisible(); try? FileManager.default.removeItem(at: directory) }
        func wait(_ label: String,_ predicate: () -> Bool) async throws {
            let deadline = Date().addingTimeInterval(40)
            while !predicate() {
                guard Date() < deadline else { XCTFail(label); throw NSError(domain: label,code: 1) }
                try await Task.sleep(for: .milliseconds(20))
            }
        }
        func button(_ root: UIView, id: String) -> UIButton? {
            if root.accessibilityIdentifier == id { return root as? UIButton }
            return root.subviews.lazy.compactMap { button($0,id: id) }.first
        }
        host.loadViewIfNeeded(); let app = try XCTUnwrap(host.children.first as? NativeAppController)
        try await wait("home") { !app.home.isHidden }
        app.navigate(.settings,interrupt: true)
        try await wait("settings") { app.route == .settings && app.settingsView.isUserInteractionEnabled }
        app.settingsView.developer.sendActions(for: .touchUpInside)
        let before = try store.load()
        for choice in [NativeWildArchetype.tnt.rawValue,"flower","ordinary","bloob-ball"] {
            if choice == "ordinary" || choice == "bloob-ball" {
                let index=try XCTUnwrap(NativeDeveloperAction.allCases.firstIndex(of:.endGame))
                app.settingsView.developerButtons[index].sendActions(for:.touchUpInside)
            } else {
                try XCTUnwrap(app.settingsView.developerButtons.last).sendActions(for: .touchUpInside)
            }
            let picker = try XCTUnwrap(app.presentedViewController as? NativeDeveloperPicker)
            picker.loadViewIfNeeded()
            try XCTUnwrap(button(picker.view,id: "native.developer.choice.\(choice)")).sendActions(for: .touchUpInside)
            try XCTUnwrap(button(picker.view,id: "native.developer.confirm")).sendActions(for: .touchUpInside)
            try await wait("preview") { app.presentedViewController is NativeDeveloperGameplayHost }
            let preview = try XCTUnwrap(app.presentedViewController as? NativeDeveloperGameplayHost)
            let previewApp = try XCTUnwrap(preview.children.first as? NativeAppController)
            func game() -> NativeGameplayViewController? { previewApp.children.compactMap { $0 as? NativeGameplayViewController }.first }
            try await wait("last merge entry") { game()?.boardScene?.isBoardEntryComplete == true && game()?.beforeSourceGameplayAdmission == nil }
            let gameplay = try XCTUnwrap(game()), scene = try XCTUnwrap(gameplay.boardScene)
            XCTAssertEqual(gameplay.engine.state.activeTiles.count,2)
            XCTAssertTrue(NativeSaveEnvelope.hasRecordedMove(gameplay.engine.state),"Synthetic final pair must survive normal resume admission")
            XCTAssertEqual(gameplay.engine.state.tiles.first { $0.id == "dev-wild" }?.variant,choice == "flower" || choice == "bloob-ball" ? choice : nil)
            XCTAssertTrue(try XCTUnwrap(gameplay.sourceScope).current)
            if choice == "ordinary" {
                XCTAssertEqual(gameplay.engine.state.activeTiles.map(\.value).sorted(),[2,4])
                XCTAssertTrue(gameplay.engine.state.activeTiles.allSatisfy{$0.archetype == nil})
            }
            if choice == "flower" || choice == "ordinary" || choice == "bloob-ball" {
                let a = try XCTUnwrap(scene.sourceNativeTileNode(choice == "ordinary" ? "dev-end-four":"dev-wild")), b = try XCTUnwrap(scene.sourceNativeTileNode(choice == "ordinary" ? "dev-end-two":"dev-regular"))
                let from = scene.convert(a.position,from: try XCTUnwrap(a.parent)), to = scene.convert(b.position,from: try XCTUnwrap(b.parent))
                XCTAssertTrue(scene.beginDrag(at: from)); scene.moveDrag(to: to,now: CACurrentMediaTime())
                try await Task.sleep(for: .milliseconds(160))
                XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at: to,now: CACurrentMediaTime())).accepted)
                if choice == "ordinary" {
                    XCTAssertTrue(gameplay.hasPresentedBoardCleared,"Ordinary final contact starts the clear group synchronously")
                    var ghosts:[SKNode]=[]
                    scene.enumerateChildNodes(withName:"//native-ghost-*"){node,_ in ghosts.append(node)}
                    XCTAssertFalse(ghosts.isEmpty)
                    XCTAssertTrue(ghosts.allSatisfy{$0.action(forKey:"board-exit") != nil},"Residual pop-out begins with CLEARED, before terminal")
                } else {
                    XCTAssertFalse(gameplay.hasPresentedBoardCleared,"Special finale must finish before the clear group starts")
                }
                try await wait("developer final complete") { gameplay.engine.state.terminal?.kind == .complete }
                if choice == "ordinary" || choice == "bloob-ball" {
                    try await wait("developer clean result") {
                        gameplay.presentedViewController is NativeResultController || preview.presentedViewController is NativeResultController || previewApp.presentedViewController is NativeResultController
                    }
                }
            }
            try XCTUnwrap(button(preview.view,id: "native.developer.close-gameplay")).sendActions(for: .touchUpInside)
            try await wait("preview closed") { app.presentedViewController == nil }
            XCTAssertEqual(try store.load(),before)
            XCTAssertTrue(app.admitsDeveloperAction(epoch: app.settingsView.presentationEpoch))
        }
    }

    func testUIKitTogglesProjectCanonicalValuesAndSendEpochOwnedCommands() {
        let settings = JimiNativeSettingsView(frame: CGRect(x: 0,y: 0,width: 390,height: 844), assets: JimiV9Artwork(resourceRoot: root))
        XCTAssertTrue(settings.apply(preferences)); settings.layoutSubviews()
        XCTAssertFalse(settings.switches[0].isOn); XCTAssertTrue(settings.switches[1].isOn)
        var commands: [(String,Bool,Int)] = []
        settings.onPreference = { commands.append(($0,$1,$2)) }
        settings.switches[1].setOn(false, animated: false)
        settings.switches[1].sendActions(for: .valueChanged)
        XCTAssertEqual(commands.count,1); XCTAssertEqual(commands[0].0,"musicEnabled")
        XCTAssertFalse(commands[0].1); XCTAssertEqual(commands[0].2,10)
        XCTAssertFalse(settings.apply(["presentationEpoch":11,"musicEnabled":false]))
        XCTAssertEqual(settings.presentationEpoch,10,"Malformed updates cannot replace accepted identity")
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844)] {
            settings.frame.size = size; settings.layoutSubviews()
            XCTAssertGreaterThan(settings.scroll.frame.height,0)
            XCTAssertLessThanOrEqual(settings.footer.frame.maxY,size.height)
            for toggle in settings.switches {
                XCTAssertGreaterThanOrEqual(toggle.frame.minX,0)
                XCTAssertLessThanOrEqual(toggle.frame.maxX,settings.scroll.bounds.width)
                XCTAssertEqual(toggle.frame.size,CGSize(width:67,height:45))
            }
        }
    }

    func testSettingsAnimationViewportIsFullWidthAndNeverClipsPaddedRows() {
        for width in [CGFloat(320),390,430] {
            let settings = JimiNativeSettingsView(frame:CGRect(x:0,y:0,width:width,height:844),assets:JimiV9Artwork(resourceRoot:root))
            settings.layoutSubviews()
            XCTAssertEqual(settings.scroll.frame.minX,0)
            XCTAssertEqual(settings.scroll.bounds.width,width)
            XCTAssertFalse(settings.clipsToBounds);XCTAssertFalse(settings.scroll.clipsToBounds)
            XCTAssertEqual(settings.switches[0].convert(settings.switches[0].bounds,to:settings).maxX,width-24,accuracy:0.001)
            for row in settings.rows {
                XCTAssertEqual(row.frame.minX,24);XCTAssertEqual(row.bounds.width,width-48)
                var parent: UIView? = row
                while let view = parent {XCTAssertFalse(view.clipsToBounds);parent = view.superview}
                // The authored overshoot may paint beyond the padded layout box.
                row.transform = CGAffineTransform(scaleX:1.12,y:1.12)
                XCTAssertLessThan(row.frame.minX,24)
                XCTAssertGreaterThan(row.frame.maxX,width-24)
            }
            for divider in settings.dividers {XCTAssertEqual(divider.frame.minX,24);XCTAssertEqual(divider.bounds.width,width-48)}
        }
    }

    func testSettingsLayoutKeepsV10ExitPivotsWhenModelIsCollapsed() {
        let settings = JimiNativeSettingsView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:root))
        settings.layoutSubviews()
        let targets = settings.tracks(enter:false).map{$0.0}
        let geometry = targets.map{($0.bounds,$0.center)}
        for target in targets {target.layer.transform = CATransform3DMakeScale(0,0,1)}
        settings.layoutSubviews()
        for (index,target) in targets.enumerated() {
            XCTAssertEqual(target.bounds,geometry[index].0,"v10 scale exit must not change the element's layout bounds")
            XCTAssertEqual(target.center,geometry[index].1,"Each element collapses around its own unchanged center")
        }
    }

    func testPrivacyUsesCenteredV10PaperAndLifecycleOwnedClose() async throws {
        let privacy = JimiNativePrivacyController(assets:JimiV9Artwork(resourceRoot:root))
        privacy.loadViewIfNeeded();privacy.view.frame = CGRect(x:0,y:0,width:390,height:844)
        privacy.viewDidLayoutSubviews();privacy.viewDidAppear(false)
        XCTAssertEqual(privacy.card.bounds.width,342)
        XCTAssertEqual(privacy.card.center.y-privacy.card.bounds.height*0.05,422,accuracy:0.001)
        XCTAssertEqual(privacy.flip.layer.anchorPoint.y,0.46)
        XCTAssertEqual(privacy.paper.layer.contentsRect.minY,0)
        XCTAssertEqual(privacy.paper.layer.cornerRadius,40)
        XCTAssertNotNil(privacy.paper.image)
        XCTAssertEqual(privacy.close.frame.size,CGSize(width:52,height:52))
        XCTAssertTrue(privacy.copy.text.contains("Read Privacy Policy"))
        XCTAssertEqual(privacy.card.layer.animation(forKey:"privacy-enter")?.duration,0.65)
        XCTAssertEqual(privacy.idle.layer.animation(forKey:"privacy-idle")?.duration,6.8)
        privacy.close.sendActions(for:.touchUpInside)
        XCTAssertEqual(privacy.card.layer.animation(forKey:"privacy-exit")?.duration,0.65)
        XCTAssertNotNil(privacy.card.layer.animation(forKey:"privacy-exit-opacity"))
        let geometry = [privacy.card,privacy.flip,privacy.idle].map { ($0.bounds,$0.center) }
        privacy.viewDidLayoutSubviews()
        for (i,target) in [privacy.card,privacy.flip,privacy.idle].enumerated() {
            XCTAssertEqual(target.bounds,geometry[i].0);XCTAssertEqual(target.center,geometry[i].1)
        }
        privacy.viewDidDisappear(false)
        XCTAssertNil(privacy.idle.layer.animationKeys())
    }

    func testSettingsTracksPreserveAuthoredHeaderAndStaggerWithoutIdle() throws {
        let settings = JimiNativeSettingsView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:root))
        let enter = settings.tracks(enter:true), exit = settings.tracks(enter:false)
        XCTAssertTrue(enter.first!.0 === settings.header)
        XCTAssertTrue(exit.last!.0 === settings.header)
        XCTAssertEqual(enter[0].1.tweens[0].duration,0.5)
        XCTAssertEqual(enter[1].1.tweens[0].begin,0.05)
        XCTAssertEqual(enter[2].1.tweens[0].begin,0.13,accuracy:0.001)
        let expected: [UIView] = [settings.rows[2],settings.dividers[1],settings.rows[1],settings.dividers[0],settings.rows[0],settings.footer,settings.header]
        XCTAssertEqual(exit.count,expected.count)
        for (i,item) in exit.enumerated() {
            XCTAssertTrue(item.0 === expected[i])
            let tween = item.1.tweens[0]
            XCTAssertEqual(tween.begin,Double(i)*0.04+(i==6 ? 0.05 : 0),accuracy:0.000001)
            XCTAssertEqual(tween.duration,0.34)
            XCTAssertEqual(item.1.pose(at:tween.begin+tween.duration*0.5).scaleX,1-JimiV9Motion.Ease.backIn(1.7).value(0.5),accuracy:0.000001)
        }
        XCTAssertEqual(exit.last!.1.tweens[0].duration,0.34)
        XCTAssertEqual(enter[0].1.pose(at:0).opacity,0,accuracy:0.000001)
        XCTAssertEqual(enter[0].1.pose(at:0.5).opacity,1)
    }

    func testRealNativeSettingsRouteNeverActivatesWebSettingsAndReturnsToNativeSlider() async throws {
        let web = SettingsRouteWebView(frame:CGRect(x:0,y:0,width:390,height:844))
        let controller = JimiHomeHubController(web:web,resourceRoot:root)
        let window = UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=controller;window.makeKeyAndVisible()
        defer { controller.dispose();window.isHidden=true }
        let incoming = expectation(description:"Native Settings incoming starts")
        var motions = 0, starts: [String] = []
        controller.onDiagnosticEvent = { event in
            if case .start(_,let label)=event {starts.append(label)}
            if case .motionStart(let id)=event,id==1 {motions+=1;if motions==2 {incoming.fulfill()}}
        }
        controller.receive(["kind":"present","route":"home","snapshot":["homeSlide":2,"settings":preferences]])
        XCTAssertNotNil(controller.home.heroImages[2].layer.animation(forKey:"native-hero-idle"))
        controller.home.ctaView.sendActions(for:.touchUpInside)
        controller.receive(["kind":"ready","requestId":1,"destination":["kind":"settings"]])
        await fulfillment(of:[incoming],timeout:5)
        XCTAssertTrue(controller.home.isHidden);XCTAssertFalse(controller.settings.isHidden)
        XCTAssertTrue(web.accessibilityElementsHidden)
        let group = try XCTUnwrap(controller.settings.header.layer.animation(forKey:"native-route") as? CAAnimationGroup)
        let alpha = try XCTUnwrap(group.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="opacity"})
        XCTAssertEqual((alpha.values?.first as? NSNumber)?.doubleValue ?? -1,0,accuracy:0.000001)
        XCTAssertFalse(web.scripts.contains{$0.contains("activateSource")},"Settings must never expose a web source")
        try await Task.sleep(nanoseconds:1_050_000_000)
        XCTAssertTrue(controller.settings.isUserInteractionEnabled)
        controller.settings.back.sendActions(for:.touchUpInside)
        controller.settings.back.sendActions(for:.touchUpInside)
        XCTAssertEqual(starts,["home->settings","settings->home"])
        controller.receive(["kind":"ready","requestId":2,"destination":["kind":"home"]])
        try await Task.sleep(nanoseconds:1_650_000_000)
        XCTAssertTrue(controller.settings.isHidden);XCTAssertFalse(controller.home.isHidden)
        XCTAssertEqual(controller.home.selectedSlide,2)
        let idleLayer = controller.home.heroImages[2].layer
        XCTAssertNotNil(idleLayer.animation(forKey:"native-hero-idle"))
        controller.suspend();XCTAssertEqual(idleLayer.speed,0)
        controller.resume();XCTAssertEqual(idleLayer.speed,1)
        XCTAssertFalse(web.scripts.contains{$0.contains("activateSource")})
    }

    func testArcadeHeroAndSliderRemainUIKitWithCanonicalGameLaunchOnly() {
        let home = JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:root))
        home.selectSlide(1,animated:false);home.layoutSubviews()
        XCTAssertEqual(home.heroView.accessibilityIdentifier,"native.home.hero.1")
        XCTAssertEqual(home.ctaView.title(for:.normal),"Arcade")
        XCTAssertTrue(home.heroView is UIButton)
        var activated: Int?
        home.onActivate={activated=$0}
        (home.heroView as? UIButton)?.sendActions(for:.touchUpInside)
        XCTAssertEqual(activated,1)
        XCTAssertFalse(home.sliderTrack.subviews.contains{$0 is WKWebView})
    }
    func testHomeArtworkEnlargementAndVisibleOnlyV10IdleOwnership() throws {
        let home = JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:JimiV9Artwork(resourceRoot:root))
        home.layoutSubviews()
        for i in 0..<3 {
            home.selectSlide(i,animated:false);home.startHeroIdle()
            let layer = home.heroImages[i].layer
            XCTAssertEqual(home.heroImages[i].bounds.width,336*1.05,accuracy:0.001)
            XCTAssertEqual(home.heroImages[i].center.x,168,accuracy:0.001)
            let animation = try XCTUnwrap(layer.animation(forKey:"native-hero-idle") as? CAKeyframeAnimation)
            XCTAssertEqual(animation.duration,[4.0,3.0,3.5][i])
            let peak = try XCTUnwrap((animation.values?[1] as? NSValue)?.caTransform3DValue)
            XCTAssertEqual(peak.m42,[-6.0,-8.0,-7.0][i],accuracy:0.001)
            XCTAssertEqual(sqrt(peak.m11*peak.m11+peak.m12*peak.m12),[1.05,1.02,1.03][i],accuracy:0.001)
            for other in 0..<3 where other != i {XCTAssertNil(home.heroImages[other].layer.animationKeys())}
            home.pauseHeroIdle();XCTAssertEqual(layer.speed,0)
            home.startHeroIdle();XCTAssertEqual(layer.speed,1)
            let geometry = home.heroImages[i].bounds;home.layoutSubviews();XCTAssertEqual(home.heroImages[i].bounds,geometry)
        }
        home.isHidden = true
        for image in home.heroImages {XCTAssertNil(image.layer.animationKeys());XCTAssertEqual(image.layer.speed,1)}
        home.startHeroIdle();XCTAssertNil(home.heroImages[2].layer.animationKeys())
        home.isHidden = false;home.startHeroIdle();home.stopHeroIdle();home.stopHeroIdle()
        XCTAssertNil(home.heroImages[2].layer.animationKeys())
    }

}
