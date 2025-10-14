document.addEventListener('DOMContentLoaded', () => {
    const injectButton = document.getElementById('injectButton');
    const messageDiv = document.getElementById('message');

    // Add a click listener to the button
    injectButton.addEventListener('click', async () => {
        // 1. Get the current active tab
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab && tab.id) {
            // 2. Execute a script on the current tab using the 'scripting' permission
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: injectContent
            }, () => {
                // 3. Show success message after injection
                messageDiv.style.display = 'block';
                // Hide the message again after 3 seconds
                setTimeout(() => {
                    messageDiv.style.display = 'none';
                }, 3000);
            });
        }
    });
});

/**
 * This function is executed inside the context of the active web page.
 * It's completely isolated from the popup.js script.
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
