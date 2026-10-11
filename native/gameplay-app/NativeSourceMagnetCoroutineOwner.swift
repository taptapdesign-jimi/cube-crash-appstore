import Foundation

/// Captured app-merge helper continuation, independent of decorative bounce.
/// No timer/clock created: caller borrows the app timeout and Promise FIFO.
@MainActor final class NativeSourceMagnetCoroutineOwner {
    enum Outcome:Equatable {case completed,superseded,cancelled,missingProducer}
    enum Resolution:Equatable {
        case mergePotential(clearLastMerge:Bool),cleanSix,stuckUnlocked,stuckActive,continueWithoutCheck(clearLastMerge:Bool)
    }
    struct Observation {
        // Actual getTransientSpawnState(STATE.tiles) plus captured Source roster.
        let lockedActiveCount,stillSpawningCount,activeCount,playableLockedCount:Int
        let resolution:Resolution
    }
    struct Hooks {
        let ownsLifecycle:()->Bool
        let revision:()->Double
        /// Acquisition is the real Source guard begin2200. Returned closure
        /// releases ONLY captured guard and ONLY when supplied ownsLifecycle.
        let beginGuard:()->((Bool)->Void)?
        let schedule:(Int,@escaping()->Void,@escaping()->Void)->(() -> Void)?
        let enqueue:(@escaping()->Void)->Bool
        let simulate:()->Bool
        let observe:()->Observation?
        /// Core-owned fallback plan/open acknowledgments, never UI RNG/mutation.
        let fallback:(Int,@escaping(Bool)->Void)->Bool
        /// Resource-ready actual fx-status Promise continuation, not async I/O.
        let readFXStatus:()->Bool?
        let clearCapturedLastMerge:()->Void
        let updateGhostVisibility:()->Void
        let centralCheck:(String)->Void
        /// Real helper finally, then outer handler's captured release fallback.
        let helperFinally:(Bool,Outcome)->Void
        let handlerComplete:(Bool,Outcome)->Void
    }
    private let hooks:Hooks
    private var closed=false,begun=false,committed=false,cancelled=false,finishing=false
    private var revisionAtCommit:Double?,spawnCount=0,retries=0,shouldCheck=false
    private var pendingCheck:String?,releaseGuard:((Bool)->Void)?,cancelWait:(()->Void)?
    private var epoch:UInt64=0
    init(hooks:Hooks){self.hooks=hooks}
    var active:Bool {begun && !closed && !finishing}
    private func lifecycle()->Bool {
        guard !closed,!finishing else{return false};let owned=hooks.ownsLifecycle()
        return owned && !closed && !finishing
    }
    @discardableResult func begin()->Bool {
        guard !closed,!begun,lifecycle() else{return false}
        epoch &+= 1;let captured=epoch
        let release=hooks.beginGuard()
        guard !closed,epoch==captured,lifecycle(),let release else{
            // Late acquired capture cannot be published into a sealed owner.
            if let release{release(hooks.ownsLifecycle())};return false
        }
        releaseGuard=release;begun=true;return true
    }
    /// Zero-valid-pulled path invokes central resolution after guard finally.
    func noPulledTiles(){guard active,lifecycle() else{retire();return};pendingCheck="magnet_no_pulled_tiles";finish(.completed)}
    /// Call at the actual replacements/survivor/placeholders commit, BEFORE its
    /// external onMagnetBoardCommit callback. Source captures revision first.
    func boardCommitted(spawnCount:Int,shouldRunPostCheck:Bool,publish:()->Void){
        guard active,!committed,lifecycle() else{return}
        let revision=hooks.revision();guard active,lifecycle(),revision.isFinite else{finish(.missingProducer);return}
        revisionAtCommit=revision;committed=true;self.spawnCount=max(0,spawnCount);shouldCheck=shouldRunPostCheck
        publish();guard active,lifecycle() else{retire();return}
        wait(1200){[weak self] in self?.simulateThenObserve()}
    }
    /// Actual fallback open owner uses the already-captured Source contact
    /// revision. It does not infer freshness from Core revision or bounce age.
    func mayContinueSourceFallback()->Bool {currentTail()}
    /// A real app-spawn timeline interruption rejects its awaited Promise.
    /// The original helper catches AppSpawnCancelledError, returns, then runs
    /// its literal finally; outer current-run completion remains a separate job.
    func sourceFallbackCancelled(){guard active else{return};cancelled=true;finish(.cancelled)}
    private func currentTail()->Bool {
        guard active,lifecycle(),!cancelled,let expected=revisionAtCommit else{finish(.cancelled);return false}
        let actual=hooks.revision();guard active,lifecycle() else{finish(.cancelled);return false}
        guard actual.isFinite,actual==expected else{cancelled=true;pendingCheck=nil;shouldCheck=false;finish(.superseded);return false}
        return true
    }
    private func reaction(_ callback:@escaping()->Void){
        guard active else{return}
        let accepted=hooks.enqueue{[weak self] in guard let self,self.active else{return};callback()}
        if !accepted,active {finish(.missingProducer)}
    }
    private func wait(_ milliseconds:Int,then callback:@escaping()->Void){
        guard active,lifecycle() else{finish(.cancelled);return}
        epoch &+= 1;let captured=epoch
        var delivered=false
        let next=hooks.schedule(milliseconds,{[weak self] in
            delivered=true
            guard let self,self.active,self.epoch==captured else{return}
            self.cancelWait=nil
            // waitTrackedResult resolution resumes waitForMagnet first;
            // its returned Promise then resumes the enclosing helper.
            self.reaction{[weak self] in
                guard let self,self.active else{return}
                if !self.lifecycle(){self.cancelled=true}
                self.reaction{[weak self] in guard let self,self.currentTail() else{return};callback()}
            }
        },{[weak self] in
            delivered=true
            guard let self,self.active,self.epoch==captured else{return}
            self.cancelWait=nil
            self.reaction{[weak self] in
                guard let self,self.active else{return};self.cancelled=true
                self.reaction{[weak self] in self?.finish(.cancelled)}
            }
        })
        guard active,epoch==captured,!delivered else{next?();return}
        guard let next else{finish(.missingProducer);return};cancelWait=next
    }
    private func simulateThenObserve(){
        guard currentTail() else{return}
        _=hooks.simulate() // Original value is logging-only, still genuine await.
        guard active else{return}
        reaction{[weak self] in guard let self,self.currentTail(),let snapshot=self.read() else{return}
            if snapshot.lockedActiveCount>0 || snapshot.stillSpawningCount>0 {
                self.wait(600){[weak self] in self?.checkZero()}
            }else{self.checkZero(snapshot)}
        }
    }
    private func read()->Observation? {
        guard currentTail() else{return nil}
        let observed=hooks.observe();guard currentTail() else{return nil}
        guard let observed,observed.lockedActiveCount>=0,observed.stillSpawningCount>=0,observed.activeCount>=0,observed.playableLockedCount>=0 else{finish(.missingProducer);return nil}
        return observed
    }
    private func checkZero(_ initial:Observation?=nil){
        guard let snapshot=initial ?? read() else{return}
        if snapshot.activeCount==0,spawnCount>0 {
            wait(500){[weak self] in guard let self,let recheck=self.read() else{return}
                if recheck.activeCount==0 {self.openFallback()}
                else {self.fxThenPoll()}
            }
        }else{fxThenPoll()}
    }
    private func openFallback(){
        guard currentTail() else{return}
        var settled=false
        let accepted=hooks.fallback(max(1,min(spawnCount,2))){[weak self] success in
            guard !settled,let self,self.active else{return};settled=true
            self.reaction{[weak self] in guard let self,self.currentTail() else{return}
                guard success else{self.finish(.missingProducer);return}
                self.wait(100){[weak self] in guard let self,self.read() != nil else{return};self.fxThenPoll()}
            }
        }
        if !accepted,active {finish(.missingProducer)}
    }
    private func fxThenPoll(){
        guard currentTail() else{return}
        let available=hooks.readFXStatus();guard currentTail() else{return}
        guard available != nil else{finish(.missingProducer);return}
        // Cached Source import remains an awaited Promise, even if visual false.
        reaction{[weak self] in guard let self,self.currentTail() else{return};self.pollUnlocked()}
    }
    private func pollUnlocked(){
        guard let snapshot=read() else{return}
        if snapshot.playableLockedCount>0,retries<10 {
            retries+=1;wait(50){[weak self] in self?.pollUnlocked()};return
        }
        resolve(snapshot.resolution)
    }
    private func resolve(_ resolution:Resolution){
        guard currentTail() else{return}
        switch resolution {
        case .mergePotential(let clear):
            if clear{hooks.clearCapturedLastMerge();guard currentTail() else{return}}
            hooks.updateGhostVisibility();guard currentTail() else{return}
            pendingCheck="mergePulledTiles_mergePotential_refresh"
        case .cleanSix:pendingCheck="mergePulledTiles_clean_merge6_only"
        case .stuckUnlocked:pendingCheck="mergePulledTiles_stuck_unlocked_tiles"
        case .stuckActive:pendingCheck="mergePulledTiles_stuck_active_tiles"
        case .continueWithoutCheck(let clear):
            if clear{hooks.clearCapturedLastMerge();guard currentTail() else{return}}
        }
        finish(.completed)
    }
    private func finish(_ outcome:Outcome){
        guard !closed,!finishing else{return};finishing=true
        if !begun {closed=true;epoch &+= 1;return}
        let owned=hooks.ownsLifecycle()
        // Seal BEFORE external guard/finally/cancel callbacks can reenter.
        let check=owned && !cancelled && outcome == .completed ? (pendingCheck ?? (shouldCheck ? "mergePulledTiles_postGuard_settle":nil)):nil
        closed=true;epoch &+= 1;pendingCheck=nil;shouldCheck=false
        let guardCleanup=releaseGuard;releaseGuard=nil
        let waitCleanup=cancelWait;cancelWait=nil
        waitCleanup?();guardCleanup?(owned)
        if let check,owned, hooks.ownsLifecycle(){hooks.centralCheck(check)}
        hooks.helperFinally(owned,outcome)
        // Literal nested awaits: internal helper -> handler -> app-core caller.
        // Do not move the outer Special release into synchronous helper finally.
        if owned {
            let hooks=hooks
            _=hooks.enqueue {
                guard hooks.ownsLifecycle() else{return}
                _=hooks.enqueue {
                    guard hooks.ownsLifecycle() else{return}
                    hooks.handlerComplete(true,outcome)
                }
            }
        }
    }
    func retire(){cancelled=true;finish(.cancelled)}
    isolated deinit {retire()}
}
