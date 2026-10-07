import UIKit

/// Twenty-one original growth PNGs and seventy-two pastel spores retain their
/// independent captured depth and first-arrival receipt under one visible clock.
@MainActor
final class NativeMushroomFinalePresentation:NativeFinitePresentation {
    var onHaptic:((String)->Void)?
    let assetReady:Bool
    private let viewport:CGSize,growth:[NativeMushroomGrowthMotion.Plan],glyphs:NativeSplashGlyphField
    private var growthImages:[UIImageView]=[],growthBirth:[Int:Double]=[:],growthFinished=Set<Int>()
    private var sporeViews:[UIView]=[],spores:[NativeMushroomSporeMotion.Runtime],sporeStart:Double?,sporeFinished=false
    private var beats=Set<Int>(),cancelled=false
    static let assets=["assets/shop/mushroom/mushroom.png"]+(1...5).map {"assets/shop/mushroom/mushroom\($0).png"}
    init(resourceRoot:URL,viewport:CGSize,random:()->Double={Double.random(in:0..<1)}) {
        self.viewport=viewport
        let artwork=JimiV9Artwork(resourceRoot:resourceRoot),color=UIColor(red:253.0/255,green:125.0/255,blue:95.0/255,alpha:1)
        glyphs=NativeSplashGlyphField(artwork:artwork,text:"SHROOMY",colors:[color],splitIndex:0,deferExitRotationCapture:true,random:random)
        let textures=Self.assets.map {artwork.image($0,densityAware:true)}
        assetReady=textures.allSatisfy {$0 != nil}
        func plan(_ index:Int)->NativeMushroomGrowthMotion.Plan {
            let image=textures[index%6],aspect=image.map {Double($0.size.height/max(1,$0.size.width))} ?? 1
            return NativeMushroomGrowthMotion.make(index:index,viewport:viewport,aspect:aspect,random:random)
        }
        // Source timed births0/16/33/49ms precede its55ms pollen callback.
        var captured=(0..<4).map(plan)
        let pollen=NativeMushroomSporeMotion.make(viewport:viewport,random:random)
        captured += (4..<21).map(plan)
        growth=captured;spores=pollen.map {NativeMushroomSporeMotion.Runtime($0)}
        glyphs.captureExitRotations(random:random)
        super.init(viewport:viewport,duration:5.4)
        clipsToBounds=true;accessibilityIdentifier="native-mushroom-finale"
        for (index,p) in captured.enumerated() {
            let image=UIImageView(image:textures[index%6]);image.contentMode = .scaleToFill;image.bounds=CGRect(x:0,y:0,width:p.width,height:p.height)
            image.layer.anchorPoint=CGPoint(x:0.5,y:1);image.layer.zPosition=CGFloat(p.depth);image.alpha=0;addSubview(image);growthImages.append(image)
        }
        let colors:[UInt32]=[0xFFBB9F,0xFFD0A5,0xFFEDC6,0xFFF7E7,0xFFEBE8]
        for (index,p) in pollen.enumerated() {
            let radius=CGFloat(p.radius),diameter=radius*3.3,host=UIView(frame:CGRect(x:0,y:0,width:diameter,height:diameter))
            host.isUserInteractionEnabled=false;host.alpha=0;host.layer.zPosition=CGFloat(p.depth)
            let hex=colors[index%5],color=UIColor(red:CGFloat((hex>>16)&255)/255,green:CGFloat((hex>>8)&255)/255,blue:CGFloat(hex&255)/255,alpha:1)
            let c=CGPoint(x:diameter/2,y:diameter/2)
            for (r,offset,fill) in [(radius*1.65,CGPoint.zero,color.withAlphaComponent(0.24)),(radius,CGPoint.zero,color),(radius*0.32,CGPoint(x:-radius*0.30,y:-radius*0.30),UIColor(red:1,green:247.0/255,blue:231.0/255,alpha:0.92))] {
                let shape=CAShapeLayer();shape.path=CGPath(ellipseIn:CGRect(x:c.x+offset.x-r,y:c.y+offset.y-r,width:r*2,height:r*2),transform:nil);shape.fillColor=fill.cgColor;host.layer.addSublayer(shape)
            }
            addSubview(host);sporeViews.append(host)
        }
        glyphs.frame=bounds;glyphs.layer.zPosition=1000;addSubview(glyphs)
    }
    required init?(coder:NSCoder) {fatalError("init(coder:) has not been implemented")}
    override func start() {guard assetReady else {dispose();return};super.start()}
    override func layoutSubviews() {super.layoutSubviews();glyphs.frame=bounds}
    override func paint(seconds:Double) {
        guard !cancelled,assetReady else {return}
        for index in growth.indices where !growthFinished.contains(index) {
            let p=growth[index];guard seconds>=p.birth else {continue}
            if growthBirth[index]==nil {growthBirth[index]=seconds}
            let clock=seconds-growthBirth[index]!+p.birth,pose=p.sample(seconds:clock),image=growthImages[index]
            if clock>=p.end {growthFinished.insert(index);image.alpha=0;image.isHidden=true;continue}
            image.layer.position=CGPoint(x:pose.x,y:pose.y);image.alpha=CGFloat(pose.alpha)
            image.transform=CGAffineTransform(rotationAngle:pose.rotation).scaledBy(x:pose.scaleX,y:pose.scaleY)
        }
        if sporeStart==nil,seconds>=0.055 {sporeStart=seconds}
        if let birth=sporeStart,!sporeFinished {
            let age=seconds-birth
            for index in spores.indices {
                let pose=spores[index].sample(seconds:min(5,age),viewport:viewport),host=sporeViews[index]
                host.layer.position=CGPoint(x:pose.x,y:pose.y);host.alpha=CGFloat(pose.alpha);host.isHidden = !pose.visible
                host.transform=CGAffineTransform(scaleX:pose.scale,y:pose.scale)
            }
            if age>=5 || spores.allSatisfy(\.finished) {sporeFinished=true;sporeViews.forEach {$0.alpha=0;$0.isHidden=true}}
        }
        glyphs.paint(seconds:seconds)
        // Preserve custom-family source haptics, independent of silent pollen.
        let late=Double(Int(20*25*NativeMushroomGrowthMotion.timeScale*0.75))/1000
        let start=0.2+late
        let burst:[Double]=(0..<4).map {start+Double($0)*0.1}
        let tail:[Double]=[start+0.9,start+1.08,start+1.26,start+1.40]
        let initial:[Double]=[0.2,0.27,0.34]
        let times=initial+burst+tail
        for (index,time) in times.enumerated() where seconds>=time && beats.insert(index).inserted {onHaptic?("light")}
        if growthFinished.count==21,sporeFinished {onHaptic=nil;completePresentation()}
    }
    override func dispose() {guard !cancelled else {return};cancelled=true;onHaptic=nil;growthImages.removeAll();sporeViews.removeAll();spores.removeAll();super.dispose()}
}
