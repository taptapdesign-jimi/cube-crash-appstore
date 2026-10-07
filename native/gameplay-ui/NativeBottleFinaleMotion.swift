import UIKit

/// src/modules/bottle-finale-scene.ts authored Catmull-Rom crossing paths.
enum NativeBottleFinaleMotion {
    struct Layer {
        let asset: String,widthPercent: CGFloat,path: [CGFloat],startYRatio: CGFloat,z: CGFloat
    }
    static let layers: [Layer] = [
        Layer(asset: "botle1",widthPercent: 30,path: [23,34,48,55,60],startYRatio: -0.07,z: 80),
        Layer(asset: "botle1",widthPercent: 22,path: [43,34,39,50,58],startYRatio: -0.23,z: 90),
        Layer(asset: "botle2",widthPercent: 36,path: [58,57,55,50,42],startYRatio: 0.03,z: 100),
        Layer(asset: "botle3",widthPercent: 22,path: [72,74,76,82,86],startYRatio: -0.17,z: 110),
        Layer(asset: "botle3",widthPercent: 27,path: [81.8,80,76,70,64],startYRatio: 0.10,z: 120)
    ]
    static func crossing(_ path: [CGFloat],progress: CGFloat) -> CGFloat {
        guard path.count > 1 else { return path.first ?? 50 }
        let segmentCount = path.count-1,scaled = min(1,max(0,progress))*CGFloat(segmentCount)
        let index = min(segmentCount-1,Int(scaled)),t = scaled-CGFloat(index)
        let p0 = path[max(0,index-1)],p1 = path[index],p2 = path[index+1],p3 = path[min(segmentCount,index+2)]
        return 0.5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t)
    }
    static func mixedOpacities(count: Int,random: () -> Double) -> [CGFloat] {
        guard count > 0 else { return [] }
        var values = (0..<count).map { CGFloat(0.2+(Double($0)+min(1,max(0,random())))/Double(count)*0.5) }
        if count > 1 { for index in stride(from: count-1,through: 1,by: -1) {
            let swap = min(index,Int(min(1,max(0,random()))*Double(index+1))); values.swapAt(index,swap)
        } }
        return values
    }
    /// GSAP array keyframes use linear segment ease, with the parent sine ease.
    static func keyframes(_ values: [CGFloat],progress: CGFloat) -> CGFloat {
        guard values.count > 1 else { return values.first ?? 0 }
        let clock = NativeBoardMotion.Ease.sineInOut.sample(progress)*CGFloat(values.count-1)
        let index = min(values.count-2,max(0,Int(clock))),p = clock-CGFloat(index)
        return values[index]+(values[index+1]-values[index])*p
    }
}
