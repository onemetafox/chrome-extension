let activeTabId, lastUrl, lastTitle;
let targetUrl = "https://www.walmart.com/";


function getTabInfo(tabId) {
    chrome.tabs.get(tabId, function(tab) {
        if(lastUrl != tab.url || lastTitle != tab.title){
            if(tab.url.includes(targetUrl)){
                // send message to active tab to get data from it
                chrome.tabs.sendMessage(tab.id, "ip-address");
            }
        }
        console.log(lastUrl = tab.url, lastTitle = tab.title);
    });
}
chrome.runtime.onMessage.addListener((message, data) => {
    if(message.type == "result"){
        var ws = new WebSocket('ws://localhost:40510');
        ws.onopen = function () {
            // sending a send event to websocket server
            ws.send(data)
        }

        // // event emmited when receiving message from server
        // ws.onmessage = function (ev) {
        //     console.log(ev);
        // }
    }
});
chrome.tabs.onActivated.addListener(function(activeInfo) {
    getTabInfo(activeTabId = activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if(activeTabId == tabId) {
        getTabInfo(tabId);
    }
});