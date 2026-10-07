import Foundation

/// Build-time geometry comes from the canonical authored TS specification, not screenshots.
/// Runtime player state, viewport corrections and independent beam timelines are native-owned.
public final class NativeWorldLayouts {
    private let viewports: [String: [[String: Any]]]
    private var planners: [Int:NativeWorldPlanning] = [:]
    private var beePlanner:NativeForestBeePlanning?
    public init(data: Data? = nil) throws {
        let source: Data
        if let data { source = data }
        else {
            guard let url = Bundle.module.url(forResource:"NativeWorldLayouts",withExtension:"json") else { throw NativeSaveError.invalidState(["missing-authored-world-layout"]) }
            source = try Data(contentsOf:url)
        }
        guard let object = try JSONSerialization.jsonObject(with:source) as? [String:Any], let projections = object["viewports"] as? [String:[[String:Any]]], projections["390"]?.count == 3, projections["768"]?.count == 3 else { throw NativeSaveError.invalidState(["invalid-authored-world-layout"]) }
        viewports=projections
    }
    public func snapshot(world: Int, width: Double, height: Double, generation: Int, revision: Int = 0, progression: NativeProgressionState, resumableBoards: Set<Int> = [], returnBoard: Int? = nil) throws -> [String:Any] {
        guard (1...3).contains(world),width.isFinite,height.isFinite,width > 0,height > 0,generation > 0 else { throw NativeSaveError.invalidState(["invalid-world-request"]) }
        let scale = width/390
        // Every authored layout scalar is constant or A+B/scale. Interpolate reciprocal width
        // using two exact producer outputs; don't resize the fixed-point card/offset geometry.
        let factor = (390/width-1)/(390/768-1)
        func project(_ a: Any,_ b: Any) -> Any {
            if let one = a as? [String:Any],let two = b as? [String:Any] { return one.mapWithValues { key,value in project(value,two[key] ?? value) } }
            if let one = a as? [Any],let two = b as? [Any],one.count == two.count { return zip(one,two).map { project($0,$1) } }
            if let one=a as? NSNumber,let two=b as? NSNumber,CFGetTypeID(one) != CFBooleanGetTypeID() {
                // Constant authored fields include discrete protocol identities. Keep
                // their original NSNumber type: converting version 1 to Swift Double
                // makes the native snapshot consumer's strict Int admission fail.
                if one == two {return a}
                return one.doubleValue+(two.doubleValue-one.doubleValue)*factor
            }
            return a
        }
        var snapshot=project(viewports["390"]![world-1],viewports["768"]![world-1]) as! [String:Any]
        snapshot["worldID"]=world;snapshot["routeGeneration"]=generation;snapshot["stateRevision"]=revision
        snapshot["requestID"]="native-\(generation)-\(revision)-\(world)"
        snapshot["viewport"]=["width":width,"height":height]
        snapshot["contentHeight"]=max(snapshot["contentHeight"] as? Double ?? 0,height/scale)
        if let returnBoard { snapshot["returnBoardID"]=returnBoard }
        var units=snapshot["units"] as! [[String:Any]]
        for index in units.indices {
            let board=(world-1)*10+index+1
            let stats=progression.boardStats[board] ?? NativeBoardStats()
            let completed=progression.completedJourneyBoards.contains(board)
            let interim=progression.interimBoard(world:world)==board
            let allowed=completed || interim
            let viewed=progression.viewedJourneyBoards.contains(board)
            let card=interim ? "./assets/colelctibles/interim.png" : NativeJourneyContent.cardAsset(board:board,score:stats.highScore)
            let card2x=interim ? "./assets/colelctibles/interim@2x.png" : NativeJourneyContent.cardAsset(board:board,score:stats.highScore,doubleDensity:true)
            units[index]["boardID"]=board; units[index]["locked"] = !allowed;units[index]["interim"]=interim;units[index]["completed"]=completed
            units[index]["stars"]=completed ? NativeJourneyContent.earnedStars(score:stats.highScore,board:board) : 0
            units[index]["cardRarity"]=NativeJourneyContent.earnedStars(score:stats.highScore,board:board)==3 ? "legendary" : "common"
            units[index]["viewed"]=viewed;units[index]["newRibbon"]=completed && !viewed && board != 1
            units[index]["allowedActions"]=allowed ? (interim ? ["continue","continue"] : ["openCard",resumableBoards.contains(board) ? "continue" : "play"]) : []
            units[index]["stats"]=[["label":"High Score","value":stats.highScore.formatted()],["label":"Longest Combo","value":stats.longestCombo.formatted()]]
            if allowed { units[index]["cardArt"]=card;units[index]["cardArt2x"]=card2x } else { units[index].removeValue(forKey:"cardArt");units[index].removeValue(forKey:"cardArt2x") }
            var parts=units[index]["parts"] as! [[String:Any]]
            for part in parts.indices {
                if parts[part]["role"] as? String == "card" { parts[part]["asset"]=card }
                if parts[part]["role"] as? String == "star",let asset=parts[part]["asset"] as? String {
                    let stars=completed ? NativeJourneyContent.earnedStars(score:stats.highScore,board:board) : 0
                    let ordinal=asset.contains("left") ? 1 : asset.contains("center") ? 2 : 3
                    let side=ordinal==1 ? "left" : ordinal==2 ? "center" : "right"
                    let state=stars>=ordinal ? "filled" : "empty"
                    let suffix=(side=="center" && state=="filled") || (side=="right" && state=="empty") ? "-1" : ""
                    parts[part]["asset"]="./assets/journey assets/level stars/star-\(state)-\(side)\(suffix).png"
                }
                if parts[part]["role"] as? String == "beam" { parts[part]["beamIdle"]=Self.beamIdle() }
            }
            if !allowed { parts.removeAll { $0["role"] as? String == "card" } }
            units[index]["parts"]=parts
            if returnBoard == board {units[index]["enterDelayOffset"]=0.24}
        }
        snapshot["units"]=units
        if world == 1,let main=(snapshot["mainParts"] as? [[String:Any]])?.first(where: {($0["asset"] as? String)?.hasSuffix("1Forest main.png") == true}),let x=main["x"] as? Double,let y=main["y"] as? Double,let width=main["width"] as? Double {
            let planner=NativeForestBeePlanning(contentTop:138/scale,mainX:x,mainY:y,mainWidth:width,mainHeight:width*350/390)
            beePlanner=planner;snapshot["beePlans"]=planner.next();snapshot["beeSessionID"]=generation
        }
        if world > 1 {
            let emitters = units.filter { [11,13,14,16,17,19,20].contains($0["boardID"] as? Int ?? 0) }.compactMap { unit -> NativeWorldPlanning.Emitter? in
                guard let board=unit["boardID"] as? Int,let frame=unit["frame"] as? [String:Any],let island=(unit["parts"] as? [[String:Any]])?.first(where:{$0["role"] as? String == "island"}),let fx=frame["x"] as? Double,let fy=frame["y"] as? Double,let x=island["x"] as? Double,let y=island["y"] as? Double,let width=island["width"] as? Double else {return nil}
                return .init(board:board,x:fx+x+width/2,y:fy+y+width/2)
            }
            let planner=NativeWorldPlanning(world:world,emitters:emitters,sceneHeight:max(760*scale+680,height*1.45))
            planners[world]=planner;snapshot["ambientPlans"]=planner.next(top:0,bottom:height/scale);snapshot["ambientSessionID"]=generation
        }
        return snapshot
    }
    func referenceSnapshot(world:Int,width:Int) -> [String:Any]? {
        guard (1...3).contains(world) else {return nil};return viewports[String(width)]?[world-1]
    }
    public func nextBees(ids:[Int]) -> [[String:Any]]? {beePlanner?.next(ids:ids)}
    public func nextAmbient(world:Int,top:Double,bottom:Double,ids:[Int]) -> [[String:Any]]? {
        guard top.isFinite,bottom.isFinite,bottom > top else {return nil}
        return planners[world]?.next(top:top,bottom:bottom,ids:ids)
    }
    private static func beamIdle() -> [String:Any] {
        var time=0.0,points:[[String:Double]]=[["time":0,"opacity":0.5]]
        func add(_ seconds:Double,_ opacity:Double) {time += seconds;points.append(["time":time,"opacity":opacity])}
        for _ in 0..<10 {
            add(Double.random(in:0.7...1.2),0.5)
            let brightness=Double.random(in:0.55...0.60)
            add(Double.random(in:0.32...0.50),brightness);add(Double.random(in:1.8...2.8),brightness);add(Double.random(in:0.36...0.56),0.5)
        }
        return ["points":points,"duration":time,"phase":Double.random(in:0...time)]
    }
}
import CoreFoundation
private extension Dictionary where Key == String, Value == Any {
    func mapWithValues(_ transform: (String, Any) -> Any) -> [String:Any] { Dictionary(uniqueKeysWithValues:map { ($0.key,transform($0.key,$0.value)) }) }
}
