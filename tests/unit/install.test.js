import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installHow } from '../../src/lib/install.js';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  edgeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36 EdgA/131.0.0.0',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 Instagram 357.0.0.25.101 Android',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.0]'
};

test('each Android browser gets its own menu, and in-app browsers say to open the page in a browser first', () => {
  assert.equal(installHow(UA.samsung).key, 'samsung');
  assert.match(installHow(UA.samsung).steps.join(' '), /Add page to.*Home screen/);
  assert.equal(installHow(UA.edgeAndroid).key, 'edge-android');
  assert.match(installHow(UA.edgeAndroid).steps.join(' '), /Add to phone/);
  assert.equal(installHow(UA.firefoxAndroid).key, 'firefox-android');
  assert.equal(installHow(UA.instagramAndroid).key, 'inapp');
  assert.match(installHow(UA.instagramAndroid).steps[1], /Open in Chrome/);
  assert.equal(installHow(UA.facebookIos).key, 'inapp');
  assert.match(installHow(UA.facebookIos).steps[1], /Open in Safari/);
  for (const k of ['android', 'samsung', 'edgeAndroid', 'firefoxAndroid']) assert.match(installHow(UA[k]).note, /Already installed/);
  assert.equal(installHow(UA.iphone).note, undefined);
});

test('each device gets its own steps', () => {
  assert.equal(installHow(UA.iphone).key, 'ios');
  assert.equal(installHow(UA.ipadAsMac, { platform: 'MacIntel', touch: 5 }).key, 'ios');
  assert.equal(installHow(UA.android).key, 'android');
  assert.equal(installHow(UA.macSafari, { platform: 'MacIntel', touch: 0 }).key, 'mac-safari');
  assert.equal(installHow(UA.macChrome).key, 'desktop');
  assert.equal(installHow(UA.winEdge).key, 'desktop');
  assert.equal(installHow(UA.winFirefox).key, 'firefox');
  assert.match(installHow(UA.iphone).steps.join(' '), /Add to Home Screen/);
  assert.match(installHow(UA.macSafari).steps[0], /File › Add to Dock/);
  for (const k of Object.values(UA)) assert.ok(installHow(k).steps.length >= 2 && installHow(k).steps.length <= 3);
});
