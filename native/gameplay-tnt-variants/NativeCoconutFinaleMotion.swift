import UIKit

/// Finite analytic box flights; side-wall receipts never depend on frame rate.
struct NativeCoconutFinaleMotion {
    struct Flight {
        let start:CGPoint,velocity:CGPoint,size:CGFloat,delay:Double,exitAge:Double,spin:Double
        let animated:Bool
        let topAge:Double?
        var endTime:Double {delay+exitAge}
        var displayRadius:CGFloat {size*(animated ? 640.0/371:1)*0.85}
        var wallRadius:CGFloat {size*0.75}
    }
    struct Contact {let time:Double,id:Int,body:Int;let top:Bool;let spinKick:Double}
    let whole:[Flight],contacts:[Contact]
    let endTime:Double
    let viewport:CGSize
    init(viewport:CGSize,boardBodySize:CGFloat=48,random:()->Double) {
        self.viewport=viewport
        var flights:[Flight]=[],contacts:[Contact]=[]
        for i in 0..<16 {
            let size=boardBodySize*CGFloat(0.8+random()*0.4)
            let radius=size*0.75,delay=0.25+Double(i%8)*0.14+random()*0.035
            let start=CGPoint(x:min(viewport.width-radius,max(radius,viewport.width/2+CGFloat((random()-0.5)*110))),y:viewport.height/2+CGFloat((random()-0.5)*70))
            let angle=i<8 ? random() * .pi*2 : -.pi*(0.18+Double(i%3)*0.32+(random()-0.5)*0.10)
            let speed=550+random()*500
            let vx=cos(angle)*speed,vy=sin(angle)*speed
            let direction:Double=vx>=0 ? 1:-1
            let extent=size*(i<5 ? CGFloat(640.0/371):1)*0.85
            let discriminant=vy*vy-1800*Double(start.y-radius)
            let topAge:Double?=vy<0 && discriminant>0 ? (-vy-sqrt(discriminant))/900:nil
            let age:Double
            if let hit=topAge {
                let reflected = -(vy+900*hit)
                age=hit+(-reflected+sqrt(reflected*reflected+1800*Double(viewport.height+extent-radius)))/900
                contacts.append(Contact(time:delay+hit,id:contacts.count,body:i,top:true,spinKick:(random()-0.5)*18))
            }else{age=(-vy+sqrt(vy*vy+1800*Double(viewport.height+extent-start.y)))/900}
            let flight=Flight(start:start,velocity:CGPoint(x:vx,y:vy),size:size,delay:delay,exitAge:age,spin:(random()<0.5 ? -1:1)*(8+speed/60+random()*10),animated:i<5,topAge:topAge)
            flights.append(flight)
            let width=Double(viewport.width-2*radius),origin=Double(start.x-radius)
            var crossing=direction>0 ? width:0.0
            var time=(crossing-origin)/vx
            while time<age {
                if time>0 {contacts.append(Contact(time:delay+time,id:contacts.count,body:i,top:false,spinKick:(random()-0.5)*18))}
                crossing+=direction*width;time=(crossing-origin)/vx
            }
        }
        whole=flights;self.contacts=contacts.sorted{$0.time<$1.time}
        endTime=flights.map(\.endTime).max() ?? 0
    }
    func position(_ flight:Flight,seconds:Double)->CGPoint {
        let t=max(0,min(flight.exitAge,seconds-flight.delay))
        let width=viewport.width-2*flight.wallRadius
        let raw=flight.start.x-flight.wallRadius+flight.velocity.x*t
        let cycle=(raw.truncatingRemainder(dividingBy:2*width)+2*width).truncatingRemainder(dividingBy:2*width)
        let x=flight.wallRadius+(cycle<=width ? cycle:2*width-cycle)
        let y:Double
        if let hit=flight.topAge,t>=hit {
            let age=t-hit,reflected = -(Double(flight.velocity.y)+900*hit)
            y=Double(flight.wallRadius)+reflected*age+450*age*age
        }else{y=Double(flight.start.y+flight.velocity.y*t+450*t*t)}
        return CGPoint(x:x,y:y)
    }
    func rotation(body:Int,seconds:Double)->Double {
        let flight=whole[body],time=min(flight.endTime,max(flight.delay,seconds))
        return (time-flight.delay)*flight.spin+contacts.lazy.filter{$0.body==body && $0.time<time}.reduce(0){$0+(time-$1.time)*$1.spinKick}
    }
    func squash(body:Int,seconds:Double)->CGPoint {
        guard let contact=contacts.last(where:{$0.body==body && $0.time<=seconds}),seconds-contact.time<0.16 else{return CGPoint(x:1,y:1)}
        let age=seconds-contact.time
        let wave:Double
        func blend(_ p:Double)->Double {(1-cos(.pi*p))/2}
        if age<0.025 {wave=0.50*blend(age/0.025)}
        else if age<0.075 {wave=0.50-0.65*blend((age-0.025)/0.050)}
        else {wave = -0.15*(1-blend((age-0.075)/0.085))}
        return contact.top ? CGPoint(x:1+wave,y:1-wave):CGPoint(x:1-wave,y:1+wave)
    }
    static func palmAngle(seconds:Double)->Double {
        let start=1.16,end=1.77
        if seconds<start{return (.pi/4)*sin(seconds * .pi*2/0.72)}
        let p=min(1,max(0,(seconds-start)/(end-start)))
        let initial=(.pi/4)*sin(start * .pi*2/0.72)
        let velocity=(.pi/4)*(2 * .pi/0.72)*cos(start * .pi*2/0.72)
        return (2*p*p*p-3*p*p+1)*initial+(p*p*p-2*p*p+p)*(end-start)*velocity+(-2*p*p*p+3*p*p)*(-.pi/2)
    }
}

/// All five bodies borrow one selected original SVG atlas and this finite clock.
@MainActor final class NativeCoconutSVGView:UIView {
    init(atlas:CGImage){super.init(frame:CGRect(x:0,y:0,width:128,height:128));layer.contents=atlas;isUserInteractionEnabled=false}
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    func paint(seconds:Double){let frame=NativeDiceSheet.coconut.frame(at:max(0,seconds));layer.contentsRect=CGRect(x:Double(frame%8)/8,y:Double(frame/8)/16,width:1.0/8,height:1.0/16)}
    func retire(){layer.contents=nil}
}

/// Overlapping image bands bend the original leaves locally without image
/// decoding, filters, another renderer or a clock. Only the visible pose samples.
@MainActor final class NativeCoconutPalmView:UIImageView {
    private var bands:[CALayer]=[]
    override init(image:UIImage?) {
        super.init(image:image)
        guard let image,let pixels=image.cgImage else{return}
        bounds=CGRect(origin:.zero,size:image.size);self.image=nil
        for i in 0..<64 {
            let layer=CALayer(),y=CGFloat(i)/64,h=min(1-y,1.0/64+0.004)
            layer.contents=pixels;layer.contentsScale=image.scale
            layer.contentsRect=CGRect(x:0,y:y,width:1,height:h)
            layer.frame=CGRect(x:0,y:y*bounds.height,width:bounds.width,height:h*bounds.height)
            self.layer.addSublayer(layer);bands.append(layer)
        }
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    func bend(seconds:Double,amplitude:Double=1) {
        CATransaction.begin();CATransaction.setDisableActions(true)
        for (i,band) in bands.enumerated() {
            let row=Double(i)/63,phase=seconds * .pi*2/0.58+row*3.2
            let displacement=sin(phase)*6*sin(.pi*row)*amplitude
            let transform=CGAffineTransform(translationX:displacement,y:0)
            band.setAffineTransform(transform)
        }
        CATransaction.commit()
    }
    func retire(){bands.forEach{$0.contents=nil;$0.removeFromSuperlayer()};bands.removeAll()}
}
