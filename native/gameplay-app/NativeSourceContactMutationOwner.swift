import Foundation

/// Literal app-core8295 counter. App lifetime; board resets do not reset it.
/// Only actual accepted external contact invokes advance, never Core revision,
/// timers, visual completion, internal pulled merges or recursive main80 drop.
@MainActor final class NativeSourceContactMutationOwner {
    private(set) var revision:Double=0
    private var disposed=false
    @discardableResult func acceptedExternalContact()->Double? {
        guard !disposed else{return nil};revision += 1;return revision
    }
    func dispose(){disposed=true}
}
