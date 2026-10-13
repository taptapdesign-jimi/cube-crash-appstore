import Foundation
import CoreGraphics
import StackToSixGameplay

/// Explicit diagnostic input replay. This is synthetic pipeline pressure, not
/// UITouch evidence. It borrows actual Scene callbacks and the Source move queue.
@MainActor final class NativeRenderPipelineProbe {
    struct Target {let id:String,generation:UInt64,center:CGPoint,radius:CGFloat}
    private(set) var phase="waiting"
    private(set) var frameCount=0
    private let warmupSeconds:TimeInterval,durationSeconds:TimeInterval,log:(String)->Void
    private var eligibleSince:TimeInterval?,startedAt:TimeInterval?,target:Target?,baseline:NativeBoardState?
    private var generation:UInt64?
    init(warmupSeconds:TimeInterval=2,durationSeconds:TimeInterval=20,log:@escaping(String)->Void={NSLog("%@",$0)}) {
        self.warmupSeconds=max(0,warmupSeconds);self.durationSeconds=max(0,durationSeconds);self.log=log
    }
    var active:Bool {phase=="running"}
    func step(scene:NativeBoardScene,atTime time:TimeInterval) {
        guard time.isFinite,phase=="waiting" || active else{return}
        if generation==nil {generation=scene.engine.state.generation}
        guard generation==scene.engine.state.generation else{cancel(scene:scene,reason:"generation-changed");return}
        guard scene.renderPipelineProbeAdmissionOpen else {
            if active {cancel(scene:scene,reason:"lifecycle")}else{eligibleSince=nil}
            return
        }
        if !active {
            guard let candidate=scene.renderPipelineProbeTarget() else{eligibleSince=nil;return}
            if eligibleSince==nil {eligibleSince=time}
            guard time-(eligibleSince ?? time)>=warmupSeconds else{return}
            let state=scene.engine.state
            guard scene.beginDrag(at:candidate.center),scene.renderPipelineProbeHolds(candidate) else {
                phase="cancelled";logReceipt("cancel",reason:"pickup-not-admitted",target:candidate);return
            }
            target=candidate;baseline=state;startedAt=time;phase="running"
            logReceipt("start",reason:"synthetic-not-UITouch",target:candidate)
        }
        guard let target,let start=startedAt,scene.renderPipelineProbeHolds(target),scene.engine.state==baseline else {
            cancel(scene:scene,reason:"owner-or-authority-changed");return
        }
        let elapsed=max(0,time-start)
        if elapsed>=durationSeconds {finish(scene:scene);return}
        let angle=elapsed*2*Double.pi
        scene.dispatchSourceTouchMove(to:CGPoint(x:target.center.x+target.radius*CGFloat(cos(angle)),y:target.center.y+target.radius*CGFloat(sin(angle))))
        frameCount+=1
    }
    func cancel(scene:NativeBoardScene,reason:String) {
        guard phase=="waiting" || active else{return}
        let held=target;phase="cancelled";target=nil;startedAt=nil;eligibleSince=nil
        if let held,scene.renderPipelineProbeHolds(held) {scene.cancelDrag(pointerCancelled:true)}
        logReceipt("cancel",reason:reason,target:held)
        baseline=nil
    }
    private func finish(scene:NativeBoardScene) {
        let held=target;phase="finished";target=nil;startedAt=nil
        if let held,scene.renderPipelineProbeHolds(held) {scene.cancelDrag(pointerCancelled:true)}
        logReceipt("finish",reason:scene.engine.state==baseline ? "authority-preserved":"authority-changed",target:held)
        baseline=nil
    }
    private func logReceipt(_ event:String,reason:String,target:Target?) {
        log("[CC_NATIVE_RENDER_PROBE] event=\(event) input=synthetic-scene-queue tile=\(target?.id ?? "none") generation=\(target?.generation ?? generation ?? 0) frames=\(frameCount) reason=\(reason)")
    }
}
