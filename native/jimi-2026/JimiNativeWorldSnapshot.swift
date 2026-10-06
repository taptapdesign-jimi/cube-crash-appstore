import UIKit

/// Read-only projection of the web Journey owner. No saves or unlock rules live here.
struct JimiNativeWorldSnapshot {
    struct BeamIdle: Equatable {
        let times: [Double]
        let opacities: [Double]
        let duration: Double
        let phase: Double
        init?(_ value: [String:Any]) {
            guard let points = value["points"] as? [[String:Any]], (2...64).contains(points.count),
                  let duration = value["duration"] as? Double, duration.isFinite, duration > 0, duration < 120,
                  let phase = value["phase"] as? Double, phase.isFinite, phase >= 0, phase <= duration else {return nil}
            let times = points.compactMap {$0["time"] as? Double}, opacities = points.compactMap {$0["opacity"] as? Double}
            guard times.count == points.count, opacities.count == points.count,
                  times.first == 0, times.last == duration,
                  times.allSatisfy({$0.isFinite && $0 >= 0 && $0 <= duration}),
                  zip(times.dropFirst(),times).allSatisfy({$0.0 > $0.1}),
                  opacities.allSatisfy({$0.isFinite && (0...1).contains($0)}) else {return nil}
            self.times = times; self.opacities = opacities; self.duration = duration; self.phase = phase
        }
    }
    struct Part: Equatable {
        let asset: String
        let frame: CGRect
        let rotation: CGFloat
        let opacity: CGFloat
        let role: String
        let depth: CGFloat
        let beamIdle: BeamIdle?
        init(_ value: [String: Any]) {
            asset = value["asset"] as? String ?? ""
            frame = Self.rect(value)
            rotation = Self.number(value["rotation"]) * .pi / 180
            opacity = value["opacity"] == nil ? 1 : Self.number(value["opacity"])
            role = value["role"] as? String ?? "art"
            depth = Self.number(value["zIndex"])
            beamIdle = (value["beamIdle"] as? [String:Any]).flatMap {BeamIdle($0)}
        }
        static func number(_ value: Any?) -> CGFloat { (value as? NSNumber).map { CGFloat(truncating: $0) } ?? 0 }
        static func rect(_ value: [String: Any]) -> CGRect {
            CGRect(x: number(value["x"]), y: number(value["y"]), width: number(value["width"]), height: number(value["height"]))
        }
    }
    struct Unit {
        let id: String
        let boardID: Int
        let frame: CGRect
        let cardArt2x: String?
        let cardArt: String
        let locked: Bool
        let cardRarity: String
        let viewed: Bool
        let newRibbon: Bool
        let enterDelayOffset: Double?
        let lockedNumberOffset: CGPoint
        let lockedNumberRotation: CGFloat
        let stars: Int
        let interim: Bool
        let actions: [String]
        let stats: [(String, String)]
        let parts: [Part]
        init(_ value: [String: Any]) {
            boardID = value["boardID"] as? Int ?? 0
            id = value["id"] as? String ?? "board-\(boardID)"
            frame = Part.rect(value["frame"] as? [String: Any] ?? [:])
            cardArt2x = value["cardArt2x"] as? String
            cardArt = value["cardArt"] as? String ?? ""
            locked = value["locked"] as? Bool ?? true
            cardRarity = value["cardRarity"] as? String ?? "common"
            viewed = value["viewed"] as? Bool ?? false
            newRibbon = value["newRibbon"] as? Bool ?? false
            enterDelayOffset = value["enterDelayOffset"] as? Double
            let offset = value["lockedNumberOffset"] as? [String:Any] ?? ["y":32]
            lockedNumberOffset = CGPoint(x:Part.number(offset["x"]),y:Part.number(offset["y"]))
            lockedNumberRotation = Part.number(offset["rotation"]) * .pi / 180
            stars = value["stars"] as? Int ?? 0
            interim = value["interim"] as? Bool ?? false
            actions = value["allowedActions"] as? [String] ?? []
            stats = (value["stats"] as? [[String: Any]] ?? []).map { ($0["label"] as? String ?? "", String(describing: $0["value"] ?? "")) }
            parts = (value["parts"] as? [[String: Any]] ?? []).map {Part($0)}.sorted { $0.depth < $1.depth }
        }
    }
    let requestID: String
    let generation: Int
    let revision: Int
    let worldID: Int
    let returnBoardID: Int?
    let mainFrame: CGRect
    let title: String
    let contentHeight: CGFloat
    let mainParts: [Part]
    let ambientPlans:[JimiNativeWorldAmbient.Plan]
    let ambientSessionID:Int
    let beePlans: [JimiNativeWorldBees.Plan]
    let beeSessionID:Int
    let units: [Unit]
    private static func finite(_ value:Any?) -> Bool {(value as? NSNumber)?.doubleValue.isFinite == true}
    private static func validAsset(_ path:String) -> Bool {
        let normalized = path.hasPrefix("./") ? String(path.dropFirst(2)) : path
        return normalized.hasPrefix("assets/") && !normalized.split(separator:"/").contains("..") && !normalized.contains("\\")
    }
    private static func validRect(_ value:Any?) -> Bool {
        guard let rect = value as? [String:Any] else {return false}
        return ["x","y","width","height"].allSatisfy {finite(rect[$0]) && abs(Part.number(rect[$0])) <= 100000} && Part.number(rect["width"])>0 && Part.number(rect["height"])>0
    }
    private static func validParts(_ value:Any?) -> Bool {
        guard let parts = value as? [[String:Any]] else {return false}
        return parts.allSatisfy { part in
            guard let asset = part["asset"] as? String,validAsset(asset),["x","y","width"].allSatisfy({finite(part[$0])}),Part.number(part["width"])>0 else {return false}
            if let idle = part["beamIdle"] {guard let raw = idle as? [String:Any], BeamIdle(raw) != nil else {return false}}
            return ["height","rotation","opacity","zIndex"].allSatisfy {part[$0] == nil || finite(part[$0])}
        }
    }
    init?(_ value: [String: Any]) {
        guard value["version"] as? Int == 1, let worldID = value["worldID"] as? Int,
              let generation = value["routeGeneration"] as? Int, let revision = value["stateRevision"] as? Int,
              let rawUnits = value["units"] as? [[String: Any]], !rawUnits.isEmpty,
              (1...3).contains(worldID),generation > 0,revision >= 0,
              let request = value["requestID"] as? String,!request.isEmpty,
              Self.validRect(value["mainFrame"]), Self.finite(value["contentHeight"]),
              Self.validParts(value["mainParts"]),
              Set(rawUnits.compactMap {$0["boardID"] as? Int}).count == rawUnits.count,
              Set(rawUnits.compactMap {$0["id"] as? String}).count == rawUnits.count,
              rawUnits.allSatisfy({unit in
                guard let id = unit["id"] as? String,!id.isEmpty,let board = unit["boardID"] as? Int,((worldID-1)*10+1...worldID*10).contains(board), Self.validRect(unit["frame"]),Self.validParts(unit["parts"]) else {return false}
                if let card = unit["cardArt"] as? String,!card.isEmpty,!Self.validAsset(card) {return false}
                if let card = unit["cardArt2x"] as? String,!Self.validAsset(card) {return false}
                if let delay = unit["enterDelayOffset"],!Self.finite(delay) {return false}
                return true
              }) else { return nil }
        let rawAmbient = value["ambientPlans"] as? [[String:Any]] ?? []
        let parsedAmbient = rawAmbient.compactMap {JimiNativeWorldAmbient.Plan.parse($0,worldID:worldID)}
        guard parsedAmbient.count == rawAmbient.count,parsedAmbient.count <= (worldID == 2 ? 8 : worldID == 3 ? 2 : 0),Set(parsedAmbient.map {$0.id}).count == parsedAmbient.count,
              let ambientSession = value["ambientSessionID"] as? Int ?? (parsedAmbient.isEmpty ? 0 : nil),ambientSession >= 0 else {return nil}
        ambientPlans = parsedAmbient;ambientSessionID = ambientSession
        let rawBees = value["beePlans"] as? [[String:Any]] ?? []
        let parsedBees = rawBees.compactMap {JimiNativeWorldBees.Plan.parse($0)}
        guard (worldID == 1 || rawBees.isEmpty), parsedBees.count == rawBees.count,parsedBees.count <= 5,Set(parsedBees.map {$0.id}).count == parsedBees.count else {return nil}
        guard let session = value["beeSessionID"] as? Int ?? (parsedBees.isEmpty ? 0 : nil),session >= 0 else {return nil}
        beeSessionID = session
        beePlans = parsedBees
        self.worldID = worldID; self.generation = generation; self.revision = revision
        requestID = value["requestID"] as? String ?? ""
        returnBoardID = value["returnBoardID"] as? Int
        mainFrame = Part.rect(value["mainFrame"] as? [String: Any] ?? [:])
        title = value["title"] as? String ?? "Forest"
        contentHeight = max(800, Part.number(value["contentHeight"]))
        units = rawUnits.map {Unit($0)}
        mainParts = (value["mainParts"] as? [[String: Any]] ?? []).map {Part($0)}.sorted { $0.depth < $1.depth }
    }
}
