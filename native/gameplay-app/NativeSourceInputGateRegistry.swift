import Foundation

/// Original input-gate.ts Date registry. No clock or implicit timer is installed.
/// APP owner must transport only the explicit AnimationTimer receipt on wall time.
nonisolated public struct NativeSourceInputGateRegistry:Sendable {
    public enum Scope:String,Sendable {case all,wildOnly="wild-only"}
    public struct Lease:Equatable,Sendable {public let reason:String;public let epoch:UInt64}
    public struct Lock:Equatable,Sendable {public let expiresAt:Double;public let scope:Scope}
    public struct AnimationTimer:Equatable,Sendable {public let lease:Lease;public let afterMilliseconds:Double;public let rebindWildVisualTail:Bool}
    private var locks:[String:Lock]=[:],order:[String]=[],epochs:[String:UInt64]=[:]
    private var timers:[String:AnimationTimer]=[:],sequence:UInt64=0
    public init(){}
    private mutating func remove(_ reason:String){locks.removeValue(forKey:reason);epochs.removeValue(forKey:reason);order.removeAll{$0==reason}}
    private mutating func prune(now:Double) {
        for reason in order where !(locks[reason]?.expiresAt.isFinite ?? false) || (locks[reason]?.expiresAt ?? 0)<=now {remove(reason)}
    }
    private var sourceOrder:[String] {
        let numeric=order.compactMap{key->(String,UInt32)? in guard let v=UInt32(key),v<UInt32.max,String(v)==key else{return nil};return(key,v)}.sorted{$0.1<$1.1}.map(\.0)
        let set=Set(numeric);return numeric+order.filter{!set.contains($0)}
    }
    /// Cancellation receipt allows real transport to stop exactly the old timer.
    public func timer(for reason:String)->AnimationTimer? {timers[reason]}
    @discardableResult public mutating func set(_ reason:String,active:Bool,now:Double,ttlMilliseconds:Double?=nil,scope:Scope = .all)->Lease? {
        timers.removeValue(forKey:reason)
        if active {
            sequence &+= 1;let epoch=sequence
            let supplied=ttlMilliseconds ?? 5200,ttl=supplied.isNaN ? Double.nan:max(250,supplied)
            if locks[reason]==nil {order.append(reason)}
            locks[reason] = .init(expiresAt:now+ttl,scope:scope);epochs[reason]=epoch
        } else {remove(reason)}
        prune(now:now)
        return epochs[reason].map{Lease(reason:reason,epoch:$0)}
    }
    /// Captured native completion cannot clear a replacement same-reason lock.
    @discardableResult public mutating func release(_ lease:Lease,now:Double)->Bool {
        guard epochs[lease.reason]==lease.epoch else{return false}
        set(lease.reason,active:false,now:now);return true
    }
    @discardableResult public mutating func startAnimation(_ reason:String,totalDurationMilliseconds:Double,now:Double,releaseAtRatio:Double?=nil,scope:Scope = .all)->AnimationTimer {
        let duration=max(300,Double(sourceInt32(totalDurationMilliseconds)))
        let value=releaseAtRatio ?? 0.7,ratio=value.isNaN ? Double.nan:min(0.95,max(0.2,value))
        let rounded=ratio.isNaN ? Double.nan:floor(duration*ratio+0.5)
        let after=rounded.isNaN ? Double.nan:max(220,rounded)
        let lease=set(reason,active:true,now:now,ttlMilliseconds:duration,scope:scope)!
        let timer=AnimationTimer(lease:lease,afterMilliseconds:after,rebindWildVisualTail:scope == .wildOnly)
        timers[reason]=timer;return timer
    }
    /// Return true exactly when original timer requests real Wild visual-tail rebind.
    /// Lazy TTL prune does not cancel a still-registered wall timer in the Source.
    public mutating func fire(_ timer:AnimationTimer,now:Double)->Bool? {
        guard timers[timer.lease.reason]==timer else{return nil}
        set(timer.lease.reason,active:false,now:now);return timer.rebindWildVisualTail
    }
    public mutating func clear(prefix:String?=nil,now:Double) {
        // Original iterates current locks only, not orphaned timers after lazy prune.
        for reason in sourceOrder where prefix==nil || reason.hasPrefix(prefix!) {timers.removeValue(forKey:reason);remove(reason)}
        prune(now:now)
    }
    public mutating func reasons(isWild:Bool,now:Double)->[String] {
        prune(now:now);return sourceOrder.filter{locks[$0]!.scope == .all || isWild}
    }
    public mutating func snapshot(now:Double)->[(String,Lock)] {prune(now:now);return sourceOrder.map{($0,locks[$0]!)}}
    public mutating func legacyWildBlocked(now:Double)->Bool {prune(now:now);return locks.values.contains{$0.scope == .wildOnly}}
}

/// Literal JavaScript ToInt32 used by both Source duration and guard TTL expressions.
nonisolated func sourceInt32(_ value:Double)->Int32 {
    guard value.isFinite,value != 0 else{return 0}
    let modulo=value.rounded(.towardZero).truncatingRemainder(dividingBy:4294967296)
    let positive=modulo<0 ? modulo+4294967296:modulo
    return Int32(truncatingIfNeeded:UInt32(positive))
}
