import XCTest
import UIKit
@testable import Stack_to_Six
@MainActor final class NativeSourceTutorialCTATests:XCTestCase {
 @MainActor private final class Fixture {
  var wall=0.0,current=true,contacts=0,activations=0,exits:[Bool]=[],paint:[NativeSourceTutorialCTAOwner.Pose]=[]
  let fifo=NativeSourceMicrotaskFIFO()
  var service:NativeSourceAnimationClockService!,owner:NativeSourceTutorialCTAOwner!
  init()throws {
   service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{[weak self] in self?.wall ?? 0},sourceFrameTransportEnabled:true);service.sourceMicrotaskTasks=NativeSourceMicrotaskAdapters(fifo:fifo)
   owner=try XCTUnwrap(NativeSourceTutorialCTAOwner(service:service,current:{[weak self] in self?.current==true},paint:{[weak self] in self?.paint.append($0)},contact:{[weak self] in self?.contacts+=1},activate:{[weak self] in guard let self else{return};self.activations+=1;_=self.owner.exit(completed:{[weak self] in self?.exits.append($0)})}))
  }
  func deliver(_ time:Double){wall=time;service.deliver(wallMilliseconds:time)}
  func dispose(){owner.dispose();service.dispose();fifo.dispose()}
 }
 func testImmediateActivationCannotOverwriteActualExitWithReleaseAndWaitsThroughPause()throws {
  let f=try Fixture();defer{f.dispose()};f.owner.prime(hidden:true);XCTAssertTrue(f.owner.enter())
  for t in stride(from:16.0,through:500,by:16){f.deliver(t)}
  XCTAssertEqual(f.owner.state,.idle);f.owner.pointerDown();f.deliver(512);f.deliver(576);f.owner.pointerUp(inside:true)
  XCTAssertEqual(f.contacts,1);XCTAssertEqual(f.activations,1);XCTAssertEqual(f.owner.state,.exiting);XCTAssertTrue(f.exits.isEmpty)
  _=f.service.setSourceGlobalPaused(true);for t in stride(from:592.0,through:1200,by:16){f.deliver(t)};XCTAssertTrue(f.exits.isEmpty)
  _=f.service.setSourceGlobalPaused(false);for t in stride(from:1216.0,through:1800,by:16){f.deliver(t)}
  XCTAssertEqual(f.exits,[true]);XCTAssertEqual(f.owner.state,.hidden);XCTAssertEqual(f.owner.pose.scale,0,accuracy:1e-6)
 }
 func testCapturedOutsideReleaseDoesNotActivateAndRetirementSettlesExactWaiter()throws {
  let f=try Fixture();defer{f.dispose()};f.owner.prime(hidden:false);f.owner.pointerDown();f.owner.pointerUp(inside:false)
  XCTAssertEqual(f.activations,0);for t in stride(from:16.0,through:400,by:16){f.deliver(t)}
  XCTAssertEqual(f.owner.pose.scale,1,accuracy:1e-6);XCTAssertTrue(f.owner.exit(completed:{f.exits.append($0)}))
  let paint=f.owner.pose;f.owner.dispose();XCTAssertEqual(f.exits,[false])
  for t in stride(from:416.0,through:900,by:16){f.deliver(t)};XCTAssertEqual(f.owner.pose,paint);XCTAssertEqual(f.service.activeParticipantCount,0)
 }
 func testMountedOverlayKeepsStaticButtonHitFrameWhileVisualPressAndActualExitRun()throws {
  let f=try Fixture();defer{f.dispose()};let timeouts=NativeSourceAppTimeoutOwner();timeouts.sourceMicrotaskTasks=f.service.sourceMicrotaskTasks
  let overlay=NativeTutorialOverlay(resourceRoot:NativeTestResources.root);defer{overlay.dispose();timeouts.cancelAll()}
  let window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844));let host=UIViewController();window.rootViewController=host;window.makeKeyAndVisible();host.view.addSubview(overlay)
  overlay.frame=host.view.bounds;overlay.layoutIfNeeded()
  XCTAssertTrue(overlay.showSourceIntro(from:nil,to:nil,service:f.service,timeouts:timeouts,boardGeneration:1,current:{f.current}))
  var contacts=0,activations=0,exit:[Bool]=[]
  XCTAssertTrue(overlay.installSourceCTA(service:f.service,current:{f.current},contact:{contacts+=1},activate:{activations+=1;_=overlay.exitSourceCTA(completed:{exit.append($0)})}))
  XCTAssertTrue(overlay.transitionSourceSheetToThirdStep(entered:{}))
  for t in stride(from:16.0,through:1100,by:16){f.deliver(t)}
  XCTAssertEqual(overlay.sourceCTAState,.idle)
  let button=try XCTUnwrap(overlay.subviews.flatMap{ $0.subviews }.compactMap{$0 as? UIButton}.first)
  for width in [390.0,430.0] {
   overlay.frame=CGRect(x:0,y:0,width:width,height:844);overlay.setNeedsLayout();overlay.layoutIfNeeded()
   let size=overlay.bounds.size
   let raster=UIGraphicsImageRenderer(size:size).image{ctx in
    UIColor(red:1,green:247/255,blue:239/255,alpha:1).setFill();ctx.fill(overlay.bounds);overlay.layer.render(in:ctx.cgContext)
   }
   let shot=XCTAttachment(image:raster);shot.name="source-third-cta-\(Int(width))";shot.lifetime = .keepAlways;add(shot)
  }
  overlay.frame=CGRect(x:0,y:0,width:390,height:844);overlay.setNeedsLayout();overlay.layoutIfNeeded()
  let hit=overlay.sourceCTAHitFrame;XCTAssertEqual(hit.width,249);XCTAssertEqual(hit.height,64)
  button.sendActions(for:.touchDown);f.deliver(1120);f.deliver(1248)
  XCTAssertEqual(contacts,1);XCTAssertEqual(overlay.sourceCTAHitFrame,hit);XCTAssertEqual(button.transform,.identity)
  XCTAssertLessThan(overlay.sourceCTAVisualTransform.a,1)
  button.sendActions(for:.touchUpInside);XCTAssertEqual(activations,1);XCTAssertEqual(overlay.sourceCTAState,.exiting);XCTAssertFalse(button.isEnabled)
  for t in stride(from:1264.0,through:1800,by:16){f.deliver(t)}
  XCTAssertEqual(exit,[true]);XCTAssertEqual(overlay.sourceCTAState,.hidden);XCTAssertTrue(button.isHidden)
 }

}
