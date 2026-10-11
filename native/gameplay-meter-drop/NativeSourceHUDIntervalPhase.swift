import Foundation

/// PRIVATE value-only proposal. BEFORE invoking the delivered callback, obtain
/// the next repeating deadline in the original monotonic phase. If that callback
/// blocks across it, one already-pending timeout may run on the next event-loop
/// turn. Skip prior periods at that next callback entry, not at callback exit.
/// No recurring scheduler/Timer/clock/activity or resource policy is installed.
struct NativeSourceHUDIntervalPhase {
    private(set) var pendingDeadlineNanoseconds:UInt64
    private(set) var closed=false
    static let periodNanoseconds:UInt64=100_000_000
    init(originNanoseconds:UInt64){pendingDeadlineNanoseconds=originNanoseconds+Self.periodNanoseconds}
    mutating func beginDelivery(atNanoseconds now:UInt64)->UInt64? {
        guard !closed else{return nil}
        var next=pendingDeadlineNanoseconds+Self.periodNanoseconds
        if next<=now {next += ((now-next)/Self.periodNanoseconds+1)*Self.periodNanoseconds}
        pendingDeadlineNanoseconds=next
        return next
    }
    mutating func cancel(){closed=true}
}
