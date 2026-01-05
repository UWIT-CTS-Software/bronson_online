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
    - initializeListeners()
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



// Initializes all listeners for Tickex
function initializeListeners() {
    // Escape Key
    document.addEventListener('keydown', (e) => {
        const pressedKey = e.key;

        if (pressedKey == 'Escape') {
            if (document.querySelector('.tx_popupContainer.popupActive')) {
                hidePopup();
            }
        }
    });

    // Listens to radio buttons, for sorting
    document.getElementById("sortByBox").addEventListener('click', (e) => {
        if (e.target.matches('input[type="radio"]')) {
            let sortBy = e.target.id;
            window.currentSortBy = sortBy;

            const searchBar = document.getElementById('searchBar');
            let search = searchBar.value;

            performSearch(search, sortBy);
        }
    });

    // k-pager listeners
    ["new", "catchAll", "closed"].forEach(section => {
        document.getElementById(`${section}Ticket_dropdown`)
            .addEventListener("change", () => {
                performSearch(document.getElementById("searchBar").value, window.currentSortBy);
            });

        document.getElementById(`${section}Ticket_input`)
            .addEventListener("input", () => {
                performSearch(document.getElementById("searchBar").value, window.currentSortBy);
            });
    });

    const searchBar = document.getElementById('searchBar');
    // Check for empty search bar
    searchBar.addEventListener('keyup', function() {
        if ((this.value || '').trim() === '') {
            performSearch("", window.currentSortBy); // Empty Search
        }
    });

    // Listens for Enter key in search bar
    searchBar.addEventListener('keydown', function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            searchBar.blur();

            let search = (this.value || '').trim().toLowerCase();
            performSearch(search, window.currentSortBy);
        }
    });
}

// For Later - When we have write access to TDX API
function sendToASU() {
    alert("This feature is not yet implemented. -Lex");
}

// For Later - When we have write access to TDX API
function sendToHelpDesk() {
    alert("This feature is not yet implemented. -Lex");
}

// Shows the popup with relavent ticket info
function showPopup(ticket) {
    if (!ticket) {
        console.error("Ticket data not found");
        return;
    }

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
        </div>
    `;

    // For later:
    //      <button class="popup_sendToASU" onClick="sendToASU()">Send to ASU</button>
    //      <button class="popup_sendToHelpDesk" onClick="sendToHelpDesk()">Send to Help Desk</button>
}

// Hides the popup
function hidePopup() {
    const popupContainer = document.querySelector('.tx_popupContainer.popupActive');
    // document.getElementById('terminal').style.display = 'block'; // Show Terminal

    if (popupContainer) {
        popupContainer.classList.remove('popupActive');
    }
}

// Adjusts input ticket field by value
function kPagerButton(val, inputId, maxPageId) {
    let inputField = document.getElementById(inputId);
    if (!inputField) {
        console.warn(`Input field '${inputId}' not found yet.`);
        return;
    }

    const maxPage = document.getElementById(maxPageId);
    const maxVal = parseInt(maxPage?.textContent);
    if (isNaN(maxVal)) {
        console.warn(`Max value from '${maxPage}' is not a number.`);
        return;
    }

    const newVal = parseInt(inputField.value) + val;
    if (newVal <= 0) { inputField.value = 1; } 
    else if (newVal > maxVal) { inputField.value = maxVal; }
    else { inputField.value = newVal; }

    inputField.dispatchEvent(new Event("input", { bubbles: true }));
}

// Performs the search with current text within search bar
function performSearch(search, sortBy) {
    const unalteredTicketData = JSON.parse(sessionStorage.getItem("ticketData"));
    let matchedTickets = [];

    search = search.replaceAll("monday", "mon");
    search = search.replaceAll("tuesday", "tue");
    search = search.replaceAll("wednesday", "wed");
    search = search.replaceAll("thursday", "thu");
    search = search.replaceAll("friday", "fri");
    search = search.replaceAll("saturday", "sat");
    search = search.replaceAll("sunday", "sun");

    matchedTickets = []; // Clear

    if (search !== "") {
        for (let i = 0; i < unalteredTicketData.length; i++) {

            // Query Specific Fields
            if (unalteredTicketData[i].ID.toLowerCase().includes(search) ||
                unalteredTicketData[i].Title.toLowerCase().includes(search) ||
                unalteredTicketData[i].LocationName.toLowerCase().includes(search) ||
                unalteredTicketData[i].RequestorName.toLowerCase().includes(search) ||
                unalteredTicketData[i].CreatedFullName.toLowerCase().includes(search) ||
                unalteredTicketData[i].CreatedDate.toLowerCase().includes(search) ||
                unalteredTicketData[i].ModifiedDate.toLowerCase().includes(search) ||
                unalteredTicketData[i].Description.toLowerCase().includes(search))
            {
                matchedTickets.push(unalteredTicketData[i]);
            }
        }

        initBoard(matchedTickets, sortBy);
    }
    else {
        initBoard(unalteredTicketData, sortBy);
    }
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
            const aIndex = statusOrder.indexOf(a.StatusName);
            const bIndex = statusOrder.indexOf(b.StatusName);
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
function initBoard(tickets, sortBy) {
    let ticketsHtml = {
        newTickets: "",
        catchAllTickets: "",
        closedTickets: ""
    };
    
    tickets = sortTickets(tickets, sortBy);

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
        newNumRows = 15;
        catchAllNumRows = 15;
        closedNumRows = 15;

        newInputField = 1;
        catchAllInputField = 1;
        closedInputField = 1;
    }

    // Update Max Page Numbers
    let newMaxPage = document.getElementById("newMaxPage");
    let catchAllMaxPage = document.getElementById("catchAllMaxPage");
    let closedMaxPage = document.getElementById("closedMaxPage");

    // Put tickets in proper board sections
    let newCount = 0, catchAllCount = 0, closedCount = 0;
    for (let ticket of tickets) {
        let ticketRow = `
            <tr class="tx_ticket" id="${ticket.ID}" onclick="showPopup(${JSON.stringify(ticket).replace(/"/g, '&quot;')})">
                <td>${ticket.Title}</td>
                <td>${ticket.ID}</td>
                <td>${ticket.LocationName || 'N/A'}</td>
                <td>${ticket.StatusName}</td>
            </tr>
        `;

        // If days old < 14 or status == new
        const isNew = (Date.now() - new Date(ticket.CreatedDate) < 14 * 24 * 60 * 60 * 1000 
            || ticket.StatusName.toLowerCase() === 'new') 
            && ticket.StatusName.toLowerCase() !== 'closed';

        const isClosed = ticket.StatusName.toLowerCase() === 'closed';

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
                <tr class="tx_ticket" id="${ticket.ID}" onclick="showPopup(${JSON.stringify(ticket).replace(/"/g, '&quot;')})">
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

async function fetchTickets() {
    try {
        const response = await fetch('/tickets');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const tickets = await response.json();
        return tickets;
    } catch (error) {
        console.error('Failed to fetch tickets:', error);
        return [];
    }
}

async function setTickex() {
    preserveCurrentTool();

    // TEMPORARY:
    // Clear Tickex cache so new HTML is always loaded
    sessionStorage.removeItem("Tickex_html");
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


    // Main Container
    let main_container = document.createElement('div');
    main_container.appendChild(tx_container);
    main_container.classList.add('program_guts');
    progGuts.replaceWith(main_container);



    /* -------------------- Tickex Page -------------------- */
    let response = await fetchTickets();
    let tickets = Array.isArray(response) ? response : [];
    // sessionStorage.setItem("ticketData", JSON.stringify(tickets));

    // TODO: Grab tickets from database
    // TODO: Reload board when new Tickex Run is COMPLETED (will this affect whether search is active?)
    // TODO: Put k-pager on two lines, not just 1, will look better and can condense more
    // TODO: Fix sorting
    // TODO: Fix search bar? (Might be related to broken sorting)

    // Sort By Box - by date, status, and room location
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
            <input class="tx_radio" type="radio" name="tx_dev" id="status">
            <label for="status">Status</label>
        </div>
        <div>
            <input class="tx_radio" type="radio" name="tx_dev" id="location">
            <label for="location">Location</label>
        </div>
    `;
    tx_container.append(sortByBox);


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


    // Search Bar
    let searchBar = document.createElement("div");
    searchBar.classList.add("tx_search");
    searchBar.innerHTML = `
        <legend>Search</legend>
        <textarea id="searchBar" placeholder="Search: Title, ID, Room, Date, Description, etc...  (Enter)"></textarea>
        <ul>
    `;
    tx_container.append(searchBar);

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
                        <th>Location</th>
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
                    <span>Items per page: </span>
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
                    </select>
                </div>
            </div></fieldset>
    `;

    let catchAll = document.createElement("div");
    catchAll.classList.add("tx_catchAllTickets");
    catchAll.id = 'catchAllTicketsBoard';
        catchAll.innerHTML = `
        <fieldset><legend>Ticket Catch All</legend>
            <div class="tx_ticketContainer" id="catchAll">
                <table>
                    <thead><tr>
                        <th>Title</th>
                        <th>ID</th>
                        <th>Location</th>
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
                    <span>Items per page: </span>
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
                    </select>
                </div>
            </div></fieldset>
    `;

    let closedTickets = document.createElement("div");
    closedTickets.classList.add("tx_closedTickets");
    closedTickets.id = "closedTicketsBoard";
        closedTickets.innerHTML = `
        <fieldset><legend>Closed Tickets</legend>
            <div class="tx_ticketContainer" id="closed">
                <table>
                    <thead><tr>
                        <th>Title</th>
                        <th>ID</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
                <div class="k_pager" id="closedPager">
                    <button class="k_pager_button" id="closed_minus10" onclick="kPagerButton(-10, 'closedTicket_input', 'closedMaxPage')">-10</button>
                    <button class="k_pager_button" id="closed_minus1" onclick="kPagerButton(-1, 'closedTicket_input', 'closedMaxPage')"><</button>
                    <input type="number" class="k_input_inner" id="closedTicket_input" autocomplete="off" value="1"></input>
                    <span>of </span>
                    <span id="closedMaxPage">1</span>
                    <button class="k_pager_button" id="closed_plus1" onclick="kPagerButton(1, 'closedTicket_input', 'closedMaxPage')">></button>
                    <button class="k_pager_button" id="closed_plus10" onclick="kPagerButton(10, 'closedTicket_input', 'closedMaxPage')">+10</button>
                    <span>Items per page: </span>
                    <select class="k_pager_button" id="closedTicket_dropdown">
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="15" selected>15</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        <option value="40">40</option>
                        <option value="50">50</option>
                        <option value="75">75</option>
                        <option value="100">100</option>
                    </select>
                </div>
            </div></fieldset>
    `;

    // Initial board on loadup
    let sortBy = "created"; // sort by date created on load up
    tickets = sortTickets(tickets, sortBy);

    tx_container.append(newTickets);
    tx_container.append(catchAll);
    tx_container.append(closedTickets);

    initBoard(tickets, sortBy);
    initializeListeners();


    // Popup Container - click on ticket for popup to appear
    let popupContainer = document.createElement("div");
    popupContainer.classList.add("tx_popupContainer");
    tx_container.append(popupContainer);


    // Init Hide Bool Variable in session storage
    sessionStorage.setItem("txHideBool", true);

    return;
}
