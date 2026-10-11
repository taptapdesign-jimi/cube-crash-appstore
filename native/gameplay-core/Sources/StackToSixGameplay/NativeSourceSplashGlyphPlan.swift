import Foundation

/// Authored DOM glyph constructor order. Exit entropy belongs to the later
/// actual exit callback, never this construction receipt.
public struct NativeSourceSplashGlyphPlan:Equatable,Sendable {
    public let text:String
    public let containerTiltRadians:Double
    public let sizes:[Double]
    public let opacities:[Double]
    public let bounces:[Double]
    private init(text:String,tilt:Double,sizes:[Double],opacities:[Double],bounces:[Double]) {
        self.text=text;containerTiltRadians=tilt;self.sizes=sizes
        self.opacities=opacities;self.bounces=bounces
    }
    public static func capture(text:String,random:()->Double,current:()->Bool)->Self? {
        enum Refused:Error {case retired}
        func draw()throws->Double {
            guard current() else{throw Refused.retired}
            let value=random()
            guard current(),value.isFinite,value>=0,value<1 else{throw Refused.retired}
            return value
        }
        guard !text.isEmpty,text.count<=64,current() else{return nil}
        do {
            let tilt=(try draw()-0.5)*30 * .pi/180
            let buckets:[[Double]]=[[92,98,104],[66,72,80],[30,36,44,50],[66,72,80],[92,98,104],[30,36,44,50],[66,72,80],[30,36,44,50],[92,98,104]]
            let offset=Int(try draw()*Double(buckets.count))
            var sizes:[Double]=[],opacities:[Double]=[],bounces:[Double]=[]
            for index in 0..<text.count {
                let bucket=buckets[(index+offset)%buckets.count]
                let base=bucket[Int(try draw()*Double(bucket.count))]
                let size=max(index==0 ? 75:28,base+(try draw()*10-5))
                sizes.append((size*10).rounded()/10)
            }
            for _ in 0..<text.count {
                opacities.append(((0.8+0.2*(try draw()))*100).rounded()/100)
                bounces.append(1.02+0.06*(try draw()))
            }
            guard current() else{return nil}
            return .init(text:text,tilt:tilt,sizes:sizes,opacities:opacities,bounces:bounces)
        } catch {return nil}
    }
}
