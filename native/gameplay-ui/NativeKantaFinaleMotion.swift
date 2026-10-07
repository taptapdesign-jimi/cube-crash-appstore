import UIKit

/// Original kanta-finale-scene.ts captured collection geometry and playheads.
struct NativeKantaFinaleMotion {
    struct Point { var x:Double,y:Double }
    struct Pose { var x:Double,y:Double,scaleX:Double=1,scaleY:Double=1,rotation:Double=0,alpha:Double=1,depth:Double=0 }
    struct Robot { let source:String,width:Double,restY:Double,startX:Double,endX:Double,phase:Double,direction:Int,entry:Double,crossing:Double,pickupCan:Int,rotationAmplitude:Double }
    struct Can { let source:String,width:Double,height:Double,rest:Point,phase:Double,rotation:Double,entry:Double,owner:Int,target:Point,depth:Double,pickupRotation:Double,pickupStart:Double }
    struct Composite { let source:String,width:Double,height:Double,rest:Point,depth:Double }
    let viewport:CGSize,robots:[Robot],cans:[Can],composites:[Composite]
    static let sceneDuration=2.18,exitStart=1.56,exitDuration=0.58,pickupDuration=0.32/0.6
    private static func clamp(_ x:Double)->Double { min(1,max(0,x)) }
    private static func smooth(_ x:Double)->Double {let t=clamp(x);return t*t*(3-2*t)}
    private static func cubic(_ x:Double)->Double {1-pow(1-clamp(x),3)}
    private static func back(_ x:Double,_ strength:Double=1.70158)->Double {let t=clamp(x)-1;return 1+(strength+1)*pow(t,3)+strength*t*t}
    private static func backIn(_ x:Double)->Double {let t=clamp(x);return 2.70158*t*t*t-1.70158*t*t}
    private static func rounded(_ x:Double,_ digits:Double)->Double {Double(String(format:digits == 100 ? "%.2f":"%.4f",x))!}
    static func pickup(progress:Double,start:Point,target:Point,jump:Double)->Pose {
        let p=clamp(progress),apex=min(start.y,target.y)-jump,descent=(p-0.42)/0.58
        let landing=descent <= 0.78 ? pow(descent/0.78,2)*0.86 : 0.86+back((descent-0.78)/0.22,1.8)*0.14
        let y=p <= 0.42 ? start.y+(apex-start.y)*back(p/0.42,1.9) : apex+(target.y-apex)*landing
        return Pose(x:start.x+(target.x-start.x)*smooth(p),y:y,scaleX:1+0.2*cubic(p),scaleY:1+0.2*cubic(p),rotation:sin(p * .pi))
    }
    static func pickupStarts(crossings:[Double],random:()->Double)->[Double] {
        func roll()->Double {let x=random();return x.isFinite ? max(0,min(0.999999,x)):0.5}
        var candidates:[(index:Int,earliest:Double,desired:Double)]=[]
        for (index,crossing) in crossings.enumerated() {
            let earliest=Double(index)*0.026+0.36,desired=max(crossing-0.4+roll()*0.18,earliest)
            candidates.append((index,earliest,desired))
        }
        candidates.sort { $0.desired == $1.desired ? $0.index < $1.index : $0.desired < $1.desired }
        var proposed=[Double](),earliest=[Double](),previous = -Double.infinity,previousFeasible = -Double.infinity
        for candidate in candidates {
            let gap=0.11+roll()*(0.18-0.11),start=max(candidate.desired,previous+gap),feasible=max(candidate.earliest,previousFeasible+0.11)
            proposed.append(start);earliest.append(feasible);previous=start;previousFeasible=feasible
        }
        var ordered=Array(repeating:0.0,count:candidates.count),result=ordered
        guard let last=candidates.indices.last else {return []}
        ordered[last]=min(max(proposed[last],earliest[last]+0.15),sceneDuration-pickupDuration-0.02+0.15)-0.15
        if last>0 {for index in stride(from:last-1,through:0,by:-1) { ordered[index]=max(earliest[index],min(proposed[index],ordered[index+1]-0.11)) }}
        for (index,candidate) in candidates.enumerated() {result[candidate.index]=ordered[index]};return result
    }
    static func make(viewport:CGSize,random:()->Double={Double.random(in:0..<1)})->Self {
        func roll()->Double {let x=random();return x.isFinite ? max(0,min(0.999999,x)):0.5}
        func shuffle<T>(_ input:[T])->[T] {var values=input;if values.count>1 {for index in stride(from:values.count-1,through:1,by:-1) {values.swapAt(index,Int(roll()*Double(index+1)))}};return values}
        let width=max(320,Double(viewport.width)),height=max(520,Double(viewport.height))
        let first=roll()<0.5 ? -1:1,directions=[first,-first,first,-first],pickupIndices=shuffle([0,1,2,3])
        let raises=[0.1,0.15,0.05,0.05+roll()*0.05],robotOrder=shuffle([0,1,2,3])
        let extra=shuffle((0..<7).map {robotOrder[$0%4]}),lanes=shuffle([-0.34,-0.26,-0.18,-0.10,0,0,0,0.10,0.18,0.26,0.34])
        let robots=(0..<4).map {index->Robot in
            let direction=directions[index],sourceIndex=direction<0 ? 0:1,w=rounded((sourceIndex==0 ? 92.0:108.0)*3.78,100)
            let rest=height*0.5-w*0.51-w*0.22+w*0.35-2+Double(direction)*34+(index<2 ? -8:8)-w*raises[index]
            let left = -width*0.5-w*0.65,right=width*0.5+w*0.65,entry=rounded(Double(index)*(0.7/3),10000),amplitude=5+roll()*5,phase=roll()*2 * .pi
            return Robot(source:sourceIndex==0 ? "assets/journey assets/robo/robo1.png":"assets/journey assets/robo/robo frontalni.png",width:w,restY:rest,startX:direction>0 ? left:right,endX:direction>0 ? right:left,phase:phase,direction:direction,entry:entry,crossing:entry+0.74,pickupCan:pickupIndices[index],rotationAmplitude:amplitude)
        }
        let owners=(0..<11).map {index in index>=4 ? extra[index-4] : robots.firstIndex {$0.pickupCan==index}!}
        let starts=pickupStarts(crossings:owners.map {robots[$0].crossing},random:random)
        let slots:[(Double,Double,Double,Double,Double)]=[(-105,128,-13,45,7),(-35,132,8,48,7),(35,126.6,-6,47,7),(105,127.6,14,45,7),(-120,51,-18,54,8),(-60,70,10,58,8),(0,77,-4,62,8),(60,66,11,57,8),(120,47,17,52,8),(-78,3,-11,65,9),(0,0,3,72,10)]
        let cans=(0..<11).map { (index:Int)->Can in
            let s=slots[index],upper=index<4,featured=index==6,scale=featured ? 0.85*0.9:1,w=s.3*(4/2.3)*2*0.60*1.24*scale,h=w*171/128
            let lower=upper ? h*0.1:0,raise=upper ? 0:h*0.4,rotationOffset=upper ? (roll()*2-1)*5:0
            let maximum=width*0.5-w*1.2*0.4,targetX=max(-maximum,min(maximum,width*lanes[index]))
            let sign=roll()<0.5 ? -1.0:1,magnitude=16+roll()*(44-16)
            let restY=height*0.5-h*0.5-s.1*1.7-h*0.02+height*0.1+lower+(featured ? h*0.35:0)-raise
            return Can(source:"assets/shop/kanta/\(["01","03","04"][index%3]).png",width:w,height:h,rest:Point(x:s.0+(featured ? 20:0),y:restY),phase:Double(index%3-1)*0.16,rotation:s.2+rotationOffset,entry:Double(index)*0.026,owner:owners[index],target:Point(x:targetX,y:height*0.5+h*0.4),depth:s.4+(featured ? -1:0),pickupRotation:sign*magnitude,pickupStart:starts[index])
        }
        let specs:[(String,Double,Double,Double,Double,Double)]=[("kante-ljevo",315,180/240,-105,0.05,12),("kante-sredina",495,219/390,0,0,13),("kante-desno",315,180/240,105,0.05,12)]
        let composites=specs.map {s in Composite(source:"assets/shop/kanta/\(s.0).png",width:s.1,height:s.1*s.2,rest:Point(x:s.3,y:height*0.5-s.1*s.2*0.5+height*0.1-height*s.4),depth:s.5)}
        return Self(viewport:CGSize(width:width,height:height),robots:robots,cans:cans,composites:composites)
    }
    func robotPose(_ index:Int,seconds:Double)->Pose {
        let r=robots[index],time=seconds-r.entry
        guard time>=0 else {return Pose(x:0,y:0,alpha:0)}
        let wave=sin(time*6.2+r.phase),scale=0.82+Self.smooth(time/0.18)*0.18
        return Pose(x:Self.rounded(r.startX+(r.endX-r.startX)*Self.clamp(time/1.48),100),y:Self.rounded(r.restY-abs(wave)*10,100),scaleX:Self.rounded(scale,10000),scaleY:Self.rounded(scale,10000),rotation:Self.rounded(wave*r.rotationAmplitude+Double(r.direction)*3,100),alpha:time>=1.48-0.0001 ? 0:1,depth:11)
    }
    func canPose(_ index:Int,seconds:Double)->Pose {
        let c=cans[index],local=seconds-c.entry
        guard local>=0 else {return Pose(x:0,y:0,alpha:0)}
        let entry=Self.back(local/0.36),pickupTime=seconds-c.pickupStart,p=Self.clamp(pickupTime/Self.pickupDuration),picking=pickupTime>=0 && p<1
        let sway=sin(max(0,seconds-0.36)*2.8+c.phase)*3*(1-Self.clamp(pickupTime/Self.pickupDuration))
        let origin=Point(x:c.rest.x+sin(max(0,c.pickupStart-0.36)*2.8+c.phase)*3,y:c.rest.y)
        let sample=Self.pickup(progress:p,start:origin,target:c.target,jump:Double(viewport.height)*0.12)
        let anticipation=pickupTime>0 && pickupTime<0.2 ? sin(pickupTime/0.2 * .pi)*0.1:0,scale=pickupTime>=0 ? sample.scaleX:1
        return Pose(x:Self.rounded(pickupTime>=0 ? sample.x:c.rest.x*entry+sway,100),y:Self.rounded(pickupTime>=0 ? sample.y:c.rest.y+225-225*entry,100),scaleX:Self.rounded((0.72+entry*0.28+anticipation)*scale,10000),scaleY:Self.rounded((0.72+entry*0.28-anticipation*0.65)*scale,10000),rotation:Self.rounded(c.rotation+sway*0.22+c.pickupRotation*sample.rotation*(picking ? 1:0),100),alpha:p>=1 ? 0:1,depth:pickupTime>=0 ? 14:c.depth)
    }
    func compositePose(_ index:Int,seconds:Double)->Pose {
        let c=composites[index],entry=Self.back(seconds/0.76,2.65),localExit=seconds-Self.exitStart,exit=Self.backIn(localExit/Self.exitDuration)
        let sway=sin(max(0,seconds-0.76)*2.8)*2*(1-Self.clamp(localExit/Self.exitDuration)),anticipation=localExit>0 && localExit<0.2 ? sin(localExit/0.2 * .pi)*0.1:0
        return Pose(x:Self.rounded(c.rest.x*entry+sway,100),y:Self.rounded(c.rest.y+125-125*entry+(Double(viewport.height)*0.72+180-c.rest.y)*exit,100),scaleX:Self.rounded(0.72+entry*0.28+anticipation,10000),scaleY:Self.rounded(0.72+entry*0.28-anticipation*0.65,10000),alpha:exit<0.98 ? 1:0,depth:c.depth)
    }
}
