import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSourceHUDStarScaleFeedbackMountedTests:XCTestCase {
    func testActualSceneStarArrivalPaintsPlainAuthoritativeScoreThenAuthoredNumberAndIcon()async throws {
        var wall=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall},sourceFrameTransportEnabled:true)
        let context=NativeGameplaySourceContext(service:service,visualRandom:{0.5}),scope=try XCTUnwrap(context.beginScene(retire:{}))
        let ready=expectation(description:"Actual original small-star texture upload")
        var prepared:NativeSourceHUDStarTexturePreparation.Prepared?
        scope.hudStarTextures.prepare(root:NativeTestResources.root,current:{scope.current}){prepared=$0;ready.fulfill()}
        await fulfillment(of:[ready],timeout:5)
        let texture=try XCTUnwrap(prepared)
        var star=NativeTile(id:"s",cell:.init(column:0,row:0),value:6,archetype:.star);star.starOrbitCount=1
        let engine=NativeGameplayEngine(state:.init(tiles:[star,.init(id:"d",cell:.init(column:1,row:0),value:2)]))
        XCTAssertTrue(engine.beginDrag(tileID:"s"));XCTAssertTrue(engine.drop(target:.init(column:1,row:0)).accepted)
        let scoreBefore=engine.state.score
        let scene=NativeBoardScene(engine:engine,resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
        let view=SKView(frame:.init(x:0,y:0,width:390,height:844));view.ignoresSiblingOrder=false;view.presentScene(scene);view.isPaused=true
        defer{scene.dispose();context.dispose();service.dispose();view.presentScene(nil)}
        let icon=try XCTUnwrap(scene.childNode(withName:"//native-game-score-art") as? SKSpriteNode)
        let label=try XCTUnwrap(icon.parent?.children.compactMap{$0 as? SKLabelNode}.first{
            abs($0.position.x-(icon.position.x+icon.size.width/2+6))<0.000001 && abs($0.position.y-icon.position.y)<0.000001
        })
        var red:CGFloat=0,green:CGFloat=0,blue:CGFloat=0,alpha:CGFloat=0
        XCTAssertTrue(try XCTUnwrap(label.fontColor).getRed(&red,green:&green,blue:&blue,alpha:&alpha))
        XCTAssertEqual(red,181.0/255,accuracy:0.000001);XCTAssertEqual(green,133.0/255,accuracy:0.000001);XCTAssertEqual(blue,115.0/255,accuracy:0.000001)
        let base=icon.xScale,originalPosition=label.position,font=label.fontName,color=label.fontColor
        var observed:[Int]=[],onFrameScale:[CGFloat]=[]
        scene.sourceHUDStarJobsPresentationEnabled=true
        XCTAssertTrue(scene.configureSourceHUDStarJobs(scope:scope,prepared:texture,capture:{_ in .init(screenOrigin:.init(x:195,y:430),hudTarget:.init(x:37,y:76))},hudFeedback:{value in
            observed.append(value);onFrameScale.append(label.xScale);XCTAssertEqual(label.text,String(value))
        }))
        XCTAssertTrue(scene.startSourceHUDStarJobs(ids:engine.pendingHUDStars.map(\.id)))
        for value in stride(from:0.0,through:1800,by:10){wall=value;service.deliver(wallMilliseconds:value)}
        XCTAssertEqual(engine.state.score,scoreBefore+100);XCTAssertEqual(observed,[scoreBefore+100]);XCTAssertEqual(onFrameScale,[1]) // no synchronous count-up or creation paint.
        XCTAssertEqual(label.text,String(scoreBefore+100));XCTAssertGreaterThan(label.xScale,1)
        XCTAssertEqual(icon.xScale,base,accuracy:0.000001);XCTAssertEqual(label.position,originalPosition);XCTAssertEqual(label.fontName,font);XCTAssertEqual(label.fontColor,color)
        for value in stride(from:1810.0,through:3000,by:10){wall=value;service.deliver(wallMilliseconds:value)}
        XCTAssertEqual(label.xScale,1,accuracy:0.000001);XCTAssertEqual(observed.count,1)
        scene.retireSourceHUDStarJobs();let scale=label.xScale;wall=4000;service.deliver(wallMilliseconds:wall);XCTAssertEqual(label.xScale,scale)
    }
    func testBorrowedClockGlobalPauseKeepsHeldFeedbackAndCapturedDisposeCancelsOnlyItsRoots() throws {
        var wall=0.0;let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{wall},sourceFrameTransportEnabled:true),adapter=NativeSourceHUDStarScaleClockAdapter(service:service)
        var number=NativeSourceHUDStarScaleFeedback.Scale(x:1,y:1),icon=number,text="0",current=true
        let timeouts=NativeSourceAppTimeoutOwner()
        let owner=NativeSourceHUDStarScaleFeedback(hooks:.init(current:{current},text:{text},setText:{text=$0},readScale:{$0 == .number ? number:icon},writeScale:{target,value in if target == .number{number=value}else{icon=value}},killOtherScaleTweens:{_ in},timeline:{adapter.timeline(label:$0,duration:$1,paint:$2,finished:$3)},wall:{ms,callback in
            let receipt=timeouts.schedule(sourceID:"feedback-deflate",generation:1,delayMilliseconds:ms,elapsed:callback);return{_ = timeouts.cancel(receipt)}
        }))
        defer{owner.dispose();adapter.dispose();timeouts.cancelAll();service.dispose()}
        XCTAssertTrue(owner.paint(score:100));wall=60;service.deliver(wallMilliseconds:wall);let held=number
        XCTAssertTrue(service.setSourceGlobalPaused(true));wall=400;service.deliver(wallMilliseconds:wall);XCTAssertEqual(number,held);XCTAssertEqual(text,"100")
        XCTAssertTrue(service.setSourceGlobalPaused(false));wall=480;service.deliver(wallMilliseconds:wall);XCTAssertNotEqual(number,held)
        current=false;owner.dispose();adapter.dispose();XCTAssertEqual(adapter.activeCount,0);XCTAssertEqual(timeouts.pendingCount,0)
        let captured=number;wall=600;service.deliver(wallMilliseconds:wall);XCTAssertEqual(number,captured)
    }
}
