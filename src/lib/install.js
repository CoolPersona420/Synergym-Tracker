/* How to install Synergym on this device, in two or three steps. Chrome, Edge and Samsung Internet offer their own
   install prompt, which the app shows straight away when it can; these steps are for everything else, and for when the
   browser hasn't offered the prompt (it doesn't once the app is installed). ua: navigator.userAgent; mac touch: an iPad
   that says it's a Mac. note: an optional line under the steps. */
const k = g => `<span class="ins-k">${g}</span>`;
const HOME = 'Add Synergym to your Home Screen';
const INSTALLED = 'Already installed? Just open Synergym from your Home Screen.';
/* Links opened inside Instagram, Facebook, TikTok and the like load in that app's own browser, which can't install. */
const IN_APP = /; wv\)|FBAN|FBAV|FB_IAB|Instagram|Line\/|musical_ly|Bytedance|Snapchat|MicroMessenger/;

export function installHow(ua = '', { platform = '', touch = 0 } = {}) {
  const ios = /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touch > 1);
  const android = /Android/.test(ua);
  if ((ios || android) && IN_APP.test(ua)) return { key: 'inapp', title: 'Open Synergym in your browser first', steps: [
    'This page is open inside another app, which can’t install it.',
    ios ? `Tap the menu ${k('⋯')} and choose <b>Open in Safari</b> or <b>Open in browser</b>.`
      : `Tap the menu ${k('⋮')} and choose <b>Open in Chrome</b> or <b>Open in browser</b>.`,
    'Then tap <b>Install the app</b> again.'] };
  if (ios) return { key: 'ios', title: HOME, steps: [
    'Tap <b>Share</b> (the square with an arrow), at the bottom of Safari or at the top on an iPad.',
    'Tap <b>Add to Home Screen</b>. Scroll down the list if you don’t see it.',
    'Tap <b>Add</b>. Synergym now opens from your Home Screen, like an app.'] };
  if (android && /SamsungBrowser\//.test(ua)) return { key: 'samsung', title: HOME, note: INSTALLED, steps: [
    `Tap the menu ${k('≡')} at the bottom right.`,
    'Tap <b>Add page to</b>, then <b>Home screen</b>.',
    'Tap <b>Add</b>. Synergym now opens from your Home Screen, like an app.'] };
  if (android && /EdgA\//.test(ua)) return { key: 'edge-android', title: HOME, note: INSTALLED, steps: [
    `Tap the menu ${k('⋯')} at the bottom.`,
    'Tap <b>Add to phone</b>.',
    'Tap <b>Install</b>. Synergym now opens from your Home Screen, like an app.'] };
  if (android && /Firefox\//.test(ua)) return { key: 'firefox-android', title: HOME, note: INSTALLED, steps: [
    `Tap the menu ${k('⋮')}, at the top or bottom right.`,
    'Tap <b>Add to Home screen</b> (or <b>Install</b>).',
    'Tap <b>Add</b>. Synergym now opens from your Home Screen, like an app.'] };
  if (android) return { key: 'android', title: HOME, note: INSTALLED, steps: [
    `Tap the menu ${k('⋮')} at the top right.`,
    'Tap <b>Add to Home screen</b> or <b>Install app</b>, whichever you see.',
    'Tap <b>Install</b>. Synergym now opens from your Home Screen, like an app.'] };
  if (/Firefox\//.test(ua)) return { key: 'firefox', title: 'Install Synergym', steps: [
    'Firefox on a computer can’t install web apps.',
    'Open this page in <b>Chrome</b>, <b>Edge</b> or <b>Safari</b> and install it from there, or just bookmark it.'] };
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|OPR\//.test(ua)) return { key: 'mac-safari', title: 'Add Synergym to your Dock', steps: [
    'In the menu bar, choose <b>File › Add to Dock</b>.',
    'Open Synergym from the Dock. It runs in its own window, like an app.'] };
  return { key: 'desktop', title: 'Install Synergym', steps: [
    'Click the install icon (a screen with an arrow) at the right of the address bar.',
    `Or open the browser menu ${k('⋮')} and choose <b>Install Synergym</b>.`,
    'It opens in its own window, like an app.'] };
}
