import UIKit

struct NativeSpecialDiceUnlockPresentation {
    enum Dice:String {case flower,juice
        var label:String {self == .flower ? "Flower":"Juice"}
        var asset:String {self == .flower ? "assets/shop/bush/flower.png":"assets/wild-juice.png"}
    }
    static let frameStartTimes: [Double] = (1...20).map { frame -> Double in
        let fastFrames = Double(min(16, frame - 1))
        let slowFrames = Double(max(0, frame - 17))
        return fastFrames * 0.046 + slowFrames * 0.064
    }
    static let frameDuration=16*0.046+4*0.064
    static let revealEnter=0.02,revealImpact=0.54,ctaEnter=0.22
    static func framePath(_ index:Int)->String {"assets/animations/backpack/backpack-\(max(1,min(20,index))).png"}
    struct Layout {
        let title:CGRect,subtitle:CGRect,hero:CGRect,shadow:CGRect,cta:CGRect
        let titleFont:CGFloat,subtitleFont:CGFloat
        init(width:CGFloat,height:CGFloat) {
            let compact=height<=760
            titleFont=max(44,min(64,width*0.094));subtitleFont=max(23,min(32,width*0.051))
            let top=compact ? 56:max(84,min(132,height*0.135)),titleHeight=titleFont*0.95,subtitleHeight=subtitleFont*1.2
            let heroWidth=compact ? min(width*0.64,330):min(width*0.68,380),heroHeight=heroWidth*438/379
            title=CGRect(x:24,y:top-16,width:width-48,height:titleHeight)
            subtitle=CGRect(x:24,y:top+titleHeight+26-16,width:width-48,height:subtitleHeight)
            hero=CGRect(x:(width-heroWidth)/2,y:top+titleHeight+26+subtitleHeight+(compact ? 42:max(70,min(116,height*0.125)))-64,width:heroWidth,height:heroHeight)
            shadow=CGRect(x:heroWidth*0.06,y:heroHeight*0.89+28,width:heroWidth*0.88,height:heroHeight*0.16)
            let ctaWidth=min(width*0.68,408),gap=compact ? 18:max(20,min(42,height*0.042))
            cta=CGRect(x:(width-ctaWidth)/2,y:hero.maxY+gap+(compact ? 18:24),width:ctaWidth,height:64)
        }
    }
}
