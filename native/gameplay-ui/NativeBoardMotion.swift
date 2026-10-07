import SpriteKit

/// Exact GSAP power2/back easing and accepted regular stack tuning.
enum NativeBoardMotion {
    enum Ease {
        case linear, sineInOut, power2In, power2Out, power2InOut, elasticOut(CGFloat,CGFloat), backIn(CGFloat), backOut(CGFloat)
        func sample(_ progress: CGFloat) -> CGFloat {
            let t = min(1, max(0, progress))
            switch self {
            case .linear: return t
            case .sineInOut: return -(cos(.pi*t)-1)/2
            case .power2In: return t * t * t
            case .power2Out: return 1 - pow(1 - t, 3)
            case .power2InOut: return t < 0.5 ? 4*t*t*t : 1-pow(-2*t+2,3)/2
            case .elasticOut(let amplitude,let period):
                if t == 0 || t == 1 { return t }
                // GSAP Elastic clamps amplitude below one to one.
                let a = max(1,amplitude), p = max(0.0001,period)
                let shift = p/(2 * .pi)*asin(1/a)
                return a*pow(2,-10*t)*sin((t-shift)*2 * .pi/p)+1
            case .backIn(let strength): return t * t * ((strength + 1) * t - strength)
            case .backOut(let strength):
                let shifted = t - 1
                return 1 + shifted * shifted * ((strength + 1) * shifted + strength)
            }
        }
    }

    static func scale(from: CGPoint, to: CGPoint, duration: TimeInterval, ease: Ease) -> SKAction {
        .customAction(withDuration: duration) { node, elapsed in
            let progress = ease.sample(CGFloat(elapsed) / CGFloat(max(0.0001, duration)))
            node.xScale = from.x + (to.x - from.x) * progress
            node.yScale = from.y + (to.y - from.y) * progress
        }
    }

    static func move(from: CGPoint, to: CGPoint, duration: TimeInterval, ease: Ease) -> SKAction {
        .customAction(withDuration: duration) { node, elapsed in
            let progress = ease.sample(CGFloat(elapsed) / CGFloat(max(0.0001, duration)))
            node.position = CGPoint(x: from.x + (to.x-from.x)*progress, y: from.y + (to.y-from.y)*progress)
        }
    }

    static func rejectedLanding() -> SKAction {
        .sequence([
            scale(from: CGPoint(x: 1,y: 1),to: CGPoint(x: 1.035,y: 0.965),duration: 0.13,ease: .power2In),
            scale(from: CGPoint(x: 1.035,y: 0.965),to: CGPoint(x: 1,y: 1),duration: 0.105,ease: .backOut(2.5))
        ])
    }

    static func stack(squash: Bool) -> SKAction {
        // src/modules/gameplay-tile-cartoon-motion.ts, strength 1.3.
        let raw: [CGPoint] = squash
            ? [CGPoint(x: 0.95, y: 1.055), CGPoint(x: 1.1, y: 0.96), CGPoint(x: 0.985, y: 1.025)]
            : [CGPoint(x: 1.06, y: 0.95), CGPoint(x: 0.965, y: 1.1), CGPoint(x: 1.025, y: 0.985)]
        let poses = raw.map { CGPoint(x: 1 + ($0.x - 1) * 1.3, y: 1 + ($0.y - 1) * 1.3) }
        return .sequence([
            scale(from: CGPoint(x: 1, y: 1), to: poses[0], duration: 0.065, ease: .power2Out),
            scale(from: poses[0], to: poses[1], duration: 0.09, ease: .backOut(1.65)),
            scale(from: poses[1], to: poses[2], duration: 0.13, ease: .power2Out),
            scale(from: poses[2], to: CGPoint(x: 1, y: 1), duration: 0.18, ease: .backOut(1.9))
        ])
    }

    static func enter(base: CGFloat = 1) -> SKAction {
        let zero = CGPoint.zero, peak = CGPoint(x: base*1.08,y: base*1.08)
        let compress = CGPoint(x: base*0.96,y: base*0.96), rebound = CGPoint(x: base*1.02,y: base*1.02)
        return .sequence([
            scale(from: zero,to: peak,duration: NativeBoardEntryPlan.grow,ease: .backOut(1.7)),
            scale(from: peak,to: compress,duration: NativeBoardEntryPlan.compress,ease: .sineInOut),
            scale(from: compress,to: rebound,duration: NativeBoardEntryPlan.rebound,ease: .sineInOut),
            scale(from: rebound,to: CGPoint(x: base,y: base),duration: NativeBoardEntryPlan.settle,ease: .sineInOut)
        ])
    }

    static func spawnBounce(direction: CGFloat = Bool.random() ? 1 : -1) -> SKAction {
        let scale = SKAction.sequence([
            Self.scale(from: CGPoint(x: 0.30,y: 0.30),to: CGPoint(x: 1.08,y: 1.08),duration: 0.18,ease: .backOut(1.7)),
            Self.scale(from: CGPoint(x: 1.08,y: 1.08),to: CGPoint(x: 0.96,y: 0.96),duration: 0.12,ease: .sineInOut),
            Self.scale(from: CGPoint(x: 0.96,y: 0.96),to: CGPoint(x: 1.02,y: 1.02),duration: 0.12,ease: .sineInOut),
            Self.scale(from: CGPoint(x: 1.02,y: 1.02),to: CGPoint(x: 1,y: 1),duration: 0.14,ease: .sineInOut)
        ])
        let rotation = SKAction.sequence([
            Self.rotate(from: 0,to: -0.035*direction,duration: 0.12,ease: .power2Out),
            Self.rotate(from: -0.035*direction,to: 0.035*0.6*direction,duration: 0.16,ease: .sineInOut),
            Self.rotate(from: 0.035*0.6*direction,to: 0,duration: 0.20,ease: .sineInOut)
        ])
        return .group([scale,rotation])
    }

    static func rotate(from: CGFloat,to: CGFloat,duration: TimeInterval,ease: Ease) -> SKAction {
        .customAction(withDuration: duration) { node, elapsed in
            let progress = ease.sample(CGFloat(elapsed)/CGFloat(max(0.0001,duration)))
            node.zRotation = from+(to-from)*progress
        }
    }

    static func fade(from: CGFloat,to: CGFloat,duration: TimeInterval,ease: Ease) -> SKAction {
        .customAction(withDuration: duration) { node, elapsed in
            let progress = ease.sample(CGFloat(elapsed)/CGFloat(max(0.0001,duration)))
            node.alpha = from+(to-from)*progress
        }
    }

    static func exit(from pose: CGPoint = CGPoint(x: 1, y: 1)) -> SKAction {
        let peak = CGPoint(x: 1.18, y: 1.15)
        return .sequence([
            scale(from: pose, to: peak, duration: 0.15, ease: .power2In),
            scale(from: peak, to: .zero, duration: 0.28, ease: .backIn(1.7))
        ])
    }
}
