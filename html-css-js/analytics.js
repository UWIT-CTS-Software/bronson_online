/*
                       _       _   _            _     
     /\               | |     | | (_)          (_)    
    /  \   _ __   __ _| |_   _| |_ _  ___ ___   _ ___ 
   / /\ \ | '_ \ / _` | | | | | __| |/ __/ __| | / __|
  / ____ \| | | | (_| | | |_| | |_| | (__\__ \_| \__ \
 /_/    \_\_| |_|\__,_|_|\__, |\__|_|\___|___(_) |___/
                          __/ |               _/ |    
                         |___/               |__/     

Summary:
    A tool that summarizes many CTS departmental insights about tickets, 
    room checks, and more, all in one place. Capable of individual analytics
    tracking and department-wide trends. Exporting reports to PDF is also a 
    supported feature

    Notes:
      - This tool is supposed to reflect the 
          .../src/analytics/department_analytics.py 
        python script, so any features there should be here
        
TOC:
    Helpers
    - validateDateRange()
    - getCustomDateRange()
    - getClosestRoomCheckFrame()
    - getCustomRoomCheckFrame()
    - getRoomCheckNoteText()
    - setRoomCheckNotes()

    Exporting
    - exportButton()
    - getTimePeriodRadioHTML()
    - showExport()
    - showSettings()
    - addNote()
    - removeNote()

    Board Setup
    - initializeRadioListener()
    - populateHiddenProjectList()
    - setHideProject()
    - buildGraphs()
    - updateGraphs()
    - setIndividualsBoard()
    - setDepartmentBoard()
    - setProjectsBoard()
    - setBoard()

    Backend Calls
    - fetchCurrentUserPermissions()
    - fetchProjects()
    - updateProjectIsHidden()
    - fetchTickets()
    - fetchTicketsByTimePeriod()
    - fetchIndividualAnalytics()
    - fetchDepartmentAnalytics()

    "Main" Function:
    - setAnalytics()                

*/




    /* -------------------- Helpers -------------------- */

// Validates if the two date ranges in the time period selector are valid
function validateDateRange() {
    const startDateInput = document.getElementById("an_custom-start-date");
    const endDateInput = document.getElementById("an_custom-end-date");

    const startValue = startDateInput.value;
    const endValue = endDateInput.value;

    // Wait until both fields are populated
    if (!startValue || !endValue) return;

    const startDate = new Date(startValue);
    const endDate = new Date(endValue);
    if (startDate > endDate) {
        alert("Start date must be before end date.");

        // Clear both fields
        startDateInput.value = "";
        endDateInput.value = "";
        cacheCustomDates();
        setBoard();
        return;
    }

    cacheCustomDates();
    setBoard();
}

// Grabs the custom date range from the time period selector, if valid
function getCustomDateRange() {
    const startDateInput = document.getElementById("an_custom-start-date");
    const endDateInput = document.getElementById("an_custom-end-date");
    
    const startValue = startDateInput?.value;
    const endValue = endDateInput?.value;

    if (!startValue || !endValue) return null;

    const startDate = new Date(startValue);
    const endDate = new Date(endValue);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) return null;

    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
}

// Returns the closest room check frame (7, 30, 90, 365) to the given number of days
function getClosestRoomCheckFrame(days) {
    const frames = [7, 30, 90, 365];
    let closest = frames[0];
    for (const frame of frames) {
        if (Math.abs(frame - days) < Math.abs(closest - days)) {
            closest = frame;
        }
    }
    return closest;
}

// Calculates the closest room check frame for the custom date range
function getCustomRoomCheckFrame() {
    const range = getCustomDateRange();
    if (!range) return 365;

    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.max(1, Math.round((range.endDate.getTime() - range.startDate.getTime()) / msPerDay) + 1);
    return getClosestRoomCheckFrame(diffDays);
}

// Helps with on-screen text formatting
function getRoomCheckNoteText(timePeriod, frame) {
    return `Last ${frame} Days`;
}

// Sets the room check notes for both individual and department boards
function setRoomCheckNotes(noteText) {
    ["ind_roomcheck_note", "dep_roomcheck_note"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = noteText;
    });
}



    /* -------------------- Exporting -------------------- */

// Button that Triggers export and Downloads the PDF file from backend
async function exportButton() {
    // Gather Data to send to Backend
    const timePeriod = parseInt(sessionStorage.getItem("an_timePeriod"), 10);
    const optionalData = {};
    const sectionIds = ["an_accomplishments", "an_notesForFuture", "an_ticketAndRoomCheckNotes"];
    const textAreaDivs = document.querySelectorAll(".an_textAreaDiv");
    textAreaDivs.forEach((div, index) => {
        const sectionId = sectionIds[index];
        const notes = Array.from(div.getElementsByTagName("textarea")).map(textarea => textarea.value.trim()).filter(note => note.length > 0);
        optionalData[sectionId] = notes;
    });

    // Handle custom date range
    if (timePeriod === 5) {
        const customRange = getCustomDateRange();
        if (!customRange) {
            alert("Please enter valid custom dates before exporting.");
            return;
        }
        optionalData.custom_start_date = customRange.startDate.toISOString().split('T')[0];
        optionalData.custom_end_date = customRange.endDate.toISOString().split('T')[0];
    }

    // TODO: Disable "Export to PDF" button while action in progress

    const pdfBlob = await fetchExportedPDF(timePeriod, optionalData);
    if (!pdfBlob) return; // TODO: Alert then Re-enable button

    let reportPeriod = "ERROR";
    if (timePeriod === 0) reportPeriod = "Week";
    if (timePeriod === 1) reportPeriod = "Month";
    if (timePeriod === 2) reportPeriod = "3-Months";
    if (timePeriod === 3) reportPeriod = "Year";
    if (timePeriod === 4) reportPeriod = "All-Time";
    if (timePeriod === 5) reportPeriod = "Custom-Date-Range";

    // Download the PDF file with a timestamped filename
    const filename = `CTS-${reportPeriod}-Report_${new Date().toISOString().split('T')[0]}.pdf`;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    // TODO: Re-enable button

    showSettings();
}

// Generates the HTML for the time period radio buttons
function getTimePeriodRadioHTML(timePeriod) {
    const selectedPeriod = parseInt(timePeriod, 10);
    const startDate = sessionStorage.getItem("an_custom_start");
    const endDate = sessionStorage.getItem("an_custom_end");

    return `
        <div class="an_timePeriodSelector">
            <strong>Selected Time Period:</strong>
            <div class="an_radioOption">
                <input type="radio" id="week" name="time-period" value="week" ${selectedPeriod === 0 ? "checked" : ""}></input>
                <label for="week">Past Week</label>
            </div>
            <div class="an_radioOption">
                <input type="radio" id="month" name="time-period" value="month" ${selectedPeriod === 1 ? "checked" : ""}>
                <label for="month">Past Month</label>
            </div>
            <div class="an_radioOption">
                <input type="radio" id="month-3" name="time-period" value="month-3" ${selectedPeriod === 2 ? "checked" : ""}>
                <label for="month-3">Past 3 Months</label>
            </div>
            <div class="an_radioOption">
                <input type="radio" id="year" name="time-period" value="year" ${selectedPeriod === 3 ? "checked" : ""}>
                <label for="year">Past Year</label>
            </div>
            <div class="an_radioOption">
                <input type="radio" id="all-time" name="time-period" value="all-time" ${selectedPeriod === 4 ? "checked" : ""}>
                <label for="all-time">*All Time - Jan 1, 2020</label>
            </div>
            <div class="an_radioOption">
                <input type="radio" id="custom" name="time-period" value="custom" ${selectedPeriod === 5 ? "checked" : ""}>
                <label for="custom">*Custom Date Range</label>
                <label for="custom">: </label>
                <input type="date" id="an_custom-start-date" ${startDate !== "" ? `value=${startDate}` : ""}>
                <label for="custom"> → </label>
                <input type="date" id="an_custom-end-date" ${endDate !== "" ? `value=${endDate}` : ""}>
            </div>
        </div>
    `;
}

// Extract selected dates input from user (which can be blank) and cache them
function cacheCustomDates() {
    const startDate = document.getElementById("an_custom-start-date").value;
    const endDate = document.getElementById("an_custom-end-date").value;

    if (startDate !== null) sessionStorage.setItem("an_custom_start", startDate);
    if (endDate !== null) sessionStorage.setItem("an_custom_end", endDate);

    // Force custom date radio button to be selected, because it was just modified
    const customRadioButton = document.getElementById("custom");
    customRadioButton.checked = true;
    customRadioButton.dispatchEvent(new Event("change", { bubbles: true }));
}

// Displays the export settings in the settings widget
function showExport() {
    const timePeriod = sessionStorage.getItem("an_timePeriod");
    const exportSettings = document.getElementsByClassName('an_settings')[0];
    if (exportSettings) exportSettings.innerHTML = `
        <fieldset class="an_settingsFieldset">
            <legend>Export Settings</legend>

            ${getTimePeriodRadioHTML(timePeriod)}

            <br>
            <strong>Optional:</strong>
            <div id="an_accomplishments">
                <p>Add any accomplishments for the selected time period:</p>
                <div class="an_textAreaDiv"></div>
                <div class="an_noteButtons">
                    <button class="an_addNoteButton" onclick="event.stopPropagation(); addNote('an_accomplishments')">+ Add a Note</button>
                </div>
            </div>
            <div id="an_notesForFuture">
                <p>Add any notes for the future:</p>
                <div class="an_textAreaDiv"></div>
                <div class="an_noteButtons">
                    <button class="an_addNoteButton" onclick="event.stopPropagation(); addNote('an_notesForFuture')">+ Add a Note</button>
                </div>
            </div>
            <div id="an_ticketAndRoomCheckNotes">
                <p>Add any notes for tickets and room checks:</p>
                <div class="an_textAreaDiv"></div>
                <div class="an_noteButtons">
                    <button class="an_addNoteButton" onclick="event.stopPropagation(); addNote('an_ticketAndRoomCheckNotes')">+ Add a Note</button>
                </div>
            </div>
            <br>
            <div class="an_exportButtons">
                <button id="an_exportToPDFButton" onclick="exportButton()">Export to PDF</button>
                <button onclick="showSettings()">Cancel</button>
            </div>
            <p style="float: right; font-size: 10pt; margin-top: 6px;">*Larger reports take longer to generate</p>
        </fieldset>
    `;

    initializeRadioListener();
}

// Displays the standard settings for the page
function showSettings() {
    const timePeriod = sessionStorage.getItem("an_timePeriod");
    const exportSettings = document.getElementsByClassName('an_settings')[0];
    if (exportSettings) exportSettings.innerHTML = `
        <fieldset class="an_settingsFieldset">
            <legend>Settings</legend>

            ${getTimePeriodRadioHTML(timePeriod)}

            <button class="an_startExportButton" onclick="showExport()">Export</button>
        </fieldset>
    `;

    initializeRadioListener();
}

// Adds a new note text area to the specified section (export settings)
function addNote(section) {
    const sectionDiv = document.getElementById(section);
    const textAreaDiv = sectionDiv.getElementsByClassName("an_textAreaDiv")[0];
    const buttonsDiv = sectionDiv.getElementsByClassName("an_noteButtons")[0];

    // If there less than or equal to 5 text areas, don't add another one
    const textAreas = sectionDiv.getElementsByTagName("textarea");
    if (textAreas.length >= 4) 
        buttonsDiv.removeChild(buttonsDiv.getElementsByClassName("an_addNoteButton")[0]);

    if (!buttonsDiv.getElementsByClassName("an_removeNoteButton")[0]) {
        const removeButton = document.createElement("button");
        removeButton.classList.add("an_removeNoteButton");
        removeButton.onclick = function(event) {
            event.stopPropagation();
            removeNote(section);
        };
        removeButton.textContent = "- Remove Note";
        buttonsDiv.appendChild(removeButton);
    }


    const newNote = document.createElement("textarea");
    newNote.classList.add("an_note");
    newNote.placeholder = "Enter your note here... (Max 80 Characters)";
    newNote.maxLength = 80;
    newNote.id = `${section}_note${textAreas.length + 1}`;
    textAreaDiv.appendChild(newNote);
}

// Removes the last note text area from the specified section (export settings)
function removeNote(section) {
    const sectionDiv = document.getElementById(section);
    const buttonsDiv = sectionDiv.getElementsByClassName("an_noteButtons")[0];

    const textAreas = sectionDiv.getElementsByTagName("textarea");
    if (textAreas.length > 0) {
        const lastTextArea = textAreas[textAreas.length - 1];
        lastTextArea.parentNode.removeChild(lastTextArea);
    }
    if (textAreas.length == 0) 
        buttonsDiv.removeChild(buttonsDiv.getElementsByClassName("an_removeNoteButton")[0]);


    if (!buttonsDiv.getElementsByClassName("an_addNoteButton")[0]) {
        const addButton = document.createElement("button");
        addButton.classList.add("an_addNoteButton");
        addButton.onclick = function(event) {
            event.stopPropagation();
            addNote(section);
        };
        addButton.textContent = "+ Add a Note";
        buttonsDiv.prepend(addButton);
    }
}



    /* -------------------- Board Setup -------------------- */

// Initializes the radio button listener
function initializeRadioListener() {
    // Listens to radio buttons, for time period selection
    document.querySelector(".an_timePeriodSelector").addEventListener("change", (e) => {
        if (!e.target.matches('input[type="radio"]')) return;

        const periodMap = {
            "week": 0, "month": 1, "month-3": 2, "year": 3, "all-time": 4, "custom": 5
        };

        sessionStorage.setItem("an_timePeriod", periodMap[e.target.id]);
        setBoard();
    });

    // Date Field Listeners
    document.getElementById("an_custom-start-date").addEventListener("change", validateDateRange);
    document.getElementById("an_custom-end-date").addEventListener("change", validateDateRange);
}

// Admin only: Populates the hidden project list for admins to manage
async function populateHiddenProjectList(hiddenProjects) {
    const isAdmin = await fetchCurrentUserPermissions() >= 6;
    if (!isAdmin) return "";

    const hiddenList = (hiddenProjects || []).map((project) => `
        <div class="an_hiddenRoomItem">
            <button onclick="setHideProject(${project.ID}, false)">Unhide from Techs</button>
            <a href="https://uwyo.teamdynamix.com/TDWorkManagement/WorkManagement/Home/DynamicApp/${project.ID}?type=TDProject" target="_blank" rel="noopener noreferrer">
                <button>Link to TDX</button>
            </a>
            <p>${project.Name || `Project ${project.ID}`}</p>
        </div>
    `).join("");

    return `
        <div id="an_hiddenRoomsList">
            <strong>Hidden Room Manager (Admin Only):</strong>
            ${hiddenList || "<p>No hidden rooms.</p>"}
        </div>
        <hr>
    `;
}

// Admin only: Sets the hidden status of a project
async function setHideProject(projectId, isHidden) {
    const timePeriod = parseInt(sessionStorage.getItem("an_timePeriod"), 10);
    await updateProjectIsHidden(projectId, isHidden);
    await setProjectsBoard();
}

// Only called once, builds the graphs with placeholder data
async function buildGraphs() {
    const donutGraphColor = ["rgb(236, 200, 101)", "rgb(195, 161, 68)"];
    const barGraphColor = ["rgb(236, 200, 101)"]

    // Individual Room Check Donut Chart
    const indRoomCheckDonutX = ["You", "CTS"];
    const indRoomCheckDonutY = new Array(2).fill(-1);
    new Chart("indRoomCheckDonut", {
        type: "doughnut",
        data: {
            labels: indRoomCheckDonutX,
            datasets: [{
                backgroundColor: donutGraphColor,
                data: indRoomCheckDonutY
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Your Room Checks vs Department"
                }
            }
        }
    });

    // Individual Room Check Donut Chart
    const indTicketsDonutX = ["You", "CTS"];
    const indTicketsDonutY = new Array(2).fill(-1);
    new Chart("indTicketsDonut", {
        type: "doughnut",
        data: {
            labels: indTicketsDonutX,
            datasets: [{
                backgroundColor: donutGraphColor,
                data: indTicketsDonutY
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Your Tickets Closed vs Department"
                }
            }
        }
    });

    // Ticket Count by Building Bar Graph
    const buildingCountGraphX = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
    const buildingCountGraphY = new Array(10).fill(-1);
    new Chart("buildingCountGraph", {
        type: "bar",
        data: {
            labels: buildingCountGraphX,
            datasets: [{
                backgroundColor: barGraphColor,
                data: buildingCountGraphY
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Ticket Count by Building (Top 10)"
                },
                legend: {
                    display: false
                }
            }
        }
    });


    // Total Tickets per Hour Bar Graph
    const ticketsPerHourGraphX = ["7am", "8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "Other"];
    const ticketsPerHourGraphY = new Array(14).fill(-1);
    new Chart("ticketsPerHourGraph", {
        type: "bar",
        data: {
            labels: ticketsPerHourGraphX,
            datasets: [{
                backgroundColor: barGraphColor,
                data: ticketsPerHourGraphY
            }]
        },
        options: {
            plugins: {
                title: {
                    display: true,
                    text: "Total Tickets per Hour"
                },
                legend: {
                    display: false
                }
            }
        }
    });
}

// Updates the graphs with actual data based on the selected time period
async function updateGraphs(timePeriod) {
    // Get analytics data
    const depAnalytics = fetchDepartmentAnalytics(timePeriod);
    
    // Room Check Donut
    const leaderboard = JSON.parse(localStorage.getItem("leaderboard"));
    const indRoomCheckDonut = Chart.getChart("indRoomCheckDonut");
    const overallKeys = ["Last 7 Days", "Last 30 Days", "Last 90 Days", 
                         "Last 365 Days", "Last 365 Days", getRoomCheckNoteText(timePeriod, depAnalytics.roomcheckTimeFrame)];
    const depRoomCheckOverall = depAnalytics.roomcheckOverall[overallKeys[timePeriod]];
    indRoomCheckDonut.data.datasets[0].data = [-2, depRoomCheckOverall]; // TODO: Make sure to subtract individual's numbers from department's numbers
    indRoomCheckDonut.update();

    const indTicketsDonut = Chart.getChart("indTicketsDonut");
    indTicketsDonut.data.datasets[0].data = [-2, depAnalytics.totalClosed]; // TODO: Make sure to subtract individual's numbers from department's numbers
    indTicketsDonut.update();

    const buildingCountGraph = Chart.getChart("buildingCountGraph");
    const buildingCounts = depAnalytics.byBuilding || {};
    const entries = Object.entries(buildingCounts).sort((a,b) => b[1] - a[1]);
    const top = entries.slice(0,10);
    const labels = top.map(e => e[0]);
    const data = top.map(e => e[1]);
    if (labels.length > 0) {
        buildingCountGraph.data.labels = labels;
        buildingCountGraph.data.datasets[0].data = data;
    } else if (timePeriod === 5) {
        buildingCountGraph.data.labels = [];
        buildingCountGraph.data.datasets[0].data = [];
    }
    buildingCountGraph.update();

    // Total Tickets per Hour - now using actual ticket data
    const ticketsPerHourGraph = Chart.getChart("ticketsPerHourGraph");
    ticketsPerHourGraph.data.datasets[0].data = depAnalytics.byHour;
    ticketsPerHourGraph.update();
}

// Updates all individual board based on current time period selection and current user's data
async function setIndividualsBoard(timePeriod) {
    // Individual Room Checks Data
    const roomCheckTimePeriod = document.getElementById("ind_roomcheck_timeperiod");
    roomCheckTimePeriod.textContent = -2;

    const roomCheckAllTime = document.getElementById("ind_roomcheck_alltime");
    roomCheckAllTime.textContent = -2;

    // Individual Ticket Data
    const ticketsCreated = document.getElementById("ind_tickets_created");
    ticketsCreated.textContent = -2;

    const ticketsResponded = document.getElementById("ind_tickets_responded");
    ticketsResponded.textContent = -2;

    const ticketsClosed = document.getElementById("ind_tickets_closed");
    ticketsClosed.textContent = -2;
}

// Updates all department board based on current time period selection
async function setDepartmentBoard(timePeriod) {
    const depAnalytics = fetchDepartmentAnalytics(timePeriod);

    const roomcheckLeadersDiv = document.getElementById('dep_roomcheck_leaders').children;
    for (let i = 1; i < roomcheckLeadersDiv.length; i++) { // start at i=1 to skip <strong> element
        const leader = depAnalytics.roomcheckLeaders[i-1];
        roomcheckLeadersDiv[i].textContent = `${leader.Name}: ${leader.Count}`;
    }

    const roomcheckOverallDiv = document.getElementById('dep_roomcheck_overall').children;
    const overallKeys = ["Last 7 Days", "Last 30 Days", "Last 90 Days", "Last 365 Days"];
    for (let i = 1; i < roomcheckOverallDiv.length; i++) {
        const linePrefix = overallKeys[i-1];
        roomcheckOverallDiv[i].textContent = linePrefix + ": " + (depAnalytics.roomcheckOverall[linePrefix] || 0);
    }

    const ticketsCreated = document.getElementById("dep_tickets_created");
    ticketsCreated.textContent = depAnalytics.total;

    const ticketsClosed = document.getElementById("dep_tickets_closed");
    ticketsClosed.textContent = depAnalytics.totalClosed;

    const ticketsOpen = document.getElementById("dep_tickets_open");
    ticketsOpen.textContent = depAnalytics.totalOpen;

    
    const ticketsRoomcheck = document.getElementById("dep_tickets_roomcheck");
    ticketsRoomcheck.textContent = depAnalytics.ticketsRoomcheck || 0;

    const ticketsPC = document.getElementById("dep_tickets_pc");
    ticketsPC.textContent = depAnalytics.ticketsPC || 0;

    const roomcheckNoteText = getRoomCheckNoteText(timePeriod, depAnalytics.roomcheckTimeFrame || 365);
    setRoomCheckNotes(roomcheckNoteText);

    const ticketsFalse = document.getElementById("dep_tickets_false");
    ticketsFalse.textContent = depAnalytics.ticketsFalse || 0;

    const ticketsEventSupport = document.getElementById("dep_tickets_eventsupport");
    ticketsEventSupport.textContent = depAnalytics.ticketsEventSupport || 0;
}

async function fetchProjects() {
    try {
        const response = await fetch('/projects');
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        return [];
    }
}

// Updates the current active projects
async function setProjectsBoard() {
    const projects = await fetchProjects();
    const projectsFieldset = document.querySelector('.an_projectsFieldset');
    if (!projectsFieldset) return;

    // Filter projects by TypeID == 42460
    const filteredProjects = Array.isArray(projects) ? projects : [];
    const typeIdToFilter = 42460; // The CTS Projects Management Board ID
    const matchingProjects = [];
    const hiddenProjects = [];
    
    for (let i = 0; i < filteredProjects.length; i++) {
        const project = filteredProjects[i];
        if (!project) continue;
 
        const now = new Date();
        const startDate = new Date(project.StartDate);
        const isHidden = project.is_hidden === true;
        if (project.TypeID === typeIdToFilter && startDate < now 
            && project.IsActive && project.PercentComplete != 100) {
            if (isHidden) {
                hiddenProjects.push(project);
            } else {
                matchingProjects.push(project);
            }
        }
    }

    // Sort matchingProjects according to custom criteria
    matchingProjects.sort((a, b) => {
        function getGroup(project) {
            if (project.PercentComplete === 0) return 2;
            if (project.Status === "On Hold") return 1;
            return 0;
        }

        const groupA = getGroup(a);
        const groupB = getGroup(b);

        if (groupA !== groupB) return groupA - groupB;

        // Group 0: Sort by EndDate (earliest deadline first)
        if (groupA === 0) return new Date(a.EndDate) - new Date(b.EndDate);

        // Group 1: Sort by PercentComplete (highest first)
        if (groupA === 1) return b.PercentComplete - a.PercentComplete;

        // Group 2: Sort by EndDate (earliest deadline first)
        return new Date(a.EndDate) - new Date(b.EndDate);
    });

    localStorage.setItem("matchingProjects", JSON.stringify(matchingProjects));

    // Clear the fieldset content except for the legend
    const legend = projectsFieldset.querySelector('legend');
    projectsFieldset.innerHTML = '';
    if (legend) {
        projectsFieldset.appendChild(legend);
    } else {
        const fallbackLegend = document.createElement('legend');
        fallbackLegend.textContent = 'Projects';
        projectsFieldset.appendChild(fallbackLegend);
    }

    const isAdmin = await fetchCurrentUserPermissions() >= 6;
    if (isAdmin) 
        projectsFieldset.insertAdjacentHTML('beforeend', await populateHiddenProjectList(hiddenProjects));

    // If no matching projects, show message
    if (matchingProjects.length === 0) {
        projectsFieldset.innerHTML += '<p>No active projects.</p>';
        return;
    }

    const projectsWrapper = document.createElement('div');
    projectsWrapper.id = "projectsWrapper";
    projectsFieldset.appendChild(projectsWrapper);

    window.currentPage = 1; 
    await renderProjects();
    // projectsFieldset.appendChild(projectsWrapper);

    const k_pagerHTML = `
        <div id="an_projectsPager" class="an_k-pager">
                <button onClick="prevPage()" id="prevBtn"  ><</button>
                 <button onClick= 'nextPage()' id="nextBtn">></button>
                    <p id="currentPage">${window.currentPage}</p>
                
        </div>
        `;
    projectsFieldset.innerHTML += k_pagerHTML;
}
async function renderProjects() {
    const isAdmin = await fetchCurrentUserPermissions() >= 6;

    let matchingProjects = localStorage.getItem("matchingProjects");
    matchingProjects = JSON.parse(matchingProjects);

    const getPage = (data, page, size) => data.slice((page-1)* size, page * size);
    const currentProjects = getPage(matchingProjects, currentPage, 5);


    // Dynamically create HTML for all matching projects
    // for (let i = indexStart; i < indexEnd; i++) {

    const projectHTML = document.createElement('div');
    currentProjects.forEach((project, index) => {
        // const project = matchingProjects[i];

        const completionDate = new Date(project.EndDate).toLocaleDateString();

        const adminButtons = isAdmin ? `
            <button class='an_adminProjectButtons' onclick="setHideProject(${project.ID}, true)">Hide from Techs</button>
        ` : "";

        projectHTML.innerHTML += `
            <strong>${project.Name}:</strong>
            <label for="an_project_${project.ID}">${project.PercentComplete}%</label>
            <strong class="an_projectStatus">${project.StatusName}</strong>
            <progress id="an_project_${project.ID}" value="${project.PercentComplete}" max="100"></progress>
            <p class="an_projectEndDate">Projected Completion: ${completionDate}</p>
            <ul>
                <li>Item 1</li>
                <li>Item 2</li>
                <li>Item 3</li>
            </ul>
            <div class="an_projectButtons">
                <a href="https://uwyo.teamdynamix.com/TDWorkManagement/WorkManagement/Home/DynamicApp/${project.ID}?type=TDProject" target="_blank" rel="noopener noreferrer">
                    <button class="popup_linkToTicket">Link to TDX</button>
                </a>
                ${adminButtons}
            </div>
            <hr style="margin: 3px 0;">
        `;

        if (i < currentProjects.length - 1) {
            const hr = document.createElement('hr');
            projectHTML.appendChild(hr);
        }
    });
    const projectsWrapper = document.getElementById('projectsWrapper');
  
    projectsWrapper.innerHTML = projectHTML.innerHTML;
}

async function nextPage(){
    let matchingProjects = localStorage.getItem("matchingProjects");
    if(window.currentPage * 5 < matchingProjects.length) {
        window.currentPage++; 
        await renderProjects();
       const pageNum = document.getElementById(`currentPage`).innerText = window.currentPage;

    }
     updateButtons();

}

async function prevPage(){
    if(window.currentPage > 1) {
        window.currentPage--; 
        await renderProjects();
        const pageNum = document.getElementById(`currentPage`).innerText = window.currentPage;
      
    
    }
     updateButtons();
}

function updateButtons() {
    let matchingProjects = localStorage.getItem("matchingProjects");
     matchingProjects = JSON.parse(matchingProjects);
    let maxPage = Math.floor(matchingProjects.length / 5)
    if (matchingProjects.length % 5 != 0){
        maxPage++;
    }
    
    document.getElementById("prevBtn").disabled = window.currentPage <= 1;
    document.getElementById("nextBtn").disabled = window.currentPage >= maxPage;
    if(window.currentPage < 1 || window.currentPage > maxPage){
        window.currentPage = 1;
    }
}



// Updates all analytics boards based on current time period selection
async function setBoard() {
    const timePeriod = parseInt(sessionStorage.getItem("an_timePeriod"), 10);
    await setIndividualsBoard(timePeriod);
    await setDepartmentBoard(timePeriod);
    await updateGraphs(timePeriod);
}



    /* -------------------- Backend Calls -------------------- */

// Fetches the current user's permission levels
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

// Fetches all projects from backend/api
async function fetchProjects() {
    try {
        const response = await fetch('/projects');
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        return [];
    }
}

// Updates the hidden status of a project in the backend
async function updateProjectIsHidden(projectId, isHidden) {
    try {
        const response = await fetch('/update/projects/hidden', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ id: projectId, is_hidden: isHidden }),
        });

        if (!response.ok) console.error('Failed to update project hidden status');
    } catch (error) {
        console.error('Error updating project hidden status:', error);
    }
}

// Fetches all tickets from backend/api
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

// Filter tickets by time period (0=week, 1=month, 2=3months, 3=year, 4=alltime, 5=custom)
function fetchTicketsByTimePeriod(timePeriod) {
    const now = new Date();
    let startDate = new Date();
    
    switch(timePeriod) {
        case 0: // Last 7 days
            startDate.setDate(now.getDate() - 7);
            break;
        case 1: // Last 30 days
            startDate.setDate(now.getDate() - 30);
            break;
        case 2: // Last 90 days
            startDate.setDate(now.getDate() - 90);
            break;
        case 3: // Last 365 days
            startDate.setDate(now.getDate() - 365);
            break;
        case 4: // All time
            return window.allTickets || [];
        case 5: // Custom Date Range
            const customRange = getCustomDateRange();
            if (!customRange) return [];
            return (window.allTickets || []).filter(t => {
                const ticketDate = new Date(t.CreatedDate || t.ModifiedDate);
                return ticketDate >= customRange.startDate && ticketDate <= customRange.endDate;
            });
        default:
            return window.allTickets || [];
    }
    
    return (window.allTickets || []).filter(t => {
        const ticketDate = new Date(t.CreatedDate || t.ModifiedDate);
        return ticketDate >= startDate && ticketDate <= now;
    });
}

// Get analytics data for current user
function fetchIndividualAnalytics(timePeriod) {
    const ticketsInPeriod = fetchTicketsByTimePeriod(timePeriod);
    
    const stats = {
        created: 0,
        responded: 0,
        closed: 0
    };
    
    // TODO: Grab tickets relavent for user (requires shibboleth)
    
    return stats;
}

// Get department-wide analytics
function fetchDepartmentAnalytics(timePeriod) {
    const ticketsInPeriod = fetchTicketsByTimePeriod(timePeriod);
    const allTickets = fetchTicketsByTimePeriod(-1); // -1 forces to get all tickets

    const stats = {
        total: ticketsInPeriod.length,
        byBuilding: {},
        byHour: new Array(14).fill(0),
        totalClosed: 0,
        totalOpen: 0,
        ticketsRoomcheck: 0,
        ticketsPC: 0,
        ticketsFalse: 0,
        ticketsEventSupport: 0,
        roomcheckLeaders: [],
        roomcheckOverall: {}
    };

    const leaderboard = JSON.parse(localStorage.getItem("leaderboard") || "{}");
    const leaderboardLeaders = {
        0: (leaderboard["7days"] || []).slice(0, 3),
        1: (leaderboard["30days"] || []).slice(0, 3),
        2: (leaderboard["90days"] || []).slice(0, 3),
        3: (leaderboard["365days"] || []).slice(0, 3)
    };
    const leaderboardOverall = {
        0: (leaderboard["7days"] || []).reduce((sum, person) => sum + (person.Count || 0), 0),
        1: (leaderboard["30days"] || []).reduce((sum, person) => sum + (person.Count || 0), 0),
        2: (leaderboard["90days"] || []).reduce((sum, person) => sum + (person.Count || 0), 0),
        3: (leaderboard["365days"] || []).reduce((sum, person) => sum + (person.Count || 0), 0)
    };

    let roomcheckPeriodIndex = timePeriod;
    if (timePeriod === 5) {
        const frame = getCustomRoomCheckFrame();
        roomcheckPeriodIndex = [7, 30, 90, 365].indexOf(frame);
        stats.roomcheckTimeFrame = frame;
    } else if (timePeriod === 4) {
        stats.roomcheckTimeFrame = 365;
        roomcheckPeriodIndex = 3;
    } else {
        stats.roomcheckTimeFrame = [7, 30, 90, 365][timePeriod] || 7;
    }

    stats.roomcheckLeaders = leaderboardLeaders[roomcheckPeriodIndex] || [];
    stats.roomcheckOverall = {
        "Last 7 Days": leaderboardOverall[0],
        "Last 30 Days": leaderboardOverall[1],
        "Last 90 Days": leaderboardOverall[2],
        "Last 365 Days": leaderboardOverall[3]
    };
    
    // All Time Stats
    for (const ticket of allTickets) {
        const status = ticket.StatusName;

        // Count Ticket Stats
        if (status === 'New' || status === 'In Process' || status === "On Hold")
            stats.totalOpen++;
    }

    // Time Period Stats
    for (const ticket of ticketsInPeriod) {
        const status = ticket.StatusName;
        const title = (ticket.Title || "").toString();
        const titleMatch = title.match(/^\s*([A-Za-z]{2,4}(?:\s+[A-Za-z]{2,4})?)\s+(\d{1,4})/);
        const BUILDING_NORMALIZATION = {
            "BCPA": "PA",
            "ST": "STEM",
            "ENZI": "STEM",
            "ENZI STEM": "STEM",
            "ENG": "EN",
            "ESB": "ES",
            "SIB": "SI",
            "COE": "CL",
            "CIC": "CI",
            "BE": "BH",
        };

        // Count Ticket Stats
        if (status === 'Closed' || status === 'Completed' || status === 'Resolved' || 
            status === 'Cancelled' || status === 'Closed using Remote Support Tool')
            stats.totalClosed++;
        if (/Room Check$/i.test(title.trim()))
            stats.ticketsRoomcheck++;
        if (/\b(PC|Computer|Laptop|LPTP)\b/i.test(title))
            stats.ticketsPC++;
        if (ticket.ParentID == 22873142)
            stats.ticketsFalse++;
        if (/\b(WyoCast|Event|Zoom|Tutorial)\b/i.test(title))
            stats.ticketsEventSupport++;
        
        // Ticket Count by Building Bar Graph
        if (titleMatch) {
            let bld = titleMatch[1].toUpperCase().trim();
            bld = BUILDING_NORMALIZATION[bld] || bld;
            stats.byBuilding[bld] = (stats.byBuilding[bld] || 0) + 1;
        }

        // Total Tickets per Hour Bar Graph
        if (ticket.CreatedDate) {
            const hour = new Date(ticket.CreatedDate).getHours();
            if (hour >= 7 && hour <= 19)
                stats.byHour[hour - 7]++;
            else
                stats.byHour[13]++; // "Other"        
        }
    }
    
    return stats;
}

// Executes a analytics export and fetches it
async function fetchExportedPDF(timePeriod, optionalData) {
    try {
        const response = await fetch('/analytics/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ timePeriod, optionalData })
        });
        if (!response.ok) throw new Error('Network response was not ok');
        return await response.blob();
    } catch (error) {
        console.error('Failed to fetch exported PDF:', error);
        return null;
    }
}


    /* -------------------- "Main" Function -------------------- */

// Sets up the Analytics tool page
async function setAnalytics() {
    preserveCurrentTool();
    document.title = "Analytics - Bronson";

    // Clear Analytics cache so new HTML and Tickets are always loaded
    sessionStorage.removeItem("Analytics_html");

    let current = document.getElementsByClassName("selected");
    if (current.length != 0)
        current[0].classList.remove("selected");

    let newCurrent = document.getElementById("ANButton");
    newCurrent.classList.add("selected");
    newCurrent.classList.remove("stashed"); // Stop the strobing

    history.pushState("test", "Analytics", "/analytics");

    // Check for preserved space
    let cached_HTML = sessionStorage.getItem("Analytics_html");
    let progGuts = document.querySelector('.program_board .program_guts');
    if (cached_HTML != null) {
        // make sure cache was not overwritten with another tool.
        if(cached_HTML.includes("an_container")) {
            progGuts.innerHTML = cached_HTML;
            return;
        }
    }

    // No HTML Cache found, build from scratch
    let an_container = document.createElement("div");
    an_container.classList.add("an_container");

    // Main Container
    let main_container = document.createElement('div');
    main_container.appendChild(an_container);
    main_container.classList.add('program_guts');
    
    // Add mobile class if on mobile device
    const isMobile = (localStorage.getItem("isMobile") === "true") ? true : false;
    if (isMobile) an_container.classList.add('mobile');
    
    progGuts.replaceWith(main_container);

    // Hide Terminal
    const terminal = document.getElementById('terminal');
    if (terminal && terminal.style.display !== "none") hideTerminal();
    

    /* -------------------- Analytics Page -------------------- */

    // Display loading message while fetching tickets
    let loadingMessage = document.createElement("div");
    loadingMessage.classList.add("an_loadingMessage");
    if (isMobile) loadingMessage.classList.add("mobile");
    loadingMessage.innerHTML = `
        <legend ${isMobile ? "class='mobile_legend'" : ""}>Loading Analytics</legend>
    `;
    an_container.append(loadingMessage);

    let ellipsis = "";
    const ellipsisInterval = setInterval(() => {
        ellipsis += ".";
        if (ellipsis.length > 3) ellipsis = "";
        loadingMessage.innerHTML = `
            <legend ${isMobile ? "class='mobile_legend'" : ""}>Loading Analytics${ellipsis}</legend>
        `;
    }, 1000); // Update every 1 second

    // Fetch all tickets
    let tickets = [];
    while (!tickets.length) {
        let response = await fetchTickets();
        tickets = Array.isArray(response) ? response : [];
    }
    window.allTickets = tickets;

    // Build fast lookup map by ticket ID
    window.allTicketsById = new Map();
    for (const t of window.allTickets || []) {
        window.allTicketsById.set(t.ID, t);
    }    


    // Clear Loading Screen
    clearInterval(ellipsisInterval);
    loadingMessage.remove();

    sessionStorage.setItem("an_custom_start", ""); // Initialize as blank date
    sessionStorage.setItem("an_custom_end", ""); // Initialize as blank date
    sessionStorage.setItem("an_timePeriod", 1); // Initialize page to "Past Month"

    const leftCol = document.createElement('div');
    leftCol.classList.add('an_leftCol');
    an_container.append(leftCol);

    const rightCol = document.createElement('div');
    rightCol.classList.add('an_rightCol');
    an_container.append(rightCol);


    const exportSettings = document.createElement('div');
    exportSettings.classList.add('an_settings');
    leftCol.append(exportSettings);
    showSettings();

    const individuals = document.createElement('div');
    individuals.classList.add('an_individuals');
    const isAdmin = await fetchCurrentUserPermissions() >= 6;
    const adminTechSelectorHTML = isAdmin ? `
        <div id="an_techSelector">
            <strong>Choose a tech:</strong>
            <select name="techs" id="techs">
                <option value="johndoe" selected>John Doe</option>
                <option value="todo">TODO: Add Users via Shibboleth</option>
            </select>
            <hr>
        </div>
    ` : "";
    individuals.innerHTML = `
        <fieldset class="an_individualsFieldset">
            <legend id="an_individualsLegend">My Analytics</legend>

            ${adminTechSelectorHTML}

            <p>Dev Note: "My Analytics" Widget is unavailable for development until we have shibboleth</p>

            <strong><u>Room Checks:</u></strong>
            <div id="an_individualRoomcheckStats">
                <div class="an_statsBox">
                    <strong id='ind_roomcheck_note'></strong>
                    <h1 id="ind_roomcheck_timeperiod"></h1>
                </div>
                <div class="an_statsBox">
                    <strong>All Time</strong>
                    <h1 id="ind_roomcheck_alltime"></h1>
                </div>
            </div>
            <strong><u>Tickets:</u></strong>
            <div id="an_individualTicketStats">
                <div class="an_statsBox">
                    <strong>Created</strong>
                    <h1 id="ind_tickets_created"></h1>
                </div>
                <div class="an_statsBox">
                    <strong>Responded To</strong>
                    <h1 id="ind_tickets_responded"></h1>
                </div>
                <div class="an_statsBox">
                    <strong>Closed</strong>
                    <h1 id="ind_tickets_closed"></h1>
                </div>
            </div>

            <div class="an_donutGraphContainer">
                <div class="an_donutGraph">
                    <canvas id="indRoomCheckDonut"></canvas>
                </div>
                <div class="an_donutGraph">
                    <canvas id="indTicketsDonut"></canvas>
                </div>
            </div>
        </fieldset>
    `;
    leftCol.append(individuals);

    const department = document.createElement('div');
    department.classList.add('an_department');
    department.innerHTML = `
        <fieldset class="an_departmentFieldset">
            <legend>Department Analytics</legend>
            <strong><u>Room Checks:</u></strong>
            <div id="an_departmentRoomcheckStats">
                <div class="an_statsBox" id="dep_roomcheck_leaders">
                    <strong>Room Check Leaders (<strong id='dep_roomcheck_note' style='margin: 0;'></strong>)</strong>
                    <p>1. Person A - </p>
                    <p>2. Person B - </p>
                    <p>3. Person C - </p>
                </div>
                <div class="an_statsBox" id="dep_roomcheck_overall">
                    <strong>Total Room Checks:</strong>
                    <p>Last 7 Days: </p>
                    <p>Last 30 Days: </p>
                    <p>Last 90 Days: </p>
                    <p>Last 365 Days: </p>
                </div>
            </div>

            <strong><u>Tickets:</u></strong>
            <div id="an_departmentTicketStats">
                <div class="an_statsBox">
                    <strong>Created</strong>
                    <h1 id="dep_tickets_created"></h1>
                </div>
                <div class="an_statsBox">
                    <strong>Closed</strong>
                    <h1 id="dep_tickets_closed"></h1>
                </div>
                <div class="an_statsBox">
                    <strong>Open Tickets (All Time)</strong>
                    <h1 id="dep_tickets_open"></h1>
                </div>
            </div>

            <strong id="an_statsLabel"><u>Stats:</u></strong>
            <div id="an_departmentGeneralStats">
                <div class="an_statsBox">
                    <strong>Room Check Tickets</strong>
                    <h1 id="dep_tickets_roomcheck"></h1>
                </div>
                <div class="an_statsBox">
                    <strong>False Tickets</strong>
                    <h1 id="dep_tickets_false"></h1>
                </div>
                <div class="an_statsBox">
                    <strong>PC Tickets</strong>
                    <h1 id="dep_tickets_pc"></h1>
                </div>
                <div class="an_statsBox">
                    <strong>Event Support Tickets</strong>
                    <h1 id="dep_tickets_eventsupport"></h1>
                </div>
            </div>

            <div class="an_barGraph">
                <canvas id="buildingCountGraph"></canvas>
            </div>
            <div class="an_barGraph">
                <canvas id="ticketsPerHourGraph"></canvas>
            </div>
        </fieldset>
    `;
    rightCol.append(department);

    const projects = document.createElement('div');
    projects.classList.add('an_projects');
    const adminHiddenProjectsHTML = await populateHiddenProjectList();
    projects.innerHTML = `
        <fieldset class="an_projectsFieldset">
            ${adminHiddenProjectsHTML}
            <strong></strong>
            <label for="an_project_0">0%</label>
            <progress id="an_project_0" value="0" max="100"></progress>
            <ul>
                <li></li>
            </ul>
        
        </fieldset>
    `;
    rightCol.append(projects);
    

    await buildGraphs(); // Only ever call once
    await setBoard();
    await setProjectsBoard();
}
