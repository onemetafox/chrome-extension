chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if(message == "ip-address"){
        // get Ip adress from api
        $.get('https://icanhazip.com', function(res) {
            sendToBackground("result",res);
        });
    }
});

function sendToBackground(type, data) {
    chrome.runtime.sendMessage({
        type,
        data
    });
}
