import Foundation

/// app-core begin/end/getEndgameGuardState. Source labels retain Map insertion order.
/// Count ownership does not expire on a timer even after the advertised TTL.
nonisolated public struct NativeSourceEndgameGuardRegistry:Sendable {
    public struct Lease:Equatable,Sendable {public let source:String,epoch:UInt64}
    public struct Snapshot:Equatable,Sendable {public let active:Bool,count:Int,until:Double,sources:[String]}
    private var count=0,until=0.0,counts:[String:Int]=[:],order:[String]=[]
    private var sequence:UInt64=0,leases:[UInt64:String]=[:]
    public init(){}
    @discardableResult public mutating func begin(source:String,now:Double,ttlMilliseconds:Double=1500)->Lease {
        let name=source.isEmpty ? "unknown":source,integer=sourceInt32(ttlMilliseconds)
        let ttl=max(50,min(5000,integer==0 ? 1500:Int(integer)))
        if counts[name]==nil {order.append(name)}
        counts[name,default:0]+=1;count+=1;until=max(until,now+Double(ttl))
        sequence &+= 1;leases[sequence]=name;return .init(source:name,epoch:sequence)
    }
    private mutating func end(_ source:String) {
        let name=source.isEmpty ? "unknown":source,existing=counts[name] ?? 0
        if existing>1 {counts[name]=existing-1} else {counts.removeValue(forKey:name);order.removeAll{$0==name}}
        if count>0 {count-=1};if count==0 {until=0}
    }
    /// Once captured release is the Native transport protection around literal end.
    @discardableResult public mutating func release(_ lease:Lease)->Bool {
        guard leases[lease.epoch]==lease.source else{return false}
        leases.removeValue(forKey:lease.epoch);end(lease.source);return true
    }
    public func snapshot(now:Double)->Snapshot {.init(active:count>0 || until>now,count:count,until:until,sources:order)}
}
