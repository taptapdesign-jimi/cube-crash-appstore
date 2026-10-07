import fs from 'node:fs';

/**
 * Swift SOURCE contracts, not UIKit execution or presented-frame evidence.
 * The pure JimiV9MotionChecks executable separately checks v9 curves/end poses.
 * Simulator video must still inspect the final outgoing frame and first incoming
 * frame: settled XCUITest screenshots cannot detect a one-frame source flash.
 */
const controller = fs.readFileSync('native/jimi-2026/JimiHomeHubController.swift', 'utf8');
const home = fs.readFileSync('native/jimi-2026/JimiV9HomeView.swift', 'utf8');
const hub = fs.readFileSync('native/jimi-2026/JimiV9HubView.swift', 'utf8');

function method(name: string): string {
  // Lifecycle entry points are internal so UIKit fixtures exercise their owner
  // directly without posting application-wide notifications to the test host.
  const marker = new RegExp(`\\n {4}(?:private )?func ${name}\\(`).exec(controller)?.[0];
  const start = marker === undefined ? -1 : controller.indexOf(marker);
  if (start < 0 || marker === undefined) throw new Error(`Missing Swift method ${name}`);
  const bodyStart = start + marker.length;
  const next = /\n {4}(?:private )?func /.exec(controller.slice(bodyStart));
  return controller.slice(start, next ? bodyStart + next.index : undefined).replace(/\/\/[^\n]*/g, '');
}

function ordered(source: string, ...tokens: string[]): void {
  let previous = -1;
  for (const token of tokens) {
    const position = source.indexOf(token, previous + 1);
    expect({ token, found: position >= 0 }).toEqual({ token, found: true });
    expect(position).toBeGreaterThan(previous);
    previous = position;
  }
}

describe('native Home/Hub outgoing-pose source contracts', () => {
  test('CTA activation does not wait for release feedback and route cancellation preserves its separate shell', () => {
    const activation = home.slice(home.indexOf('@objc private func activate('), home.indexOf('@objc private func pressCTA('));
    expect(activation).toContain('onActivate?(selectedSlide)');
    expect(activation).not.toContain('self.onActivate');
    expect(method('navigate')).toContain('home.cancelPan(preservingCTAFeedback: true)');
    expect(home).toContain('if !preservingCTAFeedback { resetCTAFeedback() }');
  });
  test('Settings and Arcade exit natively before retiring the cover; tutorial still uses its canonical source', () => {
    expect(method('navigate')).toContain('if isWebSource && !nativeHomeExit');
    expect(method('navigate')).toContain('(destinationLabel == "settings" || destinationLabel == "arcade")');
    expect(controller).toContain('["kind": index == 1 ? "arcade" : "settings"]');
    const body = method('commitIfReady');
    const arcade = body.slice(body.indexOf('if kind == "arcade" {'), body.indexOf('if kind == "web-home" || kind == "web-hub"'));
    ordered(arcade, 'activateNativeArcade(id)', 'guard case .success(let accepted)', 'self.view.isHidden = true');
    const transfer = body.slice(body.indexOf('if nativeExitComplete {'), body.indexOf('return\n            }', body.indexOf('if nativeExitComplete {')));
    ordered(transfer, 'activateSource(id, true)', 'guard case .success(let value)', 'self.view.isHidden = true');
  });
  test('Hub flags keep their art, progress and flutter without shimmer layers or idle effects', () => {
    const hub = fs.readFileSync('native/jimi-2026/JimiV9HubView.swift', 'utf8');
    expect(hub).toContain('assets/journey assets/natpis.png');
    expect(hub).toContain('counts[id]?.attributedText');
    expect(hub).toContain('addLoop(banner.layer, keyPath: "transform"');
    expect(hub).not.toMatch(/shineLayers|emberLayers|flagEffects|flagMasks|shimmerDuration|CAGradientLayer/);
  });
  test('Journey NAV exit delegates the v9 top-pivot recipe without changing incoming choreography', () => {
    const body = method('hubTracks');
    expect(body).toContain('JimiV9Motion.journeyNavigationExit(reducedMotion: reduced)');
    expect(body).toContain('from: .scale(reduced ? 0.96 : 0.65, y: reduced ? 8 : 30, opacity: 0)');
    expect(body).toContain('duration: reduced ? 0.2 : 0.56');
    expect(body).not.toContain('y: reduced ? 8 : 28');
  });

  test('Journey header layout preserves authored bounds and top edge while its route pivot changes', () => {
    const layout = hub.slice(hub.indexOf('override func layoutSubviews()'), hub.indexOf('private func cloudWorldID'))
      .replace(/\/\/[^\n]*/g, '');
    expect(layout).toContain('header.bounds = CGRect(x: 0, y: 0, width: width, height: headerTop + 66)');
    expect(layout).toContain('header.layer.position = CGPoint(x: width * header.layer.anchorPoint.x,');
    expect(layout).toContain('y: header.bounds.height * header.layer.anchorPoint.y)');
    expect(layout).not.toContain('header.frame =');
  });

  test.each(['commitIfReady', 'adopt'])(
    '%s retires both source surfaces before identity cleanup within one outer disabled-actions transaction',
    (name) => {
      const body = method(name);
      ordered(body,
        'CATransaction.begin(); CATransaction.setDisableActions(true)',
        'defer { CATransaction.commit() }',
        'home.isHidden = true; hub.isHidden = true',
        'cancelMotion()',
      );
      // A separately committed reset can resurrect full-size logo/shards/Units.
      const beforeReset = body.slice(0, body.indexOf('cancelMotion()'));
      expect(beforeReset.match(/CATransaction\.commit\(\)/g)).toHaveLength(1);
      expect(beforeReset).not.toMatch(/(?:asyncAfter|DispatchQueue\.main\.async|CATransaction\.flush)\b/);
    },
  );

  test('the readiness guard runs before retirement, so delayed preparation retains the collapsed outgoing model', () => {
    ordered(method('commitIfReady'),
      'guard motionDone, let destination = destinationReady, let id = expectedRequest else { return }',
      'home.isHidden = true; hub.isHidden = true',
      'cancelMotion()',
    );
  });

  test('CA installation stores the terminal transform and baseline-relative opacity before adding its finite animation', () => {
    ordered(method('installTracks'),
      'if baseOpacity[key] == nil { baseOpacity[key] = layer.opacity }',
      'let alpha = baseOpacity[key] ?? 1',
      'let final = poses.last!',
      'layer.transform = CATransform3DScale(CATransform3DMakeTranslation(final.x, final.y, 0), final.scaleX, final.scaleY, 1)',
      'layer.opacity = Float(final.opacity) * alpha',
      'layer.add(group, forKey: "native-route")',
    );
    // This is the native equivalent of v9's exit fill:forwards; don't rely on
    // an animation whose removal would reveal an identity/full-size model.
    expect(method('installTracks')).not.toContain('repeatCount');
  });

  test('completion cannot reset the terminal model before route readiness and ignores cancelled leases', () => {
    const body = method('animate');
    const completion = body.slice(body.indexOf('CATransaction.setCompletionBlock'), body.indexOf('installTracks(routeEntries,'));
    ordered(completion, 'guard let self, self.generation == owner else { return }', 'completion()');
    expect(completion).not.toMatch(/cancelMotion\(|\.transform\s*=|\.opacity\s*=|isHidden\s*=\s*false/);
    const anchor = method('restoreAnchor');
    expect(anchor).not.toMatch(/\.transform\s*=|\.opacity\s*=/);
  });

  test('only finite route groups co-retire at the existing route maximum, independently of decorative banners', () => {
    const body = method('animate');
    ordered(body,
      'installTracks(decoration)',
      'CATransaction.setCompletionBlock',
      'installTracks(routeEntries, holdUntil: routeEntries.map { $0.1.duration }.max())',
    );
    expect(body).not.toContain('installTracks(decoration,');
    const installer = method('installTracks');
    expect(installer).toContain('JimiV9Motion.sampledTrack(track, holdUntil: holdUntil)');
    expect(installer).toContain('transform.keyTimes = sampled.keyTimes?.map');
    expect(installer).toContain('opacity.keyTimes = sampled.keyTimes?.map');
    expect(installer).toContain('group.duration = sampled.duration');
    expect(installer).not.toMatch(/repeatCount|fillMode|isRemovedOnCompletion|asyncAfter/);
    expect(method('cancelMotion')).toContain('layer.removeAnimation(forKey: "native-route")');
    expect(method('cancelMotion')).toContain('generation += 1');
  });

  test('destination motion is installed synchronously inside the coverage transaction, not after another scheduled turn', () => {
    const body = method('commitIfReady');
    const native = body.slice(body.indexOf('route = kind == "settings" ? .settings : kind == "hub" ? .hub : .home'));
    ordered(native,
      'home.isHidden = route != .home; hub.isHidden = route != .hub',
      'let incoming = route == .settings ? settings.tracks(enter: true) : route == .home ? homeTracks(enter: true) : hubTracks(enter: true)',
      'animate(incoming)',
    );
    expect(native).not.toMatch(/DispatchQueue|asyncAfter|CATransaction\.flush/);
  });

  test('logo and all four shard shells have independent owned tracks, without scaling their common container twice', () => {
    const tracks = method('homeTracks');
    expect(tracks).toContain('(home.logoImageView, .logo)');
    expect(tracks).toContain('parts += home.shardViews.map { ($0, .shard) }');
    expect(tracks).not.toContain('(home.logoView,');
    expect(home).toContain('private let shardShells = (0..<4).map { _ in UIView() }');
    expect(home).toContain('var shardViews: [UIView] { shardShells }');
    expect(home).toContain('shards[3].transform = CGAffineTransform(scaleX: -1, y: 1)');
  });

  test('hero layout preserves its rest rectangle across route and selected-slide pivot changes', () => {
    const layout = home.slice(home.indexOf('override func layoutSubviews()'))
      .split(/\n {4}(?:private )?func /)[0].replace(/\/\/[^\n]*/g, '');
    expect(layout).toContain('heroes[i].bounds = CGRect(x: 0, y: 0, width: 336, height: 336)');
    expect(layout).toContain('heroes[i].layer.position = CGPoint(');
    expect(layout).toContain('x: width/2 + (heroes[i].layer.anchorPoint.x - 0.5) * 336,');
    expect(layout).toContain('y: heroTop + heroes[i].layer.anchorPoint.y * 336)');
    expect(layout).not.toMatch(/heroes\[i\]\.(?:center|frame)\s*=/);
  });

  test('layout uses bounds with anchor-safe position or center, never frame, for animated Home targets', () => {
    const layout = home.slice(home.indexOf('override func layoutSubviews()'))
      .split(/\n {4}(?:private )?func /)[0]
      .replace(/\/\/[^\n]*/g, '');
    // installTracks writes the terminal model scale immediately. UIView.frame
    // is not a valid geometry owner while its layer transform is nonidentity,
    // including the singular scale(0) retained throughout an outgoing track.
    for (const target of ['logoImage', 'heroes[i]', 'ctaContainers[i]', 'ctas[i]',
      'navView', 'bottomShadow', 'shardShells[i]', 'navButtons[i]']) {
      expect(layout).toContain(`${target}.bounds =`);
      expect(layout).toContain(target === 'heroes[i]' ? `${target}.layer.position =` : `${target}.center =`);
      expect(layout).not.toContain(`${target}.frame =`);
    }
  });

  test('settled native Forest foreground validates exact current web receipt before resuming', () => {
    const body = method('resume');
    const world = body.slice(body.indexOf('if route == .world'),body.indexOf('if status.accessibilityValue'));
    ordered(world,'isNativeWorldPresentationCurrent(generation, revision)','identity.generation == model.generation','guard case .success(let value)','self.nativeWorld.resume()');
    expect(world).toContain('"generation": model.generation, "revision": model.revision');
    expect(world).toContain('self.generation == owner');
    expect(world).toContain('UIApplication.shared.applicationState == .active');
    expect(world).toContain('self.nativeWorld.hide(); self.active = false');
    expect(world).toContain('self.view.isHidden = true; self.web.accessibilityElementsHidden = false');
    expect(world).not.toContain('cancel()');
  });

  test('deferred native Forest releases held paper coverage when either exact validation or preparation is denied', () => {
    const body = method('resumeDeferredWorldPresentation');
    expect(body.match(/isNativeWorldPresentationCurrent\(generation, revision\)/g)).toHaveLength(2);
    expect(body.match(/self\.releaseStaleNativeWorldCoverage\(\)/g)).toHaveLength(3);
    ordered(body,'JimiNativeWorldSnapshot(pending.snapshot)','isNativeWorldPresentationCurrent(generation, revision)','self.expectedRequest == nil, !self.transitioning','guard case .success(let value)','self.releaseStaleNativeWorldCoverage()','self.nativeWorld.prepare(model, rawSnapshot: pending.snapshot');
    const second = body.slice(body.indexOf('current in'));
    ordered(second,'UIApplication.shared.applicationState == .active','guard case .success(let accepted)','self.releaseStaleNativeWorldCoverage()','self.view.isHidden = false');
    const release = method('releaseStaleNativeWorldCoverage');
    expect(release).toContain('nativeWorld.hide(); active = false');
    expect(release).toContain('view.isHidden = true; web.accessibilityElementsHidden = false');
    expect(release).not.toContain('evaluateJavaScript');
  });

  test('denied native Forest input admission relinquishes coverage before any input is enabled', () => {
    const body = method('commitNativeWorldInput');
    ordered(body,'self.generation == owner','guard case .success(let accepted)','self.releaseStaleNativeWorldCoverage()','self.nativeWorld.worldView?.finishPresentationAdmission()');
    expect(body).toContain('"generation": snapshot.generation, "revision": snapshot.revision');
  });
});
