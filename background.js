// chrome.cookies.getAll({ domain: ".salesforce.com" }, function (cookies) {
//     let sessionId = null;
   
//     cookies.forEach((cookie) => {
//         if (cookie.name === "sid") {
//             sessionId = cookie.value;
//         }
//     });

//     if (sessionId) {
//         chrome.storage.local.remove('sid', function() {
//             console.log('Old sid removed from storage');
//         });
//         console.log("Salesforce Session ID:", sessionId);
//         chrome.storage.local.set({ sid: sessionId }, function() {
//             console.log("New session id stored in chrome.storage.local which is ->",sessionId);
//         });
//     } else {
//         console.error("Session ID not found.");
// //     }
// // });
// chrome.action.onClicked.addListener(() => {
//     // This will run only when the extension icon is clicked

//     // Get cookies only when the extension is opened
//     chrome.cookies.getAll({ domain: ".salesforce.com" }, function (cookies) {
//         let sessionId = null;

//         // Look for the "sid" cookie (Salesforce session cookie)
//         cookies.forEach((cookie) => {
//             if (cookie.name === "sid") {
//                 sessionId = cookie.value;
//             }
//         });

//         // Check if the sessionId is found
//         if (sessionId) {
//             // Log and remove the old session ID from chrome.storage.local
//             chrome.storage.local.get('sid', function (data) {
//                 if (data.sid && data.sid !== sessionId) {
//                     console.log('Old session ID detected:', data.sid);
//                     chrome.storage.local.remove('sid', function () {
//                         console.log('Old sid removed from storage');
//                     });
//                 }
//             });

//             // Store the new session ID in chrome.storage.local
//             chrome.storage.local.set({ sid: sessionId }, function () {
//                 console.log("New session ID stored in chrome.storage.local:", sessionId);
//             });

//         } else {
//             console.error("Session ID not found.");
//         }
//     });

//     // Open a new popup window when the extension is clicked
//     chrome.system.display.getInfo((displays) => {
//         const primaryDisplay = displays.find(display => display.isPrimary);
//         chrome.windows.create({
//             url: "logs.html",
//             left: 0,
//             top: 0,
//             width: primaryDisplay.workArea.width,
//             height: primaryDisplay.workArea.height,
//             type: "popup"
//         });
//     });
// });

// // Code to manage active tab URL and extension icon enable/disable
// let lastActiveTabUrl = "";

// chrome.tabs.onActivated.addListener((activeInfo) => {
//     chrome.tabs.get(activeInfo.tabId, function (tab) {
//         const currentTabUrl = tab.url;

//         // Check if the active tab's URL is a Salesforce org
//         if (currentTabUrl && currentTabUrl.includes(".force.com")) {
//             lastActiveTabUrl = currentTabUrl;
//             chrome.action.enable(); // Enable extension icon when Salesforce tab is active
//         } else {
//             // Only disable if the last active tab URL was a Salesforce org
//             if (lastActiveTabUrl.includes("force.com")) {
//                 chrome.action.disable(); // Disable extension icon if not a Salesforce tab
//             }
//         }
//     });
// });


chrome.action.onClicked.addListener(() => {
    // Get the current active tab's URL
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length === 0) {
            console.error('No active tab found');
            return;
        }

        const tabUrl = tabs[0].url;
        console.log('Tab URL: changes', tabUrl);
        console.log('bool->',tabUrl.includes('.force.com'));
        // Check if the tab URL is a Salesforce domain
        if (tabUrl.includes('.force.com')) {
            let domain = new URL(tabUrl).hostname;  // Extract domain (e.g., "incedo--qasandbox.sandbox.my.salesforce.com")
            console.log('Salesforce Org Domain:', domain);

            if(domain.includes('lightning.force.com')) {
                domain = domain.replace('lightning.force.com', 'my.salesforce.com');
                console.log('Updated Salesforce Org Domain:', domain);
            }

            // Fetch all cookies for the Salesforce domain
            chrome.cookies.getAll({ domain: "salesforce.com" }, function (cookies) {
                let sessionId = null;
                console.log('coockies->',cookies);
                // Loop through cookies to find the correct session cookie (sid)
                cookies.forEach(cookie => {
                    if (cookie.name === "sid" && cookie.domain==domain) {
                        console.log('++++++++++++++');
                        sessionId = cookie.value;
                    }
                });

                // If sessionId is found, store it in chrome.storage.local
                if (sessionId) {
                    chrome.storage.local.set({ sid: sessionId, activeTabUrl: tabUrl }, function() {
                        console.log("Session ID for the domain stored:", sessionId);
                    });
                } else {
                    console.error("Session ID not found for the domain:", domain);
                }
            });
        } else {
            console.error("Not a Salesforce tab, no SID to store.");
        }
        chrome.system.display.getInfo((displays) => {
            const primaryDisplay = displays.find(display => display.isPrimary);
            const width = primaryDisplay.workArea.width;
            const height = primaryDisplay.workArea.height;
        
            // Adjust width and height by subtracting a small amount to account for window borders, taskbar, etc.
            const adjustedWidth = width + 10; // You can adjust this value if necessary
            const adjustedHeight = height;
        
            chrome.windows.create({
                url: "logs.html",
                left: 0,
                top: 0,
                width: adjustedWidth,
                height: adjustedHeight,
                type: "popup"
            });
        });
        
        
    });
});

chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, function (tab) {
        const currentTabUrl = tab.url;

        // Check if the active tab's URL is a Salesforce org
        if (currentTabUrl && currentTabUrl.includes(".force.com")) {
            lastActiveTabUrl = currentTabUrl;
            chrome.action.enable(); // Enable extension icon when Salesforce tab is active
        } else {
            // Only disable if the last active tab URL was a Salesforce org
            if (lastActiveTabUrl.includes(".force.com")) {
                chrome.action.disable(); // Disable extension icon if not a Salesforce tab
            }
        }
    });
});
