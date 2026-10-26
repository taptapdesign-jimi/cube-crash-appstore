import UIKit
import QuartzCore

/// A route-scoped media lease. Accepted die poses remain owned by SpriteKit;
/// selected original SVG frames share that clock and one immutable route lease.
/// The optional original movie transport remains available to explicit callers.
@MainActor
final class NativeFishIdleOwner:UIView {
    var onPrepared:((String,UInt64)->Void)?
    var onMediaReady:((String,UInt64,Bool)->Void)?
    private let mediaPolicy:NativeFishMediaPolicy
    private let minimumPaintInterval:Double,svgPlaybackRate:Double
    private let preferOriginalSVG:Bool
    private let resourceRoot:URL
    private let svgResources:NativeFishSVGResourceLease
    private var owners:[String:NativeFishIdlePresentation]=[:]
    private var generation:UInt64?,disposed=false,suspended=false,preservingVisiblePose=false
    init(resourceRoot:URL,mediaPolicy:NativeFishMediaPolicy? = nil,preferOriginalSVG:Bool=false,minimumPaintInterval:Double=1/30,svgPlaybackRate:Double=1) {
        self.minimumPaintInterval=minimumPaintInterval;self.svgPlaybackRate=svgPlaybackRate
        self.preferOriginalSVG=preferOriginalSVG
        self.mediaPolicy=mediaPolicy ?? .shared;self.resourceRoot=resourceRoot;svgResources=NativeFishSVGResourceLease(resourceRoot:resourceRoot,measureBodyBounds:preferOriginalSVG);super.init(frame:.zero)
        isOpaque=false;backgroundColor = .clear;isUserInteractionEnabled=false;clipsToBounds=true
        accessibilityIdentifier="native-fish-authored-foreground"
    }
    required init?(coder:NSCoder){fatalError("Use an accepted resource lease")}
    func paint(_ frames:[String:NativeFishIdleFrame],generation:UInt64,force:Bool=false,now:Double=CACurrentMediaTime()) {
        guard !disposed else {return}
        if self.generation != generation {
            retireMedia();self.generation=generation
        }
        if suspended && preservingVisiblePose {return}
        for id in Array(owners.keys) where frames[id]==nil {owners.removeValue(forKey:id)?.dispose()}
        for (id,frame) in frames.sorted(by:{$0.value.depth == $1.value.depth ? $0.value.paintOrder<$1.value.paintOrder:$0.value.depth<$1.value.depth}) {
            let owner:NativeFishIdlePresentation
            if let existing=owners[id] {owner=existing}
            else {
                owner=NativeFishIdlePresentation(resourceRoot:resourceRoot,svgResources:svgResources,allowHEVC:!preferOriginalSVG && mediaPolicy.useHEVC,minimumPaintInterval:minimumPaintInterval,svgPlaybackRate:svgPlaybackRate)
                owners[id]=owner;addSubview(owner);owner.setSuspended(suspended)
                owner.onPrepared={ [weak self,weak owner] in
                    guard let self,!self.disposed,self.generation==generation,self.owners[id] === owner else {return}
                    self.onPrepared?(id,generation)
                }
                owner.onMediaReady={ [weak self,weak owner] ready in
                    guard let self,!self.disposed,self.generation==generation,self.owners[id] === owner else {return}
                    self.onMediaReady?(id,generation,ready)
                }
                owner.onVideoSourceError={ [weak mediaPolicy=self.mediaPolicy] in mediaPolicy?.recordVideoSourceError() }
                owner.prepare()
            }
            bringSubviewToFront(owner);owner.paint(frame,now:now,force:force)
        }
    }
    func setSuspended(_ value:Bool,preservingVisiblePose:Bool=false) {
        suspended=value;self.preservingVisiblePose=value && preservingVisiblePose
        svgResources.setSuspended(value)
        owners.values.forEach {$0.setSuspended(value,preservingVisiblePose:preservingVisiblePose)}
    }
    var selectedSVGFrameCount:Int {svgResources.decodedFrameCount}
    var pendingSVGRequests:Int {svgResources.pendingRequestCount}
    var activeMediaCount:Int {owners.count}
    /// Optional original-SVG body receipt in this owner's UIKit coordinates.
    func currentBodyFrame(tileID:String)->CGRect? {owners[tileID]?.currentBodyFrame(in:self)}
    func presentation(tileID:String)->NativeFishIdlePresentation? {owners[tileID]}
    private func retireMedia() {Array(owners.values).forEach {$0.dispose()};owners.removeAll()}
    func dispose() {guard !disposed else {return};disposed=true;onPrepared=nil;onMediaReady=nil;retireMedia();svgResources.dispose();generation=nil;removeFromSuperview()}
}
