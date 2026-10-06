import UIKit
import CoreText

/// Original, unmodified Web.bundle artwork. Lifetime and preparation belong to
/// the presenting controller; this instance is not a process-global cache.
@MainActor
final class JimiV9Artwork {
    let resourceRoot: URL
    private var images: [String: UIImage] = [:]
    private var fontNames: [String: String] = [:]

    init(resourceRoot: URL) { self.resourceRoot = resourceRoot }

    func image(_ relativePath: String, densityAware: Bool = false) -> UIImage? {
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
        for (candidate, scale) in candidates {
            if let cached = images[candidate.path] { return cached }
            guard let loaded = UIImage(contentsOfFile: candidate.path), let cgImage = loaded.cgImage else { continue }
            let image = UIImage(cgImage: cgImage, scale: scale, orientation: loaded.imageOrientation)
            images[candidate.path] = image
            return image
        }
        NSLog("[JIMI_V9_ARTWORK] Missing image: %@", url.path)
        return nil
    }

    func font(size: CGFloat, weight: String = "Bold") -> UIFont {
        if let name = fontNames[weight], let font = UIFont(name: name, size: size) { return font }
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
