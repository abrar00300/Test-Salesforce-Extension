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

                document.getElementById("filterUser").addEventListener("change", () => fetchApexLogs(data.sid, instanceUrl));
                document.getElementById("filterTime").addEventListener("change", () => fetchApexLogs(data.sid, instanceUrl));
                document.getElementById("filterStatus").addEventListener("change",() =>  fetchApexLogs(data.sid, instanceUrl));
                document.getElementById("resetFilters").addEventListener("click", () => {
                    document.getElementById("filterUser").value = "";
                    document.getElementById("filterTime").value = "00:00";
                    document.getElementById("filterStatus").value = "";

                    fetchApexLogs(data.sid, instanceUrl);
                });
                document.addEventListener('contextmenu', function(event) {
                    event.preventDefault();
                });
                document.addEventListener('keydown', function(event) {
                    if ((event.key === 'F12') || (event.ctrlKey && event.shiftKey && event.key === 'I')) {
                        event.preventDefault();
                        console.log("Inspecting is disabled.");
                    }
                });
                                


                document.getElementById("refreshLogs").addEventListener("click", function () {
                    console.log("Refresh button clicked!");
                    //  chrome.storage.local.get(["sid", "instanceUrl"], function (data) {
                    console.log('sid->', data.sid);
                    console.log('sid->', instanceUrl);
                    if (data.sid && instanceUrl) {
                        fetchApexLogs(data.sid, instanceUrl);
                    } else {
                        console.error("Session ID or Instance URL missing!");
                    }
                    // });
                });

                document.getElementById("logTable").addEventListener('click', function (event) {
                    if (event.target && event.target.classList.contains('open-log-btn')) {
                        console.log('Button clicked:', event.target);
                        handleRowClick(event);  // Call the handler
                    }
                    if (event.target && event.target.classList.contains('delete-log-btn')) {
                        console.log('Delete Button clicked:', event.target);
                        const logId = event.target.getAttribute("data-id");
                        deleteApexLog(logId, instanceUrl)
                    }
                });

                const clearStorageButton = document.getElementById('clearStorageBtn');

                clearStorageButton.addEventListener('click', function () {
                    chrome.storage.local.remove(['sid', 'activeTabUrl'], function () {
                        if (chrome.runtime.lastError) {
                            console.error("Error clearing local storage:", chrome.runtime.lastError);
                        } else {
                            console.log("Local storage cleared: sid and activeTabUrl.");
                        }

                        alert("Local storage cleared successfully.");
                    });
                });

            });

            const goToTopBtn = document.getElementById("goToTopBtn");
            const tableContainer = document.querySelector(".table-container");

            tableContainer.addEventListener("scroll", () => {
                if (tableContainer.scrollTop > 200) {
                    goToTopBtn.style.display = "block";
                } else {
                    goToTopBtn.style.display = "none";
                }
            });

            // Scroll to top on click
            goToTopBtn.addEventListener("click", () => {
                tableContainer.scrollTo({
                    top: 0,
                    behavior: "smooth"
                });
            });


        } else {
            document.getElementById("logTable").innerHTML = "<tr><td colspan='5'>No session ID found!</td></tr>";
        }
    });
});

function fetchApexLogs(sessionId, instanceUrl) {
    let selectedTime = document.getElementById("filterTime").value;
    let selectedUser = document.getElementById("filterUser").value;
    let selectedStatus = document.getElementById("filterStatus").value.toLowerCase();

    
    const today = new Date().toISOString().split("T")[0];
    let filterDateTime = new Date(`${today}T00:00:00`);

    if (selectedTime) {
        let [hours, minutes] = selectedTime.split(":");
        filterDateTime.setHours(hours, minutes, 0, 0);
    }

    let query = `SELECT Id, LogLength, Status, StartTime, LogUser.Name 
                 FROM ApexLog 
                 WHERE StartTime >= ${today}T00:00:00.000+0000 
                 ORDER BY StartTime DESC`;

    // If there's a selected status filter, apply it in the query
       if (selectedStatus === 'error') {
        query = query.replace(
            "ORDER BY StartTime DESC",
            "AND Status != 'Success' ORDER BY StartTime DESC"
        );
    } else if (selectedStatus) {
        query = query.replace(
            "ORDER BY StartTime DESC",
            `AND Status = '${selectedStatus}' ORDER BY StartTime DESC`
        );
    }

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
                let logDate = new Date(log.StartTime);
                let logLocalTime = logDate.toLocaleString();

                if (logDate < filterDateTime) return;

                users.add(log.LogUser.Name);

                let logStatus = log.Status ? log.Status.toLowerCase() : 'n/a';

                let matchesUser = !selectedUser || log.LogUser.Name === selectedUser;
                let matchesStatus = !selectedStatus ||
                    (selectedStatus === "success" && logStatus === "success") ||
                    (selectedStatus === "error" && logStatus !== "success");

                if (matchesUser && matchesStatus) {
                    let logLengthFormatted;
                    let logLength = log.LogLength;

                    if (logLength >= 1048576) {
                        logLengthFormatted = (logLength / 1048576).toFixed(2) + " MB";
                    } else {
                        logLengthFormatted = (logLength / 1024).toFixed(2) + " KB";
                    }

                    filteredLogs.push({
                        id: log.Id,
                        logLocalTime: logLocalTime,
                        status: log.Status || 'N/A',
                        logLength: logLengthFormatted,
                        logUserName: log.LogUser.Name
                    });
                }
            });

            if (filteredLogs.length === 0) {
                logTable.innerHTML = "<tr><td colspan='6'>No matching logs found.</td></tr>";
                return;
            }

            let currentSelectedUser = selectedUser;
            userFilter.innerHTML = `<option value="">All Users</option>`;
            users.forEach(user => {
                let selectedAttr = user === currentSelectedUser ? "selected" : "";
                userFilter.innerHTML += `<option value="${user}" ${selectedAttr}>${user}</option>`;
            });

            filteredLogs.forEach(log => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${log.id}</td>
                    <td>${log.logLocalTime}</td>
                    <td>${log.status}</td>
                    <td>${log.logLength}</td>
                    <td>${log.logUserName}</td>
                    <td class="action-buttons">
                        <button class="open-log-btn" data-id="${log.id}">Open</button>
                        <button class="download-log-btn" data-id="${log.id}">Download</button>
                        <button class="delete-log-btn" data-id="${log.id}">Delete</button>
                    </td>
                `;
                logTable.appendChild(row);
            });

            document.querySelectorAll(".download-log-btn").forEach(button => {
                button.addEventListener("click", function () {
                    let logId = this.getAttribute("data-id");
                    downloadLogFile(logId, instanceUrl);
                });
            });

        })
        .catch(error => {
            console.error("Error fetching logs:", error);
            document.getElementById("logTable").innerHTML = "<tr><td colspan='6'>Failed to load logs.</td></tr>";
        });
}





async function handleRowClick(event) {
    const logId = event.target.getAttribute("data-id");
    chrome.storage.local.get("sid", async function (data) {
        const sessionID = data.sid;

        if (!sessionID) {
            console.error("Session ID not found!");
            return;
        }

        chrome.storage.local.get("activeTabUrl", function (urlData) {
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
                    // console.log('Log Body:', logBody);
                    showModal(logBody);  
                })
                .catch(error => {
                    console.error("Error fetching log details:", error);
                });
        });
    });
}
function showModal(logBody) {
    console.log('open modal');
    const modal = document.createElement("div");
    modal.setAttribute("class", "modal");

    const debugCheckbox = `
        <div class="debug-checkbox">
            <label for="showDebugOnly">Show Debug Only</label>
            <input type="checkbox" id="showDebugOnly" />
        </div>
    `;

    const filterInput = `
        <div class="filter-input">
            <label for="logFilter">Filter Logs:</label>
            <input type="text" id="logFilter" placeholder="Type to filter logs..." />
        </div>
    `;

    modal.innerHTML = `
        <div class="modal-content">
            <span class="close-btn">&times;</span>
            ${debugCheckbox}
            ${filterInput}
            <pre class="log-body" id="log-body"></pre>
        </div>
    `;
    document.body.appendChild(modal);

    setTimeout(() => {
        modal.classList.add('show');
        modal.querySelector('.modal-content').classList.add('show');
    }, 10);

    const closeBtn = modal.querySelector(".close-btn");
    closeBtn.addEventListener("click", () => {
        modal.remove();
    });

    const logBodyElement = modal.querySelector("#log-body");
    const filterInputElement = modal.querySelector("#logFilter");
    const showDebugOnlyCheckbox = modal.querySelector("#showDebugOnly");

    let currentLogPosition = 0;
    const chunkSize = 100000; // Adjust size to your needs, this controls how much data is shown at a time

    function loadNextChunk() {
        const chunk = logBody.slice(currentLogPosition, currentLogPosition + chunkSize);
        logBodyElement.textContent += chunk; // Append the chunk to the log body
        currentLogPosition += chunkSize;

        if (currentLogPosition < logBody.length) {
            // If there’s more to load, create a "Load more" button
            const loadMoreBtn = document.createElement("button");
            loadMoreBtn.textContent = "Load More Logs";
            loadMoreBtn.addEventListener("click", () => {
                loadNextChunk(); // Load next chunk when button clicked
                loadMoreBtn.remove(); // Remove the button after loading more
            });
            logBodyElement.appendChild(loadMoreBtn);
        }
    }

    loadNextChunk(); // Initial load

    showDebugOnlyCheckbox.addEventListener("change", () => {
        if (showDebugOnlyCheckbox.checked) {
            let debugLog = getDebugOnlyLog(logBody);
            const filteredDebugLog = filterLog(debugLog, filterInputElement.value);
            logBodyElement.textContent = filteredDebugLog;
        } else {
            const filteredLog = filterLog(logBody, filterInputElement.value);
            logBodyElement.textContent = filteredLog;
        }
    });

    filterInputElement.addEventListener("input", () => {
        const filterTerm = filterInputElement.value;

        if (showDebugOnlyCheckbox.checked) {
            let debugLog = getDebugOnlyLog(logBody);
            const filteredDebugLog = filterLog(debugLog, filterTerm);
            logBodyElement.textContent = filteredDebugLog;
        } else {
            const filteredLog = filterLog(logBody, filterTerm);
            logBodyElement.textContent = filteredLog;
        }
    });
}


function filterLog(logBody, filterTerm) {
    if (!filterTerm) return logBody;

    const lines = logBody.split("\n");
    let filteredLines = [];
    let captureNextLines = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes(filterTerm)) {
            filteredLines.push(line);
            captureNextLines = true;
            continue;
        }

        if (captureNextLines) {
            if (/^\d{2}:\d{2}:\d{2}/.test(line)) {
                captureNextLines = false;
                continue;
            }
            filteredLines.push(line);
        }
    }

    return filteredLines.join("\n");
}


function getDebugOnlyLog(logBody) {
    const debugLines = logBody.split("\n").filter(line => line.includes("DEBUG"));
    return debugLines.join("\n");
}
document.querySelectorAll("th").forEach((th) => {
    const handle = document.createElement("span");
    handle.classList.add("resize-handle");
    th.appendChild(handle);

    let isResizing = false;
    let startX, startWidth;

    handle.addEventListener("mousedown", (e) => {
        isResizing = true;
        startX = e.pageX;
        startWidth = th.offsetWidth;

        const doResize = (moveEvent) => {
            if (!isResizing) return;

            const newWidth = startWidth + (moveEvent.pageX - startX);
            if (newWidth > 50) { 
                th.style.width = newWidth + "px";
                th.style.minWidth = newWidth + "px";   
                th.style.maxWidth = newWidth + "px";   
            }
        };

        const stopResize = () => {
            isResizing = false;
            document.removeEventListener("mousemove", doResize);
            document.removeEventListener("mouseup", stopResize);
        };

        document.addEventListener("mousemove", doResize);
        document.addEventListener("mouseup", stopResize);
    });
});

function filterLogs() {
    const selectedStatus = document.getElementById("filterStatus").value.toLowerCase();
    const selectedUser = document.getElementById("filterUser").value; 
    console.log('in filter logs->',selectedUser);
    console.log('in filter status->',selectedStatus);
    document.querySelectorAll("#logTable tr").forEach(row => {
        const statusCell = row.cells[2];  
        const userCell = row.cells[4];  

        if (!statusCell || !userCell) return; 

        const logStatus = statusCell?.textContent.trim().toLowerCase();
        const logUser = userCell.textContent.trim();

        let showRow = true;

        if (selectedStatus === "success" && logStatus !== "success") {
            console.log('in if');
            showRow = false;
        } else if (selectedStatus === "error" && logStatus === "success") {
            console.log('in else if');
            showRow = false;
        }

       
        if (selectedUser && logUser !== selectedUser) {
            console.log('in ');
            
            showRow = false;
        }

        row.style.display = showRow ? "" : "none";  
    });
}
function downloadLogFile(logId, instanceUrl) {
    console.log('Download clicked');

     
    chrome.storage.local.get("sid", function (data) {
        if (!data.sid) {
            console.error("Session ID not found in local storage");
            return;
        }

        const url = `https://${instanceUrl}/services/data/v60.0/tooling/sobjects/ApexLog/${logId}/Body`;
        const sessionId = data.sid;

         
        fetch(url, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${sessionId}`
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch log. Status: ${response.status}`);
                }
                return response.text();
            })
            .then(logContent => {
                const blob = new Blob([logContent], { type: "text/plain" });
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `ApexLog_${logId}.txt`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            })
            .catch(error => {
                console.error("Error downloading log:", error);
            });
    });
}

function deleteApexLog(logId, instanceUrl) {
    if (!confirm("Are you sure you want to delete this log? This action cannot be undone.")) {
        return;
    }

    chrome.storage.local.get("sid", async function (data) {
        const sessionId = data.sid;

        if (!sessionId) {
            alert("Session ID not found! Please log in again.");
            return;
        }

        const deleteUrl = `https://${instanceUrl}/services/data/v60.0/tooling/sobjects/ApexLog/${logId}`;

        fetch(deleteUrl, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${sessionId}`,
                "Content-Type": "application/json"
            }
        })
            .then(response => {
                if (response.ok) {
                    alert("Log deleted successfully!");
                    fetchApexLogs(sessionId, instanceUrl);
                } else {
                    response.text().then(text => alert(`Failed to delete log: ${text}`));
                }
            })
            .catch(error => {
                console.error("Error deleting log:", error);
                alert("Error deleting log. Please try again.");
            });
    });
}



