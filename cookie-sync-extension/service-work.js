let activeTabId, lastUrl, lastTitle;

function getTabInfo(tabId) {
    chrome.tabs.get(tabId, function(tab) {
        if(lastUrl != tab.url || lastTitle != tab.title){
            browser.tabs.sendMessage(tab.id,{"msg":"tabupdate", "id":tab.id, "url":tab.url})
            .then((res) => {
                console.log(res.msg)
            });
        }
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