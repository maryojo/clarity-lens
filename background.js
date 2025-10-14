// The Service Worker is a background script that runs outside of the visible web pages.
// It is primarily used to listen for and respond to browser events.

// Listen for the event that occurs when the extension is first installed.
chrome.runtime.onInstalled.addListener((details) => {
    // Check if the installation reason is a fresh install (not an update or reload)
    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
        // Use chrome.tabs.create to open a new tab with our welcome page.
        chrome.tabs.create({
            url: 'welcome_page.html'
        });
    }
});
