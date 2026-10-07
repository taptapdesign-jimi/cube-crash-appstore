import Foundation
import CoreGraphics

/// Pure source-owned geometry from spaceship-finale-scene.ts and lasergun-finale-scene.ts.
/// Coordinates are UIKit viewport points; this owner has no gameplay state.
enum NativeArea55Motion {
    struct RigPose { var x: Double; var y: Double; var rotation: Double; var sx = 1.0; var sy = 1.0 }
    struct DebrisPlan {
        let id: String, source: String?; let value: Int
        let x,y: Double; let curve: (Double,Double); let size,order,delay,rotation,wobble,drift: Double
        let below,foreground: Bool
        var arrival: Double { delay+1.95+order*0.04 }
        var z: CGFloat { CGFloat(foreground ? 4 : value > 0 ? 0 : below ? 1 : 3) }
    }
    struct Scatter { let x,y,c1,c2,drift,rotation: Double }
    static let debris: [DebrisPlan] = [
        .init(id: "rock1", source: "assets/shop/spaceship/rock1@2x.png", value: 0, x: 22, y: 112, curve: (14, 38), size: 108, order: 0, delay: 0, rotation: -12, wobble: 8, drift: 22, below: false, foreground: false),
        .init(id: "can1", source: "assets/shop/spaceship/kanta1@2x.png", value: 0, x: 44, y: 116, curve: (51, 39), size: 132, order: 2, delay: 0, rotation: 10, wobble: -10, drift: -16, below: true, foreground: false),
        .init(id: "rock2", source: "assets/shop/spaceship/rock2@2x.png", value: 0, x: 70, y: 120, curve: (80, 57), size: 112, order: 1, delay: 0, rotation: 8, wobble: -7, drift: -22, below: false, foreground: false),
        .init(id: "rock3", source: "assets/shop/spaceship/rock3@2x.png", value: 0, x: 39, y: 124, curve: (31, 45), size: 116, order: 3, delay: 0, rotation: -7, wobble: 8, drift: 14, below: true, foreground: false),
        .init(id: "can2", source: "assets/shop/spaceship/kanta2@2x.png", value: 0, x: 72, y: 128, curve: (82, 62), size: 128, order: 4, delay: 0, rotation: -9, wobble: 9, drift: 18, below: true, foreground: false),
        .init(id: "rock4", source: "assets/shop/spaceship/rock4@2x.png", value: 0, x: 14, y: 132, curve: (5, 35), size: 104, order: 5, delay: 0, rotation: 11, wobble: -10, drift: -26, below: false, foreground: false),
        .init(id: "rock5", source: "assets/shop/spaceship/rock5@2x.png", value: 0, x: 50, y: 136, curve: (59, 44), size: 114, order: 7, delay: 0, rotation: -8, wobble: 7, drift: 18, below: false, foreground: false),
        .init(id: "can3", source: "assets/shop/spaceship/kanta3@2x.png", value: 0, x: 18, y: 140, curve: (7, 38), size: 126, order: 6, delay: 0, rotation: 12, wobble: -9, drift: -28, below: false, foreground: false),
        .init(id: "rock6", source: "assets/shop/spaceship/rock6@2x.png", value: 0, x: 78, y: 144, curve: (90, 60), size: 109, order: 9, delay: 0, rotation: 9, wobble: -8, drift: -24, below: true, foreground: false),
        .init(id: "can4", source: "assets/shop/spaceship/kanta4@2x.png", value: 0, x: 86, y: 148, curve: (97, 66), size: 134, order: 8, delay: 0, rotation: -10, wobble: 8, drift: 24, below: true, foreground: false),
        .init(id: "rock7", source: "assets/shop/spaceship/rock7@2x.png", value: 0, x: 48, y: 152, curve: (37, 55), size: 111, order: 11, delay: 0, rotation: -11, wobble: 10, drift: 20, below: true, foreground: false),
        .init(id: "can5", source: "assets/shop/spaceship/kanta5@2x.png", value: 0, x: 52, y: 156, curve: (63, 45), size: 130, order: 10, delay: 0, rotation: 7, wobble: -9, drift: -18, below: false, foreground: false),
        .init(id: "rock1Copy1", source: "assets/shop/spaceship/rock1@2x.png", value: 0, x: 4, y: 129, curve: (-2, 30), size: 88, order: 2.5, delay: 0, rotation: 95, wobble: -24, drift: 28, below: true, foreground: false),
        .init(id: "rock1Copy2", source: "assets/shop/spaceship/rock1@2x.png", value: 0, x: 96, y: 145, curve: (103, 68), size: 121, order: 7.25, delay: 0, rotation: -95, wobble: 31, drift: -30, below: false, foreground: false),
        .init(id: "rock3Copy1", source: "assets/shop/spaceship/rock3@2x.png", value: 0, x: 10, y: 151, curve: (-1, 34), size: 94, order: 5.5, delay: 0, rotation: -95, wobble: 27, drift: 32, below: false, foreground: false),
        .init(id: "rock3Copy2", source: "assets/shop/spaceship/rock3@2x.png", value: 0, x: 88, y: 136, curve: (100, 63), size: 126, order: 8.5, delay: 0, rotation: 95, wobble: -29, drift: -34, below: true, foreground: false),
        .init(id: "rock3Copy3", source: "assets/shop/spaceship/rock3@2x.png", value: 0, x: 3, y: 166, curve: (-6, 37), size: 76, order: 10.75, delay: 0, rotation: 95, wobble: -34, drift: 36, below: true, foreground: false),
        .init(id: "die1", source: nil, value: 3, x: 3, y: 116, curve: (-4, 34), size: 52, order: 12, delay: 0.08, rotation: -22, wobble: 52, drift: 30, below: true, foreground: false),
        .init(id: "die2", source: nil, value: 2, x: 95, y: 121, curve: (103, 64), size: 52, order: 1.5, delay: 0, rotation: 18, wobble: -60, drift: -32, below: false, foreground: true),
        .init(id: "die3", source: nil, value: 4, x: 10, y: 128, curve: (-1, 37), size: 52, order: 3.5, delay: 0, rotation: 25, wobble: -48, drift: -30, below: false, foreground: true),
        .init(id: "die4", source: nil, value: 1, x: 97, y: 134, curve: (105, 66), size: 52, order: 4.5, delay: 0, rotation: -17, wobble: 56, drift: 34, below: true, foreground: false),
        .init(id: "die5", source: nil, value: 2, x: 1, y: 142, curve: (-7, 32), size: 52, order: 6.5, delay: 0, rotation: 14, wobble: -55, drift: 36, below: true, foreground: false),
        .init(id: "die6", source: nil, value: 5, x: 94, y: 149, curve: (102, 67), size: 52, order: 7.5, delay: 0, rotation: -24, wobble: 60, drift: -38, below: false, foreground: true),
        .init(id: "die7", source: nil, value: 4, x: 7, y: 158, curve: (-3, 36), size: 52, order: 9.5, delay: 0, rotation: -16, wobble: 46, drift: 34, below: false, foreground: true),
        .init(id: "die8", source: nil, value: 3, x: 91, y: 164, curve: (101, 62), size: 52, order: 13, delay: 0.14, rotation: 21, wobble: -58, drift: -36, below: true, foreground: false),
    ]
    static func clamp(_ value: Double,_ a: Double = 0,_ b: Double = 1) -> Double { max(a,min(b,value)) }
    static func bezier(_ a: Double,_ b: Double,_ c: Double,_ d: Double,_ p: Double) -> Double {
        let q = 1-p; return q*q*q*a+3*q*q*p*b+3*q*p*p*c+p*p*p*d
    }
    static func magnetic(_ progress: Double) -> Double { let p = clamp(progress); return 0.14*p+0.86*p*p }
    static func scatter(_ plan: DebrisPlan,random: () -> Double) -> Scatter {
        let x = clamp(50+(plan.x-50)*1.5+(random()*2-1)*3,-6,106)
        let c1 = clamp(50+(plan.curve.0-50)*1.5+(random()*2-1)*5,-15,115)
        let c2 = clamp(50+(plan.curve.1-50)*1.5+(random()*2-1)*5,-15,115)
        let y = plan.y+random()*8
        let drift = (plan.drift < 0 ? -1.0 : 1.0)*clamp(abs(plan.drift)*(1.5+(random()*2-1)*0.1),18,58)
        let rotation = plan.id.contains("Copy") ? plan.rotation : clamp(plan.rotation+(random()*2-1)*12,-35,35)
        return .init(x: x,y: y,c1: c1,c2: c2,drift: drift,rotation: rotation)
    }
    static let knots: [Double] = [0,0.1290625,0.258125,0.36875,0.4978125,0.6453125,0.8296875,0.995625,1.18]
    static func hermite(_ values: [Double],_ slopes: [Double],_ seconds: Double) -> Double {
        var index = 0
        while index < knots.count-2 && seconds >= knots[index+1] { index += 1 }
        let d = max(0.001,knots[index+1]-knots[index]), p = clamp((seconds-knots[index])/d), p2 = p*p,p3 = p2*p
        return (2*p3-3*p2+1)*values[index]+(p3-2*p2+p)*d*slopes[index]+(-2*p3+3*p2)*values[index+1]+(p3-p2)*d*slopes[index+1]
    }
    private static let exitX = [0.0,0.008,0.035,0.09,0.20,0.42,0.78,1.12,1.12]
    private static let exitXT = [0.0,0.12,0.30,0.58,1.05,1.75,2.20,0,0]
    private static let exitY = [0.05,0.045,0.025,-0.015,-0.10,-0.28,-0.58,-0.84,-0.84]
    private static let exitYT = [0.0,-0.08,-0.22,-0.48,-0.90,-1.45,-1.85,0,0]
    private static let exitR = [0.0,1.5,4,7,11,15,19,20,20]
    private static let exitRT = [0.0,14,20,24,24,20,10,0,0]
    private static let exitSX = [1.0,0.998,0.994,0.989,0.982,0.974,0.964,0.96,0.96]
    private static let exitSXT = [0.0,-0.02,-0.03,-0.04,-0.05,-0.06,-0.04,0,0]
    private static let exitSY = [1.0,0.997,0.991,0.983,0.973,0.96,0.945,0.94,0.94]
    private static let exitSYT = [0.0,-0.03,-0.05,-0.06,-0.08,-0.09,-0.06,0,0]
    private static let enterLanes: [[Double]] = [[-1,-0.44,-0.34,-0.34,-0.12,0.10,-0.035,-12],[1,0.44,-0.34,0.34,-0.12,-0.10,-0.035,12],[-1,-0.62,-0.16,-0.43,-0.23,0.075,-0.015,-12],[1,0.62,-0.16,0.43,-0.23,-0.075,-0.015,12]]
    private static let driftTimes = [0.45,0.95,1.45,1.95,2.40,2.62]
    private static let driftPoses: [[Double]] = [[0,0.04,0],[-24,0.06,-10],[18,0.02,12],[-12,0.07,-8],[14,0.03,10],[0,0.05,0]]
    private static let intakeRatios = [0.46,0.50,0.54]
    static func exitPose(seconds: Double,lane: Double,viewport: CGSize) -> RigPose {
        let x = hermite(exitX,exitXT,seconds)
        let y = hermite(exitY,exitYT,seconds)
        let rotation = hermite(exitR,exitRT,seconds)
        let sx = hermite(exitSX,exitSXT,seconds)
        let sy = hermite(exitSY,exitSYT,seconds)
        return .init(x: lane*Double(viewport.width)*x,y: Double(viewport.height)*y,rotation: lane*clamp(rotation,-20,20),sx: sx,sy: sy)
    }
    static func rigPose(seconds: Double,entry: Int,lane: Double,viewport: CGSize) -> RigPose {
        if seconds >= 2.62 { return exitPose(seconds: seconds-2.62,lane: lane,viewport: viewport) }
        let l = enterLanes[max(0,min(3,entry))], w = Double(viewport.width),h = Double(viewport.height)
        let p = clamp(seconds/0.45),f = 1-pow(1-p,3),e = pow(1-f,1.35)*sin(.pi*f)
        var result = RigPose(x: bezier(l[1],l[3],l[5],0,f)*w+l[0]*w*0.018*sin(5 * .pi*f)*e,y: bezier(l[2],l[4],l[6],0.04,f)*h+h*0.01*sin(4 * .pi*f)*e,rotation: l[7]*(1-f)+l[0]*4*sin(4 * .pi*f)*e)
        if seconds >= 0.45 {
            var i = 0; while i < driftTimes.count-2 && seconds >= driftTimes[i+1] { i += 1 }
            let q = (1-cos(.pi*clamp((seconds-driftTimes[i])/(driftTimes[i+1]-driftTimes[i]))))/2
            result = .init(x: driftPoses[i][0]+(driftPoses[i+1][0]-driftPoses[i][0])*q,y: (driftPoses[i][1]+(driftPoses[i+1][1]-driftPoses[i][1])*q)*h,rotation: driftPoses[i][2]+(driftPoses[i+1][2]-driftPoses[i][2])*q)
        }
        if seconds >= 0.30 && seconds < 0.90 {
            // Source captures the rotated bounding height at spring start, then applies yPercent to the unrotated rig.
            let capture = rigPose(seconds: 0.30-0.00000001,entry: entry,lane: lane,viewport: viewport)
            let rw = min(w*0.76,297),rh = rw*202/297,a = capture.rotation * .pi/180
            let measuredHeight = abs(rw*sin(a))+abs(rh*cos(a))
            let q = (seconds-0.30)/0.60; result.y += 18*(1-q)*sin(3 * .pi*q)*rh/measuredHeight
        }
        return result
    }
    static func intake(pose: RigPose,order: Double,viewport: CGSize) -> CGPoint {
        let rw = min(Double(viewport.width)*0.76,297),rh = rw*202/297
        let slot = Int(floor(order))%3
        let x = (rw*intakeRatios[slot]+0.5-rw*0.5)*pose.sx,y = (rh*0.78+0.5-rh*0.45)*pose.sy,a = pose.rotation * .pi/180
        return .init(x: Double(viewport.width)/2+pose.x+x*cos(a)-y*sin(a),y: rh*0.45+pose.y+x*sin(a)+y*cos(a))
    }
    static func laserLayout(origin: CGPoint,viewport: CGSize,scale: Double) -> (left: Bool,x: Double,y: Double,offscreen: Double,width: Double) {
        let w = max(320,Double(viewport.width)),h = max(320,Double(viewport.height)),left = Double(origin.x)>w/2
        let width = min(w*0.70,273), inset = clamp(w*0.21,72,84), muzzle = left ? inset : w-inset
        let x = muzzle-width*max(0.1,scale)*(left ? 0.30 : -0.28),margin = min(h*0.24,132)
        return (left,x,clamp(Double(origin.y),margin,h-margin),left ? -(x+width*max(0.1,scale)/2+6) : w-x+width*max(0.1,scale)/2+6,width)
    }
}
