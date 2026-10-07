import UIKit

/// One original Juice PNG route, freshly captured only at actual admission.
struct NativeJuiceBubbleMotion {
    static let sources = ["bubble1","bubble 2","bubble 3","bubble 4","bubble 5","bubble 6","bubble 7","bubble 8"].map { "assets/shop/juice/bubbles pack/"+$0+".png" }
    let assetIndex: Int,start: CGPoint,path: [CGPoint],duration: TimeInterval,alpha: CGFloat,scale: CGFloat,finalScale: CGFloat
    static func make(viewport: CGSize,random: () -> Double = { Double.random(in: 0..<1) }) -> Self {
        func roll() -> CGFloat { CGFloat(min(1-Double.ulpOfOne,max(0,random()))) }
        let selection = roll(),index: Int
        if selection < 0.2 { index = 3 } else if selection < 0.4 { index = 4 } else if selection < 0.5 { index = 5 }
        else if selection < 0.6 { index = 6 } else if selection < 0.7 { index = 7 } else { index = min(2,Int(roll()*3)) }
        let big = roll() < 0.5,baseSize = big ? 55+roll()*35 : 18+roll()*25,size = baseSize*(0.75+roll()*0.08),ratio = size/80
        let x = (roll()-0.5)*viewport.width*1.4+viewport.width/2,y = viewport.height*(0.95+roll()*0.2)
        let fullAlpha = roll() < 0.85,alpha: CGFloat = fullAlpha ? 1 : 0.8+roll()*0.1
        _ = roll() // Shared Mushroom scale draw is retained at its source position.
        let scale = (0.5+roll()*0.4)*ratio,endY = -viewport.height*(0.1+roll()*0.15)
        let duration = min(2.1,max(1.1,1.6+(roll()-0.5)*0.6)),drift = (roll()-0.5)*100
        let direction: CGFloat = roll() < 0.5 ? -1 : 1,weave = viewport.width*(0.1+roll()*0.08),travelY = endY-y
        let path = [CGPoint(x:x,y:y),CGPoint(x:x+drift*0.18+direction*weave,y:y+travelY*0.18),
                    CGPoint(x:x+drift*0.38-direction*weave*0.92,y:y+travelY*0.38),
                    CGPoint(x:x+drift*0.6+direction*weave*0.78,y:y+travelY*0.6),
                    CGPoint(x:x+drift*0.8-direction*weave*0.62,y:y+travelY*0.8),CGPoint(x:x+drift,y:endY)]
        return Self(assetIndex:index,start:CGPoint(x:x,y:y),path:path,duration:Double(duration),alpha:alpha,scale:scale,finalScale:(0.65+roll()*0.35)*ratio)
    }
    func sample(seconds: TimeInterval) -> (point: CGPoint,scale: CGFloat) {
        let clock = NativeBoardMotion.Ease.sineInOut.sample(CGFloat(seconds/duration))*5,index = min(4,max(0,Int(clock))),p = clock-CGFloat(index)
        let a = path[index],b = path[index+1],scaleProgress = min(1,max(0,CGFloat(seconds/(duration*0.45))))
        let quadraticOut = 1-(1-scaleProgress)*(1-scaleProgress)
        return (CGPoint(x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p),scale+(finalScale-scale)*quadraticOut)
    }
}
