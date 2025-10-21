// --- 1) Forward messages from the webpage to the extension background ---
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.from !== 'clarity_webapp') return;

  const { payload } = event.data;

  chrome.runtime.sendMessage(payload, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('sendMessage error:', chrome.runtime.lastError.message);
    } else {
      console.log('Extension received:', response);
    }
  });
});

// --- 2) Helper: summarize selected text via Chrome AI Summarizer API ---
async function summarizeSelectedText() {
  // Grab selection from the page context
  const selection = (window.getSelection && window.getSelection().toString && window.getSelection().toString().trim()) || '';

  if (!selection) {
    throw new Error('no-selection');
  }

  if (!window.ai || !window.ai.summarizer) {
    throw new Error('ai-not-available');
  }

  // Create summarizer instance and summarize
  const summarizer = await ai.summarizer.create({
    model: 'default',       // built-in model
    tone: 'informative',    // optional
    length: 'short'         // short | medium | long
  });

  // `summarize` returns string or structured object depending on implementation
  const summary = await summarizer.summarize(selection);
  return summary;
}

// --- 3) Message handlers from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type === 'GET_GEOLOCATION') {
    if (!('geolocation' in navigator)) {
      sendResponse({ status: 'error', error: 'geolocation-not-supported' });
      return;
    }

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

    return true; // we'll call sendResponse async
  }

  // SUMMARIZE_SELECTION handler
  if (request?.type === 'SUMMARIZE_SELECTION') {
    (async () => {
      try {
        const summary = await summarizeSelectedText();

        // If summarizer returns object, normalise to string if needed
        const normalized = (typeof summary === 'string') ? summary : (summary?.text || JSON.stringify(summary));

        sendResponse({ status: 'ok', summary: normalized });
      } catch (err) {
        // Map errors to friendly codes/messages
        const code = err?.message || 'unknown';
        if (code === 'no-selection') {
          sendResponse({ status: 'error', error: 'no-selection', message: 'Please select text on the page first.' });
        } else if (code === 'ai-not-available') {
          sendResponse({ status: 'error', error: 'ai-not-available', message: 'AI Summarizer API not available in this context.' });
        } else {
          sendResponse({ status: 'error', error: 'summarize-failed', message: String(err) });
        }
      }
    })();

    return true; // keep channel open for async response
  }
});
