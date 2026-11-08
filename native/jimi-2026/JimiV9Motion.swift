import Foundation
import UIKit

/// Pure immutable v9 recipes, not an animation owner. A controller samples a
/// Track into its own CAKeyframes and owns cancellation/completion/input.
enum JimiV9Motion {
    enum Part { case hero, logo, shard, ctaContainer, cta, navigation, fixedShadow }

    enum Ease {
        case linear, powerIn(Int), powerOut(Int), backIn(Double), backOut(Double)
        case cubicBezier(Double, Double, Double, Double)

        func value(_ progress: Double) -> Double {
            let t = min(1, max(0, progress))
            switch self {
            case .linear: return t
            // GSAP power2 is cubic, power3 is quartic.
            case .powerIn(let power): return pow(t, Double(power + 1))
            case .powerOut(let power): return 1 - pow(1-t, Double(power + 1))
            case .backIn(let s): return t*t*((s+1)*t-s)
            case .backOut(let s):
                let u = t-1
                return 1 + u*u*((s+1)*u+s)
            case .cubicBezier(let x1, let y1, let x2, let y2):
                if t == 0 || t == 1 { return t }
                func cubic(_ u: Double, _ a: Double, _ b: Double) -> Double {
                    let v = 1-u
                    return 3*v*v*u*a + 3*v*u*u*b + u*u*u
                }
                var low = 0.0
                var high = 1.0
                // Monotone authored x curves; solve x(u)=time, not y(time).
                for _ in 0..<40 {
                    let middle = (low+high)/2
                    if cubic(middle, x1, x2) < t { low = middle } else { high = middle }
                }
                return cubic((low+high)/2, y1, y2)
            }
        }
    }

    struct Pose {
        var scaleX = 1.0
        var scaleY = 1.0
        var x = 0.0
        var y = 0.0
        var opacity = 1.0

        static func scale(_ value: Double, y: Double = 0, opacity: Double = 1) -> Pose {
            Pose(scaleX: value, scaleY: value, y: y, opacity: opacity)
        }

        func interpolated(to other: Pose, progress: Double) -> Pose {
            func blend(_ a: Double, _ b: Double) -> Double { a + (b-a)*progress }
            return Pose(scaleX: blend(scaleX, other.scaleX), scaleY: blend(scaleY, other.scaleY),
                        x: blend(x, other.x), y: blend(y, other.y), opacity: blend(opacity, other.opacity))
        }
    }

    struct Tween {
        let begin: Double
        let duration: Double
        let from: Pose
        let to: Pose
        let ease: Ease
    }

    struct Track {
        let tweens: [Tween]
        var anchorX = 0.5
        var anchorY = 0.5
        var duration: Double { tweens.map { $0.begin + $0.duration }.max() ?? 0 }

        func pose(at seconds: Double) -> Pose {
            guard let first = tweens.first else { return Pose() }
            var result = first.from
            for tween in tweens {
                if seconds < tween.begin { return result }
                if seconds < tween.begin + tween.duration {
                    return tween.from.interpolated(to: tween.to,
                        progress: tween.ease.value((seconds-tween.begin)/tween.duration))
                }
                result = tween.to
            }
            return result
        }
    }

    struct SampledTrack {
        let duration: Double
        let poses: [Pose]
        // nil preserves CA's existing evenly-spaced path, including zero-time tracks.
        let keyTimes: [Double]?
    }

    /// Keep authored samples at their original seconds. A shorter finite route
    /// animation can retain its terminal pose until its siblings retire without
    /// stretching a curve, adding motion, or extending the route completion gate.
    static func sampledTrack(_ track: Track, holdUntil: Double? = nil) -> SampledTrack {
        let samples = max(2, Int(ceil(track.duration * 240)))
        var poses = (0...samples).map { track.pose(at: Double($0) * track.duration / Double(samples)) }
        guard track.duration > 0, let heldDuration = holdUntil, heldDuration > track.duration else {
            return SampledTrack(duration: track.duration, poses: poses, keyTimes: nil)
        }
        var times = (0...samples).map { Double($0) * track.duration / Double(samples) / heldDuration }
        poses.append(poses.last!)
        times.append(1)
        return SampledTrack(duration: heldDuration, poses: poses, keyTimes: times)
    }

    static let homeEnterEase = Ease.cubicBezier(0.175, 0.885, 0.32, 1.275)
    static let homeExitEase = Ease.cubicBezier(0.60, -0.28, 0.735, 0.045)
    static func homeCloudPanoramaOffset(slideX:Double,width:Double,foreground:Bool)->Double {
        guard width>0 else{return 0}
        let page=max(0,min(2,1.5-slideX/width))
        return (page-1)*min(foreground ? 50:32,width*(foreground ? 0.12:0.08))*1.20*1.60*1.60*1.60
    }
    /// Cubic Hermite motion keeps velocity when a finger reverses or releases,
    /// then arrives with zero velocity. Sampled once into Core Animation.
    struct HomeCloudCurve {
        let start:Double,end:Double,initialVelocity:Double,duration:Double,delay:Double
        var staggered=false,followThrough=false
        var coastScale=1.0,returnScale=1.0,extraDistance=0.70
        private var glides:Bool {followThrough && abs(end-start)>0.5}
        private var coastDuration:Double {1.5*1.40/4.20*coastScale}
        private var returnDuration:Double {1.8*1.40/4.20*returnScale}
        // Idle exchange offsets never enter this curve. Bound release speed
        // and reject opposite-way carry so a fast retarget cannot fling clouds.
        private var releaseVelocity:Double {
            let direction=end>start ? 1.0:-1.0
            return direction*min(max(0,initialVelocity*direction),max(12,abs(end-start)*0.75))
        }
        private var waiting:Double {abs(releaseVelocity)>1 ? 0:delay}
        private var forwardDuration:Double {duration+coastDuration+(delay-waiting)}
        private var apex:Double {start+(end-start)*(1+extraDistance)}
        var totalDuration:Double {glides ? waiting+forwardDuration+returnDuration:delay+duration}
        func position(at elapsed:Double)->Double {
            let t=max(0,elapsed)
            if t>=totalDuration {return end}
            if glides {
                if t<waiting {return start}
                let age=t-waiting
                if age<forwardDuration {
                    let u=age/forwardDuration,u2=u*u,u3=u2*u
                    return start+(apex-start)*(3*u2-2*u3)+releaseVelocity*forwardDuration*(u3-2*u2+u)
                }
                let u=min(1,(age-forwardDuration)/returnDuration)
                return apex+(end-apex)*(3*u*u-2*u*u*u)
            }
            if staggered {
                if delay>0,t<delay {return start+initialVelocity*(t-t*t/(2*delay))}
                let origin=start+(delay>0 ? initialVelocity*delay/2:0)
                let speed=delay>0 ? 0:initialVelocity
                let u=max(0,min(1,(t-delay)/duration)),tail=1-u,distance=end-origin
                return origin+distance*(1-pow(tail,5))+(speed*duration-5*distance)*u*pow(tail,4)
            }
            if t<=delay {return start}
            let u=(t-delay)/duration,u2=u*u,u3=u2*u
            return start+(end-start)*(3*u2-2*u3)+initialVelocity*duration*(u3-2*u2+u)
        }
        func velocity(at elapsed:Double)->Double {
            let t=max(0,elapsed)
            if t>=totalDuration {return 0}
            if glides {
                if t<waiting {return 0}
                let age=t-waiting
                if age<forwardDuration {
                    let u=age/forwardDuration
                    return (apex-start)*(6*u-6*u*u)/forwardDuration+releaseVelocity*(3*u*u-4*u+1)
                }
                let u=min(1,(age-forwardDuration)/returnDuration)
                return (end-apex)*(6*u-6*u*u)/returnDuration
            }
            if staggered {
                if delay>0,t<delay {return initialVelocity*(1-t/delay)}
                let origin=start+(delay>0 ? initialVelocity*delay/2:0)
                let speed=delay>0 ? 0:initialVelocity
                let u=max(0,min(1,(t-delay)/duration)),tail=1-u,distance=end-origin
                return (5*distance*pow(tail,4)+(speed*duration-5*distance)*pow(tail,3)*(1-5*u))/duration
            }
            if t<delay {return 0}
            let u=(t-delay)/duration
            return (end-start)*(6*u-6*u*u)/duration+initialVelocity*(3*u*u-4*u+1)
        }
    }
    static func homeCloudSettlingProfile(index:Int)->(coast:Double,settle:Double,extra:Double) {
        let profiles:[(Double,Double,Double)]=[
            (0.75,1.25,0.30),(1.05,0.90,0.55),(1.30,1.60,0.85),
            (0.90,1.90,0.40),(1.45,1.10,0.95),(1.15,1.45,0.70)]
        return profiles[max(0,index)%profiles.count]
    }
    static func homeCloudTravelDuration(slot:Int,foreground:Bool)->Double {
        let durations=[0.46,0.74,0.52,0.84,0.60,0.40,0.68,0.55]
        return durations[max(0,min(7,slot))]*(foreground ? 0.80:1)
    }
    static let sliderDuration = 0.65
    static let cloudCascadeStagger=0.014
    static let sliderEase = Ease.powerOut(2)
    static let navigationSelectionDuration = 0.38
    static let navigationActiveSizeEase = Ease.powerOut(3)
    static let navigationInactiveSizeEase = Ease.powerOut(2)
    static let navigationOffsetEase = Ease.powerOut(3)
    static let navigationActiveY = -12.0
    static let heroSelectionDelay = 0.24
    static let dragThreshold = 100.0
    static let flickThresholdPointsPerMillisecond = 0.35
    static let edgeResistance = 0.1
    static let edgeLimitFraction = 0.03

    // slider-manager.ts@v9:322–340,943–969. The legacy 3% constant is
    // not used in that actual drag path; do not introduce an extra clamp.
    static func sliderDragDisplacement(selectedSlide: Int, distance: Double) -> Double {
        let edge = (selectedSlide == 0 && distance > 0) || (selectedSlide == 2 && distance < 0)
        return distance * (edge ? edgeResistance : 1)
    }

    static func sliderDragDestination(selectedSlide: Int, distance: Double, velocityPointsPerMillisecond: Double) -> Int {
        guard abs(distance) > dragThreshold || abs(velocityPointsPerMillisecond) >= flickThresholdPointsPerMillisecond else {
            return selectedSlide
        }
        let signal = distance != 0 ? distance : velocityPointsPerMillisecond
        return min(2, max(0, selectedSlide + (signal > 0 ? -1 : 1)))
    }

    /// The view exposes a neutral wrapper outside authored banner rotation.
    /// First World tick starts all reveals; independent World delays remain.
    static func hubBanner(worldID: Int, enter: Bool, width: Double, firstWorldStart: Double = 0.08,
                          reducedMotion: Bool = false) -> Track {
        guard !reducedMotion else { return one(delay: 0, duration: 0, from: Pose(), to: Pose(), ease: .linear) }
        let tucked = Pose(x: (worldID == 3 ? 0.64 : -0.64)*width)
        let delay = worldID == 2 ? 0.11 : worldID == 3 ? 0.22 : 0
        return enter
            ? one(delay: firstWorldStart+delay, duration: 0.72, from: tucked, to: Pose(), ease: .cubicBezier(0.2,0.88,0.32,1.08))
            : one(delay: 0, duration: 0.32, from: Pose(), to: tucked, ease: .cubicBezier(0.56,-0.22,0.78,0.34))
    }

    /// journey-boards-manager.ts@v9:10296–10345 and Hub Back's embedded
    /// NAV exit: collapse upward to the top-center pivot, not the World's
    /// downward/shallow exit. Incoming recipes are intentionally unchanged.
    /// Canonical Journey island contact-free route recipes, also used by navigation content.
    static func worldHubElementEnter(begin:Double=0,reducedMotion:Bool=false)->Track {
        .init(tweens:[.init(begin:begin,duration:reducedMotion ? 0.2:0.56,
            from:.scale(reducedMotion ? 0.96:0.65,y:reducedMotion ? 8:30,opacity:0),to:.scale(1),
            ease:reducedMotion ? .powerOut(1):.backOut(1.8))])
    }
    static func worldHubElementExit(begin:Double=0,selected:Bool=false,reducedMotion:Bool=false)->Track {
        let peak=Pose(scaleX:selected ? 1.18:1.144,scaleY:selected ? 1.15:1.12)
        let anticipation=reducedMotion ? 0.15:0.18,collapse=reducedMotion ? 0.28:0.336
        return .init(tweens:[.init(begin:begin,duration:anticipation,from:.scale(1),to:peak,ease:.powerIn(2)),
            .init(begin:begin+anticipation,duration:collapse,from:peak,to:.scale(0),ease:.backIn(1.7))],anchorY:0.54)
    }

    static func journeyNavigationExit(reducedMotion: Bool = false) -> Track {
        let track = one(delay: 0, duration: reducedMotion ? 0.16 : 0.48,
                        from: .scale(1), to: .scale(0.04, y: -10, opacity: 0),
                        ease: reducedMotion ? .powerIn(1) : .backIn(1.25))
        return Track(tweens: track.tweens, anchorY: 0)
    }

    // animations.ts:312–318,1402–1593; cta-system.ts:38–49,244–263.
    /// One finite route timeline owns every cloud; idle remains on its image.
    /// Pending/hidden incoming clouds stay hidden if the route is interrupted.
    @MainActor static func cloudCascade(on target:UIView,base:Track,enter:Bool,index:Int,stagger:Double=JimiV9Motion.cloudCascadeStagger) -> Track {
        let delay=0.100+Double(index)*stagger
        let painted=target.layer.presentation() ?? target.layer
        let t=painted.transform
        let dx=(base.anchorX-target.layer.anchorPoint.x)*target.bounds.width
        let dy=(base.anchorY-target.layer.anchorPoint.y)*target.bounds.height
        let start=Pose(scaleX:t.m11,scaleY:t.m22,x:t.m41+dx*(t.m11-1),
                       y:t.m42+dy*(t.m22-1),opacity:Double(painted.opacity))
        let hidden = !enter && (painted.opacity <= 0.001 || abs(t.m11) <= 0.001)
        if UIAccessibility.isReduceMotionEnabled {
            return one(delay:0,duration:0.16,from:enter ? .scale(0.96,opacity:0):start,
                to:hidden ? .scale(0,opacity:0):.scale(enter ? 1:0.96,opacity:enter ? 1:0),ease:.powerOut(1))
        }
        return Track(tweens:base.tweens.enumerated().map { i,tween in
            Tween(begin:tween.begin+delay,duration:tween.duration,
                  from:hidden ? .scale(0,opacity:0):(!enter && i == 0 ? start:tween.from),
                  to:hidden ? .scale(0,opacity:0):tween.to,ease:tween.ease)
        },anchorX:base.anchorX,anchorY:base.anchorY)
    }

    /// Bottom navigation retains its accepted rhythm independently of top-nav
    /// speed tuning. Individual controls own tracks; their parent stays at rest.
    @MainActor static func homeNavigation(enter:Bool,index:Int?,reducedMotion:Bool=false)->Track {
        let speed:Double=1.3
        let titleEntryDelay=0.10/speed,elementStagger=0.13/speed
        let duration=reducedMotion ? 0.16:0.56/speed
        let delay:Double
        if let index {
            delay=reducedMotion ? 0:(enter ? titleEntryDelay:0)+Double(index)*elementStagger
        } else {
            // Match the upper paper/divider exit placement only. Home icons
            // retain their own 1.3-speed order, durations and entry recipe.
            delay=enter || reducedMotion ? 0:JimiV9ArchedNavigationTitle.backgroundExitDelay
        }
        let hidden=Pose.scale(index == nil ? 1:(reducedMotion ? 0.96:0.65),y:reducedMotion ? 0:(index == nil ? 24:30),opacity:0)
        let rest=Pose.scale(index == nil ? 1.025:1)
        return one(delay:delay,duration:duration,from:enter ? hidden:rest,to:enter ? rest:hidden,
            ease:reducedMotion ? .powerOut(1):(enter ? .backOut(index == nil ? 1.7:1.8):.backIn(index == nil ? 1.7:1.8)))
    }

    static func homeEnter(_ part: Part) -> Track {
        switch part {
        case .navigation, .fixedShadow:
            return one(delay: 0, duration: 0.43, from: .scale(0), to: .scale(1), ease: homeEnterEase)
        case .hero, .logo, .shard:
            return one(delay: 0.045, duration: 0.65, from: .scale(0), to: .scale(1), ease: homeEnterEase)
        case .ctaContainer:
            return one(delay: 0.095, duration: 0.65, from: .scale(0), to: .scale(1), ease: homeEnterEase)
        case .cta:
            return one(delay: 0.095, duration: 0.34, from: .scale(0, y: 18, opacity: 0),
                       to: .scale(1), ease: .backOut(1.8))
        }
    }

    // animations.ts:563–724 + homepage-hero-motion.ts. No opacity fade on
    // shells; only the registered CTA visual has its own authored alpha tail.
    static func homeExit(_ part: Part, reducedMotion: Bool = false) -> Track {
        switch part {
        case .hero:
            let inflate = reducedMotion ? 0.15 : 0.18
            let collapse = reducedMotion ? 0.28 : 0.336
            let peak = Pose(scaleX: 1.18, scaleY: 1.15)
            return Track(tweens: [
                Tween(begin: 0, duration: inflate, from: .scale(1), to: peak, ease: .powerIn(2)),
                Tween(begin: inflate, duration: collapse, from: peak, to: .scale(0), ease: .backIn(1.7)),
            ], anchorY: 0.54)
        case .cta:
            return one(delay: 0.18, duration: 0.31, from: .scale(1),
                       to: .scale(0, y: 18, opacity: 0), ease: .backIn(1.75))
        case .ctaContainer:
            return one(delay: 0.18, duration: 0.46, from: .scale(1), to: .scale(0), ease: homeExitEase)
        case .logo, .shard:
            return one(delay: 0.21, duration: 0.46, from: .scale(1), to: .scale(0), ease: homeExitEase)
        case .navigation, .fixedShadow:
            return one(delay: 0.24, duration: 0.46, from: .scale(1), to: .scale(0), ease: homeExitEase)
        }
    }

    // slider-manager.ts:182–248, invoked only for accepted slide selection.
    static let selectedHeroBounce = Track(tweens: [
        Tween(begin: 0.24, duration: 0.18, from: .scale(1), to: .scale(1.065), ease: .backOut(1.55)),
        Tween(begin: 0.42, duration: 0.135, from: .scale(1.065), to: .scale(0.975), ease: .powerOut(2)),
        Tween(begin: 0.555, duration: 0.255, from: .scale(0.975), to: .scale(1), ease: .backOut(1.35)),
    ], anchorY: 0.65)

    /// Same selection bounce, half the scale excursion and100ms later.
    static let selectedCTABounce = Track(tweens:selectedHeroBounce.tweens.map { tween in
        Tween(begin:tween.begin+0.1,duration:tween.duration,
            from:.scale(1+(tween.from.scaleX-1)*0.5),
            to:.scale(1+(tween.to.scaleX-1)*0.5),ease:tween.ease)
    })

    // nav-icon-bounce.ts:4–11,75–93. Parent may combine this visual track
    // with the separate 380ms size/offset selection track on its outer shell.
    static let navigationTapBounce = Track(tweens:(0..<5).map{i in
        let a=NativeHUDTapMotion.poses[i],b=NativeHUDTapMotion.poses[i+1]
        return Tween(begin:NativeHUDTapMotion.phases[i]*NativeHUDTapMotion.duration,duration:(NativeHUDTapMotion.phases[i+1]-NativeHUDTapMotion.phases[i])*NativeHUDTapMotion.duration,
            from:Pose(scaleX:a.x,scaleY:a.y,y:a.offset),to:Pose(scaleX:b.x,scaleY:b.y,y:b.offset),ease:.cubicBezier(0.42,0,0.58,1))
    })

    private static func one(delay: Double, duration: Double, from: Pose, to: Pose, ease: Ease) -> Track {
        Track(tweens: [Tween(begin: delay, duration: duration, from: from, to: to, ease: ease)])
    }
}

/// Finite letter entry sampled from the exact PRESENTS recipe. The caller owns
/// glyph layout, admission, its ancestor clock and retirement; no scheduler.
/// A caller can compress letter offsets into an overlapping wave without
/// changing the authored shape or the other coach callers.
@MainActor
enum NativeCoachCopyMotion {
    static let rate=1.5
    static let fadeDuration=0.15
    static func pose(at elapsed:Double,index:Int,lifespan:Double=2.8,speedMultiplier:Double=1,staggerMultiplier:Double=1,breathes:Bool=false,letterExit:Bool=false)->NativeArcadeRoundPresentation.Pose {
        var result=NativeStudioIntroView.presentsPose(at:NativeStudioIntroView.presentsEntryStart+elapsed*rate*speedMultiplier+Double(index)*NativeStudioIntroView.presentsLetterStagger*(1-staggerMultiplier),index:index)
        if breathes {
            let letterDuration=NativeStudioIntroView.presentsEntryDuration-7*NativeStudioIntroView.presentsLetterStagger
            let settledAt=(letterDuration+Double(index)*NativeStudioIntroView.presentsLetterStagger*staggerMultiplier)/(rate*speedMultiplier)
            if elapsed>=settledAt {
                result.scale *= NativeSplashGlyphField.captionIdleScale(time:elapsed-settledAt,bounce:1.03+CGFloat(index%4)*0.01)
            }
        }
        let exitDelay=letterExit ? Double(index)*0.014:0
        let exitStart=lifespan-(letterExit ? 0.18+13*0.014:fadeDuration)+exitDelay
        let exitProgress=max(0,min(1,(elapsed-exitStart)/(letterExit ? 0.18:fadeDuration)))
        if letterExit {
            result.rotation += CGFloat(8*exitProgress)
            result.scale *= CGFloat(1-0.25*exitProgress)
        }
        let fade=1-exitProgress
        result.alpha=max(0,min(1,result.alpha))*CGFloat(fade)
        return result
    }
    /// beginTime is the caller's shared host epoch, converted to each glyph's
    /// local clock so letter staggering remains encoded solely in the recipe.
    static func install(on layer:CALayer,index:Int,lifespan:Double=2.8,key:String="native.coach.copy",beginTime:CFTimeInterval?=nil,speedMultiplier:Double=1,staggerMultiplier:Double=1,breathes:Bool=false,letterExit:Bool=false) {
        guard lifespan.isFinite,lifespan>0 else{return}
        let count=max(1,Int(ceil(lifespan*120)))
        let poses=(0...count).map{pose(at:lifespan*Double($0)/Double(count),index:index,lifespan:lifespan,speedMultiplier:speedMultiplier,staggerMultiplier:staggerMultiplier,breathes:breathes,letterExit:letterExit)}
        let transform=CAKeyframeAnimation(keyPath:"transform"),opacity=CAKeyframeAnimation(keyPath:"opacity")
        transform.values=poses.map{NSValue(caTransform3D:$0.transform)}
        opacity.values=poses.map{NSNumber(value:Double($0.alpha))}
        let times=(0...count).map{NSNumber(value:Double($0)/Double(count))}
        for animation in [transform,opacity] {animation.keyTimes=times;animation.calculationMode = .linear;animation.duration=lifespan}
        let group=CAAnimationGroup();group.animations=[transform,opacity];group.duration=lifespan
        group.beginTime=layer.convertTime(beginTime ?? CACurrentMediaTime(),from:nil)
        group.fillMode = .both;group.isRemovedOnCompletion=true
        CATransaction.begin();CATransaction.setDisableActions(true)
        layer.opacity=0;layer.transform=CATransform3DIdentity;layer.add(group,forKey:key)
        CATransaction.commit()
    }
}
