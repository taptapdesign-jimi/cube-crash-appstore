test('iOS image helper does not install a global MutationObserver for density probing', async () => {
  jest.resetModules();
  const observe = jest.fn();
  const OriginalMutationObserver = global.MutationObserver;
  (global as any).MutationObserver = jest.fn(() => ({ observe, disconnect: jest.fn() }));

  await import('../ios-image-helper');

  expect(observe).not.toHaveBeenCalled();
  (global as any).MutationObserver = OriginalMutationObserver;
});

test('iOS image helper leaves component-declared image src and srcset untouched', async () => {
  jest.resetModules();
  document.body.innerHTML = '<img id="journey-image" src="./assets/journey.png" srcset="./assets/journey@2x.png 2x">';

  await import('../ios-image-helper');
  await Promise.resolve();

  const image = document.getElementById('journey-image') as HTMLImageElement;
  expect(image.getAttribute('src')).toBe('./assets/journey.png');
  expect(image.getAttribute('srcset')).toBe('./assets/journey@2x.png 2x');
});
