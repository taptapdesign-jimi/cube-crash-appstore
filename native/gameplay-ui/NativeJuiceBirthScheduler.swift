import Foundation

/// Source Juice birth budget; attempts at a full pool consume the same tick
/// accumulator as the original owner, while every admitted sprite gets a new
/// local playhead. No gameplay RNG or model mutation participates here.
struct NativeJuiceBirthScheduler {
    private(set) var spawned = 9
    private var frameCounter = 1,lateBurstDone = false
    private var lastTick: TimeInterval = 0,accumulator: Double = 0
    mutating func tick(seconds: TimeInterval,activeCount: Int) -> Int {
        frameCounter += 1
        guard frameCounter%2 == 0 else { return 0 }
        let dt = max(0.001,seconds-lastTick); lastTick = seconds
        guard !(seconds >= 1.5 && spawned >= 66),seconds < 3.9 else { return 0 }
        if !lateBurstDone && seconds >= 1.125 { lateBurstDone = true; accumulator += 18 }
        accumulator += 32*dt
        let attempts = min(3,Int(accumulator)); accumulator -= Double(attempts)
        let admitted = max(0,min(attempts,min(66-spawned,34-activeCount)))
        spawned += admitted; return admitted
    }
    var lastPhaseEnded: Bool { spawned >= 66 }
}
