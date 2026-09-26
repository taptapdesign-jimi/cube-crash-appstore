import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

function fixture() {
  const media: Media[] = [];
  let failedStarts = 0;
  class Media {
    paused = true;
    constructor(readonly src: string) { media.push(this); }
    load() {}
    pause() { this.paused = true; }
    play() { this.paused = false; return Promise.resolve(); }
  }
  const parameter = () => ({ value: 1, setValueAtTime() {}, cancelScheduledValues() {}, linearRampToValueAtTime() {} });
  class Context extends EventTarget {
    state = 'running'; currentTime = 1; sampleRate = 48_000; destination = {};
    resume() { this.state = 'running'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({ length: 48_000, numberOfChannels: 2, duration: 1 }); }
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    createBufferSource() {
      return { playbackRate: parameter(), connect() {}, disconnect() {}, stop() {},
        start() { failedStarts++; throw new Error('injected native source.start failure'); }, onended: null };
    }
  }
  const context = vm.createContext({
    window: Object.assign(new EventTarget(), { AudioContext: Context, _settings: { gameSoundsEnabled: true }, setTimeout, clearTimeout }),
    document: Object.assign(new EventTarget(), { hidden: false, baseURI: 'https://audio.test/' }),
    location: { hostname: 'audio.test', search: '' }, Audio: Media,
    fetch: () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) }),
    URL, performance, setTimeout, clearTimeout, console,
  });
  const modules = new Map<string, { exports: any }>();
  const load = (filename: string): any => {
    filename = path.resolve(root, filename);
    const cached = modules.get(filename);
    if (cached) return cached.exports;
    const module = { exports: {} }; modules.set(filename, module);
    const require = (name: string) => {
      if (name.includes('/logger.')) return { logger: { warn() {}, info() {}, debug() {} } };
      if (name.includes('mobile-runtime-profile')) return { MOBILE_RUNTIME_PROFILE: { isMobileDevice: true } };
      let next = path.resolve(path.dirname(filename), name);
      if (!fs.existsSync(next)) next = next.replace(/\.js$/, '.ts');
      if (!fs.existsSync(next)) next += '.ts';
      return load(next);
    };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context)(require, module, module.exports);
    return module.exports;
  };
  return {
    load, media, failedStarts: () => failedStarts,
    player: load('src/modules/gameplay-audio-buffer-player.ts') as typeof import('../gameplay-audio-buffer-player'),
  };
}

const owners = [
  { name: 'LaserGun', file: 'laser-gun-merge6-sound.ts', preload: 'preloadLaserGunMerge6Sounds', play: 'playLaserGunMerge6AddonSounds', stop: 'stopLaserGunMerge6Sounds', cueCount: 2 },
  { name: 'Spaceship', file: 'spaceship-merge6-sound.ts', preload: 'preloadSpaceshipMerge6Sounds', play: 'playSpaceshipMerge6AddonSounds', stop: 'stopSpaceshipMerge6Sounds', cueCount: 3 },
];

describe.each(owners)('$name actual engine native-start failure', owner => {
  test.each(['warm', 'cold'] as const)('%s failure falls back exactly once per cue and remains stoppable', async cache => {
    const f = fixture();
    const audio = f.load(`src/modules/${owner.file}`);
    try {
      if (cache === 'warm') { audio[owner.preload](); await settle(); }
      expect(audio[owner.play]()).toBe(true);
      await settle();
      expect(f.failedStarts()).toBe(owner.cueCount);
      expect(f.media).toHaveLength(owner.cueCount);
      expect(f.media.every(media => !media.paused)).toBe(true);
      expect(f.player.getDecodedGameplayAudioStats().activeVoices).toBe(0);
      expect(f.player.getDecodedGameplayAudioStats().pendingVoiceStarts).toBe(0);
      audio[owner.stop]();
      expect(f.media.every(media => media.paused)).toBe(true);
      await settle();
      expect(f.media).toHaveLength(owner.cueCount);
    } finally { audio[owner.stop](); f.player.resetDecodedGameplayAudioForTests(); }
  });
});
