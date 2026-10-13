import XCTest
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeHapticRuntimeTests:XCTestCase {
    func testStackActuatorReusesGeneratorAndPreparesEverySubtleContact() {
        final class Generator:NativeStackImpactGenerator {
            var calls:[String]=[]
            func prepare(){calls.append("prepare")}
            func impactOccurred(intensity:CGFloat){calls.append("impact:\(intensity)")}
        }
        let generator=Generator();var creations=0
        let actuator=NativeHapticRuntime.Actuator(makeStackGenerator:{creations += 1;return generator})
        actuator.emit(.stackContact);actuator.emit(.stackContact)
        XCTAssertEqual(creations,1)
        XCTAssertEqual(generator.calls,["prepare","impact:0.35","prepare","impact:0.35"])
    }
    func testEachGentleStackContactPreservesSettingsForegroundAndFinaleBudget() {
        var enabled=true,active=true,outputs:[NativeHapticRuntime.Output]=[]
        let owner=NativeHapticRuntime(enabled:{enabled},active:{active},now:{0},transport:{outputs.append($0)})
        defer{owner.dispose()}
        for _ in 0..<12 {XCTAssertTrue(owner.emit("stack-contact"))}
        XCTAssertEqual(outputs,Array(repeating:.stackContact,count:12))
        XCTAssertTrue(owner.emit("light"),"Stack contacts do not consume the finale impact budget")
        enabled=false;XCTAssertFalse(owner.emit("stack-contact"))
        enabled=true;active=false;XCTAssertFalse(owner.emit("stack-contact"))
        active=true;owner.dispose();XCTAssertFalse(owner.emit("stack-contact"))
    }
    func testMountedBootstrapSettingsAndCommittedSixReachDirectNativeTransport() async throws {
        let directory=FileManager.default.temporaryDirectory.appendingPathComponent("haptic-connected-"+UUID().uuidString)
        defer{try? FileManager.default.removeItem(at:directory)}
        let store=NativeSaveStore(directory:directory)
        let tiles=[NativeTile(id:"left",cell:.init(column:0,row:0),value:2),NativeTile(id:"right",cell:.init(column:1,row:0),value:4),NativeTile(id:"other",cell:.init(column:2,row:0),value:5),NativeTile(id:"stack-left",cell:.init(column:0,row:1),value:1),NativeTile(id:"stack-right",cell:.init(column:1,row:1),value:1)]
        var seed=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:true),journeyRuns:[1:NativeBoardState(tiles:tiles,mode:.journey,board:1,moves:10)])
        seed.progression.firstPlayTutorialComplete=true;try store.save(seed)
        let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
        let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        var outputs:[NativeHapticRuntime.Output]=[];bootstrap.hapticOutputObserver={outputs.append($0)}
        window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
        defer{bootstrap.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        let app=try XCTUnwrap(host.children.first as? NativeAppController)
        app.navigate(.settings,interrupt:true);try await wait{app.settingsView.isUserInteractionEnabled}
        let toggle=try XCTUnwrap(findControl(app.settingsView,id:"native.settings.hapticsEnabled"))
        try await Task.sleep(for:.milliseconds(250));outputs.removeAll()
        toggle.sendActions(for:.touchUpInside)
        XCTAssertEqual(outputs,[.impact("light")]);XCTAssertFalse(try XCTUnwrap(store.load()).settings.hapticsEnabled)
        try await Task.sleep(for:.milliseconds(250));outputs.removeAll()
        toggle.sendActions(for:.touchUpInside)
        XCTAssertEqual(outputs,[.impact("light")]);XCTAssertTrue(try XCTUnwrap(store.load()).settings.hapticsEnabled)
        app.navigate(.world(1),interrupt:true);try await wait{app.world?.isReadyForInput==true}
        app.world?.onRequest?("continue",1);try await wait{app.route == .gameplay}
        let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
        try await wait{game.boardScene?.isBoardEntryComplete==true}
        let scene=try XCTUnwrap(game.boardScene),geometry=try XCTUnwrap(scene.boardGeometry)
        try await wait{scene.beginDrag(at:geometry.center(row:1,column:0))}
        outputs.removeAll()
        XCTAssertTrue(try XCTUnwrap(scene.finishDrag(at:geometry.center(row:1,column:1),now:90)).accepted)
        try await wait{outputs.contains(.stackContact)}
        XCTAssertEqual(outputs.filter{$0 == .stackContact}.count,1)
        try await wait{game.engine.pendingOrdinaryStack == nil && game.engine.pendingSourceOrdinaryStackFaces.isEmpty}
        try await wait{scene.beginDrag(at:geometry.center(row:0,column:0))}
        outputs.removeAll()
        let six=try XCTUnwrap(scene.finishDrag(at:geometry.center(row:0,column:1),now:100))
        XCTAssertTrue(six.accepted,"Unexpected merge-six refusal: \(six.events), \(six.resolution)")
        XCTAssertEqual(outputs.first,.impact("medium"))
        XCTAssertEqual(outputs.filter{$0 == .impact("medium")}.count,1)
    }
    private func findControl(_ view:UIView,id:String)->UIControl? {
        if view.accessibilityIdentifier==id {return view as? UIControl}
        for child in view.subviews {if let found=findControl(child,id:id){return found}}
        return nil
    }
    private func wait(_ predicate:()->Bool)async throws {
        let end=Date().addingTimeInterval(20)
        while !predicate(){if Date()>end{throw NSError(domain:"NativeHapticConnectedTimeout",code:1)};try await Task.sleep(for:.milliseconds(20))}
    }
    func testCleanCounterOwnsChangedValueFiftyMillisecondCadenceAndRetirement() {
        let result=NativeResultController(root:NativeTestResources.root,state:NativeBoardState(tiles:[],mode:.journey,board:1,score:100),clean:true,combo:50,efficiency:500,finalScore:650)
        var beats:[Double]=[];result.onHaptic={kind in if kind == "protected-light" {beats.append(result.elapsed)}}
        result.loadViewIfNeeded();result.tick(0)
        for index in 1...150 {result.tick(Double(index)/100)}
        XCTAssertFalse(beats.isEmpty)
        for (left,right) in zip(beats,beats.dropFirst()) {XCTAssertGreaterThanOrEqual(right-left,0.05-0.000001)}
        let count=beats.count;result.tick(1.50);XCTAssertEqual(beats.count,count)
        result.setSuspended(true);result.tick(3);XCTAssertEqual(beats.count,count)
        result.dispose();result.tick(5);XCTAssertEqual(beats.count,count)
    }
    func testPwaBudgetProtectedContactsSettingsAndBackground() {
        var time=0.0,enabled=true,active=true,outputs:[NativeHapticRuntime.Output]=[]
        let owner=NativeHapticRuntime(enabled:{enabled},active:{active},now:{time},transport:{outputs.append($0)})
        defer{owner.dispose()}
        for index in 0..<40 {time=Double(index)*50;owner.emit("light")}
        XCTAssertEqual(outputs.count,5) // Exact PWA 2-second burst cap.
        XCTAssertTrue(owner.emit("heavy",protected:true))
        XCTAssertTrue(owner.emit("light",protected:true))
        enabled=false;XCTAssertFalse(owner.emit("heavy",protected:true))
        enabled=true;active=false;XCTAssertFalse(owner.emit("heavy",protected:true))
        active=true;owner.reset();XCTAssertTrue(owner.emit("light"))
        XCTAssertFalse(owner.emit("light"));time += 220;XCTAssertTrue(owner.emit("light"))
        owner.dispose();time += 1000;XCTAssertFalse(owner.emit("heavy",protected:true))
    }
    func testSelectionNotificationAndAllImpactStylesUseDistinctTransports() {
        var time=0.0,outputs:[NativeHapticRuntime.Output]=[]
        let owner=NativeHapticRuntime(enabled:{true},active:{true},now:{time},transport:{outputs.append($0)})
        defer{owner.dispose()}
        XCTAssertTrue(owner.emit("selection"));XCTAssertFalse(owner.emit("selection"))
        XCTAssertTrue(owner.emit("notification-error"));XCTAssertFalse(owner.emit("notification-warning"))
        time=260;XCTAssertTrue(owner.emit("selection"));XCTAssertTrue(owner.emit("notification-warning"))
        for style in ["light","medium","heavy","rigid","soft"] {XCTAssertTrue(owner.emit(style,protected:true))}
        XCTAssertEqual(outputs,[.selection,.notification("error"),.selection,.notification("warning"),.impact("light"),.impact("medium"),.impact("heavy"),.impact("rigid"),.impact("soft")])
    }
    func testForegroundNotificationsSuppressAndResumeWithoutReplayingOldSequence() {
        var outputs:[NativeHapticRuntime.Output]=[]
        let owner=NativeHapticRuntime(enabled:{true},active:{true},transport:{outputs.append($0)})
        defer{owner.dispose()}
        XCTAssertTrue(owner.emit("heavy",protected:true))
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertFalse(owner.emit("heavy",protected:true));XCTAssertFalse(owner.emit("notification-error"))
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(outputs,[.impact("heavy")]);XCTAssertTrue(owner.emit("selection"))
    }
    func testSustainedAndLightBudgetsMirrorPwa() {
        var time=0.0,outputs=0
        let owner=NativeHapticRuntime(enabled:{true},active:{true},now:{time},transport:{_ in outputs += 1})
        defer{owner.dispose()}
        for index in 0..<10 {time=Double(index)*900;XCTAssertTrue(owner.emit("medium"))}
        time=9500;XCTAssertFalse(owner.emit("heavy"));time=10000;XCTAssertTrue(owner.emit("heavy"))
        owner.reset();time=20000
        for _ in 0..<6 {XCTAssertTrue(owner.emit("light"));time += 900}
        XCTAssertFalse(owner.emit("light"));XCTAssertTrue(owner.emit("medium"))
        XCTAssertEqual(outputs,18)
    }
    func testAuthoredSequencesConsumeOnceAndRetireWithoutReplaying() {
        var current=true,outputs:[String]=[]
        let sequence=NativeHapticRuntime.Sequence(beats:NativeHapticPatterns.home,current:{current})
        sequence.onBeat={outputs.append($0.style)}
        sequence.paint(seconds:0.2);sequence.paint(seconds:0.2)
        XCTAssertEqual(outputs,["light"])
        current=false;sequence.paint(seconds:1);current=true;sequence.paint(seconds:1)
        XCTAssertEqual(outputs,["light"])
        let owner=NativeHapticRuntime(enabled:{true},active:{true},transport:{_ in})
        owner.cancelSequences();XCTAssertTrue(owner.emit("selection")) // Route cleanup is reusable.
        owner.dispose()
    }
    func testEveryWildIdentityAndDirectionUsesPwaMainImpactPattern() {
        let ordinary=NativeTile(id:"ordinary",cell:.init(column:1,row:0),value:1)
        for (archetype,variant) in NativeWildArchetype.allCases.map({($0,Optional<String>.none)})+NativeSpecialDiceRegistry.variants.values.map({($0.archetype,Optional($0.id))}) {
            let wild=NativeTile(id:"wild",cell:.init(column:0,row:0),value:6,archetype:archetype,variant:variant)
            for reverse in [false,true] {
                let event=NativeGameplayEvent(.merged,value:6,archetype:archetype,variant:variant)
                let beats=NativeHapticPatterns.mergeSix(source:reverse ? ordinary:wild,destination:reverse ? wild:ordinary,event:event)
                if variant == "laser-gun" {XCTAssertTrue(beats.isEmpty);continue}
                XCTAssertEqual(beats.first?.style,"heavy");XCTAssertEqual(beats.first?.protected,true)
                XCTAssertEqual(beats.map(\.seconds),archetype == .tnt || ["flower","beach-ball","barell"].contains(variant ?? "") ? [0,0.45,0.85]:[0,0.15])
            }
        }
        XCTAssertEqual(NativeHapticPatterns.mergeSix(source:ordinary,destination:ordinary,event:.init(.merged,value:6)),[.init(seconds:0,style:"medium",protected:true)])
        for (actual,expected) in zip(NativeHapticPatterns.magnetPull(count:4).map(\.seconds),[0,0.05,0.15,0.20]) {XCTAssertEqual(actual,expected,accuracy:0.000001)}
    }
}
