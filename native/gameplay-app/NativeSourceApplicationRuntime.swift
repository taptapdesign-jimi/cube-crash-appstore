import UIKit

/// One app-lived Source transport/context. This does not enable any gameplay
/// feature flag. Admission precedes context, RNG, asset or renderer work.
@MainActor final class NativeSourceApplicationRuntime {
    let context:NativeGameplaySourceContext
    let fifo:NativeSourceMicrotaskFIFO
    let tasks:NativeSourceMicrotaskAdapters
    private let transport:NativeSourceAnimationClockService.AppTransport
    private(set) var disposed=false
    var service:NativeSourceAnimationClockService {transport.service}
    static func acquire(wallMillisecondsNow:@escaping()->Double={floor(Date().timeIntervalSince1970*1000)},
                        appOriginMilliseconds:Double=CACurrentMediaTime()*1000,
                        visualRandom:@escaping()->Double={Double.random(in:0..<1)}) -> NativeSourceApplicationRuntime? {
        guard let transport=NativeSourceAnimationClockService.acquireAppTransport(wallMillisecondsNow:wallMillisecondsNow) else{return nil}
        return NativeSourceApplicationRuntime(transport:transport,appOriginMilliseconds:appOriginMilliseconds,
            visualRandom:visualRandom,sourceDateMilliseconds:wallMillisecondsNow)
    }
    private init(transport:NativeSourceAnimationClockService.AppTransport,appOriginMilliseconds:Double,
                 visualRandom:@escaping()->Double,sourceDateMilliseconds:@escaping()->Double) {
        self.transport=transport
        let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
        self.fifo=fifo;self.tasks=tasks
        transport.service.sourceMicrotaskTasks=tasks
        context=NativeGameplaySourceContext(service:transport.service,appOriginMilliseconds:appOriginMilliseconds,
            visualRandom:visualRandom,sourceDateMilliseconds:sourceDateMilliseconds,sourceMicrotaskTasks:tasks)
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        context.dispose()
        // Close reactions before Source/raw cancellation can publish stale jobs.
        fifo.dispose();transport.dispose()
    }
    isolated deinit {dispose()}
}
