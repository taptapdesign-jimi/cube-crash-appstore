import Foundation

/// Display only. Caller owns candidate/terminal decision, generation, clock,
/// suspension and exact exit completion. This owner never acquires input locks.
enum NativeNoMovesPlan {
    static let text=Array("No Moves"),exitDuration=1.07
    struct Pose {var scale=0.0,alpha=0.0,rx=0.0,ry=0.0,rz=0.0,z=0.0}
    struct Letter {
        let character:Character,size,inkAlpha,bounce:Double
        func enter(at seconds:Double,index:Int)->Pose {
            let t=seconds-0.2-Double(index)*0.05
            if t<0{return Pose()}
            if t<0.3 {let p=backOut(t/0.3,2);return Pose(scale:1.2*p,alpha:min(1,max(0,p)),rx:-5*p,z:20*p)}
            if t<0.42 {let p=powerOut((t-0.3)/0.12);return Pose(scale:1.2-0.25*p,alpha:1,rx:-5*(1-p),z:20*(1-p))}
            if t<0.54{return Pose(scale:0.95+0.05*backOut((t-0.42)/0.12,1.5),alpha:1)}
            // GSAP rounds its timeline time to seven decimal places before
            // resolving repeat/yoyo endpoints; retain exact elastic endpoints.
            let age=((t-0.54)*1e7).rounded()/1e7
            let phase=age.truncatingRemainder(dividingBy:0.7)/0.35,p=phase<=1 ? phase:2-phase
            return Pose(scale:1+(bounce-1)*elasticInOut(p),alpha:1)
        }
        func exit(at elapsed:Double,index:Int,from:Pose,rotation:Double)->Pose {
            let t=elapsed-Double(index)*0.06
            if t<0{return from}
            if t<0.19 {let p=powerOut(t/0.19);var pose=from;pose.scale=from.scale+(1.1-from.scale)*p;pose.z=from.z+(30-from.z)*p;return pose}
            let p=pow(min(1,max(0,(t-0.19)/0.41)),3)
            return Pose(scale:1.1*(1-p),alpha:from.alpha*(1-p),rx:from.rx+(45-from.rx)*p,ry:from.ry+(30-from.ry)*p,rz:from.rz+(rotation-from.rz)*p,z:30-130*p)
        }
    }
    struct Composition {let tilt:Double,letters:[Letter]}
    static func make(random:()->Double)->Composition {
        let tilt=(random()-0.5)*30,buckets=[[92.0,98,104],[66,72,80],[30,36,44,50],[66,72,80],[92,98,104],[30,36,44,50],[66,72,80],[30,36,44,50],[92,98,104]]
        let offset=min(8,Int(random()*9))
        var sizes:[Double]=[]
        for index in text.indices {let bucket=buckets[(index+offset)%9],base=bucket[min(bucket.count-1,Int(random()*Double(bucket.count)))];sizes.append(max(index==0 ? 75:28,base+random()*10-5))}
        let letters=text.indices.map { i -> Letter in
            let size=text[i]==" " ? 64:sizes[i],alpha=((0.8+random()*0.2)*100).rounded()/100,bounce=1.02+random()*0.06
            return Letter(character:text[i],size:(size*10).rounded()/10,inkAlpha:alpha,bounce:bounce)
        }
        return Composition(tilt:tilt,letters:letters)
    }
    static func backOut(_ p:Double,_ amount:Double)->Double {let u=min(1,max(0,p))-1;return 1+u*u*((amount+1)*u+amount)}
    static func backIn(_ p:Double,_ amount:Double)->Double {let t=min(1,max(0,p));return t*t*((amount+1)*t-amount)}
    static func powerOut(_ p:Double)->Double {1-pow(1-min(1,max(0,p)),3)}
    static func elasticInOut(_ p:Double)->Double {
        func out(_ t:Double)->Double {t==0 ? 0:t==1 ? 1:pow(2,-10*t)*sin((t-0.05)*(.pi*2/0.2))+1}
        return p<0.5 ? (1-out(1-p*2))/2:0.5+out((p-0.5)*2)/2
    }
}
