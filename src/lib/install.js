/* How to install Synergym on this device, in two or three steps. Chrome and Edge (and Android's Chrome) offer their
   own install prompt, which the app shows straight away when it can; these steps are for everything else, and for
   when the browser hasn't offered the prompt. ua: navigator.userAgent; mac touch: an iPad that says it's a Mac. */
export function installHow(ua = '', { platform = '', touch = 0 } = {}) {
  const ios = /iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touch > 1);
  if (ios) return { key: 'ios', title: 'Add Synergym to your Home Screen', steps: [
    'Tap <b>Share</b> (the square with an arrow), at the bottom of Safari or at the top on an iPad.',
    'Tap <b>Add to Home Screen</b>. Scroll down the list if you don’t see it.',
    'Tap <b>Add</b>. Synergym now opens from your Home Screen, like an app.'] };
  if (/Android/.test(ua)) return { key: 'android', title: 'Add Synergym to your Home Screen', steps: [
    'Open the browser menu <b>⋮</b>, at the top right.',
    'Tap <b>Install app</b> or <b>Add to Home screen</b>.',
    'Open Synergym from your Home Screen, like an app.'] };
  if (/Firefox\//.test(ua)) return { key: 'firefox', title: 'Install Synergym', steps: [
    'Firefox on a computer can’t install web apps.',
    'Open this page in <b>Chrome</b>, <b>Edge</b> or <b>Safari</b> and install it from there, or just bookmark it.'] };
  if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|OPR\//.test(ua)) return { key: 'mac-safari', title: 'Add Synergym to your Dock', steps: [
    'In the menu bar, choose <b>File › Add to Dock</b>.',
    'Open Synergym from the Dock. It runs in its own window, like an app.'] };
  return { key: 'desktop', title: 'Install Synergym', steps: [
    'Click the install icon (a screen with an arrow) at the right of the address bar.',
    'Or open the browser menu <b>⋮</b> and choose <b>Install Synergym</b>.',
    'It opens in its own window, like an app.'] };
}
