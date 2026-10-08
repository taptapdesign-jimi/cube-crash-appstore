import Foundation
import ImageIO

/// Immutable original bitmap crosses existing serial I/O -> MainActor only.
nonisolated struct NativeSelectedFinaleRaster:@unchecked Sendable {
 let path:String
 let image:CGImage
 static func decode(root:URL,candidates:[String])->Self? {
  for path in candidates {
   let relative=path.hasPrefix("./") ? String(path.dropFirst(2)):path
   guard !relative.hasPrefix("/"),!relative.split(separator:"/").contains(".."),
         let source=CGImageSourceCreateWithURL(root.appendingPathComponent(relative) as CFURL,nil),
         let image=CGImageSourceCreateImageAtIndex(source,0,[kCGImageSourceShouldCacheImmediately:true] as CFDictionary) else{continue}
   return Self(path:relative,image:image)
  }
  return nil
 }
}
