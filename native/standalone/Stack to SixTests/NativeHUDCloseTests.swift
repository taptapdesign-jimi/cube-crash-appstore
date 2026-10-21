import XCTest
import UIKit
import SpriteKit
import Metal
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor
final class NativeHUDCloseTests:XCTestCase {
    func testModalCloseOpacitySurvivesUIKitLayoutAndStateRefresh() async throws {
        let modal=NativeScoreModal(model:.init(state:NativeBoardState(tiles:[]),progression:.init(),combo:false),root:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=modal;window.makeKeyAndVisible()
        defer {modal.dispose();window.isHidden=true}
        modal.view.layoutIfNeeded()
        func find(_ view:UIView)->UIButton? {
            if view.accessibilityIdentifier=="native.score-modal.close" {return view as? UIButton}
            return view.subviews.lazy.compactMap {find($0)}.first
        }
        let close=try XCTUnwrap(find(modal.view))
        for enabled in [true,false,true] {
            close.isEnabled=enabled;close.setNeedsLayout();close.layoutIfNeeded()
            try await Task.sleep(for:.milliseconds(30))
            XCTAssertEqual(try XCTUnwrap(close.imageView).alpha,0.8,accuracy:0.0001)
            XCTAssertEqual(close.imageView?.bounds.width,24)
        }
    }
    func testMountedNavigationContactActuallyPaintsBeforeItFinishes() async throws {
        let assets=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let home=JimiV9HomeView(frame:CGRect(x:0,y:0,width:390,height:844),assets:assets)
        let controller=UIViewController();controller.view=home
        let window=UIWindow(frame:home.bounds);window.rootViewController=controller;window.makeKeyAndVisible()
        let motion=NativeRouteMotion(home:home,hub:JimiV9HubView(frame:home.bounds,assets:assets))
        defer {motion.cancel();window.isHidden=true}
        home.layoutIfNeeded();try await Task.sleep(for:.milliseconds(50))
        for index in home.navigationIconViews.indices {
            motion.selectSlide(index){}
            var changed=false
            for _ in 0..<10 {
                try await Task.sleep(for:.milliseconds(20))
                let value=home.navigationIconViews[index].layer.presentation()?.transform.m11 ?? 1
                if abs(value-1)>0.005 {changed=true}
            }
            XCTAssertTrue(changed,"Tab \(index) must paint contact while visible")
            try await Task.sleep(for:.milliseconds(1100))
            let icon=home.navigationIconViews[index]
            let layer=icon.layer,now=CACurrentMediaTime()
            let contact=layer.animation(forKey:NativeHubBackpackFeedback.animationKey)
            let local=layer.convertTime(now,from:nil)
            print("[HUD_CONTACT] tab=\(index) local=\(local) contactStart=\(contact?.beginTime ?? 0) painted=\(layer.presentation()?.transform.m11 ?? 1)")
            XCTAssertEqual(layer.presentation()?.transform.m11 ?? 1,1,accuracy:0.005,"Contact must already be at rest before any return")
            // Core Animation may retain an expired key until its enclosing
            // transaction settles. Its input-time clock and actual pixels,
            // rather than key retention, establish whether it can replay.
            if let contact {
                XCTAssertGreaterThan(contact.beginTime,0)
                XCTAssertGreaterThanOrEqual(local-contact.beginTime,contact.duration)
            }
            home.isHidden=true;home.isHidden=false
            try await Task.sleep(for:.milliseconds(40))
            XCTAssertEqual(layer.presentation()?.transform.m11 ?? 1,1,accuracy:0.005,"Revealing navigation must not replay contact")
        }
    }
    func testControllerModalPausePaintsEveryHUDContactAndNeverReplaysOnDismissal() async throws {
        for metal in [false,true] {
            let engine=NativeGameplayEngine(state:.init(tiles:[
                .init(id:"one",cell:.init(column:0,row:0),value:1),
                .init(id:"two",cell:.init(column:1,row:0),value:1)]))
            let controller=NativeGameplayViewController(engine:engine,resourceRoot:NativeTestResources.root,
                renderSurfaceFactory:metal ? nil : {SKView()})
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=controller;window.makeKeyAndVisible()
            defer {controller.dispose();window.isHidden=true}
            controller.view.frame=window.bounds;controller.view.layoutIfNeeded()
            let scene=try XCTUnwrap(controller.boardScene)
            // Admit the real retained board without waiting for unrelated entry art.
            scene.layout(size:scene.size,insets:.zero,animateEntry:false)
            try await Task.sleep(for:.milliseconds(200))
            var requests=0,tapCues=0;var cueKinds:[String]=[]
            controller.onHUDTapContact={kind in tapCues += 1;cueKinds.append(kind)}
            let pause={requests += 1;controller.setSuspended(true)}
            scene.onExitRequest=pause;scene.onHelpRequest=pause;scene.onScoreRequest=pause;scene.onComboRequest=pause
            let die=try XCTUnwrap(scene.sourceNativeTileNode("one"))
            for name in ["native-game-close","native-game-help","native-game-score-art","native-game-combo-art"] {
                controller.setSuspended(false)
                let icon=try XCTUnwrap(scene.childNode(withName:"//"+name))
                let base=icon.xScale,start=die.position
                die.run(.moveBy(x:100,y:0,duration:1),withKey:"pause-regression")
                let before=requests,beforeCues=tapCues
                XCTAssertTrue(scene.handleHUDContact(at:icon.convert(.zero,to:scene)))
                XCTAssertEqual(requests,before+1,name)
                XCTAssertEqual(tapCues,beforeCues+1,"Exactly one cue at accepted contact: \(name)")
                XCTAssertEqual(cueKinds.last,name == "native-game-close" ? "close":"hud-icon-tap")
                XCTAssertFalse(scene.handleHUDContact(at:icon.convert(.zero,to:scene)),"Suspended modal blocks repeat contact")
                XCTAssertEqual(tapCues,beforeCues+1)
                XCTAssertFalse(try XCTUnwrap(scene.gameplayRenderHost).renderingPaused,"Modal must admit the finite contact tail: \(name), metal=\(metal)")
                var changed=false
                let tailDeadline=Date().addingTimeInterval(2)
                while scene.hasActiveHUDTapFeedback,Date()<tailDeadline {
                    try await Task.sleep(for:.milliseconds(20))
                    if abs(icon.xScale-base)>0.005 {changed=true}
                    XCTAssertEqual(die.position.x,start.x,accuracy:0.001,"Gameplay stays frozen")
                }
                XCTAssertTrue(changed,"Real controller contact paints before dismissal: \(name), metal=\(metal)")
                XCTAssertFalse(scene.hasActiveHUDTapFeedback)
                XCTAssertTrue(try XCTUnwrap(scene.gameplayRenderHost).renderingPaused,"The finite tail must release renderer demand")
                XCTAssertEqual(icon.xScale,base,accuracy:0.0001)
                die.removeAction(forKey:"pause-regression")
                controller.setSuspended(false)
                try await Task.sleep(for:.milliseconds(80))
                XCTAssertEqual(icon.xScale,base,accuracy:0.0001,"Dismissal cannot replay the tap")
            }
        }
    }
    func testModalXContactPaintsOnTouchDownAndReleaseKeepsSameBounce() async throws {
        let modal=NativeScoreModal(model:.init(state:.init(tiles:[]),progression:.init(),combo:false),root:NativeTestResources.root)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=modal;window.makeKeyAndVisible()
        defer {modal.dispose();window.isHidden=true}
        modal.view.layoutIfNeeded()
        try await Task.sleep(for:.milliseconds(900))
        func find(_ view:UIView)->JimiV9PlainButton? {
            if view.accessibilityIdentifier=="native.score-modal.close" {return view as? JimiV9PlainButton}
            return view.subviews.lazy.compactMap{find($0)}.first
        }
        let close=try XCTUnwrap(find(modal.view)),icon=try XCTUnwrap(close.imageView)
        close.sendActions(for:.touchDown)
        let start=try XCTUnwrap(icon.layer.animation(forKey:NativeHubBackpackFeedback.animationKey)).beginTime
        var changed=false
        for _ in 0..<3 {
            try await Task.sleep(for:.milliseconds(20))
            if abs((icon.layer.presentation()?.transform.m11 ?? 1)-1)>0.005 {changed=true}
        }
        XCTAssertTrue(changed,"X paints contact while the modal is still fully open")
        XCTAssertEqual(icon.alpha,0.8,accuracy:0.00001)
        close.sendActions(for:.touchUpInside)
        XCTAssertEqual(icon.layer.animation(forKey:NativeHubBackpackFeedback.animationKey)?.beginTime,start,"Release cannot restart the press bounce behind the exit")
    }
    func testHUDIconMinificationPreservesGeometryAndImprovesActualShakeRaster() throws {
        let textures=NativeBoardTextures(root:NativeTestResources.root)
        defer{textures.dispose()}
        let paths=["assets/close-icon.png","assets/nav/stats-nav.png","assets/hud/score-hud.png",
                   "assets/hud/combo-hud.png","assets/hud/extra-combo-hud.png","assets/hud/mega-combo-hud.png"]
        let device=try XCTUnwrap(MTLCreateSystemDefaultDevice()),queue=try XCTUnwrap(device.makeCommandQueue())
        func render(_ source:SKTexture,side:CGFloat,offset:CGFloat,density:Int)throws->[UInt8] {
            let width=64*density
            let descriptor=MTLTextureDescriptor.texture2DDescriptor(pixelFormat:.bgra8Unorm,width:width,height:width,mipmapped:false)
            descriptor.usage=[.renderTarget,.shaderRead];descriptor.storageMode = .shared
            let target=try XCTUnwrap(device.makeTexture(descriptor:descriptor))
            let scene=SKScene(size:CGSize(width:64,height:64));scene.scaleMode = .fill;scene.backgroundColor = .clear
            let icon=SKSpriteNode(texture:source);icon.size=CGSize(width:side,height:side)
            icon.position=CGPoint(x:32+offset,y:32+offset*0.7);scene.addChild(icon)
            let renderer=SKRenderer(device:device);renderer.scene=scene;renderer.update(atTime:1)
            let pass=MTLRenderPassDescriptor();pass.colorAttachments[0].texture=target
            pass.colorAttachments[0].loadAction = .clear;pass.colorAttachments[0].storeAction = .store
            let command=try XCTUnwrap(queue.makeCommandBuffer())
            renderer.render(withViewport:CGRect(x:0,y:0,width:width,height:width),commandBuffer:command,renderPassDescriptor:pass)
            command.commit();command.waitUntilCompleted();XCTAssertEqual(command.status,.completed)
            var bytes=[UInt8](repeating:0,count:width*width*4)
            bytes.withUnsafeMutableBytes{target.getBytes($0.baseAddress!,bytesPerRow:width*4,from:MTLRegionMake2D(0,0,width,width),mipmapLevel:0)}
            renderer.scene=nil
            guard density>1 else{return bytes}
            // Independent area average of a 4x raster is the minification reference.
            var reduced=[UInt8](repeating:0,count:64*64*4)
            for y in 0..<64 {for x in 0..<64 {for c in 0..<4 {
                var sum=0
                for dy in 0..<density {for dx in 0..<density {sum+=Int(bytes[(((y*density+dy)*width+x*density+dx)*4)+c])}}
                reduced[(y*64+x)*4+c]=UInt8(sum/(density*density))
            }}}
            return reduced
        }
        var rawError=0.0,filteredError=0.0
        var comparisons:[UIImage]=[]
        for path in paths {
            let filtered=try XCTUnwrap(textures.texture(path))
            XCTAssertTrue(filtered.usesMipmaps,path);XCTAssertEqual(filtered.filteringMode,.linear)
            XCTAssertTrue(filtered === textures.texture(path))
            let url=NativeTestResources.root.appendingPathComponent(path)
            let density=min(3,max(1,Int(UIScreen.main.scale.rounded(.up))))
            var original:UIImage?
            for scale in stride(from:density,through:1,by:-1) {
                let candidate=scale==1 ? url:url.deletingLastPathComponent().appendingPathComponent(url.deletingPathExtension().lastPathComponent+"@\(scale)x."+url.pathExtension)
                if let image=UIImage(contentsOfFile:candidate.path){original=image;break}
            }
            let raw=SKTexture(image:try XCTUnwrap(original));raw.filteringMode = .linear
            XCTAssertEqual(filtered.size(),raw.size(),"Logical texture dimensions remain exact")
            let pixels=try XCTUnwrap(textures.sourceRasterPixelSize(for:filtered))
            for value in [Int(pixels.width),Int(pixels.height)] {XCTAssertEqual(value & (value-1),0)}
            let side:CGFloat=path.contains("stats-nav") ? 36:path.contains("close-icon") ? 24:28
            var pathRaw=0.0,pathFiltered=0.0
            for offset:CGFloat in [0,0.25,0.5,0.75] {
                let reference=try render(raw,side:side,offset:offset,density:4)
                let a=try render(raw,side:side,offset:offset,density:1)
                let b=try render(filtered,side:side,offset:offset,density:1)
                for i in reference.indices {
                    pathRaw+=pow(Double(a[i])-Double(reference[i]),2)
                    pathFiltered+=pow(Double(b[i])-Double(reference[i]),2)
                }
                if offset==0.25 {
                    for var pixels in [a,b] {
                        let image=pixels.withUnsafeMutableBytes { buffer -> CGImage? in
                            CGContext(data:buffer.baseAddress,width:64,height:64,bitsPerComponent:8,bytesPerRow:64*4,
                                space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue)?.makeImage()
                        }
                        comparisons.append(UIImage(cgImage:try XCTUnwrap(image)))
                    }
                }
            }
            print("[HUD_FILTER_GPU] asset=\(path) raw=\(pathRaw) filtered=\(pathFiltered)")
            XCTAssertLessThan(pathFiltered,pathRaw,path)
            rawError+=pathRaw;filteredError+=pathFiltered
        }
        let format=UIGraphicsImageRendererFormat();format.scale=1
        let sheet=UIGraphicsImageRenderer(size:CGSize(width:384,height:1152),format:format).image { context in
            UIColor(red:0.94,green:0.87,blue:0.81,alpha:1).setFill();context.fill(CGRect(x:0,y:0,width:384,height:1152))
            context.cgContext.interpolationQuality = .none
            for (i,image) in comparisons.enumerated() {image.draw(in:CGRect(x:(i%2)*192,y:(i/2)*192,width:192,height:192))}
        }
        try sheet.pngData()?.write(to:URL(fileURLWithPath:"/tmp/hud-filter-comparison.png"))
        print("[HUD_FILTER_GPU] rawError=\(rawError) filteredError=\(filteredError)")
        XCTAssertLessThan(filteredError,rawError,"Actual subpixel shake samples should approach the supersampled reference")
        XCTAssertFalse(try XCTUnwrap(textures.texture("assets/shadow.png")).usesMipmaps)
    }
    func testModalPauseAllowsCloseFeedbackButFreezesActualBoardBranch() async throws {
        let tile=NativeTile(id:"paused",cell:NativeCell(column:0,row:0),value:1)
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:NativeBoardState(tiles:[tile])),resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        let renderer=SKView(frame:CGRect(x:0,y:0,width:390,height:844))
        let controller=UIViewController();controller.view=renderer
        let window=UIWindow(frame:renderer.bounds);window.rootViewController=controller;window.makeKeyAndVisible()
        defer{scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let painted=expectation(description:"Actual gameplay scene mounted and painted")
        scene.onFirstBoardFrame={painted.fulfill()}
        renderer.presentScene(scene);scene.layout(size:scene.size,insets:.zero)
        await fulfillment(of:[painted],timeout:3)
        scene.onFirstBoardFrame=nil
        let close=try XCTUnwrap(scene.childNode(withName:"//native-game-close") as? NativeHUDCloseNode)
        let die=try XCTUnwrap(scene.sourceNativeTileNode("paused")),start=die.position
        die.run(.moveBy(x:100,y:0,duration:1),withKey:"pause-regression")
        var actionElapsed:CGFloat=0
        die.run(.customAction(withDuration:1) {_,elapsed in actionElapsed=elapsed},withKey:"pause-clock")
        close.playTapBounce();scene.setSuspended(true,allowHUDFeedback:true)
        XCTAssertTrue(die.isPaused,"The actual dice child must own the feedback-only pause")
        var paintedScales:[CGFloat]=[]
        for _ in 0..<25 {
            try await Task.sleep(for:.milliseconds(20));paintedScales.append(close.xScale)
            XCTAssertTrue(die.isPaused || scene.isPaused,"The feedback interval must retain either child or whole-scene pause")
            XCTAssertEqual(die.position.x,start.x,accuracy:0.001,"Feedback cannot resume a gameplay action")
        }
        XCTAssertTrue(paintedScales.contains{abs($0-1)>0.005},"The actual child action must paint through modal pause")
        XCTAssertNil(close.action(forKey:"hud-tap-bounce"));XCTAssertTrue(scene.isPaused)
        scene.setSuspended(false)
        let resumed=actionElapsed
        try await Task.sleep(for:.milliseconds(120))
        XCTAssertGreaterThan(actionElapsed,resumed,"Resume must release the captured action clock; entry/layout may also write position")
    }
    func testQuietBoardKeepsRenderingWhileCloseTapActionIsActive() throws {
        let tile=NativeTile(id:"quiet",cell:NativeCell(column:0,row:0),value:1)
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:NativeBoardState(tiles:[tile])),resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        defer{scene.dispose()}
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0))
        let close=try XCTUnwrap(scene.childNode(withName:"//native-game-close") as? NativeHUDCloseNode)
        var renderingDemands:[Bool]=[]
        scene.onRenderingDemand={renderingDemands.append($0)}
        close.playTapBounce()
        scene.didFinishUpdate()
        XCTAssertNotNil(close.action(forKey:"hud-tap-bounce"))
        XCTAssertFalse(renderingDemands.contains(false),"Quiet-board ownership must retain the finite child action")
    }
    func testTapCurveUsesSharedAnisotropicBounceAndReturnsToNeutral() {
        let peak=NativeHUDTapMotion.pose(at:NativeHUDTapMotion.phases[2]*0.4)
        XCTAssertEqual(peak.x,0.88,accuracy:0.00001);XCTAssertEqual(peak.y,1.14,accuracy:0.00001);XCTAssertEqual(peak.offset,-7,accuracy:0.00001)
        let end=NativeHUDTapMotion.pose(at:0.4)
        XCTAssertEqual(end.x,1,accuracy:0.00001);XCTAssertEqual(end.y,1,accuracy:0.00001);XCTAssertEqual(end.offset,0,accuracy:0.00001)
    }
    func testRealTapActionFreezesWithGameplayPauseAndFinishesAfterResume() async throws {
        let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
        let close=NativeHUDCloseNode(texture:nil,stageFont:artwork.font(size:16))
        let scene=SKScene(size:CGSize(width:100,height:100));scene.addChild(close)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:100,height:100)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller;window.makeKeyAndVisible();renderer.presentScene(scene)
        defer{renderer.presentScene(nil);window.isHidden=true}
        renderer.isPaused=true;close.playTapBounce()
        try await Task.sleep(for:.milliseconds(300))
        XCTAssertNotNil(close.action(forKey:"hud-tap-bounce"));XCTAssertEqual(close.xScale,1)
        renderer.isPaused=false
        let finished=expectation(description:"Existing renderer finishes authored finite tap")
        close.run(.sequence([.wait(forDuration:0.4),.run{finished.fulfill()}]),withKey:"tap-completion-observer")
        await fulfillment(of:[finished],timeout:3)
        XCTAssertNil(close.action(forKey:"hud-tap-bounce"));XCTAssertEqual(close.xScale,1);XCTAssertEqual(close.yScale,1)
    }
    func testTypographicPlacementMatchesExecutedV9BrowserFontAdvanceAndAuthoredAsset() throws {
        let root=NativeTestResources.root,artwork=JimiV9Artwork(resourceRoot:root),texture=SKTexture(image:try XCTUnwrap(artwork.image("assets/close-icon.png")))
        let close=NativeHUDCloseNode(texture:texture,stageFont:artwork.font(size:16))
        // Actual immutable-v9 lblStyle/Text measured with original Pixi and
        // loaded Baloo2-Bold16 in Chrome: Stage.advance41.231964111328125.
        XCTAssertEqual(close.stageAdvance,41.231964111328125,accuracy:0.0001)
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:834,height:1194)] {
            let row=NativeGameplayChromePlan.make(viewport:size,safeTop:47).valueRowY
            close.layout(valueRowY:row)
            XCTAssertEqual(close.position.x,44.61598205566406,accuracy:0.0001);XCTAssertEqual(close.position.y,row)
            XCTAssertTrue(close.hitRect.contains(CGPoint(x:1,y:row+35.9)))
            XCTAssertTrue(close.hitRect.contains(CGPoint(x:102,y:row-31.9)))
            XCTAssertFalse(close.hitRect.contains(CGPoint(x:105,y:row)))
            XCTAssertFalse(close.hitRect.contains(CGPoint(x:1,y:row+36.1)))
            XCTAssertFalse(close.hitRect.contains(CGPoint(x:1,y:row-32.1)))
        }
        XCTAssertEqual(close.icon.size,CGSize(width:24,height:24));XCTAssertEqual(close.icon.alpha,0.8,accuracy:0.000001)
        XCTAssertEqual(close.ring.lineWidth,2);XCTAssertEqual(close.ring.lineCap,.butt);XCTAssertEqual(close.ring.lineJoin,.miter);XCTAssertEqual(close.ring.miterLimit,10)
        var red:CGFloat=0,green:CGFloat=0,blue:CGFloat=0,alpha:CGFloat=0
        XCTAssertTrue(close.ring.strokeColor.getRed(&red,green:&green,blue:&blue,alpha:&alpha))
        // SpriteKit stores alpha/color channels at Float32 precision.
        for (actual,source) in zip([red,green,blue,alpha],[232.0/255,212.0/255,199.0/255,1]) {XCTAssertEqual(actual,source,accuracy:0.000001)}
    }
    func testActualSceneUsesLiveCircleWithinCanonicalCanvas() throws {
        let tile=NativeTile(id:"a",cell:NativeCell(column:0,row:0),value:1)
        let scene=NativeBoardScene(engine:NativeGameplayEngine(state:NativeBoardState(tiles:[tile])),resourceRoot:NativeTestResources.root,size:CGSize(width:390,height:844))
        defer{scene.dispose()}
        scene.layout(size:scene.size,insets:UIEdgeInsets(top:47,left:0,bottom:34,right:0))
        let close=try XCTUnwrap(scene.childNode(withName:"//native-game-close") as? NativeHUDCloseNode)
        XCTAssertEqual(close.position.y,NativeGameplayChromePlan.make(viewport:scene.size,safeTop:47).valueRowY)
        XCTAssertEqual(close.children.count,2);XCTAssertEqual(close.parent?.parent?.name,"native-gameplay-canvas")
    }
}
