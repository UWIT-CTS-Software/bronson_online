/*
  ________        _
 |___  ___|      | |       _    _  (_)   
    |  |  (_)  __| | _____ \ \/ /   _ ___ 
    |  |   _ / __| |/ / _ \ \  /   | / __|
    |  |  | | (__|   <  __/ /  \  _| \__ \
    |__|  |_|\___|_|\_\___|/_/\_\(_) |___/
                                  _/ |
                                 |__/
TOC:
    - sendToASU() (for later)
    - sendToHelpDesk() (for later)
    
    Popups:
    - dismissAll()
    - dismissAllPopup()
    - dismissChanges()
    - showPopup()
    - hidePopup()

    Board Setup:
    - initializeListeners()
    - kPagerButton()
    - performSearch()
    - sortTickets()
    - initBoard()

    Backend Calls:
    - fetchTickets()
    - fetchTicketDescription()
    - fetchCurrentUserPermissions()
    - updateTicketViewed()

    "Main" Function:
    - setTickex()


Notes:
    - The current state of this tool is read-only from the TDX API. We plan 
        to have write access to the API in the future once we get permissions.

TODO:
    - Add ticket editing/saving to TDX API (if we get write access)
    - Add "send to ASU"/"send to help desk" button (if we get write access)
    - Add TDX comments section in popup (if we have access)
    - Add Description field in popup (if we have access)
*/


// For Later - When we have write access to TDX API
function sendToASU() {
    alert("This feature is not yet implemented.");
}

// For Later - When we have write access to TDX API
function sendToHelpDesk() {
    alert("This feature is not yet implemented.");
}


    /* -------------------- Popups -------------------- */

// Clear all ticket rows of unread notifications
async function dismissAll(confirmed) {
    // Dismiss Popup
    const dismissAllPopupContainer = document.querySelector('.tx_dismissAllPopupContainer');
    if (!dismissAllPopupContainer) {
        console.error("Dismiss All Popup container not found");
        return;
    }
    dismissAllPopupContainer.classList.remove('popupActive');

    // If confirmed, proceed to dismiss all notifications
    if (confirmed) {
        // Display loading message while fetching tickets
        let button = document.getElementById("tx_dismissAllButton");
        button.disabled = true;

        let ellipsis = "";
        const ellipsisInterval = setInterval(() => {
            ellipsis += ".";
            if (ellipsis.length > 3) ellipsis = "";
            button.textContent = `Clearing${ellipsis}`;
        }, 1000); // every 1 second

        for (const ticket of window.currentTickets) {
            if (ticket && !ticket.has_been_viewed) {
                await updateTicketViewed(ticket.ID, true);
                
                let tick = document.querySelectorAll(`[id="${ticket.ID}"]`);
                tick.forEach(t => {
                    t.classList.remove("tx_highlight_row");
                });
            }
        }

        clearInterval(ellipsisInterval);
        button.textContent = "Dismiss All";
        button.disabled = false;
    }
}

// Shows the Dismiss All confirmation popup
function dismissAllPopup() {
    const dismissAllPopupContainer = document.querySelector('.tx_dismissAllPopupContainer');
    if (!dismissAllPopupContainer) {
        console.error("Dismiss All Popup container not found");
        return;
    }
    dismissAllPopupContainer.classList.add('popupActive');

    dismissAllPopupContainer.innerHTML = `
        <div class="tx_popupBox">
        <span>Are You Sure?</span>
        <p>This action will apply to all users.</p>
        <p>Are you sure you wish to Dismiss All Notifications?</p>
        <button class="dismissAllButtonConfirm" onClick="dismissAll(true)">Yes, Dismiss All</button>
        <button class="cancelPopupButton" onClick="dismissAll(false)">Cancel</button>
    `;
}

// Dismisses the "What Changed" box in the popup
function dismissChanges() {
    const popupContainer = document.querySelector('.tx_popupContainer.popupActive');
    if (!popupContainer) return;

    // Remove the "What Changed" box
    const whatChangedBox = popupContainer.querySelector('.tx_whatChangedBox');
    if (whatChangedBox) {
        whatChangedBox.remove();
    }
}

// Shows the popup with relavent ticket info
async function showPopup(ticket) {
    if (!ticket) {
        console.error("Ticket data not found");
        return;
    }

    const desc = await fetchTicketDescription(ticket.ID);
    const description = desc.replace(/<[^>]*>/g, ''); // Scrub HTML tags out

    const popupContainer = document.querySelector('.tx_popupContainer');
    if (!popupContainer) {
        console.error("Popup container not found");
        return;
    }

    if (!popupContainer.classList.contains('popupActive'))
        popupContainer.classList.add('popupActive');

    // Mark ticket as viewed
    updateTicketViewed(ticket.ID, true);

    // Remove highlight (for all HTML instances of the ticket)
    const ticketRows = document.querySelectorAll(`[id="${ticket.ID}"]`);
    ticketRows.forEach(ticketRow => {
        if (ticketRow) 
            ticketRow.classList.remove('tx_highlight_row');
    });

    // Convert Dates to Readable Format
    if (ticket.CreatedDate != "") ticket.CreatedDate = new Date(ticket.CreatedDate).toLocaleString();
    if (ticket.ModifiedDate != "") ticket.ModifiedDate = new Date(ticket.ModifiedDate).toLocaleString();

    // Shorten ResponsibleGroupName field to CTS if it's the correct string
    if (ticket.ResponsibleGroupName === "Classroom Technology Support (CTS)") 
        ticket.ResponsibleGroupName = "CTS";
    if (ticket.old_responsible_group_name === "Classroom Technology Support (CTS)") 
        ticket.old_responsible_group_name = "CTS";

    // Fix Phone Number Format => (XXX) YYY-ZZZZ
    const raw = ticket.RequestorPhone;
    const digits = (raw.match(/\d/g) || []).join('');
    if (digits.length === 10) // Invalid numbers just get skipped and raw string is used
        ticket.RequestorPhone = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;

    // Set the HTML for what changed, if anything changed
    let whatChangedHTML = "";
    if (ticket.old_type_name != ticket.TypeName || 
        ticket.old_type_category_name != ticket.TypeCategoryName || 
        ticket.old_title != ticket.Title || 
        ticket.old_account_name != ticket.AccountName || 
        ticket.old_status_name != ticket.StatusName || 
        ticket.old_service_name != ticket.ServiceName || 
        ticket.old_priority_name != ticket.PriorityName || 
        ticket.old_responsible_full_name != ticket.ResponsibleFullName || 
        ticket.old_responsible_group_name != ticket.ResponsibleGroupName) {

        // Grab old ticket info. Compares what changed. (Field: Old info => New info)
        let whatChangedRows = "";
        if (ticket.old_type_name != ticket.TypeName)
            whatChangedRows += `<p>Type: ${ticket.old_type_name} => ${ticket.TypeName}</p>`;
        if (ticket.old_type_category_name != ticket.TypeCategoryName)
            whatChangedRows += `<p>Type Category: ${ticket.old_type_category_name} => ${ticket.TypeCategoryName}</p>`;
        if (ticket.old_title != ticket.Title)
            whatChangedRows += `<p>Title: ${ticket.old_title} => ${ticket.Title}</p>`;
        if (ticket.old_account_name != ticket.AccountName)
            whatChangedRows += `<p>Account: ${ticket.old_account_name} => ${ticket.AccountName}</p>`;
        if (ticket.old_status_name != ticket.StatusName)
            whatChangedRows += `<p>Status: ${ticket.old_status_name} => ${ticket.StatusName}</p>`;
        if (ticket.old_service_name != ticket.ServiceName)
            whatChangedRows += `<p>Service: ${ticket.old_service_name} => ${ticket.ServiceName}</p>`;
        if (ticket.old_priority_name != ticket.PriorityName)
            whatChangedRows += `<p>Priority: ${ticket.old_priority_name} => ${ticket.PriorityName}</p>`;
        if (ticket.old_responsible_full_name != ticket.ResponsibleFullName)
            whatChangedRows += `<p>Responsible: ${ticket.old_responsible_full_name} => ${ticket.ResponsibleFullName}</p>`;
        if (ticket.old_responsible_group_name != ticket.ResponsibleGroupName)
            whatChangedRows += `<p>Responsible Group: ${ticket.old_responsible_group_name} => ${ticket.ResponsibleGroupName}</p>`;

        whatChangedHTML = `
            <div class="tx_whatChangedBox">
            <span>What Changed:</span>
            ${whatChangedRows}
            <p>Last Modified: ${ticket.ModifiedDate || ""} by ${ticket.ModifiedFullName || ""}</p>
            <a href="https://uwyo.teamdynamix.com/TDNext/Apps/216/Tickets/TicketDet?TicketID=${ticket.ID}" target="_blank" rel="noopener noreferrer">
                <button class="popup_linkToTicket">Link to Ticket</button>
            </a>
            <button class="popup_dismissChanges" onclick="dismissChanges()">Dismiss</button>
            </div>
        `;
    }

    // Set Popup HTML
    if (popupContainer.classList.contains('detailsShown')) {
        popupContainer.innerHTML = `
            <div class="tx_popupBox">
            <span>${ticket.Title || "No Title"}</span>
            <button class="popup_closeButton" onClick="hidePopup()">X</button>
                <div class="tx_adjacent"><p class="tx_popup_ID">Ticket ID: ${ticket.ID || ""}</p>
                <p class="tx_popup_StatusName">Status: ${ticket.StatusName || ""}</p></div>
                <div class="tx_adjacent"><p class="tx_popup_PriorityName">Priority: ${ticket.PriorityName || ""}</p>
                <p class="tx_popup_DaysOld">Days Old: ${ticket.DaysOld || ""}</p></div>
                <p class="tx_popup_Title">Title: ${ticket.Title || "No Title"}</p>
                <button class="popup_toggleButton" onClick="toggleDetails(${ticket.ID})">See Description</button>
                <p class="tx_popup_Requestor">Requestor: ${ticket.RequestorName || ""} || ${ticket.RequestorEmail || "Email Not Provided"} || ${ticket.RequestorPhone || "Phone Not Provided"}</p>
                <p class="tx_popup_Responsible">Responsible: ${ticket.ResponsibleFullName || "UNASSIGNED"} || ${ticket.ResponsibleGroupName || ""}</p>
                <p class="tx_popup_ServiceName">Service: ${ticket.ServiceName || ""}</p>
                <p class="tx_popup_AccountName">Account Department: ${ticket.AccountName || ""}</p>
                <p class="tx_popup_TypeName">Type: ${ticket.TypeName || ""}</p>
                <p class="tx_popup_TypeCategoryName">Type Category: ${ticket.TypeCategoryName || ""}</p>
                <p class="tx_popup_Created">Date Created: ${ticket.CreatedDate || ""} || Created by: ${ticket.CreatedFullName || ""}</p>
                <p class="tx_popup_Modified">Last Modified: ${ticket.ModifiedDate || ""} || Modified by: ${ticket.ModifiedFullName || ""}</p>
                <a href="https://uwyo.teamdynamix.com/TDNext/Apps/216/Tickets/TicketDet?TicketID=${ticket.ID}" target="_blank" rel="noopener noreferrer">
                    <button class="popup_linkToTicket">Link to Ticket</button>
                </a>
                <button disabled class="popup_sendToASU" onClick="sendToASU()">Send to ASU</button>
                <button disabled class="popup_sendToHelpDesk" onClick="sendToHelpDesk()">Send to Help Desk</button>
            </div>
            ${whatChangedHTML}
        `;
    } else {
        popupContainer.innerHTML = `
            <div class="tx_popupBox">
            <span>${ticket.Title || "No Title"}</span>
            <button class="popup_closeButton" onClick="hidePopup()">X</button>
                <div class="tx_adjacent"><p class="tx_popup_ID">Ticket ID: ${ticket.ID || ""}</p>
                <p class="tx_popup_StatusName">Status: ${ticket.StatusName || ""}</p></div>
                <div class="tx_adjacent"><p class="tx_popup_PriorityName">Priority: ${ticket.PriorityName || ""}</p>
                <p class="tx_popup_DaysOld">Days Old: ${ticket.DaysOld || ""}</p></div>
                <p class="tx_popup_Title">Title: ${ticket.Title || "No Title"}</p>
                <button class="popup_toggleButton" onClick="toggleDetails(${ticket.ID})">See Ticket Details</button>
                <p class="tx_Description">${description || "No Description Provided"}</p>
                <a href="https://uwyo.teamdynamix.com/TDNext/Apps/216/Tickets/TicketDet?TicketID=${ticket.ID}" target="_blank" rel="noopener noreferrer">
                    <button class="popup_linkToTicket">Link to Ticket</button>
                </a>
                <button disabled class="popup_sendToASU" onClick="sendToASU()">Send to ASU</button>
                <button disabled class="popup_sendToHelpDesk" onClick="sendToHelpDesk()">Send to Help Desk</button>
            </div>
            ${whatChangedHTML}
        `;
    }
}

// Toggles the details in the popup
function toggleDetails(ticketID) {
    const popupContainer = document.querySelector('.tx_popupContainer.popupActive');
    if (!popupContainer) return;

    const isDetailsShown = popupContainer.classList.contains('detailsShown');
    if (isDetailsShown) {
        popupContainer.classList.remove('detailsShown');
    } else {
        popupContainer.classList.add('detailsShown');
    }

    // Find the ticket data again
    const ticket = window.currentTickets.find(t => t.ID === ticketID);
    showPopup(ticket);
}

// Hides the popup
function hidePopup() {
    const popupContainer = document.querySelector('.tx_popupContainer.popupActive');
    if (popupContainer) {
        popupContainer.classList.remove('popupActive');

        if (popupContainer.classList.contains('detailsShown')) 
            popupContainer.classList.remove('detailsShown');
    }
}


    /* -------------------- Board Setup -------------------- */

// Initializes all listeners for Tickex
function initializeListeners() {
    // Escape Key
    document.addEventListener('keydown', (e) => {
        const pressedKey = e.key;
        if (pressedKey == 'Escape') 
            if (document.querySelector('.tx_popupContainer.popupActive')) hidePopup();
    });

    // Listens to radio buttons, for sorting
    document.getElementById("sortByBox").addEventListener('click', (e) => {
        if (e.target.matches('input[type="radio"]')) {
            let sortBy = e.target.id;
            window.currentSortBy = sortBy;

            const searchBar = document.getElementById('searchBar');
            let search = searchBar.value;

            performSearch(search);
        }
    });

    // k-pager listeners
    ["new", "catchAll", "closed"].forEach(section => {
        document.getElementById(`${section}Ticket_dropdown`)
            .addEventListener("change", () => {
                document.getElementById(`${section}Ticket_input`).value = 1; // Reset to page 1
                performSearch(document.getElementById("searchBar").value, window.currentSortBy);
            });

        document.getElementById(`${section}Ticket_input`)
            .addEventListener("input", () => {
                performSearch(document.getElementById("searchBar").value, window.currentSortBy);
            });
    });

    // Check for empty search bar
    const searchBar = document.getElementById('searchBar');
    searchBar.addEventListener('keyup', function() {
        if ((this.value || '').trim() === '') {
            // Reset to page 1
            document.getElementById(`newTicket_input`).value = 1;
            document.getElementById(`catchAllTicket_input`).value = 1;
            document.getElementById(`closedTicket_input`).value = 1;
            performSearch("", window.currentSortBy); // Empty the Search Bar
        }
    });

    // Listens for Enter key in search bar
    searchBar.addEventListener('keydown', function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            searchBar.blur();

            // Reset to page 1
            document.getElementById(`newTicket_input`).value = 1;
            document.getElementById(`catchAllTicket_input`).value = 1;
            document.getElementById(`closedTicket_input`).value = 1;

            let search = (this.value || '').trim();
            performSearch(search, window.currentSortBy);
        }
    });
}

// Adjusts input ticket field by value
function kPagerButton(val, inputId, maxPageId) {
    let inputField = document.getElementById(inputId);
    if (!inputField) return;

    const maxPage = document.getElementById(maxPageId);
    const maxVal = parseInt(maxPage?.textContent);
    if (isNaN(maxVal)) return;

    const newVal = parseInt(inputField.value) + val;
    if (newVal <= 0) { inputField.value = 1; } 
    else if (newVal > maxVal) { inputField.value = maxVal; }
    else { inputField.value = newVal; }

    inputField.dispatchEvent(new Event("input", { bubbles: true }));
}

// Performs the search with current text within search bar
function performSearch(search) {
    const allTickets = window.allTickets || window.currentTickets;
    let matchedTickets = [];

    // Normalize search string
    search = search.toLowerCase();

    // Abbreviate days of the week for search
    search = search.replaceAll("monday", "mon");
    search = search.replaceAll("tuesday", "tue");
    search = search.replaceAll("wednesday", "wed");
    search = search.replaceAll("thursday", "thu");
    search = search.replaceAll("friday", "fri");
    search = search.replaceAll("saturday", "sat");
    search = search.replaceAll("sunday", "sun");

    matchedTickets = []; // Clear

    if (search !== "") {
        for (let i = 0; i < allTickets.length; i++) {
            // Query Specific Fields
            if (allTickets[i].ID == search ||
                allTickets[i].Title.includes(search) ||
                allTickets[i].Description.includes(search) ||
                allTickets[i].RequestorName.includes(search) ||
                allTickets[i].CreatedFullName.includes(search) ||
                allTickets[i].CreatedDate.includes(search) ||
                allTickets[i].ModifiedDate.includes(search))
            {
                matchedTickets.push(allTickets[i]);
            }
        }

        window.currentTickets = matchedTickets;
        initBoard();
    }
    else {
        window.currentTickets = allTickets;
        initBoard();
    }
}

// Handles sorting of board elements
//      - sortBy recieves: 'created', 'modified', or 'status'
function sortTickets() {
    // Sort by Date Created (default)
    window.currentTickets = window.currentTickets.sort((a, b) => new Date(b.CreatedDate) - new Date(a.CreatedDate));
    
    // Sort by Data Modified
    if (window.currentSortBy === 'modified') {
        window.currentTickets = window.currentTickets.sort((a, b) => new Date(b.ModifiedDate) - new Date(a.ModifiedDate));
        return window.currentTickets;
    }
    // Sort by Status
    else if (window.currentSortBy === 'status') {
        const statusOrder = ["New", "In Process", "On Hold", "Closed", "Resolved", "Cancelled"];
        window.currentTickets = window.currentTickets.sort((a, b) => statusOrder.indexOf(a.StatusName) - statusOrder.indexOf(b.StatusName));
        return window.currentTickets;
    }

    return window.currentTickets; 
}

// Add tickets to the board
function initBoard() {
    let ticketsHtml = {
        newTickets: "",
        catchAllTickets: "",
        closedTickets: ""
    };
    
    window.currentTickets = sortTickets();

    let newNumRows, catchAllNumRows, closedNumRows;
    let newInputField, catchAllInputField, closedInputField;
    try {
        newNumRows = parseInt(document.getElementById("newTicket_dropdown").value);
        catchAllNumRows = parseInt(document.getElementById("catchAllTicket_dropdown").value);
        closedNumRows = parseInt(document.getElementById("closedTicket_dropdown").value);

        newInputField = parseInt(document.getElementById("newTicket_input").value);
        catchAllInputField = parseInt(document.getElementById("catchAllTicket_input").value);
        closedInputField = parseInt(document.getElementById("closedTicket_input").value);
    } catch (e) {
        // On first time load or on error, use default values
        newNumRows = 15; catchAllNumRows = 15; closedNumRows = 10;
        newInputField = 1; catchAllInputField = 1; closedInputField = 1;
    }

    // Update Max Page Numbers
    let newMaxPage = document.getElementById("newMaxPage");
    let catchAllMaxPage = document.getElementById("catchAllMaxPage");
    let closedMaxPage = document.getElementById("closedMaxPage");

    // If UI isn’t ready yet — bail
    if (!newMaxPage || !catchAllMaxPage || !closedMaxPage) return;

    // Put tickets in proper board sections
    let newCount = 0, catchAllCount = 0, closedCount = 0;
    for (let ticket of window.currentTickets) {
        let highlightClass = ticket.has_been_viewed ? '' : 'tx_highlight_row';
        let ticketRow = `
            <tr class="tx_ticket ${highlightClass}" id="${ticket.ID}" onclick="showPopup(${JSON.stringify(ticket).replace(/"/g, '&quot;')})">
                <td>${ticket.Title}</td>
                <td>${ticket.ID}</td>
                <td>${ticket.StatusName}</td>
            </tr>
        `;

        // If days old < 14 or status == new
        const isNew = (Date.now() - new Date(ticket.CreatedDate) < 14 * 24 * 60 * 60 * 1000 
                    || ticket.StatusName === 'New') 
                    && ticket.StatusName !== 'Closed'
                    && ticket.StatusName !== 'Cancelled'
                    && ticket.StatusName !== 'Resolved';

        const isClosed = ticket.StatusName === 'Closed' 
                      || ticket.StatusName === 'Resolved' 
                      || ticket.StatusName === 'Cancelled';

        // Ensure k-pager rows are displaying corresponding to current page number
        if (isNew) {
            if ((newInputField - 1) * newNumRows <= newCount &&
                newCount < newInputField * newNumRows
            ) {
                ticketsHtml.newTickets += ticketRow;
            }
            newCount++;
        }
        if (!isClosed) {
            if ((catchAllInputField-1) * catchAllNumRows <= catchAllCount &&
                catchAllCount < catchAllInputField * catchAllNumRows
            ) {
                ticketsHtml.catchAllTickets += ticketRow;
            }
            catchAllCount++;
        }
        if (isClosed) {
            let closedRow = `
                <tr class="tx_ticket ${highlightClass}" id="${ticket.ID}" onclick="showPopup(${JSON.stringify(ticket).replace(/"/g, '&quot;')})">
                    <td>${ticket.Title}</td>
                    <td>${ticket.ID}</td>
                </tr>
            `;

            if ((closedInputField-1) * closedNumRows <= closedCount &&
                closedCount < closedInputField * closedNumRows
            ) {
                ticketsHtml.closedTickets += closedRow;
            }
            closedCount++;
        }
    }

    // Correct max pages based on filtered ticket totals
    newMaxPage.innerText = Math.ceil(newCount / newNumRows) || 1;
    catchAllMaxPage.innerText = Math.ceil(catchAllCount / catchAllNumRows) || 1;
    closedMaxPage.innerText = Math.ceil(closedCount / closedNumRows) || 1;

    // Set Board HTML
    document.querySelector("#newTicketsBoard tbody").innerHTML = ticketsHtml.newTickets;
    document.querySelector("#catchAllTicketsBoard tbody").innerHTML = ticketsHtml.catchAllTickets;
    document.querySelector("#closedTicketsBoard tbody").innerHTML = ticketsHtml.closedTickets;
}


    /* -------------------- Backend Calls -------------------- */

// Grab tickets from backend
async function fetchTickets() {
    try {
        const response = await fetch('/tickets');
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch tickets:', error);
        return [];
    }
}

// Grab ticket Description from backend 
//  (since TDX doesn't include it in the main 
//  ticket data when pulling mutliple tickets)
async function fetchTicketDescription(ticketId) {
    try {
        const response = await fetch(`/ticket/description/${ticketId}`);
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.text();
    } catch (error) {
        console.error('Failed to fetch ticket description:', error);
        return "Could not fetch Description field.";
    }
}

// Fetches the current user's permission level
async function fetchCurrentUserPermissions() {
    try {
        const response = await fetch('/currentUser');
        if (!response.ok) {
            console.error("Failed to fetch current user permissions");
            return 0;
        }

        const data = await response.json();
        return data.permissions || 0;
    } catch (error) {
        console.error("Error fetching current user permissions:", error);
        return 0;
    }
}

// Update ticket's viewed status in backend
async function updateTicketViewed(ticketId, viewed) {
    try {
        const response = await fetch('/update/ticket/viewed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ id: ticketId, viewed: viewed }),
        });

        if (!response.ok) console.error('Failed to update ticket viewed status');
    } catch (error) {
        console.error('Error updating ticket viewed status:', error);
    }
}


    /* -------------------- "Main" Function -------------------- */

// Sets up the Tickex tool page
async function setTickex() {
    preserveCurrentTool();
    document.title = "Tickex - Bronson";

    // Clear Tickex cache so new HTML and Tickets are always loaded
    sessionStorage.removeItem("Tickex_html");
    
    // Clear stash and remove strobing indicator
    sessionStorage.removeItem("Tickex_stash");
    
    let current = document.getElementsByClassName("selected");
    if (current.length != 0) {
        current[0].classList.remove("selected");
    }
    let newCurrent = document.getElementById("TXButton");
    newCurrent.classList.add("selected");
    newCurrent.classList.remove("stashed"); // Stop the strobing

    // Check for preserved space
    let cached_HTML = sessionStorage.getItem("Tickex_html");
    let progGuts = document.querySelector('.program_board .program_guts');
    if (cached_HTML != null) {
        // make sure cache was not overwritten with another tool.
        if(cached_HTML.includes("tx_container")) {
            progGuts.innerHTML = cached_HTML;
            return;
        }
    }

    // No HTML Cache found, build from scratch
    let tx_container = document.createElement("div");
    tx_container.classList.add("tx_container");

    // Main Container
    let main_container = document.createElement('div');
    main_container.appendChild(tx_container);
    main_container.classList.add('program_guts');
    progGuts.replaceWith(main_container);



    /* -------------------- Tickex Page -------------------- */

    // Display loading message while fetching tickets
    let loadingMessage = document.createElement("div");
    loadingMessage.classList.add("tx_loadingMessage");
    loadingMessage.innerHTML = `
        <legend>Loading Tickets</legend>
    `;
    tx_container.append(loadingMessage);

    let ellipsis = "";
    const ellipsisInterval = setInterval(() => {
        ellipsis += ".";
        if (ellipsis.length > 3) ellipsis = "";
        loadingMessage.innerHTML = `
            <legend>Loading Tickets${ellipsis}</legend>
        `;
    }, 1000); // Update every 1 second

    let tickets = [];
    while (!tickets.length) { // Keep trying until tickets are fetched
        let response = await fetchTickets();
        tickets = Array.isArray(response) ? response : [];
    }
    window.currentTickets = tickets;
    window.allTickets = tickets; // Store complete ticket list for auto-refresh comparison

    clearInterval(ellipsisInterval);
    loadingMessage.remove();


    // Sort By Box - by date and status
    let sortByBox = document.createElement("div");
    sortByBox.classList.add("tx_sortByBox");
    sortByBox.id = "sortByBox";
    sortByBox.innerHTML = `
        <legend>Sort By</legend>
        <div>
            <input class="tx_radio" type="radio" name="tx_dev" id="created" checked>
            <label for="created">Date Created</label>
        </div>
        <div>
            <input class="tx_radio" type="radio" name="tx_dev" id="modified">
            <label for="modified">Date Modified</label>
        </div>
        <div>
            <input class="tx_radio" type="radio" name="tx_dev" id="status">
            <label for="status">Status</label>
        </div>

    `;
    tx_container.append(sortByBox);

    // Search Bar
    let searchBar = document.createElement("div");
    searchBar.classList.add("tx_search");
    searchBar.innerHTML = `
        <legend>Search</legend>
        <textarea id="searchBar" placeholder="Search: Title, ID, Description, Room, Date, etc...  (Enter)"></textarea>
        <ul>
    `;
    tx_container.append(searchBar);

    // TeamDynamix Hotlink
    let tdxHotlink = document.createElement("div");
    tdxHotlink.classList.add("tx_tdxHotlink");
    tdxHotlink.innerHTML = `
        <legend>Link to TDX</legend>
        <a href="https://uwyo.teamdynamix.com/TDWorkManagement/" target="_blank" rel="noopener noreferrer">
            <img src="/tdx_logo.png" alt="TeamDynamix" style="height:45px; vertical-align:middle; cursor:pointer;" />
        </a>
    `;
    tx_container.append(tdxHotlink);

    // New Tickets Popup
    let newTicketsPopup = document.createElement("div");
    newTicketsPopup.classList.add("tx_newTicketsPopup");
    newTicketsPopup.innerHTML = `
        <legend>New Tickets are Available!</legend>
    `;
    tx_container.append(newTicketsPopup);

    // Dismiss Notifications Button (Admin only)
    let dismissAllButton = document.createElement("div");
    dismissAllButton.classList.add("tx_dismissAllButton");
    const userPermissions = await fetchCurrentUserPermissions();
    if (userPermissions >= 6) {
        dismissAllButton.innerHTML = `
            <button id="tx_dismissAllButton" onclick="dismissAllPopup()">Dismiss All</button>
        `;
        tx_container.append(dismissAllButton);
    }

    // Dismiss All Popup Container - admin only
    let dismissAllPopupContainer = document.createElement("div");
    dismissAllPopupContainer.classList.add("tx_dismissAllPopupContainer");
    tx_container.append(dismissAllPopupContainer);


    // The 3 Tickex boards - New, Catch All, Closed
    let newTickets = document.createElement("div");
    newTickets.classList.add("tx_newTickets");
    newTickets.id = 'newTicketsBoard';
    newTickets.innerHTML = `
        <fieldset><legend>New CTS Tickets</legend>
            <div class="tx_ticketContainer" id="new">
                <table>
                    <thead><tr>
                        <th>Title</th>
                        <th>ID</th>
                        <th>Status</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
                <div class="k_pager" id="newPager">
                    <button class="k_pager_button" id="new_minus10" onclick="kPagerButton(-10, 'newTicket_input', 'newMaxPage')">-10</button>
                    <button class="k_pager_button" id="new_minus1" onclick="kPagerButton(-1, 'newTicket_input', 'newMaxPage')"><</button>
                    <input type="number" class="k_input_inner" id="newTicket_input" autocomplete="off" value="1"></input>
                    <span>of </span>
                    <span id="newMaxPage">1</span>
                    <button class="k_pager_button" id="new_plus1" onclick="kPagerButton(1, 'newTicket_input', 'newMaxPage')">></button>
                    <button class="k_pager_button" id="new_plus10" onclick="kPagerButton(10, 'newTicket_input', 'newMaxPage')">+10</button>
                    <div><span>Max Items per Page: </span>
                    <select class="k_pager_button" id="newTicket_dropdown">
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="15" selected>15</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        <option value="40">40</option>
                        <option value="50">50</option>
                        <option value="75">75</option>
                        <option value="100">100</option>
                    </select></div>
                </div>
            </div></fieldset>
    `;

    let catchAll = document.createElement("div");
    catchAll.classList.add("tx_catchAllTickets");
    catchAll.id = 'catchAllTicketsBoard';
        catchAll.innerHTML = `
        <fieldset><legend>CTS Ticket Catch All</legend>
            <div class="tx_ticketContainer" id="catchAll">
                <table>
                    <thead><tr>
                        <th>Title</th>
                        <th>ID</th>
                        <th>Status</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
                <div class="k_pager" id="catchAllPager">
                    <button class="k_pager_button" id="catchAll_minus10" onclick="kPagerButton(-10, 'catchAllTicket_input', 'catchAllMaxPage')">-10</button>
                    <button class="k_pager_button" id="catchAll_minus1" onclick="kPagerButton(-1, 'catchAllTicket_input', 'catchAllMaxPage')"><</button>
                    <input type="number" class="k_input_inner" id="catchAllTicket_input" autocomplete="off" value="1"></input>
                    <span>of </span>
                    <span id="catchAllMaxPage">1</span>
                    <button class="k_pager_button" id="catchAll_plus1" onclick="kPagerButton(1, 'catchAllTicket_input', 'catchAllMaxPage')">></button>
                    <button class="k_pager_button" id="catchAll_plus10" onclick="kPagerButton(10, 'catchAllTicket_input', 'catchAllMaxPage')">+10</button>
                    <div><span>Max Items per Page: </span>
                    <select class="k_pager_button" id="catchAllTicket_dropdown">
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="15" selected>15</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        <option value="40">40</option>
                        <option value="50">50</option>
                        <option value="75">75</option>
                        <option value="100">100</option>
                    </select></div>
                </div>
            </div></fieldset>
    `;

    let closedTickets = document.createElement("div");
    closedTickets.classList.add("tx_closedTickets");
    closedTickets.id = "closedTicketsBoard";
        closedTickets.innerHTML = `
        <fieldset><legend>Closed CTS Tickets</legend>
            <div class="tx_ticketContainer" id="closed">
                <table>
                    <thead><tr>
                        <th>Title</th>
                        <th>ID</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
                <div class="k_pagerClosed" id="closedPager">
                    <button class="k_pager_button" id="closed_minus10" onclick="kPagerButton(-10, 'closedTicket_input', 'closedMaxPage')">-10</button>
                    <button class="k_pager_button" id="closed_minus1" onclick="kPagerButton(-1, 'closedTicket_input', 'closedMaxPage')"><</button>
                    <input type="number" class="k_input_inner" id="closedTicket_input" autocomplete="off" value="1"></input>
                    <span>of </span>
                    <span id="closedMaxPage">1</span>
                    <button class="k_pager_button" id="closed_plus1" onclick="kPagerButton(1, 'closedTicket_input', 'closedMaxPage')">></button>
                    <button class="k_pager_button" id="closed_plus10" onclick="kPagerButton(10, 'closedTicket_input', 'closedMaxPage')">+10</button>
                    <div><span>Max Items per Page: </span>
                    <select class="k_pager_button" id="closedTicket_dropdown">
                        <option value="5">5</option>
                        <option value="10" selected>10</option>
                        <option value="15">15</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        <option value="40">40</option>
                        <option value="50">50</option>
                        <option value="75">75</option>
                        <option value="100">100</option>
                    </select></div>
                </div>
            </div></fieldset>
    `;

    // Popup Container - click on ticket for popup to appear
    let popupContainer = document.createElement("div");
    popupContainer.classList.add("tx_popupContainer");
    tx_container.append(popupContainer);
    

    // Initial board on loadup
    let sortBy = "created"; // sort by date created on load up
    window.currentSortBy = sortBy;
    window.currentTickets = sortTickets();

    tx_container.append(newTickets);
    tx_container.append(catchAll);
    tx_container.append(closedTickets);

    initBoard();
    initializeListeners();

    // Auto-refresh board logic
    setInterval(() => {
        fetchTickets().then(newTickets => {
            if (Array.isArray(newTickets)) {
                const oldTickets = new Set(window.allTickets.map(t => t.ModifiedDate));
                const actuallyNew = newTickets.filter(t => !oldTickets.has(t.ModifiedDate) && 
                                                           t.StatusName != "Closed" && 
                                                           t.StatusName != 'Resolved' && 
                                                           t.StatusName != 'Cancelled');
                const closedTickets = newTickets.filter(t => !oldTickets.has(t.ModifiedDate) && 
                                                            (t.StatusName == "Closed" || 
                                                             t.StatusName == 'Resolved' || 
                                                             t.StatusName == 'Cancelled'));

                // New tickets found
                if (actuallyNew.length > 0) {
                    // Mark new tickets as not viewed
                    actuallyNew.forEach(ticket => {
                        updateTicketViewed(ticket.ID, false); // mark as not viewed

                        // Update local copy immediately
                        const index = newTickets.findIndex(t => t.ID === ticket.ID);
                        if (index !== -1) newTickets[index].has_been_viewed = false;
                    });

                    // Check if user is currently on Tickex page
                    const txButton = document.getElementById("TXButton");
                    if (txButton && txButton.classList.contains("selected")) {
                        // User is on Tickex, show the popup
                        newTicketsPopup.classList.add("tx_newTicketsPopupActive");
                        newTicketsPopup.classList.remove("tx_newTicketsPopup");
                        setTimeout(() => {
                            newTicketsPopup.classList.add("tx_newTicketsPopup");
                            newTicketsPopup.classList.remove("tx_newTicketsPopupActive");
                        }, 60000);
                    } else {
                        // User is NOT on Tickex, stash the response and strobe the tab
                        stashTickexResponse(actuallyNew);
                    }
                }

                // Update New Tickets Popup if needed
                if (newTicketsPopup.classList.contains("tx_newTicketsPopupActive") && actuallyNew.length == 0) {
                    newTicketsPopup.classList.remove("tx_newTicketsPopupActive");
                    newTicketsPopup.classList.add("tx_newTicketsPopup");
                }

                // Prevent Task Disruption
                const searchBar = document.getElementById('searchBar'); 
                if (searchBar && searchBar.value.trim() === '' /* User is using Search Bar */) {
                    window.allTickets = newTickets;
                    window.currentTickets = newTickets;
                    initBoard(window.currentSortBy || 'created');
                }

                // Ticket that just closed
                if (closedTickets.length > 0) {
                    closedTickets.forEach(ticket => {
                        const tick = document.querySelectorAll(`[id="${ticket.ID}"]`);
                        tick.forEach(t => {
                            if (t) {
                                updateTicketViewed(ticket.ID, true); // mark as viewed
                                t.classList.remove("tx_highlight_row");
                                t.classList.add("tx_ticket_closed_flash");

                                setTimeout(() => {
                                    t.classList.remove("tx_ticket_closed_flash");
                                }, 3000);
                            }
                        });
                    });
                }
            }
        }).catch(error => console.error('Error fetching tickets for update:', error));
    }, 15000); // Check every 15 seconds

    await Promise.resolve();

    // Init Hide Bool Variable in session storage
    sessionStorage.setItem("txHideBool", true);

    return;
}


