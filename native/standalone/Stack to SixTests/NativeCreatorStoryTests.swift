import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeCreatorStoryTests:XCTestCase {
    override func setUpWithError() throws {
        #if !targetEnvironment(simulator)
        throw XCTSkip("Simulator only")
        #endif
        guard ["1018BE2D-491B-465F-8F75-3E5BEB38C22A","43A75086-0C64-464C-B71C-FDD01AF59C32"].contains(ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "") else {throw XCTSkip("Retained Native QA Simulators only")}
    }
    private func all(_ view:UIView)->[UIView] {[view]+view.subviews.flatMap(all)}
    private func wait(_ predicate:()->Bool)async throws {
        let limit=Date().addingTimeInterval(12)
        while !predicate(),Date()<limit {try await Task.sleep(for:.milliseconds(20))}
        XCTAssertTrue(predicate())
    }
    private func alphaCount(_ image:CGImage,in rect:CGRect)throws->Int {
        let crop=try XCTUnwrap(image.cropping(to:rect.integral))
        let context=try XCTUnwrap(CGContext(data:nil,width:crop.width,height:crop.height,bitsPerComponent:8,bytesPerRow:crop.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue))
        context.draw(crop,in:CGRect(x:0,y:0,width:crop.width,height:crop.height))
        let pixels=try XCTUnwrap(context.data).assumingMemoryBound(to:UInt8.self)
        return stride(from:3,to:crop.width*crop.height*4,by:4).reduce(0){$0+(pixels[$1]>0 ? 1:0)}
    }
    func testCreatorShimmerMasksHeartAndBothLabelsAndRetires()async throws {
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let settings=JimiNativeSettingsView(frame:CGRect(origin:.zero,size:size),assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
            let host=UIViewController(),window=UIWindow(frame:settings.bounds)
            window.rootViewController=host;host.view.addSubview(settings);window.makeKeyAndVisible()
            defer{settings.setCreatorShimmerActive(false);settings.removeFromSuperview();window.isHidden=true;window.rootViewController=nil}
            XCTAssertTrue(settings.apply(["presentationEpoch":10,"gameSoundsEnabled":true,"musicEnabled":true,"hapticsEnabled":true]))
            settings.layoutIfNeeded();settings.setCreatorShimmerActive(true)
            weak var retired:NativeCTAShimmer?
            do {
                let sheen=try XCTUnwrap(settings.creatorShimmer);retired=sheen
                XCTAssertTrue(sheen.running)
                let heart=try XCTUnwrap(all(settings.creator).first{$0.accessibilityIdentifier=="native.settings.creator.heart"})
                let motion=try XCTUnwrap(heart.layer.animation(forKey:JimiNativeSettingsView.creatorHeartIdleKey) as? CAKeyframeAnimation)
                XCTAssertEqual(motion.duration,3,accuracy:0.000001)
                let transforms=try XCTUnwrap(motion.values as? [NSValue]).map{$0.caTransform3DValue}
                let peakScale=transforms.map{sqrt($0.m11*$0.m22-$0.m12*$0.m21)}.max() ?? 0
                XCTAssertEqual(peakScale,1.2,accuracy:0.01)
                let maskHeart=try XCTUnwrap(settings.creatorShimmerMask.sublayers?.first)
                XCTAssertNotNil(maskHeart.animation(forKey:JimiNativeSettingsView.creatorHeartIdleKey))
                let format=UIGraphicsImageRendererFormat();format.scale=window.screen.scale
                let mask=try XCTUnwrap(UIGraphicsImageRenderer(size:settings.creator.bounds.size,format:format).image {context in
                    settings.creatorShimmerMask.render(in:context.cgContext)
                }.cgImage)
                let scale=window.screen.scale
                XCTAssertEqual(mask.width,Int(ceil(settings.creator.bounds.width*scale)))
                XCTAssertEqual(try alphaCount(mask,in:CGRect(x:0,y:0,width:5*scale,height:CGFloat(mask.height))),0,"No shine on empty background")
                for id in ["native.settings.creator.heart","native.settings.creator.brand","native.settings.creator.made"] {
                    let leaf=try XCTUnwrap(all(settings.creator).first{$0.accessibilityIdentifier==id})
                    XCTAssertGreaterThan(try alphaCount(mask,in:leaf.frame.applying(CGAffineTransform(scaleX:scale,y:scale))),0,id)
                }
                settings.setCreatorShimmerActive(false)
                XCTAssertFalse(sheen.running);XCTAssertNil(sheen.highlight.superlayer)
                XCTAssertNil(settings.creatorShimmerMask.contents)
                XCTAssertNil(heart.layer.animation(forKey:JimiNativeSettingsView.creatorHeartIdleKey))
                XCTAssertNil(maskHeart.animation(forKey:JimiNativeSettingsView.creatorHeartIdleKey))
            }
            try await wait{retired==nil}
            settings.setCreatorShimmerActive(true);XCTAssertTrue(settings.creatorShimmer?.running == true)
            settings.setIdleForeground(false);XCTAssertNil(settings.creatorShimmer)
            settings.setIdleForeground(true);XCTAssertTrue(settings.creatorShimmer?.running == true)
            settings.setDeveloperPanelVisible(true);XCTAssertNil(settings.creatorShimmer)
            settings.setDeveloperPanelVisible(false);XCTAssertTrue(settings.creatorShimmer?.running == true)
            settings.isHidden=true;XCTAssertNil(settings.creatorShimmer)
            settings.isHidden=false;settings.setCreatorShimmerActive(true)
            settings.removeFromSuperview();XCTAssertNil(settings.creatorShimmer)
        }
    }
    func testPrivacyBodyUsesSharedSubtitleStyleAfterDeviceLayout()throws {
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let privacy=JimiNativePrivacyController(assets:JimiV9Artwork(resourceRoot:NativeTestResources.root))
            let window=UIWindow(frame:CGRect(origin:.zero,size:size))
            window.rootViewController=privacy;window.makeKeyAndVisible()
            defer{privacy.viewDidDisappear(false);window.isHidden=true;window.rootViewController=nil}
            privacy.view.frame=window.bounds;privacy.view.setNeedsLayout();privacy.view.layoutIfNeeded()
            let text=try XCTUnwrap(privacy.copy.attributedText)
            let index=(text.string as NSString).range(of:"Stack to Six does").location
            let font=try XCTUnwrap(text.attribute(.font,at:index,effectiveRange:nil) as? UIFont)
            XCTAssertEqual(font.pointSize,18)
            XCTAssertEqual(font.fontName,JimiV9Artwork(resourceRoot:NativeTestResources.root).font(size:18,weight:"Medium").fontName)
            XCTAssertEqual(text.attribute(.foregroundColor,at:index,effectiveRange:nil) as? UIColor,NativeTextPalette.subtitle)
            let paragraph=try XCTUnwrap(text.attribute(.paragraphStyle,at:index,effectiveRange:nil) as? NSParagraphStyle)
            XCTAssertEqual(paragraph.minimumLineHeight,23.4,accuracy:0.001)
            XCTAssertEqual(paragraph.alignment,.left)
            let needed=privacy.copy.sizeThatFits(CGSize(width:privacy.copy.bounds.width,height:.greatestFiniteMagnitude)).height
            XCTAssertTrue(needed<=privacy.copy.bounds.height+0.5 || privacy.copy.isScrollEnabled)
        }
    }
    func testStoryKeepsReadableSideMarginsAndAllCopyReachable()throws {
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let modal=NativeCreatorStoryModal(assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),reducedMotion:true)
            let window=UIWindow(frame:CGRect(origin:.zero,size:size))
            window.rootViewController=modal;window.makeKeyAndVisible()
            defer{modal.dispose();window.isHidden=true;window.rootViewController=nil}
            modal.view.frame=window.bounds;modal.view.setNeedsLayout();modal.view.layoutIfNeeded()
            XCTAssertGreaterThanOrEqual(modal.copyViewport.bounds.height,70)
            XCTAssertGreaterThanOrEqual(modal.copyViewport.frame.minX,40)
            XCTAssertEqual(modal.copyViewport.frame.minX,modal.idle.bounds.width-modal.copyViewport.frame.maxX,accuracy:0.001)
            XCTAssertGreaterThan(modal.copyViewport.frame.minY-modal.heading.frame.maxY,16)
            XCTAssertLessThanOrEqual(modal.heading.sizeThatFits(CGSize(width:1000,height:1000)).width,modal.heading.bounds.width+1)
            let needed=modal.copy.sizeThatFits(CGSize(width:modal.copy.bounds.width,height:.greatestFiniteMagnitude)).height
            XCTAssertTrue(needed<=modal.copyViewport.bounds.height+0.5 || modal.copyViewport.isScrollEnabled,"All story text and signature must remain reachable on compact screens")
            XCTAssertEqual(modal.storyArtwork.image?.cgImage?.width,1155)
            XCTAssertEqual(modal.storyArtwork.image?.scale,3)
            XCTAssertEqual(modal.artworkEntry.bounds.height/modal.artworkEntry.bounds.width,257.0/385,accuracy:0.001)
            XCTAssertEqual(modal.artworkEntry.center.x,modal.idle.bounds.midX,accuracy:0.001)
            XCTAssertLessThan(modal.artworkEntry.frame.minY,modal.paper.bodyFrame.minY)
            XCTAssertEqual(modal.artworkEntry.frame.maxY-modal.paper.bodyFrame.minY,26,accuracy:0.001)
            XCTAssertEqual(modal.heading.frame.minY-modal.paper.bodyFrame.minY,32,accuracy:0.001)
            XCTAssertNil(modal.artworkEntry.layer.mask,"Heads remain above the paper edge")
            XCTAssertTrue(modal.artworkEntry.superview === modal.paper.superview,"Art and paper share the same tilt/idle owner")
            XCTAssertTrue(CATransform3DIsIdentity(modal.artworkEntry.layer.transform))
            XCTAssertTrue(CATransform3DIsIdentity(modal.storyArtwork.layer.transform))
            let baseline=modal.artworkEntry.frame.minY+modal.artworkEntry.bounds.height*224/257
            XCTAssertEqual(modal.artworkEntry.frame.minY,8,accuracy:0.001)
            if size.width==390 {XCTAssertGreaterThanOrEqual(baseline,modal.paper.bodyFrame.minY,"No transparent seam above paper after compact-art scaling")}
            let left=modal.idle.convert(CGPoint(x:modal.artworkEntry.frame.minX,y:baseline),to:window)
            let right=modal.idle.convert(CGPoint(x:modal.artworkEntry.frame.maxX,y:baseline),to:window)
            let paperLeft=modal.idle.convert(CGPoint(x:0,y:modal.paper.bodyFrame.minY),to:window)
            let paperRight=modal.idle.convert(CGPoint(x:modal.paper.bodyFrame.width,y:modal.paper.bodyFrame.minY),to:window)
            XCTAssertEqual((right.y-left.y)/(right.x-left.x),(paperRight.y-paperLeft.y)/(paperRight.x-paperLeft.x),accuracy:0.001)
            XCTAssertEqual(modal.factLabel.text,"Fun fact: It all started with the Star.")
            XCTAssertEqual(modal.factLabel.attributedText?.attribute(.foregroundColor,at:0,effectiveRange:nil) as? UIColor,NativeTextPalette.accentOrange)
            if size.width>=390 {XCTAssertLessThanOrEqual(modal.factLabel.bounds.height,46.8+1,"Entire inline fact fits two lines")}
            XCTAssertNotNil(modal.inlineStar.contents)
            XCTAssertTrue(modal.inlineStar.superlayer === modal.fact.layer)
            XCTAssertEqual(modal.inlineStar.bounds.size,CGSize(width:64,height:64))
            XCTAssertTrue(modal.fact.transform.isIdentity)
            XCTAssertEqual(modal.fact.frame.minX,32,accuracy:0.001)
            XCTAssertEqual(modal.idle.bounds.width-modal.fact.frame.maxX,32,accuracy:0.001)
            XCTAssertEqual(modal.idle.bounds.height-modal.fact.frame.maxY,40,accuracy:0.001)
            XCTAssertLessThan(modal.inlineStar.frame.maxX,modal.factDivider.frame.minX)
            XCTAssertLessThan(modal.factDivider.frame.maxX,modal.factLabel.frame.minX)
            XCTAssertEqual(modal.factDivider.bounds.width,1,accuracy:0.001)
            XCTAssertEqual(modal.factDivider.bounds.height,modal.fact.bounds.height-40,accuracy:0.001)
            XCTAssertEqual(modal.factDivider.frame.midY,modal.fact.bounds.midY,accuracy:0.001)
            XCTAssertEqual(modal.factDivider.backgroundColor,NativeTextPalette.subtitle.withAlphaComponent(0.35))
            let format=UIGraphicsImageRendererFormat();format.scale=3;format.opaque=false
            let inkImage=UIGraphicsImageRenderer(size:modal.factLabel.bounds.size,format:format).image{_ in modal.factLabel.drawText(in:modal.factLabel.bounds)}
            let cg=try XCTUnwrap(inkImage.cgImage)
            var pixels=[UInt8](repeating:0,count:cg.width*cg.height*4)
            let context=try XCTUnwrap(CGContext(data:&pixels,width:cg.width,height:cg.height,bitsPerComponent:8,bytesPerRow:cg.width*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue))
            context.draw(cg,in:CGRect(x:0,y:0,width:cg.width,height:cg.height))
            let rows=(0..<cg.height).filter{y in (0..<cg.width).contains{x in pixels[(y*cg.width+x)*4+3]>24}}
            let inkTop=CGFloat(try XCTUnwrap(rows.first))/3
            let inkBottom=CGFloat(try XCTUnwrap(rows.last)+1)/3
            let inkMidY=modal.factLabel.frame.minY+(inkTop+inkBottom)/2
            XCTAssertEqual(inkMidY,modal.fact.bounds.midY,accuracy:1.5,"Visible text ink must be vertically centered at width \(size.width)")
            XCTAssertEqual(try XCTUnwrap(modal.factLabel.attributedText?.attribute(.paragraphStyle,at:0,effectiveRange:nil) as? NSParagraphStyle).alignment,.left)
            XCTAssertEqual(modal.factDivider.frame.minX-modal.inlineStar.frame.maxX,11,accuracy:0.001)
            XCTAssertEqual(modal.factLabel.frame.minX-modal.factDivider.frame.maxX,12,accuracy:0.001)
            XCTAssertGreaterThan(modal.fact.frame.minY,modal.copyViewport.frame.maxY)
            XCTAssertTrue(modal.copy.superview === modal.copyViewport)
            XCTAssertTrue(modal.copyViewport.superview === modal.idle)
            if size.width==390 {XCTAssertFalse(modal.copyViewport.isScrollEnabled,"Phone story including final j/y must fit without an initially clipped last line")}
            let copyFormat=UIGraphicsImageRendererFormat();copyFormat.scale=3;copyFormat.opaque=false
            let copyImage=UIGraphicsImageRenderer(size:modal.copy.bounds.size,format:copyFormat).image{_ in modal.copy.drawText(in:modal.copy.bounds)}
            let copyCG=try XCTUnwrap(copyImage.cgImage)
            XCTAssertEqual(try alphaCount(copyCG,in:CGRect(x:0,y:CGFloat(copyCG.height)-3,width:CGFloat(copyCG.width),height:3)),0,"Final descenders need clear space below the painted ink")
            XCTAssertLessThan(modal.fact.frame.maxY,modal.paper.bodyFrame.maxY)
            XCTAssertTrue(modal.fact.superview === modal.idle)
            XCTAssertEqual(modal.factPaper.cornerRadius,12)
            XCTAssertEqual(modal.factPaper.edgeDetailScale,0.4)
            XCTAssertEqual(modal.factPaper.alpha,1)
            XCTAssertLessThanOrEqual(modal.factLabel.sizeThatFits(modal.factLabel.bounds.size).height,modal.factLabel.bounds.height+0.5)
            XCTAssertTrue(modal.artworkEntry.isDescendant(of:modal.idle))
            XCTAssertEqual(modal.heading.attributedText?.attribute(.foregroundColor,at:4,effectiveRange:nil) as? UIColor,NativeTextPalette.modalTitle)
            XCTAssertEqual(modal.heading.attributedText?.attribute(.foregroundColor,at:0,effectiveRange:nil) as? UIColor,NativeModalTypography.attributedCollectionTitle("The story",baseColor:NativeTextPalette.modalTitle).attribute(.foregroundColor,at:0,effectiveRange:nil) as? UIColor)
            XCTAssertEqual(modal.copy.attributedText!.attribute(.foregroundColor,at:0,effectiveRange:nil) as? UIColor,NativeTextPalette.subtitle)
            XCTAssertEqual((modal.copy.attributedText!.attribute(.font,at:0,effectiveRange:nil) as? UIFont)?.pointSize,18)
            XCTAssertEqual(try XCTUnwrap(modal.copy.attributedText!.attribute(.paragraphStyle,at:0,effectiveRange:nil) as? NSParagraphStyle).minimumLineHeight,23.4,accuracy:0.001)
            let union=modal.card.convert(modal.card.bounds,to:window).union(modal.artworkEntry.convert(modal.artworkEntry.bounds,to:window))
            XCTAssertEqual(union.midX,window.bounds.midX,accuracy:8)
            XCTAssertEqual(union.midY,window.bounds.midY,accuracy:8)
            let artworkFrame=modal.artworkEntry.frame
            modal.view.setNeedsLayout();modal.view.layoutIfNeeded()
            XCTAssertEqual(modal.artworkEntry.frame,artworkFrame)
            modal.viewDidAppear(false)
            let output=URL(fileURLWithPath:"/tmp/creator-island-renders")
            try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
            window.backgroundColor=UIColor(red:0.96,green:0.93,blue:0.89,alpha:1)
            let image=UIGraphicsImageRenderer(bounds:window.bounds).pngData{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
            try image.write(to:output.appendingPathComponent("story-\(Int(size.width)).png"))
        }
    }
    func testFooterKeepsUpperRowsAndOneCreatorTargetSeparateFromPrivacy()throws {
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:820,height:1180)] {
            let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
            let settings=JimiNativeSettingsView(frame:CGRect(origin:.zero,size:size),assets:assets)
            let host=UIViewController(),window=UIWindow(frame:settings.bounds)
            window.rootViewController=host;host.view.addSubview(settings);window.makeKeyAndVisible()
            defer{settings.removeFromSuperview();window.isHidden=true;window.rootViewController=nil}
            XCTAssertTrue(settings.apply(["presentationEpoch":10,"gameSoundsEnabled":true,"musicEnabled":true,"hapticsEnabled":true]))
            settings.layoutIfNeeded()
            let before=settings.rows.map(\.frame)
            var opened=0,privacy=0,preferences=0
            settings.onCreatorStory={opened+=1};settings.onPrivacy={privacy+=1};settings.onPreference={_,_,_ in preferences+=1}
            let creator=try XCTUnwrap(all(settings).first{$0.accessibilityIdentifier=="native.settings.creator"} as? UIControl)
            XCTAssertNotNil(try XCTUnwrap(all(creator).first{$0.accessibilityIdentifier=="native.settings.creator.heart"} as? UIImageView).image)
            let brand=try XCTUnwrap(all(creator).first{$0.accessibilityIdentifier=="native.settings.creator.brand"} as? UILabel)
            let made=try XCTUnwrap(all(creator).first{$0.accessibilityIdentifier=="native.settings.creator.made"} as? UILabel)
            for point in [brand.center,made.center,CGPoint(x:creator.bounds.midX,y:20)] {
                XCTAssertTrue(creator.hitTest(point,with:nil) === creator,"One actual target covers heart and both lines")
            }
            creator.sendActions(for:.touchUpInside)
            XCTAssertEqual(opened,1);XCTAssertEqual(preferences,0)
            let version=try XCTUnwrap(all(settings.footer).first{$0.accessibilityIdentifier=="native.settings.version"} as? UILabel)
            let policy=try XCTUnwrap(all(settings.footer).first{$0.accessibilityIdentifier=="native.settings.privacy"} as? UIButton)
            XCTAssertEqual(version.text,"Version 1.0")
            XCTAssertEqual(version.font,policy.titleLabel?.font)
            XCTAssertEqual(version.textColor,policy.titleColor(for:.normal))
            let policyFrame=policy.convert(policy.bounds,to:settings.footer)
            XCTAssertEqual(version.frame.midY,policyFrame.midY,accuracy:0.001)
            XCTAssertGreaterThanOrEqual(version.frame.minX,0);XCTAssertLessThanOrEqual(policyFrame.maxX,settings.footer.bounds.width)
            XCTAssertLessThanOrEqual(creator.frame.maxY,policyFrame.minY)
            policy.sendActions(for:.touchUpInside);XCTAssertEqual(privacy,1);XCTAssertEqual(opened,1)
            XCTAssertEqual(settings.rows.map(\.frame),before);XCTAssertEqual(settings.rows.count,3)
            let output=URL(fileURLWithPath:"/tmp/creator-story-renders")
            try FileManager.default.createDirectory(at:output,withIntermediateDirectories:true)
            let background=NativeAppPaperSurface(artwork:assets);background.frame=settings.bounds;background.layoutIfNeeded()
            try UIGraphicsImageRenderer(bounds:settings.bounds).pngData {context in
                background.layer.render(in:context.cgContext);settings.layer.render(in:context.cgContext)
            }.write(to:output.appendingPathComponent("settings-\(Int(size.width)).png"))
        }
    }
    func testActualSettingsRouteOwnsStoryPauseCloseReopenAndRetirement()async throws {
        var preferences=0
        let services=NativeAppServices(settings:{["gameSoundsEnabled":true,"musicEnabled":true,"hapticsEnabled":true]},setPreference:{_,_ in preferences+=1},worldSnapshot:{_,_,_ in [:]},markViewed:{_ in},makeGameplay:{_,_ in UIViewController()},flush:{})
        let app=NativeAppController(resourceRoot:NativeTestResources.root,services:services)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=app;window.makeKeyAndVisible()
        defer{app.dispose();window.isHidden=true;window.rootViewController=nil}
        try await wait{!app.transitioning && app.home.isUserInteractionEnabled}
        app.navigate(.settings);try await wait{app.route == .settings && app.settingsView.isUserInteractionEnabled}
        XCTAssertTrue(app.settingsView.creatorShimmer?.running == true)
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertNil(app.settingsView.creatorShimmer)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        try await wait{app.settingsView.creatorShimmer?.running == true}
        let privacyButton=try XCTUnwrap(all(app.settingsView).first{$0.accessibilityIdentifier=="native.settings.privacy"} as? UIButton)
        privacyButton.sendActions(for:.touchUpInside)
        XCTAssertNil(app.settingsView.creatorShimmer)
        try await wait{(app.presentedViewController as? JimiNativePrivacyController)?.card.layer.animation(forKey:"privacy-enter")==nil && app.presentedViewController != nil}
        let policy=try XCTUnwrap(app.presentedViewController as? JimiNativePrivacyController)
        policy.close.sendActions(for:.touchUpInside)
        try await wait{app.presentedViewController==nil && app.settingsView.creatorShimmer?.running == true}
        var cues:[String]=[];app.onFeedback={cues.append($0)}
        app.settingsView.creator.sendActions(for:.touchUpInside);app.settingsView.creator.sendActions(for:.touchUpInside)
        XCTAssertNil(app.settingsView.creatorShimmer,"Story cover retires creator sheen")
        weak var released:NativeCreatorStoryModal?
        do {
        let modal=try XCTUnwrap(app.creatorStoryModal);released=modal
        XCTAssertEqual(cues.filter{$0=="modal-open"}.count,1)
        try await wait{modal.ready}
        XCTAssertTrue(app.presentedViewController === modal)
        XCTAssertEqual(modal.heading.textAlignment,.center)
        XCTAssertTrue(modal.factLabel.accessibilityLabel!.contains("Fun fact: It all started with the Star."));XCTAssertNotNil(modal.storyArtwork.image)
        let starMotion=try XCTUnwrap(modal.inlineStar.animation(forKey:NativeCreatorStoryModal.inlineStarKey) as? CAKeyframeAnimation)
        XCTAssertEqual(starMotion.duration,NativeDiceSheet.star.cycle)
        XCTAssertEqual(starMotion.values?.count,NativeDiceSheet.star.frameCount+1)
        XCTAssertEqual(starMotion.calculationMode,.discrete)
        XCTAssertNotNil(modal.idle.layer.animation(forKey:NativeCreatorStoryModal.idleKey))
        XCTAssertTrue(modal.fact.superview === modal.idle,"Both papers inherit the same modal idle")
        let shadow=try XCTUnwrap(modal.idle.layer.sublayers?.first{$0.name=="native.end-run.paper-shadow"})
        XCTAssertEqual(shadow.frame,modal.card.bounds)
        XCTAssertFalse(shadow.isDoubleSided,"Shadow and paper must share front-face visibility during the flip")
        XCTAssertTrue(try XCTUnwrap(shadow.shadowPath).contains(CGPoint(x:modal.idle.bounds.midX,y:modal.idle.bounds.midY)))
        XCTAssertNil(shadow.animation(forKey:"shadowPath"),"Layout must not implicitly animate the paper silhouette")
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        XCTAssertEqual(modal.view.layer.speed,0)
        let starTime=modal.inlineStar.convertTime(CACurrentMediaTime(),from:nil)
        let idleTime=modal.idle.layer.convertTime(CACurrentMediaTime(),from:nil)
        try await Task.sleep(for:.milliseconds(50))
        XCTAssertEqual(modal.inlineStar.convertTime(CACurrentMediaTime(),from:nil),starTime,accuracy:0.001)
        XCTAssertEqual(modal.idle.layer.convertTime(CACurrentMediaTime(),from:nil),idleTime,accuracy:0.001)
        modal.requestClose();XCTAssertFalse(modal.closing)
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        XCTAssertEqual(modal.view.layer.speed,1)
        modal.requestClose();modal.requestClose()
        XCTAssertNil(modal.inlineStar.animation(forKey:NativeCreatorStoryModal.inlineStarKey))
        XCTAssertNil(modal.idle.layer.animation(forKey:NativeCreatorStoryModal.idleKey))
        XCTAssertEqual(cues.filter{$0=="modal-close"}.count,1)
        try await wait{app.creatorStoryModal==nil && app.presentedViewController==nil}
        }
        // Leave the local modal scope before asserting actual retirement.
        try await wait{released==nil}
        XCTAssertTrue(app.settingsView.creatorShimmer?.running == true)
        app.settingsView.creator.sendActions(for:.touchUpInside)
        let replacement=try XCTUnwrap(app.creatorStoryModal)
        XCTAssertFalse(replacement.disposed)
        app.navigate(.home,interrupt:true)
        XCTAssertNil(app.creatorStoryModal);XCTAssertTrue(replacement.disposed)
        XCTAssertNil(replacement.onClosed);XCTAssertNil(replacement.onCloseRequested)
        XCTAssertEqual(preferences,0,"The creator story cannot mutate player preferences")
        try await wait{app.route == .home && !app.transitioning}
        app.navigate(.settings);try await wait{app.settingsView.isUserInteractionEnabled && app.route == .settings}
        app.settingsView.creator.sendActions(for:.touchUpInside)
        weak var disposed=app.creatorStoryModal
        app.dispose();XCTAssertNil(app.creatorStoryModal)
        try await wait{disposed==nil}
    }
    func testReducedMotionKeepsArtworkStillAndDisposesComposition()throws {
        let modal=NativeCreatorStoryModal(assets:JimiV9Artwork(resourceRoot:NativeTestResources.root),reducedMotion:true)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
        window.rootViewController=modal;window.makeKeyAndVisible()
        defer{modal.dispose();window.isHidden=true;window.rootViewController=nil}
        modal.view.layoutIfNeeded();modal.viewDidAppear(false)
        XCTAssertTrue(modal.ready)
        XCTAssertNil(modal.inlineStar.animationKeys());XCTAssertNil(modal.idle.layer.animationKeys())
        modal.requestClose();XCTAssertTrue(modal.disposed)
        XCTAssertNil(modal.artworkEntry.layer.animationKeys())
    }
}
