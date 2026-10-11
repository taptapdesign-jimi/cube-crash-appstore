import Foundation
import StackToSixGameplay

/// Fresh-board-only capture. The caller supplies the APP stream also used by
/// actual face RAFs. Captured constructor tilt is materialized without a redraw.
public struct NativeSourceInitialBoardRecipe: Equatable, Sendable {
    public struct Holder: Equatable, Sendable {
        public let tileID: String
        public let cell: NativeCell
        public let rotation: Double
    }
    public struct Opening: Equatable, Sendable {
        public let tileID: String
        public let value: Int
    }
    public let state: NativeBoardState
    public let holders: [Holder]
    public let openings: [Opening]

    public func matches(_ candidate: NativeBoardState) -> Bool {
        candidate.columns == state.columns && candidate.rows == state.rows &&
        candidate.generation == state.generation && candidate.mode == state.mode &&
        candidate.board == state.board && candidate.revision == 0 && candidate.terminal == nil &&
        candidate.tiles == state.tiles
    }

    /// No board-entry/idle/preload draw is hidden here. v9 createTile consumes
    /// every row-major rotG draw before openRandomTiles starts the shuffle.
    public static func capture(mode: NativeRunMode, board: Int, columns: Int = 5,
        rows: Int = 9, generation: UInt64 = 1, gameplaySeed: UInt64 = 1,
        tutorialDemo: Bool = false, random: () -> Double,
        constructHolder: ((Holder) -> Bool)? = nil, openTile: ((Opening) -> Bool)? = nil) -> Self? {
        guard (columns == 5 || columns == 7), rows == 9, board > 0 else { return nil }
        var holders: [Holder] = [], tiles: [NativeTile] = [], openings: [Opening] = []
        for row in 0..<rows {
            for column in 0..<columns {
                let id = "g\(generation)-\(row*columns+column)", cell = NativeCell(column:column,row:row)
                let draw = random()
                guard draw.isFinite, draw >= 0, draw < 1 else { return nil }
                let holder=Holder(tileID:id,cell:cell,rotation:draw*0.12-0.06)
                holders.append(holder)
                tiles.append(.init(id:id,cell:cell,value:0,locked:true))
                if constructHolder?(holder) == false { return nil }
            }
        }
        func open(_ index: Int, _ value: Int) -> Bool {
            tiles[index].locked = false; tiles[index].value = value
            let opening=Opening(tileID:tiles[index].id,value:value)
            openings.append(opening)
            return openTile?(opening) != false
        }
        if tutorialDemo {
            let center=max(0,min(rows-3,rows/2-1)),lower=max(2,min(rows-1,center+2))
            let left=max(0,min(columns-3,columns/2-1)),right=max(2,min(columns-1,left+2))
            let cells=[(left,center,3),(right,lower,2),(max(0,columns-2),min(rows-1,1),1),
                (0,0,2),(1,0,2),(2,0,2),(0,2,2),(1,2,2),(2,2,1),(3,2,1),
                (0,rows-3,2),(1,rows-3,2),(2,rows-3,2),(columns-1,min(rows-1,4),2),
                (0,rows-1,2),(1,rows-1,2),(2,rows-1,1),(3,rows-1,1)]
            var seen: Set<Int> = []
            for (c,r,value) in cells where c>=0 && c<columns && r>=0 && r<rows {
                if seen.insert(r*columns+c).inserted && !open(r*columns+c,value) { return nil }
            }
        } else {
            var indices=Array(tiles.indices)
            for index in stride(from:indices.count-1,through:1,by:-1) {
                let draw=random()
                guard draw.isFinite,draw>=0,draw<1 else {return nil}
                indices.swapAt(index,Int(draw*Double(index+1)))
            }
            let stage=(board-1)%10+1
            let bias=mode == .journey ? (stage<=3 ? 0.75:stage<=6 ? 0.4:0):0
            for index in indices.prefix(Int((Double(tiles.count)*0.30).rounded(.toNearestOrAwayFromZero))) {
                var small=false
                if bias>0 {
                    let draw=random();guard draw.isFinite,draw>=0,draw<1 else{return nil}
                    small=draw<bias
                }
                let pool=small ? [1,2,3]:[1,1,1,2,2,3,3,4,5]
                let draw=random();guard draw.isFinite,draw>=0,draw<1 else{return nil}
                if !open(index,pool[Int(draw*Double(pool.count))]) { return nil }
            }
        }
        return .init(state:.init(columns:columns,rows:rows,tiles:tiles,mode:mode,board:board,
            stage:board,generation:generation,rngState:gameplaySeed),holders:holders,openings:openings)
    }
}
