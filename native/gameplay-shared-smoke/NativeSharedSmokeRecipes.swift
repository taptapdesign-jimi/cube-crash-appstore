import Foundation

/// PRIVATE recipes copied from immutable v9 caller options. The caller chooses
/// the source callsite; a visual callback cannot infer/select gameplay rules.
enum NativeSharedSmokeRecipes {
    enum ImpactProfile{case ordinary,beachBall,laserGun}
    static func regularStack(tileDepth:Double,reduced:Bool)->NativeSharedSmokeRecipe{
        var r=NativeSharedSmokeRecipe();r.tileDepth=tileDepth;r.strength=0.72;r.behind=true
        r.colors=[0xffffff];r.blendMode="normal";r.spawnShape="edges"
        r.baseAlpha=reduced ? 0.62:0.72;r.trailAlpha=reduced ? 0.7:0.82
        r.sizeScale=reduced ? 1:1.1;r.sizeBoostChance=reduced ? 0.18:0.26;r.sizeBoostScale=reduced ? 1.2:1.3
        r.distanceScale=reduced ? 0.92:1.04;r.countScale=reduced ? 0.42:0.56;r.durationScale=reduced ? 0.72:0.84
        r.bursts=3;r.burstGap=0.022;r.ttl=0.55;r.haloAlpha=0.28;r.haloScale=0.72;r.fxTag="stack-smoke"
        return r
    }
    static func regularSix(tileDepth:Double,reduced:Bool)->NativeSharedSmokeRecipe{
        var r=NativeSharedSmokeRecipe();r.tileDepth=tileDepth;r.strength=1.3
        r.activityLeaseLabel="regular-merge6-smoke";r.spawnShape="organic-radial"
        r.sizeBoostChance=0.2;r.sizeBoostScale=1.3;r.durationScale=0.9
        r.sizeScale=reduced ? 1.25:1.36;r.distanceScale=reduced ? 1.08:1.2;r.countScale=reduced ? 0.72:0.9
        r.ellipseChance=0.62;r.ellipseAspectMin=0.58;r.ellipseAspectMax=1.42
        r.baseAlpha=1;r.trailAlpha=1;r.cloudAlphaProfile=true;r.blendMode="normal"
        return r
    }
    /// Caller executes these two authored option draws before entering helper.
    /// Core-TNT caller must skip this entire recipe, including its two draws.
    static func specialMain(tileDepth:Double,magnet:Bool,random:()->Double)->NativeSharedSmokeRecipe{
        var r=NativeSharedSmokeRecipe();r.tileDepth=tileDepth;r.tileSize=128*1.3;r.strength=magnet ? 0.6:3
        r.activityLeaseLabel="special-merge6-smoke"
        r.sizeScale=0.8+random()*0.25;r.countScale=0.75+random()*0.3
        r.distanceScale=0.55;r.trailAlpha=0.92;r.maxParticles=magnet ? 36:72;r.groupedOwner=true;r.deferFutureBursts=true
        return r
    }
    static func alternateWild(tileDepth:Double)->NativeSharedSmokeRecipe{
        var r=NativeSharedSmokeRecipe();r.tileDepth=tileDepth;r.tileSize=128*1.2;r.strength=2.6
        r.maxParticles=72;r.groupedOwner=true;r.deferFutureBursts=true;return r
    }
    static func laserPrimary(tileDepth:Double)->NativeSharedSmokeRecipe{
        var r=NativeSharedSmokeRecipe();r.tileDepth=tileDepth;r.strength=1.3;r.activityLeaseLabel="laser-gun-merge6-smoke"
        r.sizeScale=1.15;r.countScale=0.55;r.distanceScale=0.65;r.trailAlpha=0.92;r.maxParticles=36;r.groupedOwner=true;r.deferFutureBursts=true;return r
    }
    static func targetImpact(tileDepth:Double,profile:ImpactProfile)->NativeSharedSmokeRecipe{
        var r=NativeSharedSmokeRecipe();r.tileDepth=tileDepth;r.zIndex=9994
        switch profile{
        case .ordinary:r.sizeScale=1.5
        case .beachBall:r.strength=1.25;r.sizeScale=1.9;r.distanceScale=1.35;r.countScale=1.15;r.groupedOwner=true
        case .laserGun:r.strength=0.62;r.sizeScale=1.15;r.countScale=0.28
        }
        return r
    }
    static func wildMeterLanding(tileDepth:Double)->NativeSharedSmokeRecipe{
        var r=NativeSharedSmokeRecipe();r.tileDepth=tileDepth;r.tileSize=128*1.05;r.strength=1.35;r.behind=true
        r.fxTag="wild-spawn-drop-smoke";r.sizeScale=1.35;r.ttl=1.15;r.blendMode="normal"
        r.baseAlpha=0.85;r.trailAlpha=0.7;r.cloudAlphaProfile=true;r.fadeInDuration=0.12;r.fadeInEase="sine.out";r.durationScale=1.35;r.groupedOwner=true;return r
    }
    static func regularIdle(tileDepth:Double)->NativeSharedSmokeRecipe{
        var r=NativeSharedSmokeRecipe();r.tileDepth=tileDepth;r.strength=1.1;r.behind=true;r.baseAlpha=0.58
        r.sizeScale=1.1;r.distanceScale=0.75;r.countScale=1.04;r.ttl=0.28;r.durationScale=0.84;r.fxTag="tile-idle-smoke";r.groupedOwner=true;return r
    }
}
