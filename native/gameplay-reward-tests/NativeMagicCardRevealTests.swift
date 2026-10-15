import XCTest
import UIKit
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeMagicCardRevealTests:XCTestCase {
    func testHeldSvgMatchesUnlockedArtworkSizeAndExportsComparison() throws {
        let root=NativeTestResources.root
        let source=try XCTUnwrap(NativeMagicCardSource.read(root.appendingPathComponent(NativeMagicCardSource.path),lease:NativeRewardPreparationLease()))
        let artwork=JimiV9Artwork(resourceRoot:root)
        let front=try XCTUnwrap(artwork.image(NativeJourneyContent.cardAsset(board:1,score:1000,doubleDensity:true)))
        let format=UIGraphicsImageRendererFormat();format.scale=1;format.opaque=false
        func raster(width:CGFloat,closed:Bool,old:Bool=false)->UIImage {
            let layout=NativeRewardPresentation.Layout(width:width,height:844,bottomSafe:34)
            let canvas=UIView(frame:CGRect(x:0,y:0,width:500,height:650))
            let face=UIView(frame:CGRect(origin:.zero,size:layout.hero.size));face.center=CGPoint(x:250,y:325);canvas.addSubview(face)
            if closed {
                let magic=NativeMagicCardReveal();magic.install(source);magic.layout(in:face.bounds);magic.settle(at:NativeMagicCardSource.hold)
                face.layer.addSublayer(magic.layer)
                if old {face.transform=CGAffineTransform(scaleX:1.2/1.1115,y:1.2/1.1115)}
                return UIGraphicsImageRenderer(size:canvas.bounds.size,format:format).image{canvas.layer.render(in:$0.cgContext)}
            }
            face.transform=CGAffineTransform(scaleX:NativeRewardPresentation.surfaceScale,y:NativeRewardPresentation.surfaceScale)
            let image=UIImageView(image:front);image.contentMode = .scaleAspectFit;image.frame=face.bounds
            image.transform=CGAffineTransform(scaleX:NativeRewardPresentation.frontArtworkScale,y:NativeRewardPresentation.frontArtworkScale);face.addSubview(image)
            return UIGraphicsImageRenderer(size:canvas.bounds.size,format:format).image{canvas.layer.render(in:$0.cgContext)}
        }
        func opaqueBounds(_ image:UIImage)->CGRect {
            let cg=image.cgImage!,bytes=cg.dataProvider!.data! as Data
            var left=cg.width,top=cg.height,right=0,bottom=0
            for y in 0..<cg.height {for x in 0..<cg.width where bytes[y*cg.bytesPerRow+x*4+3]>=128 {
                left=min(left,x);right=max(right,x);top=min(top,y);bottom=max(bottom,y)
            }}
            return CGRect(x:left,y:top,width:right-left+1,height:bottom-top+1)
        }
        for width in [CGFloat(320),390,430] {
            let closed=opaqueBounds(raster(width:width,closed:true)),opened=opaqueBounds(raster(width:width,closed:false))
            XCTAssertEqual(closed.height,opened.height,accuracy:2,"Visible raster heights must match at viewport \(width)")
            XCTAssertEqual(closed.width,opened.width,accuracy:2,"Original aspect ratios differ by only about0.1percent")
        }
        let before=raster(width:390,closed:true,old:true),opened=raster(width:390,closed:false),after=raster(width:390,closed:true)
        let comparison=UIGraphicsImageRenderer(size:CGSize(width:1170,height:720),format:format).image{context in
            for (index,item) in [("SVG BEFORE",before),("UNLOCKED CARD",opened),("SVG MATCHED",after)].enumerated() {
                let panel=CGRect(x:CGFloat(index)*390,y:0,width:390,height:720)
                let paper=NativeAppPaperSurface(artwork:artwork);paper.frame=CGRect(origin:.zero,size:panel.size);paper.layoutIfNeeded()
                context.cgContext.saveGState();context.cgContext.translateBy(x:panel.minX,y:0);paper.layer.render(in:context.cgContext)
                item.1.draw(at:CGPoint(x:-55,y:30))
                let paragraph=NSMutableParagraphStyle();paragraph.alignment = .center
                let ink=UIColor(red:181/255,green:138/255,blue:120/255,alpha:1)
                (item.0 as NSString).draw(in:CGRect(x:0,y:28,width:390,height:32),withAttributes:[.font:artwork.font(size:22,weight:"ExtraBold"),.foregroundColor:ink,.paragraphStyle:paragraph])
                let size=opaqueBounds(item.1).size
                (String(format:"%.0f × %.0f px",size.width,size.height) as NSString).draw(in:CGRect(x:0,y:650,width:390,height:32),withAttributes:[.font:artwork.font(size:22),.foregroundColor:ink,.paragraphStyle:paragraph])
                context.cgContext.restoreGState()
            }
        }
        try comparison.pngData()?.write(to:URL(fileURLWithPath:"/tmp/reward-card-size-comparison.png"))
        let attachment=XCTAttachment(image:comparison);attachment.name="Actual artwork size comparison at390px; neutral pose";attachment.lifetime = .keepAlways;add(attachment)
    }
    func testGentleBrightnessLiftPreservesAlphaAndHighlightDetail() throws {
        let bitmap=try XCTUnwrap(CGContext(data:nil,width:3,height:1,bitsPerComponent:8,bytesPerRow:12,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue))
        let pixels=try XCTUnwrap(bitmap.data).assumingMemoryBound(to:UInt8.self)
        let input:[UInt8]=[100,150,240,255,40,80,95,100,0,0,0,0]
        for i in input.indices {pixels[i]=input[i]}
        NativeMagicCardSource.brightenPremultipliedRGBA(bitmap)
        XCTAssertEqual(Array(UnsafeBufferPointer(start:pixels,count:12)),[122,165,242,255,49,83,96,100,0,0,0,0])
    }
    func testOriginalSVGHasBoundedDecodedArtAndExactOpenHoldAndExit() throws {
        let source=try XCTUnwrap(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:NativeRewardPreparationLease()))
        let owner=NativeMagicCardReveal();owner.install(source);owner.layout(in:CGRect(x:0,y:0,width:265,height:391))
        XCTAssertEqual(owner.trackCount,210);XCTAssertEqual(owner.imageCount,9)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let layers=descendants(owner.layer)
        let images=layers.filter{$0.contents != nil};XCTAssertEqual(images.count,9)
        owner.settle(at:NativeMagicCardSource.hold)
        XCTAssertEqual(images.dropLast().map(\.opacity),[Float](repeating:0,count:8));XCTAssertEqual(images.last?.opacity,1)
        // The final raster is upright and uncrumpled, with every enclosing
        // authored scale/translation/rotation settled at its exact rest pose.
        var current=images.last?.superlayer
        while let layer=current,layer !== owner.layer {
            if layer.superlayer !== owner.layer {XCTAssertTrue(CATransform3DIsIdentity(layer.transform))}
            current=layer.superlayer
        }
        XCTAssertTrue(layers.allSatisfy{($0.animationKeys() ?? []).isEmpty})
        owner.play(from:NativeMagicCardSource.hold,to:NativeMagicCardSource.end)
        XCTAssertTrue(layers.contains{!($0.animationKeys() ?? []).isEmpty})
        XCTAssertTrue(layers.flatMap{layer in (layer.animationKeys() ?? []).compactMap{layer.animation(forKey:$0)}}.allSatisfy{$0.repeatCount==0 && $0.duration<=0.514})
        owner.settle(at:NativeMagicCardSource.end);XCTAssertEqual(images.last?.opacity,0)
        owner.dispose();owner.dispose();XCTAssertFalse(owner.ready);XCTAssertEqual(owner.trackCount,0);XCTAssertNil(owner.layer.sublayers)
    }
    func testOpeningPublishesBlankFirstFrameOnOneSharedClockAndSlowsOnlyExit() throws {
        let source=try XCTUnwrap(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:NativeRewardPreparationLease()))
        let owner=NativeMagicCardReveal();owner.install(source)
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let images=descendants(owner.layer).filter{$0.contents != nil}
        XCTAssertTrue(images.allSatisfy{$0.opacity==0},"Mount must be empty, never the full open card")
        owner.play(from:0,to:NativeMagicCardSource.hold)
        for image in images {
            let animation=try XCTUnwrap(image.animation(forKey:"magic.opacity") as? CAKeyframeAnimation)
            XCTAssertEqual((animation.values?.first as? NSNumber)?.doubleValue,0)
            XCTAssertEqual(animation.fillMode,.backwards)
        }
        let animations=descendants(owner.layer).flatMap{layer in (layer.animationKeys() ?? []).compactMap{layer.animation(forKey:$0)}}
        XCTAssertEqual(Set(animations.map(\.beginTime)).count,1,"All tracks start atomically after preparation")
        owner.settle(at:NativeMagicCardSource.hold)
        owner.play(from:NativeMagicCardSource.hold,to:NativeMagicCardSource.end,durationScale:1.3)
        for animation in descendants(owner.layer).flatMap({layer in (layer.animationKeys() ?? []).compactMap{layer.animation(forKey:$0)}}) {
            XCTAssertEqual(animation.duration,(NativeMagicCardSource.end-NativeMagicCardSource.hold)*1.3,accuracy:0.000001)
        }
        owner.dispose()
    }
    func testRetiredLeaseRejectsDecodeAndReduceMotionOwnsNoAnimation() throws {
        let lease=NativeRewardPreparationLease();lease.cancel()
        XCTAssertNil(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:lease))
        let source=try XCTUnwrap(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:NativeRewardPreparationLease()))
        let owner=NativeMagicCardReveal();owner.install(source);owner.play(from:0,to:NativeMagicCardSource.hold,reduced:true)
        func quiet(_ layer:CALayer)->Bool { (layer.animationKeys() ?? []).isEmpty && (layer.sublayers ?? []).allSatisfy(quiet) }
        XCTAssertTrue(quiet(owner.layer));owner.dispose()
    }
}
