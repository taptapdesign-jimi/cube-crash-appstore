import Foundation

/// PRIVATE opt-in app-owned Promise reaction queue. No timer, Dispatch async,
/// render lease or independent animation clock. Producers must wrap the actual
/// JS-equivalent task/RAF callback; arbitrary callers are refused, never deferred
/// to a guessed main-queue turn. Jobs appended while draining stay FIFO.
@MainActor final class NativeSourceMicrotaskFIFO {
    enum Boundary: String, CaseIterable, Sendable {case inputTask, appTimeoutTask, sourceAnimationFrameCallback, sourceRendererFrameHandoff}
    @MainActor final class Scope {
        fileprivate weak var owner:NativeSourceMicrotaskFIFO?
        fileprivate let id:UUID
        fileprivate var closed=false
        private let isCurrent:()->Bool
        fileprivate init(owner:NativeSourceMicrotaskFIFO,id:UUID,isCurrent:@escaping()->Bool){self.owner=owner;self.id=id;self.isCurrent=isCurrent}
        fileprivate func valid()->Bool {
            guard !closed,let owner,owner.contains(self) else{return false}
            let result=isCurrent()
            return result && !closed && owner.contains(self)
        }
        /// Promise jobs can only be created from an admitted task or reaction.
        /// false is explicit refusal: the producer must not use an async fallback.
        @discardableResult func enqueue(_ reaction:@escaping @MainActor ()->Void)->Bool {
            guard valid(),let owner else{return false};return owner.append(scope:self,reaction:reaction)
        }
        func dispose(){guard !closed else{return};closed=true;owner?.remove(self);owner=nil}
        isolated deinit {dispose()}
    }
    private final class Job {
        weak var scope:Scope?
        let scopeID:UUID
        var reaction:(@MainActor ()->Void)?
        init(scope:Scope,reaction:@escaping @MainActor ()->Void){self.scope=scope;scopeID=scope.id;self.reaction=reaction}
    }
    private var scopes:[UUID:WeakScope]=[:],jobs:[Job]=[],head=0,taskDepth=0,draining=false,closed=false
    private final class WeakScope {weak var value:Scope?;init(_ value:Scope){self.value=value}}
    var pendingCount:Int {jobs.dropFirst(head).filter{$0.reaction != nil}.count}
    var isInsideCheckpoint:Bool {draining}
    var isAcceptingJobs:Bool {!closed && (taskDepth>0 || draining)}

    /// Coverage is an integration prerequisite, not a cadence/performance flag.
    /// The meter queue requires all four actual producer hooks. Defaults refuse.
    func makeMeterScope(boundProducers:Set<Boundary> = [],isCurrent:@escaping()->Bool)->Scope? {
        guard !closed,Set(Boundary.allCases).isSubset(of:boundProducers) else{return nil}
        let id=UUID(),scope=Scope(owner:self,id:id,isCurrent:isCurrent)
        scopes[id]=WeakScope(scope)
        guard scope.valid() else{scope.dispose();return nil};return scope
    }
    fileprivate func contains(_ scope:Scope)->Bool {!closed && scopes[scope.id]?.value === scope}
    fileprivate func append(scope:Scope,reaction:@escaping @MainActor ()->Void)->Bool {
        guard isAcceptingJobs,contains(scope),scope.valid(),isAcceptingJobs,contains(scope) else{return false}
        jobs.append(Job(scope:scope,reaction:reaction));return true
    }
    fileprivate func remove(_ scope:Scope){
        if scopes[scope.id]?.value === scope{scopes.removeValue(forKey:scope.id)}
        // Clear captured callbacks now, including already-reached records. Old A
        // cannot cancel C, even when both use generation1 after a board restart.
        for job in jobs where job.scopeID==scope.id{job.reaction=nil}
        if !draining {compact()}
    }
    @discardableResult func performTask(_ boundary:Boundary,_ callback:()->Void)->Bool {
        guard !closed else{return false}
        taskDepth+=1
        defer {taskDepth-=1;if taskDepth==0 && !draining {checkpoint()}}
        callback();return true
    }
    private func checkpoint(){
        guard !closed,!draining,taskDepth==0 else{return};draining=true
        defer{draining=false;compact()}
        while !closed,head<jobs.count {
            let job=jobs[head];head+=1
            let reaction=job.reaction;job.reaction=nil // retire BEFORE external code
            guard let reaction,let scope=job.scope,scope.valid(),!closed else{continue}
            reaction()
        }
    }
    private func compact(){
        if head>0{jobs.removeFirst(head);head=0}
        jobs.removeAll{$0.reaction==nil}
        scopes=scopes.filter{$0.value.value != nil}
    }
    func dispose(){
        guard !closed else{return};closed=true
        let captured=scopes.values.compactMap(\.value);scopes.removeAll()
        // Seal every scope before dropping user captures (deinit may reenter).
        for scope in captured{scope.closed=true;scope.owner=nil}
        for job in jobs{job.reaction=nil};jobs.removeAll();head=0
    }
    isolated deinit {dispose()}
}
