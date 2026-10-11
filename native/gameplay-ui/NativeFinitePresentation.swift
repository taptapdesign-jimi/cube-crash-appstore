import UIKit

/// A bounded native effect has one clock, one visible lifetime and one receipt.
/// Subclasses sample authored poses; callbacks do not make gameplay decisions.
@MainActor
class NativeFinitePresentation: UIView,NativeSourceAnimationParticipant {
    private let completionReceipt=NativeFiniteCompletionReceipt()
    var onFinished: ((Bool) -> Void)? {didSet{completionReceipt.callback=onFinished}}
    var onCue: ((String,Int) -> Void)?
    let duration: TimeInterval
    private var delivery=NativeSourceAnimationClockService.shared
    private var domain=NativeSourceAnimationClockService.Domain.nativeRaw
    private var deliveryLease:NativeSourceAnimationClockService.Lease?
    var hasActiveClock:Bool{deliveryLease?.active == true}
    /// Source mapping requires selected original-root proof. Defaults retain
    /// unmapped nativeRaw elapsed/pause behavior on the replacement transport.
    func configureAnimationDelivery(_ service:NativeSourceAnimationClockService,
                                    domain:NativeSourceAnimationClockService.Domain = .nativeRaw) {
        precondition(!started && !disposed)
        delivery=service;self.domain=domain
    }
    private var started = false,suspended = false,backgrounded = false,disposed = false
    private var observations: [NSObjectProtocol] = []
    init(viewport: CGSize,duration: TimeInterval) {
        self.duration = duration
        super.init(frame: CGRect(origin: .zero,size: viewport))
        isUserInteractionEnabled = false; isOpaque = false; backgroundColor = .clear
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
        let capturedReceipt=completionReceipt,capturedObservations=observations
        deliveryLease=delivery.register(participant:self,duration:duration,domain:domain) { [weak self] success in
            guard let self else {
                capturedObservations.forEach(NotificationCenter.default.removeObserver)
                capturedReceipt.finish(false);return
            }
            self.deliveryLease=nil
            self.finish(success)
        }
        guard deliveryLease != nil else{finish(false);return}
        updatePause()
    }
    func paint(seconds:TimeInterval) {}
    func advanceSourceAnimation(seconds:Double) {
        guard !disposed else{return}
        CATransaction.begin();CATransaction.setDisableActions(true)
        paint(seconds:min(duration,seconds));CATransaction.commit()
    }
    override func didMoveToWindow() { super.didMoveToWindow(); updatePause() }
    func setSuspended(_ value: Bool) { suspended = value; updatePause() }
    private func updatePause(){deliveryLease?.setSuspended(suspended || backgrounded || window == nil)}
    private func finish(_ success: Bool) {
        guard !disposed else{return}
        if let lease=deliveryLease{deliveryLease=nil;lease.cancel(success:success);return}
        disposed=true
        observations.forEach(NotificationCenter.default.removeObserver); observations.removeAll()
        let completion = completionReceipt.take(); onFinished = nil; onCue = nil
        removeFromSuperview(); completion?(success)
    }
    isolated deinit {
        // A covered last participant has no recurring driver callback. Retire
        // its captured observer/completion receipt when the UIView disappears.
        deliveryLease?.cancel(success:false)
        observations.forEach(NotificationCenter.default.removeObserver)
    }
    func completePresentation() { finish(true) }
    func dispose() { finish(false) }
}

@MainActor
private final class NativeFiniteCompletionReceipt {
    var callback:((Bool)->Void)?
    private var settled=false
    func take()->((Bool)->Void)? {
        guard !settled else{return nil};settled=true
        let captured=callback;callback=nil;return captured
    }
    func finish(_ success:Bool){take()?(success)}
}
