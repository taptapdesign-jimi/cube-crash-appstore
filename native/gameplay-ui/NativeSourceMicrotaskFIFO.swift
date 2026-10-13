import Foundation

/// PRIVATE opt-in app-owned Promise reaction queue. No timer, Dispatch async,
/// render lease or independent animation clock. Producers must wrap the actual
/// JS-equivalent task/RAF callback; arbitrary callers are refused, never deferred
/// to a guessed main-queue turn. Jobs appended while draining stay FIFO.
@MainActor final class NativeSourceMicrotaskFIFO {
    struct CheckpointDiagnostics {
        var validationMilliseconds=0.0,reactionMilliseconds=0.0,compactMilliseconds=0.0
        var jobs=0,slowestReactionMilliseconds=0.0,slowestReactionOwner="none"
    }
    var diagnosticMillisecondsNow:(()->Double)?
    var onDiagnosticCheckpoint:((CheckpointDiagnostics)->Void)?
    private var diagnosticOwner:UUID?
    var diagnosticsEnabled:Bool {diagnosticMillisecondsNow != nil}
    func installDiagnostics(owner:UUID,clock:@escaping()->Double,report:@escaping(CheckpointDiagnostics)->Void){
        guard !closed else{return};diagnosticOwner=owner;diagnosticMillisecondsNow=clock;onDiagnosticCheckpoint=report
    }
    func removeDiagnostics(owner:UUID){
        guard diagnosticOwner==owner else{return};diagnosticOwner=nil;diagnosticMillisecondsNow=nil;onDiagnosticCheckpoint=nil
    }
    enum Boundary: String, CaseIterable, Sendable {case inputTask, appTimeoutTask, sourceAnimationFrameCallback, sourceRendererFrameHandoff, sourceAssetCompletionTask, nativeLayoutTask, nativeRenderActionTask}
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
        @discardableResult func enqueue(owner label:String?=nil,file:StaticString=#fileID,line:UInt=#line,_ reaction:@escaping @MainActor ()->Void)->Bool {
            guard valid(),let owner else{return false};return owner.append(scope:self,label:owner.diagnosticsEnabled ? (label ?? "\(file):\(line)"):"",reaction:reaction)
        }
        func isBound(to fifo:NativeSourceMicrotaskFIFO)->Bool {!closed && owner === fifo && fifo.contains(self)}
        var admissionOpen:Bool {valid()}
        var diagnosticsEnabled:Bool {owner?.diagnosticsEnabled==true}
        func dispose(){guard !closed else{return};closed=true;owner?.remove(self);owner=nil}
        isolated deinit {dispose()}
    }
    private final class Job {
        weak var scope:Scope?
        let scopeID:UUID
        let diagnosticOwner:String
        var reaction:(@MainActor ()->Void)?
        init(scope:Scope,label:String,reaction:@escaping @MainActor ()->Void){self.scope=scope;scopeID=scope.id;diagnosticOwner=label;self.reaction=reaction}
    }
    private var scopes:[UUID:WeakScope]=[:],jobs:[Job]=[],head=0,taskDepth=0,draining=false,closed=false
    private final class WeakScope {weak var value:Scope?;init(_ value:Scope){self.value=value}}
    var pendingCount:Int {jobs.dropFirst(head).filter{$0.reaction != nil}.count}
    var isInsideCheckpoint:Bool {draining}
    var isAcceptingJobs:Bool {!closed && (taskDepth>0 || draining)}

    static let meterBoundaries:Set<Boundary>=[.inputTask,.appTimeoutTask,.sourceAnimationFrameCallback,.sourceRendererFrameHandoff]

    /// Explicit actual asset completion producer, separate from meter coverage.
    func makeAssetScope(boundProducer:Boundary?,isCurrent:@escaping()->Bool)->Scope? {
        guard !closed,boundProducer == .sourceAssetCompletionTask else{return nil}
        let id=UUID(),scope=Scope(owner:self,id:id,isCurrent:isCurrent)
        scopes[id]=WeakScope(scope)
        guard scope.valid() else{scope.dispose();return nil};return scope
    }

    /// Coverage is an integration prerequisite, not a cadence/performance flag.
    /// The meter queue requires all four actual producer hooks. Defaults refuse.
    func makeMeterScope(boundProducers:Set<Boundary> = [],isCurrent:@escaping()->Bool)->Scope? {
        guard !closed,Self.meterBoundaries.isSubset(of:boundProducers) else{return nil}
        let id=UUID(),scope=Scope(owner:self,id:id,isCurrent:isCurrent)
        scopes[id]=WeakScope(scope)
        guard scope.valid() else{scope.dispose();return nil};return scope
    }
    fileprivate func contains(_ scope:Scope)->Bool {!closed && scopes[scope.id]?.value === scope}
    fileprivate func append(scope:Scope,label:String,reaction:@escaping @MainActor ()->Void)->Bool {
        guard isAcceptingJobs,contains(scope),scope.valid(),isAcceptingJobs,contains(scope) else{return false}
        jobs.append(Job(scope:scope,label:label,reaction:reaction));return true
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
        // Borrow one captured diagnostic owner/clock for this exact checkpoint.
        // External authority checks/reactions may replace it; old work must
        // never be measured with the new clock or reported to the new service.
        let diagnosticClock=diagnosticMillisecondsNow,capturedDiagnosticOwner=diagnosticOwner,capturedReport=onDiagnosticCheckpoint
        var diagnostics=CheckpointDiagnostics()
        defer{
            draining=false
            let start=diagnosticClock?();compact()
            if let start,let clock=diagnosticClock {
                diagnostics.compactMilliseconds=max(0,clock()-start)
                if diagnosticOwner==capturedDiagnosticOwner,diagnosticMillisecondsNow != nil {capturedReport?(diagnostics)}
            }
        }
        while !closed,head<jobs.count {
            let job=jobs[head];head+=1
            let reaction=job.reaction,scope=job.scope;job.reaction=nil // retire BEFORE external code
            let start=diagnosticClock?()
            let admitted:Bool
            if reaction != nil,let scope {admitted=scope.valid() && !closed}
            else {admitted=false}
            if let start,let clock=diagnosticClock {diagnostics.validationMilliseconds+=max(0,clock()-start);diagnostics.jobs+=1}
            guard admitted,let reaction else{continue}
            let reactionStart=diagnosticClock?();withExtendedLifetime(scope){reaction()}
            if let reactionStart,let clock=diagnosticClock {
                let duration=max(0,clock()-reactionStart);diagnostics.reactionMilliseconds+=duration
                if duration>diagnostics.slowestReactionMilliseconds {
                    diagnostics.slowestReactionMilliseconds=duration
                    diagnostics.slowestReactionOwner=String(job.diagnosticOwner.map{$0.isWhitespace ? "_":$0}.prefix(120))
                }
            }
        }
    }
    private func compact(){
        if head>0{jobs.removeFirst(head);head=0}
        jobs.removeAll{$0.reaction==nil}
        scopes=scopes.filter{$0.value.value != nil}
    }
    func dispose(){
        guard !closed else{return};closed=true
        diagnosticOwner=nil;diagnosticMillisecondsNow=nil;onDiagnosticCheckpoint=nil
        let captured=scopes.values.compactMap(\.value);scopes.removeAll()
        // Seal every scope before dropping user captures (deinit may reenter).
        for scope in captured{scope.closed=true;scope.owner=nil}
        for job in jobs{job.reaction=nil};jobs.removeAll();head=0
    }
    isolated deinit {dispose()}
}
