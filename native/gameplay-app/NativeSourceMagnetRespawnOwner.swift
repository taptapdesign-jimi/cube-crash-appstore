import Foundation

/// app-merge's normal captured spawnPromises. Deadlines belong to the genuine
/// app-wall owner; the actual app-spawn Source timeline supplies arrival. Each
/// arrival then awaits wall50 and a Promise reaction before verifying its cell.
/// No timeout guesses the 560ms animation and no new transport is created.
@MainActor final class NativeSourceMagnetRespawnOwner {
    enum Completion:Equatable {case completed(successes:Int),cancelled,unavailable}
    enum OpenResult {case started,skipped,unavailable}
    struct Hooks {
        let current:()->Bool
        let schedule:(Int,@escaping()->Void,@escaping()->Void)->(()->Void)?
        let enqueue:(@escaping()->Void)->Bool
        /// Core-owned captured slot. Completion means actual openAtCell Promise
        /// settlement, not logical value assignment/decorative frame inference.
        let open:(Int,@escaping(Bool)->Void)->OpenResult
        let verify:(Int)->Bool
        let finished:(Completion)->Void
    }
    private let hooks:Hooks
    private var count=0,successful=0,pending:Set<Int>=[],closed=false,begun=false
    private var cancels:[UInt64:()->Void]=[:],nextSchedule:UInt64=0
    init(hooks:Hooks){self.hooks=hooks}
    var active:Bool{begun && !closed}
    private func current()->Bool {
        guard !closed else{return false};let accepted=hooks.current()
        return accepted && !closed
    }
    @discardableResult func start(count:Int)->Bool {
        guard !begun,current(),count>=0 else{return false}
        begun=true;self.count=count;pending=Set(0..<count)
        if count==0 {return reaction{[weak self] in self?.finish(.completed(successes:0))}}
        return wait(50){[weak self] in self?.launch()}
    }
    private func wait(_ milliseconds:Int,_ continuation:@escaping()->Void)->Bool {
        guard current() else{finish(.cancelled);return false}
        nextSchedule &+= 1;let id=nextSchedule;var delivered=false
        let cancel=hooks.schedule(milliseconds,{[weak self] in
            delivered=true
            guard let self,self.current() else{return}
            self.cancels.removeValue(forKey:id)
            _=self.reaction(continuation)
        },{[weak self] in self?.finish(.cancelled)})
        guard current(),let cancel else{cancel?();finish(.unavailable);return false}
        // A genuine producer may synchronously deliver zero. Do not retain an
        // already-delivered handle, and seal before invoking cancellation.
        if !delivered {cancels[id]=cancel}
        return true
    }
    @discardableResult private func reaction(_ callback:@escaping()->Void)->Bool {
        guard current() else{finish(.cancelled);return false}
        let accepted=hooks.enqueue{[weak self] in guard let self,self.current() else{return};callback()}
        guard accepted,current() else{finish(.unavailable);return false};return true
    }
    private func launch(){
        guard current() else{finish(.cancelled);return}
        // Every zero-delay wait is still a real app-wall Promise, like literal
        // waitForMagnet(0); no synchronous fabricated open is substituted.
        for index in 0..<count {
            guard current() else{return}
            _=wait(index*150){[weak self] in self?.open(index)}
        }
    }
    private func open(_ index:Int){
        guard current(),pending.contains(index) else{return}
        var settled=false
        let result=hooks.open(index,{[weak self] success in
            guard !settled else{return};settled=true
            guard let self,self.current(),self.pending.contains(index) else{return}
            guard success else{self.finish(.cancelled);return}
            // Awaited animation completion reaction precedes starting this
            // wall50. Source verifies current grid/cell, not captured model.
            _=self.reaction{[weak self] in
                guard let self else{return}
                _=self.wait(50){[weak self] in self?.verify(index)}
            }
        })
        guard current() else{return}
        switch result {
        case .started:break
        case .skipped:if !settled {settled=true;settle(index,success:false)}
        case .unavailable:finish(.unavailable)
        }
    }
    private func verify(_ index:Int){
        guard current(),pending.contains(index) else{return}
        let success=hooks.verify(index)
        guard current(),pending.contains(index) else{return}
        settle(index,success:success)
    }
    private func settle(_ index:Int,success:Bool){
        guard current(),pending.remove(index) != nil else{return}
        if success {successful+=1}
        // Promise.all continuation occurs after each branch reaction; it must
        // not run inside the actual visual/contact callback.
        if pending.isEmpty {_=reaction{[weak self] in guard let self else{return};self.finish(.completed(successes:self.successful))}}
    }
    private func finish(_ completion:Completion){
        guard !closed else{return};closed=true
        let captured=Array(cancels.values);cancels=[:];pending=[]
        captured.forEach{$0()}
        hooks.finished(completion)
    }
    func retire(){finish(.cancelled)}
    isolated deinit {retire()}
}
