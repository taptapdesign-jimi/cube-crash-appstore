import Foundation
import CoreGraphics
import ImageIO

/// Selected-generation original SVG pixels/SMIL, without WebKit or generated assets.
nonisolated struct NativeBaloonResources: @unchecked Sendable {
    struct Track: Sendable {
        let times: [Double], values: [[Double]], discrete: Bool
        func sample(_ unit: Double) -> [Double] {
            let u = min(1, max(0, unit))
            var i = 0
            while i + 1 < times.count && times[i + 1] <= u { i += 1 }
            if discrete || i == times.count - 1 { return values[i] }
            let t = (u - times[i]) / (times[i + 1] - times[i])
            return zip(values[i], values[i + 1]).map { $0 + ($1 - $0) * t }
        }
    }
    let frames: [CGImage], translation: Track, rotation: Track, scale: Track, cells: Track
    let duration: Double
    static let source = "assets/shop/baloon/blue baloon pop.svg"
    static func load(root: URL) throws -> Self {
        try Task.checkCancellation()
        let data = try Data(contentsOf: root.appendingPathComponent(source))
        let metadata = NativeBaloonSVGMetadata(), parser = XMLParser(data: data)
        parser.delegate = metadata
        guard parser.parse(), let translation = metadata.translation, let rotation = metadata.rotation,
              let scale = metadata.scale, let cells = metadata.cells,
              let uri = metadata.image, let comma = uri.firstIndex(of: ","),
              let bytes = Data(base64Encoded: String(uri[uri.index(after: comma)...])) else { throw CocoaError(.fileReadCorruptFile) }
        try Task.checkCancellation()
        guard let atlas = Self.decodedAtlas(bytes) else {throw CocoaError(.fileReadCorruptFile)}
        var frames: [CGImage] = []
        for index in 0..<32 {
            try Task.checkCancellation()
            guard let frame = atlas.cropping(to: CGRect(x: (index % 6) * 320, y: (index / 6) * 320, width: 320, height: 320)) else { throw CocoaError(.fileReadCorruptFile) }
            // Materialize pixels during cancellable preparation, rather than
            // asking CoreAnimation to decode/crop a new image during flight.
            guard let context=CGContext(data:nil,width:320,height:320,bitsPerComponent:8,bytesPerRow:320*4,
                space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else {throw CocoaError(.fileReadCorruptFile)}
            context.draw(frame,in:CGRect(x:0,y:0,width:320,height:320))
            guard let pixels=context.makeImage() else {throw CocoaError(.fileReadCorruptFile)}
            frames.append(pixels)
        }
        return Self(frames: frames, translation: translation, rotation: rotation, scale: scale, cells: cells, duration: metadata.duration)
    }
    private static func decodedAtlas(_ bytes:Data)->CGImage? {
        guard let source=CGImageSourceCreateWithData(bytes as CFData,nil),
              let encoded=CGImageSourceCreateImageAtIndex(source,0,nil),encoded.width==1920,encoded.height==1920,
              let context=CGContext(data:nil,width:1920,height:1920,bitsPerComponent:8,bytesPerRow:1920*4,
                space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue) else{return nil}
        // Decode the WebP once. Cropping the encoded provider and drawing each
        // cell separately would repeatedly invoke ImageIO for the same atlas.
        context.draw(encoded,in:CGRect(x:0,y:0,width:1920,height:1920))
        return context.makeImage()
    }
}

private nonisolated final class NativeBaloonSVGMetadata: NSObject, XMLParserDelegate {
    var image: String?, translation: NativeBaloonResources.Track?, rotation: NativeBaloonResources.Track?, scale: NativeBaloonResources.Track?, cells: NativeBaloonResources.Track?
    var duration = 0.0
    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?, attributes a: [String: String]) {
        if name == "image" { image = a["xlink:href"] ?? a["href"] }
        guard name == "animateTransform", a["dur"] == "1.0200413s", let text = a["values"], let keys = a["keyTimes"], let type = a["type"] else { return }
        let values = text.split(separator: ";").map { $0.split(whereSeparator: { $0 == " " || $0 == "," }).compactMap { Double($0) } }
        let times = keys.split(separator: ";").compactMap { Double($0) }
        guard times.count >= 2, values.count == times.count, times.first == 0, times.last == 1,
              zip(times, times.dropFirst()).allSatisfy({ $0 < $1 }),
              values.allSatisfy({ $0.count == (type == "rotate" ? 1 : 2) }) else { parser.abortParsing(); return }
        let track = NativeBaloonResources.Track(times: times, values: values, discrete: a["calcMode"] == "discrete")
        if track.discrete { cells = track }
        else if type == "translate" { translation = track }
        else if type == "rotate" { rotation = track }
        else if type == "scale" { scale = track }
        duration = Double((a["dur"] ?? "").dropLast()) ?? 0
    }
}
