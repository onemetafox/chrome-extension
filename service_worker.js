
let activeTabId, lastUrl, lastTitle;
let targetUrl = "http://localhost/isoprocess/";

function getTabInfo(tabId) {
    chrome.tabs.get(tabId, function(tab) {
        if(lastUrl != tab.url || lastTitle != tab.title)
            var ws = new WebSocket('ws://localhost:40510');
            if(tab.url.includes(targetUrl)){
                // event emmited when connected
                ws.onopen = function () {
                    console.log('websocket is connected ...')
                    // sending a send event to websocket server
                    ws.send('connected')
                }

                // event emmited when receiving message 
                ws.onmessage = function (ev) {
                    console.log(ev);
                }
            }else{
                ws.close();
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