import XCTest
@testable import StackToSixGameplay

nonisolated final class NativeSourceMeterQueuePermissionTests:XCTestCase {
    private struct Packet:Decodable {let writerLines:[Int],writerRows:[Writer],blockerRows:[Blocker],permissionRows:[PermissionRow]}
    private struct Tile:Decodable {
        let id:String,value:Int,special:String?,locked:Bool,stackDepth:Int,gridX:Int,gridY:Int,eventMode:String,visible:Bool,alpha:Double
        let destroyed:Bool?,_cleanupToken:Int?,_wildMagnetAffected:Bool?,_ccWildSpawnDropping:Bool?,_ccWildSpawnHandoffLock:Bool?,_ccSpawnAnimating:Bool?,_spawnAnimating:Bool?,_isSpawning:Bool?,_isBeingSpawned:Bool?
    }
    private struct Writer:Decodable {let name:String,kind:String,now:Int64,token:UInt64?,tiles:[Tile]?,stamp:Int64,active:[UInt64]}
    private struct Expected:Decodable {let action:String,reason:String,retryDelayMs:Int?}
    private struct Guard:Decodable {let active:Bool,sources:[String]}
    private struct Blocker:Decodable {let name:String,enabled:[String],now:Int64,mutationDate:Int64,tiles:[Tile],`guard`:Guard,reason:String?,permission:Expected}
    private struct Input:Decodable {let tiles:[Tile],wildMeter:Double,boardWildSpawnEnabled:Bool,boardWildMeterEnabled:Bool,wildSpawnInProgress:Bool,busyEnding:Bool,boardTransitionActive:Bool,failScreenPending:Bool,activeAnimationBlockReason:String?}
    private struct PermissionRow:Decodable {let input:Input,expected:Expected}
    private func packet()throws->Packet {try JSONDecoder().decode(Packet.self,from:Data(contentsOf:XCTUnwrap(Bundle.module.url(forResource:"SourceMeterPermissionOracle",withExtension:"json"))))}
    private func engine(tiles:[Tile],meter:Double=1.25,busy:Bool=false)->NativeGameplayEngine {
        let e=NativeGameplayEngine(state:.init(tiles:tiles.map {t in
            .init(id:t.id,cell:.init(column:t.gridX,row:t.gridY),value:t.value,stackDepth:t.stackDepth,
                  archetype:t.special.flatMap(NativeWildArchetype.init(rawValue:)),locked:t.locked,visible:t.visible,alpha:t.alpha,
                  transientSpawn:t._isBeingSpawned==true,magnetOwned:t._wildMagnetAffected==true,merge6CleanupOwned:t._cleanupToken != nil)
        },wildMeter:meter))
        for t in tiles {var r=NativeNoMovesTileRuntime();r.destroyed=t.destroyed==true;r.eventMode=t.eventMode=="none" ? .none:t.eventMode=="passive" ? .passive:.normal;r.wildDropping=t._ccWildSpawnDropping==true;r.wildHandoff=t._ccWildSpawnHandoffLock==true;e.noMovesTileRuntime[t.id]=r}
        var f=NativeGameplayRuntimeFlags();f.busyEnding=busy;e.setRuntimeFlags(f);return e
    }
    private func markers(_ tiles:[Tile])->[NativeSourceMeterQueueTileMarkers] {tiles.map {t in
        .init(tileID:t.id,destroyed:t.destroyed==true,cleanupClaim:t._cleanupToken != nil,magnetAffected:t._wildMagnetAffected==true,
              wildDropping:t._ccWildSpawnDropping==true,wildHandoff:t._ccWildSpawnHandoffLock==true,
              ccSpawnAnimating:t._ccSpawnAnimating==true,spawnAnimating:t._spawnAnimating==true,isSpawning:t._isSpawning==true)
    }}
    private func environment(_ e:NativeGameplayEngine,date:Int64=1000,meterEnabled:Bool=true,spawnEnabled:Bool=true,queue:Bool=false,enabled:[String]=[],guardState:Guard?=nil,tiles:[NativeSourceMeterQueueTileMarkers]?=nil)->NativeSourceMeterQueueEnvironment {
        .init(generation:e.state.generation,sourceDateMilliseconds:date,boardMeterEnabled:meterEnabled,boardSpawnEnabled:spawnEnabled,queueInProgress:queue,
              boardTransitionActive:enabled.contains("transition"),failScreenPending:enabled.contains("fail"),specialTransactionActive:enabled.contains("special"),
              endgameGuardActive:guardState?.active ?? false,endgameGuardSources:guardState?.sources ?? [],mergeSixSpawnInProgress:enabled.contains("mergeSix"),
              wildMagnetPullInProgress:enabled.contains("pull"),wildDropInProgress:enabled.contains("drop"),tiles:tiles ?? e.state.tiles.map {t in
                  .init(tileID:t.id,destroyed:false,cleanupClaim:false,magnetAffected:false,wildDropping:false,wildHandoff:false,ccSpawnAnimating:false,spawnAnimating:false,isSpawning:false)
              })
    }
    private func equal(_ actual:NativeWildMeterRules.Permission,_ expected:Expected,_ name:String) {
        XCTAssertEqual(actual.action.rawValue,expected.action,name);XCTAssertEqual(actual.reason,expected.reason,name);XCTAssertEqual(actual.retryDelayMs,expected.retryDelayMs,name)
    }
    func testFourActualSourceMutationWritersAndThirteenCapturedReceipts()throws {
        let p=try packet();XCTAssertEqual(p.writerLines,[3378,3409,12717,14590]);XCTAssertEqual(p.writerRows.count,13)
        var ledger=NativeSourceMeterMutationLedger(generation:1)
        var native=NativeGameplayEngine(state:.init(tiles:[]))
        for row in p.writerRows {
            let writer:NativeSourceMeterMutationLedger.Writer
            switch row.kind {
            case "begin":writer = .regularHandoffBegan(try XCTUnwrap(row.token))
            case "release":writer = .regularHandoffReleased(try XCTUnwrap(row.token))
            case "allocate":writer = .mergeSixSpawnOwnerAllocated(try XCTUnwrap(row.token))
            default:
                native=engine(tiles:try XCTUnwrap(row.tiles))
                writer = .checkLevelEndSignatureObserved(.init(activeEntries:try XCTUnwrap(row.tiles).filter {t in NativeSourceEndgameChecker.active(native.state.tiles.first{$0.id==t.id}!,runtime:native.noMovesTileRuntime[t.id] ?? .init())}.map {t in .init(value:t.value,special:t.special,locked:t.locked,depth:t.stackDepth,x:t.gridX,y:t.gridY,eventMode:t.eventMode)}))
            }
            ledger.record(writer,generation:1,sourceDateMilliseconds:row.now)
            XCTAssertEqual(ledger.lastMutationDateMilliseconds,row.stamp,row.name);XCTAssertEqual(ledger.activeRegularHandoffs,Set(row.active),row.name)
        }
    }
    func testFiftyLiteralSourceOrderedBlockersAndActualPermissionReadOnly()throws {
        let rows=try packet().blockerRows;XCTAssertEqual(rows.count,50)
        for row in rows {
            let e=engine(tiles:row.tiles,busy:row.enabled.contains("busy"))
            if row.enabled.contains("regular") {e.recordSourceMeterBoardMutation(.regularHandoffBegan(1),generation:1,sourceDateMilliseconds:0)}
            if row.mutationDate != 0 {e.recordSourceMeterBoardMutation(.mergeSixSpawnOwnerAllocated(1),generation:1,sourceDateMilliseconds:row.mutationDate)}
            let env=environment(e,date:row.now,enabled:row.enabled,guardState:row.guard,tiles:markers(row.tiles)),before=e.state,flags=e.flags
            XCTAssertEqual(e.sourceMeterAnimationBlockReason(environment:env),row.reason,row.name);equal(e.meterSourceQueuePermission(environment:env),row.permission,row.name)
            XCTAssertEqual(e.state,before,row.name);XCTAssertEqual(e.flags,flags,row.name)
        }
    }
    func testFifteenLiteralPermissionPrioritiesIncludingOuterSelfFlag()throws {
        let rows=try packet().permissionRows;XCTAssertEqual(rows.count,15)
        for row in rows {
            let i=row.input,e=engine(tiles:i.tiles,meter:i.wildMeter,busy:i.busyEnding)
            var enabled:[String]=[];if i.boardTransitionActive {enabled.append("transition")};if i.failScreenPending {enabled.append("fail")}
            if i.activeAnimationBlockReason=="special-transaction" {enabled.append("special")}
            if i.activeAnimationBlockReason=="merge6-spawn-in-progress" {enabled.append("mergeSix")}
            if i.activeAnimationBlockReason=="board-settling" {e.recordSourceMeterBoardMutation(.mergeSixSpawnOwnerAllocated(1),generation:1,sourceDateMilliseconds:1000)}
            equal(e.meterSourceQueuePermission(environment:environment(e,meterEnabled:i.boardWildMeterEnabled,spawnEnabled:i.boardWildSpawnEnabled,queue:i.wildSpawnInProgress,enabled:enabled,tiles:markers(i.tiles))),row.expected,"permission-\(i)")
        }
    }
    func testActualSignatureObservationExcludesIdentityAlphaAndIncludesEventMode()throws {
        let rows=try packet().writerRows.filter{$0.kind=="observe"},e=engine(tiles:try XCTUnwrap(rows.first?.tiles))
        let first=try XCTUnwrap(rows.first)
        XCTAssertEqual(e.observeSourceMeterCheckLevelEndSignature(generation:1,sourceDateMilliseconds:first.now,eventModes:Dictionary(uniqueKeysWithValues:try XCTUnwrap(first.tiles).map{($0.id,NativeSourceMeterEventMode($0.eventMode))})),true)
        XCTAssertEqual(e.sourceMeterLastBoardMutationDateMilliseconds,100)
        XCTAssertNil(e.observeSourceMeterCheckLevelEndSignature(generation:1,sourceDateMilliseconds:110,eventModes:[:]))
        XCTAssertEqual(e.sourceMeterLastBoardMutationDateMilliseconds,100)
        let modes=Dictionary(uniqueKeysWithValues:e.state.tiles.map{($0.id,NativeSourceMeterEventMode($0.id=="a" ? "dynamic":"static"))})
        XCTAssertEqual(e.observeSourceMeterCheckLevelEndSignature(generation:1,sourceDateMilliseconds:140,eventModes:modes),true)
        XCTAssertEqual(e.observeSourceMeterCheckLevelEndSignature(generation:1,sourceDateMilliseconds:160,eventModes:modes),false)
        XCTAssertEqual(e.sourceMeterLastBoardMutationDateMilliseconds,140)
    }
    func testCaptureGenerationDuplicateReleaseAndPauseDoNotStampNewDate()throws {
        let e=engine(tiles:try XCTUnwrap(try packet().blockerRows.first?.tiles))
        XCTAssertTrue(e.recordSourceMeterBoardMutation(.regularHandoffBegan(1),generation:1,sourceDateMilliseconds:1000))
        XCTAssertFalse(e.recordSourceMeterBoardMutation(.regularHandoffBegan(1),generation:1,sourceDateMilliseconds:1050))
        XCTAssertEqual(e.sourceMeterAnimationBlockReason(environment:environment(e,date:9000)),"regular-merge-handoff","Paused/callback delay alone does not release real capture")
        XCTAssertTrue(e.recordSourceMeterBoardMutation(.regularHandoffReleased(1),generation:1,sourceDateMilliseconds:9000))
        XCTAssertFalse(e.recordSourceMeterBoardMutation(.regularHandoffReleased(1),generation:1,sourceDateMilliseconds:9999))
        XCTAssertEqual(e.sourceMeterLastBoardMutationDateMilliseconds,9000)
        e.restart(state:.init(tiles:e.state.tiles,generation:999,wildMeter:1.25))
        XCTAssertEqual(e.state.generation,2,"Engine actual generation, not caller fresh payload, owns new ledger")
        XCTAssertEqual(e.sourceMeterLastBoardMutationDateMilliseconds,9000,"Literal transient reset retains app-lived Source Date")
        XCTAssertFalse(e.recordSourceMeterBoardMutation(.regularHandoffReleased(1),generation:1,sourceDateMilliseconds:10000))
        let replacement=engine(tiles:try XCTUnwrap(try packet().blockerRows.first?.tiles))
        XCTAssertTrue(replacement.adoptSourceMeterMutationSnapshot(e.sourceMeterMutationSnapshot,generation:1))
        XCTAssertEqual(replacement.sourceMeterLastBoardMutationDateMilliseconds,9000)
        XCTAssertEqual(replacement.meterSourceQueuePermission(environment:environment(replacement,date:9079)).reason,"board-settling")
        XCTAssertFalse(replacement.adoptSourceMeterMutationSnapshot(e.sourceMeterMutationSnapshot,generation:1))
        XCTAssertTrue(e.recordSourceMeterBoardMutation(.regularHandoffBegan(2),generation:2,sourceDateMilliseconds:10000))
    }
    func testZeroDateBackwardsDateAndExactEightyBoundary() {
        var ledger=NativeSourceMeterMutationLedger(generation:1)
        ledger.record(.mergeSixSpawnOwnerAllocated(1),generation:1,sourceDateMilliseconds:0)
        XCTAssertFalse(ledger.isBoardSettling(sourceDateMilliseconds:1))
        ledger.record(.mergeSixSpawnOwnerAllocated(2),generation:1,sourceDateMilliseconds:1000)
        XCTAssertTrue(ledger.isBoardSettling(sourceDateMilliseconds:500));XCTAssertTrue(ledger.isBoardSettling(sourceDateMilliseconds:1079))
        XCTAssertFalse(ledger.isBoardSettling(sourceDateMilliseconds:1080));XCTAssertFalse(ledger.isBoardSettling(sourceDateMilliseconds:1081))
    }
    func testMissingActualMarkerCaptureRefusesAdmissionAndVisualPlanPresenceIsNotBlocker()throws {
        let e=engine(tiles:try XCTUnwrap(try packet().blockerRows.first?.tiles))
        XCTAssertEqual(e.meterSourceQueuePermission(environment:environment(e,tiles:[])).reason,"source-meter-markers-unavailable")
        e.sourceSaveRuntime.activeDrag=true;e.sourceSaveRuntime.tileMarkers=[.init()]
        XCTAssertEqual(e.meterSourceQueuePermission(environment:environment(e)).action,.allow,"Save/input/hint observations are not invented meter blockers")
    }
}
