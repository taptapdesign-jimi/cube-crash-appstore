import SpriteKit

/// Six shared, preuploaded SVG-derived sheets. Frames borrow the atlas storage;
/// flight playback uses the existing Source clock, never SKActions or a timer.
@MainActor struct NativeHUDCoinAnimation {
    static let names = ["coin-upright-0", "coin-left-35", "coin-right-35",
        "coin-back-forth-diagonal-15", "coin-back-forth-left-50", "coin-back-forth-right-50"]
    let frames: [SKTexture]
    var duration: Double { Double(frames.count) / 60 }
    func texture(at seconds: Double) -> SKTexture {
        let index = Int((max(0, seconds).truncatingRemainder(dividingBy: duration) * 60).rounded(.down))
        return frames[min(index, frames.count - 1)]
    }
    static func slice(_ atlas: SKTexture, frameCount: Int) -> Self {
        let columns = 10, rows = (frameCount + columns - 1) / columns
        let frames = (0..<frameCount).map { index in
            let rect = CGRect(x: Double(index % columns) / Double(columns),
                y: Double(rows - 1 - index / columns) / Double(rows),
                width: 1 / Double(columns), height: 1 / Double(rows))
            let frame = SKTexture(rect: rect, in: atlas)
            frame.filteringMode = .linear
            return frame
        }
        return Self(frames: frames)
    }
}
