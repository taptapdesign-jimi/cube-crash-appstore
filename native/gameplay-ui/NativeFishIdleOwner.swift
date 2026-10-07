import UIKit
import QuartzCore

/// A route-scoped media lease. Accepted die poses remain owned by SpriteKit;
/// AVFoundation plays the unchanged original Fish movie without a second clock.
@MainActor
final class NativeFishIdleOwner:UIView {
    var onPrepared:((String,UInt64)->Void)?
    var onMediaReady:((String,UInt64,Bool)->Void)?
    private let resourceRoot:URL
    private var owners:[String:NativeFishIdlePresentation]=[:]
    private var generation:UInt64?,disposed=false,suspended=false
    init(resourceRoot:URL) {
        self.resourceRoot=resourceRoot;super.init(frame:.zero)
        isOpaque=false;backgroundColor = .clear;isUserInteractionEnabled=false;clipsToBounds=true
        accessibilityIdentifier="native-fish-authored-foreground"
    }
    required init?(coder:NSCoder){fatalError("Use an accepted resource lease")}
    func paint(_ frames:[String:NativeFishIdleFrame],generation:UInt64,force:Bool=false,now:Double=CACurrentMediaTime()) {
        guard !disposed else {return}
        if self.generation != generation {
            retireMedia();self.generation=generation
        }
        for id in Array(owners.keys) where frames[id]==nil {owners.removeValue(forKey:id)?.dispose()}
        for (id,frame) in frames.sorted(by:{$0.value.depth == $1.value.depth ? $0.value.paintOrder<$1.value.paintOrder:$0.value.depth<$1.value.depth}) {
            let owner:NativeFishIdlePresentation
            if let existing=owners[id] {owner=existing}
            else {
                owner=NativeFishIdlePresentation(resourceRoot:resourceRoot)
                owners[id]=owner;addSubview(owner);owner.setSuspended(suspended)
                owner.onPrepared={ [weak self,weak owner] in
                    guard let self,!self.disposed,self.generation==generation,self.owners[id] === owner else {return}
                    self.onPrepared?(id,generation)
                }
                owner.onMediaReady={ [weak self,weak owner] ready in
                    guard let self,!self.disposed,self.generation==generation,self.owners[id] === owner else {return}
                    self.onMediaReady?(id,generation,ready)
                }
                owner.prepare()
            }
            bringSubviewToFront(owner);owner.paint(frame,now:now,force:force)
        }
    }
    func setSuspended(_ value:Bool) {suspended=value;owners.values.forEach {$0.setSuspended(value)}}
    var activeMediaCount:Int {owners.count}
    func presentation(tileID:String)->NativeFishIdlePresentation? {owners[tileID]}
    private func retireMedia() {Array(owners.values).forEach {$0.dispose()};owners.removeAll()}
    func dispose() {guard !disposed else {return};disposed=true;onPrepared=nil;onMediaReady=nil;retireMedia();generation=nil;removeFromSuperview()}
}
