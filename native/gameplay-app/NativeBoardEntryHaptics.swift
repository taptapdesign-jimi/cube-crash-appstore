import UIKit

/// One finite entry clock emits the captured source beat schedule. Retiring a
/// board retires its outstanding beats; enabling haptics does not replay them.
@MainActor
final class NativeBoardEntryHaptics:NativeFinitePresentation {
    private let beats:[TimeInterval]
    private var sent=0
    var onImpact:(()->Void)?
    init(duration:TimeInterval,beats:[TimeInterval]) {
        self.beats=beats.filter{$0.isFinite && $0>=0 && $0<=duration}.sorted()
        super.init(viewport:.zero,duration:max(0.001,duration))
        accessibilityElementsHidden=true
    }
    required init?(coder:NSCoder) {fatalError("Use captured native beat schedule")}
    override func paint(seconds:TimeInterval) {
        while sent<beats.count,seconds>=beats[sent] {sent += 1;onImpact?()}
    }
    override func dispose() {onImpact=nil;super.dispose()}
}
