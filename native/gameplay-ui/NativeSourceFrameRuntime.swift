import Foundation

/// Private integration draft. Scene owns all timestamps and rendering delivery.
/// Kinds name actual source leases; no generic visual-owner lease is admitted.
final class NativeSourceFrameRuntime {
    enum Kind:String,CaseIterable {
        case boardEntry="board-entry",boardPopIn="board-popin",boardExit="board-exit"
        case spawnBounce="spawn-bounce",wildSpawnDrop="wild-spawn-drop"
        case regularMergeHandoff="regular-merge-handoff",mergeSixResolution="merge6-resolution"
        case regularSixShards="regular-merge6-shards",regularSixSmoke="regular-merge6-smoke"
        case specialShards="special-merge6-shards",specialSmoke="special-merge6-smoke",laserSmoke="laser-gun-merge6-smoke"
        case magnetPull="magnet-pull",honeyPull="honey-pull",hudStarFlight="hud-star-flight"
        case regularIdleBounce="regular-tile-idle-bounce",hudExit="hud-exit"
        case tntFinale="tnt-flower-finale",juiceFinale="juice-family-finale",cleanBoardHandoff="clean-board-handoff"
        var tailMs:Double {
            switch self {
            case .regularMergeHandoff,.hudExit,.tntFinale,.juiceFinale,.cleanBoardHandoff:return 180
            case .hudStarFlight,.regularIdleBounce:return 60
            default:return 100
            }
        }
        var suspendsSpecialIdle:Bool {self == .regularMergeHandoff || self == .mergeSixResolution}
        var sourceLabel:String {rawValue}
    }
    struct Key:Hashable {
        let kind:Kind,generation:UInt64,id:String
    }
    final class Capture {
        let key:Key
        fileprivate let lease:NativeBoardFrameCadence.Lease
        fileprivate var released=false
        fileprivate init(key:Key,lease:NativeBoardFrameCadence.Lease) {self.key=key;self.lease=lease}
    }
    let cadence=NativeBoardFrameCadence()
    private(set) var budget=NativeBoardFrameBudget()
    private(set) var nowMs=0.0
    private var owners:[Key:Capture]=[:],specialPopulation:Set<String>=[]
    private var settledPopulation:NativeBoardFrameCadence.Lease?
    var onTarget:((Int)->Void)?
    var onBudget:((NativeBoardFrameBudget.Snapshot)->Void)?
    var onIdleSuspension:((Bool)->Void)?
    private var lastIdleSuspension=false
    private var lastDeliveredTarget:Int?
    var reducedFx:Bool {budget.isReduced}
    var snapshot:NativeBoardFrameCadence.Snapshot {cadence.snapshot}
    var isSpecialIdleSuspended:Bool {owners.keys.contains {$0.kind.suspendsSpecialIdle}}

    /// Assign a real existing Scene/input callback timestamp without adding a budget sample.
    func receiveCallbackTime(_ timestampMs:Double) {nowMs=timestampMs}

    func attach(rendererID:UInt64,nowMs:Double,configuredFPS:Double) {
        self.nowMs=nowMs
        // Original registration order: monitor first, cadence second.
        if !budget.isRunning {onBudget?(budget.start(nowMs:nowMs,maxFPS:configuredFPS))}
        cadence.start(tickerID:rendererID,nowMs:nowMs);publishTarget()
    }
    func newBoard(nowMs:Double,configuredFPS:Double) {
        self.nowMs=nowMs
        onBudget?(budget.start(nowMs:nowMs,maxFPS:configuredFPS))
    }
    func frame(nowMs:Double,configuredFPS:Double) {
        self.nowMs=nowMs
        if let receipt=budget.sample(nowMs:nowMs,maxFPS:configuredFPS) {onBudget?(receipt)}
        cadence.advance(nowMs:nowMs);publishTarget()
    }
    @discardableResult func begin(_ key:Key)->Capture {
        // beginMerge6ResolutionFrames replaces its own source singleton.
        if key.kind == .mergeSixResolution {
            for old in Array(owners.values) where old.key.kind == .mergeSixResolution {end(old)}
        } else if let existing=owners[key] {return existing}
        let lease=cadence.acquireActivity(label:key.kind.sourceLabel,releaseTailMs:key.kind.tailMs,nowMs:nowMs)
        let capture=Capture(key:key,lease:lease);owners[key]=capture
        reconcileSettledPopulation();publishTarget();return capture
    }
    func end(_ capture:Capture) {
        guard !capture.released else{return};capture.released=true
        cadence.release(capture.lease,nowMs:nowMs)
        if owners[capture.key] === capture {owners.removeValue(forKey:capture.key)}
        reconcileSettledPopulation();publishTarget()
    }
    func end(kind:Kind,generation:UInt64,id:String) {
        if let capture=owners[.init(kind:kind,generation:generation,id:id)] {end(capture)}
    }
    /// Caller passes source-admitted registrations, including phase waiting.
    /// Readiness/hasActions/hasAnimatedArtwork do not define admission here.
    func registerPopulation(_ ids:Set<String>) {
        specialPopulation=ids;reconcileSettledPopulation();publishTarget()
    }
    func pointerBegan() {cadence.beginDirectManipulation(nowMs:nowMs);publishTarget()}
    func pointerEnded() {cadence.endDirectManipulation(nowMs:nowMs);publishTarget()}
    func visibilityChanged(hidden:Bool) {cadence.visibilityChanged(hidden:hidden,nowMs:nowMs);publishTarget()}
    /// Retire exact callbacks at a real generation cleanup without replacing
    /// the persistent source ticker. Old closures retain released captures.
    func retireGeneration(_ generation:UInt64) {
        for capture in Array(owners.values) where capture.key.generation == generation {end(capture)}
    }
    func retireGameplayGeneration(_ generation:UInt64) {
        let gameplay:Set<Kind>=[.regularMergeHandoff,.mergeSixResolution,.magnetPull,.honeyPull]
        for capture in Array(owners.values) where capture.key.generation==generation && gameplay.contains(capture.key.kind) {end(capture)}
    }
    func stop() {
        // Clear typed captures after canonical stop, so their late closures
        // cannot extend a replacement ticker's paint tail.
        cadence.stop(nowMs:nowMs)
        owners.values.forEach {$0.released=true};owners.removeAll()
        specialPopulation.removeAll();settledPopulation=nil;budget.stop()
        lastDeliveredTarget=nil
    }
    private func reconcileSettledPopulation() {
        let suspended=owners.keys.contains {$0.kind.suspendsSpecialIdle}
        if lastIdleSuspension != suspended {lastIdleSuspension=suspended;onIdleSuspension?(suspended)}
        if specialPopulation.isEmpty || suspended {
            if let lease=settledPopulation {settledPopulation=nil;cadence.release(lease,nowMs:nowMs)}
        } else if settledPopulation == nil {
            settledPopulation=cadence.acquireSettled(label:"special-dice-idle-registry",nowMs:nowMs)
        }
    }
    private func publishTarget() {
        let snapshot=cadence.snapshot
        guard snapshot.active,lastDeliveredTarget != snapshot.maxFPS else{return}
        lastDeliveredTarget=snapshot.maxFPS;onTarget?(snapshot.maxFPS)
    }
}
