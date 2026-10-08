import Foundation

/// Genuine original 18 opening demo only. Presentation/activation receipts do
/// not serialize, and cannot invent a constructor or claim a full tutorial port.
public struct NativeSourceTutorialDemoActivationReceipt:Equatable,Sendable {
    public let id:String,generation:UInt64,revision:UInt64
    public let threeID:String,twoID:String,oneID:String
    let originalTiles:[NativeTile]
    static func matchesOriginalDemo(_ state:NativeBoardState)->Bool {
        guard (state.columns==5 || state.columns==7),state.rows==9,
            state.tiles.count==state.columns*state.rows,state.validationIssues().isEmpty else{return false}
        let cols=state.columns,rows=state.rows,cells=NativeTutorialRules.guidedCells(columns:cols,rows:rows)
        let desired:[(NativeCell,Int)]=[(cells.three,3),(cells.two,2),(cells.one,1),
            (.init(column:0,row:0),2),(.init(column:1,row:0),2),(.init(column:2,row:0),2),
            (.init(column:0,row:2),2),(.init(column:1,row:2),2),(.init(column:2,row:2),1),(.init(column:3,row:2),1),
            (.init(column:0,row:rows-3),2),(.init(column:1,row:rows-3),2),(.init(column:2,row:rows-3),2),
            (.init(column:cols-1,row:min(rows-1,4)),2),(.init(column:0,row:rows-1),2),
            (.init(column:1,row:rows-1),2),(.init(column:2,row:rows-1),1),(.init(column:3,row:rows-1),1)]
        var openings:[NativeCell:Int]=[:];for(cell,value)in desired where openings[cell]==nil{openings[cell]=value}
        return state.tiles.allSatisfy {tile in
            tile.archetype==nil && tile.variant==nil && !tile.isWild && !tile.pendingRemoval &&
            !tile.transientSpawn && !tile.magnetOwned && !tile.resolutionOwned && !tile.merge6CleanupOwned &&
            tile.value == (openings[tile.cell] ?? 0) && tile.locked == (openings[tile.cell]==nil)
        }
    }
}
