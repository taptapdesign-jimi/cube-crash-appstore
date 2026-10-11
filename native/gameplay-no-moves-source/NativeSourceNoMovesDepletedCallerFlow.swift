import Foundation
import StackToSixGameplay

/// Literal two caller coroutines. Uses Scene's existing app wall timeout owner;
/// no clock, no generic resolver event, no automatic timer-based capability.
@MainActor final class NativeSourceNoMovesDepletedCallerFlow {
    struct FreshRequest {
        let receipt:NativeSourceNoMovesCallerReceipt
        let moves=0,forceRefresh=true
    }
    enum ReturnReason:String {case busy,cancelled,unsupported,continued,clean,cleanHidden,tutorial,wildDeferred,noMovesRequested,retired}
    struct Hooks {
        var current:(NativeSourceNoMovesCallerReceipt)->Bool
        var busyEnding:()->Bool?
        var wait:(String,UInt64,Int,@escaping()->Void,@escaping()->Void)->(()->Void)
        var ensureTutorialSingleTile:(NativeSourceNoMovesCallerReceipt,@escaping(Bool?)->Void)->Void
        /// Actual captured physical forced checker, Source context moves0. This
        /// is NOT full NO MOVES commit-authority.capture (would query too early).
        var fresh:(FreshRequest)->NativeResolution?
        var resetHint:()->Void
        var deferWild:(String)->Bool?
        var tutorialFinalChance:(String,@escaping(Bool?)->Void)->Void
        var cleanVisibility:()->(home:Bool,journey:Bool)?
        var clean:(String)->Void
        var beginNoMoves:(NativeSourceNoMovesCallerReceipt,@escaping()->Void)->Void
        var continueMergeSix:(NativeSourceNoMovesCallerReceipt)->Void
        /// Real captured caller return/teardown, metadata retirement only; not a
        /// fabricated Special finish, spawn completion, arrival or HUD reward.
        var returned:(NativeSourceNoMovesCallerReceipt,ReturnReason)->Void
    }
    private enum Phase {case outer400,inner100,ensure,fresh,tutorial,noMoves,closed}
    private final class Entry {
        let receipt:NativeSourceNoMovesCallerReceipt
        var phase:Phase
        var cancel:(()->Void)?
        var returned=false
        init(_ receipt:NativeSourceNoMovesCallerReceipt,_ phase:Phase){self.receipt=receipt;self.phase=phase}
    }
    private let hooks:Hooks
    private var entries:[String:Entry]=[:]
    private var finishing:[String:Entry]=[:]
    private var started:Set<String>=[]
    private var disposed=false
    var pendingCount:Int {entries.count}
    init(hooks:Hooks){self.hooks=hooks}
    private func valid(_ e:Entry,_ phase:Phase)->Bool {
        guard !disposed,entries[e.receipt.id] === e,e.phase==phase else{return false}
        let current=hooks.current(e.receipt)
        return current && !disposed && entries[e.receipt.id] === e && e.phase==phase
    }
    @discardableResult func start(_ receipt:NativeSourceNoMovesCallerReceipt)->Bool {
        guard [.ordinaryMovesDepleted,.mergeMovesDepleted].contains(receipt.kind),
            !disposed,!started.contains(receipt.id),entries[receipt.id]==nil else{return false}
        let current=hooks.current(receipt)
        guard current,!disposed,!started.contains(receipt.id),entries[receipt.id]==nil else{return false}
        let e=Entry(receipt,receipt.kind == .ordinaryMovesDepleted ? .outer400:.fresh)
        started.insert(receipt.id);entries[receipt.id]=e
        if receipt.kind == .ordinaryMovesDepleted {schedule(e,phase:.outer400,milliseconds:400){[weak self,weak e] in guard let self,let e else{return};self.enterMovesDepleted(e)}}
        else {readFresh(e)}
        return true
    }
    private func schedule(_ e:Entry,phase:Phase,milliseconds:Int,elapsed:@escaping()->Void) {
        guard valid(e,phase) else{return}
        let cancel=hooks.wait("source-nomoves-caller:"+e.receipt.id+":"+String(milliseconds),e.receipt.generation,milliseconds,{[weak self,weak e] in
            guard let self,let e,self.valid(e,phase) else{return}
            e.cancel=nil;elapsed()
        },{[weak self,weak e] in
            guard let self,let e,self.valid(e,phase) else{return};e.cancel=nil;self.finish(e,.cancelled)
        })
        guard valid(e,phase) else{cancel();return};e.cancel=cancel
    }
    private func enterMovesDepleted(_ e:Entry) {
        guard valid(e,.outer400) else{return}
        let busy=hooks.busyEnding()
        guard valid(e,.outer400) else{return}
        guard let busy else{finish(e,.unsupported);return}
        if busy {finish(e,.busy);return}
        e.phase = .inner100
        schedule(e,phase:.inner100,milliseconds:100){[weak self,weak e] in
            guard let self,let e,self.valid(e,.inner100) else{return};e.phase = .ensure
            self.hooks.ensureTutorialSingleTile(e.receipt,{[weak self,weak e] saved in
                guard let self,let e,self.valid(e,.ensure) else{return}
                guard let saved else{self.finish(e,.unsupported);return}
                if saved {self.finish(e,.tutorial);return};e.phase = .fresh;self.readFresh(e)
            })
        }
    }
    private func readFresh(_ e:Entry) {
        guard valid(e,.fresh) else{return}
        let result=hooks.fresh(.init(receipt:e.receipt))
        guard valid(e,.fresh) else{return}
        guard let result,[.fail,.continue,.complete].contains(result.kind) else{finish(e,.unsupported);return}
        if result.kind != .fail {
            if e.receipt.kind == .mergeMovesDepleted {finish(e,.continued,action:{self.hooks.continueMergeSix(e.receipt)});return}
            if result.kind == .continue {finish(e,.continued);return}
            let busy=hooks.busyEnding();guard valid(e,.fresh) else{return}
            guard let busy else{finish(e,.unsupported);return};if busy{finish(e,.busy);return}
            let visibility=hooks.cleanVisibility();guard valid(e,.fresh) else{return}
            guard let visibility else{finish(e,.unsupported);return}
            if visibility.home || visibility.journey {finish(e,.cleanHidden);return}
            finish(e,.clean,action:{self.hooks.clean("clean_board_from_moves_depleted")});return
        }
        if e.receipt.kind == .mergeMovesDepleted {hooks.resetHint();guard valid(e,.fresh) else{return}}
        let wild=hooks.deferWild(e.receipt.reason)
        guard valid(e,.fresh) else{return};guard let wild else{finish(e,.unsupported);return}
        if wild {
            if e.receipt.kind == .mergeMovesDepleted {finish(e,.wildDeferred,action:{self.hooks.continueMergeSix(e.receipt)})}
            else {finish(e,.wildDeferred)}
            return
        }
        e.phase = .tutorial
        hooks.tutorialFinalChance(e.receipt.reason,{[weak self,weak e] saved in
            guard let self,let e,self.valid(e,.tutorial) else{return}
            guard let saved else{self.finish(e,.unsupported);return}
            if saved {self.finish(e,.tutorial);return}
            let busy=self.hooks.busyEnding();guard self.valid(e,.tutorial) else{return}
            guard let busy else{self.finish(e,.unsupported);return};if busy{self.finish(e,.busy);return}
            e.phase = .noMoves
            self.hooks.beginNoMoves(e.receipt,{[weak self,weak e] in
                guard let self,let e,self.valid(e,.noMoves) else{return};self.finish(e,.noMovesRequested)
            })
        })
    }
    private func finish(_ e:Entry,_ reason:ReturnReason,action:(()->Void)?=nil) {
        guard !disposed,entries[e.receipt.id] === e,e.phase != .closed else{return}
        let phase=e.phase
        guard valid(e,phase) else{return}
        entries.removeValue(forKey:e.receipt.id);finishing[e.receipt.id]=e;e.phase = .closed
        let cancel=e.cancel;e.cancel=nil;cancel?()
        // Remove before external callback. Nothing afterwards can erase C.
        if let action {action()}
        if finishing[e.receipt.id] === e {finishing.removeValue(forKey:e.receipt.id);returnOnce(e,reason)}
    }
    private func returnOnce(_ e:Entry,_ reason:ReturnReason) {
        guard !e.returned else{return};e.returned=true;hooks.returned(e.receipt,reason)
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        let captured=(Array(entries.values)+Array(finishing.values)).sorted{$0.receipt.sequence<$1.receipt.sequence};entries.removeAll();finishing.removeAll()
        for e in captured {e.phase = .closed;let cancel=e.cancel;e.cancel=nil;cancel?();returnOnce(e,.retired)}
    }
}
