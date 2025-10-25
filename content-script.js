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
// --- 2) Helper: summarize selected text via Chrome AI Summarizer API ---
async function summarizeSelectedText() {
    // 1. Grab selection from the page context
    const selection = (window.getSelection && window.getSelection().toString && window.getSelection().toString().trim()) || '';

    if (!selection) {
        throw new Error('no-selection');
    }

    // 2. Run Feature Detection (check for global Summarizer object)
    if (!('Summarizer' in window)) {
        throw new Error('ai-not-available');
    }

    // 3. Check for immediate availability
    const availability = await Summarizer.availability();
    
    // Check if the API is unusable due to requirements (hardware, sign-in, etc.)
    if (availability === 'unavailable') {
        // You might want a more specific error message here for the user
        throw new Error('ai-unavailable-requirements');
    }
    
    // 4. Create summarizer instance
    // Note: The 'model', 'tone', and 'length' parameters are now passed to the summarize() method 
    // or as options to create() depending on the specific API version and intended usage.
    // The safest approach is to create the instance and then pass options to summarize.
    const summarizerInstance = await Summarizer.create({
        // Set your desired output language using one of the exact codes: 'en', 'es', or 'ja'
        outputLanguage: 'en', // <-- Use 'en', 'es', or 'ja'
        
        // Optionally include input language, which is also a good practice
        expectedInputLanguages: ['en', 'es', 'ja'] // List all expected input languages
        
        // You can also add 'type' or 'sharedContext' here if needed
        // type: "key-points", 
    });

    
    // Optional: Add a monitor for download progress if 'availability' was 'downloadable'
    if (availability === 'downloadable' || availability === 'downloading') {
        // The .create() call might initiate the download. You can monitor it.
        // For a simple synchronous extension, you might just rely on the next step succeeding.
        console.log(`Summarizer model state: ${availability}. A download might be in progress.`);
    }

    // 5. Generate summary
    // Pass model options (tone, length) to the summarize method for built-in models.
    const summary = await summarizerInstance.summarize(selection, {
         // The 'model' and 'tone' options might be deprecated or moved; 
         // 'length' is the most common parameter supported here.
         length: 'short' // short | medium | long
    });

    // `summarize` returns string or structured object depending on implementation
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
          // This is now likely caused by the global Summarizer object missing
          sendResponse({ status: 'error', error: 'ai-not-available', message: 'AI Summarizer API not available on this Chrome version or configuration.' });
        } else if (code === 'ai-unavailable-requirements') {
          // New specific error for hardware/sign-in issues
          sendResponse({ status: 'error', error: 'ai-unavailable-requirements', message: 'AI Summarizer is unavailable. Please check your browser settings, Google sign-in status, and device requirements.' });
        } else {
          sendResponse({ status: 'error', error: 'summarize-failed', message: String(err) });
        }
      }
    })();

    return true; // keep channel open for async response
  }
});
