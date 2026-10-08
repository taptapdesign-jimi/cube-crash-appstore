import Foundation

/// Literal v9 wild-spawn-drop.ts geometry. Coordinates remain source Y-down.
/// A carrier adapter must map stage space to the existing renderer; this value
/// owner never chooses a clock, creates assets, or changes gameplay state.
nonisolated struct NativeWildMeterDropPlan: Sendable {
    struct Point: Codable, Equatable, Sendable { var x: Double; var y: Double }
    struct Affine: Codable, Equatable, Sendable {
        var a: Double = 1, b: Double = 0, c: Double = 0, d: Double = 1, tx: Double = 0, ty: Double = 0
        func project(_ p: Point) -> Point { Point(x:a*p.x+c*p.y+tx,y:b*p.x+d*p.y+ty) }
        func unproject(_ p: Point) -> Point {
            let det=a*d-b*c, x=p.x-tx, y=p.y-ty
            return Point(x:(d*x-c*y)/det,y:(-b*x+a*y)/det)
        }
    }
    struct Pose: Equatable, Sendable {
        var point: Point; var scaleX: Double; var scaleY: Double; var rotation: Double; var opacity: Double
    }
    struct TilePose: Equatable, Sendable {
        var pose: Pose; var visible: Bool; var stageParent: Bool; var dropping: Bool; var handoff: Bool; var interactive: Bool
    }
    struct CarrierPose: Equatable, Sendable {
        var pose: Pose; var frame: Int; var source: String; var released: Bool
    }
    struct Frame: Equatable, Sendable { var tile: TilePose; var carrier: CarrierPose }
    static let revealTime=0.505, travelStart=0.865, travelDuration=0.54
    static let impactDuration=0.43, carrierCleanupTime=1.4, handoffMilliseconds=140.0
    static let carrierDepth=2_100_000, tileDepth=2_100_001
    static let carrierAnchor=Point(x:0.5,y:0.72)
    static let frameTailMilliseconds=100.0
    static let backpackSources=(1...20).map { "./assets/animations/backpack/backpack-\($0).png" }
    static let crateSources=(1...10).map { "./assets/animations/crate/box-\($0).png" }
    static var preloadSources: [String] { backpackSources+crateSources }

    /// Literal v9 getSpecialDiceVisualConfig: both dimensions must be authored.
    /// Native artwork bounds exist for all variants and cannot decide this flag.
    static func sourceUsesUniformDropScale(variant:String?)->Bool {
        guard let variant else{return false}
        return ["fish","kanta","laser-gun","spaceship","barell","cubero"].contains(variant)
    }
    let arcade: Bool, usesUniformDropScale: Bool
    let viewport: Point, tileSize: Double, target: Point, stageTarget: Point
    let originalRotation: Double, originalZIndex: Double, visualScale: Double
    let backpackPoint: Point, start: Point, launch: Point, control: Point
    let carrierScale: Double, carrierRotation: Double, initialTileRotation: Double

    init(arcade: Bool, viewport: Point, tileSize: Double, target: Point,
         parentWorld: Affine, stageWorld: Affine = Affine(), originalRotation: Double,
         originalZIndex: Double, usesUniformDropScale: Bool, random: () -> Double) {
        self.arcade=arcade;self.viewport=viewport;self.tileSize=tileSize;self.target=target
        self.originalRotation=originalRotation;self.originalZIndex=originalZIndex
        self.usesUniformDropScale=usesUniformDropScale
        let s=max(0.2,min(2,(hypot(parentWorld.a,parentWorld.b)+hypot(parentWorld.c,parentWorld.d))*0.5))
        visualScale=s
        var bp=stageWorld.unproject(Point(x:viewport.x-tileSize*s*1.15,y:viewport.y-tileSize*s*1.35+32))
        var wild=bp
        if arcade { bp.x-=24*s;bp.y-=(tileSize*0.1+58)*s;wild.y-=(tileSize*0.1+58)*s }
        backpackPoint=bp
        let origin=Point(x:wild.x-34*s,y:wild.y-96*s-(arcade ? 48*s:0))
        start=origin;launch=Point(x:origin.x,y:origin.y-14*s)
        let destination=stageWorld.unproject(parentWorld.project(target));stageTarget=destination
        // Preserve Source construction/RNG order, including both carrier draws.
        carrierRotation=(random()<0.5 ? -1.0:1.0)*(4+random())*Double.pi/180
        carrierScale=tileSize*s*2.15*1.15/(arcade ? 290:379)*(arcade ? 0.95:1)
        initialTileRotation=originalRotation-0.04+random()*0.08
        let dx=destination.x-launch.x,dy=destination.y-launch.y,side=dx>=0 ? 1.0:-1.0
        control=Point(x:launch.x+dx*0.48+side*(10+random()*12),y:launch.y+dy*0.22-max(54,min(112,abs(dy)*0.16+38)))
    }

    /// `impactStart` is captured when the ACTUAL travel completion runs. Source
    /// allocates a new GSAP root there; a stalled callback shifts impact/restore.
    /// `restored`/`wallHandoffPending` are supplied by captured runtime receipts,
    /// because the140ms timeout is wall time, independently of animation pause.
    func sample(seconds t: Double,impactStart: Double?,restored: Bool,wallHandoffPending: Bool) -> Frame {
        let s=visualScale
        var tile=TilePose(pose:Pose(point:Point(x:start.x,y:t==0 ? start.y:launch.y),scaleX:s*0.18,scaleY:s*0.18,
            rotation:initialTileRotation,opacity:0),visible:false,stageParent:true,dropping:true,handoff:false,interactive:false)
        if t>=Self.revealTime {
            let p=Self.quantize(Self.clamp((t-Self.revealTime)/0.36))
            let y:Double,sx:Double,sy:Double
            if p<0.34 {
                let k=Self.sineInOut(p/0.34)
                y=Self.lerp(start.y+16*s,start.y+2*s,k);sx=s*Self.lerp(0.5,0.62,k);sy=s*Self.lerp(0.5,0.58,k)
            } else if p<0.78 {
                let k=Self.backOut((p-0.34)/0.44,2.45)
                y=Self.lerp(start.y+2*s,start.y-24*s,k);sx=s*Self.lerp(0.62,0.9,k);sy=s*Self.lerp(0.58,0.82,k)
            } else {
                let k=Self.sineInOut((p-0.78)/0.22)
                y=Self.lerp(start.y-24*s,launch.y,k);sx=s*Self.lerp(0.9,0.8,k);sy=s*Self.lerp(0.82,0.8,k)
            }
            tile.pose.point.y=y;tile.pose.opacity=Self.clamp(p/0.28);tile.visible=true
            setDropScale(&tile.pose,sx,sy)
        }
        if t>=Self.travelStart {
            let p=Self.quantize(Self.power3InOut((t-Self.travelStart)/Self.travelDuration)),inv=1-p
            tile.pose.point=Point(x:inv*inv*launch.x+2*inv*p*control.x+p*p*stageTarget.x,
                y:inv*inv*launch.y+2*inv*p*control.y+p*p*stageTarget.y)
            let side=stageTarget.x-launch.x>=0 ? 1.0:-1.0
            tile.pose.rotation=originalRotation+side*sin(p*Double.pi)*0.18;tile.pose.opacity=1;tile.visible=true
            let pulse=sin(p*Double.pi)*0.04,bounce=sin(p*Double.pi*7.5)*(1-p*0.25)*0.075
            let squash=sin(p*Double.pi*7.5+Double.pi*0.5)*(1-p*0.35)*0.03
            let spawnT=min(1,p/0.34),pop=max(0,1-spawnT)*0.1
            let spawnBounce=sin(spawnT*Double.pi*2.25)*max(0,1-spawnT)*0.05
            setDropScale(&tile.pose,s*(1+pop+spawnBounce+pulse+bounce+squash),
                s*(1+pop*0.68-spawnBounce*0.5+pulse-bounce*0.45-squash*0.55))
        }
        if let impactStart,t>=impactStart {
            tile.pose.point=stageTarget
            let dt=t-impactStart,k:Double
            if dt<0.12 {k=Self.quantize(Self.lerp(s*0.76,s*1.18,Self.backOut(dt/0.12,3)))}
            else if dt<0.19 {k=Self.quantize(Self.lerp(Self.quantize(s*1.18),s*0.9,Self.power2InOut((dt-0.12)/0.07)))}
            else if dt<0.27 {k=Self.quantize(Self.lerp(Self.quantize(s*0.9),s*1.06,Self.power2Out((dt-0.19)/0.08)))}
            else {k=Self.quantize(Self.lerp(Self.quantize(s*1.06),s,Self.elasticOut((dt-0.27)/0.16,0.7)))}
            tile.pose.scaleX=k;tile.pose.scaleY=k
        }
        if restored {
            tile.pose=Pose(point:target,scaleX:1,scaleY:1,rotation:originalRotation,opacity:1)
            tile.stageParent=false;tile.dropping=false;tile.handoff=wallHandoffPending;tile.interactive = !wallHandoffPending
        }
        return Frame(tile:tile,carrier:sampleCarrier(t))
    }

    func sampleCarrier(_ t: Double) -> CarrierPose {
        let b=carrierScale
        let starts=[0.0,0.11,0.2,0.29],durations=[0.13,0.1,0.1,0.16]
        let targets=[Point(x:b*1.18,y:b*0.84),Point(x:b*0.9,y:b*1.12),Point(x:b*1.05,y:b*0.97),Point(x:b,y:b)]
        func ease(_ i:Int,_ p:Double)->Double {
            switch i {case 0,2:return Self.power2Out(p);case 1:return Self.power2InOut(p);default:return Self.elasticOut(p,0.72)}
        }
        var captured=Point(x:b*0.82,y:b*0.82),result=captured
        for i in 0..<4 {
            if i>0 {
                let k=ease(i-1,(starts[i]-starts[i-1])/durations[i-1])
                captured=Point(x:Self.quantize(Self.lerp(captured.x,targets[i-1].x,k)),y:Self.quantize(Self.lerp(captured.y,targets[i-1].y,k)))
            }
            if t>=starts[i] {
                let k=ease(i,(t-starts[i])/durations[i])
                result=Point(x:Self.quantize(Self.lerp(captured.x,targets[i].x,k)),y:Self.quantize(Self.lerp(captured.y,targets[i].y,k)))
            }
        }
        if t==0 {result=Point(x:b*0.82,y:b*0.82)}
        if t>=1.08 {let k=Self.backIn((t-1.08)/0.24,2.2);let v=Self.quantize(Self.lerp(Self.quantize(b),0,k));result=Point(x:v,y:v)}
        var frame=0,frameTime=0.28
        for i in 0..<20 {if t+1e-8>=frameTime {frame=i};frameTime += i>=10 ? 0.0225:0.0375;if i==9 {frameTime+=0.2}}
        let opacity=t<1.12 ? Self.quantize(Self.power2Out(t/0.08)):Self.quantize(1-pow(Self.clamp((t-1.12)/0.1),2))
        let y=t==0 ? backpackPoint.y+tileSize*visualScale*2.2:
            Self.quantize(Self.lerp(backpackPoint.y+tileSize*visualScale*2.2,backpackPoint.y,Self.backOut(t/0.28,2.3)))
        let sources=arcade ? Self.crateSources+Self.crateSources.reversed():Self.backpackSources
        return CarrierPose(pose:Pose(point:Point(x:backpackPoint.x,y:y),scaleX:result.x,scaleY:result.y,
            rotation:carrierRotation,opacity:opacity),frame:frame,source:sources[frame],released:t>=Self.carrierCleanupTime)
    }
    private func setDropScale(_ pose:inout Pose,_ x:Double,_ y:Double) {
        if usesUniformDropScale {pose.scaleX=(x+y)*0.5;pose.scaleY=pose.scaleX}
        else {pose.scaleX=x;pose.scaleY=y}
    }
    private static func clamp(_ x:Double)->Double {max(0,min(1,x))}
    private static func quantize(_ x:Double)->Double {(x*1_000_000).rounded()/1_000_000}
    private static func lerp(_ a:Double,_ b:Double,_ p:Double)->Double {a+(b-a)*p}
    private static func sineInOut(_ p:Double)->Double {0.5-cos(clamp(p)*Double.pi)*0.5}
    private static func power2Out(_ p:Double)->Double {1-pow(1-clamp(p),3)}
    private static func power2InOut(_ p:Double)->Double {let p=clamp(p);return p<0.5 ? 4*pow(p,3):1-pow(-2*p+2,3)*0.5}
    private static func power3InOut(_ p:Double)->Double {let p=clamp(p);return p<0.5 ? 8*pow(p,4):1-pow(-2*p+2,4)*0.5}
    private static func backOut(_ p:Double,_ s:Double)->Double {let p=clamp(p)-1;return 1+(s+1)*pow(p,3)+s*pow(p,2)}
    private static func backIn(_ p:Double,_ s:Double)->Double {let p=clamp(p);return (s+1)*pow(p,3)-s*pow(p,2)}
    private static func elasticOut(_ p:Double,_ period:Double)->Double {
        if p<=0 {return 0};if p>=1 {return 1}
        return pow(2,-10*p)*sin((p-period/4)*2*Double.pi/period)+1
    }
}
