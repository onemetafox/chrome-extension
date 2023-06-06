
let activeTabId, lastUrl, lastTitle;
let targetUrl = "https://www.walmart.com/";

function getTabInfo(tabId) {
    chrome.tabs.get(tabId, function(tab) {
        if(lastUrl != tab.url || lastTitle != tab.title)
            // in the future, the online server socket will be replaced
            var ws = new WebSocket('ws://localhost:40510');
            if(tab.url.includes(targetUrl)){
                console.log(tab.id);
                (async () => {
                    const response = await chrome.tabs.sendMessage(tab.id, "test");
                    console.log(response);
                })();
                // event emmited when connected
                ws.onopen = function () {
                    console.log('websocket is connected ...')

                    // sending a send event to websocket server
                    ws.send('connected')
                }

                // // event emmited when receiving message 
                ws.onmessage = function (ev) {
                    console.log(ev);
                }
            }
        console.log(lastUrl = tab.url, lastTitle = tab.title);
    });
}

chrome.tabs.onActivated.addListener(function(activeInfo) {
    getTabInfo(activeTabId = activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if(activeTabId == tabId) {
        getTabInfo(tabId);
    }
});