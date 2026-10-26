import XCTest
import CoreText
import QuartzCore
import Darwin
import CryptoKit
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six

@MainActor final class NativeCoconutTests:XCTestCase {
 func testLocoLeadingLAlwaysUsesLargeLetterTreatment() throws {
  let artwork=JimiV9Artwork(resourceRoot:NativeTestResources.root)
  for sample in [0.0,0.23,0.56,0.99] {
   let field=NativeSplashGlyphField.clankStyle(artwork:artwork,text:"COCO-LOCO",random:{sample})
   let labels=try XCTUnwrap(field.subviews.first).subviews.compactMap{$0 as? UILabel}
   XCTAssertEqual(labels.map{$0.text ?? ""}.joined(),"COCO-LOCO")
   XCTAssertGreaterThanOrEqual(labels[0].font.pointSize,75)
   XCTAssertGreaterThanOrEqual(labels[5].font.pointSize,75)
  }
 }

 func testEveryCoconutContactDrivesBoundedFiniteScreenShake() {
  let motion=NativeCoconutFinaleMotion(viewport:.init(width:390,height:844),random:{0.5})
  XCTAssertFalse(motion.contacts.isEmpty)
  for contact in motion.contacts {
   let poses=(1...17).map{motion.screenShakeOffset(seconds:contact.time+Double($0)*0.01)}
   XCTAssertTrue(poses.contains{$0 != .zero})
   XCTAssertTrue(poses.allSatisfy{abs($0.x)<=8 && abs($0.y)<=8})
  }
  XCTAssertEqual(motion.screenShakeOffset(seconds:-1),.zero)
  XCTAssertEqual(motion.screenShakeOffset(seconds:(motion.contacts.last?.time ?? 0)+0.181),.zero)
 }
 func testCoconutScreenShakeRestoresHostOnPauseAndDisposal() async throws {
  let selected=try await prepared();defer{selected.dispose()}
  let host=UIView(frame:CGRect(x:0,y:0,width:390,height:844));host.transform=CGAffineTransform(translationX:3,y:5)
  let base=host.transform
  let owner=NativeTntVariantPresentation(resourceRoot:NativeTestResources.root,variant:.coconut,viewport:host.bounds.size,preparedArtwork:selected.artwork,random:{0.5})
  defer{owner.dispose()};host.addSubview(owner);owner.bindScreenShake(to:host)
  let motion=NativeCoconutFinaleMotion(viewport:host.bounds.size,random:{0.5})
  let time=try XCTUnwrap(motion.contacts.first).time+0.015
  owner.paint(seconds:time);XCTAssertNotEqual(host.transform,base)
  owner.setSuspended(true);XCTAssertEqual(host.transform.tx,base.tx,accuracy:1e-10);XCTAssertEqual(host.transform.ty,base.ty,accuracy:1e-10)
  owner.setSuspended(false);owner.paint(seconds:time);XCTAssertNotEqual(host.transform,base)
  owner.dispose();XCTAssertEqual(host.transform.tx,base.tx,accuracy:1e-10);XCTAssertEqual(host.transform.ty,base.ty,accuracy:1e-10);owner.dispose()
 }
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
 func testAllCaptionFacesAreWhiteWhileOriginalPerLetterColorsMoveToGlow()throws {
  let art=JimiV9Artwork(resourceRoot:NativeTestResources.root)
  let palette:[UIColor]=[.red,.green,.blue,.orange]
  let field=NativeSplashGlyphField(artwork:art,text:"TEST",colors:palette,splitIndex:2,letterColors:palette,letterOpacityRange:1...1,random:{0.5})
  field.frame=CGRect(x:0,y:0,width:390,height:844);field.layoutIfNeeded();field.paint(seconds:0.9)
  let faces=try XCTUnwrap(field.subviews.first).subviews.compactMap{$0 as? UILabel}
  XCTAssertEqual(faces.count,4)
  for(index,face)in faces.enumerated(){
   XCTAssertEqual(face.textColor.withAlphaComponent(1),.white)
   let glows=face.subviews.compactMap{$0 as? UILabel};XCTAssertEqual(glows.count,4)
   XCTAssertTrue(glows.allSatisfy{$0.layer.shadowColor==palette[index].cgColor && $0.layer.shadowPath==nil})
  }
  field.paint(seconds:10);XCTAssertTrue(faces.allSatisfy{$0.alpha==0})
  field.paint(seconds:0.9);XCTAssertTrue(faces.contains{$0.alpha>0})
 }
 func testOriginalTwoColorSplitMovesIntoGlowWithoutSplitWhiteFaces()throws {
  let art=JimiV9Artwork(resourceRoot:NativeTestResources.root)
  let field=NativeSplashGlyphField(artwork:art,text:"TEST",colors:[.red,.blue],splitIndex:1.5,random:{0.5})
  field.frame=CGRect(x:0,y:0,width:390,height:844);field.layoutIfNeeded()
  let faces=try XCTUnwrap(field.subviews.first).subviews.compactMap{$0 as? UILabel}
  XCTAssertEqual(faces.map{$0.subviews.count},[4,4,4,4])
  let splitColors=faces[1].subviews.compactMap{($0 as? UILabel)?.layer.shadowColor}
  XCTAssertEqual(splitColors.filter{$0==UIColor.red.cgColor}.count,2);XCTAssertEqual(splitColors.filter{$0==UIColor.blue.cgColor}.count,2)
  XCTAssertTrue(faces[0].subviews.allSatisfy{$0.layer.shadowColor==UIColor.red.cgColor})
  XCTAssertTrue(faces[3].subviews.allSatisfy{$0.layer.shadowColor==UIColor.blue.cgColor})
 }
 func testBlossomUsesWhiteLettersAndFlyingFlowerPinkYellowGlow()async throws {
  let selected=try await prepared();defer{selected.dispose()}
  let owner=NativeTntVariantPresentation(resourceRoot:NativeTestResources.root,variant:.flower,viewport:.init(width:390,height:844),preparedArtwork:selected.artwork,random:{0.5});defer{owner.dispose()}
  XCTAssertTrue(owner.assetsReady)
  func labels(_ view:UIView)->[UILabel] {view.subviews.compactMap{$0 as? UILabel}+view.subviews.flatMap{labels($0)}}
  owner.paint(seconds:1.4)
  let all=labels(owner),faces=all.filter{!($0.superview is UILabel)},glows=all.filter{$0.layer.shadowOpacity>0}
  XCTAssertEqual(faces.compactMap(\.text).joined(),"BLOSSOM")
  XCTAssertTrue(faces.allSatisfy{$0.textColor.withAlphaComponent(1) == .white})
  XCTAssertEqual(glows.count,28)
  for glow in glows {
   var r:CGFloat=0,g:CGFloat=0,b:CGFloat=0,a:CGFloat=0
   XCTAssertTrue(UIColor(cgColor:glow.layer.shadowColor!).getRed(&r,green:&g,blue:&b,alpha:&a))
   XCTAssertTrue((253.0/255...1).contains(r));XCTAssertTrue((156.0/255...233.0/255).contains(g));XCTAssertTrue((171.0/255...177.0/255).contains(b))
  }
  let image=UIGraphicsImageRenderer(size:owner.bounds.size).image{owner.layer.render(in:$0.cgContext)}
  try image.pngData()?.write(to:FileManager.default.temporaryDirectory.appendingPathComponent("blossom-pink-yellow-treatment.png"))
  owner.paint(seconds:1.97);XCTAssertTrue(glows.allSatisfy{$0.layer.shadowOpacity==0});XCTAssertTrue(faces.contains{$0.alpha>0})
  owner.paint(seconds:1.4);XCTAssertTrue(glows.allSatisfy{$0.layer.shadowOpacity>0})
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
  XCTAssertEqual(try XCTUnwrap(found).position.y,10,accuracy:0.001)
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

// Opt-in comparison only: no production renderer or player preference changes.
@MainActor private final class GlyphDisplayBenchmark: NSObject {
 var field:NativeSplashGlyphField!
 var glowOpacity:CGFloat=1
 var optimize:((NativeSplashGlyphField)->Void)?
 var completion:(()->Void)?
 var link:CADisplayLink?,tick=0,last:CFTimeInterval=0
 var gaps:[Double]=[],paintMilliseconds:[Double]=[]
 func start(){let l=CADisplayLink(target:self,selector:#selector(frame(_:)));l.preferredFrameRateRange=CAFrameRateRange(minimum:60,maximum:60,preferred:60);link=l;l.add(to:.main,forMode:.common)}
 @objc private func frame(_ l:CADisplayLink){
  tick+=1
  if tick>20,last>0 {gaps.append((l.timestamp-last)*1000)}
  last=l.timestamp
  let start=CACurrentMediaTime()
  field.paint(seconds:0.3+Double(tick%66)/60,glowOpacity:glowOpacity);optimize?(field)
  if tick>20{paintMilliseconds.append((CACurrentMediaTime()-start)*1000)}
  if tick==140 {link?.invalidate();link=nil;let done=completion;completion=nil;done?()}
 }
}

extension NativeCoconutTests {
 func testOptInGlyphGlowComparison()async throws {
  let art=JimiV9Artwork(resourceRoot:NativeTestResources.root)
  let viewport=CGSize(width:390,height:844)
  let colors=[UIColor(red:101.0/255,green:119.0/255,blue:30.0/255,alpha:1),UIColor(red:130.0/255,green:148.0/255,blue:36.0/255,alpha:1)]
  func labels(_ view:UIView)->[UILabel]{view.subviews.compactMap{$0 as? UILabel}+view.subviews.flatMap{labels($0)}}
  func make(_ mode:String)->NativeSplashGlyphField {
   let f=NativeSplashGlyphField(artwork:art,text:"BLOOMING!",colors:[.white],splitIndex:0,letterOpacityRange:0.8...1,fitToWidth:true,neonGlow:mode != "none",glowPalette:colors,whiteGlowTreatment:false,random:{0.5})
   f.frame=CGRect(origin:.zero,size:viewport);f.layoutIfNeeded();return f
  }
  // Exact font outlines give Core Animation a retained shape instead of asking
  // it to derive the shadow from each label's composited alpha channel.
  func preparePaths(_ f:NativeSplashGlyphField){
   for label in labels(f) where label.layer.shadowOpacity>0 {
    let font=CTFontCreateWithName(label.font.fontName as CFString,label.font.pointSize,nil)
    let chars=Array((label.text ?? "").utf16);var glyphs=[CGGlyph](repeating:0,count:chars.count)
    guard !chars.isEmpty,CTFontGetGlyphsForCharacters(font,chars,&glyphs,chars.count) else{continue}
    let line=CTLineCreateWithAttributedString(NSAttributedString(string:label.text ?? "",attributes:[.font:label.font as Any]))
    let width=CTLineGetTypographicBounds(line,nil,nil,nil)
    let rect=label.textRect(forBounds:label.bounds,limitedToNumberOfLines:1)
    var transform=CGAffineTransform(translationX:(label.bounds.width-width)/2,y:rect.minY+label.font.ascender).scaledBy(x:1,y:-1)
    if let path=CTFontCreatePathForGlyph(font,glyphs[0],&transform){label.layer.shadowPath=path}
   }
  }
  func sample(_ values:[Double])->[String:Double]{let a=values.sorted();return ["mean":a.reduce(0,+)/Double(max(1,a.count)),"p95":a[min(a.count-1,Int(Double(a.count)*0.95))],"max":a.last ?? 0]}
  func resident()->UInt64 {
   var info=mach_task_basic_info();var count=mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size/MemoryLayout<natural_t>.size)
   let result=withUnsafeMutablePointer(to:&info){$0.withMemoryRebound(to:integer_t.self,capacity:Int(count)){task_info(mach_task_self_,task_flavor_t(MACH_TASK_BASIC_INFO),$0,&count)}}
   return result==KERN_SUCCESS ? info.resident_size:0
  }
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first{$0.isKeyWindow}
  let window=UIWindow(frame:CGRect(origin:.zero,size:viewport)),vc=UIViewController();vc.view.backgroundColor=UIColor(red:0.97,green:0.94,blue:0.89,alpha:1);window.rootViewController=vc;window.makeKeyAndVisible()
  defer{window.isHidden=true;previous?.makeKeyAndVisible()}
  var result:[String:Any]=["environment":"Native iOS Simulator; UIKit isolated caption; not physical GPU timing","text":"BLOOMING!","pointViewport":[390,844],"targetHz":60]
  var metrics:[String:[[String:Any]]]=[:]
  let format=UIGraphicsImageRendererFormat();format.scale=3;format.opaque=false
  let renderer=UIGraphicsImageRenderer(size:viewport,format:format)
  var images:[String:UIImage]=[:]
  // Constant0.5 RNG gives every glyph0.9 fill alpha. Explicit paths require
  // that same alpha on the shadow; pass it in the existing disabled-action
  // paint transaction, never as a second implicit-animation write.
  // Rotate order to reduce first-run/font-cache/thermal ordering bias.
  for order in [["none","current","paths"],["paths","none","current"],["current","paths","none"]] {
   for mode in order {
    let f=make(mode);vc.view.addSubview(f);if mode=="paths"{preparePaths(f)}
    f.paint(seconds:0.9,glowOpacity:mode=="paths" ? 0.9:1)
    if images[mode]==nil {images[mode]=renderer.image{f.layer.render(in:$0.cgContext)}}
    let driver=GlyphDisplayBenchmark();driver.field=f;driver.glowOpacity=mode=="paths" ? 0.9:1
    await withCheckedContinuation{(c:CheckedContinuation<Void,Never>) in driver.completion={c.resume()};driver.start()}
    var raster:[Double]=[]
    for _ in 0..<1 {
     f.paint(seconds:1.1,glowOpacity:mode=="paths" ? 0.9:1)
     let start=CACurrentMediaTime();autoreleasepool{_ = renderer.image{f.layer.render(in:$0.cgContext)}};raster.append((CACurrentMediaTime()-start)*1000)
    }
    metrics[mode,default:[]].append(["paintMs":sample(driver.paintMilliseconds),"displayCallbackGapMs":sample(driver.gaps),"gapsOver25ms":driver.gaps.filter{$0>25}.count,"cpuLayerRenderMs":sample(raster),"labels":labels(f).count,"dynamicShadows":labels(f).filter{$0.layer.shadowOpacity>0 && $0.layer.shadowPath==nil}.count])
    print("[GlyphGlowBenchmark] sample \(mode) paint=\(sample(driver.paintMilliseconds)) softwareRender=\(sample(raster))")
    f.removeFromSuperview();driver.field=nil;driver.optimize=nil
   }
  }
  var memory:[String:Any]=[:]
  for mode in ["none","current","paths"] {
   var alive=0,checkpoints:[UInt64]=[]
   for i in 0..<60 {
    weak var weakField:NativeSplashGlyphField?
    autoreleasepool {
     let f=make(mode);weakField=f;vc.view.addSubview(f);if mode=="paths"{preparePaths(f)}
     f.paint(seconds:0.9,glowOpacity:mode=="paths" ? 0.9:1)
     f.layer.displayIfNeeded();CATransaction.flush()
     f.paint(seconds:4);f.removeFromSuperview()
    }
    CATransaction.flush();try await Task.sleep(for:.milliseconds(10))
    if weakField != nil{alive+=1}
    if i%10==9{checkpoints.append(resident())}
   }
   XCTAssertEqual(alive,0,"Caption must release every iteration")
   memory[mode]=["residentBytesEvery10Cycles":checkpoints,"retainedCaptionsAfter60":alive]
   print("[GlyphGlowBenchmark] memory \(mode) retained=\(alive) bytes=\(checkpoints)")
  }
  func rgba(_ image:UIImage)->[UInt8]{var bytes=[UInt8](repeating:0,count:1170*2532*4);bytes.withUnsafeMutableBytes{b in let ctx=CGContext(data:b.baseAddress,width:1170,height:2532,bitsPerComponent:8,bytesPerRow:1170*4,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue)!;ctx.draw(image.cgImage!,in:CGRect(x:0,y:0,width:1170,height:2532))};return bytes}
  let a=rgba(images["current"]!),b=rgba(images["paths"]!);var squared=0.0,changed=0
  for i in a.indices {let d=Double(a[i])-Double(b[i]);squared+=d*d;if abs(d)>8{changed+=1}}
  result["metrics"]=metrics;result["memory"]=memory;result["pathVisualDifference"]=["rgbaRms255":sqrt(squared/Double(a.count)),"channelsDifferingOver8Percent":Double(changed)*100/Double(a.count)]
  let dir=FileManager.default.temporaryDirectory
  for(mode,image)in images{try image.pngData()?.write(to:dir.appendingPathComponent("glyph-glow-\(mode).png"))}
  let data=try JSONSerialization.data(withJSONObject:result,options:[.prettyPrinted,.sortedKeys]);try data.write(to:dir.appendingPathComponent("glyph-glow-benchmark.json"))
  print("[GlyphGlowBenchmark] \(String(decoding:data,as:UTF8.self))")
 }
}
