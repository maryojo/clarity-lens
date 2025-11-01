document.addEventListener('DOMContentLoaded', () => {
    const locationButton = document.getElementById('locationButton'); 
    const messageDiv = document.getElementById('message');
    const summarizeBtn = document.getElementById('summarize-btn'); 
    const summaryResultEl = document.getElementById('summary-result'); 
    const errorEl = document.getElementById('error'); 
    const loadingEl = document.getElementById('loading');

    const explainFormBtn = document.getElementById('explain-form-btn'); 
    // const formExplanationEl = document.getElementById('form-explanation-result'); 
    const startChatBtn = document.getElementById('start-chat-btn');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');
    const chatLogEl = document.getElementById('chat-log'); 
    const chatStatusEl = document.getElementById('chat-status');

    const startActionBtn = document.getElementById('start-action-btn');
    const actionResultEl = document.getElementById('actions-result');
    let actionResponse;

    let isChatActive = false; 

      const tabs = document.querySelectorAll(".icon-btn");
  const sections = document.querySelectorAll("#content-area > div");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      // Remove active states
      tabs.forEach((t) => t.classList.remove("active"));
      sections.forEach((s) => s.classList.remove("active"));

      // Add active state to the clicked tab and its content
      tab.classList.add("active");
      if (tab.id === "summarize-tab") {
        document.getElementById("summary-section").classList.add("active");
      } else if (tab.id === "actions-tab") {
        document.getElementById("action-section").classList.add("active");
      } else if (tab.id === "chat-tab") {
        document.getElementById("chat-section").classList.add("active");
      }
    });
  });

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
    // SUMMARIZE SELECTION
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
    // EXPLAIN FORM (Conversational Analysis)
    // ------------------------------------
    // if (explainFormBtn) {
    //     explainFormBtn.addEventListener('click', async () => {
    //         formExplanationEl.innerHTML = '<div class="chat-message ai">Analyzing form via screenshot...</div>';
    //         errorEl.textContent = '';
    //         setLoading(true);

    //         try {
    //             const tabId = await getCurrentTabId();
    //             const response = await sendMessageAsync(tabId, { type: 'EXPLAIN_FORM' });

    //             if (response.status === 'ok') {
    //                 formExplanationEl.textContent = response.explanation || 'Could not generate explanation.';
    //             } else {
    //                 formExplanationEl.textContent = '';
    //                 displayError(response.message || 'Form analysis failed.');
    //             }
    //         } catch (err) {
    //             displayError('Form analysis failed: ' + err.message);
    //         } finally {
    //             setLoading(false);
    //         }
    //     });
    // }

    // ------------------------------------
    // CHAT WITH PAGE - START
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
                //sendPromptToAI('hello ev'); 
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
                chatLogEl.innerHTML = `<div class="chat-message">Error: ${err.message || 'Check AI availability.'}</div>`;
                chatLogEl.classList.add('error');
            } finally {
                setLoading(false); 
            }
        });
    }

    // ------------------------------------
    // CHAT WITH PAGE - SEND
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
            chatLogEl.innerHTML += `<div class="chat-message">Error: ${err.message || 'Communication failed. Restart chat.'}</div>`;
            chatLogEl.classList.add('error');
        } finally {
            chatInput.disabled = false;
            chatSendBtn.disabled = false;
            chatInput.focus();
            chatLogEl.scrollTop = chatLogEl.scrollHeight;
        }
    }

    // ------------------------------------
    // GET USER ACTIONS - START
    // ------------------------------------
    if (startActionBtn) {
        startActionBtn.addEventListener('click', async () => {
            try {
                const tabId = await getCurrentTabId();
                //sendPromptToAI('hello ev');
                const response = await sendMessageAsync(tabId, { type: 'GET_USER_ACTIONS' });

                if (response.status === 'ok') {
                      actionResultEl.innerHTML = '';
                renderActions(response.message);
                } else {
                    throw new Error(response.message || 'Failed to start chat session.');
                }
            } catch (err) {
                isChatActive = false;
                actionResultEl.innerHTML += `<div class="chat-message">Error: ${err.message || 'Check AI availability.'}</div>`;
                actionResultEl.classList.add('error');
            } finally {
                setLoading(false); 
            }
        });
    }

 const icons = {
      mustDo: "🚨",
      shouldDo: "🟢",
      warnings: "⚠️",
      contacts: "📞",
      timeline: "🗓️"
    };

    const titles = {
      mustDo: "Must Do",
      shouldDo: "Should Do",
      warnings: "Warnings",
      contacts: "Contacts",
      timeline: "Timeline"
    };

    function renderSection(key, items) {
      let html = `<div class="section"><h3>${icons[key]} ${titles[key]}</h3><ul>`;
      if (!items || items.length === 0) {
        html += `<li><em>No ${titles[key].toLowerCase()}</em></li>`;
      } else {
        for (const item of items) {
          if (key === "mustDo" || key === "shouldDo") {
            html += `
              <li>
                <div class="item-header"><span class="icon">✅</span><span class="text">${item.text}</span></div>
                ${item.shortDescription ? `<p class="desc">${item.shortDescription}</p>` : ""}
                <span class="deadline">${item.deadline ? `Deadline: ${item.deadline}` : "No deadline"}</span>
                ${item.subItems?.length ? item.subItems.map(sub => `<div class="sub-item">• ${sub}</div>`).join("") : ""}
              </li>`;
          } else if (key === "warnings") {
            html += `
              <li>
                <div class="item-header"><span class="icon">⚠️</span><span class="text">${item.text}</span></div>
                <span class="deadline">Severity: ${item.severity || "normal"}</span>
              </li>`;
          } else if (key === "contacts") {
            html += `
              <li>
                <div class="item-header"><span class="icon">📞</span><span class="text">${item.label || item.type}</span></div>
                <div class="contact-info">${item.type}: ${item.value}</div>
              </li>`;
          } else if (key === "timeline") {
            html += `
              <li>
                <div class="item-header"><span class="icon">🗓️</span><span class="text">${item.text}</span></div>
                <div class="timeline-info">${item.date || "No date"} ${item.isDeadline ? "(Deadline)" : ""}</div>
              </li>`;
          }
        }
      }
      html += `</ul></div>`;
      return html;
    }

    function renderActions(data) {
      const container = document.getElementById("actions-result");
	console.log('data', data);

    if (!data) {
        container.innerHTML = '<div class="error-message">No action data received</div>';
        return;
    }

      container.innerHTML = `
        ${renderSection("mustDo", data.mustDo)}
        ${renderSection("shouldDo", data.shouldDo)}
        ${renderSection("warnings", data.warnings)}
        ${renderSection("contacts", data.contacts)}
        ${renderSection("timeline", data.timeline)}
      `;
    }


    // ------------------------------------
    // ORIGINAL FUNCTIONS, for testing, not raelly needed
    // ------------------------------------

    // Restore stored location (if any) and display it safely
    chrome.storage.local.get(["location"], (res) => {
        const loc = document.getElementById('location');
        if (res && res.location && loc) {
            // Prefer text to avoid injecting raw markup; stringify non-strings
            loc.textContent = (typeof res.location === 'string') ? res.location : JSON.stringify(res.location);
        }
    });

    // --- 2. NEW Geolocation Functionality (using a standard Web API) ---
    if (locationButton) {
        locationButton.addEventListener('click', () => {
            if (navigator.geolocation) {
                
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
                        console.error("Geolocation Error:", error);
                    }
                );
            } else {
                alert('Geolocation is not supported by this browser.');
            }
        });
    }
});

// This test file runs in the webpage context and sends a request
async function sendPromptToAI(text) {
    
    // Send a message to the Service Worker
    const response = await chrome.runtime.sendMessage({
        action: 'runAIPrompt',
        promptText: text
    });
    
    if (response.status === 'success') {
        console.log("AI Response:", response.response);
        // Update your UI with the response.response
        return response.response;
    } else {
        console.error("Failed to get AI response:", response.message);
    }
}

// Example usage when a button is clicked
// const userText = document.getElementById('user-input').value;
// sendPromptToAI(userText);

