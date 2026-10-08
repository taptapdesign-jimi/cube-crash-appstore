import XCTest
@testable import StackToSixGameplay

final class NativeWildSpawnPhaseTests:XCTestCase {
    struct Row:Decodable { let inputTag:String?;let mode:String;let archetype:String;let lockedCount:Int;let multiplier:Int;let orbitCount:Int;let trace:[Trace];let tiles:[Tile] }
    struct Trace:Decodable {let at:Int;let kind:String;let value:Int?}
    struct Tile:Decodable {let value:Int;let locked:Bool}
    func testOriginalWildCoroutinesDriveNativePhaseOrderAcross432Pools()throws {
        let rows=try JSONDecoder().decode([Row].self,from:NativeWildSpawnPhaseOracle.data)
        XCTAssertEqual(rows.filter{$0.inputTag==nil}.count,432)
        for row in rows where row.inputTag==nil {
            let mode:NativeWildSpawnPhaseOwner.Mode=row.mode == "normal" ? .normal:row.mode == "endgame" ? .endgame:.arcade
            let p=NativeWildSpawnPhaseOwner(id:"wild",generation:1,mode:mode,archetype:row.archetype=="star" ? .star:.juice,spawnCount:row.multiplier,orbitCount:row.orbitCount)
            var now=80,timerSequence=0,freshSequence=0,assignments:[Int]=[],holders:[NativeCell:Int]=[:],locked:Set<NativeCell>=[]
            var timers:[(at:Int,id:Int,callback:()->Void)]=[]
            for i in 0..<row.lockedCount {let cell=NativeCell(column:i%5,row:1+i/5);holders[cell]=0;locked.insert(cell)}
            holders[NativeCell(column:4,row:8)]=2
            func schedule(_ delay:Int,_ fn:@escaping()->Void){timerSequence+=1;timers.append((now+delay,timerSequence,fn))}
            func randomEmpty()->NativeCell? {
                var cells:[NativeCell]=[]
                for r in 0..<9 {for c in 0..<5 {let cell=NativeCell(column:c,row:r);if cell != NativeCell(column:1,row:0) && (holders[cell]==nil || locked.contains(cell) && holders[cell]==0) {cells.append(cell)}}}
                return cells.isEmpty ? nil:cells[min(cells.count-1,Int(Double(cells.count)*0.2))]
            }
            var scheduled:Set<String>=[]
            func pump(){
                guard let command=p.command,scheduled.insert(command.id).inserted else{return}
                schedule(command.delayMilliseconds){
                    switch command.kind {
                    case .primary,.juiceExtra,.juiceSafetyPrimary,.remainderPrimary:
                        let cell=command.kind == .primary ? NativeCell(column:1,row:0):randomEmpty()
                        if let cell {
                            holders[cell]=1;locked.remove(cell);assignments.append(now);freshSequence+=1
                            let arrival="fresh\(freshSequence)"
                            if command.kind == .primary {XCTAssertTrue(p.acknowledgePrimaryAssignment(commandID:command.id,generation:1,arrivalID:arrival))}
                            else if command.kind == .remainderPrimary {XCTAssertTrue(p.acknowledgeRemainderAssignment(commandID:command.id,generation:1,arrivalID:arrival,hasCell:true))}
                            else {XCTAssertTrue(p.acknowledgeExtraPrimary(commandID:command.id,generation:1,arrivalID:arrival))}
                            schedule(560){XCTAssertTrue(p.acknowledgeArrival(arrival,generation:1));pump()}
                        } else if command.kind == .remainderPrimary {XCTAssertTrue(p.acknowledgeRemainderAssignment(commandID:command.id,generation:1,arrivalID:nil,hasCell:false))}
                        else {XCTAssertTrue(p.acknowledgeExtraPrimary(commandID:command.id,generation:1,arrivalID:nil))}
                    case .baseLocked,.extraLocked,.remainderFallback,.forcedLocked,.emergencyLocked:
                        var pool=locked.sorted{$0.row != $1.row ? $0.row<$1.row:$0.column<$1.column}
                        // Actual source Fisher-Yates. Values are pinned1 in the source oracle.
                        if pool.count>1 {for i in stride(from:pool.count-1,through:1,by:-1){pool.swapAt(i,Int(Double(i+1)*0.2))}}
                        let picked=Array(pool.prefix(command.count))
                        if picked.isEmpty {XCTAssertTrue(p.acknowledgeLockedBatch(commandID:command.id,generation:1,openedCount:0))}
                        else {for (i,cell) in picked.enumerated(){schedule((command.kind == .forcedLocked ? 0:50)+i*100){holders[cell]=1;locked.remove(cell);assignments.append(now);if i==picked.count-1 {XCTAssertTrue(p.acknowledgeLockedBatch(commandID:command.id,generation:1,openedCount:picked.count));pump()}}}}
                    case .remainderWait:XCTAssertTrue(p.acknowledgeRemainderWait(commandID:command.id,generation:1))
                    case .juiceSafety:XCTAssertTrue(p.acknowledgeJuiceSafety(commandID:command.id,generation:1))
                    case .minimumActive:XCTAssertTrue(p.acknowledgeMinimum(commandID:command.id,generation:1,activeCount:holders.filter{$0.value>0 && !locked.contains($0.key)}.count))
                    case .emergencyFallback:XCTAssertTrue(p.acknowledgeEmergencyFallback(commandID:command.id,generation:1))
                    }
                    pump()
                }
            }
            XCTAssertNotNil(p.begin());XCTAssertTrue(p.acknowledgeConsumedIdentitiesRetired(generation:1));pump()
            var callbacks=0
            while !timers.isEmpty {
                timers.sort{$0.at != $1.at ? $0.at<$1.at:$0.id<$1.id};let timer=timers.removeFirst();now=timer.at;timer.callback();callbacks+=1
                XCTAssertLessThan(callbacks,500)
                if callbacks>=500 {break}
            }
            XCTAssertTrue(p.complete,"\(row.mode)/\(row.archetype)/\(row.lockedCount)/\(row.multiplier)/\(row.orbitCount)")
            XCTAssertTrue(p.ordinaryInputReleased)
            XCTAssertEqual(assignments,row.trace.filter{$0.kind=="assignment"}.map(\.at))
            XCTAssertEqual(locked.count,row.tiles.filter(\.locked).count)
            XCTAssertEqual(holders.count-locked.count,row.tiles.filter{!$0.locked}.count)
        }
    }
    func testPrimaryArrivalAndConsumedIdentityPostconditionRequireTheirOwnOnceGenerationBoundReceipts() {
        let p=NativeWildSpawnPhaseOwner(id:"wild",generation:7,mode:.arcade,archetype:.star,spawnCount:2,orbitCount:1)
        let c=p.begin()!;XCTAssertEqual(c.delayMilliseconds,50);XCTAssertNil(p.begin())
        XCTAssertFalse(p.acknowledgePrimaryAssignment(commandID:c.id,generation:6,arrivalID:"a"))
        XCTAssertTrue(p.acknowledgePrimaryAssignment(commandID:c.id,generation:7,arrivalID:"a"))
        XCTAssertFalse(p.ordinaryInputReleased);XCTAssertFalse(p.acknowledgeArrival("a",generation:8))
        XCTAssertTrue(p.acknowledgeArrival("a",generation:7));XCTAssertTrue(p.complete);XCTAssertFalse(p.ordinaryInputReleased)
        XCTAssertFalse(p.acknowledgeArrival("a",generation:7));XCTAssertFalse(p.acknowledgeConsumedIdentitiesRetired(generation:6))
        XCTAssertTrue(p.acknowledgeConsumedIdentitiesRetired(generation:7));XCTAssertTrue(p.ordinaryInputReleased);XCTAssertFalse(p.acknowledgeConsumedIdentitiesRetired(generation:7))
    }
    func testLifecycleCancellationRevokesOldPhaseAndArrivalWithoutCompletingTheRun() {
        let p=NativeWildSpawnPhaseOwner(id:"old",generation:7,mode:.normal,archetype:.star,spawnCount:2,orbitCount:3)
        XCTAssertFalse(p.acknowledgeConsumedIdentitiesRetired(generation:7))
        let c=p.begin()!;XCTAssertTrue(p.acknowledgePrimaryAssignment(commandID:c.id,generation:7,arrivalID:"old-primary"))
        p.cancelForLifecycle();XCTAssertTrue(p.cancelled);XCTAssertNil(p.command);XCTAssertFalse(p.complete)
        XCTAssertFalse(p.acknowledgeArrival("old-primary",generation:7));XCTAssertFalse(p.acknowledgeConsumedIdentitiesRetired(generation:7));XCTAssertNil(p.begin())
        let unsupported=NativeWildSpawnPhaseOwner(id:"tnt",generation:1,mode:.normal,archetype:.tnt,spawnCount:2,orbitCount:1)
        XCTAssertNil(unsupported.begin())
    }

}
