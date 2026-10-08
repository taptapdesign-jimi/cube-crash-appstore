import Foundation

/// HUD smoke is its own original vector recipe. It is not common-smoke, has no
/// pool or activity label, and its wall emission is independent of GSAP pause.
@MainActor final class NativeWildMeterSmokeOwner {
    private final class Bubble {
        let id:UInt64
        var cancel:(()->Void)?
        var retired=false
        init(_ id:UInt64){self.id=id}
    }
    private let driver:any NativeWildMeterHUDDriving
    private let wall:any NativeWildMeterSmokeWallDriving
    private let resources:any NativeWildMeterSmokeResources
    private let geometry:()->NativeWildMeterSmokeGeometry
    private let disabled:()->Bool,current:()->Bool,random:()->Double
    private var bubbles:[UInt64:Bubble]=[:]
    private var wallCancel:(()->Void)?
    private var emissionEpoch:UInt64=0,sequence:UInt64=0
    private var closed=false,emitting=false
    var activeBubbleCount:Int{bubbles.count}
    var isEmitting:Bool{emitting}
    init(driver:any NativeWildMeterHUDDriving,wall:any NativeWildMeterSmokeWallDriving,
         resources:any NativeWildMeterSmokeResources,geometry:@escaping()->NativeWildMeterSmokeGeometry,
         disabled:@escaping()->Bool,current:@escaping()->Bool,random:@escaping()->Double){
        self.driver=driver;self.wall=wall;self.resources=resources;self.geometry=geometry
        self.disabled=disabled;self.current=current;self.random=random
    }
    private func valid()->Bool {
        guard !closed else{return false}
        let result=current()
        if !result,!closed{dispose()}
        return result && !closed
    }
    func startEmission(){
        guard valid(),!emitting,!disabled() else{return}
        guard valid() else{return}
        emitting=true;emissionEpoch &+= 1;let epoch=emissionEpoch
        let lease=wall.start{[weak self] in
            guard let self,self.valid(),self.emitting,self.emissionEpoch==epoch else{return}
            if self.disabled(){self.stopSmoke();return}
            self.emit()
        }
        if !closed,emitting,emissionEpoch==epoch{wallCancel=lease;if lease==nil{emitting=false}}
        else{lease?()}
    }
    func stopEmission(){
        emissionEpoch &+= 1;emitting=false
        let captured=wallCancel;wallCancel=nil;captured?()
    }
    func stopSmoke(){
        stopEmission()
        // Remove captured old owners BEFORE any external cleanup. Reentrant C
        // is owned by its new identity and cannot be destroyed by old A.
        let captured=bubbles.values.sorted{$0.id<$1.id};bubbles.removeAll()
        for bubble in captured{retire(bubble)}
    }
    private func retire(_ bubble:Bubble){
        guard !bubble.retired else{return};bubble.retired=true
        let cancel=bubble.cancel;bubble.cancel=nil;cancel?()
        resources.destroy(id:bubble.id)
    }
    private func finish(_ bubble:Bubble){
        guard bubbles[bubble.id] === bubble else{return}
        bubbles.removeValue(forKey:bubble.id);retire(bubble)
    }
    private func emit(){
        guard valid(),!disabled() else{return}
        guard valid() else{return}
        let g=geometry()
        guard valid(),g.fillAlive,g.parentAttached else{return}
        let left=max(0,g.left),width=max(0,g.width)
        guard width>0 else{return} // original zero-width callback draws no RNG
        let x=g.x+left+random()*max(1,width)
        let y=g.y+5+(random()-0.5)*5
        let radius=2.5+pow(random(),1.7)*3
        guard valid() else{return}
        sequence &+= 1;let bubble=Bubble(sequence)
        bubbles[bubble.id]=bubble
        resources.create(id:bubble.id,x:x,y:y,radius:radius)
        guard valid(),bubbles[bubble.id] === bubble,!bubble.retired else{finish(bubble);return}
        // Literal source evaluates these three vars AFTER adding the Graphics.
        let plan=NativeWildMeterSmokePlan(x:x,y:y,radius:radius,random:random)
        guard valid(),bubbles[bubble.id] === bubble else{finish(bubble);return}
        let lease=driver.start(duration:plan.duration,family:.defaultLazyTween,paint:{[weak self,weak bubble] seconds in
            guard let self,let bubble,self.valid(),self.bubbles[bubble.id] === bubble else{return}
            self.resources.paint(id:bubble.id,plan.sample(seconds:seconds))
        },completed:{[weak self,weak bubble] in
            guard let self,let bubble else{return};self.finish(bubble)
        },interrupted:{[weak self,weak bubble] in
            guard let self,let bubble else{return};self.finish(bubble)
        })
        if valid(),bubbles[bubble.id] === bubble,!bubble.retired{
            bubble.cancel=lease
            if lease==nil{finish(bubble)}
        }else{lease?()}
    }
    func dispose(){
        guard !closed else{return};closed=true;stopSmoke()
    }
    isolated deinit {
        let wall=wallCancel;wallCancel=nil;wall?()
        for bubble in bubbles.values.sorted(by:{$0.id<$1.id}){
            let cancel=bubble.cancel;bubble.cancel=nil;cancel?()
            if !bubble.retired{bubble.retired=true;resources.destroy(id:bubble.id)}
        }
    }
}
