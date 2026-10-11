import Foundation

/// App-lived all-live Special idle registry. Original accepted registry order,
/// captured suspension identities and one borrowed cadence receipt; no clock.
@MainActor final class NativeSourceSpecialIdleRegistry {
    struct Owner {
        let start:()->Void,stop:()->Void,pause:()->Void,resume:()->Void
    }
    struct Snapshot:Equatable {
        let registered,running,paused,pending:Int
        let suspended,settledCadenceOwned:Bool
    }
    private enum State {case pending,running,paused}
    private final class Registration {
        weak var key:AnyObject?
        let identity:ObjectIdentifier
        var owner:Owner?,state=State.pending
        init(key:AnyObject,owner:Owner){self.key=key;identity=ObjectIdentifier(key);self.owner=owner}
    }
    private var registrations:[ObjectIdentifier:Registration]=[:],order:[Registration]=[]
    private var suspensions:Set<UUID>=[]
    private var releaseCadence:(()->Void)?
    private let acquireSettledCadence:(()->(()->Void)?)?
    private var disposed=false,reconciling=false,reconcileAgain=false,acquiringCadence=false
    init(acquireSettledCadence:(()->(()->Void)?)?=nil){self.acquireSettledCadence=acquireSettledCadence}
    func register(_ key:AnyObject,owner:Owner){
        guard !disposed else{return};let id=ObjectIdentifier(key)
        if let existing=registrations[id],existing.key === key {
            if existing.state == .pending {existing.owner=owner};return
        }
        let record=Registration(key:key,owner:owner)
        registrations[id]=record;order.append(record);reconcile()
    }
    func has(_ key:AnyObject)->Bool {registrations[ObjectIdentifier(key)]?.key === key}
    func hasStarted(_ key:AnyObject)->Bool {
        guard !disposed,let record=registrations[ObjectIdentifier(key)],record.key === key else{return false}
        return record.state != .pending
    }
    func retire(_ key:AnyObject){
        let id=ObjectIdentifier(key)
        guard let record=registrations[id],record.key === key else{return}
        registrations.removeValue(forKey:id)
        let owner=record.owner;record.owner=nil
        if record.state != .pending {owner?.stop()}
        reconcileCadence()
    }
    /// Release captures a token, never "the currently active suspension".
    func acquire(reason:String)->(()->Void)? {
        guard !disposed else{return nil}
        let token=UUID();suspensions.insert(token)
        if suspensions.count==1 {reconcile()}
        var released=false
        return {[weak self] in
            guard !released else{return};released=true
            guard let self,self.suspensions.remove(token) != nil else{return}
            if self.suspensions.isEmpty,!self.disposed {self.reconcile()}
        }
    }
    var snapshot:Snapshot {
        let values=Array(registrations.values)
        return .init(registered:values.count,running:values.filter{$0.state == .running}.count,
            paused:values.filter{$0.state == .paused}.count,pending:values.filter{$0.state == .pending}.count,
            suspended:!suspensions.isEmpty,settledCadenceOwned:releaseCadence != nil)
    }
    private func isCurrent(_ record:Registration)->Bool {
        !disposed && record.key != nil && registrations[record.identity] === record
    }
    private func reconcile(){
        guard !disposed else{return}
        if reconciling {reconcileAgain=true;return}
        reconciling=true
        defer {reconciling=false}
        repeat {
        reconcileAgain=false
        if suspensions.isEmpty {acquireCadence()}
        // Source Map iteration is live: appended owners are visited in order.
        var index=0
        while index<order.count,!disposed {
            let record=order[index];index+=1
            guard isCurrent(record),let owner=record.owner else{continue}
            let wasSuspended = !suspensions.isEmpty
            if wasSuspended {
                guard record.state == .running else{continue}
                owner.pause();if isCurrent(record){record.state = .paused}
            } else if record.state == .pending {
                owner.start();if isCurrent(record){record.state = .running}
            } else if record.state == .paused {
                owner.resume();if isCurrent(record){record.state = .running}
            }
            if wasSuspended != !suspensions.isEmpty {reconcileAgain=true}
        }
        order.removeAll{!isCurrent($0)}
        reconcileCadence()
        } while reconcileAgain && !disposed
    }
    private func reconcileCadence(){
        if !disposed,suspensions.isEmpty,!registrations.isEmpty {acquireCadence()}
        else {releaseOwnedCadence()}
    }
    private func acquireCadence(){
        guard !disposed,!acquiringCadence,suspensions.isEmpty,releaseCadence==nil,!registrations.isEmpty else{return}
        acquiringCadence=true
        let captured=acquireSettledCadence?()
        acquiringCadence=false
        guard !disposed,suspensions.isEmpty,!registrations.isEmpty,releaseCadence==nil else {captured?();return}
        releaseCadence=captured
    }
    private func releaseOwnedCadence(){let release=releaseCadence;releaseCadence=nil;release?()}
    func dispose(){
        guard !disposed else{return};disposed=true
        let captured=order;registrations.removeAll();order=[];suspensions=[]
        for record in captured {let owner=record.owner;record.owner=nil;if record.state != .pending {owner?.stop()}}
        releaseOwnedCadence()
    }
    isolated deinit {dispose()}
}
