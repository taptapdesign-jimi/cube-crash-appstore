import UIKit

/// Finite canonical bubble/ship projections, renewed only by the current World receipt.
/// Core Animation interpolates the trajectories; no display link, timers or web renderer.
@MainActor
final class JimiNativeWorldAmbient {
    struct Frame {
        let time:Double,x:CGFloat,y:CGFloat,width:CGFloat,height:CGFloat,rotation:CGFloat,opacity:Float
        let asset:String,behind:Bool
    }
    struct Plan {
        let id:Int,worldID:Int,duration:Double,frames:[Frame],assets:[String],visualBounds:CGRect
        static func parse(_ raw:[String:Any],worldID:Int)->Plan? {
            guard raw["worldID"] as? Int == worldID,(2...3).contains(worldID),let id = raw["id"] as? Int,(0..<(worldID == 2 ? 8 : 2)).contains(id),
                  let duration = raw["duration"] as? Double,duration.isFinite,duration>0,duration<=11,
                  let rows = raw["frames"] as? [[String:Any]],(2...331).contains(rows.count) else {return nil}
            let allowed:Set<String> = worldID == 2 ? Set((1...6).map {"./assets/shop/bottle/bottle animation pack/bubble\($0).png"}) : ["./assets/journey assets/robo/ship1@2x.png"]
            var frames:[Frame] = [],assets = Set<String>(),bounds = CGRect.null,last = -Double.infinity
            for row in rows {
                guard let time = row["time"] as? Double,let x = row["x"] as? Double,let y = row["y"] as? Double,
                      let width = row["width"] as? Double,let height = row["height"] as? Double,let rotation = row["rotation"] as? Double,
                      let opacity = row["opacity"] as? Double,[time,x,y,width,height,rotation,opacity].allSatisfy({$0.isFinite}),
                      time>=0,time<=duration,time>last,abs(x)<5000,abs(y)<10000,width>0,width<=140,height>0,height<=140,
                      abs(rotation)<=20.001,(0...1).contains(opacity),let asset = row["asset"] as? String,allowed.contains(asset),
                      let depth = row["depth"] as? String,depth == "front" || depth == "behind",worldID == 2 || depth == "front" else {return nil}
                frames.append(Frame(time:time,x:x,y:y,width:width,height:height,rotation:rotation * .pi/180,opacity:Float(opacity),asset:asset,behind:depth == "behind"))
                assets.insert(asset);bounds = bounds.union(CGRect(x:x-width,y:y-height,width:width*3,height:height*3));last = time
            }
            guard frames.first?.time == 0,abs(last-duration)<0.001 else {return nil}
            return Plan(id:id,worldID:worldID,duration:duration,frames:frames,assets:Array(assets),visualBounds:bounds)
        }
    }
    private final class Receipt:NSObject,CAAnimationDelegate {
        var finish:(()->Void)?
        func animationDidStop(_ anim:CAAnimation,finished flag:Bool) {if flag {finish?()}}
    }
    private final class Sprite {
        var plan:Plan,elapsed:Double = 0,start:Double = 0,epoch = 0,preparing = false,playing = false,complete = false
        let layers = [CALayer(),CALayer()]
        var receipt:Receipt?
        init(_ plan:Plan) {self.plan = plan}
    }
    private let resources:JimiNativeWorldResources
    private weak var content:UIView?
    private var sprites:[Int:Sprite] = [:],epoch = 0,requesting = false,enabled = false
    private var viewport = CGRect.zero,scale:CGFloat = 1
    var onRequest: ((CGRect,[Int],@escaping ([[String:Any]]?)->Void)->Void)?
    var activeCount:Int {sprites.values.filter {$0.playing}.count}
    var layerCount:Int {sprites.values.reduce(0) {$0+$1.layers.filter {$0.superlayer != nil}.count}}
    init(plans:[Plan],content:UIView,resources:JimiNativeWorldResources) {
        self.content = content;self.resources = resources
        for plan in plans {sprites[plan.id] = Sprite(plan)}
    }
    private func visible(_ sprite:Sprite)->Bool {sprite.plan.visualBounds.applying(CGAffineTransform(scaleX:scale,y:scale)).intersects(viewport.insetBy(dx:0,dy:-80*scale))}
    func prepareVisible(viewport:CGRect,scale:CGFloat,completion:@escaping (Bool)->Void) {
        self.viewport = viewport;self.scale = scale
        let targets = sprites.values.filter(visible);var left = targets.count,accepted = true
        guard left>0 else {completion(true);return}
        for sprite in targets {resources.prepare(sprite.plan.assets,owner:-400-sprite.plan.id) {ok in accepted = accepted && ok;left -= 1;if left == 0 {completion(accepted)}}}
    }
    func update(enabled:Bool,viewport:CGRect,scale:CGFloat) {
        self.enabled = enabled && !UIAccessibility.isReduceMotionEnabled;self.viewport = viewport;self.scale = scale
        for sprite in sprites.values {if self.enabled && visible(sprite) && !sprite.complete {start(sprite)} else {pause(sprite)}}
        renew()
    }
    private func start(_ sprite:Sprite) {
        guard !sprite.playing,!sprite.preparing else {return};sprite.preparing = true
        let token = epoch,owner = sprite.epoch
        resources.prepare(sprite.plan.assets,owner:-400-sprite.plan.id) { [weak self,weak sprite] accepted in
            guard let self,let sprite,self.epoch == token,sprite.epoch == owner else {return};sprite.preparing = false
            guard accepted,self.enabled,self.visible(sprite),!sprite.complete else {return};self.install(sprite)
        }
    }
    private func install(_ sprite:Sprite) {
        guard let content else {return}
        let token = sprite.epoch,frames = sprite.plan.frames,duration = sprite.plan.duration
        let images = Dictionary(uniqueKeysWithValues:sprite.plan.assets.compactMap {asset -> (String,CGImage)? in resources.image(asset,owner:-400-sprite.plan.id)?.cgImage.map {(asset,$0)}})
        guard images.count == sprite.plan.assets.count else {return}
        let times = frames.map {NSNumber(value:$0.time/duration)}
        let poses = frames.map {f -> NSValue in
            var pose = CATransform3DMakeTranslation((f.x+f.width/2)*scale,(f.y+f.height/2)*scale,0)
            pose = CATransform3DRotate(pose,f.rotation,0,0,1);pose = CATransform3DScale(pose,f.width*scale,f.height*scale,1)
            return NSValue(caTransform3D:pose)
        }
        sprite.playing = true;sprite.start = CACurrentMediaTime()-sprite.elapsed
        for (index,layer) in sprite.layers.enumerated() {
            layer.name = "world.ambient.\(sprite.plan.worldID).\(sprite.plan.id).\(index)";layer.bounds = CGRect(x:0,y:0,width:1,height:1);layer.position = .zero;layer.opacity = 0
            // Native World2/3 parts use shared-motion depth planes: clouds1,
            // terrain2, main3, decor6, front ambience7 and cards8.
            layer.zPosition = index == 0 ? 7 : 0;content.layer.addSublayer(layer)
            let motion = CAKeyframeAnimation(keyPath:"transform");motion.values = poses;motion.keyTimes = times
            let art = CAKeyframeAnimation(keyPath:"contents");art.values = frames.map {images[$0.asset]!};art.keyTimes = times;art.calculationMode = .discrete
            let alpha = CAKeyframeAnimation(keyPath:"opacity");alpha.values = frames.map {$0.behind == (index == 1) ? $0.opacity : 0};alpha.keyTimes = times
            let group = CAAnimationGroup();group.animations = [motion,art,alpha];group.duration = duration;group.beginTime = layer.convertTime(sprite.start,from:nil);group.fillMode = .both;group.isRemovedOnCompletion = false
            if index == 0 {let receipt = Receipt();receipt.finish = { [weak self,weak sprite] in guard let self,let sprite,sprite.epoch == token else {return};sprite.playing = false;sprite.complete = true;sprite.elapsed = duration;self.renew()};sprite.receipt = receipt;group.delegate = receipt}
            layer.add(group,forKey:"world.ambient.flight")
        }
    }
    private func pause(_ sprite:Sprite) {
        guard sprite.playing || sprite.preparing || sprite.layers.contains(where:{$0.superlayer != nil}) else {return}
        if sprite.playing {sprite.elapsed = min(sprite.plan.duration,max(0,CACurrentMediaTime()-sprite.start))}
        sprite.epoch += 1;sprite.playing = false;sprite.preparing = false;sprite.receipt = nil
        sprite.layers.forEach {$0.removeAllAnimations();$0.contents = nil;$0.removeFromSuperlayer()};resources.release(-400-sprite.plan.id)
    }
    private func renew() {
        guard enabled,!requesting,let onRequest else {return}
        let ids = sprites.values.filter {$0.complete || ($0.plan.worldID == 3 && !visible($0))}.map {$0.plan.id}.sorted()
        guard !ids.isEmpty else {return};requesting = true;let token = epoch
        let requestViewport = CGRect(x:0,y:viewport.minY/scale,width:390,height:viewport.height/scale)
        onRequest(requestViewport,ids) { [weak self] raw in
            guard let self,self.epoch == token else {return};self.requesting = false
            guard let worldID = self.sprites.values.first?.plan.worldID,let rows = raw,
                  rows.count == ids.count else {return}
            let plans = rows.compactMap {Plan.parse($0,worldID:worldID)}
            guard plans.count == ids.count,Set(plans.map {$0.id}) == Set(ids) else {return}
            for plan in plans {guard let sprite = self.sprites[plan.id] else {continue};self.pause(sprite);sprite.plan = plan;sprite.elapsed = 0;sprite.complete = false;if self.enabled && self.visible(sprite) {self.start(sprite)}}
        }
    }
    func replacePlans(_ plans:[Plan]) {let callback = onRequest;cleanup();onRequest = callback;for plan in plans {sprites[plan.id] = Sprite(plan)}}
    func cleanup() {epoch += 1;enabled = false;requesting = false;sprites.values.forEach(pause);sprites.removeAll();onRequest = nil}
}
