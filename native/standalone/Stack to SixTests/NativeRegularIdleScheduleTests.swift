import XCTest
@testable import Stack_to_Six
@MainActor
final class NativeRegularIdleScheduleTests:XCTestCase {
    struct Row:Decodable {let mode:String;let trace:[Step]}
    struct Step:Decodable {
        let label:String,due:[Double],draws:Int,time:Double?
        init(from decoder:Decoder)throws {
            var values=try decoder.unkeyedContainer();label=try values.decode(String.self)
            time=label=="wake" ? try values.decode(Double.self):nil
            due=try values.decode([Double].self);draws=try values.decode(Int.self)
        }
    }
    func testLiteralOriginalTimerVisibilityDragAndInteractionScheduling()throws {
        let path=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"NativeRegularIdleScheduleOracle",withExtension:"json"))
        let rows=try JSONDecoder().decode([Row].self,from:Data(contentsOf:path));XCTAssertEqual(rows.count,10)
        for row in rows {
            var owner=NativeRegularIdleSchedule(),draws=0
            let random={draws+=1;return 0.2}
            var hidden=false
            owner.start(at:1000)
            for step in row.trace {
                switch step.label {
                case "start":break
                case "park":
                    if row.mode=="hidden-race-resume" {hidden=true;_ = owner.wake(at:5000,hidden:true,dragActive:false,availableIDs:["a"],random:random)}
                    else {hidden=true;owner.park(at:row.mode=="pagehide" ? 2000:2600)}
                case "interaction":
                    if row.mode=="interaction" {_ = owner.wake(at:5000,hidden:false,dragActive:false,availableIDs:["a"],random:random)}
                    owner.interact(at:row.mode=="interaction" ? 5300:3000,hidden:hidden)
                case "resume":hidden=false;owner.resume(at:row.mode=="pagehide" ? 7000:9000)
                case "wake":
                    if row.mode=="early" {owner.interact(at:4800,hidden:false)}
                    if row.mode=="hidden-race" {hidden=true}
                    _ = owner.wake(at:try XCTUnwrap(step.time),hidden:hidden,dragActive:row.mode=="drag",availableIDs:row.mode=="empty" ? []:["a"],random:random)
                default:XCTFail(step.label)
                }
                XCTAssertEqual(owner.due.map{[$0]} ?? [],step.due,row.mode+":"+step.label)
                XCTAssertEqual(draws,step.draws,row.mode+":"+step.label)
            }
            owner.stop();XCTAssertNil(owner.due);XCTAssertFalse(owner.active)
        }
    }
}
