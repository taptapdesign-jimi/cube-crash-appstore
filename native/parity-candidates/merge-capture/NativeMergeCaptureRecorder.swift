import Foundation
import QuartzCore

/// Opt-in debug evidence only. No gameplay decision, frame target or timer.
/// The caller delivers existing Scene callbacks; disk writes occur only at
/// background/dispose boundaries and run on one serial utility queue.
@MainActor
final class NativeMergeCaptureRecorder {
    struct Record: Codable {
        let seconds: Double, kind: String, detail: String
        let value: Double, targetFPS: Int
    }
    struct Snapshot: Codable {
        let schema: Int, session: String, reason: String, startedAt: Date
        let recordsSeen: Int, droppedRecords: Int, records: [Record]
        let timingMeaning: String
    }
    private static let writer = DispatchQueue(label: "native.merge.capture.disk", qos: .utility)
    private let enabled: Bool, capacity: Int, session = UUID().uuidString
    private let start = CACurrentMediaTime(), startedAt = Date()
    private var ring: [Record?], seen = 0, lastFrame: Double?
    var recordedCount: Int { min(seen, capacity) }
    init(enabled: Bool = ProcessInfo.processInfo.arguments.contains("--native-merge-capture"), capacity: Int = 8192) {
        self.enabled = enabled; self.capacity = max(1, capacity)
        ring = enabled ? Array(repeating: nil, count: max(1, capacity)) : []
    }
    func event(_ kind: String, detail: String = "", value: Double = 0, targetFPS: Int = 0) {
        guard enabled else { return }
        ring[seen % capacity] = Record(seconds: CACurrentMediaTime()-start, kind: kind, detail: detail, value: value, targetFPS: targetFPS)
        seen += 1
    }
    func frame(now: Double, targetFPS: Int) {
        guard enabled else { return }
        if let lastFrame { event("frame-gap", value: max(0, now-lastFrame)*1000, targetFPS: targetFPS) }
        lastFrame = now
    }
    func suspend() { event("suspend"); lastFrame = nil; flush(reason: "suspend") }
    func resume() { lastFrame = nil; event("resume") }
    func snapshot(reason: String) -> Snapshot {
        let count = recordedCount, first = max(0, seen-capacity)
        return Snapshot(schema: 1, session: session, reason: reason, startedAt: startedAt,
                        recordsSeen: seen, droppedRecords: max(0, seen-capacity),
                        records: (0..<count).compactMap { ring[(first+$0) % capacity] },
                        timingMeaning: "Scene callback intervals and CPU section durations; not presented GPU FPS")
    }
    func flush(reason: String) {
        guard enabled else { return }
        let captured = snapshot(reason: reason)
        Self.writer.async {
            do {
                let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                    .appendingPathComponent("NativeMergeCapture", isDirectory: true)
                try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
                let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
                let bytes = try encoder.encode(captured)
                try bytes.write(to: root.appendingPathComponent("latest.json"), options: .atomic)
                NSLog("[NATIVE_MERGE_CAPTURE] saved records=%d dropped=%d reason=%@", captured.records.count, captured.droppedRecords, captured.reason)
            } catch { NSLog("[NATIVE_MERGE_CAPTURE] save failed %@", String(describing: error)) }
        }
    }
}
