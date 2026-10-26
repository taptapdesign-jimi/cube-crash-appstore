import UIKit
import SpriteKit
import MetalKit
import StackToSixGameplay

/// Standalone Native presentation owner. MTKView supplies the only frame scheduler;
/// SKRenderer borrows the existing Scene and canonical Source delivery.
@MainActor
final class NativeOwnedMetalGameplayView: MTKView, @preconcurrency MTKViewDelegate, NativeGameplayRenderHost {
    // Overlapping SKRenderer updates/encodes reproduce wrong texture sampling.
    // Admit the next update only after the prior GPU submission completes.
    // A busy GPU skips this display tick; the main thread never waits.
    nonisolated static let maximumInFlightFrames=1
    final class Flights: @unchecked Sendable {
        private let lock=NSLock()
        private var count=0
        private var submitted=0,completed=0,failed=0
        private var lastFailure:[String:Any]=[:]
        func recordSubmission(){lock.lock();submitted+=1;lock.unlock()}
        /// Only immutable frame identifiers cross the GPU completion boundary.
        /// Keep one bounded failure record rather than retaining command buffers.
        func completeSubmission(status:MTLCommandBufferStatus,error:Error?,epoch:UInt64,generation:UInt64) {
            defer{release()}
            let failure=status != .completed
            let detail=error as NSError?
            let domain=String((detail?.domain ?? "").prefix(128))
            let message=String((detail?.localizedDescription ?? "").prefix(256))
            lock.lock()
            if failure {
                failed+=1
                lastFailure=["status":status.rawValue,"errorDomain":domain,"errorCode":detail?.code ?? 0,
                    "message":message,"presentationEpoch":epoch,"generation":generation]
            } else {completed+=1}
            let shouldLog=failure && failed<=4
            lock.unlock()
            if shouldLog {
                NSLog("[CC_NATIVE_RENDER_FAILURE] status=%lu domain=%@ code=%ld epoch=%llu generation=%llu message=%@",
                    status.rawValue,domain,detail?.code ?? 0,epoch,generation,message)
            }
        }
        var completionSnapshot:[String:Any] {
            lock.lock();defer{lock.unlock()}
            return ["submittedFrames":submitted,"completedFrames":completed,"failedFrames":failed,
                "lastRenderFailure":lastFailure]
        }
        func acquire()->Bool {lock.lock();defer{lock.unlock()};guard count<NativeOwnedMetalGameplayView.maximumInFlightFrames else{return false};count+=1;return true}
        func release(){lock.lock();count-=1;lock.unlock()}
        var outstanding:Int {lock.lock();defer{lock.unlock()};return count}
    }
    /// Completion handlers retain renderer resources without accessing Scene or
    /// UIKit off-main. Retired hosts never synchronously wait for GPU completion.
    private final class SubmittedResources: @unchecked Sendable {
        let renderer:SKRenderer
        init(_ renderer:SKRenderer){self.renderer=renderer}
    }
    private let ownedRenderer:SKRenderer
    private let ownedQueue:any MTLCommandQueue
    private let flights=Flights()
    private(set) var presentationEpoch:UInt64=0
    private var pausePolicyRevision:UInt64=0
    private var mountedScaleMode:SKSceneScaleMode?
    var diagnosticsEnabled=false
    private var unavailable=0,inFlightSkips=0
    private var acquireWorst=0.0,updateWorst=0.0,encodeWorst=0.0,submitWorst=0.0
    var renderView:UIView {self}
    var renderedScene:SKScene? {ownedRenderer.scene}
    var renderingPaused:Bool {get{isPaused} set{pausePolicyRevision &+= 1;isPaused=newValue}}
    var renderingFPS:Int {get{preferredFramesPerSecond} set{preferredFramesPerSecond=newValue}}

    init?(frame:CGRect = .zero,metalDevice:(any MTLDevice)? = MTLCreateSystemDefaultDevice()) {
        guard let metalDevice,let queue=metalDevice.makeCommandQueue() else{return nil}
        ownedRenderer=SKRenderer(device:metalDevice);ownedQueue=queue
        super.init(frame:frame,device:metalDevice)
        isOpaque=false;backgroundColor = .clear;clearColor=MTLClearColorMake(0,0,0,0)
        colorPixelFormat = .bgra8Unorm;framebufferOnly=true
        depthStencilPixelFormat = .invalid;sampleCount=1
        contentScaleFactor=UIScreen.main.scale;autoResizeDrawable=false
        updateDrawableResolution()
        preferredFramesPerSecond=60;enableSetNeedsDisplay=false;isPaused=true
        ownedRenderer.ignoresSiblingOrder=false
        delegate=self
    }
    required init(coder:NSCoder){fatalError("init(coder:) has not been implemented")}

    /// A Scene is never simultaneously mounted in SKView and this owner.
    @discardableResult func presentScene(_ scene:NativeBoardScene?)->Bool {
        if ownedRenderer.scene === scene {return true}
        guard scene?.view == nil,scene == nil || scene?.scaleMode == .resizeFill else{return false}
        if let foreign=scene?.gameplayRenderHost,foreign !== self {return false}
        isPaused=true;presentationEpoch &+= 1
        let epoch=presentationEpoch
        if let previous=ownedRenderer.scene as? NativeBoardScene {
            let previousScaleMode=mountedScaleMode
            previous.unmountOwnedRenderHost(self)
            guard epoch==presentationEpoch,ownedRenderer.scene === previous else{return false}
            if let previousScaleMode {previous.scaleMode=previousScaleMode}
        }
        mountedScaleMode=nil
        ownedRenderer.scene=nil
        guard let scene else{return true}
        // SKRenderer derives its logical target from texture pixels and the
        // screen's native scale. resizeFill therefore crops a one-pixel-per-
        // point target on Retina displays. Scene layout owns logical geometry;
        // fill maps that complete geometry into the actual render target.
        mountedScaleMode=scene.scaleMode
        scene.scaleMode = .fill
        ownedRenderer.scene=scene
        let pauseRevision=pausePolicyRevision
        let accepted=scene.mountOwnedRenderHost(self)
        guard epoch==presentationEpoch,ownedRenderer.scene === scene else{return false}
        guard accepted else {
            scene.unmountOwnedRenderHost(self)
            guard epoch==presentationEpoch,ownedRenderer.scene === scene else{return false}
            if let mountedScaleMode {scene.scaleMode=mountedScaleMode}
            mountedScaleMode=nil;ownedRenderer.scene=nil;return false
        }
        // Synchronize may synchronously suspend gameplay or replace the host.
        // Its explicit rendering policy wins over the initial mount default.
        if pausePolicyRevision==pauseRevision {isPaused=false}
        return true
    }
    func retirePresentation(){_ = presentScene(nil)}
    override func layoutSubviews(){
        super.layoutSubviews()
        updateDrawableResolution()
    }
    private func updateDrawableResolution() {
        let scale=window?.screen.scale ?? UIScreen.main.scale
        if contentScaleFactor != scale {contentScaleFactor=scale}
        let desired=CGSize(width:max(1,(bounds.width*scale).rounded(.up)),
                           height:max(1,(bounds.height*scale).rounded(.up)))
        if drawableSize != desired {drawableSize=desired}
    }
    override func didMoveToWindow(){
        super.didMoveToWindow()
        updateDrawableResolution()
        guard window == nil,let scene=ownedRenderer.scene as? NativeBoardScene else{return}
        let epoch=presentationEpoch
        scene.renderPipelineProbe?.cancel(scene:scene,reason:"window-detached")
        guard window == nil,presentationEpoch==epoch,ownedRenderer.scene === scene else{return}
        // Detachment ends held input, not the controller's suspension scope.
        // This retires queued moves/direct transport and retains the authored
        // finite pointer-cancel return. External callbacks can replace the Scene.
        scene.cancelDrag(pointerCancelled:true)
        guard window == nil,presentationEpoch==epoch,ownedRenderer.scene === scene else{return}
        scene.retireSourceRendererDragTransport()
    }
    func mtkView(_ view:MTKView,drawableSizeWillChange size:CGSize) {}
    func draw(in view:MTKView){
        guard view === self,frameAdmissionVisible,
              let scene=ownedRenderer.scene as? NativeBoardScene else{return}
        guard flights.acquire() else{if diagnosticsEnabled {inFlightSkips+=1};return}
        var submitted=false
        defer{if !submitted {flights.release()}}
        let epoch=presentationEpoch
        let acquireStart=diagnosticsEnabled ? CACurrentMediaTime():nil
        // Public acquisition may block up to the CAMetalLayer timeout. This is
        // measured separately; no unavailable-drawable precheck/private API.
        let acquiredDrawable=currentDrawable
        let acquiredPass=acquiredDrawable == nil ? nil:currentRenderPassDescriptor
        if let acquireStart {acquireWorst=max(acquireWorst,(CACurrentMediaTime()-acquireStart)*1000)}
        guard let drawable=acquiredDrawable,let pass=acquiredPass,
              let command=ownedQueue.makeCommandBuffer() else{if diagnosticsEnabled{unavailable+=1};return}
        guard updateSceneForRendererFrame(atTime:CACurrentMediaTime()),
              epoch==presentationEpoch,ownedRenderer.scene === scene else{return}
        let encodeStart=diagnosticsEnabled ? CACurrentMediaTime():nil
        ownedRenderer.render(withViewport:CGRect(origin:.zero,size:drawableSize),commandBuffer:command,renderPassDescriptor:pass)
        if let encodeStart {encodeWorst=max(encodeWorst,(CACurrentMediaTime()-encodeStart)*1000)}
        let pool=flights,resources=SubmittedResources(ownedRenderer),generation=scene.engine.state.generation
        command.addCompletedHandler{completed in
            _ = resources.renderer
            pool.completeSubmission(status:completed.status,error:completed.error,epoch:epoch,generation:generation)
        }
        let submitStart=diagnosticsEnabled ? CACurrentMediaTime():nil
        #if DEBUG
        if let touch=scene.takeHUDLatencySubmission() {
            NSLog("[NATIVE_HUD_LATENCY] phase=metal.submit monotonicMs=%.3f deltaMs=%.3f",CACurrentMediaTime()*1000,(CACurrentMediaTime()-touch)*1000)
            command.addCompletedHandler { _ in
                NSLog("[NATIVE_HUD_LATENCY] phase=metal.completed monotonicMs=%.3f deltaMs=%.3f",CACurrentMediaTime()*1000,(CACurrentMediaTime()-touch)*1000)
            }
        }
        #endif
        command.present(drawable);submitted=true;pool.recordSubmission();command.commit()
        if let submitStart {submitWorst=max(submitWorst,(CACurrentMediaTime()-submitStart)*1000)}
    }
    private var frameAdmissionVisible:Bool {
        guard !isPaused,let window,UIApplication.shared.applicationState == .active else{return false}
        if let windowScene=window.windowScene,windowScene.activationState != .foregroundActive {return false}
        var surface:UIView?=self
        while let current=surface {
            guard !current.isHidden,current.alpha>0.001 else{return false}
            surface=current.superview
        }
        return true
    }
    /// Actual SKRenderer update boundary, shared with mounted-host regression
    /// tests. This performs no encoding and reports model admission only.
    @discardableResult func updateSceneForRendererFrame(atTime time:TimeInterval)->Bool {
        guard time.isFinite,frameAdmissionVisible,
              let scene=ownedRenderer.scene as? NativeBoardScene else{return false}
        let epoch=presentationEpoch,start=diagnosticsEnabled ? CACurrentMediaTime():nil
        ownedRenderer.update(atTime:time)
        if let start {updateWorst=max(updateWorst,(CACurrentMediaTime()-start)*1000)}
        return epoch==presentationEpoch && ownedRenderer.scene === scene && frameAdmissionVisible
    }
    isolated deinit {
        if let scene=ownedRenderer.scene as? NativeBoardScene {
            scene.unmountOwnedRenderHost(self)
            if let mountedScaleMode {scene.scaleMode=mountedScaleMode}
        }
        ownedRenderer.scene=nil
    }
    func scenePointToView(_ point:CGPoint,scene:SKScene)->CGPoint {
        CGPoint(x:(point.x+scene.anchorPoint.x*scene.size.width)*bounds.width/max(scene.size.width,1),
                y:(scene.size.height*(1-scene.anchorPoint.y)-point.y)*bounds.height/max(scene.size.height,1))
    }
    func viewPointToScene(_ point:CGPoint,scene:SKScene)->CGPoint {
        CGPoint(x:point.x*scene.size.width/max(bounds.width,1)-scene.anchorPoint.x*scene.size.width,
                y:scene.size.height*(1-scene.anchorPoint.y)-point.y*scene.size.height/max(bounds.height,1))
    }
    override func touchesBegan(_ touches:Set<UITouch>,with event:UIEvent?){guard frameAdmissionVisible else{return};(ownedRenderer.scene as? NativeBoardScene)?.touchesBegan(touches,with:event)}
    override func touchesMoved(_ touches:Set<UITouch>,with event:UIEvent?){guard frameAdmissionVisible else{return};(ownedRenderer.scene as? NativeBoardScene)?.touchesMoved(touches,with:event)}
    override func touchesEnded(_ touches:Set<UITouch>,with event:UIEvent?){(ownedRenderer.scene as? NativeBoardScene)?.touchesEnded(touches,with:event)}
    override func touchesCancelled(_ touches:Set<UITouch>,with event:UIEvent?){(ownedRenderer.scene as? NativeBoardScene)?.touchesCancelled(touches,with:event)}
    func diagnosticSnapshot()->[String:Any] {
        guard diagnosticsEnabled else{return[:]}
        var snapshot=flights.completionSnapshot
        snapshot.merge(["drawableUnavailable":unavailable,"inFlightSkips":inFlightSkips,
                "inFlight":flights.outstanding,"presentationEpoch":presentationEpoch,
                "acquireWorstMs":acquireWorst,"updateWorstMs":updateWorst,"encodeWorstMs":encodeWorst,"submitWorstMs":submitWorst]) { _,new in new }
        return snapshot
    }
}
