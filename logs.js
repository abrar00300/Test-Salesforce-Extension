document.addEventListener("DOMContentLoaded", function () {
    console.log('logs.js running');
    chrome.storage.local.get("sid", function (data) {
        if (data.sid) {
            chrome.storage.local.get("activeTabUrl", function (urlData) {
                let instanceUrl = "https://default.salesforce.com";  
                if (urlData.activeTabUrl) {
                    let tabUrl = urlData.activeTabUrl;
                    
                    if (tabUrl.includes('lightning.force.com')) {
                        instanceUrl = tabUrl.replace('lightning.force.com', 'my.salesforce.com');
                    }

                    instanceUrl = instanceUrl.split('/')[2];  
                    console.log("Extracted Instance URL:", instanceUrl);
                }
                document.getElementById("tabUrl").innerText = `Current Salesforce Domain : ${instanceUrl}`;
                fetchApexLogs(data.sid, instanceUrl);
            });
        } else {
            document.getElementById("logTable").innerHTML = "<tr><td colspan='3'>No session ID found!</td></tr>";
        }
    });
});

function fetchApexLogs(sessionId, instanceUrl) {
    const today = new Date().toISOString().split("T")[0];

    const query = `SELECT Id, LogLength,Status, StartTime FROM ApexLog WHERE StartTime >= ${today}T00:00:00Z ORDER BY StartTime DESC LIMIT 10`;
    const url = `https://${instanceUrl}/services/data/v60.0/tooling/query/?q=${encodeURIComponent(query)}`;

    fetch(url, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${sessionId}`,
            "Content-Type": "application/json"
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('data is ht for api->',data);
        const logTable = document.getElementById("logTable");
        logTable.innerHTML = "";  

        if (!data.records || data.records.length === 0) {
            logTable.innerHTML = "<tr><td colspan='3'>No logs found today.</td></tr>";
            return;
        }

        data.records.forEach(log => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${log.Id}</td>
                <td>${new Date(log.StartTime).toLocaleString()}</td>
                <td>${log.Status || 'N/A'}</td>
                <td>${(log.LogLength / 1024).toFixed(2)} KB</td>
            
            `;
            logTable.appendChild(row);
        });
    })
    .catch(error => {
        console.error("Error fetching logs:", error);
        document.getElementById("logTable").innerHTML = "<tr><td colspan='3'>Failed to load logs.</td></tr>";
    });
}
