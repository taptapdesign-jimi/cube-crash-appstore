import Foundation

/// One immutable APP Math.random function binding. Every genuine logical or FX
/// caller invokes this same function at its actual callsite. The stream exposes
/// no seed, reset, rewind, count-derived skip or per-Scene fork. Raw callers do
/// not receive it. Provider contract is the original Math.random interval0..<1.
public final class NativeSourceMathRandomStream {
    private let draw:()->Double
    public init(draw:@escaping()->Double){self.draw=draw}
    public func next()->Double {draw()}
}
