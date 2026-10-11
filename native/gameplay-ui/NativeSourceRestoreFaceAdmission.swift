import Foundation

/// Narrow native bridge guard: existing Source setValue checks its target at
/// synchronous installation, while a delivered RAF requires actual adoption.
struct NativeSourceRestoreFaceAdmission {
    static func permits(installing:Bool,building:Bool,adopted:Bool)->Bool {
        (installing && building) || adopted
    }
}
