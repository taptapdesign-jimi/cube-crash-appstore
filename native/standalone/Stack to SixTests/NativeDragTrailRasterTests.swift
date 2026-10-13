import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeDragTrailRasterTests:XCTestCase {
    private func rgba(_ image:CGImage)throws->[UInt8] {
        var bytes=[UInt8](repeating:0,count:image.width*image.height*4)
        let rendered=bytes.withUnsafeMutableBytes {buffer->Bool in
            guard let context=CGContext(data:buffer.baseAddress,width:image.width,height:image.height,bitsPerComponent:8,
                bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),
                bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue) else{return false}
            context.draw(image,in:CGRect(x:0,y:0,width:CGFloat(image.width),height:CGFloat(image.height)));return true
        }
        XCTAssertTrue(rendered);return bytes
    }
    func testSharedRastersHaveOriginalWhiteFillAndCircleTransparentCorners()throws {
        let circle=NativeDragTrail.unitCircleTexture.cgImage(),square=NativeDragTrail.unitSquareTexture.cgImage()
        let round=try rgba(circle),rect=try rgba(square)
        XCTAssertEqual(circle.width,square.width);XCTAssertGreaterThanOrEqual(circle.width,64)
        let center=((circle.height/2)*circle.width+circle.width/2)*4
        XCTAssertEqual(Array(round[center..<center+4]),[255,255,255,255])
        XCTAssertEqual(Array(rect[center..<center+4]),[255,255,255,255])
        XCTAssertEqual(round[3],0);XCTAssertEqual(rect[3],255)
    }
    func testActualSpriteRenderRetainsVectorSilhouetteColorAndDoubleAlpha()throws {
        let view=SKView(frame:CGRect(x:0,y:0,width:80,height:80)),scene=SKScene(size:CGSize(width:80,height:80))
        scene.backgroundColor = .clear;view.presentScene(scene)
        defer{view.presentScene(nil)}
        let color=UIColor(red:0.72,green:0.46,blue:0.31,alpha:1),fill:CGFloat=0.92
        for round in [true,false] {
            for size in [CGSize(width:7.9,height:7.9),CGSize(width:13.7,height:19.1)] {
                let actual=SKSpriteNode(texture:round ? NativeDragTrail.unitCircleTexture:NativeDragTrail.unitSquareTexture)
                actual.size=size;actual.color=color;actual.colorBlendFactor=1;actual.alpha=fill*fill
                let rect=CGRect(x:-size.width/2,y:-size.height/2,width:size.width,height:size.height)
                let expected=SKShapeNode(path:round ? CGPath(ellipseIn:rect,transform:nil):CGPath(rect:rect,transform:nil))
                expected.fillColor=color.withAlphaComponent(fill);expected.alpha=fill
                expected.strokeColor = .clear;expected.lineWidth=0
                for angle in [CGFloat(0),CGFloat(0.37)] {
                    actual.zRotation=angle;expected.zRotation=angle
                    let crop=CGRect(x:-20,y:-20,width:40,height:40)
                    let a=try XCTUnwrap(view.texture(from:actual,crop:crop)).cgImage()
                    let b=try XCTUnwrap(view.texture(from:expected,crop:crop)).cgImage()
                    XCTAssertEqual(a.width,b.width);XCTAssertEqual(a.height,b.height)
                    let pixels=try rgba(a),gold=try rgba(b)
                    let actualAlpha=stride(from:3,to:pixels.count,by:4).reduce(0){$0+Int(pixels[$1])}
                    let goldAlpha=stride(from:3,to:gold.count,by:4).reduce(0){$0+Int(gold[$1])}
                    XCTAssertGreaterThan(goldAlpha,0)
                    XCTAssertEqual(Double(actualAlpha)/Double(goldAlpha),1,accuracy:0.08,"Raster antialias fringe must retain original coverage")
                    let center=((a.height/2)*a.width+a.width/2)*4
                    for channel in 0..<4 {XCTAssertEqual(Double(pixels[center+channel]),Double(gold[center+channel]),accuracy:3,"Interior tint and effective alpha must match vector fill")}
                }
            }
        }
    }
    func testActualTrailPoolStaysBoundedAndDisposedOwnerCannotEmitOrConsumeRandom() {
        var draws=0
        let trail=NativeDragTrail(random:{draws+=1;return 0.5}),host=SKNode();host.addChild(trail)
        trail.begin(at:.zero,time:0)
        for index in 1...80 {trail.emit(at:.init(x:CGFloat(index)*40,y:0),time:Double(index)*16,scale:0.475,wild:false,round:true)}
        XCTAssertEqual(trail.live.count,128);XCTAssertEqual(trail.children.count,128)
        XCTAssertTrue(trail.children.allSatisfy{$0 is SKSpriteNode && !($0 is SKShapeNode)})
        let identities=Set(trail.live.map(ObjectIdentifier.init)),stableDraws=draws
        trail.emit(at:.init(x:4000,y:0),time:1400,scale:0.475,wild:false,round:true)
        XCTAssertEqual(draws,stableDraws,"At cap, no new Source draws or resources are allowed")
        trail.clear();trail.begin(at:.zero,time:0)
        trail.emit(at:.init(x:100,y:0),time:16,scale:0.475,wild:true,round:false)
        XCTAssertTrue(Set(trail.live.map(ObjectIdentifier.init)).isSubset(of:identities))
        trail.dispose();let retiredDraws=draws
        trail.begin(at:.zero,time:0);trail.emit(at:.init(x:100,y:0),time:16,scale:0.475,wild:false,round:true)
        XCTAssertEqual(draws,retiredDraws);XCTAssertTrue(trail.children.isEmpty);XCTAssertFalse(trail.hasTail);XCTAssertNil(trail.parent)
    }
    func testAnalyticTailsPreserveSourceQuadOutPoseWithoutPerParticleActions() {
        for identity in [String?](arrayLiteral:nil)+NativeSpecialDiceRegistry.variants.keys.sorted().map({Optional($0)}) {
            let core=identity.flatMap{NativeSpecialDiceRegistry.variants[$0]?.archetype}
            let style=NativeDragTrailStyle.resolve(core:core,variant:identity)
            let trail=NativeDragTrail(random:{0.5})
            defer{trail.dispose()}
            let scale:CGFloat=0.475,point=CGPoint(x:100,y:0)
            trail.begin(at:.zero,time:0)
            trail.emit(at:point,time:16,scale:scale,style:style)
            // First source burst is born at the spacing crossing, not pointer.
            let origin=CGPoint(x:(style.wild ? 26:28)*scale,y:0)
            let plan=NativeDragTrailParticlePlan.make(style:style,origin:origin,scale:scale,random:{0.5})
            XCTAssertFalse(trail.live.isEmpty)
            XCTAssertTrue(trail.live.allSatisfy{!$0.hasActions()})
            for fraction in [0.25,0.5,0.75] {
                trail.advance(delta:plan.life*0.25)
                let p=CGFloat(1-pow(1-fraction,2))
                for node in trail.live {
                    XCTAssertEqual(node.position.x,plan.start.x+(plan.end.x-plan.start.x)*p,accuracy:1e-6)
                    XCTAssertEqual(node.position.y,plan.start.y+(plan.end.y-plan.start.y)*p,accuracy:1e-6)
                    XCTAssertEqual(node.alpha,plan.fill*plan.fill*(1-p),accuracy:1e-6)
                    XCTAssertEqual(node.zRotation,plan.rotation+(plan.endRotation-plan.rotation)*p,accuracy:1e-6)
                }
            }
            trail.end();XCTAssertTrue(trail.hasTail)
            let before=trail.live.first?.position
            trail.advance(delta:0);XCTAssertEqual(trail.live.first?.position,before,"Suspended Scene supplies no elapsed frame time")
            trail.advance(delta:plan.life*0.25+0.000001)
            XCTAssertFalse(trail.hasTail);XCTAssertTrue(trail.live.isEmpty)
            XCTAssertTrue(trail.children.allSatisfy{$0.isHidden && !$0.hasActions()})
        }
    }
    func testParticleBirthUsesOnlyTimeSincePointerBurstInItsFirstFrame() {
        let trail=NativeDragTrail(random:{0.5});defer{trail.dispose()}
        trail.begin(at:.zero,time:1000)
        trail.emit(at:CGPoint(x:100,y:0),time:1015,scale:1,wild:false,round:true)
        let node=trail.live.first!,start=node.position
        trail.advance(delta:0.016,timeMilliseconds:1016)
        let plan=NativeDragTrailParticlePlan.makeRegular(origin:CGPoint(x:28,y:0),scale:1,random:{0.5})
        let p=CGFloat(1-pow(1-0.001/plan.life,2))
        XCTAssertEqual(node.position.y,start.y+(plan.end.y-start.y)*p,accuracy:1e-6)
        XCTAssertEqual(node.alpha,plan.fill*plan.fill*(1-p),accuracy:1e-6)
    }
    func testTailLeaseAndPoolRetireOnceAcrossRepeatedClearAndDispose() {
        let trail=NativeDragTrail(random:{0.5})
        var starts=0,ends=0
        trail.onTailChanged={if $0 {starts+=1}else{ends+=1}}
        var initial:Set<ObjectIdentifier>?
        for cycle in 0..<40 {
            trail.begin(at:.zero,time:0)
            trail.emit(at:CGPoint(x:100,y:0),time:16,scale:0.475,wild:false,round:true)
            XCTAssertEqual(starts,cycle+1)
            let identities=Set(trail.live.map(ObjectIdentifier.init))
            if let initial {XCTAssertEqual(identities,initial)}else{initial=identities}
            XCTAssertTrue(trail.live.allSatisfy{!$0.hasActions()})
            trail.clear();trail.clear();XCTAssertEqual(ends,cycle+1)
            XCTAssertFalse(trail.hasTail);XCTAssertTrue(trail.children.allSatisfy(\.isHidden))
        }
        trail.begin(at:.zero,time:0)
        trail.emit(at:CGPoint(x:100,y:0),time:16,scale:0.475,wild:false,round:true)
        trail.dispose();trail.dispose()
        XCTAssertEqual(starts,41);XCTAssertEqual(ends,41);XCTAssertTrue(trail.children.isEmpty)
        trail.advance(delta:100);XCTAssertEqual(ends,41)
    }

}
