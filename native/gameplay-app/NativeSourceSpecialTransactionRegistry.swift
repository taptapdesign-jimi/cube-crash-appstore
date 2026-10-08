import Foundation

/// Literal SpecialDiceTransactionOwner. An active visual-tail still owns the
/// Source board transaction; lazy Date expiry is separate from a motion receipt.
nonisolated public struct NativeSourceSpecialTransactionRegistry:Sendable {
    public enum Kind:String,Sendable {case star,juice,magnet,tnt}
    public enum Phase:String,Sendable {case mutating,visualTail="visual-tail"}
    public struct Snapshot:Equatable,Sendable {
        public let token:UInt64,kind:Kind,startedAt:Double,expiresAt:Double
        public var phase:Phase,boardRevisionAtCommit:Double?
    }
    private var nextToken:UInt64=1,active:Snapshot?
    public let ttlMilliseconds:Double
    public init(ttlMilliseconds:Double=15000) {self.ttlMilliseconds=ttlMilliseconds}
    private mutating func prune(now:Double){if let owner=active,owner.expiresAt<=now {active=nil}}
    public mutating func claim(kind:Kind,now:Double)->UInt64? {
        prune(now:now);guard active==nil else{return nil}
        let token=nextToken;nextToken &+= 1
        active = .init(token:token,kind:kind,startedAt:now,expiresAt:now+ttlMilliseconds,phase:.mutating,boardRevisionAtCommit:nil);return token
    }
    public mutating func owns(_ token:UInt64?,now:Double)->Bool {prune(now:now);return token != nil && active?.token==token}
    public mutating func snapshot(now:Double)->Snapshot? {prune(now:now);return active}
    @discardableResult public mutating func markBoardCommitted(token:UInt64?,boardRevision:Double,now:Double)->Bool {
        guard owns(token,now:now),active != nil else{return false};active!.phase = .visualTail;active!.boardRevisionAtCommit=boardRevision;return true
    }
    public mutating func isVisualTailCurrent(boardRevision:Double,now:Double)->Bool {prune(now:now);return active?.phase == .visualTail && active?.boardRevisionAtCommit==boardRevision}
    @discardableResult public mutating func release(_ token:UInt64?,now:Double)->Bool {guard owns(token,now:now) else{return false};active=nil;return true}
    public mutating func reset(){active=nil}
}
