import Foundation

/// Width and spring are separate authored roots. Full bounce is born at the
/// received gain completion, including frame quantization and delayed delivery.
@MainActor final class NativeWildMeterGainOwner {
    private let driver: any NativeWildMeterHUDDriving
    private let drawWidth: (Double) -> Void, drawBounce: (Double) -> Void
    private let startSmoke: () -> Void, stopEmission: () -> Void
    private var cancelGain: (() -> Void)?, cancelSpring: (() -> Void)?
    private var closed=false
    private var generation: UInt64 = 0
    private(set) var width: Double
    init(driver: any NativeWildMeterHUDDriving, initialWidth: Double,
         drawWidth: @escaping(Double) -> Void, drawBounce: @escaping(Double) -> Void,
         startSmoke: @escaping() -> Void, stopEmission: @escaping() -> Void) {
        self.driver = driver; width = initialWidth; self.drawWidth = drawWidth
        self.drawBounce = drawBounce; self.startSmoke = startSmoke; self.stopEmission = stopEmission
    }
    private func retire() {
        generation &+= 1
        let gain = cancelGain, spring = cancelSpring
        cancelGain = nil; cancelSpring = nil
        gain?(); spring?()
    }
    func setProgress(_ ratio: Double, animated: Bool, maximum: Double, isPad: Bool) {
        guard !closed else{return}
        retire(); let captured = generation
        drawBounce(0); stopEmission()
        guard generation == captured else { return }
        let plan = NativeWildMeterGainPlan(maximum: maximum, initial: width, ratio: ratio, isPad: isPad)
        guard animated else { width = plan.target; drawWidth(width); return }
        if plan.growing { startSmoke() }
        guard generation == captured else { return }
        if plan.bounceTrigger == .atStart { spring(plan, captured: captured) }
        guard generation == captured else { return }
        let receipt = driver.start(duration: plan.duration, family: plan.growing ? .timeline : .defaultLazyTween, paint: { [weak self] seconds in
            guard let self, self.generation == captured else { return }
            self.width = plan.width(seconds: seconds); self.drawWidth(self.width)
        }, completed: { [weak self] in
            guard let self, self.generation == captured else { return }
            self.cancelGain = nil; self.width = plan.target; self.drawWidth(self.width)
            guard self.generation == captured else { return }
            if plan.bounceTrigger == .afterActualCompletion { self.spring(plan, captured: captured) }
            guard self.generation == captured else { return }
            self.stopEmission()
        }, interrupted: {})
        if generation == captured { cancelGain = receipt } else { receipt?() }
    }
    private func spring(_ plan: NativeWildMeterGainPlan, captured: UInt64) {
        guard !closed else{return}
        let old = cancelSpring; cancelSpring = nil; old?()
        guard generation == captured else { return }
        let receipt = driver.start(duration: 0.58, paint: { [weak self] seconds in
            guard let self, self.generation == captured else { return }
            self.drawBounce(plan.bounce(secondsSinceBirth: seconds))
        }, completed: { [weak self] in
            guard let self, self.generation == captured else { return }
            self.cancelSpring = nil
        }, interrupted: {})
        if generation == captured { cancelSpring = receipt } else { receipt?() }
    }
    func adoptPaintedWidth(_ value: Double) { guard !closed else{return};width = value }
    func retireForConsumption(reducedMotion: Bool) {
        guard !closed else{return}
        retire()
        if !reducedMotion { drawBounce(0) }
    }
    func playVerticalBounce(maximum: Double) {
        spring(NativeWildMeterGainPlan(maximum: maximum, initial: width, ratio: 1, isPad: false), captured: generation)
    }
    func dispose() { guard !closed else{return};closed=true;retire(); stopEmission() }
    isolated deinit {cancelGain?();cancelSpring?()}
}
