import Foundation

/// One bounded selected-family decode per board route. Suspension cancels work
/// while retaining weak presentation requests for a fresh foreground attempt.
@MainActor
final class NativeFishSVGResourceLease {
    private let resourceRoot:URL
    private let measureBodyBounds:Bool
    private let load:@Sendable(URL,Bool)throws->NativeFishSVGFallbackResources
    private var resources:NativeFishSVGFallbackResources?
    private var decode:Task<NativeFishSVGFallbackResources?,Never>?,delivery:Task<Void,Never>?
    private var waiters:[UUID:(NativeFishSVGFallbackResources?)->Void]=[:]
    private var epoch:UInt64=0,suspended=false,disposed=false,attempted=false
    private var decodeID:UUID?
    init(resourceRoot:URL,measureBodyBounds:Bool=false,
         load:@escaping @Sendable(URL,Bool)throws->NativeFishSVGFallbackResources = {try NativeFishSVGFallbackResources.load(resourceRoot:$0,measureBodyBounds:$1)}) {
        self.resourceRoot=resourceRoot;self.measureBodyBounds=measureBodyBounds;self.load=load
    }
    @discardableResult
    func request(_ completion:@escaping (NativeFishSVGFallbackResources?)->Void)->UUID? {
        guard !disposed else {return nil}
        if let resources {completion(resources);return nil}
        if attempted {completion(nil);return nil}
        let token=UUID();waiters[token]=completion;beginIfNeeded();return token
    }
    func cancel(_ token:UUID) {
        waiters.removeValue(forKey:token)
        if waiters.isEmpty,decode != nil {epoch+=1;decode?.cancel()}
    }
    private func beginIfNeeded() {
        guard !disposed,!suspended,decode==nil,!waiters.isEmpty else {return}
        epoch+=1;let acceptedEpoch=epoch,root=resourceRoot,measureBounds=measureBodyBounds,id=UUID()
        let loader=load
        let task=Task.detached(priority:.userInitiated){try? loader(root,measureBounds)}
        decode=task;decodeID=id
        delivery=Task { [weak self] in
            let resource=await task.value
            guard let self,self.decodeID==id else{return}
            self.decode=nil;self.delivery=nil;self.decodeID=nil
            guard !self.disposed else{return}
            guard !Task.isCancelled,!task.isCancelled,!self.suspended,self.epoch==acceptedEpoch else {
                self.beginIfNeeded();return
            }
            self.resources=resource;self.attempted=true
            let callbacks=self.waiters;self.waiters.removeAll()
            callbacks.values.forEach {$0(resource)}
        }
    }
    func setSuspended(_ value:Bool) {
        guard !disposed else {return};suspended=value
        // Keep the cancelled worker's slot until it really drains. Rapid
        // background/foreground must not overlap full-strip decodes.
        if value {epoch+=1;decode?.cancel()}
        else {beginIfNeeded()}
    }
    var decodedFrameCount:Int {resources?.frames.count ?? 0}
    var pendingRequestCount:Int {waiters.count}
    func dispose() {
        guard !disposed else {return};disposed=true;epoch+=1
        decode?.cancel();decode=nil;decodeID=nil;delivery?.cancel();delivery=nil
        waiters.removeAll();resources=nil
    }
}
