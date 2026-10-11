import UIKit

/// Caller-clocked v9 NO MOVES display. Mount over the gameplay canvas (not HUD);
/// caller alone owns candidate/terminal, entry/exit receipts and visibility.
@MainActor
final class NativeNoMovesPresentation:UIView {
    private let composition:NativeNoMovesPlan.Composition
    private let clouds:[NativeNoMovesCloudPlan.Cloud]
    private var glyphs:[UILabel]=[],cloudViews:[UIImageView]=[]
    private let textContainer=UIView()
    private var exitAt:Double?,exitFrom:[NativeNoMovesPlan.Pose]=[],exitRotations:[Double]=[]
    private(set) var disposed=false
    let generation:UInt64
    var onExitFinished:((Bool)->Void)?
    init(font:UIFont,images:[UIImage],viewport:CGSize,generation:UInt64,random:()->Double) throws {
        guard font.fontName=="Baloo2-ExtraBold",images.count==4 else{throw AdmissionError.missingOriginalArtwork}
        self.generation=generation
        composition=NativeNoMovesPlan.make(random:random)
        clouds=NativeNoMovesCloudPlan.make(width:viewport.width,height:viewport.height,random:random)
        super.init(frame:CGRect(origin:.zero,size:viewport))
        isUserInteractionEnabled=false;backgroundColor = .clear;accessibilityIdentifier="native.no-moves"
        for plan in clouds {let image=UIImageView(image:images[plan.asset]);image.contentMode = .scaleAspectFit;image.alpha=0;addSubview(image);cloudViews.append(image)}
        addSubview(textContainer);textContainer.isUserInteractionEnabled=false
        textContainer.transform=CGAffineTransform(rotationAngle:composition.tilt * .pi/180)
        var perspective=CATransform3DIdentity;perspective.m34 = -1/1000;textContainer.layer.sublayerTransform=perspective
        for letter in composition.letters {
            let label=UILabel();label.text=letter.character==" " ? "\u{00A0}":String(letter.character);label.font=font.withSize(letter.size)
            label.textColor=UIColor(red:231.0/255,green:116.0/255,blue:73.0/255,alpha:letter.inkAlpha)
            label.textAlignment = .center;label.layer.isDoubleSided=false;label.alpha=0
            textContainer.addSubview(label);glyphs.append(label)
        }
        layoutDisplay();paint(at:0)
    }
    enum AdmissionError:Error {case missingOriginalArtwork}
    required init?(coder:NSCoder){fatalError("original NO MOVES resources")}
    private func layoutDisplay(){
        let widths=glyphs.map{($0.text! as NSString).size(withAttributes:[.font:$0.font as Any]).width}
        let total=widths.reduce(0,+)-4.2*Double(glyphs.count-1),height=composition.letters.map(\.size).max() ?? 0
        textContainer.bounds=CGRect(x:0,y:0,width:total,height:height);textContainer.center=CGPoint(x:bounds.midX,y:bounds.midY)
        var x=0.0
        for(i,label)in glyphs.enumerated(){if i>0{x-=4.2};label.bounds=CGRect(x:0,y:0,width:widths[i],height:composition.letters[i].size);label.center=CGPoint(x:x+widths[i]/2,y:height/2);x+=widths[i]}
        for(i,image)in cloudViews.enumerated(){image.bounds=CGRect(x:0,y:0,width:clouds[i].width,height:clouds[i].height)}
    }
    func beginExit(at seconds:Double,random:()->Double)->Double {
        guard !disposed,exitAt==nil else{return NativeNoMovesPlan.exitDuration}
        exitFrom=composition.letters.enumerated().map{$0.element.enter(at:seconds,index:$0.offset)}
        exitRotations=composition.letters.map{_ in 12+random()*8};exitAt=seconds
        return NativeNoMovesPlan.exitDuration
    }
    func paint(at seconds:Double){
        guard !disposed else{return}
        CATransaction.begin();CATransaction.setDisableActions(true);defer{CATransaction.commit()}
        for(i,image)in cloudViews.enumerated(){let p=clouds[i].sample(at:seconds);image.center=CGPoint(x:p.x,y:p.y);image.alpha=p.alpha;image.transform=CGAffineTransform(rotationAngle:clouds[i].rotation * .pi/180).scaledBy(x:p.scale,y:p.scale);image.isHidden=seconds>=clouds[i].duration}
        for(i,label)in glyphs.enumerated(){let p:NativeNoMovesPlan.Pose
            if let exitAt {p=composition.letters[i].exit(at:seconds-exitAt,index:i,from:exitFrom[i],rotation:exitRotations[i])}
            else{p=composition.letters[i].enter(at:seconds,index:i)}
            var transform=CATransform3DMakeTranslation(0,0,p.z)
            transform=CATransform3DRotate(transform,p.rz * .pi/180,0,0,1)
            transform=CATransform3DRotate(transform,p.ry * .pi/180,0,1,0)
            transform=CATransform3DRotate(transform,p.rx * .pi/180,1,0,0)
            label.layer.transform=CATransform3DScale(transform,p.scale,p.scale,1);label.alpha=p.alpha
        }
        if let exitAt,seconds-exitAt>=NativeNoMovesPlan.exitDuration {finish(completed:true)}
    }
    private func finish(completed:Bool){guard !disposed else{return};disposed=true;removeFromSuperview();glyphs.forEach{$0.removeFromSuperview()};cloudViews.forEach{$0.image=nil;$0.removeFromSuperview()};glyphs.removeAll();cloudViews.removeAll();let reply=onExitFinished;onExitFinished=nil;reply?(completed)}
    func dispose(){finish(completed:false)}
}
