import UIKit
import CoreText

/// Shared semantic text colors for Native UI.
enum NativeTextPalette {
    static let subtitle = UIColor(red:189/255,green:151/255,blue:136/255,alpha:1) // #BD9788
}

/// Modal subtitles share Combo's 20pt / 26pt rhythm, including explicit newlines.
enum NativeModalTypography {
    static func subtitleParagraph(fontSize:CGFloat=20,alignment:NSTextAlignment = .center)->NSParagraphStyle {
        let paragraph=NSMutableParagraphStyle()
        paragraph.alignment=alignment
        paragraph.minimumLineHeight=fontSize*1.3
        paragraph.maximumLineHeight=fontSize*1.3
        return paragraph
    }
    static func attributedSubtitle(_ text:String,font:UIFont,alignment:NSTextAlignment = .center)->NSAttributedString {
        NSAttributedString(string:text,attributes:[.font:font,.foregroundColor:NativeTextPalette.subtitle,
            .paragraphStyle:subtitleParagraph(fontSize:font.pointSize,alignment:alignment)])
    }
}

/// Shared rectangular navigation surface; its existing parent owns all motion.
@MainActor
final class JimiV9NavigationHeader: UIView {
    /// Forest's accepted row center, shared by differently sized controls.
    struct RowLayout {
        let top,width:CGFloat
        var centerY:CGFloat {top+26}
        var titleFrame:CGRect {CGRect(x:72,y:centerY-16,width:max(0,width-144),height:32)}
        init(bounds:CGRect,safeAreaTop:CGFloat) {
            width=bounds.width;top=max(0,safeAreaTop+bounds.height*0.02-16)
        }
        func buttonFrame(x:CGFloat,width:CGFloat=44,height:CGFloat=44)->CGRect {
            CGRect(x:x,y:centerY-height/2,width:width,height:height)
        }
    }
    override init(frame:CGRect) {
        super.init(frame:frame)
        clipsToBounds=false
        layer.shadowColor=UIColor(red:185/255,green:145/255,blue:119/255,alpha:1).cgColor
        layer.shadowOpacity=0.16
        layer.shadowRadius=6
        layer.shadowOffset=CGSize(width:0,height:4)
    }
    required init?(coder:NSCoder) {fatalError("Use frame initializer")}
    override func layoutSubviews() {
        super.layoutSubviews()
        layer.shadowPath=UIBezierPath(rect:bounds).cgPath
    }
}

/// Original, unmodified Web.bundle artwork. Lifetime and preparation belong to
/// the presenting controller; this instance is not a process-global cache.
@MainActor
final class JimiV9Artwork {
    let resourceRoot: URL
    private var images: [String: UIImage] = [:]
    private var resolvedImages:[String:UIImage]=[:]
    private var resolvedImagePaths:[String:String]=[:]
    private(set) var preparedBloobSplash:NativeBloobSplashScene?
    private(set) var preparedBloobReverse:NativeBloobReverseArt?
    private var materializedPaths:Set<String>=[]
    private var fontNames: [String: String] = [:]
    private var pendingImages:[String:[(UIImage?)->Void]]=[:]
    private var pendingImageTokens:[String:PreparationLifetime]=[:]
    private(set) var fontDescriptorReadCount=0
    private(set) var imageFileLoadCount=0
    private(set) var preparedImageCount=0
    private let preparationLifetime=PreparationLifetime()
    private let imagePreparationQueue:DispatchQueue
    private let prepareRaster:@Sendable(URL,[String])->NativeSelectedFinaleRaster?
    nonisolated private static let preparationQueue=DispatchQueue(label:"native.selected-finale-ui-raster",qos:.utility)
    nonisolated private final class PreparationLifetime:@unchecked Sendable {
        private let lock=NSLock();private var live=true
        var current:Bool {lock.lock();defer{lock.unlock()};return live}
        func retire(){lock.lock();live=false;lock.unlock()}
    }

    init(resourceRoot:URL,preparationQueue:DispatchQueue?=nil,
         prepareRaster:@escaping @Sendable(URL,[String])->NativeSelectedFinaleRaster? = {NativeSelectedFinaleRaster.decode(root:$0,candidates:$1)}) {
        self.resourceRoot=resourceRoot;imagePreparationQueue=preparationQueue ?? Self.preparationQueue
        self.prepareRaster=prepareRaster
    }

    func image(_ relativePath: String, densityAware: Bool = false) -> UIImage? {
        let requestKey=imageRequestKey(relativePath,densityAware:densityAware)
        if let cached=resolvedImages[requestKey] {return cached}
        let candidates=imageCandidates(relativePath,densityAware:densityAware)
        let url=resourceRoot.appendingPathComponent(relativePath)
        for (candidate, scale) in candidates {
            if let cached=images[candidate.path],let pixels=cached.cgImage {
                let image=cached.scale==scale ? cached:UIImage(cgImage:pixels,scale:scale,orientation:cached.imageOrientation)
                resolvedImages[requestKey]=image;resolvedImagePaths[requestKey]=candidate.path;return image
            }
            guard let loaded = UIImage(contentsOfFile: candidate.path), let cgImage = loaded.cgImage else { continue }
            let image = UIImage(cgImage: cgImage, scale: scale, orientation: loaded.imageOrientation)
            images[candidate.path] = image;resolvedImages[requestKey]=image;resolvedImagePaths[requestKey]=candidate.path;imageFileLoadCount += 1
            return image
        }
        NSLog("[JIMI_V9_ARTWORK] Missing image: %@", url.path)
        return nil
    }

    /// Same density resolution as display; selected preparation never invents
    /// a second bitmap cache or uploads UIKit-only artwork into SpriteKit.
    private func imageRequestKey(_ path:String,densityAware:Bool)->String {
        (densityAware ? "density\(Int(UIScreen.main.scale.rounded(.up))):":"exact:")+path
    }
    private func imageCandidates(_ relativePath:String,densityAware:Bool)->[(URL,CGFloat)] {
        let path = relativePath.hasPrefix("./") ? String(relativePath.dropFirst(2)) : relativePath
        let url = resourceRoot.appendingPathComponent(path)
        let density = min(3, max(1, Int(UIScreen.main.scale.rounded(.up))))
        var candidates: [(URL, CGFloat)] = []
        if densityAware, density > 1 {
            for scale in stride(from: density, through: 2, by: -1) {
                let name = url.deletingPathExtension().lastPathComponent + "@\(scale)x." + url.pathExtension
                candidates.append((url.deletingLastPathComponent().appendingPathComponent(name), CGFloat(scale)))
            }
        }
        candidates.append((url, 1))
        return candidates
    }
    /// One serial resource queue materializes the selected original PNG pixels.
    /// UIImage construction/cache mutation remain MainActor. Duplicate callers
    /// share a pending request, and retirement cancels all queued publication.
    func prepareImage(_ path:String,densityAware:Bool,completion:@escaping(UIImage?)->Void) {
        guard preparationLifetime.current else{completion(nil);return}
        let key=imageRequestKey(path,densityAware:densityAware)
        // Only this exact request's resolved preferred density is reusable.
        // A lower-density cached candidate cannot skip a real higher file.
        if let image=resolvedImages[key],let resolvedPath=resolvedImagePaths[key],materializedPaths.contains(resolvedPath) {completion(image);return}
        let candidates=imageCandidates(path,densityAware:densityAware)
        if pendingImages[key] != nil {pendingImages[key]?.append(completion);return}
        let requestLifetime=PreparationLifetime()
        pendingImageTokens[key]=requestLifetime;pendingImages[key]=[completion]
        let root=resourceRoot,relative=candidates.map{$0.0.path.replacingOccurrences(of:root.path+"/",with:"")}
        let scales=candidates.map{$0.1},lifetime=preparationLifetime,decode=prepareRaster
        imagePreparationQueue.async { [weak self] in
            guard self != nil,lifetime.current,requestLifetime.current else{return}
            let raster=decode(root,relative)
            guard lifetime.current,requestLifetime.current else{return}
            DispatchQueue.main.async {
                guard let self,lifetime.current,requestLifetime.current,
                      self.pendingImageTokens[key] === requestLifetime,
                      let callbacks=self.pendingImages.removeValue(forKey:key) else{return}
                self.pendingImageTokens.removeValue(forKey:key)
                let image:UIImage?
                if let raster,let index=relative.firstIndex(of:raster.path) {
                    let absolute=root.appendingPathComponent(raster.path).path
                    let prepared=UIImage(cgImage:raster.image,scale:scales[index],orientation:.up)
                    // Exact @2x/@3x display uses scale1; density-aware
                    // display can share those pixels with scale2/3. Preserve
                    // each request's authored logical size when replacing an
                    // encoded alias with its materialized bitmap backing.
                    for alias in self.resolvedImagePaths.keys where self.resolvedImagePaths[alias]==absolute {
                        guard let existing=self.resolvedImages[alias] else{continue}
                        self.resolvedImages[alias]=UIImage(cgImage:raster.image,scale:existing.scale,orientation:existing.imageOrientation)
                    }
                    self.images[absolute]=prepared;self.resolvedImages[key]=prepared;self.resolvedImagePaths[key]=absolute;self.materializedPaths.insert(absolute)
                    if let reverse=raster.bloobReverse {self.preparedBloobReverse=reverse}
                    if let scene=raster.bloobSplash {self.preparedBloobSplash=scene}
                    self.preparedImageCount += 1;image=prepared
                } else {image=nil}
                for callback in callbacks {guard lifetime.current else{break};callback(image)}
            }
        }
    }
    func retainPreparedImages(_ requests:[(String,Bool)]) {
        if !requests.contains(where:{$0.0==NativeBloobReverseArt.path}) {preparedBloobReverse=nil}
        if !requests.contains(where:{$0.0==NativeBloobArt.splashPath}) {preparedBloobSplash=nil}
        let keys=Set(requests.map{imageRequestKey($0.0,densityAware:$0.1)})
        // Exact live/active families retain bitmap aliases. Dropped queued
        // requests cannot publish after their pending registry row retires.
        resolvedImages=resolvedImages.filter{keys.contains($0.key)}
        resolvedImagePaths=resolvedImagePaths.filter{keys.contains($0.key)}
        for (key,token) in pendingImageTokens where !keys.contains(key) {token.retire()}
        pendingImageTokens=pendingImageTokens.filter{keys.contains($0.key)}
        pendingImages=pendingImages.filter{keys.contains($0.key)}
        let retained=Set(resolvedImagePaths.values)
        images=images.filter{retained.contains($0.key)}
        materializedPaths.formIntersection(Set(images.keys))
    }
    func cancelPendingImagePreparation() {
        for token in pendingImageTokens.values {token.retire()}
        pendingImageTokens.removeAll();pendingImages.removeAll()
    }
    func retireImagePreparation() {
        preparedBloobSplash=nil;preparedBloobReverse=nil
        preparationLifetime.retire();let callbacks=pendingImages.values.flatMap{$0}
        cancelPendingImagePreparation()
        pendingImages.removeAll();images.removeAll();resolvedImages.removeAll();resolvedImagePaths.removeAll();materializedPaths.removeAll()
        callbacks.forEach{$0(nil)}
    }

    func font(size: CGFloat, weight: String = "Bold") -> UIFont {
        if let name = fontNames[weight], let font = UIFont(name: name, size: size) { return font }
        fontDescriptorReadCount+=1
        let url = resourceRoot.appendingPathComponent("assets/fonts/Baloo2-\(weight).ttf")
        if let descriptors = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor],
           let descriptor = descriptors.first,
           let name = CTFontDescriptorCopyAttribute(descriptor, kCTFontNameAttribute) as? String {
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            fontNames[weight] = name
            if let font = UIFont(name: name, size: size) { return font }
        }
        // Missing packaged font is observable; never silently claim parity.
        NSLog("[JIMI_V9_ARTWORK] Missing Baloo2 font: %@", url.path)
        return .systemFont(ofSize: size, weight: .bold)
    }
}
