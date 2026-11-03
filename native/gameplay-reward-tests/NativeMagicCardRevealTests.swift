import XCTest
import UIKit
import ImageIO
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeMagicCardRevealTests:XCTestCase {
    func testHeldFaceUsesOriginalDensityWithoutChangingFoldFramesOrBurnBudget() throws {
        let url=NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path)
        let source=try XCTUnwrap(NativeMagicCardSource.read(url,lease:NativeRewardPreparationLease()))
        // The copied SVG has no neighboring high-density PNG: read must retain
        // its original embedded final WebP as a complete fallback.
        let folder=FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString,isDirectory:true)
        let fallbackURL=folder.appendingPathComponent(NativeMagicCardSource.path)
        try FileManager.default.createDirectory(at:fallbackURL.deletingLastPathComponent(),withIntermediateDirectories:true)
        defer{try? FileManager.default.removeItem(at:folder)}
        try FileManager.default.copyItem(at:url,to:fallbackURL)
        let fallback=try XCTUnwrap(NativeMagicCardSource.read(fallbackURL,lease:NativeRewardPreparationLease()))
        func images(_ node:NativeMagicCardSource.Node)->[NativeMagicCardSource.Node] {
            (node.tag=="image" ? [node]:[])+node.children.flatMap{images($0)}
        }
        let actual=images(source),embedded=images(fallback)
        XCTAssertEqual(actual.count,9);XCTAssertEqual(embedded.count,9)
        for index in 0..<8 {
            XCTAssertEqual(actual[index].attributes,embedded[index].attributes)
            XCTAssertEqual(actual[index].image?.width,embedded[index].image?.width)
            XCTAssertEqual(actual[index].image?.height,embedded[index].image?.height)
            XCTAssertEqual(actual[index].image?.dataProvider?.data as Data?,embedded[index].image?.dataProvider?.data as Data?)
        }
        let held=try XCTUnwrap(actual.last),oldHeld=try XCTUnwrap(embedded.last)
        XCTAssertEqual(held.attributes,oldHeld.attributes,"Exact authored geometry and tracks remain")
        XCTAssertEqual(oldHeld.image?.width,360);XCTAssertEqual(oldHeld.image?.height,533)
        XCTAssertEqual(held.image?.width,1032);XCTAssertEqual(held.image?.height,1528)
        let original=try XCTUnwrap(CGImageSourceCreateWithURL(NativeTestResources.root.appendingPathComponent("assets/colelctibles/interim@2x.png") as CFURL,nil))
        let decoded=try XCTUnwrap(CGImageSourceCreateImageAtIndex(original,0,nil))
        let bitmap=try XCTUnwrap(CGContext(data:nil,width:1032,height:1528,bitsPerComponent:8,bytesPerRow:1032*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue))
        bitmap.draw(decoded,in:CGRect(x:0,y:0,width:1032,height:1528));NativeMagicCardSource.brightenPremultipliedRGBA(bitmap)
        XCTAssertEqual(held.image?.dataProvider?.data as Data?,bitmap.makeImage()?.dataProvider?.data as Data?,"Same accepted brightness formula on original high-density pixels")
        XCTAssertEqual(held.sheenImage?.width,1032);XCTAssertEqual(held.sheenImage?.height,1528)
        XCTAssertEqual(held.burnGlow?.width,1032);XCTAssertEqual(held.burnGlow?.height,1528)
        XCTAssertEqual(held.burnFrames.count,31)
        XCTAssertTrue(held.burnFrames.allSatisfy{$0.width==360 && $0.height==533},"Finite animated burn retains its original pixel budget")
        XCTAssertEqual(held.burnFrames.reduce(0){$0+$1.bytesPerRow*$1.height},31*360*533*4)
        func alphaStats(_ image:CGImage)throws -> (maximum:UInt8,nonzero:Int) {
            let bitmap=try XCTUnwrap(CGContext(data:nil,width:image.width,height:image.height,bitsPerComponent:8,bytesPerRow:image.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue))
            bitmap.draw(image,in:CGRect(x:0,y:0,width:image.width,height:image.height))
            let bytes=try XCTUnwrap(bitmap.data).assumingMemoryBound(to:UInt8.self)
            var maximum:UInt8=0,nonzero=0
            for offset in stride(from:3,to:image.width*image.height*4,by:4) {maximum=max(maximum,bytes[offset]);if bytes[offset]>0 {nonzero+=1}}
            return (maximum,nonzero)
        }
        XCTAssertEqual(try alphaStats(held.burnFrames[0]).maximum,0,"The held first frame must never cover the original with a low-resolution photograph")
        XCTAssertEqual(try alphaStats(held.burnFrames[30]).maximum,0)
        let middle=try alphaStats(held.burnFrames[15])
        XCTAssertGreaterThan(middle.maximum,0);XCTAssertLessThan(middle.maximum,255)
        XCTAssertLessThan(middle.nonzero,360*533,"Only a partial transparent light field is rasterized")
        let owner=NativeMagicCardReveal();owner.install(source);defer{owner.dispose()}
        XCTAssertEqual(owner.imageCount,9);XCTAssertEqual(owner.trackCount,210)
    }
    func testHeldFaceSheenUsesFaceBoundsAndRetiresForReducedMotionStopAndDispose() throws {
        let source=try XCTUnwrap(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:NativeRewardPreparationLease()))
        let owner=NativeMagicCardReveal();owner.install(source);owner.settle(at:NativeMagicCardSource.hold)
        defer{owner.dispose()}
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        let sheen=try XCTUnwrap(descendants(owner.layer).first{$0.name=="native.reward.magic-card.sheen"})
        let face=try XCTUnwrap(sheen.superlayer),band=try XCTUnwrap(sheen.mask)
        XCTAssertEqual(sheen.frame,face.bounds)
        XCTAssertNotNil(sheen.contents);XCTAssertEqual(owner.imageCount,9)
        owner.playCardShimmer(reduced:true);XCTAssertEqual(sheen.opacity,0);XCTAssertNil(band.animationKeys())
        let admitted=band.convertTime(CACurrentMediaTime(),from:nil)
        owner.playCardShimmer(reduced:false)
        let pass=try XCTUnwrap(band.animation(forKey:"native.reward.magic-card.sheen"))
        XCTAssertEqual(band.bounds.width,face.bounds.width*1.12,accuracy:0.001)
        XCTAssertEqual(pass.beginTime,admitted,accuracy:0.05)
        XCTAssertEqual(pass.duration,3);XCTAssertEqual(pass.repeatCount,.infinity);XCTAssertTrue(pass.isRemovedOnCompletion)
        XCTAssertEqual(sheen.opacity,0.72,accuracy:0.001)
        owner.stopCardShimmer();XCTAssertEqual(sheen.opacity,0);XCTAssertNil(band.animationKeys())
        owner.playCardShimmer(reduced:false);owner.dispose();owner.dispose()
        XCTAssertNil(sheen.contents);XCTAssertNil(sheen.superlayer);XCTAssertNil(sheen.mask);XCTAssertNil(band.animationKeys())
    }
    func testRepeatedMountedEffectOwnersReleaseLayersAndAnimations() throws {
        let source=try XCTUnwrap(NativeMagicCardSource.read(NativeTestResources.root.appendingPathComponent(NativeMagicCardSource.path),lease:NativeRewardPreparationLease()))
        let host=UIView(frame:CGRect(x:0,y:0,width:390,height:844))
        func descendants(_ layer:CALayer)->[CALayer] {[layer]+(layer.sublayers ?? []).flatMap{descendants($0)}}
        for _ in 0..<8 {
            weak var weakOwner:NativeMagicCardReveal?
            autoreleasepool {
                let owner=NativeMagicCardReveal();weakOwner=owner
                host.layer.addSublayer(owner.layer);owner.install(source);owner.playCardShimmer(reduced:false)
                let held=descendants(owner.layer)
                XCTAssertTrue(held.contains{!($0.animationKeys() ?? []).isEmpty})
                owner.stop();XCTAssertTrue(held.allSatisfy{($0.animationKeys() ?? []).isEmpty})
                owner.playCardShimmer(reduced:false);owner.dispose();owner.dispose();owner.layer.removeFromSuperlayer()
                XCTAssertTrue(held.allSatisfy{$0.contents == nil && ($0.animationKeys() ?? []).isEmpty})
            }
            XCTAssertNil(weakOwner);XCTAssertTrue((host.layer.sublayers ?? []).isEmpty)
        }
    }
    func testCTAAndInterimEffectChurnRetiresObserversAnimationsAndPreparedImages() async throws {
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        let root=UIViewController();window.rootViewController=root;window.makeKeyAndVisible()
        defer{window.isHidden=true;window.rootViewController=nil}
        for _ in 0..<16 {
            weak var released:NativeCTAShimmer?
            autoreleasepool {
                let button=JimiV9PlainButton(type:.custom);button.frame=CGRect(x:40,y:200,width:240,height:74);root.view.addSubview(button)
                let shimmer=NativeCTAShimmer(button:button,faceLayer:button.layer);released=shimmer
                shimmer.refresh();shimmer.dispose();shimmer.dispose()
                XCTAssertNil(shimmer.highlight.superlayer);XCTAssertNil(shimmer.highlight.animationKeys());XCTAssertNil(shimmer.band.animationKeys())
                button.removeFromSuperview()
            }
            XCTAssertNil(released)
        }
        for _ in 0..<8 {
            weak var releasedButton:JimiV9PlainButton?
            weak var releasedHighlight:CALayer?
            autoreleasepool {
                let button=JimiV9PlainButton(type:.custom);releasedButton=button
                button.frame=CGRect(x:40,y:200,width:240,height:74);root.view.addSubview(button)
                button.setPrimaryCTAShimmer(true)
                releasedHighlight=button.layer.sublayers?.flatMap{[$0]+($0.sublayers ?? [])}.first{$0.name=="native.cta.shimmer"}
                button.removeFromSuperview()
            }
            XCTAssertNil(releasedButton);XCTAssertNil(releasedHighlight)
        }
        let renderer=UIGraphicsImageRenderer(size:CGSize(width:120,height:180))
        let image=renderer.image{context in UIColor.orange.setFill();context.fill(CGRect(x:0,y:0,width:120,height:180))}
        for index in 0..<4 {
            let card=UIImageView(image:image);card.frame=CGRect(x:50,y:200,width:120,height:180);root.view.addSubview(card)
            var effect:JimiNativeInterimEffect?=JimiNativeInterimEffect(card:card,scale:1)
            weak var released=effect
            effect?.start()
            if index==0 {
                for _ in 0..<100 where effect?.preparedBurnFrameCount==0 {try await Task.sleep(nanoseconds:20_000_000)}
                XCTAssertEqual(effect?.preparedBurnFrameCount,31)
            }
            effect?.stop();effect?.stop();XCTAssertEqual(effect?.preparedBurnBytes,0)
            XCTAssertNil(card.layer.animation(forKey:"world.interim"))
            XCTAssertFalse((card.layer.sublayers ?? []).contains{($0.name ?? "").hasPrefix("world.interim")})
            effect=nil;XCTAssertNil(released);card.removeFromSuperview()
        }
        try await Task.sleep(nanoseconds:100_000_000)
        XCTAssertTrue(root.view.subviews.isEmpty)
    }
    func testHeldSvgReferenceAndLargerUnlockedArtworkExportComparison() throws {
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
            image.transform=CGAffineTransform(scaleX:NativeRewardPresentation.unlockedArtworkScale,y:NativeRewardPresentation.unlockedArtworkScale);face.addSubview(image)
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
            let correction=NativeRewardPresentation.unlockedArtworkScale/NativeRewardPresentation.frontArtworkScale
            XCTAssertEqual(closed.height*correction,opened.height,accuracy:2,"Unlocked correction must apply to its actual visible raster")
            XCTAssertEqual(closed.width*correction,opened.width,accuracy:2,"Keep original card proportions while increasing visible size")
        }
        let before=raster(width:390,closed:true,old:true),opened=raster(width:390,closed:false),after=raster(width:390,closed:true)
        let comparison=UIGraphicsImageRenderer(size:CGSize(width:1170,height:720),format:format).image{context in
            for (index,item) in [("SVG BEFORE",before),("UNLOCKED CARD",opened),("SVG REFERENCE",after)].enumerated() {
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
        let images=layers.filter{($0.name ?? "").hasPrefix("magic.image.")};XCTAssertEqual(images.count,9)
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
        let images=descendants(owner.layer).filter{($0.name ?? "").hasPrefix("magic.image.")}
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
