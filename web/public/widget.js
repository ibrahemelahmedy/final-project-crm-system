/**
 * Wisal chat widget loader — Story 26 (WIS-22), Decision 10.
 *
 * Plain, dependency-free, ES5-safe JavaScript, served byte-for-byte from
 * `web/public/` with no build step and no transpilation, because third-party
 * pages load it directly. NOT a `.tsx` file and NOT under `src/` on purpose —
 * `check-no-literals.mjs` only scans the roots in
 * `web/scripts/i18n-allowlist.json`, and this file is deliberately outside
 * all of them. Do not move it there.
 *
 * Usage: <script src="https://<host>/widget.js" data-site-key="..."
 *                 data-origin="https://<host>" data-title="Chat"></script>
 *
 * Never reads cookies, never sends anything to the parent page. The only
 * cross-frame traffic is the iframe posting its own height on a
 * `wisal-widget:` prefixed message, and this script checks that message's
 * origin against the `data-origin` it was configured with before using it.
 */
(function () {
  'use strict';

  var currentScript = document.currentScript;
  if (!currentScript) return;

  var siteKey = currentScript.getAttribute('data-site-key');
  var origin = currentScript.getAttribute('data-origin');
  var title = currentScript.getAttribute('data-title') || 'Chat';
  if (!siteKey || !origin) return;
  origin = origin.replace(/\/$/, '');

  var frame = null;
  var panel = null;
  var isOpen = false;

  function style(el, rules) {
    for (var key in rules) {
      if (Object.prototype.hasOwnProperty.call(rules, key)) el.style[key] = rules[key];
    }
  }

  function buildLauncher() {
    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', title);
    button.className = 'wisal-widget-launcher-button';
    style(button, {
      position: 'fixed', bottom: '20px', insetInlineEnd: '20px', zIndex: '2147483000',
      width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
      background: '#0E7490', color: '#fff', fontSize: '24px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
    });
    button.textContent = String.fromCharCode(0xd83d, 0xdcac); // speech-bubble emoji
    button.addEventListener('click', toggle);
    return button;
  }

  function buildPanel() {
    var div = document.createElement('div');
    div.className = 'wisal-widget-launcher-panel';
    style(div, {
      position: 'fixed', bottom: '86px', insetInlineEnd: '20px', width: '360px',
      maxWidth: '92vw', height: '480px', maxHeight: '80vh', zIndex: '2147483000',
      boxShadow: '0 8px 30px rgba(0,0,0,0.3)', borderRadius: '12px', overflow: 'hidden',
      display: 'none',
    });

    var iframe = document.createElement('iframe');
    iframe.title = title;
    iframe.src = origin + '/widget/chat?key=' + encodeURIComponent(siteKey);
    style(iframe, { width: '100%', height: '100%', border: 'none' });

    div.appendChild(iframe);
    frame = iframe;
    return div;
  }

  function toggle() {
    isOpen = !isOpen;
    panel.style.display = isOpen ? 'block' : 'none';
  }

  function open() {
    isOpen = true;
    panel.style.display = 'block';
  }

  function close() {
    isOpen = false;
    panel.style.display = 'none';
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== origin) return;
    var data = event.data;
    if (!data || data.type !== 'wisal-widget:height') return;
    var value = parseInt(data.value, 10);
    if (frame && !isNaN(value) && value > 0) frame.style.minHeight = value + 'px';
  });

  function init() {
    panel = buildPanel();
    document.body.appendChild(panel);
    document.body.appendChild(buildLauncher());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.WisalChat = { open: open, close: close };
})();
