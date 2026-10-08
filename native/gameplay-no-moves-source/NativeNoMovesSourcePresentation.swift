import UIKit

@MainActor final class NativeNoMovesClockScheduler:NativeNoMovesRootScheduling {
    private let service:NativeSourceAnimationClockService
    private var sequence:UInt64=0
    init(_ service:NativeSourceAnimationClockService){self.service=service}
    func register(_ participant:any NativeSourceAnimationParticipant,family:NativeSourceAnimationRuntime.RootFamily,duration:Double,delay:Double,paused:Bool,cleanup:@escaping(Bool)->Void)->NativeNoMovesRootLease? {
        guard let lease=service.register(participant:participant,duration:duration,domain:.sourceGSAP(family),delay:delay,initiallySuspended:paused,cleanup:cleanup)else{return nil}
        sequence += 1
        return .init(id:sequence,cancel:{lease.cancel(success:$0)},suspend:{lease.setSuspended($0)},active:{lease.active})
    }
}

/// PRIVATE raster projection of the executed Source graph. Original display
/// packet is used for geometry/font/images only. No UIView clock or sampler
/// derives root completion from nominal entry time or throttled Scene paint.
@MainActor final class NativeNoMovesSourcePresentation:UIView {
    enum AdmissionError:Error{case missingOriginalArtwork}
    let generation:UInt64
    let graph:NativeNoMovesSourceGraph
    private(set) var glyphViews:[UILabel]=[],cloudViews:[UIImageView]=[]
    private let textContainer=UIView()
    private(set) var disposed=false
    var onExitFinished:((Bool)->Void)?
    init(font:UIFont,images:[UIImage],viewport:CGSize,generation:UInt64,service:NativeSourceAnimationClockService,
         current:@escaping(UInt64)->Bool,random:@escaping()->Double,
         scheduleExitFallback:@escaping(@escaping()->Void)->(()->Void))throws {
        guard font.fontName=="Baloo2-ExtraBold",images.count==4 else{throw AdmissionError.missingOriginalArtwork}
        self.generation=generation
        graph=try NativeNoMovesSourceGraph(width:viewport.width,height:viewport.height,scheduler:NativeNoMovesClockScheduler(service),current:{current(generation)},random:random,scheduleExitFallback:scheduleExitFallback)
        super.init(frame:CGRect(origin:.zero,size:viewport))
        isUserInteractionEnabled=false;backgroundColor = .clear;accessibilityIdentifier="native.no-moves.source-graph"
        for c in graph.clouds {
            let image=UIImageView(image:images[c.asset]);image.contentMode = .scaleAspectFit;image.alpha=0
            image.bounds=CGRect(x:0,y:0,width:c.width,height:c.height);addSubview(image);cloudViews.append(image)
        }
        addSubview(textContainer);textContainer.isUserInteractionEnabled=false
        textContainer.transform=CGAffineTransform(rotationAngle:graph.composition.tilt * .pi/180)
        var perspective=CATransform3DIdentity;perspective.m34 = -1/1000;textContainer.layer.sublayerTransform=perspective
        for letter in graph.composition.letters {
            let label=UILabel();label.text=letter.character==" " ? "\u{00A0}":String(letter.character);label.font=font.withSize(letter.size)
            label.textColor=UIColor(red:231.0/255,green:116.0/255,blue:73.0/255,alpha:letter.inkAlpha)
            label.textAlignment = .center;label.layer.isDoubleSided=false;label.alpha=0
            textContainer.addSubview(label);glyphViews.append(label)
        }
        let widths=glyphViews.enumerated().map{ i,label in
            let advance=(label.text! as NSString).size(withAttributes:[.font:label.font as Any]).width
            return graph.composition.letters[i].character==" " ? max(18,advance):advance
        }
        let total=widths.reduce(0,+)-4.2*Double(glyphViews.count-1),height=graph.composition.letters.map(\.size).max() ?? 0
        textContainer.bounds=CGRect(x:0,y:0,width:total,height:height);textContainer.center=CGPoint(x:bounds.midX,y:bounds.midY)
        var x=0.0
        for(i,label)in glyphViews.enumerated(){if i>0{x-=4.2};label.bounds=CGRect(x:0,y:0,width:widths[i],height:graph.composition.letters[i].size);label.center=CGPoint(x:x+widths[i]/2,y:height/2);x+=widths[i]}
        graph.onGlyph={[weak self] i,p in self?.paintGlyph(i,p)}
        graph.onCloud={[weak self] i,p in self?.paintCloud(i,p)}
        graph.onFinished={[weak self] success in self?.finish(success)}
        for i in glyphViews.indices{paintGlyph(i,graph.glyphs[i])}
        for i in cloudViews.indices{paintCloud(i,graph.cloudPoses[i])}
    }
    required init?(coder:NSCoder){fatalError("original NO MOVES resources and Source session")}
    private func paintGlyph(_ i:Int,_ p:NativeNoMovesPlan.Pose){
        guard !disposed,glyphViews.indices.contains(i)else{return}
        CATransaction.begin();CATransaction.setDisableActions(true);defer{CATransaction.commit()}
        var transform=CATransform3DMakeTranslation(0,0,p.z)
        transform=CATransform3DRotate(transform,p.rz * .pi/180,0,0,1)
        transform=CATransform3DRotate(transform,p.ry * .pi/180,0,1,0)
        transform=CATransform3DRotate(transform,p.rx * .pi/180,1,0,0)
        glyphViews[i].layer.transform=CATransform3DScale(transform,p.scale,p.scale,1);glyphViews[i].alpha=min(1,max(0,p.alpha))
    }
    private func paintCloud(_ i:Int,_ p:NativeNoMovesCloudPlan.Cloud.Pose){
        guard !disposed,cloudViews.indices.contains(i)else{return}
        CATransaction.begin();CATransaction.setDisableActions(true);defer{CATransaction.commit()}
        let image=cloudViews[i];image.center=CGPoint(x:p.x,y:p.y);image.alpha=min(1,max(0,p.alpha))
        image.transform=CGAffineTransform(rotationAngle:graph.clouds[i].rotation * .pi/180).scaledBy(x:p.scale,y:p.scale)
    }
    func beginExit(){guard !disposed else{return};graph.beginExit()}
    func dispose(){guard !disposed else{return};graph.dispose()}
    private func finish(_ success:Bool){
        guard !disposed else{return};disposed=true
        graph.onGlyph=nil;graph.onCloud=nil;graph.onFinished=nil
        removeFromSuperview();glyphViews.forEach{$0.removeFromSuperview()};cloudViews.forEach{$0.image=nil;$0.removeFromSuperview()}
        glyphViews.removeAll();cloudViews.removeAll()
        let callback=onExitFinished;onExitFinished=nil;callback?(success)
    }
    isolated deinit {
        if !disposed{graph.onFinished=nil;graph.dispose();let callback=onExitFinished;onExitFinished=nil;callback?(false)}
    }
}
