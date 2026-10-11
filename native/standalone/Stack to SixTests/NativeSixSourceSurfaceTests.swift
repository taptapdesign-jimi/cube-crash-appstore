import XCTest
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor final class NativeSixSourceSurfaceTests:XCTestCase {
    private final class Raw:NativeSourceAnimationParticipant {func advanceSourceAnimation(seconds:Double){}}
    private let zero=NativeSixSourceShakeGraph.Pose(canvas:[0,0],indicator:[0,0],decor:[0,0])
    func testActualUnionClockOriginalMultiplierAndCSSPluginShakeSixContexts() throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"six-surfaces-source-oracle",withExtension:"json"))
        let packet=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
        for trace in packet["traces"] as! [[String:Any]] {
            let asleep=trace["asleep"] as! Bool,behavior=trace["behavior"] as! String
            var now=0.0,draws=0,seed:UInt32=127,m=NativeSixSourceMultiplierGraph.Pose()
            var surface=NativeSixSourceShakeGraph.Pose(canvas:[-1.3,2.8],indicator:[-0.7,1.1],decor:[-0.4,0.5]),removed=0
            let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
            let raw=Raw(),rawLease=asleep ? nil:service.register(participant:raw,duration:3,domain:.nativeRaw,cleanup:{_ in})
            let owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{surface=$0})
            func random()->Double{seed=seed &* 1664525 &+ 1013904223;draws+=1;return Double(seed)/4294967296}
            now=10
            XCTAssertNotNil(owner.start(depth:5,initial:surface,random:random,paintMultiplier:{m=$0},removeMultiplier:{removed+=1}))
            for row in trace["rows"] as! [[String:Any]] {
                let at=row["wall"] as! Int;now=Double(at)
                if behavior=="paused",at==200{service.setSourceGlobalPaused(true)}
                if behavior=="paused",at==500{service.setSourceGlobalPaused(false)}
                if behavior=="replacement",at==200 {
                    XCTAssertNotNil(owner.start(depth:2,initial:surface,random:random,paintMultiplier:{_ in},removeMultiplier:{removed+=1}))
                }
                service.deliver(wallMilliseconds:now)
                XCTAssertEqual(service.sourceAnimationSeconds,row["animation"] as! Double,accuracy:1e-10)
                for(actual,key)in [([m.scale,m.alpha,m.rotation],"multiplier"),(surface.canvas,"canvas"),(surface.indicator,"indicator"),(surface.decor,"decor")] {
                    for(a,e)in zip(actual,row[key] as! [Double]){XCTAssertEqual(a,e,accuracy:1e-10,"\(asleep)/\(behavior)/\(at)/\(key)")}
                }
                XCTAssertEqual(draws,row["draws"] as! Int)
            }
            owner.dispose();rawLease?.cancel();service.dispose()
            XCTAssertEqual(removed,behavior=="replacement" ? 2:1)
            XCTAssertEqual(service.activeParticipantCount,0)
        }
    }
    func testLateTTLRemovesMultiplierOnlyAtActualSourceDeliveryWhilePaused() {
        var now=0.0,removed=0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
        let owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in})
        XCTAssertNotNil(owner.start(depth:2,initial:zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{removed+=1}))
        now=200;service.deliver(wallMilliseconds:now);service.setSourceGlobalPaused(true)
        now=500;service.deliver(wallMilliseconds:now);now=800;service.deliver(wallMilliseconds:now)
        XCTAssertEqual(removed,0);XCTAssertTrue(service.hasActiveClock)
        service.setSourceGlobalPaused(false)
        now=1100;service.deliver(wallMilliseconds:now);XCTAssertEqual(removed,0)
        now=1500;service.deliver(wallMilliseconds:now);XCTAssertEqual(removed,1)
        owner.dispose();service.dispose();XCTAssertEqual(removed,1)
    }
    func testVisualRandomRetirementStopsRemainingDrawsAndSourceRootAdmission() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var owner:NativeSixSourceSurfaceOwner!,draws=0,removed=0
        owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in})
        let id=owner.start(depth:5,initial:zero,random:{draws+=1;if draws==3{owner.dispose()};return 0.5},paintMultiplier:{_ in},removeMultiplier:{removed+=1})
        XCTAssertNil(id);XCTAssertEqual(draws,3);XCTAssertEqual(removed,1)
        XCTAssertEqual(service.activeParticipantCount,0);service.dispose()
    }
    func testOldDisposalRemoveCallbackPreservesReplacementOwnerRoots() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let old=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in})
        var replacement:NativeSixSourceSurfaceOwner?,oldRemoved=0,newRemoved=0
        XCTAssertNotNil(old.start(depth:2,initial:zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{
            oldRemoved+=1
            let c=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in});replacement=c
            XCTAssertNotNil(c.start(depth:3,initial:self.zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{newRemoved+=1}))
        }))
        old.dispose();old.dispose();XCTAssertEqual(oldRemoved,1);XCTAssertEqual(newRemoved,0)
        XCTAssertEqual(service.activeParticipantCount,3)
        replacement?.dispose();service.dispose();XCTAssertEqual(newRemoved,1)
    }
    func testTrueReturningCurrentPredicateRetirementCannotReviveOldPaint() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var owner:NativeSixSourceSurfaceOwner!,retire=false,paints=0,removed=0
        owner=NativeSixSourceSurfaceOwner(service:service,current:{if retire{owner.dispose()};return true},paintShake:{_ in paints+=1})
        XCTAssertNotNil(owner.start(depth:2,initial:zero,random:{0.5},paintMultiplier:{_ in paints+=1},removeMultiplier:{removed+=1}))
        retire=true;service.deliver(wallMilliseconds:16)
        XCTAssertEqual(paints,0);XCTAssertEqual(removed,1);XCTAssertEqual(service.activeParticipantCount,0)
        service.dispose()
    }
    func testCapturedCarrierCancellationPreservesReplacementShakeAndMultiplier(){
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var oldRemoved=0,newRemoved=0
        let owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in})
        let old=owner.start(depth:2,initial:zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{oldRemoved+=1})!
        let replacement=owner.start(depth:3,initial:zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{newRemoved+=1})!
        owner.cancel(old);owner.cancel(old)
        XCTAssertEqual(oldRemoved,1);XCTAssertEqual(newRemoved,0);XCTAssertEqual(service.activeParticipantCount,3)
        owner.cancel(replacement);XCTAssertEqual(newRemoved,1);XCTAssertEqual(service.activeParticipantCount,0)
        owner.dispose();service.dispose()
    }
    func testCapturedCarrierRetirementDuringRandomRejectsRemainingDrawsWithoutRetiringOwner(){
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var current=true,draws=0,removed=0
        let owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{_ in})
        XCTAssertNil(owner.start(depth:2,initial:zero,random:{draws+=1;if draws==3{current=false};return 0.5},paintMultiplier:{_ in},removeMultiplier:{removed+=1},carrierCurrent:{current}))
        XCTAssertEqual(draws,3);XCTAssertEqual(removed,1);XCTAssertEqual(service.activeParticipantCount,0)
        XCTAssertNotNil(owner.start(depth:3,initial:zero,random:{0.5},paintMultiplier:{_ in},removeMultiplier:{}))
        XCTAssertEqual(service.activeParticipantCount,3);owner.dispose();service.dispose()
    }

    func testV9WildFamilyAndLaserContactShakeParameters() {
        let expected:[NativeWildArchetype:(Double,Double,Double,Int)]=[
            .star:(25,20,0.52,32),.juice:(25,20,0.52,32),
            .magnet:(20,16,0.26,16),.tnt:(32,32,0.26,16)]
        for family in NativeWildArchetype.allCases {
            let row=expected[family]!,normal=NativeSixSourceShakeGraph.Configuration.wild(archetype:family,isFinal:false)
            let final=NativeSixSourceShakeGraph.Configuration.wild(archetype:family,isFinal:true,tntTargetCount:4)
            XCTAssertEqual(normal.strength,row.0);XCTAssertEqual(final.strength,row.1)
            XCTAssertEqual(normal.duration,row.2);XCTAssertEqual(normal.steps,row.3)
            XCTAssertEqual(normal.ease,.sineInOut);XCTAssertEqual(normal.alsoShakeOverlay,family == .tnt)
        }
        for targetCount in [1,2,3,4,8] {
            XCTAssertEqual(NativeSixSourceShakeGraph.Configuration.wild(archetype:.tnt,isFinal:false,tntTargetCount:targetCount).strength,40)
        }
        let pull=NativeSixSourceShakeGraph.Configuration.magnetPull
        XCTAssertEqual(pull.strength,28);XCTAssertEqual(pull.duration,0.36);XCTAssertEqual(pull.steps,28)
        XCTAssertEqual(pull.ease,.sineInOut);XCTAssertFalse(pull.alsoShakeOverlay)
        XCTAssertNil(NativeSixSourceShakeGraph.Configuration.laserImpact(index:0))
        XCTAssertNil(NativeSixSourceShakeGraph.Configuration.laserImpact(index:1))
        let third=NativeSixSourceShakeGraph.Configuration.laserImpact(index:2)!
        let fourth=NativeSixSourceShakeGraph.Configuration.laserImpact(index:3)!
        XCTAssertEqual(third.strength,9);XCTAssertEqual(third.duration,0.18);XCTAssertEqual(third.steps,10)
        XCTAssertEqual(fourth.strength,12);XCTAssertEqual(fourth.duration,0.22);XCTAssertEqual(fourth.steps,12)
        XCTAssertEqual(third.yScale,0.72);XCTAssertEqual(fourth.ease,.power2Out)
        XCTAssertTrue(third.alsoShakeOverlay);XCTAssertNil(NativeSixSourceShakeGraph.Configuration.laserImpact(index:4))
    }
    func testV9SineShakeIndependentOverlayInitialAndDownOnlyFooter() {
        let configuration=NativeSixSourceShakeGraph.Configuration.wild(archetype:.tnt,isFinal:false,tntTargetCount:1)
        var draws=0
        let graph=NativeSixSourceShakeGraph(configuration:configuration,
            initial:.init(canvas:[8,-6],indicator:[4,-2],decor:[2,3],overlay:[0,0]),random:{draws+=1;return draws % 2 == 1 ? 1:0})
        XCTAssertEqual(draws,32)
        // Actual first sine.inOut child halfway; separate CSS transform
        // baselines are preserved, including a newly mounted TNT overlay.
        let pose=graph.advance(0.008125)
        XCTAssertEqual(pose.canvas,[24,-23]);XCTAssertEqual(pose.indicator,[18,-17])
        XCTAssertEqual(pose.decor,[17,1.5]);XCTAssertEqual(pose.overlay,[20,-20])
        let ended=graph.advance(configuration.totalDuration)
        XCTAssertEqual(ended.canvas,[0,0]);XCTAssertEqual(ended.overlay,[0,0])
    }
    func testStandaloneWildShakePausesOnSharedClockAndRetiresAllSurfacesTogether() {
        var now=0.0,surface=zero
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
        let owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{surface=$0})
        let configuration=NativeSixSourceShakeGraph.Configuration.wild(archetype:.tnt,isFinal:false,tntTargetCount:2)
        XCTAssertNotNil(owner.startShake(configuration:configuration,initial:zero,random:{0.9}))
        now=50;service.deliver(wallMilliseconds:now);let paused=surface
        service.setSourceGlobalPaused(true);now=500;service.deliver(wallMilliseconds:now)
        XCTAssertEqual(surface.canvas,paused.canvas);XCTAssertEqual(surface.overlay,paused.overlay)
        service.setSourceGlobalPaused(false);now=1000;service.deliver(wallMilliseconds:now)
        XCTAssertEqual(surface.canvas,[0,0]);XCTAssertEqual(surface.indicator,[0,0]);XCTAssertEqual(surface.decor,[0,0]);XCTAssertEqual(surface.overlay,[0,0])
        XCTAssertEqual(service.activeParticipantCount,0);owner.dispose();service.dispose()
    }
    func testStandaloneWildShakeRetirementDuringSourceRandomDoesNotAdmitStaleRoot() {
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        var current=true,draws=0,paints=0
        let owner=NativeSixSourceSurfaceOwner(service:service,current:{current},paintShake:{_ in paints+=1})
        XCTAssertNil(owner.startShake(configuration:.wild(archetype:.juice,isFinal:false),initial:zero,random:{draws+=1;if draws==3{current=false};return 0.8}))
        XCTAssertEqual(draws,3);XCTAssertEqual(paints,0);XCTAssertEqual(service.activeParticipantCount,0)
        owner.dispose();service.dispose()
    }

    func testEveryWildShakeGraphMatchesImmutableV9ActualGSAPCSSPlugin() throws {
        let url=try XCTUnwrap(Bundle(for:Self.self).url(forResource:"wild-screen-shake-source-oracle",withExtension:"json"))
        let packet=try JSONSerialization.jsonObject(with:Data(contentsOf:url)) as! [String:Any]
        for trace in packet["traces"] as! [[String:Any]] {
            let overlay=trace["overlay"] as! Bool
            let configuration=NativeSixSourceShakeGraph.Configuration(strength:trace["strength"] as! Double,
                duration:trace["duration"] as! Double,steps:trace["steps"] as! Int,
                ease:trace["ease"] as! String == "sine.inOut" ? .sineInOut:.power2Out,
                yScale:trace["yScale"] as! Double,alsoShakeOverlay:overlay)
            var seed:UInt32=127,draws=0
            let graph=NativeSixSourceShakeGraph(configuration:configuration,
                initial:.init(canvas:[8,-6],indicator:[4,-2],decor:[2,3],overlay:overlay ? [0,0]:nil),random:{
                    seed=seed &* 1664525 &+ 1013904223;draws+=1;return Double(seed)/4294967296
                })
            XCTAssertEqual(draws,trace["draws"] as! Int)
            for row in trace["rows"] as! [[String:Any]] {
                let seconds=row["seconds"] as! Double,pose=graph.advance(seconds)
                for (actual,key) in [(pose.canvas,"canvas"),(pose.indicator,"indicator"),(pose.decor,"decor")] {
                    for (a,e) in zip(actual,row[key] as! [Double]) {XCTAssertEqual(a,e,accuracy:1e-10,"\(trace["name"]!)/\(seconds)/\(key)")}
                }
                if overlay {for(a,e)in zip(pose.overlay!,row["overlay"] as! [Double]){XCTAssertEqual(a,e,accuracy:1e-10)}}
            }
        }
    }

    func testCapturedOverlayRetirementCannotMoveReplacementCarrier() {
        final class Carrier {var offset=CGPoint.zero;var paints=0}
        let old=Carrier(),replacement=Carrier();var live=old
        let oldTarget=NativeSourceScreenShakeOverlayTarget(read:{old.offset},paint:{old.offset=$0;old.paints+=1},current:{live === old})
        let newTarget=NativeSourceScreenShakeOverlayTarget(read:{replacement.offset},paint:{replacement.offset=$0;replacement.paints+=1},current:{live === replacement})
        let oldID=UUID(),newID=UUID();var targets=[oldID:oldTarget,newID:newTarget],retired=[UUID]()
        var now=0.0
        let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{now})
        let owner=NativeSixSourceSurfaceOwner(service:service,current:{true},paintShake:{pose in
            if let id=pose.overlayInvocationID,let offset=pose.overlay {targets[id]?.apply(CGPoint(x:offset[0],y:offset[1]))}
        },retiredShake:{pose in if let id=pose.overlayInvocationID {retired.append(id);targets.removeValue(forKey:id)}})
        let configuration=NativeSixSourceShakeGraph.Configuration.wild(archetype:.tnt,isFinal:false,tntTargetCount:1)
        XCTAssertNotNil(owner.startShake(configuration:configuration,initial:.init(canvas:[0,0],indicator:[0,0],decor:[0,0],overlay:[0,0],overlayInvocationID:oldID),random:{0.9}))
        now=50;service.deliver(wallMilliseconds:now);XCTAssertGreaterThan(old.paints,0)
        let oldPose=old.offset,oldPaints=old.paints;live=replacement
        XCTAssertNotNil(owner.startShake(configuration:configuration,initial:.init(canvas:[0,0],indicator:[0,0],decor:[0,0],overlay:[0,0],overlayInvocationID:newID),random:{0.1}))
        now=100;service.deliver(wallMilliseconds:now)
        XCTAssertEqual(old.offset,oldPose);XCTAssertEqual(old.paints,oldPaints)
        XCTAssertGreaterThan(replacement.paints,0);XCTAssertNotEqual(replacement.offset,.zero)
        XCTAssertEqual(retired,[oldID]);XCTAssertNil(targets[oldID]);XCTAssertNotNil(targets[newID])
        oldTarget.apply(.zero);XCTAssertNotEqual(replacement.offset,.zero,"Retired exact target cannot reset a newly mounted overlay")
        // Traverse actual normal Source clock deliveries. A single 900ms
        // hitch is intentionally lag-smoothed and cannot stand in for the
        // replacement root's full animation duration.
        for wall in stride(from:120,through:620,by:20) {now=Double(wall);service.deliver(wallMilliseconds:now)}
        XCTAssertEqual(replacement.offset,.zero);XCTAssertEqual(retired,[oldID,newID]);XCTAssertTrue(targets.isEmpty)
        XCTAssertEqual(old.offset,oldPose);XCTAssertEqual(old.paints,oldPaints)
        owner.dispose();service.dispose()
    }

    func testCoreTntArtAndBoomGlyphCompositeKeepsIndependentRetirement() {
        var art=CGPoint.zero,glyphs=CGPoint.zero,artCurrent=true,glyphsCurrent=true
        let artwork=NativeSourceScreenShakeOverlayTarget(read:{art},paint:{art=$0},current:{artCurrent})
        let boom=NativeSourceScreenShakeOverlayTarget(read:{glyphs},paint:{glyphs=$0},current:{glyphsCurrent})
        let composite=NativeSourceScreenShakeOverlayTarget.combining(artwork,boom)!
        composite.apply(CGPoint(x:12,y:-9));XCTAssertEqual(art,glyphs)
        XCTAssertEqual(art,CGPoint(x:12,y:-9))
        glyphsCurrent=false;composite.apply(.zero)
        XCTAssertEqual(art,.zero);XCTAssertEqual(glyphs,CGPoint(x:12,y:-9),"Retired exact glyph carrier is not rewritten by the still-live art return")
        artCurrent=false;composite.apply(CGPoint(x:8,y:6))
        XCTAssertEqual(art,.zero);XCTAssertFalse(composite.isCurrent)
    }

}
