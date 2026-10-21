import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeThemedBoardTransitionLifecycleTests:XCTestCase {
    private final class Resources:NativeBoardTransitionResources {
        var prepared:[Int:[String]]=[:],pending:[(Bool)->Void]=[],released:[Int]=[]
        lazy var pixel:UIImage=UIGraphicsImageRenderer(size:CGSize(width:2,height:2)).image{_ in UIColor.white.setFill();UIBezierPath(rect:CGRect(x:0,y:0,width:2,height:2)).fill()}
        func image(_ path:String,owner:Int)->UIImage? {pixel}
        func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping (Bool)->Void){prepared[owner]=paths;pending.append(completion)}
        func release(_ owner:Int){released.append(owner)}
        func accept(){while !pending.isEmpty{let callback=pending.removeFirst();callback(true)}}
    }
    private func make(board:Int,resources:Resources,generation:UInt64=9)->NativeThemedBoardTransitionController {
        NativeThemedBoardTransitionController(root:URL(fileURLWithPath:"/unused"),board:board,viewport:CGSize(width:390,height:844),generation:generation,resources:resources,font:.systemFont(ofSize:166),random:{0.37})
    }
    private final class DepthResources:NativeBoardTransitionResources {
        let mountain:UIImage,cloud:UIImage,clear:UIImage
        init(){
            func image(_ color:UIColor)->UIImage {UIGraphicsImageRenderer(size:CGSize(width:2,height:2)).image{ctx in color.setFill();ctx.fill(CGRect(x:0,y:0,width:2,height:2))}}
            mountain=image(.cyan);cloud=image(.magenta);clear=image(.clear)
        }
        func image(_ path:String,owner:Int)->UIImage? {
            if path.hasSuffix("mountain.png"){return mountain}
            if path.contains("oblak"){return cloud}
            return clear
        }
        func prepare(_ paths:[String],owner:Int,required:Bool,completion:@escaping (Bool)->Void){completion(true)}
        func release(_ owner:Int){}
    }
    func testRearCloudCannotCrossMountainDuringActualDigitPerspectiveExit()async throws {
        let resources=DepthResources()
        let owner=NativeThemedBoardTransitionController(root:URL(fileURLWithPath:"/unused"),board:2,viewport:CGSize(width:390,height:844),generation:9,resources:resources,font:.systemFont(ofSize:166),random:{0.37})
        let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));window.rootViewController=owner;window.makeKeyAndVisible()
        defer{owner.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
        owner.start();owner.view.layoutIfNeeded()
        try await Task.sleep(for:.milliseconds(30))
        func views(_ view:UIView)->[UIView]{[view]+view.subviews.flatMap{views($0)}}
        let all=views(owner.view)
        let mountain=try XCTUnwrap(all.compactMap{$0 as? UIImageView}.first{$0.image === resources.mountain})
        let clouds=all.compactMap{$0 as? UIImageView}.filter{$0.image === resources.cloud}
        let cloud=try XCTUnwrap(clouds.first{$0.superview?.layer.zPosition==1})
        let host=try XCTUnwrap(cloud.superview)
        for seconds in [2.35,2.4,2.45,2.48,2.5,2.52,2.55,2.6] {
            owner.paint(seconds:seconds,generation:9)
            for other in clouds where other !== cloud {other.superview?.isHidden=true}
            let point=mountain.convert(CGPoint(x:mountain.bounds.midX,y:mountain.bounds.midY),to:owner.view)
            host.layer.position=CGPoint(x:point.x-host.transform.tx,y:point.y-host.transform.ty)
            CATransaction.flush()
            let format=UIGraphicsImageRendererFormat();format.scale=1;format.preferredRange = .standard
            let image=UIGraphicsImageRenderer(bounds:window.bounds,format:format).image{_ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true)}
            let pixel=try XCTUnwrap(image.cgImage?.cropping(to:CGRect(x:point.x.rounded(),y:point.y.rounded(),width:1,height:1)))
            var rgba=[UInt8](repeating:0,count:4)
            rgba.withUnsafeMutableBytes{buffer in
                let context=CGContext(data:buffer.baseAddress,width:1,height:1,bitsPerComponent:8,bytesPerRow:4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!
                context.draw(pixel,in:CGRect(x:0,y:0,width:1,height:1))
            }
            XCTAssertLessThan(rgba[0],20,"Rear cloud crossed the mountain at \(seconds)")
            XCTAssertGreaterThan(rgba[1],235,"Mountain must cover cloud at \(seconds)")
            XCTAssertGreaterThan(rgba[2],235)
            let attachment=XCTAttachment(image:image);attachment.name="forest-depth-\(seconds)";attachment.lifetime = .keepAlways;add(attachment)
        }
    }
    func testAllThemesKeepDigitPerspectiveInsideFixedNNUnit()throws {
        for board in [2,12,22] {
            let resources=Resources(),owner=make(board:board,resources:resources)
            owner.start();resources.accept();defer{owner.dispose()}
            let unit=try XCTUnwrap(owner.view.subviews.first{$0.subviews.compactMap{$0 as? UILabel}.count==2})
            let labels=unit.subviews.compactMap{$0 as? UILabel}
            XCTAssertEqual(unit.layer.zPosition,10);XCTAssertEqual(unit.frame,owner.view.bounds)
            XCTAssertTrue(owner.view.subviews.compactMap{$0 as? UILabel}.isEmpty)
            let exit=board==22 ? 2.681:1.75
            for age in [0.1,0.25,0.35,0.4,0.6,0.75] {
                owner.paint(seconds:exit+0.35+age,generation:9)
                XCTAssertEqual(unit.layer.zPosition,10)
                XCTAssertTrue(CATransform3DIsIdentity(unit.layer.transform))
                XCTAssertTrue(owner.view.subviews.allSatisfy{CATransform3DIsAffine($0.layer.transform)},"Only the NN children own perspective; root stacking planes stay affine")
                XCTAssertTrue(labels.allSatisfy{$0.superview === unit})
            }
            XCTAssertFalse(CATransform3DIsAffine(labels[1].layer.transform),"Authored 3D motion is retained inside the Unit")
            owner.dispose();XCTAssertNil(unit.superview);XCTAssertTrue(unit.subviews.isEmpty)
        }
    }
    func testCompletedCloudsReleaseArtworkAndFreezeLastTransformAcrossAllThemes() {
        for board in [1,11,21] {
            let resources=Resources(),owner=make(board:board,resources:resources)
            owner.start();resources.accept();defer{owner.dispose()}
            func hosts(_ view:UIView)->[UIView] {
                view.subviews.flatMap { child -> [UIView] in
                    if type(of:child)==UIView.self,child.subviews.count==1,child.subviews[0] is UIImageView,
                       child.bounds.width<240,child.bounds.height<240,
                       [CGFloat(1),2,5,15].contains(child.layer.zPosition) {return [child]}
                    return hosts(child)
                }
            }
            let clouds=hosts(owner.view)
            XCTAssertEqual(clouds.count,board==11 ? 6:8)
            var frozen:[ObjectIdentifier:(CGAffineTransform,CGAffineTransform)]=[:]
            for frame in 0...900 {
                owner.paint(seconds:Double(frame)/120,generation:9)
                for host in clouds {
                    let image=host.subviews[0] as! UIImageView,key=ObjectIdentifier(host)
                    if let pose=frozen[key] {
                        XCTAssertTrue(host.isHidden);XCTAssertNil(image.image);XCTAssertEqual(image.alpha,0)
                        XCTAssertEqual(host.transform,pose.0);XCTAssertEqual(image.transform,pose.1)
                    } else if image.image==nil {
                        XCTAssertTrue(host.isHidden);XCTAssertEqual(image.alpha,0)
                        XCTAssertNotEqual(image.transform.a*image.transform.d-image.transform.b*image.transform.c,0)
                        frozen[key]=(host.transform,image.transform)
                    }
                }
            }
            XCTAssertEqual(frozen.count,clouds.count)
        }
    }
    func testAllThemeCloudExitsShrinkContinuouslyFromActualSizeAtBothDisplayRates()throws {
        for board in [2,11,21] {
            for randomValue in [0.0,0.999999] {
                for fps in [60.0,120.0] {
                    let resources=DepthResources()
                    let owner=NativeThemedBoardTransitionController(root:URL(fileURLWithPath:"/unused"),board:board,viewport:CGSize(width:390,height:844),generation:9,resources:resources,font:.systemFont(ofSize:166),random:{randomValue})
                    owner.start();defer{owner.dispose()}
                    func images(_ view:UIView)->[UIImageView] {view.subviews.flatMap{child in (child as? UIImageView).map{[$0]} ?? images(child)}}
                    let clouds=images(owner.view).filter{$0.image === resources.cloud}
                    XCTAssertEqual(clouds.count,board==11 ? 6:8)
                    func scales(_ sprite:UIImageView)->(CGFloat,CGFloat) {
                        let t=sprite.transform
                        return (hypot(t.a,t.b),hypot(t.c,t.d))
                    }
                    let exit=board==21 ? 2.35+NativeBoardTransitionPlan.airCombatHold(minimum:0,duration:3.001,elapsed:2.35)+0.9:2.65,duration=0.595
                    owner.paint(seconds:exit-0.000001,generation:9)
                    let initial=clouds.map{scales($0).0}
                    owner.paint(seconds:exit,generation:9)
                    for (index,sprite) in clouds.enumerated() {
                        XCTAssertEqual(scales(sprite).0,initial[index],accuracy:0.000001,"Exit must capture each cloud's actual rest size")
                    }
                    var previous=initial
                    for frame in 1...Int(ceil(duration*fps))-1 {
                        owner.paint(seconds:exit+Double(frame)/fps,generation:9)
                        for (index,sprite) in clouds.enumerated() {
                            let (x,y)=scales(sprite)
                            XCTAssertNotNil(sprite.image);XCTAssertFalse(sprite.superview!.isHidden)
                            XCTAssertEqual(x,y,accuracy:0.000001,"Every theme must preserve aspect ratio")
                            XCTAssertLessThanOrEqual(x,previous[index]+0.000001,"Final exit must never rebound or flash larger")
                            XCTAssertLessThanOrEqual(previous[index]-x,initial[index]*CGFloat(1.6/(duration*fps)),"A single frame must not normalize the cloud to a fixed scale")
                            XCTAssertGreaterThan(x,0)
                            previous[index]=x
                        }
                    }
                    owner.paint(seconds:exit+duration-0.000001,generation:9)
                    for sprite in clouds {XCTAssertNotNil(sprite.image);XCTAssertFalse(sprite.superview!.isHidden)}
                    owner.paint(seconds:exit+duration,generation:9)
                    for sprite in clouds {
                        XCTAssertNil(sprite.image);XCTAssertEqual(sprite.alpha,0);XCTAssertTrue(sprite.superview!.isHidden)
                        XCTAssertGreaterThan(scales(sprite).0,0,"Retirement must preserve the last nonsingular transform")
                    }
                }
            }
        }
    }
    func testCloudHostsKeepTheirParentDepthAndNeverAcquireImplicitAnimations() {
        for board in [1,11,21] {
            let resources=Resources(),owner=make(board:board,resources:resources)
            owner.start();resources.accept()
            func hosts(_ view:UIView)->[UIView] {
                view.subviews.flatMap { child -> [UIView] in
                    if type(of:child)==UIView.self,child.subviews.count==1,child.subviews[0] is UIImageView,
                       child.bounds.width<240,child.bounds.height<240,
                       [CGFloat(1),2,5,15].contains(child.layer.zPosition) {return [child]}
                    return hosts(child)
                }
            }
            let clouds=hosts(owner.view)
            XCTAssertEqual(clouds.count,board==11 ? 6:8)
            let parents=clouds.map { $0.superview },depths=clouds.map { $0.layer.zPosition }
            for seconds in [1.749,1.751,2.054,2.056,2.649,2.651,3.244,3.246] {
                owner.paint(seconds:seconds,generation:9)
                for (index,host) in clouds.enumerated() {
                    XCTAssertTrue(host.superview === parents[index])
                    XCTAssertEqual(host.layer.zPosition,depths[index])
                    XCTAssertTrue(host.layer.animationKeys()?.isEmpty ?? true)
                    let sprite=host.subviews[0]
                    if sprite.alpha==0 {XCTAssertTrue(host.isHidden)}
                    if board==1,depths[index]==2,seconds>=3.245 {XCTAssertTrue(host.isHidden)}
                }
            }
            owner.dispose()
        }
    }
    func testEachAuthoredSceneRetainsOpaquePaperUntilExplicitPreparedBoardRelease() {
        for (board,end) in [(1,3.781),(11,3.331),(21,4.197)] {
            let resources=Resources(),owner=make(board:board,resources:resources)
            var exits=0,audio:[Bool]=[],cues:[String]=[],haptics:[String]=[],music:[(String,Double,Double)]=[]
            owner.onMusicPhase={music.append(($0,$1,$2))}
            owner.onSceneExit={generation in XCTAssertEqual(generation,9);exits += 1;XCTAssertTrue(owner.retainsOpaqueCover);XCTAssertEqual(music.last?.0,"complete")}
            owner.onAudioCleanup={audio.append($0)};owner.onCue={cues.append("\($0):\($1)")};owner.onHaptic={haptics.append($0)}
            owner.start();owner.start();XCTAssertFalse(owner.assetsReady);XCTAssertFalse(owner.hasActiveClock)
            owner.releaseCover(generation:9);XCTAssertTrue(resources.released.isEmpty)
            resources.accept();XCTAssertTrue(owner.assetsReady);XCTAssertTrue(owner.hasActiveClock)
            XCTAssertEqual(resources.prepared.values.flatMap{$0}.count,owner.selectedAssetCount+1)
            owner.paint(seconds:end-0.01,generation:9);XCTAssertEqual(exits,0)
            owner.paint(seconds:end,generation:9);XCTAssertEqual(exits,1);XCTAssertFalse(owner.hasActiveClock)
            XCTAssertEqual(music.map{$0.0},["begin","hold","exit","complete"])
            XCTAssertEqual(music.map{$0.1},[0.62,0.5,0.2,0.33])
            let enter=board==21 ? 2.35:1.35,exitAt=board==21 ? 2.681:1.75
            XCTAssertEqual(music[0].2,enter,accuracy:0.000001)
            XCTAssertEqual(music[1].2,exitAt-enter,accuracy:0.000001)
            XCTAssertEqual(music[2].2,end-exitAt,accuracy:0.000001)
            XCTAssertEqual(music[3].2,0.32,accuracy:0.000001)
            XCTAssertEqual(resources.released.count,1);XCTAssertEqual(audio,[false]);XCTAssertEqual(haptics,["light","light","light","light"])
            XCTAssertTrue(cues.contains("digit:0"));XCTAssertTrue(cues.contains("digit:1"))
            if board==21 {XCTAssertEqual(cues,["area55-start:0","area55-beam:1","digit:0","digit:1","area55-beam:2"])}
            owner.paint(seconds:20,generation:9);owner.releaseCover(generation:8)
            XCTAssertTrue(owner.retainsOpaqueCover);XCTAssertEqual(exits,1);XCTAssertEqual(resources.released.count,1)
            XCTAssertEqual(music.count,4)
            owner.releaseCover(generation:9);owner.dispose();XCTAssertFalse(owner.retainsOpaqueCover)
            XCTAssertEqual(resources.released.count,2);XCTAssertEqual(Set(resources.released).count,2);XCTAssertEqual(audio,[false])
        }
    }
    func testColdBackgroundPreparationWaitsAndStaleOrDisposedClockCannotEmitContacts() {
        let resources=Resources(),owner=make(board:1,resources:resources)
        var exits=0,cues=0,audio:[Bool]=[];owner.onSceneExit={_ in exits += 1};owner.onCue={_,_ in cues += 1};owner.onAudioCleanup={audio.append($0)}
        owner.start();owner.setForeground(false);resources.accept()
        XCTAssertTrue(owner.assetsReady);XCTAssertFalse(owner.hasActiveClock)
        owner.paint(seconds:20,generation:9);XCTAssertEqual(exits,0);XCTAssertEqual(cues,0)
        owner.setForeground(true);XCTAssertTrue(owner.hasActiveClock)
        owner.paint(seconds:20,generation:8);XCTAssertEqual(exits,0);XCTAssertEqual(cues,0)
        owner.paint(seconds:0.7,generation:9);XCTAssertGreaterThan(cues,0)
        let contacts=cues,cleanup=owner.captureCleanup();cleanup();cleanup()
        owner.setForeground(true);owner.paint(seconds:20,generation:9)
        XCTAssertFalse(owner.hasActiveClock);XCTAssertEqual(exits,0);XCTAssertEqual(cues,contacts);XCTAssertEqual(audio,[true]);XCTAssertEqual(resources.released.count,2)
    }
    func testDisposedLateAssetsAndFailedRequiredAssetsNeverStartReducedScene() {
        let resources=Resources(),owner=make(board:21,resources:resources);var exits=0
        owner.onSceneExit={_ in exits += 1};owner.start();owner.dispose();resources.accept()
        XCTAssertFalse(owner.assetsReady);XCTAssertFalse(owner.hasActiveClock);XCTAssertEqual(exits,0);XCTAssertEqual(resources.released.count,2)
        let failed=Resources(),blocked=make(board:11,resources:failed);var failures=0
        blocked.onAssetFailure={failures += 1};blocked.onSceneExit={_ in XCTFail("Missing authored scene cannot enter gameplay")}
        blocked.start();failed.pending.removeFirst()(false)
        XCTAssertEqual(failures,1);XCTAssertFalse(blocked.assetsReady);XCTAssertFalse(blocked.hasActiveClock)
        blocked.paint(seconds:10,generation:9);blocked.dispose()
    }
    func testBeachSideSequenceAlternatesWithoutRerollAndRoboDirectionKeepsOppositeWalker() {
        let owner=NativeThemedTransitionVariationOwner();var draws=0
        func random()->Double{draws += 1;return 0.1}
        XCTAssertTrue(owner.next(theme:.beach,random:random).beachSwapped)
        XCTAssertFalse(owner.next(theme:.beach,random:random).beachSwapped)
        XCTAssertTrue(owner.next(theme:.beach,random:random).beachSwapped);XCTAssertEqual(draws,1)
        let robo=owner.next(theme:.area55,random:random);XCTAssertEqual(robo.frontDirection,1);XCTAssertEqual(robo.walkerDirection,-1);XCTAssertEqual(draws,2)
    }
    func testColdJourneyEntryCannotExposeFlatOpaqueCoverBeforePaperTexture(){
        for board in [1,11,21] {
            let resources=Resources(),owner=make(board:board,resources:resources)
            owner.start()
            XCTAssertFalse(owner.view.isOpaque)
            XCTAssertEqual(owner.view.backgroundColor,.clear)
            let cover=owner.view.subviews.first
            XCTAssertTrue(cover?.isHidden == true)
            XCTAssertFalse(owner.assetsReady);XCTAssertFalse(owner.hasActiveClock)
            resources.pending.removeFirst()(true)
            XCTAssertFalse(owner.view.isOpaque);XCTAssertTrue(cover?.isHidden ?? false)
            XCTAssertNotNil(cover?.subviews.compactMap{$0 as? UIImageView}.first?.image)
            XCTAssertFalse(owner.assetsReady);XCTAssertFalse(owner.hasActiveClock)
            resources.accept();XCTAssertTrue(owner.assetsReady)
            XCTAssertTrue(owner.view.isOpaque);XCTAssertFalse(cover?.isHidden ?? true)
            XCTAssertEqual(owner.view.alpha,0,"Prepared scene starts its original fade atomically with the textured cover")
            owner.dispose()
        }
    }
    func testFailedOrDisposedPendingPaperCannotRevealEmptyCover(){
        let resources=Resources(),owner=make(board:1,resources:resources)
        owner.start();resources.pending.removeFirst()(false)
        XCTAssertFalse(owner.view.isOpaque);XCTAssertTrue(owner.view.subviews.first?.isHidden == true)
        owner.dispose()
        let late=Resources(),disposed=make(board:11,resources:late)
        disposed.start();disposed.dispose();late.accept()
        XCTAssertFalse(disposed.view.isOpaque);XCTAssertTrue(disposed.view.subviews.first?.isHidden == true)
    }

}
