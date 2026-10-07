import UIKit

/// Source text-bubbly-sprites.ts compact two-burst screen-blend tracks.
struct NativeTextBubbleMotion {
    struct Pose { var x: CGFloat = 0,y: CGFloat = 0,scale: CGFloat = 1,alpha: CGFloat = 0 }
    private enum Ease { case cubicOut,sineOut,quadOut,quadIn
        func sample(_ raw: CGFloat) -> CGFloat { let t = min(1,max(0,raw)); switch self {
            case .cubicOut:return 1-pow(1-t,3);case .sineOut:return sin(t * .pi/2);case .quadOut:return 1-(1-t)*(1-t);case .quadIn:return t*t
        } }
    }
    private struct Track {
        let start: TimeInterval,duration: TimeInterval,from: Pose,to: Pose,fields: Int,ease: Ease,relative: Bool
        func apply(seconds: TimeInterval,pose: inout Pose) {
            guard seconds >= start else { return }
            let p = duration == 0 ? 1 : ease.sample(CGFloat((seconds-start)/duration))
            if fields&1 != 0 {pose.x = from.x+(to.x-from.x)*p}; if fields&2 != 0 {pose.y = from.y+(to.y-from.y)*p}
            if fields&4 != 0 {pose.scale = from.scale+(to.scale-from.scale)*p}; if fields&8 != 0 {pose.alpha = from.alpha+(to.alpha-from.alpha)*p}
        }
    }
    /// Stateful source timeline semantics: a .set is consumed at its crossing,
    /// and an overlapping tween captures the actual painted values at birth.
    struct Player {
        private let motion: NativeTextBubbleMotion
        private var pose: Pose
        private var from: [Int:Pose] = [:],targets: [Int:Pose] = [:],finished = Set<Int>()
        init(_ motion: NativeTextBubbleMotion) { self.motion = motion; pose = motion.initial }
        mutating func sample(seconds: TimeInterval) -> Pose {
            let time = seconds-motion.delay
            for (index,track) in motion.tracks.enumerated().sorted(by: { $0.element.start < $1.element.start }) where time >= track.start && !finished.contains(index) {
                if from[index] == nil { from[index] = pose
                    var target = track.to
                    if track.relative { target.x += pose.x; target.y += pose.y }
                    targets[index] = target
                }
                Track(start: track.start,duration: track.duration,from: from[index]!,to: targets[index]!,fields: track.fields,ease: track.ease,relative: false).apply(seconds: time,pose: &pose)
                if time >= track.start+track.duration { finished.insert(index) }
            }
            var output = pose; output.x += motion.birth.x; output.y += motion.birth.y; return output
        }
    }
    let index: Int,birth: CGPoint,size: CGFloat,delay: TimeInterval,end: TimeInterval
    private let initial: Pose,tracks: [Track]
    func sample(seconds: TimeInterval) -> Pose {
        var pose = initial
        for track in tracks.sorted(by: { $0.start < $1.start }) { track.apply(seconds: seconds-delay,pose: &pose) }
        pose.x += birth.x; pose.y += birth.y; return pose
    }
    static func make(viewport: CGSize,random: () -> Double = { Double.random(in: 0..<1) }) -> [Self] {
        func roll() -> CGFloat { CGFloat(min(1-Double.ulpOfOne,max(0,random()))) }
        let w = max(320,viewport.width),h = max(520,viewport.height)
        return (0..<14).map { index in
            let ring = index%3,rx = w*(ring == 0 ? 0.14 : ring == 1 ? 0.24 : 0.33),ry = h*(ring == 0 ? 0.07 : ring == 1 ? 0.11 : 0.16)
            let angle = CGFloat(index)/14*2 * .pi+(roll()-0.5)*0.8
            let x = w/2+cos(angle)*rx+(roll()-0.5)*34,y = h*0.56+sin(angle)*ry+(roll()-0.5)*28
            let size = (index%6 == 0 ? (42+roll()*20)*1.25 : 20+roll()*18)*1.3
            let rise = 44+roll()*86,sway = (roll()-0.5)*30,startScale = 0.2+roll()*0.2,scale = 0.72+roll()*0.58
            let delay = max(0,CGFloat(index)*0.028+roll()*0.2-0.1)
            let riseA = 0.2+roll()*0.1,riseB = 0.16+roll()*0.1,popA = 0.04+roll()*0.025,popB = 0.035+roll()*0.02
            let initial = Pose(scale:startScale),reset = Pose(scale:startScale)
            var tracks: [Track] = [],cursor: TimeInterval = 0
            func sample(_ time: TimeInterval) -> Pose { var pose = initial; for track in tracks.sorted(by: { $0.start < $1.start }) {track.apply(seconds:time,pose:&pose)};return pose }
            func add(_ target: Pose,_ fields: Int,_ duration: CGFloat,_ ease: Ease,start: TimeInterval? = nil,relative: Bool = false) {
                let at = start ?? cursor
                tracks.append(Track(start:at,duration:Double(duration),from:sample(at),to:target,fields:fields,ease:ease,relative:relative)); cursor = at+Double(duration)
            }
            let alphaA = 0.6+roll()*0.28,enterA = 0.12+roll()*0.06
            add(Pose(scale:scale,alpha:alphaA),12,enterA,.cubicOut)
            add(Pose(x:sway,y:-rise,alpha:0.5+roll()*0.3),11,riseA,.sineOut)
            let extraY = 8+roll()*14,extraX = (roll()-0.5)*18,extraAlpha = 0.35+roll()*0.2,extraDuration = 0.12+roll()*0.08
            add(Pose(x:extraX,y:-extraY,alpha:extraAlpha),11,extraDuration,.quadOut,relative:true)
            add(Pose(scale:scale*(1.12+roll()*0.12),alpha:0),12,popA,.quadIn)
            add(reset,15,0,.quadOut)
            let alphaB = 0.58+roll()*0.26,scaleB = scale*(0.92+roll()*0.14),enterB = 0.1+roll()*0.05
            add(Pose(scale:scaleB,alpha:alphaB),12,enterB,.cubicOut,start:cursor-0.06)
            let yB = -rise*(0.78+roll()*0.26),xB = sway*(0.65+roll()*0.45),opacityB = 0.45+roll()*0.28
            add(Pose(x:xB,y:yB,alpha:opacityB),11,riseB,.sineOut)
            add(Pose(scale:scale*(1.06+roll()*0.1),alpha:0),12,popB,.quadIn)
            add(reset,15,0,.quadOut)
            return Self(index:index,birth:CGPoint(x:x.rounded(),y:y.rounded()),size:size.rounded(),delay:Double(delay),end:Double(delay)+cursor,initial:initial,tracks:tracks)
        }
    }
}
