import Foundation

/// Shared artwork contracts run against either packaged product's original bytes.
/// Native QA never requires the archived Web.bundle.
enum NativeTestResources {
    static var root: URL {
        Bundle.main.url(forResource:"NativeAssets",withExtension:"bundle")
            ?? Bundle.main.bundleURL.appendingPathComponent("Web.bundle")
    }
}
