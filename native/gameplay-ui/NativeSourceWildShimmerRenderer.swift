import SpriteKit

/// Scene-scoped runtime gradient leases, never an original artwork rewrite.
@MainActor final class NativeSourceWildShimmerGradientCache {
    final class Handle {
        let texture:SKTexture,width:Int,height:Int
        fileprivate let id:String
        fileprivate weak var cache:NativeSourceWildShimmerGradientCache?
        fileprivate var released=false
        fileprivate init(texture:SKTexture,width:Int,height:Int,id:String,cache:NativeSourceWildShimmerGradientCache){
            self.texture=texture;self.width=width;self.height=height;self.id=id;self.cache=cache
        }
        var current:Bool{!released && cache?.isCurrent(id,texture:texture)==true}
        func release(){guard !released else{return};released=true;cache?.release(id)}
    }
    private struct Entry {let texture:SKTexture;var references:Int}
    private var entries:[String:Entry]=[:],order:[String]=[],disposed=false
    var count:Int{entries.count}
    var references:Int{entries.values.reduce(0){$0+$1.references}}
    static func alpha(at x:Double)->Double {
        let stops:[(Double,Double)]=[(0,0),(0.2,0),(0.4,0.6),(0.5,0.9),(0.6,0.6),(0.8,0),(1,0)]
        for i in 1..<stops.count where x<=stops[i].0 {
            let a=stops[i-1],b=stops[i]
            return a.1+(b.1-a.1)*max(0,min(1,(x-a.0)/(b.0-a.0)))
        }
        return 0
    }
    func acquire(width:Double,height:Double)->Handle? {
        guard !disposed,width.isFinite,height.isFinite,width>0,height>0,width<=1024,height<=1024 else{return nil}
        let w=max(2,Int(ceil(width))),h=max(2,Int(ceil(height))),key="\(w)x\(h)"
        if entries[key]==nil {
            var bytes=[UInt8](repeating:0,count:w*h*4)
            for x in 0..<w {
                let a=UInt8((Self.alpha(at:(Double(x)+0.5)/Double(w))*255).rounded())
                for y in 0..<h {let i=(y*w+x)*4;bytes[i]=a;bytes[i+1]=a;bytes[i+2]=a;bytes[i+3]=a}
            }
            let texture=SKTexture(data:Data(bytes),size:CGSize(width:w,height:h));texture.filteringMode = .linear
            entries[key] = .init(texture:texture,references:0)
        }
        entries[key]!.references+=1;order.removeAll{$0==key};order.append(key);prune()
        return .init(texture:entries[key]!.texture,width:w,height:h,id:key,cache:self)
    }
    private func isCurrent(_ key:String,texture:SKTexture)->Bool{!disposed && entries[key]?.texture === texture}
    private func release(_ key:String){guard var e=entries[key],e.references>0 else{return};e.references-=1;entries[key]=e;prune()}
    private func prune(){
        for key in order where entries.count>4 && entries[key]?.references==0 {entries.removeValue(forKey:key)}
        order.removeAll{entries[$0]==nil}
    }
    func dispose(){guard !disposed else{return};disposed=true;entries.removeAll();order.removeAll()}
}

/// A fixed captured Source base mask. SpriteKit reflects Source y-down exactly
/// once. Shader retains Pixi's red*alpha mask equation rather than binary crop.
@MainActor final class NativeSourceWildShimmerRenderer {
    let sprite:SKSpriteNode
    private var gradient:NativeSourceWildShimmerGradientCache.Handle?
    private let pose:SKUniform,opacity:SKUniform,maskPosition:SKUniform,maskRotation:SKUniform
    private var disposed=false
    var current:Bool{!disposed && gradient?.current==true && sprite.parent != nil}
    static func maskClamp(pixelSize:CGSize,logicalWidth:CGFloat)->SIMD4<Float>? {
        guard pixelSize.width>0,pixelSize.height>0,pixelSize.width.isFinite,pixelSize.height.isFinite,
              logicalWidth>0,logicalWidth.isFinite else{return nil}
        let margin:CGFloat=logicalWidth<10 ? 0:0.5
        let x=Float(margin/pixelSize.width),y=Float(margin/pixelSize.height)
        return SIMD4<Float>(x,y,Float(1-margin/pixelSize.width),Float(1-margin/pixelSize.height))
    }
    static let shaderSource="""
    void main() {
        vec2 p=(v_tex_coord-u_anchor)*u_size;
        p.y=-p.y;
        // Mask-local artwork coordinates must enter the parent's Source
        // coordinates before sampling its independently rotated gradient.
        float mr=u_mask_rotation;
        p=vec2(cos(mr)*p.x-sin(mr)*p.y,sin(mr)*p.x+cos(mr)*p.y)+u_mask_position;
        vec2 d=p-u_sweep;
        float c=0.7071067811865476;
        vec2 q=vec2(c*(d.x+d.y),c*(-d.x+d.y));
        vec2 uv=q/u_gradient_size+vec2(0.5);
        float clip=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
        vec4 original=texture2D(u_gradient,uv);
        vec4 masky=texture2D(u_texture,v_tex_coord);
        float maskClip=step(u_mask_clamp.x,v_tex_coord.x)*step(u_mask_clamp.y,v_tex_coord.y)
            *step(v_tex_coord.x,u_mask_clamp.z)*step(v_tex_coord.y,u_mask_clamp.w);
        // Installed Pixi MaskFilter keeps uAlpha=1 for this Sprite mask.
        float alphaMul=1.0-u_mask_alpha*(1.0-masky.a);
        gl_FragColor=original*(alphaMul*masky.r*u_mask_alpha*clip*maskClip*u_opacity)*v_color_mix.a;
    }
    """
    init?(texture:SKTexture,size:CGSize,anchor:CGPoint,pixelSize:CGSize?=nil,logicalMaskWidth:CGFloat?=nil,
          cache:NativeSourceWildShimmerGradientCache){
        guard size.width>0,size.height>0,size.width.isFinite,size.height.isFinite,
              let clamp=Self.maskClamp(pixelSize:pixelSize ?? texture.size(),logicalWidth:logicalMaskWidth ?? (pixelSize ?? texture.size()).width),
              let handle=cache.acquire(width:max(64,Double(size.width))*2,height:max(64,Double(size.height))*2) else{return nil}
        gradient=handle
        sprite=SKSpriteNode(texture:texture,size:size);sprite.anchorPoint=anchor
        sprite.name="source-wild-shimmer-mask";sprite.isUserInteractionEnabled=false
        pose=SKUniform(name:"u_sweep",vectorFloat2:SIMD2<Float>(-Float(max(64,size.width)) * 0.8,-Float(max(64,size.height)) * 0.8))
        opacity=SKUniform(name:"u_opacity",float:0)
        maskPosition=SKUniform(name:"u_mask_position",vectorFloat2:SIMD2<Float>(0,0))
        maskRotation=SKUniform(name:"u_mask_rotation",float:0)
        sprite.shader=SKShader(source:Self.shaderSource,uniforms:[pose,opacity,maskPosition,maskRotation,SKUniform(name:"u_mask_clamp",vectorFloat4:clamp),
            SKUniform(name:"u_size",vectorFloat2:SIMD2<Float>(Float(size.width),Float(size.height))),
            SKUniform(name:"u_anchor",vectorFloat2:SIMD2<Float>(Float(anchor.x),Float(anchor.y))),
            SKUniform(name:"u_gradient_size",vectorFloat2:SIMD2<Float>(Float(max(64,size.width)*2),Float(max(64,size.height)*2))),
            SKUniform(name:"u_gradient",texture:handle.texture),SKUniform(name:"u_mask_alpha",float:1)])
    }
    func paint(_ p:NativeSourceWildShimmerMotion.Pose){
        guard !disposed else{return}
        guard gradient?.current==true else{dispose();return}
        pose.vectorFloat2Value=SIMD2<Float>(Float(p.x),Float(p.y));opacity.floatValue=Float(p.alpha)
    }
    func mount(in host:SKNode,position:CGPoint,rotation:CGFloat,zPosition:CGFloat){
        guard !disposed,sprite.parent==nil else{return}
        guard gradient?.current==true else{dispose();return}
        maskPosition.vectorFloat2Value=SIMD2<Float>(Float(position.x),-Float(position.y))
        maskRotation.floatValue = -Float(rotation)
        sprite.position=position;sprite.zRotation=rotation;sprite.zPosition=zPosition;host.addChild(sprite)
    }
    func dispose(){
        guard !disposed else{return};disposed=true;sprite.removeFromParent();sprite.shader=nil;sprite.texture=nil
        gradient?.release();gradient=nil
    }
    isolated deinit{dispose()}
}
