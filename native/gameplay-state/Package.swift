// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "StackToSixNativeState", platforms: [.iOS(.v15), .macOS(.v13)], products: [.library(name: "StackToSixNativeState", targets: ["StackToSixNativeState"])], dependencies: [.package(path: "../gameplay-core")], targets: [.target(name: "StackToSixNativeState", dependencies: [.product(name: "StackToSixGameplay", package: "gameplay-core")], resources: [.process("Resources")]), .testTarget(name: "StackToSixNativeStateTests", dependencies: ["StackToSixNativeState"], resources: [.process("Resources")])])
