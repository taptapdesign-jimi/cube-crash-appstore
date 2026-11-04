import Foundation
import CoreGraphics

/// Exact source confetti-system.ts birth plans. Seconds replace browser milliseconds.
enum NativeResultCelebrationTheme:String {case area55,forest,beach,arcade}
enum NativeResultConfettiPlan {
    static let maximumRuntime=9.8
    struct Area {
        let birth,startX,startY,endX,endY,width,height,radius,rotation:Double
        let color:Int
        func sample(seconds:Double)->Pose {
            let p=(seconds-birth)/3,travel=areaEase(min(1,max(0,p)))
            return Pose(visible:p>=0 && p<1,x:startX+(endX-startX)*travel,y:startY+(endY-startY)*travel,
                opacity:0.9,scale:1,rotation:rotation*travel,skewX:0,imageScaleX:1,imageScaleY:1)
        }
    }
    struct Leaf {let motion:NativeBeeLeafMotion;let width,height:Double;let asset:Int}
    struct Bubble {
        let birth,lifetime,startX,startY,rise,direction,weave,cycles,size,scale,opacity:Double
        let asset:Int
        func sample(seconds:Double)->Pose {
            let age=seconds-birth,p=min(1,max(0,age/lifetime)),enter=min(1,max(0,age/0.12)),exit=p>0.92 ? max(0,(1-p)/0.08):1
            return Pose(visible:age>=0 && age<lifetime,x:startX+direction*weave*sin(p*2*Double.pi*cycles),y:startY-rise*p,
                opacity:opacity*enter*exit,scale:scale*(0.35+(0.5-cos(Double.pi*enter)*0.5)*0.65)*(0.96+p*0.12),rotation:0,skewX:0,imageScaleX:1,imageScaleY:1)
        }
    }
    struct Pose {let visible:Bool;let x,y,opacity,scale,rotation,skewX,imageScaleX,imageScaleY:Double}
    static func area(width:Double,height:Double,random:()->Double)->[Area] {
        var result:[Area]=[];result.reserveCapacity(300)
        let origins:[(Double,Double,Bool)]=[(-width*0.3,Double.pi/4,true),(width*1.3,Double.pi*3/4,false),(width*0.25,Double.pi/2-0.3,true),(width*0.75,Double.pi/2+0.3,false)]
        for burst in 0..<5 {
            let batch=burst==0 ? 0:random()*0.2
            for (start,base,left) in origins {for i in 0..<15 {
                let angle=base+(random()-0.5)*0.25,category=i%3
                let vmin=category==0 ? 120.0:category==1 ? 150:180,vmax=category==0 ? 180.0:category==1 ? 220:280
                let velocity=vmin+random()*(vmax-vmin),strip=i%2==0
                let x=start+(left ? 1:-1)*random()*150,y = -height*0.3+random()*50
                let wiggle=80+random()*120,phase=random()*2*Double.pi
                let endX=x+cos(angle)*velocity*2+sin(phase+1)*wiggle
                let birth=Double(burst)+batch+max(0,random()*3-0.4)
                let w=strip ? 3+random():4+random()*2,h=strip ? 8+random()*7:6+random()*4
                result.append(Area(birth:birth,startX:x,startY:y,endX:endX,endY:y+height*1.3,width:w,height:h,radius:strip ? 2:1,rotation:360+random()*720,color:i%6))
            }}
        }
        return result
    }
    static func forest(width:Double,height:Double,random:()->Double)->[Leaf] {
        func oldBirth(_ i:Int)->Double {let wave=i/3,slot=i%3;return i<12 ? Double(slot)*0.018+Double(wave)*0.028:Double(wave)*(2.9/13)+Double(slot)*0.018}
        func life(_ i:Int)->Double {min(1.18+Double(i%5)*0.09,3.86-oldBirth(i))}
        let lastEnd=(0..<3).map {Double($0)*0.018+life(39+$0)}.max()!,lastStart=maximumRuntime-lastEnd
        let phase=random()*2*Double.pi
        return (0..<42).map {i in
            let wave=i/3,slot=i%3,lifetime=life(i),birth=Double(wave)/13*lastStart+Double(slot)*0.018
            let unit=(sin(Double(i+1)*91.731+phase*13.17)+1)*0.5
            let angle=(Double(i)*2.399963229728653+unit*0.9).truncatingRemainder(dividingBy:Double.pi*2)
            let x=(Double(i)+0.5)/42*width+cos(angle)*(12+Double(i%4)*9)
            let boost=i<12 ? 2.0:i%5==0 ? 1.5:unit>0.78 ? 2:1
            let w=(16+((unit*17+Double(i)*7.31).truncatingRemainder(dividingBy:1)*22).rounded())*boost
            let heightUnit=(sin(Double(i+3)*47.17+phase*5.3)+1)*0.5,h=(14+(heightUnit*28).rounded())*boost
            let y = -h*0.6-Double(slot)*8,scatter=width*(0.476+unit*0.714)
            let vx=cos(angle)*scatter/lifetime,vy=sin(angle)*scatter/lifetime-90-Double(i%3)*18
            let motion=NativeBeeLeafMotion(birth:birth,lifetime:lifetime,birthX:x,birthY:y,velocityX:vx,velocityY:vy,
                gravity:NativeBeeLeafMotion.gravity(viewportHeight:height,birthY:y,velocityY:vy,lifetime:lifetime),flutter:Double(i)*1.73,
                spin:(i%2==1 ? 1:-1)*(260+Double(i%6)*48),scale:i%3 != 0 ? 1.08:0.88,peakOpacity:i%3 != 0 ? 1:0.86)
            return Leaf(motion:motion,width:w,height:h,asset:i%6)
        }
    }
    static func beach(width:Double,height:Double,random:()->Double)->[Bubble] {
        // Same five authored opacity levels as Journey Beach bubble drift.
        // Retain the original draw count and shuffle so travel RNG is unchanged.
        let levels=[0.2,0.3,0.4,0.5,0.6]
        var opacities=(0..<40).map {levels[min(4,Int((Double($0)+min(1,max(0,random())))/8))]}
        for i in stride(from:39,through:1,by:-1) {let other=min(i,Int(floor(min(1,max(0,random()))*Double(i+1))));opacities.swapAt(i,other)}
        let waves=[6,10,7,7,5,5];var wave=0,start=0,result:[Bubble]=[]
        for i in 0..<40 {
            while i>=start+waves[wave] && wave<5 {start += waves[wave];wave += 1}
            let slot=i-start,lane=(Double(slot)+0.12+random()*0.76)/Double(waves[wave]),x=(2+lane*96)/100*width
            let gap=50+random()*50,y=height*(1.03+random()*0.08)+Double(slot%4)*gap
            let size=(18+pow(random(),1.6)*42)*(i>=25 ? 1.08:2.4),rise=y+size*(1.1+random()*1.4)
            let direction=random()<0.5 ? -1.0:1,weave=max(16,width*(0.03+random()*0.09)),cycles=1.35+random()*0.3
            let sampledLife=1.65+random()*0.5,sampledDelay=Double(slot)*(0.045+random()*0.035)
            let lifetime=i==39 ? 2.15:sampledLife,delay=i==39 ? 0.32:sampledDelay
            result.append(Bubble(birth:Double(wave)/5*7.33+delay,lifetime:lifetime,startX:x,startY:y,rise:rise,direction:direction,weave:weave,cycles:cycles,
                size:size,scale:0.75+random()*0.35,opacity:opacities[i],asset:i%6))
        }
        return result
    }
    /// Arcade borrows the real HUD fan geometry, with its own symmetric clock.
    /// No reward receipt, trophy pull, final acceleration or score side effect.
    struct Coin {
        let birth,lifetime,size,spin,phase:Double
        let points:[CGPoint]
        let viewportHeight:Double
        let asset:Int
        func sample(seconds:Double)->Pose {
            let age=seconds-birth,t=min(1,max(0,age/lifetime))
            let progress=(1-cos(.pi*t))/2
            let offset=progress*Double(points.count-1),index=min(points.count-2,Int(offset)),mix=offset-Double(index)
            let a=points[index],b=points[index+1],y=a.y+(b.y-a.y)*mix
            let ascent=min(1,max(0,(viewportHeight-y)/max(1,viewportHeight)))
            return Pose(visible:age>=0 && age<lifetime,x:a.x+(b.x-a.x)*mix,y:y,
                opacity:1,scale:1-0.5*ascent,rotation:phase+age*spin,skewX:0,imageScaleX:1,imageScaleY:1)
        }
    }
    static func arcade(width:Double,height:Double,random:()->Double)->[Coin] {
        let viewport=CGSize(width:width,height:height)
        let enlargement=NativeSourceHUDStarPlan.coinEnlargement(for:viewport)
        var result:[Coin]=[]
        for ordinal in 0..<24 {
            let size=(40+random()*56)*(enlargement/1.20)*1.20
            let margin=size/2,span=max(0,width-size)
            let start=CGPoint(x:margin+random()*span,y:height+size+8)
            let target=CGPoint(x:margin+random()*span,y:-size*1.5-8)
            var previousArrival=0.0,previousEnd=0.0
            let source=NativeSourceHUDStarPlan.construct(ordinal:ordinal%3,sizes:[30,42,56],origin:start,target:target,
                textureWidth:128,previousArrival:&previousArrival,random:random)
            let flight=source.readableCoin(ordinal:ordinal,previousEnd:&previousEnd,gentleLaunch:true)
            let birth=Double(ordinal)/3.6 //40% fewer births over the same emission window.
            let life=2.75+random()*0.50
            result.append(Coin(birth:birth,lifetime:life,size:size,spin:(random()<0.5 ? -1:1)*(35+random()*55),
                phase:random()*360,points:flight.points,viewportHeight:height,asset:ordinal%6))
        }
        return result
    }
    /// Visual-only soft-disc collisions. Fixed substeps borrow the result clock;
    /// at most15 catch-up steps are admitted after delayed asset readiness.
    struct CoinField {
        let coins:[Coin]
        private(set) var elapsed=0.0,collisionCount=0
        private var retired=Set<Int>()
        private var offsets:[CGPoint],velocities:[CGPoint],turns:[Double],spinVelocity:[Double]
        init(coins:[Coin]) {
            self.coins=coins;offsets=Array(repeating:.zero,count:coins.count)
            velocities=offsets;turns=Array(repeating:0,count:coins.count);spinVelocity=turns
        }
        mutating func advance(to time:Double) {
            guard time.isFinite,time>=elapsed else{return}
            let target=min(maximumRuntime,time)
            // A hidden/preparing canvas has no visible collision history to replay.
            if target-elapsed>0.25 {elapsed=target-0.25}
            let dt=1.0/60
            while elapsed+dt<=target+0.000001 {elapsed += dt;step(dt:dt)}
        }
        func pose(_ index:Int,at time:Double?=nil)->Pose {
            let p=coins[index].sample(seconds:time ?? elapsed),o=offsets[index]
            return Pose(visible:p.visible && !retired.contains(index),x:p.x+o.x,y:p.y+o.y,opacity:p.opacity,scale:p.scale,
                rotation:p.rotation+turns[index],skewX:0,imageScaleX:1,imageScaleY:1)
        }
        private mutating func step(dt:Double) {
            var positions=Array(repeating:CGPoint.zero,count:coins.count),baseVelocities=positions
            var visibleSizes=Array(repeating:0.0,count:coins.count)
            var active:[Int]=[]
            for i in coins.indices {
                let p=coins[i].sample(seconds:elapsed)
                guard p.visible,!retired.contains(i) else{continue};active.append(i)
                visibleSizes[i]=coins[i].size*p.scale
                let previous=coins[i].sample(seconds:elapsed-dt)
                baseVelocities[i]=CGPoint(x:(p.x-previous.x)/dt,y:(p.y-previous.y)/dt)
                offsets[i].x += velocities[i].x*dt;offsets[i].y += velocities[i].y*dt
                velocities[i].x *= exp(-2.2*dt);velocities[i].y *= exp(-2.2*dt)
                turns[i] += spinVelocity[i]*dt;spinVelocity[i] *= exp(-1.8*dt)
                positions[i]=CGPoint(x:p.x+offsets[i].x,y:p.y+offsets[i].y)
            }
            for left in active.indices {for right in active.indices where right>left {
                let i=active[left],j=active[right],a=positions[i],b=positions[j]
                let dx=b.x-a.x,dy=b.y-a.y,distance=hypot(dx,dy),contact=(visibleSizes[i]+visibleSizes[j])*0.41
                guard distance<contact else{continue}
                let nx=distance>0.001 ? dx/distance:(i.isMultiple(of:2) ? 1.0:-1.0)
                let ny=distance>0.001 ? dy/distance:0
                let invA=1600/(coins[i].size*coins[i].size),invB=1600/(coins[j].size*coins[j].size),total=invA+invB
                let correction=(contact-distance)*0.75
                let pushA=correction*invA/total,pushB=correction*invB/total
                offsets[i].x -= nx*pushA;offsets[i].y -= ny*pushA
                offsets[j].x += nx*pushB;offsets[j].y += ny*pushB
                positions[i].x -= nx*pushA;positions[i].y -= ny*pushA
                positions[j].x += nx*pushB;positions[j].y += ny*pushB
                let closing=(baseVelocities[j].x+velocities[j].x-baseVelocities[i].x-velocities[i].x)*nx
                    +(baseVelocities[j].y+velocities[j].y-baseVelocities[i].y-velocities[i].y)*ny
                guard closing<0 else{continue}
                let impulse=min(220,-1.65*closing/total);collisionCount += 1
                velocities[i].x -= impulse*invA*nx;velocities[i].y -= impulse*invA*ny
                velocities[j].x += impulse*invB*nx;velocities[j].y += impulse*invB*ny
                spinVelocity[i] -= impulse*invA*(nx+0.3);spinVelocity[j] += impulse*invB*(nx+0.3)
            }}
            for i in active {
                velocities[i].x=min(140,max(-140,velocities[i].x));velocities[i].y=min(60,max(-60,velocities[i].y))
                offsets[i].x=min(140,max(-140,offsets[i].x));offsets[i].y=min(coins[i].size*0.5,max(-coins[i].size*0.5,offsets[i].y))
                spinVelocity[i]=min(180,max(-180,spinVelocity[i]))
                // Retire only after the entire rotated footprint clears the top.
                if coins[i].sample(seconds:elapsed).y+offsets[i].y+visibleSizes[i]*0.72<0 {retired.insert(i)}
            }
        }
    }
    private static let areaSamples=(0...256).map {i in
        let p=Double(i)/256;var lo=0.0,hi=1.0
        for _ in 0..<20 {let t=(lo+hi)/2,x=3*(1-t)*t*t*0.58+t*t*t;if x<p{lo=t}else{hi=t}}
        let t=(lo+hi)/2;return 3*(1-t)*t*t+t*t*t
    }
    private static func areaEase(_ p:Double)->Double {
        let position=p*256,index=Int(floor(position)),next=min(256,index+1)
        return areaSamples[index]+(areaSamples[next]-areaSamples[index])*(position-Double(index))
    }
}
