import XCTest
@testable import StackToSixGameplay

final class NativeCoconutTests:XCTestCase {
 func testBarrelParityAcrossModesDirectionsFinalAndBlockerAfterSave()throws {
  for mode in [NativeRunMode.journey,.arcade] {for reverse in [false,true] {for blocker in [false,true] {
   func run(_ variant:String)throws->NativeGameplayEngine {
    var tiles=[NativeTile(id:"w",cell:.init(column:0,row:0),value:6,archetype:.tnt,variant:variant),NativeTile(id:"d",cell:.init(column:1,row:0),value:2)]
    if blocker {tiles += (2..<12).map{NativeTile(id:"b\($0)",cell:.init(column:$0%5,row:$0/5),value:3)}}
    let saved=try JSONEncoder().encode(NativeBoardState(tiles:tiles,mode:mode,board:15))
    let state=try JSONDecoder().decode(NativeBoardState.self,from:saved)
    XCTAssertEqual(state.tiles.first?.variant,variant)
    let engine=NativeGameplayEngine(state:state,recordedRandomChoices:Array(repeating:0.3,count:500))
    XCTAssertTrue(engine.beginDrag(tileID:reverse ? "d":"w"))
    XCTAssertTrue(engine.drop(target:reverse ? .init(column:0,row:0):.init(column:1,row:0)).accepted)
    if let plan=engine.pendingSpecial {
     XCTAssertEqual(plan.targets.count,blocker ? 10:0)
     for target in plan.targets {XCTAssertTrue(engine.commitSpecialImpact(transactionID:plan.id,tileID:target.id).accepted)}
     XCTAssertTrue(engine.commitSpecialBoard(transactionID:plan.id).accepted)
    }
    return engine
   }
   let coconut=try run("coconut"),barrel=try run("barell")
   XCTAssertEqual(coconut.state.tiles,barrel.state.tiles)
   XCTAssertEqual(coconut.state.score,barrel.state.score)
   XCTAssertEqual(coconut.state.terminal,barrel.state.terminal)
   XCTAssertEqual(coconut.pendingSpecial==nil,barrel.pendingSpecial==nil)
  }}}
 }
}
