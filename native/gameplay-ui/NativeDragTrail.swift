import SpriteKit
import UIKit
import StackToSixGameplay

/// Source distance-based touch trail: at most one burst per pointer frame.
/// The existing board frame owner advances finite tails; a bounded pool owns reuse.
struct NativeDragTrailCadence {
    var point:CGPoint?,at=0.0,carry=0.0
    mutating func reset(at point:CGPoint,time:Double){self.point=point;at=time;carry=0}
    mutating func consume(_ next:CGPoint,time:Double,spacing:CGFloat)->(CGPoint,Double)? {
        guard let previous=point else{reset(at:next,time:time);return nil}
        let dx=next.x-previous.x,dy=next.y-previous.y,distance=hypot(dx,dy),elapsed=max(1,time-at)
        point=next;at=time
        guard distance>=0.01 else{return nil}
        let total=carry+Double(distance)
        guard total>=Double(spacing) else{carry=total;return nil}
        let offset=min(distance,max(0,spacing-CGFloat(carry))),ratio=offset/distance
        carry=total.truncatingRemainder(dividingBy:Double(spacing))
        return (CGPoint(x:previous.x+dx*ratio,y:previous.y+dy*ratio),Double(distance)/elapsed)
    }
}
/// Immutable production-benchmark-v9 registry + wooden-template palettes.
/// TNT's rectangular branch precedes the registry's circle request in fx.ts.
struct NativeDragTrailStyle:Equatable {
    let wild:Bool,round:Bool,colors:[UInt32]
    private static let variants:[String:[UInt32]]=[
            "baloon":[0xF4E2CD,0x95D0F9,0x5BB6F9],
            "fish":[0xF5D8BF,0xFDAC78,0xFDA458,0xFD7C41],
            "kanta":[0xEBC29B,0xDDAD7F,0xDCFEFB,0x9CFDFC],
            "bee":[0xFAF4ED,0xFAE0BB,0xDB8265,0xD68E62],
            "laser-gun":[0xFEDFAD,0xFDC37E,0xE5CCA4,0x97E9FD],
            "spaceship":[0xF8DCBF,0xEFBE8F,0x7CFBFD,0x8AEEFE],
            "bottle":[0xFDCA89,0xD8E9CA,0xC8ECD0,0xAEE9E6],
            "honey":[0xFBD099,0xFEE4B8,0xFDCD55,0xF9AF3A],
            "flower":[0xFFE4D4,0xFFBBAD,0xF9999F,0xFFD257],
            "barell":[0xD7C3BC,0xE2CDC0,0xF5BD65,0xEAAD61],
            "mushroom":[0xFFE1C8,0xFFEDD9,0xFF9A80,0xFF7D61],
            "robo-cube":[0xFED49C,0xE99D5F,0xAA9482,0x8AEEFE],
            "beach-ball":[0x4BC9FC,0xDD94EB,0xFDA4A7,0xFDEB8C]]
    private static let defaults:[NativeWildArchetype:[UInt32]]=[
            .star:[0xF3D7B8,0xF7E8D7,0xFCC57C,0xFDA74C],
            .juice:[0xFBD295,0xF9BE9C,0xF6E6C8,0xF99D77],
            .magnet:[0xF26034,0xF57A5A,0xF89480,0xFBAEA6,0xFDC8CC],
            .tnt:[0xE85C3A,0xEB7A5A,0xF09880,0xF5B6A6]]
    static func resolve(core:NativeWildArchetype?,variant:String?)->Self {
        let core=variant.flatMap{NativeSpecialDiceRegistry.variants[$0]?.archetype} ?? core
        var colors=variant.flatMap{variants[$0]} ?? core.flatMap{defaults[$0]} ?? [0xF4EEE7,0xFBE3C5,0xECD7C2,0xE5C7AD,0xFADEC0]
        if core == .tnt {colors += [0xFFD966,0xFFE699]}
        let round=core != .tnt && (variant.map{["baloon","fish","beach-ball","bottle"].contains($0)} ?? (core == .juice))
        return Self(wild:core != nil,round:round,colors:colors)
    }
}

struct NativeDragTrailParticlePlan {
    let round:Bool,color:UInt32,fill:CGFloat,size:CGSize,start:CGPoint,end:CGPoint,rotation:CGFloat,endRotation:CGFloat,life:Double
    static func make(style:NativeDragTrailStyle,origin:CGPoint,scale:CGFloat,random:()->Double)->Self {
        guard style.wild else{return makeRegular(origin:origin,scale:scale,random:random)}
        let color=style.colors[min(style.colors.count-1,Int(random()*Double(style.colors.count)))]
        let width:CGFloat,height:CGFloat,round:Bool
        round=style.round
        if round {width=CGFloat(8+random()*8)*1.04*2;height=width}
        else {width=CGFloat(12+random()*12)*1.04;height=CGFloat(16+random()*16)*1.04}
        let angle=CGFloat(random()*Double.pi*2),distance=CGFloat(96*(0.1+random()*0.6)*0.9)*scale
        let start=CGPoint(x:origin.x+cos(angle)*distance,y:origin.y-sin(angle)*distance)
        let rotation = -CGFloat(random()*Double.pi*2)
        let endAngle=angle+CGFloat(random()-0.5),endDistance=distance*CGFloat(1.5+random()*0.5)
        let end=CGPoint(x:origin.x+cos(endAngle)*endDistance,y:origin.y-sin(endAngle)*endDistance)
        let endRotation=rotation-CGFloat((random()-0.5)*Double.pi*2),life=0.3+random()*0.3
        return Self(round:round,color:color,fill:0.92,size:CGSize(width:width*scale,height:height*scale),start:start,end:end,rotation:rotation,endRotation:endRotation,life:life)
    }
    static func makeRegular(origin:CGPoint,scale:CGFloat,random:()->Double)->Self {
        let category=random(),radius=category<0.33 ? 3+random()*3:category<0.66 ? 4+random()*6:5+random()*8
        let colors=NativeDragTrailStyle.resolve(core:nil,variant:nil).colors,color=colors[min(colors.count-1,Int(random()*Double(colors.count)))]
        let start=CGPoint(x:origin.x+CGFloat(-40+random()*80)*scale,y:origin.y-CGFloat(-40+random()*80)*scale)
        let life=0.9+random()*0.5,end=CGPoint(x:start.x,y:start.y+CGFloat(20+random()*15)*scale)
        return Self(round:true,color:color,fill:0.8,size:CGSize(width:radius*2*Double(scale),height:radius*2*Double(scale)),start:start,end:end,rotation:0,endRotation:0,life:life)
    }
}
@MainActor
final class NativeDragTrail:SKNode {
    // Original unit geometry is rasterized once; per-frame SpriteKit vector
    // tessellation is unnecessary for these immutable filled silhouettes.
    static let unitCirclePath=CGPath(ellipseIn:CGRect(x:-1,y:-1,width:2,height:2),transform:nil)
    static let unitSquarePath=CGPath(rect:CGRect(x:-1,y:-1,width:2,height:2),transform:nil)
    static let unitCircleTexture=makeUnitTexture(round:true)
    static let unitSquareTexture=makeUnitTexture(round:false)
    private static func makeUnitTexture(round:Bool)->SKTexture {
        let format=UIGraphicsImageRendererFormat();format.scale=min(3,max(1,UIScreen.main.scale));format.opaque=false
        let image=UIGraphicsImageRenderer(size:CGSize(width:64,height:64),format:format).image {context in
            let canvas=context.cgContext
            canvas.translateBy(x:32,y:32);canvas.scaleBy(x:32,y:32)
            canvas.addPath(round ? unitCirclePath:unitSquarePath)
            canvas.setFillColor(UIColor.white.cgColor);canvas.fillPath()
        }
        let texture=SKTexture(image:image);texture.filteringMode = .linear;return texture
    }
    private var cadence=NativeDragTrailCadence(),pool:[SKSpriteNode]=[]
    private struct Tail {let node:SKSpriteNode,plan:NativeDragTrailParticlePlan;var bornAtMilliseconds:Double?;var elapsed:Double=0}
    private var tails:[Tail]=[]
#if DEBUG
    private(set) var textureAssignmentCount=0
#endif
    private(set) var live=Set<SKSpriteNode>()
    var onTailChanged:((Bool)->Void)?
    private var active=false,disposed=false
    private let random:()->Double
    init(random:@escaping ()->Double={Double.random(in:0..<1)}) {
        self.random=random;super.init();pool.reserveCapacity(128);tails.reserveCapacity(128);live.reserveCapacity(128)
        // Prepare the tiny shared silhouettes before the first pointer burst.
        _=Self.unitCircleTexture;_=Self.unitSquareTexture
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    func begin(at point:CGPoint,time:Double){active=true;cadence.reset(at:point,time:time)}
    func end(){active=false}
    func emit(at point:CGPoint,time:Double,scale:CGFloat,wild:Bool,round:Bool,reduced:Bool=false) {
        emit(at:point,time:time,scale:scale,style:.resolve(core:wild ? (round ? .juice:.star):nil,variant:nil),reduced:reduced)
    }
    func emit(at point:CGPoint,time:Double,scale:CGFloat,style:NativeDragTrailStyle,reduced:Bool=false) {
        guard active,!disposed,scale>0 else{return}
        let spacing:CGFloat=style.wild ? (reduced ? 32:26):(reduced ? 34:28)
        guard let (origin,speed)=cadence.consume(point,time:time,spacing:spacing*scale) else{return}
        let fast=speed/Double(scale)>=0.65,count=style.wild ? (reduced ? 1:(fast ? 2:1)):(reduced ? (fast ? 3:2):(fast ? 4:3))
        for _ in 0..<count {
            guard live.count<128 else{break}
            let particle=pool.popLast() ?? SKSpriteNode()
            let plan=style.wild ? NativeDragTrailParticlePlan.make(style:style,origin:origin,scale:scale,random:random):NativeDragTrailParticlePlan.makeRegular(origin:origin,scale:scale,random:random)
            let texture=plan.round ? Self.unitCircleTexture:Self.unitSquareTexture
            if particle.texture !== texture {
                particle.texture=texture
#if DEBUG
                textureAssignmentCount+=1
#endif
            }
            let color=plan.color
            particle.color=UIColor(red:CGFloat((color>>16)&255)/255,green:CGFloat((color>>8)&255)/255,blue:CGFloat(color&255)/255,alpha:1)
            particle.colorBlendFactor=1;particle.setScale(1);particle.size=CGSize(width:2,height:2)
            particle.xScale=plan.size.width/2;particle.yScale=plan.size.height/2
            // Source Graphics fill alpha and node alpha both participate.
            let effectiveAlpha=plan.fill*plan.fill
            particle.alpha=effectiveAlpha;particle.zRotation=plan.rotation;particle.position=plan.start
            if particle.parent !== self {addChild(particle)}
            particle.isHidden=false;live.insert(particle)
            let first=tails.isEmpty
            tails.append(Tail(node:particle,plan:plan,bornAtMilliseconds:time))
            if first {onTailChanged?(true)}
        }
    }
    /// Uses the Scene's existing elapsed frame time, so global suspension and
    /// renderer cadence retain their owner. No per-particle actions or closures.
    func advance(delta:Double,timeMilliseconds:Double?=nil) {
        guard !disposed,delta.isFinite,delta>=0 else{return}
        let hadTail = !tails.isEmpty
        for index in tails.indices.reversed() {
            let step:Double
            if let born=tails[index].bornAtMilliseconds,let now=timeMilliseconds {
                step=min(delta,max(0,(now-born)/1000))
            } else {step=delta}
            tails[index].bornAtMilliseconds=nil
            tails[index].elapsed+=step
            let tail=tails[index],plan=tail.plan,node=tail.node
            let t=min(1,CGFloat(tail.elapsed/plan.life)),p=1-(1-t)*(1-t)
            node.position=CGPoint(x:plan.start.x+(plan.end.x-plan.start.x)*p,y:plan.start.y+(plan.end.y-plan.start.y)*p)
            node.zRotation=plan.rotation+(plan.endRotation-plan.rotation)*p;node.alpha=plan.fill*plan.fill*(1-p)
            if tail.elapsed>=plan.life {
                node.isHidden=true;live.remove(node);pool.append(node)
                tails.swapAt(index,tails.count-1);tails.removeLast()
            }
        }
        if hadTail,tails.isEmpty {onTailChanged?(false)}
    }
    var hasTail:Bool {!tails.isEmpty}
    func clear(){let hadTail = !tails.isEmpty;active=false;for tail in tails{tail.node.isHidden=true;pool.append(tail.node)};tails.removeAll(keepingCapacity:true);live.removeAll(keepingCapacity:true);if hadTail {onTailChanged?(false)}}
    func dispose(){guard !disposed else{return};clear();disposed=true;onTailChanged=nil;pool.removeAll();removeAllChildren();removeFromParent()}
}
