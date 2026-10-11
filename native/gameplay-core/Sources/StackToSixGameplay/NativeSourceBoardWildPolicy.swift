/// Immutable production-benchmark-v9 board-specific-rules configuration.
/// Board2 explicitly enables both; every other board uses the original true
/// default. This is configuration, never an inference from pending gameplay.
public struct NativeSourceBoardWildPolicy:Equatable,Sendable {
    public let board:Int
    public let meterEnabled:Bool
    public let spawnEnabled:Bool
    public init(board:Int) {
        self.board=board
        // The preserved BOARD_RULES record has no disabling override.
        meterEnabled=true;spawnEnabled=true
    }
}
