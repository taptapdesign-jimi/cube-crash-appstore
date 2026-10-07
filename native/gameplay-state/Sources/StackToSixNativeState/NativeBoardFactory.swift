import Foundation
import StackToSixGameplay

/// Ports app-core-board-build/open + randVal. Randomness is injected as logical seed, never rendering time.
public enum NativeBoardFactory {
    public static func make(mode: NativeRunMode, board: Int, columns: Int = 5, rows: Int = 9, generation: UInt64 = 1, seed: UInt64 = 1, tutorial: Bool = false) -> NativeBoardState {
        precondition(columns > 0 && rows > 0 && columns * rows <= 4096)
        var rng = seed == 0 ? UInt64(1) : seed
        func roll() -> Double {
            rng ^= rng << 13; rng ^= rng >> 7; rng ^= rng << 17
            return Double(rng >> 11) / 9007199254740992
        }
        var tiles = (0..<(columns*rows)).map { index in NativeTile(id:"g\(generation)-\(index)",cell:NativeCell(column:index%columns,row:index/columns),value:0,locked:true) }
        if tutorial {
            let center = max(0,min(rows-3,rows/2-1)), lower = max(2,min(rows-1,center+2))
            let left = max(0,min(columns-3,columns/2-1)), right = max(2,min(columns-1,left+2))
            let desired = [(left,center,3),(right,lower,2),(max(0,columns-2),min(rows-1,1),1),(0,0,2),(1,0,2),(2,0,2),(0,2,2),(1,2,2),(2,2,1),(3,2,1),(0,rows-3,2),(1,rows-3,2),(2,rows-3,2),(columns-1,min(rows-1,4),2),(0,rows-1,2),(1,rows-1,2),(2,rows-1,1),(3,rows-1,1)]
            var seen: Set<Int> = []
            for (c,r,value) in desired where c >= 0 && c < columns && r >= 0 && r < rows {
                let index = r*columns+c
                if seen.insert(index).inserted { tiles[index].value=value; tiles[index].locked=false }
            }
        } else {
            var ids = Array(tiles.indices)
            for index in stride(from:ids.count-1,through:1,by:-1) { ids.swapAt(index,Int(roll()*Double(index+1))) }
            let bias = mode == .journey ? NativeJourneyContent.smallValueBias(board:board) : 0
            for index in ids.prefix(max(1,Int((Double(tiles.count)*0.30).rounded(.toNearestOrAwayFromZero)))) {
                let pool = bias > 0 && roll() < bias ? [1,2,3] : [1,1,1,2,2,3,3,4,5]
                tiles[index].locked=false; tiles[index].value=pool[Int(roll()*Double(pool.count))]
            }
        }
        return NativeBoardState(columns:columns,rows:rows,tiles:tiles,mode:mode,board:max(1,board),stage:max(1,board),generation:generation,rngState:rng)
    }
}
