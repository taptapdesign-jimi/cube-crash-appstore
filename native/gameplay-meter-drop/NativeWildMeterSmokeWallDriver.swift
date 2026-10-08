import Foundation

/// Reuses the existing captured app-timeout registry. No Timer, display link,
/// animation activity or pause flag. Absolute interval phase avoids drift in
/// on-time callbacks; late delivery schedules one next callback, never bursts.
/// Browser setInterval hitch/coalescing beyond these tested traces remains OPEN.
@MainActor final class NativeWildMeterSmokeWallDriver:NativeWildMeterSmokeWallDriving {
    private final class Interval {
        var cancelled=false
        var receipt:NativeSourceAppTimeoutOwner.Receipt?
        var next:DispatchTime
        let callback:()->Void
        init(callback:@escaping()->Void){self.callback=callback;next = .now() + .milliseconds(100)}
    }
    private let timeouts:NativeSourceAppTimeoutOwner
    private let generation:UInt64
    private var sequence:UInt64=0
    init(timeouts:NativeSourceAppTimeoutOwner,generation:UInt64){self.timeouts=timeouts;self.generation=generation}
    func start(_ delivery:@escaping()->Void)->(()->Void)? {
        sequence &+= 1;let sourceID="wild-meter-smoke-interval:\(sequence)"
        let interval=Interval(callback:delivery)
        schedule(interval,sourceID:sourceID)
        return {[weak timeouts] in
            guard !interval.cancelled else{return};interval.cancelled=true
            let receipt=interval.receipt;interval.receipt=nil
            if let receipt{_ = timeouts?.cancel(receipt)}
        }
    }
    private func schedule(_ interval:Interval,sourceID:String){
        guard !interval.cancelled else{return}
        interval.receipt=timeouts.schedule(sourceID:sourceID,generation:generation,delayMilliseconds:0,from:interval.next,elapsed:{[weak self,weak interval] in
            guard let self,let interval,!interval.cancelled else{return}
            interval.receipt=nil;interval.callback()
            guard !interval.cancelled else{return}
            let now=DispatchTime.now().uptimeNanoseconds
            let next=interval.next.uptimeNanoseconds+100_000_000
            interval.next=DispatchTime(uptimeNanoseconds:next>now ? next:now+100_000_000)
            self.schedule(interval,sourceID:sourceID)
        })
    }
}
