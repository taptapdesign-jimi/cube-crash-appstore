import Foundation
import SpriteKit
import Metal

/// Finite GPU preparation owned by the selected board's texture request. The
/// scratch graph has no gameplay, actions, display link, view or Source clock.
/// Its renderer and nodes are created/used exclusively on this serial worker;
/// only the completed GPU receipt returns to the main actor. SpriteKit's device
/// pipeline cache is then available to the normal gameplay SKRenderer.
nonisolated enum NativeGameplayPipelinePreparation {
    final class Request: @unchecked Sendable {
        private let lock=NSLock()
        private var cancelled=false
        private var submissions=0
        var isCurrent:Bool {lock.lock();defer{lock.unlock()};return !cancelled}
        var submittedFrames:Int {lock.lock();defer{lock.unlock()};return submissions}
        fileprivate func submitted(){lock.lock();submissions+=1;lock.unlock()}
        func cancel(){lock.lock();cancelled=true;lock.unlock()}
    }
    private final class Inputs: @unchecked Sendable {
        // Already uploaded, immutable texture identities. No decode or new art.
        let textures:[SKTexture]
        init(_ textures:[SKTexture]){self.textures=textures}
    }
    private final class Resources: @unchecked Sendable {
        let renderer:SKRenderer,scene:SKScene
        let target:any MTLTexture
        init(renderer:SKRenderer,scene:SKScene,target:any MTLTexture){self.renderer=renderer;self.scene=scene;self.target=target}
    }
    private static let queue=DispatchQueue(label:"com.taptapdesign.stacktosix.gameplay-pipelines",qos:.userInitiated)
    @MainActor @discardableResult static func prepare(textures:[SKTexture],enqueue:((@escaping @Sendable ()->Void)->Void)?=nil,completion:@escaping @MainActor (Bool)->Void)->Request {
        let request=Request(),inputs=Inputs(textures)
        let work:@Sendable ()->Void = {
            func finish(_ success:Bool){DispatchQueue.main.async {completion(success && request.isCurrent)}}
            guard request.isCurrent else{finish(false);return}
            autoreleasepool {
                guard let device=MTLCreateSystemDefaultDevice(),let commands=device.makeCommandQueue(),request.isCurrent else{finish(false);return}
                let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:64,height:64,mipmapped:false)
                descriptor.usage=[.renderTarget,.shaderRead];descriptor.storageMode = .private
                guard let target=device.makeTexture(descriptor:descriptor),let command=commands.makeCommandBuffer() else{finish(false);return}
                let scene=SKScene(size:CGSize(width:64,height:64));scene.scaleMode = .fill;scene.backgroundColor = .clear
                for (index,texture) in inputs.textures.enumerated() {
                    guard request.isCurrent else{finish(false);return}
                    let node=SKSpriteNode(texture:texture,size:CGSize(width:12,height:12))
                    node.position=CGPoint(x:8+(index%4)*14,y:8+(index/4%4)*14);node.alpha=0.75
                    scene.addChild(node)
                }
                // The same built-in sprite, rounded path, stroked path and glyph
                // pipelines used by the board/HUD. Make every primitive visible
                // here; alpha-zero entry holders cannot compile these ahead.
                let plain=SKSpriteNode(color:.white,size:CGSize(width:8,height:8));plain.position=CGPoint(x:12,y:54);scene.addChild(plain)
                for index in 0..<2 {
                    let shape=SKShapeNode(rectOf:CGSize(width:12,height:8),cornerRadius:3)
                    shape.position=CGPoint(x:30+index*16,y:54);shape.fillColor = .brown
                    shape.strokeColor = index==0 ? .clear:.white;shape.lineWidth=1;shape.alpha=0.75;scene.addChild(shape)
                }
                let glyph=SKLabelNode(fontNamed:"Helvetica");glyph.text="01";glyph.fontSize=10;glyph.position=CGPoint(x:32,y:26);scene.addChild(glyph)
                let renderer=SKRenderer(device:device);renderer.ignoresSiblingOrder=false;renderer.scene=scene
                let pass=MTLRenderPassDescriptor();pass.colorAttachments[0].texture=target
                pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .dontCare
                guard request.isCurrent else{finish(false);return}
                let start=ProcessInfo.processInfo.systemUptime
                renderer.update(atTime:0)
                renderer.render(withViewport:CGRect(x:0,y:0,width:64,height:64),commandBuffer:command,renderPassDescriptor:pass)
                let resources=Resources(renderer:renderer,scene:scene,target:target)
                command.addCompletedHandler { result in
                    _=resources.renderer;_=resources.scene;_=resources.target
                    #if DEBUG
                    NSLog("[NativeEntryPipelines] prepared=%d durationMs=%.1f cancelled=%d",result.status == .completed ? 1:0,(ProcessInfo.processInfo.systemUptime-start)*1000,request.isCurrent ? 0:1)
                    #endif
                    finish(result.status == .completed)
                }
                // Already executing SpriteKit/driver compilation cannot cancel.
                // One submitted scratch frame drains; retired callers cannot publish.
                request.submitted();command.commit()
            }
        }
        if let enqueue {enqueue(work)}else{queue.async(execute:work)}
        return request
    }
}
