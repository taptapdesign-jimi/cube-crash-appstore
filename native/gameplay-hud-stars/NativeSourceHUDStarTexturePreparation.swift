import SpriteKit
import UIKit

/// App-lived cached merge-six HUD coin texture. Upload is performed by the
/// existing guarded selected-asset host, with original bytes and no all-artwork
/// warmup. Sprite/job lifetime does not invalidate this reusable app cache.
@MainActor final class NativeSourceHUDStarTexturePreparation {
    @MainActor final class Prepared {
        fileprivate weak var owner:NativeSourceHUDStarTexturePreparation?
        fileprivate let epoch:UInt64
        let texture:SKTexture,pixelSize:CGSize
        fileprivate(set) var coinAnimations:[NativeHUDCoinAnimation]=[]
        fileprivate init(owner:NativeSourceHUDStarTexturePreparation,epoch:UInt64,texture:SKTexture,pixelSize:CGSize){self.owner=owner;self.epoch=epoch;self.texture=texture;self.pixelSize=pixelSize}
        var current:Bool{owner?.accepts(self)==true}
    }
    struct Request:Hashable{let id:UUID}
    private struct Waiter {let current:()->Bool,completion:(Prepared?)->Void}
    private var host:NativeBoardTextures?,root:URL?,prepared:Prepared?,epoch:UInt64=0,disposed=false
    private var waiting:[Request:Waiter]=[:],order:[Request]=[],loading=false
    func accepts(_ receipt:Prepared)->Bool {!disposed && receipt.owner === self && receipt.epoch==epoch && prepared === receipt}
    /// Standard TNT HUD bonus selection shares the one prepared coin texture.
    /// Its selection still consumes one shared Math draw.
    func selectStandardTntBonusParticle(random:()->Double,current:()->Bool)->Prepared? {
        guard !disposed,let prepared,accepts(prepared),current(),!disposed,accepts(prepared) else{return nil}
        let captured=epoch,roll=random()
        guard !disposed,epoch==captured,current(),!disposed,epoch==captured,accepts(prepared),
              roll.isFinite,roll>=0,roll<1 else{return nil}
        let textures=[prepared]
        return textures[Int(floor(roll*Double(textures.count)))]
    }
    @discardableResult func prepare(root:URL,current:@escaping()->Bool,completion:@escaping(Prepared?)->Void)->Request? {
        guard !disposed,self.root==nil || self.root==root else{completion(nil);return nil}
        let request=Request(id:UUID());waiting[request]=Waiter(current:current,completion:completion);order.append(request)
        if let prepared {deliver(request,prepared);return request}
        guard !loading else{return request};loading=true
        if host==nil {self.root=root;host=NativeBoardTextures(root:root)}
        guard let host else{finish(nil);return request};let captured=epoch
        host.prepareSelectedFinaleAsset(.init(["./assets/hud/coin-hud.png"])) {[weak self,weak host] texture in
            guard let self,!self.disposed,self.epoch==captured,self.host === host,self.loading else{return}
            guard let host,let texture,let size=host.logicalSize("assets/hud/coin-hud.png"),size.width>0,size.height>0 else{self.finish(nil);return}
            let receipt=Prepared(owner:self,epoch:captured,texture:texture,pixelSize:size)
            self.prepareCoinAnimations(receipt, index:0, captured:captured)
        }
        return request
    }
    private func prepareCoinAnimations(_ receipt:Prepared,index:Int,captured:UInt64) {
        guard !disposed,epoch==captured,loading,let host else{return}
        guard index<NativeHUDCoinAnimation.names.count else{
            prepared=receipt;finish(receipt);return
        }
        let name=NativeHUDCoinAnimation.names[index]
        let path="assets/hud/native-coin-animation/\(name).webp"
        host.prepareSelectedFinaleAsset(.init([path])) {[weak self,weak host] atlas in
            guard let self,!self.disposed,self.epoch==captured,self.loading,self.host === host else{return}
            guard let atlas,let size=host?.logicalSize(path),size == CGSize(width:1280,height:index<3 ? 384:1536) else{
                // A failed derived resource keeps genuine reward delivery on the
                // original coin, with no partially admitted animation library.
                receipt.coinAnimations=[];self.host?.dispose();self.host=nil
                self.prepared=receipt;self.finish(receipt);return
            }
            receipt.coinAnimations.append(.slice(atlas,frameCount:index<3 ? 30:120))
            self.prepareCoinAnimations(receipt,index:index+1,captured:captured)
        }
    }
    private func deliver(_ request:Request,_ receipt:Prepared?) {
        guard let waiter=waiting[request] else{return}
        let admitted=waiter.current()
        guard let current=waiting.removeValue(forKey:request) else{return}
        order.removeAll{$0==request}
        // Guard AFTER external predicate; it can dispose this cache or install
        // another request. No old callback may publish a stale prepared object.
        let accepted=admitted && !disposed && receipt.map{accepts($0)}==true
        current.completion(accepted ? receipt:nil)
    }
    private func finish(_ receipt:Prepared?) {
        loading=false;let captured=order
        for request in captured {deliver(request,receipt)}
    }
    @discardableResult func cancel(_ request:Request)->Bool {
        guard let waiter=waiting.removeValue(forKey:request) else{return false};order.removeAll{$0==request}
        waiter.completion(nil);return true
    }
    func dispose() {
        guard !disposed else{return};disposed=true;epoch &+= 1
        prepared=nil;loading=false;let captures=order.compactMap{waiting[$0]};waiting.removeAll();order.removeAll()
        let host=self.host;self.host=nil;self.root=nil;host?.dispose()
        captures.forEach{$0.completion(nil)}
    }
}
