// The Service Worker is a background script that runs outside of the visible web pages.
// It is primarily used to listen for and respond to browser events.

// Listen for the event that occurs when the extension is first installed.
chrome.runtime.onInstalled.addListener((details) => {
    // Check if the installation reason is a fresh install (not an update or reload)
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        // Use chrome.tabs.create to open a new tab with our welcome page.
        chrome.tabs.create({
            url: 'https://clarity-lens-web.vercel.app/welcome'
        });
    }
});

// Extension background.js
// RECEIVE message FROM web app
// chrome.runtime.onMessageExternal.addListener(
//   (request, sender, sendResponse) => {
//     if (sender.url.startsWith('http://localhost:3000')) {
//       if (request.type === 'ONBOARDING_COMPLETE') {
//         // Save to extension storage
//         chrome.storage.local.set({
//           readingLevel: request.data.readingLevel,
//           language: request.data.language,
//           locationGranted: request.data.locationGranted,
//           onboardingComplete: true
//         });
        
//         sendResponse({ success: true });
//       }
//     }
//   }
// );

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request?.type === "ONBOARDING_COMPLETE") {
    console.log("✅ Onboarding data received:", request.data);

    // 1️⃣ Save onboarding preferences
    chrome.storage.local.set({
      readingLevel: request.data.readingLevel,
      language: request.data.language,
      locationGranted: request.data.locationGranted,
      onboardingComplete: true
    });

    // 2️⃣ If user agreed to share location → request actual geolocation
    if (request.data.locationGranted) {
      // Service workers / extension background scripts do NOT have access to
      // the page's navigator.geolocation. Instead, ask the active tab's
      // content script (which runs in the page context) to fetch the location
      // and reply.
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) {
          sendResponse({ status: 'error', error: 'no-active-tab' });
          return;
        }

        chrome.tabs.sendMessage(tab.id, { type: 'GET_GEOLOCATION' }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('❌ sendMessage error:', chrome.runtime.lastError.message);
            sendResponse({ status: 'error', error: chrome.runtime.lastError.message });
            return;
          }

          if (response && response.status === 'ok' && response.location) {
            const coords = response.location;
            console.log('✅ Location fetched from page:', coords);

            // Save location to extension storage
            chrome.storage.local.set({ location: coords }, () => {
              console.log('✅ Location saved to storage');
              sendResponse({ status: 'ok', location: coords });
            });
          } else {
            const errMsg = response?.error || 'no-location-response';
            console.warn('❌ Location error:', errMsg);
            sendResponse({ status: 'error', error: errMsg });
          }
        });
      });

      return true; // keep message channel open for async response
    }

    // If user didn’t grant location
    sendResponse({ status: "ok", location: null });
  }
});

// This file runs in the background and has access to chrome.ai
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    // Check for the specific request from your popup/content script
    if (request.action === 'runAIPrompt') {
console.log('hereee');
        try {
console.log('ttthereee');
            // 1. Get the LanguageModel object
            const languageModel = await chrome.ai.getLanguageModel();
		const availability = await languageModel.availability();
console.log('before',availability);
            
            // 2. Create a session
            const session = await languageModel.create();
            
            // 3. Prompt the model
            const result = await session.prompt(request.promptText);
            
            // 4. Send the result back to the sender
            sendResponse({ status: 'success', response: result });
        } catch (error) {
            console.error("AI API Error:", error);
            sendResponse({ status: 'error', message: error.toString() });
        }
        // Return true to indicate you will send a response asynchronously
        return true; 
    }
});


// --- Function to Capture Screenshot (moved from content-script.js) ---
async function capturePageScreenshot(tabId) {
    try {
        // Use the active tab in the current window (or use the tabId passed in)
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Note: tabId is technically not needed for captureVisibleTab if you use the active tab.
        // If you were using a specific tab ID, you'd pass it as the first argument.
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'jpeg',
            quality: 90
        });
        return dataUrl;
    } catch (e) {
        console.error("Error in capturePageScreenshot (in background.js):", e);
        throw new Error('screenshot-failed');
    }
}


// --- New Message Listener in background.js ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // Check for the specific request type from the content script
    if (request.type === 'CAPTURE_SCREENSHOT') {
        (async () => {
            try {
                // Sender provides the tab ID of the content script's location
                const dataUrl = await capturePageScreenshot(sender.tab.id); 
                
                // Send the result back to the content script
                sendResponse({ status: 'ok', dataUrl: dataUrl });
            } catch (error) {
                sendResponse({ status: 'error', message: error.message });
            }
        })();
        
        // IMPORTANT: Must return true to indicate you will send the response asynchronously
        return true; 
    }
    
    // Add other handlers here (e.g., if AI calls are also moved to background.js)
    
});
