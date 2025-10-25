document.addEventListener('DOMContentLoaded', () => {
    const injectButton = document.getElementById('injectButton');
    const locationButton = document.getElementById('locationButton'); 
    const messageDiv = document.getElementById('message');
    const btn = document.getElementById('summarize-btn');
    const result = document.getElementById('summary-result');
    const error = document.getElementById('error');
    const loading = document.getElementById('loading');

    function setLoading(on) {
    loading.style.display = on ? 'inline' : 'none';
    btn.disabled = on;
    if (!on) btn.focus();
  }

  btn.addEventListener('click', async () => {
    result.textContent = '';
    error.textContent = '';
    setLoading(true);

    try {
      // Get active tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.id) {
          setLoading(false);
          error.textContent = 'No active tab found.';
          return;
        }

        chrome.tabs.sendMessage(tab.id, { type: 'SUMMARIZE_SELECTION' }, (response) => {
          setLoading(false);
          
          // Check for runtime errors first
          if (chrome.runtime.lastError) {
            // console.warn('sendMessage error:', chrome.runtime.lastError);
            error.textContent = chrome.runtime.lastError.message || 'Extension not active on this page. Make sure the extension can run here.';
            return;
          }

          // Then check for missing response
          if (!response) {
            error.textContent = 'No response from content script. The page may need to be refreshed.';
            return;
          }

          if (response.status === 'ok') {
            result.textContent = response.summary || '(empty summary)';
          } else {
            // Map known errors to friendly messages
            if (response.error === 'no-selection') {
              error.textContent = 'Please select some text on the page before summarizing.';
            } else if (response.error === 'ai-not-available') {
              error.textContent = 'AI Summarizer is not available in this context.';
            } else {
              error.textContent = response.message || 'Failed to summarize selection.';
            }
          }
        });
      });
    } catch (err) {
      setLoading(false);
      error.textContent = 'Unexpected error: ' + String(err);
    }
  });

    // Restore stored location (if any) and display it safely
    chrome.storage.local.get(["location"], (res) => {
        if (res && res.location) {
            console.log("User location in popup:", res.location);
            const loc = document.getElementById('location');
            if (loc) {
                // Prefer text to avoid injecting raw markup; stringify non-strings
                loc.textContent = (typeof res.location === 'string') ? res.location : JSON.stringify(res.location);
            }
        }
    });

    // Helper function to display temporary messages in the popup
    function showSuccessMessage(text = 'Content Injected! Check the page.', duration = 3000) {
        messageDiv.textContent = text;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, duration);
    }

    // --- 1. Existing Greeting Functionality ---
    injectButton.addEventListener('click', async () => {
        // 1. Get the current active tab
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab && tab.id) {
            // 2. Execute a script on the current tab using the 'scripting' permission
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: injectContent
            }, () => {
                showSuccessMessage('Greeting Injected!');
            });
        }
    });

    // --- 2. NEW Geolocation Functionality (using a standard Web API) ---
    locationButton.addEventListener('click', () => {
        if (navigator.geolocation) {
            
            showSuccessMessage('Requesting location...', 5000);
            
            // Use the standard Geolocation Web API
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    // On success, use a Chrome API to inject the result into the page
                    injectLocation(lat, lon);
                },
                (error) => {
                    // Handle geolocation errors (like user denying permission)
                    let errorMessage = "Could not get location.";
                    if (error.code === error.PERMISSION_DENIED) {
                        errorMessage = "Location permission denied. Click the 'i' icon next to the URL.";
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        errorMessage = "Location information is unavailable.";
                    }
                    showSuccessMessage(`Error: ${errorMessage}`, 5000);
                    console.error("Geolocation Error:", error);
                }
            );
        } else {
            showSuccessMessage('Geolocation is not supported by this browser.', 4000);
        }
    });

    // Helper function to inject location data via chrome.scripting API
    async function injectLocation(latitude, longitude) {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab && tab.id) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                // Pass the data as arguments to the function running in the webpage
                function: injectLocationContent,
                args: [latitude, longitude] 
            }, () => {
                showSuccessMessage(`Location Injected: Lat ${latitude.toFixed(2)}, Lon ${longitude.toFixed(2)}`);
            });
        }
    }
});

/**
 * This function is executed inside the context of the active web page (for the first button).
 */
function injectContent() {
    // Check if the greeting element already exists to avoid duplicates
    let greeting = document.getElementById('chrome-ext-greeting');
    
    if (!greeting) {
        greeting = document.createElement('div');
        greeting.id = 'chrome-ext-greeting';
        greeting.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 15px;
            background: #10b981; /* Emerald green */
            color: white;
            z-index: 10000;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            font-family: 'Inter', sans-serif;
            font-size: 16px;
            animation: fadeIn 0.5s ease-out;
        `;
        
        greeting.innerHTML = '👋 **Hello from your first Chrome Extension!**';
        
        // Append it to the page body
        document.body.appendChild(greeting);

        // Add a simple fade-in CSS animation directly using an injected style tag
        if (!document.getElementById('chrome-ext-style')) {
            const style = document.createElement('style');
            style.id = 'chrome-ext-style';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        // Remove the greeting after 5 seconds
        setTimeout(() => {
            if (document.getElementById('chrome-ext-greeting')) {
                document.getElementById('chrome-ext-greeting').remove();
            }
        }, 5000);
    }
}



/**
 * This function is executed inside the context of the active web page 
 * and displays the Geolocation results (for the second button).
 */
function injectLocationContent(lat, lon) {
    // Standard DOM manipulation to show the location
    let locator = document.getElementById('chrome-ext-location');
    
    if (!locator) {
        locator = document.createElement('div');
        locator.id = 'chrome-ext-location';
        locator.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            padding: 10px 15px;
            background: #f59e0b; /* Amber */
            color: white;
            z-index: 10000;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            font-family: 'Inter', sans-serif;
            font-size: 14px;
        `;
        document.body.appendChild(locator);
    }

    locator.innerHTML = `🌍 Your Location (Web API): <br>Lat: <b>${lat.toFixed(4)}</b>, Lon: <b>${lon.toFixed(4)}</b>`;

    // Remove the location box after 8 seconds
    setTimeout(() => {
        if (document.getElementById('chrome-ext-location')) {
            document.getElementById('chrome-ext-location').remove();
        }
    }, 8000);
}