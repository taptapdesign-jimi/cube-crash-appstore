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
                let shift=JimiV9NavigationHeader.dividerDrop(at:midX/width)-JimiV9NavigationHeader.dividerArchDepth
                let angle=JimiV9NavigationHeader.tangentAngle(at:midX,width:width)
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
    func startNavigationEntry(at epoch:CFTimeInterval){animateNavigationContent(at:epoch,entering:true)}
    func startNavigationExit(at epoch:CFTimeInterval){animateNavigationContent(at:epoch,entering:false)}
    private func animateNavigationContent(at epoch:CFTimeInterval,entering:Bool) {
        let stagger=entering ? 0.09:0.045
        let targets:[UIView?]=[self,leftEntryIcon,rightEntryIcon]
        let painted=targets.map{target -> (CATransform3D,Float) in
            guard let target else{return (CATransform3DIdentity,1)}
            return (target.layer.presentation()?.transform ?? target.layer.transform,target.layer.presentation()?.opacity ?? target.layer.opacity)
        }
        cancelNavigationEntry();layoutIfNeeded();prepareGlyphs()
        guard !UIAccessibility.isReduceMotionEnabled,window != nil else{return}
        let recipe=entering ? JimiV9Motion.worldHubElementEnter():JimiV9Motion.worldHubElementExit()
        let sampled=JimiV9Motion.sampledTrack(recipe)
        for (index,item) in targets.enumerated() {
            guard let target=item else{continue}
            let base=entering ? target.layer.transform:painted[index].0
            let motion=CAKeyframeAnimation(keyPath:"transform"),opacity=CAKeyframeAnimation(keyPath:"opacity")
            motion.values=sampled.poses.map { pose in
                let local=CATransform3DScale(CATransform3DMakeTranslation(pose.x,pose.y,0),pose.scaleX,pose.scaleY,1)
                return NSValue(caTransform3D:CATransform3DConcat(base,local))
            }
            opacity.values=sampled.poses.map { pose in
                NSNumber(value:entering ? max(0,min(1,pose.opacity))*Double(target.layer.opacity):max(0,min(1,Double(pose.scaleX)))*Double(painted[index].1))
            }
            for track in [motion,opacity] {track.duration=sampled.duration;track.keyTimes=sampled.keyTimes?.map{NSNumber(value:$0)}}
            let animation=CAAnimationGroup();animation.animations=[motion,opacity];animation.duration=sampled.duration
            animation.beginTime=target.layer.convertTime(epoch+Double(index)*stagger,from:layer);animation.fillMode=entering ? .backwards:.both
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
    override func add(_ original:CAAnimation,forKey key:String?) {
        let anim=MainActor.assumeIsolated {Self.springEntry(original)}
        decorationLayer?.removeAllAnimations()
        if let group=anim as? CAAnimationGroup,
           let fade=group.value(forKey:"nativeNavigationDecorationFade") as? CABasicAnimation,
           let decorationLayer {
            let child=group.copy() as! CAAnimationGroup
            child.animations=[fade]
            if group.beginTime != 0 {child.beginTime=decorationLayer.convertTime(group.beginTime,from:self)}
            decorationLayer.add(child,forKey:key)
        }
        super.add(anim,forKey:key)
        if let group=anim as? CAAnimationGroup,
           let track=group.animations?.compactMap({$0 as? CAKeyframeAnimation}).first(where:{$0.keyPath=="transform"}),
           let first=(track.values?.first as? NSValue)?.caTransform3DValue,
           let last=(track.values?.last as? NSValue)?.caTransform3DValue {
            MainActor.assumeIsolated {
                if hypot(last.m11,last.m12)>hypot(first.m11,first.m12) {
                    let epoch=group.beginTime==0 ? convertTime(CACurrentMediaTime(),from:nil):group.beginTime
                    let lead=(group.value(forKey:"nativeNavigationEntryLead") as? NSNumber)?.doubleValue ?? 0
                    if let navigationTitle {navigationTitle.startNavigationEntry(at:navigationTitle.layer.convertTime(epoch+lead,from:self))}
                }else{
                    let epoch=group.beginTime==0 ? convertTime(CACurrentMediaTime(),from:nil):group.beginTime
                    if let navigationTitle {navigationTitle.startNavigationExit(at:navigationTitle.layer.convertTime(epoch,from:self))}
                }
            }
        }
    }
    @MainActor private static func springEntry(_ animation:CAAnimation)->CAAnimation {
        guard !UIAccessibility.isReduceMotionEnabled,let group=animation as? CAAnimationGroup,
              let track=group.animations?.compactMap({$0 as? CAKeyframeAnimation}).first(where:{$0.keyPath=="transform"}),
              let values=track.values as? [NSValue],values.count>1,
              let first=values.first?.caTransform3DValue,let last=values.last?.caTransform3DValue else{return animation}
        if hypot(last.m11,last.m12)<hypot(first.m11,first.m12) {return exitWithContentTail(group)}
        guard hypot(last.m11,last.m12)>hypot(first.m11,first.m12) else{return animation}
        let lead=(group.value(forKey:"nativeNavigationEntryLead") as? NSNumber)?.doubleValue ?? 0
        let duration=(group.value(forKey:"nativeNavigationEntryDuration") as? NSNumber)?.doubleValue ?? group.duration
        let moved=track.copy() as! CAKeyframeAnimation
        moved.values=values.enumerated().map { index,value in
            var pose=value.caTransform3DValue
            let time=(track.keyTimes?[index].doubleValue ?? Double(index)/Double(values.count-1))*group.duration
            let progress=duration>0 ? (time-lead)/duration:1
            pose.m42=last.m42-24*CGFloat(1-JimiV9Motion.Ease.backOut(1.7).value(progress))
            return NSValue(caTransform3D:pose)
        }
        let revised=group.copy() as! CAAnimationGroup
        revised.animations=group.animations?.map { item in
            (item as? CAKeyframeAnimation)?.keyPath=="transform" ? moved:item
        }
        return revised
    }
    @MainActor private static func exitWithContentTail(_ group:CAAnimationGroup)->CAAnimationGroup {
        let oldDuration=max(0.001,group.duration)
        let lead=(group.value(forKey:"nativeNavigationEntryLead") as? NSNumber)?.doubleValue ?? 0
        let motionDuration=(group.value(forKey:"nativeNavigationEntryDuration") as? NSNumber)?.doubleValue ?? oldDuration
        let oldEnd=lead+motionDuration
        let extra=max(0.14,JimiV9Motion.worldHubElementExit().duration+0.09+0.02-oldEnd)
        let newEnd=oldEnd+extra,newDuration=max(oldDuration,newEnd)
        let revised=group.copy() as! CAAnimationGroup
        revised.duration=newDuration
        revised.animations=group.animations?.map { item in
            if let track=item as? CAKeyframeAnimation,let values=track.values,values.count>1 {
                let copy=track.copy() as! CAKeyframeAnimation
                var frames:[Any]=[values[0]],times:[NSNumber]=[0]
                for i in values.indices {
                    let time=(track.keyTimes?[i].doubleValue ?? Double(i)/Double(values.count-1))*oldDuration
                    let mapped=time<=oldEnd+0.000001 ? time+extra:newEnd+(time-oldEnd)*max(0,newDuration-newEnd)/max(0.001,oldDuration-oldEnd)
                    let fraction=min(1,mapped/newDuration)
                    // A consumed route hold must not leave duplicate terminal key times.
                    if abs(fraction-(times.last?.doubleValue ?? -1))<0.000001 {frames[frames.count-1]=values[i]}
                    else {frames.append(values[i]);times.append(NSNumber(value:fraction))}
                }
                copy.values=frames;copy.keyTimes=times
                copy.duration=newDuration;return copy
            }
            let copy=item.copy() as! CAAnimation;copy.beginTime+=extra;return copy
        }
        if let fade=group.value(forKey:"nativeNavigationDecorationFade") as? CABasicAnimation {
            let copy=fade.copy() as! CABasicAnimation;copy.beginTime+=extra
            revised.setValue(copy,forKey:"nativeNavigationDecorationFade")
        }
        return revised
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
        decorationLayer?.removeAllAnimations();MainActor.assumeIsolated{navigationTitle?.cancelNavigationEntry()};super.removeAllAnimations()
    }
}

/// Shared arched navigation surface; its existing parent owns all motion.
@MainActor
final class JimiV9NavigationHeader: UIView {
    // Reversible visual trial: false restores the original navigation shadow.
    override class var layerClass:AnyClass {JimiV9NavigationRouteLayer.self}
    static let usesHomeDividerTrial=true
    private let homeDivider=UIImageView()
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
    static let dividerArchDepth:CGFloat=dividerBandHeight*0.20
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
            let angle=Self.tangentAngle(at:x,width:bounds.width)
            icon.layer.sublayerTransform=CATransform3DRotate(CATransform3DMakeTranslation(0,shift,0),angle,0,0,1)
        }
        CATransaction.commit()
    }
    func setHomeDividerImage(_ image:UIImage?) {
        if dividerSource !== image {dividerSource=image;dividerWidth = -1;setNeedsLayout()}
        homeDivider.isHidden = !Self.usesHomeDividerTrial || image == nil
    }
    func setBackgroundImage(_ image:UIImage?,opacity:Float=1) {
        CATransaction.begin();CATransaction.setDisableActions(true)
        navigationSurface.contents=image?.cgImage
        navigationSurface.opacity=opacity
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
                source.draw(in:CGRect(x:0,y:0,width:width,height:Self.dividerBandHeight))
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
        // The route group may hold the settled header while other elements enter.
        // Content timing follows the header's actual motion, excluding that hold.
        let lead=track.tweens.first?.begin ?? 0
        group.setValue(NSNumber(value:lead),forKey:"nativeNavigationEntryLead")
        group.setValue(NSNumber(value:max(0,track.duration-lead)),forKey:"nativeNavigationEntryDuration")
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
                source.draw(in:dividerRect);context.restoreGState()
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
