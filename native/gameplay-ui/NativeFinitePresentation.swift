import UIKit

/// A bounded native effect has one clock, one visible lifetime and one receipt.
/// Subclasses sample authored poses; callbacks do not make gameplay decisions.
@MainActor
class NativeFinitePresentation: UIView {
    var onFinished: ((Bool) -> Void)?
    var onCue: ((String,Int) -> Void)?
    let duration: TimeInterval
    private let clockTarget = NativeFiniteClockTarget()
    private var link: CADisplayLink?
    var hasActiveClock: Bool { link != nil }
    private var lastFrame: TimeInterval?
    private var elapsed: TimeInterval = 0
    private var started = false,suspended = false,backgrounded = false,disposed = false
    private var observations: [NSObjectProtocol] = []
    init(viewport: CGSize,duration: TimeInterval) {
        self.duration = duration
        super.init(frame: CGRect(origin: .zero,size: viewport))
        isUserInteractionEnabled = false; isOpaque = false; backgroundColor = .clear
        clockTarget.owner = self
        observations = [
            NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,object: nil,queue: .main) { [weak self] _ in MainActor.assumeIsolated { self?.backgrounded = true; self?.updatePause() } },
            NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,object: nil,queue: .main) { [weak self] _ in MainActor.assumeIsolated { self?.backgrounded = false; self?.updatePause() } }
        ]
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    func start() {
        guard !started,!disposed else { return }
        started = true; layoutIfNeeded(); paint(seconds: 0)
        guard !disposed else { return }
        let clock = CADisplayLink(target: clockTarget,selector: #selector(NativeFiniteClockTarget.tick(_:)))
        clock.preferredFrameRateRange = CAFrameRateRange(minimum: 30,maximum: 60,preferred: 60)
        clock.add(to: .main,forMode: .common); link = clock; updatePause()
    }
    func paint(seconds: TimeInterval) {}
    fileprivate func tick(_ clock: CADisplayLink) {
        guard !disposed,!suspended,!backgrounded,window != nil else { lastFrame = nil; return }
        elapsed += lastFrame.map { max(0,clock.timestamp-$0) } ?? 0; lastFrame = clock.timestamp
        CATransaction.begin(); CATransaction.setDisableActions(true); paint(seconds: min(duration,elapsed)); CATransaction.commit()
        if elapsed >= duration { finish(true) }
    }
    override func didMoveToWindow() { super.didMoveToWindow(); updatePause() }
    func setSuspended(_ value: Bool) { suspended = value; updatePause() }
    private func updatePause() { lastFrame = nil; link?.isPaused = suspended || backgrounded || window == nil }
    private func finish(_ success: Bool) {
        guard !disposed else { return }; disposed = true
        link?.invalidate(); link = nil; clockTarget.owner = nil
        observations.forEach(NotificationCenter.default.removeObserver); observations.removeAll()
        let completion = onFinished; onFinished = nil; onCue = nil
        removeFromSuperview(); completion?(success)
    }
    func completePresentation() { finish(true) }
    func dispose() { finish(false) }
}

@MainActor
private final class NativeFiniteClockTarget: NSObject {
    weak var owner: NativeFinitePresentation?
    @objc func tick(_ clock: CADisplayLink) { owner?.tick(clock) }
}
