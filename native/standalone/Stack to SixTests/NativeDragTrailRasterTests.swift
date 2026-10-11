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
}
