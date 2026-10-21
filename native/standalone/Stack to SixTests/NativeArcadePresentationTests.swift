import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeArcadePresentationTests: XCTestCase {
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
