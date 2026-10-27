import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeArcadePresentationTests: XCTestCase {
    func testBoardClearedReusesBothThumbsWithoutRoundCommitAndReleases() async throws {
        for sample in [0.0,0.99] {
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            let host=UIViewController();window.rootViewController=host;window.makeKeyAndVisible()
            var owner:NativeArcadeRoundPresentation?=NativeArcadeRoundPresentation(resourceRoot:root,
                clearedRound:1,nextRound:2,boardClearedOnly:true,random:{sample})
            weak var retired=owner
            owner!.frame=window.bounds;host.view.addSubview(owner!)
            var commits=0,starts=0,digits=0,finishes=0
            let entered=expectation(description:"Clear card entered"),done=expectation(description:"Finite clear card exit")
            owner!.onNextRoundPresented={commits += 1}
            owner!.onCue={cue in
                if case .celebrationStarted=cue {starts += 1}
                if case .digitEntered=cue {digits += 1}
                if case .thumbWhoosh=cue {XCTAssertGreaterThanOrEqual(owner!.elapsed,owner!.thumbEnterStart);XCTAssertLessThan(owner!.elapsed,owner!.boardClearedTextEnterEnd);entered.fulfill()}
            }
            owner!.onFinished={success in XCTAssertTrue(success);finishes += 1;done.fulfill()}
            owner!.start();await fulfillment(of:[entered],timeout:2)
            owner!.setSuspended(true);owner!.start()
            let held=owner!.elapsed
            NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
            NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
            try await Task.sleep(for:.milliseconds(100))
            XCTAssertEqual(finishes,0);XCTAssertEqual(starts,1);XCTAssertEqual(owner!.elapsed,held)
            owner!.setSuspended(false)
            try await Task.sleep(for:.milliseconds(850))
            owner!.setSuspended(true)
            let format=UIGraphicsImageRendererFormat();format.scale=1
            let image=UIGraphicsImageRenderer(size:window.bounds.size,format:format).image{host.view.layer.render(in:$0.cgContext)}
            try image.pngData()?.write(to:URL(fileURLWithPath:sample==0 ? "/tmp/board-cleared-puppy.png":"/tmp/board-cleared-thumb.png"))
            owner!.setSuspended(false)
            while owner!.elapsed < owner!.boardClearedTextExitEnd {try await Task.sleep(for:.milliseconds(10))}
            owner!.setSuspended(true)
            func descendants(_ view:UIView)->[UIView] {view.subviews.flatMap{[$0]+descendants($0)}}
            let rendered=descendants(owner!)
            let thumb=try XCTUnwrap(rendered.first{$0.accessibilityIdentifier=="native.board-cleared.thumb"})
            XCTAssertEqual(thumb.alpha,1,accuracy:0.001,"Thumb waits for every CLEARED glyph to exit")
            for glyph in rendered where glyph.accessibilityIdentifier?.hasPrefix("native.board-cleared.glyph.")==true {
                XCTAssertEqual(glyph.alpha,0,accuracy:0.001)
            }
            owner!.setSuspended(false)
            await fulfillment(of:[done],timeout:5)
            XCTAssertEqual(commits,0);XCTAssertEqual(digits,0);XCTAssertEqual(finishes,1)
            owner!.dispose();owner=nil
            try await Task.sleep(for:.milliseconds(100))
            XCTAssertNil(retired);window.isHidden=true
        }
    }

    func testClearedThumbFloatsSixteenPointsAndHoldsItsPoseIntoExit() {
        for sample in [0.0,0.99] {
            let owner=NativeArcadeRoundPresentation(resourceRoot:root,clearedRound:1,nextRound:2,boardClearedOnly:true,random:{sample})
            defer{owner.dispose()}
            let start=owner.thumbEnterStart+0.68
            XCTAssertEqual(owner.thumbFloat(at:start).y,0,accuracy:0.000001)
            XCTAssertEqual(owner.thumbFloat(at:start+0.82).y,-16,accuracy:0.000001)
            XCTAssertEqual(owner.thumbFloat(at:start+0.82).rotation,4,accuracy:0.000001)
            let exit=owner.duration-0.30
            XCTAssertEqual(owner.thumbFloat(at:exit-0.000001).y,owner.thumbFloat(at:exit).y,accuracy:0.0001)
            XCTAssertEqual(owner.thumbFloat(at:exit+0.1).y,owner.thumbFloat(at:exit).y,accuracy:0.000001)
        }
    }

    func testFinalCelebrationLeadIsBoundedByActualVisualEnd() {
        XCTAssertEqual(NativeFinalMergeCelebrationTiming.startTime(visualDuration:10),9.55,accuracy:0.000001)
        XCTAssertEqual(NativeFinalMergeCelebrationTiming.startTime(visualDuration:2),1.7,accuracy:0.000001)
        XCTAssertEqual(NativeFinalMergeCelebrationTiming.startTime(visualDuration:0.4),0.34,accuracy:0.000001)
        XCTAssertEqual(NativeFinalMergeCelebrationTiming.startTime(visualDuration:0),0)
    }
    func testBarrelVisualEndDoesNotIncludeEmptyCleanupTail() {
        let owner=NativeTntVariantPresentation(resourceRoot:root,variant:.barell,viewport:CGSize(width:390,height:844),random:{0.5})
        defer{owner.dispose()}
        XCTAssertTrue(owner.assetsReady)
        XCTAssertEqual(owner.duration,4.2,accuracy:0.000001)
        let wood=NativeTntFinale.makeDiePlans(random:{0.5})
        let dice=NativeTntVariantPlanning.barrelDice(wood:wood,random:{0.5})
        let expected=max(1.93,(wood+dice).map{$0.delay+$0.duration}.max() ?? 0)
        XCTAssertEqual(owner.progressDuration,expected,accuracy:0.000001)
        XCTAssertLessThan(owner.progressDuration,owner.duration)
        print("[ClearedHandoff] barrel visualEnd=\(owner.progressDuration) cleanupEnd=\(owner.duration) textStart=\(NativeFinalMergeCelebrationTiming.startTime(visualDuration:owner.progressDuration))")
        var reports:[(Double,Double)]=[]
        owner.onProgress={reports.append(($0,$1))}
        owner.advanceSourceAnimation(seconds:NativeFinalMergeCelebrationTiming.startTime(visualDuration:owner.progressDuration))
        XCTAssertEqual(reports.count,1)
        XCTAssertEqual(reports[0].1,owner.progressDuration)
        XCTAssertLessThan(reports[0].0,reports[0].1)
    }
    func testBoardClearedSharesNoMovesEntryAndHasNoExtraHold() throws {
        let owner=NativeArcadeRoundPresentation(resourceRoot:root,clearedRound:1,nextRound:2,boardClearedOnly:true,random:{0.4})
        defer{owner.dispose()}
        let plan=try XCTUnwrap(owner.boardClearedTextComposition)
        XCTAssertEqual(String(plan.letters.map(\.character)),"CLEARED")
        XCTAssertEqual(owner.boardClearedTextEnterEnd,1.04,accuracy:0.000001)
        XCTAssertEqual(owner.thumbEnterStart,0.2,accuracy:0.000001)
        XCTAssertLessThanOrEqual(abs(owner.boardClearedThumbRotation),20)
        XCTAssertEqual(owner.boardClearedTextExitEnd,2.68,accuracy:0.000001)
        XCTAssertEqual(owner.duration,2.98,accuracy:0.000001)
        for index in plan.letters.indices {
            for time in [0.0,0.2,0.6,1.0,1.039] {
                let expected=plan.letters[index].enter(at:time,index:index),actual=owner.boardClearedTextPose(at:time,index:index)
                XCTAssertEqual(Double(actual.scale),expected.scale,accuracy:0.000001)
                XCTAssertEqual(Double(actual.alpha),expected.alpha,accuracy:0.000001)
            }
            let end=owner.boardClearedTextPose(at:owner.duration,index:index)
            XCTAssertEqual(end.scale,0,accuracy:0.000001);XCTAssertEqual(end.alpha,0,accuracy:0.000001)
        }
        owner.frame=CGRect(x:0,y:0,width:320,height:568);owner.layoutIfNeeded()
        func labels(_ view:UIView)->[UILabel]{view.subviews.flatMap{($0 as? UILabel).map{[$0]} ?? labels($0)}}
        let glyphs=labels(owner).filter{$0.accessibilityIdentifier?.hasPrefix("native.board-cleared.glyph.")==true}
        XCTAssertEqual(glyphs.count,7)
        func find(_ view:UIView,_ id:String)->UIView? {
            if view.accessibilityIdentifier==id{return view}
            return view.subviews.compactMap{find($0,id)}.first
        }
        let text=try XCTUnwrap(find(owner,"native.board-cleared.text"))
        let png=try XCTUnwrap(find(owner,"native.board-cleared.thumb"))
        XCTAssertTrue(text.superview === png.superview)
        XCTAssertGreaterThan(png.layer.zPosition,text.layer.zPosition)
        XCTAssertEqual(text.frame.midX,png.frame.midX,accuracy:0.001)
        XCTAssertLessThan(text.frame.maxY,png.frame.minY)
        let group=text.frame.union(png.frame)
        let center=try XCTUnwrap(text.superview).convert(CGPoint(x:group.midX,y:group.midY),to:owner)
        XCTAssertEqual(center.x,owner.bounds.midX,accuracy:0.001)
        XCTAssertEqual(center.y,owner.bounds.midY,accuracy:0.001)
        for glyph in glyphs {glyph.alpha=1;glyph.transform = .identity}
        let review=UIGraphicsImageRenderer(size:CGSize(width:text.bounds.width+120,height:text.bounds.height+120)).image {ctx in
            UIColor(red:243.0/255,green:238.0/255,blue:232.0/255,alpha:1).setFill()
            ctx.fill(CGRect(x:0,y:0,width:text.bounds.width+120,height:text.bounds.height+120))
            ctx.cgContext.translateBy(x:60,y:60);text.layer.render(in:ctx.cgContext)
        }
        try review.pngData()?.write(to:FileManager.default.temporaryDirectory.appendingPathComponent("cleared-no-glow-review.png"))

        for glyph in glyphs {
            XCTAssertEqual(glyph.font.fontName,"Baloo2-ExtraBold")
            var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0
            glyph.textColor.getRed(&r,green:&g,blue:&b,alpha:&a)
            XCTAssertEqual(r,231.0/255,accuracy:1e-8);XCTAssertEqual(g,116.0/255,accuracy:1e-8);XCTAssertEqual(b,73.0/255,accuracy:1e-8)
            XCTAssertEqual(glyph.layer.shadowRadius,0);XCTAssertEqual(glyph.layer.shadowOpacity,0)
            XCTAssertTrue(glyph.subviews.isEmpty)

        }
    }

    func testThumbVariantCapturedOnceAtEqualProbabilityBoundary() {
        for (sample,puppy) in [(0.0,true),(0.499999,true),(0.5,false),(0.999999,false)] {
            let owner=NativeArcadeRoundPresentation(resourceRoot:root,clearedRound:1,nextRound:2,random:{sample})
            XCTAssertEqual(owner.isPuppyThumb,puppy)
            XCTAssertEqual(owner.thumbAssetPath,puppy ? "assets/puppy thumbs up@2x.png":"assets/thumbs-up@2x.png")
            XCTAssertNotNil(JimiV9Artwork(resourceRoot:root).image(owner.thumbAssetPath,densityAware:false))
            owner.setSuspended(true);owner.setSuspended(false)
            XCTAssertEqual(owner.isPuppyThumb,puppy)
            owner.dispose();owner.dispose()
        }
    }
    func testSelectedThumbEmitsOneContactThroughSuspendAndReleases() async {
        for sample in [0.0,0.99] {
            let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
            let controller=UIViewController();window.rootViewController=controller;window.makeKeyAndVisible()
            var owner:NativeArcadeRoundPresentation?=NativeArcadeRoundPresentation(resourceRoot:root,clearedRound:1,nextRound:2,random:{sample})
            weak var released=owner
            owner!.frame=window.bounds;controller.view.addSubview(owner!)
            var contacts=0
            let contact=expectation(description:"Actual thumb contact")
            owner!.onCue={cue in if case .thumbWhoosh=cue {contacts += 1;contact.fulfill()}}
            owner!.start()
            await fulfillment(of:[contact],timeout:2)
            owner!.setSuspended(true);owner!.setSuspended(false);owner!.start()
            XCTAssertEqual(contacts,1)
            owner!.dispose();owner=nil
            // UIKit/display-link autorelease drains at the next run-loop boundary.
            try? await Task.sleep(for:.milliseconds(150))
            XCTAssertNil(released);window.isHidden=true
        }
    }
    func testThumbShadowPaintHasTransparentCornersAndPwaBlurredCenter() {
        // Actual iPhone13 thumb shadow dimensions: 58vw * 74%, 58vw * 15%.
        let size = CGSize(width: 390*0.58*0.74,height: 390*0.58*0.15)
        let shadow = NativeArcadeThumbShadow(frame: CGRect(origin: .zero,size: size))
        shadow.layoutIfNeeded()
        let canvas = UIView(frame: CGRect(x: 0,y: 0,width: size.width+60,height: size.height+60))
        canvas.backgroundColor = .clear; shadow.frame.origin = CGPoint(x: 30,y: 30); canvas.addSubview(shadow)
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = false
        let image = UIGraphicsImageRenderer(size: canvas.bounds.size,format: format).image { canvas.layer.render(in: $0.cgContext) }
        let cg = image.cgImage!,bytes = cg.dataProvider!.data! as Data
        let stride = cg.bytesPerRow,x = cg.width/2,y = cg.height/2
        XCTAssertEqual(bytes[3],0)
        let centerAlpha = bytes[y*stride+x*4+3]
        XCTAssertGreaterThan(centerAlpha,15); XCTAssertLessThan(centerAlpha,45,
            "PWA blur spreads the raw 32% center instead of leaving a dark concentrated ellipse")
        XCTAssertGreaterThan(bytes[29*stride+x*4+3],0,"Blur must extend beyond the original ellipse bounds")
        let cachedImage = (shadow.subviews.first as? UIImageView)?.image
        shadow.setNeedsLayout(); shadow.layoutIfNeeded()
        XCTAssertTrue(cachedImage === (shadow.subviews.first as? UIImageView)?.image)
        try? image.pngData()?.write(to: URL(fileURLWithPath: "/tmp/native-arcade-shadow-pwa-blur.png"))
    }

    func testBeachBubblePaintHonorsIdleOpacityInActualImagePixels() {
        let size = CGSize(width: 390,height: 844)
        let resources = OpaqueBubbleResources()
        let canvas = NativeResultConfettiCanvas(root: root,theme: .beach,viewport: size,generation: 7,resources: resources,random: {0.5})
        defer { canvas.dispose() }
        canvas.paint(seconds: 1,generation: 7)
        let plan = NativeResultConfettiPlan.beach(width: 390,height: 844,random: {0.5})
        let first = plan[0].sample(seconds: 1)
        let x = Int(first.x),y = Int(first.y)
        var expected = 0.0
        for bubble in plan {
            let pose = bubble.sample(seconds: 1)
            let half = bubble.size*pose.scale/2
            if pose.visible && abs(Double(x)+0.5-pose.x)<half && abs(Double(y)+0.5-pose.y)<half {
                expected = pose.opacity+expected*(1-pose.opacity)
            }
        }
        XCTAssertGreaterThan(expected,0); XCTAssertLessThan(expected,0.9)
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = false
        let image = UIGraphicsImageRenderer(size: size,format: format).image { _ in canvas.draw(canvas.bounds) }
        let cg = image.cgImage!,bytes = cg.dataProvider!.data! as Data
        XCTAssertEqual(Double(bytes[y*cg.bytesPerRow+x*4+3])/255,expected,accuracy: 0.02)
        try? image.pngData()?.write(to: URL(fileURLWithPath: "/tmp/native-beach-opacity-fixed.png"))
    }

    private final class OpaqueBubbleResources: NativeResultConfettiResources {
        private let sprite: UIImage = UIGraphicsImageRenderer(size: CGSize(width: 10,height: 10)).image {
            UIColor.white.setFill(); $0.fill(CGRect(x: 0,y: 0,width: 10,height: 10))
        }
        func image(_ path: String,owner: Int)->UIImage? {sprite}
        func prepare(_ paths: [String],owner: Int,required: Bool,completion: @escaping (Bool)->Void) {completion(true)}
        func release(_ owner: Int) {}
    }

    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    private enum ReceiptFailure: Error { case rejected }

    func testContinuationReceiptPrecedesFirstRoundFrameAndCommitsExactlyOnce() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844))
        let controller = UIViewController(); window.rootViewController = controller; window.makeKeyAndVisible()
        let owner = NativeArcadeRoundPresentation(resourceRoot: root,clearedRound: 1,nextRound: 2,continuationOnly: true,random: { 0.5 })
        owner.frame = window.bounds; controller.view.addSubview(owner)
        var commits = 0,rounds = 0,finishes = 0,digits = Set<Int>()
        let finished = expectation(description: "Actual finite native digit clock finishes")
        owner.onNextRoundPresented = { commits += 1 }
        owner.onCue = { cue in
            switch cue {
            case .roundShown: XCTAssertEqual(commits,1); rounds += 1
            case .digitEntered(let index): XCTAssertEqual(commits,1); digits.insert(index)
            default: break
            }
        }
        owner.onFinished = { completed in XCTAssertTrue(completed); finishes += 1; finished.fulfill() }
        owner.start(); owner.start()
        XCTAssertEqual(commits,1); XCTAssertEqual(rounds,1)
        // Original getArcadeRoundCueDurationMs: two digits = 2200ms.
        XCTAssertEqual(owner.duration,2.2,accuracy: 0.000001)
        await fulfillment(of: [finished],timeout: 5)
        XCTAssertEqual(digits,Set([0,1])); XCTAssertEqual(finishes,1)
        XCTAssertNil(owner.superview)
        owner.dispose(); XCTAssertEqual(finishes,1)
        window.isHidden = true
    }

    func testThrowingReceiptCancelsBeforeAnyVisibleRoundOrDigit() {
        let container = UIView(frame: CGRect(x: 0,y: 0,width: 390,height: 844))
        let owner = NativeArcadeRoundPresentation(resourceRoot: root,clearedRound: 1,nextRound: 2,continuationOnly: true)
        owner.frame = container.bounds; container.addSubview(owner)
        var attempted = 0,visible = 0,finishes = 0
        owner.onNextRoundPresented = { attempted += 1; throw ReceiptFailure.rejected }
        owner.onCue = { cue in
            switch cue { case .roundShown,.digitEntered: visible += 1; default: break }
        }
        owner.onFinished = { completed in XCTAssertFalse(completed); finishes += 1 }
        owner.start(); owner.start(); owner.dispose()
        XCTAssertEqual(attempted,1); XCTAssertEqual(visible,0); XCTAssertEqual(finishes,1)
        XCTAssertNil(owner.superview)
    }

    func testSuspendedDisposedOwnerCannotCompleteOrRetainDisplayClock() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844))
        let controller = UIViewController(); window.rootViewController = controller; window.makeKeyAndVisible()
        var owner: NativeArcadeRoundPresentation? = NativeArcadeRoundPresentation(resourceRoot: root,clearedRound: 3,nextRound: 4,continuationOnly: true)
        weak var released = owner
        owner?.frame = window.bounds; controller.view.addSubview(owner!)
        var committed = 0,completed = 0,cancelled = 0
        owner?.onNextRoundPresented = { committed += 1 }
        owner?.onFinished = { success in if success { completed += 1 } else { cancelled += 1 } }
        owner?.start(); owner?.setSuspended(true); owner?.dispose(); owner?.setSuspended(false); owner?.start(); owner = nil
        try? await Task.sleep(nanoseconds: 150_000_000)
        XCTAssertEqual(committed,1); XCTAssertEqual(completed,0); XCTAssertEqual(cancelled,1)
        XCTAssertNil(released,"Finite clock target and notification callbacks must release the disposed owner")
        window.isHidden = true
    }

    func testFishNativeFlightMatchesSourceEndpointsAndExpiry() {
        let motion = NativeFishFinaleMotion(origin: CGPoint(x: 70,y: 200),viewport: CGSize(width: 390,height: 844))
        let first = motion.sample(seconds: 0),last = motion.sample(seconds: 2.4)
        XCTAssertEqual(first.point.x,70); XCTAssertEqual(first.point.y,200)
        XCTAssertEqual(first.scale,0.18,accuracy: 0.000001)
        XCTAssertEqual(last.point.x,390+motion.mediaSize.width/2+24,accuracy: 0.000001)
        XCTAssertEqual(last.point.y,844+motion.mediaSize.height/2+24,accuracy: 0.000001)
        XCTAssertEqual(last.alpha,0)
        let reversed = NativeFishFinaleMotion(origin: CGPoint(x: 300,y: 700),viewport: CGSize(width: 390,height: 844))
        XCTAssertEqual(reversed.direction,-1)
        XCTAssertLessThan(reversed.end.x,0); XCTAssertLessThan(reversed.end.y,0)
    }
}
