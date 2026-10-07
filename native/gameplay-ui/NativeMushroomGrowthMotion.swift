import UIKit

/// Actual shared GSAP timeline position semantics, including the .34 rise
/// that extends the first .21 scale track before the second track can begin.
enum NativeMushroomGrowthMotion {
    struct Slot {let x,y,bias,rotation,depth:Double}
    static let timeScale:Double=1.86/2.86
    static let slots:[Slot]=[
        Slot(x:-0.08,y:1.085,bias:1.00,rotation:-1,depth:94),
        Slot(x:0.08,y:1.075,bias:0.98,rotation:1,depth:97),
        Slot(x:0.24,y:1.085,bias:1.00,rotation:-1,depth:99),
        Slot(x:0.40,y:1.075,bias:0.97,rotation:1,depth:101),
        Slot(x:0.57,y:1.085,bias:1.00,rotation:-1,depth:102),
        Slot(x:0.74,y:1.075,bias:0.98,rotation:1,depth:100),
        Slot(x:0.90,y:1.085,bias:1.00,rotation:-1,depth:98),
        Slot(x:1.06,y:1.075,bias:0.98,rotation:1,depth:95),
        Slot(x:-0.02,y:1.025,bias:0.98,rotation:1,depth:74),
        Slot(x:0.13,y:1.015,bias:1.00,rotation:-1,depth:77),
        Slot(x:0.28,y:1.025,bias:0.97,rotation:1,depth:79),
        Slot(x:0.43,y:1.015,bias:1.00,rotation:-1,depth:81),
        Slot(x:0.58,y:1.025,bias:0.98,rotation:1,depth:82),
        Slot(x:0.73,y:1.015,bias:1.00,rotation:-1,depth:80),
        Slot(x:0.88,y:1.025,bias:0.97,rotation:1,depth:78),
        Slot(x:1.03,y:1.015,bias:0.99,rotation:-1,depth:75),
        Slot(x:0.02,y:0.965,bias:0.95,rotation:-1,depth:55),
        Slot(x:0.18,y:0.955,bias:0.98,rotation:1,depth:58),
        Slot(x:0.34,y:0.945,bias:1.00,rotation:-1,depth:60),
        Slot(x:0.50,y:0.940,bias:0.98,rotation:1,depth:62),
        Slot(x:0.66,y:0.945,bias:1.00,rotation:-1,depth:61),
        Slot(x:0.82,y:0.955,bias:0.97,rotation:1,depth:59),
        Slot(x:0.98,y:0.965,bias:0.96,rotation:-1,depth:56),
        Slot(x:0.04,y:0.925,bias:0.93,rotation:1,depth:36),
        Slot(x:0.19,y:0.905,bias:0.96,rotation:-1,depth:39),
        Slot(x:0.34,y:0.885,bias:0.99,rotation:1,depth:41),
        Slot(x:0.50,y:0.875,bias:1.00,rotation:-1,depth:43),
        Slot(x:0.66,y:0.885,bias:0.99,rotation:1,depth:42),
        Slot(x:0.81,y:0.905,bias:0.96,rotation:-1,depth:40),
        Slot(x:0.96,y:0.925,bias:0.93,rotation:1,depth:37)
]
    struct Pose {let x,y,rotation,alpha,scaleX,scaleY:Double;let visible:Bool}
    struct Plan {
        let index:Int,birth:Double,x,startY,targetY,exitY,width,height,rotation,depth:Double
        var rise:Double {0.34*0.6*timeScale}
        var firstScale:Double {0.21*0.6*timeScale}
        var secondScale:Double {0.13*0.6*timeScale}
        var thirdScale:Double {0.16*0.6*timeScale}
        var settled:Double {rise+secondScale+thirdScale}
        var hold:Double {0.62*timeScale+Double(20-index)*0.025*timeScale+Double(20-index)*0.05*timeScale}
        var anticipation:Double {0.12*timeScale}
        var exit:Double {0.32*timeScale}
        var end:Double {birth+settled+hold+anticipation+exit}
        func sample(seconds:Double)->Pose {
            let local=seconds-birth
            guard local>=0,local<end-birth else {return Pose(x:x,y:startY,rotation:rotation*0.25,alpha:0,scaleX:0.08,scaleY:0.08,visible:false)}
            var y=targetY,angle=rotation,alpha=1.0,sx=1.0,sy=1.0
            if local<rise {
                let p=Double(NativeBoardMotion.Ease.backOut(2.5).sample(CGFloat(local/rise)))
                y=startY+(targetY-startY)*p;angle=rotation*(0.25+0.75*p);alpha=p
            }
            if local<firstScale {
                let p=Double(NativeBoardMotion.Ease.power2Out.sample(CGFloat(local/firstScale)));sx=0.08+(1.14-0.08)*p;sy=0.08+(0.88-0.08)*p
            } else if local<rise {sx=1.14;sy=0.88}
            else if local<rise+secondScale {
                let p=Double(NativeBoardMotion.Ease.power2Out.sample(CGFloat((local-rise)/secondScale)));sx=1.14+(0.94-1.14)*p;sy=0.88+(1.08-0.88)*p
            } else if local<settled {
                let p=Double(NativeBoardMotion.Ease.backOut(2.1).sample(CGFloat((local-rise-secondScale)/thirdScale)));sx=0.94+0.06*p;sy=1.08-0.08*p
            } else if local>=settled+hold,local<settled+hold+anticipation {
                let raw=(local-settled-hold)/anticipation,p=1-pow(1-raw,2);sx=1+0.08*p;sy=1-0.08*p
            } else if local>=settled+hold+anticipation {
                let raw=(local-settled-hold-anticipation)/exit
                let p=Double(NativeBoardMotion.Ease.backIn(1.7).sample(CGFloat(raw))),q=Double(NativeBoardMotion.Ease.backIn(1.9).sample(CGFloat(raw)))
                y=targetY+(exitY-targetY)*p;angle=rotation*(1-0.65*p);sx=1.08+(0.06-1.08)*q;sy=0.92+(0.06-0.92)*q
            }
            return Pose(x:x,y:y,rotation:angle,alpha:alpha,scaleX:sx,scaleY:sy,visible:true)
        }
    }
    static func make(index:Int,viewport:CGSize,aspect:Double,random:()->Double)->Plan {
        func roll()->Double {let value=random();return value.isFinite ? min(1-Double.ulpOfOne,max(0,value)):0.5}
        // Preserve the generic Juice draws performed before Mushroom overrides.
        let big=roll()<0.5;_ = (big ? 55:18)+roll()*(big ? 35:25);_ = roll();_ = roll();_ = roll()
        let opaque=roll()<0.85;if !opaque {_ = roll()};_ = roll();_ = roll();_ = roll();_ = roll()
        let slot=slots[Int((Double(index)*Double(slots.count-1)/20).rounded())]
        let x=Double(viewport.width)*slot.x+(roll()-0.5)*12,y=Double(viewport.height)*slot.y+(roll()-0.5)*8
        let randomSize=160+roll()*40,width=160+(randomSize-160)*slot.bias,height=width*aspect
        let direction=roll()<0.5 ? slot.rotation:-slot.rotation,rotation=direction*(8+roll()*7) * .pi/180
        return Plan(index:index,birth:Double(index)*0.025*timeScale,x:x,startY:Double(viewport.height)+height*0.45,targetY:y,exitY:Double(viewport.height)+height,width:width,height:height,rotation:rotation,depth:slot.depth)
    }
}
