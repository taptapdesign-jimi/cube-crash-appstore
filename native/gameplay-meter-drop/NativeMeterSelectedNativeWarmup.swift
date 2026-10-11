import SpriteKit

/// Binds the clockless promise bridge to the existing board texture owner.
/// Artwork/idle/carrier readiness is deliberately not an input to this bridge.
@MainActor enum NativeMeterSelectedNativeWarmup {
 static func make(textures:NativeBoardTextures)->NativeMeterSelectedFinaleWarmup<SKTexture> {
  NativeMeterSelectedFinaleWarmup<SKTexture>(load:{ [weak textures] asset,done in
   guard let textures else{done(nil);return}
   textures.prepareSelectedFinaleAsset(asset,completion:done)
  })
 }
}
