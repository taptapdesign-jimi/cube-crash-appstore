import Foundation

/// One bounded selected-family decode per board route. Suspension cancels work
/// while retaining weak presentation requests for a fresh foreground attempt.
@MainActor
final class NativeFishSVGResourceLease {
    private let resourceRoot:URL
    private var resources:NativeFishSVGFallbackResources?
    private var decode:Task<NativeFishSVGFallbackResources?,Never>?,delivery:Task<Void,Never>?
    private var waiters:[UUID:(NativeFishSVGFallbackResources?)->Void]=[:]
    private var epoch:UInt64=0,suspended=false,disposed=false,attempted=false
    init(resourceRoot:URL){self.resourceRoot=resourceRoot}
    @discardableResult
    func request(_ completion:@escaping (NativeFishSVGFallbackResources?)->Void)->UUID? {
        guard !disposed else {return nil}
        if let resources {completion(resources);return nil}
        if attempted {completion(nil);return nil}
        let token=UUID();waiters[token]=completion;beginIfNeeded();return token
    }
    func cancel(_ token:UUID) {
        waiters.removeValue(forKey:token)
        if waiters.isEmpty,decode != nil {epoch+=1;decode?.cancel();decode=nil;delivery?.cancel();delivery=nil}
    }
    private func beginIfNeeded() {
        guard !disposed,!suspended,decode==nil,!waiters.isEmpty else {return}
        epoch+=1;let acceptedEpoch=epoch,root=resourceRoot
        let task=Task.detached(priority:.userInitiated){try? NativeFishSVGFallbackResources.load(resourceRoot:root)}
        decode=task
        delivery=Task { [weak self] in
            let resource=await task.value
            guard !Task.isCancelled,let self,!self.disposed,!self.suspended,self.epoch==acceptedEpoch else {return}
            self.decode=nil;self.delivery=nil;self.resources=resource;self.attempted=true
            let callbacks=self.waiters;self.waiters.removeAll()
            callbacks.values.forEach {$0(resource)}
        }
    }
    func setSuspended(_ value:Bool) {
        guard !disposed else {return};suspended=value
        if value {epoch+=1;decode?.cancel();decode=nil;delivery?.cancel();delivery=nil}
        else {beginIfNeeded()}
    }
    var decodedFrameCount:Int {resources?.frames.count ?? 0}
    var pendingRequestCount:Int {waiters.count}
    func dispose() {
        guard !disposed else {return};disposed=true;epoch+=1
        decode?.cancel();decode=nil;delivery?.cancel();delivery=nil
        waiters.removeAll();resources=nil
    }
}
