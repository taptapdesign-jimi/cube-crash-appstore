import Foundation

struct NativeBeeLeafPlan {
    let source:String,width:Double,height:Double,front:Bool,motion:NativeBeeLeafMotion
    static func make(route:NativeBeeFinaleMotion,heroPosition:((Double)->NativeBeeFinaleMotion.Point)?=nil,emissionEnd:Double=2.9,retireAt:Double=3.86)->[Self] {
        (0..<42).map {index in
            let burst=index/3,lane=index%3,merge=index<12,start=merge ? Double(lane)*0.018+Double(burst)*0.028:Double(burst)*(emissionEnd/13)+Double(lane)*0.018
            let point=heroPosition?(start) ?? route.sample(seconds:start).point,front=index%3 != 0,unit=(sin(Double(index+1)*91.731+route.seed*13.17)+1)*0.5,angle=(Double(index)*2.399963229728653+unit*0.9).truncatingRemainder(dividingBy:2 * .pi),distance=Double(12+index%4*9)
            let x=(merge ? route.origin.x:point.x)+cos(angle)*distance,y=(merge ? route.origin.y:point.y)+sin(angle)*distance,lifetime=min(1.18+Double(index%5)*0.09,retireAt-start),scatter=route.width*(0.476+unit*0.714),vx=cos(angle)*scatter/lifetime,vy=sin(angle)*scatter/lifetime-90-Double(index%3)*18
            let gravity=NativeBeeLeafMotion.gravity(viewportHeight:route.height,birthY:y,velocityY:vy,lifetime:lifetime),boost:Double=merge ? 2:index%5==0 ? 1.5:unit>0.78 ? 2:1
            let width=(16+(((unit*17+Double(index)*7.31).truncatingRemainder(dividingBy:1))*22).rounded(.toNearestOrAwayFromZero))*boost,height=(14+(((sin(Double(index+3)*47.17+route.seed*5.3)+1)*0.5)*28).rounded(.toNearestOrAwayFromZero))*boost
            return Self(source:"assets/shop/bee/leaf\(index%6+1).png",width:width,height:height,front:front,motion:NativeBeeLeafMotion(birth:start,lifetime:lifetime,birthX:x,birthY:y,velocityX:vx,velocityY:vy,gravity:gravity,flutter:Double(index)*1.73,spin:Double(index%2==1 ? 1:-1)*Double(260+index%6*48),scale:front ? 1.08:0.88,peakOpacity:front ? 1:0.86))
        }
    }
}
