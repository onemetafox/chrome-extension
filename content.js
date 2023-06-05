chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('from background script: ' + message )
    sendResponse('message recieved')
});