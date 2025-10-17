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
    - fetchTickets()

HTML
    - setTickex()

Notes:


TODO - Popup for ticket details/editing (https://www.youtube.com/watch?v=VO3HOri1TEw)
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

    popupContainer.innerHTML = `
        <div class="tx_popupBox">
            <span>${ticket.ticket_title || "No Title"}</span>
            <p>Ticket ID: ${ticket.ticket_id || ""}</p>
            <p>Location: ${ticket.location || ""}</p>
            <p>Status: ${ticket.status || ""}</p>
            <p>Description: ${ticket.description || ""}</p>
            <p>Requestor: ${ticket.requestor || ""}</p>
            <p>Creator: ${ticket.creator || ""}</p>
            <p>Responsibility: ${ticket.responsibility || ""}</p>
            <p>Service: ${ticket.service || ""}</p>
            <p>Account Department: ${ticket.account_department || ""}</p>
            <p>Type: ${ticket.type || ""}</p>
            <p>Urgency: ${ticket.urgency || ""}</p>
            <p>Priority: ${ticket.priority || ""}</p>
            <p>Date Created: ${ticket.date_created || ""}</p>
            <p>Last Modified: ${ticket.date_last_modified || ""}</p>
            <button class="popup_closeButton" onClick="hidePopup()">Close</button>
            <button class="popup_sendToASU" onClick="sendToASU()">Send to ASU</button>
            <button class="popup_sendToHelpDesk" onClick="sendToHelpDesk()">Send to Help Desk</button>
        </div>
    `;
}

function hidePopup() {
    let popupContainer = document.querySelector('.tx_popupContainer.popupActive');

    if (popupContainer) {
        popupContainer.classList.remove('popupActive');
    }
}

function sendToASU() {
    alert("This feature is not yet implemented. -Lex");
}

function sendToHelpDesk() {
    alert("This feature is not yet implemented. -Lex");
}

function addTicketsToBoard(tickets, ticketsHtml) {
    tickets.sort((a, b) => new Date(b.date_created) - new Date(a.date_created));

    for (let ticket of tickets) {
        let ticketRow = `
            <tr class="tx_ticket" id="${ticket.ticket_id}" onclick="showPopup(${JSON.stringify(ticket).replace(/"/g, '&quot;')})">
                <td>${ticket.ticket_title}</td>
                <td>${ticket.ticket_id}</td>
                <td>${ticket.location || 'N/A'}</td>
                <td>${ticket.status}</td>
            </tr>
        `;

        // Days old < 14 or status is new
        if ((Date.now() - new Date(ticket.date_created) < 14 * 24 * 60 * 60 * 1000 || ticket.status.toLowerCase() === 'new')
                && ticket.status.toLowerCase() !== 'closed') {
            ticketsHtml.newTickets += ticketRow;
        }
        if (ticket.status.toLowerCase() !== 'closed') {
            ticketsHtml.catchAllTickets += ticketRow;
        }
        if (ticket.status.toLowerCase() === 'closed') {
            ticketRow = `
                <tr class="tx_ticket" id="${ticket.ticket_id}" onclick="showPopup(${JSON.stringify(ticket).replace(/"/g, '&quot;')})">
                    <td>${ticket.ticket_title}</td>
                    <td>${ticket.ticket_id}</td>
                </tr>
            `;

            ticketsHtml.closedTickets += ticketRow;
        }
    }
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



    let response = await fetchTickets();
    let tickets = response?.tickets || [];
    let ticketsHtml = {
        newTickets: "",
        catchAllTickets: "",
        closedTickets: ""
    };
    
    addTicketsToBoard(tickets, ticketsHtml);

    // -- No HTML Cache found, build from scratch
    let tx_container = document.createElement("div");
    tx_container.classList.add("tx_container");


    let tdxHotlink = document.createElement("div");
    tdxHotlink.classList.add("tx_tdxHotlink");
    tdxHotlink.innerHTML = `
        <legend>Link to TDX</legend>
        <a href="https://uwyo.teamdynamix.com/TDWorkManagement/" target="_blank" rel="noopener noreferrer">
            <img src="/tdx_logo.png" alt="TeamDynamix" style="height:45px; vertical-align:middle; cursor:pointer;" />
        </a>
    `;

    let infoBox = document.createElement("div");
    infoBox.classList.add("tx_infoBox");
    infoBox.innerHTML = `
        <legend>Welcome to Tickex!</legend>
        <p>Tickex is a Ticket Management System designed to help you track and manage CTS tickets from TeamDynamix.</p>
        <ul>
    `;

    let newTickets = document.createElement("div");
    newTickets.classList.add("tx_newTickets");
    newTickets.innerHTML = `
        <fieldset>
            <legend>New CTS Tickets</legend>
            <div class="tx_ticketContainer">
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

    let catchAll = document.createElement("div");
    catchAll.classList.add("tx_catchAllTickets");
    catchAll.innerHTML = `
        <fieldset>
            <legend>Ticket Catch All</legend>
            <div class="tx_ticketContainer">
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

    let closedTickets = document.createElement("div");
    closedTickets.classList.add("tx_closedTickets");
    closedTickets.innerHTML = `
        <fieldset>
            <legend>Closed Tickets</legend>
            <div class="tx_ticketContainer">
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

    let popupContainer = document.createElement("div");
    popupContainer.classList.add("tx_popupContainer");


    tx_container.append(tdxHotlink);
    tx_container.append(infoBox);
    tx_container.append(popupContainer);
    tx_container.append(newTickets);
    tx_container.append(catchAll);
    tx_container.append(closedTickets);

    // Closes popup if escape key is pressed
    document.addEventListener('keydown', (e) => {
        const pressedKey = e.key;

        if (pressedKey == 'Escape') {
            if (document.querySelector('.tx_popupContainer.popupActive')) {
                hidePopup();
            }
        }
    });

    let main_container = document.createElement('div');
    main_container.appendChild(tx_container);
    main_container.classList.add('program_guts');
    progGuts.replaceWith(main_container);

    // Init Hide Bool Variable in session storage
    sessionStorage.setItem("txHideBool", true);
    return;
}