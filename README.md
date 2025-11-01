# ClarityLens - AI Reading Assistant
Make any website easy to read. For people with dyslexia, seniors, immigrants, and anyone who struggles with complex text.

## Quick Start - Testing Instructions
### Prerequisites
- Google Chrome (version 127 or later)
- Chrome Built-in AI enabled (see setup below)

### Step 1: Enable Chrome Built-in AI
1. Open Chrome and go to `chrome://flags`
2. Search for and Enable these flags:
#optimization-guide-on-device-model
#prompt-api-for-gemini-nano
#summarization-api-for-gemini-nano
3. Restart Chrome
4. Verify AI is available:
- Open DevTools (F12)
- Go to Console
- Type in: await ai.languageModel.capabilities()
- It should return: { available: "readily" }

### Step 2: Install the Extension
1. Download/Clone this repository
   `git clone https://github.com/maryojo/claritylens.git
   cd claritylens`
2. Open Chrome and go to `chrome://extensions/`
3. Enable Developer mode (toggle in top-right)
4. Click "Load unpacked"
5. Select the extension folder from this project
6. The ClarityLens icon should appear in the extension list

### Step 3: Test the Extension

Test 1: Simplify Text
1. Go to a complex website e.g Any Wikipedia article with technical content
2. Click the ClarityLens icon in your toolbar
3. Select some text on the page
4. Click "Summarize Selection"
5. You should see a simplified summary appear

Test 2: Extract Actions
1. Go to a page with instructions or tasks (try these):
   - Any government form or application
   - Medical discharge instructions
2. Click the Actions tab
3. Click "Get Actions"
4. You should see a checklist with:
   - Must Do items
   - Should Do items
   - Warnings
   - Contact information
   - Timeline

Test 3: Chat with Page
1. Stay on any complex webpage
2. Click the Chat tab
3. Click "Start Chat"
4. Type a question like:
   - "What is this page about?"
   - "What do I need to do?"
   - "Hpw do I start?"
5. Press Enter or click Send
6. The AI should answer based on page content




