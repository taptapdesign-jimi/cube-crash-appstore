import Foundation
import StackToSixGameplay

/// Build-time geometry comes from the canonical authored TS specification, not screenshots.
/// Runtime player state, viewport corrections and independent beam timelines are native-owned.
public final class NativeWorldLayouts {
    private let viewports: [String: [[String: Any]]]
    private var planners: [Int:NativeWorldPlanning] = [:]
    private var beePlanner:NativeForestBeePlanning?
    private var beamSequences:[Int:[String:Any]] = [:]
    private lazy var beamTempoBands=Array(0..<10).shuffled()
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
    public func snapshot(world: Int, width: Double, height: Double, generation: Int, revision: Int = 0, progression: NativeProgressionState, resumableBoards: Set<Int> = [], returnBoard: Int? = nil, proportionalCards: Bool = false, phoneUnitLayout: Bool = false, unitScale: Double = 1, unitHorizontalBleed: Double = 0, unitRowGap: Double = 0, unitColumnSpread: Double = 0, unitPairCompression: Bool = false, lastUnitCenterX: Double? = nil) throws -> [String:Any] {
        guard (1...3).contains(world),width.isFinite,height.isFinite,width > 0,height > 0,generation > 0,unitScale.isFinite,(1...1.5).contains(unitScale),unitHorizontalBleed.isFinite,(0...200).contains(unitHorizontalBleed),unitRowGap.isFinite,(0...80).contains(unitRowGap),unitColumnSpread.isFinite,(0...0.2).contains(unitColumnSpread),lastUnitCenterX.map({$0.isFinite && (0...780).contains($0)}) ?? true else { throw NativeSaveError.invalidState(["invalid-world-request"]) }
        let scale = width/390
        // Every authored layout scalar is constant or A+B/scale. Interpolate reciprocal width
        // using two exact producer outputs. The default retains fixed-point card geometry;
        // tablet callers explicitly restore phone card proportions below.
        let factor = (390/width-1)/(390/768-1)
        func project(_ a: Any,_ b: Any) -> Any {
            if let one = a as? [String:Any],let two = b as? [String:Any] { return one.mapWithValues { key,value in
                // Temporal profiles are native-owned below, not viewport geometry.
                key == "beamIdle" ? value:project(value,two[key] ?? value)
            } }
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
        var phoneUnitOriginY:Double?
        if phoneUnitLayout {
            // Tablet reuses each world's complete phone composition. Keep the
            // existing first-row vertical anchor beneath the unchanged hero.
            let phoneUnits=viewports["390"]![world-1]["units"] as! [[String:Any]]
            let firstFrame=units[0]["frame"] as! [String:Double]
            let firstIsland=(units[0]["parts"] as! [[String:Any]]).first{$0["role"] as? String == "island"}!
            let phoneIsland=(phoneUnits[0]["parts"] as! [[String:Any]]).first{$0["role"] as? String == "island"}!
            phoneUnitOriginY=firstFrame["y"]!+(firstIsland["y"] as! Double)-(phoneIsland["y"] as! Double)
            units=phoneUnits
        }
        for index in units.indices {
            let board=(world-1)*10+index+1
            let stats=progression.boardStats[board] ?? NativeBoardStats()
            let completed=progression.completedJourneyBoards.contains(board)
            let interim=progression.interimBoard(world:world)==board
            let allowed=completed || interim
            let viewed=progression.viewedJourneyBoards.contains(board)
            let stars=progression.journeyStars(board:board)
            let card=interim ? "./assets/colelctibles/interim.png" : NativeJourneyContent.cardAsset(board:board,stars:stars)
            let card2x=interim ? "./assets/colelctibles/interim@2x.png" : NativeJourneyContent.cardAsset(board:board,stars:stars,doubleDensity:true)
            units[index]["boardID"]=board; units[index]["locked"] = !allowed;units[index]["interim"]=interim;units[index]["completed"]=completed
            units[index]["stars"]=stars
            units[index]["cardRarity"]=stars==3 ? "legendary" : "common"
            units[index]["viewed"]=viewed;units[index]["newRibbon"]=completed && !viewed && board != 1
            units[index]["allowedActions"]=allowed ? (interim ? ["continue","continue"] : ["openCard",resumableBoards.contains(board) ? "continue" : "play"]) : []
            units[index]["stats"]=[["label":"High Score","value":NativeScoreDisplay.text(stats.highScore)],["label":"Longest Combo","value":NativeComboDisplay.text(stats.longestCombo)]]
            if allowed { units[index]["cardArt"]=card;units[index]["cardArt2x"]=card2x } else { units[index].removeValue(forKey:"cardArt");units[index].removeValue(forKey:"cardArt2x") }
            var parts=units[index]["parts"] as! [[String:Any]]
            if proportionalCards {
                // Keep the card's phone proportions and its authored relationship
                // to the island. Rebase the complete Unit hit area onto that card,
                // preserving every decoration's absolute world position. Locked Units
                // use the same virtual card anchor for their number labels.
                let phoneUnit=(viewports["390"]![world-1]["units"] as! [[String:Any]])[index]
                let phoneParts=phoneUnit["parts"] as! [[String:Any]]
                let oldFrame=units[index]["frame"] as! [String:Double]
                let phoneFrame=phoneUnit["frame"] as! [String:Double]
                let island=parts.first{$0["role"] as? String == "island"}!
                let phoneIsland=phoneParts.first{$0["role"] as? String == "island"}!
                var frame=phoneFrame
                for axis in ["x","y"] {
                    let islandPosition=oldFrame[axis]!+(island[axis] as! Double)
                    frame[axis]=islandPosition-(phoneIsland[axis] as! Double)
                }
                for part in parts.indices {
                    if parts[part]["role"] as? String == "card" {
                        let phoneCard=phoneParts.first{$0["role"] as? String == "card"}!
                        for key in ["x","y","width","height"] {parts[part][key]=phoneCard[key]}
                    } else {
                        for axis in ["x","y"] {
                            parts[part][axis]=(parts[part][axis] as! Double)+oldFrame[axis]!-frame[axis]!
                        }
                    }
                }
                units[index]["frame"]=frame
            }
            for part in parts.indices {
                if parts[part]["role"] as? String == "card" { parts[part]["asset"]=card }
                if parts[part]["role"] as? String == "star",let asset=parts[part]["asset"] as? String {
                    let ordinal=asset.contains("left") ? 1 : asset.contains("center") ? 2 : 3
                    let side=ordinal==1 ? "left" : ordinal==2 ? "center" : "right"
                    let state=stars>=ordinal ? "filled" : "empty"
                    let suffix=(side=="center" && state=="filled") || (side=="right" && state=="empty") ? "-1" : ""
                    parts[part]["asset"]="./assets/journey assets/level stars/star-\(state)-\(side)\(suffix).png"
                }
                if world == 3,parts[part]["role"] as? String == "beam" { var pulse=beamIdle(board:board)
                    if allowed {
                        pulse["duration"]=(pulse["duration"] as! Double)*0.5
                        pulse["phase"]=(pulse["phase"] as! Double)*0.5
                        pulse["points"]=(pulse["points"] as! [[String:Double]]).map { point in var scaled=point;scaled["time"]=point["time"]!*0.5;return scaled }
                    }
                    parts[part]["beamIdle"]=pulse }
            }
            if !allowed { parts.removeAll { $0["role"] as? String == "card" } }
            units[index]["parts"]=parts
            if returnBoard == board {units[index]["enterDelayOffset"]=0.24}
        }
        if phoneUnitLayout || unitScale != 1 || unitRowGap != 0 || unitColumnSpread != 0 {
            let originY=(units[0]["frame"] as! [String:Double])["y"]!
            for index in units.indices {
                var frame=units[index]["frame"] as! [String:Double]
                var parts=units[index]["parts"] as! [[String:Any]]
                let island=parts.first{$0["role"] as? String == "island"}!
                let islandWidth=(island["width"] as! Double)*unitScale
                let oldCenter=frame["x"]!+(island["x"] as! Double)+(island["width"] as! Double)/2
                let minCenter=islandWidth/2-unitHorizontalBleed,maxCenter=390+unitHorizontalBleed-islandWidth/2
                let baseCenter=min(maxCenter,max(minCenter,oldCenter))
                // Expand both columns equally away from the canvas centre.
                // Retain the caller's screen-edge clearance for wider islands.
                let center=unitColumnSpread == 0 ? baseCenter:min(maxCenter,max(minCenter,195+(baseCenter-195)*(1+unitColumnSpread)))
                if let phoneUnitOriginY {
                    frame["x"]=195+(frame["x"]!-195)*unitScale
                    frame["y"]=phoneUnitOriginY+(frame["y"]!-originY)*unitScale
                } else {
                    frame["x"]=center-((island["x"] as! Double)+(island["width"] as! Double)/2)*unitScale
                    frame["y"]=originY+(frame["y"]!-originY+Double(index)*unitRowGap)*unitScale
                }
                frame["width"]! *= unitScale;frame["height"]! *= unitScale
                for part in parts.indices {
                    for key in ["x","y","width","height"] {
                        if let value=parts[part][key] as? Double {parts[part][key]=value*unitScale}
                    }
                }
                var offset=units[index]["lockedNumberOffset"] as? [String:Double] ?? ["y":32]
                for key in ["x","y"] {if let value=offset[key] {offset[key]=value*unitScale}}
                units[index]["frame"]=frame;units[index]["parts"]=parts;units[index]["lockedNumberOffset"]=offset
            }
        }
        // Tablet-only caller opt-in. Measure each pair's original island-row
        // anchor before moving any frame, so shifts never compound on relayout.
        if unitPairCompression && !phoneUnitLayout {
            let fractions=[0.0,0.1,0.2,0.4,0.8]
            let anchors=units.map { unit -> Double in
                let frame=unit["frame"] as! [String:Double]
                let parts=unit["parts"] as! [[String:Any]]
                let island=parts.first{$0["role"] as? String == "island"}!
                return frame["y"]!+(island["y"] as! Double)
            }
            let rows=stride(from:0,to:units.count,by:2).map { start -> Double in
                let end=min(start+2,units.count)
                return anchors[start..<end].reduce(0,+)/Double(end-start)
            }
            for index in units.indices {
                let pair=index/2
                guard pair>0,pair<fractions.count else{continue}
                let lift=max(0,rows[pair]-rows[pair-1])*fractions[pair]
                var frame=units[index]["frame"] as! [String:Double]
                frame["y"]! -= lift
                units[index]["frame"]=frame
            }
        }
        // The tablet caller places local Stage10 as a complete group, using
        // the painted island centre rather than the asymmetric card envelope.
        if !phoneUnitLayout,let lastUnitCenterX,let index=units.indices.last {
            var frame=units[index]["frame"] as! [String:Double]
            let parts=units[index]["parts"] as! [[String:Any]]
            let island=parts.first{$0["role"] as? String == "island"}!
            frame["x"]=lastUnitCenterX-(island["x"] as! Double)-(island["width"] as! Double)/2
            units[index]["frame"]=frame
        }
        snapshot["unitVisualScale"]=unitScale
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
    private func beamIdle(board:Int) -> [String:Any] {
        let index=max(0,min(9,board-21))
        if let cached=beamSequences[index] {return cached}
        // Disjoint tempo bands keep all ten Units independent, even when their
        // random draws coincide. Choose once; refresh/layout never rolls again.
        let duration=(3.2+Double(beamTempoBands[index])*0.24+Double.random(in:0...0.14))/1.5
        let peak=duration*Double.random(in:0.28...0.42)
        let sequence:[String:Any] = ["points":[["time":0.0,"opacity":0.2],
            ["time":peak,"opacity":1.0],["time":duration,"opacity":0.2]],
            "duration":duration,"phase":Double.random(in:0..<duration)]
        beamSequences[index]=sequence
        return sequence
    }
}
import CoreFoundation
private extension Dictionary where Key == String, Value == Any {
    func mapWithValues(_ transform: (String, Any) -> Any) -> [String:Any] { Dictionary(uniqueKeysWithValues:map { ($0.key,transform($0.key,$0.value)) }) }
}
