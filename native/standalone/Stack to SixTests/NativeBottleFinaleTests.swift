import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeBottleFinaleTests: XCTestCase {
    private var root: URL { Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle") }
    func testBubbleCollapseCannotFlashBrighterThanItsPopOnset() {
        let owner=NativeBottleFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844),random:{0.1})
        let host=UIView(frame:owner.bounds);host.addSubview(owner);owner.layoutIfNeeded();defer{owner.dispose()}
        let bubbles=owner.subviews.compactMap{$0 as? UIImageView}.filter{$0.layer.zPosition>=120 && $0.layer.zPosition<1000}
        XCTAssertEqual(bubbles.count,40)
        let trail=owner.subviews.compactMap{$0 as? UIImageView}[0]
        let trailPop=0.3+0.06+(0.32+0.1*0.18)-0.08
        owner.paint(seconds:trailPop)
        var previous=trail.alpha
        XCTAssertGreaterThan(previous,0)
        for frame in 1...8 {
            owner.paint(seconds:trailPop+Double(frame)*0.01)
            XCTAssertLessThanOrEqual(trail.alpha,previous+0.000001,"Bottle trail bubbles must also fade without brightening")
            previous=trail.alpha
        }
        let first=bubbles[0]
        // Captured first bubble: pause=true, travel=1.495, ratio=0.478.
        let pop=0.12+1.495*0.478
        owner.paint(seconds:pop+0.06)
        let onset=first.alpha,peakSize=first.bounds.width*abs(first.transform.a)
        var samples:[String]=[];previous=onset
        var largest=peakSize
        for frame in 1...8 {
            let time=pop+0.06+Double(frame)*0.01
            owner.paint(seconds:time)
            samples.append(String(format:"%.5f:%.6f",time,first.alpha))
            XCTAssertLessThanOrEqual(first.alpha,onset+0.000001,"A shrinking/popping bubble must not flash brighter during its final 80ms")
            XCTAssertLessThanOrEqual(first.alpha,previous+0.000001)
            previous=first.alpha;largest=max(largest,first.bounds.width*abs(first.transform.a))
            if frame==4 {
                func render(_ name:String) {
                    let image=UIGraphicsImageRenderer(size:owner.bounds.size).image{owner.layer.render(in:$0.cgContext)}
                    try? image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/"+name+".png"))
                }
                render("bottle-pop-after")
                let faded=first.alpha
                first.alpha=onset*1.25 // Exact previous back-in opacity at its halfway overshoot.
                render("bottle-pop-before")
                first.alpha=faded
            }
        }
        print("[BOTTLE_POP_AUDIT] pop=\(pop) onsetAlpha=\(onset) onsetSize=\(peakSize) samples=\(samples)")
        XCTAssertEqual(first.alpha,0,accuracy:0.000001)
        XCTAssertGreaterThan(largest,peakSize,"Keep the existing elastic scale pop while removing opacity overshoot")
    }
    func testEveryBubbleHasOneFiniteVisibleLifetimeWithoutResurrectionOrScreenSizedFlash() {
        for seed in [UInt64(17),UInt64(256),UInt64(12345)] {
            var randomState=seed
            let owner=NativeBottleFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844),random:{
                randomState=randomState &* 6364136223846793005 &+ 1
                return Double(randomState>>11)/Double(UInt64.max>>11)
            })
            let host=UIView(frame:owner.bounds);host.addSubview(owner);owner.layoutIfNeeded();defer{owner.dispose()}
            let images=owner.subviews.compactMap{$0 as? UIImageView}
            XCTAssertEqual(images.count,100)
            var seen=Set<Int>(),retired=Set<Int>()
            for frame in 0...684 {
                owner.advanceSourceAnimation(seconds:Double(frame)/120)
                for (index,image) in images.enumerated() {
                    XCTAssertTrue(image.center.x.isFinite && image.center.y.isFinite && image.transform.a.isFinite)
                    XCTAssertLessThanOrEqual(image.alpha,0.8+0.000001)
                    if image.alpha>0.000001 {
                        XCTAssertLessThanOrEqual(image.frame.width,80,"Only visible geometry can produce a screen flash; hidden UIImageViews retain original natural bounds until birth")
                        XCTAssertFalse(retired.contains(index),"A bubble cannot reappear after its completed fade")
                        seen.insert(index)
                    } else if seen.contains(index) {retired.insert(index)}
                }
            }
            XCTAssertEqual(seen.count,100);XCTAssertEqual(retired.count,100)
        }
    }
    func testAllForegroundBubblesStaySmallToMediumIncludingPopOvershoot() {
        for roll in [0.0,0.5,1.0] {
            let owner=NativeBottleFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844),random:{roll})
            defer{owner.dispose()}
            let bubbles=owner.subviews.compactMap{$0 as? UIImageView}.filter{$0.layer.zPosition>=120 && $0.layer.zPosition<1000}
            XCTAssertEqual(bubbles.count,40)
            var largestPainted:CGFloat=0
            for frame in 0...648 {
                owner.paint(seconds:Double(frame)/120)
                for bubble in bubbles where bubble.alpha>0 {
                    XCTAssertTrue((18...48).contains(bubble.bounds.width))
                    largestPainted=max(largestPainted,bubble.frame.width)
                }
            }
            XCTAssertGreaterThan(largestPainted,0)
            XCTAssertLessThanOrEqual(largestPainted,80,"Even the existing pop overshoot must remain medium-sized")
        }
    }
    func testCrossingPathsMatchExecutedSourceGoldenCoordinates() {
        let progress: [CGFloat] = [0,0.125,0.375,0.625,0.875,1]
        let expected: [[CGFloat]] = [
            [23,27.625,41.25,52.0625,57.9375,60],
            [43,38.1875,35.25,44.3125,54.6875,58],
            [58,57.625,56.25,52.875,45.6875,42],
            [72,72.875,74.75,78.875,84.375,86],
            [81.8,81.15,78.2625,73.125,66.625,64]
        ]
        for (layer,values) in zip(NativeBottleFinaleMotion.layers,expected) {
            for (p,golden) in zip(progress,values) {
                XCTAssertEqual(NativeBottleFinaleMotion.crossing(layer.path,progress: p),golden,accuracy: 0.000001)
            }
        }
        XCTAssertEqual(NativeBottleFinaleMotion.crossing([],progress: 0.5),50)
    }
    func testBubbleKeyframesMatchInstalledGSAPAndOpacityRange() {
        let values: [CGFloat] = [0,5,-9,12,6]
        XCTAssertEqual(NativeBottleFinaleMotion.keyframes(values,progress: 0.125),0.761205,accuracy: 0.000001)
        XCTAssertEqual(NativeBottleFinaleMotion.keyframes(values,progress: 0.25),2.928932,accuracy: 0.000001)
        XCTAssertEqual(NativeBottleFinaleMotion.keyframes(values,progress: 0.5),-9,accuracy: 0.000001)
        XCTAssertEqual(NativeBottleFinaleMotion.keyframes(values,progress: 0.75),9.514718,accuracy: 0.000001)
        let alpha = NativeBottleFinaleMotion.mixedOpacities(count: 40,random: { 0.5 })
        XCTAssertEqual(alpha.count,40)
        XCTAssertEqual(Set(alpha),Set([CGFloat(0.6),0.7,0.8,0.9]))
        for level: CGFloat in [0.6,0.7,0.8,0.9] {
            XCTAssertEqual(alpha.filter { $0 == level }.count,10)
        }
    }
    func testFullBottleClockKeepsCueOrderAndOneVisibleCompletionReceipt() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844)),controller = UIViewController()
        window.rootViewController = controller; window.makeKeyAndVisible()
        let owner = NativeBottleFinalePresentation(resourceRoot: root,viewport: window.bounds.size,random: { 0.5 })
        controller.view.addSubview(owner)
        defer { owner.dispose(); window.isHidden = true }
        var cues: [String] = [],finished = 0
        let completion = expectation(description: "Bottles and foreground bubbles retire before the source cleanup receipt")
        owner.onCue = { cue,_ in cues.append(cue) }
        owner.onFinished = { success in XCTAssertTrue(success); finished += 1; completion.fulfill() }
        owner.start(); owner.start()
        XCTAssertEqual(cues,["water-waves"])
        XCTAssertEqual(owner.duration,5.70,accuracy: 0.000001)
        XCTAssertEqual(owner.subviews.compactMap { $0 as? UIImageView }.count,100)
        await fulfillment(of: [completion],timeout: 8)
        XCTAssertEqual(cues,["water-waves","bottle1","bottle2","bublesi","cling","cling2"])
        XCTAssertNil(owner.superview)
        owner.dispose(); XCTAssertEqual(finished,1)
    }
    func testRisingBubbleOpacityHasContinuousVarietyAndPreservesRandomDrawCount() {
        for roll in [0.0,0.5,1.0] {
            var draws=0
            let values=NativeBottleFinaleMotion.mixedOpacities(count:40,range:0.3...0.8,random:{draws+=1;return roll})
            XCTAssertEqual(values.count,40);XCTAssertEqual(Set(values).count,40)
            XCTAssertTrue(values.allSatisfy{(0.3...0.8).contains($0)})
            XCTAssertEqual(draws,79,"Opacity changes must preserve subsequent authored motion draws")
            for (index,value) in values.sorted().enumerated() {
                XCTAssertEqual(value,0.3+0.5*(CGFloat(index)+CGFloat(roll))/40,accuracy:0.000001)
            }
        }
        let first=NativeBottleFinaleMotion.mixedOpacities(count:40,range:0.3...0.8,random:{0})
        let second=NativeBottleFinaleMotion.mixedOpacities(count:40,range:0.3...0.8,random:{1})
        XCTAssertNotEqual(first,second)
    }
    func testActualBottleBubblesStayBelowEightyPercentIncludingPopOvershoot() {
        let owner=NativeBottleFinalePresentation(resourceRoot:root,viewport:.init(width:390,height:844),random:{0.5})
        defer{owner.dispose()}
        owner.layoutIfNeeded()
        let images=owner.subviews.compactMap{$0 as? UIImageView}
        let rising=images.filter{$0.layer.zPosition>=120}
        XCTAssertEqual(images.count,100);XCTAssertEqual(rising.count,40)
        var brightest:CGFloat=0
        for frame in 0...684 {
            owner.paint(seconds:Double(frame)/120)
            for image in images {
                XCTAssertGreaterThanOrEqual(image.alpha,0)
                XCTAssertLessThanOrEqual(image.alpha,0.8+0.000001)
                brightest=max(brightest,image.alpha)
            }
        }
        XCTAssertEqual(brightest,0.8,accuracy:0.000001)
        XCTAssertTrue(images.allSatisfy{$0.alpha==0},"Authored final fade must still reach transparent")
    }
    func testDisposedSuspendedOwnerReleasesItsClockAndCannotFinishTwice() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844)),controller = UIViewController()
        window.rootViewController = controller; window.makeKeyAndVisible()
        var owner: NativeBottleFinalePresentation? = NativeBottleFinalePresentation(resourceRoot: root,viewport: window.bounds.size,random: { 0.5 })
        weak var weakOwner = owner
        controller.view.addSubview(owner!)
        var finishes = 0
        owner?.onFinished = { success in XCTAssertFalse(success); finishes += 1 }
        owner?.start(); XCTAssertEqual(owner?.hasActiveClock,true)
        owner?.setSuspended(true); owner?.dispose(); owner?.dispose()
        XCTAssertEqual(owner?.hasActiveClock,false); XCTAssertNil(owner?.superview); XCTAssertEqual(finishes,1)
        owner = nil
        // UIKit/CoreAnimation can retain a just-detached view until this frame
        // drains. Clock retirement above is synchronous; deallocation must
        // still occur across this bounded real run-loop boundary.
        try? await Task.sleep(for: .milliseconds(150))
        XCTAssertNil(weakOwner); XCTAssertEqual(finishes,1)
        window.isHidden = true
    }
    func testForegroundNotificationCannotOverrideExplicitPresentationSuspension() async {
        let window = UIWindow(frame: CGRect(x: 0,y: 0,width: 390,height: 844)),controller = UIViewController()
        window.rootViewController = controller; window.makeKeyAndVisible()
        let owner = NativeFinitePresentation(viewport: window.bounds.size,duration: 0.08)
        controller.view.addSubview(owner)
        defer { owner.dispose(); window.isHidden = true }
        var completions = 0
        let completed = expectation(description: "Explicitly resumed visible clock completes")
        owner.onFinished = { success in XCTAssertTrue(success); completions += 1; completed.fulfill() }
        owner.setSuspended(true); owner.start()
        NotificationCenter.default.post(name: UIApplication.willResignActiveNotification,object: nil)
        NotificationCenter.default.post(name: UIApplication.didBecomeActiveNotification,object: nil)
        try? await Task.sleep(for: .milliseconds(150))
        XCTAssertEqual(completions,0,"Foreground activation must preserve the navigation owner's explicit suspension")
        owner.setSuspended(false)
        await fulfillment(of: [completed],timeout: 2)
        XCTAssertEqual(completions,1)
    }
}
