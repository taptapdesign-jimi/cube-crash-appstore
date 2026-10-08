import Foundation

/// Reuses the existing captured app-timeout registry. No Timer, display link,
/// animation activity or pause flag. Absolute interval phase avoids drift in
/// on-time callbacks; late delivery schedules one next callback, never bursts.
/// Explicit source-phase opt-in follows measured Chrome missed-delivery phase.
/// iOS WebKit throttle/background and paused resource lifetime remain OPEN.
@MainActor final class NativeWildMeterSmokeWallDriver:NativeWildMeterSmokeWallDriving {
    private final class Interval {
        var cancelled=false
        var receipt:NativeSourceAppTimeoutOwner.Receipt?
        var next:DispatchTime
        var phase:NativeSourceHUDIntervalPhase?
        let callback:()->Void
        init(callback:@escaping()->Void,origin:DispatchTime,sourcePhase:Bool){
            self.callback=callback;next=origin + .milliseconds(100)
            if sourcePhase{phase=NativeSourceHUDIntervalPhase(originNanoseconds:origin.uptimeNanoseconds)}
        }
    }
    private let timeouts:NativeSourceAppTimeoutOwner
    private let generation:UInt64
    private var sequence:UInt64=0
    private let sourcePhaseEnabled:Bool,monotonicNow:()->DispatchTime
    // PRIVATE read-only scheduling receipt; no production observer by default.
    var onScheduledDeadline:((DispatchTime)->Void)?
    init(timeouts:NativeSourceAppTimeoutOwner,generation:UInt64,
         sourcePhaseEnabled:Bool=false,monotonicNow:@escaping()->DispatchTime={.now()}){
        self.timeouts=timeouts;self.generation=generation
        self.sourcePhaseEnabled=sourcePhaseEnabled;self.monotonicNow=monotonicNow
    }
    func start(_ delivery:@escaping()->Void)->(()->Void)? {
        sequence &+= 1;let sourceID="wild-meter-smoke-interval:\(sequence)"
        let interval=Interval(callback:delivery,origin:monotonicNow(),sourcePhase:sourcePhaseEnabled)
        schedule(interval,sourceID:sourceID)
        return {[weak timeouts] in
            guard !interval.cancelled else{return};interval.cancelled=true;interval.phase?.cancel()
            let receipt=interval.receipt;interval.receipt=nil
            if let receipt{_ = timeouts?.cancel(receipt)}
        }
    }
    private func schedule(_ interval:Interval,sourceID:String){
        guard !interval.cancelled else{return}
        interval.receipt=timeouts.schedule(sourceID:sourceID,generation:generation,delayMilliseconds:0,from:interval.next,elapsed:{[weak self,weak interval] in
            guard let self,let interval,!interval.cancelled else{return}
            interval.receipt=nil
            if self.sourcePhaseEnabled {
                // Source repeating target is determined BEFORE user callback.
                // One pending task may become overdue while that callback runs;
                // its next entry skips missed prior periods without a burst.
                let now=self.monotonicNow().uptimeNanoseconds
                guard !interval.cancelled,let next=interval.phase?.beginDelivery(atNanoseconds:now) else{return}
                interval.next=DispatchTime(uptimeNanoseconds:next)
                self.schedule(interval,sourceID:sourceID)
                guard !interval.cancelled else{return}
                interval.callback()
                return // never republish A after a callback installs C
            }
            interval.callback()
            guard !interval.cancelled else{return}
            let now=self.monotonicNow().uptimeNanoseconds
            guard !interval.cancelled else{return}
            let next=interval.next.uptimeNanoseconds+100_000_000
            interval.next=DispatchTime(uptimeNanoseconds:next>now ? next:now+100_000_000)
            self.schedule(interval,sourceID:sourceID)
        })
        onScheduledDeadline?(interval.next)
    }
}
