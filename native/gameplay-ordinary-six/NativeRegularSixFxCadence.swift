import Foundation

/// App-lived source pattern/cadence state. Other native smoke owners can share
/// the same hot-factor receipt; no gameplay RNG or saved progression is touched.
@MainActor
final class NativeRegularSixFxCadence {
    static let shared=NativeRegularSixFxCadence()
    private var pattern=0,lastBurstMilliseconds=0.0
    func nextPattern()->Int {let result=pattern;pattern=(pattern+1)%3;return result}
    func hotFactor(nowMilliseconds:Double,reducedBoardFx:Bool)->Double {
        let delta=nowMilliseconds-lastBurstMilliseconds;lastBurstMilliseconds=nowMilliseconds
        let thermal=reducedBoardFx ? 0.58:1.0
        return delta>=320 ? thermal:(0.55+delta/320*0.45)*thermal
    }
}
