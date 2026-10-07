import Foundation

/// Canonical mobile Forest flight owner. Float32 samples preserve the source Catmull-Rom math.
/// Five retained bees produce finite compositor plans, including gate and direction continuity.
public final class NativeForestBeePlanning {
    private struct Flight {
        var points=[Float](repeating:0,count:16)
        var duration=11.0,elapsed=0.0,onScreen=0.0,bounce=0.0,width=40.0,scale=1.0,passage=0.12
        var unit=0,side = -1,gate=true,phase="roam"
        mutating func set(_ index:Int,_ x:Double,_ y:Double) {points[index*2]=Float(x);points[index*2+1]=Float(y)}
        func read(_ index:Int,_ axis:Int,cyclic:Bool=false)->Double {
            let bounded=cyclic ? (index%7+7)%7 : min(7,max(0,index))
            return Double(points[bounded*2+axis])
        }
    }
    private struct Bee {
        var flight:Flight
        var asset="bee1",previous:String?,pending:String?,pendingSeconds=0.0,blend=0.08,behind=false
    }
    private let random:()->Double,contentTop:Double,left:Double,right:Double,top:Double,bottom:Double,leftPine:Double,rightPine:Double,mainBottom:Double
    private var bees:[Bee]=[]
    public init(contentTop:Double,mainX:Double,mainY:Double,mainWidth:Double,mainHeight:Double,random:@escaping ()->Double={Double.random(in:0..<1)}) {
        self.random=random;self.contentTop=contentTop
        left=mainX+160.92/390*mainWidth;right=mainX+205.08/390*mainWidth
        top=mainY-contentTop+60/350*mainHeight;bottom=mainY-contentTop+85/350*mainHeight
        leftPine=mainX+103/390*mainWidth;rightPine=mainX+287/390*mainWidth;mainBottom=mainY-contentTop+mainHeight
        var all:[Flight]=[]
        for index in 0..<18 {
            var flight=Flight();flight.unit=index>=14 ? -1 : index<10 ? index : [2,4,5,7][index-10]
            let ordinal=index<10 ? index : -1
            flight.side=ordinal%2==0 ? -1 : 1;flight.gate=ordinal>=0
            let fraction=Double(ordinal)*0.61803398875
            flight.passage=0.12+(fraction.truncatingRemainder(dividingBy:1))*0.76
            flight.scale=[0.65,0.7,0.8,0.9,1.0][index%5]
            resetRoam(&flight,index:index,initial:0.04+Double(index)/18*0.82)
            all.append(flight)
        }
        bees=[0,2,5,7,9].enumerated().map {Bee(flight:all[$0.element],asset:$0.offset%2==0 ? "bee1" : "bee3")}
    }
    private func clamp(_ value:Double,_ low:Double,_ high:Double)->Double {min(high,max(low,value))}
    private func sample()->Double {let v=random();return v.isFinite ? clamp(v,0,1) : 0.5}
    private func centered()->Double {sample()*2-1}
    private func lane(_ unit:Int)->Double {unit<0 ? 190 : [384.0,474,584,672,802,906,1010,1134,1238,1362][unit%10]}
    private func resetRoam(_ p:inout Flight,index:Int,startX:Double?=nil,startY:Double?=nil,initial:Double=0,tangentX:Double?=nil,tangentY:Double?=nil) {
        let center=lane(p.unit),sweep=index%4==0
        let x=startX ?? (56+sample()*278),y=startY ?? clamp(center+centered()*46,48,1428)
        let length=hypot(tangentX ?? 0,tangentY ?? 0),tx=length>0.001 ? (tangentX ?? 0)/length : 0,ty=length>0.001 ? (tangentY ?? 0)/length : 0
        let continuous=tangentX != nil
        p.set(0,x,y)
        for point in 1..<7 {
            if continuous && point==1 {p.set(point,x+tx*36*0.82,y+ty*36*0.82);continue}
            if continuous && point==6 {p.set(point,x-tx*36*0.82,y-ty*36*0.82);continue}
            let pull=Double(point%2==1 ? 52 : -52)*0.82
            let px=clamp(x+pull+centered()*92*0.82,20,370)
            let vertical=sweep ? sin(Double(point)/7*Double.pi*2)*48 : centered()*48
            let texture=sweep ? centered()*12 : 0
            p.set(point,px,clamp(y+(vertical+texture)*0.82,max(42,center-72),min(1428,center+72)))
        }
        p.set(7,x,y);p.phase="roam";p.duration=11;p.elapsed=clamp(initial,0,0.94)*11
        if !continuous {p.bounce=sample()*Double.pi*2}
        p.width=36+sample()*8
    }
    private func resetExit(_ p:inout Flight) {
        let x=p.read(7,0),y=p.read(7,1),direction=Double(p.side == -1 ? -1 : 1)
        let near=p.side == -1 ? left : right,far=p.side == -1 ? right : left
        let pine=p.side == -1 ? leftPine : rightPine,opposite=p.side == -1 ? rightPine : leftPine
        let passage=top+2+p.passage*max(1,bottom-top-7),exitY=clamp(50+sample()*30,50,80),half=p.width*p.scale/2
        let points=[(x,y),(opposite-half,y+(passage-y)*0.55-half),(far-direction*34-half,passage+1-half),(far-half,passage-half),(near-half,passage-half),(near+direction*28-half,passage-1-half),(pine-half,passage+(exitY-passage)*0.45-half),(Double(p.side == -1 ? 20 : 370)-half,exitY-half)]
        for (i,point) in points.enumerated() {p.set(i,point.0,point.1)}
        p.phase="exit";p.duration=7.8*(0.84+sample()*0.32);p.elapsed=0
    }
    private func resetEntry(_ p:inout Flight,startX:Double,startY:Double) {
        let direction=Double(p.side == -1 ? 1 : -1),passage=top+2+p.passage*max(1,bottom-top-7)
        let entryY=clamp(passage-40+sample()*90,20,135)
        let near=p.side == -1 ? left : right,far=p.side == -1 ? right : left
        let pine=p.side == -1 ? leftPine : rightPine,opposite=p.side == -1 ? rightPine : leftPine
        let endX=clamp(Double(p.unit%2==0 ? 112 : 278)+centered()*52,34,356),endY=clamp(lane(p.unit)+centered()*44,92,1428),half=p.width*p.scale/2
        let points=[(startX,startY),(pine-half,entryY+(passage-entryY)*0.35-half),(near-direction*28-half,passage-1-half),(near-half,passage-half),(far-half,passage-half),(far+direction*34-half,passage+1-half),(opposite-half,passage+(endY-passage)*0.45-half),(endX-half,endY-half)]
        for (i,point) in points.enumerated() {p.set(i,point.0,point.1)}
        p.phase="entry";p.duration=max(7.8*(0.9+sample()*0.2),4.5+abs(endY-passage)/105);p.elapsed=0;p.onScreen=0
    }
    private func pose(_ p:Flight,progress:Double)->[Double] {
        let bounded=clamp(progress,0,0.999999),position=bounded*7,segment=min(6,Int(floor(position))),t=position-Double(segment),t2=t*t,t3=t2*t
        var out=[Float](repeating:0,count:4)
        for axis in 0..<2 {
            let a=p.read(segment-1,axis,cyclic:p.phase=="roam"),b=p.read(segment,axis,cyclic:p.phase=="roam"),c=p.read(segment+1,axis,cyclic:p.phase=="roam"),d=p.read(segment+2,axis,cyclic:p.phase=="roam")
            out[axis]=Float(0.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t2+(-a+3*b-3*c+d)*t3))
            out[axis+2]=Float(0.5*((-a+c)+2*(2*a-5*b+4*c-d)*t+3*(-a+3*b-3*c+d)*t2)*7)
        }
        let angle=bounded*Double.pi*2*6+p.bounce,center=p.phase=="exit" ? 0.36 : p.phase=="entry" ? 0.5 : -1,distance=abs(bounded-center)
        let strength=p.gate && distance<0.16 ? clamp((distance-0.06)/0.1,0,1) : 1
        out[0]=Float(Double(out[0])+cos(angle*0.7)*6*strength);out[1]=Float(Double(out[1])+sin(angle)*14*strength)
        return out.map(Double.init)
    }
    private func asset(vx:Double,vy:Double,fallback:String)->String {
        let magnitude=hypot(vx,vy);if !magnitude.isFinite || magnitude<0.01 {return fallback}
        if abs(vx)<magnitude*0.12 {return vy<0 ? "bee5" : "bee7"}
        let steep=abs(vx)*0.42
        if vx>0 {return vy < -steep ? "bee2" : vy>steep ? "bee6" : "bee1"}
        if vy < -steep {return abs(vy)>abs(vx)*1.35 ? "bee5" : "bee4"}
        return vy>steep ? "bee7" : "bee3"
    }
    public func next(duration:Double=11,ids:[Int]?=nil)->[[String:Any]] {
        guard duration>0,duration<=60 else {return []}
        let count=Int((duration*30).rounded()),dt=duration/Double(count)
        return bees.indices.filter {ids==nil || ids!.contains(bees[$0].flight.unit)}.map { index in
            var bee=bees[index],frames:[[String:Any]]=[]
            for frame in 0...count {
                if frame>0 {
                    bee.flight.elapsed+=dt;if bee.flight.phase=="roam" {bee.flight.onScreen+=dt}
                    if bee.flight.elapsed>=bee.flight.duration {
                        let x=bee.flight.read(7,0),y=bee.flight.read(7,1)
                        if bee.flight.phase=="roam" {
                            if bee.flight.onScreen>=30 {resetExit(&bee.flight)} else {bee.flight.elapsed=max(0,bee.flight.elapsed-bee.flight.duration)}
                        } else if bee.flight.phase=="exit" {resetEntry(&bee.flight,startX:x,startY:y)}
                        else {
                            let priorX=bee.flight.read(6,0),priorY=bee.flight.read(6,1)
                            bee.flight.onScreen=0;bee.behind=false
                            resetRoam(&bee.flight,index:index,startX:x,startY:y,tangentX:x-priorX,tangentY:y-priorY)
                        }
                    }
                }
                let p=bee.flight.elapsed/bee.flight.duration,point=pose(bee.flight,progress:p),candidate=asset(vx:point[2],vy:point[3],fallback:bee.asset)
                if candidate==bee.asset {bee.pending=nil;bee.pendingSeconds=0}
                else if candidate != bee.pending {bee.pending=candidate;bee.pendingSeconds=0}
                else {
                    bee.pendingSeconds+=frame>0 ? dt : 0
                    if bee.pendingSeconds>=0.05 {bee.previous=bee.asset;bee.asset=candidate;bee.blend=0;bee.pending=nil;bee.pendingSeconds=0}
                }
                bee.blend=min(0.08,bee.blend+(frame>0 ? dt : 0))
                let wave=sin(p*Double.pi*2*6+bee.flight.bounce),entry=bee.flight.phase=="entry" ? 0.5+0.5*clamp(p/0.5,0,1) : 1
                let area=0.5+0.5*clamp((point[1]-mainBottom)/40,0,1),size=min(entry,area),center=point[0]+bee.flight.width*bee.flight.scale/2
                if bee.flight.phase=="entry" && (bee.flight.side == -1 ? center>=left : center<=right) {bee.behind=false}
                if bee.flight.phase=="exit" && p>=0.3 && (bee.flight.side == -1 ? center<=right : center>=left) {bee.behind=true}
                var output:[String:Any]=["time":Double(frame)*dt,"x":point[0],"y":contentTop+point[1],"width":bee.flight.width,"scaleX":bee.flight.scale*size*(1+wave*0.045*1.125),"scaleY":bee.flight.scale*size*(1-wave*0.035*1.125),"rotation":sin(p*Double.pi*2*7+bee.flight.bounce)*7,"asset":"./assets/shop/honey/\(bee.asset).png","blend":clamp(bee.blend/0.08,0,1),"depth":bee.behind ? "behind" : "front"]
                if let previous=bee.previous {output["previousAsset"]="./assets/shop/honey/\(previous).png"}
                frames.append(output)
            }
            bees[index]=bee;return ["id":bee.flight.unit,"duration":duration,"frames":frames]
        }
    }
}
