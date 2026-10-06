import UIKit

@MainActor
final class JimiNativeWorldBees {
    struct Frame {
        let time:Double,x:CGFloat,y:CGFloat,width:CGFloat,sx:CGFloat,sy:CGFloat,rotation:CGFloat,blend:Float
        let asset:String,previous:String?,behind:Bool
    }
    struct Plan {
        let id:Int,duration:Double,frames:[Frame]
        let assets:[String]
        let visualBounds:CGRect
        private static let allowedAssets:Set<String> = Set((1...7).flatMap { ["./assets/shop/honey/bee\($0).png","assets/shop/honey/bee\($0).png"] })
        static func parse(_ raw:[String:Any]) -> Plan? {
            guard let id = raw["id"] as? Int,[0,2,5,7,9].contains(id),let duration = raw["duration"] as? Double,duration.isFinite,duration>0,duration<=60,let rows = raw["frames"] as? [[String:Any]],(2...1801).contains(rows.count) else {return nil}
            var frames:[Frame] = [];frames.reserveCapacity(rows.count)
            var assets = Set<String>(),bounds = CGRect.null,lastTime = -Double.infinity
            for row in rows {
                guard let time = (row["time"] as? NSNumber)?.doubleValue,
                      let x = (row["x"] as? NSNumber)?.doubleValue,
                      let y = (row["y"] as? NSNumber)?.doubleValue,
                      let width = (row["width"] as? NSNumber)?.doubleValue,
                      let sx = (row["scaleX"] as? NSNumber)?.doubleValue,
                      let sy = (row["scaleY"] as? NSNumber)?.doubleValue,
                      let rotation = (row["rotation"] as? NSNumber)?.doubleValue,
                      let blend = (row["blend"] as? NSNumber)?.doubleValue,
                      time.isFinite,x.isFinite,y.isFinite,width.isFinite,sx.isFinite,sy.isFinite,rotation.isFinite,blend.isFinite,
                      let asset = row["asset"] as? String,allowedAssets.contains(asset),
                      let depth = row["depth"] as? String,depth == "front" || depth == "behind",
                      time>=0,time<=duration,time>lastTime,width>0,width<=64,abs(sx)<=2,abs(sy)<=2,blend>=0,blend<=1,abs(x)<5000,abs(y)<5000 else {return nil}
                let previous = row["previousAsset"] as? String
                guard row["previousAsset"] == nil || previous != nil,previous == nil || allowedAssets.contains(previous!) else {return nil}
                frames.append(Frame(time:time,x:x,y:y,width:width,sx:sx,sy:sy,rotation:rotation * .pi/180,blend:Float(blend),asset:asset,previous:previous,behind:depth == "behind"))
                assets.insert(asset);if let previous {assets.insert(previous)}
                bounds = bounds.union(CGRect(x:x-width,y:y-width,width:width*3,height:width*3));lastTime = time
            }
            guard frames.first!.time == 0,abs(lastTime-duration)<0.001 else {return nil}
            return Plan(id:id,duration:duration,frames:frames,assets:Array(assets),visualBounds:bounds)
        }
    }
    private final class Receipt:NSObject,CAAnimationDelegate {
        var finish:(()->Void)?
        func animationDidStop(_ anim:CAAnimation,finished flag:Bool) {if flag {finish?()}}
    }
    private final class Bee {
        var plan:Plan,elapsed:Double = 0,startTime:Double = 0,epoch = 0,preparing = false,playing = false,complete = false
        let layers = (0..<4).map {_ in CALayer()}
        var receipt:Receipt?
        init(_ plan:Plan) {self.plan = plan}
    }
    private let resources:JimiNativeWorldResources
    private weak var content:UIView?
    private weak var main:UIView?
    private var bees:[Int:Bee] = [:],epoch = 0,requesting = false,enabled = false
    private var viewport = CGRect.zero,scale:CGFloat = 1
    var onRequest: (([Int],@escaping ([[String:Any]]?)->Void)->Void)?
    init(plans:[Plan],content:UIView,main:UIView,resources:JimiNativeWorldResources) {
        self.content = content;self.main = main;self.resources = resources
        for plan in plans {bees[plan.id] = Bee(plan)}
    }
    var layerCount:Int {bees.values.reduce(0) {$0+$1.layers.filter {$0.superlayer != nil}.count}}
    var activeCount:Int {bees.values.filter {$0.playing}.count}
    func prepareVisible(viewport:CGRect,scale:CGFloat,completion:@escaping (Bool)->Void) {
        self.viewport = viewport;self.scale = scale
        let visible = bees.values.filter {$0.plan.visualBounds.applying(CGAffineTransform(scaleX:scale,y:scale)).intersects(viewport.insetBy(dx:0,dy:-180*scale))}
        var left = visible.count,accepted = true
        guard left>0 else {completion(true);return}
        for bee in visible {resources.prepare(bee.plan.assets,owner:-300-bee.plan.id) {ok in accepted = accepted && ok;left -= 1;if left == 0 {completion(accepted)}}}
    }
    func update(enabled:Bool,viewport:CGRect,scale:CGFloat) {
        self.enabled = enabled && !UIAccessibility.isReduceMotionEnabled;self.viewport = viewport;self.scale = scale
        for bee in bees.values {
            let visible = bee.plan.visualBounds.applying(CGAffineTransform(scaleX:scale,y:scale)).intersects(viewport.insetBy(dx:0,dy:-180*scale))
            if self.enabled && visible {if !bee.complete {start(bee)}} else {pause(bee)}
        }
        renewIfNeeded()
    }
    private func start(_ bee:Bee) {
        guard !bee.playing,!bee.preparing else {return};bee.preparing = true
        let token = epoch,owner = bee.epoch
        resources.prepare(bee.plan.assets,owner:-300-bee.plan.id) { [weak self,weak bee] accepted in
            guard let self,let bee,self.epoch == token,bee.epoch == owner else {return};bee.preparing = false
            guard accepted,self.enabled,!bee.complete else {return}
            let visible = bee.plan.visualBounds.applying(CGAffineTransform(scaleX:self.scale,y:self.scale)).intersects(self.viewport.insetBy(dx:0,dy:-180*self.scale))
            guard visible else {self.resources.release(-300-bee.plan.id);return};self.install(bee)
        }
    }
    private func install(_ bee:Bee) {
        guard let content,let main else {return}
        let token = bee.epoch,frames = bee.plan.frames,duration = bee.plan.duration
        let images = Dictionary(uniqueKeysWithValues:bee.plan.assets.compactMap {path -> (String,CGImage)? in resources.image(path,owner:-300-bee.plan.id)?.cgImage.map {(path,$0)}})
        guard images.count == bee.plan.assets.count else {return}
        let times = frames.map {NSNumber(value:$0.time/duration)}
        let transforms = frames.map {f -> NSValue in
            var pose = CATransform3DMakeTranslation((f.x+f.width/2)*scale,(f.y+f.width/2)*scale,0)
            pose = CATransform3DRotate(pose,f.rotation,0,0,1);pose = CATransform3DScale(pose,f.width*f.sx*scale,f.width*f.sy*scale,1)
            return NSValue(caTransform3D:pose)
        }
        bee.playing = true;bee.startTime = CACurrentMediaTime()-bee.elapsed
        for (index,layer) in bee.layers.enumerated() {
            layer.name = "world.bee.\(bee.plan.id).\(index)";layer.bounds = CGRect(x:0,y:0,width:1,height:1);layer.position = .zero;layer.opacity = 0
            if index<2 {content.layer.addSublayer(layer)} else if let hero = main.subviews.filter({$0.accessibilityIdentifier?.hasSuffix(".cloud") != true}).max(by:{$0.bounds.width*$0.bounds.height<$1.bounds.width*$1.bounds.height}) {main.layer.insertSublayer(layer,below:hero.layer)} else {main.layer.addSublayer(layer)}
            let motion = CAKeyframeAnimation(keyPath:"transform");motion.values = index<2 ? transforms : transforms.map { value -> NSValue in var pose = value.caTransform3DValue;pose.m41 -= main.frame.minX;pose.m42 -= main.frame.minY;return NSValue(caTransform3D:pose)};motion.keyTimes = times
            let art = CAKeyframeAnimation(keyPath:"contents");art.values = frames.map {images[index%2 == 0 ? $0.asset : ($0.previous ?? $0.asset)]!};art.keyTimes = times;art.calculationMode = .discrete
            let alpha = CAKeyframeAnimation(keyPath:"opacity");alpha.values = frames.map {f -> Float in
                guard f.behind == (index>=2) else {return 0};return index%2 == 0 ? f.blend : (f.previous == nil ? 0 : 1-f.blend)
            };alpha.keyTimes = times
            let group = CAAnimationGroup();group.animations = [motion,art,alpha];group.duration = duration;group.beginTime = layer.convertTime(bee.startTime,from:nil);group.fillMode = .both;group.isRemovedOnCompletion = false
            if index == 0 {let receipt = Receipt();receipt.finish = { [weak self,weak bee] in guard let self,let bee,bee.epoch == token else {return};bee.playing = false;bee.complete = true;bee.elapsed = duration;self.renewIfNeeded()};bee.receipt = receipt;group.delegate = receipt}
            layer.add(group,forKey:"world.bee.flight")
        }
    }
    private func pause(_ bee:Bee) {
        guard bee.playing || bee.preparing || bee.layers.contains(where:{$0.superlayer != nil}) else {return}
        if bee.playing {bee.elapsed = min(bee.plan.duration,max(0,CACurrentMediaTime()-bee.startTime))}
        bee.epoch += 1;bee.playing = false;bee.preparing = false;bee.receipt = nil
        bee.layers.forEach {$0.removeAllAnimations();$0.contents = nil;$0.removeFromSuperlayer()};resources.release(-300-bee.plan.id)
    }
    private func renewIfNeeded() {
        guard enabled,!requesting,let onRequest else {return}
        let ids = bees.values.filter {$0.complete && $0.plan.visualBounds.applying(CGAffineTransform(scaleX:scale,y:scale)).intersects(viewport.insetBy(dx:0,dy:-180*scale))}.map {$0.plan.id}
        guard !ids.isEmpty else {return};requesting = true;let token = epoch
        onRequest(ids) { [weak self] raw in
            guard let self,self.epoch == token else {return};self.requesting = false
            guard let plans = raw?.compactMap(Plan.parse),plans.count == ids.count,Set(plans.map {$0.id}) == Set(ids) else {return}
            for plan in plans {guard let bee = self.bees[plan.id],bee.complete else {continue};bee.plan = plan;bee.elapsed = 0;bee.complete = false;if self.enabled {self.start(bee)}}
        }
    }
    /// Freeze the last sampled authored pose, then retire each visible bee with the canonical 220ms exit.
    func exit() {
        enabled = false
        for bee in bees.values {
            guard bee.layers.contains(where:{$0.superlayer != nil}) else {pause(bee);continue}
            if bee.playing {bee.elapsed = min(bee.plan.duration,max(0,CACurrentMediaTime()-bee.startTime))}
            bee.epoch += 1;bee.playing = false;bee.preparing = false
            let token = bee.epoch
            for (index,layer) in bee.layers.enumerated() {
                let visible = layer.presentation() ?? layer
                let pose = visible.transform,alpha = visible.opacity,art = visible.contents
                layer.removeAllAnimations();layer.transform = pose;layer.opacity = 0;layer.contents = art
                let fade = CABasicAnimation(keyPath:"opacity");fade.fromValue = alpha;fade.toValue = 0;fade.duration = 0.22
                if index == 0 {let receipt = Receipt();receipt.finish = {[weak self,weak bee] in guard let self,let bee,bee.epoch == token else {return};self.pause(bee)};bee.receipt = receipt;fade.delegate = receipt}
                layer.add(fade,forKey:"world.bee.exit")
            }
        }
    }
    func replacePlans(_ plans:[Plan]) {
        let request = onRequest;cleanup();onRequest = request
        for plan in plans {bees[plan.id] = Bee(plan)}
    }
    func cleanup() {epoch += 1;enabled = false;requesting = false;bees.values.forEach(pause);bees.removeAll();onRequest = nil}
}
