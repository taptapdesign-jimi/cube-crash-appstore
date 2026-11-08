import UIKit
import CoreText

/// Shared semantic text colors for Native UI.
enum NativeTextPalette {
    static let accentOrange=UIColor(red:231/255,green:116/255,blue:73/255,alpha:1)
    static let navigationTitle = UIColor(red:190/255,green:124/255,blue:89/255,alpha:1) // #BE7C59
    static let modalTitle = UIColor(red:190/255,green:124/255,blue:89/255,alpha:1) // #BE7C59
    static let subtitle = UIColor(red:207/255,green:147/255,blue:115/255,alpha:1) // #CF9373
}

/// Modal subtitles use the shared 18pt / 23.4pt rhythm, including explicit newlines.
enum NativeModalTypography {
    /// Backpack and Box headings share the collection counter's orange accent.
    static func attributedCollectionTitle(_ text:String,baseColor:UIColor)->NSAttributedString {
        let title=NSMutableAttributedString(string:text,attributes:[.foregroundColor:baseColor])
        let words=text.split(whereSeparator:{$0.isWhitespace})
        if words.count==2,let first=words.first,let range=text.range(of:String(first)) {
            title.addAttribute(.foregroundColor,value:UIColor(red:232/255,green:116/255,blue:74/255,alpha:1),range:NSRange(range,in:text))
        }
        return title
    }

    static func subtitleParagraph(fontSize:CGFloat=18,alignment:NSTextAlignment = .center)->NSParagraphStyle {
        let paragraph=NSMutableParagraphStyle()
        paragraph.alignment=alignment
        paragraph.minimumLineHeight=fontSize*1.3
        paragraph.maximumLineHeight=fontSize*1.3
        return paragraph
    }
    static func attributedSubtitle(_ text:String,font:UIFont,alignment:NSTextAlignment = .center)->NSAttributedString {
        NSAttributedString(string:text,attributes:[.font:font,.foregroundColor:NativeTextPalette.subtitle,
            .paragraphStyle:subtitleParagraph(fontSize:font.pointSize,alignment:alignment)])
    }
}

/// Glyphs stay vector text and retain UILabel accessibility and attributed colors.
/// Only the baseline and each glyph tangent follow the shared divider parabola.
@MainActor
final class JimiV9ArchedNavigationTitle:UILabel {
    private var glyphLayers:[CALayer]=[]
    private var cachedValue:NSAttributedString?
    private var cachedGeometry:CGRect = .null
    private var cachedHeaderWidth:CGFloat = -1
    private weak var leftEntryIcon:UIView?
    private weak var rightEntryIcon:UIView?
    private static let entryKey="native.navigation.content.enter"
    static let navigationAcceleration:Double=1.2
    static let navigationSpeed:Double=1.3*navigationAcceleration
    static let titleEntryDelay:Double=0.10/navigationSpeed
    static let elementStagger:Double=0.13/navigationSpeed
    static let elementDuration:Double=0.56/navigationSpeed
    static let backgroundExitDelay:Double=elementStagger*3
    // Accepted Forest main-art exit is the reference handoff window. Incoming
    // titles retain its gap even when a collection's content exits sooner.
    static let handoffWindow:Double=0.234+0.4368
    static var titleHandoffGap:Double {handoffWindow+titleEntryDelay-contentDelay(index:0,entering:false)-elementDuration}
    static func contentDelay(index:Int,entering:Bool)->Double {
        if entering {return titleEntryDelay+Double(index)*elementStagger}
        return Double(index == 0 ? 2:index-1)*elementStagger // left,right,title
    }
    static func visualDuration(entering:Bool)->Double {
        entering ? titleEntryDelay+2*elementStagger+elementDuration:backgroundExitDelay+elementDuration
    }
    static func reducedDuration(entering:Bool)->Double {(entering ? 0.20:0.16)/navigationAcceleration}
    /// Directional accessibility recipe shared by every top header. Input is
    /// explicit so callers can inspect it without changing device preferences.
    static func reducedNavigationGroup(_ source:CAAnimationGroup,entering:Bool,rest:CATransform3D,initialOpacity:Float)->CAAnimationGroup {
        let duration=reducedDuration(entering:entering)
        let parent=source.copy() as! CAAnimationGroup
        parent.duration=duration
        let hold=CAKeyframeAnimation(keyPath:"transform")
        hold.values=[NSValue(caTransform3D:rest),NSValue(caTransform3D:rest)];hold.duration=duration
        let alpha=CAKeyframeAnimation(keyPath:"opacity")
        alpha.values=[entering ? 0:initialOpacity,entering ? 1:0];alpha.duration=duration
        parent.animations=[hold,alpha]
        return parent
    }
    override func drawText(in rect:CGRect) {} // Original CoreText geometry is painted by static glyph layers.
    override func layoutSubviews(){super.layoutSubviews();prepareGlyphs()}
    private func prepareGlyphs() {
        guard let font else{return}
        let value=NSMutableAttributedString(string:text ?? "",attributes:[.font:font,.foregroundColor:textColor ?? UIColor.black])
        if let attributedText {attributedText.enumerateAttributes(in:NSRange(location:0,length:attributedText.length)){attrs,range,_ in value.addAttributes(attrs,range:range)}}
        let width=superview?.bounds.width ?? bounds.width
        let geometry=CGRect(x:frame.minX,y:0,width:bounds.width,height:bounds.height)
        guard width>0 else{return}
        guard cachedValue?.isEqual(to:value) != true || cachedGeometry != geometry || cachedHeaderWidth != width else{return}
        cachedValue=value.copy() as? NSAttributedString;cachedGeometry=geometry;cachedHeaderWidth=width
        glyphLayers.forEach{$0.removeFromSuperlayer()};glyphLayers.removeAll()
        let line=CTLineCreateWithAttributedString(value)
        let startX=(bounds.width-CGFloat(CTLineGetTypographicBounds(line,nil,nil,nil)))/2
        let baseline=(bounds.height-font.lineHeight)/2+font.ascender
        CATransaction.begin();CATransaction.setDisableActions(true)
        for run in CTLineGetGlyphRuns(line) as! [CTRun] {
            let count=CTRunGetGlyphCount(run)
            var glyphs=[CGGlyph](repeating:0,count:count),positions=[CGPoint](repeating:.zero,count:count),advances=[CGSize](repeating:.zero,count:count)
            CTRunGetGlyphs(run,CFRange(location:0,length:0),&glyphs);CTRunGetPositions(run,CFRange(location:0,length:0),&positions);CTRunGetAdvances(run,CFRange(location:0,length:0),&advances)
            let attrs=CTRunGetAttributes(run) as NSDictionary,runFont=(CTRunGetAttributes(run) as NSDictionary)[kCTFontAttributeName] as! CTFont
            let ink=attrs[kCTForegroundColorAttributeName] ?? attrs[NSAttributedString.Key.foregroundColor.rawValue]
            for index in glyphs.indices {
                let localX=startX+positions[index].x,midX=frame.minX+localX+advances[index].width/2
                // User2026-11-06: cumulative title curvature +15percent, then +10percent.
                let titleArchScale:CGFloat=1.265
                let shift=(JimiV9NavigationHeader.dividerDrop(at:midX/width)-JimiV9NavigationHeader.dividerArchDepth)*titleArchScale
                let angle=atan(tan(JimiV9NavigationHeader.tangentAngle(at:midX,width:width))*titleArchScale)
                let carrier=CALayer();carrier.anchorPoint = .zero;carrier.position=CGPoint(x:localX+advances[index].width/2,y:baseline-positions[index].y+shift)
                carrier.transform=CATransform3DMakeRotation(angle,0,0,1)
                let shape=CAShapeLayer();shape.anchorPoint = .zero
                var mapping=CGAffineTransform(a:1,b:0,c:0,d:-1,tx:-advances[index].width/2,ty:0)
                shape.path=CTFontCreatePathForGlyph(runFont,glyphs[index],&mapping)
                if let color=ink as? UIColor {shape.fillColor=color.cgColor}
                else if let ink,CFGetTypeID(ink as CFTypeRef)==CGColor.typeID {shape.fillColor=(ink as! CGColor)}
                else {shape.fillColor=(textColor ?? .black).cgColor}
                shape.contentsScale=window?.screen.scale ?? traitCollection.displayScale
                carrier.addSublayer(shape);layer.addSublayer(carrier);glyphLayers.append(carrier)
            }
        }
        CATransaction.commit()
    }
    func configureEntryIcons(_ icons:[UIView]){leftEntryIcon=icons.first;rightEntryIcon=icons.count>1 ? icons.last:nil}
    func startNavigationEntry(at epoch:CFTimeInterval,reducedMotion:Bool=UIAccessibility.isReduceMotionEnabled){animateNavigationContent(at:epoch,entering:true,reducedMotion:reducedMotion)}
    func startNavigationExit(at epoch:CFTimeInterval,reducedMotion:Bool=UIAccessibility.isReduceMotionEnabled){animateNavigationContent(at:epoch,entering:false,reducedMotion:reducedMotion)}
    private func animateNavigationContent(at epoch:CFTimeInterval,entering:Bool,reducedMotion:Bool) {
        let targets:[UIView?]=[self,leftEntryIcon,rightEntryIcon]
        let painted=targets.map{target -> (CATransform3D,Float) in
            guard let target else{return (CATransform3DIdentity,1)}
            return (target.layer.presentation()?.transform ?? target.layer.transform,target.layer.presentation()?.opacity ?? target.layer.opacity)
        }
        cancelNavigationEntry();layoutIfNeeded();prepareGlyphs()
        guard window != nil else{return}
        if reducedMotion {
            for (index,item) in targets.enumerated() {
                guard let target=item else{continue}
                let source=CAAnimationGroup();source.fillMode=entering ? .backwards:.both;source.isRemovedOnCompletion=entering
                let animation=Self.reducedNavigationGroup(source,entering:entering,rest:target.layer.transform,initialOpacity:painted[index].1)
                animation.beginTime=target.layer.convertTime(epoch,from:layer)
                target.layer.add(animation,forKey:Self.entryKey)
            }
            return
        }
        let sampled=JimiV9Motion.sampledTrack(JimiV9Motion.worldHubElementEnter())
        let poses=entering ? sampled.poses:Array(sampled.poses.reversed())
        for (index,item) in targets.enumerated() {
            guard let target=item else{continue}
            let base=entering ? target.layer.transform:painted[index].0
            let motion=CAKeyframeAnimation(keyPath:"transform"),opacity=CAKeyframeAnimation(keyPath:"opacity")
            motion.values=poses.map { pose in
                // Only the title's settling overshoot grows20percent; start size stays.
                let sx=index == 0 && pose.scaleX>1 ? 1+(pose.scaleX-1)*1.2:pose.scaleX
                let sy=index == 0 && pose.scaleY>1 ? 1+(pose.scaleY-1)*1.2:pose.scaleY
                let local=CATransform3DScale(CATransform3DMakeTranslation(pose.x,pose.y,0),sx,sy,1)
                return NSValue(caTransform3D:CATransform3DConcat(base,local))
            }
            opacity.values=poses.map { pose in
                NSNumber(value:max(0,min(1,pose.opacity))*Double(entering ? target.layer.opacity:painted[index].1))
            }
            for track in [motion,opacity] {track.duration=sampled.duration/Self.navigationSpeed;track.keyTimes=sampled.keyTimes?.map{NSNumber(value:$0)}}
            let animation=CAAnimationGroup();animation.animations=[motion,opacity];animation.duration=sampled.duration/Self.navigationSpeed
            animation.beginTime=target.layer.convertTime(epoch+Self.contentDelay(index:index,entering:entering),from:layer);animation.fillMode=entering ? .backwards:.both
            animation.isRemovedOnCompletion=entering;target.layer.add(animation,forKey:Self.entryKey)
        }
    }
    func cancelNavigationEntry(){
        for target in [self,leftEntryIcon,rightEntryIcon].compactMap({$0}) {target.layer.removeAnimation(forKey:Self.entryKey)}
    }
    override func didMoveToWindow(){super.didMoveToWindow();if window==nil{cancelNavigationEntry()}}
    override var isHidden:Bool {didSet{if isHidden{cancelNavigationEntry()}}}
}

/// The parent route remains the only lifecycle owner. Mirror its finite group
/// onto decoration and remove it on the exact same cancellation/replacement key.
final class JimiV9NavigationRouteLayer:CALayer {
    weak var decorationLayer:CALayer?
    weak var navigationTitle:JimiV9ArchedNavigationTitle?
    var continuousBackground=false
    var fadeBackgroundDuringHandoff=false
    var immediateBackgroundExit=false
    /// Global monotonic deadline, consumed once by the incoming route group.
    var entryNotBefore:CFTimeInterval?
    private var exitEnd:CFTimeInterval?
    var hasUnfinishedExit:Bool {exitEnd.map {convertTime(CACurrentMediaTime(),from:nil)<$0} ?? false}
    override func add(_ original:CAAnimation,forKey key:String?) {
        let reducedMotion=MainActor.assumeIsolated {UIAccessibility.isReduceMotionEnabled}
        installNavigation(original,forKey:key,reducedMotion:reducedMotion)
    }
    /// The same installation boundary serves each route's explicit motion policy.
    func installNavigation(_ original:CAAnimation,forKey key:String?,reducedMotion:Bool) {
        let prepared=MainActor.assumeIsolated {prepareNavigation(original,reducedMotion:reducedMotion)}
        if prepared.entering == false {immediateBackgroundExit=false}
        decorationLayer?.removeAllAnimations()
        if let decoration=prepared.decoration,let decorationLayer {
            decorationLayer.add(decoration,forKey:key)
        }else if let group=original as? CAAnimationGroup,
                 let fade=group.value(forKey:"nativeNavigationDecorationFade") as? CABasicAnimation,
                 let decorationLayer {
            // Retain the existing reduced-motion fallback.
            let child=group.copy() as! CAAnimationGroup;child.animations=[fade]
            if group.beginTime != 0 {child.beginTime=decorationLayer.convertTime(group.beginTime,from:self)}
            decorationLayer.add(child,forKey:key)
        }
        exitEnd=prepared.entering == false ? prepared.parent.beginTime+prepared.parent.duration:nil
        super.add(prepared.parent,forKey:key)
        if let entering=prepared.entering {
            let epoch=prepared.parent.beginTime
            MainActor.assumeIsolated {
                if let navigationTitle {
                    let titleEpoch=navigationTitle.layer.convertTime(epoch,from:self)
                    if entering {navigationTitle.startNavigationEntry(at:titleEpoch,reducedMotion:reducedMotion)}
                    else {navigationTitle.startNavigationExit(at:titleEpoch,reducedMotion:reducedMotion)}
                }
            }
        }
    }
    /// Background and content borrow the existing route clock independently.
    /// The root stays still, so its transform cannot cancel the title's rise or
    /// collapse every child together. These groups never gate screen admission.
    @MainActor private func prepareNavigation(_ original:CAAnimation,reducedMotion:Bool)->(parent:CAAnimation,decoration:CAAnimationGroup?,entering:Bool?) {
        guard let group=original as? CAAnimationGroup,
              let track=group.animations?.compactMap({$0 as? CAKeyframeAnimation}).first(where:{$0.keyPath=="transform"}),
              let values=track.values as? [NSValue],values.count>1,
              let first=values.first?.caTransform3DValue,let last=values.last?.caTransform3DValue,
              abs(hypot(last.m11,last.m12)-hypot(first.m11,first.m12))>0.00001 else{return(original,nil,nil)}
        let entering=hypot(last.m11,last.m12)>hypot(first.m11,first.m12)
        // Navigation owns its handoff epoch independently of screen content.
        // A shorter outgoing collection must not advance the next title.
        let now=convertTime(CACurrentMediaTime(),from:nil)
        let requested=entering ? entryNotBefore:nil
        if entering {entryNotBefore=nil}
        let epoch=entering && !reducedMotion ? max(now,requested.map{convertTime($0,from:nil)} ?? now):now
        if reducedMotion {
            let duration=JimiV9ArchedNavigationTitle.reducedDuration(entering:entering)
            let rest=entering ? last:first
            let parent=group.copy() as! CAAnimationGroup
            parent.beginTime=epoch;parent.duration=duration
            let hold=CAKeyframeAnimation(keyPath:"transform")
            hold.values=[NSValue(caTransform3D:rest),NSValue(caTransform3D:rest)];hold.duration=duration
            let alpha=CAKeyframeAnimation(keyPath:"opacity");alpha.values=[1,1];alpha.duration=duration
            parent.animations=[hold,alpha]
            transform=rest;opacity=1
            guard let decorationLayer else{return(parent,nil,entering)}
            let paintedAlpha=decorationLayer.presentation()?.opacity ?? decorationLayer.opacity
            let settled=CATransform3DMakeScale(1.025,1.025,1)
            decorationLayer.transform=settled;decorationLayer.opacity=1
            let decoration=JimiV9ArchedNavigationTitle.reducedNavigationGroup(group,entering:entering,rest:settled,initialOpacity:paintedAlpha)
            if continuousBackground && !fadeBackgroundDuringHandoff {
                let opacity=decoration.animations?.compactMap{$0 as? CAKeyframeAnimation}.first{$0.keyPath=="opacity"}
                opacity?.values=[1,1]
            }
            decoration.beginTime=decorationLayer.convertTime(epoch,from:self);decoration.duration=duration
            decoration.fillMode = .both;decoration.isRemovedOnCompletion=entering
            return(parent,decoration,entering)
        }
        let duration=JimiV9ArchedNavigationTitle.visualDuration(entering:entering)
        let parent=group.copy() as! CAAnimationGroup
        parent.duration=duration
        parent.beginTime=epoch
        let rest=entering ? last:first
        let hold=CAKeyframeAnimation(keyPath:"transform");hold.values=[NSValue(caTransform3D:rest),NSValue(caTransform3D:rest)];hold.duration=duration
        let sourceOpacity=group.animations?.compactMap({$0 as? CAKeyframeAnimation}).first(where:{$0.keyPath=="opacity"})
        let restAlpha=(entering ? sourceOpacity?.values?.last:sourceOpacity?.values?.first) as? NSNumber ?? NSNumber(value:1)
        let alpha=CAKeyframeAnimation(keyPath:"opacity");alpha.values=[restAlpha,restAlpha];alpha.duration=duration
        parent.animations=[hold,alpha]
        // Stable model geometry prevents layout/anchor restoration from snapping
        // a still-visible header to the route track's collapsed endpoint.
        transform=rest;opacity=restAlpha.floatValue
        guard let decorationLayer else{return(parent,nil,entering)}
        let painted=decorationLayer.presentation()
        let base=entering ? CATransform3DIdentity:(painted?.transform ?? decorationLayer.transform)
        let baseAlpha=entering ? decorationLayer.opacity:(painted?.opacity ?? decorationLayer.opacity)
        let growth:CGFloat=0.025 // Same rest geometry across full and soft profiles.
        let baseScale=max(0.001,hypot(base.m11,base.m12))
        // Background always covers the full width; only a small scale-UP is allowed.
        decorationLayer.transform=CATransform3DMakeScale(1+growth,1+growth,1)
        decorationLayer.opacity=1
        let transform=CAKeyframeAnimation(keyPath:"transform"),opacity=CAKeyframeAnimation(keyPath:"opacity")
        var transforms:[NSValue]=[],alphas:[NSNumber]=[]
        for index in 0...80 {
            let t=Double(index)/80
            // Keep reversed spring progress; the outgoing fade profile leaves downward.
            let p=entering ? t:1-t,e=JimiV9Motion.Ease.backOut(1.7).value(p)
            // Incoming internal navigation grows12percent then returns. Keep
            // outgoing decoration settled: content can hand off mid-track.
            let settledScale=entering ? 1+growth:baseScale
            let pulse=entering ? CGFloat(pow(sin(.pi*t),2))*settledScale*0.12:0
            let absoluteScale=continuousBackground ? settledScale+pulse:max(1,entering ? 1+growth*CGFloat(e):1+(baseScale-1)*CGFloat(e))
            let scale=entering ? absoluteScale:absoluteScale/baseScale
            let bouncesOut=fadeBackgroundDuringHandoff && !entering
            let y=continuousBackground && !bouncesOut ? 0:CGFloat((bouncesOut ? 14.4*0.7:-14.4)*(1-e))
            let local=CATransform3DScale(CATransform3DMakeTranslation(0,y,0),scale,scale,1)
            transforms.append(NSValue(caTransform3D:CATransform3DConcat(base,local)))
            alphas.append(NSNumber(value:(continuousBackground && !bouncesOut ? 1:max(0,min(1,e)))*Double(baseAlpha)))
        }
        transform.values=transforms;opacity.values=alphas
        for motion in [transform,opacity] {
            motion.duration=JimiV9ArchedNavigationTitle.elementDuration
            motion.beginTime=entering || immediateBackgroundExit ? 0:JimiV9ArchedNavigationTitle.backgroundExitDelay
            motion.fillMode = .both;motion.isRemovedOnCompletion=false
        }
        if fadeBackgroundDuringHandoff && !entering {
            // Paper/divider leaves halfway between the first and second icons.
            // Keep the existing downward spring/fade and finite route owner.
            let betweenIcons=JimiV9ArchedNavigationTitle.elementStagger*0.5
            transform.beginTime=betweenIcons;opacity.beginTime=betweenIcons
        }
        if fadeBackgroundDuringHandoff && entering {
            // Borrow the same route epoch and lifecycle. The surface stays
            // clear through preparation and the title handoff, then returns
            // with the first incoming navigation element.
            opacity.values=[0,baseAlpha]
            opacity.keyTimes=[0,1]
            opacity.duration=0.12
            opacity.beginTime=entering ? JimiV9ArchedNavigationTitle.contentDelay(index:0,entering:true):0
            opacity.timingFunction=CAMediaTimingFunction(name:.easeOut)
        }
        let decoration=CAAnimationGroup();decoration.animations=[transform,opacity]
        decoration.duration=duration;decoration.fillMode = .both;decoration.isRemovedOnCompletion=entering
        decoration.beginTime=decorationLayer.convertTime(parent.beginTime,from:self)
        return(parent,decoration,entering)
    }
    override func removeAnimation(forKey key:String) {
        decorationLayer?.removeAnimation(forKey:key)
        // Normal header completion must not truncate the longer finite letter tail.
        if let animation=animation(forKey:key),convertTime(CACurrentMediaTime(),from:nil)<animation.beginTime+animation.duration {
            MainActor.assumeIsolated{navigationTitle?.cancelNavigationEntry()}
        }
        super.removeAnimation(forKey:key)
    }
    override func removeAllAnimations() {
        exitEnd=nil;entryNotBefore=nil
        decorationLayer?.removeAllAnimations();MainActor.assumeIsolated{navigationTitle?.cancelNavigationEntry()};super.removeAllAnimations()
    }
}

/// Populated static painted properties shared by both finite navigation copies.
/// Subtree selection, animations and lifetime remain with each existing owner.
@MainActor private enum JimiV9NavigationLayerCopy {
    static func painted(_ source:CALayer)->CALayer {
        let visual=source.presentation() ?? source
        // init(layer:) is Core Animation's presentation-copy initializer;
        // it does not produce a populated standalone static layer tree.
        // Copy the painted properties explicitly while sharing image/path
        // references, so the readiness bridge has real geometry/content.
        let result:CALayer
        if visual is CAShapeLayer {result=CAShapeLayer()}
        else if visual is CAGradientLayer {result=CAGradientLayer()}
        else if visual is CATextLayer {result=CATextLayer()}
        else if visual is CATransformLayer {result=CATransformLayer()}
        else {result=CALayer()}
        result.name=source.name
        result.bounds=visual.bounds;result.position=visual.position
        result.anchorPoint=visual.anchorPoint;result.anchorPointZ=visual.anchorPointZ
        result.zPosition=visual.zPosition;result.transform=visual.transform
        result.sublayerTransform=visual.sublayerTransform
        result.opacity=visual.opacity;result.isHidden=visual.isHidden
        result.contents=visual.contents;result.contentsScale=visual.contentsScale
        result.contentsFormat=visual.contentsFormat;result.isOpaque=visual.isOpaque
        result.contentsRect=visual.contentsRect;result.contentsCenter=visual.contentsCenter
        result.contentsGravity=visual.contentsGravity
        result.minificationFilter=visual.minificationFilter;result.magnificationFilter=visual.magnificationFilter
        result.isGeometryFlipped=visual.isGeometryFlipped
        result.masksToBounds=visual.masksToBounds;result.isDoubleSided=visual.isDoubleSided
        result.backgroundColor=visual.backgroundColor;result.cornerRadius=visual.cornerRadius
        result.maskedCorners=visual.maskedCorners;result.cornerCurve=visual.cornerCurve
        result.borderWidth=visual.borderWidth;result.borderColor=visual.borderColor
        result.shadowColor=visual.shadowColor;result.shadowOpacity=visual.shadowOpacity
        result.shadowOffset=visual.shadowOffset;result.shadowRadius=visual.shadowRadius
        result.shadowPath=visual.shadowPath
        result.allowsGroupOpacity=visual.allowsGroupOpacity
        result.allowsEdgeAntialiasing=visual.allowsEdgeAntialiasing;result.edgeAntialiasingMask=visual.edgeAntialiasingMask
        if let shape=visual as? CAShapeLayer,let target=result as? CAShapeLayer {
            target.path=shape.path;target.fillColor=shape.fillColor;target.fillRule=shape.fillRule
            target.strokeColor=shape.strokeColor;target.strokeStart=shape.strokeStart;target.strokeEnd=shape.strokeEnd
            target.lineWidth=shape.lineWidth;target.lineCap=shape.lineCap;target.lineJoin=shape.lineJoin
            target.miterLimit=shape.miterLimit;target.lineDashPhase=shape.lineDashPhase;target.lineDashPattern=shape.lineDashPattern
        }
        if let gradient=visual as? CAGradientLayer,let target=result as? CAGradientLayer {
            target.colors=gradient.colors;target.locations=gradient.locations
            target.startPoint=gradient.startPoint;target.endPoint=gradient.endPoint;target.type=gradient.type
        }
        if let text=visual as? CATextLayer,let target=result as? CATextLayer {
            target.string=text.string;target.font=text.font;target.fontSize=text.fontSize
            target.foregroundColor=text.foregroundColor;target.isWrapped=text.isWrapped
            target.alignmentMode=text.alignmentMode;target.truncationMode=text.truncationMode
            target.allowsFontSubpixelQuantization=text.allowsFontSubpixelQuantization
        }
        result.delegate=nil;result.actions=[:]
        result.speed=1;result.timeOffset=0;result.beginTime=0
        return result
    }
}

/// At most one finite, noninteractive visual continuation in the app host.
/// Copies painted layers and the remaining authored navigation tracks, sharing
/// original CGImage/path contents; no new assets, timer, raster pass or callbacks.
@MainActor final class JimiV9NavigationExitContinuation {
    private var root:CALayer?
    init?(header:JimiV9NavigationHeader,host:CALayer,includeBackground:Bool) {
        guard let source=header.layer as? JimiV9NavigationRouteLayer,source.hasUnfinishedExit else{return nil}
        var tracks:[(CALayer,CAAnimation,String)]=[]
        let keys:Set<String>=["native-route","world.enter","world.exit","native.navigation.content.enter"]
        func copyTree(_ layer:CALayer)->CALayer {
            let result=JimiV9NavigationLayerCopy.painted(layer)
            result.speed=layer.speed;result.timeOffset=layer.timeOffset;result.beginTime=layer.beginTime
            for child in layer.sublayers ?? [] where includeBackground || child.name != "navigationDecoration" {result.addSublayer(copyTree(child))}
            if let mask=layer.mask {result.mask=copyTree(mask)}
            for key in layer.animationKeys() ?? [] where keys.contains(key) {
                if let animation=layer.animation(forKey:key)?.copy() as? CAAnimation {
                    animation.delegate=nil;tracks.append((result,animation,key))
                }
            }
            return result
        }
        let copied=copyTree(source);root=copied
        copied.name="native.navigation.exit-continuation";copied.zPosition=1000
        copied.position=host.convert(source.position,from:source.superlayer)
        let now=CACurrentMediaTime(),local=source.convertTime(now,from:nil)
        CATransaction.begin();CATransaction.setDisableActions(true)
        CATransaction.setCompletionBlock {[weak self] in self?.dispose()}
        host.addSublayer(copied)
        if copied.speed != 0 {copied.beginTime=host.convertTime(now,from:nil)-(local-copied.timeOffset)/Double(copied.speed)}
        for (layer,animation,key) in tracks {layer.add(animation,forKey:key)}
        CATransaction.commit()
    }
    func pause() {
        guard let root,root.speed != 0 else{return}
        let time=root.convertTime(CACurrentMediaTime(),from:nil);root.speed=0;root.timeOffset=time
    }
    func resume() {
        guard let root,root.speed==0 else{return}
        let time=root.timeOffset;root.speed=1;root.timeOffset=0;root.beginTime=0
        root.beginTime=root.convertTime(CACurrentMediaTime(),from:nil)-time
    }
    func dispose(){
        func clear(_ layer:CALayer){layer.sublayers?.forEach(clear);if let mask=layer.mask {clear(mask)};layer.removeAllAnimations()}
        if let root {clear(root);root.removeFromSuperlayer()};root=nil
    }
}

/// Shared arched navigation surface; its existing parent owns all motion.
@MainActor
final class JimiV9NavigationHeader: UIView {
    var fadeBackgroundDuringHandoff:Bool {
        get {(layer as? JimiV9NavigationRouteLayer)?.fadeBackgroundDuringHandoff ?? false}
        set {(layer as? JimiV9NavigationRouteLayer)?.fadeBackgroundDuringHandoff=newValue}
    }
    var entryNotBefore:CFTimeInterval? {
        get {(layer as? JimiV9NavigationRouteLayer)?.entryNotBefore}
        set {(layer as? JimiV9NavigationRouteLayer)?.entryNotBefore=newValue}
    }
    var continuousBackground:Bool {
        get {(layer as? JimiV9NavigationRouteLayer)?.continuousBackground ?? false}
        set {(layer as? JimiV9NavigationRouteLayer)?.continuousBackground=newValue}
    }
    var immediateBackgroundExit:Bool {
        get {(layer as? JimiV9NavigationRouteLayer)?.immediateBackgroundExit ?? false}
        set {(layer as? JimiV9NavigationRouteLayer)?.immediateBackgroundExit=newValue}
    }
    // Reversible visual trial: false restores the original navigation shadow.
    override class var layerClass:AnyClass {JimiV9NavigationRouteLayer.self}
    static let usesHomeDividerTrial=true
    private let homeDivider=UIImageView()
    /// Static bridge across asynchronous internal-route preparation. Original
    /// image/path references only; no animation, rasterization or extra clock.
    func retainNavigationBackground(in host:CALayer)->CALayer {
        func copy(_ source:CALayer)->CALayer {
            let result=JimiV9NavigationLayerCopy.painted(source)
            for child in source.sublayers ?? [] {result.addSublayer(copy(child))}
            if let mask=source.mask {result.mask=copy(mask)}
            return result
        }
        let bridge=copy(navigationDecoration.layer)
        bridge.name="native.navigation.background-handoff";bridge.zPosition=900
        bridge.position=host.convert(navigationDecoration.layer.position,from:layer)
        host.addSublayer(bridge)
        return bridge
    }
    private let navigationDecoration=UIView()
    private let navigationSurface=CAShapeLayer()
    private let navigationSurfaceMask=CAShapeLayer()
    private var surfaceColor:UIColor?
    override var backgroundColor:UIColor? {
        get {surfaceColor ?? super.backgroundColor}
        set {
            surfaceColor=newValue
            super.backgroundColor=Self.usesHomeDividerTrial ? .clear:newValue
            CATransaction.begin();CATransaction.setDisableActions(true)
            navigationSurface.fillColor=navigationSurface.contents == nil ? newValue?.cgColor:UIColor.clear.cgColor;CATransaction.commit()
        }
    }
    private var dividerSource:UIImage?
    private var dividerWidth:CGFloat = -1
    private var dividerDensity:CGFloat=0
    static let dividerBandHeight:CGFloat=49
    static let dividerArchDepth:CGFloat=dividerBandHeight*0.288
    static func dividerDrop(at fraction:CGFloat)->CGFloat {
        let x=max(0,min(1,fraction))
        return 4*dividerArchDepth*x*(1-x)
    }
    static func tangentAngle(at x:CGFloat,width:CGFloat,bottom:Bool=false)->CGFloat {
        guard width>0 else{return 0}
        let fraction=max(0,min(1,x/width))
        let slope=4*dividerArchDepth*(1-2*fraction)/width
        return atan(bottom ? -slope:slope)
    }
    override func point(inside point:CGPoint,with event:UIEvent?)->Bool {
        if super.point(inside:point,with:event) {return true}
        // The content-only downward offset may extend a control below the
        // decorative header bounds. Retain its entire existing hit rectangle.
        return subviews.contains { child in
            child.isUserInteractionEnabled && !child.isHidden && child.alpha>0.01 &&
                child.point(inside:convert(point,to:child),with:event)
        }
    }
    func applyCurve(to title:UILabel,icons:[UIView]) {
        (layer as? JimiV9NavigationRouteLayer)?.navigationTitle=title as? JimiV9ArchedNavigationTitle
        (title as? JimiV9ArchedNavigationTitle)?.configureEntryIcons(icons)
        title.setNeedsDisplay();title.setNeedsLayout()
        CATransaction.begin();CATransaction.setDisableActions(true)
        for icon in icons {
            let x=icon.center.x
            let shift=Self.dividerDrop(at:x/max(1,bounds.width))-Self.dividerArchDepth
            // Read the inner arc beside the artwork, toward the title; the
            // outer screen corner is not its visual orientation reference.
            let inward:CGFloat=x<bounds.width/2 ? 1:-1
            let innerArcX=x+inward*icon.bounds.width/2
            let angle=Self.tangentAngle(at:innerArcX,width:bounds.width)*1.8
            icon.layer.sublayerTransform=CATransform3DRotate(CATransform3DMakeTranslation(0,shift,0),angle,0,0,1)
        }
        CATransaction.commit()
    }
    func setHomeDividerImage(_ image:UIImage?) {
        if dividerSource !== image {dividerSource=image;dividerWidth = -1;setNeedsLayout()}
        homeDivider.isHidden = !Self.usesHomeDividerTrial || image == nil
    }
    /// Scroll drives the existing surface directly, including restored offsets.
    /// No timer or queued fade can outlive the owning screen or lag a reversal.
    private var restingBackgroundOpacity:Float=0.5
    private var backgroundScrollDistance:CGFloat=0
    static func backgroundOpacity(resting:Float,scrollDistance:CGFloat)->Float {
        let progress=max(0,min(1,scrollDistance/80))
        return resting+(1-resting)*Float(progress*progress)
    }
    func updateBackgroundForScroll(_ scrollView:UIScrollView) {
        backgroundScrollDistance=max(0,scrollView.contentOffset.y+scrollView.adjustedContentInset.top)
        CATransaction.begin();CATransaction.setDisableActions(true)
        navigationSurface.opacity=Self.backgroundOpacity(resting:restingBackgroundOpacity,scrollDistance:backgroundScrollDistance)
        CATransaction.commit()
    }
    func setBackgroundImage(_ image:UIImage?,opacity:Float=0.5) {
        CATransaction.begin();CATransaction.setDisableActions(true)
        navigationSurface.contents=image?.cgImage
        restingBackgroundOpacity=max(0,min(1,opacity))
        navigationSurface.opacity=Self.backgroundOpacity(resting:restingBackgroundOpacity,scrollDistance:backgroundScrollDistance)
        navigationSurface.contentsScale=image?.scale ?? 1
        navigationSurface.contentsGravity = .resize
        navigationSurface.fillColor=image == nil ? surfaceColor?.cgColor:UIColor.clear.cgColor
        navigationSurface.mask=image == nil ? nil:navigationSurfaceMask
        CATransaction.commit()
        setNeedsLayout()
    }
    private func prepareDivider(width:CGFloat,density:CGFloat) {
        guard Self.usesHomeDividerTrial,let source=dividerSource,width>0 else {homeDivider.image=dividerSource;return}
        guard dividerWidth != width || dividerDensity != density else{return}
        let height=Self.dividerBandHeight+Self.dividerArchDepth
        let format=UIGraphicsImageRendererFormat();format.scale=density;format.opaque=false
        format.preferredRange = .standard
        // Static, pixel-aligned affine strips approximate the shallow curve
        // within0.01pt. Reuse the source pixels; rasterize once per size/density.
        let renderer=UIGraphicsImageRenderer(size:CGSize(width:width,height:height),format:format)
        homeDivider.image=renderer.image { render in
            let context=render.cgContext;context.interpolationQuality = .high
            for slice in 0..<32 {
                let x0=(width*density*CGFloat(slice)/32).rounded()/density
                let x1=(width*density*CGFloat(slice+1)/32).rounded()/density
                guard x1>x0 else{continue}
                let y0=Self.dividerDrop(at:x0/width),y1=Self.dividerDrop(at:x1/width)
                let slope=(y1-y0)/(x1-x0)
                context.saveGState()
                context.clip(to:CGRect(x:x0,y:0,width:x1-x0,height:height))
                context.concatenate(CGAffineTransform(a:1,b:slope,c:0,d:1,tx:0,ty:y0-slope*x0))
                // Inset only divider artwork; retain the full-width background curve.
                source.draw(in:CGRect(x:width*0.1,y:0,width:width*0.8,height:Self.dividerBandHeight))
                context.restoreGState()
            }
        }
        dividerWidth=width;dividerDensity=density
    }
    /// Shared row keeps prior device geometry plus the latest8pt downward content offset.
    struct RowLayout {
        // LOCKED user2026-11-06: shared Hub/Settings/World navigation height.
        // Changes require an explicit user instruction; no per-screen override.
        static let contentHeight:CGFloat=66
        let top,width:CGFloat
        let tablet:Bool,sideInset:CGFloat
        var centerY:CGFloat {(tablet ? headerHeight()/2+4:top+26-(uncompressedHeaderHeight-headerHeight())/2)+8}
        var iconScale:CGFloat {tablet ? 1.4:1}
        var titleFontSize:CGFloat {28*iconScale}
        private var uncompressedHeaderHeight:CGFloat {top+Self.contentHeight+(tablet ? 32:0)}
        func headerHeight()->CGFloat {uncompressedHeaderHeight*0.8}
        func iconRect(_ rect:CGRect,inkCenterY:CGFloat=0.5)->CGRect {
            guard tablet else{return rect}
            return CGRect(x:rect.minX*iconScale,y:(rect.minY+(0.5-inkCenterY)*rect.height)*iconScale,width:rect.width*iconScale,height:rect.height*iconScale)
        }
        func iconInsets(_ insets:UIEdgeInsets,imageHeight:CGFloat=0,inkCenterY:CGFloat=0.5)->UIEdgeInsets {
            guard tablet else{return insets}
            let offset=(0.5-inkCenterY)*imageHeight
            return UIEdgeInsets(top:(insets.top+offset)*iconScale,left:insets.left*iconScale,bottom:(insets.bottom-offset)*iconScale,right:insets.right*iconScale)
        }
        var titleFrame:CGRect {
            let edge:CGFloat=tablet ? sideInset+60:72
            let height:CGFloat=32*iconScale
            return CGRect(x:edge,y:centerY-height/2,width:max(0,width-edge*2),height:height)
        }
        /// Align actual glyph ink, not Baloo's asymmetric ascent/descent box.
        /// Metrics are sampled only in the existing layout pass; no raster/cache.
        func titleFrame(for label:UILabel)->CGRect {
            var frame=titleFrame
            guard tablet,let font=label.font else{return frame}
            let text=label.attributedText ?? NSAttributedString(string:label.text ?? "",attributes:[.font:font])
            let line=CTLineCreateWithAttributedString(text)
            let ink=CTLineGetBoundsWithOptions(line,.useGlyphPathBounds)
            guard !ink.isEmpty else{return frame}
            frame.origin.x += CGFloat(CTLineGetTypographicBounds(line,nil,nil,nil))/2-ink.midX
            frame.origin.y += ink.midY-(font.ascender+font.descender-font.leading)/2
            return frame
        }
        init(bounds:CGRect,safeAreaTop:CGFloat) {
            width=bounds.width;top=max(0,safeAreaTop+bounds.height*0.02-16)
            tablet=NativeTabletLayout.applies(bounds.size)
            sideInset=NativeTabletLayout.navigationSideInset(bounds.size)
        }
        /// Insets refer to the original icon's painted edge inside its hit area.
        /// Phone callers retain their exact authored x; tablet icons share the
        /// Settings content edges without reducing their existing hit targets.
        func buttonFrame(x:CGFloat,width:CGFloat=44,height:CGFloat=44,visibleInset:CGFloat=0)->CGRect {
            let paintedWidth=width*iconScale,paintedHeight=height*iconScale,inset=visibleInset*iconScale
            let alignedX=tablet ? (x<self.width/2 ? sideInset-inset:self.width-sideInset-paintedWidth+inset):x
            return CGRect(x:alignedX,y:centerY-paintedHeight/2,width:paintedWidth,height:paintedHeight)
        }
    }
    override init(frame:CGRect) {
        super.init(frame:frame)
        clipsToBounds=false;isOpaque=false
        navigationSurface.name="native.navigation.arched-surface"
        navigationSurface.fillColor=surfaceColor?.cgColor
        navigationSurface.isHidden = !Self.usesHomeDividerTrial
        navigationDecoration.isUserInteractionEnabled=false
        navigationDecoration.layer.name="navigationDecoration"
        (layer as? JimiV9NavigationRouteLayer)?.decorationLayer=navigationDecoration.layer
        addSubview(navigationDecoration)
        navigationDecoration.layer.addSublayer(navigationSurface)
        layer.shadowColor=UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        layer.shadowOpacity=Self.usesHomeDividerTrial ? 0:0.16
        homeDivider.alpha=0.55;homeDivider.contentMode = .scaleToFill
        homeDivider.isUserInteractionEnabled=false
        homeDivider.accessibilityIdentifier="native.navigation.home-divider"
        navigationDecoration.addSubview(homeDivider)
        layer.shadowRadius=6
        layer.shadowOffset=CGSize(width:0,height:4)
    }
    required init?(coder:NSCoder) {fatalError("Use frame initializer")}
    /// The route group owns this fade, including pause, cancellation and replay.
    /// Shadow starts fading200ms into the rectangle’s authored bounce.
    func appendExitShadowFade(to group:CAAnimationGroup,track:JimiV9Motion.Track) {
        // Normal motion is authored by the independent navigation recipe;
        // retain this fade only for the reduced-motion/legacy fallback.
        guard track.tweens.last?.to.opacity == 0 else{return}
        if Self.usesHomeDividerTrial {
            let carrier=CAAnimationGroup();carrier.duration=group.duration
            Self.appendDecorationFade(to:carrier,keyPath:"opacity",
                from:navigationDecoration.layer.presentation()?.opacity ?? 1,delay:track.tweens.first?.begin ?? 0)
            group.setValue(carrier.animations?.last,forKey:"nativeNavigationDecorationFade")
            return
        }
        let fade=CABasicAnimation(keyPath:"shadowOpacity")
        fade.fromValue=layer.presentation()?.shadowOpacity ?? layer.shadowOpacity
        fade.toValue=Float(0);fade.beginTime=min(0.2,max(0,group.duration-0.06))
        fade.duration=min(0.16,max(0,group.duration-fade.beginTime))
        fade.timingFunction=CAMediaTimingFunction(name:.easeOut)
        fade.fillMode = .both;fade.isRemovedOnCompletion=false
        group.animations=(group.animations ?? [])+[fade]
    }
    static func appendDecorationFade(to group:CAAnimationGroup,keyPath:String,from:Float,delay:Double) {
        let fade=CABasicAnimation(keyPath:keyPath)
        fade.fromValue=from;fade.toValue=Float(0)
        fade.beginTime=min(delay+0.2,max(0,group.duration-0.06))
        fade.duration=min(0.16,max(0,group.duration-fade.beginTime))
        fade.timingFunction=CAMediaTimingFunction(name:.easeOut)
        fade.fillMode = .both;fade.isRemovedOnCompletion=false
        group.animations=(group.animations ?? []).filter{($0 as? CAPropertyAnimation)?.keyPath != keyPath}+[fade]
    }
    override func layoutSubviews() {
        super.layoutSubviews()
        navigationDecoration.frame=CGRect(x:0,y:0,width:bounds.width,height:bounds.height+Self.dividerArchDepth)
        layer.shadowPath=Self.usesHomeDividerTrial ? nil:UIBezierPath(rect:bounds).cgPath
        // The same parabola defines the fill edge and the divider's top. Clear
        // UIView's rectangular paint so no straight seam remains above the arc.
        if Self.usesHomeDividerTrial {
            let surface=UIBezierPath();surface.move(to:.zero)
            surface.addLine(to:CGPoint(x:bounds.width,y:0))
            surface.addLine(to:CGPoint(x:bounds.width,y:bounds.height))
            surface.addQuadCurve(to:CGPoint(x:0,y:bounds.height),controlPoint:CGPoint(x:bounds.width/2,y:bounds.height+2*Self.dividerArchDepth))
            surface.close()
            CATransaction.begin();CATransaction.setDisableActions(true)
            navigationSurface.contentsScale=window?.screen.scale ?? UIScreen.main.scale
            navigationSurface.frame=CGRect(x:0,y:0,width:bounds.width,height:bounds.height+Self.dividerArchDepth)
            navigationSurface.path=surface.cgPath
            navigationSurfaceMask.frame=navigationSurface.bounds
            navigationSurfaceMask.path=surface.cgPath
            CATransaction.commit()
        }
        homeDivider.frame=CGRect(x:0,y:bounds.height,width:bounds.width,height:Self.dividerBandHeight+Self.dividerArchDepth)
        prepareDivider(width:bounds.width,density:window?.screen.scale ?? UIScreen.main.scale)
    }
}

/// Static Home footer decoration; the existing fixed-shadow route owns motion.
@MainActor
final class JimiV9BottomNavigationSurface:UIView {
    private let texture=CALayer(),textureMask=CAShapeLayer()
    private let divider=UIImageView()
    private let source:UIImage?
    private var renderedRect:CGRect = .null
    private var renderedSize:CGSize = .zero
    private var renderedDensity:CGFloat=0
    init(assets:JimiV9Artwork) {
        source=assets.image("assets/home-shadow.png")
        super.init(frame:.zero)
        isUserInteractionEnabled=false;accessibilityIdentifier="native.home.arched-navigation"
        texture.contents=assets.image("assets/nav/nav-bg.png",densityAware:true)?.cgImage
        texture.contentsGravity = .resize;texture.mask=textureMask;texture.opacity=0.5
        layer.addSublayer(texture)
        divider.alpha=0.55;divider.isUserInteractionEnabled=false;addSubview(divider)
    }
    required init?(coder:NSCoder){fatalError("Use assets initializer")}
    static func topEdge(at fraction:CGFloat)->CGFloat {
        JimiV9NavigationHeader.dividerArchDepth-JimiV9NavigationHeader.dividerDrop(at:fraction)
    }
    func configure(size:CGSize,dividerRect:CGRect) {
        bounds=CGRect(origin:.zero,size:size)
        let width=size.width,depth=JimiV9NavigationHeader.dividerArchDepth
        guard width>0 else{return}
        let path=UIBezierPath();path.move(to:CGPoint(x:0,y:depth))
        path.addQuadCurve(to:CGPoint(x:width,y:depth),controlPoint:CGPoint(x:width/2,y:-depth))
        path.addLine(to:CGPoint(x:width,y:size.height));path.addLine(to:CGPoint(x:0,y:size.height));path.close()
        CATransaction.begin();CATransaction.setDisableActions(true)
        texture.frame=bounds;textureMask.frame=bounds;textureMask.path=path.cgPath
        CATransaction.commit()
        let density=window?.screen.scale ?? UIScreen.main.scale
        guard renderedRect != dividerRect || renderedSize != size || renderedDensity != density else{return}
        renderedRect=dividerRect;renderedSize=size;renderedDensity=density
        divider.frame=CGRect(x:0,y:0,width:width,height:dividerRect.height+depth)
        guard let source else{return}
        let format=UIGraphicsImageRendererFormat();format.scale=density;format.opaque=false;format.preferredRange = .standard
        divider.image=UIGraphicsImageRenderer(size:divider.bounds.size,format:format).image {render in
            let context=render.cgContext;context.interpolationQuality = .high
            for slice in 0..<32 {
                let x0=(width*density*CGFloat(slice)/32).rounded()/density
                let x1=(width*density*CGFloat(slice+1)/32).rounded()/density
                guard x1>x0 else{continue}
                let y0=Self.topEdge(at:x0/width),y1=Self.topEdge(at:x1/width)
                let slope=(y1-y0)/(x1-x0)
                context.saveGState();context.clip(to:CGRect(x:x0,y:0,width:x1-x0,height:divider.bounds.height))
                context.concatenate(CGAffineTransform(a:1,b:slope,c:0,d:1,tx:0,ty:y0-slope*x0))
                source.draw(in:dividerRect.insetBy(dx:dividerRect.width*0.095,dy:0));context.restoreGState()
            }
        }
    }
}

/// Original, unmodified Web.bundle artwork. Lifetime and preparation belong to
/// the presenting controller; this instance is not a process-global cache.
@MainActor
final class JimiV9Artwork {
    let resourceRoot: URL
    private var images: [String: UIImage] = [:]
    private var resolvedImages:[String:UIImage]=[:]
    private var resolvedImagePaths:[String:String]=[:]
    private(set) var preparedBloobSplash:NativeBloobSplashScene?
    private(set) var preparedBloobReverse:NativeBloobReverseArt?
    private var materializedPaths:Set<String>=[]
    private var fontNames: [String: String] = [:]
    private var pendingImages:[String:[(UIImage?)->Void]]=[:]
    private var pendingImageTokens:[String:PreparationLifetime]=[:]
    private(set) var fontDescriptorReadCount=0
    private(set) var imageFileLoadCount=0
    private(set) var preparedImageCount=0
    private let preparationLifetime=PreparationLifetime()
    private let imagePreparationQueue:DispatchQueue
    private let prepareRaster:@Sendable(URL,[String])->NativeSelectedFinaleRaster?
    nonisolated private static let preparationQueue=DispatchQueue(label:"native.selected-finale-ui-raster",qos:.utility)
    nonisolated private final class PreparationLifetime:@unchecked Sendable {
        private let lock=NSLock();private var live=true
        var current:Bool {lock.lock();defer{lock.unlock()};return live}
        func retire(){lock.lock();live=false;lock.unlock()}
    }

    init(resourceRoot:URL,preparationQueue:DispatchQueue?=nil,
         prepareRaster:@escaping @Sendable(URL,[String])->NativeSelectedFinaleRaster? = {NativeSelectedFinaleRaster.decode(root:$0,candidates:$1)}) {
        self.resourceRoot=resourceRoot;imagePreparationQueue=preparationQueue ?? Self.preparationQueue
        self.prepareRaster=prepareRaster
    }

    func image(_ relativePath: String, densityAware: Bool = false,minimumDensity:Int=1) -> UIImage? {
        let requestKey=imageRequestKey(relativePath,densityAware:densityAware,minimumDensity:minimumDensity)
        if let cached=resolvedImages[requestKey] {return cached}
        let candidates=imageCandidates(relativePath,densityAware:densityAware,minimumDensity:minimumDensity)
        let url=resourceRoot.appendingPathComponent(relativePath)
        for (candidate, scale) in candidates {
            if let cached=images[candidate.path],let pixels=cached.cgImage {
                let image=cached.scale==scale ? cached:UIImage(cgImage:pixels,scale:scale,orientation:cached.imageOrientation)
                resolvedImages[requestKey]=image;resolvedImagePaths[requestKey]=candidate.path;return image
            }
            guard let loaded = UIImage(contentsOfFile: candidate.path), let cgImage = loaded.cgImage else { continue }
            let image = UIImage(cgImage: cgImage, scale: scale, orientation: loaded.imageOrientation)
            images[candidate.path] = image;resolvedImages[requestKey]=image;resolvedImagePaths[requestKey]=candidate.path;imageFileLoadCount += 1
            return image
        }
        NSLog("[JIMI_V9_ARTWORK] Missing image: %@", url.path)
        return nil
    }

    /// Same density resolution as display; selected preparation never invents
    /// a second bitmap cache or uploads UIKit-only artwork into SpriteKit.
    private func imageRequestKey(_ path:String,densityAware:Bool,minimumDensity:Int=1)->String {
        (densityAware ? "density\(min(3,max(minimumDensity,Int(UIScreen.main.scale.rounded(.up))))):":"exact:")+path
    }
    private func imageCandidates(_ relativePath:String,densityAware:Bool,minimumDensity:Int=1)->[(URL,CGFloat)] {
        let path = relativePath.hasPrefix("./") ? String(relativePath.dropFirst(2)) : relativePath
        let url = resourceRoot.appendingPathComponent(path)
        let density = min(3, max(1,minimumDensity,Int(UIScreen.main.scale.rounded(.up))))
        var candidates: [(URL, CGFloat)] = []
        if densityAware, density > 1 {
            for scale in stride(from: density, through: 2, by: -1) {
                let name = url.deletingPathExtension().lastPathComponent + "@\(scale)x." + url.pathExtension
                candidates.append((url.deletingLastPathComponent().appendingPathComponent(name), CGFloat(scale)))
            }
        }
        candidates.append((url, 1))
        return candidates
    }
    /// One serial resource queue materializes the selected original PNG pixels.
    /// UIImage construction/cache mutation remain MainActor. Duplicate callers
    /// share a pending request, and retirement cancels all queued publication.
    func prepareImage(_ path:String,densityAware:Bool,completion:@escaping(UIImage?)->Void) {
        guard preparationLifetime.current else{completion(nil);return}
        let key=imageRequestKey(path,densityAware:densityAware)
        // Only this exact request's resolved preferred density is reusable.
        // A lower-density cached candidate cannot skip a real higher file.
        if let image=resolvedImages[key],let resolvedPath=resolvedImagePaths[key],materializedPaths.contains(resolvedPath) {completion(image);return}
        let candidates=imageCandidates(path,densityAware:densityAware)
        if pendingImages[key] != nil {pendingImages[key]?.append(completion);return}
        let requestLifetime=PreparationLifetime()
        pendingImageTokens[key]=requestLifetime;pendingImages[key]=[completion]
        let root=resourceRoot,relative=candidates.map{$0.0.path.replacingOccurrences(of:root.path+"/",with:"")}
        let scales=candidates.map{$0.1},lifetime=preparationLifetime,decode=prepareRaster
        imagePreparationQueue.async { [weak self] in
            guard self != nil,lifetime.current,requestLifetime.current else{return}
            let raster=decode(root,relative)
            guard lifetime.current,requestLifetime.current else{return}
            DispatchQueue.main.async {
                guard let self,lifetime.current,requestLifetime.current,
                      self.pendingImageTokens[key] === requestLifetime,
                      let callbacks=self.pendingImages.removeValue(forKey:key) else{return}
                self.pendingImageTokens.removeValue(forKey:key)
                let image:UIImage?
                if let raster,let index=relative.firstIndex(of:raster.path) {
                    let absolute=root.appendingPathComponent(raster.path).path
                    let prepared=UIImage(cgImage:raster.image,scale:scales[index],orientation:.up)
                    // Exact @2x/@3x display uses scale1; density-aware
                    // display can share those pixels with scale2/3. Preserve
                    // each request's authored logical size when replacing an
                    // encoded alias with its materialized bitmap backing.
                    for alias in self.resolvedImagePaths.keys where self.resolvedImagePaths[alias]==absolute {
                        guard let existing=self.resolvedImages[alias] else{continue}
                        self.resolvedImages[alias]=UIImage(cgImage:raster.image,scale:existing.scale,orientation:existing.imageOrientation)
                    }
                    self.images[absolute]=prepared;self.resolvedImages[key]=prepared;self.resolvedImagePaths[key]=absolute;self.materializedPaths.insert(absolute)
                    if let reverse=raster.bloobReverse {self.preparedBloobReverse=reverse}
                    if let scene=raster.bloobSplash {self.preparedBloobSplash=scene}
                    self.preparedImageCount += 1;image=prepared
                } else {image=nil}
                for callback in callbacks {guard lifetime.current else{break};callback(image)}
            }
        }
    }
    func retainPreparedImages(_ requests:[(String,Bool)]) {
        if !requests.contains(where:{$0.0==NativeBloobReverseArt.path}) {preparedBloobReverse=nil}
        if !requests.contains(where:{$0.0==NativeBloobArt.splashPath}) {preparedBloobSplash=nil}
        let keys=Set(requests.map{imageRequestKey($0.0,densityAware:$0.1)})
        // Exact live/active families retain bitmap aliases. Dropped queued
        // requests cannot publish after their pending registry row retires.
        resolvedImages=resolvedImages.filter{keys.contains($0.key)}
        resolvedImagePaths=resolvedImagePaths.filter{keys.contains($0.key)}
        for (key,token) in pendingImageTokens where !keys.contains(key) {token.retire()}
        pendingImageTokens=pendingImageTokens.filter{keys.contains($0.key)}
        pendingImages=pendingImages.filter{keys.contains($0.key)}
        let retained=Set(resolvedImagePaths.values)
        images=images.filter{retained.contains($0.key)}
        materializedPaths.formIntersection(Set(images.keys))
    }
    func cancelPendingImagePreparation() {
        for token in pendingImageTokens.values {token.retire()}
        pendingImageTokens.removeAll();pendingImages.removeAll()
    }
    func retireImagePreparation() {
        preparedBloobSplash=nil;preparedBloobReverse=nil
        preparationLifetime.retire();let callbacks=pendingImages.values.flatMap{$0}
        cancelPendingImagePreparation()
        pendingImages.removeAll();images.removeAll();resolvedImages.removeAll();resolvedImagePaths.removeAll();materializedPaths.removeAll()
        callbacks.forEach{$0(nil)}
    }

    func font(size: CGFloat, weight: String = "Bold") -> UIFont {
        if let name = fontNames[weight], let font = UIFont(name: name, size: size) { return font }
        fontDescriptorReadCount+=1
        let url = resourceRoot.appendingPathComponent("assets/fonts/Baloo2-\(weight).ttf")
        if let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor],
           let descriptor = descriptors.first,
           let name = CTFontDescriptorCopyAttribute(descriptor, kCTFontNameAttribute) as? String {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            fontNames[weight] = name
            if let font = UIFont(name: name, size: size) { return font }
        }
        // Missing packaged font is observable; never silently claim parity.
        NSLog("[JIMI_V9_ARTWORK] Missing Baloo2 font: %@", url.path)
        return .systemFont(ofSize: size, weight: .bold)
    }
}
