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
    - fetchDummyTicket()

HTML
    - setTickex()

Notes:


TODO - Popup for ticket details/editing
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


async function fetchDummyTicket() {
    const response = await fetch('/api/dummy_ticket');

    if (!response.ok) {
        console.error('Failed to fetch dummy ticket');
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

    let ticket = await fetchDummyTicket();
    let ticketHtml = "";

    if (ticket) {
        ticketHtml = `
            <fieldset>
              <legend>${ticket.ticket_title || "No Title"}</legend>
              <p>ID: ${ticket.ticket_id || ""}</p>
              <p>Location: ${ticket.location || ""}</p>
              <p>Status: ${ticket.status || ""}</p>
              <p>Description: ${ticket.description || ""}</p>
              <p>Requestor: ${ticket.requestor || ""}</p>
            </fieldset>
        `;
    }


    
    // -- No HTML Cache found, build from scratch
    let tx_container = document.createElement("div");
    tx_container.classList.add("tx_container");


    let tdxHotlink = document.createElement("div");
    tdxHotlink.classList.add("tx_tdxHotlink");
    tdxHotlink.innerHTML = `
    <legend>Link to TDX</legend>
    <a href="https://uwyo.teamdynamix.com/TDWorkManagement/" target="_blank" rel="noopener noreferrer">
        <img src="/tdx_logo.png" alt="TeamDynamix" style="height:45px; vertical-align:middle; cursor:pointer;" />
    </a>`;


    let infoBox = document.createElement("div");
    infoBox.classList.add("tx_infoBox");
    infoBox.innerHTML = `
        <legend>Welcome to Tickex!</legend>
        <p>Tickex is a Ticket Management System designed to help you track and manage CTS tickets from TeamDynamix.</p>
        <ul>
    `;

    let ticketInfo = document.createElement("div");
    ticketInfo.classList.add("tx_ticketInfo");
    ticketInfo.innerHTML = ticketHtml || `
        <fieldset>
          <legend>Test Field</legend>
          <p>This is a test field for Tickex.</p>
          <p>You can add your content here.</p>
        </fieldset>
    `;

    let newTickets = document.createElement("div");
    newTickets.classList.add("tx_newTickets");
    newTickets.innerHTML = `
        <fieldset>
          <legend>New CTS Tickets</legend>
          <p>(Placeholder text) This is where new tickets will be displayed.</p>
        </fieldset>
    `;

    let catchAll = document.createElement("div");
    catchAll.classList.add("tx_catchAllTickets");
    catchAll.innerHTML = `
        <fieldset>
          <legend>CTS Catch All Tickets</legend>
          <p>(Placeholder text) This is where all CTS tickets will be displayed.</p>
        </fieldset>
    `;

    let closedTickets = document.createElement("div");
    closedTickets.classList.add("tx_closedTickets");
    closedTickets.innerHTML = `
        <fieldset>
          <legend>CTS Catch All Tickets</legend>
          <p>(Placeholder text) This is where all closed tickets will be displayed.</p>
        </fieldset>
    `;

    tx_container.append(tdxHotlink);
    tx_container.append(infoBox);
    tx_container.append(newTickets);
    tx_container.append(catchAll);
    tx_container.append(closedTickets);
    tx_container.append(ticketInfo);


    let main_container = document.createElement('div');
    main_container.appendChild(tx_container);
    main_container.classList.add('program_guts');
    progGuts.replaceWith(main_container);

    // Init Hide Bool Variable in session storage
    sessionStorage.setItem("txHideBool", true);
    return;
}