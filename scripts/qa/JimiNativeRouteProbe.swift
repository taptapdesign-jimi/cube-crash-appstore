import UIKit

// QA fixture only: copy into the temporary Simulator project, not production.
// The route owner must cancel on background/disposal and finish on every terminal
// path. There are no notification observers, timers, animation or routing writes.
#if DEBUG && targetEnvironment(simulator)
@MainActor
final class JimiNativeRouteProbe {
    static var enabled: Bool {
        ProcessInfo.processInfo.arguments.contains("--jimi-native-route-probe") &&
        ProcessInfo.processInfo.environment["SIMULATOR_UDID"] == "1018BE2D-491B-465F-8F75-3E5BEB38C22A"
    }

    private static let sampleLimit = 512
    private static let maximumDuration = 10.0

    // CADisplayLink retains its target. A weak proxy allows owner disposal to
    // invalidate the link rather than retaining the probe until another tick.
    @MainActor private final class Target: NSObject {
        weak var owner: JimiNativeRouteProbe?
        @objc func tick(_ link: CADisplayLink) { owner?.sample() }
    }

    private let target = Target()
    private var link: CADisplayLink?
    private var requestID: Int?
    private var label = ""
    private var startedAt = 0.0
    private var startedUnixTime = 0.0
    private var previousCallback: Double?
    private var firstCallbackLatency: Double?
    private var bridgeReadyAt: Double?
    private var motionStartedAt: Double?
    private var intervals: [Double] = []
    private var worstIntervalEndAt: Double?
    private var worstInterval = 0.0

    init() { target.owner = self }

    deinit { link?.invalidate() }

    func start(label: String, requestID: Int) {
        guard Self.enabled else { return }
        cancel(reason: "replaced")
        self.label = String(label.prefix(120))
        self.requestID = requestID
        intervals.removeAll(keepingCapacity: true)
        intervals.reserveCapacity(Self.sampleLimit)
        previousCallback = nil
        firstCallbackLatency = nil
        bridgeReadyAt = nil
        motionStartedAt = nil
        worstIntervalEndAt = nil
        worstInterval = 0
        startedAt = CACurrentMediaTime()
        startedUnixTime = Date().timeIntervalSince1970
        let displayLink = CADisplayLink(target: target, selector: #selector(Target.tick(_:)))
        // Do not request a different frame rate: observe the route's normal
        // callback scheduling, not a probe-selected refresh-rate policy.
        link = displayLink
        displayLink.add(to: .main, forMode: .common)
    }

    func markBridgeReady(requestID: Int) {
        guard self.requestID == requestID, bridgeReadyAt == nil else { return }
        bridgeReadyAt = elapsedMilliseconds()
    }

    func markMotionStart(requestID: Int) {
        guard self.requestID == requestID, motionStartedAt == nil else { return }
        motionStartedAt = elapsedMilliseconds()
    }

    func finish(requestID: Int, outcome: String = "complete") {
        guard self.requestID == requestID else { return }
        end(outcome: outcome)
    }

    func cancel(reason: String) {
        guard requestID != nil else { return }
        end(outcome: "cancelled:" + String(reason.prefix(100)))
    }

    private func elapsedMilliseconds() -> Double {
        (CACurrentMediaTime() - startedAt) * 1000
    }

    private func sample() {
        guard requestID != nil else { return }
        // Actual callback entry time, not a scheduled display-link timestamp.
        let now = CACurrentMediaTime()
        if let previousCallback {
            let interval = (now - previousCallback) * 1000
            intervals.append(interval)
            if interval > worstInterval {
                worstInterval = interval
                worstIntervalEndAt = (now - startedAt) * 1000
            }
        } else {
            firstCallbackLatency = (now - startedAt) * 1000
        }
        previousCallback = now
        if intervals.count >= Self.sampleLimit {
            end(outcome: "sample-limit")
        } else if now - startedAt >= Self.maximumDuration {
            end(outcome: "duration-limit")
        }
    }

    private func end(outcome: String) {
        guard let requestID else { return }
        let duration = elapsedMilliseconds()
        link?.invalidate()
        link = nil
        self.requestID = nil // Retire before formatting or publishing the row.
        let sorted = intervals.sorted()
        let percentileIndex = max(0, Int(ceil(Double(sorted.count) * 0.95)) - 1)
        func value(_ number: Double?) -> Any { number.map { $0 as Any } ?? NSNull() }
        let row: [String: Any] = [
            "schema": "jimi-native-route-callbacks-v1",
            "label": label,
            "requestId": requestID,
            "outcome": String(outcome.prefix(120)),
            "measurement": "CADisplayLink callback cadence, not displayed FPS",
            "environment": "isolated iOS Simulator; XCUITest and native observer overhead may contribute",
            "durationMs": duration,
            "startedUnixTime": startedUnixTime,
            "endedUnixTime": Date().timeIntervalSince1970,
            "firstCallbackLatencyMs": value(firstCallbackLatency),
            "bridgeReadyMs": value(bridgeReadyAt),
            "motionStartMs": value(motionStartedAt),
            "callbackIntervalCount": intervals.count,
            "callbackIntervalsMs": intervals,
            "worstCallbackIntervalMs": value(sorted.last),
            "p95CallbackIntervalMs": value(sorted.isEmpty ? nil : sorted[percentileIndex]),
            "worstIntervalEndMs": value(worstIntervalEndAt),
            "terminalCallbackAgeMs": value(previousCallback.map { (startedAt + duration / 1000 - $0) * 1000 }),
            "callbackIntervalsOver25Ms": intervals.filter { $0 > 25 }.count,
            "callbackIntervalsOver50Ms": intervals.filter { $0 > 50 }.count,
            "sampleLimit": Self.sampleLimit
        ]
        intervals.removeAll(keepingCapacity: true)
        guard let data = try? JSONSerialization.data(withJSONObject: row, options: [.sortedKeys]),
              let text = String(data: data, encoding: .utf8) else { return }
        // Write each complete row immediately; redirected printf may buffer
        // the final cohort until process termination and lose its evidence.
        FileHandle.standardOutput.write(Data(("[JIMI_NATIVE_ROUTE] " + text + "\n").utf8))
    }
}
#endif
