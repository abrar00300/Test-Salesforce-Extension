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

                // Event listeners for filters
                document.getElementById("filterUser").addEventListener("change", () => fetchApexLogs(data.sid, instanceUrl));
                document.getElementById("filterTime").addEventListener("change", () => fetchApexLogs(data.sid, instanceUrl));
                document.getElementById("resetFilters").addEventListener("click", () => {
                    // Reset filter inputs
                    document.getElementById("filterUser").value = "";
                    document.getElementById("filterTime").value = "00:00";
        
                    // Trigger any logic to show all logs here
                    fetchApexLogs(data.sid, instanceUrl);
                });

             
                document.getElementById("logTable").addEventListener('click', function(event) {
                    // Check if the clicked element is a button with class 'open-log-btn'
                    if (event.target && event.target.classList.contains('open-log-btn')) {
                        console.log('Button clicked:', event.target);
                        handleRowClick(event);  // Call the handler
                    }
                });
            });
        } else {
            document.getElementById("logTable").innerHTML = "<tr><td colspan='5'>No session ID found!</td></tr>";
        }
    });
});

// Fetch and display logs
function fetchApexLogs(sessionId, instanceUrl) {
    let selectedTime = document.getElementById("filterTime").value;
    let selectedUser = document.getElementById("filterUser").value;

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    let filterDateTime = new Date(`${today}T00:00:00`); // Default to midnight in local time

    if (selectedTime) {
        let [hours, minutes] = selectedTime.split(":");
        filterDateTime.setHours(hours, minutes, 0, 0); // Set filter time in local timezone
    }

    let query = `SELECT Id, LogLength, Status, StartTime, LogUser.Name 
                 FROM ApexLog 
                 WHERE StartTime >= ${today}T00:00:00.000+0000 
                 ORDER BY StartTime DESC`;

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
        console.log('Fetched Logs:', data);
        const logTable = document.getElementById("logTable");
        const userFilter = document.getElementById("filterUser");

        logTable.innerHTML = "";

        if (!data.records || data.records.length === 0) {
            logTable.innerHTML = "<tr><td colspan='6'>No logs found.</td></tr>";
            return;
        }

        let users = new Set();
        let filteredLogs = [];

        data.records.forEach(log => {
            let logDate = new Date(log.StartTime); // Convert UTC time to local
            let logLocalTime = logDate.toLocaleString(); // Display formatted local time
            
            if (logDate < filterDateTime) return; // Filter logs based on local time

            users.add(log.LogUser.Name);

            // If a user is selected, only show logs for that user
            if (!selectedUser || log.LogUser.Name === selectedUser) {
                filteredLogs.push({
                    id: log.Id,
                    logLocalTime: logLocalTime,
                    status: log.Status || 'N/A',
                    logLength: (log.LogLength / 1024).toFixed(2),
                    logUserName: log.LogUser.Name
                });
            }
        });

        // If no logs match the filter (time or user), show no logs message
        if (filteredLogs.length === 0) {
            logTable.innerHTML = "<tr><td colspan='6'>No matching logs found.</td></tr>";
            return;
        }

        // Populate the user filter dropdown
        userFilter.innerHTML = `<option value="">All Users</option>`;
        users.forEach(user => {
            userFilter.innerHTML += `<option value="${user}">${user}</option>`;
        });

        // Render the filtered logs in the table
        filteredLogs.forEach(log => {
            const row = document.createElement("tr");
            row.innerHTML = `
                <td>${log.id}</td>
                <td>${log.logLocalTime}</td>
                <td>${log.status}</td>
                <td>${log.logLength} KB</td>
                <td>${log.logUserName}</td>
                <td><button class="open-log-btn" data-id="${log.id}">Open Log</button></td>
            `;
            logTable.appendChild(row);
        });
    })
    .catch(error => {
        console.error("Error fetching logs:", error);
        document.getElementById("logTable").innerHTML = "<tr><td colspan='6'>Failed to load logs.</td></tr>";
    });
}


// Handle row click to fetch and show the log body in a modal
async function handleRowClick(event) {
    const logId = event.target.getAttribute("data-id");
    chrome.storage.local.get("sid", async function(data) {
        const sessionID = data.sid;
        
        if (!sessionID) {
            console.error("Session ID not found!");
            return;
        }

        chrome.storage.local.get("activeTabUrl", function(urlData) {
            let instanceUrl = "https://default.salesforce.com";
            if (urlData.activeTabUrl) {
                let tabUrl = urlData.activeTabUrl;

                if (tabUrl.includes('lightning.force.com')) {
                    instanceUrl = tabUrl.replace('lightning.force.com', 'my.salesforce.com');
                }

                instanceUrl = instanceUrl.split('/')[2];
            }

            console.log('logId->', logId);
            console.log('sessionID->', sessionID);
            console.log('instanceUrl->', instanceUrl);

            const myHeaders = new Headers();
            myHeaders.append("Authorization", "Bearer " + sessionID);

            const requestOptions = {
                method: "GET",
                headers: myHeaders,
                redirect: "follow"
            };

            const apiUrl = `https://${instanceUrl}/services/data/v60.0/sobjects/ApexLog/${logId}/Body`;

            fetch(apiUrl, requestOptions)
                .then(response => response.text())
                .then(logBody => {
                    console.log('Log Body:', logBody);
                    showModal(logBody);  // Show modal with the log body
                })
                .catch(error => {
                    console.error("Error fetching log details:", error);
                });
        });
    });
}
// Function to show the modal with log content
function showModal(logBody) {
    console.log('open modal');
    const modal = document.createElement("div");
    modal.setAttribute("class", "modal");

    // Create a checkbox to toggle "Show Debug Only"
    const debugCheckbox = `
        <div class="debug-checkbox">
            <label for="showDebugOnly">Show Debug Only</label>
            <input type="checkbox" id="showDebugOnly" />
        </div>
    `;

    // Create the filter input field
    const filterInput = `
        <div class="filter-input">
            <label for="logFilter">Filter Logs:</label>
            <input type="text" id="logFilter" placeholder="Type to filter logs..." />
        </div>
    `;

    // Create modal content with the checkbox, filter input, and log body
    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            ${debugCheckbox}
            ${filterInput}
            <pre class="log-body">${logBody}</pre>
        </div>
    `;
    document.body.appendChild(modal);

    // Adding 'show' class to trigger the transition
    setTimeout(() => {
        modal.classList.add('show');
        modal.querySelector('.modal-content').classList.add('show');
    }, 10);

    const closeBtn = modal.querySelector(".close-btn");
    closeBtn.addEventListener("click", () => {
        modal.remove();  // Close modal when the close button is clicked
    });

    // Get the log body element
    const logBodyElement = modal.querySelector(".log-body");

    // Filter event listener for the input field
    const filterInputElement = modal.querySelector("#logFilter");

    // Get the checkbox
    const showDebugOnlyCheckbox = modal.querySelector("#showDebugOnly");

    // Listen for changes in the checkbox (Show Debug Only)
    showDebugOnlyCheckbox.addEventListener("change", () => {
        if (showDebugOnlyCheckbox.checked) {
            // If "Debug Only" is checked, filter and show only the debug logs
            let debugLog = getDebugOnlyLog(logBody);
            const filteredDebugLog = filterLog(debugLog, filterInputElement.value);
            logBodyElement.textContent = filteredDebugLog;
        } else {
            // If "Debug Only" is unchecked, show the full log
            const filteredLog = filterLog(logBody, filterInputElement.value);
            logBodyElement.textContent = filteredLog;
        }
    });

    // Real-time filtering based on the input
    filterInputElement.addEventListener("input", () => {
        const filterTerm = filterInputElement.value;

        if (showDebugOnlyCheckbox.checked) {
            // Filter only the debug logs when "Show Debug Only" is checked
            let debugLog = getDebugOnlyLog(logBody);
            const filteredDebugLog = filterLog(debugLog, filterTerm);
            logBodyElement.textContent = filteredDebugLog;
        } else {
            // Filter the full log when "Show Debug Only" is not checked
            const filteredLog = filterLog(logBody, filterTerm);
            logBodyElement.textContent = filteredLog;
        }
    });
}

// Function to filter log content based on a search term
function filterLog(logBody, filterTerm) {
    const logLines = logBody.split("\n");
    if (!filterTerm) {
        return logBody;  // If filter term is empty, return the full log
    }
    const filteredLines = logLines.filter(line => line.toUpperCase().includes(filterTerm.toUpperCase()));
    return filteredLines.join("\n");
}

// Function to extract debug information from the full log
function getDebugOnlyLog(logBody) {
    // Assuming the debug logs are marked with some specific keyword like 'DEBUG'
    const debugLines = logBody.split("\n").filter(line => line.includes("DEBUG"));
    return debugLines.join("\n");
}


