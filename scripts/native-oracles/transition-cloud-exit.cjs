// Independent samples of the preserved PWA cloud exit through actual GSAP.
// Append this output to NativeThemedCloudOracle.swift when refreshing evidence.
const fs = require('fs');
const { execFileSync } = require('child_process');
const { gsap } = require('gsap');
const source = execFileSync('git', ['show', 'production-benchmark-v9:src/modules/board-transition-screen.ts'], { encoding: 'utf8' });
const current = fs.readFileSync('src/modules/board-transition-screen.ts', 'utf8');
function stages(text) {
  const constants = Object.fromEntries([...text.matchAll(/export const (BOARD_TRANSITION_CLOUD_EXIT_\w+_SECONDS) = ([\d.]+);/g)].map(m => [m[1], Number(m[2])]));
  return [...text.matchAll(/cloudExitTimeline\.to\(cloudExitTargets, \{\s*scaleX: ([\d.]+),\s*scaleY: ([\d.]+),\s*duration: (\w+),\s*ease: '([^']+)'/g)].map(m => ({ scaleX: Number(m[1]), scaleY: Number(m[2]), duration: constants[m[3]], ease: m[4] }));
}
const recipe = stages(source);
if (recipe.length !== 3 || JSON.stringify(recipe) !== JSON.stringify(stages(current))) throw new Error('Preserved/current PWA cloud exit recipe differs');
const ages = [...new Set([0, .035, .07, .1, .135, .35, .58, .595, .7, ...Array.from({ length: 72 }, (_, i) => i / 120)])].sort((a, b) => a - b);
const samples = [];
for (const rest of [.82, 1.03, 1.24]) {
  const pose = { scaleX: rest, scaleY: rest };
  const timeline = gsap.timeline({ paused: true });
  for (const stage of recipe) timeline.to(pose, stage);
  for (const age of ages) {
    timeline.seek(age);
    samples.push([rest, age, pose.scaleX, pose.scaleY]);
  }
  timeline.kill();
}
gsap.ticker.sleep();
process.stdout.write('\n// Actual GSAP samples from immutable production-benchmark-v9.\nenum NativeThemedCloudExitOracle {\nstatic let samples:[[Double]]=try! JSONDecoder().decode([[Double]].self,from:Data(json.utf8))\nprivate static let json = #"""\n' + JSON.stringify(samples) + '\n"""#\n}\n');
