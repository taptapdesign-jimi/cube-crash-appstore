import SpriteKit

/// Binds the clockless promise bridge to the existing board texture owner.
/// Artwork/idle/carrier readiness is deliberately not an input to this bridge.
@MainActor enum NativeMeterSelectedNativeWarmup {
 static func make(textures:NativeBoardTextures,
                  assetCompletionTask:((()->Void)->Bool)?=nil)->NativeMeterSelectedFinaleWarmup<SKTexture> {
  NativeMeterSelectedFinaleWarmup<SKTexture>(load:{ [weak textures] asset,done in
   let completed:(SKTexture?)->Void = {texture in
    // This is the actual selected native upload/decode completion. It can arrive
    // after carrier travel has already awaited the selected warmup Promise.
    // Borrow the app's existing asset producer; never invent an async fallback.
    if let assetCompletionTask {_=assetCompletionTask{done(texture)}}
    else {done(texture)} // Existing Raw fixtures have no Source FIFO installation.
   }
   guard let textures else{completed(nil);return}
   textures.prepareSelectedFinaleAsset(asset,completion:completed)
  })
 }
}
