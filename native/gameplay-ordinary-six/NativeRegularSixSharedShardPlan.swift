import Foundation

/// PRIVATE streamed original regularMerge6ShardsTemplated recipe. Initial
/// resource acquisition and root registration occur BETWEEN shard RNG draws,
/// preserving synchronous root wake/reentry ordering rather than bulk building.
struct NativeRegularSixSharedShardPlan {
    typealias Shard=NativeRegularSixShardPlan.Shard
    let shards:[Shard]
    init(patternIndex:Int,reduced:Bool,random:()->Double,isActive:()->Bool = {true},
         acquire:@escaping(Int)->Void,
         materialize:@escaping(Int,[Double],Double,Double)->Void,
         registerTweens:@escaping(Int,Shard)->Void){
        let patterns=NativeRegularShardTemplates.patterns,pattern=patterns[patternIndex%patterns.count]
        let stride=reduced ? 2:1,visual=reduced ? 1.12:1.18,distanceScale=reduced ? 1.12:1.2
        var result:[Shard]=[]
        for (index,definition) in pattern.enumerated() where index%stride==0 {
            guard isActive() else{break}
            let id=result.count;acquire(id)
            let width=(8+random()*10)*definition.size*2.4*visual,height=width*(0.8+random()*1.4)
            let count=4+Int(floor(random()*4));var points:[Double]=[]
            for vertex in 0..<count {
                let angle=Double(vertex)/Double(count)*Double.pi*2+(random()-0.5)*0.8,radius=(0.3+random()*0.7)*min(width,height)/2
                points += [cos(angle)*radius,sin(angle)*radius]
            }
            let rotation=random()*Double.pi
            materialize(id,points,rotation,definition.alpha)
            let angle=definition.angle*Double.pi/180,distance=definition.distance*96*2.5*distanceScale
            let bx=pow(abs(cos(angle)),0.75)*(cos(angle)<0 ? -1:1),by=pow(abs(sin(angle)),0.75)*(sin(angle)<0 ? -1:1),maximum=max(abs(bx),abs(by))
            let shard=Shard(points:points,rotation:rotation,alpha:definition.alpha,dx:bx/maximum*distance,dy:by/maximum*distance,travelDuration:0.35*definition.speed,fadeDelay:0.15+0.1*random())
            result.append(shard)
            registerTweens(id,shard)
        }
        shards=result
    }
}
