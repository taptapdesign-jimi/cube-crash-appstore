import XCTest
@testable import StackToSixGameplay
final class NativeSourceNoMovesTests:XCTestCase {
    func tile(_ id:String,_ value:Int,_ column:Int=0,_ archetype:NativeWildArchetype?=nil)->NativeTile {NativeTile(id:id,cell:.init(column:column,row:0),value:value,archetype:archetype)}
    func engine()->NativeGameplayEngine {let e=NativeGameplayEngine(state:.init(tiles:[tile("a",4),tile("b",3,1)]));e.stagedSourceNoMoves=true;return e}
    func plan(_ e:NativeGameplayEngine)->NativeNoMovesCandidateOwner.Plan {guard case .candidate(let p)=e.beginSourceNoMoves(origin:.levelEnd) else{fatalError("candidate")};return p}
    func lock(_ e:NativeGameplayEngine,_ p:NativeNoMovesCandidateOwner.Plan)->NativeNoMovesCandidateOwner.Effect {
        XCTAssertEqual(e.deliverSourceNoMovesWait(plan:p,generation:1),.exit(p))
        XCTAssertEqual(e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.exited),.acquireInputLock(p))
        return e.acquireSourceNoMovesLock(plan:p,generation:1)
    }
    func testPinnedFreshChecker129Cases() {
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t0",1,1,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t1",1,2,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t2",1,3,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t3",2,4,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t4",1,0,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t5",3,1,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t6",1,2,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t7",4,3,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t8",1,4,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t9",5,0,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t10",1,1,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t11",6,2,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t12",2,3,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t13",1,4,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t14",2,0,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t15",2,1,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t16",2,2,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t17",3,3,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t18",2,4,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t19",4,0,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t20",2,1,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t21",5,2,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t22",2,3,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t23",6,4,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t24",3,0,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t25",1,1,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t26",3,2,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t27",2,3,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t28",3,4,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t29",3,0,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t30",3,1,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t31",4,2,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t32",3,3,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t33",5,4,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t34",3,0,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t35",6,1,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t36",4,2,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t37",1,3,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t38",4,4,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t39",2,0,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t40",4,1,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t41",3,2,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t42",4,3,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t43",4,4,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t44",4,0,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t45",5,1,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t46",4,2,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t47",6,3,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t48",5,4,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t49",1,0,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t50",5,1,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t51",2,2,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t52",5,3,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t53",3,4,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t54",5,0,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t55",4,1,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t56",5,2,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t57",5,3,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t58",5,4,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t59",6,0,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t60",6,1,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t61",1,2,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t62",6,3,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t63",2,4,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t64",6,0,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t65",3,1,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t66",6,2,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t67",4,3,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t68",6,4,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t69",5,0,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t70",6,1,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t71",6,2,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t72",6,3,.star);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t73",4,4,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t74",6,0,.star);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t75",6,1,.star);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t76",6,2,.star);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t77",6,3,.juice);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t78",6,4,.star);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t79",6,0,.magnet);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t80",6,1,.star);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t81",6,2,.tnt);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t82",6,3,.juice);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t83",4,4,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t84",6,0,.juice);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t85",6,1,.star);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t86",6,2,.juice);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t87",6,3,.juice);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t88",6,4,.juice);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t89",6,0,.magnet);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t90",6,1,.juice);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t91",6,2,.tnt);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t92",6,3,.magnet);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t93",4,4,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t94",6,0,.magnet);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t95",6,1,.star);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t96",6,2,.magnet);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t97",6,3,.juice);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t98",6,4,.magnet);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t99",6,0,.magnet);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t100",6,1,.magnet);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t101",6,2,.tnt);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t102",6,3,.tnt);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t103",4,4,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t104",6,0,.tnt);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t105",6,1,.star);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t106",6,2,.tnt);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t107",6,3,.juice);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t108",6,4,.tnt);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t109",6,0,.magnet);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t110",6,1,.tnt);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t111",6,2,.tnt);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"no_merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t112",1,3,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t113",1,4,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t114",1,0,nil);t.cell.row=5;t.stackDepth=2;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t115",1,1,nil);t.cell.row=5;t.stackDepth=2;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t116",1,2,nil);t.cell.row=5;t.stackDepth=3;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t117",1,3,nil);t.cell.row=5;t.stackDepth=3;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t118",3,4,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t119",3,0,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t120",3,1,nil);t.cell.row=6;t.stackDepth=2;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t121",3,2,nil);t.cell.row=6;t.stackDepth=2;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t122",3,3,nil);t.cell.row=6;t.stackDepth=3;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t123",3,4,nil);t.cell.row=6;t.stackDepth=3;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t124",6,0,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.complete);XCTAssertEqual(result.reason,"only_merge6_remains")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t125",6,1,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.complete);XCTAssertEqual(result.reason,"only_merge6_remains")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t126",6,2,nil);t.cell.row=7;t.stackDepth=2;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.complete);XCTAssertEqual(result.reason,"only_merge6_remains")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t127",6,3,nil);t.cell.row=7;t.stackDepth=2;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.complete);XCTAssertEqual(result.reason,"only_merge6_remains")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t128",6,4,nil);t.cell.row=7;t.stackDepth=3;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.complete);XCTAssertEqual(result.reason,"only_merge6_remains")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t129",6,0,nil);t.cell.row=8;t.stackDepth=3;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.complete);XCTAssertEqual(result.reason,"only_merge6_remains")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t130",6,1,nil);t.cell.row=8;t.stackDepth=1;t.locked=true;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t131",4,2,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t132",6,3,.star);t.cell.row=8;t.stackDepth=1;t.locked=true;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t133",4,4,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t134",6,0,.juice);t.cell.row=0;t.stackDepth=1;t.locked=true;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t135",4,1,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t136",6,2,.magnet);t.cell.row=0;t.stackDepth=1;t.locked=true;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t137",4,3,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t138",6,4,.tnt);t.cell.row=0;t.stackDepth=1;t.locked=true;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t139",4,0,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t140",6,1,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=false;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t141",4,2,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t142",6,3,.star);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=false;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t143",4,4,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t144",6,0,.juice);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=false;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t145",4,1,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t146",6,2,.magnet);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=false;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t147",4,3,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t148",6,4,.tnt);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=false;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t149",4,0,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t150",6,1,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t151",4,2,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t152",6,3,.star);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t153",4,4,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t154",6,0,.juice);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t155",4,1,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t156",6,2,.magnet);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t157",4,3,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t158",6,4,.tnt);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=0;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t159",4,0,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t160",6,1,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=true;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t161",4,2,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t162",6,3,.star);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=true;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t163",4,4,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t164",6,0,.juice);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=true;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t165",4,1,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t166",6,2,.magnet);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=true;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t167",4,3,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t168",6,4,.tnt);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=true;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t169",4,0,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t170",6,1,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=true;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t171",4,2,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t172",6,3,.star);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=true;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t173",4,4,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t174",6,0,.juice);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=true;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t175",4,1,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t176",6,2,.magnet);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=true;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t177",4,3,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t178",6,4,.tnt);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=true;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t179",4,0,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t180",6,1,nil);t.cell.row=0;t.stackDepth=1;t.locked=true;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=true;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t181",4,2,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"transient_locked_spawn")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t182",6,3,.star);t.cell.row=0;t.stackDepth=1;t.locked=true;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=true;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t183",4,4,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"transient_locked_spawn")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t184",6,0,.juice);t.cell.row=1;t.stackDepth=1;t.locked=true;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=true;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t185",4,1,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t186",6,2,.magnet);t.cell.row=1;t.stackDepth=1;t.locked=true;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=true;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t187",4,3,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"transient_locked_spawn")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t188",6,4,.tnt);t.cell.row=1;t.stackDepth=1;t.locked=true;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=true;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t189",4,0,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"transient_locked_spawn")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t190",6,1,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t191",4,2,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t192",6,3,.star);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t193",4,4,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t194",6,0,.juice);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=true;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t195",4,1,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t196",6,2,.magnet);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t197",4,3,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t198",6,4,.tnt);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t199",4,0,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t200",6,1,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=true;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t201",4,2,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"transient_locked_spawn")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t202",6,3,.star);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=true;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t203",4,4,nil);t.cell.row=4;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"transient_locked_spawn")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t204",6,0,.juice);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=true;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t205",4,1,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"transient_locked_spawn")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t206",6,2,.magnet);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=true;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t207",4,3,nil);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"transient_locked_spawn")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t208",6,4,.tnt);t.cell.row=5;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=true;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t209",4,0,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"transient_locked_spawn")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t210",6,1,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=true;runtime[t.id]=r}
            do {var t=tile("t211",4,2,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t212",6,3,.star);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=true;runtime[t.id]=r}
            do {var t=tile("t213",4,4,nil);t.cell.row=6;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t214",6,0,.juice);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=true;runtime[t.id]=r}
            do {var t=tile("t215",4,1,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t216",6,2,.magnet);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=true;runtime[t.id]=r}
            do {var t=tile("t217",4,3,nil);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t218",6,4,.tnt);t.cell.row=7;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=true;runtime[t.id]=r}
            do {var t=tile("t219",4,0,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t220",6,1,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .none;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t221",4,2,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t222",6,3,.star);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .none;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t223",4,4,nil);t.cell.row=8;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t224",6,0,.juice);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .none;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t225",4,1,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t226",6,2,.magnet);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .none;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t227",4,3,nil);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t228",6,4,.tnt);t.cell.row=0;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .none;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t229",4,0,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t230",6,1,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .passive;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t231",4,2,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t232",6,3,.star);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .passive;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t233",4,4,nil);t.cell.row=1;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t234",6,0,.juice);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .passive;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t235",4,1,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.fail);XCTAssertEqual(result.reason,"single_non_6_tile")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t236",6,2,.magnet);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .passive;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t237",4,3,nil);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
        do {
            var tiles:[NativeTile]=[];var runtime:[String:NativeNoMovesTileRuntime]=[:]
            do {var t=tile("t238",6,4,.tnt);t.cell.row=2;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .passive;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            do {var t=tile("t239",4,0,nil);t.cell.row=3;t.stackDepth=1;t.locked=false;t.visible=true;t.alpha=1;t.pendingRemoval=false;t.magnetOwned=false;t.transientSpawn=false;tiles.append(t)
            var r=NativeNoMovesTileRuntime();r.eventMode = .normal;r.wildHandoff=false;r.wildDropping=false;runtime[t.id]=r}
            let result=NativeSourceEndgameChecker.check(state:.init(tiles:tiles),runtime:runtime);XCTAssertEqual(result.kind,.continue);XCTAssertEqual(result.reason,"merges_possible")
        }
    }
    func testAllNineTriggerOptions() {
        for t in NativeNoMovesCandidateOwner.Trigger.allCases {
            XCTAssertEqual(t.waitMilliseconds,t == .singleRegular ? 500:1500)
            XCTAssertEqual(t.exitTimeoutMilliseconds,t == .levelEnd ? 700:nil)
            XCTAssertEqual(t.resetHint,t == .movesDepleted)
            XCTAssertEqual(t.persistStuckState,t == .levelEnd)
        }
    }
    func testSignatureIgnoresIDsAlphaHUDAndRevision() {
        let a=tile("a",4);var b=a;b.id="replacement";b.alpha=0
        var s=NativeBoardState(tiles:[a]);let first=NativeSourceGameplaySignature(tiles:s.tiles);s.tiles=[b];s.revision+=1;s.moves-=1;s.score+=100
        XCTAssertEqual(first,NativeSourceGameplaySignature(tiles:s.tiles))
        s.tiles[0].archetype = .star;XCTAssertNotEqual(first,NativeSourceGameplaySignature(tiles:s.tiles))
    }
    func testLegacyBaselineIsOptOut() {let e=engine();e.stagedSourceNoMoves=false;XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.ignored);XCTAssertNotNil(e.beginNoMovesConfirmation())}
    func testConfirmedWaitsActualBoardExit() {let e=engine(),p=plan(e);XCTAssertEqual(lock(e,p),.confirmedFinal(p));XCTAssertNil(e.state.terminal);XCTAssertTrue(e.navigationLocked);XCTAssertFalse(e.beginDrag(tileID:"a"));XCTAssertTrue(e.finishSourceNoMovesBoardExit(plan:p,generation:1).accepted);XCTAssertFalse(e.finishSourceNoMovesBoardExit(plan:p,generation:1).accepted)}
    func testPickupAllowedDuringCandidateThenFreshWaitRollsBack() {let e=engine(),p=plan(e);XCTAssertTrue(e.beginDrag(tileID:"a"));guard case .rollback(_,let reason,let release)=e.deliverSourceNoMovesWait(plan:p,generation:1) else{return XCTFail()};XCTAssertEqual(reason,"pre-commit:active-drag");XCTAssertFalse(release);XCTAssertFalse(e.navigationLocked)}
    func testCancelledInitialWait() {let e=engine(),p=plan(e);guard case .rollback(_,let r,let release)=e.deliverSourceNoMovesWait(plan:p,generation:1,cancelled:true) else{return XCTFail()};XCTAssertEqual(r,"lifecycle-cancelled-before-commit");XCTAssertFalse(release)}
    func testCancelledTextExit() {let e=engine(),p=plan(e);_ = e.deliverSourceNoMovesWait(plan:p,generation:1);guard case .rollback(_,let r,_)=e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.cancelled) else{return XCTFail()};XCTAssertEqual(r,"lifecycle-cancelled-during-exit")}
    func testRejectedTextExitStillChecksAndLocks() {let e=engine(),p=plan(e);_ = e.deliverSourceNoMovesWait(plan:p,generation:1);XCTAssertEqual(e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.rejected),.acquireInputLock(p));XCTAssertEqual(e.acquireSourceNoMovesLock(plan:p,generation:1),.confirmedFinal(p))}
    func testLevelEndTimeoutCanCommit() {let e=engine(),p=plan(e);_ = e.deliverSourceNoMovesWait(plan:p,generation:1);XCTAssertEqual(e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.timedOut),.acquireInputLock(p))}
    func testOtherTriggerHasNoInventedTimeout() {let e=NativeGameplayEngine(state:.init(tiles:[tile("a",4)],moves:0));e.stagedSourceNoMoves=true;guard case .candidate(let p)=e.beginSourceNoMoves(origin:.movesDepleted) else{return XCTFail()};_ = e.deliverSourceNoMovesWait(plan:p,generation:1);XCTAssertEqual(e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.timedOut),.ignored);XCTAssertEqual(e.pendingSourceNoMoves,p)}
    func testDuplicateCandidateIgnored() {let e=engine();_ = plan(e);XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.ignored)}
    func testDuplicateWaitIgnored() {let e=engine(),p=plan(e);_ = e.deliverSourceNoMovesWait(plan:p,generation:1);XCTAssertEqual(e.deliverSourceNoMovesWait(plan:p,generation:1),.ignored)}
    func testRestartInvalidatesReceiptWithoutTerminal() {let e=engine(),p=plan(e);e.restart(state:.init(tiles:[tile("c",4)]));XCTAssertEqual(e.deliverSourceNoMovesWait(plan:p,generation:1),.ignored);XCTAssertNil(e.state.terminal);XCTAssertNil(e.pendingSourceNoMoves)}
    func testWildPreflightDoesNotAllocate() {let e=engine();e.sourceWildRetryPending=true;XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("wild-continuation-pending"));XCTAssertNil(e.pendingSourceNoMoves)}
    func testTransactionPreflightDoesNotAllocate() {let e=engine();e.sourceSaveRuntime.regularHandoffActive=true;XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("gameplay-transaction-active"))}
    func testEndgameGuardPreflight() {let e=engine();var f=NativeGameplayRuntimeFlags();f.endgameGuardActive=true;e.setRuntimeFlags(f);XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("endgame-guard-active"))}
    func testBusyEndingDoesNotAllocate() {let e=engine();var f=NativeGameplayRuntimeFlags();f.busyEnding=true;e.setRuntimeFlags(f);XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.ignored)}
    func testWildWaitRecheckRollsBack() {let e=engine(),p=plan(e);e.sourceWildRetryPending=true;guard case .rollback(_,let reason,_)=e.deliverSourceNoMovesWait(plan:p,generation:1) else{return XCTFail()};XCTAssertEqual(reason,"pre-commit:wild-continuation-pending")}
    func testTransactionExitRecheckRollsBack() {let e=engine(),p=plan(e);_ = e.deliverSourceNoMovesWait(plan:p,generation:1);e.sourceSaveRuntime.specialTransactionActive=true;guard case .rollback(_,let reason,_)=e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.exited) else{return XCTFail()};XCTAssertEqual(reason,"final-commit:gameplay-transaction-active")}
    func testPostLockRaceReleasesOnlyOwnLock() {let e=engine(),p=plan(e);_ = e.deliverSourceNoMovesWait(plan:p,generation:1);_ = e.deliverSourceNoMovesTextExit(plan:p,generation:1,delivery:.exited);guard case .rollback(_,let reason,let release)=e.acquireSourceNoMovesLock(plan:p,generation:1,afterLock:{e.sourceSaveRuntime.activeDrag=true}) else{return XCTFail()};XCTAssertEqual(reason,"post-lock:active-drag");XCTAssertTrue(release);e.sourceSaveRuntime.activeDrag=false;XCTAssertTrue(e.beginDrag(tileID:"a"))}
    func testModalPauseHasNoLogicalDelivery() {let e=engine(),p=plan(e),before=e.state;XCTAssertEqual(e.state,before);XCTAssertEqual(e.pendingSourceNoMoves,p);XCTAssertNil(e.state.terminal)}
    func testStaleFinalExitCannotSealNewGeneration() {let e=engine(),p=plan(e);_ = lock(e,p);e.restart(state:.init(tiles:[tile("new",2)]));XCTAssertFalse(e.finishSourceNoMovesBoardExit(plan:p,generation:1).accepted);XCTAssertNil(e.state.terminal)}
    func testFreshRegularAlphaRetainsCandidate() {let e=NativeGameplayEngine(state:.init(tiles:[NativeTile(id:"a",cell:.init(column:0,row:0),value:4,alpha:0),tile("b",3,1)]));e.stagedSourceNoMoves=true;guard case .candidate = e.beginSourceNoMoves(origin:.levelEnd) else{return XCTFail()}}
    func testLoneSixWildIsCleanNotSyntheticFail() {let e=NativeGameplayEngine(state:.init(tiles:[tile("a",6,0,.star)]));e.stagedSourceNoMoves=true;XCTAssertEqual(e.beginSourceNoMoves(origin:.levelEnd),.deferred("fresh-result:clean"))}
}
