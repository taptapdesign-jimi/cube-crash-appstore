import UIKit
import AVFoundation

/// Preserved HEVC-with-alpha artwork on native AVPlayerLayer, no web media.
/// Fish's bubbles and swimmer use the source 2.4s visual clocks. Codec alpha
/// and first-ready-frame acceptance remain Simulator/physical QA obligations.
@MainActor
final class NativeFishFinalePresentation: UIView {
    var onFinished: ((Bool) -> Void)?
    private let swimmer = UIView(),bubbles = UIView()
    private let swimmerLayer = AVPlayerLayer(),bubblesLayer = AVPlayerLayer()
    private let swimmerPlayer: AVQueuePlayer,bubblesPlayer: AVPlayer
    private let swimmerLoop: AVPlayerLooper
    private var motion: NativeFishFinaleMotion
    private let target = NativeFishClockTarget()
    private let glyphs: NativeSplashGlyphField
    private var link: CADisplayLink?
    private var readiness: [NSKeyValueObservation] = []
    private var observations: [NSObjectProtocol] = []
    private var lastFrame: TimeInterval?,elapsed: TimeInterval = 0,preparing: TimeInterval = 0
    private var started = false,ready = false,paused = false,backgrounded = false,disposed = false

    init(resourceRoot: URL,origin: CGPoint,viewport: CGSize) {
        let fishItem = AVPlayerItem(url: resourceRoot.appendingPathComponent("assets/shop/fish/fish-mobile-hevc.mov"))
        swimmerPlayer = AVQueuePlayer(); swimmerLoop = AVPlayerLooper(player: swimmerPlayer,templateItem: fishItem)
        bubblesPlayer = AVPlayer(url: resourceRoot.appendingPathComponent("assets/shop/fish/bubbly-fast-hevc.mov"))
        motion = NativeFishFinaleMotion(origin: origin,viewport: viewport)
        glyphs = NativeSplashGlyphField(artwork: JimiV9Artwork(resourceRoot: resourceRoot),text: "FISHY",
            colors: [UIColor(red: 253.0/255,green: 124.0/255,blue: 65.0/255,alpha: 1),UIColor(red: 252.0/255,green: 164.0/255,blue: 112.0/255,alpha: 1)],splitIndex: 3)
        super.init(frame: CGRect(origin: .zero,size: viewport))
        isUserInteractionEnabled = false; isOpaque = false; backgroundColor = .clear; clipsToBounds = true
        accessibilityIdentifier = "native-fish-finale"
        bubbles.isOpaque = false; swimmer.isOpaque = false
        addSubview(bubbles); addSubview(swimmer); addSubview(glyphs)
        bubblesLayer.player = bubblesPlayer; swimmerLayer.player = swimmerPlayer
        bubblesLayer.videoGravity = .resizeAspectFill; swimmerLayer.videoGravity = .resizeAspect
        bubblesLayer.backgroundColor = UIColor.clear.cgColor; swimmerLayer.backgroundColor = UIColor.clear.cgColor
        bubbles.layer.addSublayer(bubblesLayer); swimmer.layer.addSublayer(swimmerLayer)
        swimmerPlayer.isMuted = true; bubblesPlayer.isMuted = true
        swimmerPlayer.automaticallyWaitsToMinimizeStalling = false; bubblesPlayer.automaticallyWaitsToMinimizeStalling = false
        readiness = [swimmerLayer.observe(\.isReadyForDisplay,options: [.new]) { [weak self] _,_ in
            Task { @MainActor [weak self] in self?.admitReadyFrame() }
        },bubblesLayer.observe(\.isReadyForDisplay,options: [.new]) { [weak self] _,_ in
            Task { @MainActor [weak self] in self?.admitReadyFrame() }
        }]
        target.owner = self
        observations = [
            NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,object: nil,queue: .main) { [weak self] _ in MainActor.assumeIsolated { self?.backgrounded = true; self?.updatePause() } },
            NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,object: nil,queue: .main) { [weak self] _ in MainActor.assumeIsolated { self?.backgrounded = false; self?.updatePause() } }
        ]
        swimmer.alpha = 0; bubbles.alpha = 0
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func layoutSubviews() {
        super.layoutSubviews()
        glyphs.frame = bounds
        bubbles.bounds = bounds; bubbles.center = CGPoint(x: bounds.midX,y: bounds.midY)
        bubblesLayer.frame = bubbles.bounds
        swimmer.bounds = CGRect(origin: .zero,size: motion.mediaSize); swimmerLayer.frame = swimmer.bounds
    }
    func start() {
        guard !started,!disposed else { return }
        started = true; layoutIfNeeded()
        // Decode the first frames while both layers remain hidden; admission
        // consumes readiness once and rewinds to start both original sources.
        swimmerPlayer.playImmediately(atRate: 2); bubblesPlayer.playImmediately(atRate: 1)
        let clock = CADisplayLink(target: target,selector: #selector(NativeFishClockTarget.tick(_:)))
        clock.preferredFrameRateRange = CAFrameRateRange(minimum: 30,maximum: 60,preferred: 60)
        clock.add(to: .main,forMode: .common); link = clock; clock.isPaused = paused || backgrounded || window == nil
        admitReadyFrame()
    }
    private func admitReadyFrame() {
        guard !disposed,!ready,swimmerLayer.isReadyForDisplay,bubblesLayer.isReadyForDisplay else { return }
        ready = true; lastFrame = nil
        swimmerPlayer.seek(to: .zero,toleranceBefore: .zero,toleranceAfter: .zero)
        bubblesPlayer.seek(to: .zero,toleranceBefore: .zero,toleranceAfter: .zero)
        if !paused && !backgrounded && window != nil { swimmerPlayer.playImmediately(atRate: 2); bubblesPlayer.playImmediately(atRate: 1) }
        paint()
    }
    fileprivate func tick(_ clock: CADisplayLink) {
        guard !disposed,!paused,!backgrounded,window != nil else { lastFrame = nil; return }
        let delta = lastFrame.map { max(0,clock.timestamp-$0) } ?? 0; lastFrame = clock.timestamp
        if ready {
            elapsed += delta; paint()
            if elapsed >= max(NativeFishFinaleMotion.duration,glyphs.duration) { finish(true) }
        } else {
            preparing += delta
            if swimmerPlayer.status == .failed || bubblesPlayer.status == .failed || preparing >= 4 { finish(false) }
        }
    }
    private func paint() {
        CATransaction.begin(); CATransaction.setDisableActions(true)
        let pose = motion.sample(seconds: elapsed)
        swimmer.layer.position = pose.point
        swimmer.transform = CGAffineTransform(rotationAngle: pose.rotation * .pi/180).scaledBy(x: pose.scale*motion.direction,y: pose.scale)
        swimmer.alpha = pose.alpha
        let viewportHeight = max(520,bounds.height),progress = min(1,elapsed/2.4)
        let scale = progress < 0.98 ? 1.7 : 1.7-0.7*Double(NativeBoardMotion.Ease.power2InOut.sample(CGFloat((progress-0.98)/0.02)))
        let offset = viewportHeight*(0.37875+(0.25-0.37875)*progress)
        bubbles.layer.position = CGPoint(x: bounds.midX,y: bounds.midY+offset)
        bubbles.transform = CGAffineTransform(scaleX: scale,y: scale)
        bubbles.alpha = progress < 0.98 ? 1 : 0
        CATransaction.commit()
        glyphs.paint(seconds: elapsed)
    }
    override func didMoveToWindow() { super.didMoveToWindow(); updatePause() }
    func setSuspended(_ value: Bool) { paused = value; updatePause() }
    private func updatePause() {
        lastFrame = nil; link?.isPaused = paused || backgrounded || window == nil
        if paused || backgrounded || window == nil { swimmerPlayer.pause(); bubblesPlayer.pause() }
        else if started { swimmerPlayer.playImmediately(atRate: 2); bubblesPlayer.playImmediately(atRate: 1) }
    }
    private func finish(_ success: Bool) {
        guard !disposed else { return }; disposed = true
        link?.invalidate(); link = nil; target.owner = nil
        readiness.removeAll(); observations.forEach(NotificationCenter.default.removeObserver); observations.removeAll()
        swimmerPlayer.pause(); bubblesPlayer.pause(); swimmerLoop.disableLooping(); swimmerPlayer.removeAllItems()
        bubblesPlayer.replaceCurrentItem(with: nil); swimmerLayer.player = nil; bubblesLayer.player = nil
        let completion = onFinished; onFinished = nil; removeFromSuperview(); completion?(success)
    }
    func dispose() { finish(false) }
}

@MainActor
private final class NativeFishClockTarget: NSObject {
    weak var owner: NativeFishFinalePresentation?
    @objc func tick(_ clock: CADisplayLink) { owner?.tick(clock) }
}
