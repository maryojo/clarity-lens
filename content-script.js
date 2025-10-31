// A local variable to hold the LanguageModel session for the 'Chat with Page' feature.
// This allows the model to remember previous questions/answers (the conversation history).
let chatSession = null; 
let userActionsChatSession = null;

// --- 1) Forward messages from the webpage to the extension background
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


// Feature Functions
async function capturePageScreenshot() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 90
    });
    return dataUrl;
  } catch (e) {
    console.error("Error in capturePageScreenshot. Did you remember to call this from a Service Worker?", e);
    throw new Error('screenshot-failed');
  }
}


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
        throw new Error('ai-unavailable-requirements');
    }
    
    // 4. Create summarizer instance
    const summarizerInstance = await Summarizer.create({
        outputLanguage: 'en',
        expectedInputLanguages: ['en', 'es', 'ja']
    });
    
    if (availability === 'downloadable' || availability === 'downloading') {
        console.log(`Summarizer model state: ${availability}. A download might be in progress.`);
    }

    // 5. Generate summary
    const summary = await summarizerInstance.summarize(selection, {
         length: 'short'
    });

    return summary;
}




// --- 3) Message handlers from popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // SUMMARIZE_SELECTION handler (Existing)
  if (request?.type === 'SUMMARIZE_SELECTION') {
      (async () => {
        try {
          const summary = await summarizeSelectedText();
          const normalized = (typeof summary === 'string') ? summary : (summary?.text || JSON.stringify(summary));
          sendResponse({ status: 'ok', summary: normalized });
        } catch (err) {
          const code = err?.message || 'unknown';
          if (code === 'no-selection') {
            sendResponse({ status: 'error', error: 'no-selection', message: 'Please select text on the page first.' });
          } else if (code.startsWith('ai-')) {
            sendResponse({ status: 'error', error: code, message: `AI Summarizer: ${code.replace('ai-', '')} issue.` });
          } else {
            sendResponse({ status: 'error', error: 'summarize-failed', message: String(err) });
          }
        }
      })();

    return true;
  }

  // EXPLAIN_FORM (Conversation with Multimodal Input)
  if (request?.type === 'EXPLAIN_FORM') {
      (async () => {
     
 const screenshot = await capturePageScreenshot(); 
    
    const ai = await chrome.ai.getLanguageModel(); 
    
    const promptText = `
      You are a friendly, conversational form assistant.
      Analyze the visual information from this form and answer the following questions conversationally.
      1. What are the key pieces of information needed?
      2. What is the goal of this form (its purpose)?
      3. What are the most common mistakes people make when filling this out?
      Explain in simple terms as if guiding a friend.
    `;

    const analysis = await ai.prompt({
        prompt: promptText,
        image: {
            dataUri: screenshot,
        }
    });

    return analysis.text;
      })();

    return true; 
  }

// 💡 NEW IMPLEMENTATION: This is the Message Bridge to background.js
async function capturePageScreenshot() {
    // Send a message to the background service worker
    const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' }, (res) => {
            if (chrome.runtime.lastError) {
                // Catch internal errors (e.g., service worker inactive)
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(res);
            }
        });
    });

    if (response.status === 'ok') {
        return response.dataUrl;
    } else {
        throw new Error(response.message || 'screenshot-failed');
    }
}

  //  CHAT_WITH_PAGE_START (Setup the initial chat session)
  if (request?.type === 'CHAT_WITH_PAGE_START') {
    (async () => {
        try {
            if (!('LanguageModel' in window)) {
                throw new Error('ai-not-available');
            }
            const availability = await LanguageModel.availability();

            console.log('This is my availabiltiy', availability);
            if (availability !== 'available') {
                 throw new Error('ai-unavailable-requirements');
            }
            
            // Get all visible text on the page to provide context
            const pageText = document.body.innerText.slice(0, 10000); // Limit context size

            // Create a persistent, stateful session for conversation
            chatSession = await LanguageModel.create({
                initialPrompts: [{
                    role: 'system',
                    content: `You are an expert Q&A assistant for the current web page. Use the following page content to answer questions. If you don't know the answer, say so. Page Content: """${pageText}"""`,
                }],
                expectedOutputs: [
                    { type: "text", languages: ["en"] }
                  ]
                });

            sendResponse({ status: 'ok', message: 'Chat session started. Ask a question.' });
        } catch (err) {
            chatSession = null;
console.log(err);
            sendResponse({ status: 'error', error: err.message || 'chat-failed-start', message: 'Could not start chat session. Check AI availability.' });
        }
    })();
    return true;
  }
  
  // CHAT_WITH_PAGE_SEND (Send a message to the active session)
  if (request?.type === 'CHAT_WITH_PAGE_SEND') {
    (async () => {
        try {
            if (!chatSession) {
                throw new Error('chat-session-not-active');
            }
            
            // Send the user's question to the existing session
            const response = await chatSession.prompt(request.question);
            
            // The chatSession automatically updates its internal history
            sendResponse({ status: 'ok', answer: response });
            
        } catch (err) {
            sendResponse({ status: 'error', error: err.message || 'chat-failed-send', message: 'Chat failed. Did you click "Start Chat"?' });
        }
    })();
    return true;
  }

    //  GET_USER_ACTIONS (Setup the initial chat session)
  if (request?.type === 'GET_USER_ACTIONS') {
    (async () => {
        try {
            if (!('LanguageModel' in window)) {
                throw new Error('ai-not-available');
            }
            const availability = await LanguageModel.availability();

            console.log('This is my availabiltiy', availability);
            if (availability !== 'available') {
                 throw new Error('ai-unavailable-requirements');
            }
            
            // Get all visible text on the page to provide context
            const pageText = document.body.innerText.slice(0, 10000); // Limit context size

            // Create a persistent, stateful session for conversation
            userActionsChatSession = await LanguageModel.create({
                initialPrompts: [{
                    role: 'system',
                    content: `You are an expert assistant for the current web page. Use the following page content to get out action items for the page visitor. If you don't see any, say so. Page Content: """${pageText}"""`,
                }],
                expectedOutputs: [
                    { type: "text", languages: ["en"] }
                  ]
                });
            const response = await userActionsChatSession.prompt(`
    You are a structured assistant that extracts and organizes action items from the web page.
    
    From the web page, extract and sort items into the following sections in plain text (do not include JSON or code blocks):
    
    MUST DO:
    □ Action (deadline if any)
    
    SHOULD DO:
    □ Action (deadline if any)
    
    WATCH OUT FOR:
    ⚠️ Warning or consequence
    
    CONTACT INFO:
    • Who to call/email
    
    Ensure that:
    - The actions are prioritized and sorted into the correct sections based on urgency and importance.
    - The result is clear, readable plain text, no markdown or JSON formatting.
    
    Web page content:
    "${pageText}"
  `);
            sendResponse({ status: 'ok', message: response.answer });
        } catch (err) {
            userActionsChatSession = null;
console.log(err);
            sendResponse({ status: 'error', error: err.message || 'chat-failed-start', message: 'Could not start chat session. Check AI availability.' });
        }
    })();
    return true;
  }
});
