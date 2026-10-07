import Foundation

/// Exact source confetti-system.ts birth plans. Seconds replace browser milliseconds.
enum NativeResultCelebrationTheme:String {case area55,forest,beach}
enum NativeResultConfettiPlan {
    static let maximumRuntime=9.8
    struct Area {
        let birth,startX,startY,endX,endY,width,height,radius,rotation:Double
        let color:Int
        func sample(seconds:Double)->Pose {
            let p=(seconds-birth)/3,travel=areaEase(min(1,max(0,p)))
            return Pose(visible:p>=0 && p<1,x:startX+(endX-startX)*travel,y:startY+(endY-startY)*travel,
                opacity:0.9,scale:1,rotation:rotation*travel,skewX:0,imageScaleX:1,imageScaleY:1)
        }
    }
    struct Leaf {let motion:NativeBeeLeafMotion;let width,height:Double;let asset:Int}
    struct Bubble {
        let birth,lifetime,startX,startY,rise,direction,weave,cycles,size,scale,opacity:Double
        let asset:Int
        func sample(seconds:Double)->Pose {
            let age=seconds-birth,p=min(1,max(0,age/lifetime)),enter=min(1,max(0,age/0.12)),exit=p>0.92 ? max(0,(1-p)/0.08):1
            return Pose(visible:age>=0 && age<lifetime,x:startX+direction*weave*sin(p*2*Double.pi*cycles),y:startY-rise*p,
                opacity:opacity*enter*exit,scale:scale*(0.35+(0.5-cos(Double.pi*enter)*0.5)*0.65)*(0.96+p*0.12),rotation:0,skewX:0,imageScaleX:1,imageScaleY:1)
        }
    }
    struct Pose {let visible:Bool;let x,y,opacity,scale,rotation,skewX,imageScaleX,imageScaleY:Double}
    static func area(width:Double,height:Double,random:()->Double)->[Area] {
        var result:[Area]=[];result.reserveCapacity(300)
        let origins:[(Double,Double,Bool)]=[(-width*0.3,Double.pi/4,true),(width*1.3,Double.pi*3/4,false),(width*0.25,Double.pi/2-0.3,true),(width*0.75,Double.pi/2+0.3,false)]
        for burst in 0..<5 {
            let batch=burst==0 ? 0:random()*0.2
            for (start,base,left) in origins {for i in 0..<15 {
                let angle=base+(random()-0.5)*0.25,category=i%3
                let vmin=category==0 ? 120.0:category==1 ? 150:180,vmax=category==0 ? 180.0:category==1 ? 220:280
                let velocity=vmin+random()*(vmax-vmin),strip=i%2==0
                let x=start+(left ? 1:-1)*random()*150,y = -height*0.3+random()*50
                let wiggle=80+random()*120,phase=random()*2*Double.pi
                let endX=x+cos(angle)*velocity*2+sin(phase+1)*wiggle
                let birth=Double(burst)+batch+max(0,random()*3-0.4)
                let w=strip ? 3+random():4+random()*2,h=strip ? 8+random()*7:6+random()*4
                result.append(Area(birth:birth,startX:x,startY:y,endX:endX,endY:y+height*1.3,width:w,height:h,radius:strip ? 2:1,rotation:360+random()*720,color:i%6))
            }}
        }
        return result
    }
    static func forest(width:Double,height:Double,random:()->Double)->[Leaf] {
        func oldBirth(_ i:Int)->Double {let wave=i/3,slot=i%3;return i<12 ? Double(slot)*0.018+Double(wave)*0.028:Double(wave)*(2.9/13)+Double(slot)*0.018}
        func life(_ i:Int)->Double {min(1.18+Double(i%5)*0.09,3.86-oldBirth(i))}
        let lastEnd=(0..<3).map {Double($0)*0.018+life(39+$0)}.max()!,lastStart=maximumRuntime-lastEnd
        let phase=random()*2*Double.pi
        return (0..<42).map {i in
            let wave=i/3,slot=i%3,lifetime=life(i),birth=Double(wave)/13*lastStart+Double(slot)*0.018
            let unit=(sin(Double(i+1)*91.731+phase*13.17)+1)*0.5
            let angle=(Double(i)*2.399963229728653+unit*0.9).truncatingRemainder(dividingBy:Double.pi*2)
            let x=(Double(i)+0.5)/42*width+cos(angle)*(12+Double(i%4)*9)
            let boost=i<12 ? 2.0:i%5==0 ? 1.5:unit>0.78 ? 2:1
            let w=(16+((unit*17+Double(i)*7.31).truncatingRemainder(dividingBy:1)*22).rounded())*boost
            let heightUnit=(sin(Double(i+3)*47.17+phase*5.3)+1)*0.5,h=(14+(heightUnit*28).rounded())*boost
            let y = -h*0.6-Double(slot)*8,scatter=width*(0.476+unit*0.714)
            let vx=cos(angle)*scatter/lifetime,vy=sin(angle)*scatter/lifetime-90-Double(i%3)*18
            let motion=NativeBeeLeafMotion(birth:birth,lifetime:lifetime,birthX:x,birthY:y,velocityX:vx,velocityY:vy,
                gravity:NativeBeeLeafMotion.gravity(viewportHeight:height,birthY:y,velocityY:vy,lifetime:lifetime),flutter:Double(i)*1.73,
                spin:(i%2==1 ? 1:-1)*(260+Double(i%6)*48),scale:i%3 != 0 ? 1.08:0.88,peakOpacity:i%3 != 0 ? 1:0.86)
            return Leaf(motion:motion,width:w,height:h,asset:i%6)
        }
    }
    static func beach(width:Double,height:Double,random:()->Double)->[Bubble] {
        var opacities=(0..<40).map {0.2+(Double($0)+min(1,max(0,random())))/40*0.5}
        for i in stride(from:39,through:1,by:-1) {let other=min(i,Int(floor(min(1,max(0,random()))*Double(i+1))));opacities.swapAt(i,other)}
        let waves=[6,10,7,7,5,5];var wave=0,start=0,result:[Bubble]=[]
        for i in 0..<40 {
            while i>=start+waves[wave] && wave<5 {start += waves[wave];wave += 1}
            let slot=i-start,lane=(Double(slot)+0.12+random()*0.76)/Double(waves[wave]),x=(2+lane*96)/100*width
            let gap=50+random()*50,y=height*(1.03+random()*0.08)+Double(slot%4)*gap
            let size=(18+pow(random(),1.6)*42)*(i>=25 ? 1.08:2.4),rise=y+size*(1.1+random()*1.4)
            let direction=random()<0.5 ? -1.0:1,weave=max(16,width*(0.03+random()*0.09)),cycles=1.35+random()*0.3
            let sampledLife=1.65+random()*0.5,sampledDelay=Double(slot)*(0.045+random()*0.035)
            let lifetime=i==39 ? 2.15:sampledLife,delay=i==39 ? 0.32:sampledDelay
            result.append(Bubble(birth:Double(wave)/5*7.33+delay,lifetime:lifetime,startX:x,startY:y,rise:rise,direction:direction,weave:weave,cycles:cycles,
                size:size,scale:0.75+random()*0.35,opacity:opacities[i]*0.8,asset:i%6))
        }
        return result
    }
    private static let areaSamples=(0...256).map {i in
        let p=Double(i)/256;var lo=0.0,hi=1.0
        for _ in 0..<20 {let t=(lo+hi)/2,x=3*(1-t)*t*t*0.58+t*t*t;if x<p{lo=t}else{hi=t}}
        let t=(lo+hi)/2;return 3*(1-t)*t*t+t*t*t
    }
    private static func areaEase(_ p:Double)->Double {
        let position=p*256,index=Int(floor(position)),next=min(256,index+1)
        return areaSamples[index]+(areaSamples[next]-areaSamples[index])*(position-Double(index))
    }
}
