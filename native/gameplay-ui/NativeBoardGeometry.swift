import Foundation
import CoreGraphics

/// The accepted web board's logical 128px die and 20px gap, fitted once per
/// layout pass. UIKit's top-left coordinates are converted at the scene edge.
struct NativeBoardGeometry: Equatable {
    static let tile: CGFloat = 128
    static let gap: CGFloat = 20
    let columns: Int
    let rows: Int
    let bounds: CGRect
    let scale: CGFloat
    let origin: CGPoint

    init(columns: Int, rows: Int, bounds: CGRect) {
        self.columns = max(1, columns)
        self.rows = max(1, rows)
        self.bounds = bounds
        let width = CGFloat(self.columns) * Self.tile + CGFloat(self.columns - 1) * Self.gap
        let height = CGFloat(self.rows) * Self.tile + CGFloat(self.rows - 1) * Self.gap
        scale = max(0.001, min(bounds.width / width, bounds.height / height))
        origin = CGPoint(x: bounds.midX - width * scale / 2, y: bounds.midY - height * scale / 2)
    }

    var tileSize: CGFloat { Self.tile * scale }
    var stride: CGFloat { (Self.tile + Self.gap) * scale }

    func center(row: Int, column: Int) -> CGPoint {
        CGPoint(x: origin.x + (CGFloat(column) * (Self.tile + Self.gap) + Self.tile / 2) * scale,
                y: origin.y + (CGFloat(rows - row - 1) * (Self.tile + Self.gap) + Self.tile / 2) * scale)
    }

    /// No nearest-target auto aim: the stable die footprint owns the hit.
    /// Larger Special artwork does not enlarge its gameplay hit rectangle.
    func cell(at point: CGPoint) -> (row: Int, column: Int)? {
        let column = Int(floor((point.x - origin.x) / stride))
        let bottomRow = Int(floor((point.y - origin.y) / stride))
        guard (0..<columns).contains(column), (0..<rows).contains(bottomRow) else { return nil }
        let row = rows - bottomRow - 1
        let center = center(row: row, column: column)
        guard abs(point.x - center.x) <= tileSize / 2,
              abs(point.y - center.y) <= tileSize / 2 else { return nil }
        return (row, column)
    }
}
