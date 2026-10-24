import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeCoconutTests:XCTestCase {
 private func prepared()async throws->NativeSelectedUIKitFinaleArtworkOwner {
  let selected=NativeSelectedUIKitFinaleArtworkOwner(root:NativeTestResources.root,generation:1,current:{true})
  selected.prepare(variant:"coconut")
  for _ in 0..<750 where !selected.readyFamilies.contains("coconut") {try await Task.sleep(for:.milliseconds(20))}
  XCTAssertTrue(selected.readyFamilies.contains("coconut"));return selected
 }
 func testIdentityAndPalette() {
  XCTAssertTrue(NativeSpecialDiceRegistry.usesBarrelFlow("coconut"))
  XCTAssertEqual(NativeJourneyContent.introductionID(board:16),"coconut")
  XCTAssertFalse(NativeJourneyContent.rewardPool(board:15).contains("coconut"))
  XCTAssertEqual(NativeDragTrailStyle.resolve(core:.tnt,variant:"coconut").colors,[0xFBC68E,0xD27B45,0xBB623A,0xA34C30])
  XCTAssertEqual(NativeWildMergeSixShardProfile.make(archetype:.tnt,variant:"coconut")?.colors,[0xFEEDD4,0xDF8E58])
 }
 func testBoxReflectionsFastLaunchSquashAndBottomExit() {
  var seed:UInt64=721
  let motion=NativeCoconutFinaleMotion(viewport:.init(width:390,height:844),random:{seed=seed &* 6364136223846793005 &+ 1;return Double(seed>>11)/Double(UInt64.max>>11)})
  XCTAssertEqual(motion.whole.count,16);XCTAssertEqual(motion.whole.filter(\.animated).count,5)
  XCTAssertFalse(motion.contacts.isEmpty)
  XCTAssertTrue(motion.whole.allSatisfy{$0.size>=48*0.8 && $0.size<=48*1.2})
  XCTAssertTrue(motion.whole.suffix(8).allSatisfy{$0.velocity.y<0})
  for (body,flight) in motion.whole.enumerated() {
   XCTAssertGreaterThanOrEqual(hypot(flight.velocity.x,flight.velocity.y),550-0.001)
   for sample in 0...100 {
    let time=flight.delay+flight.exitAge*Double(sample)/100
    let point=motion.position(flight,seconds:time),shape=motion.squash(body:body,seconds:time)
    XCTAssertGreaterThanOrEqual(point.x,flight.wallRadius-0.001);XCTAssertLessThanOrEqual(point.x,390-flight.wallRadius+0.001)
    XCTAssertGreaterThanOrEqual(shape.x,0.5);XCTAssertLessThanOrEqual(shape.x,1.5)
    if !motion.contacts.contains(where:{$0.body==body && time >= $0.time && time-$0.time<0.16}) {XCTAssertEqual(shape,CGPoint(x:1,y:1))}
   }
   XCTAssertEqual(motion.position(flight,seconds:flight.endTime).y-flight.displayRadius,844,accuracy:0.001)
  }
  for (index,flight) in motion.whole.enumerated() {XCTAssertGreaterThan(abs(motion.rotation(body:index,seconds:flight.endTime)),.pi*2)}
  for contact in motion.contacts {
   let hit=motion.squash(body:contact.body,seconds:contact.time+0.025)
   if !motion.contacts.contains(where:{$0.body==contact.body && $0.time>contact.time && $0.time<=contact.time+0.025}) {XCTAssertEqual(hit,contact.top ? CGPoint(x:1.5,y:0.5):CGPoint(x:0.5,y:1.5))}
   XCTAssertEqual(motion.rotation(body:contact.body,seconds:contact.time-0.000001),motion.rotation(body:contact.body,seconds:contact.time+0.000001),accuracy:0.001)
   let flight=motion.whole[contact.body],p=motion.position(flight,seconds:contact.time)
   if contact.top {XCTAssertEqual(p.y,flight.wallRadius,accuracy:0.001)}else{XCTAssertTrue(abs(p.x-flight.wallRadius)<0.001 || abs(p.x-(390-flight.wallRadius))<0.001)}
   let before=motion.position(flight,seconds:contact.time-0.0001),after=motion.position(flight,seconds:contact.time+0.0001)
   if contact.top {XCTAssertLessThan((p.y-before.y)*(after.y-p.y),0)}else{XCTAssertLessThan((p.x-before.x)*(after.x-p.x),0)}
  }
 }
 func testMountedOriginalSVGPopulationImpactsRewindAndWeakRelease()async throws {
  let selected=try await prepared();defer{selected.dispose()}
  weak var weakOwner:NativeTntVariantPresentation?
  autoreleasepool {
   var seed:UInt64=721
   let owner=NativeTntVariantPresentation(resourceRoot:NativeTestResources.root,variant:.coconut,viewport:.init(width:390,height:844),preparedArtwork:selected.artwork,random:{seed=seed &* 6364136223846793005 &+ 1;return Double(seed>>11)/Double(UInt64.max>>11)});weakOwner=owner
   let host=UIView(frame:owner.bounds);host.addSubview(owner);XCTAssertTrue(owner.assetsReady)
   let animated=owner.subviews.compactMap{$0 as? NativeCoconutSVGView},whole=owner.subviews.filter{$0.accessibilityIdentifier=="native-coconut-whole"},shards=owner.subviews.filter{$0.accessibilityIdentifier=="native-coconut-shard"}
   XCTAssertEqual(animated.count,5);XCTAssertEqual(whole.count,11);XCTAssertEqual(shards.count,0)
   var cues:[String]=[];owner.onCue={name,_ in cues.append(name)}
   owner.paint(seconds:0.9);let first=animated.map{$0.layer.contentsRect}
   owner.paint(seconds:1.0);XCTAssertNotEqual(first,animated.map{$0.layer.contentsRect});XCTAssertTrue(shards.allSatisfy{$0.alpha==0})
   owner.paint(seconds:1.2);XCTAssertTrue(shards.isEmpty)
   func render(_ name:String){let f=UIGraphicsImageRendererFormat();f.scale=2;let im=UIGraphicsImageRenderer(size:owner.bounds.size,format:f).image{owner.layer.render(in:$0.cgContext)};try? im.pngData()?.write(to:URL(fileURLWithPath:"/tmp/"+name+".png"))}
   render("coconut-wall-bounce")
   owner.paint(seconds:0.8);render("coconut-svg-launch")
   owner.paint(seconds:owner.duration);XCTAssertTrue(shards.allSatisfy{$0.alpha==0});XCTAssertTrue(animated.allSatisfy{$0.alpha==0});XCTAssertTrue(whole.allSatisfy{$0.alpha==0})
   XCTAssertGreaterThan(cues.filter{$0=="coconut-contact"}.count,0);XCTAssertEqual(cues.filter{$0=="coconut-loop"}.count,1)
   owner.dispose();owner.dispose();XCTAssertTrue(animated.allSatisfy{$0.layer.contents==nil})
  }
  XCTAssertNil(weakOwner)
 }
 func testPalmExitsOnlyLeftAndLocalBendingRetires()async throws {
  let selected=try await prepared();defer{selected.dispose()}
  let owner=NativeTntVariantPresentation(resourceRoot:NativeTestResources.root,variant:.coconut,viewport:.init(width:390,height:844),preparedArtwork:selected.artwork,random:{0.5});defer{owner.dispose()}
  let palms=owner.subviews.flatMap(\.subviews).filter{$0.accessibilityIdentifier?.hasPrefix("native-coconut-palm")==true}
  let parent=try XCTUnwrap(palms.first?.superview)
  owner.paint(seconds:0.18);XCTAssertEqual(atan2(parent.transform.b,parent.transform.a),.pi/4,accuracy:0.00001)
  let rear=owner.subviews.flatMap(\.subviews).filter{$0.accessibilityIdentifier?.hasPrefix("native-coconut-rear-palm")==true}
  XCTAssertEqual(rear.count,8)
  let rearUnit=try XCTUnwrap(rear.first?.superview)
  XCTAssertTrue(rearUnit.isHidden)
  owner.paint(seconds:0.38)
  XCTAssertEqual(atan2(rearUnit.transform.b,rearUnit.transform.a),-.pi/4,accuracy:0.00001)
  owner.paint(seconds:1.20)
  XCTAssertGreaterThan(palms[4].alpha,0);XCTAssertGreaterThan(palms[5].alpha,0)
  owner.paint(seconds:1.80);XCTAssertTrue(parent.isHidden);XCTAssertFalse(rearUnit.isHidden)
  owner.paint(seconds:1.98);XCTAssertTrue(rearUnit.isHidden)
  var previous=NativeCoconutFinaleMotion.palmAngle(seconds:1.16)
  for i in 1...60 {let t=1.16+Double(i)*0.01;let current=NativeCoconutFinaleMotion.palmAngle(seconds:t);XCTAssertLessThanOrEqual(current,previous);previous=current}
  owner.paint(seconds:0.54);let bands=palms[4].layer.sublayers ?? [];XCTAssertEqual(bands.count,64);let pose=bands.map{$0.affineTransform()}
  owner.paint(seconds:0.7);XCTAssertNotEqual(pose,bands.map{$0.affineTransform()})
  owner.dispose();XCTAssertTrue(palms[4].layer.sublayers?.isEmpty ?? true);XCTAssertTrue(rear.allSatisfy{$0.layer.sublayers?.isEmpty ?? true})
 }
 func testGreenGlowFadesWithPalmExitAndRewindsWithoutFadingWhiteFaces()async throws {
  let selected=try await prepared();defer{selected.dispose()}
  let owner=NativeTntVariantPresentation(resourceRoot:NativeTestResources.root,variant:.coconut,viewport:.init(width:390,height:844),preparedArtwork:selected.artwork,random:{0.5});defer{owner.dispose()}
  func labels(_ view:UIView)->[UILabel] {view.subviews.flatMap {($0 as? UILabel).map{[$0]} ?? []}+view.subviews.flatMap{labels($0)}}
  owner.paint(seconds:1.4)
  let all=labels(owner),glows=all.filter{$0.layer.shadowOpacity>0},faces=all.filter{!($0.superview is UILabel)}
  XCTAssertFalse(glows.isEmpty)
  owner.paint(seconds:1.4);let initial=glows.map{$0.layer.shadowOpacity}
  owner.paint(seconds:1.7);XCTAssertTrue(zip(glows,initial).allSatisfy{$0.0.layer.shadowOpacity>0 && $0.0.layer.shadowOpacity<$0.1})
  owner.paint(seconds:1.97);XCTAssertTrue(glows.allSatisfy{$0.layer.shadowOpacity==0});XCTAssertTrue(faces.contains{$0.alpha>0})
  owner.paint(seconds:1.4);XCTAssertEqual(glows.map{$0.layer.shadowOpacity},initial)
 }
 private final class AudioTransport:NativeGameplayAudioTransport {
  var cues:[NativeAudioCue]=[],stops=0,stopped:Set<String>=[]
  func play(_ cue:NativeAudioCue){cues.append(cue)}
  func stopAll(){stops+=1}
  func stopVoices(_ ids:Set<String>){stopped.formUnion(ids)}
  func dispose(){stopAll()}
 }
 func testBoundedLoopBothCoconutSoundsAndShardsFadeSettingsAndContacts()throws {
  let bounded=NativeAVGameplayAudioTransport(root:NativeTestResources.root,activateSession:{XCTFail("Invalid loop cannot activate audio");return false})
  var rejected:NativeAudioCompletion?
  bounded.play(NativeAudioCue(source:"assets/sound/Wild and special kockice/coconut/coconut1.wav",voice:"invalid-loop",gain:0.3,looping:true)){rejected=$0}
  XCTAssertEqual(rejected,.unavailable);XCTAssertEqual(bounded.scheduledVoiceCount,0);bounded.dispose()

  XCTAssertEqual(NativeAuthoredAudioCatalog.groups["coconut"]?.map(\.source),NativeAuthoredAudioCatalog.groups["flower"]?.map(\.source))
  let t=AudioTransport(),owner=NativeGameplayAudioOwner(root:NativeTestResources.root,enabled:true,transport:t);defer{owner.dispose()}
  owner.specialMoment(variant:"coconut",moment:"coconut-palm-shards",index:3000,receipt:1,generation:1)
  owner.specialMoment(variant:"coconut",moment:"coconut-loop",index:3000,receipt:2,generation:1)
  XCTAssertEqual(t.cues.first?.gain,0.51);XCTAssertEqual(t.cues.count,3);XCTAssertTrue(t.cues.allSatisfy{$0.looping && $0.stopAfter==3.25 && $0.fadeOut==0.25})
  XCTAssertEqual(Set(t.cues.map{$0.source.components(separatedBy:"/").last!}),Set(["coconut1.wav","coconut2.wav","coconut shards.wav"]))
  owner.specialMoment(variant:"coconut",moment:"coconut-contact",index:0,receipt:3,generation:1);XCTAssertEqual(t.cues.count,5)
  guard t.cues.count==5 else{return}
  XCTAssertTrue(t.cues[3].source.hasSuffix("mini2.mp3"));XCTAssertTrue(t.cues[4].source.hasSuffix("mini3.wav"))
  owner.specialMoment(variant:"coconut",moment:"coconut-stop",receipt:4,generation:1);XCTAssertEqual(t.stopped.count,3)
  owner.setEnabled(false);owner.specialMoment(variant:"coconut",moment:"coconut-loop",index:3000,receipt:5,generation:1);XCTAssertEqual(t.cues.count,5)
  owner.setEnabled(true);owner.setForeground(false);owner.specialMoment(variant:"coconut",moment:"coconut-loop",index:3000,receipt:6,generation:1);XCTAssertEqual(t.cues.count,5)
 }
 func testBoardCoconutArtworkIsThirtyPercentLarger()async throws {
  let textures=NativeBoardTextures(root:NativeTestResources.root),board=NativeBoardScene(engine:NativeGameplayEngine(state:.init(tiles:[])),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
  let die=NativeDiceNode(id:"coconut-size",value:6,kind:"wild-tnt",variant:"coconut",depth:1,locked:false,textures:textures);board.addChild(die);defer{die.dispose();textures.dispose();board.dispose()}
  var found:SKSpriteNode?
  for _ in 0..<600 {die.tick(1.0/60,suspended:false,viewportCenter:195);if let art=die.visual.children.compactMap({$0 as? SKSpriteNode}).last,!art.isHidden,art.texture != nil,abs(art.size.width-166.4)<0.01 {found=art;break};try await Task.sleep(for:.milliseconds(20))}
  XCTAssertEqual(try XCTUnwrap(found).size.width,166.4,accuracy:0.01)
  let phase=die.authoredArtworkReceipt.elapsed
  die.setDragging(true)
  for _ in 0..<120 {die.tick(1.0/60,suspended:false,viewportCenter:195)}
  XCTAssertEqual(die.authoredArtworkReceipt.frame,0)
  XCTAssertEqual(die.authoredArtworkReceipt.elapsed,phase)
  XCTAssertFalse(try XCTUnwrap(found).isHidden)
  die.setDragging(false);die.tick(0.1,suspended:false,viewportCenter:195)
  XCTAssertGreaterThan(die.authoredArtworkReceipt.elapsed,phase)
 }
}
