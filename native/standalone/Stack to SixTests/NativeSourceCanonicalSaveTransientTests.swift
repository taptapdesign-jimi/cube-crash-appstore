import XCTest
@testable import Stack_to_Six

final class NativeSourceCanonicalSaveTransientTests:XCTestCase {
    struct Oracle:Decodable {struct Row:Decodable{let stop:Int,busy:Bool,order:[String]};let transientRows:[Row]}
    func testLiteralOriginalTransientQueryOrderAndAllShortCircuits()async throws {
        let o=try JSONDecoder().decode(Oracle.self,from:Data(contentsOf:Bundle(for:Self.self).url(forResource:"NativeSourceCanonicalSaveOracle",withExtension:"json")!))
        await MainActor.run {
            for row in o.transientRows {
                var trace:[String]=[]
                let names=["busy","spawn","special","handoff","cleanup","drag","drop","tiles"]
                func read(_ i:Int)->Bool? {trace.append(names[i]);return row.stop==i}
                let h=NativeSourceCanonicalSaveTransient.Hooks(current:{true},busyEnding:{read(0)},spawningOrPulling:{read(1)},specialActive:{read(2)},regularHandoff:{read(3)},cleanupClaim:{read(4)},livingDrag:{read(5)},foregroundDrop:{read(6)},livingTileMarker:{read(7)})
                XCTAssertEqual(NativeSourceCanonicalSaveTransient.capture(h),.known(row.busy))
                XCTAssertEqual(trace.filter{!["busy","spawn"].contains($0)},row.order,"stop \(row.stop)")
            }
        }
    }
    func testMissingActualOwnerRefusesWithoutQueryingSubsequentRegistries()async {
        await MainActor.run {
            var later=0
            let h=NativeSourceCanonicalSaveTransient.Hooks(current:{true},busyEnding:{false},spawningOrPulling:{nil},specialActive:{later+=1;return false},regularHandoff:{later+=1;return false},cleanupClaim:{false},livingDrag:{false},foregroundDrop:{false},livingTileMarker:{false})
            XCTAssertEqual(NativeSourceCanonicalSaveTransient.capture(h),.missing("source-spawn-or-pull"));XCTAssertEqual(later,0)
        }
    }
    func testReentrantGetterRetirementCannotPublishFalseOrReadLaterSourceOwner()async {
        await MainActor.run {
            var current=true,later=0
            let h=NativeSourceCanonicalSaveTransient.Hooks(current:{current},busyEnding:{false},spawningOrPulling:{false},specialActive:{current=false;return false},regularHandoff:{later+=1;return false},cleanupClaim:{false},livingDrag:{false},foregroundDrop:{false},livingTileMarker:{false})
            XCTAssertEqual(NativeSourceCanonicalSaveTransient.capture(h),.obsolete);XCTAssertEqual(later,0)
        }
    }
    func testAdmissionIsDistinctFromGenuineFreshArcadeSaveRequest()async {
        await MainActor.run {
            typealias Owner=NativeSourceCanonicalSaveOwner<Int>
            var admissions=0,fresh=0,normal=0
            let owner=Owner()
            let hooks=Owner.Hooks(current:{true},capture:{request in
                switch request {case .admission:admissions+=1;case .save(let f):if f{fresh+=1}else{normal+=1}}
                return .init(state:0,guardFields:.init(runMode:"arcade_home",skipRebuildBoard:false,journeyCompletedSaveVeto:false,gameHasEnded:false,gridReady:true,gameplayTransientBusy:false,freshArcadeEntryAuthorized:true),missingOwners:[],nativeCoherent:true)
            },stillMatches:{$0==0},write:{_ in true},wall:{_,_ in nil})
            let binding=owner.install(hooks:hooks)!
            XCTAssertEqual(admissions,1);XCTAssertEqual(fresh,0);XCTAssertEqual(normal,0)
            XCTAssertEqual(binding.notify(.lifecycle),.written);XCTAssertEqual(normal,1);XCTAssertEqual(fresh,0)
            XCTAssertEqual(binding.notify(.preparedArcadeEntry),.written);XCTAssertEqual(fresh,1)
            owner.dispose()
        }
    }
}
