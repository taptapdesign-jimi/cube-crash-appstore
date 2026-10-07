import Foundation

/// The authored seven-waypoint route commits to one diagonal departure corridor.
struct NativeBeeFinaleMotion {
    struct Point {var x:Double,y:Double}
    struct Pose {var point:Point,vx:Double,vy:Double,rotation:Double,scale:Double,facing:Int,phase:String}
    struct Ambient {let startX:Double,startY:Double,endX:Double,endY:Double,wave:Double,frequency:Double,phase:Double,scale:Double}
    struct AmbientPose {var point:Point,vx:Double,vy:Double,rotation:Double,scaleX:Double,scaleY:Double}
    let width:Double,height:Double,origin:Point,seed:Double,points:[Point],controlOut:[Point],controlIn:[Point]
    static let sceneDuration=4.0,flightDuration=3.0
    static let progress=[0.0,0.10,0.19,0.34,0.50,0.62,0.76]
    static let ambient:[Ambient]=[
        Ambient(startX:-0.12,startY:0.20,endX:1.12,endY:0.34,wave:38,frequency:2.1,phase:0.2,scale:0.78),
        Ambient(startX:1.10,startY:0.28,endX:-0.12,endY:0.46,wave:31,frequency:2.6,phase:1.4,scale:0.64),
        Ambient(startX:-0.14,startY:0.58,endX:1.14,endY:0.67,wave:44,frequency:2.3,phase:2.5,scale:0.90),
        Ambient(startX:1.12,startY:0.72,endX:-0.10,endY:0.61,wave:35,frequency:2.8,phase:3.2,scale:0.70),
        Ambient(startX:0.08,startY:0.88,endX:0.88,endY:0.12,wave:28,frequency:2.4,phase:4.1,scale:0.82),
        Ambient(startX:0.92,startY:0.10,endX:0.18,endY:0.86,wave:33,frequency:2.7,phase:5,scale:0.60)]
    static func clamp(_ value:Double,_ lower:Double=0,_ upper:Double=1)->Double {min(upper,max(lower,value))}
    private static func sine(_ progress:Double)->Double {0.5-cos(.pi*clamp(progress))*0.5}
    static func resolveOrigin(_ point:Point?,width:Double,height:Double)->Point {
        guard let point,point.x.isFinite,point.y.isFinite else {return Point(x:width*0.5,y:height*0.54)}
        return Point(x:clamp(point.x,56,width-56),y:clamp(point.y,120,height-120))
    }
    private static func exit(_ origin:Point,_ width:Double,_ height:Double,_ seed:Double)->Point {
        let dx=origin.x-width*0.5,dy=origin.y-height*0.5
        let horizontal=abs(dx)>width*0.12 ? (dx>0 ? -1:1):(cos(seed)>=0 ? 1:-1)
        let vertical=abs(dy)>height*0.12 ? (dy>0 ? -1:1):(sin(seed)>=0 ? -1:1)
        return Point(x:horizontal>0 ? width*1.2:-width*0.2,y:vertical>0 ? height*1.2:-height*0.2)
    }
    init(width:Double,height:Double,origin requested:Point?,seed:Double) {
        self.width=max(1,width);self.height=max(1,height);self.seed=seed.isFinite ? seed:0
        let width=self.width,height=self.height,seed=self.seed,origin=Self.resolveOrigin(requested,width:width,height:height)
        self.origin=origin
        let exit=Self.exit(origin,width,height,seed),radius=min(width*0.128,56)+3,safeW=max(1,width-radius*2),safeH=max(1,height-radius*2)
        let right=exit.x>=width*0.5,top=exit.y<height*0.5
        let start=Point(x:right ? (origin.x-radius)/safeW:1-(origin.x-radius)/safeW,y:top ? (origin.y-radius)/safeH:1-(origin.y-radius)/safeH)
        func jitter(_ index:Double,_ amount:Double)->Double {sin(seed*1.73+origin.x*0.009+origin.y*0.006+index*2.41)*amount}
        let first=Self.clamp(max(0.43,start.x+0.24),0.43,0.72),far=Self.clamp(max(0.7,first+0.18),0.7,0.94),low=Self.clamp(start.y+0.08,0.66,0.94)
        let canonical=[start,Point(x:first,y:start.y),Point(x:far,y:low),Point(x:Self.clamp(0.18+jitter(3,0.025),0.15,0.21),y:Self.clamp(low-0.03+jitter(4,0.018),0.64,0.9)),Point(x:Self.clamp(0.24+jitter(5,0.022),0.21,0.27),y:Self.clamp(0.28+jitter(6,0.026),0.24,0.32)),Point(x:Self.clamp(0.5+jitter(7,0.03),0.46,0.54),y:Self.clamp(0.5+jitter(8,0.03),0.46,0.54)),Point(x:Self.clamp(0.78+jitter(9,0.026),0.74,0.82),y:Self.clamp(0.52+jitter(10,0.034),0.47,0.57))]
        let points=canonical.map {Point(x:radius+(right ? $0.x:1-$0.x)*safeW,y:radius+(top ? $0.y:1-$0.y)*safeH)}
        self.points=points
        var outgoing=[Point](),incoming=[Point]()
        for index in 0..<points.count-1 {
            let p=points[index],end=points[index+1],before=index>0 ? points[index-1]:p,after=index+2<points.count ? points[index+2]:end
            outgoing.append(Point(x:Self.clamp(p.x+(end.x-before.x)*0.13,radius,width-radius),y:Self.clamp(p.y+(end.y-before.y)*0.13,radius,height-radius)))
            incoming.append(Point(x:Self.clamp(end.x-(after.x-p.x)*0.13,radius,width-radius),y:Self.clamp(end.y-(after.y-p.y)*0.13,radius,height-radius)))
        }
        controlOut=outgoing;controlIn=incoming
    }
    private static func cubic(_ p:Double,_ start:Point,_ a:Point,_ b:Point,_ end:Point)->Point {
        let q=1-p
        return Point(x:pow(q,3)*start.x+3*q*q*p*a.x+3*q*p*p*b.x+pow(p,3)*end.x,y:pow(q,3)*start.y+3*q*q*p*a.y+3*q*p*p*b.y+pow(p,3)*end.y)
    }
    private func raw(_ progress:Double)->Point {
        let route=Self.clamp(progress,0,0.76)
        let index=(0..<Self.progress.count-1).first {route<=Self.progress[$0+1]} ?? Self.progress.count-2
        let p=Self.clamp((route-Self.progress[index])/max(0.001,Self.progress[index+1]-Self.progress[index]))
        var point=Self.cubic(p,points[index],controlOut[index],controlIn[index],points[index+1])
        point.y+=sin(progress * .pi*18)*sin(progress * .pi)*3;return point
    }
    private func contain(_ p:Point)->Point {let r=min(width*0.128,56)+3;return Point(x:Self.clamp(p.x,r,width-r),y:Self.clamp(p.y,r,height-r))}
    private func position(_ seconds:Double)->Point {
        let p=Self.clamp(Self.clamp(seconds,0,4)/3),exit=Self.exit(origin,width,height,seed)
        if p>=1 {return exit};if p<0.76 {return contain(raw(p))}
        let r=min(width*0.128,56)+3,corner=Point(x:exit.x>=width*0.5 ? width-r:r,y:exit.y>=height*0.5 ? height-r:r)
        let distance=max(1,hypot(exit.x-corner.x,exit.y-corner.y)),unit=Point(x:(exit.x-corner.x)/distance,y:(exit.y-corner.y)/distance),inset=min(44,max(24,min(width,height)*0.075))
        let gate=Point(x:corner.x-unit.x*inset,y:corner.y-unit.y*inset),start=contain(raw(0.76)),before=contain(raw(0.748))
        let guideDistance=max(1,hypot(gate.x-start.x,gate.y-start.y)),incoming=max(0.001,hypot(start.x-before.x,start.y-before.y)),firstDistance=min(48,guideDistance*0.28)
        let first=contain(Point(x:start.x+(start.x-before.x)/incoming*firstDistance,y:start.y+(start.y-before.y)/incoming*firstDistance))
        let lead=min(guideDistance*0.32,max(24,min(width,height)*0.11)),second=Point(x:gate.x-unit.x*lead,y:gate.y-unit.y*lead)
        if p<=0.9 {return Self.cubic(Self.clamp((p-0.76)/0.14),start,first,second,gate)}
        let t=Self.clamp((p-0.9)/0.1),slope=Self.clamp(3*lead*0.1/(0.14*distance),0.12,0.9),squared=t*t,cubed=squared*t
        let accelerated=(cubed-2*squared+t)*slope+(-2*cubed+3*squared)+(cubed-squared)*2
        return Point(x:gate.x+(exit.x-gate.x)*accelerated,y:gate.y+(exit.y-gate.y)*accelerated)
    }
    func sample(seconds:Double)->Pose {
        let time=Self.clamp(seconds,0,4),current=position(time),before=position(max(0,time-0.004)),after=position(min(4,time+0.004)),vx=after.x-before.x,vy=after.y-before.y,facing=vx < -0.01 ? -1:1
        let heading=atan2(vy,vx)*180 / .pi,relative=facing==1 ? heading:heading>=0 ? heading-180:heading+180
        return Pose(point:current,vx:vx,vy:vy,rotation:Self.clamp(relative*0.55+sin(time * .pi*3.5+seed)*4+sin(time * .pi*7+seed),-20,20),scale:0.86+sin(time * .pi*6+seed)*0.055,facing:facing,phase:time<=0.9 ? "orbit":time<=1.8 ? "right-feint":time<=2.65 ? "left-charge":"flyby")
    }
    static func idleBlend(seconds:Double)->[Double] {
        let frame=max(0,seconds)/(1.0/960),index=Int(floor(frame))%4,local=frame-floor(frame),mix=local<=0.62 ? 0:sine((local-0.62)/0.38)
        var result=Array(repeating:0.0,count:4);result[index]=1-mix;result[(index+1)%4]+=mix;return result
    }
    func sampleAmbient(_ plan:Ambient,seconds:Double)->AmbientPose {
        func position(_ time:Double)->Point {
            let base=Self.sine(Self.clamp(time/4)),envelope=sin(base * .pi),surge=sin(base * .pi*(plan.frequency*2.15+1.35)+plan.phase*1.41)*0.052*envelope,p=Self.clamp(base+surge)
            let x=(plan.startX+(plan.endX-plan.startX)*p)*width,y=(plan.startY+(plan.endY-plan.startY)*p)*height
            let primary=sin(p * .pi*(plan.frequency+0.9)+plan.phase)*plan.wave,nervous=sin(p * .pi*(plan.frequency*3.2+1.1)+plan.phase*1.73)*plan.wave*0.56,cross=cos(p * .pi*(plan.frequency*2.55+0.7)+plan.phase*1.19)*plan.wave*0.68,launch=Self.sine(Self.clamp(time/0.55))
            return Point(x:origin.x+(x+cross*envelope-origin.x)*launch,y:origin.y+(y+(primary+nervous)*envelope-origin.y)*launch)
        }
        let current=position(seconds),before=position(max(0,seconds-0.004)),after=position(min(4,seconds+0.004)),bounce=sin(seconds * .pi*7.4+plan.phase)*0.064+sin(seconds * .pi*12.6+plan.phase*1.67)*0.026
        return AmbientPose(point:current,vx:after.x-before.x,vy:after.y-before.y,rotation:sin(seconds * .pi*5.2+plan.phase)*9+sin(seconds * .pi*10.8+plan.phase*1.43)*4,scaleX:1+bounce,scaleY:1-bounce*0.78)
    }
}
