import Foundation

/// Each property has its source owner until the captured exit replaces it.
final class NativeTransitionScenePlan {
    typealias Pose=NativeTransitionInterpolation.Pose
    typealias Track=NativeTransitionInterpolation.Track
    typealias Frame=NativeTransitionInterpolation.Frame
    private struct Runtime {let layer:NativeTransitionSceneGeometry.Layer,index:Int,start:Double,track:Track;let boing:Double,pause:Double;let groundAmbient:Track?}
    let theme:NativeBoardTransitionPlan.Theme,exitAt:Double,exitDuration:Double,cloudExitAt:Double
    private let variation:NativeTransitionSceneGeometry.Variation,width:Double,sceneHeight:Double
    private let runtimes:[String:Runtime],exits:[String:(start:Double,order:Int)]
    init(theme:NativeBoardTransitionPlan.Theme,layers:[NativeTransitionSceneGeometry.Layer],viewportWidth:Double,viewportHeight:Double,variation:NativeTransitionSceneGeometry.Variation,random:()->Double) throws {
        self.theme=theme;self.variation=variation;width=viewportWidth;sceneHeight=min(viewportHeight*0.44,380)+120
        let order=NativeTransitionThemeLayers.enterOrder(theme),map=Dictionary(uniqueKeysWithValues:layers.map{($0.definition.key,$0)})
        var runs:[String:Runtime]=[:]
        for (index,key) in order.enumerated() {
            guard let layer=map[key],!key.hasPrefix("robo-fighter"),!key.hasPrefix("robo-beam") else{continue}
            let hill=["mountain","hill1","hill2"].contains(key),front=key=="robo-front",walker=key=="robo-walker",groundFront=key=="robo-ground-front"
            let regularStart=theme == .forest ? 0.01+Double(index)*0.03:0.05+Double(index)*0.042525
            let ground=key=="robo-ground-front" || key=="robo-ground-rear"
            let start=theme == .area55 ? front ? 0.32:!ground ? 0.62+Double(max(0,index-2))*0.042525:regularStart:regularStart
            let parallax=key=="mountain" ? 50.0:key=="hill1" ? -67:84
            let baseX=key=="mountain" ? -72.0:key=="hill1" ? -32:-20,scale=key=="mountain" ? 1.45:key=="hill1" ? 1.6:1.53
            let sign=front ? variation.frontDirection == -1 ? -1.0:1:walker && variation.walkerDirection==1 ? -1:1
            let sx=hill ? scale*0.68:key=="beach-shore-2" ? 0.7:front ? sign:0
            let initial=Pose(x:hill ? baseX-parallax*0.18:front ? -Double(variation.frontDirection)*max(360,viewportWidth):0,
                y:hill ? (min(viewportHeight,760)*0.4).rounded():key=="beach-shore-2" || front ? 0:groundFront ? 4.2:14,
                sx:sx,sy:abs(sx),opacity:key=="beach-shore-2" || front ? 1:0,rotation:hill || front ? 0:Double(index%2==0 ? -8:8))
            var frames:[Frame]=[]
            if hill {
                var target=initial;target.opacity=1;target.y=0;target.sx=scale;target.sy=scale
                frames.append(Frame(duration:0.6804,to:target,ease:.sineOut))
                if key=="mountain" {target.y = -7;frames.append(Frame(duration:0.14,to:target,ease:.sineOut));target.y=0;frames.append(Frame(duration:0.22,to:target,ease:.backOut(1.35)))}
            } else if front {
                let end=Double(variation.frontDirection)*max(640,viewportWidth*1.65),startX=initial.x
                let xs=[startX*0.28,end*0.10,end*0.32,end*0.56,end*0.80,end],ys=[-7.0,7,-9,9,-6,6],rots=[3.0,-3,3,-3,2,-2],scales=[1.01,0.99,1.01,0.99,1.01,1],durations=[0.34,0.42,0.44,0.46,0.46,0.48]
                for i in xs.indices {frames.append(Frame(duration:durations[i]/0.70,to:Pose(x:xs[i],y:ys[i],sx:scales[i]*sign,sy:scales[i],rotation:rots[i]),ease:.linear))}
            } else {
                let restX=key=="robo-ground-rear" ? 100.0:groundFront ? -100:0,restRotation=key=="robo-fence" ? 6.0:0
                let fenceSign=key=="robo-fence-static-right" ? -1.0:1
                let renderSign=walker ? sign:fenceSign
                let over=groundFront ? 1.012:1.04,rebound=groundFront ? 0.985:0.95
                var target=Pose(x:restX,y:0,sx:over*renderSign,sy:over,rotation:restRotation)
                frames.append(Frame(duration:0.2835,to:target,ease:.backOut(groundFront ? 0.6:2)))
                target.sx=rebound*renderSign;target.sy=rebound;frames.append(Frame(duration:0.0945,to:target,ease:.powerOut(2)))
                target.sx=renderSign;target.sy=1;frames.append(Frame(duration:0.1134,to:target,ease:.backOut(groundFront ? 0.45:1.5)))
                if walker {
                    let end=Double(variation.walkerDirection)*max(viewportWidth+layer.width*1.5,viewportWidth*1.65)
                    let xs=[0.18,0.36,0.53,0.70,0.86,1.0],ys=[7.0,-7,9,-9,6,0],rots=[-3.0,3,-3,3,-2,0],scales=[1.01,0.99,1.01,0.99,1.01,1.0],durations=[0.34,0.42,0.44,0.46,0.46,0.48]
                    for i in xs.indices {frames.append(Frame(duration:durations[i]/0.60,to:Pose(x:end*xs[i],y:ys[i],sx:scales[i]*sign,sy:scales[i],rotation:rots[i]),ease:.linear))}
                }
            }
            let boing=layer.definition.motion=="sea" ? 0.2+random()*0.35:0,pause=layer.definition.motion=="sea" ? 0.18+random()*0.35:0
            let groundAmbient:Track?
            if ground {let rest=groundFront ? -100.0:100,sign=groundFront ? -1.0:1
                groundAmbient=Track(initial:Pose(x:rest),frames:[Frame(duration:4.2,to:Pose(x:rest+sign*40),ease:.sineInOut),Frame(duration:8.4,to:Pose(x:rest-sign*40),ease:.sineInOut),Frame(duration:4.2,to:Pose(x:rest),ease:.sineInOut)])
            }else{groundAmbient=nil}
            runs[key]=Runtime(layer:layer,index:index,start:start,track:Track(initial:initial,frames:frames),boing:boing,pause:pause,groundAmbient:groundAmbient)
        }
        runtimes=runs
        exitAt=theme == .area55 ? 2.35+NativeBoardTransitionPlan.airCombatHold(minimum:0,duration:3.001,elapsed:2.35):1.75
        cloudExitAt=exitAt+0.9
        var exitRows:[String:(start:Double,order:Int)]=[:],maxEnd=0.0
        if theme == .forest {
            // Source arrays are three/two elements with random comparator order.
            // Original authoring oracle uses the JS engine's stable small-array
            // run detection and binary insertion. The comparator intentionally
            // consumes one random draw per comparison.
            let rear=Self.authoredSort(["pine1","pine3","pine5"],random:random)
            let fences=Self.authoredSort(["fence-left","fence-right"],random:random),front=["pine4","pine2"]
            for (i,key) in fences.enumerated(){exitRows[key]=(Double(i)*0.06,i)}
            for (i,key) in rear.enumerated(){exitRows[key]=(0.2+Double(i)*0.05,2+i)}
            for (i,key) in front.enumerated(){exitRows[key]=(0.7+Double(i)*0.05,5+i)}
            for (i,key) in ["mountain","hill1","hill2"].enumerated(){let start=0.9+Double(i)*0.2;exitRows[key]=(start,7+i);maxEnd=max(maxEnd,start+(key=="mountain" ? 0.78:0.71))}
        } else {
            let keys=theme == .beach ? layers.map{$0.definition.key}:["robo-front","robo-walker","robo-fence","robo-fence-static-left","robo-fence-static-right","robo-ground-rear","robo-ground-front"]
            let rows=try NativeBoardTransitionPlan.exitSchedule(keys:keys,base:0.7,stagger:0.05,duration:0.28,dependencies:theme == .beach ? ["beach-sea-3":"beach-ball","beach-shore-2":"beach-castle"]:[:],offsets:theme == .beach ? ["beach-bottle":-0.2,"beach-ball":0.1]:[:])
            for row in rows {exitRows[row.key]=(row.start,row.orderIndex);maxEnd=max(maxEnd,row.end)}
        }
        exits=exitRows
        exitDuration=max(1.45,theme == .forest ? 1.85:1.25,maxEnd+0.02,0.9+0.595+0.02)+0.001
    }
    static func authoredSort(_ keys:[String],random:()->Double)->[String] {
        guard keys.count>1 else{return keys};var values=keys
        let descending=random()-0.5<0
        var run=2
        while run<values.count {let comparison=random()-0.5;if descending ? comparison>=0:comparison<0 {break};run += 1}
        if descending {values.replaceSubrange(0..<run,with:values[0..<run].reversed())}
        for position in run..<values.count {let pivot=values[position];var low=0,high=position
            while low<high {let mid=(low+high)/2;if random()-0.5<0 {high=mid}else{low=mid+1}}
            if low<position {for index in stride(from:position,through:low+1,by:-1){values[index]=values[index-1]};values[low]=pivot}
        };return values
    }
    func pose(key:String,seconds:Double)->Pose? {
        guard let r=runtimes[key] else{return nil}
        guard let entry=exits[key] else{return entering(r,seconds:seconds)}
        if seconds<exitAt+entry.start {
            if theme == .forest,seconds>=exitAt,!["mountain","hill1","hill2"].contains(key) {return forestParallax(key:key,seconds:seconds-exitAt,initial:entering(r,seconds:exitAt))}
            return entering(r,seconds:seconds)
        }
        let exitStart=exitAt+entry.start,age=seconds-exitStart
        let hill=["mountain","hill1","hill2"].contains(key),duration=hill ? key=="mountain" ? 0.78:0.71:0.28
        var from=entering(r,seconds:exitStart),to=from
        if hill {
            to.opacity=0;to.y += key=="hill2" ? 220:210;let s=key=="mountain" ? 0.94:0.96;to.sx *= s;to.sy *= s;to.rotation=0
            let p=NativeTransitionInterpolation.Ease.backIn(key=="mountain" ? 1.18:1.05).value(age/duration)
            var pose=from.mixing(to,p);pose.x=entering(r,seconds:seconds).x;return pose
        }
        if theme == .forest {from=forestParallax(key:key,seconds:entry.start,initial:entering(r,seconds:exitAt));to=from;to.opacity=0}
        let isFloat=r.layer.definition.motion=="float"
        to.sx=0;to.sy=0;if !isFloat && key != "robo-front" {to.x=0}
        to.y=key=="pine2" || key=="pine4" ? 112:key=="robo-front" ? from.y+max(220,sceneHeight*0.35):24
        to.rotation=key=="beach-ball" ? from.rotation+(entry.order%2==0 ? 12.6:-12.6):key=="robo-front" ? 0:entry.order%2==0 ? 12:-12
        let p=theme == .forest ? NativeTransitionInterpolation.Ease.powerIn(2).value(age/duration):NativeTransitionInterpolation.Ease.backIn(1.35).value(age/duration)
        var result=from.mixing(to,p);if age>=duration-1e-9{result.opacity=0};return result
    }
    private func entering(_ r:Runtime,seconds:Double)->Pose {
        let key=r.layer.definition.key,age=seconds-r.start
        var pose=r.track.sample(age)
        if ["mountain","hill1","hill2"].contains(key) {
            let px=key=="mountain" ? 50.0:key=="hill1" ? -67:84,base=key=="mountain" ? -72.0:key=="hill1" ? -32:-20,duration=key=="mountain" ? 5.8:key=="hill1" ? 5.5:5.2
            pose.x=base-px*0.18+px*1.18*NativeTransitionInterpolation.clamp(age/duration);return pose
        }
        if key=="robo-front",age>=r.track.duration {pose.opacity=0;return pose}
        guard age>=r.track.duration else{return pose}
        let ambientAge=age-r.track.duration
        if r.layer.definition.motion=="float" {
            let bottle=key=="beach-bottle",right=variation.beachSwapped ? !bottle:bottle,direction=right ? -1.0:1
            // GSAP's original numeric progress owner rounds its 0...1 clock
            // to six decimals before the authored callback multiplies by 12.
            let progress=ambientAge.truncatingRemainder(dividingBy:12)/12
            let t=(progress*1_000_000).rounded()/1_000_000*12
            pose.x=direction*width*0.88*0.75*(0.5-cos(Double.pi*NativeTransitionInterpolation.clamp(t/1.5))*0.5)
            pose.y = -(bottle ? 18:30)*(0.5-cos(t*2*Double.pi)*0.5)
            pose.rotation=sin(t*2*Double.pi/1.5)*(bottle ? 50.4:82.32)
        } else if r.layer.definition.motion=="sea" {
            let i=key=="beach-sea-1" ? 1:key=="beach-sea-2" ? 2:3,duration=(1.55+Double(i)*0.12)/0.88
            let cycle=ambientAge.truncatingRemainder(dividingBy:duration*2),p=cycle<=duration ? cycle/duration:2-cycle/duration
            pose.x=(i==2 ? -47.5:i==1 ? 66.64:42)*(1-cos(p*Double.pi))/2
            let down=max(0.16,r.boing*0.78),boingCycle=r.boing+down+r.pause,b=ambientAge.truncatingRemainder(dividingBy:boingCycle),y=i==2 ? 5.0:-5
            pose.y=b<r.boing ? y*sin(b/r.boing*Double.pi/2):b<r.boing+down ? y*cos((b-r.boing)/down*Double.pi/2):0
        } else if r.layer.definition.motion=="shore" {
            // The first shore exit kills the one shared shore owner. Castle
            // and foreground shore retain that same captured pose until their
            // own dependency-delayed exits take over.
            let captured=min(seconds,exitAt+(exits["beach-shore-1"]?.start ?? 0.95))
            let index=key=="beach-shore-1" ? 0:key=="beach-castle" ? 1:2,t=max(0,captured-0.64645-Double(index)*0.08)
            // The parent yoyo duration includes the .16 stagger tail: 6.56.
            let position=t.truncatingRemainder(dividingBy:13.12),p=position<=6.56 ? min(1,position/6.4):min(1,(13.12-position)/6.4)
            let e=(1-cos(p*Double.pi))/2
            pose.x=(key=="beach-shore-1" ? -7:key=="beach-shore-2" ? 7:4)*e;pose.y=(key=="beach-castle" ? -2:2)*e
            pose.rotation=(key=="beach-shore-1" ? -0.3:0.3)*e;pose.sx=1+(key=="beach-castle" ? 0.24:0.15)*e;pose.sy=pose.sx
        } else if key=="robo-ground-front" || key=="robo-ground-rear" {
            let t=ambientAge.truncatingRemainder(dividingBy:16.8)
            pose.x=r.groundAmbient!.sample(t).x
        }
        return pose
    }
    private func forestParallax(key:String,seconds:Double,initial:Pose)->Pose {
        let fence=key.hasPrefix("fence"),aggressive=key=="pine2" || key=="pine4",left=key=="pine1" || key=="pine2"
        let duration=key=="pine1" ? 1.55:key=="pine2" || key=="pine4" ? 1.05:key=="pine3" ? 1.68:key=="pine5" ? 1.42:0.9
        var target=initial;target.sx=fence ? 0.93:0.945;target.sy=target.sx
        target.x=left ? -59:key=="pine3" ? 78:key.hasPrefix("pine") ? 59:key=="fence-left" ? -140:140
        target.y=aggressive ? 55:key=="pine3" ? 34:key.hasPrefix("pine") ? 18:58
        return initial.mixing(target,NativeTransitionInterpolation.Ease.sineInOut.value(seconds/duration))
    }
}
