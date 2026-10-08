import Foundation

/// Original attachPuffyClouds(count5,floatBounce:false,timingScale:.38).
/// Finite samples only; no timers, repeating loops, audio or completion decisions.
enum NativeNoMovesCloudPlan {
    static let paths=["assets/board transition/oblak+srednji.png","assets/board transition/oblak mali desno.png","assets/board transition/oblak mali ljevo.png","assets/board transition/oblak veliki ljevo dole.png"]
    struct Cloud {
        let asset:Int,width,height,x,y,rotation,baseScale,enterDelay,windDuration,drift,windY:Double
        var exitAt:Double {enterDelay+0.06*0.38+windDuration+0.05*0.38}
        var duration:Double {exitAt+0.48*0.38}
        struct Pose {let x,y,scale,alpha:Double}
        func sample(at seconds:Double)->Pose {
            let t=seconds-enterDelay
            func sine(_ t:Double)->Double {(1-cos(min(1,max(0,t)) * .pi))/2}
            // Literal GSAP duration admission rounds to seven decimal places.
            let wind=(windDuration*1e7).rounded()/1e7,yWind=(windDuration*0.55*1e7).rounded()/1e7
            let dx=drift*sine((t-0.06*0.38)/wind),dy=windY*sine((t-0.06*0.38)/yWind)
            if t<0{return Pose(x:x,y:y,scale:0.12,alpha:0)}
            if t<0.34*0.38 {let p=NativeNoMovesPlan.backOut(t/(0.34*0.38),2.2);return Pose(x:x+dx,y:y+dy,scale:0.12+(baseScale*1.22-0.12)*p,alpha:min(1,max(0,0.8*p)))}
            if seconds<exitAt {let p=NativeNoMovesPlan.powerOut((t-0.34*0.38)/(0.14*0.38));return Pose(x:x+dx,y:y+dy,scale:baseScale*1.22-baseScale*0.22*p,alpha:0.8)}
            let age=seconds-exitAt
            if age<0.14*0.38 {let p=NativeNoMovesPlan.backOut(age/(0.14*0.38),2);return Pose(x:x+dx,y:y+dy,scale:baseScale+baseScale*0.14*p,alpha:0.8)}
            let p=NativeNoMovesPlan.backIn((age-0.14*0.38)/(0.34*0.38),1.55)
            return Pose(x:x+dx,y:y+dy,scale:baseScale*1.14*(1-p),alpha:min(1,max(0,0.8*(1-p))))
        }
    }
    static func make(width:Double,height:Double,random:()->Double)->[Cloud] {
        let w=max(320,width),h=max(520,height),base=min(240,max(104,w*0.22)),step=max(18,base*0.18)
        return (0..<5).map {i in
            let boost=0.95+random()*0.4,size=((base+Double(i%3)*step)*boost).rounded(),height=(size/1.15).rounded()
            let scale=(0.9+Double(i%3)*0.08)*min(1.1,0.98+boost*0.1),rotation=Double(i%5-2)*5,delay=Double(i)*0.06*0.38
            let factor=1+(random()*2-1)*0.18,dy=(random()*2-1)*10,duration=(1.6*0.52+0.2)*factor*0.38,distance=w*0.32+random()*(w*0.3)
            let x=(w*0.5+(random()*2-1)*min(26,w*0.04)).rounded(),y=(h*0.5+(random()*2-1)*min(90,h*0.15)).rounded()
            return Cloud(asset:i%4,width:size,height:height,x:x,y:y,rotation:rotation,baseScale:scale,enterDelay:delay,windDuration:duration,drift:distance*(i%2==0 ? -1:1),windY:dy)
        }
    }
}
