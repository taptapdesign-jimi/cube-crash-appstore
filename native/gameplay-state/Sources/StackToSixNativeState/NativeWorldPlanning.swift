import Foundation

/// Retained pure Swift port of canonical Beach/Area55 compositor projections.
/// Only finite 11-second plans are made on admission/renewal; no timers or display links.
public final class NativeWorldPlanning {
    public struct Emitter { public let board:Int,x:Double,y:Double; public init(board:Int,x:Double,y:Double) {self.board=board;self.x=x;self.y=y} }
    private struct Bubble {
        var depth="behind",duration=1.0,delay=0.0,elapsed=0.0,startX=0.0,startY=0.0,endX=0.0,size=1.0,opacity=0.0,wave=0.0,cycles=1.0,phase=0.0
        var asset=0
    }
    private struct Ship {
        var lower=false,planned=false,direction=1
        var elapsed=0.0,delay=0.0,duration=5.0,startX=0.0,startY=0.0,endX=0.0,endY=0.0,c1x=0.0,c1y=0.0,c2x=0.0,c2y=0.0,baseSize=50.0
        var scale=0.5,scaleFrom=0.5,scaleTarget=0.5,hold=3.0,transition=0.45,phase=0.0,wobble=0.0,x=0.0,y=0.0,rotation=0.0
    }
    private let world:Int,emitters:[Emitter],sceneHeight:Double,random:()->Double
    private var bubbles:[Bubble]=[],ships:[Ship]=[]
    public init(world:Int,emitters:[Emitter]=[],sceneHeight:Double=844,random:@escaping ()->Double = {Double.random(in:0..<1)}) {
        self.world=world;self.emitters=emitters;self.sceneHeight=sceneHeight;self.random=random
        if world==2 && !emitters.isEmpty {
            for index in 0..<8 {var bubble=Bubble();resetBubble(&bubble,index:index,initial:true);bubbles.append(bubble)}
        } else if world==3 {
            for index in 0..<2 {var ship=Ship();ship.lower=index%2 != 0;ship.direction=index%2==0 ? 1 : -1;ship.delay=Double(index)*0.42;ship.scale=sample();ship.hold=3+sample()*1.5;ship.phase=sample()*Double.pi*2;ships.append(ship)}
        }
    }
    private func sample()->Double {let value=random();return value.isFinite ? min(1,max(0,value)) : 0.5}
    private func resetBubble(_ b:inout Bubble,index:Int,initial:Bool) {
        let guaranteed=initial && index<emitters.count
        b.depth=guaranteed || sample()<2.0/3 ? "behind" : "front"
        let emitter=emitters[index%emitters.count]
        b.size=(10+sample()*22)*[2.0,2.5,3,3.5,4][index%5]
        b.startX=emitter.x-b.size*0.5;b.startY=emitter.y-b.size*0.5
        b.endX=min(390-b.size,max(0,b.startX-72+sample()*154))
        b.wave=16+sample()*38;b.cycles=1.6+sample()*2;b.phase=sample()*Double.pi*2
        b.opacity=[0.2,0.3,0.4,0.5,0.6][index%5]
        b.duration=(1.45+sample()*0.45)*1.84*max(0.5,sceneHeight/844)
        b.delay=initial ? (index<emitters.count ? 0 : Double(index-emitters.count+1)/Double(18-emitters.count+1)*b.duration) : 0.45+sample()*1.8
        b.elapsed=0;b.asset=Int(floor(sample()*6))%6
    }
    private func resetShip(_ s:inout Ship,index:Int,top:Double,bottom:Double) {
        s.direction=sample()<0.5 ? -1 : 1
        s.startX=s.direction==1 ? -54 : 444;s.endX=s.direction==1 ? 444 : -54
        let height=max(1,bottom-top),laneTop=top+height*(s.lower ? 0.62 : 0.12),laneSpan=height*0.22
        s.startY=laneTop+sample()*laneSpan;s.endY=laneTop+sample()*laneSpan
        s.c1x=390*(s.direction==1 ? 0.22 : 0.78);s.c2x=390*(s.direction==1 ? 0.78 : 0.22)
        s.c1y=laneTop+sample()*laneSpan;s.c2y=laneTop+sample()*laneSpan
        s.duration=4.2+sample()*2.8;s.baseSize=55+sample()*14.5;s.wobble=12+sample()*24;s.scale=sample()
        s.scaleFrom=s.scale;s.scaleTarget=s.scale;s.hold=3+sample()*1.5;s.transition=0.45
        s.phase=sample()*Double.pi*2;s.elapsed = -(Double(index)*0.38+sample()*0.35)
        s.x=s.startX;s.y=s.startY;s.rotation=0;s.planned=true
    }
    private func cubic(_ a:Double,_ b:Double,_ c:Double,_ d:Double,_ p:Double)->Double {let inverse=1-p;return pow(inverse,3)*a+3*inverse*inverse*p*b+3*inverse*p*p*c+p*p*p*d}
    private func shipSize(_ s:Ship)->Double {min(75,max(50,s.baseSize*(0.82+min(1,max(0,s.scale))*0.36)))}
    private func sampleShip(_ s:inout Ship,progress:Double,delta:Double)->Double {
        let p=min(1,max(0,progress)),eased=p*p*(3-2*p)
        let x=cubic(s.startX,s.c1x,s.c2x,s.endX,eased)+cos(p*Double.pi*3+s.phase)*s.wobble*0.35
        let y=cubic(s.startY,s.c1y,s.c2y,s.endY,eased)+sin(p*Double.pi*4+s.phase)*s.wobble
        let vx=x-s.x,vy=y-s.y;s.x=x;s.y=y
        var remaining=max(0,delta)
        if s.hold>0 {
            let held=min(s.hold,remaining);s.hold-=held;remaining-=held
            if s.hold<=0 {s.scaleFrom=s.scale;s.scaleTarget=sample();s.transition=0}
        }
        if s.hold<=0 {
            s.transition=min(0.45,s.transition+remaining)
            let ratio=s.transition/0.45,curve=ratio*ratio*(3-2*ratio)
            s.scale=s.scaleFrom+(s.scaleTarget-s.scaleFrom)*curve
            if ratio>=1 {s.scale=s.scaleTarget;s.hold=3+sample()*1.5}
        }
        let limit=20*Double.pi/180
        let target=min(limit,max(-limit,atan2(vy,max(0.0001,abs(vx)))*0.58+sin(p*Double.pi*8+s.phase)*0.12))
        let elapsed=min(0.12,max(0,delta)),requested=(target-s.rotation)*(1-exp(-8*elapsed)),maxDelta=Double.pi/2*elapsed
        s.rotation=min(limit,max(-limit,s.rotation+min(maxDelta,max(-maxDelta,requested))))
        return shipSize(s)
    }
    public func next(top:Double,bottom:Double,ids:[Int]?=nil)->[[String:Any]] {
        if world==2 {
            return bubbles.indices.filter {ids==nil || ids!.contains($0)}.map { index in
                var b=bubbles[index],frames:[[String:Any]]=[]
                for frame in 0...330 {
                    if frame>0 {b.elapsed+=1.0/30}
                    var p=(b.elapsed-b.delay)/b.duration
                    if p>=1 {resetBubble(&b,index:index,initial:false);p=0}
                    p=max(0,p);let eased=sin(p*Double.pi*0.5)
                    let x=b.startX+(b.endX-b.startX)*eased+(sin(p*Double.pi*2*b.cycles+b.phase)-sin(b.phase))*b.wave
                    let y=b.startY+(-b.size*1.35-b.startY)*eased
                    // Typed producer values matter before JSON encoding: the native
                    // compositor admits Double, and an Any-context zero ternary
                    // otherwise emits Swift Int for hidden frames.
                    let opacity:Double=b.elapsed<b.delay ? 0 : b.opacity*min(1,max(0,(1-p)*8))
                    frames.append(["time":Double(frame)/30,"x":x,"y":y,"width":b.size,"height":b.size,"rotation":0.0,"opacity":opacity,"asset":"./assets/shop/bottle/bottle animation pack/bubble\(b.asset+1).png","depth":b.depth])
                }
                bubbles[index]=b;return ["id":index,"worldID":2,"duration":11.0,"frames":frames]
            }
        }
        if world==3 {
            return ships.indices.filter {ids==nil || ids!.contains($0)}.map { index in
                var s=ships[index],size=shipSize(ships[index]),frames:[[String:Any]]=[]
                func advance(_ dt:Double)->Bool {
                    if !s.planned || s.y<top-75 || s.y>bottom+75 {resetShip(&s,index:index,top:top,bottom:bottom)}
                    s.elapsed+=dt;if s.elapsed<s.delay {return false}
                    let p=(s.elapsed-s.delay)/s.duration
                    if p>=1 {resetShip(&s,index:index,top:top,bottom:bottom);return false}
                    size=sampleShip(&s,progress:p,delta:dt);return true
                }
                for frame in 0...330 {
                    if frame>0 {_=advance(1.0/60)}
                    let visible=advance(frame>0 ? 1.0/60 : 0)
                    frames.append(["time":Double(frame)/30,"x":s.x-size/2,"y":s.y-size*(188.0/194)/2,"width":size,"height":size*188/194,"rotation":s.rotation*180/Double.pi,"opacity":visible ? 1.0 : 0.0,"asset":"./assets/journey assets/robo/ship1@2x.png","depth":"front"])
                }
                ships[index]=s;return ["id":index,"worldID":3,"duration":11.0,"frames":frames]
            }
        }
        return []
    }
}
