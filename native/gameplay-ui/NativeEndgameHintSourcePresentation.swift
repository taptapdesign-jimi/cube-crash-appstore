import UIKit

@MainActor final class NativeEndgameHintSourcePresentation:UIView {
    private var graph:NativeEndgameHintSourceGraph?
    private let text=UIView()
    private var labels:[UILabel]=[],cloudViews:[UIImageView]=[]
    private var disposed=false
    var onFinished:(()->Void)?
    init(message:String,font:UIFont,images:[UIImage],viewport:CGSize,service:NativeSourceAnimationClockService,
         current:@escaping()->Bool,random:@escaping()->Double)throws {
        guard images.count==4,font.fontName=="Baloo2-ExtraBold" else{throw NativeEndgameHintSourceGraph.Failure.closed}
        super.init(frame:CGRect(origin:.zero,size:viewport));isUserInteractionEnabled=false;backgroundColor = .clear
        accessibilityIdentifier="native.endgame-idle-hint";autoresizingMask=[.flexibleWidth,.flexibleHeight]
        let value=try NativeEndgameHintSourceGraph(message:message,width:viewport.width,height:viewport.height,
            scheduler:NativeNoMovesClockScheduler(service),current:{[weak self] in
                guard let self,!self.disposed else{return false};let admitted=current();return admitted && !self.disposed
            },random:random)
        graph=value
        for c in value.clouds {
            let image=UIImageView(image:images[c.asset]);image.contentMode = .scaleAspectFit
            image.bounds=CGRect(x:0,y:0,width:c.width,height:c.height);image.center=CGPoint(x:c.x,y:c.y);image.alpha=0
            addSubview(image);cloudViews.append(image)
        }
        text.isUserInteractionEnabled=false;addSubview(text)
        var x=0.0,maxHeight=0.0
        for letter in value.letters {
            let label=UILabel();label.text=letter.character==" " ? "\u{00a0}":String(letter.character)
            label.font=font.withSize(letter.size);label.textColor=UIColor(red:231/255,green:116/255,blue:73/255,alpha:1)
            label.textAlignment = .center;label.isUserInteractionEnabled=false;label.alpha=0
            let width=(label.text! as NSString).size(withAttributes:[.font:label.font!]).width
            label.bounds=CGRect(x:0,y:0,width:width,height:letter.size);label.center=CGPoint(x:x+width/2,y:0)
            text.addSubview(label);labels.append(label);x+=width-4.2;maxHeight=max(maxHeight,letter.size)
        }
        let total=x+4.2;text.bounds=CGRect(x:0,y:0,width:total,height:maxHeight)
        for label in labels {label.center.y=maxHeight/2}
        text.center=CGPoint(x:viewport.width/2,y:viewport.height/2);text.transform=CGAffineTransform(rotationAngle:value.tilt * .pi/180)
        value.onGlyph={ [weak self] i,p in self?.paint(i,p) }
        value.onCloud={ [weak self] i,p in
            guard let self,!self.disposed,self.cloudViews.indices.contains(i) else{return};let image=self.cloudViews[i]
            image.center=CGPoint(x:p.x,y:p.y);image.alpha=min(1,max(0,p.alpha))
            image.transform=CGAffineTransform(rotationAngle:value.clouds[i].rotation * .pi/180).scaledBy(x:p.scale,y:p.scale)
        }
        value.onFinished={ [weak self] _ in self?.onFinished?() }
    }
    required init?(coder:NSCoder){fatalError("Use original hint resources")}
    override func layoutSubviews(){super.layoutSubviews();text.center=CGPoint(x:bounds.midX,y:bounds.midY)}
    private func paint(_ i:Int,_ p:NativeNoMovesPlan.Pose) {
        guard !disposed,labels.indices.contains(i) else{return};let label=labels[i]
        label.alpha=min(1,max(0,p.alpha))
        var transform=CATransform3DIdentity;transform.m34 = -1/1000
        transform=CATransform3DTranslate(transform,0,0,p.z)
        transform=CATransform3DRotate(transform,p.rz * .pi/180,0,0,1)
        transform=CATransform3DRotate(transform,p.ry * .pi/180,0,1,0)
        transform=CATransform3DRotate(transform,p.rx * .pi/180,1,0,0)
        label.layer.transform=CATransform3DScale(transform,p.scale,p.scale,1)
    }
    func beginExit(){guard !disposed else{return};graph?.beginExit()}
    isolated deinit{dispose()}
    func dispose(){guard !disposed else{return};disposed=true;onFinished=nil;graph?.dispose();graph=nil;removeFromSuperview()}
}
