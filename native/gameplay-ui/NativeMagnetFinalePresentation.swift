import SpriteKit
import CoreGraphics

/// Sixteen original electric bolts use the existing board renderer's supported
/// screen blend. The same finite clock drives the UIKit SWOOP glyph overlay.
@MainActor final class NativeMagnetFinalePresentation:SKNode {
    static let assets=(1...8).map{"assets/animations/bolt\($0).png"}
    let assetReady:Bool
    let duration:TimeInterval=0.3+4*0.05+0.54+4*0.06+0.60+0.05
    var onGlyphClock:((TimeInterval,Bool)->Void)?
    private let viewport:CGSize,plans:[NativeMagnetBoltMotion.Plan],sprites:[SKSpriteNode]
    private final class RasterBatch:@unchecked Sendable {
        let inputs:[CGImage],sizes:[CGFloat]
        var outputs:[CGImage]=[]
        init(inputs:[CGImage],sizes:[CGFloat]){self.inputs=inputs;self.sizes=sizes}
    }
    private static let rasterQueue=DispatchQueue(label:"native.magnet-bolt-shadow",qos:.userInitiated)
    private let rasterInputs:[CGImage]
    private var started=false,disposed=false,preparing=false,lastSeconds=0.0
    private var completion:(()->Void)?
    var hasActiveClock:Bool {action(forKey:"magnet-field") != nil}
    init(textures:NativeBoardTextures,viewport:CGSize,random:()->Double={Double.random(in:0..<1)}) {
        self.viewport=viewport
        plans=NativeMagnetBoltMotion.make(viewport:viewport,random:random)
        let originals=Self.assets.compactMap{textures.texture($0)}
        rasterInputs=originals.count==8 ? originals.map{$0.cgImage()}:[]
        sprites=plans.map{plan in
            let sprite=SKSpriteNode(texture:textures.texture("assets/animations/bolt\(plan.assetIndex).png"))
            let dimensions=sprite.texture?.size() ?? .init(width:1,height:1)
            let ratio=plan.size/max(dimensions.width,dimensions.height)
            sprite.size = .init(width:dimensions.width*ratio,height:dimensions.height*ratio)
            sprite.alpha=0;sprite.blendMode = .screen;return sprite
        }
        assetReady=sprites.allSatisfy{$0.texture != nil}
        super.init();name="native-magnet-finale";sprites.forEach(addChild)
    }
    required init?(coder:NSCoder){fatalError("init(coder:) has not been implemented")}
    func play(completion:@escaping()->Void){
        guard !started,!disposed,assetReady else{completion();return}
        started=true;preparing=true;self.completion=completion
        paint(seconds:0)
        guard !disposed else{return}
        run(.sequence([.customAction(withDuration:duration){[weak self] _,time in self?.paint(seconds:Double(time))},.run{[weak self] in self?.dispose()}]),withKey:"magnet-field")
        let batch=RasterBatch(inputs:rasterInputs,sizes:plans.map(\.size))
        Self.rasterQueue.async {
            // Original CSS drop-shadow is applied before the pose transform.
            // Bake each admitted square carrier once; no per-frame blur or
            // files/cache mutation. Pixel padding retains the soft outer glow.
            for (index,size) in batch.sizes.enumerated(){
                let side=Int(size)+72
                guard let context=CGContext(data:nil,width:side,height:side,bitsPerComponent:8,bytesPerRow:0,
                    space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue),batch.inputs.count==8 else{break}
                let image=batch.inputs[index%8],ratio=size/max(CGFloat(image.width),CGFloat(image.height))
                let width=CGFloat(image.width)*ratio,height=CGFloat(image.height)*ratio
                let rect=CGRect(x:(CGFloat(side)-width)/2,y:(CGFloat(side)-height)/2,width:width,height:height)
                context.setShadow(offset:.zero,blur:12,color:CGColor(red:1,green:200.0/255,blue:140.0/255,alpha:0.35))
                context.draw(image,in:rect)
                guard let output=context.makeImage() else{break};batch.outputs.append(output)
            }
            DispatchQueue.main.async {[weak self] in
                guard let self,!self.disposed,self.preparing else{return}
                self.preparing=false
                guard batch.outputs.count==self.sprites.count else{return}
                for (index,image) in batch.outputs.enumerated(){
                    let scale=self.sprites[index].xScale
                    self.sprites[index].setScale(1)
                    self.sprites[index].texture=SKTexture(cgImage:image)
                    self.sprites[index].size=CGSize(width:CGFloat(image.width),height:CGFloat(image.height))
                    self.sprites[index].setScale(scale)
                }
            }
        }
    }
    func paint(seconds:TimeInterval){
        guard started,!disposed else{return};lastSeconds=seconds
        onGlyphClock?(seconds,false)
        guard !disposed else{return}
        for (index,plan) in plans.enumerated(){
            let pose=plan.sample(seconds:seconds),sprite=sprites[index]
            sprite.position = .init(x:pose.point.x,y:viewport.height-pose.point.y)
            sprite.zRotation = -pose.rotation * .pi/180;sprite.setScale(pose.scale);sprite.alpha=pose.alpha
        }
    }
    func dispose(){
        guard !disposed else{return};disposed=true;preparing=false
        removeAllActions();removeFromParent();removeAllChildren()
        onGlyphClock?(lastSeconds,true);onGlyphClock=nil
        let captured=completion;completion=nil;captured?()
    }
}
