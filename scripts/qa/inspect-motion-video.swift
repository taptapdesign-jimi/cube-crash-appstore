import AVFoundation
import AppKit

// Offline inspection only. Video cadence is recorder output, NOT physical FPS.
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let out = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)
let asset = AVURLAsset(url: url)
let track = asset.tracks(withMediaType: .video)[0]
let reader = try AVAssetReader(asset: asset)
let output = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
reader.add(output); reader.startReading()
var times: [Double] = []
while let sample = output.copyNextSampleBuffer() { times.append(CMSampleBufferGetPresentationTimeStamp(sample).seconds) }
let sorted = times.filter { $0.isFinite }.sorted()
guard sorted.count > 1 else { fatalError("No usable video timestamps") }
let gaps = zip(sorted.dropFirst(), sorted).map { ($0 - $1) * 1000 }.sorted()
print("Video frames=\(times.count) invalidPTS=\(times.count-sorted.count) nominalFPS=\(track.nominalFrameRate) duration=\(asset.duration.seconds)")
print("Recorder PTS gap medianMs=\(gaps[gaps.count/2]) worstMs=\(gaps.last!)")
let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero
// Settled/transition thumbnails covering the first complete six-trial block.
for seconds in stride(from: 4.0, through: min(25, asset.duration.seconds - 1), by: 0.5) {
    var actual = CMTime.zero
    let image = try generator.copyCGImage(at: CMTime(seconds: seconds, preferredTimescale: 600), actualTime: &actual)
    let rep = NSBitmapImageRep(cgImage: image)
    try rep.representation(using: .png, properties: [:])!.write(to: out.appendingPathComponent(String(format: "frame-%05.1f.png", seconds)))
}
