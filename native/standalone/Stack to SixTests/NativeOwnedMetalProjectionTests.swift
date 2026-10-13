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

}
