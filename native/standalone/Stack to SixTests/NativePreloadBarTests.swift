import XCTest
import SpriteKit
import UIKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativePreloadBarTests:XCTestCase {
    private func mount(_ bar:NativePreloadBarPresentation)->(UIWindow,SKView,SKScene){
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),host=UIViewController()
        window.rootViewController=host;window.makeKeyAndVisible()
        let view=SKView(frame:window.bounds);host.view.addSubview(view)
        let scene=SKScene(size:window.bounds.size);scene.scaleMode = .resizeFill
        scene.addChild(bar.container);bar.container.position=CGPoint(x:24,y:700);view.presentScene(scene)
        return (window,view,scene)
    }
    func testMountedEntryUnrollsInPlaceAfterDividerAndStopsItsDemand() throws {
        let bar=NativePreloadBarPresentation(reducedMotion:{false}),mounted=mount(bar)
        defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
        var demands:[Bool]=[];bar.onMotionChanged={demands.append($0)}
        bar.resize(maximum:343.2,barHeight:10);bar.setNativeFill(left:0,width:180,maximum:343.2)
        bar.primeBoardEntry();XCTAssertTrue(bar.container.isHidden)
        bar.beginBoardEntry()
        let ribbon=try XCTUnwrap(bar.container.children.first{$0 is SKCropNode})
        let paint=try XCTUnwrap(ribbon.children.compactMap{$0 as? SKSpriteNode}.last)
        let duration=NativePreloadBarPresentation.chromeDuration(entering:true)
        var reveal:Float=0
        for elapsed in stride(from:0.0,through:duration+0.02,by:0.01){
            bar.paintBoardEntry(elapsed)
            XCTAssertEqual(ribbon.position,.zero,"Entry must not compete with mask through vertical motion")
            XCTAssertEqual(ribbon.xScale,1);XCTAssertEqual(ribbon.yScale,1)
            let edge=try XCTUnwrap(paint.shader?.uniformNamed("u_reveal")).floatValue
            if elapsed<JimiV9ArchedNavigationTitle.elementDuration{XCTAssertEqual(edge,0)}
            XCTAssertGreaterThanOrEqual(edge,reveal);reveal=edge
        }
        XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(demands,[true,false])
        let frozen=ribbon.position;bar.paintBoardEntry(duration+10);XCTAssertEqual(ribbon.position,frozen)
        XCTAssertFalse(bar.container.hasActions())
    }
    func testHolderFinishesBeforeRestoredLiquidStartsOnPhoneTabletAndRestart() throws {
        for pad in [false,true] {for restart in [false,true] {
            let bar=NativePreloadBarPresentation(isPad:pad,reducedMotion:{false}),mounted=mount(bar)
            defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
            bar.resize(maximum:343.2,barHeight:10)
            bar.setNativeFill(left:0,width:240,maximum:343.2)
            bar.primeBoardEntry(restart:restart);bar.beginBoardEntry(restart:restart)
            let ribbon=try XCTUnwrap(bar.container.children.first{$0 is SKCropNode})
            let paint=try XCTUnwrap(ribbon.children.compactMap{$0 as? SKSpriteNode}.last)
            let maskEnd=NativePreloadBarPresentation.holderEntryDuration(restart:restart)
            for elapsed in stride(from:0.0,through:maskEnd,by:0.01) {
                bar.paintBoardEntry(elapsed)
                XCTAssertEqual(bar.liquidFillFraction,0)
                XCTAssertEqual(paint.shader?.uniformNamed("u_visible")?.floatValue,0)
                XCTAssertFalse(bar.smokeAdmitted)
            }
            func capture(_ name:String) throws {
                guard !pad,!restart else{return}
                let texture=try XCTUnwrap(mounted.1.texture(from:bar.container))
                let attachment=XCTAttachment(image:UIImage(cgImage:texture.cgImage()))
                attachment.name=name;attachment.lifetime = .keepAlways;add(attachment)
            }
            bar.paintBoardEntry(maskEnd)
            try capture("holder-complete-liquid-empty")
            XCTAssertEqual(bar.lifecycleReveal,1)
            XCTAssertEqual(bar.liquidFillFraction,0)
            bar.paintBoardEntry(maskEnd+NativePreloadBarPresentation.entryFillDuration/2)
            XCTAssertEqual(bar.lifecycleReveal,1)
            XCTAssertGreaterThan(bar.liquidFillFraction,0);XCTAssertLessThan(bar.liquidFillFraction,1)
            XCTAssertLessThan(try XCTUnwrap(paint.shader?.uniformNamed("u_right")).floatValue,240)
            try capture("holder-complete-liquid-filling")
            let fraction=bar.liquidFillFraction
            _=bar.beginBoardExit(restart:restart);bar.paintBoardExit(0)
            XCTAssertEqual(bar.liquidFillFraction,fraction,"Interrupted fill cannot flash full on exit")
            bar.cancelBoardExit();bar.beginBoardEntry(restart:restart)
            bar.paintBoardEntry(NativePreloadBarPresentation.chromeDuration(entering:true,restart:restart))
            XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(bar.liquidFillFraction,1)
            XCTAssertEqual(try XCTUnwrap(paint.shader?.uniformNamed("u_right")).floatValue,240,accuracy:0.001)
        }}
    }

    func testMountedDividerWaitsHiddenThenBouncesWithMaskReveal() throws {
        for pad in [false,true] {
        let bar=NativePreloadBarPresentation(isPad:pad,dividerResourceRoot:NativeTestResources.root,reducedMotion:{false}),mounted=mount(bar)
        defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
        bar.resize(maximum:343.2,barHeight:10);bar.primeBoardEntry();bar.beginBoardEntry()
        let divider=try XCTUnwrap(bar.container.childNode(withName:"//native-preload-divider"))
        let motion=try XCTUnwrap(divider.parent)
        let onset=JimiV9ArchedNavigationTitle.elementDuration
        for elapsed in [0.0,onset/2,onset] {
            bar.paintBoardEntry(elapsed)
            XCTAssertEqual(motion.alpha,0);XCTAssertEqual(motion.position.y,-16,accuracy:0.0001)
            XCTAssertEqual(bar.lifecycleReveal,0)
        }
        bar.paintBoardEntry(onset+0.02)
        XCTAssertGreaterThan(bar.lifecycleReveal,0);XCTAssertGreaterThan(motion.alpha,0)
        XCTAssertLessThan(motion.alpha,1);XCTAssertGreaterThan(motion.position.y,-16)
        let travel=NativePreloadBarPresentation.holderEntryDuration()-onset
        var highest=0.0,lowestAfterLift=0.0
        for step in 1...100 {
            bar.paintBoardEntry(onset+travel*Double(step)/100)
            let y=Double(motion.position.y)
            highest=max(highest,y)
            if highest>2 {lowestAfterLift=min(lowestAfterLift,y)}
        }
        XCTAssertGreaterThan(highest,4,"Entry needs a clearly visible spring overshoot")
        XCTAssertLessThan(lowestAfterLift,-0.5,"Spring must rebound before settling")
        bar.paintBoardEntry(NativePreloadBarPresentation.chromeDuration(entering:true))
        XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(motion.position,.zero);XCTAssertEqual(motion.alpha,1)
    }

    }

    func testRestartMasksInPlaceAndKeepsDividerAcrossBothDirections() throws {
        for pad in [false,true] {
        let bar=NativePreloadBarPresentation(isPad:pad,dividerResourceRoot:NativeTestResources.root,reducedMotion:{false}),mounted=mount(bar)
        defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
        bar.resize(maximum:343.2,barHeight:10);bar.setNativeFill(left:0,width:180,maximum:343.2)
        let ribbon=try XCTUnwrap(bar.container.children.first{$0 is SKCropNode})
        let divider=try XCTUnwrap(bar.container.childNode(withName:"//native-preload-divider"))
        let dividerRoot=try XCTUnwrap(divider.parent)
        let exit=bar.beginBoardExit(restart:true)
        var previous=1.0
        for time in stride(from:0.0,through:exit+0.01,by:0.01) {
            bar.paintBoardExit(time)
            XCTAssertLessThanOrEqual(bar.lifecycleReveal,previous);previous=bar.lifecycleReveal
            XCTAssertEqual(ribbon.position,.zero);XCTAssertEqual(ribbon.xScale,1);XCTAssertEqual(ribbon.yScale,1)
            XCTAssertEqual(dividerRoot.position,.zero);XCTAssertEqual(dividerRoot.xScale,1);XCTAssertEqual(dividerRoot.alpha,1)
            XCTAssertFalse(divider.isHidden)
        }
        XCTAssertEqual(bar.phase,.gone);XCTAssertEqual(bar.lifecycleReveal,0)
        bar.primeBoardEntry(restart:true)
        XCTAssertFalse(bar.container.isHidden,"Incoming first paint already contains the fixed divider")
        XCTAssertFalse(divider.isHidden);XCTAssertEqual(dividerRoot.alpha,1)
        XCTAssertEqual(dividerRoot.position,.zero);XCTAssertTrue(ribbon.isHidden)
        bar.beginBoardEntry(restart:true)
        bar.paintBoardEntry(0.01);XCTAssertGreaterThan(bar.lifecycleReveal,0,"Restart's settled divider must not introduce the normal entry hold")
        previous=bar.lifecycleReveal
        let enter=NativePreloadBarPresentation.chromeDuration(entering:true,restart:true)
        for time in stride(from:0.02,through:enter+0.01,by:0.01) {
            bar.paintBoardEntry(time)
            XCTAssertGreaterThanOrEqual(bar.lifecycleReveal,previous);previous=bar.lifecycleReveal
            XCTAssertEqual(ribbon.position,.zero);XCTAssertEqual(dividerRoot.position.x,0);XCTAssertEqual(dividerRoot.alpha,1)
            XCTAssertEqual(dividerRoot.position,.zero);XCTAssertEqual(dividerRoot.xScale,1)
        }
        XCTAssertEqual(dividerRoot.position,.zero)
        XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(bar.lifecycleReveal,1);XCTAssertFalse(bar.container.hasActions())
    }

    }

    func testInterruptedExitCancelAndRepeatedDisposeRetireActualNodes() throws {
        weak var retired:NativePreloadBarPresentation?
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));defer{window.isHidden=true}
        try autoreleasepool {
            let bar=NativePreloadBarPresentation(reducedMotion:{false});retired=bar
            let mounted=mount(bar);defer{mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
            bar.resize(maximum:343.2,barHeight:10);bar.setNativeFill(left:0,width:200,maximum:343.2)
            bar.primeBoardEntry();bar.beginBoardEntry();bar.paintBoardEntry(0.45)
            let before=bar.lifecycleReveal,duration=bar.beginBoardExit()
            XCTAssertEqual(bar.lifecycleReveal,before,accuracy:0.000001)
            bar.paintBoardExit(duration/2);XCTAssertLessThan(bar.lifecycleReveal,before)
            bar.cancelBoardExit();XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(bar.lifecycleReveal,1)
            let second=bar.beginBoardExit();bar.paintBoardExit(second)
            XCTAssertEqual(bar.phase,.gone);XCTAssertFalse(bar.smokeAdmitted)
            bar.dispose();bar.dispose();XCTAssertNil(bar.container.parent)
            bar.beginBoardEntry();XCTAssertNil(bar.container.parent)
        }
        XCTAssertNil(retired)
    }
    func testGradientBirthColorsFollowLocalCoordinatesAndTabletArchKeepsCentre() throws {
        for pad in [false,true] {
            let bar=NativePreloadBarPresentation(isPad:pad,reducedMotion:{false}),mounted=mount(bar)
            defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
            bar.resize(maximum:340,barHeight:14)
            for (u,expected) in [(0.0,[234.0,139,87]),(0.5,[232.5,127.5,80.5]),(1.0,[231.0,116,74])] {
                let point=bar.smokePoint(atX:340*u,in:mounted.2),color=bar.smokeColor(point,in:mounted.2)
                var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0;color.getRed(&r,green:&g,blue:&b,alpha:&a)
                for (actual,want) in zip([r,g,b],expected){XCTAssertEqual(Double(actual)*255,want,accuracy:0.0001)}
                XCTAssertEqual(a,0.5)
            }
            if pad {
                XCTAssertEqual(bar.barCenterY,-5)
                let a=bar.smokeCurveOffset(bar.smokePoint(atX:0,in:mounted.2),in:mounted.2)
                let b=bar.smokeCurveOffset(bar.smokePoint(atX:170,in:mounted.2),in:mounted.2)
                XCTAssertGreaterThan(a.y,7);XCTAssertEqual(b,.zero)
            }
        }
    }
    func testReducedMotionUsesFiniteFadeAndSettlesAfterResize() throws {
        let bar=NativePreloadBarPresentation(reducedMotion:{true}),mounted=mount(bar)
        defer{bar.dispose();mounted.1.presentScene(nil);mounted.0.isHidden=true;mounted.0.rootViewController=nil}
        bar.resize(maximum:343.2,barHeight:10);bar.primeBoardEntry();bar.beginBoardEntry()
        let duration=NativePreloadBarPresentation.chromeDuration(entering:true,reduced:true)
        bar.paintBoardEntry(duration/2);bar.resize(maximum:350,barHeight:10)
        bar.paintBoardEntry(duration);XCTAssertEqual(bar.phase,.idle);XCTAssertEqual(bar.lifecycleReveal,1)
        let exit=bar.beginBoardExit();bar.paintBoardExit(exit);XCTAssertEqual(bar.phase,.gone)
    }
    func testProductionPhoneHUDArtworkFitsSmallReferenceAndWideScreens() throws {
        for size in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:430,height:932)] {
            let state=NativeBoardFactory.make(mode:.journey,board:2)
            let scene=NativeBoardScene(engine:NativeGameplayEngine(state:state),resourceRoot:NativeTestResources.root,size:size)
            defer{scene.dispose()}
            scene.layout(size:size,insets:.init(top:size.width==320 ? 20:47,left:0,bottom:34,right:0))
            for name in ["native-game-close","native-game-help","native-game-score-art","native-game-combo-art"] {
                let node=try XCTUnwrap(scene.childNode(withName:"//"+name)),parent=try XCTUnwrap(node.parent)
                let f=node.frame,a=scene.convert(CGPoint(x:f.minX,y:f.minY),from:parent),b=scene.convert(CGPoint(x:f.maxX,y:f.maxY),from:parent)
                XCTAssertGreaterThanOrEqual(min(a.x,b.x),0,"HUD artwork must fit at \(size.width): \(name)")
                XCTAssertLessThanOrEqual(max(a.x,b.x),size.width,"HUD artwork must fit at \(size.width): \(name)")
            }
        }
    }

    func testMiniTabletBridgeKeepsMainMeterOriginWithoutChangingCanonicalPadFlag() throws {
        let scene=SKScene(size:CGSize(width:744,height:1133)),canvas=SKNode(),stage=SKNode()
        scene.addChild(canvas);canvas.addChild(stage)
        let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let timeouts=NativeSourceAppTimeoutOwner()
        let owner=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:500,isPad:false,sourceOrigin:CGPoint(x:40,y:900),barHeight:14,preloadDividerRoot:NativeTestResources.root,sourceToNative:{$0},nativeToSource:{$0},smokeDisabled:{true},current:{true},visualRandom:{0.5})
        defer{owner.dispose();timeouts.cancelAll();service.dispose();view.presentScene(nil)}
        let surface=try XCTUnwrap(scene.childNode(withName:"//native-preload-bar"))
        XCTAssertEqual(surface.position,CGPoint(x:40,y:900))
        let divider=try XCTUnwrap(surface.childNode(withName:"//native-preload-divider") as? SKSpriteNode)
        XCTAssertNotNil(divider.texture);XCTAssertFalse(divider.isHidden)
        owner.resize(maximum:540,sourceOrigin:CGPoint(x:50,y:850),barHeight:14)
        XCTAssertEqual(surface.position,CGPoint(x:50,y:850))
        XCTAssertEqual(canvas.children.filter{$0.name=="native-preload-bar"}.count,1)
        owner.dispose();owner.dispose();XCTAssertNil(surface.parent)
        XCTAssertEqual(timeouts.pendingCount,0);XCTAssertEqual(service.activeParticipantCount,0)
    }

    func testRestartPrimeKeepsDividerVisibleWhenSourceOwnerSynchronizesFirstFrame() throws {
        let scene=SKScene(size:CGSize(width:390,height:844)),stage=SKNode()
        scene.addChild(stage)
        let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),timeouts=NativeSourceAppTimeoutOwner()
        let owner=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:343.2,isPad:false,sourceOrigin:CGPoint(x:24,y:700),preloadDividerRoot:NativeTestResources.root,sourceToNative:{$0},nativeToSource:{$0},smokeDisabled:{true},current:{true},visualRandom:{0.5})
        defer{owner.dispose();timeouts.cancelAll();service.dispose();view.presentScene(nil)}
        owner.primeBoardEntry(restart:true);owner.synchronizePreloadSurfaceVisibility()
        let surface=try XCTUnwrap(scene.childNode(withName:"//native-preload-bar"))
        let divider=try XCTUnwrap(surface.childNode(withName:"//native-preload-divider")),motion=try XCTUnwrap(divider.parent)
        let ribbon=try XCTUnwrap(surface.children.first{$0 is SKCropNode})
        XCTAssertFalse(surface.isHidden);XCTAssertFalse(divider.isHidden);XCTAssertTrue(ribbon.isHidden)
        XCTAssertEqual(motion.position,.zero);XCTAssertEqual(motion.alpha,1)
        owner.beginBoardEntry(restart:true)
        for time in [0.0,0.10,0.25,0.50,1.0] {
            owner.paintPreloadBoardEntry(time);owner.synchronizePreloadSurfaceVisibility()
            XCTAssertFalse(surface.isHidden);XCTAssertFalse(divider.isHidden)
            XCTAssertEqual(motion.position,.zero);XCTAssertEqual(motion.alpha,1)
            XCTAssertEqual(motion.xScale,1);XCTAssertEqual(motion.yScale,1)
        }
        owner.primeBoardEntry();owner.synchronizePreloadSurfaceVisibility()
        XCTAssertTrue(surface.isHidden,"Ordinary fresh entry still owns its full divider bounce")
    }

    func testPhoneSizedBootstrapRelayoutUsesCurrentTabletOriginAndWidth() throws {
        for size in [CGSize(width:744,height:1133),CGSize(width:820,height:1180),CGSize(width:1032,height:1376)] {
            let scene=SKScene(size:CGSize(width:390,height:844)),stage=SKNode()
            scene.addChild(stage)
            let view=SKView(frame:CGRect(origin:.zero,size:scene.size));view.presentScene(scene)
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0}),timeouts=NativeSourceAppTimeoutOwner()
            let owner=NativeWildMeterHUDPresentation(hudStage:stage,service:service,timeouts:timeouts,generation:1,maximum:343.2,isPad:false,sourceOrigin:CGPoint(x:24,y:700),preloadDividerRoot:NativeTestResources.root,sourceToNative:{$0},nativeToSource:{$0},smokeDisabled:{true},current:{true},visualRandom:{0.5})
            defer{owner.dispose();timeouts.cancelAll();service.dispose();view.presentScene(nil)}
            scene.size=size;view.frame=CGRect(origin:.zero,size:size)
            let grid=NativeBoardGeometry(columns:7,rows:8,viewport:size,safeInsets:.init(top:24,left:0,bottom:20,right:0))
            let width=7*NativeBoardGeometry.tile*grid.scale+6*NativeBoardGeometry.gap*grid.scale
            let chrome=NativeGameplayChromePlan.make(viewport:size,safeTop:24,boardBounds:CGRect(x:grid.origin.x,y:0,width:width,height:0))
            let origin=CGPoint(x:chrome.meterRect.minX,y:chrome.meterRect.maxY)
            // Even a relayout that retains the same logical span must refresh
            // phone ribbon geometry before the canonical width catches up.
            owner.resize(maximum:343.2,sourceOrigin:origin,barHeight:10)
            let surface=try XCTUnwrap(scene.childNode(withName:"//native-preload-bar"))
            let ribbon=try XCTUnwrap(surface.children.first{$0 is SKCropNode})
            let paint=try XCTUnwrap(ribbon.children.compactMap{$0 as? SKSpriteNode}.last)
            XCTAssertEqual(paint.shader?.uniformNamed("u_radius")?.floatValue ?? 0,5,accuracy:0.001)
            owner.resize(maximum:width,sourceOrigin:origin,barHeight:chrome.meterRect.height)
            owner.synchronizePreloadSurfaceVisibility()
            XCTAssertEqual(surface.position.x,origin.x,accuracy:0.001)
            XCTAssertEqual(surface.position.y,origin.y,accuracy:0.001,"A late tablet layout must retire the phone Y recipe")
            XCTAssertEqual(paint.shader?.uniformNamed("u_width")?.floatValue ?? 0,Float(width),accuracy:0.001)
            XCTAssertGreaterThan(paint.shader?.uniformNamed("u_arch")?.floatValue ?? 0,0)
            let boardTop=grid.origin.y+(8*NativeBoardGeometry.tile+7*NativeBoardGeometry.gap)*grid.scale
            XCTAssertGreaterThan(origin.y-5-chrome.meterRect.height/2,boardTop)
            let divider=try XCTUnwrap(surface.childNode(withName:"//native-preload-divider") as? SKSpriteNode)
            XCTAssertGreaterThanOrEqual(divider.size.width,size.width)
        }
    }

}
