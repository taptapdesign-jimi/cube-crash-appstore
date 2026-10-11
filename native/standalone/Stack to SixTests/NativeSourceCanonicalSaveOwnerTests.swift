import XCTest
@testable import Stack_to_Six

final class NativeSourceCanonicalSaveOwnerTests:XCTestCase {
    @MainActor func testPreparedWriteReceivesExactProducerDespiteNestedCapture()throws {
        let h=Harness();h.mode="arcade_home";h.fresh=true
        var requests:[Bool]=[],binding:Owner.Binding?,nested=false
        var hooks=h.hooks()
        hooks.writeWithRequest={_,request in
            switch request {case .admission:XCTFail("admission cannot write");case .save(let fresh):requests.append(fresh)}
            return true
        }
        binding=try XCTUnwrap(h.owner.install(hooks:hooks))
        h.captureHook={
            guard !nested else{return};nested=true
            XCTAssertEqual(binding?.notify(.lifecycle),.written)
        }
        XCTAssertEqual(binding?.notify(.preparedArcadeEntry),.written)
        XCTAssertEqual(requests,[false,true]);XCTAssertTrue(h.writes.isEmpty)
        h.owner.dispose()
    }
    typealias Owner=NativeSourceCanonicalSaveOwner<Int>
    struct Oracle:Decodable {let guardRows:[GuardRow],rows:[TraceRow]}
    struct GuardRow:Decodable {struct Input:Decodable{let gameHasEnded,gridReady,gameplayTransientBusy:Bool;let runMode:String};let input:Input,allowed:Bool}
    struct TraceRow:Decodable{struct Spec:Decodable{let name:String,events:[[Int]],reenter:Bool?};let spec:Spec,trace:[[Item]]}
    enum Item:Decodable{case str(String),num(Int),bool(Bool);init(from d:Decoder)throws{let c=try d.singleValueContainer();if let b=try?c.decode(Bool.self){self = .bool(b)}else if let n=try?c.decode(Int.self){self = .num(n)}else{self = .str(try c.decode(String.self))}}}
    @MainActor final class Harness {
        struct Timer{let id:UUID,at:Int,callback:()->Void}
        let owner=Owner()
        var now=0,state=0,timers:[Timer]=[],trace:[String]=[],writes:[Int]=[],missing:[String]=[],current=true,coherent=true,writeSucceeds=true,busy=false,ended=false,skip=false,journeyVeto=false,grid=true,mode="journey",fresh=false
        var writeHook:(()->Void)?,captureHook:(()->Void)?,cancelHook:(()->Void)?
        func hooks()->Owner.Hooks{.init(current:{[unowned self] in current},capture:{[unowned self] _ in captureHook?();return .init(state:state,guardFields:.init(runMode:mode,skipRebuildBoard:skip,journeyCompletedSaveVeto:journeyVeto,gameHasEnded:ended,gridReady:grid,gameplayTransientBusy:busy,freshArcadeEntryAuthorized:fresh),missingOwners:missing,nativeCoherent:coherent)},stillMatches:{[unowned self] in $0==state},write:{[unowned self] value in writes.append(value);trace.append("save:\(now):\(!owner.hasPendingSave)");writeHook?();return writeSucceeds},wall:{[unowned self] ms,callback in let id=UUID();timers.append(.init(id:id,at:now+ms,callback:callback));trace.append("schedule:\(now):\(ms)");return{[weak self] in guard let self else{return};timers.removeAll{$0.id==id};cancelHook?()}})}
        func deliver(_ at:Int){now=at;for t in timers.filter({$0.at<=now}).sorted(by:{$0.at<$1.at}){guard timers.contains(where:{$0.id==t.id})else{continue};timers.removeAll{$0.id==t.id};t.callback()}}
    }
    func oracle()throws->Oracle{try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:Bundle(for:NativeSourceCanonicalSaveOwnerTests.self).url(forResource:"NativeSourceCanonicalSaveOracle",withExtension:"json")!))}
    func testOriginalGuardDecisionsPreserveBoardOneBeforeAnyMove()throws {for r in try oracle().guardRows{let v=r.input;XCTAssertEqual(NativeSourceCanonicalSaveGuard(runMode:v.runMode,skipRebuildBoard:false,journeyCompletedSaveVeto:false,gameHasEnded:v.gameHasEnded,gridReady:v.gridReady,gameplayTransientBusy:v.gameplayTransientBusy,freshArcadeEntryAuthorized:false).admits(freshArcadeEntry:false),r.allowed)}}
    func testOriginalDebounceSixWallTracesAndClearBeforeReentrantSave()async throws {let rows=try oracle().rows;await MainActor.run{for row in rows{let h=Harness(),b=h.owner.install(hooks:h.hooks())!;if row.spec.reenter==true{h.writeHook={if h.now==400{_ = b.notify(.wildQueueFinally)}}}
        for at in stride(from:0,through:1500,by:100){h.now=at;for event in row.spec.events where event[0]==at{let p:Owner.Producer=event[1]==400 ? .wildQueueFinally:.ordinarySubSixContact;XCTAssertEqual(b.notify(p),.scheduled(event[1]));XCTAssertTrue(h.writes.isEmpty || at>=400)};h.deliver(at)}
        let expected=row.trace.compactMap{event->String? in guard case .str(let kind)=event[0],kind != "cancel",case .num(let wall)=event[1] else{return nil};switch event[2]{case .num(let ms):return "schedule:\(wall):\(ms)";case .bool(let nilled):return "save:\(wall):\(nilled)";default:return nil}}
        XCTAssertEqual(h.trace,expected,row.spec.name);h.owner.dispose()
    }}}
    func testCaptureAtDeliveryRefusesTransientWithoutTouchingLastDurableValue()async{await MainActor.run{let h=Harness(),b=h.owner.install(hooks:h.hooks())!;XCTAssertEqual(b.notify(.wildQueueFinally),.scheduled(400));h.state=8;h.busy=true;h.deliver(400);XCTAssertTrue(h.writes.isEmpty);h.busy=false;XCTAssertEqual(b.notify(.levelCheckContinue),.written);XCTAssertEqual(h.writes,[8]);h.owner.dispose()}}
    func testMissingOwnersRefuseInstallAndFreshlyMissingSnapshotRefusesWrite()async{await MainActor.run{let h=Harness();h.missing=["source-spawn-marker"];XCTAssertNil(h.owner.install(hooks:h.hooks()));h.missing=[];let b=h.owner.install(hooks:h.hooks())!;h.missing=["source-drag-owner"];XCTAssertEqual(b.notify(.lifecycle),.missingOwners);XCTAssertTrue(h.writes.isEmpty);h.owner.dispose()}}
    func testRetiredACannotCancelSameAppScopeCOrPublishOldState()async{await MainActor.run{let h=Harness(),a=h.owner.install(hooks:h.hooks())!;_ = a.notify(.wildQueueFinally);let c=h.owner.install(hooks:h.hooks())!;_ = c.notify(.ordinarySubSixContact);a.retire();XCTAssertEqual(a.notify(.lifecycle),.obsolete);h.state=9;h.deliver(400);XCTAssertTrue(h.writes.isEmpty);h.deliver(1200);XCTAssertEqual(h.writes,[9]);XCTAssertTrue(c.current);h.owner.dispose()}}
    func testReentrantCancellationInstallationKeepsCAndRejectsOuterB()async{await MainActor.run{let h=Harness(),a=h.owner.install(hooks:h.hooks())!;_ = a.notify(.wildQueueFinally);var c:Owner.Binding?;h.cancelHook={h.cancelHook=nil;c=h.owner.install(hooks:h.hooks());_ = c?.notify(.ordinarySubSixContact)};XCTAssertNil(h.owner.install(hooks:h.hooks()));XCTAssertTrue(c?.current==true);h.deliver(1200);XCTAssertEqual(h.writes,[0]);h.owner.dispose()}}
    func testFreshArcadeIsOnlyGenuinePreparedReceiptAndJourneyVetoRemains()async{await MainActor.run{let h=Harness();h.busy=true;h.ended=true;h.mode="arcade_home";let b=h.owner.install(hooks:h.hooks())!;XCTAssertEqual(b.notify(.preparedArcadeEntry),.vetoed);h.fresh=true;XCTAssertEqual(b.notify(.preparedArcadeEntry),.written);h.mode="journey";h.busy=false;h.ended=false;h.journeyVeto=true;XCTAssertEqual(b.notify(.levelCheckContinue),.vetoed);h.skip=true;XCTAssertEqual(b.notify(.lifecycle),.vetoed);h.owner.dispose()}}
    func testWriteFailureDoesNotBecomeDurableAndNoAnimationPauseAPIExists()async{await MainActor.run{let h=Harness(),b=h.owner.install(hooks:h.hooks())!;h.writeSucceeds=false;XCTAssertEqual(b.notify(.lifecycle),.writeFailed);h.owner.dispose();XCTAssertFalse(b.current)}}
    @MainActor func testPhysicalRevalidationRefusesChangedPoseOrRetiredBindingEvenWhenCoreStillMatches() {
        for retired in [false,true] {
            let h=Harness();var physical=true
            var hooks=h.hooks()
            hooks = .init(current:hooks.current,capture:{_ in
                .init(state:h.state,guardFields:.init(runMode:h.mode,skipRebuildBoard:false,journeyCompletedSaveVeto:false,gameHasEnded:false,gridReady:true,gameplayTransientBusy:false,freshArcadeEntryAuthorized:false),missingOwners:[],nativeCoherent:true,physicalStillMatches:{
                    if retired && !physical {h.owner.dispose();return true}
                    return physical
                })
            },stillMatches:hooks.stillMatches,write:hooks.write,wall:hooks.wall)
            let binding=h.owner.install(hooks:hooks)!
            physical=false
            XCTAssertEqual(binding.notify(.lifecycle),.obsolete)
            XCTAssertTrue(h.writes.isEmpty);XCTAssertEqual(h.state,0)
            h.owner.dispose()
        }
    }
}
