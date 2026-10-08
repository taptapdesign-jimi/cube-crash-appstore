import XCTest
@testable import StackToSixGameplay
final class NativeWildRejectedEngineSourceTests:XCTestCase {
    struct Row:Decodable {
        struct Event:Decodable {let kind:String;let at:Int}
        struct Tile:Decodable {let c,r,value:Int;let locked:Bool}
        let mode:String;let rejectPermits:Int;let lockedCount:Int;let trace:[Event];let tiles:[Tile]
    }
    func testActualRejectedPrimaryCallsitesMatchConnectedRetryFallbackAndFailedAccounting()throws {
        let rows=try JSONDecoder().decode([Row].self,from:NativeWildRejectedCallsiteOracle.data);XCTAssertEqual(rows.count,4)
        for row in rows {
            var tiles=[NativeTile(id:"a",cell:.init(column:0,row:0),value:6,archetype:.juice),NativeTile(id:"b",cell:.init(column:1,row:0),value:5),NativeTile(id:"survivor",cell:.init(column:4,row:8),value:2)]
            if row.lockedCount>0 {tiles.append(NativeTile(id:"locked0",cell:.init(column:0,row:1),value:0,locked:true,alpha:0.2))}
            let e=NativeGameplayEngine(state:NativeBoardState(tiles:tiles,board:10),recordedRandomChoices:Array(repeating:0.2,count:1000))
            e.stagedDirectWildMoves=true;e.stagedDirectWildAssignments=true
            var rejected=0
            e.wildSpawnPermitAdmission={purpose in
                if (row.rejectPermits==99 || purpose == .primary || purpose == .hardFallback) && rejected<row.rejectPermits {rejected+=1;return false}
                return true
            }
            XCTAssertTrue(e.beginDrag(tileID:"a"));XCTAssertTrue(e.drop(target:.init(column:1,row:0)).accepted)
            let plan=try XCTUnwrap(e.pendingDirectWild),first=e.commitDirectWildGameplay(transactionID:plan.id)
            XCTAssertTrue(first.accepted)
            var now=80,sequence=0,assignments=first.events.filter{$0.kind == .spawned && ($0.value ?? 0)>0}.map{_ in now}
            var timers:[(at:Int,id:Int,fn:()->Void)]=[],scheduled:Set<String>=[]
            func schedule(_ delay:Int,_ fn:@escaping()->Void){sequence+=1;timers.append((now+delay,sequence,fn))}
            func pump(){
                for action in e.pendingWildSpawnActions where scheduled.insert(action.id).inserted {
                    schedule(action.delayMilliseconds){let result=e.commitWildSpawnAction(transactionID:plan.id,generation:plan.generation,actionID:action.id);XCTAssertTrue(result.accepted);assignments += result.events.filter{$0.kind == .spawned && ($0.value ?? 0)>0}.map{_ in now};pump()}
                }
                for arrival in e.pendingWildSpawnArrivals where scheduled.insert("arrival:"+arrival.id).inserted {
                    schedule(560){XCTAssertTrue(e.finishWildSpawnArrival(transactionID:plan.id,generation:plan.generation,arrivalID:arrival.id).accepted);pump()}
                }
            }
            pump();var callbacks=0
            while !timers.isEmpty && callbacks<100 {timers.sort{$0.at != $1.at ? $0.at<$1.at:$0.id<$1.id};let t=timers.removeFirst();now=t.at;t.fn();callbacks+=1}
            XCTAssertLessThan(callbacks,100)
            XCTAssertEqual(assignments,row.trace.filter{$0.kind=="assignment"}.map(\.at),"\(row.mode)/\(row.rejectPermits)")
            func cells(_ tiles:[NativeTile])->[String]{tiles.map{"\($0.cell.column),\($0.cell.row):\($0.value):\($0.locked)"}.sorted()}
            let expected=row.tiles.map{"\($0.c),\($0.r):\($0.value):\($0.locked)"}.sorted()
            XCTAssertEqual(cells(e.state.tiles),expected,"\(row.mode)/\(row.rejectPermits)")
            XCTAssertEqual(e.state.moves,49);XCTAssertTrue(e.state.validationIssues().isEmpty)
            let failedAccounting=row.mode=="normal" || row.rejectPermits==99
            XCTAssertEqual(e.beginDrag(tileID:"survivor"),!failedAccounting);e.cancelDrag()
            XCTAssertTrue(e.releaseDirectWildPresentation(transactionID:plan.id,generation:plan.generation).accepted)
            XCTAssertEqual(e.pendingDirectWild != nil,failedAccounting)
            let current=e.state.tiles;e.cancelForBackground();XCTAssertNil(e.pendingDirectWild);XCTAssertEqual(e.state.tiles,current)
        }
    }
}
