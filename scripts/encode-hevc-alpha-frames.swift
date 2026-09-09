#!/usr/bin/env swift

import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation
import ImageIO
import VideoToolbox

struct Arguments {
    let inputDirectory: URL
    let outputURL: URL
    let width: Int
    let height: Int
    let frameCount: Int
    let sourceStride: Int
    let outputDurationMilliseconds: Int64
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("\(message)\n".utf8))
    exit(1)
}

func parseArguments() -> Arguments {
    let values = Array(CommandLine.arguments.dropFirst())
    guard values.count == 7 else {
        fail("Usage: encode-hevc-alpha-frames.swift <input-dir> <output.mov> <width> <height> <frame-count> <source-stride> <output-duration-ms>")
    }

    guard
        let width = Int(values[2]), width > 0,
        let height = Int(values[3]), height > 0,
        let frameCount = Int(values[4]), frameCount > 0,
        let sourceStride = Int(values[5]), sourceStride > 0,
        let outputDurationMilliseconds = Int64(values[6]), outputDurationMilliseconds > 0
    else {
        fail("Width, height, frame-count, source-stride and frame-duration-ms must be positive integers.")
    }

    return Arguments(
        inputDirectory: URL(fileURLWithPath: values[0], isDirectory: true),
        outputURL: URL(fileURLWithPath: values[1]),
        width: width,
        height: height,
        frameCount: frameCount,
        sourceStride: sourceStride,
        outputDurationMilliseconds: outputDurationMilliseconds
    )
}

func loadImage(at url: URL) -> CGImage {
    guard
        let source = CGImageSourceCreateWithURL(url as CFURL, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        fail("Could not decode PNG frame: \(url.path)")
    }
    return image
}

func makePixelBuffer(from image: CGImage, width: Int, height: Int, pool: CVPixelBufferPool) -> CVPixelBuffer {
    var optionalBuffer: CVPixelBuffer?
    let result = CVPixelBufferPoolCreatePixelBuffer(nil, pool, &optionalBuffer)
    guard result == kCVReturnSuccess, let pixelBuffer = optionalBuffer else {
        fail("Could not allocate a video pixel buffer (CoreVideo error \(result)).")
    }

    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    defer { CVPixelBufferUnlockBaseAddress(pixelBuffer, []) }

    guard
        let baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer),
        let context = CGContext(
            data: baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue |
                CGImageAlphaInfo.premultipliedFirst.rawValue
        )
    else {
        fail("Could not create the transparent BGRA frame context.")
    }

    context.clear(CGRect(x: 0, y: 0, width: width, height: height))
    context.interpolationQuality = .high
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    return pixelBuffer
}

let arguments = parseArguments()

guard !FileManager.default.fileExists(atPath: arguments.outputURL.path) else {
    fail("Output already exists: \(arguments.outputURL.path)")
}

let writer: AVAssetWriter
do {
    writer = try AVAssetWriter(outputURL: arguments.outputURL, fileType: .mov)
} catch {
    fail("Could not create AVAssetWriter: \(error)")
}

let compressionProperties: [String: Any] = [
    AVVideoAverageBitRateKey: 6_000_000,
    AVVideoExpectedSourceFrameRateKey: 30,
    AVVideoMaxKeyFrameIntervalKey: arguments.frameCount,
    AVVideoAllowFrameReorderingKey: false,
    kVTCompressionPropertyKey_TargetQualityForAlpha as String: 1.0,
]
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.hevcWithAlpha,
    AVVideoWidthKey: arguments.width,
    AVVideoHeightKey: arguments.height,
    AVVideoCompressionPropertiesKey: compressionProperties,
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false

let pixelBufferAttributes: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: arguments.width,
    kCVPixelBufferHeightKey as String: arguments.height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
]
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: pixelBufferAttributes
)

guard writer.canAdd(input) else {
    fail("AVAssetWriter rejected the HEVC-with-alpha video input.")
}
writer.add(input)

guard writer.startWriting() else {
    fail("HEVC-with-alpha writer could not start: \(writer.error?.localizedDescription ?? "unknown error")")
}
writer.startSession(atSourceTime: .zero)

guard let pool = adaptor.pixelBufferPool else {
    fail("HEVC-with-alpha writer did not create a pixel-buffer pool.")
}

for outputIndex in 0..<arguments.frameCount {
    while !input.isReadyForMoreMediaData {
        Thread.sleep(forTimeInterval: 0.001)
        if writer.status == .failed {
            fail("HEVC-with-alpha writer failed while waiting: \(writer.error?.localizedDescription ?? "unknown error")")
        }
    }

    let sourceIndex = outputIndex * arguments.sourceStride
    let frameName = String(format: "frame-%04d.png", sourceIndex)
    let frameURL = arguments.inputDirectory.appendingPathComponent(frameName)
    let image = loadImage(at: frameURL)
    let pixelBuffer = makePixelBuffer(
        from: image,
        width: arguments.width,
        height: arguments.height,
        pool: pool
    )
    let presentationMilliseconds = (
        Int64(outputIndex) * arguments.outputDurationMilliseconds + Int64(arguments.frameCount / 2)
    ) / Int64(arguments.frameCount)
    let presentationTime = CMTime(value: presentationMilliseconds, timescale: 1_000)
    guard adaptor.append(pixelBuffer, withPresentationTime: presentationTime) else {
        fail("Could not append frame \(outputIndex): \(writer.error?.localizedDescription ?? "unknown error")")
    }
}

let duration = CMTime(value: arguments.outputDurationMilliseconds, timescale: 1_000)
input.markAsFinished()
writer.endSession(atSourceTime: duration)

let completion = DispatchSemaphore(value: 0)
writer.finishWriting { completion.signal() }
completion.wait()

guard writer.status == .completed else {
    fail("HEVC-with-alpha writer did not finish: \(writer.error?.localizedDescription ?? "unknown error")")
}

let result: [String: Any] = [
    "output": arguments.outputURL.path,
    "width": arguments.width,
    "height": arguments.height,
    "frames": arguments.frameCount,
    "sourceStride": arguments.sourceStride,
    "durationMilliseconds": arguments.outputDurationMilliseconds,
]
let data = try JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
print(String(decoding: data, as: UTF8.self))
