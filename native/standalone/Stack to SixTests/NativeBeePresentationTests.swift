import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor
final class NativeBeePresentationTests: XCTestCase {
    private var root:URL {Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")}
    // Gold recorded by executing original bee-finale-scene and shared leaf
    // module: seeded route shape/corner corridor and exact captured births.
    func testHeroRouteAndLeafPlansMatchExecutedOriginalTypeScript() {
        let route=NativeBeeFinaleMotion(width:390,height:844,origin:.init(x:70,y:170),seed:0.4)
        let frames:[(Double,[Double])]=[
(0,[70,170,0.5752086483247467,0.004986318221114061,2.220259211389481,0.8814180088269757,1]),
(0.017,[72.82658690018725,170.08658469525983,1.5583011892432665,0.07910671848168249,4.512466046382217,0.8962844484400682,1]),
(0.1,[98.07045807407407,172.00420720616486,3.1063847789605887,0.21371260905976897,6.670707853396593,0.9015604296006373,1]),
(0.5,[246.56489481252478,121.29112631502316,1.8157841066249603,-2.0815966932346868,-20,0.8385819911730242,1]),
(0.9,[134.63458677520936,104.90899787994903,-3.070501163470766,1.0524016270257732,-12.491877511049507,0.8052025129729464,-1]),
(1.5,[127.16802961434594,601.4471772731036,0.7338573998825808,1.6056266353471074,20,0.8385819911730243,1]),
(1.8,[187.27567321412116,441.9016649797323,1.6146402973143381,-5.203910517287227,-20,0.8724487006538248,1]),
(2.28,[267.97793520384755,381.2588878648961,1.6014547505335486,-0.1740709322683074,-1.8177195780393545,0.8287040795165896,1]),
(2.65,[315.80821217321835,740.277392822585,0.8282327531675833,5.900252153204519,20,0.8647154443608096,1]),
(2.7,[322.2077820209348,765.893105940129,1.3148843151962524,2.329860524667879,20,0.9071037669072168,1]),
(2.85,[365.16220629981046,838.6387135716009,3.5410328510544105,5.996927923432622,20,0.823975970638885,1]),
(3,[468,1012.8,3.8527437392683055,6.524826931489201,20,0.8814180088269756,1]),
(3.88,[468,1012.8,0,0,-3.9660934748490724,0.8073147142304464,1]),
(4,[468,1012.8,0,0,1.947091711543243,0.8814180088269759,1])
]
        for (time,expected) in frames {
            let p=route.sample(seconds:time),actual=[p.point.x,p.point.y,p.vx,p.vy,p.rotation,p.scale,Double(p.facing)]
            for index in actual.indices {XCTAssertEqual(actual[index],expected[index],accuracy:0.000001,"time\(time) scalar\(index)")}
        }
        let plans=NativeBeeLeafPlan.make(route:route)
        XCTAssertEqual(plans.count,42)
        let gold:[(Int,[Double])]=[
(0,[0,1.18,79.75789017171816,176.9845242784807,260.38376379928525,96.37806820673234,952.7281747164252,0,-260,0.88,0.86,64,34]),
(11,[0.12,1.27,60.91198061813597,207.92634840997567,-64.66877783343979,143.87735130196097,698.5546722506466,19.03,500,1.08,1,58,66]),
(12,[0.8923076923076922,1.3599999999999999,128.03861804017058,96.7606125984773,-130.84524742351914,-188.4249599262709,1204.0412336734983,20.759999999999998,-260,0.88,0.86,38,23]),
(25,[1.8026153846153845,1.18,175.85791673787918,422.9411338859845,-187.45090301870488,-379.09497064227935,1405.3302664060689,43.25,308,1.08,1,30,36]),
(41,[2.936,0.9239999999999999,412.8390607166127,900.8965199252968,-25.3417163331034,-490.88842232823134,1343.633229866583,70.92999999999999,500,1.08,1,16,16])
]
        for (index,expected) in gold {
            let p=plans[index],m=p.motion,actual=[m.birth,m.lifetime,m.birthX,m.birthY,m.velocityX,m.velocityY,m.gravity,m.flutter,m.spin,m.scale,m.peakOpacity,p.width,p.height]
            for index in actual.indices {XCTAssertEqual(actual[index],expected[index],accuracy:0.000001)}
        }
        XCTAssertTrue(plans.allSatisfy {$0.motion.birth+$0.motion.lifetime<=3.86+0.000001})
    }
    func testSingleDiagonalExitAndCrossfadesPreserveAllSeedTopologies() {
        for seed in [0.0,0.4,1.5,3.14,5.8] {
            let route=NativeBeeFinaleMotion(width:390,height:844,origin:.init(x:195,y:455.76),seed:seed)
            var leftViewport=false
            for frame in 0...300 {
                let t=Double(frame)/100,p=route.sample(seconds:t),inside=p.point.x>=0 && p.point.x<=390 && p.point.y>=0 && p.point.y<=844
                if !inside {leftViewport=true};if leftViewport {XCTAssertFalse(inside,"The source corridor must not reenter")}
                let blend=NativeBeeFinaleMotion.idleBlend(seconds:t)
                XCTAssertEqual(blend.reduce(0,+),1,accuracy:0.000001);XCTAssertLessThanOrEqual(blend.filter {$0>0}.count,2)
            }
            XCTAssertTrue(leftViewport)
        }
    }
    func testBeeNativeClockOwnsFortyTwoLeavesAndFinaleCueOnce() async {
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController()
        window.rootViewController=controller;window.makeKeyAndVisible()
        let owner=NativeBeeFinalePresentation(resourceRoot:root,viewport:window.bounds.size,origin:CGPoint(x:70,y:170),random:{0.4/(2 * .pi)})
        controller.view.addSubview(owner);defer {owner.dispose();window.isHidden=true}
        XCTAssertTrue(owner.assetReady)
        var cueCount=0,finishes=0,haptics=0
        let finished=expectation(description:"Bee source scene exits at4sec then owned cleanup")
        owner.onCue={cue,index in XCTAssertEqual(cue,"finale");XCTAssertEqual(index,0);cueCount+=1}
        owner.onHaptic={style in XCTAssertEqual(style,"light");haptics+=1}
        owner.onFinished={success in XCTAssertTrue(success);finishes+=1;finished.fulfill()}
        owner.start();owner.start()
        await fulfillment(of:[finished],timeout:7)
        XCTAssertEqual(cueCount,1);XCTAssertEqual(finishes,1);XCTAssertEqual(haptics,13);XCTAssertFalse(owner.hasActiveClock)
        owner.dispose();owner.paint(seconds:5);XCTAssertEqual(cueCount,1);XCTAssertEqual(finishes,1)
    }
    func testBackgroundAndExplicitCoverageCannotReviveDisposedBee() {
        let owner=NativeBeeFinalePresentation(resourceRoot:root,viewport:CGSize(width:390,height:844),origin:nil,random:{0.5})
        var cueCount=0,finishes=0
        owner.onCue={_,_ in cueCount+=1};owner.onFinished={success in XCTAssertFalse(success);finishes+=1}
        owner.setSuspended(true);owner.start()
        NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
        owner.dispose()
        NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
        owner.setSuspended(false);owner.start();owner.paint(seconds:4)
        XCTAssertEqual(cueCount,0);XCTAssertEqual(finishes,1);XCTAssertFalse(owner.hasActiveClock)
    }
}
