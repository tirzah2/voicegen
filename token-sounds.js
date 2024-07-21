import { registerTokenHooks } from './scripts/tokenHooks.js';

export const MODULE_ID = 'voicegen';

function loadScript(url, callback) {
  let script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = url;
  script.onload = callback;
  document.head.appendChild(script);
}

Hooks.on('init', () => {
  loadScript('https://cdn.jsdelivr.net/npm/mp3tag.js@latest/dist/mp3tag.min.js', () => {
    console.log('Tag Editor loaded');
    registerTokenHooks();
  });
});
