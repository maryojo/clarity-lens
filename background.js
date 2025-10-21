// The Service Worker is a background script that runs outside of the visible web pages.
// It is primarily used to listen for and respond to browser events.

// Listen for the event that occurs when the extension is first installed.
chrome.runtime.onInstalled.addListener((details) => {
    // Check if the installation reason is a fresh install (not an update or reload)
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        // Use chrome.tabs.create to open a new tab with our welcome page.
        chrome.tabs.create({
            url: 'http://localhost:3000/welcome'
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




