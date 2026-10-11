import Foundation

/// Literal board.setValue face RAF, independent nested-pips RAF, captured final
/// child-hide repeats and deferred Star idle stop. This owner borrows the APP
/// RAF transport; it has no elapsed clock or activity label.
@MainActor final class NativeSourceWildDestinationFaceSequence {
    typealias Request=(String,@escaping()->Void,@escaping()->Void)->(()->Void)?
    struct Hooks {
        let current:()->Bool
        let firstFace:()->Bool
        let immediateStack:()->Bool
        let nestedPipsCheck:()->Void
        let hideFinal:()->Void
        let stopIdle:()->Void
    }
    private let request:Request,hooks:Hooks
    private var cancellations:[UInt64:()->Void]=[:]
    private var sequence:UInt64=0,started=false,disposed=false
    private(set) var firstFaceDelivered=false
    var pendingCount:Int {cancellations.count}
    init(request:@escaping Request,hooks:Hooks){self.request=request;self.hooks=hooks}
    private func current()->Bool {
        guard !disposed else{return false}
        let result=hooks.current();return result && !disposed
    }
    @discardableResult func start(final:Bool,deferIdleStop:Bool)->Bool {
        guard !started,current() else{return false};started=true
        // Literal clearWildState skips synchronous stop only for core Star.
        if !deferIdleStop {hooks.stopIdle();guard current() else{return false}}
        guard enqueue("face",{[weak self] in
            guard let self,self.current() else{return}
            let painted=self.hooks.firstFace()
            guard painted,self.current() else{return}
            self.firstFaceDelivered=true
        }),enqueue("pips-outer",{[weak self] in
            guard let self,self.current() else{return}
            _=self.enqueue("pips-inner",{[weak self] in
                guard let self,self.current() else{return};self.hooks.nestedPipsCheck()
            })
        }),current() else{dispose();return false}
        guard hooks.immediateStack(),current() else{dispose();return false}
        if final {
            hooks.hideFinal();guard current() else{dispose();return false}
            guard enqueue("final-hide",{[weak self] in
                guard let self,self.current() else{return};self.hooks.hideFinal()
            }),enqueue("final-hide-outer",{[weak self] in
                guard let self,self.current() else{return}
                _=self.enqueue("final-hide-inner",{[weak self] in
                    guard let self,self.current() else{return};self.hooks.hideFinal()
                })
            }),current() else{dispose();return false}
        }
        if deferIdleStop {
            guard enqueue("star-stop-idle",{[weak self] in
                guard let self,self.current() else{return};self.hooks.stopIdle()
            }),current() else{dispose();return false}
        }
        return current()
    }
    private func enqueue(_ name:String,_ callback:@escaping()->Void)->Bool {
        guard current() else{return false};sequence &+= 1;let id=sequence
        // A queued marker permits captured cancellation/retirement during the
        // external request without late returned leases repopulating teardown.
        cancellations[id]={}
        let cancel=request(name,{[weak self] in
            guard let self,self.cancellations.removeValue(forKey:id) != nil,self.current() else{return}
            callback()
        },{[weak self] in self?.cancellations.removeValue(forKey:id)})
        guard let cancel else{cancellations.removeValue(forKey:id);return false}
        guard !disposed,cancellations[id] != nil,current(),!disposed,cancellations[id] != nil else{cancel();return false}
        cancellations[id]=cancel;return true
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        let old=Array(cancellations.values);cancellations.removeAll()
        for cancel in old {cancel()}
    }
}
