import UIKit

/// Captured Robo ensemble and source continuous orbit/gravity composition.
/// Random-comparator sorting preserves the authored comparator draws through
/// an explicit small-array run/insertion algorithm; browser engine order is
/// separately a physical parity boundary for this non-transitive source sort.
enum NativeRoboFinaleMotion {
    static let neonExitStart=1.706,headExitStart=1.906,headEnd=2.506,motionSpeed=Double.pi*4/0.85
    struct Point {let x,y:Double}
    struct Neon {
        let index,asset,exitOrder:Int
        let origin:Point,width,aspect,minimumAlpha,direction,phase,scatterX,scatterY,enterDrift:Double
        var birth:Double {0.02+Double(index)*0.016}
        var windmill:Bool {asset==1 || asset==2}
    }
    struct Plan {let drift:Double;let neons:[Neon]}
    struct Pose {let x,y,rotation,scale,alpha:Double}
    struct HeadPose {let x,y,rotation,scaleX,scaleY:Double;let frame:Int;let visible:Bool}
    static func randomComparatorSort(_ values:[Int],random:()->Double)->[Int] {
        guard values.count>1 else {return values}
        var result=values
        func compare()->Bool {random()<0.5}
        let descending=compare();var run=2
        while run<result.count {
            let lower=compare()
            if lower != descending {break};run+=1
        }
        if descending {result.replaceSubrange(0..<run,with:result[0..<run].reversed())}
        for index in run..<result.count {
            let pivot=result[index];var low=0,high=index
            while low<high {let middle=(low+high)/2;if compare() {high=middle} else {low=middle+1}}
            if low<index {for cursor in stride(from:index,through:low+1,by:-1) {result[cursor]=result[cursor-1]};result[low]=pivot}
        }
        return result
    }
    static func make(viewport:CGSize,aspects:[Double],random:()->Double)->Plan {
        func roll()->Double {let r=random();return r.isFinite ? min(1-Double.ulpOfOne,max(0,r)):0.5}
        let width=Double(viewport.width),height=Double(viewport.height),drift=(roll()*2-1)*40,count=30
        var indices=Array(repeating:0,count:5)+[1,2]
        for _ in 7..<count {indices.append(roll()<0.2 ? 3:1+Int(roll()*2))}
        indices=randomComparatorSort(indices,random:roll)
        let enlarged=Set(randomComparatorSort(Array(0..<count),random:roll).prefix(15))
        var placed:[(Point,Double)]=[],captured:[Neon]=[],lastPistol:Double?
        for index in 0..<count {
            let asset=indices[index],targetWidth=min(52,width*(0.105+Double(index%3)*0.012)),pixelWidth=targetWidth*(enlarged.contains(index) ? 1.4:1)
            let diameter=pixelWidth*1.28,margin=diameter*0.5+6,top=height*0.14+diameter*0.5,bottom=height*0.91-diameter*0.5
            var x=margin+roll()*max(1,width-margin*2),y=top+roll()*max(1,bottom-top),clearance = -Double.infinity
            for _ in 0..<120 {
                let cx=margin+roll()*max(1,width-margin*2),cy=top+roll()*max(1,bottom-top)
                let distance=placed.reduce(Double.infinity) {result,p in min(result,hypot(cx-p.0.x,cy-p.0.y)-(diameter+p.1)*0.5-16)}
                if distance>clearance {x=cx;y=cy;clearance=distance}
                if distance>=0 {break}
            }
            let origin=Point(x:x,y:y);placed.append((origin,diameter))
            let alpha=0.75+roll()*0.2;var direction:Double=roll()<0.5 ? -1:1
            if asset==3 {if let lastPistol {direction = -lastPistol};lastPistol=direction}
            let scatterAngle=roll() * .pi*2,scatterDistance=20+roll()*32,enterDrift=(roll()*2-1)*34,phase=roll() * .pi*2
            captured.append(Neon(index:index,asset:asset,exitOrder:0,origin:origin,width:pixelWidth,aspect:aspects[asset],minimumAlpha:alpha,direction:direction,phase:phase,scatterX:cos(scatterAngle)*scatterDistance,scatterY:sin(scatterAngle)*scatterDistance,enterDrift:enterDrift))
        }
        var order=Array(0..<count)
        for index in stride(from:count-1,through:1,by:-1) {order.swapAt(index,Int(roll()*Double(index+1)))}
        let neons=captured.map {n in Neon(index:n.index,asset:n.asset,exitOrder:order.firstIndex(of:n.index)!,origin:n.origin,width:n.width,aspect:n.aspect,minimumAlpha:n.minimumAlpha,direction:n.direction,phase:n.phase,scatterX:n.scatterX,scatterY:n.scatterY,enterDrift:n.enterDrift)}
        return Plan(drift:drift,neons:neons)
    }
    static func frameIndex(seconds:Double)->Int {
        guard seconds>=0.724 else {return 0}
        return min(10,Int(floor((seconds-0.724)/0.12))+1)
    }
    static func selectExitFrame(current:Int,previous:Int?,random:Double)->Int {
        var candidates=(0..<12).filter {$0 != current && $0 != previous}
        if candidates.isEmpty {candidates=(0..<12).filter {$0 != current}}
        let safe=random.isFinite ? min(0.999999999999,max(0,random)):0
        return candidates[Int(safe*Double(candidates.count))]
    }
    static func head(viewport:CGSize,drift:Double,seconds:Double,exitFrame:Int?)->HeadPose {
        let width=Double(viewport.width),height=Double(viewport.height),size=min(width*0.576,288),sign:Double=drift>=0 ? 1:-1
        var x=width/2,y=height*0.7,rotation=0.0,sx=1.0,sy=1.0
        if seconds<0.5 {
            let p=1-pow(1-max(0,seconds)/0.5,3);x=width/2+drift*(1-0.88*p);y=height+size+(height*0.7-30-height-size)*p;rotation=sign*(-0.20+0.25*p)
        } else if seconds<0.6 {
            let p=pow((seconds-0.5)/0.1,3);x=width/2+drift*0.12*(1-p);y=height*0.7-30+30*p;rotation=sign*0.05*(1-p)
        }
        if seconds>=0.7 {
            let index=min(9,max(0,Int(floor((seconds-0.7)/0.12)))),age=seconds-(0.7+Double(index)*0.12)
            if age<0.024 {let p=pow(max(0,age)/0.024,2);sx=1+0.035*p;sy=1-0.015*p}
            else if age<0.076 {let p=1-pow(1-(age-0.024)/0.052,3);sx=1.035-0.035*p;sy=0.985+0.015*p}
        }
        if seconds>=headExitStart,seconds<headExitStart+0.1 {
            let p=1-pow(1-(seconds-headExitStart)/0.1,3);x=width/2+drift*0.12*p;y=height*0.7-30*p;rotation=sign*0.18*p
        } else if seconds>=headExitStart+0.1 {
            let p=pow(min(1,(seconds-headExitStart-0.1)/0.5),3);x=width/2+drift*(0.12+0.88*p);y=height*0.7-30+(height+size-height*0.7+30)*p;rotation=sign*(0.18+1.42*p)
        }
        return HeadPose(x:x,y:y,rotation:rotation,scaleX:sx,scaleY:sy,frame:exitFrame ?? frameIndex(seconds:seconds),visible:seconds<headEnd)
    }
    static func entry(_ neon:Neon,viewport:CGSize,seconds:Double)->Pose {
        let local=max(0,seconds-neon.birth),diameter=neon.width*1.28
        if local<0.44 {
            let p=1-pow(1-local/0.44,3)
            return Pose(x:neon.origin.x+neon.enterDrift*(1-0.88*p),y:Double(viewport.height)+diameter+(neon.origin.y-24-Double(viewport.height)-diameter)*p,rotation:neon.direction*(-1.55+1.73*p),scale:1.04,alpha:1)
        }
        let raw=min(1,(local-0.44)/0.1),p=raw*raw*raw,q=raw<0.5 ? 4*raw*raw*raw:1-pow(-2*raw+2,3)/2
        return Pose(x:neon.origin.x+neon.enterDrift*0.12*(1-p),y:neon.origin.y-24*(1-p),rotation:neon.direction*0.18*(1-p),scale:1.04-0.04*q,alpha:1)
    }
    struct Live {let x,y,rotation,pulse,scale:Double}
    static func live(_ neon:Neon,motionAge:Double)->Live {
        let radians=motionSpeed*motionAge,wave=radians+neon.phase,rotationWave=radians*0.5+neon.phase,radius=8+Double(neon.index%4)*2.5
        let progress=min(1,motionAge/(headExitStart-0.75)),scatter=max(0,(progress-0.62)/0.38),eased=scatter*scatter
        let pulse=(sin(wave*1.31)+1)*0.5,angle=neon.windmill ? rotationWave*1.35*neon.direction:sin(rotationWave*0.82)*0.24*neon.direction
        return Live(x:cos(wave)*radius+neon.scatterX*eased,y:sin(wave*0.92)*radius*0.65+neon.scatterY*eased,rotation:angle,pulse:pulse,scale:0.92+pulse*0.14)
    }
    struct Exit {let pose:Pose,live:Live,drift,direction:Double}
    struct Runtime {
        let plan:Plan
        private var prior:[Pose],exits:[Exit]=[],motionStart:Double?,exitMotionAge:Double?,priorMotionAge=0.0
        var motionEnd:Double? {motionStart.map {$0+1.67}}
        init(_ plan:Plan,viewport:CGSize) {self.plan=plan;prior=plan.neons.map {entry($0,viewport:viewport,seconds:0)}}
        mutating func sample(seconds:Double,viewport:CGSize,random:()->Double)->[Pose] {
            if motionStart==nil,seconds>=0.75 {motionStart=seconds}
            let motionAge=motionStart.map {min(1.67,max(0,seconds-$0))} ?? 0
            if exitMotionAge==nil,seconds>=neonExitStart {
                exitMotionAge=priorMotionAge
                exits=plan.neons.enumerated().map {index,n in
                    let live=NativeRoboFinaleMotion.live(n,motionAge:priorMotionAge)
                    return Exit(pose:prior[index],live:live,drift:(random()*2-1)*34,direction:random()<0.5 ? -1:1)
                }
            }
            let poses=plan.neons.enumerated().map {index,n ->Pose in
                guard motionStart != nil else {return entry(n,viewport:viewport,seconds:seconds)}
                let live=NativeRoboFinaleMotion.live(n,motionAge:motionAge),alpha=n.minimumAlpha+(1-n.minimumAlpha)*live.pulse
                guard let exitMotionAge else {return Pose(x:n.origin.x+live.x,y:n.origin.y+live.y,rotation:live.rotation,scale:live.scale,alpha:alpha)}
                let start=exits[index],age=motionAge-exitMotionAge-Double(n.exitOrder)*0.006,ratio=live.scale/start.live.scale
                let dx=live.x-start.live.x,dy=live.y-start.live.y,rotation=live.rotation-start.live.rotation
                if age<=0 {return Pose(x:start.pose.x+dx,y:start.pose.y+dy,rotation:start.pose.rotation+rotation,scale:start.pose.scale*ratio,alpha:alpha)}
                if age<=0.1 {
                    let p=1-pow(1-age/0.1,2)
                    return Pose(x:start.pose.x+start.drift*0.12*p+dx,y:start.pose.y-24*p+dy,rotation:start.pose.rotation+start.direction*0.18*p+rotation,scale:start.pose.scale*(1+0.04*p)*ratio,alpha:alpha)
                }
                let p=min(1,(age-0.1)/0.44),below=Double(viewport.height)+max(80,n.width*n.aspect*prior[index].scale)
                return Pose(x:start.pose.x+start.drift*(0.12+p*0.88)+dx,y:start.pose.y-24+(below-start.pose.y+24)*p*p+dy,rotation:start.pose.rotation+start.direction*(0.18+p*1.55)+rotation,scale:start.pose.scale*1.04*ratio,alpha:p>=1 ? 0:alpha)
            }
            let completed=motionEnd.map {seconds >= $0} ?? false
            let painted=completed ? poses.map {Pose(x:$0.x,y:$0.y,rotation:$0.rotation,scale:$0.scale,alpha:0)}:poses
            prior=painted;priorMotionAge=motionAge;return painted
        }
    }
}
