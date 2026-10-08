import Foundation

/// One HUD coordinator; gameplay charge remains external. Original consume and
/// gain roots share painted width, but never duplicate active animations.
@MainActor final class NativeWildMeterHUDOwner {
    private let driver: NativeWildMeterSourceDriver
    private let maximum: Double, isPad: Bool
    private let draw: (NativeWildMeterConsumptionPlan.Pose) -> Void, drawBounce: (Double) -> Void
    private let stopSmoke: () -> Void, stopEmission: () -> Void, startSmoke: () -> Void
    private(set) var width: Double
    private var disposed = false
    private lazy var gain = NativeWildMeterGainOwner(driver: driver, initialWidth: width,
        drawWidth: { [weak self] width in self?.paint(.init(left: 0, width: width)) },
        drawBounce: drawBounce, startSmoke: startSmoke, stopEmission: stopEmission)
    private lazy var consumption = NativeWildMeterConsumptionOwner(driver: driver, maximum: maximum, initialWidth: width,
        draw: { [weak self] pose in self?.paint(pose) },
        prepareConsume: { [weak self] _ in self?.gain.retireForConsumption(reducedMotion: true) },
        resetBounce: { [weak self] in self?.drawBounce(0) },
        prepareReset: { [weak self] in self?.gain.retireForConsumption(reducedMotion: false) },
        stopSmoke: stopSmoke, stopEmission: stopEmission, startSmoke: startSmoke,
        bounce: { [weak self] in guard let self else { return }; self.gain.playVerticalBounce(maximum: self.maximum) })
    init(driver: NativeWildMeterSourceDriver, maximum: Double, initialWidth: Double, isPad: Bool,
         draw: @escaping(NativeWildMeterConsumptionPlan.Pose) -> Void, drawBounce: @escaping(Double) -> Void,
         stopSmoke: @escaping() -> Void, stopEmission: @escaping() -> Void, startSmoke: @escaping() -> Void) {
        self.driver = driver; self.maximum = maximum; width = initialWidth; self.isPad = isPad
        self.draw = draw; self.drawBounce = drawBounce; self.stopSmoke = stopSmoke
        self.stopEmission = stopEmission; self.startSmoke = startSmoke
    }
    private func paint(_ pose: NativeWildMeterConsumptionPlan.Pose) {
        guard !disposed else { return }
        width = pose.width; draw(pose)
    }
    func setProgress(_ ratio: Double, animated: Bool) {
        guard !disposed else { return }
        if consumption.active {
            if consumption.acceptProgress(ratio, animated: animated) {
                return
            }
        }
        gain.adoptPaintedWidth(width)
        gain.setProgress(ratio, animated: animated, maximum: maximum, isPad: isPad)
    }
    func consume(_ ratio: Double, reducedMotion: Bool = false) {
        guard !disposed else { return }
        if !consumption.active { consumption.adoptPaintedWidth(width) }
        consumption.consume(ratio, reducedMotion: reducedMotion)
    }
    var consumeActive: Bool { consumption.active }
    var pendingRatio: Double? { consumption.pending }
    var queuedRatios: [Double] { consumption.queue }
    func dispose() {
        guard !disposed else { return }; disposed = true
        consumption.dispose(); gain.dispose()
    }
}
