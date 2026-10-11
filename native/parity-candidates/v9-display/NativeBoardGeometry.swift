import Foundation
import CoreGraphics
import UIKit

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

    /// v9 final atomic pose after the Wild meter has its measured10px height.
    /// Keep the original12px lift and24px bottom pad plus safe bottom.
    init(columns:Int,rows:Int,viewport:CGSize,safeInsets:UIEdgeInsets) {
        self.columns=max(1,columns);self.rows=max(1,rows)
        let chrome=NativeGameplayChromePlan.make(viewport:viewport,safeTop:safeInsets.top)
        let meterBottom=viewport.height-chrome.meterRect.minY
        let dynamicHudBottom=meterBottom+24
        let available=max(1,viewport.height-dynamicHudBottom-24-safeInsets.bottom)
        let padding:CGFloat=viewport.width>=768 && viewport.width<=1400 ? 40:24
        bounds=CGRect(x:padding,y:24+safeInsets.bottom,width:max(1,viewport.width-padding*2),height:available)
        let width=CGFloat(self.columns)*Self.tile+CGFloat(self.columns-1)*Self.gap
        let height=CGFloat(self.rows)*Self.tile+CGFloat(self.rows-1)*Self.gap
        scale=max(0.001,min(bounds.width/width,available/height))
        let renderedWidth=width*scale,renderedHeight=height*scale
        let left=min(max(((viewport.width-renderedWidth)/2).rounded(),padding),viewport.width-padding-renderedWidth)
        let top=(dynamicHudBottom+(available-renderedHeight)/2-12).rounded()
        origin=CGPoint(x:left,y:viewport.height-top-renderedHeight)
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
