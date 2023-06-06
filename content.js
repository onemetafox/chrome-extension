chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('from background script: ' + message )
    sendResponse('message recieved')
});

function sendToBackground(type, data) {
    chrome.runtime.sendMessage({
        type,
        target: 'background',
        data
    });
}
