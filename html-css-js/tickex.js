/*
  ________        _                 _
 |___  ___|      | |       _    _  (_)   
    |  |  (_)  __| | _____ \ \/ /   _ ___ 
    |  |   _ / __| |/ / _ \ \  /   | / __|
    |  |  | | (__|   <  __/ /  \  _| \__ \
    |__|  |_|\___|_|\_\___|/_/\_\(_) |___/
                                  _/ |
                                 |__/
TOC:
    - listenEscapeKey()
    - sendToASU()
    - sendToHelpDesk()
    - sortBy()
    - fetchTickets()

HTML
    - setTickex()
    - showPopup()
    - hidePopup()
    - initBoard()

Notes:


TODO:
    - Add real ticket fetching from TDX API 
    - Add ticket editing/saving to TDX API (if we get write access)
    - Add "send to ASU"/"send to help desk" button (if we get write access)
    - Add ticket filtering/sorting options
    - Add ticket search bar
*/


/*
$$\   $$\ $$$$$$$$\ $$\      $$\ $$\       
$$ |  $$ |\__$$  __|$$$\    $$$ |$$ |      
$$ |  $$ |   $$ |   $$$$\  $$$$ |$$ |      
$$$$$$$$ |   $$ |   $$\$$\$$ $$ |$$ |      
$$  __$$ |   $$ |   $$ \$$$  $$ |$$ |      
$$ |  $$ |   $$ |   $$ |\$  /$$ |$$ |      
$$ |  $$ |   $$ |   $$ | \_/ $$ |$$$$$$$$\ 
\__|  \__|   \__|   \__|     \__|\________|
*/


// Shows the popup with relavent ticket info
function showPopup(ticket) {
    if (!ticket) {
        console.error("Ticket data not found");
        return;
    }

    console.log(ticket);

    const popupContainer = document.querySelector('.tx_popupContainer');
    if (!popupContainer) {
        console.error("Popup container not found");
        return;
    }

    popupContainer.classList.add('popupActive');
    // document.getElementById('terminal').style.display = 'none'; // Hide Terminal

    popupContainer.innerHTML = `
        <div class="tx_popupBox">
            <span>${ticket.Title || "No Title"}</span>
            <p>Ticket ID: ${ticket.ID || ""}</p>
            <p>Location: ${ticket.LocationName || ""}</p>
            <p>Status: ${ticket.StatusName || ""}</p>
            <p>Description: ${ticket.Description || ""}</p>
            <p>Requestor: ${ticket.RequestorName || ""}</p>
            <p>Creator: ${ticket.CreatedFullName || ""}</p>
            <p>Responsibility: ${ticket.ResponsibleGroupName || ""}</p>
            <p>Service: ${ticket.ServiceName || ""}</p>
            <p>Account Department: ${ticket.AccountName || ""}</p>
            <p>Type: ${ticket.TypeCategoryName || ""}</p>
            <p>Urgency: ${ticket.UrgencyName || ""}</p>
            <p>Priority: ${ticket.PriorityName || ""}</p>
            <p>Date Created: ${ticket.CreatedDate || ""}</p>
            <p>Last Modified: ${ticket.ModifiedDate || ""}</p>
            <button class="popup_closeButton" onClick="hidePopup()">Close</button>
            <button class="popup_sendToASU" onClick="sendToASU()">Send to ASU</button>
            <button class="popup_sendToHelpDesk" onClick="sendToHelpDesk()">Send to Help Desk</button>
        </div>
    `;
}

// Hides the popup
function hidePopup() {
    let popupContainer = document.querySelector('.tx_popupContainer.popupActive');
    // document.getElementById('terminal').style.display = 'block'; // Show Terminal

    if (popupContainer) {
        popupContainer.classList.remove('popupActive');
    }
}

// Closes popup if escape key is pressed
function listenEscapeKey() {
    document.addEventListener('keydown', (e) => {
        const pressedKey = e.key;

        if (pressedKey == 'Escape') {
            if (document.querySelector('.tx_popupContainer.popupActive')) {
                hidePopup();
            }
        }
    });
}

// TODO
function sendToASU() {
    alert("This feature is not yet implemented. -Lex");
}

// TODO
function sendToHelpDesk() {
    alert("This feature is not yet implemented. -Lex");
}

// Handles sorting of board elements
//      - sortBy recieves: 'created', 'status', or 'location'
function sortTickets(tickets, sortBy) {
    // Sort everything by date first
    tickets = tickets.sort((a, b) => new Date(b.CreatedDate) - new Date(a.CreatedDate));

    // Sort by Status
    if (sortBy === 'status') {
        const statusOrder = [
            "New", "In Process", "On Hold", "Resolved", "Cancelled", "Closed"
        ];

        tickets = tickets.sort((a, b) => {
            let aIndex = statusOrder.indexOf(a.StatusName);
            let bIndex = statusOrder.indexOf(b.StatusName);
            return aIndex - bIndex;
        });

        return tickets;
    }
    // Sort by Location
    else if (sortBy === 'location') {
        tickets = tickets.sort((a, b) => a.LocationName.localeCompare(b.LocationName));
        return tickets;
    }
    // Default sort by Date
    else { return tickets; }
}

// Add tickets to the board
function initBoard(tickets, ticketsHtml) {
    ticketsHtml.newTickets = ``;
    ticketsHtml.catchAllTickets = ``;
    ticketsHtml.closedTickets = ``;

    for (let ticket of tickets) {
        let ticketRow = `
            <tr class="tx_ticket" id="${ticket.ID}" onclick="showPopup(${JSON.stringify(ticket).replace(/"/g, '&quot;')})">
                <td>${ticket.Title}</td>
                <td>${ticket.ID}</td>
                <td>${ticket.LocationName || 'N/A'}</td>
                <td>${ticket.StatusName}</td>
            </tr>
        `;

        // Days old < 14 or status is new
        if ((Date.now() - new Date(ticket.CreatedDate) < 14 * 24 * 60 * 60 * 1000 || ticket.StatusName.toLowerCase() === 'new')
                && ticket.StatusName.toLowerCase() !== 'closed') {
            ticketsHtml.newTickets += ticketRow;
        }
        if (ticket.StatusName.toLowerCase() !== 'closed') {
            ticketsHtml.catchAllTickets += ticketRow;
        }
        if (ticket.StatusName.toLowerCase() === 'closed') {
            ticketRow = `
                <tr class="tx_ticket" id="${ticket.ID}" onclick="showPopup(${JSON.stringify(ticket).replace(/"/g, '&quot;')})">
                    <td>${ticket.Title}</td>
                    <td>${ticket.ID}</td>
                </tr>
            `;

            ticketsHtml.closedTickets += ticketRow;
        }
    }
}

// Create board HTML elements
function createBoard(newTickets, catchAll, closedTickets, ticketsHtml) {
    newTickets.innerHTML = `
        <fieldset>
            <legend>New CTS Tickets</legend>
            <div class="tx_ticketContainer" id="new">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>ID</th>
                            <th>Location</th>
                            <th>Status</th>
                        </tr>
                </thead>
                    <tbody>
                        ${ticketsHtml.newTickets}
                    </tbody>
                </table>
            </div>
        </fieldset>
    `;

    catchAll.innerHTML = `
        <fieldset>
            <legend>Ticket Catch All</legend>
            <div class="tx_ticketContainer" id="catchAll">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>ID</th>
                            <th>Location</th>
                            <th>Status</th>
                        </tr>
                </thead>
                    <tbody>
                        ${ticketsHtml.catchAllTickets}
                    </tbody>
                </table>
            </div>
        </fieldset>
    `;

    closedTickets.innerHTML = `
        <fieldset>
            <legend>Closed Tickets</legend>
            <div class="tx_ticketContainer" id="closed">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>ID</th>
                        </tr>
                </thead>
                    <tbody>
                        ${ticketsHtml.closedTickets}
                    </tbody>
                </table>
            </div>
        </fieldset>
    `;
}

async function fetchTickets() {
    const response = await fetch('/api/tickets');

    if (!response.ok) {
        console.error('Failed to fetch tickets');
        return null;
    }
    
    return await response.json();
}

async function setTickex() {
    preserveCurrentTool();
    listenEscapeKey();

    // TEMPORARY:
    // Clear Tickex cache so new HTML is always loaded
    sessionStorage.removeItem("Tickex_html");
    sessionStorage.removeItem("Tickex_stash");
    /////////////

    document.title = "Tickex - Bronson";
    
    let current = document.getElementsByClassName("selected");
    if (current.length != 0) {
        current[0].classList.remove("selected");
    }
    let newCurrent = document.getElementById("TXButton");
    newCurrent.classList.add("selected");


    history.pushState("test", "Tickex", "/tickex");

    let progGuts = document.querySelector('.program_board .program_guts');
    // Check for preserved space
    let cached_HTML = sessionStorage.getItem("Tickex_html");
    if (cached_HTML != null) {
        // make sure cache was not overwritten with another tool.
        if(cached_HTML.includes("tx_container")) {
            progGuts.innerHTML = cached_HTML;
            let stash = JSON.parse(sessionStorage.getItem("Tickex_stash"));
            if (stash != null) {
                console.log("Tickex stash found, unloading items");
                // Reset stash
                sessionStorage.removeItem("Tickex_stash");
                // Reset button
                let txButton = document.getElementById("TXButton");
                txButton.classList.remove("stashed");
            }
            return;
        }
    }


    // -- No HTML Cache found, build from scratch
    let tx_container = document.createElement("div");
    tx_container.classList.add("tx_container");


    let sortByBox = document.createElement("div");
    sortByBox.classList.add("tx_sortByBox");
    sortByBox.innerHTML = `
        <legend>Sort By</legend>
        <div>
            <input class="tx_radio" type="radio" name="tx_dev" id="created" checked>
            <label for="created">Date Created</label>
        </div>
        <div>
            <input class="tx_radio" type="radio" name="tx_dev" id="status">
            <label for="status">Status</label>
        </div>
        <div>
            <input class="tx_radio" type="radio" name="tx_dev" id="location">
            <label for="location">Location</label>
        </div>
    `;
    tx_container.append(sortByBox);


    let tdxHotlink = document.createElement("div");
    tdxHotlink.classList.add("tx_tdxHotlink");
    tdxHotlink.innerHTML = `
        <legend>Link to TDX</legend>
        <a href="https://uwyo.teamdynamix.com/TDWorkManagement/" target="_blank" rel="noopener noreferrer">
            <img src="/tdx_logo.png" alt="TeamDynamix" style="height:45px; vertical-align:middle; cursor:pointer;" />
        </a>
    `;
    tx_container.append(tdxHotlink);


    let infoBox = document.createElement("div");
    infoBox.classList.add("tx_infoBox");
    infoBox.innerHTML = `
        <legend>Welcome to Tickex!</legend>
        <p>Tickex is a Ticket Management System to help track and manage TeamDynamix tickets.</p>
        <ul>
    `;
    tx_container.append(infoBox);


    let main_container = document.createElement('div');
    main_container.appendChild(tx_container);
    main_container.classList.add('program_guts');
    progGuts.replaceWith(main_container);


    let newTickets = document.createElement("div");
    newTickets.classList.add("tx_newTickets");
    let catchAll = document.createElement("div");
    catchAll.classList.add("tx_catchAllTickets");
    let closedTickets = document.createElement("div");
    closedTickets.classList.add("tx_closedTickets");

    let response = await fetchTickets();
    let tickets = response?.tickets || [];
    let ticketsHtml = {
        newTickets: "",
        catchAllTickets: "",
        closedTickets: ""
    };

    // Initial board on loadup
    tickets = sortTickets(tickets, 'created'); // Sort by date on loadup
    initBoard(tickets, ticketsHtml);
    createBoard(newTickets, catchAll, closedTickets, ticketsHtml);

    // Listens to radio buttons, for sorting
    sortByBox.addEventListener('click', (e) => {
        if (e.target.matches('input[type="radio"]')) {
            let sortBy = e.target.id;
            let sortedTickets = sortTickets(tickets, sortBy);
            initBoard(sortedTickets, ticketsHtml);
            createBoard(newTickets, catchAll, closedTickets, ticketsHtml);
        }
    });

    tx_container.append(newTickets);
    tx_container.append(catchAll);
    tx_container.append(closedTickets);


    let popupContainer = document.createElement("div");
    popupContainer.classList.add("tx_popupContainer");
    tx_container.append(popupContainer);


    // Init Hide Bool Variable in session storage
    sessionStorage.setItem("txHideBool", true);

    return;
}
