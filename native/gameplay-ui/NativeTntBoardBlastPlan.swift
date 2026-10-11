import CoreGraphics

/// Literal v9 startTntBoardBlast draw order, including delayed wobble draws
/// even when the frame-six return cancels that tween before it starts.
struct NativeTntBoardBlastPlan {
    let rest,blast,wobble:CGPoint
    let returnDuration,returnElastic,blastDuration,wobbleDuration,wobbleElastic:Double
    static func make(rest:CGPoint,center:CGPoint,tileSize:CGFloat,
                     random:()->Double,current:()->Bool)->Self? {
        func draw()->Double? {
            guard current() else{return nil}
            let value=random()
            guard current(),value.isFinite,value>=0,value<1 else{return nil}
            return value
        }
        guard current() else{return nil}
        let dx=rest.x-center.x,dy=rest.y-center.y,distance=hypot(dx,dy)
        let direction:CGPoint
        if distance<1 {
            guard let value=draw() else{return nil}
            let angle=value*2 * .pi
            // SpriteKit reflects Source's downward y axis.
            direction=CGPoint(x:cos(angle),y:-sin(angle))
        } else {direction=CGPoint(x:dx/distance,y:dy/distance)}
        guard let strength=draw() else{return nil}
        let travel=tileSize*0.4*(1+strength*0.3)
        let blast=CGPoint(x:rest.x+direction.x*travel,y:rest.y+direction.y*travel)
        guard let back=draw(),let elastic=draw(),let out=draw(),let amplitude=draw(),
              let duration=draw(),let wobbleElastic=draw(),let x=draw(),let y=draw() else{return nil}
        let wobbleAmplitude=tileSize*(0.03+amplitude*0.05)
        return Self(rest:rest,blast:blast,
            wobble:CGPoint(x:blast.x+(x-0.5)*wobbleAmplitude,y:blast.y-(y-0.5)*wobbleAmplitude),
            returnDuration:0.58+back*0.12,returnElastic:0.14+elastic*0.08,
            blastDuration:0.62+out*0.14,wobbleDuration:0.7+duration*0.5,wobbleElastic:0.35+wobbleElastic*0.2)
    }
}

/// Beach Ball's held Cubero-profile wave is a two-pass recipe: every
/// direction is drawn before any tile's durations. Date sits between the
/// outward duration draws and the three held-return draws.
struct NativeShortWildBoardBlastPlan {
    let rest,blast:CGPoint
    let waveDelay,blastDuration,returnDelay,returnDuration,returnElastic,returnAmplitude:Double
    let returnNotBeforeMilliseconds:Double?
    static func make(rests:[CGPoint],center:CGPoint,tileSize:CGFloat,
                     random:()->Double,dateMilliseconds:()->Double?,current:()->Bool,held:Bool=true)->[Self]? {
        func draw()->Double? {
            guard current() else{return nil};let value=random()
            return current() && value.isFinite && value>=0 && value<1 ? value:nil
        }
        guard current() else{return nil}
        var directions:[CGPoint]=[],distances:[CGFloat]=[],maximum:CGFloat=1
        for rest in rests {
            let dx=rest.x-center.x,dy = -(rest.y-center.y),distance=hypot(dx,dy)
            guard let value=draw() else{return nil}
            let angle=distance<1 ? value*2 * .pi:atan2(dy,dx)+(value-0.5)*0.58
            directions.append(.init(x:cos(angle),y:-sin(angle)));distances.append(distance);maximum=max(maximum,distance)
        }
        var result:[Self]=[]
        for (index,rest) in rests.enumerated() {
            guard let wave=draw(),let strength=draw(),let out=draw(),let unusedReturn=draw() else{return nil}
            // The unheld return duration is still evaluated by the original
            // constructor, even though the external TNT return replaces it.
            let unheldReturn=0.64*(0.9+unusedReturn*0.22)
            let delay=Double(min(1,distances[index]/maximum))*0.26+wave*0.035,duration=0.40*(0.88+out*0.22)
            let back:Double,elastic:Double,amplitude:Double,notBefore:Double?
            if held {
                guard current(),let date=dateMilliseconds(),current(),date.isFinite else{return nil}
                notBefore=date+floor((delay+duration)*1000+0.5)
                guard let returnDraw=draw(),let elasticDraw=draw(),let amplitudeDraw=draw() else{return nil}
                back=0.82+returnDraw*0.10;elastic=0.22+elasticDraw*0.05;amplitude=1.02+amplitudeDraw*0.08
            } else {
                guard let elasticDraw=draw() else{return nil}
                notBefore=nil;back=unheldReturn;elastic=0.30+elasticDraw*0.12;amplitude=1
            }
            let travel=tileSize*0.52*(0.86+strength*0.52),direction=directions[index]
            result.append(.init(rest:rest,blast:.init(x:rest.x+direction.x*travel,y:rest.y+direction.y*travel),
                waveDelay:delay,blastDuration:duration,returnDelay:held ? 0:0.10,returnDuration:back,
                returnElastic:elastic,returnAmplitude:amplitude,returnNotBeforeMilliseconds:notBefore))
        }
        return current() ? result:nil
    }
}
