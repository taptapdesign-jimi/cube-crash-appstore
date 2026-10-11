import Foundation

/// PRIVATE Scene-owned binding to ONE app-owned FIFO. This helper owns no clock,
/// timer or resource callback. Its captured identity is retired before clearing
/// pending reactions; old cleanup cannot clear a replacement Scene binding.
@MainActor final class NativeSourceSceneMicrotaskInstallation {
    let tasks:NativeSourceMicrotaskAdapters
    private let capability:NativeSourceMeterMicrotaskCapability
    private let current:()->Bool
    private(set) var closed=false
    init?(fifo:NativeSourceMicrotaskFIFO,tasks:NativeSourceMicrotaskAdapters,
          service:NativeSourceAnimationClockService,timeouts:NativeSourceAppTimeoutOwner,current:@escaping()->Bool){
        guard let capability=NativeSourceMeterMicrotaskCapability(fifo:fifo,tasks:tasks,service:service,timeouts:timeouts,
            inputBoundaryInstalled:true,renderHandoffInstalled:true,current:current) else{return nil}
        self.tasks=tasks;self.capability=capability;self.current=current
    }
    var reactionScope:NativeSourceMicrotaskFIFO.Scope? {isCurrent ? capability.reactionScope:nil}
    var isCurrent:Bool {
        guard !closed else{return false};let value=current();return value && !closed
    }
    @discardableResult func inputTask(_ action:()->Void)->Bool {
        guard isCurrent else{return false}
        return tasks.inputTask{[self] in guard isCurrent else{return};action()}
    }
    @discardableResult func renderedHandoff(_ action:()->Void)->Bool {
        guard isCurrent else{return false}
        return tasks.renderedFrameHandoff{[self] in guard isCurrent else{return};action()}
    }
    @discardableResult func enqueue(_ action:@escaping @MainActor ()->Void)->Bool {
        guard isCurrent else{return false};return capability.enqueue{[weak self] in guard self?.isCurrent==true else{return};action()}
    }
    func dispose(){guard !closed else{return};closed=true;capability.dispose()}
    isolated deinit {dispose()}
}
