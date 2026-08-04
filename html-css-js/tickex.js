/*
  ________        _
 |___  ___|      | |       _    _  (_)   
    |  |  (_)  __| | _____ \ \/ /   _ ___ 
    |  |   _ / __| |/ / _ \ \  /   | / __|
    |  |  | | (__|   <  __/ /  \  _| \__ \
    |__|  |_|\___|_|\_\___|/_/\_\(_) |___/
                                  _/ |
                                 |__/

Summary:
    A tool that integrates CTS's every day needs for ticket handling
    in TeamDynamix. Viewing, responding, assigning, and active monitoring
    for tickets in the CTS department (exclusively CTS-specified tickets).

Notes:
    - The current state of this tool is read-only from the TDX API. We plan 
        to have write access to the API in the future once we get permissions.

        
TOC:
    Helpers:
    - delay() : Simple delay/wait function

    Write to TDX Functions (unimplemented for right now):
    - takeIncident()    : Takes responsibility for a ticket
    - markTicketFalse() : Marks a ticket as false

    Popups:
    - newTicketPopup()               : Opens the popup for the new ticket dialog
    - createTicket()                 : Looks at new ticket popup and sends request to create ticket
    - editTicketPopup()              : Opens the popup for the edit ticket dialog
    - applyChanges()                 : Looks at edit ticket popup and sends request to edit ticket
    - newCommentDiolog()             : Opens the new comment for a ticket dialog
    - closeCommentDialog()           : Closes the new comment dialog
    - comment()                      : Looks at comment dialog and sends request to comment
    - toggleEmailRequestor()         : Toggles html that indicates whether the requestor will be emailed
    - dismissAll()                   : Clear all ticket rows of unread notifications
    - dismissAllPopup()              : Shows the "Dismiss All" confirmation popup
    - dismissChanges()               : Dismisses the "What Changed" box in the popup
    - showTicketPopup()              : Shows the popup with relavent ticket info
    - showTicketPopupFromDashboard() : Shows popup from dashboard - opens Tickex first, then shows the popup
    - showTicket()                   : Shows the ticket popup
    - toggleDetails()                : Toggles the details page in the popup
    - toggleComments()               : Toggles the comments box in the popup
    - hideCurrentPopup()             : Hides the current popup

    Board Setup:
    - initializeListeners() : Initializes all listeners for Tickex
    - kPagerButton()        : Scroll page buttons at bottom of a ticket board
    - performSearch()       : Performs the search with current text within search bar
    - sortTickets()         : Handles sorting of board elements
    - initBoard()           : Add/Refreshes tickets to the board

    Cache Functions:
    - getTicketCache()      : Grabs the Ticket Cache
    - getCachedTicketData() : Grabs a Specific Ticket from the Cache
    - setCachedTicketData() : Saves a Ticket to the Cache
    - removeFromCache()     : Removes a Ticket from the Cache 
    - tokenize()            : Helper: simple tokenizer

    Backend Calls:
    - fetchTickets()                : Grab all tickets from backend/api
    - fetchTicketDescription()      : Grab ticket Description from backend 
    - fetchTicketComments()         : Grab ticket Comments (feed) from backend
    - fetchCurrentUserPermissions() : Fetches the current user's permission level
    - checkUserExistsInDatabase()   : Fetches whether the current user exists within Database records
    - fetchTDXUserID()              : Fetches the TDX user ID for the current user
    - updateTicketViewed()          : Update ticket's viewed status in backend/database
    - updateTicket()                : Send a request to TeamDynamix to Create/edit a Ticket
    - postComment()                 : Send a request to TeamDynamix to Post a Comment to a Ticket
    - updateFalseStatus()           : Send a request to TeamDynamix to mark at Ticket as a True/False Ticket

    "Main" Function:
    - setTickex()   : Sets up the Tickex tool page


TODO:
    Main Features to Add when we get write access:
    - Add "Take Responsibility" Button to unassigned tickets
        - This will disappear when a tech takes responsibility
    - Add "Assign Responsibility" Button to assign other techs to tickets
        - Maybe a dropdown of all CTS techs that you can assign to? (Can we get this list from the API?)
    - (Optional, but might be nice) Have an AI Summarize the actions of the tickets when closing the ticket 
        - Client side?/Server side?
        - TDX sort of has an AI summary, but I want to post it in the comments
*/

    /* -------------------- Helpers -------------------- */

// Simple delay/wait function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));



    /* -------------------- Write to TDX Functions -------------------- */

// Macro for taking Responsibility for a Ticket
// For Later - When we have shibboleth
function takeResponsibility() {
    alert("This feature is not yet implemented.");

    // Projected workflow w/ shibboleth:
    //  - We will have some type of user name from shibboleth (example: "John Doe")
    //  - Query TDX for a Uid from that user name ("John Doe" -> "6f873055-ca...")
    //  - If we get an ID, update ticket using /api/216/tickets/{id} endpoint
    //  - If not, display error and bail on action? 
}

// Macro for marking a ticket as false
async function markTicketFalse(ticketID, parentID) {
    const confirmationMessage = ` Are You Sure?
    Example False Ticket Criteria:
    - Tech arrives to Ticket being resolved/no issue is found
    - Loud noises not related to Classroom Tech
    - PC BIOS Screen or bad PC Power Supply
    - Ticket was offloaded to a different department

If you are unsure if this is a false ticket, ask a full-timer.
    `;

    if (!confirm(confirmationMessage)) return;

    const jsonBody = {
        "ID": ticketID,
        "ParentID": parentID,
    };

    hideCurrentPopup();

    await updateFalseStatus(jsonBody);
}



    /* -------------------- Popups -------------------- */

// Opens the popup for the new ticket dialog
function newTicketPopup() {
    const newTicketPopupContainer = document.querySelector('.tx_newTicketPopupContainer');
    if (!newTicketPopupContainer) {
        console.error("New Ticket Popup Container not found");
        return;
    }

    newTicketPopupContainer.classList.add('tx_popupActive');
    newTicketPopupContainer.innerHTML = `
        <div class="tx_popupBox">
            <span>Create New Ticket</span>
            <br class="tx_createTicketBr">
            <p class="tx_createTicketText">Title: </p>
            <textarea id="tx_createTicket_Title" class="tx_createTicketTextarea" maxlength="80" placeholder="Ex: IT 173 - My Issue (This field is Required)"></textarea>
            <br class="tx_createTicketBr">
            <p class="tx_createTicketText">Description:</p>
            <textarea id="tx_createTicket_Description" class="tx_createTicketTextarea" rows="8" placeholder="Explain your Ticket... (This field is Required)"></textarea>
            <br class="tx_createTicketBr">
            <div>
                <label for="requestor">Requestor:</label>
                <select name="requestor" id="tx_createTicket_Requestor">
                    <option value="johndoe_ID">John Doe</option>
                </select>
            </div>
            <br class="tx_createTicketBr">
            <div>
                <label for="created-by">Created By:</label>
                <select name="created-by" id="tx_createTicket_CreatedBy">
                    <option value="johndoe_ID">John Doe</option>
                </select>
            </div>
            <br class="tx_createTicketBr">
            <button id="tx_createTicketButton" onClick="createTicket()">Create Ticket</button>
            <button class="cancelPopupButton" onClick="hideCurrentPopup()">Cancel</button>
        </div>
    `;

    // Hide terminal if open
    const terminal = document.getElementById('terminal');
    if (terminal) terminal.style.display = 'none';

    // Disable scrolling the main body when popup is active
    document.body.classList.add('tx_no-scroll');
}
// Looks at new ticket popup and sends request to create ticket
async function createTicket(container) {
    // Ensure required fields are filled out
    const titleField = document.getElementById("tx_createTicket_Title");
    const descriptionField = document.getElementById("tx_createTicket_Description");
    const requestorField = document.getElementById("tx_createTicket_Requestor");
    const createdByField = document.getElementById("tx_createTicket_CreatedBy");

    let canContinue = true;

    // Title
    if (titleField.value === "") {
        canContinue = false;
        titleField.classList.add("tx_textareaRequired");
    } else {
        titleField.classList.remove("tx_textareaRequired");
    }
    // Description
    if (descriptionField.value === "") {
        canContinue = false;
        descriptionField.classList.add("tx_textareaRequired");
    } else {
        descriptionField.classList.remove("tx_textareaRequired");
    }

    // Stops here if any required fields are empty
    if (!canContinue) return;

    // Package data and send to backend
    const jsonBody = {
        "_OperationType": "CREATE", 
        "Title": titleField.value.trim(),
        "Description": descriptionField.value.trim(),
        "RequestorUid": "6f873055-ca2f-eb11-8b7c-000d3a9b77a1", // Hard-coded for now
    };

    await updateTicket(jsonBody);
    hideCurrentPopup(true);
    await delay(250); // Pause for a little
    setTickex(); // Reload board to show changes
}

// Opens the popup for the edit ticket dialog
async function editTicketPopup(ticketID) {
    hideCurrentPopup();

    const editTicketPopupContainer = document.querySelector('.tx_editTicketPopupContainer');
    if (!editTicketPopupContainer) {
        console.error("Edit Ticket Popup Container not found");
        return;
    }

    const ticket = window.ticketById?.get(ticketID);
    if (!ticket) console.error("Failed to search for Ticket when attempting to Edit Ticket");
    let description = await fetchTicketDescription(ticket.ID);
    // Scrub HTML tags out
    description = description.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n+/g, '\n').trim();

    editTicketPopupContainer.classList.add('tx_popupActive');
    editTicketPopupContainer.innerHTML = `
        <div class="tx_popupBox">
            <span>Edit Ticket</span>
            <div class="tx_adjacent">
                <p>ID: ${ticket.ID}
                    <a href="https://uwyo.teamdynamix.com/TDNext/Apps/216/Tickets/TicketDet?TicketID=${ticket.ID}" target="_blank" rel="noopener noreferrer">
                        <button>Link to Ticket</button>
                    </a>
                </p>
            </div>
            <div>
                <label for="status">Status:</label>
                <select name="status" id="tx_editTicket_Status">
                    ${(ticket.StatusName !== "New" && ticket.StatusName !== "In Process" && ticket.StatusName !== "Closed") ?
                        `<option selected value="Other">${ticket.StatusName}</option>`: ""
                    }
                    <option ${(ticket.StatusName === "New") ? "selected" : ""} value="New">New</option>
                    <option ${(ticket.StatusName === "In Process") ? "selected" : ""} value="In Process">In Process</option>
                    <option ${(ticket.StatusName === "Closed") ? "selected" : ""} value="Closed">Closed</option>
                </select>
            </div>
            <p class="tx_editTicketText">Title: </p>
            <textarea id="tx_editTicket_Title" class="tx_createTicketTextarea" maxlength="80" placeholder="Ex: IT 173 - My Issue (This field is Required)">${ticket.Title}</textarea>
            <br class="tx_createTicketBr">
            <p class="tx_createTicketText">Description:</p>
            <p class="tx_Description" id="tx_editTicket_Description">${description}</p>
            <br class="tx_createTicketBr">
            <p class="tx_createTicketText">Comments:</p>
            <textarea id="tx_editTicket_Comments" class="tx_createTicketTextarea" rows="9"></textarea>
            <br class="tx_createTicketBr">
            <input id="tx_editTicketEmailCheckbox" type="checkbox" id="email" name="email" onClick="toggleEmailRequestor('edit', ${ticketID})"></input>
            <label class="tx_createTicketText" for="email">Notify Requestor (${ticket.RequestorName})</label>
            <br class="tx_createTicketBr">
            <button id="tx_applyChangesButton" onClick="applyChanges(${ticketID})">Apply Changes</button>
            <button class="cancelPopupButton" onClick="hideCurrentPopup()">Cancel</button>
        </div>
    `;

    toggleEmailRequestor("edit", ticketID);

    // Hide terminal if open
    const terminal = document.getElementById('terminal');
    if (terminal) terminal.style.display = 'none';

    // Disable scrolling the main body when popup is active
    document.body.classList.add('tx_no-scroll');
}
// Looks at edit ticket popup and sends request to edit ticket
async function applyChanges(ticketID) {
    const isAuthorized = await fetchTDXUserID() != 0 && (await fetchCurrentUserPermissions() > 3 || !await checkUserExistsInDatabase()); 

    const ticket = window.ticketById?.get(ticketID);
    if (!ticket) console.error("Failed to search for Ticket when attempting to Edit Ticket");

    // Ensure required fields are filled out
    const statusField = document.getElementById("tx_editTicket_Status");
    const titleField = document.getElementById("tx_editTicket_Title");
    const commentsFields = document.getElementById("tx_editTicket_Comments");
    const emailCheckbox = document.getElementById("tx_editTicketEmailCheckbox");

    let canContinue = true;

    // Title
    if (titleField.value === "") {
        canContinue = false;
        titleField.classList.add("tx_textareaRequired");
    } else {
        titleField.classList.remove("tx_textareaRequired");
    }
    // Comments
    if (commentsFields.value === "") {
        canContinue = false;
        commentsFields.classList.add("tx_textareaRequired");
    } else {
        commentsFields.classList.remove("tx_textareaRequired");
    }

    // Stops here if any required fields are empty
    if (!canContinue) return;

    // Package data and send to backend
    const ticketBody = {
        "_OperationType": "EDIT", 
        "ID": ticketID,
        "Title": titleField.value.trim(),
        "ResponsibleUid": "6f873055-ca2f-eb11-8b7c-000d3a9b77a1" // Hard-coded for now, "Lex Fermelia"
    };
    // Omit Status if it is not "New", "In Process", or "Closed"
    if (statusField.value.trim() !== "Other") ticketBody["StatusName"] = statusField.value.trim();

    const c = "<b><i>This comment was made on behalf of " + "Lex Fermelia" + ":</i></b><br><br>" + commentsFields.value;
    const commentBody = {
        "ID": ticket.ID,
        "Comments": c, // Hard-coded for now, "Lex Fermelia"
        "IsPrivate": !emailCheckbox.checked,
        "Notify": emailCheckbox.checked ? [ticket.RequestorEmail] : [] // An array, pass [] to NOT notify anybody
    };

    hideCurrentPopup(true);
    await updateTicket(ticketBody);
    await postComment(commentBody);
    await delay(100); // Pause for a little
    setTickex(ticketID); // Reload page to show changes 
}

// Opens the new comment dialog
function newCommentDiolog(ticketID, commentButton) {
    if (event) event.stopPropagation();

    const ticket = window.ticketById?.get(ticketID);
    if (!ticket) console.error("Failed to search for Ticket when attempting to Edit Ticket");

    // Replace comment button with new commenet dialog
    const dialog = document.createElement("div");
    dialog.classList.add("tx_newCommentDialog");
    dialog.id = "tx_newCommentDialogBox";
    dialog.innerHTML = `
        <span>New Comment:</span>
        <textarea id="tx_commentOnTicket_Comments" class="tx_createTicketTextarea" rows="9"></textarea>
        <br>
        <input id="tx_commentOnTicketEmailCheckbox" type="checkbox" id="email" name="email" onClick="toggleEmailRequestor('comment', ${ticketID})"></input>
        <label class="tx_createTicketText" for="email">Notify Requestor (${ticket.RequestorName}):</label>
        <br>
        <button id="tx_commentButton" onClick="comment(${ticket.ID})">Comment</button>
        <button class="cancelPopupButton" onClick="closeCommentDialog(${ticket.ID})">Cancel</button>
    `;

    commentButton.outerHTML = dialog.outerHTML;
    
    toggleEmailRequestor("comment", ticketID);
}
// Closes the new comment dialog
async function closeCommentDialog(ticketID) {
    const isAuthorized = await fetchTDXUserID() != 0 && (await fetchCurrentUserPermissions() > 3 || !await checkUserExistsInDatabase()); 
    if (event) event.stopPropagation();

    const dialog = document.getElementById("tx_newCommentDialogBox");
    dialog.outerHTML = `
        ${isAuthorized ? `<button id="tx_newCommentButton" onClick="newCommentDiolog(${ticketID}, this)">Post New Comment</button>` : ""}
    `;
}
// Looks at comment dialog and sends request to comment
async function comment(ticketID) {
    const ticket = window.ticketById?.get(ticketID);
    if (!ticket) console.error("Failed to search for Ticket when attempting to Edit Ticket");

    // Ensure required fields are filled out
    const commentsFields = document.getElementById("tx_commentOnTicket_Comments");
    const emailCheckbox = document.getElementById("tx_commentOnTicketEmailCheckbox");

    let canContinue = true;

    // Require Comments Field
    if (commentsFields.value === "") {
        canContinue = false;
        commentsFields.classList.add("tx_textareaRequired");
    } else {
        commentsFields.classList.remove("tx_textareaRequired");
    }
    
    // Stops here if any required fields are empty
    if (!canContinue) return;

    // Package data and send to backend
    const c = "<b><i>This comment was made on behalf of " + "Lex Fermelia" + ":</i></b><br><br>" + commentsFields.value;
    const commentBody = {
        "ID": ticket.ID,
        "Comments": c,
        "IsPrivate": !emailCheckbox.checked,
        "Notify": emailCheckbox.checked ? [ticket.RequestorEmail] : [] // An array, pass [] to NOT notify anybody
    };

    hideCurrentPopup(true);
    await postComment(commentBody);
    await delay(100); // Pause for a little
    setTickex(ticketID); // Reload page to show changes
}

// Toggles html that indicates whether the requestor will be emailed
function toggleEmailRequestor(type, ticketID) {
    const ticket = window.ticketById?.get(ticketID);
    if (!ticket) console.error("Failed to search for Ticket when attempting to Edit Ticket");

    const privateCommentsPreview = `Enter your private comments...
    
Notes you make here will NOT be sent to the Requestor unless the the checkbox is checked.
    `;
    const emailPreview = `Hello ${ticket.RequestorFirstName},

(Write your email to ${ticket.RequestorFirstName} here, summarizing relevant information like fixes/issues/further actions...)

Thanks,

<Your Name>
Classroom Technology Services (CTS)
    `;

    let checkbox = null;
    let textfield = null;
    if (type === "edit") {
        checkbox = document.getElementById("tx_editTicketEmailCheckbox");
        textfield = document.getElementById("tx_editTicket_Comments");
    }
    else if (type === "comment") {
        checkbox = document.getElementById("tx_commentOnTicketEmailCheckbox");
        textfield = document.getElementById("tx_commentOnTicket_Comments");
    }

    if (checkbox.checked) 
        textfield.placeholder = emailPreview;
    else 
        textfield.placeholder = privateCommentsPreview;
}

// Clear all ticket rows of unread notifications
async function dismissAll(confirmed) {
    // Dismiss Popup
    const dismissAllPopupContainer = document.querySelector('.tx_dismissAllPopupContainer');
    if (!dismissAllPopupContainer) {
        console.error("Dismiss All Popup container not found");
        return;
    }
    dismissAllPopupContainer.classList.remove('tx_popupActive');

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
        document.body.classList.remove('tx_no-scroll');
    }
}
// Shows the "Dismiss All" confirmation popup
function dismissAllPopup() {
    const dismissAllPopupContainer = document.querySelector('.tx_dismissAllPopupContainer');
    if (!dismissAllPopupContainer) {
        console.error("Dismiss All Popup container not found");
        return;
    }
    dismissAllPopupContainer.classList.add('tx_popupActive');
    event.stopPropagation();

    dismissAllPopupContainer.innerHTML = `
        <div class="tx_popupBox">
            <span>Are You Sure?</span>
            <p>This action will apply to all users.</p>
            <p>Are you sure you wish to Dismiss All Notifications?</p>
            <button class="dismissAllButtonConfirm" onClick="dismissAll(true)">Yes, Dismiss All</button>
            <button class="cancelPopupButton" onClick="dismissAll(false)">Cancel</button>
        </div>
    `;

    // Hide terminal if open
    const terminal = document.getElementById('terminal');
    if (terminal) terminal.style.display = 'none';

    // Disable scrolling the main body when popup is active
    document.body.classList.add('tx_no-scroll');
}

// Dismisses the "What Changed" box in the popup
function dismissChanges(ticketID, event) {
    if (event) event.stopPropagation();
    
    const ticketPopupContainer = document.querySelector('.tx_ticketPopupContainer.tx_popupActive');
    if (!ticketPopupContainer) return;

    // Remove the "What Changed" box
    const whatChangedBox = ticketPopupContainer.querySelector('.tx_whatChangedBox');
    if (whatChangedBox) whatChangedBox.remove();

    updateTicketViewed(ticketID, true);
}

// Shows the popup with relavent ticket info
function showTicketPopup(ticket, element) {
    // Change cursor to loading
    if (!document.body.classList.contains('tx_waiting-cursor')) 
        document.body.classList.add('tx_waiting-cursor');
    if (element != null && !element.classList.contains('tx_waiting-cursor')) 
        element.classList.add('tx_waiting-cursor');

    // Force cursor wheel to show
    requestAnimationFrame(() => {
        showTicket(ticket).finally(() => {
            // Remove loading cursor
            if (document.body.classList.contains('tx_waiting-cursor'))
                document.body.classList.remove('tx_waiting-cursor');
            if (element != null &&element.classList.contains('tx_waiting-cursor')) 
                element.classList.remove('tx_waiting-cursor');
        });
    });
}
// Shows popup from dashboard - opens Tickex first, then shows the popup
async function showTicketPopupFromDashboard(ticket, element) {
    // Set up Tickex first
    await setTickex();
    
    // Change cursor to loading
    if (!document.body.classList.contains('tx_waiting-cursor')) 
        document.body.classList.add('tx_waiting-cursor');
    if (element != null && !element.classList.contains('tx_waiting-cursor')) 
        element.classList.add('tx_waiting-cursor');

    // Force cursor wheel to show
    requestAnimationFrame(() => {
        showTicket(ticket).finally(() => {
            // Remove loading cursor
            if (document.body.classList.contains('tx_waiting-cursor'))
                document.body.classList.remove('tx_waiting-cursor');
            if (element != null &&element.classList.contains('tx_waiting-cursor')) 
                element.classList.remove('tx_waiting-cursor');
        });
    });
}
// Shows the ticket popup
async function showTicket(ticket) {
    if (!ticket) {
        console.error("Ticket data not found");
        return;
    }

    const isMobile = localStorage.getItem("isMobile") === "true";
    const isAuthorized = await fetchTDXUserID() != 0 && (await fetchCurrentUserPermissions() > 3 || !await checkUserExistsInDatabase()); 

    let ticketPopupContainer = document.querySelector('.tx_ticketPopupContainer');
    if (!ticketPopupContainer) {
        // Wait for popup to load (timeout of 3 seconds)
        let waited = 0;
        while (waited < 3000) {
            await new Promise(resolve => setTimeout(resolve, 100));
            const pc = document.querySelector('.tx_ticketPopupContainer');
            if (pc) {
                ticketPopupContainer = pc;
                break;
            }
            waited += 100;
        }

        console.error("Popup container not found");
        return;
    }

    // Remove highlight (for all HTML instances of the ticket)
    const ticketRows = document.querySelectorAll(`[id="${ticket.ID}"]`);
    ticketRows.forEach(ticketRow => {
        if (ticketRow) ticketRow.classList.remove('tx_highlight_row');
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
    if (digits.length === 10) // Invalid phone numbers just get skipped and raw string is used
        ticket.RequestorPhone = `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;


    // Set the HTML for comments section
    let commentsHTML = "";
    const container = document.querySelector('.tx_container');
    if (container.classList.contains('commentsShown')) {
        // Fetch from either cache or TDX
        let comments;
        if (ticket.has_been_viewed)
            comments = await fetchTicketComments(ticket.ID); // Try fetching from cache
        else 
            comments = await fetchTicketComments(ticket.ID, true); // Force fetch from TDX

        // Build comments
        let builtComments = "";
        for (let i = 0; i < comments.length; i++) {
            const c = comments[i];

            let formattedDate = "";
            if (c.date != "") formattedDate = new Date(c.date).toLocaleString();

            for (let i = 0; i < c.created_date.length; i++) {
                c.created_date[i] = new Date(c.created_date[i]).toLocaleString();
            }

            // Scrub HTML tags out
            let commentBody = c.comment.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n+/g, '\n').trim(); 

            // Build replies
            let repliesRows = "";
            for (let i = 0; i < c.replies_count; i++) {
                let reply = c.replies[i];

                // Scrub HTML tags out
                reply = reply.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n+/g, '\n').trim();

                repliesRows += `
                <div class="tx_reply">
                    <p class="tx_reply_person">
                        <strong class="tx_strong">${c.created_by[i]}, ${c.created_date[i]}</strong>
                    </p>
                    <p class="tx_reply_body">${reply}</p>
                </div>
                `;
            }

            let repliesHTML = `
                <p class="tx_reply_header">
                    <strong class="tx_strong">Replies:</strong>
                    ${repliesRows}
                </p>
            `;

            builtComments += `
                <div class="tx_comment">
                    <p class="tx_comment_header">
                        <strong class="tx_strong">${c.commenter}</strong> - ${formattedDate}
                    </p>
                    <p class="tx_comment_body">${commentBody}</p>
                    <div class="tx_replies">${c.replies_count ? repliesHTML : "" }</div>
                    <p class="tx_comment_seperator"></p>
                </div>
            `;
        }

        if (comments.length == 0) {
            builtComments = `
                <div class="tx_comment">
                    <br>
                        <p class="tx_comment_header">
                            <strong class="tx_strong">No Comments Exist for this Ticket</strong>
                        </p>
                    <br>
                </div>
            `;
        }
        
        commentsHTML = `
            <div class="tx_popupComments ${isMobile ? "mobile" : ""}">
                <span>Comments:</span>
                <div class="tx_commentWrapper">
                    <div class="tx_commentList">
                        ${builtComments}
                    </div>
                </div>
                <hr class="tx_popupCommentsHR">
                ${isAuthorized ? `<button id="tx_newCommentButton" onClick="newCommentDiolog(${ticket.ID}, this)">Post New Comment</button>` : ""}
            </div>
        `;
    }

    // Set the HTML for what changed, if anything changed
    let whatChangedHTML = "";
    if (!ticket.has_been_viewed) {
        ticket.has_been_viewed = true;
        
        // Grab old ticket info. Compares what changed. (Field: Old info => New info)
        //  - TypeName ("General Classroom Issue" or similar)
        //  - TypeCategoryName ("Instructional Technology & Classroom Support" or similar)
        //  - Title
        //  - AccountName (Department Name)
        //  - StatusName (New, In Process, etc...)
        //  - ServiceName ("I need help with my classroom" or similar)
        //  - PriorityName (High, Medium, Low, Not Specified)
        //  - ResponsibilityFullName (Tech's name)
        //  - ResponsibilityGropuName (CTS)
        //  - comment_count (how many comments/replies are on the ticket)
        let whatChangedRows = "";
        if (ticket.old_type_name != ticket.TypeName && ticket.old_type_name !== "")
            whatChangedRows += `<p>Type: ${ticket.old_type_name} => ${ticket.TypeName}</p>`;
        if (ticket.old_type_category_name != ticket.TypeCategoryName && ticket.old_type_category_name !== "")
            whatChangedRows += `<p>Type Category: ${ticket.old_type_category_name} => ${ticket.TypeCategoryName}</p>`;
        if (ticket.old_title != ticket.Title  && ticket.old_title !== "")
            whatChangedRows += `<p>Title: ${ticket.old_title} => ${ticket.Title}</p>`;
        if (ticket.old_account_name != ticket.AccountName  && ticket.old_account_name !== "")
            whatChangedRows += `<p>Account: ${ticket.old_account_name} => ${ticket.AccountName}</p>`;
        if (ticket.old_status_name != ticket.StatusName  && ticket.old_status_name !== "")
            whatChangedRows += `<p>Status: ${ticket.old_status_name} => ${ticket.StatusName}</p>`;
        if (ticket.old_service_name != ticket.ServiceName  && ticket.old_service_name !== "")
            whatChangedRows += `<p>Service: ${ticket.old_service_name} => ${ticket.ServiceName}</p>`;
        if (ticket.old_priority_name != ticket.PriorityName  && ticket.old_priority_name !== "")
            whatChangedRows += `<p>Priority: ${ticket.old_priority_name} => ${ticket.PriorityName}</p>`;
        if (ticket.old_responsible_full_name != ticket.ResponsibleFullName  && ticket.old_responsible_full_name !== "")
            whatChangedRows += `<p>Responsible: ${ticket.old_responsible_full_name} => ${ticket.ResponsibleFullName}</p>`;
        if (ticket.old_responsible_group_name != ticket.ResponsibleGroupName  && ticket.old_responsible_group_name !== "")
            whatChangedRows += `<p>Responsible Group: ${ticket.old_responsible_group_name} => ${ticket.ResponsibleGroupName}</p>`;
        if (ticket.old_comment_count != ticket.comment_count || ticket.comment_count !== 0)
            whatChangedRows += `<p>New Comments have been added!</p>`;

        // Brand new ticket if no old info exists
        if (ticket.old_title === "") whatChangedRows = `<p>This is a Brand-New Ticket!</p>`;

        whatChangedHTML = `
            <div class="tx_whatChangedBox">
                <span>What Changed:</span>
                <button class="popup_dismissChanges" onclick="dismissChanges(${ticket.ID}, event)">Dismiss</button>
                ${whatChangedRows}
                <p>Last Modified: ${ticket.ModifiedDate || ""} by ${ticket.ModifiedFullName || ""}</p>
            </div>
        `;
    }

    // Set Popup HTML
    let sideContent = "";
    if (container.classList.contains('commentsShown'))
        sideContent += commentsHTML;
    if (whatChangedHTML && !isMobile)
        sideContent += whatChangedHTML;
    
    if (ticketPopupContainer.classList.contains('detailsShown')) { // Details Shown
        ticketPopupContainer.innerHTML = `
            <div class="tx_popupWrapper ${isMobile ? "mobile mobile_tx_font" : ""}">
                <div class="tx_popupBox ${isMobile ? "mobile" : ""}">
                    <span>${ticket.Title || "No Title"}</span>
                    <button class="popup_closeButton" onClick="hideCurrentPopup()">X</button>
                    <div class="tx_adjacent">
                        <p class="tx_popup_ID">Ticket ID: ${ticket.ID || ""}</p>
                        <p class="tx_popup_StatusName">Status: ${ticket.StatusName || ""}</p>
                    </div>
                    <div class="tx_adjacent">
                        <p class="tx_popup_PriorityName">Priority: ${ticket.PriorityName || ""}</p>
                        <p class="tx_popup_DaysOld">Days Old: ${ticket.DaysOld || ""}</p>
                    </div>
                    <p class="tx_popup_Title tx_textwrap">Title: ${ticket.Title || "No Title"}</p>
                    ${isAuthorized ? `<button class="popup_falseTicketButton" onClick="markTicketFalse(${ticket.ID}, ${ticket.ParentID})">Mark Ticket as False</button>` : ""}
                    <a href="https://uwyo.teamdynamix.com/TDNext/Apps/216/Tickets/TicketDet?TicketID=${ticket.ID}" target="_blank" rel="noopener noreferrer">
                        <button class="popup_linkToTicket ${isMobile ? "mobile_tx_button" : ""}">Link to Ticket</button>
                    </a>
                    <hr>
                    <button class="popup_toggleButton ${isMobile ? "mobile_tx_button" : ""}" onClick="toggleDetails(${ticket.ID})">Description</button>
                    <p class="tx_popup_Requestor tx_textwrap">Requestor: ${ticket.RequestorName || ""} || ${ticket.RequestorEmail || "Email Not Provided"} || ${ticket.RequestorPhone || "Phone Not Provided"}</p>
                    <p class="tx_popup_Responsible tx_textwrap">Responsible: ${ticket.ResponsibleFullName || `UNASSIGNED ${isAuthorized ? `<button ${isMobile ? "class=mobile_tx_button" : ""} onClick='takeResponsibility()' disabled>Take Incident</button>` : ""}`} || ${ticket.ResponsibleGroupName || ""}</p>
                    <p class="tx_popup_ServiceName tx_textwrap">Service: ${ticket.ServiceName || ""}</p>
                    <p class="tx_popup_AccountName tx_textwrap">Account Department: ${ticket.AccountName || ""}</p>
                    <p class="tx_popup_TypeName tx_textwrap">Type: ${ticket.TypeName || ""}</p>
                    <p class="tx_popup_TypeCategoryName tx_textwrap">Type Category: ${ticket.TypeCategoryName || ""}</p>
                    <p class="tx_popup_Created tx_textwrap">Date Created: ${ticket.CreatedDate || ""} || Created by: ${ticket.CreatedFullName || ""}</p>
                    <p class="tx_popup_Modified tx_textwrap">Last Modified: ${ticket.ModifiedDate || ""} || Modified by: ${ticket.ModifiedFullName || ""}</p>
                    ${isMobile ? "" : `<button class="popup_commentsButton" onClick="toggleComments(${ticket.ID})">Show Comments</button>`}
                    ${isAuthorized ? `<button class="popup_editTicket" onClick="editTicketPopup(${ticket.ID})">Edit Ticket</button>` : ""}
                </div>
                ${sideContent ? `<div class="tx_sideContent">${sideContent}</div>` : ''}
            </div>
        `;
    } else { // Description Shown
        let description = await fetchTicketDescription(ticket.ID);
        // Scrub HTML tags out
        description = description.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n+/g, '\n').trim(); 

        ticketPopupContainer.innerHTML = `
            <div class="tx_popupWrapper ${isMobile ? "mobile mobile_tx_font" : ""}">
                <div class="tx_popupBox ${isMobile ? "mobile" : ""}">
                    <span>${ticket.Title || "No Title"}</span>
                    ${isMobile ? "" : `<button class="popup_closeButton" onClick="hideCurrentPopup()">X</button>`}
                    <div class="tx_adjacent">
                        <p class="tx_popup_ID">Ticket ID: ${ticket.ID || ""}</p>
                        <p class="tx_popup_StatusName">Status: ${ticket.StatusName || ""}</p>
                    </div>
                    <div class="tx_adjacent"><p class="tx_popup_PriorityName">Priority: ${ticket.PriorityName || ""}</p>
                        <p class="tx_popup_DaysOld">Days Old: ${ticket.DaysOld || ""}</p>
                    </div>
                    <p class="tx_popup_Title tx_textwrap">Title: ${ticket.Title || "No Title"}</p>
                    ${isAuthorized ? `<button class="popup_falseTicketButton" onClick="markTicketFalse(${ticket.ID}, ${ticket.ParentID})">Mark Ticket as False</button>` : ""}
                    <a href="https://uwyo.teamdynamix.com/TDNext/Apps/216/Tickets/TicketDet?TicketID=${ticket.ID}" target="_blank" rel="noopener noreferrer">
                        <button class="popup_linkToTicket ${isMobile ? "mobile_tx_button" : ""}">Link to Ticket</button>
                    </a>
                    <br>
                    <hr>
                    <button class="popup_toggleButton ${isMobile ? "mobile_tx_button" : ""}" onClick="toggleDetails(${ticket.ID})">Details</button>
                    <p class="tx_popup_Requestor tx_textwrap">Requestor: ${ticket.RequestorName || ""}</p>
                    <p class="tx_popup_contact tx_textwrap">Contact: ${ticket.RequestorEmail || "Email Not Provided"} || ${ticket.RequestorPhone || "Phone Not Provided"}</p>
                    <p class="tx_popup_Responsible tx_textwrap${isMobile ? "mobile_tx_button" : ""}">Responsible: ${ticket.ResponsibleFullName || `UNASSIGNED ${isAuthorized ? `<button ${isMobile ? "class=mobile_tx_button" : ""} onClick='takeResponsibility()' disabled>Take Incident</button>` : ""}`} || ${ticket.ResponsibleGroupName || ""}</p>
                    <p class="tx_Description">${description || "--- No Description Provided ---"}</p>
                    ${isMobile ? "" : `<button class="popup_commentsButton" onClick="toggleComments(${ticket.ID})">Show Comments</button>`}
                    ${isAuthorized ? `<button class="popup_editTicket" onClick="editTicketPopup(${ticket.ID})">Edit Ticket</button>` : ""}
                </div>
                ${sideContent ? `<div class="tx_sideContent">${sideContent}</div>` : ''}
            </div>
        `;
    }
    // Show popup
    if (!ticketPopupContainer.classList.contains('tx_popupActive')) {
        // Hide terminal if open
        const terminal = document.getElementById('terminal');
        if (terminal) terminal.style.display = 'none';

        ticketPopupContainer.classList.add('tx_popupActive');

        // Disable scrolling the main body when popup is active
        document.body.classList.add('tx_no-scroll');
    }

    // Mark ticket as viewed
    updateTicketViewed(ticket.ID, true);
}

// Toggles the details page in the popup
function toggleDetails(ticketID) {
    const ticketPopupContainer = document.querySelector('.tx_ticketPopupContainer.tx_popupActive');
    if (!ticketPopupContainer) return;

    const isDetailsShown = ticketPopupContainer.classList.contains('detailsShown');
    if (isDetailsShown) 
        ticketPopupContainer.classList.remove('detailsShown');
    else 
        ticketPopupContainer.classList.add('detailsShown');
    
    // O(1) lookup via ticketById map
    const ticket = window.ticketById?.get(ticketID);
    if (ticket) showTicketPopup(ticket);
}
// Toggles the comments box in the popup
function toggleComments(ticketID) {
    const container = document.querySelector('.tx_container');
    if (!container) return;

    const isCommentsShown = container.classList.contains('commentsShown');
    if (isCommentsShown) 
        container.classList.remove('commentsShown');
    else 
        container.classList.add('commentsShown');
    
    // O(1) lookup via ticketById map
    const ticket = window.ticketById?.get(ticketID);
    if (ticket) showTicketPopup(ticket);
}

// Hides the current popup
function hideCurrentPopup(forceClose=false) {
    if (event) event.stopPropagation();

    const container = document.getElementsByClassName("tx_popupActive")[0];
    if (!container) {
        console.error("hideCurrentPopup(): Couldn't resolve popupContainer");
        return;
    }

    if (container.classList.contains("tx_ticketPopupContainer")) {
        container.classList.remove('detailsShown');
        container.classList.remove('tx_popupActive');
    }
    if (container.classList.contains("tx_newTicketPopupContainer")) {
        if (forceClose) {
            container.classList.remove('tx_popupActive');
            document.body.classList.remove('tx_no-scroll');
            return;
        }
        if (confirm("Are you sure you want to continue? Unsaved changes will be lost.")) {
            container.classList.remove('tx_popupActive');
        } else return;
    }
    if (container.classList.contains("tx_editTicketPopupContainer")) {
        if (forceClose) {
            container.classList.remove('tx_popupActive');
            document.body.classList.remove('tx_no-scroll');
            return;
        }
        if (confirm("Are you sure you want to continue? Unsaved changes will be lost.")) {
            container.classList.remove('tx_popupActive');
        } else return;
    }

    document.body.classList.remove('tx_no-scroll');
}



    /* -------------------- Board Setup -------------------- */

// Initializes all listeners for Tickex
function initializeListeners() {
    // Left Click Outside of Popup
    document.addEventListener('click', (e) => {
        if (e.button !== 0) return; // Ensure only left clicking

        const ticketPopupContainer = document.querySelector('.tx_ticketPopupContainer.tx_popupActive');
        if (ticketPopupContainer) {
            // Check if clicked element is within popupBox, comments, or whatChangedBox
            const clickedInPopupBox = e.target.closest('.tx_popupBox');
            const clickedInSideContent = e.target.closest('.tx_sideContent');
            
            if (!clickedInPopupBox && !clickedInSideContent) hideCurrentPopup();
        }

        const newTicketPopupContainer = document.querySelector('.tx_newTicketPopupContainer.tx_popupActive');
        if (newTicketPopupContainer) {
            const clickedInPopupBox = e.target.closest('.tx_popupBox');
            if (!clickedInPopupBox) hideCurrentPopup();
        }

        const editTicketPopupContainer = document.querySelector('.tx_editTicketPopupContainer.tx_popupActive');
        if (editTicketPopupContainer) {
            const clickedInPopupBox = e.target.closest('.tx_popupBox');
            if (!clickedInPopupBox) hideCurrentPopup();
        }

        const dismissAllPopupContainer = document.querySelector('.tx_dismissAllPopupContainer.tx_popupActive');
        if (dismissAllPopupContainer) {
            const clickedInPopupBox = e.target.closest('.tx_popupBox');
            if (!clickedInPopupBox) {    
                dismissAll(false);
            }
        }
    });

    // Listens to radio buttons, for sorting
    document.getElementById("sortByBox").addEventListener('click', (e) => {
        if (e.target.matches('input[type="radio"]')) {
            window.currentSortBy = e.target.id;

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

// Scroll page buttons at bottom of a ticket board
function kPagerButton(val, inputId, maxPageId) {
    let inputField = document.getElementById(inputId);
    if (!inputField) return;

    const maxPage = document.getElementById(maxPageId);
    const maxVal = parseInt(maxPage?.textContent);
    if (isNaN(maxVal)) return;

    const newVal = parseInt(inputField.value) + val;
    if (newVal <= 0) 
        inputField.value = 1; 
    else if (newVal > maxVal) 
        inputField.value = maxVal;
    else 
        inputField.value = newVal;

    inputField.dispatchEvent(new Event("input", { bubbles: true }));
}

// Performs the search with current text within search bar
function performSearch(search) {
    // Normalize and abbreviate days
    search = (search || "").toString().toLowerCase().trim();
    search = search.replaceAll("monday", "mon");
    search = search.replaceAll("tuesday", "tue");
    search = search.replaceAll("wednesday", "wed");
    search = search.replaceAll("thursday", "thu");
    search = search.replaceAll("friday", "fri");
    search = search.replaceAll("saturday", "sat");
    search = search.replaceAll("sunday", "sun");

    if (search === "") {
        window.currentTickets = window.allTickets || [];
        initBoard();
        return;
    }

    // Numeric -> ID exact lookup
    if (/^\d+$/.test(search) && window.ticketById) {
        const t = window.ticketById.get(Number(search));
        window.currentTickets = t ? [t] : [];
        initBoard();
        return;
    }

    // Token-search via inverted index
    const tokens = tokenize(search);
    if (tokens.length > 0 && window.ticketIndex) {
        let resultIds = null;
        for (const tok of tokens) {
            const s = window.ticketIndex.get(tok);
            if (!s) { resultIds = new Set(); break; }
            if (resultIds === null) resultIds = new Set(s);
            else {
                for (const id of Array.from(resultIds)) {
                    if (!s.has(id)) resultIds.delete(id);
                }
            }
        }

        if (resultIds && resultIds.size > 0) {
            const allTickets = window.allTickets || [];
            window.currentTickets = allTickets.filter(t => resultIds.has(t.ID));
            initBoard();
            return;
        }
    }

    // Fallback to full scan
    const allTickets = window.allTickets || window.currentTickets || [];
    window.currentTickets = allTickets.filter(t => {
        const s = search;
        return t.ID.toString() === s ||
            (t.Title || "").toLowerCase().includes(s) ||
            (t.Description || "").toLowerCase().includes(s) ||
            (t.RequestorName || "").toLowerCase().includes(s) ||
            (t.CreatedFullName || "").toLowerCase().includes(s) ||
            (t.CreatedDate || "").toLowerCase().includes(s) ||
            (t.ModifiedDate || "").toLowerCase().includes(s);
    });
    initBoard();
}

// Handles sorting of board elements
function sortTickets() {    
    // Sort by Data Created
    if (window.currentSortBy === 'created') {
        window.currentTickets = window.currentTickets.sort((a, b) => new Date(b.CreatedDate) - new Date(a.CreatedDate));
    }
    // Sort by Status
    else if (window.currentSortBy === 'status') {
        const statusOrder = ["New", "In Process", "On Hold", "Closed", "Resolved", "Cancelled"];
        window.currentTickets = window.currentTickets.sort((a, b) => statusOrder.indexOf(a.StatusName) - statusOrder.indexOf(b.StatusName));
    }
    // Sort by Date Modified (default)
    else { // window.currentSortBy === 'modified'
        window.currentTickets = window.currentTickets.sort((a, b) => new Date(b.ModifiedDate) - new Date(a.ModifiedDate));
    }

    return window.currentTickets; 
}

// Add/Refreshes tickets to the board
function initBoard() {
    let ticketsHtml = {
        newTickets: "",
        catchAllTickets: "",
        closedTickets: ""
    };
    
    const isMobile = localStorage.getItem("isMobile") === "true";
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
        // Hard-coded blacklist for tickets that we don't want showing up in Tickex
        const TICKETID_BLACKLIST = [
            22873142, 22873186
        ];
        if (TICKETID_BLACKLIST.includes(ticket.ID)) continue;

        let highlightClass = ticket.has_been_viewed ? '' : 'tx_highlight_row';
        let ticketRow = `
            <tr class="tx_ticket ${highlightClass}" id="${ticket.ID}" onclick="showTicketPopup(${JSON.stringify(ticket).replace(/"/g, '&quot;')}, this)">
                <td>${ticket.Title}</td>
                ${isMobile ? "" : `<td>${ticket.ID}</td>`}
                <td>${ticket.StatusName}</td>
            </tr>
        `;

        // If less than 14 days old or status == new
        const isNew = (Date.now() - new Date(ticket.CreatedDate) < 14 * 24 * 60 * 60 * 1000 
                    || ticket.StatusName === 'New') 
                    && ticket.StatusName !== 'Closed'
                    && ticket.StatusName !== 'Cancelled'
                    && ticket.StatusName !== 'Resolved';

        const isClosed = ticket.StatusName === 'Closed' 
                      || ticket.StatusName === 'Cancelled'
                      || ticket.StatusName === 'Resolved';

        // Ensure k-pager rows are displaying corresponding to current page number
        if (isNew) {
            if ((newInputField - 1) * newNumRows <= newCount && newCount < newInputField * newNumRows)
                ticketsHtml.newTickets += ticketRow;

            newCount++;
        }
        if (!isClosed) { // Catch All
            if ((catchAllInputField-1) * catchAllNumRows <= catchAllCount && catchAllCount < catchAllInputField * catchAllNumRows)
                ticketsHtml.catchAllTickets += ticketRow;

            catchAllCount++;
        }
        if (isClosed) {
            let closedRow = `
                <tr class="tx_ticket ${highlightClass}" id="${ticket.ID}" onclick="showTicketPopup(${JSON.stringify(ticket).replace(/"/g, '&quot;')}, this)">
                    <td>${ticket.Title}</td>
                    ${isMobile ? "" : `<td>${ticket.ID}</td>`}
                </tr>
            `;

            if ((closedInputField-1) * closedNumRows <= closedCount && closedCount < closedInputField * closedNumRows)
                ticketsHtml.closedTickets += closedRow;

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



    /* -------------------- Cache Functions -------------------- */

// Grabs the Ticket Cache
function getTicketCache() {
    try {
        return JSON.parse(sessionStorage.getItem('tickex_cache')) || { order: [], data: {} };
    } catch {
        return { order: [], data: {} };
    }
}

// Grabs a Specific Ticket from the Cache
function getCachedTicketData(ticketID, type) {
    const cache = getTicketCache();
    return cache.data[`${ticketID}_${type}`] || null;
}

// Saves a Ticket to the Cache
function setCachedTicketData(ticketID, type, value) {
    // Stores 50 tickets, comments & description for every ticket
    const MAX_CACHED = 100;

    const cache = getTicketCache();
    const key = `${ticketID}_${type}`;
    
    // If already exists, remove from order queue to re-add at end
    if (cache.data[key])
        cache.order = cache.order.filter(k => k !== key);
    
    cache.data[key] = value;
    cache.order.push(key);

    // Evict oldest if exceeds max
    while (cache.order.length > MAX_CACHED) {
        const oldest = cache.order.shift();
        delete cache.data[oldest];
    }

    // Save changes to Cache
    try {
        sessionStorage.setItem('tickex_cache', JSON.stringify(cache));
    } catch (e) {
        console.warn('Failed to save cache:', e);
    }
}

// Removes a ticket from the Cache
function removeFromCache(ticketID) {
    const cache = getTicketCache();
    const keysToRemove = [ `${ticketID}_description`, `${ticketID}_comments` ];

    cache.order = cache.order.filter(k => !keysToRemove.includes(k));
    keysToRemove.forEach(k => delete cache.data[k]);

    // Save changes to Cache
    try {
        sessionStorage.setItem('tickex_cache', JSON.stringify(cache));
    } catch (e) {
        console.warn('Failed to update cache:', e);
    }
}

// Helper: simple tokenizer
function tokenize(text) {
    return (text || "").toString().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}



    /* -------------------- Backend Calls -------------------- */

// Grab all tickets from backend/api
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
async function fetchTicketDescription(ticketID, forceFetch=false) {
    // Check cache first
    const cached = getCachedTicketData(ticketID, 'description');
    if (cached && !forceFetch) return cached;

    try {
        const response = await fetch(`/ticket/description/${ticketID}`);
        if (!response.ok) throw new Error('Network response was not ok');

        // Cache response
        const result = await response.text();
        setCachedTicketData(ticketID, 'description', result);

        return result;
    } catch (error) {
        console.error('Failed to fetch ticket description:', error);
        return "Could not fetch description field.";
    }
}

// Grab ticket Comments (feed) from backend
async function fetchTicketComments(ticketID, forceFetch=false) {
    // Check cache first
    const cached = getCachedTicketData(ticketID, 'comments');
    if (cached && !forceFetch) return cached;

    try {
        const response = await fetch(`/ticket/feed/${ticketID}`);
        if (!response.ok) throw new Error('Network response was not ok');

        // Cache response
        const result = await response.json();
        setCachedTicketData(ticketID, 'comments', result);

        return result;
    } catch (error) {
        console.error('Failed to fetch ticket feed:', error);
        return [];
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

// Fetches whether the current user exists within Database records
async function checkUserExistsInDatabase() {
    try {
        const response = await fetch('/currentUser/existsInDB');
        if (!response.ok) {
            console.error("Failed to fetch current user permissions");
            return 0;
        }

        const data = await response.json();
        return data.response || 0;
    } catch (error) {
        console.error("Error fetching current user permissions:", error);
        return 0;
    }
}

// Fetches the TDX user ID for the current user
async function fetchTDXUserID() {
    try {
        const response = await fetch('/currentUser/fetchTDXUserID');
        if (!response.ok) {
            console.error("Failed to fetch current user permissions");
            return "FAILED_TO_FETCH_TDX_USER_ID";
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching current user permissions:", error);
        return "FAILED_TO_FETCH_TDX_USER_ID";
    }
}

// Update ticket's viewed status in backend/database
async function updateTicketViewed(ticketID, viewed) {
    try {
        const response = await fetch('/update/ticket/viewed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ id: ticketID, viewed: viewed }),
        });

        if (!response.ok) console.error('Failed to update ticket viewed status');
    } catch (error) {
        console.error('Error updating ticket viewed status:', error);
    }
}

// Send a request to TeamDynamix to Create/edit a Ticket
async function updateTicket(body) {
    const isAuthorized = await fetchTDXUserID() != 0 && (await fetchCurrentUserPermissions() > 3 || !await checkUserExistsInDatabase()); 
    if (!isAuthorized) return;
    
    try {
        const response = await fetch('/update/ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(body),
        });

        if (!response.ok) console.error('Failed to Creating/Editing ticket');
    } catch (error) {
        console.error('Error Creating/Editing ticket:', error);
    }
}

// Send a request to TeamDynamix to Post a Comment to a Ticket
async function postComment(body) {
    const isAuthorized = await fetchTDXUserID() != 0 && (await fetchCurrentUserPermissions() > 3 || !await checkUserExistsInDatabase()); 
    if (!isAuthorized) return;

    try {
        const response = await fetch('/update/ticket/postComment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(body),
        });

        if (!response.ok) console.error('Failed to Creating/Editing ticket');
    } catch (error) {
        console.error('Error Creating/Editing ticket:', error);
    }
}

// Send a request to TeamDynamix to mark at Ticket as a True/False Ticket
async function updateFalseStatus(jsonBody) {
    const isAuthorized = await fetchTDXUserID() != 0 && (await fetchCurrentUserPermissions() > 3 || !await checkUserExistsInDatabase()); 
    if (!isAuthorized) return;

    try {
        const response = await fetch('/update/ticket/markFalse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify(jsonBody),
        });

        if (!response.ok) console.error('Failed to Creating/Editing ticket');
    } catch (error) {
        console.error('Error Creating/Editing ticket:', error);
    }
}



    /* -------------------- "Main" Function -------------------- */

// Sets up the Tickex tool page
async function setTickex(openTicketByID = -1) {
    preserveCurrentTool();
    document.title = "Tickex - Bronson";

    // Clear Tickex cache so new HTML and Tickets are always loaded
    sessionStorage.removeItem("Tickex_html");
    
    // Clear stash and remove strobing indicator
    sessionStorage.removeItem("Tickex_stash");

    const isMobile = (localStorage.getItem("isMobile") === "true") ? true : false;

    let current = document.getElementsByClassName("selected");
    if (current.length != 0)
        current[0].classList.remove("selected");

    let newCurrent = document.getElementById("TXButton");
    newCurrent.classList.add("selected");
    newCurrent.classList.remove("stashed"); // Stop the strobing

    history.pushState("test", "Tickex", "/tickex");

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
    tx_container.classList.add("commentsShown");

    // Main Container
    let main_container = document.createElement('div');
    main_container.appendChild(tx_container);
    main_container.classList.add('program_guts');
    
    // Add mobile class if on mobile device
    if (isMobile) tx_container.classList.add('mobile');
    
    progGuts.replaceWith(main_container);



    /* -------------------- Tickex Page -------------------- */

    const isAdmin = await fetchCurrentUserPermissions()  >= 6;
    const isAuthorized = await fetchTDXUserID() != 0 && (await fetchCurrentUserPermissions() > 3 || !await checkUserExistsInDatabase()); 

    // Display loading message while fetching tickets
    let loadingMessage = document.createElement("div");
    loadingMessage.classList.add("tx_loadingMessage");
    if (isMobile) loadingMessage.classList.add("mobile");
    loadingMessage.innerHTML = `
        <legend ${isMobile ? "class='mobile_legend'" : ""}>Loading Tickets</legend>
    `;
    tx_container.append(loadingMessage);

    let ellipsis = "";
    const ellipsisInterval = setInterval(() => {
        ellipsis += ".";
        if (ellipsis.length > 3) ellipsis = "";
        loadingMessage.innerHTML = `
            <legend ${isMobile ? "class='mobile_legend'" : ""}>Loading Tickets${ellipsis}</legend>
        `;
    }, 1000); // Update every 1 second

    let tickets = [];
    while (!tickets.length) { // Keep trying until tickets are fetched
        let response = await fetchTickets();
        tickets = Array.isArray(response) ? response : [];
    }
    window.currentTickets = tickets;
    window.allTickets = tickets;

    // Build fast lookup maps for quicker searches
    window.ticketById = new Map();
    window.ticketIndex = new Map();
    for (const t of window.allTickets || []) {
        window.ticketById.set(t.ID, t);

        const fields = [t.Title, t.Description, t.RequestorName, t.CreatedFullName, t.CreatedDate, t.ModifiedDate, t.StatusName, String(t.ID)];
        const tokenSet = new Set();
        for (const f of fields) {
            for (const tok of tokenize(f)) tokenSet.add(tok);
        }

        for (const tok of tokenSet) {
            if (!window.ticketIndex.has(tok)) window.ticketIndex.set(tok, new Set());
            window.ticketIndex.get(tok).add(t.ID);
        }
    }

    // Clear Loading Screen
    clearInterval(ellipsisInterval);
    loadingMessage.remove();


    // Add Ticket Button
    let addTicketButton = document.createElement("div");
    addTicketButton.classList.add("tx_addTicketButton");
    addTicketButton.innerHTML = `
        <button onclick="event.stopPropagation(); newTicketPopup()">+</button>
    `;
    if (isAuthorized) tx_container.append(addTicketButton);

    // New Ticket Popup Container
    let newTicketPopupContainer = document.createElement("div");
    newTicketPopupContainer.classList.add("tx_newTicketPopupContainer");
    tx_container.append(newTicketPopupContainer);

    // Edit Ticket Popup Container
    let editTicketPopupContainer = document.createElement("div");
    editTicketPopupContainer.classList.add("tx_editTicketPopupContainer");
    tx_container.append(editTicketPopupContainer);


    // Sort By Box - by date and status
    let sortByBox = document.createElement("div");
    sortByBox.classList.add("tx_sortByBox");
    if (isMobile) sortByBox.classList.add("mobile");
    sortByBox.id = "sortByBox";
    sortByBox.innerHTML = `
        <legend ${isMobile ? "class='mobile_legend'" : ""}>Sort By</legend>
        <div>
            <input class="tx_radio" type="radio" name="tx_dev" id="modified" checked>
            <label for="modified">Date Modified</label>
        </div>
        <div>
            <input class="tx_radio" type="radio" name="tx_dev" id="created">
            <label for="created">Date Created</label>
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
    if (isMobile) searchBar.classList.add("mobile");
    searchBar.innerHTML = `
        <legend ${isMobile ? "class='mobile_legend'" : ""}>Search</legend>
        <textarea id="searchBar" placeholder="${isMobile ? "Search..." : "Search: Title, ID, Description, Room, Date, etc... (Press Enter)"}"></textarea>
        <ul>
    `;
    tx_container.append(searchBar);

    if (!isMobile) {
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
        
        // Dismiss Notifications Button (Admin only)
        let dismissAllButton = document.createElement("div");
        dismissAllButton.classList.add("tx_dismissAllButton");
        if (isAdmin) {
            dismissAllButton.innerHTML = `
                <button id="tx_dismissAllButton" onclick="dismissAllPopup()">Dismiss All</button>
            `;
            tx_container.append(dismissAllButton);
        }

        // Dismiss All Confirmation Popup (Admin only)
        let dismissAllPopupContainer = document.createElement("div");
        dismissAllPopupContainer.classList.add("tx_dismissAllPopupContainer");
        tx_container.append(dismissAllPopupContainer);
    }

    // The 3 Tickex boards - New, Catch All, Closed
    let newTickets = document.createElement("div");
    newTickets.classList.add("tx_newTickets");
    if (isMobile) newTickets.classList.add("mobile");
    newTickets.id = 'newTicketsBoard';
    newTickets.innerHTML = `
        <fieldset><legend ${isMobile ? "class='mobile_legend'" : ""}>New CTS Tickets</legend>
            <div class="tx_ticketContainer" id="new">
                <table ${isMobile ? "class='mobile_font'" : ""}>
                    <thead><tr>
                        <th>Title</th>
                        ${isMobile ? "" : "<th>ID</th>"}
                        <th>Status</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
                <div class="k_pager" id="newPager">
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="new_minus10" onclick="kPagerButton(-10, 'newTicket_input', 'newMaxPage')">-10</button>
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="new_minus1" onclick="kPagerButton(-1, 'newTicket_input', 'newMaxPage')"><</button>
                    <input type="number" class="k_input_inner ${isMobile ? "mobile_font" : ""}" id="newTicket_input" autocomplete="off" value="1"></input>
                    <span ${isMobile ? "class='mobile_font'" : ""}>of </span>
                    <span ${isMobile ? "class='mobile_font'" : ""} id="newMaxPage">1</span>
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="new_plus1" onclick="kPagerButton(1, 'newTicket_input', 'newMaxPage')">></button>
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="new_plus10" onclick="kPagerButton(10, 'newTicket_input', 'newMaxPage')">+10</button>
                    <div><span ${isMobile ? "class='mobile_font'" : ""}>Max Items per Page: </span>
                    <select class="k_pager_button ${isMobile ? "mobile_font" : ""}" id="newTicket_dropdown">
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="15" selected>15</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        ${!isMobile ? `
                            <option value="40">40</option>
                            <option value="50">50</option>
                            <option value="75">75</option>
                            <option value="100">100</option>` : ""
                        }
                    </select></div>
                </div>
            </div></fieldset>
    `;

    let catchAll = document.createElement("div");
    catchAll.classList.add("tx_catchAllTickets");
    if (isMobile) catchAll.classList.add("mobile");
    catchAll.id = 'catchAllTicketsBoard';
    catchAll.innerHTML = `
        <fieldset><legend ${isMobile ? "class='mobile_legend'" : ""}>CTS Ticket Catch All</legend>
            <div class="tx_ticketContainer" id="catchAll">
                <table ${isMobile ? "class='mobile_font'" : ""}>
                    <thead><tr>
                        <th>Title</th>
                        ${isMobile ? "" : "<th>ID</th>"}
                        <th>Status</th>
                    </tr></thead>
                    <tbody></tbody>
                </table>
                <div class="k_pager" id="catchAllPager">
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="catchAll_minus10" onclick="kPagerButton(-10, 'catchAllTicket_input', 'catchAllMaxPage')">-10</button>
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="catchAll_minus1" onclick="kPagerButton(-1, 'catchAllTicket_input', 'catchAllMaxPage')"><</button>
                    <input type="number" class="k_input_inner ${isMobile ? "mobile_font" : ""}" id="catchAllTicket_input" autocomplete="off" value="1"></input>
                    <span ${isMobile ? "class='mobile_font'" : ""}>of </span>
                    <span ${isMobile ? "class='mobile_font'" : ""} id="catchAllMaxPage">1</span>
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="catchAll_plus1" onclick="kPagerButton(1, 'catchAllTicket_input', 'catchAllMaxPage')">></button>
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="catchAll_plus10" onclick="kPagerButton(10, 'catchAllTicket_input', 'catchAllMaxPage')">+10</button>
                    <div><span ${isMobile ? "class='mobile_font'" : ""}>Max Items per Page: </span>
                    <select class="k_pager_button ${isMobile ? "mobile_font" : ""}" id="catchAllTicket_dropdown">
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="15" selected>15</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        ${!isMobile ? `
                            <option value="40">40</option>
                            <option value="50">50</option>
                            <option value="75">75</option>
                            <option value="100">100</option>` : ""
                        }
                    </select></div>
                </div>
            </div></fieldset>
    `;

    let closedTickets = document.createElement("div");
    closedTickets.classList.add("tx_closedTickets");
    if (isMobile) closedTickets.classList.add("mobile");
    closedTickets.id = "closedTicketsBoard";
    closedTickets.innerHTML = `
        <fieldset><legend ${isMobile ? "class='mobile_legend'" : ""}>Closed CTS Tickets</legend>
            <div class="tx_ticketContainer" id="closed">
                <table ${isMobile ? "class='mobile_font'" : ""}>
                    <thead><tr>
                        <th>Title</th>
                        ${isMobile ? "" : "<th>ID</th>"}
                    </tr></thead>
                    <tbody></tbody>
                </table>
                <div class="k_pagerClosed" id="closedPager">
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="closed_minus10" onclick="kPagerButton(-10, 'closedTicket_input', 'closedMaxPage')">-10</button>
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="closed_minus1" onclick="kPagerButton(-1, 'closedTicket_input', 'closedMaxPage')"><</button>
                    <input type="number" class="k_input_inner ${isMobile ? "mobile_font" : ""}" id="closedTicket_input" autocomplete="off" value="1"></input>
                    <span ${isMobile ? "class='mobile_font'" : ""}>of </span>
                    <span ${isMobile ? "class='mobile_font'" : ""} id="closedMaxPage">1</span>
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="closed_plus1" onclick="kPagerButton(1, 'closedTicket_input', 'closedMaxPage')">></button>
                    <button class="k_pager_button ${isMobile ? "mobile_button" : ""}" id="closed_plus10" onclick="kPagerButton(10, 'closedTicket_input', 'closedMaxPage')">+10</button>
                    <div><span ${isMobile ? "class='mobile_font'" : ""}>Max Items per Page: </span>
                    <select class="k_pager_button ${isMobile ? "mobile_font" : ""}" id="closedTicket_dropdown">
                        <option value="5">5</option>
                        <option value="10" selected>10</option>
                        <option value="15">15</option>
                        <option value="20">20</option>
                        <option value="30">30</option>
                        ${!isMobile ? `
                            <option value="40">40</option>
                            <option value="50">50</option>
                            <option value="75">75</option>
                            <option value="100">100</option>` : ""
                        }
                    </select></div>
                </div>
            </div></fieldset>
    `;

    // Popup Container - click on ticket for popup to appear
    let ticketPopupContainer = document.createElement("div");
    ticketPopupContainer.classList.add("tx_ticketPopupContainer");
    tx_container.append(ticketPopupContainer);
    

    // Initialize board on loadup
    window.currentTickets = sortTickets();

    tx_container.append(newTickets);
    tx_container.append(catchAll);
    tx_container.append(closedTickets);

    initBoard();
    initializeListeners();


    // Auto-refresh board logic
    if (localStorage.getItem("isTXTicketIntervalSet") != "true") {
        localStorage.setItem("isTXTicketIntervalSet", true)
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
                            removeFromCache(ticket.ID); // Clear cache for this ticket so new description/comments will be fetched

                            // Update local copy immediately
                            const index = newTickets.findIndex(t => t.ID === ticket.ID);
                            if (index !== -1) newTickets[index].has_been_viewed = false;
                        });

                        // Check if user is currently on Tickex page
                        const txButton = document.getElementById("TXButton");
                        if (!(txButton && txButton.classList.contains("selected"))) 
                            stashTickexResponse(actuallyNew); // User is NOT on Tickex, stash the response and strobe the tab

                    }

                    // Prevent Search Task Disruption
                    const searchBar = document.getElementById('searchBar'); 
                    if (searchBar && searchBar.value.trim() === '') {
                        window.allTickets = newTickets;
                        window.currentTickets = newTickets;
                        initBoard(window.currentSortBy || 'modified');
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
        }, 60000); // Refresh every 60 seconds
    }

    // Instantly opens up the provided ticket upon page loadup
    const t = window.ticketById?.get(openTicketByID);
    if (openTicketByID != -1 && t) { // -1: default for no popup on loadup
        showTicketPopup(t); 
    }

    await Promise.resolve();
    return;
}
