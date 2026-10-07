// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "StackToSixGameplay", products: [.library(name: "StackToSixGameplay", targets: ["StackToSixGameplay"])], targets: [.target(name: "StackToSixGameplay"), .testTarget(name: "StackToSixGameplayTests", dependencies: ["StackToSixGameplay"])])
