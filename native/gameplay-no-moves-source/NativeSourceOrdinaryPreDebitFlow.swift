import Foundation
import StackToSixGameplay

/// Actual Source STATE roster, deliberately separate from collectBoardGameplayTiles.
/// Each object is the real captured native node, never an ID-only Core projection.
@MainActor struct NativeSourcePostcheckTile {
    let object:AnyObject,id:String,value:Int,depth:Int,locked:Bool,destroyed:Bool
    let isWildLike:Bool,active:Bool
}
@MainActor struct NativeSourcePostcheckRoster {
    let tiles:[NativeSourcePostcheckTile]
    let moves:Int
    /// Actual complete Source marker/predicate observation; nil supplier refuses.
    let complete:Bool
}
@MainActor struct NativeSourcePostcheckMainCapture {
    let source:AnyObject,destination:AnyObject,sourceID:String,destinationID:String
    let effectiveSum:Int,sourceValue:Int,destinationValue:Int
    let sourceSpecial:String?,destinationSpecial:String?
    let sourceDepth:Int,destinationDepth:Int
    let visibleBefore:Int,physicalBefore:Int,bothCapturedActive:Bool
    var regularPair:Bool {sourceSpecial==nil && destinationSpecial==nil && sourceValue>0 && destinationValue>0}
}

/// Literal six pre-debit Source branches. No clock, classifier shortcut, extra
/// render lease or automatic runtime markers. Existing app-wall/FIFO owners inject
/// deliveries; current() is sealed before AND after every external callback.
@MainActor final class NativeSourceOrdinaryPreDebitFlow {
    enum ReturnReason:String {case continueToDebit,earlyReturn,cancelled,unsupported,retired}
    enum RosterKind {case active,STATE}
    struct FreshRequest {let receipt:NativeSourceOrdinaryPreDebitReceipt,kind:RosterKind,roster:NativeSourcePostcheckRoster;let forceRefresh=true}
    struct Hooks {
        var current:(NativeSourceOrdinaryPreDebitReceipt)->Bool
        var mainCapture:(NativeSourceOrdinaryPreDebitReceipt)->NativeSourcePostcheckMainCapture?
        var busyEnding:()->Bool?
        var wait:(String,UInt64,Int,@escaping()->Void,@escaping()->Void)->(()->Void)
        var stateRoster:()->NativeSourcePostcheckRoster?
        /// Re-read the SAME retained actual object after the awaited tutorial.
        var reread:(NativeSourcePostcheckTile)->NativeSourcePostcheckTile?
        var fresh:(FreshRequest)->NativeResolution?
        var clearEndGameCache:()->Void
        var resetHint:()->Void
        var deferStackWild:(String)->Bool?
        var ensureTutorialSingleTile:(String,@escaping(Bool?)->Void)->Void
        var tutorialFinalChance:(String,@escaping(Bool?)->Void)->Void
        var beginNoMoves:(NativeSourceOrdinaryPreDebitReceipt,NativeNoMovesCandidateOwner.Trigger,@escaping()->Void)->Void
        var finished:(NativeSourceOrdinaryPreDebitReceipt,ReturnReason)->Void
    }
    private enum Phase {case main,wait,read,ensure,tutorial,noMoves,closed}
    private final class Entry {
        let receipt:NativeSourceOrdinaryPreDebitReceipt
        var phase=Phase.main,main:NativeSourcePostcheckMainCapture?
        var cancel:(()->Void)?,finished=false
        init(_ receipt:NativeSourceOrdinaryPreDebitReceipt){self.receipt=receipt}
    }
    private let hooks:Hooks
    private var entries:[String:Entry]=[:],started:Set<UUID>=[]
    private var disposed=false
    var pendingCount:Int {entries.count}
    init(hooks:Hooks){self.hooks=hooks}
    private func valid(_ e:Entry,_ phase:Phase)->Bool {
        guard !disposed,entries[e.receipt.ownerID] === e,e.phase==phase,!e.finished else{return false}
        let current=hooks.current(e.receipt)
        return current && !disposed && entries[e.receipt.ownerID] === e && e.phase==phase && !e.finished
    }
    @discardableResult func start(_ receipt:NativeSourceOrdinaryPreDebitReceipt)->Bool {
        guard !disposed,entries[receipt.ownerID]==nil,!started.contains(receipt.id) else{return false}
        let current=hooks.current(receipt)
        guard current,!disposed,entries[receipt.ownerID]==nil,!started.contains(receipt.id) else{return false}
        let e=Entry(receipt);entries[receipt.ownerID]=e;started.insert(receipt.id)
        let capture=hooks.mainCapture(receipt)
        guard valid(e,.main) else{return true}
        guard let capture,capture.effectiveSum>0,capture.effectiveSum<6 else{finish(e,.unsupported);return true}
        e.main=capture
        let busy=hooks.busyEnding();guard valid(e,.main) else{return true}
        guard let busy else{finish(e,.unsupported);return true}
        // Source outer if is skipped when busy at actual main entry. No100 wait.
        if busy {finish(e,.continueToDebit);return true}
        e.phase = .wait
        let cancel=hooks.wait("source-predebit:"+receipt.id.uuidString,receipt.generation,100,{[weak self,weak e] in
            guard let self,let e,self.valid(e,.wait) else{return};e.cancel=nil;e.phase = .read;self.read(e)
        },{[weak self,weak e] in
            guard let self,let e,self.valid(e,.wait) else{return};e.cancel=nil;self.finish(e,.cancelled)
        })
        guard valid(e,.wait) else{cancel();return true};e.cancel=cancel;return true
    }
    private func read(_ e:Entry) {
        guard valid(e,.read),let main=e.main else{return}
        let state=hooks.stateRoster();guard valid(e,.read) else{return}
        guard let state,state.complete,Set(state.tiles.map(\.id)).count==state.tiles.count else{finish(e,.unsupported);return}
        let active=state.tiles.filter(\.active)
        if active.count>=2 {
            let quick=hooks.fresh(.init(receipt:e.receipt,kind:.active,roster:.init(tiles:active,moves:state.moves,complete:true)))
            guard valid(e,.read) else{return}
            guard let quick,[.continue,.complete,.fail].contains(quick.kind) else{finish(e,.unsupported);return}
            // Literal quick continue never returns; later full check still runs.
        }
        let lastOnly=active.count==1 && active[0].object === main.destination
        let noLockedPositive = !state.tiles.contains{$0.locked && !$0.destroyed && $0.value>0}
        if main.regularPair,main.effectiveSum<6,main.bothCapturedActive,lastOnly,noLockedPositive {
            let tile=active[0],value=tile.value==0 ? main.effectiveSum:tile.value,depth=tile.depth==0 ? 1:tile.depth
            let canReach=value*2<=6 && depth>=2
            let selfDead=value*2==6 && depth-1==1
            if main.visibleBefore==2 {
                if !canReach {deadEnd(e,.lastTwoRegular);return}
                if selfDead {deadEnd(e,.lastTwoSelf);return}
            }
            if main.physicalBefore>=3 && main.sourceDepth+main.destinationDepth>=main.physicalBefore {
                if !canReach {deadEnd(e,.lastThreeRegular);return}
                if selfDead {deadEnd(e,.lastThreeSelf);return}
            }
        }
        if active.count==1 {
            let held=active[0];e.phase = .ensure
            hooks.ensureTutorialSingleTile("post_stack_single_regular_tile",{[weak self,weak e] saved in
                guard let self,let e,self.valid(e,.ensure) else{return}
                guard let saved else{self.finish(e,.unsupported);return}
                if saved {self.finish(e,.earlyReturn);return}
                let tile=self.hooks.reread(held);guard self.valid(e,.ensure) else{return}
                guard let tile,tile.object === held.object,tile.id==held.id else{self.finish(e,.unsupported);return}
                let depth=tile.depth==0 ? 1:tile.depth
                let canSelf = !tile.isWildLike && depth>=2 && tile.value*2<=6
                let busy=self.hooks.busyEnding();guard self.valid(e,.ensure) else{return}
                guard let busy else{self.finish(e,.unsupported);return}
                e.phase = .read
                if !tile.isWildLike && !canSelf && !busy {self.deadEnd(e,.singleRegular);return}
                self.fullCheck(e)
            });return
        }
        fullCheck(e)
    }
    private func fullCheck(_ e:Entry) {
        guard valid(e,.read) else{return}
        hooks.clearEndGameCache();guard valid(e,.read) else{return}
        // Read current STATE again AFTER await / cache-clear external callbacks.
        let state=hooks.stateRoster();guard valid(e,.read) else{return}
        guard let state,state.complete else{finish(e,.unsupported);return}
        let fresh=hooks.fresh(.init(receipt:e.receipt,kind:.STATE,roster:state));guard valid(e,.read) else{return}
        guard let fresh,[.continue,.complete,.fail].contains(fresh.kind) else{finish(e,.unsupported);return}
        if fresh.kind == .fail {deadEnd(e,.postMerge)}
        else {finish(e,.continueToDebit)}
    }
    private func deadEnd(_ e:Entry,_ trigger:NativeNoMovesCandidateOwner.Trigger) {
        guard valid(e,.read) else{return}
        hooks.resetHint();guard valid(e,.read) else{return}
        let wild=hooks.deferStackWild(trigger.rawValue);guard valid(e,.read) else{return}
        guard let wild else{finish(e,.unsupported);return}
        if wild {finish(e,.earlyReturn);return}
        e.phase = .tutorial
        hooks.tutorialFinalChance(trigger.rawValue,{[weak self,weak e] saved in
            guard let self,let e,self.valid(e,.tutorial) else{return}
            guard let saved else{self.finish(e,.unsupported);return}
            if saved {self.finish(e,.earlyReturn);return}
            // Source single safety-net did its busy test BEFORE tutorial await.
            // runNoMoves itself still owns the later actual busy refusal.
            if trigger != .singleRegular {
                let busy=self.hooks.busyEnding();guard self.valid(e,.tutorial) else{return}
                guard let busy else{self.finish(e,.unsupported);return}
                if busy {self.finish(e,.earlyReturn);return}
            }
            e.phase = .noMoves
            self.hooks.beginNoMoves(e.receipt,trigger,{[weak self,weak e] in
                guard let self,let e,self.valid(e,.noMoves) else{return};self.finish(e,.earlyReturn)
            })
        })
    }
    private func finish(_ e:Entry,_ reason:ReturnReason) {
        guard !disposed,entries[e.receipt.ownerID] === e,!e.finished else{return}
        let phase=e.phase
        guard valid(e,phase) else{return}
        e.finished=true;e.phase = .closed;entries.removeValue(forKey:e.receipt.ownerID)
        let cancel=e.cancel;e.cancel=nil;cancel?()
        // An external cancel can dispose/rebind C. Old A must not publish after it.
        guard !disposed,e.finished,e.phase == .closed,entries[e.receipt.ownerID]==nil else{return}
        let current=hooks.current(e.receipt)
        guard current,!disposed,entries[e.receipt.ownerID]==nil else{return}
        hooks.finished(e.receipt,reason)
    }
    func dispose() {
        guard !disposed else{return};disposed=true
        let captured=Array(entries.values);entries=[:]
        for e in captured {e.phase = .closed;e.finished=true;let cancel=e.cancel;e.cancel=nil;cancel?()}
        // Scope/Scene captures own metadata retirement; no callback after dispose.
    }
}
