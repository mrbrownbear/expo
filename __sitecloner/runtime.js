(() => {
  const BLOCKED = '/__sitecloner/blocked';

  const localize = value => {
    try {
      const raw = String(value && value.url ? value.url : value);
      if (!raw || raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('about:')) {
        return raw;
      }

      const url = new URL(raw, location.href);
      if (url.origin === location.origin) {
        return raw;
      }

      if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) {
        return BLOCKED;
      }

      return raw;
    } catch {
      return BLOCKED;
    }
  };

  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = (input, init) => originalFetch.call(window, localize(input), init);
  }

  const originalXhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    return originalXhrOpen.call(this, method, localize(url), ...rest);
  };

  try {
    const OriginalWorker = window.Worker;
    if (OriginalWorker) {
      window.Worker = function(url, options) {
        return new OriginalWorker(localize(url), options);
      };
    }
  } catch {}

  try {
    const OriginalWebSocket = window.WebSocket;
    if (OriginalWebSocket) {
      window.WebSocket = function(url, protocols) {
        const mapped = localize(url);
        if (mapped === BLOCKED) {
          throw new DOMException('External network access is disabled', 'SecurityError');
        }
        return new OriginalWebSocket(mapped, protocols);
      };
    }
  } catch {}

  try {
    const beacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
    if (beacon) {
      navigator.sendBeacon = (url, data) => {
        const mapped = localize(url);
        return mapped === BLOCKED ? false : beacon(mapped, data);
      };
    }
  } catch {}

  try {
    const originalWindowOpen = window.open.bind(window);
    window.open = (url, ...args) => {
      const mapped = localize(url);
      return mapped === BLOCKED ? null : originalWindowOpen(mapped, ...args);
    };
  } catch {}

  for (const [Ctor, prop] of [
    [HTMLImageElement, 'src'],
    [HTMLScriptElement, 'src'],
    [HTMLLinkElement, 'href'],
    [HTMLVideoElement, 'src'],
    [HTMLAudioElement, 'src'],
    [HTMLSourceElement, 'src'],
    [HTMLIFrameElement, 'src']
  ]) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(Ctor.prototype, prop);
      if (descriptor && descriptor.set) {
        Object.defineProperty(Ctor.prototype, prop, {
          ...descriptor,
          set(value) {
            return descriptor.set.call(this, localize(value));
          }
        });
      }
    } catch {}
  }

  const originalSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function(name, value) {
    if (['src', 'href', 'data', 'action'].includes(String(name).toLowerCase())) {
      value = localize(value);
    }
    return originalSetAttribute.call(this, name, value);
  };
})();
