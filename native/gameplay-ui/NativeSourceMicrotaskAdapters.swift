import Foundation

/// Explicit producer adapters, not a synthetic RunLoop observer. The app passes
/// its one FIFO and existing finite timeout owner. inputTask wraps the WHOLE
/// touch/event task. frameCallback wraps ONE literal RAF callback, not a whole
/// displaylink batch or one GSAP child root. Optional installation defaults off.
@MainActor final class NativeSourceMicrotaskAdapters {
    private let fifo:NativeSourceMicrotaskFIFO
    init(fifo:NativeSourceMicrotaskFIFO){self.fifo=fifo}
    func isBound(to owner:NativeSourceMicrotaskFIFO)->Bool{fifo === owner}
    @discardableResult func inputTask(_ action:()->Void)->Bool{fifo.performTask(.inputTask,action)}
    func frameCallback(_ action:@escaping()->Void)->()->Void {
        return{[fifo] in _=fifo.performTask(.sourceAnimationFrameCallback,action)}
    }
    @discardableResult func renderedFrameHandoff(_ action:()->Void)->Bool{fifo.performTask(.sourceRendererFrameHandoff,action)}
    func timeoutCallback(_ action:@escaping()->Void)->()->Void {
        return{[fifo] in _=fifo.performTask(.appTimeoutTask,action)}
    }
    @discardableResult func after(timeouts:NativeSourceAppTimeoutOwner,sourceID:String,generation:UInt64,delayMilliseconds:Int,from deadline:DispatchTime = .now(),action:@escaping()->Void,cancelled:(()->Void)?=nil)->NativeSourceAppTimeoutOwner.Receipt {
        timeouts.schedule(sourceID:sourceID,generation:generation,delayMilliseconds:delayMilliseconds,from:deadline,elapsed:timeoutCallback(action),cancelled:cancelled)
    }
}
