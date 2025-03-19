
chrome.cookies.getAll({ domain: ".salesforce.com" }, function (cookies) {
    let sessionId = null;
    cookies.forEach((cookie) => {
        if (cookie.name === "sid") {
            sessionId = cookie.value;
        }
    });

    if (sessionId) {
        console.log("Salesforce Session ID:", sessionId);
        chrome.storage.local.set({ sid: sessionId });
    } else {
        console.error("Session ID not found.");
    }
});

chrome.action.onClicked.addListener(() => {
    chrome.system.display.getInfo((displays) => {
        const primaryDisplay = displays.find(display => display.isPrimary);
        chrome.windows.create({
            url: "logs.html",
            left: 0,
            top: 0,
            width: primaryDisplay.workArea.width,
            height: primaryDisplay.workArea.height,
            type: "popup"
        });
    });
});
chrome.tabs.onActivated.addListener((activeInfo) => {


    chrome.tabs.get(activeInfo.tabId, function(tab) {
        console.log('tabt->',tab);
        console.log('Tab URL to be saved:', tab.url);
        const tabUrl = tab.url;
        
        console.log('Current active tab URL: ;line 21', tabUrl);
        
    

        if (tabUrl.includes('force.com')) {
            console.log('Current active tab URL: ;line 32', tabUrl);

            chrome.storage.local.remove('activeTabUrl', function() {
                console.log('Old activeTabUrl removed from storage');
            });
            
                chrome.storage.local.set({ activeTabUrl: tabUrl }, function() {
                    console.log("New active tab URL stored in chrome.storage.local which is ->",tabUrl);
                });
           
        } else {
            console.log('Tab URL does not contain "force.com", not storing.');
        }
    });
});

// background.js
// chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
//     const tabUrl = tabs[0].url;
//     console.log('Current active tab URL: ;line 32', tabUrl);

//     // Remove the old activeTabUrl value from storage
//     chrome.storage.local.remove('activeTabUrl', function() {
//         console.log('Old activeTabUrl removed from storage');
        
//         // Now store the new activeTabUrl
//         chrome.storage.local.set({ activeTabUrl: tabUrl }, function() {
//             console.log("New active tab URL stored in chrome.storage.local");
//         });
//     });
// });


 



