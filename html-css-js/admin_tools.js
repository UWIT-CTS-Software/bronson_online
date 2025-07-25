// admin_tools.js

// Note, I think it would be good to put the terminal stuff in here that is currently in index_admin.html but it utilizes JQueury in a way that I am not hundred percent sure of so I will not be doing that just yet because I don't want to break anything.

// Adds the 'Admin Tools' tab to the program header
function setAdminBronson() {
    // Add Admin Tool Tab
    siteheader = document.getElementById("middle");
    adminTabs = document.createElement("div");
    adminTabs.classList.add("tab_row");
    adminTabs.classList.add("admin_tab");
    adminTabs.innerHTML = `<button id="adminButton" class="toolTab adminTab" onclick="setAdminTools()" type=button><img class="tab_img" src=button2.png></img><span>Admin Tools</span></button>`;
    siteheader.appendChild(adminTabs);
}

// Set Admin Tool Page on program guts
async function setAdminTools() {
    const menuItems = document.querySelectorAll(".menuItem");

    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

    preserveCurrentTool();

    document.title = "Admin Tools - Bronson";
    // remove currently active status mark tab has active.
    // let active_tab_header = document.querySelector('.active_tab_header');
    // active_tab_header.innerHTML = 'Checkerboard';
    let current = document.getElementsByClassName("selected");
    if (current.length != 0) {
        current[0].classList.remove("selected");
        // current[0].classList.remove("active");
    }
    let newCurrent = document.getElementById("adminButton");
    // newCurrent.classList.add("active");
    newCurrent.classList.add("selected");

    history.pushState("test", "Admin Tools", "/admintools");

    let progGuts = document.querySelector('.program_board .program_guts');

    // Build Admin Tools Landing Page
    let at_container = document.createElement("div");
    at_container.classList.add("at_container");
    // Admin Tool Tab Rows
    let admin_tab_row = document.createElement("div");
    admin_tab_row.classList.add("tab_row");
    admin_tab_row.classList.add("admin_tabs");
    admin_tab_row.innerHTML = `
    <button id="at_message" onclick="setMessageEditor()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Message Editor </span>
    </button>
    <button id="at_schedule" onclick="setScheduleEditor()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Schedule Editor </span>
    </button>`;
    // init admin tool guts
    let admin_internals = document.createElement("div");
    admin_internals.setAttribute("id", "admin_internals");
    admin_internals.innerHTML = `<p> Please Select an Administrative Tool </p>`;
    // fieldset
    let at_fieldset = document.createElement('fieldset');
    at_fieldset.classList.add('at_fieldset');
    at_fieldset.innerHTML = `<legend> Admin Tools </legend>`;
    at_fieldset.appendChild(admin_tab_row);
    at_fieldset.appendChild(admin_internals);
    at_container.appendChild(at_fieldset);

    let main_container = document.createElement('div');
    main_container.appendChild(at_container);
    main_container.classList.add('program_guts');
    progGuts.replaceWith(main_container);
    return;
}

// MESSAGE EDITOR

// Set MessageEditor
// TODO - Check permissions here
function setMessageEditor() {
    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("at_selected");
    if (current.length != 0) {
        current[0].classList.remove("at_selected");
    }
    let newCurrent = document.getElementById("at_message");
    newCurrent.classList.add("at_selected");

    // Update Dashboard Message
    let dashboard_message_editor = document.createElement("div");
    dashboard_message_editor.setAttribute("id", "admin_internals");
    dashboard_message_editor.classList.add('at_dme'); //dashboard message editor, acronym
    dashboard_message_editor.innerHTML = `
    <fieldset>
        <legend> Edit Dashboard Message: </legend>
        <textarea id="dme_editor"></textarea>
        <button onclick="setDashboardMessage()"> Set Message </button>
        <button onclick="clearEditor()"> Clear Editor </button> 
    </fieldset>`;
    // replace admin_internals
    let admin_internals = document.getElementById('admin_internals');
    admin_internals.replaceWith(dashboard_message_editor);
    return;
}

// Grabs the contents of the text
//  Need to update setDashboard() to check for this
//  I am waiting on the database to have the correct behavior.
//  When the pieces are in place, the contents of this editor will
//  be sent to the back end and be saved in the database and then all
//  dashboards will pull that value for the dashboard messages content.
function setDashboardMessage() {
    let dme = document.getElementById("dme_editor");
    contents = dme.innerText;
    localStorage.setItem("DashboardMessage", contents);
    return;
}

function clearEditor() {
    let dme = document.getElementById("dme_editor");
    dme.innerText = ``;
    return;
}

// SCHEDULE EDITOR

function setScheduleEditor() {
    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("at_selected");
    if (current.length != 0) {
        current[0].classList.remove("at_selected");
    }
    let newCurrent = document.getElementById("at_schedule");
    newCurrent.classList.add("at_selected");
    // build tool
    let schedule_editor = document.createElement('div');
    schedule_editor.setAttribute("id", "admin_internals");
    schedule_editor.classList.add('at_se');
    // get Current Schedule
    //  Note this will change with the database
    let scheduleData = JSON.parse(localStorage.getItem("schedule"));
    if(scheduleData == null) {
        console.assert("Error: schedule not found in local storage.");
        return;
    }
    
    // TODO: Make Buttons
    let buttonFieldset = document.createElement('div');
    buttonFieldset.classList.add("schdEditorButtonsDiv");
    buttonFieldset.innerHTML = `
    <fieldset className="techSchdOptions">
        <legend> Options </legend>
        <button onclick="updateAllTechSchedules()"> Save All Schedules </button>
        <button onclick="addBlankTechSchedule()"> Add a Technician </button>
        <button onclick="setRemoveMode()"> Remove a Technician </button>
        <button onclick="exportSchd()"> Export Schedules </button>
        <div class="techFilterDiv">
            <label for="techSchdFilter">Filter Technician:</label>
            <textarea id="techSchdFilter" placeholder="Name:" onkeyup="filterTechs()"></textarea>
        </div>
    </fieldset>`;
    schedule_editor.appendChild(buttonFieldset);
    // Make filters (?)
    // Make Tables
    for(let i = 0; i < scheduleData.Technicians.length; i++) {
        //console.log(scheduleData.Technicians[i]);
        schedule_editor.appendChild(makeTechEditTable(scheduleData.Technicians[i]));
    }
    // replace admin_internals
    let admin_internals = document.getElementById('admin_internals');
    admin_internals.replaceWith(schedule_editor);
    // Add additional Listeners
    document.getElementById('techSchdFilter').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        } 
    });
    // update hours for everyone
    for(tech in scheduleData.Technicians) {
        let techObj = scheduleData.Technicians[tech];
        updateHours(`tech${techObj.Name}`,`${techObj.Name.split(" ")[1]}Hours`);
    }
    return;
}

// TODO: set remove mode,
//  I really dont want to accidentally remove someone with a misclick
//   so I want this to be a popup with a list of techs. With a button
function setRemoveMode() {
    return;
}

// TODO: place a blank tech table at the top of the page.
//s empty name, unassigned, no time selected on the table.
// The save button here will need to be a little different
//  it will need to add the new tech to the array of objects.
//  the other function updates an existing entry.
function addBlankTechSchedules() {
    return;
}

// TODO: Export Schdule
function exportSchd() {
    return;
}

function filterTechs() {
    let techTables = document.getElementsByClassName("techSchdDiv");
    let filter = document.getElementById("techSchdFilter").value;
    console.log("filtering", filter);
    if (filter == '') {
        for(let i = 0; i < techTables.length; i++) {
            techTables[i].hidden = false;
        }
        return;
    }
    for(let i = 0; i < techTables.length; i++) {
        if(!techTables[i].getAttribute('id').toLowerCase().includes(filter.toLowerCase())) {
            techTables[i].hidden = true;
        }
    }
    return;
}

function makeTechEditTable(techObj) {
    let techTable = document.createElement('div');
    techTable.classList.add("techSchdDiv");
    techTable.setAttribute("id", techObj.Name);
    //techTable.innerText = techObj.Name;
    //let techSchedule = techObj.Schedule;
    let tableHTML = `
        <fieldset id="${techObj.Name.split(" ")[1]}_table" class="techFieldset">
        <legend>Technician: ${techObj.Name}</legend>
        <fieldset class="schdTechFields">
            <label for="techNameEdit${techObj.Name}">Name:</label>
            <textarea id="techNameEdit${techObj.Name}" spellcheck="false" rows="1" cols="10">${techObj.Name}</textarea><br>
            ${makeTechAssignmentSelect(techObj)}
            <button onclick="updateTechSchedule('tech${techObj.Name}')">Save Schedule</button>
        </fieldset>
        <table id="tech${techObj.Name}" class="adminTechTable">
            <thead>
                ${makeTechTableHeader("Weekday")}
            </thead>
            <tbody>
                ${makeAdminTechSchdRow(techObj, "Monday")}
                ${makeAdminTechSchdRow(techObj, "Tuesday")}
                ${makeAdminTechSchdRow(techObj, "Wednesday")}
                ${makeAdminTechSchdRow(techObj, "Thursday")}
                ${makeAdminTechSchdRow(techObj, "Friday")}
            </tbody>
            <tfoot>
                <tr>
                    <th scope"row" colspan="2">Weekly Hours:</th>
                    <td id="${techObj.Name.split(" ")[1]}Hours"></td>
                </tr>
            </tfoot>
        </table>
        </fieldset>`;
    techTable.innerHTML = tableHTML;
    return techTable;
}

// This function is mainly used to make sure that a tech's current assignment is the current option
function makeTechAssignmentSelect(techObj) {
    const assignments = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'SysEn', 'Networking', 'Coding','Unassigned'];
    let currentAssignment = techObj.Assignment;
    let otherAssignments = assignments.filter(element => element !== currentAssignment);
    let html = `
    <label for="techSelect${techObj.Name}">Assignment: </label>
    <select id="techSelect${techObj.Name}">
        <option value="${currentAssignment}">${currentAssignment}</option>`;
    for(a in otherAssignments) {
        html += `<option value="${otherAssignments[a]}">${otherAssignments[a]}</option>`;
    }
    html += `</select>`;
    return html;
}

function makeAdminTechSchdRow(tech, day) {
    // console.log(today);
    let html = `
    <tr>
        <th scope="row" class="schdLeftIndex">${day}</th>`;
    // get schedule timeblocks
    let timeBlocks = getTechSchdTimeBlocks();
    //console.log(timeBlocks);
    // get techs schedule for the day
    let timeSwitches = [];
    let shift = tech.Schedule[day].split(",");
    for(let i = 0; i < shift.length; i++) {
        timeSwitches.push(shift[i].split(' - '))
    }
    timeSwitches = timeSwitches.flat(2);

    let onClock = false;
    let timeIndex = 0;
    // Iterate through 24 time blocks;
    for(let i = 0; i < timeBlocks.length; i++) {
        //console.info("timeswitch: ", timeSwitches[timeIndex], " Time Block: ", timeBlocks[i]);
        if(timeBlocks[i] == timeSwitches[timeIndex]) {
            //console.log("Hit a timeSwitch");
            onClock = !onClock;
            ++timeIndex;
        }
        let id = tech.Name.split(" ")[1] + day + timeBlocks[i];
        html += `<td id="${id}" draggable="true" ondragenter="flipTime('${tech.Name}','${id}')" onclick="flipTime('${tech.Name}','${id}')" class="schd${onClock}">\t</td>`;
    }
    //console.groupEnd("TimeSwitch vs. TimeBlocks");
    html += `</tr>`
    return html;
}

function flipTime(techName, tableElementID) {
    let element = document.getElementById(tableElementID);
    if(element.classList.contains("schdtrue")) {
        element.classList.remove("schdtrue");
        element.classList.add("schdfalse");
    } else {
        element.classList.remove("schdfalse");
        element.classList.add("schdtrue");
    }
    updateHours(`tech${techName}`,`${techName.split(" ")[1]}Hours`);
    return;
}

function updateHours(tableID, tableHoursID) {
    let table = document.getElementById(tableID);
    let hoursEntry = document.getElementById(tableHoursID);
    let onCells = table.getElementsByClassName('schdtrue');
    //console.log("updateHours", onCells);
    hoursEntry.innerText = onCells.length * .5;
    return;
}

function updateAllTechSchedules() {
    let tables = document.getElementsByClassName("adminTechTable");
    for(let i = 0; i < tables.length; i++) {
        let tableId = tables[i].getAttribute("id");
        updateTechSchedule(tableId);
    }
    return;
}

// grabs the table for a tech on the page and converts it to schedule time
// as well as the assignment drop down
function updateTechSchedule(tableID) {
    // This will be a post request once the database is implemented.
    let table = document.getElementById(tableID);
    let trueCells = table.getElementsByClassName('schdtrue');
    let timeBlocks = getTechSchdTimeBlocks();
    timeBlocks.push("7:30PM");
    let techName = tableID.split("tech")[1];
    const days = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday"
    ];
    let newSchdObj = {
        "Monday": "NA",
        "Tuesday": "NA",
        "Wednesday": "NA",
        "Thursday": "NA",
        "Friday": "NA"
    }
    cellIds = [];
    // make an array of cell IDs
    for(let i = 0; i < trueCells.length; i++) {
        let cell = trueCells[i].getAttribute('id');
        cellIds.push(cell);
    }
    // Iterate through each day
    for(let i = 0; i < days.length; i++) {
        let dailyTimes = cellIds.filter(element => element.includes(days[i]));
        let tmpString = '';
        let multipleShifts = false;
        let shiftStarted = false;
        for(let j = 0; j < dailyTimes.length - 1; j++) {
            // Init currentTime info
            let time = dailyTimes[j].split('day')[1];
            let nextTime = dailyTimes[j+1].split('day')[1];
            let lastTime = dailyTimes.at(-1).split('day')[1];
            let tbIndex = timeBlocks.indexOf(time);
            let nextTB = timeBlocks[tbIndex+1];
            if (!shiftStarted) {
                if(!multipleShifts){
                    tmpString += time + ' - ';
                    shiftStarted = true;
                } else {
                    tmpString += ',' + time + ' - ';
                    shiftStarted = true;
                }
            }
            if (shiftStarted) {
                if(nextTime != nextTB) {
                    tmpString += nextTB;
                    shiftStarted = false;
                    multipleShifts = true;
                } else if(nextTime == lastTime) {
                    tmpString += timeBlocks[tbIndex+2];
                }
            }
            // Last iteration / check for singular 30 minute shift
            if(nextTime == lastTime) {
                if(timeBlocks.indexOf(nextTime) > tbIndex+1) {
                    //console.warn("Singular 30 minute shift detected");
                    let tbII = timeBlocks.indexOf(nextTime);
                    tmpString += ',' + nextTime + ' - ' + timeBlocks[tbII + 1];
                }
            }
        }
        //console.log(days[i] +' '+ tmpString);
        if (tmpString != '') {
            newSchdObj[days[i]] =  tmpString;
        }
    }
    // Assignment
    let select = document.getElementById(`techSelect${techName}`);
    // get copy of current tech schedules and update it
    //   DATABASE POST REQUEST HERE.
    let scheduleData = JSON.parse(localStorage.getItem('schedule'));
    let techIndex = scheduleData.Technicians.findIndex(element => element.Name === techName);
    scheduleData.Technicians[techIndex].Schedule = newSchdObj;
    scheduleData.Technicians[techIndex].Assignment = select.value;
    localStorage.setItem('schedule', JSON.stringify(scheduleData));
    return;
}