import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeJourneyBottomDecorTests:XCTestCase {
    private final class Random {
        var seed:UInt32,draws=0
        init(_ value:UInt32){seed=value}
        func next()->Double {draws += 1;seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296}
    }
    private final class Resources:NativeJourneyBottomDecorResourcePreparing {
        var decodedBytes=0,requests:[(UIImage?)->Void]=[],paths:[String]=[],cancellations=0,releases=0
        func prepare(path:String,completion:@escaping(UIImage?)->Void){paths.append(path);requests.append(completion)}
        func cancelPendingPreparation(){cancellations += 1}
        func release(){releases += 1;decodedBytes=0}
        func finish(_ index:Int,image:UIImage?){decodedBytes=image==nil ? 0:32;requests[index](image)}
    }
    private func testImage()->UIImage {UIGraphicsImageRenderer(size:CGSize(width:2,height:1)).image{_ in UIColor.white.setFill();UIBezierPath(rect:CGRect(x:0,y:0,width:2,height:1)).fill()}}
    private func owner(resources:Resources,board:Int=1,generation:UInt64=1,current:@escaping(UInt64)->Bool={_ in true})->NativeJourneyBottomDecorOwner {
        NativeJourneyBottomDecorOwner(root:NativeTestResources.root,board:board,viewport:CGSize(width:390,height:844),generation:generation,isCurrent:current,catalog:NativeJourneyBottomDecorCatalog(),resources:resources,density:2,isApplicationActive:{true},random:{0.4})
    }
    private func assertPose(_ p:NativeJourneyBottomDecorPlan.Pose,_ values:[Double],file:StaticString=#filePath,line:UInt=#line) {
        for(a,b)in zip([p.x,p.y,p.scaleX,p.scaleY,p.opacity],values){XCTAssertEqual(a,b,accuracy:0.000001,file:file,line:line)}
    }
    func testOriginalAssetMapWarmupAndPerBoardForestCacheAcross180Visits() {
        for session in NativeJourneyBottomDecorSourceOracle.payload.assets {
            let catalog=NativeJourneyBottomDecorCatalog(),random=Random(session.seed)
            for row in session.records {
                let asset=catalog.asset(board:row.board,random:random.next)
                XCTAssertEqual(asset.key,row.key);XCTAssertEqual(asset.oneX,row.oneX);XCTAssertEqual(asset.twoX,row.twoX)
                let one=asset.oneX.replacingOccurrences(of:" ",with:"%20")
                XCTAssertEqual(row.warmSource,one)
                XCTAssertEqual(row.warmSrcset,asset.twoX.map{one+" 1x, "+$0.replacingOccurrences(of:" ",with:"%20")+" 2x"} ?? one+" 1x")
                for density in [1.0,2,3] {XCTAssertEqual(asset.path(density:density),density>1 ? (row.twoX ?? row.oneX):row.oneX)}
            }
            XCTAssertEqual(random.draws,session.draws);XCTAssertEqual(random.draws,10)
        }
    }
    func testOriginalVisibleOwnerActualGsapEntryAndFiveCapturedExitPoses() {
        for row in NativeJourneyBottomDecorSourceOracle.payload.motions {
            for sample in row.enter {assertPose(NativeJourneyBottomDecorPlan.enter(seconds:sample[0]),Array(sample.dropFirst()))}
            let p=row.initial,start=NativeJourneyBottomDecorPlan.Pose(x:p[0],y:p[1],scaleX:p[2],scaleY:p[3],opacity:p[4])
            for sample in row.exit {assertPose(NativeJourneyBottomDecorPlan.exit(seconds:sample[0],from:start),Array(sample.dropFirst()))}
            XCTAssertTrue(row.hidden)
        }
    }
    func testColdEnterQueuesUntilSelectedAssetReadyAndSettledFooterHasNoClock() {
        let resources=Resources(),owner=owner(resources:resources);var ready:[Bool]=[]
        owner.enter();owner.prepare{ready.append($0)}
        XCTAssertFalse(owner.isPrepared);XCTAssertFalse(owner.hasActiveClock);XCTAssertEqual(resources.paths.count,1)
        resources.finish(0,image:testImage())
        XCTAssertEqual(ready,[true]);XCTAssertEqual(owner.phase,.entering)
        owner.paint(seconds:0.62,generation:1)
        XCTAssertEqual(owner.pose,NativeJourneyBottomDecorPlan.visible);XCTAssertEqual(owner.phase,.visible);XCTAssertFalse(owner.hasActiveClock)
        owner.dispose();XCTAssertEqual(resources.releases,1);XCTAssertEqual(owner.decodedBytes,0)
    }
    func testBackgroundCancelsQueuedAssetAndLateReplyCannotAdoptOrResurrect() {
        let resources=Resources(),owner=owner(resources:resources);var first:[Bool]=[],second:[Bool]=[]
        owner.prepare{first.append($0)};owner.setForeground(false)
        XCTAssertEqual(first,[false]);resources.finish(0,image:testImage());XCTAssertFalse(owner.isPrepared);XCTAssertFalse(owner.hasActiveClock)
        owner.setForeground(true);owner.prepare{second.append($0)};resources.finish(0,image:testImage())
        XCTAssertTrue(second.isEmpty);resources.finish(1,image:testImage());XCTAssertEqual(second,[true])
        owner.dispose();resources.finish(1,image:testImage());XCTAssertEqual(first,[false]);XCTAssertEqual(second,[true]);XCTAssertEqual(owner.phase,.disposed)
    }
    func testGenerationReplacementSettlesPendingPreparationWithoutInvisibleEntry() {
        var generation:UInt64=1;let resources=Resources(),owner=owner(resources:resources,current:{$0==generation});var replies:[Bool]=[]
        owner.prepare{replies.append($0)};generation=2;resources.finish(0,image:testImage())
        XCTAssertEqual(replies,[false]);XCTAssertEqual(owner.phase,.disposed);XCTAssertFalse(owner.isPrepared);XCTAssertFalse(owner.hasActiveClock)
    }
    func testExitCapturesRealMidEntryAndShakeThenClearsHiddenTransformOnce() {
        let resources=Resources(),owner=owner(resources:resources),row=NativeJourneyBottomDecorSourceOracle.payload.motions.first{$0.capture==0.17}!
        owner.enter();resources.finish(0,image:testImage());owner.paint(seconds:0.17,generation:1)
        owner.applyShake(sourceOffset:CGPoint(x:-2,y:3),generation:1);XCTAssertEqual(owner.captureShakePose(),CGPoint(x:-2,y:3))
        var exits:[Bool]=[];owner.exit{exits.append($0)}
        for sample in row.exit {owner.paint(seconds:sample[0],generation:1);assertPose(owner.pose,Array(sample.dropFirst()))}
        owner.paint(seconds:0.44,generation:1);owner.paint(seconds:1,generation:1)
        XCTAssertEqual(exits,[true]);XCTAssertEqual(owner.phase,.hidden);XCTAssertFalse(owner.hasActiveClock)
        let image=owner.subviews.compactMap{$0 as? UIImageView}.first!
        XCTAssertTrue(image.isHidden);XCTAssertEqual(image.transform,.identity);owner.dispose();XCTAssertEqual(exits,[true])
    }
    func testActualOriginalHighDensityAssetAndResponsiveBottomAnchor() async throws {
        let row=NativeJourneyBottomDecorSourceOracle.payload.assets[0].records.first{$0.board==13}!
        let owner=NativeJourneyBottomDecorOwner(root:NativeTestResources.root,board:13,viewport:CGSize(width:320,height:568),generation:1,isCurrent:{_ in true},catalog:NativeJourneyBottomDecorCatalog(),density:2,isApplicationActive:{true})
        let ready=expectation(description:"Exact Beach3 original PNG decoded");owner.prepare{XCTAssertTrue($0);ready.fulfill()};await fulfillment(of:[ready],timeout:4)
        let imageView=try XCTUnwrap(owner.subviews.compactMap{$0 as? UIImageView}.first),image=try XCTUnwrap(imageView.image),pixels=row.pixels[1]
        XCTAssertEqual(image.cgImage?.width,pixels[1]);XCTAssertEqual(image.cgImage?.height,pixels[2]);XCTAssertEqual(image.scale,2)
        XCTAssertTrue(owner.selectedPath.hasSuffix("beach-hud3@3x.png"));XCTAssertGreaterThan(owner.decodedBytes,0)
        for viewport in [CGSize(width:320,height:568),CGSize(width:390,height:844),CGSize(width:834,height:1194)] {
            owner.bounds=CGRect(origin:.zero,size:viewport);owner.setNeedsLayout();owner.layoutIfNeeded()
            XCTAssertEqual(imageView.bounds.width,viewport.width);XCTAssertEqual(imageView.bounds.height,viewport.width*CGFloat(pixels[2])/CGFloat(pixels[1]),accuracy:0.000001)
            XCTAssertEqual(imageView.layer.position,CGPoint(x:viewport.width/2,y:viewport.height+1))
        }
        XCTAssertFalse(owner.hasActiveClock);owner.dispose();XCTAssertEqual(owner.decodedBytes,0)
    }
    func testActualCancelledDecoderPreservesWarmOriginalAndRepliesOnce() async throws {
        let resources=NativeJourneyBottomDecorResources(root:NativeTestResources.root),catalog=NativeJourneyBottomDecorCatalog()
        let path=catalog.asset(board:13,random:{0.4}).path(density:2),other=catalog.asset(board:14,random:{0.4}).path(density:2)
        var warm:UIImage?;let ready=expectation(description:"Original Beach PNG warm")
        resources.prepare(path:path){warm=$0;ready.fulfill()};await fulfillment(of:[ready],timeout:4)
        let original=try XCTUnwrap(warm),bytes=resources.decodedBytes
        let cancelled=expectation(description:"Retired decode replies nil once");var replies=0
        resources.prepare(path:other){XCTAssertNil($0);replies += 1;cancelled.fulfill()};resources.cancelPendingPreparation()
        await fulfillment(of:[cancelled],timeout:4)
        XCTAssertEqual(replies,1);XCTAssertEqual(resources.decodedBytes,bytes)
        var reused:UIImage?;resources.prepare(path:path){reused=$0}
        XCTAssertTrue(reused===original);resources.release();XCTAssertEqual(resources.decodedBytes,0)
    }
    func testActualFiniteClockStopsSuspendedAndDisposesWithoutLateExitReceipt() {
        let resources=Resources(),owner=owner(resources:resources),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController()
        window.rootViewController=controller;window.makeKeyAndVisible();controller.view.addSubview(owner)
        owner.enter();resources.finish(0,image:testImage());XCTAssertTrue(owner.hasActiveClock)
        owner.paint(seconds:0.17,generation:1);let captured=owner.pose;owner.setSuspended(true)
        RunLoop.main.run(until:Date().addingTimeInterval(0.06));XCTAssertEqual(owner.pose,captured);XCTAssertFalse(owner.hasActiveClock)
        owner.setSuspended(false);var results:[Bool]=[];owner.exit{results.append($0)};owner.dispose();owner.dispose();owner.paint(seconds:1,generation:1)
        XCTAssertEqual(results,[false]);XCTAssertFalse(owner.hasActiveClock);XCTAssertNil(owner.superview);window.isHidden=true
    }
}
