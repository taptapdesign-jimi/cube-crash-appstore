/**
 * 🪵 WOODEN TEMPLATE - Original OG Style
 * 
 * This is the original "wooden" visual style for cube-crash.
 * All colors, patterns, and parameters are defined here for easy theming.
 */

// 🎨 Wooden Colors
export const woodenColors = {
  regular: 0xD4A584,     // Brown - for regular tile merges
  wild: 0xFFCB47,        // Yellow (#FFCB47) - for wild star merges (ORIGINAL COLOR)
  wildStar: 0xFFCB47,    // Yellow (#FFCB47) - for wild star merges (ORIGINAL COLOR)
  wildBeer: 0xF99D77,    // Orange (#F99D77) - for wild beer/juice merges (ORIGINAL COLOR)
  wildTnt: 0xE85C3A,     // Orange-red (#E85C3A) - for wild TNT / Explosion Pack merges
  wildMagnet: 0xF26034,  // Red (#F26034) - for wild magnet merges
  smoke: 0xFFFFFF        // White smoke for wild effects
};

// 🎨 Wooden Drag Particle Colors (for drag smoke trail)
// Each wild tile type has its own color palette for drag particles
export const woodenDragParticleColors = {
  // Regular tiles: Beige/cream palette (default)
  regular: [0xF4EEE7, 0xFBE3C5, 0xECD7C2, 0xE5C7AD, 0xFADEC0],
  
  // Wild star (wild): Yellow palette - ORIGINAL COLOR
  wild: [0xFFCB47, 0xFFD966, 0xFFE699, 0xFFF0B3, 0xFFF5CC],
  wildStar: [0xFFCB47, 0xFFD966, 0xFFE699, 0xFFF0B3, 0xFFF5CC], // Alias for wild
  
  // Wild beer: Orange palette - ORIGINAL COLOR
  wildBeer: [0xFBD295, 0xF9BE9C, 0xF6E6C8, 0xF99D77],
  
  // Wild TNT (Explosion Pack): Orange-red palette
  wildTnt: [0xE85C3A, 0xEB7A5A, 0xF09880, 0xF5B6A6],
  
  // Wild magnet: Red palette - ORIGINAL COLOR
  wildMagnet: [0xF26034, 0xF57A5A, 0xF89480, 0xFBAEA6, 0xFDC8CC]
};

// 🎨 Wooden Bubble Colors (for full-screen bubbles explosion)
// Bubbles use lighter, more transparent variations of drag particle colors
export const woodenBubbleColors = {
  // Regular tiles: Light beige/cream bubbles
  regular: [0xFFFFFF, 0xFEF9F5, 0xFDF5ED, 0xFCF0E5],
  
  // Wild star (wild): Light yellow/white bubbles
  wild: [0xFFFFFF, 0xFFF8E1, 0xFFF3C4, 0xFFEEB3],
  wildStar: [0xFFFFFF, 0xFFF8E1, 0xFFF3C4, 0xFFEEB3], // Alias for wild
  
  // Wild beer: Light orange/white bubbles - ORIGINAL COLOR (white with orange tint)
  wildBeer: [0xFFFFFF, 0xFFF5E6, 0xFFE8D1, 0xFFDCC2],
  
  // Wild TNT (Explosion Pack): Light orange-red/white bubbles
  wildTnt: [0xFFFFFF, 0xFFEDE6, 0xFFE0D4, 0xFFD4C2],
  
  // Wild magnet: Light red/white bubbles
  wildMagnet: [0xFFFFFF, 0xFFE8E0, 0xFFD4C8, 0xFFC0B0]
};

// 📐 Wooden Shard Patterns
// Each pattern defines exact positions, angles, and properties for shards
// This allows for reliable pooling and consistent visual quality

/**
 * Pattern 1: "EXPLOSION" - Wide spread, explosive feel
 * Perfect for: Regular merge 6 (ordinary + ordinary)
 * Shards: 12 shards in circular explosion pattern
 */
export const woodenPatternExplosion = [
  // Ring 1: Inner circle (6 shards) - 🔥 FIX: Increased distances for better spread
  { angle: 0,   distance: 0.08, size: 1.3, speed: 1.0, alpha: 1.0 },
  { angle: 60,  distance: 0.10, size: 1.2, speed: 0.95, alpha: 1.0 },
  { angle: 120, distance: 0.09, size: 1.4, speed: 1.05, alpha: 1.0 },
  { angle: 180, distance: 0.11, size: 1.1, speed: 0.9, alpha: 1.0 },
  { angle: 240, distance: 0.10, size: 1.3, speed: 1.0, alpha: 1.0 },
  { angle: 300, distance: 0.08, size: 1.2, speed: 0.95, alpha: 1.0 },
  
  // Ring 2: Outer circle (6 shards) - 🔥 FIX: Increased distances to match non-templated maxDistance
  { angle: 30,  distance: 0.20, size: 1.0, speed: 1.1, alpha: 1.0 },
  { angle: 90,  distance: 0.24, size: 1.1, speed: 1.15, alpha: 1.0 },
  { angle: 150, distance: 0.18, size: 0.9, speed: 1.0, alpha: 1.0 },
  { angle: 210, distance: 0.22, size: 1.0, speed: 1.1, alpha: 1.0 },
  { angle: 270, distance: 0.20, size: 1.1, speed: 1.05, alpha: 1.0 },
  { angle: 330, distance: 0.23, size: 0.95, speed: 1.1, alpha: 1.0 }
];

/**
 * 🧲 ORGANIC PATTERN 1: "Asymmetric Explosion" - Natural, non-uniform spread
 * Perfect for: Wild-magnet merge 6 (wild-magnet + ordinary)
 * Shards: 18 shards with asymmetric, organic distribution (+30% from 14)
 * Style: Clustered in some areas, sparse in others - looks natural
 */
export const woodenPatternWildMagnetOrganic1 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle (radius = tileSize * 0.28)
  // Minimum distance now: 0.059+ (ensures 40%+ beyond multiplier circle)
  // Top-right cluster (dense, organic variation) - OSCILLATING distances (40%+ increase)
  { angle: 22,  distance: 0.059, size: 1.5, speed: 0.88, alpha: 1.0 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 33,  distance: 0.216, size: 1.1, speed: 1.02, alpha: 1.0 },  // 🔥 Far (0.154 * 1.4 = 0.216)
  { angle: 47,  distance: 0.108, size: 1.4, speed: 0.92, alpha: 1.0 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 58,  distance: 0.219, size: 1.0, speed: 1.08, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 28,  distance: 0.078, size: 1.3, speed: 0.95, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  
  // Bottom-left cluster (dense, organic variation) - OSCILLATING distances (40%+ increase, far ones 20% closer)
  { angle: 202, distance: 0.196, size: 1.3, speed: 0.95, alpha: 1.0 },  // 🔥 Far (0.245 * 0.8 = 0.196, 20% closer)
  { angle: 213, distance: 0.088, size: 1.2, speed: 1.05, alpha: 1.0 }, // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 228, distance: 0.243, size: 1.5, speed: 0.98, alpha: 1.0 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 238, distance: 0.069, size: 1.1, speed: 1.12, alpha: 1.0 },  // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 208, distance: 0.186, size: 1.25, speed: 1.0, alpha: 1.0 }, // 🔥 Mid-far (0.133 * 1.4 = 0.186)
  
  // Sparse scattered shards (organic gaps, OSCILLATING distances) - wide range (40%+ increase, far ones 20% closer)
  { angle: 97,  distance: 0.251, size: 0.95, speed: 1.18, alpha: 1.0 }, // 🔥 Very far (0.314 * 0.8 = 0.251, 20% closer)
  { angle: 157, distance: 0.049, size: 1.05, speed: 0.92, alpha: 1.0 }, // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 277, distance: 0.204, size: 1.15, speed: 1.25, alpha: 1.0 }, // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 318, distance: 0.118, size: 0.98, speed: 1.03, alpha: 1.0 }, // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 8,   distance: 0.227, size: 1.08, speed: 1.15, alpha: 1.0 }, // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 347, distance: 0.098, size: 1.22, speed: 0.96, alpha: 1.0 }, // 🔥 Close (0.070 * 1.4 = 0.098)
  { angle: 125, distance: 0.274, size: 1.12, speed: 1.08, alpha: 1.0 }, // 🔥 Very far (0.343 * 0.8 = 0.274, 20% closer)
  { angle: 265, distance: 0.078, size: 1.05, speed: 1.12, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 42,  distance: 0.188, size: 1.18, speed: 0.99, alpha: 1.0 }  // 🔥 Far (0.235 * 0.8 = 0.188, 20% closer)
];

/**
 * 🧲 ORGANIC PATTERN 2: "Random Organic Spread" - Completely random angles, no X pattern
 * Perfect for: Wild-magnet merge 6 (wild-magnet + ordinary)
 * Shards: 21 shards with random angles and oscillating distances
 * Style: Pure organic chaos - random angles, no clusters, no X pattern, just natural explosion
 */
export const woodenPatternWildMagnetOrganic2 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle
  // 🔥 ORGANIC RANDOM: Completely random angles and distances - no X pattern, pure organic chaos
  // Random angles (not in clusters) with oscillating distances (40%+ increase)
  { angle: 17,  distance: 0.059, size: 1.4, speed: 0.93, alpha: 1.0 },   // 🔥 Random angle, close (0.042 * 1.4 = 0.059)
  { angle: 73,  distance: 0.212, size: 1.15, speed: 1.08, alpha: 1.0 }, // 🔥 Random angle, far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 134, distance: 0.108, size: 1.45, speed: 0.97, alpha: 1.0 }, // 🔥 Random angle, close (0.077 * 1.4 = 0.108)
  { angle: 201, distance: 0.235, size: 1.05, speed: 1.15, alpha: 1.0 }, // 🔥 Random angle, far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 256, distance: 0.078, size: 1.25, speed: 0.88, alpha: 1.0 },  // 🔥 Random angle, close (0.056 * 1.4 = 0.078)
  { angle: 312, distance: 0.225, size: 1.3, speed: 1.02, alpha: 1.0 },  // 🔥 Random angle, mid-far (0.161 * 1.4 = 0.225)
  
  // More random angles - organic spread (40%+ increase, far ones 20% closer)
  { angle: 48,  distance: 0.219, size: 1.18, speed: 0.96, alpha: 1.0 },  // 🔥 Random angle, far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 89,  distance: 0.078, size: 1.32, speed: 1.02, alpha: 1.0 }, // 🔥 Random angle, close (0.056 * 1.4 = 0.078)
  { angle: 156, distance: 0.258, size: 1.08, speed: 1.11, alpha: 1.0 }, // 🔥 Random angle, far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 223, distance: 0.049, size: 1.22, speed: 0.94, alpha: 1.0 },  // 🔥 Random angle, very close (0.035 * 1.4 = 0.049)
  { angle: 278, distance: 0.196, size: 1.15, speed: 1.05, alpha: 1.0 }, // 🔥 Random angle, far (0.245 * 0.8 = 0.196, 20% closer)
  
  // More random angles - continued organic chaos (40%+ increase, far ones 20% closer)
  { angle: 34,  distance: 0.069, size: 1.12, speed: 1.05, alpha: 1.0 },  // 🔥 Random angle, close (0.049 * 1.4 = 0.069)
  { angle: 107, distance: 0.243, size: 1.25, speed: 0.92, alpha: 1.0 }, // 🔥 Random angle, far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 181, distance: 0.088, size: 1.05, speed: 1.18, alpha: 1.0 },  // 🔥 Random angle, close (0.063 * 1.4 = 0.088)
  { angle: 245, distance: 0.204, size: 1.2, speed: 0.98, alpha: 1.0 },  // 🔥 Random angle, far (0.255 * 0.8 = 0.204, 20% closer)
  
  // Final random angles - complete organic spread (40%+ increase, far ones 20% closer)
  { angle: 62,  distance: 0.118, size: 1.35, speed: 0.99, alpha: 1.0 },  // 🔥 Random angle, close (0.084 * 1.4 = 0.118)
  { angle: 129, distance: 0.266, size: 1.08, speed: 1.22, alpha: 1.0 }, // 🔥 Random angle, far (0.333 * 0.8 = 0.266, 20% closer)
  { angle: 197, distance: 0.059, size: 1.18, speed: 1.03, alpha: 1.0 }, // 🔥 Random angle, close (0.042 * 1.4 = 0.059)
  { angle: 264, distance: 0.227, size: 1.28, speed: 0.91, alpha: 1.0 },  // 🔥 Random angle, far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 331, distance: 0.098, size: 1.22, speed: 1.08, alpha: 1.0 }  // 🔥 Random angle, close (0.070 * 1.4 = 0.098)
];

/**
 * 🧲 ORGANIC PATTERN 3: "Chaotic Spread" - Irregular, natural distribution
 * Perfect for: Wild-magnet merge 6 (wild-magnet + ordinary)
 * Shards: 20 shards with chaotic, non-uniform angles and distances (+30% from 15)
 * Style: No symmetry, looks like natural debris explosion
 */
export const woodenPatternWildMagnetOrganic3 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle
  // Irregular angles and OSCILLATING distances - maximum organic chaos, wide distance range (40%+ increase)
  { angle: 9,   distance: 0.049, size: 1.35, speed: 0.87, alpha: 1.0 },  // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 35,  distance: 0.251, size: 1.08, speed: 1.12, alpha: 1.0 }, // 🔥 Far (0.314 * 0.8 = 0.251, 20% closer)
  { angle: 64,  distance: 0.078, size: 1.48, speed: 0.94, alpha: 1.0 },  // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 91,  distance: 0.219, size: 1.18, speed: 1.22, alpha: 1.0 }, // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 115, distance: 0.059, size: 1.05, speed: 0.91, alpha: 1.0 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 144, distance: 0.235, size: 1.25, speed: 1.08, alpha: 1.0 }, // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 171, distance: 0.108, size: 1.32, speed: 1.19, alpha: 1.0 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 195, distance: 0.274, size: 1.12, speed: 1.03, alpha: 1.0 },  // 🔥 Very far (0.343 * 0.8 = 0.274, 20% closer)
  { angle: 224, distance: 0.069, size: 1.42, speed: 0.96, alpha: 1.0 }, // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 248, distance: 0.212, size: 1.02, speed: 1.28, alpha: 1.0 }, // 🔥 Far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 275, distance: 0.088, size: 1.22, speed: 0.99, alpha: 1.0 }, // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 301, distance: 0.258, size: 1.38, speed: 1.14, alpha: 1.0 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 329, distance: 0.039, size: 1.08, speed: 0.89, alpha: 1.0 },   // 🔥 Very close (0.028 * 1.4 = 0.039)
  { angle: 353, distance: 0.204, size: 1.28, speed: 1.07, alpha: 1.0 }, // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 49,  distance: 0.118, size: 1.15, speed: 1.25, alpha: 1.0 }, // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 19,  distance: 0.243, size: 1.28, speed: 0.93, alpha: 1.0 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 76,  distance: 0.078, size: 1.15, speed: 1.16, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 133, distance: 0.227, size: 1.32, speed: 1.01, alpha: 1.0 }, // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 189, distance: 0.059, size: 1.08, speed: 1.09, alpha: 1.0 }, // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 259, distance: 0.266, size: 1.25, speed: 0.96, alpha: 1.0 }   // 🔥 Very far (0.333 * 0.8 = 0.266, 20% closer)
];

/**
 * 🧲 PULL PATTERN 1: "Organic Pull Explosion" - For magnet pull animations
 * Perfect for: Wild-magnet pull merge 6 (after tiles are pulled)
 * Shards: 18 shards with organic, varied distances - no overlap
 * Style: Random angles, oscillating distances, maximum variety
 */
export const woodenPatternWildMagnetPull1 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle, far ones 20% closer
  // Random angles with oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 14,  distance: 0.049, size: 1.4, speed: 0.93, alpha: 1.0 },   // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 67,  distance: 0.212, size: 1.15, speed: 1.08, alpha: 1.0 },  // 🔥 Far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 123, distance: 0.108, size: 1.45, speed: 0.97, alpha: 1.0 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 198, distance: 0.235, size: 1.05, speed: 1.15, alpha: 1.0 },  // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 251, distance: 0.078, size: 1.25, speed: 0.88, alpha: 1.0 },  // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 309, distance: 0.225, size: 1.3, speed: 1.02, alpha: 1.0 },  // 🔥 Mid-far (0.161 * 1.4 = 0.225)
  { angle: 45,  distance: 0.196, size: 1.18, speed: 0.96, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.196, 20% closer)
  { angle: 88,  distance: 0.078, size: 1.32, speed: 1.02, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 152, distance: 0.258, size: 1.08, speed: 1.11, alpha: 1.0 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 221, distance: 0.049, size: 1.22, speed: 0.94, alpha: 1.0 },  // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 275, distance: 0.196, size: 1.15, speed: 1.05, alpha: 1.0 }, // 🔥 Far (0.245 * 0.8 = 0.196, 20% closer)
  { angle: 32,  distance: 0.069, size: 1.12, speed: 1.05, alpha: 1.0 },   // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 104, distance: 0.243, size: 1.25, speed: 0.92, alpha: 1.0 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 179, distance: 0.088, size: 1.05, speed: 1.18, alpha: 1.0 },   // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 243, distance: 0.204, size: 1.2, speed: 0.98, alpha: 1.0 },  // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 59,  distance: 0.118, size: 1.35, speed: 0.99, alpha: 1.0 },  // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 127, distance: 0.266, size: 1.08, speed: 1.22, alpha: 1.0 }, // 🔥 Far (0.333 * 0.8 = 0.266, 20% closer)
  { angle: 195, distance: 0.059, size: 1.18, speed: 1.03, alpha: 1.0 }  // 🔥 Close (0.042 * 1.4 = 0.059)
];

/**
 * 🧲 PULL PATTERN 2: "Chaotic Pull Burst" - For magnet pull animations
 * Perfect for: Wild-magnet pull merge 6 (after tiles are pulled)
 * Shards: 20 shards with chaotic spread - no overlap
 * Style: Maximum chaos, random angles, wide distance range
 */
export const woodenPatternWildMagnetPull2 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle
  // Maximum chaos - random angles, oscillating distances (40%+ increase)
  { angle: 7,   distance: 0.039, size: 1.35, speed: 0.87, alpha: 1.0 },   // 🔥 Very close (0.028 * 1.4 = 0.039)
  { angle: 41,  distance: 0.251, size: 1.08, speed: 1.12, alpha: 1.0 },  // 🔥 Far (0.314 * 0.8 = 0.251, 20% closer)
  { angle: 78,  distance: 0.078, size: 1.48, speed: 0.94, alpha: 1.0 },   // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 112, distance: 0.219, size: 1.18, speed: 1.22, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 146, distance: 0.059, size: 1.05, speed: 0.91, alpha: 1.0 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 183, distance: 0.235, size: 1.25, speed: 1.08, alpha: 1.0 }, // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 217, distance: 0.108, size: 1.32, speed: 1.19, alpha: 1.0 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 254, distance: 0.274, size: 1.12, speed: 1.03, alpha: 1.0 },  // 🔥 Very far (0.343 * 0.8 = 0.274, 20% closer)
  { angle: 289, distance: 0.069, size: 1.42, speed: 0.96, alpha: 1.0 }, // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 326, distance: 0.212, size: 1.02, speed: 1.28, alpha: 1.0 }, // 🔥 Far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 23,  distance: 0.088, size: 1.22, speed: 0.99, alpha: 1.0 },  // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 56,  distance: 0.258, size: 1.38, speed: 1.14, alpha: 1.0 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 94,  distance: 0.049, size: 1.08, speed: 0.89, alpha: 1.0 },   // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 131, distance: 0.204, size: 1.28, speed: 1.07, alpha: 1.0 }, // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 168, distance: 0.118, size: 1.15, speed: 1.25, alpha: 1.0 }, // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 205, distance: 0.243, size: 1.28, speed: 0.93, alpha: 1.0 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 242, distance: 0.078, size: 1.15, speed: 1.16, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 278, distance: 0.227, size: 1.32, speed: 1.01, alpha: 1.0 }, // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 315, distance: 0.059, size: 1.08, speed: 1.09, alpha: 1.0 }, // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 352, distance: 0.266, size: 1.25, speed: 0.96, alpha: 1.0 }   // 🔥 Very far (0.333 * 0.8 = 0.266, 20% closer)
];

/**
 * 🧲 PULL PATTERN 3: "Scattered Pull Debris" - For magnet pull animations
 * Perfect for: Wild-magnet pull merge 6 (after tiles are pulled)
 * Shards: 19 shards with scattered, organic distribution - no overlap
 * Style: Natural debris spread, varied distances, organic feel
 */
export const woodenPatternWildMagnetPull3 = [
  // 🔥 FIX: All distances increased by 40%+ to ensure shards exit multiplier circle
  // Scattered organic debris - varied angles and distances (40%+ increase)
  { angle: 19,  distance: 0.059, size: 1.4, speed: 0.93, alpha: 1.0 },   // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 61,  distance: 0.212, size: 1.15, speed: 1.08, alpha: 1.0 },  // 🔥 Far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 103, distance: 0.108, size: 1.45, speed: 0.97, alpha: 1.0 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 145, distance: 0.235, size: 1.05, speed: 1.15, alpha: 1.0 }, // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 187, distance: 0.078, size: 1.25, speed: 0.88, alpha: 1.0 },  // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 229, distance: 0.225, size: 1.3, speed: 1.02, alpha: 1.0 },  // 🔥 Mid-far (0.161 * 1.4 = 0.225)
  { angle: 271, distance: 0.219, size: 1.18, speed: 0.96, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 313, distance: 0.078, size: 1.32, speed: 1.02, alpha: 1.0 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 355, distance: 0.258, size: 1.08, speed: 1.11, alpha: 1.0 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 37,  distance: 0.049, size: 1.22, speed: 0.94, alpha: 1.0 },   // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 79,  distance: 0.196, size: 1.15, speed: 1.05, alpha: 1.0 },  // 🔥 Far (0.245 * 0.8 = 0.196, 20% closer)
  { angle: 121, distance: 0.069, size: 1.12, speed: 1.05, alpha: 1.0 },  // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 163, distance: 0.243, size: 1.25, speed: 0.92, alpha: 1.0 },  // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 205, distance: 0.088, size: 1.05, speed: 1.18, alpha: 1.0 },   // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 247, distance: 0.204, size: 1.2, speed: 0.98, alpha: 1.0 },   // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 289, distance: 0.118, size: 1.35, speed: 0.99, alpha: 1.0 },   // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 331, distance: 0.266, size: 1.08, speed: 1.22, alpha: 1.0 }, // 🔥 Far (0.333 * 0.8 = 0.266, 20% closer)
  { angle: 13,  distance: 0.059, size: 1.18, speed: 1.03, alpha: 1.0 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 55,  distance: 0.227, size: 1.28, speed: 0.91, alpha: 1.0 }    // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
];

/**
 * ⭐ WILD STAR ORGANIC PATTERN 1: "Stellar Explosion" - For wild star merges
 * Perfect for: Wild star merge 6 (wild + ordinary)
 * Shards: 18 shards with stellar, organic distribution
 * Style: Star-like spread, oscillating distances, natural feel
 */
export const woodenPatternWildStarOrganic1 = [
  // Stellar explosion - oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 15,  distance: 0.059, size: 1.800, speed: 0.88, alpha: 1.0 },   // 🔥 Close
  { angle: 45,  distance: 0.212, size: 1.320, speed: 1.02, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 75,  distance: 0.108, size: 1.680, speed: 0.92, alpha: 1.0 }, // 🔥 Close
  { angle: 105, distance: 0.235, size: 1.200, speed: 1.08, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 135, distance: 0.078, size: 1.560, speed: 0.95, alpha: 1.0 }, // 🔥 Close
  { angle: 165, distance: 0.196, size: 1.440, speed: 1.05, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 195, distance: 0.243, size: 1.800, speed: 0.98, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 225, distance: 0.069, size: 1.320, speed: 1.12, alpha: 1.0 },  // 🔥 Close
  { angle: 255, distance: 0.186, size: 1.500, speed: 1.0, alpha: 1.0 }, // 🔥 Mid-far
  { angle: 285, distance: 0.251, size: 1.140, speed: 1.18, alpha: 1.0 }, // 🔥 Very far (20% closer)
  { angle: 315, distance: 0.049, size: 1.260, speed: 0.92, alpha: 1.0 }, // 🔥 Very close
  { angle: 345, distance: 0.204, size: 1.380, speed: 1.25, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 30,  distance: 0.118, size: 1.176, speed: 1.03, alpha: 1.0 }, // 🔥 Close
  { angle: 60,  distance: 0.227, size: 1.296, speed: 1.15, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 90,  distance: 0.098, size: 1.464, speed: 0.96, alpha: 1.0 }, // 🔥 Close
  { angle: 120, distance: 0.274, size: 1.344, speed: 1.08, alpha: 1.0 }, // 🔥 Very far (20% closer)
  { angle: 150, distance: 0.078, size: 1.260, speed: 1.12, alpha: 1.0 }, // 🔥 Close
  { angle: 180, distance: 0.188, size: 1.416, speed: 0.99, alpha: 1.0 }  // 🔥 Far (20% closer)
];

/**
 * ⭐ WILD STAR ORGANIC PATTERN 2: "Radiant Burst" - For wild star merges
 * Perfect for: Wild star merge 6 (wild + ordinary)
 * Shards: 20 shards with radiant, organic distribution
 * Style: Radiant spread, random angles, oscillating distances
 */
export const woodenPatternWildStarOrganic2 = [
  // Radiant burst - random angles, oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 12,  distance: 0.059, size: 1.680, speed: 0.93, alpha: 1.0 },   // 🔥 Close
  { angle: 51,  distance: 0.212, size: 1.380, speed: 1.08, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 89,  distance: 0.108, size: 1.740, speed: 0.97, alpha: 1.0 }, // 🔥 Close
  { angle: 127, distance: 0.235, size: 1.260, speed: 1.15, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 165, distance: 0.078, size: 1.500, speed: 0.88, alpha: 1.0 },  // 🔥 Close
  { angle: 203, distance: 0.225, size: 1.560, speed: 1.02, alpha: 1.0 },  // 🔥 Mid-far
  { angle: 241, distance: 0.196, size: 1.416, speed: 0.96, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 279, distance: 0.078, size: 1.584, speed: 1.02, alpha: 1.0 }, // 🔥 Close
  { angle: 317, distance: 0.258, size: 1.296, speed: 1.11, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 355, distance: 0.049, size: 1.464, speed: 0.94, alpha: 1.0 },  // 🔥 Very close
  { angle: 33,  distance: 0.196, size: 1.380, speed: 1.05, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 71,  distance: 0.069, size: 1.344, speed: 1.05, alpha: 1.0 },  // 🔥 Close
  { angle: 109, distance: 0.243, size: 1.500, speed: 0.92, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 147, distance: 0.088, size: 1.260, speed: 1.18, alpha: 1.0 },   // 🔥 Close
  { angle: 185, distance: 0.204, size: 1.440, speed: 0.98, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 223, distance: 0.118, size: 1.620, speed: 0.99, alpha: 1.0 },  // 🔥 Close
  { angle: 261, distance: 0.266, size: 1.296, speed: 1.22, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 299, distance: 0.059, size: 1.416, speed: 1.03, alpha: 1.0 }, // 🔥 Close
  { angle: 337, distance: 0.227, size: 1.536, speed: 0.91, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 18,  distance: 0.098, size: 1.464, speed: 1.08, alpha: 1.0 }  // 🔥 Close
];

/**
 * ⭐ WILD STAR ORGANIC PATTERN 3: "Cosmic Spread" - For wild star merges
 * Perfect for: Wild star merge 6 (wild + ordinary)
 * Shards: 19 shards with cosmic, organic distribution
 * Style: Cosmic spread, varied angles, natural feel
 */
export const woodenPatternWildStarOrganic3 = [
  // Cosmic spread - varied angles, oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 8,   distance: 0.049, size: 1.620, speed: 0.87, alpha: 1.0 },  // 🔥 Very close
  { angle: 38,  distance: 0.251, size: 1.296, speed: 1.12, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 68,  distance: 0.078, size: 1.776, speed: 0.94, alpha: 1.0 },  // 🔥 Close
  { angle: 98,  distance: 0.219, size: 1.416, speed: 1.22, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 128, distance: 0.059, size: 1.260, speed: 0.91, alpha: 1.0 },  // 🔥 Close
  { angle: 158, distance: 0.235, size: 1.500, speed: 1.08, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 188, distance: 0.108, size: 1.584, speed: 1.19, alpha: 1.0 }, // 🔥 Close
  { angle: 218, distance: 0.274, size: 1.344, speed: 1.03, alpha: 1.0 },  // 🔥 Very far (20% closer)
  { angle: 248, distance: 0.069, size: 1.704, speed: 0.96, alpha: 1.0 }, // 🔥 Close
  { angle: 278, distance: 0.212, size: 1.224, speed: 1.28, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 308, distance: 0.088, size: 1.464, speed: 0.99, alpha: 1.0 }, // 🔥 Close
  { angle: 338, distance: 0.258, size: 1.656, speed: 1.14, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 23,  distance: 0.039, size: 1.296, speed: 0.89, alpha: 1.0 },   // 🔥 Very close
  { angle: 53,  distance: 0.204, size: 1.536, speed: 1.07, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 83,  distance: 0.118, size: 1.380, speed: 1.25, alpha: 1.0 }, // 🔥 Close
  { angle: 113, distance: 0.243, size: 1.536, speed: 0.93, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 143, distance: 0.078, size: 1.380, speed: 1.16, alpha: 1.0 }, // 🔥 Close
  { angle: 173, distance: 0.227, size: 1.584, speed: 1.01, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 203, distance: 0.059, size: 1.296, speed: 1.09, alpha: 1.0 }  // 🔥 Close
];

/**
 * 🍺 WILD BEER ORGANIC PATTERN 1: "Juice Explosion" - For wild beer merges
 * Perfect for: Wild beer merge 6 (wild-beer + ordinary)
 * Shards: 18 shards with juice-like, organic distribution
 * Style: Juice explosion, oscillating distances, natural feel
 */
export const woodenPatternWildBeerOrganic1 = [
  // Juice explosion - oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 22,  distance: 0.059, size: 1.800, speed: 0.88, alpha: 1.0 },   // 🔥 Close
  { angle: 56,  distance: 0.212, size: 1.320, speed: 1.02, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 90,  distance: 0.108, size: 1.680, speed: 0.92, alpha: 1.0 }, // 🔥 Close
  { angle: 124, distance: 0.235, size: 1.200, speed: 1.08, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 158, distance: 0.078, size: 1.560, speed: 0.95, alpha: 1.0 }, // 🔥 Close
  { angle: 192, distance: 0.196, size: 1.440, speed: 1.05, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 226, distance: 0.243, size: 1.800, speed: 0.98, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 260, distance: 0.069, size: 1.320, speed: 1.12, alpha: 1.0 },  // 🔥 Close
  { angle: 294, distance: 0.186, size: 1.500, speed: 1.0, alpha: 1.0 }, // 🔥 Mid-far
  { angle: 328, distance: 0.251, size: 1.140, speed: 1.18, alpha: 1.0 }, // 🔥 Very far (20% closer)
  { angle: 2,   distance: 0.049, size: 1.260, speed: 0.92, alpha: 1.0 }, // 🔥 Very close
  { angle: 36,  distance: 0.204, size: 1.380, speed: 1.25, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 70,  distance: 0.118, size: 1.176, speed: 1.03, alpha: 1.0 }, // 🔥 Close
  { angle: 104, distance: 0.227, size: 1.296, speed: 1.15, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 138, distance: 0.098, size: 1.464, speed: 0.96, alpha: 1.0 }, // 🔥 Close
  { angle: 172, distance: 0.274, size: 1.344, speed: 1.08, alpha: 1.0 }, // 🔥 Very far (20% closer)
  { angle: 206, distance: 0.078, size: 1.260, speed: 1.12, alpha: 1.0 }, // 🔥 Close
  { angle: 240, distance: 0.188, size: 1.416, speed: 0.99, alpha: 1.0 }  // 🔥 Far (20% closer)
];

/**
 * 🍺 WILD BEER ORGANIC PATTERN 2: "Bubbly Burst" - For wild beer merges
 * Perfect for: Wild beer merge 6 (wild-beer + ordinary)
 * Shards: 20 shards with bubbly, organic distribution
 * Style: Bubbly spread, random angles, oscillating distances
 */
export const woodenPatternWildBeerOrganic2 = [
  // Bubbly burst - random angles, oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 14,  distance: 0.059, size: 1.680, speed: 0.93, alpha: 1.0 },   // 🔥 Close
  { angle: 48,  distance: 0.212, size: 1.380, speed: 1.08, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 82,  distance: 0.108, size: 1.740, speed: 0.97, alpha: 1.0 }, // 🔥 Close
  { angle: 116, distance: 0.235, size: 1.260, speed: 1.15, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 150, distance: 0.078, size: 1.500, speed: 0.88, alpha: 1.0 },  // 🔥 Close
  { angle: 184, distance: 0.225, size: 1.560, speed: 1.02, alpha: 1.0 },  // 🔥 Mid-far
  { angle: 218, distance: 0.196, size: 1.416, speed: 0.96, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 252, distance: 0.078, size: 1.584, speed: 1.02, alpha: 1.0 }, // 🔥 Close
  { angle: 286, distance: 0.258, size: 1.296, speed: 1.11, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 320, distance: 0.049, size: 1.464, speed: 0.94, alpha: 1.0 },  // 🔥 Very close
  { angle: 354, distance: 0.196, size: 1.380, speed: 1.05, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 28,  distance: 0.069, size: 1.344, speed: 1.05, alpha: 1.0 },  // 🔥 Close
  { angle: 62,  distance: 0.243, size: 1.500, speed: 0.92, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 96,  distance: 0.088, size: 1.260, speed: 1.18, alpha: 1.0 },   // 🔥 Close
  { angle: 130, distance: 0.204, size: 1.440, speed: 0.98, alpha: 1.0 },  // 🔥 Far (20% closer)
  { angle: 164, distance: 0.118, size: 1.620, speed: 0.99, alpha: 1.0 },  // 🔥 Close
  { angle: 198, distance: 0.266, size: 1.296, speed: 1.22, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 232, distance: 0.059, size: 1.416, speed: 1.03, alpha: 1.0 }, // 🔥 Close
  { angle: 266, distance: 0.227, size: 1.536, speed: 0.91, alpha: 1.0 }  // 🔥 Far (20% closer)
];

/**
 * 🍺 WILD BEER ORGANIC PATTERN 3: "Fizzy Spread" - For wild beer merges
 * Perfect for: Wild beer merge 6 (wild-beer + ordinary)
 * Shards: 19 shards with fizzy, organic distribution
 * Style: Fizzy spread, varied angles, natural feel
 */
export const woodenPatternWildBeerOrganic3 = [
  // Fizzy spread - varied angles, oscillating distances (40%+ increase, far ones 20% closer)
  { angle: 11,  distance: 0.049, size: 1.620, speed: 0.87, alpha: 1.0 },  // 🔥 Very close
  { angle: 41,  distance: 0.251, size: 1.296, speed: 1.12, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 71,  distance: 0.078, size: 1.776, speed: 0.94, alpha: 1.0 },  // 🔥 Close
  { angle: 101, distance: 0.219, size: 1.416, speed: 1.22, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 131, distance: 0.059, size: 1.260, speed: 0.91, alpha: 1.0 },  // 🔥 Close
  { angle: 161, distance: 0.235, size: 1.500, speed: 1.08, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 191, distance: 0.108, size: 1.584, speed: 1.19, alpha: 1.0 }, // 🔥 Close
  { angle: 221, distance: 0.274, size: 1.344, speed: 1.03, alpha: 1.0 },  // 🔥 Very far (20% closer)
  { angle: 251, distance: 0.069, size: 1.704, speed: 0.96, alpha: 1.0 }, // 🔥 Close
  { angle: 281, distance: 0.212, size: 1.224, speed: 1.28, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 311, distance: 0.088, size: 1.464, speed: 0.99, alpha: 1.0 }, // 🔥 Close
  { angle: 341, distance: 0.258, size: 1.656, speed: 1.14, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 26,  distance: 0.039, size: 1.296, speed: 0.89, alpha: 1.0 },   // 🔥 Very close
  { angle: 56,  distance: 0.204, size: 1.536, speed: 1.07, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 86,  distance: 0.118, size: 1.380, speed: 1.25, alpha: 1.0 }, // 🔥 Close
  { angle: 116, distance: 0.243, size: 1.536, speed: 0.93, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 146, distance: 0.078, size: 1.380, speed: 1.16, alpha: 1.0 }, // 🔥 Close
  { angle: 176, distance: 0.227, size: 1.584, speed: 1.01, alpha: 1.0 }, // 🔥 Far (20% closer)
  { angle: 206, distance: 0.059, size: 1.296, speed: 1.09, alpha: 1.0 }  // 🔥 Close
];

/**
 * ⭐ WILD STAR ORGANIC PATTERN 4: "Nova Burst" - For wild star merges
 * Perfect for: Wild star merge 6 (wild + ordinary)
 * Shards: 20 shards with nova-like, organic distribution
 * Style: Nova explosion, varied distances, natural feel
 */
export const woodenPatternWildStarOrganic4 = [
  // Nova burst - varied angles, oscillating distances (40%+ increase, far ones 20% closer) - 🔥 USER REQUEST: 20% larger shards
  { angle: 5,   distance: 0.071, size: 1.62, speed: 0.85, alpha: 1.0 },  // 🔥 Close
  { angle: 35,  distance: 0.254, size: 1.296, speed: 1.15, alpha: 1.0 }, // 🔥 Far
  { angle: 65,  distance: 0.130, size: 1.776, speed: 0.90, alpha: 1.0 },  // 🔥 Close
  { angle: 95,  distance: 0.263, size: 1.416, speed: 1.25, alpha: 1.0 }, // 🔥 Far
  { angle: 125, distance: 0.071, size: 1.26, speed: 0.88, alpha: 1.0 },  // 🔥 Close
  { angle: 155, distance: 0.282, size: 1.5, speed: 1.10, alpha: 1.0 }, // 🔥 Far
  { angle: 185, distance: 0.130, size: 1.584, speed: 1.22, alpha: 1.0 }, // 🔥 Close
  { angle: 215, distance: 0.329, size: 1.344, speed: 1.05, alpha: 1.0 },  // 🔥 Very far
  { angle: 245, distance: 0.083, size: 1.704, speed: 0.93, alpha: 1.0 }, // 🔥 Close
  { angle: 275, distance: 0.254, size: 1.224, speed: 1.30, alpha: 1.0 }, // 🔥 Far
  { angle: 305, distance: 0.106, size: 1.464, speed: 0.97, alpha: 1.0 }, // 🔥 Close
  { angle: 335, distance: 0.310, size: 1.656, speed: 1.17, alpha: 1.0 }, // 🔥 Far
  { angle: 20,  distance: 0.047, size: 1.296, speed: 0.87, alpha: 1.0 },   // 🔥 Very close
  { angle: 50,  distance: 0.245, size: 1.536, speed: 1.08, alpha: 1.0 }, // 🔥 Far
  { angle: 80,  distance: 0.142, size: 1.38, speed: 1.28, alpha: 1.0 }, // 🔥 Close
  { angle: 110, distance: 0.292, size: 1.536, speed: 0.95, alpha: 1.0 }, // 🔥 Far
  { angle: 140, distance: 0.094, size: 1.38, speed: 1.19, alpha: 1.0 }, // 🔥 Close
  { angle: 170, distance: 0.272, size: 1.584, speed: 1.02, alpha: 1.0 }, // 🔥 Far
  { angle: 200, distance: 0.071, size: 1.296, speed: 1.11, alpha: 1.0 }, // 🔥 Close
  { angle: 230, distance: 0.245, size: 1.44, speed: 0.99, alpha: 1.0 }  // 🔥 Far
];

/**
 * ⭐ WILD STAR ORGANIC PATTERN 5: "Galactic Spread" - For wild star merges
 * Perfect for: Wild star merge 6 (wild + ordinary)
 * Shards: 19 shards with galactic, organic distribution
 * Style: Galactic spread, varied angles, natural feel
 */
export const woodenPatternWildStarOrganic5 = [
  // Galactic spread - varied angles, oscillating distances (40%+ increase, far ones 20% closer) - 🔥 USER REQUEST: 20% larger shards
  { angle: 7,   distance: 0.059, size: 1.62, speed: 0.84, alpha: 1.0 },  // 🔥 Very close
  { angle: 37,  distance: 0.301, size: 1.296, speed: 1.13, alpha: 1.0 }, // 🔥 Far
  { angle: 67,  distance: 0.094, size: 1.776, speed: 0.91, alpha: 1.0 },  // 🔥 Close
  { angle: 97,  distance: 0.263, size: 1.416, speed: 1.23, alpha: 1.0 }, // 🔥 Far
  { angle: 127, distance: 0.071, size: 1.26, speed: 0.89, alpha: 1.0 },  // 🔥 Close
  { angle: 157, distance: 0.282, size: 1.5, speed: 1.09, alpha: 1.0 }, // 🔥 Far
  { angle: 187, distance: 0.130, size: 1.584, speed: 1.21, alpha: 1.0 }, // 🔥 Close
  { angle: 217, distance: 0.329, size: 1.344, speed: 1.04, alpha: 1.0 },  // 🔥 Very far
  { angle: 247, distance: 0.083, size: 1.704, speed: 0.94, alpha: 1.0 }, // 🔥 Close
  { angle: 277, distance: 0.254, size: 1.224, speed: 1.29, alpha: 1.0 }, // 🔥 Far
  { angle: 307, distance: 0.106, size: 1.464, speed: 0.98, alpha: 1.0 }, // 🔥 Close
  { angle: 337, distance: 0.310, size: 1.656, speed: 1.16, alpha: 1.0 }, // 🔥 Far
  { angle: 25,  distance: 0.047, size: 1.296, speed: 0.88, alpha: 1.0 },   // 🔥 Very close
  { angle: 55,  distance: 0.245, size: 1.536, speed: 1.09, alpha: 1.0 }, // 🔥 Far
  { angle: 85,  distance: 0.142, size: 1.38, speed: 1.27, alpha: 1.0 }, // 🔥 Close
  { angle: 115, distance: 0.292, size: 1.536, speed: 0.94, alpha: 1.0 }, // 🔥 Far
  { angle: 145, distance: 0.094, size: 1.38, speed: 1.18, alpha: 1.0 }, // 🔥 Close
  { angle: 175, distance: 0.272, size: 1.584, speed: 1.03, alpha: 1.0 }, // 🔥 Far
  { angle: 205, distance: 0.071, size: 1.296, speed: 1.10, alpha: 1.0 }  // 🔥 Close
];

/**
 * 🍺 WILD BEER ORGANIC PATTERN 4: "Splash Burst" - For wild beer merges
 * Perfect for: Wild beer merge 6 (wild-beer + ordinary)
 * Shards: 20 shards with splash-like, organic distribution
 * Style: Splash explosion, varied distances, natural feel
 */
export const woodenPatternWildBeerOrganic4 = [
  // Splash burst - varied angles, oscillating distances (40%+ increase, far ones 20% closer) - 🔥 USER REQUEST: 20% larger shards
  { angle: 6,   distance: 0.071, size: 1.62, speed: 0.86, alpha: 1.0 },  // 🔥 Close
  { angle: 36,  distance: 0.254, size: 1.296, speed: 1.14, alpha: 1.0 }, // 🔥 Far
  { angle: 66,  distance: 0.130, size: 1.776, speed: 0.91, alpha: 1.0 },  // 🔥 Close
  { angle: 96,  distance: 0.263, size: 1.416, speed: 1.24, alpha: 1.0 }, // 🔥 Far
  { angle: 126, distance: 0.071, size: 1.26, speed: 0.90, alpha: 1.0 },  // 🔥 Close
  { angle: 156, distance: 0.282, size: 1.5, speed: 1.11, alpha: 1.0 }, // 🔥 Far
  { angle: 186, distance: 0.130, size: 1.584, speed: 1.20, alpha: 1.0 }, // 🔥 Close
  { angle: 216, distance: 0.329, size: 1.344, speed: 1.06, alpha: 1.0 },  // 🔥 Very far
  { angle: 246, distance: 0.083, size: 1.704, speed: 0.92, alpha: 1.0 }, // 🔥 Close
  { angle: 276, distance: 0.254, size: 1.224, speed: 1.31, alpha: 1.0 }, // 🔥 Far
  { angle: 306, distance: 0.106, size: 1.464, speed: 0.96, alpha: 1.0 }, // 🔥 Close
  { angle: 336, distance: 0.310, size: 1.656, speed: 1.18, alpha: 1.0 }, // 🔥 Far
  { angle: 21,  distance: 0.047, size: 1.296, speed: 0.85, alpha: 1.0 },   // 🔥 Very close
  { angle: 51,  distance: 0.245, size: 1.536, speed: 1.07, alpha: 1.0 }, // 🔥 Far
  { angle: 81,  distance: 0.142, size: 1.38, speed: 1.26, alpha: 1.0 }, // 🔥 Close
  { angle: 111, distance: 0.292, size: 1.536, speed: 0.93, alpha: 1.0 }, // 🔥 Far
  { angle: 141, distance: 0.094, size: 1.38, speed: 1.17, alpha: 1.0 }, // 🔥 Close
  { angle: 171, distance: 0.272, size: 1.584, speed: 1.04, alpha: 1.0 }, // 🔥 Far
  { angle: 201, distance: 0.071, size: 1.296, speed: 1.12, alpha: 1.0 }, // 🔥 Close
  { angle: 231, distance: 0.245, size: 1.44, speed: 1.00, alpha: 1.0 }  // 🔥 Far
];

/**
 * 🍺 WILD BEER ORGANIC PATTERN 5: "Foam Explosion" - For wild beer merges
 * Perfect for: Wild beer merge 6 (wild-beer + ordinary)
 * Shards: 19 shards with foam-like, organic distribution
 * Style: Foam explosion, varied angles, natural feel
 */
export const woodenPatternWildBeerOrganic5 = [
  // Foam explosion - varied angles, oscillating distances (40%+ increase, far ones 20% closer) - 🔥 USER REQUEST: 20% larger shards
  { angle: 9,   distance: 0.059, size: 1.62, speed: 0.83, alpha: 1.0 },  // 🔥 Very close
  { angle: 39,  distance: 0.301, size: 1.296, speed: 1.12, alpha: 1.0 }, // 🔥 Far
  { angle: 69,  distance: 0.094, size: 1.776, speed: 0.92, alpha: 1.0 },  // 🔥 Close
  { angle: 99,  distance: 0.263, size: 1.416, speed: 1.22, alpha: 1.0 }, // 🔥 Far
  { angle: 129, distance: 0.071, size: 1.26, speed: 0.91, alpha: 1.0 },  // 🔥 Close
  { angle: 159, distance: 0.282, size: 1.5, speed: 1.10, alpha: 1.0 }, // 🔥 Far
  { angle: 189, distance: 0.130, size: 1.584, speed: 1.19, alpha: 1.0 }, // 🔥 Close
  { angle: 219, distance: 0.329, size: 1.344, speed: 1.05, alpha: 1.0 },  // 🔥 Very far
  { angle: 249, distance: 0.083, size: 1.704, speed: 0.95, alpha: 1.0 }, // 🔥 Close
  { angle: 279, distance: 0.254, size: 1.224, speed: 1.30, alpha: 1.0 }, // 🔥 Far
  { angle: 309, distance: 0.106, size: 1.464, speed: 0.99, alpha: 1.0 }, // 🔥 Close
  { angle: 339, distance: 0.310, size: 1.656, speed: 1.15, alpha: 1.0 }, // 🔥 Far
  { angle: 24,  distance: 0.047, size: 1.296, speed: 0.86, alpha: 1.0 },   // 🔥 Very close
  { angle: 54,  distance: 0.245, size: 1.536, speed: 1.08, alpha: 1.0 }, // 🔥 Far
  { angle: 84,  distance: 0.142, size: 1.38, speed: 1.25, alpha: 1.0 }, // 🔥 Close
  { angle: 114, distance: 0.292, size: 1.536, speed: 0.96, alpha: 1.0 }, // 🔥 Far
  { angle: 144, distance: 0.094, size: 1.38, speed: 1.16, alpha: 1.0 }, // 🔥 Close
  { angle: 174, distance: 0.272, size: 1.584, speed: 1.02, alpha: 1.0 }, // 🔥 Far
  { angle: 204, distance: 0.071, size: 1.296, speed: 1.11, alpha: 1.0 }  // 🔥 Close
];

/**
 * 🧲 WILD MAGNET DRAG PATTERN 1: "Organic Trail" - For wild magnet drag particles
 * Perfect for: Wild magnet drag and idle particles
 * Particles: 20 particles with organic, varied distribution
 */
export const woodenPatternWildMagnetDrag1 = [
  { angle: 0,   distance: 0.10, size: 1.0, speed: 1.0, alpha: 1.0 },
  { angle: 18,  distance: 0.12, size: 0.9, speed: 1.1, alpha: 1.0 },
  { angle: 36,  distance: 0.11, size: 1.1, speed: 0.9, alpha: 1.0 },
  { angle: 54,  distance: 0.13, size: 0.8, speed: 1.2, alpha: 1.0 },
  { angle: 72,  distance: 0.09, size: 1.2, speed: 1.05, alpha: 1.0 },
  { angle: 90,  distance: 0.14, size: 0.95, speed: 0.95, alpha: 1.0 },
  { angle: 108, distance: 0.08, size: 1.15, speed: 1.15, alpha: 1.0 },
  { angle: 126, distance: 0.15, size: 0.85, speed: 1.0, alpha: 1.0 },
  { angle: 144, distance: 0.10, size: 1.05, speed: 1.1, alpha: 1.0 },
  { angle: 162, distance: 0.12, size: 0.9, speed: 0.9, alpha: 1.0 },
  { angle: 180, distance: 0.11, size: 1.1, speed: 1.2, alpha: 1.0 },
  { angle: 198, distance: 0.13, size: 0.8, speed: 1.0, alpha: 1.0 },
  { angle: 216, distance: 0.09, size: 1.2, speed: 1.05, alpha: 1.0 },
  { angle: 234, distance: 0.14, size: 0.95, speed: 0.95, alpha: 1.0 },
  { angle: 252, distance: 0.08, size: 1.15, speed: 1.15, alpha: 1.0 },
  { angle: 270, distance: 0.15, size: 0.85, speed: 1.0, alpha: 1.0 },
  { angle: 288, distance: 0.10, size: 1.05, speed: 1.1, alpha: 1.0 },
  { angle: 306, distance: 0.12, size: 0.9, speed: 0.9, alpha: 1.0 },
  { angle: 324, distance: 0.11, size: 1.1, speed: 1.2, alpha: 1.0 },
  { angle: 342, distance: 0.13, size: 0.8, speed: 1.0, alpha: 1.0 }
];

/**
 * 🧲 WILD MAGNET DRAG PATTERN 2: "Scattered Burst" - For wild magnet drag particles
 * Perfect for: Wild magnet drag and idle particles (alternative pattern)
 * Particles: 18 particles with scattered, chaotic distribution
 */
export const woodenPatternWildMagnetDrag2 = [
  { angle: 15,  distance: 0.12, size: 1.1, speed: 1.1, alpha: 1.0 },
  { angle: 45,  distance: 0.08, size: 0.9, speed: 0.95, alpha: 1.0 },
  { angle: 75,  distance: 0.15, size: 1.2, speed: 1.2, alpha: 1.0 },
  { angle: 105, distance: 0.10, size: 1.0, speed: 1.0, alpha: 1.0 },
  { angle: 135, distance: 0.13, size: 0.85, speed: 1.15, alpha: 1.0 },
  { angle: 165, distance: 0.09, size: 1.15, speed: 0.9, alpha: 1.0 },
  { angle: 195, distance: 0.14, size: 1.05, speed: 1.1, alpha: 1.0 },
  { angle: 225, distance: 0.11, size: 0.95, speed: 1.05, alpha: 1.0 },
  { angle: 255, distance: 0.12, size: 1.1, speed: 0.95, alpha: 1.0 },
  { angle: 285, distance: 0.08, size: 0.9, speed: 1.2, alpha: 1.0 },
  { angle: 315, distance: 0.15, size: 1.2, speed: 1.0, alpha: 1.0 },
  { angle: 345, distance: 0.10, size: 1.0, speed: 1.1, alpha: 1.0 },
  { angle: 30,  distance: 0.13, size: 0.85, speed: 1.15, alpha: 1.0 },
  { angle: 60,  distance: 0.09, size: 1.15, speed: 0.9, alpha: 1.0 },
  { angle: 120, distance: 0.14, size: 1.05, speed: 1.1, alpha: 1.0 },
  { angle: 150, distance: 0.11, size: 0.95, speed: 1.05, alpha: 1.0 },
  { angle: 240, distance: 0.12, size: 1.1, speed: 0.95, alpha: 1.0 },
  { angle: 300, distance: 0.08, size: 0.9, speed: 1.2, alpha: 1.0 }
];

/**
 * 🧲 WILD MAGNET DRAG PATTERN 3: "Radial Flow" - For wild magnet drag particles
 * Perfect for: Wild magnet drag and idle particles (alternative pattern)
 * Particles: 22 particles with radial, flowing distribution
 */
export const woodenPatternWildMagnetDrag3 = [
  { angle: 0,   distance: 0.10, size: 1.0, speed: 1.0, alpha: 1.0 },
  { angle: 16,  distance: 0.12, size: 0.95, speed: 1.05, alpha: 1.0 },
  { angle: 32,  distance: 0.11, size: 1.05, speed: 0.95, alpha: 1.0 },
  { angle: 48,  distance: 0.13, size: 0.9, speed: 1.1, alpha: 1.0 },
  { angle: 64,  distance: 0.09, size: 1.1, speed: 1.0, alpha: 1.0 },
  { angle: 80,  distance: 0.14, size: 0.85, speed: 1.15, alpha: 1.0 },
  { angle: 96,  distance: 0.08, size: 1.15, speed: 0.9, alpha: 1.0 },
  { angle: 112, distance: 0.15, size: 1.0, speed: 1.2, alpha: 1.0 },
  { angle: 128, distance: 0.10, size: 0.9, speed: 1.05, alpha: 1.0 },
  { angle: 144, distance: 0.12, size: 1.1, speed: 0.95, alpha: 1.0 },
  { angle: 160, distance: 0.11, size: 0.95, speed: 1.1, alpha: 1.0 },
  { angle: 176, distance: 0.13, size: 1.05, speed: 1.0, alpha: 1.0 },
  { angle: 192, distance: 0.09, size: 0.9, speed: 1.15, alpha: 1.0 },
  { angle: 208, distance: 0.14, size: 1.1, speed: 0.9, alpha: 1.0 },
  { angle: 224, distance: 0.08, size: 0.95, speed: 1.2, alpha: 1.0 },
  { angle: 240, distance: 0.15, size: 1.0, speed: 1.05, alpha: 1.0 },
  { angle: 256, distance: 0.10, size: 0.9, speed: 0.95, alpha: 1.0 },
  { angle: 272, distance: 0.12, size: 1.1, speed: 1.1, alpha: 1.0 },
  { angle: 288, distance: 0.11, size: 0.85, speed: 1.0, alpha: 1.0 },
  { angle: 304, distance: 0.13, size: 1.15, speed: 1.15, alpha: 1.0 },
  { angle: 320, distance: 0.09, size: 0.95, speed: 0.9, alpha: 1.0 },
  { angle: 336, distance: 0.14, size: 1.05, speed: 1.2, alpha: 1.0 }
];

/**
 * Pattern 2: "BURST" - Vertical emphasis, upward burst
 * Perfect for: Regular merge 6 (alternative pattern)
 * Shards: 12 shards with vertical emphasis
 */
export const woodenPatternBurst = [
  // Top cluster (4 shards) - 🔥 FIX: Increased distances
  { angle: 75,  distance: 0.12, size: 1.4, speed: 1.2, alpha: 1.0 },
  { angle: 90,  distance: 0.20, size: 1.5, speed: 1.3, alpha: 1.0 },
  { angle: 105, distance: 0.12, size: 1.3, speed: 1.2, alpha: 1.0 },
  { angle: 90,  distance: 0.10, size: 1.2, speed: 1.0, alpha: 1.0 },
  
  // Side clusters (4 shards) - 🔥 FIX: Increased distances
  { angle: 30,  distance: 0.15, size: 1.1, speed: 1.0, alpha: 1.0 },
  { angle: 150, distance: 0.15, size: 1.1, speed: 1.0, alpha: 1.0 },
  { angle: 330, distance: 0.18, size: 1.0, speed: 1.1, alpha: 1.0 },
  { angle: 210, distance: 0.18, size: 1.0, speed: 1.1, alpha: 1.0 },
  
  // Bottom cluster (4 shards) - 🔥 FIX: Increased distances
  { angle: 255, distance: 0.12, size: 1.0, speed: 0.9, alpha: 1.0 },
  { angle: 270, distance: 0.18, size: 1.1, speed: 1.0, alpha: 1.0 },
  { angle: 285, distance: 0.12, size: 1.0, speed: 0.9, alpha: 1.0 },
  { angle: 270, distance: 0.10, size: 0.9, speed: 0.85, alpha: 1.0 }
];

/**
 * Pattern 3: "SPIRAL" - Spiral arrangement, dynamic feel
 * Perfect for: Regular merge 6 (alternative pattern)
 * Shards: 12 shards in spiral pattern
 */
export const woodenPatternSpiral = [
  // 🔥 FIX: Increased distances to match non-templated spread
  { angle: 0,   distance: 0.08, size: 1.4, speed: 1.0, alpha: 1.0 },
  { angle: 30,  distance: 0.12, size: 1.3, speed: 1.05, alpha: 1.0 },
  { angle: 60,  distance: 0.16, size: 1.2, speed: 1.1, alpha: 1.0 },
  { angle: 90,  distance: 0.20, size: 1.1, speed: 1.15, alpha: 1.0 },
  { angle: 120, distance: 0.22, size: 1.0, speed: 1.2, alpha: 1.0 },
  { angle: 150, distance: 0.24, size: 0.95, speed: 1.25, alpha: 1.0 },
  { angle: 180, distance: 0.08, size: 1.3, speed: 1.0, alpha: 1.0 },
  { angle: 210, distance: 0.12, size: 1.2, speed: 1.05, alpha: 1.0 },
  { angle: 240, distance: 0.16, size: 1.1, speed: 1.1, alpha: 1.0 },
  { angle: 270, distance: 0.20, size: 1.0, speed: 1.15, alpha: 1.0 },
  { angle: 300, distance: 0.22, size: 0.95, speed: 1.2, alpha: 1.0 },
  { angle: 330, distance: 0.24, size: 0.9, speed: 1.25, alpha: 1.0 }
];

/**
 * Pattern 4: "STAR" - Star-shaped spread for wild merges
 * Perfect for: Wild star merge 6 (wild + ordinary)
 * Shards: 18 shards in star pattern with rich distribution
 */
export const woodenPatternStar = [
  // Inner star points (8 shards)
  { angle: 0,   distance: 0.15, size: 1.5, speed: 1.0, alpha: 1.0 },
  { angle: 45,  distance: 0.15, size: 1.4, speed: 0.95, alpha: 1.0 },
  { angle: 90,  distance: 0.15, size: 1.5, speed: 1.0, alpha: 1.0 },
  { angle: 135, distance: 0.15, size: 1.4, speed: 0.95, alpha: 1.0 },
  { angle: 180, distance: 0.15, size: 1.5, speed: 1.0, alpha: 1.0 },
  { angle: 225, distance: 0.15, size: 1.4, speed: 0.95, alpha: 1.0 },
  { angle: 270, distance: 0.15, size: 1.5, speed: 1.0, alpha: 1.0 },
  { angle: 315, distance: 0.15, size: 1.4, speed: 0.95, alpha: 1.0 },
  
  // Mid star points (6 shards)
  { angle: 30,  distance: 0.30, size: 1.3, speed: 1.1, alpha: 1.0 },
  { angle: 90,  distance: 0.32, size: 1.2, speed: 1.15, alpha: 1.0 },
  { angle: 150, distance: 0.30, size: 1.3, speed: 1.1, alpha: 1.0 },
  { angle: 210, distance: 0.32, size: 1.2, speed: 1.15, alpha: 1.0 },
  { angle: 270, distance: 0.30, size: 1.3, speed: 1.1, alpha: 1.0 },
  { angle: 330, distance: 0.32, size: 1.2, speed: 1.15, alpha: 1.0 },
  
  // Outer star points (4 shards)
  { angle: 0,   distance: 0.45, size: 1.0, speed: 1.2, alpha: 1.0 },
  { angle: 90,  distance: 0.48, size: 1.1, speed: 1.25, alpha: 1.0 },
  { angle: 180, distance: 0.45, size: 1.0, speed: 1.2, alpha: 1.0 },
  { angle: 270, distance: 0.48, size: 1.1, speed: 1.25, alpha: 1.0 }
];

/**
 * Pattern 5: "CONTAINED" - Tight, contained spread for wild merges
 * Perfect for: Wild star merge 6 (50% closer variant)
 * Shards: 18 shards close to tile, contained feel
 */
export const woodenPatternContained = [
  // Inner ring (8 shards) - very close
  { angle: 0,   distance: 0.08, size: 1.4, speed: 0.9, alpha: 1.0 },
  { angle: 45,  distance: 0.09, size: 1.3, speed: 0.85, alpha: 1.0 },
  { angle: 90,  distance: 0.08, size: 1.4, speed: 0.9, alpha: 1.0 },
  { angle: 135, distance: 0.09, size: 1.3, speed: 0.85, alpha: 1.0 },
  { angle: 180, distance: 0.08, size: 1.4, speed: 0.9, alpha: 1.0 },
  { angle: 225, distance: 0.09, size: 1.3, speed: 0.85, alpha: 1.0 },
  { angle: 270, distance: 0.08, size: 1.4, speed: 0.9, alpha: 1.0 },
  { angle: 315, distance: 0.09, size: 1.3, speed: 0.85, alpha: 1.0 },
  
  // Mid ring (6 shards) - moderately close
  { angle: 30,  distance: 0.18, size: 1.2, speed: 1.0, alpha: 1.0 },
  { angle: 90,  distance: 0.20, size: 1.1, speed: 1.05, alpha: 1.0 },
  { angle: 150, distance: 0.18, size: 1.2, speed: 1.0, alpha: 1.0 },
  { angle: 210, distance: 0.20, size: 1.1, speed: 1.05, alpha: 1.0 },
  { angle: 270, distance: 0.18, size: 1.2, speed: 1.0, alpha: 1.0 },
  { angle: 330, distance: 0.20, size: 1.1, speed: 1.05, alpha: 1.0 },
  
  // Outer ring (4 shards) - still contained
  { angle: 0,   distance: 0.28, size: 1.0, speed: 1.1, alpha: 1.0 },
  { angle: 90,  distance: 0.30, size: 1.0, speed: 1.15, alpha: 1.0 },
  { angle: 180, distance: 0.28, size: 1.0, speed: 1.1, alpha: 1.0 },
  { angle: 270, distance: 0.30, size: 1.0, speed: 1.15, alpha: 1.0 }
];

// 🎯 Pattern Selection - Map merge types to preferred patterns
export const woodenPatternMap = {
  // Regular merge 6 (ordinary + ordinary) - rotate between 3 patterns
  regular: ['explosion', 'burst', 'spiral'],
  
  // Wild merge 6 (wild star + ordinary) - alternate between star and contained
  wild: ['star', 'contained'],
  
  // Wild-magnet merge 6 (wild-magnet + ordinary) - use 3 organic patterns (asymmetric, natural, non-uniform)
  wildMagnet: ['wildMagnetOrganic1', 'wildMagnetOrganic2', 'wildMagnetOrganic3'],
  
  // Wild-magnet pull merge 6 (after tiles are pulled) - use 3 pull-specific patterns (no overlap, organic variety)
  wildMagnetPull: ['wildMagnetPull1', 'wildMagnetPull2', 'wildMagnetPull3'],
  
  // Wild star merge 6 (wild + ordinary) - use 5 organic patterns (stellar, radiant, cosmic, nova, galactic)
  wildStar: ['wildStarOrganic1', 'wildStarOrganic2', 'wildStarOrganic3', 'wildStarOrganic4', 'wildStarOrganic5'],
  
  // Wild beer merge 6 (wild-beer + ordinary) - use 5 organic patterns (juice, bubbly, fizzy, splash, foam)
  wildBeer: ['wildBeerOrganic1', 'wildBeerOrganic2', 'wildBeerOrganic3', 'wildBeerOrganic4', 'wildBeerOrganic5'],
  
  // Wild TNT merge 6 (wild-tnt + ordinary) - reuse beer organic patterns (Explosion Pack)
  wildTnt: ['wildBeerOrganic1', 'wildBeerOrganic2', 'wildBeerOrganic3', 'wildBeerOrganic4', 'wildBeerOrganic5'],
  
  // Wild-magnet drag particles (during drag and idle) - use 3 organic patterns for variety
  wildMagnetDrag: ['wildMagnetDrag1', 'wildMagnetDrag2', 'wildMagnetDrag3']
};

// ⚙️ Wooden Parameters - Base parameters for different merge types
export const woodenParams = {
  regular: {
    // Visual
    lineWidth: 2.5,
    lineAlpha: 1.0,              // 🔥 USER REQUEST: 100% opacity
    
    // Animation timing
    travelDuration: 0.35,      // Base travel duration
    travelDurMultiplier: 0.5,  // Duration multiplier
    fadeDelay: 0.15,           // Fade start delay
    fadeDelayMultiplier: 0.1,  // Fade delay multiplier
    fadeDuration: 0.25,        // Fade duration
    ttl: 1.0,                  // Layer time to live
    
    // Visual effects
    fastFadeOut: true,         // Enable fast procedural fade
    vanishDelay: 0.0,
    vanishJitter: 0.02,
    
    // Physics
    tileSize: 96,              // Base tile size
    baseTile: 96,
    spread: 2.5,               // 50% tighter spread for regular merge 6
    shape: 'box',              // Bias shards into a more cube-like spread
    boxPower: 0.75,
    radiusBoost: 1.0,
    distanceMultiplier: 1.0
  },
  
  wild: {
    // Visual
    lineWidth: 3.0,
    lineAlpha: 0.9,
    
    // Animation timing
    travelDuration: 0.4,
    speed: 1.0,
    vanishDelay: 0.0,
    vanishJitter: 0.02,
    ttl: 1.2,
    
    // Physics
    tileSize: 96,
    baseTile: 96,
    spread: 0.7,               // 50% closer (was 1.4, reduced to 0.7)
    radiusBoost: 1.0,
    distanceMultiplier: 1.0,
    
    // Visual effects
    enhanced: true,
    intensity: 1.35
  },
  
  wildMagnet: {
    // Visual
    lineWidth: 2.5,
    lineAlpha: 1.0,              // 🔥 USER REQUEST: 100% opacity
    
    // Animation timing
    travelDuration: 0.35,
    travelDurMultiplier: 0.5,
    fadeDelay: 0.15,
    fadeDelayMultiplier: 0.1,
    fadeDuration: 0.25,
    speed: 1.0,                // 🔥 Same speed as regular merge 6 (normal speed)
    vanishDelay: 0.0,
    vanishJitter: 0.02,
    ttl: 1.0,
    
    // Physics
    tileSize: 96,
    baseTile: 96,
    spread: 6.888,             // 🔥 FIX: 18% reduced from 8.4 (8.4 * 0.82 = 6.888) - more contained, organic spread
    radiusBoost: 1.0,
    distanceMultiplier: 1.0,
    
    // Visual effects
    enhanced: true,
    intensity: 1.9
  },
  
  wildStar: {
    // Visual
    lineWidth: 3.0,
    lineAlpha: 1.0,              // 🔥 USER REQUEST: 100% opacity
    
    // Animation timing
    travelDuration: 0.4,
    travelDurMultiplier: 0.5,
    fadeDelay: 0.15,
    fadeDelayMultiplier: 0.1,
    fadeDuration: 0.25,
    speed: 1.0,
    vanishDelay: 0.0,
    vanishJitter: 0.02,
    ttl: 1.2,
    
    // Physics
    tileSize: 96,
    baseTile: 96,
    spread: 6.72,              // 🔥 USER REQUEST: 20% more spread than regular (5.6 * 1.2 = 6.72) for better organic dispersion
    radiusBoost: 1.0,
    distanceMultiplier: 1.0,
    
    // Visual effects
    enhanced: true,
    intensity: 1.35
  },
  
  wildBeer: {
    // Visual
    lineWidth: 3.0,
    lineAlpha: 1.0,              // 🔥 USER REQUEST: 100% opacity
    
    // Animation timing
    travelDuration: 0.4,
    travelDurMultiplier: 0.5,
    fadeDelay: 0.15,
    fadeDelayMultiplier: 0.1,
    fadeDuration: 0.25,
    speed: 1.0,
    vanishDelay: 0.0,
    vanishJitter: 0.02,
    ttl: 1.2,
    
    // Physics
    tileSize: 96,
    baseTile: 96,
    spread: 6.72,              // 🔥 USER REQUEST: 20% more spread than regular (5.6 * 1.2 = 6.72) for better organic dispersion
    radiusBoost: 1.0,
    distanceMultiplier: 1.0,
    
    // Visual effects
    enhanced: true,
    intensity: 1.35
  },
  
  wildTnt: {
    // Same as wildBeer (Explosion Pack - TNT merge 6)
    lineWidth: 3.0,
    lineAlpha: 1.0,
    travelDuration: 0.4,
    travelDurMultiplier: 0.5,
    fadeDelay: 0.15,
    fadeDelayMultiplier: 0.1,
    fadeDuration: 0.25,
    speed: 1.0,
    vanishDelay: 0.0,
    vanishJitter: 0.02,
    ttl: 1.2,
    tileSize: 96,
    baseTile: 96,
    spread: 6.72,
    radiusBoost: 1.0,
    distanceMultiplier: 1.0,
    enhanced: true,
    intensity: 1.35
  },
  
  wildMagnetDrag: {
    // Visual
    lineWidth: 2.5,
    lineAlpha: 1.0,              // 100% opacity
    
    // Animation timing
    travelDuration: 0.3,
    speed: 1.0,
    vanishDelay: 0.0,
    vanishJitter: 0.02,
    ttl: 0.6,                    // Shorter TTL for drag particles (they fade quickly)
    
    // Physics
    tileSize: 96,
    baseTile: 96,
    spread: 1.12,                 // 🔥 USER REQUEST: 60% more spread (0.7 * 1.6 = 1.12) - particles more spread out from center
    radiusBoost: 1.0,
    distanceMultiplier: 1.0,
    
    // Visual effects
    enhanced: true,
    intensity: 1.0
  }
};

// 📦 Export complete wooden template
export const woodenTemplate = {
  name: 'wooden',
  displayName: '🪵 Wooden (Original)',
  colors: woodenColors,
  dragParticleColors: woodenDragParticleColors, // 🔥 NEW: Drag particle color palettes
  bubbleColors: woodenBubbleColors, // 🔥 FIX: Bubble colors for wild-beer bubbles explosion
  patterns: {
    explosion: woodenPatternExplosion,
    burst: woodenPatternBurst,
    spiral: woodenPatternSpiral,
    star: woodenPatternStar,
    contained: woodenPatternContained,
    wildMagnetOrganic1: woodenPatternWildMagnetOrganic1,
    wildMagnetOrganic2: woodenPatternWildMagnetOrganic2,
    wildMagnetOrganic3: woodenPatternWildMagnetOrganic3,
    wildMagnetPull1: woodenPatternWildMagnetPull1,
    wildMagnetPull2: woodenPatternWildMagnetPull2,
    wildMagnetPull3: woodenPatternWildMagnetPull3,
    wildStarOrganic1: woodenPatternWildStarOrganic1,
    wildStarOrganic2: woodenPatternWildStarOrganic2,
    wildStarOrganic3: woodenPatternWildStarOrganic3,
    wildStarOrganic4: woodenPatternWildStarOrganic4,
    wildStarOrganic5: woodenPatternWildStarOrganic5,
    wildBeerOrganic1: woodenPatternWildBeerOrganic1,
    wildBeerOrganic2: woodenPatternWildBeerOrganic2,
    wildBeerOrganic3: woodenPatternWildBeerOrganic3,
    wildBeerOrganic4: woodenPatternWildBeerOrganic4,
    wildBeerOrganic5: woodenPatternWildBeerOrganic5,
    wildMagnetDrag1: woodenPatternWildMagnetDrag1,
    wildMagnetDrag2: woodenPatternWildMagnetDrag2,
    wildMagnetDrag3: woodenPatternWildMagnetDrag3
  },
  patternMap: woodenPatternMap,
  params: woodenParams
};

export default woodenTemplate;

