// content-script.js
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.from !== 'clarity_webapp') return;

  const { payload } = event.data;

  // Forward the payload to the extension's background script
  // (chrome.runtime.sendMessage without an ID sends to the current extension)
  chrome.runtime.sendMessage(payload, (response) => {
    if (chrome.runtime.lastError) {
      // Background may not be listening; log lastError safely
      console.warn('sendMessage error:', chrome.runtime.lastError.message);
    } else {
      console.log('Extension received:', response);
    }
  });
});

// Listen for background requests to get geolocation from the page context.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type === 'GET_GEOLOCATION') {
    if (!('geolocation' in navigator)) {
      sendResponse({ status: 'error', error: 'geolocation-not-supported' });
      return; // no async response
    }

    // Call geolocation in the page (content script) context
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        sendResponse({ status: 'ok', location: coords });
      },
      (err) => {
        sendResponse({ status: 'error', error: err.message || err.code });
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );

    return true; // indicate we'll respond asynchronously
  }
});
