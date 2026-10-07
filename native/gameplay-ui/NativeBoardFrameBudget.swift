import Foundation

/// Source board-frame-budget.ts; receives the existing scene ticker's time.
/// This value owner installs no callback, display link, timer, or renderer.
struct NativeBoardFrameBudget {
    struct Snapshot:Equatable,Codable {
        var averageFrameMs,worstFrameMs:Double
        var framesOver28Ms:Int
        var reducedFx:Bool
        var sampleCount:Int
        var sustainedLoadReduction:Bool
        var expectedFrameMs:Double
        var framesOverBudget:Int
    }
    static let sustainedLoadReductionAfterMs=180_000.0
    let isMobileRuntime:Bool
    private(set) var isRunning=false
    private(set) var snapshot:Snapshot
    private var lastFrameAt=0.0,samples:[Double]=[],stableWindows=0,framesSinceEvaluation=0
    private var activeElapsedMs=0.0,lastTargetFrameMs=1000.0/60,reducedFx=false
    init(isMobileRuntime:Bool=true) {
        self.isMobileRuntime=isMobileRuntime;snapshot=Self.evaluate(samples:[])
    }
    static func shouldUseSustainedLoadReduction(elapsedMs:Double,isMobileRuntime:Bool)->Bool {
        isMobileRuntime && elapsedMs.isFinite && elapsedMs>=sustainedLoadReductionAfterMs
    }
    static func shouldSample(maxFPS:Double?,isMobileRuntime:Bool)->Bool {
        !isMobileRuntime || maxFPS == nil || maxFPS!.isFinite
    }
    static func expectedFrameMs(maxFPS:Double?,isMobileRuntime:Bool)->Double {
        guard isMobileRuntime,let maxFPS,maxFPS.isFinite,maxFPS>0 else{return 1000/60}
        return 1000/min(60,maxFPS)
    }
    static func evaluate(samples:[Double],currentlyReduced:Bool=false,sustainedLoadReduction:Bool=false,targetFrameMs:Double=1000/60)->Snapshot {
        let usable=Array(samples.filter{$0.isFinite && $0>0}.suffix(120))
        let average=usable.isEmpty ? 16.67:usable.reduce(0,+)/Double(usable.count)
        let worst=usable.max() ?? 16.67,idleAllowance=max(0,targetFrameMs-1000/60)
        let framesOver28=usable.filter{$0>28}.count,overBudget=usable.filter{$0-idleAllowance>28}.count
        let shouldReduce=average-idleAllowance>20.5 || overBudget>=7
        let canRecover=currentlyReduced && average-idleAllowance<18.2 && overBudget<=2
        return .init(averageFrameMs:average,worstFrameMs:worst,framesOver28Ms:framesOver28,reducedFx:sustainedLoadReduction || shouldReduce || (currentlyReduced && !canRecover),sampleCount:usable.count,sustainedLoadReduction:sustainedLoadReduction,expectedFrameMs:targetFrameMs,framesOverBudget:overBudget)
    }
    /// Reset every board, preserving the existing ticker's target-change guard.
    @discardableResult mutating func start(nowMs:Double,maxFPS:Double?=nil)->Snapshot {
        let target=Self.expectedFrameMs(maxFPS:maxFPS,isMobileRuntime:isMobileRuntime)
        lastFrameAt=nowMs;samples=[];stableWindows=0;framesSinceEvaluation=0;activeElapsedMs=0;reducedFx=false
        snapshot=Self.evaluate(samples:[],targetFrameMs:target)
        if !isRunning {lastTargetFrameMs=target};isRunning=true;return snapshot
    }
    /// Nil means the canonical owner did not publish a new evaluation.
    @discardableResult mutating func sample(nowMs:Double,maxFPS:Double?=nil)->Snapshot? {
        guard isRunning else{return nil}
        guard Self.shouldSample(maxFPS:maxFPS,isMobileRuntime:isMobileRuntime) else{lastFrameAt=nowMs;return nil}
        let target=Self.expectedFrameMs(maxFPS:maxFPS,isMobileRuntime:isMobileRuntime)
        let frameMs=max(1,min(250,nowMs-lastFrameAt))
        if target != lastTargetFrameMs {
            samples=[];framesSinceEvaluation=0;stableWindows=0;lastTargetFrameMs=target;lastFrameAt=nowMs;return nil
        }
        samples.append(frameMs);lastFrameAt=nowMs
        if target<=1000/55 {activeElapsedMs += frameMs}
        if samples.count>120 {samples.removeFirst()};framesSinceEvaluation += 1
        guard samples.count>=60,framesSinceEvaluation>=15 else{return nil}
        framesSinceEvaluation=0
        let sustained=Self.shouldUseSustainedLoadReduction(elapsedMs:activeElapsedMs,isMobileRuntime:isMobileRuntime)
        var candidate=Self.evaluate(samples:samples,currentlyReduced:reducedFx,sustainedLoadReduction:sustained,targetFrameMs:target)
        if reducedFx && !candidate.reducedFx {
            stableWindows += 1;if stableWindows<4 {candidate.reducedFx=true}
        } else {stableWindows=0}
        reducedFx=candidate.reducedFx;snapshot=candidate;return candidate
    }
    mutating func stop() {
        isRunning=false;lastFrameAt=0;samples=[];stableWindows=0;framesSinceEvaluation=0;activeElapsedMs=0;reducedFx=false
    }
    var isReduced:Bool {reducedFx}
}
