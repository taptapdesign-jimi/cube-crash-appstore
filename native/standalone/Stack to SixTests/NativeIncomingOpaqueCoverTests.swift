import XCTest
import UIKit
@testable import Stack_to_Six

@MainActor final class NativeIncomingOpaqueCoverTests:XCTestCase {
 func testOnlyMountedOriginalOpaquePaintTransfersVisibilityOnce()async throws {
  let carrier=NativeThemedBoardTransitionController(root:NativeTestResources.root,board:1,
      viewport:.init(width:390,height:844),generation:17,random:{0.1})
  var receipts:[UInt64]=[]
  carrier.onOriginalOpaqueCover={receipts.append($0)}
  carrier.start()
  let deadline=Date().addingTimeInterval(8)
  while !carrier.assetsReady {
   guard Date()<deadline else{throw NSError(domain:"NativeOpaqueCover.resources",code:1)}
   try await Task.sleep(for:.milliseconds(10))
  }
  carrier.setForeground(false)
  XCTAssertEqual(receipts,[],"Prepared assets without mounted incoming pixels do not hide the World")
  let previous=UIApplication.shared.connectedScenes.compactMap{$0 as? UIWindowScene}.flatMap(\.windows).first(where:\.isKeyWindow)
  let window=UIWindow(frame:.init(x:0,y:0,width:390,height:844));window.rootViewController=carrier;window.makeKeyAndVisible()
  defer{carrier.dispose();window.isHidden=true;previous?.makeKeyAndVisible()}
  carrier.setForeground(true)
  carrier.paint(seconds:0.1,generation:17)
  XCTAssertEqual(receipts,[],"The fading original cover still retains outgoing paint")
  carrier.paint(seconds:0.2,generation:17)
  XCTAssertEqual(receipts,[17])
  carrier.paint(seconds:0.3,generation:17)
  XCTAssertEqual(receipts,[17])
  carrier.dispose();carrier.paint(seconds:0.4,generation:17)
  XCTAssertEqual(receipts,[17])
 }
}
