import Foundation

/// App-owned Source __ccBoardTransitionActive writer. A real transition caller
/// acquires after retiring the previous graph, and releases at its accepted
/// handoff/error/teardown. Reads never infer a flag from a controller's presence.
@MainActor final class NativeSourceBoardTransitionState {
    private var activeID:UUID?
    private var epoch:UInt64=0,closed=false
    var snapshot:Bool? {closed ? nil:activeID != nil}
    func begin(current:()->Bool)->Claim? {
        guard !closed,activeID==nil else{return nil}
        let captured=epoch,accepted=current()
        guard accepted,!closed,epoch==captured,activeID==nil else{return nil}
        let id=UUID();activeID=id;epoch &+= 1
        return Claim(owner:self,id:id)
    }
    private func release(_ id:UUID)->Bool {
        guard !closed,activeID==id else{return false}
        activeID=nil;epoch &+= 1;return true
    }
    func dispose(){guard !closed else{return};closed=true;activeID=nil;epoch &+= 1}
    @MainActor final class Claim {
        fileprivate let id:UUID
        private weak var owner:NativeSourceBoardTransitionState?
        fileprivate init(owner:NativeSourceBoardTransitionState,id:UUID){self.owner=owner;self.id=id}
        @discardableResult func release()->Bool {
            let captured=owner;owner=nil
            return captured?.release(id)==true
        }
        isolated deinit {release()}
    }
}
