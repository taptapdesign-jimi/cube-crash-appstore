import XCTest
import UIKit
import SpriteKit
import StackToSixGameplay
import StackToSixNativeState
@testable import Stack_to_Six
@MainActor final class NativeSourceRegularResumeBootstrapTests:XCTestCase {
 private func run()->NativeBoardState {.init(tiles:[.init(id:"saved-five",cell:.init(column:4,row:8),value:5,stackDepth:4),.init(id:"saved-zero",cell:.init(column:0,row:0),value:0,locked:true,alpha:0.7),.init(id:"saved-two",cell:.init(column:2,row:3),value:2,stackDepth:3)],mode:.arcade,board:1,stage:1,generation:9,revision:4,moves:23,score:123,wildMeter:0.4,rngState:777)}
 func testGenuineSavedArcadeRouteUsesCapturedResumeFactoryAndRetainsRunAccounting()async throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-resume-bootstrap-\(UUID().uuidString)")
  defer{try? FileManager.default.removeItem(at:directory)}
  let store=NativeSaveStore(directory:directory)
  var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false));envelope.progression.firstPlayTutorialComplete=true;envelope.arcadeRun=run();try store.save(envelope)
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  var draws=0
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{draws+=1;return Double((draws*37)%97)/97})
  let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context);bootstrap.sourceInitialRegularResumeEnabled=true
  let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
  defer{bootstrap.dispose();context.dispose();service.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
  let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
  try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
  let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene),construction=try XCTUnwrap(game.sourceInitialConstruction)
  XCTAssertTrue(scene.sourceInitialStartupReady);XCTAssertTrue(game.sourceScope?.service === service)
  XCTAssertFalse(game.sourceSmallStackPresentationEnabled);XCTAssertEqual(construction.nodes.count,3)
  XCTAssertEqual(game.engine.state.tiles.map(\.id),["saved-zero","saved-two","saved-five"])
  XCTAssertEqual(game.engine.state.generation,10);XCTAssertEqual(game.engine.state.revision,5)
  XCTAssertEqual(game.engine.state.score,123);XCTAssertEqual(game.engine.state.moves,23);XCTAssertEqual(game.engine.state.wildMeter,0.4)
  XCTAssertEqual(game.engine.state.rngState,777);XCTAssertTrue(game.engine.state.tiles.allSatisfy{$0.stackDepth==1})
  for holder in construction.recipe?.holders ?? [] {XCTAssertTrue(scene.sourceNativeTileNode(holder.tileID) === construction.nodes[holder.tileID])}
  service.deliver(wallMilliseconds:16)
  XCTAssertEqual(construction.pendingFaceCount,0);XCTAssertEqual(draws,5)
  let durable=try XCTUnwrap(store.load()?.arcadeRun);XCTAssertEqual(durable.tiles,game.engine.state.tiles)
  XCTAssertEqual(durable.score,123);XCTAssertEqual(durable.moves,23)
 }
 func testDefaultResumeStillRetainsExistingRawPhysicalDepthAndDoesNotConstructSourceObjects()async throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-resume-default-\(UUID().uuidString)")
  defer{try? FileManager.default.removeItem(at:directory)}
  let store=NativeSaveStore(directory:directory);var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false));envelope.progression.firstPlayTutorialComplete=true;envelope.arcadeRun=run();try store.save(envelope)
  let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false)
  let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844)),previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
  defer{bootstrap.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
  let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
  try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
  let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
  XCTAssertNil(game.sourceInitialConstruction);XCTAssertFalse(game.sourceSmallStackPresentationEnabled)
  XCTAssertEqual(game.engine.state.tiles.first{$0.id=="saved-five"}?.stackDepth,4)
  XCTAssertEqual(game.engine.state.tiles.first{$0.id=="saved-zero"}?.alpha,0.7)
 }
 func testActualSavedBeeAppRouteBindsTypedIdleAndForegroundKeepsSingleRegistration()async throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-bee-app-\(UUID().uuidString)")
  defer{try? FileManager.default.removeItem(at:directory)}
  let store=NativeSaveStore(directory:directory)
  var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
  envelope.progression.firstPlayTutorialComplete=true
  envelope.arcadeRun = .init(tiles:[.init(id:"saved-bee",cell:.init(column:0,row:0),value:6,archetype:.star,variant:"bee"),.init(id:"other",cell:.init(column:4,row:8),value:2)],mode:.arcade,board:1,stage:1,generation:9,score:123,wildMeter:0.4)
  try store.save(envelope)
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=tasks
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
  let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
  bootstrap.sourceSpecialIdlePresentationEnabled=true
  let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
  defer{bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
  let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
  try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
  let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene)
  try await waitUntil{scene.sourceNativeTileNode("saved-bee")?.sourceWildSkinReceiptCurrent==true && scene.sourceNativeTileNode("saved-bee")?.hasAnimatedArtwork==true}
  let node=try XCTUnwrap(scene.sourceNativeTileNode("saved-bee")),scope=try XCTUnwrap(game.sourceScope)
  XCTAssertTrue(scene.sourceSpecialIdleAdmissionOpen);XCTAssertEqual(scope.specialIdle.snapshot.registered,1)
  XCTAssertNil(game.sourceInitialConstruction) // Wild original constructor still open.
  XCTAssertEqual(game.engine.state.score,123);XCTAssertEqual(game.engine.state.wildMeter,0.4)
  NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
  XCTAssertTrue(scene.sourceNativeTileNode("saved-bee") === node)
  NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
  XCTAssertTrue(scene.sourceNativeTileNode("saved-bee") === node)
  XCTAssertTrue(node.sourceWildSkinReceiptCurrent);XCTAssertEqual(scope.specialIdle.snapshot.registered,1)
  XCTAssertEqual(scope.specialIdle.snapshot.running,1)
 }
 func testLiveUIKitHiddenAncestorAutomaticallyPausesAndResumesSameShimmer()async throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-live-shimmer-\(UUID().uuidString)")
  defer{try? FileManager.default.removeItem(at:directory)}
  let store=NativeSaveStore(directory:directory)
  var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
  envelope.progression.firstPlayTutorialComplete=true
  envelope.arcadeRun = .init(tiles:[.init(id:"saved-bee",cell:.init(column:0,row:0),value:6,stackDepth:4,archetype:.star,variant:"bee"),.init(id:"other",cell:.init(column:4,row:8),value:2,stackDepth:3)],mode:.arcade,board:1,stage:1,generation:9,revision:4,moves:23,score:123,wildMeter:0.4,wildSpawnCount:7)
  try store.save(envelope)
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let origin=Date().timeIntervalSince1970*1000
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:origin,sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=tasks
  var draws=0
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:origin,visualRandom:{draws+=1;return 0.5},sourceMicrotaskTasks:tasks)
  let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
  bootstrap.sourceInitialWildResumeEnabled=true;bootstrap.sourceSpecialIdlePresentationEnabled=true;bootstrap.sourceWildShimmerPresentationEnabled=true
  let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  window.windowScene=previous?.windowScene
  window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
  defer{bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
  let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
  try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
  let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene),construction=try XCTUnwrap(game.sourceInitialConstruction),scope=try XCTUnwrap(game.sourceScope)
  let node=try XCTUnwrap(scene.sourceNativeTileNode("saved-bee"))
  try await waitUntil{node.sourceWildSkinReceiptCurrent && node.hasAnimatedArtwork}
  let sprite=try XCTUnwrap(node.sourceWildShimmerSprite),shader=try XCTUnwrap(sprite.shader)
  let sweepDeadline=Date().addingTimeInterval(12)
  while shader.uniformNamed("u_opacity")!.floatValue<0.1 && Date()<sweepDeadline {try await Task.sleep(nanoseconds:20_000_000)}
  XCTAssertEqual(node.alpha,1,accuracy:0.0001)
  XCTAssertTrue(service.hasActiveClock)
  XCTAssertGreaterThan(shader.uniformNamed("u_opacity")!.floatValue,0.1)
  game.view.isHidden=true
  // No manual visibility reconciliation, Scene update or clock delivery.
  try await Task.sleep(nanoseconds:400_000_000)
  let hiddenOffset=try XCTUnwrap(shader.uniformNamed("u_sweep")).vectorFloat2Value
  let hiddenOpacity=try XCTUnwrap(shader.uniformNamed("u_opacity")).floatValue
  let hiddenDraws=draws
  try await Task.sleep(nanoseconds:700_000_000)
  XCTAssertEqual(shader.uniformNamed("u_sweep")!.vectorFloat2Value,hiddenOffset)
  XCTAssertEqual(shader.uniformNamed("u_opacity")!.floatValue,hiddenOpacity)
  XCTAssertEqual(draws,hiddenDraws)
  XCTAssertTrue(node.sourceWildShimmerSprite === sprite)
  game.view.isHidden=false
  try await Task.sleep(nanoseconds:550_000_000)
  XCTAssertNotEqual(shader.uniformNamed("u_sweep")!.vectorFloat2Value,hiddenOffset)
  XCTAssertTrue(node.sourceWildShimmerSprite === sprite)
  XCTAssertEqual(construction.textures.sourceWildShimmerGradients.references,1)
  XCTAssertEqual(scope.specialIdle.snapshot.registered,1)
 }
 func testActualSavedPlainStarAppAutomaticallyResumesHaloAfterEntry()async throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-wild-ctor-app-\(UUID().uuidString)")
  defer{try? FileManager.default.removeItem(at:directory)}
  let store=NativeSaveStore(directory:directory)
  var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
  envelope.progression.firstPlayTutorialComplete=true
  envelope.arcadeRun = .init(tiles:[.init(id:"saved-bee",cell:.init(column:0,row:0),value:6,stackDepth:4,archetype:.star,variant:nil),.init(id:"other",cell:.init(column:4,row:8),value:2,stackDepth:3)],mode:.arcade,board:1,stage:1,generation:9,revision:4,moves:23,score:123,wildMeter:0.4,wildSpawnCount:7)
  try store.save(envelope)
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=tasks
  var draws=0
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{draws+=1;return 0.5},sourceMicrotaskTasks:tasks)
  let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
  bootstrap.sourceInitialWildResumeEnabled=true;bootstrap.sourceSpecialIdlePresentationEnabled=true;bootstrap.sourceWildShimmerPresentationEnabled=true
  let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
  defer{bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
  let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
  try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
  let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene),construction=try XCTUnwrap(game.sourceInitialConstruction),scope=try XCTUnwrap(game.sourceScope)
  let node=try XCTUnwrap(scene.sourceNativeTileNode("saved-bee"))
  try await waitUntil{scene.sourceSpecialIdleAdmissionOpen && scene.sourceRestoredWildSkinsConfigured}
  XCTAssertTrue(node === construction.nodes["saved-bee"]);XCTAssertTrue(node.sourceRestoredWildConstructorCurrent)
  XCTAssertTrue(node.sourcePhysicalMarkersCovered);XCTAssertTrue(scene.sourceRestoredWildSkinsConfigured)
  XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(scope.specialIdle.snapshot.registered,0)
  // CADisplayLink may deliver the captured raw callbacks while UIKit layout
  // is awaited. The synchronous constructor prefix is covered in Node tests.
  if node.sourceRestoreWildFacePending {
   XCTAssertEqual(construction.pendingFaceCount,2);XCTAssertEqual(draws,2)
  } else {
   XCTAssertEqual(construction.pendingFaceCount,0);XCTAssertEqual(draws,3)
  }
  service.deliver(wallMilliseconds:16)
  XCTAssertEqual(draws,3,"one regular face skin draw, no Wild numbers draw")
  XCTAssertEqual(construction.pendingFaceCount,0);XCTAssertFalse(node.sourceRestoreWildFacePending)
  try await waitUntil{node.sourceWildSkinReceiptCurrent && node.sourceLiveStarHaloCount>0}
  XCTAssertTrue(scene.sourcePlainStarHalosConfigured(scope:scope))
  XCTAssertFalse(node.sourceIdleDeferred);XCTAssertTrue(scene.isBoardEntryComplete)
  XCTAssertEqual(node.sourceWildShimmerRootCount,0);XCTAssertNil(node.sourceWildShimmerSprite)
  XCTAssertEqual(node.sourceLiveStarHaloCount,2)
  XCTAssertEqual(game.engine.state.score,123);XCTAssertEqual(game.engine.state.moves,23)
  XCTAssertEqual(game.engine.state.wildSpawnCount,7)
  XCTAssertTrue(scene.sourceNativeTileNode("saved-bee") === node)
  scope.dispose();XCTAssertEqual(node.sourceLiveStarHaloCount,0)
 }
 func testActualSavedBeeAppUsesGenuineWildConstructorAndTypedSkinThenEntryOwnedIdle()async throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-wild-ctor-app-\(UUID().uuidString)")
  defer{try? FileManager.default.removeItem(at:directory)}
  let store=NativeSaveStore(directory:directory)
  var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
  envelope.progression.firstPlayTutorialComplete=true
  envelope.arcadeRun = .init(tiles:[.init(id:"saved-bee",cell:.init(column:0,row:0),value:6,stackDepth:4,archetype:.star,variant:"bee"),.init(id:"other",cell:.init(column:4,row:8),value:2,stackDepth:3)],mode:.arcade,board:1,stage:1,generation:9,revision:4,moves:23,score:123,wildMeter:0.4,wildSpawnCount:7)
  try store.save(envelope)
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=tasks
  var draws=0
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{draws+=1;return 0.5},sourceMicrotaskTasks:tasks)
  let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
  bootstrap.sourceInitialWildResumeEnabled=true;bootstrap.sourceSpecialIdlePresentationEnabled=true;bootstrap.sourceWildShimmerPresentationEnabled=true
  let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
  defer{bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
  let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
  try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
  let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene),construction=try XCTUnwrap(game.sourceInitialConstruction),scope=try XCTUnwrap(game.sourceScope)
  let node=try XCTUnwrap(scene.sourceNativeTileNode("saved-bee"))
  try await waitUntil{scene.sourceSpecialIdleAdmissionOpen && scene.sourceRestoredWildSkinsConfigured}
  XCTAssertTrue(node === construction.nodes["saved-bee"]);XCTAssertTrue(node.sourceRestoredWildConstructorCurrent)
  XCTAssertTrue(node.sourcePhysicalMarkersCovered);XCTAssertTrue(scene.sourceRestoredWildSkinsConfigured)
  XCTAssertTrue(node.sourceIdleDeferred);XCTAssertEqual(scope.specialIdle.snapshot.registered,0)
  // CADisplayLink may deliver the captured raw callbacks while UIKit layout
  // is awaited. The synchronous constructor prefix is covered in Node tests.
  if node.sourceRestoreWildFacePending {
   XCTAssertEqual(construction.pendingFaceCount,2);XCTAssertEqual(draws,2)
  } else {
   XCTAssertEqual(construction.pendingFaceCount,0);XCTAssertEqual(draws,3)
  }
  service.deliver(wallMilliseconds:16)
  XCTAssertEqual(draws,3,"one regular face skin draw, no Wild numbers draw")
  XCTAssertEqual(construction.pendingFaceCount,0);XCTAssertFalse(node.sourceRestoreWildFacePending)
  let initialMask=try XCTUnwrap(node.sourcePaintedNumbersTexture)
  try await waitUntil{node.sourceWildSkinReceiptCurrent && node.hasAnimatedArtwork}
  XCTAssertFalse(node.sourceIdleDeferred);XCTAssertTrue(node.sourceRestoredWildConstructorCurrent)
  XCTAssertEqual(node.sourceWildShimmerRootCount,1);XCTAssertNotNil(node.sourceWildShimmerSprite)
  XCTAssertEqual(construction.textures.sourceWildShimmerGradients.references,1)
  XCTAssertEqual(scope.specialIdle.snapshot.registered,1);XCTAssertEqual(scope.specialIdle.snapshot.running,1)
  let currentFrame=try XCTUnwrap(node.sourceWildSkinAssetPath)
  XCTAssertTrue((1...4).map{"assets/shop/bee/bee\($0)@2x.png"}.contains(currentFrame))
  XCTAssertTrue(node.sourceWildShimmerSprite?.texture === initialMask,"Shimmer keeps the original constructor mask while the current authored Bee frame advances")
  XCTAssertEqual(node.sourceStarOrbitMetrics.width,128,accuracy:1e-4)
  XCTAssertEqual(game.engine.state.score,123);XCTAssertEqual(game.engine.state.moves,23)
  XCTAssertEqual(game.engine.state.wildSpawnCount,7);XCTAssertEqual(game.engine.state.revision,5)
  XCTAssertTrue(game.engine.state.tiles.allSatisfy{$0.stackDepth==1})
  NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
  NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
  XCTAssertTrue(scene.sourceNativeTileNode("saved-bee") === node);XCTAssertEqual(scope.specialIdle.snapshot.registered,1)
  XCTAssertEqual(scope.specialIdle.snapshot.running,1)
  XCTAssertEqual(node.sourceWildShimmerRootCount,1);XCTAssertEqual(construction.textures.sourceWildShimmerGradients.references,1)
  let durable=try XCTUnwrap(store.load()?.arcadeRun)
  XCTAssertEqual(durable.tiles,game.engine.state.tiles);XCTAssertEqual(durable.score,123);XCTAssertEqual(durable.wildSpawnCount,7)
 }
 func testActualMultipleRestoredBeesResumeInCapturedRowMajorOrderAfterEntry()async throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-bee-order-\(UUID().uuidString)")
  defer{try? FileManager.default.removeItem(at:directory)}
  let store=NativeSaveStore(directory:directory)
  var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
  envelope.progression.firstPlayTutorialComplete=true
  // Deliberately reversed serialized order. The original loader captures row-major.
  envelope.arcadeRun = .init(tiles:[8,4,0].map{.init(id:"bee-\($0)",cell:.init(column:0,row:$0),value:6,archetype:.star,variant:"bee")},mode:.arcade,board:1,stage:1,generation:9)
  try store.save(envelope)
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=tasks
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
  let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
  bootstrap.sourceInitialWildResumeEnabled=true;bootstrap.sourceSpecialIdlePresentationEnabled=true
  let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
  defer{bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
  let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
  try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
  let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene),scope=try XCTUnwrap(game.sourceScope)
  try await waitUntil{scene.sourceSpecialIdleAdmissionOpen && scene.sourceRestoredWildSkinsConfigured}
  let ordered=try [0,4,8].map{try XCTUnwrap(scene.sourceNativeTileNode("bee-\($0)"))}
  var resumed:[String]=[]
  for node in ordered {
   XCTAssertTrue(node.sourceIdleDeferred)
   node.onResourceReady={ [weak node] in
    guard let node,!node.sourceIdleDeferred,!resumed.contains(node.tileID) else{return}
    resumed.append(node.tileID)
   }
  }
  service.deliver(wallMilliseconds:16)
  try await waitUntil{ordered.allSatisfy{$0.hasAnimatedArtwork}}
  XCTAssertEqual(resumed,["bee-0","bee-4","bee-8"])
  XCTAssertEqual(scope.specialIdle.snapshot.registered,3);XCTAssertEqual(scope.specialIdle.snapshot.running,3)
  NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
  NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
  XCTAssertEqual(resumed,["bee-0","bee-4","bee-8"])
  XCTAssertEqual(scope.specialIdle.snapshot.registered,3)
  for node in ordered{node.onResourceReady=nil}
 }
 func testActualMixedRestoredFamiliesResumeInOriginalCapturedRowMajorOrder()async throws {
  try await assertMixedRestoredResume(scenario:.ordinary)
 }
 func testActualMixedResumeContinuesAfterFirstPlainStarOwnerRefusesMissingForeground()async throws {
  try await assertMixedRestoredResume(scenario:.refusal)
 }
 func testActualMixedResumeReentrantRendererHandoffCannotOvertakeLaterSlots()async throws {
  try await assertMixedRestoredResume(scenario:.reentry)
 }
 func testActualMixedResumeScopeRetirementStopsLaterSlots()async throws {
  try await assertMixedRestoredResume(scenario:.retirement)
 }
 func testActualMixedResumeFailureReturnAndNewSceneDoNotReviveOldCapturedSlots()async throws {
  try await assertMixedRestoredResume(scenario:.replacement)
 }
 func testActualRestoredPlainStarSheetKeepsAnimatingDuringSharedRegistryPressure()async throws {
  try await assertMixedRestoredResume(scenario:.starPressure)
 }
 private enum MixedResumeScenario {case ordinary,refusal,reentry,retirement,replacement,starPressure}
 private func assertMixedRestoredResume(scenario:MixedResumeScenario)async throws {
  let refusePlain=scenario == .refusal,reenter=scenario == .reentry,retire=scenario == .retirement

  let ids=refusePlain ? ["plain","bee","honey","bottle"]:["bee","honey","bottle","plain"]
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-mixed-order-\(UUID().uuidString)")
  defer{try? FileManager.default.removeItem(at:directory)}
  let store=NativeSaveStore(directory:directory)
  var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
  envelope.progression.firstPlayTutorialComplete=true
  // Deliberately reversed serialized order. The original loader captures row-major.
  let savedTiles:[NativeTile]=ids.enumerated().reversed().map{index,id in
   .init(id:id,cell:.init(column:0,row:index*2),value:6,archetype:(id=="honey" || id=="bottle") ? .magnet:.star,variant:id=="plain" ? nil:id)
  }
  envelope.arcadeRun = .init(tiles:savedTiles,mode:.arcade,board:1,stage:1,generation:9)
  try store.save(envelope)
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=tasks
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
  let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
  bootstrap.sourceInitialWildResumeEnabled=true;bootstrap.sourceSpecialIdlePresentationEnabled=true
  let host=UIViewController(),window=UIWindow(frame:CGRect(x:0,y:0,width:390,height:844))
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
  defer{bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
  let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
  try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
  let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene),scope=try XCTUnwrap(game.sourceScope)
  try await waitUntil{scene.sourceSpecialIdleAdmissionOpen && scene.sourceRestoredWildSkinsConfigured}
  let ordered=try ids.map{try XCTUnwrap(scene.sourceNativeTileNode($0))}
  var resumed:[String]=[],reentered=false
  for node in ordered {
   XCTAssertTrue(node.sourceIdleDeferred)
   node.onResourceReady={ [weak node] in
    guard let node,!node.sourceIdleDeferred,!resumed.contains(node.tileID) else{return}
    resumed.append(node.tileID)
    if retire,node.tileID==ids[0] {scope.dispose()}
    if scenario == .replacement,node.tileID==ids[0] {
     // Invoke the genuine typed failure endpoint. Bootstrap returns through
     // NativeAppController, disposing the old controller/Scene/Scope.
     game.onSourcePresentationFailure?()
    }
    if reenter,node.tileID==ids[0],!reentered {
     reentered=true
     let later=Array(ordered.dropFirst())
     XCTAssertTrue(later.allSatisfy{$0.sourceIdleDeferred})
     scene.didFinishUpdate()
     XCTAssertEqual(resumed,[ids[0]],"nested render handoff cannot drain later slots")
     XCTAssertTrue(later.allSatisfy{$0.sourceIdleDeferred})
    }
   }
  }
  var failures:[String]=[]
  if refusePlain {
   scene.onSourcePresentationFailure={message,_ in failures.append(message)}
   let foreground=try XCTUnwrap(scene.children.first{$0.name=="ANIMATED_DICE_HUD_FOREGROUND"})
   foreground.removeFromParent()
  }
  service.deliver(wallMilliseconds:16)
  if retire || scenario == .replacement {
   try await waitUntil{!scope.current}
   XCTAssertEqual(resumed,[ids[0]])
   XCTAssertEqual(scope.specialIdle.snapshot.registered,0)
   for wall in [400.0,800.0,1200.0] {service.deliver(wallMilliseconds:wall);scene.didFinishUpdate()}
   try await Task.sleep(for:.milliseconds(100))
   XCTAssertEqual(resumed,[ids[0]],"retired callbacks cannot activate later captured slots")
   XCTAssertTrue(ordered.dropFirst().allSatisfy{$0.sourceIdleOwnerCount==0})
   for node in ordered{node.onResourceReady=nil}
   if scenario == .replacement {
    XCTAssertEqual(app.route,.home)
    XCTAssertNil(game.boardScene);XCTAssertNil(game.sourceScope)
    XCTAssertFalse(app.children.contains{$0 === game})
    let durableBefore=try XCTUnwrap(store.load()?.arcadeRun)
    app.navigate(.gameplay,interrupt:true)
    try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
    let replacement=try XCTUnwrap(app.children.first as? NativeGameplayViewController)
    let replacementScene=try XCTUnwrap(replacement.boardScene),replacementScope=try XCTUnwrap(replacement.sourceScope)
    XCTAssertFalse(replacement === game);XCTAssertFalse(replacementScene === scene)
    try await waitUntil{replacementScene.sourceSpecialIdleAdmissionOpen && replacementScene.sourceRestoredWildSkinsConfigured}
    let newNodes=try ids.map{try XCTUnwrap(replacementScene.sourceNativeTileNode($0))}
    for (old,new) in zip(ordered,newNodes){XCTAssertFalse(old === new);XCTAssertTrue(new.sourceIdleDeferred)}
    var newResumed:[String]=[]
    for node in newNodes {
     node.onResourceReady={ [weak node] in
      guard let node,!node.sourceIdleDeferred,!newResumed.contains(node.tileID) else{return}
      newResumed.append(node.tileID)
     }
    }
    service.deliver(wallMilliseconds:1216)
    try await waitUntil{newResumed.count==4}
    XCTAssertEqual(newResumed,ids);XCTAssertEqual(resumed,[ids[0]])
    XCTAssertTrue(replacementScope.current);XCTAssertFalse(scope.current)
    XCTAssertTrue(scope.specialIdle.registeredKeys.isEmpty)
    XCTAssertEqual(Set(replacementScope.specialIdle.registeredKeys.map(ObjectIdentifier.init)),Set(newNodes.map(ObjectIdentifier.init)))
    XCTAssertEqual(replacementScope.specialIdle.snapshot.registered,4)
    try await waitUntil{newNodes[1].sourceHoneyCohortCommitted && newNodes[3].sourceLiveStarHaloCount>0}
    let honeyIdentities=newNodes[1].sourceHoneySprites.map(ObjectIdentifier.init)
    scene.didFinishUpdate();service.deliver(wallMilliseconds:1616)
    XCTAssertEqual(resumed,[ids[0]]);XCTAssertEqual(newResumed,ids)
    XCTAssertEqual(newNodes[1].sourceHoneySprites.map(ObjectIdentifier.init),honeyIdentities)
    var expectedDurable=durableBefore
    expectedDurable.generation &+= 1;expectedDurable.revision &+= 1;expectedDurable.combo=0
    XCTAssertEqual(try store.load()?.arcadeRun,expectedDurable)
    for node in newNodes{node.onResourceReady=nil}
   }
   return
  }
  try await waitUntil{resumed.count==4}
  XCTAssertEqual(resumed,ids)
  if scenario == .starPressure {
   let star=ordered[3]
   try await waitUntil{star.sourcePlainStarArtworkSprite?.isHidden == false}
   let art=try XCTUnwrap(star.sourcePlainStarArtworkSprite)
   scene.update(10000)
   let before=art.texture
   let release=try XCTUnwrap(scope.specialIdle.acquire(reason:"actual-star-sheet-pressure"))
   defer{release()}
   XCTAssertTrue(star.hasAnimatedArtwork,"Original direct Star sheet retains rendering demand during registry pressure")
   scene.update(10000.08)
   XCTAssertFalse(art.isHidden)
   XCTAssertFalse(art.texture === before,"Original shared sheet advances during registry pressure")
   let visiblePose=art.texture
   star.visual.alpha=0.001;scene.update(10000.16)
   XCTAssertTrue(art.texture === visiblePose,"Hidden rotG threshold freezes sheet phase")
   star.visual.alpha=1;scene.update(10000.24)
   XCTAssertFalse(art.texture === visiblePose,"Visible resume advances same sheet")
   let beforeRelease=art.texture
   release();scene.update(10000.32)
   XCTAssertFalse(art.texture === beforeRelease)
   star.setDragging(true);let pointerPose=art.texture;scene.update(10000.4)
   XCTAssertFalse(art.texture === pointerPose,"Original Star animateDuringDrag keeps its full authored sheet")
   star.setDragging(false)
  }
  if reenter {XCTAssertTrue(reentered)}
  XCTAssertEqual(scope.specialIdle.snapshot.registered,4);XCTAssertEqual(scope.specialIdle.snapshot.running,4)
  if refusePlain {
   XCTAssertTrue(failures.contains("source_restored_star_idle_rejected"))
   XCTAssertEqual(ordered[0].sourceLiveStarHaloCount,0)
   try await waitUntil{ordered[1].hasAnimatedArtwork && ordered[2].sourceHoneyCohortCommitted && ordered[3].hasSourceBottleIdle}
   XCTAssertTrue(ordered.allSatisfy{!$0.sourceIdleDeferred})
  }
  NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
  NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
  XCTAssertEqual(resumed,ids)
  XCTAssertEqual(scope.specialIdle.snapshot.registered,4)
  for node in ordered{node.onResourceReady=nil}
 }

 private func waitUntil(_ predicate:()->Bool)async throws {
  let deadline=Date().addingTimeInterval(8)
  while !predicate() {if Date()>deadline{throw NSError(domain:"SourceResumeTimeout",code:1)};try await Task.sleep(nanoseconds:20_000_000)}
 }
 func testActualSavedHoneyBootstrapRetainsThreeCarriersAcrossBackgroundAndDurableAccounting()async throws {
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("source-honey-bootstrap-\(UUID().uuidString)")
  defer{try? FileManager.default.removeItem(at:directory)}
  let store=NativeSaveStore(directory:directory)
  var envelope=NativeSaveEnvelope(settings:.init(gameSoundsEnabled:false,musicEnabled:false,hapticsEnabled:false))
  envelope.progression.firstPlayTutorialComplete=true
  envelope.arcadeRun = .init(tiles:[.init(id:"saved-honey",cell:.init(column:0,row:0),value:6,archetype:.magnet,variant:"honey"),.init(id:"regular",cell:.init(column:4,row:8),value:2)],mode:.arcade,board:1,stage:1,generation:9,moves:23,score:123)
  try store.save(envelope)
  let fifo=NativeSourceMicrotaskFIFO(),tasks=NativeSourceMicrotaskAdapters(fifo:fifo)
  let service=NativeSourceAnimationClockService(wallOriginMilliseconds:0,sourceWallMillisecondsNow:{0},sourceFrameTransportEnabled:true)
  service.sourceMicrotaskTasks=tasks
  let context=NativeGameplaySourceContext(service:service,appOriginMilliseconds:0,visualRandom:{0.5},sourceMicrotaskTasks:tasks)
  let bootstrap=try NativeBootstrap(root:NativeTestResources.root,store:store,showStudioIntro:false,sourceContext:context)
  bootstrap.sourceInitialWildResumeEnabled=true;bootstrap.sourceSpecialIdlePresentationEnabled=true
  let host=UIViewController(),window=UIWindow(frame:.init(x:0,y:0,width:390,height:844))
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  window.rootViewController=host;window.makeKeyAndVisible();bootstrap.start(in:host)
  defer{bootstrap.dispose();context.dispose();service.dispose();fifo.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
  let app=try XCTUnwrap(host.children.first as? NativeAppController);app.navigate(.gameplay,interrupt:true)
  try await waitUntil{app.children.contains{$0 is NativeGameplayViewController}}
  let game=try XCTUnwrap(app.children.first as? NativeGameplayViewController),scene=try XCTUnwrap(game.boardScene),construction=try XCTUnwrap(game.sourceInitialConstruction),scope=try XCTUnwrap(game.sourceScope)
  let node=try XCTUnwrap(scene.sourceNativeTileNode("saved-honey"))
  try await waitUntil{scene.sourceSpecialIdleAdmissionOpen && scene.sourceRestoredWildSkinsConfigured}
  XCTAssertTrue(node === construction.nodes["saved-honey"]);XCTAssertTrue(node.sourceRestoredWildConstructorCurrent)
  service.deliver(wallMilliseconds:16)
  try await waitUntil{node.hasSourceHoneyIdle && node.sourceHoneyCohortCommitted && node.sourceWildSkinReceiptCurrent}
  XCTAssertFalse(node.sourceIdleDeferred);XCTAssertEqual(node.sourceHoneySprites.count,3)
  XCTAssertFalse(node.visual.children.contains{$0.name=="native-honey-idle-orbit"})
  let ids=node.sourceHoneySprites.map(ObjectIdentifier.init),before=game.engine.state
  service.deliver(wallMilliseconds:400);let poses=node.sourceHoneySprites.map(\.position)
  NotificationCenter.default.post(name:UIApplication.willResignActiveNotification,object:nil)
  service.deliver(wallMilliseconds:800);XCTAssertEqual(node.sourceHoneySprites.map(\.position),poses)
  NotificationCenter.default.post(name:UIApplication.didBecomeActiveNotification,object:nil)
  service.deliver(wallMilliseconds:1200)
  XCTAssertNotEqual(node.sourceHoneySprites.map(\.position),poses)
  XCTAssertTrue(scene.sourceNativeTileNode("saved-honey") === node)
  XCTAssertEqual(node.sourceHoneySprites.map(ObjectIdentifier.init),ids)
  XCTAssertEqual(scope.specialIdle.snapshot.registered,1);XCTAssertEqual(scope.specialIdle.snapshot.running,1)
  XCTAssertEqual(game.engine.state,before)
  let durable=try XCTUnwrap(store.load()?.arcadeRun)
  XCTAssertEqual(durable.score,123);XCTAssertEqual(durable.moves,23);XCTAssertEqual(durable.tiles,game.engine.state.tiles)
 }
}
