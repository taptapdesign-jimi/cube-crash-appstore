import UIKit

enum NativeRewardFoilPlanning {
    struct Reflection:Equatable {let opacity,gold,rainbow:Double}
    static func reflection(_ angle:Double)->Reflection {
        guard angle.isFinite else{return Reflection(opacity:0,gold:50,rainbow:50)}
        let normal=(angle.truncatingRemainder(dividingBy:360)+360).truncatingRemainder(dividingBy:360)
        let signed=normal<=90 ? normal:normal>=270 ? normal-360:180
        let tilt=abs(signed)
        guard tilt<88 else{return Reflection(opacity:0,gold:50,rainbow:50)}
        func smooth(_ x:Double)->Double {let t=min(1,max(0,x));return t*t*(3-2*t)}
        func round(_ x:Double,_ scale:Double)->Double {(x*scale).rounded()/scale}
        return Reflection(opacity:round((0.104+0.39*smooth(tilt/18))*smooth((88-tilt)/20),10000),gold:round(50+signed/72*60,100),rainbow:round(50-signed/72*48,100))
    }
}

/// Original countertravelling 104° gold and 76° diffraction gradients.
/// One selected card mask clips both; no independent persistent display loop.
@MainActor
final class NativeRewardFoil {
    let layer=CALayer()
    private let gold=CAGradientLayer(),rainbow=CAGradientLayer()
    init() {
        func color(_ r:CGFloat,_ g:CGFloat,_ b:CGFloat,_ a:CGFloat)->CGColor {UIColor(red:r/255,green:g/255,blue:b/255,alpha:a).cgColor}
        gold.colors=[color(255,197,69,0),color(255,204,112,0.16),color(255,249,218,0.44),color(255,255,248,0.38),color(255,213,128,0.22),color(255,190,86,0.14),color(255,197,69,0)]
        gold.locations=[0.16,0.32,0.43,0.50,0.60,0.67,0.82]
        rainbow.colors=[color(128,224,255,0),color(128,224,255,0.32),color(169,139,255,0.32),color(255,137,211,0.36),color(255,232,116,0.23),color(124,255,190,0.34),color(128,224,255,0)]
        rainbow.locations=[0.08,0.24,0.37,0.49,0.61,0.73,0.91]
        layer.addSublayer(rainbow);layer.addSublayer(gold);layer.opacity=0;layer.zPosition=1.2
    }
    func layout(_ bounds:CGRect,mask:CGImage?) {
        layer.frame=bounds
        gold.frame=CGRect(x:-bounds.width*0.9,y:0,width:bounds.width*2.8,height:bounds.height)
        rainbow.frame=CGRect(x:-bounds.width*0.6,y:-bounds.height*0.225,width:bounds.width*2.2,height:bounds.height*1.45)
        for (gradient,angle) in [(gold,104.0),(rainbow,76.0)] {
            let dx=sin(angle * .pi/180),dy = -cos(angle * .pi/180)
            let w=Double(gradient.bounds.width),h=Double(gradient.bounds.height),extent=abs(w*dx)+abs(h*dy)
            gradient.startPoint=CGPoint(x:0.5-dx*extent/(2*max(1,w)),y:0.5-dy*extent/(2*max(1,h)))
            gradient.endPoint=CGPoint(x:0.5+dx*extent/(2*max(1,w)),y:0.5+dy*extent/(2*max(1,h)))
        }
        let clipping=CALayer();clipping.frame=CGRect(x:bounds.width*0.025,y:bounds.height*0.025-4,width:bounds.width*0.95,height:bounds.height*0.95);clipping.contents=mask;clipping.contentsGravity = .resizeAspect;layer.mask=clipping
    }
    func paint(angle:Double,idle:Bool) {
        stop();let state=NativeRewardFoilPlanning.reflection(angle)
        CATransaction.begin();CATransaction.setDisableActions(true)
        layer.opacity=Float(max(0.12,state.opacity*(idle ? 0.58:1)))
        gold.setValue(-((state.gold-50)/100)*layer.bounds.width*1.8,forKeyPath:"transform.translation.x")
        rainbow.setValue(-((state.rainbow-50)/100)*layer.bounds.width*1.2,forKeyPath:"transform.translation.x")
        CATransaction.commit()
    }
    func idle() {
        let states=[0.0,-21.6,0,21.6,0].map(NativeRewardFoilPlanning.reflection)
        let count=192,times=(0...count).map{Double($0)/Double(count)}
        func sample(_ field:(NativeRewardFoilPlanning.Reflection)->Double)->[Double] {
            times.map { time in
                let p=NativeRewardMotion.cubic(time,0.42,0,0.58,1)*4,index=min(3,Int(p)),local=p-Double(index)
                return field(states[index])+(field(states[index+1])-field(states[index]))*local
            }
        }
        animate(layer,"opacity",sample{max(0.12,$0.opacity*0.58)},times:times,duration:6.8)
        animate(gold,"transform.translation.x",sample{-($0.gold-50)/100*layer.bounds.width*1.8},times:times,duration:6.8)
        animate(rainbow,"transform.translation.x",sample{-($0.rainbow-50)/100*layer.bounds.width*1.2},times:times,duration:6.8)
    }
    func settle(angle:Double) {
        let from=NativeRewardFoilPlanning.reflection(angle),to=NativeRewardFoilPlanning.reflection(0),count=96
        let times=(0...count).map{Double($0)/Double(count)}
        func values(_ a:Double,_ b:Double)->[Double] {times.map{a+(b-a)*NativeRewardMotion.cubic($0,0.22,1,0.36,1)}}
        animate(layer,"opacity",values(max(0.12,from.opacity),0.12),times:times,duration:0.26)
        animate(gold,"transform.translation.x",values(-(from.gold-50)/100*layer.bounds.width*1.8,-(to.gold-50)/100*layer.bounds.width*1.8),times:times,duration:0.26)
        animate(rainbow,"transform.translation.x",values(-(from.rainbow-50)/100*layer.bounds.width*1.2,-(to.rainbow-50)/100*layer.bounds.width*1.2),times:times,duration:0.26)
    }
    private func animate(_ target:CALayer,_ path:String,_ values:[Double],times:[Double],duration:Double) {
        CATransaction.begin();CATransaction.setDisableActions(true);target.setValue(values.last!,forKeyPath:path);CATransaction.commit()
        let animation=CAKeyframeAnimation(keyPath:path);animation.values=values;animation.keyTimes=times.map{NSNumber(value:$0)};animation.duration=duration;target.add(animation,forKey:"reward.foil.\(path)")
    }
    func stop(){for target in [layer,gold,rainbow] {target.removeAllAnimations()}}
}
