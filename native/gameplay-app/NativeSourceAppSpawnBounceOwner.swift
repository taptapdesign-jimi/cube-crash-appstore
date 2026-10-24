import Foundation

/// Source app-spawn.ts regular open timeline, with an explicit Native fresh-face
/// timing policy. The injected app union service owns every delivery; no extra clock.
@MainActor final class NativeSourceAppSpawnBounceOwner {
    static let nativeEntryScale=0.0
    enum Completion: Equatable { case completed, interrupted, unavailable }
    struct Hooks {
        let current: () -> Bool
        let readRotation: () -> Double?
        let paintScale: (Double) -> Void
        let paintRotation: (Double) -> Void
        let ensureFullOpacity: () -> Void
        let random: () -> Double
        let acquireFrames: () -> (() -> Void)?
        let finished: (Completion) -> Void
    }
    @MainActor private final class Participant: NativeSourceAnimationParticipant {
        var advance: ((Double) -> Void)?
        func advanceSourceAnimation(seconds: Double) { advance?(seconds) }
    }
    private let service: NativeSourceAnimationClockService
    private let hooks: Hooks
    private let timeScale:Double,capturedDirection:Int?
    private let initialScale:Double
    private let nativeFreshFace:Bool
    private let nativeFrameSerial:(()->UInt64?)?
    private var participant: Participant?
    private var lease: NativeSourceAnimationClockService.Lease?
    private var releaseFrames: (() -> Void)?
    private var initialRotation: Double?
    private var direction = 1.0
    private var begun = false, closed = false, childrenRemoved = false
    init(service: NativeSourceAnimationClockService, hooks: Hooks,timeScale:Double=1,capturedDirection:Int?=nil,preservesBoardSize:Bool=false,initialScale:Double?=nil,nativeFreshFace:Bool=false,nativeFrameSerial:(()->UInt64?)?=nil) {
        self.service = service; self.hooks = hooks;self.nativeFreshFace=nativeFreshFace;self.nativeFrameSerial=nativeFrameSerial;self.timeScale=nativeFreshFace ? 1:timeScale;self.capturedDirection=capturedDirection;self.initialScale=nativeFreshFace ? 0:(initialScale ?? (preservesBoardSize ? 1:0.30))
    }
    var active: Bool { begun && !closed }
    private func current() -> Bool {
        guard !closed else { return false }
        let accepted = hooks.current()
        return accepted && !closed
    }
    @discardableResult func start() -> Bool {
        guard !begun,timeScale.isFinite,timeScale>0,initialScale.isFinite,(initialScale>0 || nativeFreshFace),initialScale<=1,
              capturedDirection == nil || capturedDirection == 1 || capturedDirection == -1,
              current(), service.sourceFrameTransportAdmissionOpen else { return false }
        begun = true
        // Production new faces, including converted survivors, use fresh entry.
        // Source-reference callers can explicitly retain their original scale.
        // Source-reference defaults and write/draw order remain unchanged.
        hooks.ensureFullOpacity(); guard current() else { finish(.unavailable); return false }
        hooks.paintScale(initialScale); guard current() else { finish(.unavailable); return false }
        if let capturedDirection {direction=Double(capturedDirection)}
        else {
            let roll = hooks.random()
            guard current(), roll.isFinite, roll >= 0, roll < 1 else { finish(.unavailable); return false }
            direction = roll < 0.5 ? 1 : -1
        }
        let release = hooks.acquireFrames()
        guard current(), let release else {
            release?(); finish(.unavailable); return false
        }
        releaseFrames = release
        let participant = Participant()
        self.participant = participant
        participant.advance = { [weak self] seconds in self?.paint(seconds) }
        let cleanup:(Bool)->Void = { [weak self] success in self?.finish(success ? .completed : .interrupted) }
        let registered = nativeFreshFace
            ? service.registerFreshFace(participant:participant,duration:0.56,frameSerial:nativeFrameSerial,cleanup:cleanup)
            : service.register(participant:participant,duration:0.56/timeScale,domain:.sourceGSAP(.timeline),cleanup:cleanup)
        guard current(), let registered else {
            registered?.cancel(); finish(.unavailable); return false
        }
        lease = registered
        return true
    }
    private func paint(_ seconds: Double) {
        guard current() else { interrupt(); return }
        if childrenRemoved {
            // Literal gsap.killTweensOf(scale), then rotG, removes all children
            // but does not kill their parent timeline. Its onComplete runs at
            // the next genuine Source root delivery, not during pointerDown.
            if let captured=lease {captured.cancel(success:true)} else {finish(.completed)}
            return
        }
        // GSAP initializes the first rotation tween at the first delivered root
        // flush. A concurrent accepted same-node write before it is observable.
        if initialRotation == nil {
            let captured = hooks.readRotation()
            guard current(), let captured, captured.isFinite else { interrupt(); return }
            initialRotation = captured
        }
        guard let initialRotation else { return }
        hooks.paintScale(nativeFreshFace ? Self.freshFaceScale(seconds):Self.scale(seconds*timeScale,initialScale:initialScale)); guard current() else { interrupt(); return }
        hooks.paintRotation(Self.rotation(seconds*timeScale, initial: initialRotation, direction: direction))
        guard current() else { interrupt(); return }
        hooks.ensureFullOpacity(); if !current() { interrupt() }
    }
    private func finish(_ completion: Completion) {
        guard !closed else { return }
        // Seal and unhook before any external paint/release/Promise continuation.
        closed = true
        let capturedLease = lease; lease = nil
        participant?.advance = nil; participant = nil
        let release = releaseFrames; releaseFrames = nil
        if completion != .completed { capturedLease?.cancel() }
        // Host predicate contains the captured node/entry identity and does
        // not depend on this already-sealed owner's `active` property.
        if hooks.current() {
            hooks.paintScale(1)
            if hooks.current() {
                if completion != .completed { hooks.paintRotation(0) }
                if hooks.current() { hooks.ensureFullOpacity() }
            }
        }
        release?()
        hooks.finished(completion)
    }
    func removeChildrenForPickup() {guard active else{return};childrenRemoved=true}
    func interrupt() { finish(.interrupted) }
    isolated deinit { interrupt() }

    private static func sine(_ t: Double) -> Double { -(cos(.pi*t)-1)/2 }
    private static func mix(_ a: Double, _ b: Double, _ t: Double) -> Double { floor((a+(b-a)*t)*1_000_000+0.5)/1_000_000 }
    /// A zero-size Native face needs visible growth, not Source back-out's
    /// steep initial slope (already108percent by the second30Hz frame).
    /// Retain the180ms arrival and every authored overshoot/settle endpoint.
    static func freshFaceScale(_ seconds:Double)->Double {
        let t=max(0,seconds)
        if t<0.18 {return mix(0,1.08,sine(t/0.18))}
        return scale(t,initialScale:0)
    }
    static func scale(_ seconds: Double,preservesBoardSize:Bool=false,initialScale:Double?=nil) -> Double {
        let t = max(0, seconds)
        if t < 0.18 {
            let u = min(1,t/0.18)-1
            let ease = 1+u*u*(2.7*u+1.7)
            return mix(initialScale ?? (preservesBoardSize ? 1:0.30),1.08,ease)
        }
        if t < 0.30 { return mix(1.08,0.96,sine((t-0.18)/0.12)) }
        if t < 0.42 { return mix(0.96,1.02,sine((t-0.30)/0.12)) }
        if t < 0.56 { return mix(1.02,1,sine((t-0.42)/0.14)) }
        return 1
    }
    static func rotation(_ seconds: Double, initial: Double, direction: Double) -> Double {
        let t = max(0, seconds)
        if t < 0.12 { return mix(initial,0.035*direction,1-pow(1-t/0.12,3)) }
        if t < 0.28 { return mix(0.035*direction,-0.021*direction,sine((t-0.12)/0.16)) }
        if t < 0.48 { return mix(-0.021*direction,0,sine((t-0.28)/0.20)) }
        return 0
    }
}
