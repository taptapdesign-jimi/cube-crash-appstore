import XCTest
@testable import Stack_to_Six

final class NativeSourceHUDStarScaleFeedbackTests:XCTestCase {
    struct Row:Decodable {let spec:Spec,samples:[Sample],events:[[Event]]}
    struct Spec:Decodable {let name:String,begin:[Int],step:Int,number:[Double]?,icon:[Double]?,pause:[Int]?,same:Bool?}
    struct Sample:Decodable {let roots:Int,wall:Int,animation:Double,text:String,number:NativeSourceHUDStarScaleFeedback.Scale,icon:NativeSourceHUDStarScaleFeedback.Scale,burst:Int}
    enum Event:Decodable {case string(String),number(Double);init(from decoder:Decoder)throws{let c=try decoder.singleValueContainer();if let n=try? c.decode(Double.self){self = .number(n)}else{self = .string(try c.decode(String.self))}}}
    @MainActor final class Harness {
        final class Root {let id=UUID(),label:String,birth:Double,duration:Double,paint:(Double)->Void,finish:(Bool)->Void;init(_ label:String,_ birth:Double,_ duration:Double,_ paint:@escaping(Double)->Void,_ finish:@escaping(Bool)->Void){self.label=label;self.birth=birth;self.duration=duration;self.paint=paint;self.finish=finish}}
        struct Wall {let id:UUID,at:Int,callback:()->Void}
        var animation=0.0,wall=0,text="0",number=NativeSourceHUDStarScaleFeedback.Scale(x:1,y:1),icon=NativeSourceHUDStarScaleFeedback.Scale(x:1,y:1),roots:[Root]=[],timers:[Wall]=[],events:[String]=[],current=true
        var setTextHook:(()->Void)?,readHook:(()->Void)?
        lazy var owner=NativeSourceHUDStarScaleFeedback(hooks:.init(current:{[unowned self] in current},text:{[unowned self] in text},setText:{[unowned self] value in text=value;events.append("text");setTextHook?()},readScale:{[unowned self] target in readHook?();return target == .number ? number:icon},writeScale:{[unowned self] target,value in if target == .number {number=value}else{icon=value}},killOtherScaleTweens:{_ in},timeline:{[unowned self] label,duration,paint,finished in
            let r=Root(label,animation,duration,paint,finished);roots.append(r);events.append(label)
            return{[weak self,weak r] in guard let self,let r,roots.contains(where:{$0 === r}) else{return};roots.removeAll{$0 === r};r.finish(false)}
        },wall:{[unowned self] ms,callback in let id=UUID();timers.append(Wall(id:id,at:wall+ms,callback:callback));return{[weak self] in self?.timers.removeAll{$0.id==id}}}))
        func deliver(_ t:Double,_ w:Int){animation=t;wall=w
            for root in roots {guard roots.contains(where:{$0 === root}) else{continue};let local=min(root.duration,max(0,NativeSourceHUDStarScaleFeedback.round7(t-root.birth)));root.paint(local);if local>=root.duration,roots.contains(where:{$0 === root}) {roots.removeAll{$0 === root};root.finish(true)}}
            for timer in timers.filter({$0.at<=w}).sorted(by:{$0.at<$1.at}) {guard timers.contains(where:{$0.id==timer.id}) else{continue};timers.removeAll{$0.id==timer.id};timer.callback()}
        }
    }
    func testLiteralOriginalGSAPRepeatedPausedAndAsymmetricFeedback() async throws {
        let rows=try JSONDecoder().decode([Row].self,from:Data(contentsOf:Bundle(for:NativeSourceHUDStarScaleFeedbackTests.self).url(forResource:"NativeSourceHUDStarScaleFeedbackOracle",withExtension:"json")!))
        await MainActor.run {
            for row in rows {let h=Harness();if let n=row.spec.number{h.number = .init(x:n[0],y:n[1])};if let i=row.spec.icon{h.icon = .init(x:i[0],y:i[1])};var score=0
                for s in row.samples {h.wall=s.wall
                    if row.spec.begin.contains(s.wall){score+=100;XCTAssertTrue(h.owner.paint(score:row.spec.same==true ? 0:score),row.spec.name)}
                    h.deliver(s.animation,s.wall)
                    XCTAssertEqual(h.text,s.text,row.spec.name)
                    if s.wall>0 {XCTAssertEqual(h.roots.count,s.roots,"\(row.spec.name) linked roots \(s.wall)")}
                    XCTAssertEqual(h.number.x,s.number.x,accuracy:0.0000011,"\(row.spec.name) numberX \(s.wall)")
                    XCTAssertEqual(h.number.y,s.number.y,accuracy:0.0000011,"\(row.spec.name) numberY \(s.wall)")
                    XCTAssertEqual(h.icon.x,s.icon.x,accuracy:0.0000011,"\(row.spec.name) iconX \(s.wall)")
                    XCTAssertEqual(h.icon.y,s.icon.y,accuracy:0.0000011,"\(row.spec.name) iconY \(s.wall)")
                    XCTAssertEqual(h.owner.burstCount,s.burst,"\(row.spec.name) burst \(s.wall)")
                };h.owner.dispose()
            }
        }
    }
    func testReentrantTextDisposeCannotInstallSurvivingRoot() async {await MainActor.run{let h=Harness();h.setTextHook={h.owner.dispose()};XCTAssertFalse(h.owner.paint(score:100));XCTAssertTrue(h.roots.isEmpty);XCTAssertTrue(h.timers.isEmpty)}}
    func testPausedWallResetsBurstWithoutFabricatedAnimation() async {await MainActor.run{let h=Harness();XCTAssertTrue(h.owner.paint(score:100));h.deliver(0.06,60);let held=h.number;h.deliver(0.06,2700);XCTAssertEqual(h.owner.burstCount,0);XCTAssertEqual(h.number,held);XCTAssertTrue(h.owner.activeNumber);h.owner.dispose();XCTAssertTrue(h.roots.isEmpty)}}
    func testRepeatedBumpsReplaceRootsAndRetainOriginalIconBase() async {await MainActor.run{let h=Harness();h.icon = .init(x:0.5,y:0.7);XCTAssertTrue(h.owner.paint(score:100));h.deliver(0.08,80);XCTAssertTrue(h.owner.paint(score:200));h.deliver(0.16,160);XCTAssertEqual(h.icon.x,0.65,accuracy:0.000001);XCTAssertEqual(h.icon.y,0.91,accuracy:0.000001);XCTAssertEqual(h.roots.count,2);XCTAssertEqual(h.timers.count,1);h.owner.dispose()}}
}
