import XCTest
import UIKit
import SpriteKit
import Metal
import StackToSixGameplay
@testable import Stack_to_Six

/// Exercises actual SKRenderer pixels, including device-density projection.
/// No assets, UI screenshot scaling, or manually reproduced projection math.
@MainActor final class NativeOwnedMetalProjectionTests:XCTestCase {
    private struct Extent {let x:Int,y:Int,width:Int,height:Int}
    private func markerExtent(scaleMode:SKSceneScaleMode)throws->Extent {
        let device=try XCTUnwrap(MTLCreateSystemDefaultDevice())
        let queue=try XCTUnwrap(device.makeCommandQueue())
        let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:390,height:844,mipmapped:false)
        descriptor.usage=[.renderTarget,.shaderRead];descriptor.storageMode = .shared
        let texture=try XCTUnwrap(device.makeTexture(descriptor:descriptor))
        let scene=SKScene(size:CGSize(width:390,height:844))
        scene.scaleMode=scaleMode;scene.anchorPoint = .zero;scene.backgroundColor = .clear
        let marker=SKSpriteNode(color:.green,size:CGSize(width:80,height:80))
        marker.position=CGPoint(x:195,y:422);scene.addChild(marker)
        let renderer=SKRenderer(device:device);renderer.scene=scene
        renderer.update(atTime:1)
        let pass=MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture=texture
        pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store
        pass.colorAttachments[0].clearColor=MTLClearColorMake(0,0,0,0)
        let command=try XCTUnwrap(queue.makeCommandBuffer())
        renderer.render(withViewport:CGRect(x:0,y:0,width:390,height:844),commandBuffer:command,renderPassDescriptor:pass)
        command.commit();command.waitUntilCompleted()
        XCTAssertEqual(command.status,.completed,"Actual raster command failed: \(String(describing:command.error))")
        var bytes=[UInt8](repeating:0,count:390*844*4)
        bytes.withUnsafeMutableBytes { buffer in
            texture.getBytes(buffer.baseAddress!,bytesPerRow:390*4,from:MTLRegionMake2D(0,0,390,844),mipmapLevel:0)
        }
        var minX=390,minY=844,maxX = -1,maxY = -1
        for y in 0..<844 {for x in 0..<390 {
            let offset=(y*390+x)*4
            if bytes[offset+1]>200 && bytes[offset]<50 && bytes[offset+2]<50 && bytes[offset+3]>200 {
                minX=min(minX,x);maxX=max(maxX,x);minY=min(minY,y);maxY=max(maxY,y)
            }
        }}
        renderer.scene=nil
        return Extent(x:minX,y:minY,width:max(0,maxX-minX+1),height:max(0,maxY-minY+1))
    }
    func testFillRasterPreservesLogicalPointExtentAtOnePixelPerPoint()throws {
        let extent=try markerExtent(scaleMode:.fill)
        XCTAssertEqual(Double(extent.x),155,accuracy:2)
        XCTAssertEqual(Double(extent.y),382,accuracy:2)
        XCTAssertEqual(Double(extent.width),80,accuracy:2)
        XCTAssertEqual(Double(extent.height),80,accuracy:2)
    }
    func testResizeFillRasterDocumentsStandaloneRendererDensityMismatch()throws {
        let fill=try markerExtent(scaleMode:.fill),resize=try markerExtent(scaleMode:.resizeFill)
        guard UIScreen.main.nativeScale>1.1 else{throw XCTSkip("Density mismatch requires a Retina renderer")}
        XCTAssertTrue(resize.x != fill.x || resize.y != fill.y || resize.width != fill.width || resize.height != fill.height,
                      "Expected actual resizeFill projection to differ at nativeScale \(UIScreen.main.nativeScale); fill=\(fill), resize=\(resize)")
    }
    func testActualOwnedHostUsesFillAndRestoresAuthoredResizeFillOnRetirement()throws {
        guard let host=NativeOwnedMetalGameplayView(frame:CGRect(x:0,y:0,width:390,height:844)) else {
            throw XCTSkip("A real Metal device is required")
        }
        let state=NativeBoardState(columns:5,rows:9,tiles:[.init(id:"marker",cell:.init(column:0,row:0),value:1)])
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),
            resourceRoot:Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle"),
            size:CGSize(width:390,height:844))
        scene.layout(size:scene.size,insets:.zero)
        XCTAssertEqual(scene.scaleMode,.resizeFill)
        XCTAssertTrue(host.presentScene(scene))
        XCTAssertEqual(scene.scaleMode,.fill,"Actual production host must use density-independent authored logical viewport")
        XCTAssertEqual(scene.size,CGSize(width:390,height:844))
        host.retirePresentation()
        XCTAssertEqual(scene.scaleMode,.resizeFill)
        scene.dispose()
    }

    /// Unlike the projection marker, this exercises real authored textures and
    /// SpriteKit's transient shape raster cache while three GPU frames overlap.
    /// Every submitted image is read; a one-frame texture substitution cannot
    /// disappear into a final screenshot or an averaged image.
    func testTexturedFramesRemainStableAcrossShapeChurnWithAndWithoutMipmaps() throws {
        let device=try XCTUnwrap(MTLCreateSystemDefaultDevice())
        let queue=try XCTUnwrap(device.makeCommandQueue())
        let width=256,height=256
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        // The production admission limit is the regression contract. Explicit
        // forensic opt-in repeats the former unsafe overlap and is expected to
        // fail when SpriteKit reuses mutable sprite texture-binding resources.
        let repeatUnsafe=ProcessInfo.processInfo.environment["CC_NATIVE_UNSAFE_RENDER_REPRO"]=="1"
        var flightLimits=[NativeOwnedMetalGameplayView.maximumInFlightFrames]
        if repeatUnsafe,!flightLimits.contains(3) {flightLimits.append(3)}
        for configuration in flightLimits.flatMap({limit in [true,false].map{($0,limit)}}) {
            let (mipmaps,flightLimit)=configuration
            let stressFrames=1200
            let artwork=NativeBoardTextures(root:root)
            defer {artwork.dispose()}
            let scene=SKScene(size:CGSize(width:width,height:height))
            scene.scaleMode = .fill;scene.backgroundColor = .clear
            let regularPaths=["assets/tile.png"]+NativeRegularStackLayout.Skin.allCases.map{String($0.rawValue.dropFirst(2))}
            let paths=regularPaths+["assets/close-icon.png","assets/nav/stats-nav.png",
                       "assets/hud/score-hud.png","assets/hud/combo-hud.png",
                       "assets/hud/extra-combo-hud.png","assets/hud/mega-combo-hud.png"]
            var regularTextures:[SKTexture]=[],paintedSprites:[SKSpriteNode]=[]
            for (index,path) in paths.enumerated() {
                let texture=try XCTUnwrap(artwork.texture(path),path)
                texture.usesMipmaps=mipmaps
                let sprite=SKSpriteNode(texture:texture,size:CGSize(width:58,height:58))
                sprite.position=CGPoint(x:32+(index%4)*64,y:34+(index/4)*64)
                sprite.zPosition=CGFloat(index*2)
                scene.addChild(sprite)
                paintedSprites.append(sprite)
                if index<regularPaths.count {
                    regularTextures.append(texture)
                    let pip=SKSpriteNode(texture:artwork.pipTexture(),size:CGSize(width:7,height:7))
                    pip.position=CGPoint(x:5,y:5);sprite.addChild(pip)
                }
            }
            let transient=(0..<paths.count).map {index -> SKNode in
                let node=SKNode();node.zPosition=CGFloat(index*2+1);scene.addChild(node);return node
            }
            let rasterFormat=UIGraphicsImageRendererFormat();rasterFormat.scale=1;rasterFormat.opaque=false
            let rasterizer=UIGraphicsImageRenderer(size:CGSize(width:32,height:32),format:rasterFormat)
            let renderer=SKRenderer(device:device);renderer.scene=scene
            renderer.ignoresSiblingOrder=false
            defer {renderer.scene=nil}
            let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:width,height:height,mipmapped:false)
            descriptor.usage=[.renderTarget,.shaderRead];descriptor.storageMode = .shared
            let targets=try (0..<3).map {_ in try XCTUnwrap(device.makeTexture(descriptor:descriptor))}
            var references:[Int:Data]=[:]
            var mismatchedFrames=0
            func attachRaster(_ data:Data,name:String) throws {
                let provider=try XCTUnwrap(CGDataProvider(data:data as CFData))
                let bitmap=CGBitmapInfo.byteOrder32Little.union(CGBitmapInfo(rawValue:CGImageAlphaInfo.premultipliedFirst.rawValue))
                let cg=try XCTUnwrap(CGImage(width:width,height:200,bitsPerComponent:8,bitsPerPixel:32,
                    bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:bitmap,
                    provider:provider,decode:nil,shouldInterpolate:false,intent:.defaultIntent))
                let image=UIImage(cgImage:cg)
                let attachment=XCTAttachment(image:image);attachment.name=name;attachment.lifetime = .keepAlways
                add(attachment)
                let url=URL(fileURLWithPath:NSTemporaryDirectory()).appendingPathComponent(name+".png")
                try XCTUnwrap(image.pngData()).write(to:url)
                print("FLASH_RASTER \(url.path)")
            }
            var submitted:[(Int,any MTLCommandBuffer,any MTLTexture)]=[]
            func verifyBatch() throws {
                for (frame,command,target) in submitted {
                    command.waitUntilCompleted()
                    XCTAssertEqual(command.status,.completed,"mipmaps=\(mipmaps) frame=\(frame): \(String(describing:command.error))")
                    var pixels=[UInt8](repeating:0,count:width*height*4)
                    pixels.withUnsafeMutableBytes {raw in
                        target.getBytes(raw.baseAddress!,bytesPerRow:width*4,from:MTLRegionMake2D(0,0,width,height),mipmapLevel:0)
                    }
                    // The top strip owns changing shape geometry. The authored
                    // sprite region must remain byte-stable after initial upload.
                    let stable=Data(pixels[(height-200)*width*4..<pixels.count])
                    let phase=(frame+12)%4
                    if frame>=0 {
                        if let reference=references[phase] {
                            // Data equality uses a native byte comparison so the
                            // long stress remains bounded in unoptimized Debug.
                            if stable != reference {
                                mismatchedFrames+=1
                                if mismatchedFrames==1 {
                                    let actual=[UInt8](stable),expected=[UInt8](reference)
                                    var changedPixels=0,maxDelta=0,minX=width,minY=200,maxX = -1,maxY = -1
                                    for pixel in 0..<(width*200) {
                                        var changed=false
                                        for channel in 0..<4 {
                                            let offset=pixel*4+channel
                                            let delta=abs(Int(actual[offset])-Int(expected[offset]))
                                            maxDelta=max(maxDelta,delta);changed = changed || delta != 0
                                        }
                                        if changed {
                                            changedPixels+=1;let x=pixel%width,y=pixel/width
                                            minX=min(minX,x);maxX=max(maxX,x);minY=min(minY,y);maxY=max(maxY,y)
                                        }
                                    }
                                    let exactPhases=references.keys.sorted().filter{references[$0]==stable}
                                    let phaseErrors=references.keys.sorted().map {candidate -> String in
                                        let error=zip(stable,references[candidate]!).reduce(0){$0+abs(Int($1.0)-Int($1.1))}
                                        return "\(candidate):\(error)"
                                    }
                                    print("FLASH_MISMATCH flights=\(flightLimit) mipmaps=\(mipmaps) frame=\(frame) phase=\(phase) changedPixels=\(changedPixels) maxDelta=\(maxDelta) bounds=\(minX),\(minY)-\(maxX),\(maxY) exactOtherPhases=\(exactPhases) phaseErrors=\(phaseErrors)")
                                    try attachRaster(stable,name:"flash-flights-\(flightLimit)-mips-\(mipmaps)-actual")
                                    try attachRaster(reference,name:"flash-flights-\(flightLimit)-mips-\(mipmaps)-reference")
                                }
                            }
                        }
                        else {XCTFail("Missing serial reference for phase \(phase)")}
                    } else if frame >= -4 {
                        references[phase]=stable
                    }
                }
                submitted.removeAll(keepingCapacity:true)
            }
            // Twelve serial warmup/reference frames precede the overlapping
            // submissions. Each stress image compares against the exact same
            // texture assignment and fractional pose rendered serially.
            for frame in -12..<stressFrames {
                let phase=(frame+12)%4
                for (index,sprite) in paintedSprites.enumerated() {
                    if index<regularTextures.count {
                        sprite.texture=regularTextures[(index+phase)%regularTextures.count]
                    }
                    let fraction=CGFloat(phase)/4
                    sprite.position=CGPoint(x:CGFloat(32+(index%4)*64)+fraction,
                                            y:CGFloat(34+(index/4)*64)+fraction)
                    sprite.setScale(1+CGFloat(phase)*0.02)
                }
                transient.forEach{$0.removeAllChildren()}
                // Fresh immutable CPU rasters exercise transient sprite texture
                // upload/reuse, interleaved with the invariant mipmapped art.
                // Their pixels stay outside the compared region.
                let circleImage=rasterizer.image {_ in
                    UIColor.white.setFill()
                    UIBezierPath(ovalIn:CGRect(x:1,y:1,width:30,height:30)).fill()
                }
                let dotImage=rasterizer.image {_ in
                    UIColor.brown.setFill()
                    UIBezierPath(ovalIn:CGRect(x:9,y:9,width:14,height:14)).fill()
                }
                let circleTexture=SKTexture(image:circleImage),dotTexture=SKTexture(image:dotImage)
                for index in 0..<12 {
                    let circle=SKShapeNode(circleOfRadius:CGFloat(2+(frame+12+index)%9))
                    circle.fillColor = .white;circle.strokeColor = .clear
                    circle.position=CGPoint(x:10+index*20,y:235);transient[index%transient.count].addChild(circle)
                    let sprite=SKSpriteNode(texture:index%2==0 ? circleTexture:dotTexture,
                                            size:CGSize(width:CGFloat(8+(frame+12+index)%17),height:20))
                    sprite.position=CGPoint(x:10+index*20,y:214)
                    transient[index%transient.count].addChild(sprite)
                }
                renderer.update(atTime:1+Double(frame+12)/60)
                let target=targets[(frame+12)%3],pass=MTLRenderPassDescriptor()
                pass.colorAttachments[0].texture=target
                pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store
                pass.colorAttachments[0].clearColor=MTLClearColorMake(0,0,0,0)
                let command=try XCTUnwrap(queue.makeCommandBuffer())
                renderer.render(withViewport:CGRect(x:0,y:0,width:width,height:height),commandBuffer:command,renderPassDescriptor:pass)
                command.commit();submitted.append((frame,command,target))
                if frame<0 || submitted.count==flightLimit {try verifyBatch()}
            }
            try verifyBatch()
            XCTAssertEqual(mismatchedFrames,0,"flights=\(flightLimit) mipmaps=\(mipmaps): \(mismatchedFrames)/\(stressFrames) stress frames differ from their serial pose reference; see first actual/reference raster attachments")
        }
    }
}
