#if canImport(UIKit)
import Foundation

/// PRIVATE concrete meter-queue capability. Defaults REFUSE because the real
/// input hook is not yet bound in Scene. Installation must be app-lived, shared
/// with the same existing timeout/Source RAF producers, before enabling Source
/// meter queue. An installed FIFO alone is not sufficient for admission.
@MainActor final class NativeSourceMeterMicrotaskCapability {
    private let capture:NativeSourceMicrotaskFIFO.Scope
    init?(fifo:NativeSourceMicrotaskFIFO,tasks:NativeSourceMicrotaskAdapters,
          service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,
          inputBoundaryInstalled:Bool=false,renderHandoffInstalled:Bool=false,current:@escaping()->Bool) {
        guard inputBoundaryInstalled,renderHandoffInstalled,tasks.isBound(to:fifo),service.sourceMicrotaskRAFBoundaryInstalled,
              service.sourceMicrotaskTasks === tasks,timeouts.sourceMicrotaskTasks === tasks,
              let capture=fifo.makeMeterScope(boundProducers:Set(NativeSourceMicrotaskFIFO.Boundary.allCases),isCurrent:{[weak service,weak timeouts,weak tasks] in
                  guard let service,let timeouts,let tasks,service.sourceMicrotaskRAFBoundaryInstalled,service.sourceMicrotaskTasks === tasks,timeouts.sourceMicrotaskTasks === tasks else{return false}
                  let result=current()
                  return result && service.sourceMicrotaskRAFBoundaryInstalled && service.sourceMicrotaskTasks === tasks && timeouts.sourceMicrotaskTasks === tasks
              }) else{return nil}
        self.capture=capture
    }
    /// Hook adapters must report false as a missing/retired producer fault;
    /// never substitute DispatchQueue.main.async to fabricate Source ordering.
    @discardableResult func enqueue(_ reaction:@escaping @MainActor ()->Void)->Bool {capture.enqueue(reaction)}
    func dispose(){capture.dispose()}
    isolated deinit {dispose()}
}
#endif
