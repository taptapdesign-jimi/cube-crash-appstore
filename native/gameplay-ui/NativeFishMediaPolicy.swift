import Foundation

/// Original Fish module availability bit; it retains no media or graphics.
/// Tests can supply an isolated capability owner for deliberately broken files.
@MainActor
final class NativeFishMediaPolicy {
    static let shared=NativeFishMediaPolicy()
    private(set) var useHEVC=true
    func recordVideoSourceError(){useHEVC=false}
}
