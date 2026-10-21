import XCTest
@testable import StackToSixGameplay

final class NativeSpecialMergeWorldTests:XCTestCase {
    private func tile(_ id:String,_ x:Int,_ archetype:NativeWildArchetype?=nil,_ variant:String?=nil)->NativeTile {
        .init(id:id,cell:.init(column:x,row:0),value:archetype == nil ? 2:6,archetype:archetype,variant:variant)
    }
    func testCatalogMembershipAllVariantsAndOriginals() {
        let worlds=["baloon":"beach","bee":"forest","flower":"forest","honey":"forest","mushroom":"forest","barell":"forest","fish":"beach","beach-ball":"beach","bottle":"beach","kanta":"area55","robo-cube":"area55","spaceship":"area55","laser-gun":"area55","cubero":"area55"]
        XCTAssertEqual(Set(worlds.keys),Set(NativeSpecialDiceRegistry.variants.keys))
        for (id,definition) in NativeSpecialDiceRegistry.variants {
            XCTAssertEqual(NativeSpecialDiceRegistry.celebrationWorld(for:tile("s",0,definition.archetype,id)),worlds[id])
        }
        for (core,world) in [(NativeWildArchetype.star,"forest"),(.juice,"beach"),(.magnet,"area55"),(.tnt,"area55")] {
            XCTAssertEqual(NativeSpecialDiceRegistry.celebrationWorld(for:tile("s",0,core)),world)
        }
        XCTAssertNil(NativeSpecialDiceRegistry.celebrationWorld(for:tile("ordinary",0)))
    }
    func testFinalDirectCommitUsesEitherContactDirectionAndRejectedOrStaleKeepsWorld() throws {
        for reverse in [false,true] {
            let pair=[tile("s",0,.star,"bee"),tile("d",1)]
            let initial=NativeBoardState(tiles:pair,lastSpecialMergeWorld:"beach")
            let e=NativeGameplayEngine(state:initial);e.stagedDirectWildMoves=true
            XCTAssertFalse(e.commitDirectWildGameplay(transactionID:"foreign").accepted)
            XCTAssertEqual(e.state.lastSpecialMergeWorld,"beach")
            XCTAssertTrue(e.beginDrag(tileID:reverse ? "d":"s"))
            XCTAssertTrue(e.drop(target:pair[reverse ? 0:1].cell).accepted)
            XCTAssertEqual(e.state.lastSpecialMergeWorld,"beach")
            let p=try XCTUnwrap(e.pendingDirectWild)
            XCTAssertTrue(e.commitDirectWildGameplay(transactionID:p.id).accepted)
            XCTAssertEqual(e.state.lastSpecialMergeWorld,"forest")
            XCTAssertFalse(e.commitDirectWildGameplay(transactionID:p.id).accepted)
            XCTAssertEqual(e.state.lastSpecialMergeWorld,"forest")
        }
    }
    func testRejectedDropAndLegacyMagnetCommit()throws {
        let initial=NativeBoardState(tiles:[tile("s",0,.magnet,"bottle"),tile("d",1),tile("a",2)],lastSpecialMergeWorld:"forest")
        let e=NativeGameplayEngine(state:initial,recordedRandomChoices:Array(repeating:0,count:200))
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertFalse(e.drop(target:.init(column:4,row:8)).accepted)
        XCTAssertEqual(e.state.lastSpecialMergeWorld,"forest")
        XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
        let p=try XCTUnwrap(e.pendingSpecial)
        XCTAssertEqual(e.state.lastSpecialMergeWorld,"forest")
        XCTAssertTrue(e.commitSpecialBoard(transactionID:p.id).accepted)
        XCTAssertEqual(e.state.lastSpecialMergeWorld,"beach")
    }
    func testOrdinarySixRetainsWorldAndOldSaveDecodes()throws {
        var a=tile("a",0),b=tile("b",1);a.value=3;b.value=3
        let e=NativeGameplayEngine(state:.init(tiles:[a,b],lastSpecialMergeWorld:"beach"))
        XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:b.cell).accepted)
        XCTAssertEqual(e.state.lastSpecialMergeWorld,"beach")
        let data=try JSONEncoder().encode(e.state)
        XCTAssertEqual(try JSONDecoder().decode(NativeBoardState.self,from:data).lastSpecialMergeWorld,"beach")
        var json=try XCTUnwrap(JSONSerialization.jsonObject(with:data) as? [String:Any]);json.removeValue(forKey:"lastSpecialMergeWorld")
        XCTAssertNil(try JSONDecoder().decode(NativeBoardState.self,from:JSONSerialization.data(withJSONObject:json)).lastSpecialMergeWorld)
    }
    func testStagedTntAndMagnetUpdateAtCommitNotReservationOrCancellation()throws {
        for core in [NativeWildArchetype.tnt,.magnet] {
            let variant=core == .tnt ? "flower":"honey"
            func engine()->NativeGameplayEngine {
                let e=NativeGameplayEngine(state:.init(tiles:[tile("s",0,core,variant),tile("d",1),tile("a",2)],lastSpecialMergeWorld:"beach"),recordedRandomChoices:Array(repeating:0,count:200))
                e.sourceMagnetMain80Enabled=core == .magnet;e.sourceTntMain80Enabled=core == .tnt;e.stagedTntActivation=core == .tnt
                XCTAssertTrue(e.beginDrag(tileID:"s"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
                return e
            }
            let e=engine(),p=try XCTUnwrap(e.pendingSpecial)
            XCTAssertEqual(e.state.lastSpecialMergeWorld,"beach")
            let r=try XCTUnwrap(e.registerSourceSpecialAbsorbOwner(transactionID:p.id,generation:p.generation))
            XCTAssertTrue(e.commitSourceSpecialAbsorbMain(receiptID:r.id,generation:r.generation).accepted)
            if core == .tnt {XCTAssertEqual(e.state.lastSpecialMergeWorld,"beach");XCTAssertTrue(e.commitSpecialActivation(transactionID:p.id).accepted)}
            XCTAssertEqual(e.state.lastSpecialMergeWorld,"forest")
            let cancelled=engine(),cp=try XCTUnwrap(cancelled.pendingSpecial)
            let cr=try XCTUnwrap(cancelled.registerSourceSpecialAbsorbOwner(transactionID:cp.id,generation:cp.generation))
            XCTAssertTrue(cancelled.cancelSourceSpecialAbsorb(receiptID:cr.id,generation:cr.generation).accepted)
            XCTAssertEqual(cancelled.state.lastSpecialMergeWorld,"beach")
        }
    }
}
