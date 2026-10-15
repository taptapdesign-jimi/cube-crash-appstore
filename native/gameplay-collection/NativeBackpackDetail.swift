import UIKit

/// One selected die, one finite presentation; no board renderer or progression writes.
@MainActor
final class NativeBackpackDetail:UIViewController {
    let die:NativeBackpackCatalog.Die
    private let assets:JimiV9Artwork,motion:NativeRouteMotion
    let card=UIView(),hero=UIImageView(),close=UIButton(type:.custom)
    private let paper=UIImageView(),heading=UILabel(),copy=UILabel(),backdrop=UIButton(type:.custom)
    let badge=UILabel()
    private var artworkAspect:CGFloat=1,artworkVisibleBounds=CGRect(x:0,y:0,width:1,height:1)
    private var closing=false,disposed=false,entered=false
    var onClose:(()->Void)?
    init(die:NativeBackpackCatalog.Die,assets:JimiV9Artwork,motion:NativeRouteMotion){self.die=die;self.assets=assets;self.motion=motion;super.init(nibName:nil,bundle:nil);modalPresentationStyle = .overFullScreen}
    required init?(coder:NSCoder){fatalError("Use die initializer")}
    override func viewDidLoad(){
        super.viewDidLoad();view.backgroundColor = .clear
        backdrop.backgroundColor=UIColor(red:220/255,green:183/255,blue:163/255,alpha:0.52);backdrop.addTarget(self,action:#selector(closeTapped),for:.touchUpInside);view.addSubview(backdrop);view.addSubview(card)
        paper.image=assets.image("assets/modals/paper.png");paper.layer.cornerRadius=40;paper.clipsToBounds=true;card.addSubview(paper)
        card.layer.shadowColor=UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor;card.layer.shadowOpacity=0.8;card.layer.shadowOffset=CGSize(width:0,height:13);card.layer.shadowRadius=16.8
        heading.textAlignment = .center;heading.font=assets.font(size:30);heading.textColor=NativeBackpackCellPalette.ink
        let text=NSMutableAttributedString(string:die.title)
        text.addAttribute(.foregroundColor,value:UIColor(red:232/255,green:116/255,blue:74/255,alpha:1),range:NSRange(location:0,length:die.title.components(separatedBy:" ").first?.utf16.count ?? 0));heading.attributedText=text
        copy.text=die.copy;copy.numberOfLines=0;copy.textAlignment = .center;copy.font=assets.font(size:20,weight:"Medium");copy.textColor=NativeTextPalette.subtitle
        hero.image=assets.image(die.artwork.path,densityAware:true);hero.contentMode = .scaleAspectFit
        if let image=hero.image {artworkAspect=image.size.width/image.size.height;artworkVisibleBounds=Self.visibleArtworkBounds(image)}
        badge.backgroundColor=UIColor(red:1,green:235/255,blue:201/255,alpha:1);badge.layer.cornerRadius=21;badge.clipsToBounds=true;badge.textAlignment = .center;badge.font=assets.font(size:15);badge.textColor=NativeBackpackCellPalette.ink
        let world=die.board==0 ? "ARCADE":die.board<=10 ? "FOREST":die.board<=20 ? "BEACH":"AREA 55"
        badge.text=die.board==0 ? world:String(format:"%@ %02d",world,(die.board-1)%10+1)
        [heading,copy,hero,badge,close].forEach{card.addSubview($0)}
        close.backgroundColor=UIColor(red:1,green:250/255,blue:244/255,alpha:1);close.layer.cornerRadius=26;close.setImage(assets.image("assets/close-icon.png"),for:.normal);close.imageView?.contentMode = .scaleAspectFit;close.imageEdgeInsets=UIEdgeInsets(top:12,left:12,bottom:12,right:12);close.addTarget(self,action:#selector(closeTapped),for:.touchUpInside);close.accessibilityLabel="Close dice details";close.accessibilityIdentifier="native.backpack.detail.close"
        card.accessibilityIdentifier="native.backpack.detail";card.alpha=0;card.isUserInteractionEnabled=false;view.accessibilityViewIsModal=true
    }
    override func viewDidLayoutSubviews(){
        super.viewDidLayoutSubviews();backdrop.frame=view.bounds
        let width=min(390,view.bounds.width-48),height=min(width/0.78,view.bounds.height-view.safeAreaInsets.top-view.safeAreaInsets.bottom-40),scale=width/390
        heading.font=assets.font(size:32*scale);copy.font=assets.font(size:20*scale,weight:"Medium");badge.font=assets.font(size:15*scale)
        card.bounds=CGRect(x:0,y:0,width:width,height:height);card.center=CGPoint(x:view.bounds.midX,y:view.bounds.midY)
        JimiNativeModalV10.paperLayout(paper,bounds:card.bounds)
        heading.frame=CGRect(x:40*scale,y:36*scale,width:width-80*scale,height:40*scale)
        copy.frame=CGRect(x:40*scale,y:88*scale,width:width-80*scale,height:90*scale)
        let oldSide=min(204*scale,height*0.42)
        let visibleHeight=min(180,height*0.42)
        let artworkHeight=min(visibleHeight/artworkVisibleBounds.height,(width-40*scale)/artworkAspect)
        hero.bounds=CGRect(x:0,y:0,width:artworkHeight*artworkAspect,height:artworkHeight)
        hero.center=CGPoint(x:width/2-(artworkVisibleBounds.midX-0.5)*hero.bounds.width,y:height*0.4+oldSide/2-(artworkVisibleBounds.midY-0.5)*hero.bounds.height)
        let badgeWidth=min(width-80*scale,ceil(badge.intrinsicContentSize.width)+32*scale)
        badge.frame=CGRect(x:(width-badgeWidth)/2,y:height-78*scale,width:badgeWidth,height:42*scale)
        badge.layer.cornerRadius=badge.bounds.height/2
        close.frame=CGRect(x:width-42,y:-10,width:52,height:52)
    }
    /// Read once from a bounded preview of the original PNG. Transparent
    /// margins must not make a nominal 180pt hero visibly smaller.
    static func visibleHeightRatio(_ image:UIImage)->CGFloat {visibleArtworkBounds(image).height}
    static func visibleArtworkBounds(_ image:UIImage)->CGRect {
        let full=CGRect(x:0,y:0,width:1,height:1)
        guard let source=image.cgImage else{return full}
        let factor=min(1,256/CGFloat(max(source.width,source.height)))
        let width=max(1,Int(CGFloat(source.width)*factor)),height=max(1,Int(CGFloat(source.height)*factor))
        var pixels=[UInt8](repeating:0,count:width*height*4)
        return pixels.withUnsafeMutableBytes { buffer in
            guard let context=CGContext(data:buffer.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return full}
            context.draw(source,in:CGRect(x:0,y:0,width:width,height:height))
            var first=height,last = -1,left=width,right = -1
            for row in 0..<height {
                for column in 0..<width where buffer[row*width*4+column*4+3]>8 {first=min(first,row);last=row;left=min(left,column);right=max(right,column)}
            }
            return last>=first ? CGRect(x:CGFloat(left)/CGFloat(width),y:CGFloat(first)/CGFloat(height),width:CGFloat(right-left+1)/CGFloat(width),height:CGFloat(last-first+1)/CGFloat(height)):full
        }
    }
    override func viewDidAppear(_ animated:Bool){super.viewDidAppear(animated);guard !entered,!disposed else{return};entered=true;card.alpha=1
        motion.animate([(card,.init(tweens:[.init(begin:0,duration:UIAccessibility.isReduceMotionEnabled ? 0.16:0.5,from:.scale(0),to:.scale(1),ease:.backOut(1.8))]))]){[weak self] in guard let self,!self.disposed,!self.closing else{return};self.card.isUserInteractionEnabled=true;self.animateHero()}
    }
    private func animateHero(){
        guard !UIAccessibility.isReduceMotionEnabled else{return}
        // Bounded native compositor feedback, only the selected modal artwork.
        let animation=CAKeyframeAnimation(keyPath:"transform.translation.y");animation.values=[0,-8,0];animation.keyTimes=[0,0.5,1];animation.duration=2;animation.repeatCount=3;animation.timingFunctions=[CAMediaTimingFunction(name:.easeInEaseOut),CAMediaTimingFunction(name:.easeInEaseOut)];hero.layer.add(animation,forKey:"backpack.detail.hero")
        if let sheet=die.artwork.idleSheet,let atlas=assets.image(sheet.path)?.cgImage {
            let frames=(0..<sheet.frameCount).compactMap { index in
                atlas.cropping(to:CGRect(x:CGFloat(index%sheet.columns)*sheet.cell.width,y:CGFloat(index/sheet.columns)*sheet.cell.height,width:sheet.cell.width,height:sheet.cell.height))
            }
            if frames.count==sheet.frameCount {
                hero.image=UIImage(cgImage:frames[0])
                let playback=CAKeyframeAnimation(keyPath:"contents");playback.values=frames;playback.calculationMode = .discrete;playback.duration=sheet.cycle;playback.repeatCount=Float(max(1,Int(6/sheet.cycle)));hero.layer.add(playback,forKey:"backpack.detail.frames")
            }
        }
        if die.id=="bee" {
            let frames=(1...4).compactMap{assets.image("assets/shop/bee/bee\($0).png",densityAware:true)?.cgImage}
            if frames.count==4 {let flutter=CAKeyframeAnimation(keyPath:"contents");flutter.values=frames;flutter.calculationMode = .discrete;flutter.duration=0.3;flutter.repeatCount=20;hero.layer.add(flutter,forKey:"backpack.detail.frames")}
        }
    }
    @objc func closeTapped(){guard !closing,!disposed,card.isUserInteractionEnabled else{return};closing=true;card.isUserInteractionEnabled=false;hero.layer.removeAllAnimations()
        motion.animate([(card,.init(tweens:[.init(begin:0,duration:UIAccessibility.isReduceMotionEnabled ? 0.16:0.4,from:.scale(1),to:.scale(0),ease:.backIn(1.7))]))]){[weak self] in guard let self,!self.disposed else{return};let callback=self.onClose;self.dispose();self.dismiss(animated:false,completion:callback)}
    }
    func setForeground(_ active:Bool){if active {motion.resume()}else{motion.suspend();hero.layer.removeAllAnimations()}}
    func dispose(){guard !disposed else{return};disposed=true;motion.cancel();hero.layer.removeAllAnimations();hero.image=nil;onClose=nil}
}
private enum NativeBackpackCellPalette {static let ink=UIColor(red:173/255,green:134/255,blue:117/255,alpha:1)}
