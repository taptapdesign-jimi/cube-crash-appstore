import SpriteKit
import UIKit

/// Finite PWA number-only balloon, advanced by the visible Scene's existing clock.
/// No actions, timers, gameplay mutations, random draws or retained HUD nodes.
@MainActor
final class NativeComboNumberMotion {
    enum Kind { case stack, mergeSix }
    private enum Phase {
        case balloon(from:Double,peak:Double,rise:Double)
        case lost(from:Double)
    }
    private weak var number:SKLabelNode?
    private var generation:UInt64?
    private var combo=0,elapsed:Double=0
    private var phase:Phase?
    var isActive:Bool {phase != nil}
    init(number:SKLabelNode){self.number=number}

    func synchronize(combo:Int,generation:UInt64,reducedMotion:Bool) {
        if self.generation != generation {
            stop();self.generation=generation;self.combo=combo;return
        }
        if combo==0,self.combo>0 {
            if reducedMotion {stop()}else {phase = .lost(from:Double(number?.xScale ?? 1));elapsed=0}
        }
        self.combo=combo
        if reducedMotion {stop()}
    }
    func bump(kind:Kind,combo:Int,generation:UInt64,reducedMotion:Bool) {
        guard combo>0 else{return}
        if self.generation != generation {stop();self.generation=generation}
        self.combo=combo
        guard !reducedMotion else{stop();return}
        let current=max(Double(number?.xScale ?? 1),Double(number?.yScale ?? 1))
        var peak=kind == .mergeSix ? 2.50:1.76
        if combo>=10 {peak=min(3.20,peak*(1+min(0.40,0.20+Double(combo-10)*0.02)))}
        phase = .balloon(from:current,peak:peak,rise:max(0.08,0.16-(current-1)*0.06))
        elapsed=0
    }
    @discardableResult func advance(delta:Double,visible:Bool,reducedMotion:Bool)->Bool {
        guard visible,let phase else{return false}
        if reducedMotion {stop();return true}
        guard delta.isFinite else{return false}
        elapsed+=max(0,delta)
        let value:Double,finished:Bool
        switch phase {
        case .balloon(let from,let peak,let rise):
            // GSAP starts the2.10s deflate10ms before the inflate finishes.
            let downStart=max(0,rise-0.01)
            if elapsed<downStart {
                value=from+(peak-from)*Double(NativeBoardMotion.Ease.backOut(3).sample(CGFloat(elapsed/rise)))
                finished=false
            }else{
                let atStart=from+(peak-from)*Double(NativeBoardMotion.Ease.backOut(3).sample(CGFloat(downStart/rise)))
                let t=min(1,(elapsed-downStart)/2.10)
                value=atStart+(1-atStart)*(1-pow(1-t,3));finished=t>=1
            }
        case .lost(let from):
            let t=min(1,elapsed/1.40)
            value=from+(1-from)*Double(NativeBoardMotion.Ease.elasticOut(1,0.9).sample(CGFloat(t)));finished=t>=1
        }
        number?.setScale(CGFloat(value))
        if finished {self.phase=nil;number?.setScale(1)}
        return true
    }
    func stop(){phase=nil;elapsed=0;number?.setScale(1)}
}
