// ==UserScript==
// @name         Chase Zelle Payments
// @namespace    http://tampermonkey.net/
// @version      2.10
// @description  Automatically clicks "See details" links on Chase secure site, processing all rows
// @author       Karthikeyan Pasupathy
// @match        https://secure.chase.com/web/auth/dashboard*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    console.log("[TM] Tampermonkey script loaded on secure.chase.com");

    // Function to convert date to MM/DD/YYYY format
    function formatDate(dateStr) {
        const months = {
            Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
            Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
        };
        const match = dateStr.match(/(\w{3})\s(\d{1,2}),\s(\d{4})/);
        if (match) {
            const month = months[match[1]];
            const day = match[2].padStart(2, '0');
            const year = match[3];
            return `${month}/${day}/${year}`;
        }
        return dateStr;
    }

    // Function to convert text to Camel Case
    function toCamelCase(str) {
        return str.toLowerCase().replace(/(?:^|\s)[a-z]/g, (match) => match.toUpperCase());
    }

    // Function to collect row data
    function collectRowData(row, transactionNumber) {
        const rawDateReceived = row.querySelector('td:nth-child(1)')?.textContent.trim() || "";
        const dateReceived = formatDate(rawDateReceived);

        let statusAndMemo = row.querySelector('td:nth-child(2)')?.textContent.trim() || "";
        const rawSender = row.querySelector('td:nth-child(3)')?.textContent.trim() || "";
        const sender = toCamelCase(rawSender);

        const amount = row.querySelector('td:nth-child(6)')?.textContent.trim() || "";

        // Split status and memo
        let status = statusAndMemo;
        let memo = "";
        const match = statusAndMemo.match(/^([^"\n]+)\s"(.*)"$/);
        if (match) {
            status = match[1].trim();
            memo = match[2].trim();
        }

        return {
            dateReceived,
            status,
            memo,
            sender,
            transactionID: transactionNumber,
            amount
        };
    }

    // Function to download the table as CSV
    function downloadTableAsCSV(rowData) {
        let csvContent = "Date Received,Status,Memo,Sender,TransactionID,Amount\n"; // Add headers

        rowData.forEach(row => {
            const rowArray = [
                (row.dateReceived || "").toString().replace(/"/g, '""'),
                (row.status || "").toString().replace(/"/g, '""'),
                (row.memo || "").toString().replace(/"/g, '""'),
                (row.sender || "").toString().replace(/"/g, '""'),
                (row.transactionID || "").toString().replace(/"/g, '""'),
                (row.amount || "").toString().replace(/"/g, '""')
            ];

            csvContent += `"${rowArray.join('","')}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "table_data.csv");
        document.body.appendChild(link); // Required for Firefox
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // Function to log all collected rows and create a new table
    function logAllRows(rowData) {
        const container = document.createElement('div');
        container.style.position = "relative";

        const downloadButton = document.createElement('button');
        downloadButton.textContent = "Download CSV";
        downloadButton.style.marginBottom = "10px";
        downloadButton.style.padding = "10px";
        downloadButton.style.cursor = "pointer";
        downloadButton.addEventListener("click", () => downloadTableAsCSV(rowData));

        const table = document.createElement('table');
        table.className = "jpui table simple responsive activityTable info-density-table condensed";
        table.innerHTML = `
            <thead>
                <tr>
                    <th class="sortable">Date Received</th>
                    <th class="sortable">Status</th>
                    <th>Memo</th>
                    <th>Sender</th>
                    <th>TransactionID</th>
                    <th class="sortable">Amount</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        rowData.forEach((data, index) => {
            console.log(`[TM] Row ${index + 1} Data:\n` +
                        `  Date received: ${data.dateReceived}\n` +
                        `  Status: ${data.status}\n` +
                        `  Memo: ${data.memo}\n` +
                        `  Sender: ${data.sender}\n` +
                        `  TransactionID: ${data.transactionID}\n` +
                        `  Amount: ${data.amount}`);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.dateReceived}</td>
                <td>${data.status}</td>
                <td>${data.memo}</td>
                <td>${data.sender}</td>
                <td>${data.transactionID}</td>
                <td>${data.amount}</td>
            `;
            tbody.appendChild(row);
        });

        container.appendChild(downloadButton);
        container.appendChild(table);

        const existingTable = document.querySelector('table');
        if (existingTable) {
            existingTable.parentNode.insertBefore(container, existingTable);
            console.log("[TM] New table created and added above the existing table.");
        } else {
            document.body.insertBefore(container, document.body.firstChild);
            console.log("[TM] New table created and added to the top of the page.");
        }
    }

    // Function to click "See details" links for all rows and collect data
    function testClickSeeDetails() {
        console.log("[TM] Running testClickSeeDetails function...");
        const detailsLinks = Array.from(document.querySelectorAll('a.actionLink[role="button"]'));

        console.log("[TM] Found", detailsLinks.length, "links to test.");

        const rowData = [];

        detailsLinks.forEach((link, index) => {
            setTimeout(() => {
                console.log(`[TM] Clicking link ${index + 1}:`, link);
                const row = link.closest('tbody'); // Fetch the entire tbody containing the clicked link
                link.click();

                // Simulate fetching transaction number from the updated DOM specific to the tbody
                setTimeout(() => {
                    const transactionNumber = row.querySelector('dl.dataset span.DATA')?.textContent.trim() || "Unknown";
                    console.log(`[TM] Fetched Transaction Number: ${transactionNumber}`);

                    if (row) {
                        rowData.push(collectRowData(row, transactionNumber));

                        // Log all rows and create a table after processing the last one
                        if (index === detailsLinks.length - 1) {
                            logAllRows(rowData);
                        }
                    } else {
                        console.warn("[TM] Row not found for link.");
                    }
                }, 2000); // Simulate delay for fetching transaction number

            }, index * 100); // 100ms interval between clicks
        });
    }

    // Run test function after page load
    const periodicCheck = setInterval(() => {
        console.log("[TM] Periodic check for testClickSeeDetails...");
        testClickSeeDetails();
        clearInterval(periodicCheck); // Stop after one execution
    }, 5000); // Check every 5 seconds
})();
