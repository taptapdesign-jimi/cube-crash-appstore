import Foundation

/// Accepted sweetPopOut plan, with presentation RNG kept outside gameplay RNG.
struct NativeBoardExitPlan {
    let tileIndex: Int
    let delay: TimeInterval
    let settle: TimeInterval
    let compress: TimeInterval
    let collapse: TimeInterval
    let peak: Double
    var end: TimeInterval { delay+settle+compress+collapse }

    static func make(count: Int, random: () -> Double = { Double.random(in: 0..<1) }) -> [Self] {
        guard count > 0 else { return [] }
        var indices = Array(0..<count)
        if count > 1 { for index in stride(from: count-1,through: 1,by: -1) {
            indices.swapAt(index,min(index,Int(random()*Double(index+1))))
        } }
        return indices.enumerated().map { index,tileIndex in
            let step = 0.020+random()*0.010
            let burst = random() < 0.22 ? -random()*0.16 : 0
            let delay = max(0,Double(index)*step*0.55+random()*0.18+burst)
            let duration = 0.55+random()*0.20, peak = 1.08+random()*0.07
            let blow = 0.18+random()*0.08, compress = 0.12+random()*0.05, settle = 0.10+random()*0.06
            return Self(tileIndex: tileIndex,delay: delay,settle: max(0.08,settle*duration),
                compress: max(0.08,compress*duration),collapse: max(0.10,blow*duration),peak: peak)
        }
    }
}
