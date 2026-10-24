import UIKit
import SpriteKit
import StackToSixGameplay

/// The immutable v9 main/pull shard profile. Gameplay and visual families are
/// separate: Beach Ball selects Juice geometry but retains TNT mechanics.
struct NativeWildMergeSixShardProfile {
    enum Family:String {case star,juice,tnt,magnet,magnetPull}
    let family:Family,colors:[UInt32],sizeScale:Double
    var ttl:Double {family == .magnet || family == .magnetPull ? 1:1.2}
    static func make(archetype:NativeWildArchetype,variant:String?,pull:Bool=false)->Self? {
        let palette:[String:[UInt32]]=[
            "baloon":[0x8DCCF9,0x47A5EC],
            "bloob":[0xA5F8ED,0x67D7E5],
            "bloob-ball":[0xDEB186,0x09E8FD],
            "fish":[0xFCA470,0xFD6B38],"kanta":[0xE4B688,0x96FDFC],"bee":[0xFBE8C7,0xDD8564],
            "laser-gun":[0xFED49A,0x97E9FD],"spaceship":[0xF2CDA8,0x8AEEFE],"bottle":[0xB1DCC9,0xFFCE77],
            "coconut":[0xFEEDD4,0xDF8E58],
            "honey":[0xF1BA79,0xFDCF58],"flower":[0xFFCDC7,0xFC8C75],"barell":[0xE9D6C6,0xEBA95B],
            "mushroom":[0xE7B392,0xFF7B60],"robo-cube":[0x91F2FF,0xFAC388],"cubero":[0xFE9130],
            "beach-ball":[0xDD94EB,0x4BC9FC,0xFDEB8C,0xFD979D]]
        if let variant,NativeSpecialDiceRegistry.variants[variant]==nil{return nil}
        if archetype == .tnt && variant==nil{return nil} // v9 core TNT has no additional shard layer.
        let visual=variant.flatMap{NativeSpecialDiceRegistry.variants[$0]?.visualFinale} ?? archetype
        let family:Family=archetype == .magnet ? (pull ? .magnetPull:.magnet):visual == .juice ? .juice:visual == .tnt ? .tnt:.star
        let defaults:UInt32=family == .magnet || family == .magnetPull ? 0xF26034:family == .juice ? 0xF99D77:family == .tnt ? 0xE85C3A:0xFFCB47
        return .init(family:family,colors:variant.flatMap{palette[$0]} ?? [defaults],sizeScale:variant == "barell" ? 0.7:1)
    }
    var patterns:[[NativeRegularShardTemplates.Definition]] {
        switch family {
        case .magnet:return [NativeWildShardTemplates.magnetOrganic1,NativeWildShardTemplates.magnetOrganic2,NativeWildShardTemplates.magnetOrganic3]
        case .magnetPull:return [NativeWildShardTemplates.magnetPull1,NativeWildShardTemplates.magnetPull2,NativeWildShardTemplates.magnetPull3]
        case .star:return [NativeWildShardTemplates.starOrganic1,NativeWildShardTemplates.starOrganic2,NativeWildShardTemplates.starOrganic3,NativeWildShardTemplates.starOrganic4,NativeWildShardTemplates.starOrganic5]
        case .juice,.tnt:return [NativeWildShardTemplates.juiceOrganic1,NativeWildShardTemplates.juiceOrganic2,NativeWildShardTemplates.juiceOrganic3,NativeWildShardTemplates.juiceOrganic4,NativeWildShardTemplates.juiceOrganic5]
        }
    }
    var poolFamily:String {family == .tnt ? Family.juice.rawValue:family.rawValue}
}

struct NativeWildMergeSixShardPlan {
    enum AdmissionError:Error {case staleRandomOrResources}
    struct Shard {let points:[Double],rotation,alpha,dx,dy,travelDuration,travelDelay,fadeDelay:Double;let color:UInt32;let depth:Double}
    let shards:[Shard]
    init(profile:NativeWildMergeSixShardProfile,pattern:Int,random:()->Double,current:()->Bool,
         acquire:(Int)->Void,materialize:(Int,Shard)->Void,register:(Int,Shard)->Void)throws {
        func draw()throws->Double {
            guard current() else{throw AdmissionError.staleRandomOrResources}
            let value=random()
            guard current(),value.isFinite,value>=0,value<1 else{throw AdmissionError.staleRandomOrResources}
            return value
        }
        var result:[Shard]=[]
        let magnet=profile.family == .magnet || profile.family == .magnetPull
        for (index,d) in profile.patterns[pattern % profile.patterns.count].enumerated() {
            guard current() else{throw AdmissionError.staleRandomOrResources};acquire(index);guard current() else{throw AdmissionError.staleRandomOrResources}
            let brown=try magnet && draw()<0.38
            let color:UInt32=magnet ? (brown ? (profile.colors.count>1 ? profile.colors[1]:0xD4A584):profile.colors[0]):profile.colors[index % profile.colors.count]
            let width=((magnet ? 8:6)+(try draw())*(magnet ? 10:8))*d.size*2.4*profile.sizeScale
            let height=width*(0.8+(try draw())*1.4),count=4+Int(floor((try draw())*4))
            var points:[Double]=[]
            for vertex in 0..<count {
                let angle=Double(vertex)/Double(count)*Double.pi*2+((try draw())-0.5)*0.8
                let radius=(0.3+(try draw())*0.7)*min(width,height)/2
                points += [cos(angle)*radius,sin(angle)*radius]
            }
            let rotation=(try draw())*Double.pi
            let angleOffset=brown ? ((try draw())-0.5)*25:0,distanceOffset=brown ? ((try draw())-0.5)*0.08:0
            let delay=(try draw())*0.08,angle=(d.angle+angleOffset)*Double.pi/180
            let distance=(d.distance+distanceOffset)*96*(magnet ? 6.888:6.72)
            let shard=Shard(points:points,rotation:rotation,alpha:d.alpha,dx:cos(angle)*distance,dy:sin(angle)*distance,
                travelDuration:(magnet ? 0.35:0.4)*d.speed,travelDelay:delay,fadeDelay:0.15+0.1*(try draw()),color:color,depth:brown ? -1:0)
            guard current() else{throw AdmissionError.staleRandomOrResources};result.append(shard);materialize(index,shard)
            guard current() else{throw AdmissionError.staleRandomOrResources};register(index,shard)
        }
        shards=result
    }
}

/// Source GLOBAL travel/fade roots plus the independently linked delayed TTL.
/// No SpriteKit actions, new clock, gameplay completion, or ordinary fallback.
@MainActor
final class NativeWildMergeSixShardOwner {
    enum AdmissionError:Error {case stale,clockClosed}
    let layer=SKNode(),id=UUID(),generation:UInt64
    private let pool:NativeSharedVectorSpritePool,roots:NativeSharedSmokeRegisteredRoots,current:()->Bool
    private var leases:[Int:NativeSharedVectorSpritePool.Lease]=[:],release:(()->Void)?
    private(set) var disposed=false,plan:NativeWildMergeSixShardPlan?
    var onFinished:((Bool)->Void)?
    var activeShardCount:Int{leases.count}
    init(profile:NativeWildMergeSixShardProfile,pattern:Int,pool:NativeSharedVectorSpritePool,
         canvas:SKNode,origin:CGPoint,renderScale:CGFloat,depth:CGFloat,generation:UInt64,
         scheduler:any NativeSharedSmokeRootScheduler,current:@escaping()->Bool,random:()->Double,
         acquireActivity:(NativeSharedFxReceipt)->(()->Void)?)throws {
        guard current(),NativeSharedSmokeSpritePresentation.opaqueAncestors(canvas) else{throw AdmissionError.stale}
        self.pool=pool;self.generation=generation;self.current=current;roots=NativeSharedSmokeRegisteredRoots(scheduler:scheduler)
        let receipt=NativeSharedFxReceipt(kind:.shards,generation:generation,sequence:0,label:"special-merge6-shards",tailMilliseconds:100,sourceOwnerID:id.uuidString)
        release=acquireActivity(receipt)
        guard current(),!disposed else{dispose();throw AdmissionError.stale}
        layer.position=origin;layer.setScale(renderScale);layer.zPosition=depth;canvas.addChild(layer)
        do {
        plan=try NativeWildMergeSixShardPlan(profile:profile,pattern:pattern,random:random,current:{[weak self] in self?.valid()==true},
            acquire:{[weak self] index in guard let self else{return};self.leases[index]=pool.acquire()},
            materialize:{[weak self] index,shard in self?.materialize(index,shard)},register:{[weak self] index,shard in self?.register(index,shard)})
                } catch {dispose();throw error}
        guard valid(),roots.register(.init(kind:.lifetime,family:.eagerTween,delay:profile.ttl,duration:0),advance:{_,_ in},
            retired:{[weak self] _,success in self?.finish(success)}) else{dispose();throw AdmissionError.clockClosed}
    }
    private func materialize(_ index:Int,_ shard:NativeWildMergeSixShardPlan.Shard) {
        guard let lease=leases[index],pool.isCurrent(lease) else{return}
        let path=CGMutablePath()
        for i in stride(from:0,to:shard.points.count,by:2) {let p=CGPoint(x:shard.points[i],y:-shard.points[i+1]);if i==0{path.move(to:p)}else{path.addLine(to:p)}}
        path.closeSubpath();lease.node.path=path
        lease.node.fillColor=UIColor(red:CGFloat((shard.color>>16)&255)/255,green:CGFloat((shard.color>>8)&255)/255,blue:CGFloat(shard.color&255)/255,alpha:1)
        lease.node.strokeColor = .clear;lease.node.alpha=NativeSharedSmokeSpritePresentation.sourcePackedAlpha(shard.alpha)
        lease.node.zRotation = -shard.rotation;lease.node.zPosition=shard.depth;layer.addChild(lease.node)
    }
    private func register(_ index:Int,_ shard:NativeWildMergeSixShardPlan.Shard) {
        guard valid() else{return}
        guard roots.register(.init(kind:.puff(index),family:.defaultLazyTween,delay:shard.travelDelay,duration:shard.travelDuration),advance:{[weak self] _,seconds in
            guard let self,self.valid(),let lease=self.leases[index],self.pool.isCurrent(lease) else{return}
            let p=NativeRegularSixFxMath.out(seconds/shard.travelDuration,3)
            lease.node.position=CGPoint(x:NativeRegularSixSharedShardOwner.round6(shard.dx*p),y:-NativeRegularSixSharedShardOwner.round6(shard.dy*p))
        },retired:{[weak self] _,success in if !success{self?.dispose()}}),valid(),
        roots.register(.init(kind:.burst(index),family:.defaultLazyTween,delay:shard.fadeDelay,duration:0.25),advance:{[weak self] _,seconds in
            guard let self,self.valid(),let lease=self.leases[index],self.pool.isCurrent(lease) else{return}
            lease.node.alpha=NativeSharedSmokeSpritePresentation.sourcePackedAlpha(NativeRegularSixSharedShardOwner.round6(shard.alpha*(1-NativeRegularSixFxMath.inside(seconds/0.25,3))))
        },retired:{[weak self] _,success in if !success{self?.dispose()}}) else{dispose();return}
    }
    private func valid()->Bool{!disposed && current() && layer.parent != nil}
    private func finish(_ success:Bool) {
        guard !disposed else{return};disposed=true;roots.dispose()
        for index in leases.keys.sorted(){if let lease=leases.removeValue(forKey:index){pool.release(lease)}}
        let captured=release;release=nil;captured?();layer.removeFromParent()
        let callback=onFinished;onFinished=nil;callback?(success && current())
    }
    func dispose(){finish(false)}
    isolated deinit{roots.dispose();for lease in leases.values{pool.release(lease)};release?();layer.removeFromParent()}
}
