import Foundation
struct NativeWildMeterSmokePlan {
    struct Pose{let x,y,alpha:Double}
    let x,y,radius,dx,dy,duration:Double
    let intensity:Double
    init(x:Double,y:Double,radius:Double,intensity:Double=1,random:()->Double) {
        self.x=x;self.y=y;self.radius=radius
        self.intensity=max(0,min(1,intensity))
        // Literal object-var evaluation is y, x, duration after circle mount.
        dy = -15-random()*10;dx=(random()-0.5)*10;duration=1+random()*0.3
    }
    func sample(seconds:Double)->Pose {
        let duration=(self.duration*1e7).rounded()/1e7,p=max(0,min(1,seconds/duration)),q=1-(1-p)*(1-p)
        func r6(_ n:Double)->Double{floor(n*1e6+0.5)/1e6}
        let fadeDuration=0.12*(1-intensity)
        let enter=fadeDuration>0 ? min(1,max(0,seconds/fadeDuration)):1
        let smoothEnter=enter*enter*(3-2*enter)
        return .init(x:r6(x+dx*q),y:r6(y+dy*q),alpha:r6((1-q)*smoothEnter*(0.65+0.35*intensity)))
    }
}
@MainActor protocol NativeWildMeterSmokeWallDriving:AnyObject {
    func start(_ delivery:@escaping()->Void)->(()->Void)?
}
@MainActor protocol NativeWildMeterSmokeResources:AnyObject {
    func create(id:UInt64,x:Double,y:Double,radius:Double)
    func paint(id:UInt64,_ pose:NativeWildMeterSmokePlan.Pose)
    func destroy(id:UInt64)
}
struct NativeWildMeterSmokeGeometry {
    let x,y,left,width:Double
    let fillAlive,parentAttached:Bool
    // Zero retains the literal source recipe for historical oracle fixtures.
    var maximum:Double=0
    var intensity:Double {maximum>0 ? max(0,min(1,width/(maximum*0.3))):1}
}
