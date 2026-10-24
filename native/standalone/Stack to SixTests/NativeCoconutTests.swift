import XCTest
import CryptoKit
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
 func testUpdatedOriginalSVGAtlasPreservesAll128VisibleSamplesAndLoop()throws {
  let url=NativeTestResources.root.appendingPathComponent(NativeCoconutArt.path)
  let hash=SHA256.hash(data:try Data(contentsOf:url)).map{String(format:"%02x",$0)}.joined()
  XCTAssertEqual(hash,"1e5fd12e86d97a3f895592ca544fef508ab3129a1f444de222037c4d30ecd937","Regenerate the sampled Native plan if the selected original changes")
  let atlas=try XCTUnwrap(NativeCoconutArt.decode(url))
  XCTAssertEqual(atlas.width,1536);XCTAssertEqual(atlas.height,3072)
  XCTAssertEqual(NativeCoconutAtlasPlan.frames.count,128)
  XCTAssertEqual(NativeDiceSheet.coconut.cycle,2.133333,accuracy:0.000001)
  let bytes=try XCTUnwrap(atlas.dataProvider?.data);let data=try XCTUnwrap(CFDataGetBytePtr(bytes))
  var nonempty=0
  for frame in 0..<128 {
   var visible=false
   for y in 0..<192 {
    for x in 0..<192 {
     let index=(frame/8*192+y)*atlas.bytesPerRow+(frame%8*192+x)*4+3
     if data[index]>16 {visible=true;break}
    }
    if visible{break}
   }
   if visible{nonempty+=1}
  }
  XCTAssertEqual(nonempty,128)
  XCTAssertTrue(NativeCoconutAtlasPlan.frames.contains{$0.count==2},"Preserve authored upper/lower split layers")
  let f=UIGraphicsImageRendererFormat();f.scale=2
  let image=UIGraphicsImageRenderer(size:.init(width:640,height:320),format:f).image{_ in
   for (i,frame) in [0,24,48,64,80,96,112,127].enumerated() {
    if let crop=atlas.cropping(to:CGRect(x:frame%8*192,y:frame/8*192,width:192,height:192)) {
     UIImage(cgImage:crop).draw(in:CGRect(x:i%4*160,y:i/4*160,width:160,height:160))
    }
   }
  }
  try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/coconut-updated-svg-samples.png"))
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
  XCTAssertEqual(motion.whole.count,16);XCTAssertEqual(motion.whole.filter(\.extendedExitPadding).count,5)
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
 func testMountedAllSixteenPNGPopulationImpactsRewindAndWeakRelease()async throws {
  let selected=try await prepared();defer{selected.dispose()}
  weak var weakOwner:NativeTntVariantPresentation?
  autoreleasepool {
   var seed:UInt64=721
   let owner=NativeTntVariantPresentation(resourceRoot:NativeTestResources.root,variant:.coconut,viewport:.init(width:390,height:844),preparedArtwork:selected.artwork,random:{seed=seed &* 6364136223846793005 &+ 1;return Double(seed>>11)/Double(UInt64.max>>11)});weakOwner=owner
   let host=UIView(frame:owner.bounds);host.addSubview(owner);XCTAssertTrue(owner.assetsReady)
   let animated=owner.subviews.filter{$0.accessibilityIdentifier=="native-coconut-animated"},whole=owner.subviews.filter{$0.accessibilityIdentifier=="native-coconut-whole"},shards=owner.subviews.filter{$0.accessibilityIdentifier=="native-coconut-shard"}
   XCTAssertEqual(animated.count,0);XCTAssertEqual(whole.count,16);XCTAssertEqual(shards.count,0)
   var cues:[String]=[];owner.onCue={name,_ in cues.append(name)}
   let original=selected.artwork.image("assets/shop/coconut/coconut.png",densityAware:true)
   XCTAssertTrue(whole.allSatisfy{($0 as? UIImageView)?.image === original})
   XCTAssertFalse(NativeTntVariantPresentation.assets(.coconut).contains(NativeCoconutArt.path))
   owner.paint(seconds:0.9);let first=whole.map{$0.transform}
   owner.paint(seconds:1.0);XCTAssertNotEqual(first,whole.map{$0.transform});XCTAssertTrue(shards.allSatisfy{$0.alpha==0})
   owner.paint(seconds:1.2);XCTAssertTrue(shards.isEmpty)
   func render(_ name:String){let f=UIGraphicsImageRendererFormat();f.scale=2;let im=UIGraphicsImageRenderer(size:owner.bounds.size,format:f).image{owner.layer.render(in:$0.cgContext)};try? im.pngData()?.write(to:URL(fileURLWithPath:"/tmp/"+name+".png"))}
   render("coconut-wall-bounce")
   owner.paint(seconds:0.8);render("coconut-png-launch")
   owner.paint(seconds:owner.duration);XCTAssertTrue(shards.allSatisfy{$0.alpha==0});XCTAssertTrue(animated.allSatisfy{$0.alpha==0});XCTAssertTrue(whole.allSatisfy{$0.alpha==0})
   XCTAssertGreaterThan(cues.filter{$0=="coconut-contact"}.count,0);XCTAssertEqual(cues.filter{$0=="coconut-loop"}.count,1)
   owner.dispose();owner.dispose();XCTAssertTrue(whole.allSatisfy{($0 as? UIImageView)?.image==nil})
  }
  XCTAssertNil(weakOwner)
 }
 func testPalmExitsOnlyLeftAndLocalBendingRetires()async throws {
  let selected=try await prepared();defer{selected.dispose()}
  let owner=NativeTntVariantPresentation(resourceRoot:NativeTestResources.root,variant:.coconut,viewport:.init(width:390,height:844),preparedArtwork:selected.artwork,random:{0.5});defer{owner.dispose()}
  var palmLoopMilliseconds:Int?,sequenceCompleted=false
  owner.onCue={name,index in if name=="coconut-palm-shards" {palmLoopMilliseconds=index}}
  owner.onVisualSequenceComplete={sequenceCompleted=true}
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
  XCTAssertEqual(palms[4].alpha,1);XCTAssertEqual(palms[5].alpha,0)
  let held=parent.transform
  owner.paint(seconds:1.80);XCTAssertFalse(parent.isHidden);XCTAssertFalse(rearUnit.isHidden)
  XCTAssertEqual(palms[4].alpha,1);XCTAssertNotEqual(parent.transform,held)
  XCTAssertEqual(palmLoopMilliseconds,2900);XCTAssertFalse(sequenceCompleted)
  let image=UIGraphicsImageRenderer(size:owner.bounds.size).image{owner.layer.render(in:$0.cgContext)}
  try image.pngData()?.write(to:URL(fileURLWithPath:"/tmp/coconut-long-hold.png"))
  owner.paint(seconds:2.20)
  XCTAssertGreaterThan(palms[4].alpha,0);XCTAssertGreaterThan(palms[5].alpha,0)
  owner.paint(seconds:2.80);XCTAssertTrue(parent.isHidden);XCTAssertFalse(rearUnit.isHidden)
  XCTAssertTrue(sequenceCompleted)
  owner.paint(seconds:2.98);XCTAssertTrue(rearUnit.isHidden)
  var previous=NativeCoconutFinaleMotion.palmAngle(seconds:2.16)
  for i in 1...60 {let t=2.16+Double(i)*0.01;let current=NativeCoconutFinaleMotion.palmAngle(seconds:t);XCTAssertLessThanOrEqual(current,previous);previous=current}
  owner.paint(seconds:0.54);let bands=palms[4].layer.sublayers ?? [];XCTAssertEqual(bands.count,64);let pose=bands.map{$0.affineTransform()}
  owner.paint(seconds:0.7);XCTAssertNotEqual(pose,bands.map{$0.affineTransform()})
  owner.dispose();XCTAssertTrue(palms[4].layer.sublayers?.isEmpty ?? true);XCTAssertTrue(rear.allSatisfy{$0.layer.sublayers?.isEmpty ?? true})
 }
 func testOnlyVisiblePalmBandsJoinCommitTreeAndRewindReusesOriginalLayers()async throws {
  let selected=try await prepared();defer{selected.dispose()}
  let owner=NativeTntVariantPresentation(resourceRoot:NativeTestResources.root,variant:.coconut,viewport:.init(width:390,height:844),preparedArtwork:selected.artwork,random:{0.5})
  let host=UIView(frame:owner.bounds);host.addSubview(owner);defer{owner.dispose()}
  let palms=owner.subviews.flatMap(\.subviews).compactMap{$0 as? NativeCoconutPalmView}
  XCTAssertEqual(palms.count,16)
  XCTAssertTrue(palms.allSatisfy{($0.layer.sublayers ?? []).isEmpty},"Hidden prepared poses must not mount 1024 layers at construction")
  var maximum=0
  for sample in 0...310 {
   owner.paint(seconds:Double(sample)/100)
   var attached=0
   for palm in palms {
    let count=palm.layer.sublayers?.count ?? 0
    let visible=palm.alpha>0 && palm.superview?.isHidden==false
    XCTAssertEqual(count,visible ? 64:0)
    attached+=count
   }
   maximum=max(maximum,attached)
   XCTAssertLessThanOrEqual(attached,256,"At most two crossfading poses per palm unit")
  }
  XCTAssertEqual(maximum,256)
  owner.paint(seconds:0.54)
  let palm=try XCTUnwrap(palms.first{$0.accessibilityIdentifier=="native-coconut-palm5"})
  let bands=try XCTUnwrap(palm.layer.sublayers);XCTAssertEqual(bands.count,64)
  let transforms=bands.map{$0.affineTransform()}
  for (i,band) in bands.enumerated() {
   let row=Double(i)/63,phase=0.54 * .pi*2/0.58+row*3.2
   XCTAssertEqual(band.affineTransform().tx,sin(phase)*6*sin(.pi*row),accuracy:1e-9)
   XCTAssertNotNil(band.contents)
  }
  owner.paint(seconds:3);XCTAssertTrue(palms.allSatisfy{($0.layer.sublayers ?? []).isEmpty})
  owner.paint(seconds:0.54)
  XCTAssertEqual(palm.layer.sublayers?.map{ObjectIdentifier($0)},bands.map{ObjectIdentifier($0)})
  XCTAssertEqual(palm.layer.sublayers?.map{$0.affineTransform()},transforms)
  owner.dispose();owner.dispose()
  XCTAssertTrue(bands.allSatisfy{$0.superlayer==nil && $0.contents==nil})
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
 func testBufferedContactsOverlapReuseStopAndRetireActualAudioGraph()async throws {
  let audio=NativeCoconutContactAudio(root:NativeTestResources.root)
  defer{audio.dispose()}
  audio.prepare()
  let initial=await audio.snapshot()
  XCTAssertEqual(initial.nodes,32);XCTAssertEqual(initial.decodedBuffers,1);XCTAssertFalse(initial.running)
  let completed=expectation(description:"all original contact tails finish");completed.expectedFulfillmentCount=12
  for i in 0..<12 {
   audio.play(.init(source:NativeCoconutContactAudio.source,voice:"coconut-contact-\(i)-mini2",gain:0.15)){result in XCTAssertEqual(result,.ended);completed.fulfill()}
  }
  let playing=await audio.snapshot();XCTAssertEqual(playing.active,12);XCTAssertTrue(playing.running)
  await fulfillment(of:[completed],timeout:8)
  let ended=await audio.snapshot();XCTAssertEqual(ended.active,0);XCTAssertFalse(ended.running);XCTAssertEqual(ended.nodes,32);XCTAssertEqual(ended.decodedBuffers,1)
  var stopped=0
  for i in 0..<4 {audio.play(.init(source:NativeCoconutContactAudio.source,voice:"coconut-contact-stop-\(i)",gain:0.15)){result in XCTAssertEqual(result,.stopped);stopped+=1}}
  audio.stopAll();XCTAssertEqual(stopped,4);XCTAssertEqual(audio.count,0)
  let cancelled=await audio.snapshot();XCTAssertEqual(cancelled.active,0);XCTAssertFalse(cancelled.running)
  audio.prepare();audio.dispose()
  let retired=await audio.snapshot();XCTAssertEqual(retired.nodes,0);XCTAssertEqual(retired.decodedBuffers,0);XCTAssertFalse(retired.running)
 }
 func testActualTransportRoutesCoconutContactsAndCancelsOnLifecycleGates()async throws {
  let preparation=NativeSelectedAudioPreparation<NativeSelectedAudioFile>(load:{_,done in XCTFail("Coconut contacts must bypass AVAudioPlayer preparation");done(nil)})
  let transport=NativeAVGameplayAudioTransport(root:NativeTestResources.root,preparation:preparation)
  defer{transport.dispose()}
  var outcomes:[NativeAudioCompletion]=[]
  let cue=NativeAudioCue(source:NativeCoconutContactAudio.source,voice:"coconut-contact-gates-mini2",gain:0.15)
  transport.play(cue){outcomes.append($0)};XCTAssertEqual(transport.scheduledVoiceCount,1)
  transport.setSelectedPreparationForeground(false)
  XCTAssertEqual(outcomes,[.stopped]);XCTAssertEqual(transport.scheduledVoiceCount,0)
  transport.play(cue){outcomes.append($0)};XCTAssertEqual(outcomes.last,.unavailable)
  transport.setSelectedPreparationForeground(true);transport.setSelectedPreparationEnabled(false)
  transport.play(cue){outcomes.append($0)};XCTAssertEqual(transport.scheduledVoiceCount,0);XCTAssertEqual(outcomes.last,.unavailable)
  transport.setSelectedPreparationEnabled(true)
  let completed=expectation(description:"buffered transport finishes original cue")
  transport.play(cue){result in XCTAssertEqual(result,.ended);completed.fulfill()}
  await fulfillment(of:[completed],timeout:8);XCTAssertEqual(transport.scheduledVoiceCount,0)
 }
 func testBufferedContactOwnerReleasesAfterPendingPreparationAndDispose()async {
  var audio:NativeCoconutContactAudio?=NativeCoconutContactAudio(root:NativeTestResources.root)
  weak var weakAudio=audio
  audio?.prepare();audio?.dispose()
  let retired=await audio?.snapshot();XCTAssertEqual(retired?.nodes,0)
  audio=nil;XCTAssertNil(weakAudio)
 }
 func testContactBackendMainThreadGapProbe()async throws {
  func measure(buffered:Bool)async throws->Double {
   let transport=NativeAVGameplayAudioTransport(root:NativeTestResources.root)
   defer{transport.dispose()}
   if buffered{transport.prepareCoconutContacts()}
   else{_ = transport.prepareSelectedSources([NativeCoconutContactAudio.source],capture:"contact-gap-probe",generation:1)}
   try await Task.sleep(for:.milliseconds(250))
   let sampling=Task{@MainActor ()throws->Double in
    var previous=ProcessInfo.processInfo.systemUptime,worst=0.0
    for _ in 0..<160 {try await Task.sleep(for:.milliseconds(10));let now=ProcessInfo.processInfo.systemUptime;worst=max(worst,(now-previous)*1000);previous=now}
    return worst
   }
   for i in 0..<12 {
    transport.play(.init(source:NativeCoconutContactAudio.source,voice:buffered ? "coconut-contact-probe-\(i)-mini2":"control-contact-probe-\(i)",gain:0.15))
    try await Task.sleep(for:.milliseconds(20))
   }
   return try await sampling.value
  }
  let legacy=try await measure(buffered:false),buffered=try await measure(buffered:true)
  print("[COCONUT_CONTACT_GAP_PROBE] legacyWorstMs=\(legacy) bufferedWorstMs=\(buffered) targetProbeSleepMs=10 simulatorOnly=true")
 }
 func testBufferedContactRoutingIsStrictlyCoconutAndRejectsAlteredRecipes() {
  let cue=NativeAudioCue(source:NativeCoconutContactAudio.source,voice:"coconut-contact-1-mini2",gain:0.15)
  XCTAssertTrue(NativeCoconutContactAudio.accepts(cue))
  XCTAssertFalse(NativeCoconutContactAudio.accepts(.init(source:cue.source,voice:"flower-impact",gain:0.15)))
  XCTAssertFalse(NativeCoconutContactAudio.accepts(.init(source:cue.source,voice:cue.voice,gain:0.15,rate:1.3)))
  XCTAssertFalse(NativeCoconutContactAudio.accepts(.init(source:cue.source,voice:cue.voice,gain:0.15,looping:true)))
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
  owner.specialMoment(variant:"coconut",moment:"coconut-contact",index:0,receipt:3,generation:1);XCTAssertEqual(t.cues.count,4)
  guard t.cues.count==4 else{return}
  XCTAssertTrue(t.cues[3].source.hasSuffix("mini2.mp3"));XCTAssertEqual(t.cues[3].gain,0.15);XCTAssertFalse(t.cues.contains{$0.source.hasSuffix("mini3.wav")})
  owner.specialMoment(variant:"coconut",moment:"coconut-stop",receipt:4,generation:1);XCTAssertEqual(t.stopped.count,3)
  owner.setEnabled(false);owner.specialMoment(variant:"coconut",moment:"coconut-loop",index:3000,receipt:5,generation:1);XCTAssertEqual(t.cues.count,4)
  owner.setEnabled(true);owner.setForeground(false);owner.specialMoment(variant:"coconut",moment:"coconut-loop",index:3000,receipt:6,generation:1);XCTAssertEqual(t.cues.count,4)
 }
 func testBoardCoconutArtworkAddsTwentyPercentToExistingBoardScale()async throws {
  let textures=NativeBoardTextures(root:NativeTestResources.root),board=NativeBoardScene(engine:NativeGameplayEngine(state:.init(tiles:[])),resourceRoot:NativeTestResources.root,size:.init(width:390,height:844))
  let die=NativeDiceNode(id:"coconut-size",value:6,kind:"wild-tnt",variant:"coconut",depth:1,locked:false,textures:textures);board.addChild(die);defer{die.dispose();textures.dispose();board.dispose()}
  var found:SKSpriteNode?
  for _ in 0..<600 {die.tick(1.0/60,suspended:false,viewportCenter:195);if let art=die.visual.children.compactMap({$0 as? SKSpriteNode}).last,!art.isHidden,art.texture != nil,abs(art.size.width-199.68)<0.01 {found=art;break};try await Task.sleep(for:.milliseconds(20))}
  XCTAssertEqual(try XCTUnwrap(found).size.width,199.68,accuracy:0.01)
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
