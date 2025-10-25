// popup.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Original DOM Element References ---
    const injectButton = document.getElementById('injectButton');
    const locationButton = document.getElementById('locationButton'); 
    const messageDiv = document.getElementById('message');
    const summarizeBtn = document.getElementById('summarize-btn'); // Renamed 'btn' to 'summarizeBtn' for clarity
    const summaryResultEl = document.getElementById('summary-result'); // Renamed 'result' for clarity
    const errorEl = document.getElementById('error'); // Renamed 'error' for clarity
    const loadingEl = document.getElementById('loading'); // Renamed 'loading' for clarity

    // --- NEW DOM Element References for new features ---
    const explainFormBtn = document.getElementById('explain-form-btn'); 
    const formExplanationEl = document.getElementById('form-explanation-result'); 
    const startChatBtn = document.getElementById('start-chat-btn');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    const chatLogEl = document.getElementById('chat-log'); 
    const chatStatusEl = document.getElementById('chat-status');

    let isChatActive = false; // Manages the state of the chat session

    // --- Helper Functions ---

    function setLoading(on) {
        loadingEl.style.display = on ? 'inline' : 'none';
        // Disable all buttons while loading/processing
        summarizeBtn.disabled = on;
        if (explainFormBtn) explainFormBtn.disabled = on;
        if (startChatBtn) startChatBtn.disabled = on;
        
        // Chat Send button depends on loading AND chat being active
        if (chatSendBtn) chatSendBtn.disabled = on || !isChatActive;
        
        if (!on) summarizeBtn.focus();
    }
    
    function displayError(message) {
        errorEl.textContent = `Error: ${message}`;
        setTimeout(() => errorEl.textContent = '', 5000);
    }

    // Helper function to display temporary messages in the popup
    function showSuccessMessage(text = 'Content Injected! Check the page.', duration = 3000) {
        messageDiv.textContent = text;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, duration);
    }

    // Function to get the current tab ID using async/await syntax
    async function getCurrentTabId() {
        // chrome.tabs.query returns a Promise of an array, which we destructure.
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            throw new Error('No active tab found.');
        }
        return tab.id;
    }
    
    // Promisified version of chrome.tabs.sendMessage with custom error handling
    function sendMessageAsync(tabId, message) {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
                // Check for runtime errors (e.g., content script not running)
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message || 'Extension not active on this page.'));
                }
                // Check for missing response
                if (!response) {
                    return reject(new Error('No response from content script. The page may need to be refreshed.'));
                }
                resolve(response);
            });
        });
    }


    // ------------------------------------
    // SUMMARIZE SELECTION (Corrected)
    // ------------------------------------
    summarizeBtn.addEventListener('click', async () => {
        summaryResultEl.textContent = 'Processing...';
        errorEl.textContent = '';
        setLoading(true);

        try {
            const tabId = await getCurrentTabId();
            
            // Use the Promisified function
            const response = await sendMessageAsync(tabId, { type: 'SUMMARIZE_SELECTION' });

            if (response.status === 'ok') {
                summaryResultEl.textContent = response.summary || '(empty summary)';
            } else {
                summaryResultEl.textContent = '';
                // Map known errors back to friendly messages (THIS IS THE CORRECTION)
                let friendlyMessage = response.message || 'Summarization failed.';
                if (response.error === 'no-selection') {
                    friendlyMessage = 'Please select some text on the page before summarizing.';
                } else if (response.error === 'ai-not-available') {
                    friendlyMessage = 'AI Summarizer is not available in this context.';
                }
                displayError(friendlyMessage);
            }
        } catch (err) {
            summaryResultEl.textContent = '';
            displayError(err.message);
        } finally {
            setLoading(false);
        }
    });

    // ------------------------------------
    // NEW: EXPLAIN FORM (Conversational Analysis)
    // ------------------------------------
    if (explainFormBtn) {
        explainFormBtn.addEventListener('click', async () => {
            formExplanationEl.innerHTML = '<div class="chat-message ai">Analyzing form via screenshot...</div>';
            errorEl.textContent = '';
            setLoading(true);

            try {
                const tabId = await getCurrentTabId();
                const response = await sendMessageAsync(tabId, { type: 'EXPLAIN_FORM' });

                if (response.status === 'ok') {
                    formExplanationEl.textContent = response.explanation || 'Could not generate explanation.';
                } else {
                    formExplanationEl.textContent = '';
                    displayError(response.message || 'Form analysis failed.');
                }
            } catch (err) {
                displayError('Form analysis failed: ' + err.message);
            } finally {
                setLoading(false);
            }
        });
    }

    // ------------------------------------
    // NEW: CHAT WITH PAGE - START
    // ------------------------------------
    if (startChatBtn) {
        startChatBtn.addEventListener('click', async () => {
            chatLogEl.innerHTML = '<div class="chat-message ai">Starting chat session...</div>';
            errorEl.textContent = '';
            setLoading(true); 
            chatStatusEl.textContent = '(Starting)';
            if (chatInput) chatInput.disabled = true;
            if (chatSendBtn) chatSendBtn.disabled = true;

            try {
                const tabId = await getCurrentTabId();
                const response = await sendMessageAsync(tabId, { type: 'CHAT_WITH_PAGE_START' });

                if (response.status === 'ok') {
                    isChatActive = true;
                    chatStatusEl.textContent = '(Active)';
                    chatLogEl.innerHTML += `<div class="chat-message ai">AI: ${response.message}</div>`;
                    if (chatInput) chatInput.disabled = false;
                    if (chatSendBtn) chatSendBtn.disabled = false;
                    if (chatInput) chatInput.focus();
                } else {
                    throw new Error(response.message || 'Failed to start chat session.');
                }
            } catch (err) {
                isChatActive = false;
                chatStatusEl.textContent = '(Inactive)';
                chatLogEl.innerHTML += `<div class="chat-message ai">AI: Error: ${err.message || 'Check AI availability.'}</div>`;
            } finally {
                setLoading(false); 
            }
        });
    }

    // ------------------------------------
    // NEW: CHAT WITH PAGE - SEND
    // ------------------------------------
    if (chatSendBtn && chatInput) {
        chatSendBtn.addEventListener('click', handleChatSend);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleChatSend();
            }
        });
    }

    async function handleChatSend() {
        const question = chatInput.value.trim();
        if (!question || !isChatActive) return;

        // 1. Display User Message and disable input/send
        chatLogEl.innerHTML += `<div class="chat-message user">User: ${question}</div>`;
        chatInput.value = '';
        chatInput.disabled = true;
        chatSendBtn.disabled = true;
        
        // Scroll to bottom
        chatLogEl.scrollTop = chatLogEl.scrollHeight; 

        try {
            const tabId = await getCurrentTabId();
            const response = await sendMessageAsync(tabId, { type: 'CHAT_WITH_PAGE_SEND', question: question });

            // 2. Display AI Response
            if (response.status === 'ok') {
                chatLogEl.innerHTML += `<div class="chat-message ai">AI: ${response.answer}</div>`;
            } else {
                throw new Error(response.message || 'Chat message failed.');
            }
        } catch (err) {
            chatLogEl.innerHTML += `<div class="chat-message ai">AI: Error: ${err.message || 'Communication failed. Restart chat.'}</div>`;
        } finally {
            chatInput.disabled = false;
            chatSendBtn.disabled = false;
            chatInput.focus();
            chatLogEl.scrollTop = chatLogEl.scrollHeight;
        }
    }

    // ------------------------------------
    // ORIGINAL FUNCTIONS (Restored)
    // ------------------------------------

    // Restore stored location (if any) and display it safely
    chrome.storage.local.get(["location"], (res) => {
        const loc = document.getElementById('location');
        if (res && res.location && loc) {
            // Prefer text to avoid injecting raw markup; stringify non-strings
            loc.textContent = (typeof res.location === 'string') ? res.location : JSON.stringify(res.location);
        }
    });

    // --- 1. Existing Greeting Functionality ---
    if (injectButton) {
        injectButton.addEventListener('click', async () => {
            try {
                const tabId = await getCurrentTabId();
                // 2. Execute a script on the current tab using the 'scripting' permission
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    function: injectContent
                }, () => {
                    showSuccessMessage('Greeting Injected!');
                });
            } catch (err) {
                displayError('Injection failed: ' + err.message);
            }
        });
    }

    // --- 2. NEW Geolocation Functionality (using a standard Web API) ---
    if (locationButton) {
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
    }

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

// The functions below are injected into the content script and MUST remain outside the DOMContentLoaded listener.

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
