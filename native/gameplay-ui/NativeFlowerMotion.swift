import Foundation

/// Port of the authored SVG's three spline tracks, including the original
/// 18-pass spline inversion. Coordinate inversion is done by the node.
enum NativeFlowerMotion {
    static let duration:TimeInterval=1.6
    struct Pose { let translateY: Double; let scaleX: Double; let scaleY: Double; let rotationDegrees: Double }
    private typealias Spline = [Double]
    private static let translateTimes = [0.0,0.15,0.43,0.79,0.87,0.95,1]
    private static let translateValues = [0.0,0,-10,0,-2,0,0]
    private static let translateSplines: [Spline] = [[0.42,0,0.58,1],[0.18,0.65,0.35,1],[0.45,0,0.8,0.4],
        [0.18,0.65,0.35,1],[0.4,0,0.8,0.6],[0.42,0,0.58,1]]
    private static let scaleTimes = [0.0,0.15,0.25,0.39,0.72,0.8,0.89,1]
    private static let scaleX = [1.0,1.08,0.95,1,1,1.065,0.985,1]
    private static let scaleY = [1.0,0.87,1.07,1,1,0.91,1.025,1]
    private static let scaleSplines: [Spline] = [[0.42,0,0.58,1],[0.18,0.65,0.35,1],[0.42,0,0.58,1],
        [0.42,0,0.58,1],[0.42,0,0.58,1],[0.18,0.65,0.35,1],[0.42,0,0.58,1]]
    private static let rotationTimes = [0.0,0.15,0.43,0.69,0.95,1]
    private static let rotations = [0.0,-4,-20,20,0,0]
    private static let rotationSplines: [Spline] = [[0.42,0,0.58,1],[0.18,0.65,0.35,1],[0.42,0,0.58,1],
        [0.25,0.1,0.5,1],[0.42,0,0.58,1]]

    private static func cubic(_ t: Double, _ first: Double, _ second: Double) -> Double {
        let inverse = 1-t
        return 3*inverse*inverse*t*first + 3*inverse*t*t*second + t*t*t
    }
    private static func solve(_ progress: Double, _ spline: Spline) -> Double {
        if progress <= 0 { return 0 }; if progress >= 1 { return 1 }
        var low = 0.0, high = 1.0
        for _ in 0..<18 {
            let middle = (low+high)/2
            if cubic(middle,spline[0],spline[2]) < progress { low = middle } else { high = middle }
        }
        return cubic((low+high)/2,spline[1],spline[3])
    }
    private static func track(_ progress: Double, _ times: [Double], _ values: [Double], _ splines: [Spline]) -> Double {
        if progress <= times[0] { return values[0] }
        if progress >= times[times.count-1] { return values[values.count-1] }
        var index = 0
        while index+1 < times.count && progress > times[index+1] { index += 1 }
        let local = solve((progress-times[index])/(times[index+1]-times[index]),splines[index])
        return values[index]+(values[index+1]-values[index])*local
    }
    static func sample(seconds: TimeInterval) -> Pose {
        let progress = max(0,seconds).truncatingRemainder(dividingBy: duration)/duration
        var index = 0
        while index+1 < scaleTimes.count && progress > scaleTimes[index+1] { index += 1 }
        let local = solve((progress-scaleTimes[index])/(scaleTimes[index+1]-scaleTimes[index]),scaleSplines[index])
        return Pose(translateY: track(progress,translateTimes,translateValues,translateSplines),
            scaleX: scaleX[index]+(scaleX[index+1]-scaleX[index])*local,
            scaleY: scaleY[index]+(scaleY[index+1]-scaleY[index])*local,
            rotationDegrees: track(progress,rotationTimes,rotations,rotationSplines))
    }
}
