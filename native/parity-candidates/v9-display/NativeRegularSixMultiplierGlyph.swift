import UIKit

/// v9 Pixi default Arial, weight800 (installed bold face), white fill and2px
/// brown outline. One raster per mounted badge; no mutable global image cache.
@MainActor
enum NativeRegularSixMultiplierGlyph {
    struct Rendered {let caption:NSAttributedString;let image:UIImage;let contentRect:CGRect}
    static func render(depth:Int,displayScale:CGFloat) throws -> Rendered {
        guard let font=UIFont(name:"Arial-BoldMT",size:33) else {throw FontError.unavailable}
        let caption=NSAttributedString(string:"×\(depth)",attributes:[.font:font,.foregroundColor:UIColor.white,.strokeColor:UIColor(red:143.0/255,green:105.0/255,blue:89.0/255,alpha:1),.strokeWidth:-100.0*2/33])
        let measured=caption.size(),content=CGRect(x:4,y:4,width:ceil(measured.width),height:ceil(measured.height))
        let format=UIGraphicsImageRendererFormat();format.scale=max(1,displayScale);format.opaque=false
        let image=UIGraphicsImageRenderer(size:CGSize(width:content.width+8,height:content.height+8),format:format).image { _ in
            // Canvas/Pixi draws strokeText before fillText. UIKit's combined
            // attributed stroke sits on the fill and makes bold ink thinner.
            caption.draw(at:content.origin)
            let fill=NSMutableAttributedString(attributedString:caption)
            fill.removeAttribute(.strokeWidth,range:NSRange(location:0,length:fill.length))
            fill.removeAttribute(.strokeColor,range:NSRange(location:0,length:fill.length))
            fill.draw(at:content.origin)
        }
        return Rendered(caption:caption,image:image,contentRect:content)
    }
    enum FontError:Error {case unavailable}
}
