/**
 * 🪵 WOODEN TEMPLATE - Original OG Style
 * 
 * This is the original "wooden" visual style for cube-crash.
 * All colors, patterns, and parameters are defined here for easy theming.
 */

// 🎨 Wooden Colors
export const woodenColors = {
  regular: 0xD4A584,     // Brown - for regular tile merges
  wild: 0xFFCB47,        // Yellow (#FFCB47) - for wild star merges
  wildMagnet: 0xF26034,  // Red (#F26034) - for wild magnet merges
  smoke: 0xFFFFFF        // White smoke for wild effects
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
  { angle: 30,  distance: 0.20, size: 1.0, speed: 1.1, alpha: 0.95 },
  { angle: 90,  distance: 0.24, size: 1.1, speed: 1.15, alpha: 0.9 },
  { angle: 150, distance: 0.18, size: 0.9, speed: 1.0, alpha: 0.95 },
  { angle: 210, distance: 0.22, size: 1.0, speed: 1.1, alpha: 0.9 },
  { angle: 270, distance: 0.20, size: 1.1, speed: 1.05, alpha: 0.95 },
  { angle: 330, distance: 0.23, size: 0.95, speed: 1.1, alpha: 0.9 }
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
  { angle: 47,  distance: 0.108, size: 1.4, speed: 0.92, alpha: 0.98 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 58,  distance: 0.219, size: 1.0, speed: 1.08, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 28,  distance: 0.078, size: 1.3, speed: 0.95, alpha: 0.99 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  
  // Bottom-left cluster (dense, organic variation) - OSCILLATING distances (40%+ increase, far ones 20% closer)
  { angle: 202, distance: 0.196, size: 1.3, speed: 0.95, alpha: 1.0 },  // 🔥 Far (0.245 * 0.8 = 0.196, 20% closer)
  { angle: 213, distance: 0.088, size: 1.2, speed: 1.05, alpha: 0.97 }, // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 228, distance: 0.243, size: 1.5, speed: 0.98, alpha: 0.92 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 238, distance: 0.069, size: 1.1, speed: 1.12, alpha: 1.0 },  // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 208, distance: 0.186, size: 1.25, speed: 1.0, alpha: 0.96 }, // 🔥 Mid-far (0.133 * 1.4 = 0.186)
  
  // Sparse scattered shards (organic gaps, OSCILLATING distances) - wide range (40%+ increase, far ones 20% closer)
  { angle: 97,  distance: 0.251, size: 0.95, speed: 1.18, alpha: 0.88 }, // 🔥 Very far (0.314 * 0.8 = 0.251, 20% closer)
  { angle: 157, distance: 0.049, size: 1.05, speed: 0.92, alpha: 0.97 }, // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 277, distance: 0.204, size: 1.15, speed: 1.25, alpha: 0.87 }, // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 318, distance: 0.118, size: 0.98, speed: 1.03, alpha: 0.96 }, // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 8,   distance: 0.227, size: 1.08, speed: 1.15, alpha: 0.89 }, // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 347, distance: 0.098, size: 1.22, speed: 0.96, alpha: 0.98 }, // 🔥 Close (0.070 * 1.4 = 0.098)
  { angle: 125, distance: 0.274, size: 1.12, speed: 1.08, alpha: 0.93 }, // 🔥 Very far (0.343 * 0.8 = 0.274, 20% closer)
  { angle: 265, distance: 0.078, size: 1.05, speed: 1.12, alpha: 0.91 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 42,  distance: 0.188, size: 1.18, speed: 0.99, alpha: 0.97 }  // 🔥 Far (0.235 * 0.8 = 0.188, 20% closer)
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
  { angle: 134, distance: 0.108, size: 1.45, speed: 0.97, alpha: 0.96 }, // 🔥 Random angle, close (0.077 * 1.4 = 0.108)
  { angle: 201, distance: 0.235, size: 1.05, speed: 1.15, alpha: 0.91 }, // 🔥 Random angle, far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 256, distance: 0.078, size: 1.25, speed: 0.88, alpha: 1.0 },  // 🔥 Random angle, close (0.056 * 1.4 = 0.078)
  { angle: 312, distance: 0.225, size: 1.3, speed: 1.02, alpha: 0.98 },  // 🔥 Random angle, mid-far (0.161 * 1.4 = 0.225)
  
  // More random angles - organic spread (40%+ increase, far ones 20% closer)
  { angle: 48,  distance: 0.219, size: 1.18, speed: 0.96, alpha: 1.0 },  // 🔥 Random angle, far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 89,  distance: 0.078, size: 1.32, speed: 1.02, alpha: 0.94 }, // 🔥 Random angle, close (0.056 * 1.4 = 0.078)
  { angle: 156, distance: 0.258, size: 1.08, speed: 1.11, alpha: 0.89 }, // 🔥 Random angle, far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 223, distance: 0.049, size: 1.22, speed: 0.94, alpha: 1.0 },  // 🔥 Random angle, very close (0.035 * 1.4 = 0.049)
  { angle: 278, distance: 0.196, size: 1.15, speed: 1.05, alpha: 0.95 }, // 🔥 Random angle, far (0.245 * 0.8 = 0.196, 20% closer)
  
  // More random angles - continued organic chaos (40%+ increase, far ones 20% closer)
  { angle: 34,  distance: 0.069, size: 1.12, speed: 1.05, alpha: 1.0 },  // 🔥 Random angle, close (0.049 * 1.4 = 0.069)
  { angle: 107, distance: 0.243, size: 1.25, speed: 0.92, alpha: 0.97 }, // 🔥 Random angle, far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 181, distance: 0.088, size: 1.05, speed: 1.18, alpha: 1.0 },  // 🔥 Random angle, close (0.063 * 1.4 = 0.088)
  { angle: 245, distance: 0.204, size: 1.2, speed: 0.98, alpha: 0.99 },  // 🔥 Random angle, far (0.255 * 0.8 = 0.204, 20% closer)
  
  // Final random angles - complete organic spread (40%+ increase, far ones 20% closer)
  { angle: 62,  distance: 0.118, size: 1.35, speed: 0.99, alpha: 1.0 },  // 🔥 Random angle, close (0.084 * 1.4 = 0.118)
  { angle: 129, distance: 0.266, size: 1.08, speed: 1.22, alpha: 0.88 }, // 🔥 Random angle, far (0.333 * 0.8 = 0.266, 20% closer)
  { angle: 197, distance: 0.059, size: 1.18, speed: 1.03, alpha: 0.95 }, // 🔥 Random angle, close (0.042 * 1.4 = 0.059)
  { angle: 264, distance: 0.227, size: 1.28, speed: 0.91, alpha: 1.0 },  // 🔥 Random angle, far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 331, distance: 0.098, size: 1.22, speed: 1.08, alpha: 0.93 }  // 🔥 Random angle, close (0.070 * 1.4 = 0.098)
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
  { angle: 35,  distance: 0.251, size: 1.08, speed: 1.12, alpha: 0.96 }, // 🔥 Far (0.314 * 0.8 = 0.251, 20% closer)
  { angle: 64,  distance: 0.078, size: 1.48, speed: 0.94, alpha: 1.0 },  // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 91,  distance: 0.219, size: 1.18, speed: 1.22, alpha: 0.87 }, // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 115, distance: 0.059, size: 1.05, speed: 0.91, alpha: 1.0 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 144, distance: 0.235, size: 1.25, speed: 1.08, alpha: 0.98 }, // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 171, distance: 0.108, size: 1.32, speed: 1.19, alpha: 0.89 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 195, distance: 0.274, size: 1.12, speed: 1.03, alpha: 1.0 },  // 🔥 Very far (0.343 * 0.8 = 0.274, 20% closer)
  { angle: 224, distance: 0.069, size: 1.42, speed: 0.96, alpha: 0.94 }, // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 248, distance: 0.212, size: 1.02, speed: 1.28, alpha: 0.88 }, // 🔥 Far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 275, distance: 0.088, size: 1.22, speed: 0.99, alpha: 1.0 }, // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 301, distance: 0.258, size: 1.38, speed: 1.14, alpha: 0.97 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 329, distance: 0.039, size: 1.08, speed: 0.89, alpha: 1.0 },   // 🔥 Very close (0.028 * 1.4 = 0.039)
  { angle: 353, distance: 0.204, size: 1.28, speed: 1.07, alpha: 0.95 }, // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 49,  distance: 0.118, size: 1.15, speed: 1.25, alpha: 0.86 }, // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 19,  distance: 0.243, size: 1.28, speed: 0.93, alpha: 0.99 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 76,  distance: 0.078, size: 1.15, speed: 1.16, alpha: 0.92 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 133, distance: 0.227, size: 1.32, speed: 1.01, alpha: 0.97 }, // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 189, distance: 0.059, size: 1.08, speed: 1.09, alpha: 0.94 }, // 🔥 Close (0.042 * 1.4 = 0.059)
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
  { angle: 123, distance: 0.108, size: 1.45, speed: 0.97, alpha: 0.96 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 198, distance: 0.235, size: 1.05, speed: 1.15, alpha: 0.91 },  // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 251, distance: 0.078, size: 1.25, speed: 0.88, alpha: 1.0 },  // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 309, distance: 0.225, size: 1.3, speed: 1.02, alpha: 0.98 },  // 🔥 Mid-far (0.161 * 1.4 = 0.225)
  { angle: 45,  distance: 0.196, size: 1.18, speed: 0.96, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.196, 20% closer)
  { angle: 88,  distance: 0.078, size: 1.32, speed: 1.02, alpha: 0.94 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 152, distance: 0.258, size: 1.08, speed: 1.11, alpha: 0.89 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 221, distance: 0.049, size: 1.22, speed: 0.94, alpha: 1.0 },  // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 275, distance: 0.196, size: 1.15, speed: 1.05, alpha: 0.95 }, // 🔥 Far (0.245 * 0.8 = 0.196, 20% closer)
  { angle: 32,  distance: 0.069, size: 1.12, speed: 1.05, alpha: 1.0 },   // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 104, distance: 0.243, size: 1.25, speed: 0.92, alpha: 0.97 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 179, distance: 0.088, size: 1.05, speed: 1.18, alpha: 1.0 },   // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 243, distance: 0.204, size: 1.2, speed: 0.98, alpha: 0.99 },  // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 59,  distance: 0.118, size: 1.35, speed: 0.99, alpha: 1.0 },  // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 127, distance: 0.266, size: 1.08, speed: 1.22, alpha: 0.88 }, // 🔥 Far (0.333 * 0.8 = 0.266, 20% closer)
  { angle: 195, distance: 0.059, size: 1.18, speed: 1.03, alpha: 0.95 }  // 🔥 Close (0.042 * 1.4 = 0.059)
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
  { angle: 41,  distance: 0.251, size: 1.08, speed: 1.12, alpha: 0.96 },  // 🔥 Far (0.314 * 0.8 = 0.251, 20% closer)
  { angle: 78,  distance: 0.078, size: 1.48, speed: 0.94, alpha: 1.0 },   // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 112, distance: 0.219, size: 1.18, speed: 1.22, alpha: 0.87 },  // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 146, distance: 0.059, size: 1.05, speed: 0.91, alpha: 1.0 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 183, distance: 0.235, size: 1.25, speed: 1.08, alpha: 0.98 }, // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 217, distance: 0.108, size: 1.32, speed: 1.19, alpha: 0.89 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 254, distance: 0.274, size: 1.12, speed: 1.03, alpha: 1.0 },  // 🔥 Very far (0.343 * 0.8 = 0.274, 20% closer)
  { angle: 289, distance: 0.069, size: 1.42, speed: 0.96, alpha: 0.94 }, // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 326, distance: 0.212, size: 1.02, speed: 1.28, alpha: 0.88 }, // 🔥 Far (0.265 * 0.8 = 0.212, 20% closer)
  { angle: 23,  distance: 0.088, size: 1.22, speed: 0.99, alpha: 1.0 },  // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 56,  distance: 0.258, size: 1.38, speed: 1.14, alpha: 0.97 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 94,  distance: 0.049, size: 1.08, speed: 0.89, alpha: 1.0 },   // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 131, distance: 0.204, size: 1.28, speed: 1.07, alpha: 0.95 }, // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 168, distance: 0.118, size: 1.15, speed: 1.25, alpha: 0.86 }, // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 205, distance: 0.243, size: 1.28, speed: 0.93, alpha: 0.99 }, // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 242, distance: 0.078, size: 1.15, speed: 1.16, alpha: 0.92 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 278, distance: 0.227, size: 1.32, speed: 1.01, alpha: 0.97 }, // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
  { angle: 315, distance: 0.059, size: 1.08, speed: 1.09, alpha: 0.94 }, // 🔥 Close (0.042 * 1.4 = 0.059)
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
  { angle: 103, distance: 0.108, size: 1.45, speed: 0.97, alpha: 0.96 }, // 🔥 Close (0.077 * 1.4 = 0.108)
  { angle: 145, distance: 0.235, size: 1.05, speed: 1.15, alpha: 0.91 }, // 🔥 Far (0.294 * 0.8 = 0.235, 20% closer)
  { angle: 187, distance: 0.078, size: 1.25, speed: 0.88, alpha: 1.0 },  // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 229, distance: 0.225, size: 1.3, speed: 1.02, alpha: 0.98 },  // 🔥 Mid-far (0.161 * 1.4 = 0.225)
  { angle: 271, distance: 0.219, size: 1.18, speed: 0.96, alpha: 1.0 },  // 🔥 Far (0.274 * 0.8 = 0.219, 20% closer)
  { angle: 313, distance: 0.078, size: 1.32, speed: 1.02, alpha: 0.94 }, // 🔥 Close (0.056 * 1.4 = 0.078)
  { angle: 355, distance: 0.258, size: 1.08, speed: 1.11, alpha: 0.89 }, // 🔥 Far (0.323 * 0.8 = 0.258, 20% closer)
  { angle: 37,  distance: 0.049, size: 1.22, speed: 0.94, alpha: 1.0 },   // 🔥 Very close (0.035 * 1.4 = 0.049)
  { angle: 79,  distance: 0.196, size: 1.15, speed: 1.05, alpha: 0.95 },  // 🔥 Far (0.245 * 0.8 = 0.196, 20% closer)
  { angle: 121, distance: 0.069, size: 1.12, speed: 1.05, alpha: 1.0 },  // 🔥 Close (0.049 * 1.4 = 0.069)
  { angle: 163, distance: 0.243, size: 1.25, speed: 0.92, alpha: 0.97 },  // 🔥 Far (0.304 * 0.8 = 0.243, 20% closer)
  { angle: 205, distance: 0.088, size: 1.05, speed: 1.18, alpha: 1.0 },   // 🔥 Close (0.063 * 1.4 = 0.088)
  { angle: 247, distance: 0.204, size: 1.2, speed: 0.98, alpha: 0.99 },   // 🔥 Far (0.255 * 0.8 = 0.204, 20% closer)
  { angle: 289, distance: 0.118, size: 1.35, speed: 0.99, alpha: 1.0 },   // 🔥 Close (0.084 * 1.4 = 0.118)
  { angle: 331, distance: 0.266, size: 1.08, speed: 1.22, alpha: 0.88 }, // 🔥 Far (0.333 * 0.8 = 0.266, 20% closer)
  { angle: 13,  distance: 0.059, size: 1.18, speed: 1.03, alpha: 0.95 },  // 🔥 Close (0.042 * 1.4 = 0.059)
  { angle: 55,  distance: 0.227, size: 1.28, speed: 0.91, alpha: 1.0 }    // 🔥 Far (0.284 * 0.8 = 0.227, 20% closer)
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
  { angle: 30,  distance: 0.15, size: 1.1, speed: 1.0, alpha: 0.95 },
  { angle: 150, distance: 0.15, size: 1.1, speed: 1.0, alpha: 0.95 },
  { angle: 330, distance: 0.18, size: 1.0, speed: 1.1, alpha: 0.9 },
  { angle: 210, distance: 0.18, size: 1.0, speed: 1.1, alpha: 0.9 },
  
  // Bottom cluster (4 shards) - 🔥 FIX: Increased distances
  { angle: 255, distance: 0.12, size: 1.0, speed: 0.9, alpha: 0.95 },
  { angle: 270, distance: 0.18, size: 1.1, speed: 1.0, alpha: 0.9 },
  { angle: 285, distance: 0.12, size: 1.0, speed: 0.9, alpha: 0.95 },
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
  { angle: 60,  distance: 0.16, size: 1.2, speed: 1.1, alpha: 0.95 },
  { angle: 90,  distance: 0.20, size: 1.1, speed: 1.15, alpha: 0.95 },
  { angle: 120, distance: 0.22, size: 1.0, speed: 1.2, alpha: 0.9 },
  { angle: 150, distance: 0.24, size: 0.95, speed: 1.25, alpha: 0.9 },
  { angle: 180, distance: 0.08, size: 1.3, speed: 1.0, alpha: 1.0 },
  { angle: 210, distance: 0.12, size: 1.2, speed: 1.05, alpha: 1.0 },
  { angle: 240, distance: 0.16, size: 1.1, speed: 1.1, alpha: 0.95 },
  { angle: 270, distance: 0.20, size: 1.0, speed: 1.15, alpha: 0.95 },
  { angle: 300, distance: 0.22, size: 0.95, speed: 1.2, alpha: 0.9 },
  { angle: 330, distance: 0.24, size: 0.9, speed: 1.25, alpha: 0.9 }
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
  { angle: 30,  distance: 0.30, size: 1.3, speed: 1.1, alpha: 0.95 },
  { angle: 90,  distance: 0.32, size: 1.2, speed: 1.15, alpha: 0.95 },
  { angle: 150, distance: 0.30, size: 1.3, speed: 1.1, alpha: 0.95 },
  { angle: 210, distance: 0.32, size: 1.2, speed: 1.15, alpha: 0.95 },
  { angle: 270, distance: 0.30, size: 1.3, speed: 1.1, alpha: 0.95 },
  { angle: 330, distance: 0.32, size: 1.2, speed: 1.15, alpha: 0.95 },
  
  // Outer star points (4 shards)
  { angle: 0,   distance: 0.45, size: 1.0, speed: 1.2, alpha: 0.9 },
  { angle: 90,  distance: 0.48, size: 1.1, speed: 1.25, alpha: 0.9 },
  { angle: 180, distance: 0.45, size: 1.0, speed: 1.2, alpha: 0.9 },
  { angle: 270, distance: 0.48, size: 1.1, speed: 1.25, alpha: 0.9 }
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
  { angle: 30,  distance: 0.18, size: 1.2, speed: 1.0, alpha: 0.95 },
  { angle: 90,  distance: 0.20, size: 1.1, speed: 1.05, alpha: 0.95 },
  { angle: 150, distance: 0.18, size: 1.2, speed: 1.0, alpha: 0.95 },
  { angle: 210, distance: 0.20, size: 1.1, speed: 1.05, alpha: 0.95 },
  { angle: 270, distance: 0.18, size: 1.2, speed: 1.0, alpha: 0.95 },
  { angle: 330, distance: 0.20, size: 1.1, speed: 1.05, alpha: 0.95 },
  
  // Outer ring (4 shards) - still contained
  { angle: 0,   distance: 0.28, size: 1.0, speed: 1.1, alpha: 0.9 },
  { angle: 90,  distance: 0.30, size: 1.0, speed: 1.15, alpha: 0.9 },
  { angle: 180, distance: 0.28, size: 1.0, speed: 1.1, alpha: 0.9 },
  { angle: 270, distance: 0.30, size: 1.0, speed: 1.15, alpha: 0.9 }
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
  wildMagnetPull: ['wildMagnetPull1', 'wildMagnetPull2', 'wildMagnetPull3']
};

// ⚙️ Wooden Parameters - Base parameters for different merge types
export const woodenParams = {
  regular: {
    // Visual
    lineWidth: 2.5,
    lineAlpha: 0.85,
    
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
    spread: 5.6,               // 🔥 FIX: Distance multiplier (matches non-templated distanceMultiplier)
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
    lineAlpha: 0.85,
    
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
  }
};

// 📦 Export complete wooden template
export const woodenTemplate = {
  name: 'wooden',
  displayName: '🪵 Wooden (Original)',
  colors: woodenColors,
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
    wildMagnetPull3: woodenPatternWildMagnetPull3
  },
  patternMap: woodenPatternMap,
  params: woodenParams
};

export default woodenTemplate;

