import XCTest
import SpriteKit
import StackToSixGameplay
@testable import Stack_to_Six

@MainActor
final class NativeIdleBubbleTests:XCTestCase {
    func testCollectionBubblesRemoveDotsAndSquashWithoutChangingBoardMotionOrLifecycle() throws {
        for family in [NativeIdleBubbleMotion.Family.fish,.honey,.bottle,.juice,.beachBall] {
            let modal=NativeIdleBubbleField(family:family,random:{0.5})
            let board=NativeIdleBubbleField(family:family,random:{0.5})
            modal.useCollectionStyle()
            modal.tick(0.2);board.tick(0.2)
            let a=try XCTUnwrap(modal.fishBubbleSnapshots.first),b=try XCTUnwrap(board.fishBubbleSnapshots.first)
            XCTAssertFalse(a.showsHighlight);XCTAssertTrue(b.showsHighlight)
            XCTAssertNotEqual(a.scale,b.scale);XCTAssertEqual(a.alpha,b.alpha)
            XCTAssertEqual(a.radius,b.radius);XCTAssertEqual(a.color,b.color)
            for carrier in modal.children where !carrier.isHidden {
                XCTAssertTrue(carrier.children[1].isHidden,"No inner dot on any modal family")
            }
            for carrier in board.children where !carrier.isHidden {XCTAssertFalse(carrier.children[1].isHidden)}
            XCTAssertEqual(modal.children.filter{$0.zPosition+modal.zPosition<0}.count,3)
            XCTAssertEqual(modal.children.filter{$0.zPosition+modal.zPosition>0}.count,3)
            var depths:[Int:Bool]=[:]
            for _ in 0..<120 {
                modal.tick(0.05)
                for bubble in modal.fishBubbleSnapshots {depths[bubble.slot]=bubble.behindArtwork}
            }
            XCTAssertEqual(depths.count,6)
            XCTAssertEqual(depths.values.filter{$0}.count,3)
            XCTAssertTrue(board.fishBubbleSnapshots.allSatisfy{!$0.behindArtwork})
            modal.stopForPointer();XCTAssertEqual(modal.activeCount,0)
            modal.restartAfterLanding();XCTAssertTrue(modal.fishBubbleSnapshots.allSatisfy{!$0.showsHighlight})
            modal.dispose();modal.dispose();modal.tick(10)
            XCTAssertEqual(modal.activeCount,0);XCTAssertTrue(modal.children.isEmpty)
            board.dispose()
        }
        let base=NativeIdleBubbleMotion.Pose(x:0,y:0,scaleX:1,scaleY:1,alpha:0.5,tint:0xFFFFFF)
        let poses=(0...120).map{NativeIdleBubbleMotion.collectionPose(base,seconds:Double($0)/60)}
        XCTAssertTrue(poses.contains{$0.scaleX>1.08 && $0.scaleY<0.95})
        XCTAssertTrue(poses.contains{$0.scaleX<0.95 && $0.scaleY>1.08})
        XCTAssertTrue(poses.allSatisfy{$0.scaleX>0.75 && $0.scaleX<1.3 && $0.scaleY>0.75 && $0.scaleY<1.3 && abs($0.y)<=2.2})
    }
    private struct Frame:Decodable {let time:Double,frame:Int,draws:Int,bubbles:[Bubble]}
    private struct Bubble:Decodable {let id:Int,x:Double,y:Double,scaleX:Double,scaleY:Double,alpha:Double,tint:UInt32}
    private struct Fixture:Decodable {let family:String,seed:UInt32,frames:[Frame]}
    private func family(_ name:String)->NativeIdleBubbleMotion.Family {
        switch name {case "honey":return .honey;case "bottle":return .bottle;case "fish":return .fish;case "beach-ball":return .beachBall;default:return .juice}
    }
    func testVisibleProducerMatchesUnmodifiedV9OriginalGSAPThroughPickupAndStalledFrames() throws {
        let fixtures=try JSONDecoder().decode([Fixture].self,from:Data(NativeIdleBubbleSourceOracle.json.utf8))
        XCTAssertEqual(fixtures.count,15)
        for fixture in fixtures {
            var rng=fixture.seed,draws=0
            let runtime=NativeIdleBubbleMotion.Runtime(family:family(fixture.family),random:{draws+=1;rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296})
            let samples=Dictionary(uniqueKeysWithValues:fixture.frames.map {($0.frame,$0)})
            var last=0.0
            for index in 0...1200 {
                let time=Double(index)/60+(index>=120 ? 0.37:0)+(index>=360 ? 0.41:0)+(index>=850 ? 0.29:0)
                runtime.advance(time-last);last=time
                if index==240 || index==720 {runtime.stopForPointer()}
                if index==270 || index==750 {runtime.restartAfterLanding()}
                XCTAssertLessThanOrEqual(runtime.bubbles.count,6)
                guard let sample=samples[index] else {continue}
                XCTAssertEqual(draws,sample.draws,"Original producer/RNG source \(fixture.family),frame\(index)")
                XCTAssertEqual(runtime.bubbles.count,sample.bubbles.count)
                for (native,gold) in zip(runtime.bubbles,sample.bubbles) {
                    let pose=native.plan.sample(seconds:runtime.elapsed-native.born)
                    XCTAssertEqual(native.id,gold.id);XCTAssertEqual(pose.tint,gold.tint)
                    // Actual GSAP rounds numeric pose properties to six digits.
                    XCTAssertEqual(pose.x,gold.x,accuracy:3e-5);XCTAssertEqual(pose.y,gold.y,accuracy:3e-5)
                    XCTAssertEqual(pose.scaleX,gold.scaleX,accuracy:3e-5);XCTAssertEqual(pose.scaleY,gold.scaleY,accuracy:3e-5)
                    XCTAssertEqual(pose.alpha,gold.alpha,accuracy:3e-5)
                }
            }
        }
    }
    func testNativeRawArchetypeNamesSelectOriginalFizzFamiliesAndCustomBranchesStayExcluded() {
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"wild-juice",variant:nil),.juice)
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"juice",variant:nil),.juice)
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"wild",variant:"fish"),.fish)
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"wild-magnet",variant:"bottle"),.bottle)
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"wild-magnet",variant:"honey"),.honey)
        XCTAssertEqual(NativeIdleBubbleMotion.family(kind:"wild-tnt",variant:"beach-ball"),.beachBall)
        XCTAssertNil(NativeIdleBubbleMotion.family(kind:"wild-juice",variant:"mushroom"))
        XCTAssertNil(NativeIdleBubbleMotion.family(kind:"wild-juice",variant:"robo-cube"))
        XCTAssertNil(NativeIdleBubbleMotion.family(kind:"wild-tnt",variant:nil))
    }

    func testVectorCarriersStayBoundedAndReuseTheSameNativeNodes() throws {
        var rng=UInt32(17)
        let field=NativeIdleBubbleField(family:.bottle,random:{rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296})
        let owner=SKNode();owner.addChild(field)
        let carriers=Set(field.children.map(ObjectIdentifier.init)),vectors=Set(field.children.flatMap(\.children).map(ObjectIdentifier.init))
        XCTAssertEqual(carriers.count,6);XCTAssertEqual(vectors.count,18)
        for _ in 0..<2400 {field.tick(1/60);XCTAssertLessThanOrEqual(field.activeCount,6)}
        XCTAssertEqual(Set(field.children.map(ObjectIdentifier.init)),carriers)
        XCTAssertEqual(Set(field.children.flatMap(\.children).map(ObjectIdentifier.init)),vectors)
        field.stopForPointer();XCTAssertFalse(field.isRunning);XCTAssertEqual(field.activeCount,0)
        XCTAssertTrue(field.children.allSatisfy(\.isHidden))
        field.tick(5);XCTAssertEqual(field.activeCount,0,"Pointer stop cannot create a new hidden producer")
        field.restartAfterLanding();XCTAssertTrue(field.isRunning);XCTAssertEqual(field.activeCount,1)
        field.dispose();field.dispose();field.tick(1);field.restartAfterLanding()
        XCTAssertNil(field.parent);XCTAssertTrue(field.children.isEmpty);XCTAssertFalse(field.isRunning)
    }
    func testNativePointerStopsFizzUntilActualV9ReturnTimelineFinishes() async throws {
        let root=Bundle.main.bundleURL.appendingPathComponent("NativeAssets.bundle")
        let bottle=NativeTile(id:"bottle",cell:NativeCell(column:0,row:0),value:0,archetype:.magnet,variant:"bottle")
        let engine=NativeGameplayEngine(state:NativeBoardState(columns:5,rows:9,tiles:[bottle,NativeTile(id:"a",cell:NativeCell(column:1,row:0),value:1),NativeTile(id:"b",cell:NativeCell(column:2,row:0),value:1)]))
        let scene=NativeBoardScene(engine:engine,resourceRoot:root,size:CGSize(width:390,height:844));scene.layout(size:scene.size,insets:.zero)
        let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),controller=UIViewController(),renderer=SKView(frame:window.bounds)
        controller.view=renderer;window.rootViewController=controller;window.makeKeyAndVisible();renderer.presentScene(scene)
        defer {scene.dispose();renderer.presentScene(nil);window.isHidden=true}
        let node=try XCTUnwrap(scene.childNode(withName:"//native-die-bottle") as? NativeDiceNode)
        let field=try XCTUnwrap(node.visual.children.compactMap {$0 as? NativeIdleBubbleField}.first)
        XCTAssertTrue(field.isRunning)
        let returned=expectation(description:"Original0.18 position plus appended0.105 recovery actually completed")
        let resourceWakeup=node.onResourceReady
        var completed=0
        node.onResourceReady={resourceWakeup?();if field.isRunning {completed+=1;returned.fulfill()}}
        let point=scene.boardGeometry!.center(row:0,column:0)
        XCTAssertTrue(scene.beginDrag(at:point));XCTAssertFalse(field.isRunning);XCTAssertEqual(field.activeCount,0)
        let started=CACurrentMediaTime()
        XCTAssertEqual(scene.finishDrag(at:point,now:1)?.accepted,false)
        XCTAssertFalse(field.isRunning,"Pointer-up alone cannot restart the source producer")
        await fulfillment(of:[returned],timeout:3)
        XCTAssertGreaterThanOrEqual(CACurrentMediaTime()-started,0.265)
        XCTAssertEqual(completed,1);XCTAssertTrue(field.isRunning)
        XCTAssertTrue(scene.beginDrag(at:point));XCTAssertFalse(field.isRunning)
        XCTAssertEqual(scene.finishDrag(at:point,now:2)?.accepted,false)
        XCTAssertTrue(scene.beginDrag(at:point),"Second accepted pickup interrupts the previous landing owner")
        try await Task.sleep(for:.milliseconds(350))
        XCTAssertFalse(field.isRunning);XCTAssertEqual(completed,1,"Interrupted landing cannot replay an old producer")
    }


    func testSourceBubbleIndependentRootsRetireOnlyAtAppMicrotaskCheckpoint() throws {
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:NativeSourceMicrotaskFIFO.meterBoundaries,isCurrent:{true}))
        defer{scope.dispose();fifo.dispose();service.dispose()}
        var seed:UInt32=1,retired=0,poses:[NativeIdleBubbleMotion.Pose]=[]
        let plan=NativeIdleBubbleMotion.make(family:.bottle,random:{seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296})
        let bubble=NativeSourceFizzBubbleClock(service:service,tasks:scope,plan:plan,current:{true},paint:{poses.append($0)},retired:{retired+=1})
        defer{bubble.dispose()}
        XCTAssertTrue(bubble.start());XCTAssertEqual(bubble.activeRootCount,4)
        for ms in [200.0,500,800]{
            XCTAssertTrue(fifo.performTask(.sourceAnimationFrameCallback){service.deliver(wallMilliseconds:ms)})
            let pose=try XCTUnwrap(poses.last),gold=plan.sample(seconds:ms/1000)
            XCTAssertEqual(pose.x,gold.x,accuracy:3e-5);XCTAssertEqual(pose.y,gold.y,accuracy:3e-5)
            XCTAssertEqual(pose.scaleX,gold.scaleX,accuracy:3e-5);XCTAssertEqual(pose.scaleY,gold.scaleY,accuracy:3e-5)
            XCTAssertEqual(pose.alpha,gold.alpha,accuracy:3e-5);XCTAssertEqual(pose.tint,gold.tint)
        }
        XCTAssertEqual(retired,0)
        XCTAssertTrue(fifo.performTask(.sourceAnimationFrameCallback){
            service.deliver(wallMilliseconds:1100)
            XCTAssertEqual(retired,0,"Rise callback cannot repool during the active root render")
            XCTAssertEqual(fifo.pendingCount,1)
        })
        XCTAssertEqual(retired,1);XCTAssertEqual(bubble.activeRootCount,0)
        XCTAssertTrue(fifo.performTask(.sourceAnimationFrameCallback){service.deliver(wallMilliseconds:1400)})
        XCTAssertEqual(retired,1)
    }

    func testMountedSourceFieldUsesSharedRootsWithoutRawTickAndPointerStopRetiresOnlyItsRoots() throws {
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:NativeSourceMicrotaskFIFO.meterBoundaries,isCurrent:{true}))
        defer{scope.dispose();fifo.dispose();service.dispose()}
        var draws=0,seed:UInt32=1
        let field=NativeIdleBubbleField(sourceFamily:.bottle,service:service,tasks:scope,random:{draws+=1;seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296},current:{true},paintable:{true})
        let host=SKNode();host.addChild(field);defer{field.dispose()}
        let carriers=Set(field.children.map(ObjectIdentifier.init))
        XCTAssertEqual(draws,0);XCTAssertTrue(field.startSource());XCTAssertEqual(draws,12)
        XCTAssertEqual(field.activeCount,1);XCTAssertEqual(service.activeParticipantCount,5)
        field.tick(100);XCTAssertEqual(draws,12,"Raw Scene tick cannot advance Source producer")
        XCTAssertTrue(fifo.performTask(.sourceAnimationFrameCallback){service.deliver(wallMilliseconds:500)})
        XCTAssertEqual(draws,24);XCTAssertEqual(field.activeCount,2)
        field.stopForPointer();XCTAssertEqual(service.activeParticipantCount,0);XCTAssertEqual(field.activeCount,0)
        XCTAssertTrue(fifo.performTask(.sourceAnimationFrameCallback){service.deliver(wallMilliseconds:800)})
        XCTAssertEqual(draws,24);field.restartAfterLanding();XCTAssertEqual(draws,36)
        XCTAssertEqual(field.activeCount,1);XCTAssertEqual(Set(field.children.map(ObjectIdentifier.init)),carriers)
        field.dispose();XCTAssertEqual(service.activeParticipantCount,0);XCTAssertNil(field.parent)
        field.restartAfterLanding();XCTAssertEqual(draws,36)
    }

    func testSourceFieldHiddenLandingStartsAtomicallySuspendedOnSharedClock() throws {
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:NativeSourceMicrotaskFIFO.meterBoundaries,isCurrent:{true}))
        defer{scope.dispose();fifo.dispose();service.dispose()}
        var draws=0
        let field=NativeIdleBubbleField(sourceFamily:.bottle,service:service,tasks:scope,random:{draws+=1;return 0.5},current:{true},paintable:{true})
        defer{field.dispose()}
        XCTAssertTrue(field.startSource());field.setSourceVisible(false);field.stopForPointer()
        field.restartAfterLanding();XCTAssertEqual(draws,24)
        XCTAssertFalse(service.hasActiveClock,"Hidden landing must not wake a runnable Source root")
        XCTAssertTrue(fifo.performTask(.sourceAnimationFrameCallback){service.deliver(wallMilliseconds:500)})
        XCTAssertEqual(draws,24)
        field.setSourceVisible(true)
        XCTAssertTrue(fifo.performTask(.sourceAnimationFrameCallback){service.deliver(wallMilliseconds:950)})
        XCTAssertEqual(draws,36)
    }

#if DEBUG
    func testIndependentSourceRootsPaintOnlyTheirOwnCarrierAndKeepRenderedPoses() throws {
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:NativeSourceMicrotaskFIFO.meterBoundaries,isCurrent:{true}))
        defer{scope.dispose();fifo.dispose();service.dispose()}
        var seed:UInt32=1
        let field=NativeIdleBubbleField(sourceFamily:.bottle,service:service,tasks:scope,random:{seed=seed &* 1664525 &+ 1013904223;return Double(seed)/4294967296},current:{true},paintable:{true})
        defer{field.dispose()}
        XCTAssertTrue(field.startSource())
        XCTAssertTrue(fifo.performTask(.sourceAnimationFrameCallback){service.deliver(wallMilliseconds:500)})
        XCTAssertEqual(field.activeCount,2,"Exercise concurrent bubbles, where whole-field publication multiplied render work")
        let paints=field.carrierPaintCount,publishes=field.sourcePosePublishCount
        XCTAssertTrue(fifo.performTask(.sourceAnimationFrameCallback){service.deliver(wallMilliseconds:550)})
        XCTAssertGreaterThan(field.sourcePosePublishCount-publishes,2,"Independent roots must actually execute")
        XCTAssertEqual(field.carrierPaintCount-paints,field.sourcePosePublishCount-publishes,"One root publication must update one carrier, irrespective of other bubbles")
        print("SourceFizzRenderWork active=\(field.activeCount) publications=\(field.sourcePosePublishCount-publishes) carrierWrites=\(field.carrierPaintCount-paints) previousWholeFieldWrites=\((field.sourcePosePublishCount-publishes)*field.activeCount)")
        let visible=field.children.filter{!$0.isHidden}
        XCTAssertEqual(visible.count,field.activeCount)
        for snapshot in field.fishBubbleSnapshots {
            let node=try XCTUnwrap(visible.first{abs($0.position.x-snapshot.point.x)<1e-5 && abs($0.position.y+snapshot.point.y)<1e-5})
            XCTAssertEqual(node.xScale,snapshot.scale.x,accuracy:1e-5)
            XCTAssertEqual(node.yScale,snapshot.scale.y,accuracy:1e-5)
            XCTAssertEqual(node.alpha,snapshot.alpha,accuracy:1e-5)
        }
    }

    func testUnchangedSourceBubbleTintDoesNotReallocateVectorColors() throws {
        let fifo=NativeSourceMicrotaskFIFO(),service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0})
        let scope=try XCTUnwrap(fifo.makeMeterScope(boundProducers:NativeSourceMicrotaskFIFO.meterBoundaries,isCurrent:{true}))
        defer{scope.dispose();fifo.dispose();service.dispose()}
        let field=NativeIdleBubbleField(sourceFamily:.juice,service:service,tasks:scope,random:{0.5},current:{true},paintable:{true})
        defer{field.dispose()}
        XCTAssertTrue(field.startSource());XCTAssertEqual(field.colorPaintCount,1)
        for ms in [50.0,100,150,200] {
            XCTAssertTrue(fifo.performTask(.sourceAnimationFrameCallback){service.deliver(wallMilliseconds:ms)})
        }
        XCTAssertEqual(field.activeCount,1);XCTAssertGreaterThan(field.carrierPaintCount,4)
        XCTAssertEqual(field.colorPaintCount,1,"Position/scale/fade publications must retain unchanged original colors")
    }
#endif

    func testDragTrailSharedRastersPreserveOriginalRenderedGeometryAcrossPoolReuse() throws {
        let trail=NativeDragTrail(),host=SKNode();host.addChild(trail)
        defer{trail.dispose()}
        var reused=Set<ObjectIdentifier>()
        for (wild,round) in [(false,true),(true,false),(true,true)] {
            trail.begin(at:.zero,time:0)
            trail.emit(at:CGPoint(x:100,y:0),time:16,scale:0.475,wild:wild,round:round)
            XCTAssertFalse(trail.live.isEmpty)
            for particle in trail.live {
                let expected=wild && !round ? NativeDragTrail.unitSquareTexture:NativeDragTrail.unitCircleTexture
                XCTAssertTrue(particle.texture === expected)
                XCTAssertEqual(particle.size.width,2*particle.xScale,accuracy:1e-4)
                XCTAssertEqual(particle.size.height,2*particle.yScale,accuracy:1e-4)
                let rect=CGRect(x:-particle.xScale,y:-particle.yScale,width:2*particle.xScale,height:2*particle.yScale)
                let original=SKShapeNode(path:wild && !round ? CGPath(rect:rect,transform:nil):CGPath(ellipseIn:rect,transform:nil))
                original.strokeColor = .clear;original.lineWidth=0;original.position=particle.position;original.zRotation=particle.zRotation
                let gold=original.frame,actual=particle.frame
                XCTAssertEqual(actual.minX,gold.minX,accuracy:1e-4)
                XCTAssertEqual(actual.minY,gold.minY,accuracy:1e-4)
                XCTAssertEqual(actual.width,gold.width,accuracy:1e-4)
                XCTAssertEqual(actual.height,gold.height,accuracy:1e-4)
            }
            let current=Set(trail.live.map(ObjectIdentifier.init))
            if !reused.isEmpty {XCTAssertTrue(current.isSubset(of:reused),"Shape changes must reuse pooled nodes")}
            reused.formUnion(current);trail.clear();XCTAssertFalse(trail.hasTail)
        }
    }
#if DEBUG
    func testDragTrailPoolOnlyReassignsTexturesWhenShapeChanges() {
        let trail=NativeDragTrail();defer{trail.dispose()}
        func burst(wild:Bool,round:Bool) {
            trail.begin(at:.zero,time:0)
            trail.emit(at:CGPoint(x:100,y:0),time:16,scale:0.475,wild:wild,round:round)
        }
        burst(wild:false,round:true)
        XCTAssertEqual(trail.live.count,4);XCTAssertEqual(trail.textureAssignmentCount,4)
        trail.clear();burst(wild:false,round:true)
        XCTAssertEqual(trail.live.count,4)
        XCTAssertEqual(trail.textureAssignmentCount,4,"Same-circle reuse must not reinstall its shared texture")
        trail.clear();burst(wild:true,round:false)
        XCTAssertEqual(trail.live.count,2);XCTAssertEqual(trail.textureAssignmentCount,6)
        trail.clear();burst(wild:true,round:true)
        XCTAssertEqual(trail.live.count,2);XCTAssertEqual(trail.textureAssignmentCount,8,"Square-to-circle reuse must update the two changed textures")
    }
#endif

    private struct TrailOracle:Decodable {
        let id:String,core:String,seed:UInt32,colors:[UInt32],round:Bool,width:Double,height:Double,color:UInt32,fill:Double,x:Double,y:Double,rotation:Double,endX:Double,endY:Double,endRotation:Double,life:Double,draws:Int
    }
    // Captured by executing unmodified magicSparklesAtTile from immutable
    // fc085599e759369900d5dc4135246a9f1355a897 with its registry/template palettes.
    func testAllSeventeenTrailFamiliesMatchActualV9ParticleDrawsAndRenderedOutput() throws {
        let fixtures=try JSONDecoder().decode([TrailOracle].self,from:Data(Self.trailOracleJSON.utf8))
        XCTAssertEqual(Set(fixtures.map{$0.id}).count,17);XCTAssertEqual(fixtures.count,51)
        for f in fixtures {
            let core:NativeWildArchetype=f.core == "wild-star" ? .star:f.core == "wild-juice" ? .juice:f.core == "wild-magnet" ? .magnet:.tnt
            let style=NativeDragTrailStyle.resolve(core:core,variant:f.id.hasPrefix("wild-") ? nil:f.id)
            XCTAssertEqual(style.colors,f.colors,f.id);XCTAssertEqual(style.round,f.round,f.id)
            var rng=f.seed,draws=0
            let random:()->Double={draws+=1;rng=rng &* 1664525 &+ 1013904223;return Double(rng)/4294967296}
            let scale:CGFloat=0.475
            let plan=NativeDragTrailParticlePlan.make(style:style,origin:.zero,scale:scale,random:random)
            XCTAssertEqual(draws,f.draws,f.id);XCTAssertEqual(plan.color,f.color,f.id)
            XCTAssertEqual(plan.size.width,f.width*Double(scale),accuracy:1e-8,f.id)
            XCTAssertEqual(plan.size.height,f.height*Double(scale),accuracy:1e-8,f.id)
            XCTAssertEqual(plan.start.x,f.x*Double(scale),accuracy:1e-8,f.id)
            XCTAssertEqual(plan.start.y,-f.y*Double(scale),accuracy:1e-8,f.id)
            XCTAssertEqual(plan.end.x,f.endX*Double(scale),accuracy:1e-8,f.id)
            XCTAssertEqual(plan.end.y,-f.endY*Double(scale),accuracy:1e-8,f.id)
            XCTAssertEqual(plan.rotation,-f.rotation,accuracy:1e-8,f.id)
            XCTAssertEqual(plan.endRotation,-f.endRotation,accuracy:1e-8,f.id)
            XCTAssertEqual(plan.life,f.life,accuracy:1e-8,f.id)
            rng=f.seed;draws=0
            let trail=NativeDragTrail(random:random);defer{trail.dispose()}
            trail.begin(at:.zero,time:0)
            trail.emit(at:CGPoint(x:100,y:0),time:16,scale:scale,style:style)
            XCTAssertEqual(trail.live.count,2,f.id)
            let particle=try XCTUnwrap(trail.children.first as? SKSpriteNode)
            // SpriteKit/UIColor store renderer-facing properties as Float32.
            // Keep the pure plan/original-v9 comparisons above at Double precision.
            func rendered(_ value:CGFloat)->CGFloat {CGFloat(Float(value))}
            XCTAssertEqual(particle.position.x,rendered(plan.start.x+26*scale),accuracy:1e-8,f.id)
            XCTAssertEqual(particle.position.y,rendered(plan.start.y),accuracy:1e-8,f.id)
            XCTAssertEqual(particle.xScale,rendered(plan.size.width/2),accuracy:1e-8,f.id)
            XCTAssertEqual(particle.yScale,rendered(plan.size.height/2),accuracy:1e-8,f.id)
            XCTAssertEqual(particle.zRotation,rendered(plan.rotation),accuracy:1e-8,f.id)
            XCTAssertEqual(particle.alpha,rendered(CGFloat(f.fill*f.fill)),accuracy:1e-8,f.id)
            var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0
            XCTAssertTrue(particle.color.getRed(&r,green:&g,blue:&b,alpha:&a))
            XCTAssertEqual(r,rendered(CGFloat((f.color>>16)&255)/255),accuracy:1e-8,f.id)
            XCTAssertEqual(g,rendered(CGFloat((f.color>>8)&255)/255),accuracy:1e-8,f.id)
            XCTAssertEqual(b,rendered(CGFloat(f.color&255)/255),accuracy:1e-8,f.id)
            XCTAssertEqual(a,1,accuracy:1e-8,f.id)
            // Release retains the existing authored tail; it cannot emit anew.
            let particles=Set(trail.live.map(ObjectIdentifier.init))
            trail.end();trail.emit(at:CGPoint(x:200,y:0),time:32,scale:scale,style:style)
            XCTAssertEqual(Set(trail.live.map(ObjectIdentifier.init)),particles,f.id)
            trail.clear();XCTAssertFalse(trail.hasTail);XCTAssertTrue(trail.live.isEmpty)
            XCTAssertTrue(trail.children.allSatisfy(\.isHidden),"clear retains only hidden reusable carriers")
            trail.dispose();XCTAssertTrue(trail.children.isEmpty)
        }
    }
    private static let trailOracleJSON = #"""
[{"id":"fish","core":"wild-star","seed":1,"colors":[16111807,16624760,16622680,16612417],"round":true,"width":22.784664010703565,"height":22.784664010703565,"color":16111807,"fill":0.92,"x":-45.16510082063843,"y":-1.2040920322902735,"rotation":0.3175749847985472,"endX":-84.81483602148535,"endY":8.837950672182476,"endRotation":0.670618185824952,"life":0.3049479707144201,"draws":9},{"id":"fish","core":"wild-star","seed":42,"colors":[16111807,16624760,16622680,16612417],"round":true,"width":18.106400755643847,"height":18.106400755643847,"color":16624760,"fill":0.92,"x":-17.844890573940567,"y":-9.416995850858905,"rotation":2.360342630979059,"endX":-34.77606933207707,"endY":-0.3907601539778551,"endRotation":-0.03694386754608647,"life":0.5621441117255017,"draws":9},{"id":"fish","core":"wild-star","seed":123456,"colors":[16111807,16624760,16622680,16612417],"round":true,"width":20.011245635151862,"height":20.011245635151862,"color":16111807,"fill":0.92,"x":19.38736235496147,"y":32.31879434210322,"rotation":4.036295285294227,"endX":55.61594341310443,"endY":33.723096506256304,"endRotation":2.2775420850439674,"life":0.43298671517986803,"draws":9},{"id":"kanta","core":"wild-star","seed":1,"colors":[15450779,14527871,14483195,10288636],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":15450779,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"kanta","core":"wild-star","seed":42,"colors":[15450779,14527871,14483195,10288636],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":14527871,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"kanta","core":"wild-star","seed":123456,"colors":[15450779,14527871,14483195,10288636],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":15450779,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"bee","core":"wild-star","seed":1,"colors":[16446701,16441531,14385765,14061154],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":16446701,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"bee","core":"wild-star","seed":42,"colors":[16446701,16441531,14385765,14061154],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":16441531,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"bee","core":"wild-star","seed":123456,"colors":[16446701,16441531,14385765,14061154],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":16446701,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"laser-gun","core":"wild-tnt","seed":1,"colors":[16703405,16630654,15060132,9955837,16767334,16770713],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":16630654,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"laser-gun","core":"wild-tnt","seed":42,"colors":[16703405,16630654,15060132,9955837,16767334,16770713],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":16630654,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"laser-gun","core":"wild-tnt","seed":123456,"colors":[16703405,16630654,15060132,9955837,16767334,16770713],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":16703405,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"spaceship","core":"wild-magnet","seed":1,"colors":[16309439,15711887,8190973,9105150],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":16309439,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"spaceship","core":"wild-magnet","seed":42,"colors":[16309439,15711887,8190973,9105150],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":15711887,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"spaceship","core":"wild-magnet","seed":123456,"colors":[16309439,15711887,8190973,9105150],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":16309439,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"bottle","core":"wild-magnet","seed":1,"colors":[16632457,14215626,13167824,11463142],"round":true,"width":22.784664010703565,"height":22.784664010703565,"color":16632457,"fill":0.92,"x":-45.16510082063843,"y":-1.2040920322902735,"rotation":0.3175749847985472,"endX":-84.81483602148535,"endY":8.837950672182476,"endRotation":0.670618185824952,"life":0.3049479707144201,"draws":9},{"id":"bottle","core":"wild-magnet","seed":42,"colors":[16632457,14215626,13167824,11463142],"round":true,"width":18.106400755643847,"height":18.106400755643847,"color":14215626,"fill":0.92,"x":-17.844890573940567,"y":-9.416995850858905,"rotation":2.360342630979059,"endX":-34.77606933207707,"endY":-0.3907601539778551,"endRotation":-0.03694386754608647,"life":0.5621441117255017,"draws":9},{"id":"bottle","core":"wild-magnet","seed":123456,"colors":[16632457,14215626,13167824,11463142],"round":true,"width":20.011245635151862,"height":20.011245635151862,"color":16632457,"fill":0.92,"x":19.38736235496147,"y":32.31879434210322,"rotation":4.036295285294227,"endX":55.61594341310443,"endY":33.723096506256304,"endRotation":2.2775420850439674,"life":0.43298671517986803,"draws":9},{"id":"honey","core":"wild-magnet","seed":1,"colors":[16502937,16704696,16633173,16363322],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":16502937,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"honey","core":"wild-magnet","seed":42,"colors":[16502937,16704696,16633173,16363322],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":16704696,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"honey","core":"wild-magnet","seed":123456,"colors":[16502937,16704696,16633173,16363322],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":16502937,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"flower","core":"wild-tnt","seed":1,"colors":[16770260,16759725,16357791,16765527,16767334,16770713],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":16759725,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"flower","core":"wild-tnt","seed":42,"colors":[16770260,16759725,16357791,16765527,16767334,16770713],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":16759725,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"flower","core":"wild-tnt","seed":123456,"colors":[16770260,16759725,16357791,16765527,16767334,16770713],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":16770260,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"barell","core":"wild-tnt","seed":1,"colors":[14140348,14863808,16104805,15379809,16767334,16770713],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":14863808,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"barell","core":"wild-tnt","seed":42,"colors":[14140348,14863808,16104805,15379809,16767334,16770713],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":14863808,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"barell","core":"wild-tnt","seed":123456,"colors":[14140348,14863808,16104805,15379809,16767334,16770713],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":14140348,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"mushroom","core":"wild-juice","seed":1,"colors":[16769480,16772569,16751232,16743777],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":16769480,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"mushroom","core":"wild-juice","seed":42,"colors":[16769480,16772569,16751232,16743777],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":16772569,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"mushroom","core":"wild-juice","seed":123456,"colors":[16769480,16772569,16751232,16743777],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":16769480,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"robo-cube","core":"wild-juice","seed":1,"colors":[16700572,15310175,11179138,9105150],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":16700572,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"robo-cube","core":"wild-juice","seed":42,"colors":[16700572,15310175,11179138,9105150],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":15310175,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"robo-cube","core":"wild-juice","seed":123456,"colors":[16700572,15310175,11179138,9105150],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":16700572,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"cubero","core":"wild-star","seed":1,"colors":[15980472,16246999,16565628,16623436],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":15980472,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"cubero","core":"wild-star","seed":42,"colors":[15980472,16246999,16565628,16623436],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":16246999,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"cubero","core":"wild-star","seed":123456,"colors":[15980472,16246999,16565628,16623436],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":15980472,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"beach-ball","core":"wild-tnt","seed":1,"colors":[4966908,14521579,16622759,16640908,16767334,16770713],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":14521579,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"beach-ball","core":"wild-tnt","seed":42,"colors":[4966908,14521579,16622759,16640908,16767334,16770713],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":14521579,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"beach-ball","core":"wild-tnt","seed":123456,"colors":[4966908,14521579,16622759,16640908,16767334,16770713],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":4966908,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"wild-star","core":"wild-star","seed":1,"colors":[15980472,16246999,16565628,16623436],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":15980472,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"wild-star","core":"wild-star","seed":42,"colors":[15980472,16246999,16565628,16623436],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":16246999,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"wild-star","core":"wild-star","seed":123456,"colors":[15980472,16246999,16565628,16623436],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":15980472,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"wild-juice","core":"wild-juice","seed":1,"colors":[16503445,16367260,16180936,16358775],"round":true,"width":22.784664010703565,"height":22.784664010703565,"color":16503445,"fill":0.92,"x":-45.16510082063843,"y":-1.2040920322902735,"rotation":0.3175749847985472,"endX":-84.81483602148535,"endY":8.837950672182476,"endRotation":0.670618185824952,"life":0.3049479707144201,"draws":9},{"id":"wild-juice","core":"wild-juice","seed":42,"colors":[16503445,16367260,16180936,16358775],"round":true,"width":18.106400755643847,"height":18.106400755643847,"color":16367260,"fill":0.92,"x":-17.844890573940567,"y":-9.416995850858905,"rotation":2.360342630979059,"endX":-34.77606933207707,"endY":-0.3907601539778551,"endRotation":-0.03694386754608647,"life":0.5621441117255017,"draws":9},{"id":"wild-juice","core":"wild-juice","seed":123456,"colors":[16503445,16367260,16180936,16358775],"round":true,"width":20.011245635151862,"height":20.011245635151862,"color":16503445,"fill":0.92,"x":19.38736235496147,"y":32.31879434210322,"rotation":4.036295285294227,"endX":55.61594341310443,"endY":33.723096506256304,"endRotation":2.2775420850439674,"life":0.43298671517986803,"draws":9},{"id":"wild-magnet","core":"wild-magnet","seed":1,"colors":[15884340,16087642,16290944,16494246,16632012],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":16087642,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"wild-magnet","core":"wild-magnet","seed":42,"colors":[15884340,16087642,16290944,16494246,16632012],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":16087642,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"wild-magnet","core":"wild-magnet","seed":123456,"colors":[15884340,16087642,16290944,16494246,16632012],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":15884340,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10},{"id":"wild-tnt","core":"wild-tnt","seed":1,"colors":[15227962,15432282,15767680,16103078,16767334,16770713],"round":false,"width":17.088498008027674,"height":25.030587417483332,"color":15432282,"fill":0.92,"x":-3.1494208382512743,"y":-10.810774277928964,"rotation":2.321752294485217,"endX":-0.17446362110092317,"endY":-20.02090461693234,"endRotation":-0.7162103027939124,"life":0.4917738119373098,"draws":10},{"id":"wild-tnt","core":"wild-tnt","seed":42,"colors":[15227962,15432282,15767680,16103078,16767334,16770713],"round":false,"width":13.579800566732883,"height":26.245959138572218,"color":15432282,"fill":0.92,"x":4.824209886166646,"y":27.697231357272756,"rotation":0.16125106985144877,"endX":9.7872769269838,"endY":42.72998559652313,"endRotation":2.5099918534527097,"life":0.5983902825973928,"draws":10},{"id":"wild-tnt","core":"wild-tnt","seed":123456,"colors":[15227962,15432282,15767680,16103078,16767334,16770713],"round":false,"width":15.008434226363898,"height":19.369022223055364,"color":15227962,"fill":0.92,"x":-38.96377552541226,"y":-15.522274809882951,"rotation":0.09182566792479151,"endX":-63.86937814465553,"endY":-21.926058906577,"endRotation":-0.26449973610425714,"life":0.5829051617067307,"draws":10}]
"""#
}
