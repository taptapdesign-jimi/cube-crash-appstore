import UIKit

/// Finite native route owner. No bridge, gameplay decisions or recurring ticker.
@MainActor
final class NativeRouteMotion {
    let home: JimiV9HomeView
    let hub: JimiV9HubView
    private var generation = 0
    private var animatedLayers: [CALayer] = []
    private var baseOpacity: [ObjectIdentifier: Float] = [:]
    private var baseAnchor: [ObjectIdentifier: CGPoint] = [:]
    init(home: JimiV9HomeView, hub: JimiV9HubView) {self.home = home;self.hub = hub}
    func homeTracks(enter: Bool) -> [(UIView, JimiV9Motion.Track)] {
        var parts: [(UIView, JimiV9Motion.Part)] = [(home.heroView, .hero), (home.logoImageView, .logo),
            (home.ctaContainerView, .ctaContainer), (home.ctaView, .cta), (home.navView, .navigation),
            (home.fixedShadowView, .fixedShadow)]
        parts += home.shardViews.map { ($0, .shard) }
        return parts.map { target, part in
            let track = enter ? JimiV9Motion.homeEnter(part) : JimiV9Motion.homeExit(part, reducedMotion: UIAccessibility.isReduceMotionEnabled)
            if !enter, case .hero = part, let painted = target.layer.presentation(),
               target.layer.animation(forKey: "native-route") != nil, let first = track.tweens.first {
                // A tap can interrupt the selected-hero bounce. Retarget from
                // its painted scale, compensating the changed animation pivot.
                let t = painted.transform
                let dx = (track.anchorX-target.layer.anchorPoint.x)*target.bounds.width
                let dy = (track.anchorY-target.layer.anchorPoint.y)*target.bounds.height
                let pose = JimiV9Motion.Pose(scaleX: t.m11, scaleY: t.m22,
                    x: t.m41+dx*(t.m11-1), y: t.m42+dy*(t.m22-1), opacity: Double(painted.opacity))
                let replacement = JimiV9Motion.Tween(begin: first.begin, duration: first.duration,
                    from: pose, to: first.to, ease: first.ease)
                return (target, JimiV9Motion.Track(tweens: [replacement] + track.tweens.dropFirst(), anchorX: track.anchorX, anchorY: track.anchorY))
            }
            return (target, track)
        }
    }

    func hubTracks(enter: Bool, selectedWorldID: Int? = nil) -> [(UIView, JimiV9Motion.Track)] {
        var tracks: [(UIView, JimiV9Motion.Track)] = []
        let reduced = UIAccessibility.isReduceMotionEnabled
        let order = enter ? hub.worldUnits : (selectedWorldID == nil ? hub.worldUnits.shuffled() : Array(hub.worldUnits.reversed()))
        for (i, unit) in order.enumerated() {
            let selected = selectedWorldID != nil && hub.worldUnits.firstIndex(of: unit).map { hub.worldIDs[$0] == selectedWorldID } == true
            if enter {
                tracks.append((unit, .init(tweens: [.init(begin: (reduced ? 0 : 0.08) + Double(i)*(reduced ? 0.02 : 0.09), duration: reduced ? 0.2 : 0.56,
                    from: .scale(reduced ? 0.96 : 0.65, y: reduced ? 8 : 30, opacity: 0), to: .scale(1), ease: reduced ? .powerOut(1) : .backOut(1.8))])))
            } else {
                if reduced && !selected {
                    tracks.append((unit, .init(tweens: [.init(begin: Double(i)*0.012, duration: 0.16, from: .scale(1), to: .scale(0.96, y: 8, opacity: 0), ease: .powerIn(1))])))
                    continue
                }
                let peak = JimiV9Motion.Pose(scaleX: selected ? 1.18 : 1.144, scaleY: selected ? 1.15 : 1.12)
                let delay = selected ? 0 : Double(i)*(selectedWorldID == nil ? 0.045 : 0.065)
                let bounceDuration = reduced ? 0.15 : 0.18
                let collapseDuration = reduced ? 0.28 : 0.336
                tracks.append((unit, .init(tweens: [
                    .init(begin: delay, duration: bounceDuration, from: .scale(1), to: peak, ease: .powerIn(2)),
                    .init(begin: delay+bounceDuration, duration: collapseDuration, from: peak, to: .scale(0), ease: .backIn(1.7))], anchorY: 0.54)))
            }
        }
        if enter {
            tracks.append((hub.header, .init(tweens: [.init(begin: 0, duration: reduced ? 0.2 : 0.56,
                from: .scale(reduced ? 0.96 : 0.65, y: reduced ? 8 : 30, opacity: 0),
                to: .scale(1), ease: reduced ? .powerOut(1) : .backOut(1.8))])))
        } else {
            tracks.append((hub.header, JimiV9Motion.journeyNavigationExit(reducedMotion: reduced)))
        }
        for target in hub.bannerRevealTargets {
            tracks.append((target.view, JimiV9Motion.hubBanner(worldID: target.worldID, enter: enter,
                width: Double(hub.bannerWidth(for: target.worldID)), firstWorldStart: reduced ? 0 : 0.08, reducedMotion: reduced)))
        }
        return tracks
    }

    func animate(_ entries: [(UIView, JimiV9Motion.Track)], completion: @escaping () -> Void) {
        generation += 1; let owner = generation
        // Banners are decorative continuations, not an extra 200ms input gate.
        // Install them outside the route completion transaction, with the same
        // generation and cancellation registry as all other owned layers.
        let bannerIDs = Set(hub.bannerRevealTargets.map { ObjectIdentifier($0.view) })
        let decoration = entries.filter { bannerIDs.contains(ObjectIdentifier($0.0)) }
        let routeEntries = entries.filter { !bannerIDs.contains(ObjectIdentifier($0.0)) }
        CATransaction.begin(); CATransaction.setDisableActions(true)
        installTracks(decoration)
        CATransaction.commit()
        CATransaction.begin()
        CATransaction.setCompletionBlock { [weak self] in
            guard let self, self.generation == owner else { return }
            CATransaction.begin(); CATransaction.setDisableActions(true)
            for (target, _) in routeEntries { self.restoreAnchor(target.layer) }
            CATransaction.commit()
            completion()
        }
        installTracks(routeEntries, holdUntil: routeEntries.map { $0.1.duration }.max())
        CATransaction.commit()
    }

    private func installTracks(_ entries: [(UIView, JimiV9Motion.Track)], holdUntil: Double? = nil) {
        for (target, track) in entries {
            let layer = target.layer
            let key = ObjectIdentifier(layer)
            if baseOpacity[key] == nil { baseOpacity[key] = layer.opacity }
            if baseAnchor[key] == nil { baseAnchor[key] = layer.anchorPoint }
            let alpha = baseOpacity[key] ?? 1
            let oldAnchor = layer.anchorPoint
            layer.position.x += (track.anchorX-oldAnchor.x)*layer.bounds.width
            layer.position.y += (track.anchorY-oldAnchor.y)*layer.bounds.height
            layer.anchorPoint = CGPoint(x: track.anchorX, y: track.anchorY)
            let sampled = JimiV9Motion.sampledTrack(track, holdUntil: holdUntil)
            let poses = sampled.poses
            let transform = CAKeyframeAnimation(keyPath: "transform")
            transform.duration = sampled.duration
            transform.keyTimes = sampled.keyTimes?.map { NSNumber(value: $0) }
            transform.values = poses.map { pose -> NSValue in
                let value = CATransform3DScale(CATransform3DMakeTranslation(pose.x, pose.y, 0), pose.scaleX, pose.scaleY, 1)
                return NSValue(caTransform3D: value)
            }
            let opacity = CAKeyframeAnimation(keyPath: "opacity"); opacity.values = poses.map { $0.opacity * Double(alpha) }
            opacity.duration = sampled.duration
            opacity.keyTimes = sampled.keyTimes?.map { NSNumber(value: $0) }
            let group = CAAnimationGroup(); group.animations = [transform, opacity]; group.duration = sampled.duration
            group.timingFunction = CAMediaTimingFunction(name: .linear)
            CATransaction.setDisableActions(true)
            let final = poses.last!
            layer.transform = CATransform3DScale(CATransform3DMakeTranslation(final.x, final.y, 0), final.scaleX, final.scaleY, 1)
            layer.opacity = Float(final.opacity) * alpha
            layer.add(group, forKey: "native-route")
            if !animatedLayers.contains(where: { $0 === layer }) { animatedLayers.append(layer) }
        }
    }

    private func restoreAnchor(_ layer: CALayer) {
        guard let anchor = baseAnchor[ObjectIdentifier(layer)] else { return }
        layer.position.x += (anchor.x-layer.anchorPoint.x)*layer.bounds.width
        layer.position.y += (anchor.y-layer.anchorPoint.y)*layer.bounds.height
        layer.anchorPoint = anchor
    }
    func suspend() {
        for layer in animatedLayers where layer.speed != 0 {
            let time = layer.convertTime(CACurrentMediaTime(),from:nil)
            layer.speed = 0;layer.timeOffset = time
        }
    }
    func resume() {
        for layer in animatedLayers where layer.speed == 0 {
            let time = layer.timeOffset;layer.speed = 1;layer.timeOffset = 0;layer.beginTime = 0
            layer.beginTime = layer.convertTime(CACurrentMediaTime(),from:nil)-time
        }
    }
    func cancel() {
        generation += 1
        for layer in animatedLayers {
            if let painted = layer.presentation() {layer.transform = painted.transform;layer.opacity = painted.opacity}
            layer.removeAnimation(forKey: "native-route")
            layer.speed = 1;layer.timeOffset = 0;layer.beginTime = 0
            restoreAnchor(layer)
        }
        animatedLayers.removeAll()
    }
}
