/* 

admin_tools.js

Functions
    - sleep(ms);
    - setAdminBronson();
    - setAdminTools();
  Message Editor
    - setMessageEditor();
    - setDashboardMessage();
    - clearEditor();
  Schedule
    - setScheduleEditor();
    - setRemoveMode();
    - removeTechSelect(techID);
    - exitRemoveMode();
    - removeSelectedTechs();
    - addBlankTechSchedule(count);
    - exportSchd();
    - filterTechs();
    - makeTechEditTable(techObj);
    - makeTechAssignmentSelect(techObj);
    - makeAdminTechSchdRow(tech, day);
    - flipTime(techName, tableElementID);
    - updateHours(tableID, tableHoursID);
    - updateAllTechSchedules();
    - updateTechSchedule(techID, scheduleData);
    - updateSchedule(schedule);
  Diagnostics
    - setDiag()
    - syncLSMData(deviceType)
    - getLSMDataByType(build_ab, deviceType)
    - clearDTerm()
    - updateDTerm(string)
    - runLSMCrosscheck(deviceType)
    - findDiff(bigArr, smlArr, name)
    - showDataDiagInfo()
    - showDatabaseInfo()
    - checkingLSMData(lsmObj, type)
    - removeLSMData()
    - getBuildingDeviceInfo(building, deviceType)
    - formatLSMDevices(lsm_data)
  Database Editor
    - setDBEditor()
    - updateDatabaseFromEditor() -- TODO
    - setRoomAddition(menuID, buildingTableID)
    - confirmRoomAddition(textareaID, buildingTableID)
    - removeRoomFromBuilding(rowID)
    - updateRow(rowElementID)
    - updateChangelog(roomElement)
    - updateChangelogRoomAddition(newRoomName)
    - validateUserRoomInput(defaultValue, userInput)
    
*/
// Note, I think it would be good to put the terminal stuff in here that is currently in index_admin.html but it utilizes JQueury in a way that I am not hundred percent sure of so I will not be doing that just yet because I don't want to break anything.

// quick sleep function, used to wait for server response when jquery delays retreiveing
// something from the backend. Which should only really need to happen when an admin
// refreshes the page.
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Persistent DataTransfer used to hold dropped room schedule files until
// the user clicks the Upload button. We use DataTransfer so files behave
// like an input.files collection and keep the File objects in memory.
const rsDataTransfer = new DataTransfer();

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
    await sleep(200);
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
    </button>
    <button id="at_dbedit" onclick="setDBEditor()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Database Editor </span>
    </button>
    <button id="at_alias" onclick="setAliasEditor()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Alias Editor </span>
    </button>
    <button id="at_diag" onclick="setDiag()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Diagnostics </span>
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
    contents = dme.value;
    // DATABASE_TODO
    //  - This needs to be a post into the database.
    //    Once that is done the below line will not be relevant
    fetch("/update/dash", {
        method: "POST",
        body: contents
    });
    return;
}

function clearEditor() {
    let dme = document.getElementById("dme_editor");
    dme.innerText = ``;
    return;
}

// SCHEDULE EDITOR

async function setScheduleEditor() {
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
    let scheduleData = await getSchedule();
    if(scheduleData == null) {
        console.assert("Error: schedule not found in local storage.");
        return;
    }
    let buttonFieldset = document.createElement('div');
    buttonFieldset.classList.add("schdEditorButtonsDiv");
    buttonFieldset.innerHTML = `
    <fieldset id="techSchdOptions" className="techSchdOptions">
        <legend> Options </legend>
        <button class="exeButton" onclick="updateAllTechSchedules()"> Save All Schedules </button>
        <button id="addNewTechBttn" onclick="addBlankTechSchedule(0)"> Add a Technician </button>
        <button onclick="setRemoveMode()" class="rmvButton"> Remove a Technician </button>
        <button onclick="exportSchd()"> Export Schedules (CSV)</button>
        <div class="techFilterDiv">
            <label for="techSchdFilter">Filter Technicians:</label>
            <textarea id="techSchdFilter" placeholder="Name:" onkeyup="filterTechs()"></textarea>
        </div>
    </fieldset>`;
    schedule_editor.appendChild(buttonFieldset);
    // Make filters (?)
    // Make Tables
    Object.values(scheduleData).forEach(function(tech) {
        schedule_editor.appendChild(makeTechEditTable(tech));
    });
    // replace admin_internals
    let admin_internals = document.getElementById('admin_internals');
    admin_internals.replaceWith(schedule_editor);
    // Add additional Listeners
    // Disable enterkey
    document.getElementById('techSchdFilter').addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
        } 
    });
    // Update hours for everyone
    Object.values(scheduleData).forEach(function(tech) {
        updateHours(`tech${tech.Name}`,`${tech.Name.split(" ")[1]}Hours`);
        // Disable enter on name fields
        document.getElementById(`techNameEdit${tech.Name}`).addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
            } 
        });
    });
    return;
}

// Remove Mode is intended to mimimize the likelihood that a tech is accidentally removed.
async function setRemoveMode() {
    let techTables = document.getElementsByClassName('techSchdDiv');
    for(i in techTables) {
        techTables[i].hidden = true;
    }
    let options = document.getElementById('techSchdOptions');
    options.hidden = true;
    let fireSomeoneMenu = document.createElement('div');
    fireSomeoneMenu.setAttribute("id", "techSchdRemoveTech");
    fireSomeoneMenu.classList.add("techSchdRemoveTech");
    // Get current saved Schedule
    let scheduleData = await getSchedule();
    //console.log(techList);
    // HTML
    let html = `
    <ul id="techSchdRemoveList">`;
    Object.values(scheduleData).forEach(function(tech) {
        html += `<li id="rm_${tech.Name}" onclick="removeTechSelect('rm_${tech.Name}')">${tech.Name}</li>`;
    })
    html +=`</ul>`;
    html += `<button onclick="exitRemoveMode()">Exit Remove Mode</button>
    <button onclick="removeSelectedTechs()">Confirm Selection</button>`;
    // place new element on page
    fireSomeoneMenu.innerHTML = html;
    if (document.getElementById('techSchdRemoveTech') == undefined) {
        document.getElementById("admin_internals").appendChild(fireSomeoneMenu);
    } else {
        document.getElementById("techSchdRemoveTech").replaceWith(fireSomeoneMenu);
    }
    return;
}

// This function simply adds a class to a techs name to indicate that they have been selected for
//  removal out of the schedule. In order to complete the removal the admin has to click 
//  'Confirm Selection'. This is to ensure intentionality and not accidentally remove someone.
function removeTechSelect(techID) {
    let element = document.getElementById(techID);
    if(element.classList.contains("setToRemove")) {
        element.classList.remove("setToRemove");
    } else {
        element.classList.add("setToRemove");
    }
    return;
}

function exitRemoveMode() {
    document.getElementById("techSchdRemoveTech").remove();
    setScheduleEditor();
    return;
}

async function removeSelectedTechs() {
    // get techs to remove
    let techsToRemove = document.getElementsByClassName("setToRemove");
    // get stored json
    let scheduleData = await getSchedule();
    for (let i = 0;i < techsToRemove.length; i++) {
        let rm_id = techsToRemove[i].getAttribute('id').split("rm_")[1];
        delete scheduleData[rm_id];
    }
    // NOTE: verify this is not broken and correct before updating the localstorage iteration.
    updateSchedule(scheduleData);
    setRemoveMode();
    return;
}

function addBlankTechSchedule(count) {
    //Up Count in onclick
    let newTechBttn = document.getElementById("addNewTechBttn");
    newTechBttn.setAttribute('onclick', `addBlankTechSchedule(${count+1})`);
    let blankTech = {
        "Name": `New Tech${count}`,
        "Assignment": "Unassigned",
        "Schedule": {
            "Monday": "NA",
            "Tuesday": "NA",
            "Wednesday": "NA",
            "Thursday": "NA",
            "Friday": "NA"
        }
    }
    let newTable = makeTechEditTable(blankTech);
    // get techSchdDiv Elements and insert new tech
    let oldTables = document.getElementsByClassName('techSchdDiv');
    let parentElement = document.getElementById('admin_internals');
    parentElement.insertBefore(newTable, oldTables[0]);
    document.getElementById(`techNameEdit${blankTech.Name}`).addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            console.log("something is wrong");
        } 
    });
    return;
}

// TODO: Export Schdule
//  thinking about adding a library to do excel files
//  if too complex resort to csv.
//  output may be the literal string inside the tech obj
// CSV = comma delimited values
// MEANING, those strings with ',' to deliminate my shifts in a given day are now a problem
// while also being gross to look at, the code below also is non-functional because that is 
// not handled.
async function exportSchd() {
    // retrieve schd data
    let schdData = await getSchedule();
    // Define the csv Rows
    let name_items = ["Name"];
    let assignment = ["Assignment"];
    let mon_items = ["Monday"];
    let tues_items = ["Tuesday"];
    let wed_items = ["Wednesday"];
    let thur_items = ["Thursday"];
    let fri_items = ["Friday"];
    Object.values(schdData).forEach(function(tech) {
        name_items.push(tech.Name);
        assignment.push(tech.Assignment);
        let schd = tech.Schedule;
        mon_items.push(schd.Monday.replaceAll(",",";"));
        tues_items.push(schd.Tuesday.replaceAll(",",";"));
        wed_items.push(schd.Wednesday.replaceAll(",",";"));
        thur_items.push(schd.Thursday.replaceAll(",",";"));
        fri_items.push(schd.Friday.replaceAll(",",";"));
    });
    csv = [
        name_items.join(","),
        assignment.join(","),
        mon_items.join(","),
        tues_items.join(","),
        wed_items.join(","),
        thur_items.join(","),
        fri_items.join(",")
    ].join("\n");
    downloadCsv(csv);
    return;
}

function filterTechs() {
    let techTables = document.getElementsByClassName("techSchdDiv");
    let filter = document.getElementById("techSchdFilter").value;
    //console.log("filtering", filter);
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
            <button onclick="updateAllTechSchedules()">Save Schedule</button>
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

async function updateAllTechSchedules() {
    let schedule = {};
    let tables = document.getElementsByClassName("adminTechTable");
    for(let i = 0; i < tables.length; i++) {
        let tableId = tables[i].getAttribute("id");
        schedule = await updateTechSchedule(tableId, schedule);
    }
    updateSchedule(schedule);
    return;
}

// grabs the table for a tech on the page and converts it to schedule time
// as well as the assignment drop down
async function updateTechSchedule(tableID, scheduleData) {
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
        //console.log("SE: dailyTimes", dailyTimes);
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
        // if there is a single 30 minute block and nothing else, the above block will not see it.
        if (dailyTimes.length == 1) {
            let time = dailyTimes[0].split('day')[1];
            tmpString = time + ' - ' + timeBlocks[timeBlocks.indexOf(time)+1];
        }
        //console.log(days[i] +' '+ tmpString);
        if (tmpString != '') {
            newSchdObj[days[i]] =  tmpString;
        }
    }
    // Assignment
    let select = document.getElementById(`techSelect${techName}`);
    // Name
    let name = document.getElementById(`techNameEdit${techName}`);
    // get copy of current tech schedules and update it
    let techObj = {
        "Name": name.value,
        "Assignment": select.value,
        "Schedule": newSchdObj
    }
    scheduleData[techObj["Name"]] = techObj;
    return scheduleData;
}

async function updateSchedule(schedule) {
    return fetch("updateSchedule", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": JSON.stringify(schedule).length,
        },
        body: JSON.stringify(schedule)
    }).then(response => {
        if (!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        return response;
    });
}

// Diagnostics Page
//  - I am implementing new LSM API Queries to pull inventory, the hope is this page will discover
//   discrepencies between the LSM database and the inventory we have in 'campus.csv.'
//  - I am also interested in updating our database with a preference for what we see in LSM rather
//   than the CSV. This will give us a more unified data handling, if a Room is converted to 
//   displays rather than projectors, the change will be automatic and JackPing/Campus.csv will not
//   need manual fine tuning. 
//  - I think this page should also allow for users to do such changes if need be.
//  - If the database needs changes this page should be able to do these changes.
//  - if we have conflicting data in LSM and Bronson, this page will report on it.
async function setDiag() {
    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("at_selected");
    if (current.length != 0) {
        current[0].classList.remove("at_selected");
    }
    let newCurrent = document.getElementById("at_diag");
    newCurrent.classList.add("at_selected");

    let adminDiagnostics = document.createElement("div");
    adminDiagnostics.setAttribute("id", "admin_internals");
    adminDiagnostics.classList.add('at_diagnostics'); //dashboard message editor, acronym
    adminDiagnostics.innerHTML = `
    <fieldset>
        <legend> Diagnostics: </legend>
        <div id="diag_space">
            <ol id="diag_list">
                <details> 
                    <summary>Sync LSM Data with Local Storage</summary>
                    <ol id="lsm_sync_list">
                        <option onclick="syncLSMData('PROC')" class="diagOption"> Sync LSM Processor Data </option>
                        <option onclick="syncLSMData('DISP')" class="diagOption"> Sync LSM Display Data </option>
                        <option onclick="syncLSMData('PJ')" class="diagOption"> Sync LSM Projector Data </option>
                        <option onclick="syncLSMData('TP')" class="diagOption"> Sync LSM Touch Panel Data </option>
                        <option onclick="removeLSMData()" class="diagOption"> Clear Local LSM Data </option>
                    </ol>
                </details>
                <li> 
                    <details> 
                        <summary> Database Diagnostics </summary>
                        <ol id="db_diag_list">
                            <option onclick="showDataDiagInfo()" class="diagOption"> Information </option>
                            <option onclick="showDatabaseInfo()" class="diagOption"> Show Database Info </option>
                            <option onclick="runLSMCrosscheck('PROC')" class="diagOption"> Examine Processors </option>
                            <option onclick="runLSMCrosscheck('DISP')" class="diagOption"> Examine Displays </option>
                            <option onclick="runLSMCrosscheck('PJ')" class="diagOption"> Examine Projectors </option>
                            <option onclick="runLSMCrosscheck('TP')" class="diagOption"> Examine Touch Panels </option>
                        </ol>
                </li>
            </ol>
            <textarea id="diag_terminal" spellcheck="false"></textarea>
        </div>
        <menu>
            <button onclick="clearDTerm()"> Clear Terminal </button>
        </menu>
    </fieldset>`;
    // replace admin_internals
    let admin_internals = document.getElementById('admin_internals');
    admin_internals.replaceWith(adminDiagnostics);
    return;
}

async function syncLSMData(deviceType) {
    clearDTerm();
    updateDTerm(`Syncing LSM Data for ${deviceType}...\n`);
    let lsm = JSON.parse(localStorage.getItem(`lsm_data_${deviceType}`));
    if (lsm == null) {
        updateDTerm(`⚠️ WARNING: No Local LSM Data found for ${deviceType}. Running sync...\n`);
        let buildings = await getBuildingList();
        let baArr = [];
        // Build Abbreviation Array
        for(let i = 0; i < buildings.length; i++) {
            let ba = await getAbbrev(buildings[i]);
            baArr.push(ba);
        }
        let lsmData = {
            data: {},
            timestamp: new Date().toISOString()
        };
        // Iterate through building abbreviations and get data
        for(let i = 0; i < baArr.length; i++) { // After Testing, remove 
            let b_name = buildings[i];
            updateDTerm(`Building: ${baArr[i]} - ${b_name}\n---------------\n`);
            let devData = await getLSMDataByType(baArr[i], deviceType);
            lsmData.data[baArr[i]] = devData.data;
            updateDTerm(`-- ✅ OK: Retrieved ${Object.keys(devData).length} ${deviceType.toLowerCase()} records from LSM for ${baArr[i]} - ${b_name}.\n`);
            updateDTerm('---------------\n');
        }
        localStorage.setItem(`lsm_data_${deviceType}`, JSON.stringify(lsmData));
    } else {
        updateDTerm(`-- ✅ OK: Local LSM Data found for ${deviceType}, no sync needed.\n`);
        updateDTerm(`Last Sync: ${lsm.timestamp}\n`);
    }
    return;
}

async function getLSMDataByType(build_ab, deviceType) {
    return await fetch('lsmData', {
        method: "POST",
        body: [build_ab, deviceType]
    })
    .then((response) => response.json())
    .then((json) => {return json;});
}

function clearDTerm() {
    let term = document.getElementById("diag_terminal");
    term.value = '';
    return;
}

function updateDTerm(string) {
    let term = document.getElementById("diag_terminal");
    term.value += string;
    return;
}

// This is supposed to be a general crosscheck function that can be used for any device type.
// TODO: implement API endpoints for other device types
//       Make a new post request function that takes device type as a parameter.
//       Update LocalStorage Object to include other device types.
async function runLSMCrosscheck(deviceType) {
    clearDTerm();
    updateDTerm(`\n\nRunning LSM Crosscheck for ${deviceType}...\n`);
    let buildings = await getBuildingList();
    let baArr = [];
    // Build Abbreviation Array
    for(let i = 0; i < buildings.length; i++) {
        let ba = await getAbbrev(buildings[i]);
        baArr.push(ba);
    }
    let lsm = JSON.parse(localStorage.getItem(`lsm_data_${deviceType}`));
    if (lsm == null) {
        updateDTerm(`❌ ERROR: No Local LSM Data found for ${deviceType}. Please sync LSM data before running diagnostics.\n`);
        return;
    }
    //let campusData = JSON.parse(localStorage.getItem("campData"));
    // Iterate through building abbreviations and compare data
    updateDTerm("Comparing LSM Data to Bronson Campus Data\n");
    // Iterate through buildings
    for(let i = 0; i < baArr.length; i++) {
        let b_ab = baArr[i];
        let b_name = buildings[i];
        updateDTerm(`\nBuilding: ${b_ab} - ${b_name}\n---------------\n`);
        //console.log("Diagnostic DEBUG: LSM Data for ", b_ab, lsm.data[b_ab]);
        let lsmDevs = await formatLSMDevices(lsm.data[b_ab], deviceType);
        let bronDevs = await getBuildingDeviceInfo(b_name, deviceType);
        let bronsonBigger = false;
        // Compare Data
        console.log("Admin Diagnostic DEBUG: Comparing LSM and Bronson Data for", b_ab, b_name);
        console.log("Bronson Devices: \n", bronDevs);
        console.log("LSM Devices: \n", lsmDevs);
        if (Object.keys(lsmDevs).length > Object.keys(bronDevs).length) {
            let diff = Object.keys(lsmDevs).length - Object.keys(bronDevs).length;
            updateDTerm(`⚠️ WARNING: LSM shows ${diff} more ${deviceType.toLowerCase()}s than Bronson has recorded.\n`);
            //updateDTerm(`${Object.keys(lsmDevs).length - Object.keys(bronDevs).length} more ${deviceType.toLowerCase()}s in LSM.\n`);
        } else if (Object.keys(lsmDevs).length < Object.keys(bronDevs).length) {
            let diff = Object.keys(bronDevs).length - Object.keys(lsmDevs).length;
            bronsonBigger = true;
            updateDTerm(`⚠️ WARNING: Bronson shows ${diff} more ${deviceType.toLowerCase()}s than LSM has recorded.\n`);
            //updateDTerm(`${Object.keys(bronDevs).length - Object.keys(lsmDevs).length} more ${deviceType.toLowerCase()}s in Bronson .\n`);
        } else {
            updateDTerm(`✅ OK: LSM and Bronson show the same number of ${deviceType.toLowerCase()}s.\n`);
        }
        // TODO: Find the difference and report on it
        let dif = findDiff(lsmDevs, bronDevs, "Bronson");
        dif.concat(findDiff(bronDevs, lsmDevs, "LSM"));
        // Print a summary of the comparison
    }
    return;
}

// takes in bronsonData and lsmData for a given building and device type
// and returns an array of objects of differences.
function findDiff(bigArr, smlArr, name) {
    let tmp = [];
    let bool = (name == "LSM");
    for (i in bigArr) {
        if (!(i in smlArr)) {
            console.log("Difference found: ", bigArr[i]);
            tmp.push(bigArr[i]);
            updateDTerm(`-- ❌ MISSING: ${bigArr[i].room} (${bigArr[i].hostname}) in ${name} data.\n`);
            if (bool) {
                if(bigArr[i].foundViaJackNet) {
                    updateDTerm(`---- ✅ OK: This device was recently FOUND via JackNet, it may need to be added to LSM\n`);
                } else {
                    updateDTerm(`---- ⚠️ WARNING: This device was NOT recently found via JackNet, it is likely that it needs to be removed from Bronson\n`);
                }
            }
        }
    }
    return tmp;
}

function showDataDiagInfo() {
    clearDTerm();
    updateDTerm("Diagnostics Information: \n");
    updateDTerm("This page is intended to help identify discrepencies between the data we have\n");
    updateDTerm("in Bronson's campus.csv and the data we can pull from LSM's API.\n");
    updateDTerm("The goal is to ensure that our data is as accurate as possible and to\n");
    updateDTerm("help identify rooms that may have been changed without our knowledge.\n");
    updateDTerm("Please run the sync functions before running any diagnostics.\n\n");
    updateDTerm("Note, if a device is missing from LSM, there is a chance it may need to be\n")
    updateDTerm("removed from our database rather than added to LSM's, or vice versa. Please verify\n");
    updateDTerm("any changes before making them.\n\n");
    updateDTerm("Also note, we have special rooms such as auditoriums that have AUD in the room\n");
    updateDTerm("name rather than a standard room number. These rooms may output a false positive.\n");
    return;
}

function showDatabaseInfo() {
    clearDTerm();
    updateDTerm("Database Information: \n");
    let campusData = JSON.parse(localStorage.getItem("campData"));
    if (campusData == null) {
        updateDTerm("⚠️ WARNING: No Campus Data found in local storage.\n");
        return;
    }
    // check for LSM Data
    let lsm1 = JSON.parse(localStorage.getItem("lsm_data_PROC"));
    let lsm2 = JSON.parse(localStorage.getItem("lsm_data_DISP"));
    let lsm3 = JSON.parse(localStorage.getItem("lsm_data_PJ"));
    let lsm4 = JSON.parse(localStorage.getItem("lsm_data_TP"));
    // Check for each device type w/ helper function
    //  - bool stays true if all data is present.
    let bool = checkingLSMData(lsm1, "Processors");
    bool = bool & checkingLSMData(lsm2, "Displays");
    bool = bool & checkingLSMData(lsm3, "Projectors");
    bool = bool & checkingLSMData(lsm4, "Touch Panels");
    updateDTerm("\nCampus Data Info:\n");
    // Iterate through data
    let buildings = Object.keys(campusData);
    updateDTerm(`We have data for ${buildings.length} buildings:\n`);
    buildings.forEach(function(building) {
        let rooms = campusData[building].rooms;
        updateDTerm(`-- ${building}: ${rooms.length} rooms\n`);
        rooms.forEach(function(room) {
            let roomName = room.name;
            let pingData = room.ping_data;
            let procCount = 0;
            let dispCount = 0;
            let pjCount = 0;
            let tpCount = 0;
            pingData.forEach(function(device) {
                let hnObj = device.hostname; // hostname Object
                if(hnObj.dev_type == "PROC") {
                    procCount += hnObj.num;
                } else if(hnObj.dev_type == "DISP") {
                    dispCount += hnObj.num;
                } else if(hnObj.dev_type == "PJ") {
                    pjCount += hnObj.num;
                } else if(hnObj.dev_type == "TP") {
                    tpCount += hnObj.num;
                }
            });
            updateDTerm(`---- ${roomName}: ${procCount} processors, ${dispCount} displays, ${pjCount} projectors, ${tpCount} touch panels\n`);
        });
    });
    // Final check
    if (bool) {
        updateDTerm("\n✅ OK: All Local LSM Data found. You may run diagnostics.\n");
    } else {
        updateDTerm("\n❌ ERROR: Missing Local LSM Data. Please sync LSM data before running diagnostics.\n");
        return;
    }
    // Output Data on LSM Data
    updateDTerm("\nLocal LSM Data Info:\n");
    let lsmBuildings = Object.keys(lsm1.data);
    updateDTerm(`We have LSM data for ${lsmBuildings.length} buildings:\n`);
    lsmBuildings.forEach(function(building) {
        let devicesPrcs = lsm1.data[building];
        let devicesDisps = lsm2.data[building];
        let devicesPjs = lsm3.data[building];
        let devicesTps = lsm4.data[building];
        let procCount = Object.keys(devicesPrcs).length;
        let dispCount = Object.keys(devicesDisps).length;
        let pjCount = Object.keys(devicesPjs).length;
        let tpCount = Object.keys(devicesTps).length;
        updateDTerm(`-- ${building}: ${procCount} processors, ${dispCount} displays, ${pjCount} projectors, ${tpCount} touch panels\n`);
    });
    return;
}

function checkingLSMData(lsmObj, type) {
    if (lsmObj == null) {
        updateDTerm("⚠️ WARNING: No Local LSM Data found. Please sync LSM data before running diagnostics.\n");
        return false;
    } else {
        updateDTerm(`-- ✅ OK: Local LSM Data for ${type} found.\n`);
        updateDTerm(`Last Sync: ${lsmObj.timestamp}\n`);
        return true;
    }
}

function removeLSMData() {
    clearDTerm();
    localStorage.removeItem("lsm_data_PROC");
    localStorage.removeItem("lsm_data_DISP");
    localStorage.removeItem("lsm_data_PJ");
    localStorage.removeItem("lsm_data_TP");
    updateDTerm("✅ OK: Local LSM Data removed.\n");
    return;
}

// Process Diagnostics
// LSM outputs a list of objects and we have a complex
// nested object for campus and this function will
// take the device type in question and the building and 
// output and array of objects that make comparisons easier.
async function getBuildingDeviceInfo(building, deviceType) {
    let b_ab = await getAbbrev(building);
    let campusData = JSON.parse(localStorage.getItem("campData"));
    let bronRooms = campusData[b_ab].rooms;
    let output = {
        data: {}
    }
    // check each room in bronRooms and grab Proc Hostnames
    for(let j = 0; j < bronRooms.length; j++) {
        let roomNum = bronRooms[j].name.split(" ")[1];
        let roomPD = bronRooms[j].ping_data; // Room Ping Data
        for(let k = 0; k < roomPD.length; k++) { // Iterate through devices in room.
            let ip = roomPD[k].ip; // ip Object
            let hnObj = roomPD[k].hostname; // hostname Object
            if(hnObj.dev_type == deviceType) {
                for(let l = 0; l < hnObj.num; l++) {
                    let hostnameString = b_ab + "-" + roomNum + "-" + hnObj.dev_type + (l+1);
                    output.data[bronRooms[j].name] = {
                        room: bronRooms[j].name,
                        hostname: hostnameString,
                        foundViaJackNet: (ip != "x")
                    }
                }
            }
        }
    }
    return output.data;
}

function formatLSMDevices(lsm_data) {
    let output = {
        data: {}
    };
    if(Object.keys(lsm_data).length == 0) {
        return output.data;
    }
    // lsm_data is an array of objects
    Object.values(lsm_data).forEach(function(device) {
            output.data[device["RoomName"]] = {
                room: device["RoomName"],
                hostname: device["Host Name"],
                model: device["Model"],
            }
        });
    return output.data;
}

// Database Editor Page
// This is intended to be an interface that allows users to update the
// inventory database without needing direct access to the database itself.
async function setDBEditor() {
    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("at_selected");
    if (current.length != 0) {
        current[0].classList.remove("at_selected");
    }
    let newCurrent = document.getElementById("at_dbedit");
    newCurrent.classList.add("at_selected");
    // MAYBE: get a new up-to-date copy of campData from the backend when this page is loaded
    let campData = await getCampusData();
    localStorage.setItem("campData", JSON.stringify(campData));

    let db_editor = document.createElement("div");
    db_editor.setAttribute("id", "admin_internals");
    db_editor.classList.add('at_dbedit'); //dashboard message editor, acronym
    db_editor.innerHTML = `<fieldset id="DBE_Header">
        <legend> Datbase Editor </legend>
        <p> Use this interface to update Bronson's database, specifically the inventory side.
        This page manages the data that JackNet uses to know what and where to look for. Be 
        careful when making changes here, as it can and will break things if mistakes are made.
        While updating things below, the changelog will keep track of what changes have been made.
        The changes will not be applied to the database until you hit "Save Changes to Database."
        <br>
        <fieldset>
            <legend> Changelog: </legend>
            <textarea id="DBE-Changelog" spellcheck="false" rows="8" cols="50" readonly></textarea>
        </fieldset>
        <menu id="DBE_MainMenu">
            <button id="updateDatabaseButton" class="exeButton" onclick="updateDatabaseFromEditor()"> Save Changes to Database </button>
            <button onclick="setDBBuildingAddition()"> Add Building </button>
            <button onclick="setDBEditor()"> Refresh Editor </button>
            <button onclick="setDBRoomSchedule()"> Upload Room Schedule </button>
            <div class="databaseFilterDiv">
            <label for="databaseFilter"> Search: </label>
            <textarea id="databaseFilter" placeholder="Building Name/Abbreviation" onkeyup="filterDatabase()"></textarea>
            </div>
        </menu>
        </fieldset>`;
    //let tmp = ``;
    Object.keys(campData).forEach(function(building) {
        let tmp = ``;
        let rooms = campData[building].rooms;
        let buildingName = campData[building].name;
        let lsmName = campData[building].lsm_name;
        tmp += `
        <fieldset class="dbBuildingFieldset" id="${building}-fieldset">
            <legend class="dbe-legend"> Building: ${buildingName} - (${building}) </legend>
            <menu id="${building}-buildingMenu" oninput="updateBuilding('${building}-buildingMenu')" class="DBE_Building_Menu">
            <ul class="DBE_Building_Fields">
                <li>
                <label for="dbe-${building}-name" class="DBE_Building_Label" id="dbe-${building}-nameLabel">Building Name: </label>
                <input id="dbe-${building}-name" type="text" value="${buildingName}" class="dbBuildingInput">
                </li>
                <li>
                <label for="dbe-${building}-abbrev" class="DBE_Building_Label" id="dbe-${building}-abbrevLabel">Abbreviation: </label>
                <input type="text" value="${building}" id="dbe-${building}-abbrev" class="dbBuildingSmallInput">
                </li>
                <li>
                <label for="dbe-${building}-lsmName" class="DBE_Building_Label" id="dbe-${building}-lsmNameLabel">LSM Name: </label>
                <input type="text" id="dbe-${building}-lsmName" value="${lsmName}" class="dbBuildingInput"}>
                </li>
                <li>
                <label for="dbe-${building}-zone" class="DBE_Building_Label" id="dbe-${building}-zoneLabel">Zone: </label>
                <input id="dbe-${building}-zone" type="number" class="dbBuildingSmallInput" value=${campData[building].zone} min="1" max="4">
                </li>
            </ul>
            </menu>
            <br>
            <button type="button" class="collapsible" id="${building}-colBtn"> See Rooms</button>
            <div class="collapse_content">
                <table class="dbBuildingTable">
                    <thead>
                        <tr>
                            <th scope="col">Room</th>
                            <th scope="col">Processors</th>
                            <th scope="col">Projectors</th>
                            <th scope="col">Displays</th>
                            <th scope="col">Touch Panels</th>
                            <th scope="col">WyoShares</th>
                            <th scope="col">Celing Mics</th>
                            <th scope="col">General Pool</th>
                        </tr>
                    </thead>
                    <tbody id="${building}-tbody">`;
        rooms.forEach(function(room) {
            let roomName = room.name;
            let pingData = room.ping_data;
            let procCount, dispCount, pjCount, tpCount, wsCount, micCount;
            procCount = dispCount = pjCount = tpCount = wsCount = micCount = 0;
            let gpBool = room.gp;
            // Bug:
            pingData.forEach(function(device) {
                let hnObj = device.hostname; // hostname Object
                switch(hnObj.dev_type) {
                    case "PROC":
                        procCount += 1;
                        break;
                    case "DISP":
                        dispCount += 1;
                        break;
                    case "PJ":
                        pjCount += 1;
                        break;
                    case "TP":
                        tpCount += 1;
                        break;
                    case "WS":
                        wsCount += 1;
                        break;
                    case "CMIC":
                        micCount += 1;
                        break;
                    default:
                        break;
                }
            });
            tmp += `
                <tr id="${roomName}-row" class="dbeRoomRow" oninput="updateRow('${roomName}-row')">
                    <th scope="row" class="dbRoomName"><span class="dbRoomInputName" id="${roomName}-text" value="${roomName}">${roomName}</span></th>
                    <td><input type="number" class="dbRoomInput" id="${roomName}-PROC" value="${procCount}" min="0"></td>
                    <td><input type="number" class="dbRoomInput" id="${roomName}-PJ" value="${pjCount}" min="0"></td>
                    <td><input type="number" class="dbRoomInput" id="${roomName}-DISP" value="${dispCount}" min="0"></td>
                    <td><input type="number" class="dbRoomInput" id="${roomName}-TP" value="${tpCount}" min="0"></td>
                    <td><input type="number" class="dbRoomInput" id="${roomName}-WS" value="${wsCount}" min="0"></td>
                    <td><input type="number" class="dbRoomInput" id="${roomName}-CMIC" value="${micCount}" min="0"></td>
                    <td><input type="checkbox" class="dbRoomCheckbox" id="${roomName}-GP" ${gpBool ? 'checked' : ''}></td>
                    <td><button id="${roomName}_rmvBtn" class="rmvButton" onclick="removeRoomFromBuilding('${roomName}-row')"> Remove </button></td>
                </tr>`;
        });
        tmp += `
                </tbody>
            </table>
            <menu id="${building}-roomMenu">
                <button onclick="setRoomAddition('${building}-roomMenu', '${building}-tbody')"> Add Room </button>
                <button id="${building}-compareLSMBtn" onclick="compareDBEditLSM('${building}')"> Compare Inventory With LSM </button>
            </menu>
            </div>
            <menu id="${building}-menu">
                <button id="${building}-rmvBtn" class="rmvButton" onclick="markBuildingToRemove('${building}-fieldset')"> Remove Building</button>
            </menu>
        </fieldset>`;
        db_editor.innerHTML += tmp;
    });
    // Get timestamps for last room schedule update, sort them by weekday
    let rsTimestamp = await getLastRoomScheduleUpdate();
    console.log(rsTimestamp);
    let ts_arr = JSON.parse(rsTimestamp["timestamps"]);
    let tmp_ts = ["", "", "", "", ""];
    if(ts_arr.length == 1) {
        tmp_ts = ["No File Pack has been uploaded yet"];
    } else {
        ts_arr.forEach(function(item) {
            let day = item.slice(0,2);
            console.log(day);
            switch(day) {
                case "Mo":
                    tmp_ts[0] = item;
                    break;
                case "Tu":
                    tmp_ts[1] = item;
                    break;
                case "We":
                    tmp_ts[2] = item;
                    break;
                case "Th":
                    tmp_ts[3] = item;
                    break;
                case "Fr":
                    tmp_ts[4] = item;
                    break;
                default:
                    break;
            }
        });
    }
    console.log("Room Schedule Timestamps: ", tmp_ts);
    // Add Pop-Up Modal for file upload (Room Schedule Editor)
    db_editor.innerHTML += `
    <div id="fileUploadModal" class="modal" style="display:none;">
        <form class="modal-content animate">
            <div class="fileupload_imgcontainer">
                <span onclick="cancelRSUpload()" class="close" title="Close Modal">&times;</span>
                <img src="logo.png" alt="Avatar" class="avatar">
            </div>
            <div class="modal_container" id="entry_field">
                <p> Please upload a room schedule file from 25Live. To collect the needed files, please refer to the following guide, <a href="https://github.com/UWIT-CTS-Software/bronson_online/wiki/Exporting-Schedules-From-25Live" target="_blank"> here </a></p>
                <br>
                <label for="updateFile"><b>File Upload: </b></label>
                <div class="fileUpload" id="updateFile"><p>Drag the five csv files to this <i> drop zone</i>.</p></div>
                <p id="lastUpdated-RS">Last Updated: ${tmp_ts.join(', ')}<p>
                <p id="output"></p>
            </div>
            <div class="modal_container">
                <button type="button" onclick="cancelRSUpload()">Cancel</button>
                <button id="uploadButton" type="button" style="float: right;" class="exeButton">Upload</button>
            </div>
        </form>
    </div>`;
    // replace admin_internals
    let admin_internals = document.getElementById('admin_internals');
    admin_internals.replaceWith(db_editor);
    // Additional Configurations
    let collapse = document.getElementsByClassName("collapsible");
    Array.from(collapse).forEach(function(element) {
        element.addEventListener("click", function() {
            this.classList.toggle("active");
            let content = this.nextElementSibling;
            if(content.style.display === "block") {
                content.style.display = "none";
            } else {
                content.style.display = "block";
            }
        });
    })
    // TODO: Configure the Modal Pop-Up / Drag and Drop
    const dropZone = document.getElementById("updateFile");
    const output = document.getElementById("output");
    dropZone.addEventListener("drop", dropHandler);
    window.addEventListener("dragover", (e) => {
        e.preventDefault();
    });
    window.addEventListener("drop", (e) => {
        e.preventDefault();
    });
    // Disable Enter Key in Filter
    document.getElementById('databaseFilter').addEventListener('keydown',
        function(event) {
            if(event.key === "Enter") {
                event.preventDefault();
            }
        }
    );
    // Init Changelog in SessionStorage
    sessionStorage.setItem("DBEChanges", JSON.stringify({log: []}));
    return;
}

async function getLastRoomScheduleUpdate() {
    return fetch('roomSchd/timestamps')
        .then((response) => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        }
    );
}

function filterDatabase() {
    let filter = document.getElementById("databaseFilter").value;
    let databaseBuildings = document.getElementsByClassName("dbBuildingFieldset");
    let tmp = [];
    if(filter == '') {
        for(let i = 0; i < databaseBuildings.length; i++) {
            databaseBuildings[i].hidden = false;
        }
        return;
    }
    for (let i = 0; i < databaseBuildings.length; i++) {
        let legend = databaseBuildings[i].getElementsByClassName("dbe-legend");
        let str = legend[0].innerHTML.split("Building: ")[1];
        tmp.push(str);
        if(!str.toLowerCase().includes(filter.toLowerCase())) {
            databaseBuildings[i].hidden = true;
        }
    }
    //console.log(tmp);
    return;
}

// Room Schedule Upload Functions
function setDBRoomSchedule() {
    document.getElementById('fileUploadModal').style.display='block';
    document.getElementById('uploadButton').disabled = true;
    document.getElementById('terminal').style.display = 'none';
    return;
}

function cancelRSUpload() {
    document.getElementById('fileUploadModal').style.display='none';
    document.getElementById('output').innerHTML = '';
    for(let i = 0; i < rsDataTransfer.items.length; i++) {
        rsDataTransfer.items.remove(i);
    }
    document.getElementById('terminal').style.display = 'block';
    return;
}

// Notes:
//   This is a new functionality yet to be implemented in Bronson.
//   The idea is that this will process files that are dropped into
//   the drop area.
//     I want this to add the newly dropped files to a list. When a
//   file is dropped it will need to be added to a list with an option
//   to remove. It is currently overwriting with every drop, which I am 
//   not partial too. In addition, in order to enable the push button, 
//   a total of 5 files need to be uploaded with each one corresponding to 
//   "schedule_M-F.csv". Once these five files have been collected. we can
//   move forward to processRSUpload(). THERE we basically port the python
//   scripts aggregate_schedule.py and process-csv.py. Once that is done,
//   we will post the new schedule data to the backend and update everything.
//     Note, that we should also make sure none of the rooms in our database
//   left out of the new files, and prompt the user with these conflicts.
//   This tool will not touch rooms that are not included in the upload.
//   Also inform the user a list of rooms that bronson does not have and 
//   is ignoring.
function dropHandler(ev) {
    // Prevent default behavior (Browsers opening the file)
    ev.preventDefault();
    let result = "";

    // Use the DataTransfer.files from the drop event. We store files in
    // `rsDataTransfer` (declared near top of file) so they are available later
    // when the user clicks the Upload button.
    const files = ev.dataTransfer.files;
    const targets = ['schedule_M.csv','schedule_T.csv','schedule_W.csv','schedule_R.csv','schedule_F.csv'];

    // Add any valid files from this drop to the persistent rsDataTransfer so
    // users can drag multiple times (e.g., drop one file at a time).
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (targets.includes(file.name.toString())) {
            // Remove any previously stored file with same name so the latest
            // dropped version replaces the old one.
            for (let j = 0; j < rsDataTransfer.items.length; j++) {
                const existing = rsDataTransfer.items[j].getAsFile();
                if (existing && existing.name === file.name) {
                    rsDataTransfer.items.remove(j);
                    break;
                }
            }
            rsDataTransfer.items.add(file);
        } 
    }
    // Show what files are currently inside rsDataTransfer
    for(let i = 0; i < rsDataTransfer.files.length; i++) {
        const file = rsDataTransfer.files[i];
        result += `${file.name} added<br>`;
    }

    // Determine which targets are still missing by comparing rsDataTransfer
    const presentNames = Array.from(rsDataTransfer.files).map(f => f.name);
    const missing = targets.filter(t => !presentNames.includes(t));
    if (missing.length === 0) {
        result += "All required files are present. Ready to upload.\n";
        const uploadBtn = document.getElementById("uploadButton");
        uploadBtn.disabled = false;
        uploadBtn.onclick = processRSUpload;
    } else {
        result += `Missing files: ${missing.join(', ')}\n`;
        document.getElementById("uploadButton").disabled = true;
    }

    output.innerHTML = result;
}

async function processRSUpload() {
    // Access files stored in rsDataTransfer
    if (!rsDataTransfer || rsDataTransfer.files.length === 0) {
        console.warn('No files ready for upload.');
        return;
    }
    let arr = [];
    for(let i = 0; i < rsDataTransfer.files.length; i++) {
        const file = rsDataTransfer.files[i];
        console.log("Uploading file: ", rsDataTransfer.files[i].name);
        let text = await readFileAsync(file);
        arr.push(text);
    }
    parseRSUpload(arr);
    return;
}

function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onloadend = (event => {
            resolve(event.target.result);
        });
        reader.onerror = (event => {
            reject(event.target.error);
        });
        reader.readAsText(file);
    });
}

// Effectively Port Python scripts from /src
    //   - aggrgate_csv.py
    //   - process-csv.py
    // The end result being an array of room updates. Structured somewhat
    // similarily to campData, but flattened one level.
async function parseRSUpload(arr) {
    let roomObjs = [];
    let timestamp = [];
    for(let i = 0; i < arr.length; i++) {
        let csvRows = await arr[i].split("\n");
        // First Row is always the day of the report, we will save that.
        timestamp.push(csvRows.splice(0,1)[0].split('"')[1]); // Remove Timestamp
        let collectMode = false; // For Loop Behavior Boolean
        let rmObj = { // Temporary Room Object
            name: '',
            schedule: []
        };
        for(let j = 1; j < csvRows.length-1; j++) {
            if(!collectMode){
                if(csvRows[j].includes("Event Times")) {
                    collectMode = true;
                    rmObj.name = csvRows[j-1].split(',')[0];
                }
            } else {
                if(csvRows[j+1].includes("Event Times") || j == csvRows.length - 2) {
                    collectMode = false;
                    // roomObjs insert/update
                    let rmObjFilter = roomObjs.filter(e => e.name == rmObj.name);
                    let ind = roomObjs.indexOf(rmObjFilter[0]);
                    if(roomObjs[ind] != undefined) {
                        roomObjs[ind].schedule = [...new Set(roomObjs[ind].schedule.concat(rmObj.schedule))];
                    } else {
                        roomObjs.push(rmObj);
                    }
                    rmObj = {name: '', schedule: []};
                } else {
                    //let ufRow = csvRows[j].split(',')[2];
                    const re = new RegExp("[MTWRF]+ [0-9]{4}-[0-9]{4}", 'g');
                    //let tmp = re.exec(ufRow);
                    let tmp = re.exec(csvRows[j]);
                    //console.log("Parsed UF Row: ", ufRow, tmp);
                    if(tmp != null) {
                        rmObj.schedule.push(tmp[0]);
                    }
                }
            }
        }
    }
    // TODO: These oddball values are hardcoded. These can change in the event that the external sources also change. We will need to retrieve these from a yet to be created source within Bronson. Requiring another tab.
    // Change Oddball Values in roomObjs
    const oddballs_rooms = {"BU AUD": "BU 0057", "AG AUD": "AG 0133", "AC 404A": "AC 0404", "ED AUD": "ED 0055", "CB GYM": "CB 0151", "CL 502H":"CL 0502", "EERB Lobby":"EERB 0105", "GE 311G":"GE 0311","HA 223C":"HA 0223"}; 
    // Added, ED AUD -> ED 0055, CB GYM -> CB 0155,
    //, "CL 502H":"CL 0502", "EERB Lobby":"EERB 0005", "GE 311G":"GE 0311", "HA 223C":"HA 0223"
    const oddballs_buildings = {"ESB":"ES", "STEM":"ST", "AC":"AHC", "BE":"BH"};
    for (ob in oddballs_rooms) {
        let filter = roomObjs.filter(e => e.name == ob);
        let ind = roomObjs.indexOf(filter[0]);
        if(roomObjs[ind] != undefined) {
            roomObjs[ind].name = oddballs_rooms[ob];
        }
    }
    for (ob in oddballs_buildings) { // Prefix
        let filter = roomObjs.filter(e => e.name.startsWith(ob));
        for (fi in filter) {
            let ind = roomObjs.indexOf(filter[fi]);
            if(roomObjs[ind] != undefined) {
                let tmp = roomObjs[ind].name.split(" ")[1];
                roomObjs[ind].name = oddballs_buildings[ob] + " " + tmp;
            }
        }
    }
    // Filter Out Rooms NOT in campData before sending to backend
    // Take note of those that are not present in either data.
    let campdata = JSON.parse(localStorage.getItem("campData"));
    let notFound = [];
    roomObjs = roomObjs.filter(function(room) {
        let b_ab = room.name.split(" ")[0];
        let b_rm = room.name.split(" ")[1]; // Pad this to four
        b_rm = pad(b_rm, 4);
        room.name = b_ab + " " + b_rm;
        // Check if building exists
        if(campdata[b_ab] != undefined) {
            let rmFilter = campdata[b_ab].rooms.filter(e => e.name == room.name);
            if(rmFilter.length == 0) {
                notFound.push(room.name);
                return false;
            } else {
                return true;
            }
        } else {
            notFound.push(room.name);
            return false;
        }
    });
    // Cross check roomObjs to find rooms that are not included in the upload (Approximately missing 150 rooms at the time of writing.)
    let missingInUpload = [];
    Object.keys(campdata).forEach(function(building) {
        let rooms = campdata[building].rooms;
        rooms.forEach(function(room) {
            let roomName = room.name;
            let filter = roomObjs.filter(e => e.name == roomName);
            if(filter.length == 0) {
                missingInUpload.push(roomName);
            }
        });
    });
    // Alert Message
    if(missingInUpload.length != 0 || notFound.length != 0) {
        let str0 = missingInUpload.join(", ");
        let str1 = notFound.join(", ");
        alert(`⚠️ WARNING: The following rooms (${missingInUpload.length} rooms) were not included in the upload and will not be updated: ${str0} \n ⚠️ WARNING: The following rooms (${notFound.length} rooms) were not found in Bronson's database and will be ignored: ${str1}`);
    }
    // Send to Backend in Chunks of 25 rooms at a time.
    let result = [];
    for (let i = 0; i < roomObjs.length; i += 25) {
        result.push(roomObjs.slice(i, i + 25));
    }
    // Create Object to send to backend
    for (let i = 0; i < result.length; i++) {
        output = JSON.stringify({
            rooms: result[i]
        });
        //console.log(`Result Chunk ${i}:\n`, result[i]);
        await postDBChange("update/database_roomSchedule", output); 
    }
    await postDBChange("update/roomSchd/timestamps", JSON.stringify({timestamps: timestamp}));
    // Reset page once changes are done. (TODO: Handle Errors ?)
    cancelRSUpload();
    setDBEditor();
    return;
}

// Actually Pushing the Changes to the database out of the DBEChanges array
// The behaviors for changelog SHOULD make sure no objects pushed here will make
// problems but be weary when making changes to the DBE.
async function updateDatabaseFromEditor() {
    let changelogData = JSON.parse(sessionStorage.getItem("DBEChanges"));
    // Iterate through Rooms
    let roomData = changelogData.log.filter(e => e.Type == "ROOM");
    // Need to Handle Inserts FIRST (Same with Buildings)
    let insertData = roomData.filter(e => e.Change == "INSERT");
    for(let i = 0; i < insertData.length; i++) {
        let endpoint = "insert/database_room";
        let packet = JSON.stringify({
            destination: insertData[i].Destination
        });
        await postDBChange(endpoint, packet);
    }
    let otherData = roomData.filter(e => e.Change != "INSERT");
    for(let i = 0; i < otherData.length; i++) {
        let packet = ``;
        let endpoint = ``;
        if (otherData[i].Change == "UPDATE") {
            endpoint = "update/database_room";
            packet = JSON.stringify({
                destination: otherData[i].Destination,
                newValue: otherData[i].NewValue
            });
        } else if (otherData[i].Change == "REMOVE") {
            endpoint = "remove/database_room";
            packet = JSON.stringify({
                destination: otherData[i].Destination
            });
        }
        await postDBChange(endpoint, packet);
    }
    // Iterate through Building related changes
    let buildingData = changelogData.log.filter(e => e.Type == "BUILDING");
    insertData = buildingData.filter(e => e.Change == "INSERT");
    for(let i = 0; i < insertData.length; i++) {
        let endpoint = "insert/database_building";
        let packet = JSON.stringify({
            destination: insertData[i].Destination,
            newValue: insertData[i].NewValue
        });
        await postDBChange(endpoint, packet);
    }
    otherData = buildingData.filter(e => e.Change != "INSERT");
    for(let i = 0; i < otherData.length; i++) {
        let packet = ``;
        let endpoint = ``;
        if (otherData[i].Change == "UPDATE") {
            endpoint = "update/database_building";
            packet = JSON.stringify({
                destination: otherData[i].Destination,
                newValue: otherData[i].NewValue
            });
        //  CHANGELOG TODO: BUILDING "REMOVE"
        } else if (otherData[i].Change == "REMOVE") {
            endpoint = "remove/database_building";
            packet = JSON.stringify({
                destination: otherData[i].Destination
            });
        }
        await postDBChange(endpoint, packet);
    }
    // Reset Page with new changes (due to init)
    setDBEditor();
    return;
}

async function postDBChange(endpoint, packet) {
    //console.log("DEBUG: Posting to ", endpoint, " with packet ", packet);
    return fetch(`${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": packet.length
        },
        body: packet
    }).then(response => {
        if(!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        return response;
    });
}

// Set the main menu to present inputs for the user.
function setDBBuildingAddition() {
    let mainMenu = document.getElementById("DBE_MainMenu");
    let tmp_html = `
    <ul id="RoomAddition-InputList">
    <li><label for="dbe-RoomAddition-name" class="DBE_Building_Label">Building Name: </label>
    <input type="text" class="DBE_AddBuildingInput" id="dbe-RoomAddition-name"></input>
    </li>
    <li>
    <label for="dbe-RoomAddition-abbrev" class="DBE_Building_Label"> Abbreviation: </label>
    <input type="text" class="DBE_AddBuildingInput" id="dbe-RoomAddition-abbrev"></input>
    </li>
    <li>
    <label for="dbe-RoomAddition-lsmName" class="DBE_Building_Label"> LSM Name: </label>
    <input type="text" class="DBE_AddBuildingInput" id="dbe-RoomAddition-lsmName"></input>
    </li>
    <li>
    <label for="dbe-RoomAddition-zone" class="DBE_Building_Label"> Zone: </label>
    <input type="number" class="DBE_AddBuildingInput" id="dbe-RoomAddition-zone" value="1" min="1" max="4"></input>
    </li>
    <ul>
    <button onclick="confirmDBBuildingAddition()"> Add New Building </button>
    <button onclick="cancelDBBuildingAddition()"> Cancel Addition </button>
    `;
    mainMenu.innerHTML = tmp_html;
    // TODO: Disable Enter Key on inputs

    return;
}

// Send Changelog Object to Log in SessionStorage and reset Main Menu Buttons.
function confirmDBBuildingAddition() {
    // Validate Input (Not sure, Abbreviation is 5 characters fs)
    let inputs = document.getElementsByClassName("DBE_AddBuildingInput");
    let building = "";
    let buildingName = "";
    let buildingZone = "";
    let buildingLSMName = "";
    for(let i = 0; i < inputs.length; i++) {
        let field = inputs[i].id.split("dbe-RoomAddition-")[1];
        if (inputs[i].value == "") {
            console.warn("Fields are not filled out");
            return;
        } else {
            switch(field) {
                case "name":
                    buildingName = inputs[i].value;
                    break;
                case "lsmName":
                    buildingLSMName = inputs[i].value;
                    break;
                case "abbrev":
                    building = inputs[i].value.toUpperCase();
                    if(inputs[i].value.length > 5) {
                        console.warn("Abbreviation Too Long, Please Revise.");
                        return;
                    }
                    break;
                case "zone":
                    if(inputs[i].value > 4 || inputs[i].value < 1) {
                        console.warn("Zone Outside of Range, Please Revise.");
                        return;
                    }
                    console.log("zone value", inputs[i].value);
                    buildingZone = inputs[i].value;
                    break;
                default:
                    break;
            }
        }
    }
    // Check for conflicts with campData
    let campData = JSON.parse(localStorage.getItem("campData"));
    let abbrevCCheck = Object.values(campData).filter(e => e.abbrev == building);
    let nameCCheck = Object.values(campData).filter(e => e.name == buildingName);
    let lsmCCheck = Object.values(campData).filter(e => e.lsm_name == buildingLSMName);
    let test = abbrevCCheck.concat(nameCCheck.concat(lsmCCheck));
    if(test.length != 0) {
        // Error Conflict Detected.
        console.warn("Building Addition Fields Detected Duplicate Field with other building records, please revise.");
        return;
    }
    // Build and Send Changelog Object
    let changeObj = {
        Type: "BUILDING",
        Destination: building,
        Change: "INSERT",
        Field: ["name","abbrev","lsmName","zone"],
        NewValue: [buildingName, building, buildingLSMName, buildingZone],
        Error: []
    };
    addToDBEChanges(changeObj);
    // New HTML / Fieldset
    let tmp_html = `
        <legend class="dbe-legend"> Building To Be Added: ${buildingName} - (${building}) </legend>
        <menu id="${building}-buildingMenu" oninput="updateBuilding('${building}-buildingMenu')" class="DBE_Building_Menu">
        <ul class="DBE_Building_Fields">
            <li>
            <label for="dbe-${building}-name" class="DBE_Building_Label" id="dbe-${building}-nameLabel">Building Name: </label>
            <input id="dbe-${building}-name" type="text" value="${buildingName}" class="dbBuildingInput">
            </li>
            <li>
            <label for="dbe-${building}-abbrev" class="DBE_Building_Label" id="dbe-${building}-abbrevLabel">Abbreviation: </label>
            <input type="text" value="${building}" id="dbe-${building}-abbrev" class="dbBuildingSmallInput">
            </li>
            <li>
            <label for="dbe-${building}-lsmName" class="DBE_Building_Label" id="dbe-${building}-lsmNameLabel">LSM Name: </label>
            <input type="text" id="dbe-${building}-lsmName" value="${buildingLSMName}" class="dbBuildingInput"}>
            </li>
            <li>
            <label for="dbe-${building}-zone" class="DBE_Building_Label" id="dbe-${building}-zoneLabel">Zone: </label>
            <input id="dbe-${building}-zone" type="number" class="dbBuildingSmallInput" value="${buildingZone}" min="1" max="4">
            </li>
        </ul>
        </menu>
        <br>
        <div>
            <table class="dbBuildingTable">
                <thead>
                    <tr>
                        <th scope="col">Room</th>
                        <th scope="col">Processors</th>
                        <th scope="col">Projectors</th>
                        <th scope="col">Displays</th>
                        <th scope="col">Touch Panels</th>
                        <th scope="col">WyoShares</th>
                        <th scope="col">Celing Mics</th>
                        <th scope="col">General Pool</th>
                    </tr>
                </thead>
                <tbody id="${building}-tbody">
                </tbody>
        </table>
        <menu id="${building}-roomMenu">
            <span> Due to the structure of the Backend, inserting a building with room's attached on insertion is not currently supported. This is due to the building record cascading data down to the rooms. The building record must first exist. After inserting this building, please refresh the editor and insert rooms as desired.</span>
        </menu>
        </div>
        <menu id="${building}-menu">
            <button class="rmvButton" onclick="markBuildingToRemove('${building}-fieldset')"> Remove Building</button>
        </menu>`;
    // Add New Building Fieldset
    let topFieldset = document.getElementById("DBE_Header");
    let newFieldset = document.createElement('fieldset');
    newFieldset.classList.add("dbBuildingFieldset");
    newFieldset.classList.add("dbBuildingToBeAdded");
    newFieldset.setAttribute('id', `${building}-fieldset`);
    newFieldset.innerHTML = tmp_html;
    topFieldset.after(newFieldset);
    // Reset MainMenu HTML
    cancelDBBuildingAddition();
    return;
}

function cancelDBBuildingAddition() {
    let mainMenu = document.getElementById("DBE_MainMenu");
    mainMenu.innerHTML = `
        <button id="updateDatabaseButton" class="exeButton" onclick="updateDatabaseFromEditor()"> Save Changes to Database </button>
        <button onclick="setDBBuildingAddition()"> Add Building </button>
        <button onclick="setDBEditor()"> Refresh Editor </button>
        <button onclick="setDBRoomSchedule()"> Upload Room Schedule </button>
        <div class="databaseFilterDiv">
        <label for="databaseFilter"> Search: </label>
        <textarea id="databaseFilter" placeholder="Building Name/Abbreviation" onkeyup="filterDatabase()"></textarea></div>`;
    return;
}

// Mark building to be remove, or remove a building that is to be added.
function markBuildingToRemove(fieldsetID) {
    let fieldsetEle = document.getElementById(fieldsetID);
    let buildingAbbrev = fieldsetID.split("-")[0];
    let buttonID = buildingAbbrev + "-rmvBtn";
    let buttonEle = document.getElementById(buttonID);
    let roomsButton = document.getElementById(buildingAbbrev + "-colBtn");
    let toBeRemoved = false;
    // Check for Default Values, Update Rooms Field.
    let newChange = {
        Type: "BUILDING",
        Destination: buildingAbbrev,
        Change: "REMOVE"
    };
    if(fieldsetEle.classList.contains("dbBuildingToBeAdded")) {
        fieldsetEle.remove();
    } else {
        if (fieldsetEle.classList.contains("dbBuildingToBeRemoved")) {
            fieldsetEle.classList.remove("dbBuildingToBeRemoved");
            buttonEle.classList.add("rmvButton");
            buttonEle.innerHTML = `Remove Building`;
            roomsButton.disabled = false;
            roomsButton.innerText= "See Rooms";
        } else {
            toBeRemoved = true;
            fieldsetEle.classList.add("dbBuildingToBeRemoved");
            buttonEle.classList.remove("rmvButton");
            buttonEle.innerHTML = `Add Building`;
            roomsButton.disabled = true;
            roomsButton.innerText = "See Rooms (Disabled)";
            let content = roomsButton.nextElementSibling;
            content.style.display = "none";
        }
    }
    // Disable/Enable Inputs
    let inputs = fieldsetEle.getElementsByTagName("input");
        for(let i = 0; i < inputs.length; i++) {
        if(toBeRemoved) { //Disable Inputs
            inputs[i].disabled = true;
            inputs[i].value = inputs[i].defaultValue;
        } else { // Enable Inputs
            inputs[i].disabled = false;
        }
    }
    addToDBEChanges(newChange);
    return;
}
// Presents a submenu to the user to fill in Information to load the new room.
function setRoomAddition(menuID, buildingTableID) {
    let tableMenuElement = document.getElementById(menuID);
    let building = menuID.split("-")[0];
    tableMenuElement.innerHTML = `
        <textarea id="${building}-addInput" placeholder="${building} ####"></textarea>
    <button onclick="confirmRoomAddition('${building}-addInput', '${buildingTableID}')">
            Add Room to Table </button>
    <button onclick="cancelRoomAddition('${menuID}')">
        Cancel Adding Room </button>`;
    // Disable Enter Key/Re-assign it to Confirm Button
    document.getElementById(`${building}-addInput`).addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            confirmRoomAddition(`${building}-addInput`, `${buildingTableID}`);
        }
    });
    return;
}

// Takes the user input and validates the input, this is called from the submenu when the user clicks 'Add Room'.
function confirmRoomAddition(textareaID, buildingTableID) {
    let tableElement = document.getElementById(buildingTableID);
    // Get New Room Name and Verify it's legality
    //  Checking the right abbreivation, exactly 4 numbers in the room number
    //  In addition, check to see if there is another room of the same name.
    let textAreaID = document.getElementById(textareaID);
    let roomName = textAreaID.value;
    let input_room = roomName.split(" ");
    let parent_abbrev = buildingTableID.split("-")[0];
    // TODO: Give this information to the user rather than a console warning.
    //   I think some kind of temporary Pop-Up would be well used here.
    if(input_room[0] != parent_abbrev) { 
        console.warn("Database Editor: User input does not match target building.");
        console.log(roomName);
        return;
    } else if (input_room[1].length != 4) {
        console.warn("Database Editor: User input does not match room number schema");
        console.log(roomName);
        return;
    }
    // Check for duplication
    let test = document.getElementById(roomName + "-row");
    if (test != null) {
        console.warn("Database Editor: Attempt to push duplicate record");
        console.log(roomName);
        return;
    }
    // Add new row to given building with class = dbRowToBeAdded.
    let tmp = `
    <tr id="${roomName}-row" class="dbRowToBeAdded" oninput="updateRow('${roomName}-row')">
        <th scope="row" class="dbRoomName"><input type="text" class="dbRoomInputName valid" id="${roomName}-text" value="${roomName}"></th>
        <td><input type="number" class="dbRoomInput" id="${roomName}-PROC" value="0" min="0"></td>
        <td><input type="number" class="dbRoomInput" id="${roomName}-PJ" value="0" min="0"></td>
        <td><input type="number" class="dbRoomInput" id="${roomName}-DISP" value="0" min="0"></td>
        <td><input type="number" class="dbRoomInput" id="${roomName}-TP" value="0" min="0"></td>
        <td><input type="number" class="dbRoomInput" id="${roomName}-WS" value="0" min="0"></td>
        <td><input type="number" class="dbRoomInput" id="${roomName}-CMIC" value="0" min="0"></td>
        <td><input type="checkbox" class="dbRoomCheckbox" id="${roomName}-GP"></td>
        <td><button class="rmvButton" id="${roomName}_rmvBtn" onclick="removeRoomFromBuilding('${roomName}-row')"> Remove </button></td>
    </tr>`;
    // Add new Row to Table
    tableElement.innerHTML += tmp;
    syncTablesWithChangelog();
    // DBChangelog updaet
    let changeObj = {
        Type: "ROOM",
        Destination: roomName,
        Change: "INSERT"
    }
    // Update Changelog, Note because we are adding a room this is a little different than the other changelog update written below.
    addToDBEChanges(changeObj);
    // Revert Building Menu
    let menuID = parent_abbrev +"-roomMenu";
    cancelRoomAddition(menuID);
    return;
}

function cancelRoomAddition(menuID) {
    let menuElement = document.getElementById(menuID);
    let building = menuID.split("-")[0];
    menuElement.innerHTML = `<button onclick="setRoomAddition('${building}-roomMenu', '${building}-tbody')"> Add Room </button>
    <button id="${building}-compareLSMBtn" onclick="compareDBEditLSM('${building}')"> Compare Inventory With LSM </button>`;
    return;
}

// This function counteracts a quirk with adding rows to a table with changed inputs.
// When this happens, the user-changed values revert to their default. This
// function is called after we add a row to go through the changelog
function syncTablesWithChangelog() {
    console.log("Running Table Sync With Changelog");
    let changelog = JSON.parse(sessionStorage.getItem("DBEChanges"));
    let changedRows = document.getElementsByClassName("dbRowChanged");
    for(let i = 0; i < changedRows.length; i++) {
        let filteredChanges = changelog.log.filter(e => e.Destination == changedRows[i].id.split("-")[0]);
        if (filteredChanges.length == 1) {
            let inputValues = filteredChanges[0].NewValue;
            let inputs = changedRows[i].getElementsByTagName("input");
            for(let j = 0; j < inputs.length; j++) {
                if(inputs[j].type == "number") {
                    inputs[j].value = inputValues[j];
                } else if (inputs[j].type == "checked") {
                    inputs[j].checked = inputValues[j];
                }
            }
        } else {
            console.warn("Filter did not narrow down correctly");
        }
    }
    return;
}

function removeRoomFromBuilding(rowID) {
    let rowElement = document.getElementById(rowID);
    // Update Button
    let room = rowID.split('-')[0];
    let btnID = room + '_rmvBtn';
    let btn = document.getElementById(btnID);
    let newChange = {
        Type: "ROOM",
        Destination: room,
        Change: "REMOVE"
    }
    // Check to see if row was added in current session
    if (rowElement.classList.contains("dbRowToBeAdded")) {
        rowElement.remove();
        //updateChangelogRoomAddition(room);
        addToDBEChanges(newChange);
        return;
    }
    // Move forward with standard behavior
    if (btn.classList.contains("rmvButton")) {
        btn.classList.remove("rmvButton");
        btn.innerHTML = "Add";
        rowElement.classList.add("dbRowToBeRemoved");
    } else {
        btn.classList.add("rmvButton");
        btn.innerHTML = "Remove";
        rowElement.classList.remove("dbRowToBeRemoved");
    }
    // Send Change to DBEChangelog
    addToDBEChanges(newChange);
    return;
}

// Building Changes, Preps changelog object and sends it to addToDBEChanges()
function updateBuilding(menuID) {
    let menuElement = document.getElementById(menuID);
    let inputs = menuElement.getElementsByTagName("input");
    let building = menuID.split("-")[0];
    let defaultBool = true;
    let campData = JSON.parse(localStorage.getItem("campData"));
    let exclusiveCD = Object.values(campData).filter(e => e.abbrev != building);
    //console.log("Filtered CampData (Should Be Excluding Building that got the change)", exclusiveCD);
    // Init Changelog Data
    let tmpObj = {
        Type: "BUILDING",
        Destination: building,
        Change: "UPDATE",
        Field: [],
        DefaultValue: [],
        NewValue: [],
        Error: []
    };
    // Iterate through elements.
    for(let i = 0; i < inputs.length; i++) {
        let inputElement = inputs[i];
        let inputID = inputElement.id;
        let inputLabelID = inputElement.id + "Label";
        let labelElement = document.getElementById(inputLabelID);
        // Change Obj
        tmpObj.Field.push(inputID.split('-')[2]);
        if(inputElement.value != inputElement.defaultValue) {
            defaultBool = false;
            //inputElement.classList.add("dbBuildingChanged");
            labelElement.classList.add("dbBuildingChanged");
        }else if (labelElement.classList.contains("dbBuildingChanged")) {
            //inputElement.classList.remove("dbBuildingChanged");
            labelElement.classList.remove("dbBuildingChanged");
        }
        tmpObj.DefaultValue.push(inputElement.defaultValue);
        tmpObj.NewValue.push(inputElement.value);
        // Validate Information / Look for naming conflicts... I worry this will be too slow.
        let field = inputID.split('-')[2];
        let value = inputElement.value;
        switch(field) {
            case "abbrev":
                let abbrevCCheck = Object.values(exclusiveCD).filter(e => e.abbrev == value);
                if (abbrevCCheck.length > 0 || inputs[i].value > 5) {
                    inputs[i].classList.add("invalidInput");
                    tmpObj.Error.push(true);
                } else {
                    tmpObj.Error.push(false);
                    inputs[i].classList.remove("invalidInput");
                }
                break;
            case "name":
                let nameCCheck = Object.values(exclusiveCD).filter(e => e.name == value);
                console.log(nameCCheck)
                if(nameCCheck.length > 0) {
                    inputs[i].classList.add("invalidInput");
                    tmpObj.Error.push(true);
                } else {
                    tmpObj.Error.push(false);
                    inputs[i].classList.remove("invalidInput");
                }
                break;
            case "lsmName":
                let lsmCCheck = Object.values(exclusiveCD).filter(e => e.lsm_name == value);
                if(lsmCCheck.length > 0) {
                    inputs[i].classList.add("invalidInput");
                    tmpObj.Error.push(true);
                } else {
                    tmpObj.Error.push(false);
                    inputs[i].classList.remove("invalidInput");
                }
            case "zone":
                if(inputs[i].value > 4 || inputs[i].value < 1) {
                    inputs[i].classList.add("invalidInput");
                    tmpObj.Error.push(true);
                } else {
                    tmpObj.Error.push(false);
                    inputs[i].classList.remove("invalidInput");
                }
            default:
                break;
        }
    }
    // Update Changelog
    addToDBEChanges(tmpObj);
    // Check for Default Values, Update Rooms Field.
    let roomsButton = document.getElementById(building + "-colBtn");
    if (defaultBool) {
        roomsButton.disabled = false;
        roomsButton.innerText= "See Rooms";
    } else {
        roomsButton.disabled = true;
        roomsButton.innerText = "See Rooms (Disabled)";
        let content = roomsButton.nextElementSibling;
        content.style.display = "none";
    }
    return;
}

// Called when any of the fields are changed.
function updateRow(rowElementID) {
    let rowElement = document.getElementById(rowElementID);
    let roomName = rowElementID.split("-")[0];
    rowElement.classList.add("dbRowChanged");
    
    // Go through each input in row and grab values
    let inputs = rowElement.getElementsByTagName("input");
    let defaultBool = true;
    // If this is an insertion row, we need to remove the first input as it is a text editor for the room name, which we store elsewhere.
    // if(rowElement.classList.contains("dbRowToBeAdded")) {
    //     inputs = inputs.filter(e => e.type != "text");
    // }
    let newChange = {
        Type: "ROOM",
        Destination: roomName,
        Change: "UPDATE",
        Field: [],
        DefaultValue: [],
        NewValue: []
    }
    for(let i = 0; i < inputs.length; i++) {
        let id = inputs[i].getAttribute("id");
        let devField = id.split("-")[1];
        if (devField != "text") {
            newChange.Field.push(devField);
        }
        if (inputs[i].type == "checkbox") {
            if (inputs[i].defaultChecked != inputs[i].checked) {
                defaultBool = false;
            }
            let defaultValue = (inputs[i].defaultChecked ? "1" : "0");
            let value = (inputs[i].checked ? "1" : "0");
            newChange.DefaultValue.push(defaultValue);
            newChange.NewValue.push(value);
        } else if (inputs[i].type == "number") {
            if (inputs[i].defaultValue != inputs[i].value) {
                defaultBool = false;
            }
            newChange.DefaultValue.push(inputs[i].defaultValue);
            newChange.NewValue.push(inputs[i].value);
        } else if (inputs[i].type == "text") {
            if (inputs[i].defaultValue != inputs[i].value) {
                defaultBool = false;
            }
            //newChange.DefaultValue.push(inputs[i].defaultValue);
            //newChange.NewValue.push(inputs[i].value);
        }
    }
    // Update Changelog Object
    addToDBEChanges(newChange);
    // IF ALL values are the same as original, remove dbRowChanged class
    if (defaultBool) {
        rowElement.classList.remove("dbRowChanged");
    }
    return;
}

// Prints changes to the textarea, called after the changelog object gets updated.
function updateDBChangelogHTML(changes) {
    let tmp_html = []; // This will hold changes.
    let tmp_buildings = []; // This holds buildings with changes, we use this to exclude changes to rooms if the building object is being changed.
    // TODO: Look for building changes first.
    //   Note: For buildings in here, take note when a change is detected
    //         as we will ignore room changes made prior to building changes.
    console.log(changes);
    let buildingChanges = changes.log.filter(element => element.Type == "BUILDING");
    for (let i = 0; i < buildingChanges.length; i++) {
        console.log(buildingChanges[i]);
        tmp_buildings.push(buildingChanges[i].Destination);
        //....
        // else, add changes to change log like normal.
        tmp_html.push(`---- ${buildingChanges[i].Destination}`);
        if (buildingChanges[i].Change == "UPDATE") {
            let truple = buildingChanges[i].Field.map((element, index) => {
                return [element, buildingChanges[i].DefaultValue[index], buildingChanges[i].NewValue[index]];
            });
            for(let j = 0; j < truple.length; j++) {
                if(truple[j][1] != truple[j][2]) {
                    // NonDefault Value
                    tmp_html.push(`  ${truple[j][0]} -- Changed from ${truple[j][1]} to ${truple[j][2]}`);
                }
            }
            if (buildingChanges[i].Error.includes(true)) {
                tmp_html.push(`   ERRORS DETECTED, Invalid input, potential conflict found. Changes to this object will be ignored.`);
            }
        } else if (buildingChanges[i].Change == "REMOVE") {
            tmp_html.push(`   To Be Removed`);
        } else if (buildingChanges[i].Change == "INSERT") {
            tmp_html.push(`   To Be Added`);
            if (buildingChanges[i].Error.includes(true)) {
                tmp_html.push(`   ERRORS DETECTED, Invalid input, potential conflict found`);
            }
        }
    }
    // TODO: Look for room changes
    let roomChanges = changes.log.filter(element => element.Type == "ROOM");
    for (let i = 0; i < roomChanges.length; i++) {
        console.log(roomChanges[i]);
        let roomParent = roomChanges[i].Destination.split(" ")[0];
        if (tmp_buildings.includes(roomParent)) {
            console.warn("Building change detected in ", roomParent, "Excluding changes to rooms within.");
        } else {
            // else, add changes to change log like normal.
            tmp_html.push(`---- ${roomChanges[i].Destination}`);
            if (roomChanges[i].Change == "UPDATE") {
                let truple = roomChanges[i].Field.map((element, index) => {
                    return [element, roomChanges[i].DefaultValue[index], roomChanges[i].NewValue[index]];
                });
                for(let j = 0; j < truple.length; j++) {
                    if(truple[j][1] != truple[j][2]) {
                        // NonDefault Value
                        tmp_html.push(`  ${truple[j][0]} -- Changed from ${truple[j][1]} to ${truple[j][2]}`);
                    }
                }
            } else if (roomChanges[i].Change == "REMOVE") {
                tmp_html.push(`   To Be Removed`);
            } else if (roomChanges[i].Change == "INSERT") {
                tmp_html.push(`   To Be Added`);
            }
        }
    }
    // TODO: Update Changelog object
    let changelogElement = document.getElementById("DBE-Changelog");
    changelogElement.value = '';
    for(let i = 0; i < tmp_html.length; i++) {
        changelogElement.value += tmp_html[i] + "\n";
    }
    return;
}

// Interfacing with DBEChanges
function addToDBEChanges(chgObj) {
    let removeRowBool = (chgObj.Change == "REMOVE");
    let changes = JSON.parse(sessionStorage.getItem("DBEChanges"));
    // If Type == "Building", we need to remove and revert changes within the room table.
    if(chgObj.Type == "BUILDING") {
        let changesToRooms = changes.log.filter(e => e.Type == "ROOM");
        changesToRooms = changesToRooms.filter(e => e.Destination.includes(chgObj.Destination))
        for(let i = 0; i < changesToRooms.length; i++) {
            let rmvIndex = changes.log.indexOf(changesToRooms[i]);
            changes.log.splice(rmvIndex, 1);
            revertRowChanges(changesToRooms[i].Destination);
        }
    }
    let filtered = changes.log.filter(elemnt => elemnt.Type == chgObj.Type);
    filtered = filtered.filter(elemnt => elemnt.Destination == chgObj.Destination);
    // At this point filtered contains the changes specific to that room/building.
    // If Remove Bool is True, we are removing any UPDATE Changes and reverting
    //    Changed Values back to default.
    if(removeRowBool) {
        let undoChanges = filtered.filter(e => (e.Change == "UPDATE") || (e.Change == "INSERT"));
        for (i in undoChanges) {
            let rmvIndex = changes.log.indexOf(undoChanges[i]);
            changes.log.splice(rmvIndex,1);
            if(undoChanges[i].Change == "UPDATE") {
                revertRowChanges(chgObj.Destination);
            } else if(undoChanges[i].Change == "INSERT") {
                // Save Updated Changes in SessionStorage and Update HTML Changelog.
                sessionStorage.setItem("DBEChanges", JSON.stringify(changes));
                updateDBChangelogHTML(changes);
                return;
            }
        }
    }
    // Filter to specific Change
    filtered = filtered.filter(elemnt => elemnt.Change == chgObj.Change);
    if(filtered.length == 1){
        let roomIndex = changes.log.indexOf(filtered[0]);
        // If remove is here, then we are reverting that remove
        if(changes.log[roomIndex].Change == "REMOVE") {
            changes.log.splice(roomIndex, 1);
        } else if (chgObj.DefaultValue.every((value, index) => value === chgObj.NewValue[index])) {
            console.log("Default Values Detected")
            changes.log.splice(roomIndex, 1);
        } else {
            changes.log[roomIndex] = chgObj;
        }
    } else {
        changes.log.push(chgObj);
    }
    // Save Updated Changes in SessionStorage and Update HTML Changelog.
    sessionStorage.setItem("DBEChanges", JSON.stringify(changes));
    updateDBChangelogHTML(changes);
    return;
}

// TODO: Need to check to see if room has 'toBeAdded' elements and remove if so.
function revertRowChanges(roomName) {
    // Get Row and Revert back to no changes.
    let rowElement = document.getElementById(roomName + "-row");
    if(rowElement.classList.contains("dbRowChanged")) {
        rowElement.classList.remove("dbRowChanged");
    }
    let inputs = rowElement.getElementsByTagName("input");
    for(let i = 0; i < inputs.length; i++) {
        if(inputs[i].type == "number") {
            inputs[i].value = inputs[i].defaultValue;
        } else if (inputs[i].type == "checkbox") {
            inputs[i].checked = inputs[i].defaultChecked;
        }
    }
    return;
}

// Checks the validatity of User Input when setting a new Room Name
// numbers instead of bool
//   - 1: true / Good
//   - 2: Bad Abbreviation
//   - 3: Bad Number
//   - 4: Duplicated Room Name
//  Currently Unused... This was from an old iteration of changelog and needs to be updated. See validateUserBuildingInput() to see how this update should look.
function validateUserRoomInput(defaultValue, userInput) {
    let cellID = defaultValue + "-text";
    let roomTextArea = document.getElementById(cellID);
    let text = defaultValue.split(" ");
    let userText = userInput.split(" ");
    let validInput = 0;
    if (text[0] == userText[0]) { // Check Abbreviation
        if(userText[1].length == 4) { // Check number of characters
            // Checking if input is unique when compared to existing records
            if(document.getElementById(userInput + "-text") == undefined){
                validInput = 1;
            } else if (defaultValue == userInput) {
                // the exception is when the input is set back to it's default
                validInput = 1;
            } else {
                validInput = 4;
            }
        } else {
            validInput = 3;
        }
    } else {
        validInput = 2;
    }
    // Update Field to be valid or invalid
    if(validInput == 1) {
        roomTextArea.classList.remove("invalid");
        roomTextArea.classList.add("valid");
    } else {
        roomTextArea.classList.remove("valid");
        roomTextArea.classList.add("invalid");
    }
    return validInput;
}

// This function is designed to quickly and easily display 
//  discrepencies inside the database with the data inside LSM.
//  I do not think this is very elegant also...
async function compareDBEditLSM(buildingAbbreviation) {
    let tableID = buildingAbbreviation + "-tbody";
    let tableElement = document.getElementById(tableID);
    //console.log(tableElement.children);
    let button = document.getElementById(buildingAbbreviation + "-compareLSMBtn");
    // For some reason when I try to reassign the onclick function in the button, it is not sticking. SO, I am checking the value of the innerHTML and diverting here instead.
    if (button.innerHTML == "Hide LSM Comparison") {
        removeCompareDBEditLSM(buildingAbbreviation);
        return;
    }
    // TODO: Get data for this building.
    const devices = ["PROC","DISP","PJ","TP"];
    let data = [];
    button.disabled = true;
    button.innerHTML = "Loading Data..."
    for (i in devices) {
        let tmp = await getLSMDataByType(buildingAbbreviation, devices[i]);
        // LSM does not have a formal item type for Room Proccessors like we do
        //   for projectors/touch panels/etc. Because of this, we have to 
        //   manually insert that field on the returns for processsors. The LSM 
        //   endpoint is pulling from a rather large list of model's that have 
        //   been 'sudo-labeled' as Proc's
        if(devices[i] == "PROC") {
            for(let j = 0; j < tmp.data.length; j++) {
                tmp.data[j]["Item Type"] = "Processor";
            }
        }
        data = data.concat(tmp.data);
    }
    //console.log("data", data);
    let tmpArr = []
    let tmp_inBronson = []; // Array of objects in data arr that do not have an entry inside Bronson.
    // Add Rows to each room.
    for(let i = 0; i < tableElement.children.length; i++) {
        let tmp = [];
        let item = tableElement.children[i];
        let roomName = item.id.split("-")[0];
        let rowInputs = item.getElementsByTagName("input");
        tmp_inBronson.push(roomName);
        let associated_data = data.filter(e => e.RoomName == roomName);
        if(associated_data.length == 0) {
            tmp.push(`${roomName} Not found in LSM`);
        } else {
            tmp.push(`LSM ${roomName}`);
            //console.log("rowInputs", rowInputs);
            for(let j = 0; j < rowInputs.length - 3; j++) { // -3 because we do not look at WS, CMIX, or General Pool with that endpoint ATM.
                let device = rowInputs[j].id.split("-")[1];
                switch(device) {
                    case "PROC":
                        device = "Processor";
                        break;
                    case "DISP":
                        device = "Display";
                        break;
                    case "PJ":
                        device = "Projector";
                        break;
                    case "TP":
                        device = "Touch Panel";
                        break;
                    default:
                        console.warn("Faulty Behvaior, Detected");
                        break;
                }
                //console.log("Device", device);
                let dev_data = associated_data.filter(e => e["Item Type"] == device);
                if(rowInputs[j].value != dev_data.length){
                    tmp.push(`❌ LSM Count: ${dev_data.length}`);
                } else {
                    tmp.push(`✅`);
                }
            }
        }
        tmpArr.push(tmp);
    }
    // Find Rooms That have inventory BUT is not in Bronson
    let notInBronson_data = data.filter(e => !tmp_inBronson.includes(e.RoomName));
    //console.log("Rooms with inventory, not in Bronson", notInBronson_data);
    let unknownRooms = [];
    for (let i = 0; i < notInBronson_data.length; i++) {
        if(!unknownRooms.includes(notInBronson_data[i].RoomName)) {
            unknownRooms.push(notInBronson_data[i].RoomName);
        }
    }
    // These should have their own row section appended after the main comparisons.
    // Iterate through table and insert rows with data inside tmpArr
    let tableRowCount = tableElement.children.length;
    let count = 0;
    for(let i = 0; i < tableRowCount; i++) {
        let newRow = tableElement.insertRow(i+1+count);
        newRow.classList.add("lsmCompareRow");
        for(let j = 0; j < tmpArr[count].length; j++) {
            let newCell = newRow.insertCell(j);
            newCell.innerHTML = tmpArr[count][j];
        }
        count++;
    }
    // Rooms Not in Bronson
    for(let i = 0; i < unknownRooms.length; i++) {
        let unknownData = data.filter(e => e.RoomName == unknownRooms[i]);
        let newRow = tableElement.insertRow();
        newRow.classList.add("lsmCompareRow");
        let newCell = newRow.insertCell();
        newCell.innerHTML = unknownRooms[i] + " - Not in Bronson DB";
        for(let j = 0; j < 4; j++) {
            switch(j) {
                case 0:
                    let procCell = newRow.insertCell(1);
                    let procCount = unknownData.filter(e => e["Item Type"] == "Processor").length;
                    procCell.innerHTML = procCount;
                    break;
                case 1:
                    let pjCell = newRow.insertCell(2);
                    let pjCount = unknownData.filter(e => e["Item Type"] == "Projector").length;
                    pjCell.innerHTML = pjCount;
                    break;
                case 2:
                    let dispCell = newRow.insertCell(3);
                    let dispCount = unknownData.filter(e => e["Item Type"] == "Display").length;
                    dispCell.innerHTML = dispCount;
                    break;
                case 3:
                    let tpCell = newRow.insertCell(4);
                    let tpCount = unknownData.filter(e => e["Item Type"] == "Touch Panel").length;
                    tpCell.innerHTML = tpCount;
                    break;
                default:
                    break;
            }
        }
    }
    // Update Menu / LSM button
    button.innerHTML = "Hide LSM Comparison";
    button.disabled = false;
    return;
}

function removeCompareDBEditLSM(buildingAbbrev) {
    // Remove LSM Rows
    let tableElement = document.getElementById(buildingAbbrev + "-tbody");
    let lsmRows = tableElement.getElementsByClassName("lsmCompareRow");
    for (let i = 0; i < lsmRows.length; i++) {
        lsmRows[i].remove();
        i--;
    }
    // Update Menu
    let button = document.getElementById(buildingAbbrev + "-compareLSMBtn");
    button.innerHTML = "Compare Inventory With LSM";
    //button.onclick = `compareDBEditLSM(${buildingAbbrev})`;
    return;
}

// Alias Editor
async function setAliasEditor() {
    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("at_selected");
    if (current.length != 0) {
        current[0].classList.remove("at_selected");
    }
    let newCurrent = document.getElementById("at_alias");
    newCurrent.classList.add("at_selected");
    // TODO: Get Data
    let aliasData = await getAliasData();
    let nondefaultAlias = false;
    if(aliasData.response != "Alias Table has not been updated") {
        nondefaultAlias = true;
        aliasData = JSON.parse(aliasData.response);
        console.log("Current Backend Alias Data: \n", aliasData)
    }
    // Add Alias Page
    let alias_editor = document.createElement("div");
    alias_editor.setAttribute("id", "admin_internals");
    alias_editor.classList.add('at_aliasEditor'); 
    alias_editor.innerHTML = `
    <fieldset>
        <legend> Edit Alias Table: </legend>
        <p> TODO: The alias table is currently not implemented anywhere. There needs to be checks and conversions in Diagnostics, Database Editor "Compare with LSM" Button, and the 25Live Upload document replacing the 'oddballs' constant. And, then updating the 'pingData' struct in room records that have an hostname exception.</p>
        <p> Room Name Aliases: </p>
        <div class="tableDiv">
            <table id="roomAliasTable">
                <thead>
                    <tr>
                        <th scope="col"> Bronson </th>
                        <th scope="col"> LSM </th>
                        <th scope="col"> 25Live </th>
                        <th scope="col"> Hostname Exceptions </th>
                        <th scope="col"> Options </th>
                    </tr>
                </thead>
                <tbody id="alias-tbody">
                <tr></tr>
                </tbody>
            </table>
        </div>
        <p> Building Name Aliases: </p>
        <div class="tableDiv">
            <table id="buildingAliasTable">
                <thead>
                    <tr>
                        <th scope="col"> Bronson </th>
                        <th scope="col"> LSM </th>
                        <th scope="col"> 25Live </th>
                        <th scope="col"> Options </th>
                    </tr>
                </thead>
                <tbody id="alias-tbody">
                    <tr></tr>
                </tbody>
            </table>
        </div>
        <div>
            <menu>
                <button class="exeButton" onclick="postAliasTable()"> Save Alias Table </button>
                <button id="addRoomAliasButton" onclick="addRoomAliasRow()"> Add Room Alias </button>
                <button id="addBuildingAliasButton" onclick="addBuildingAliasRow()"> Add Building Alias </button>
            </menu>
        </div>
    </fieldset>`;
    // replace admin_internals
    let admin_internals = document.getElementById('admin_internals');
    admin_internals.replaceWith(alias_editor);
    // Update Page with Data from backend and save object in sessionStorage to update with changes.
    if(nondefaultAlias) {
        aliasData.rooms = aliasData.rooms.sort((a,b) => a.name.localeCompare(b.name));
        aliasData.buildings = aliasData.buildings.sort((a,b) => a.name.localeCompare(b.name));
        sessionStorage.setItem("aliasData", JSON.stringify(aliasData));
    } else {
        sessionStorage.setItem("aliasData", JSON.stringify({buildings:[],rooms:[]}));
    }
    sessionStorage.setItem("aliasReset", JSON.stringify({rooms: []}));
    drawAliasTables();
    return;
}

// Current Backend DataElement for AliasData
async function getAliasData() {
    return fetch('aliasTable')
        .then((response) => {
            if(!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        }
    );
}

// Draw Alias Table from sessionStorage Object
function drawAliasTables() {
    let aliasData = JSON.parse(sessionStorage.getItem("aliasData"));
    let roomTable = document.getElementById("roomAliasTable").getElementsByTagName('tbody')[0];
    // Clear roomTable
    roomTable.innerHTML = `<tr></tr>`;
    // Rooms
    //console.log("roomTable, drawAliasTables()", roomTable);
    let roomRows = aliasData.rooms;
    //console.log(roomRows);
    for(let i = 0; i < roomRows.length; i++) {
        //console.log("Inserting Row for ", roomRows[i]);
        let newRow = roomTable.insertRow();
        newRow.classList.add("aliasRow");
        if(roomRows[i].status != undefined) {
            newRow.classList.add("toBeAdded");
            //delete roomRows[i].status;
        }
        newRow.setAttribute("id", `${roomRows[i].name}-row`);
        let bronsonCell = newRow.insertCell(0);
        let lsmCell = newRow.insertCell(1);
        let liveCell = newRow.insertCell(2);
        let hostCell = newRow.insertCell(3);
        let optionCell = newRow.insertCell(4);
        bronsonCell.innerHTML = `<span id="${roomRows[i].name}-alias-bronson-text">${roomRows[i].name}</span>`;
        lsmCell.innerHTML = `<input type="text" class="aliasInput" id="alias-lsm-text" placeholder="LSM Room Name" value="${roomRows[i].lsmName}">`;
        liveCell.innerHTML = `<input type="text" class="aliasInput" id="${roomRows[i].name}-alias-live-text" placeholder="25Live Room Name" value="${roomRows[i].liveName}">`;
        hostCell.innerHTML = `<input type="text" class="aliasInput" id="${roomRows[i].name}-alias-host-text" placeholder="Hostname Exception" value="${roomRows[i].hostnameException}">`;
        optionCell.innerHTML = `<button class="rmvButton" onclick="removeAliasRow('${roomRows[i].name}-row')"> Remove Alias </button>`;
    }
    aliasData.rooms = roomRows;
    // Buildings
    let buildingRows = aliasData.buildings;
    let buildingTable = document.getElementById("buildingAliasTable").getElementsByTagName('tbody')[0];
    // Clear buildingTable
    buildingTable.innerHTML = `<tr></tr>`;
    for(let i = 0; i < buildingRows.length; i++) {
        let newRow = buildingTable.insertRow();
        newRow.classList.add("aliasRow");
        if(buildingRows[i].status != undefined) {
            newRow.classList.add("toBeAdded");
            delete buildingRows[i].status;
        }
        newRow.setAttribute("id", `${buildingRows[i].name}-row`);
        let bronsonCell = newRow.insertCell(0);
        let lsmCell = newRow.insertCell(1);
        let liveCell = newRow.insertCell(2);
        let optionCell = newRow.insertCell(3);
        bronsonCell.innerHTML = `<span id="${buildingRows[i].name}-alias-bronson-text">${buildingRows[i].name}</span>`;
        lsmCell.innerHTML = `<input type="text" class="aliasInput" id="${buildingRows[i].name}-alias-lsm-text" placeholder="LSM Building Name" value="${buildingRows[i].lsmName}">`;
        liveCell.innerHTML = `<input type="text" class="aliasInput" id="${buildingRows[i].name}-alias-live-text" placeholder="25Live Building Name" value="${buildingRows[i].liveName}">`;
        optionCell.innerHTML = `<button class="rmvButton" onclick="removeAliasRow('${buildingRows[i].name}-row')"> Remove Alias </button>`;
    }
    aliasData.buildings = buildingRows;
    // Update aliasData with removed status field
    sessionStorage.setItem("aliasData", JSON.stringify(aliasData));
    return;
}

function addRoomAliasRow() {
    let table = document.getElementById("roomAliasTable").getElementsByTagName('tbody')[0];
    let count = document.getElementsByClassName("aliasRow").length;
    // Add New Row and populate with inputs.
    let newRow = table.insertRow();
    newRow.classList.add("aliasRow");
    newRow.classList.add("tmpDBRecord");
    newRow.setAttribute("id",`tmpRow-${count}`);
    let bronsonCell = newRow.insertCell(0);
    let lsmCell = newRow.insertCell(1);
    let liveCell = newRow.insertCell(2);
    let hostCell = newRow.insertCell(3);
    let optionCell = newRow.insertCell(4);
    bronsonCell.innerHTML = `<input type="text" class="aliasInput" id="alias-bronson-text" placeholder="Bronson Room Name">`;
    lsmCell.innerHTML = `<input type="text" class="aliasInput" id="alias-lsm-text" placeholder="LSM Room Name">`;
    liveCell.innerHTML = `<input type="text" class="aliasInput" id="alias-live-text" placeholder="25Live Room Name">`;
    hostCell.innerHTML = `<input type="text" class="aliasInput" id="alias-host-text" placeholder="Hostname Exception">`;
    optionCell.innerHTML = `<button onclick="confirmAliasRow('tmpRow-${count}')"> Confirm</button>
    <button onclick="cancelAliasRow('tmpRow-${count}')"> Cancel </button>`;
    // Disable Enterkey on New Inputs
    let newInputs = newRow.getElementsByTagName("input");
    for(let i = 0; i < newInputs.length; i++) {
        newInputs[i].addEventListener('keydown',
            function(event) {
                if(event.key === "Enter") {
                    event.preventDefault();
                }
            }
        );
    }
    // Disable Room Alias Button
    document.getElementById("addRoomAliasButton").disabled = true;
    return;
}

// Add Building Alias Row, similar to addRoomAliasRow()
function addBuildingAliasRow() {
    let table = document.getElementById("buildingAliasTable").getElementsByTagName('tbody')[0];
    let count = document.getElementsByClassName("aliasRow").length;
    // Create New Row...
    let newRow = table.insertRow();
    newRow.classList.add("aliasRow");
    newRow.classList.add("tmpDBRecord");
    newRow.setAttribute("id",`tmpRow-${count}`);
    let bronsonCell = newRow.insertCell(0);
    let lsmCell = newRow.insertCell(1);
    let liveCell = newRow.insertCell(2);
    let optionCell = newRow.insertCell(3);
    bronsonCell.innerHTML = `<input type="text" class="aliasInput" id="alias-bronson-text" placeholder="Bronson Building Name">`;
    lsmCell.innerHTML = `<input type="text" class="aliasInput" id="alias-lsm-text" placeholder="LSM Building Name">`;
    liveCell.innerHTML = `<input type="text" class="aliasInput" id="alias-live-text" placeholder="25Live Building Name">`;
    optionCell.innerHTML = `<button onclick="confirmAliasRow('tmpRow-${count}')"> Confirm</button>
    <button onclick="cancelAliasRow('tmpRow-${count}')"> Cancel </button>`;
    // Disable Enterkey on New Inputs
    let newInputs = newRow.getElementsByTagName("input");
    for(let i = 0; i < newInputs.length; i++) {
        newInputs[i].addEventListener('keydown',
            function(event) {
                if(event.key === "Enter") {
                    event.preventDefault();
                }
            }
        );
    }
    //
    document.getElementById("addBuildingAliasButton").disabled = true;
    return;
}

// Remove from page
function cancelAliasRow(rowId) {
    let row = document.getElementById(rowId);
    row.remove();
    // Determine Room/Building and re-enable it's button.
    // The rowId in THIS context is the same for both 
    // room and building (tmpRow). So, we look at both
    // tables for the existence of a 'tmpRow'.
    // ===
    let roomTable = document.getElementById("roomAliasTable").getElementsByClassName('tmpDBRecord');
    if (roomTable.length == 0) {
        document.getElementById('addRoomAliasButton').disabled = false;
    }
    let buildingTable = document.getElementById("buildingAliasTable").getElementsByClassName('tmpDBRecord');
    if(buildingTable.length == 0) {
        document.getElementById('addBuildingAliasButton').disabled = false;
    }
    return;
}

// Add to sessionStorage Object
function confirmAliasRow(rowId) {
    let row = document.getElementById(rowId);
    let inputs = row.getElementsByTagName("input");
    let name = row.cells[0].querySelector('input').value;
    let roomBool = inputs.length == 4 ? true : false;
    // Does this name exist inside of bronson?
    let campData = JSON.parse(localStorage.getItem("campData"));
    console.log("object values campData", Object.values(campData));
    let filter = [];
    if(roomBool) {
        let targetBuilding = name.split(" ")[0];
        let bldData = campData[targetBuilding];
        if (bldData == undefined) {
            console.log("Alias Error: Destination Room's building is not found.");
            return;
        }
        filter = bldData.rooms.filter(e => e.name == name);
    } else {
        filter = Object.values(campData).filter(e => e.abbrev == name);
        console.log("Alias Filter: \n", filter);
    }
    if(filter.length == 0) {
        console.log("Alias Error: Destination Alias does not exist in Bronson");
        return;
    }
    // Get Alias Data from storage
    let aliasData = JSON.parse(sessionStorage.getItem("aliasData"));
    // New Alias Object, insert to correct nested object.
    if(roomBool) {
        let newAlias = {
            name: name,
            lsmName: row.cells[1].querySelector('input').value,
            liveName: row.cells[2].querySelector('input').value,
            hostnameException: row.cells[3].querySelector('input').value,
            status: "toBeAdded"
        };
        aliasData.rooms.push(newAlias);
        document.getElementById("addRoomAliasButton").disabled = false;
    } else {
        let newAlias = {
            name: name,
            lsmName: row.cells[1].querySelector('input').value,
            liveName: row.cells[2].querySelector('input').value,
            status: "toBeAdded"
        };
        aliasData.buildings.push(newAlias);
        document.getElementById("addBuildingAliasButton").disabled = false;
    }
    // Push to 'aliasData'
    sessionStorage.setItem('aliasData', JSON.stringify(aliasData));
    // Remove Tmp-Row from page, redraw from Alias Table.
    row.remove();
    drawAliasTables();
    return;
}

// Remove from sessionStorageObject, add toBeRemoved classobj
//   Not super satisfied with the backup method given we will need to figure out when to update ping data when we remove an alias.
function removeAliasRow(rowID) {
    let row = document.getElementById(rowID);
    row.classList.add("toBeRemoved");
    let optionsButton = row.getElementsByTagName("button")[0];
    // Remove from AliasData
    let aliasData = JSON.parse(sessionStorage.getItem("aliasData"));
    let roomName = rowID.split("-")[0];
    let roomBool = roomName.length > 5 ? true : false;
    let backup = ``;
    // Add Backup to a secondary variable... Maybe
    if(roomBool) {
        let targetIndex = aliasData.rooms.findIndex(e => e.name == roomName);
        backup = JSON.stringify(aliasData.rooms[targetIndex]);
        aliasData.rooms.splice(targetIndex, 1);
    } else {
        let targetIndex = aliasData.buildings.findIndex(e => e.name == roomName);
        backup = JSON.stringify(aliasData.buildings[targetIndex]);
        aliasData.buildings.splice(targetIndex, 1);
    }
    // Add room name to alias reset array.
    let aliasReset = JSON.parse(sessionStorage.getItem("aliasReset"));
    aliasReset.rooms.push(roomName);
    sessionStorage.setItem("aliasReset", JSON.stringify(aliasReset));
    // Update Options Button and push updated aliasData.
    sessionStorage.setItem("aliasData", JSON.stringify(aliasData));
    optionsButton.setAttribute("onclick",`undoAliasRowRemoval('${rowID}','${backup}')`);
    optionsButton.innerHTML = "Undo";
    optionsButton.classList.remove("rmvButton");
    optionsButton.classList.add("exeButton");
    return;
}

function undoAliasRowRemoval(rowId, stringifiedBackup) {
    let row = document.getElementById(rowId);
    row.classList.remove("toBeRemoved");
    // Readd object to aliasData
    let aliasData = JSON.parse(sessionStorage.getItem("aliasData"));
    let backup = JSON.parse(stringifiedBackup);
    console.log("Backup (Post-Parse): ", backup);
    if (backup.hostnameException != undefined) {
        let target = aliasData.rooms.findIndex(e => e.name == backup.name);
        aliasData.rooms.splice(target, 0, backup);
    } else {
        let target = aliasData.buildings.findIndex(e => e.name == backup.name);
        aliasData.buildings.splice(target, 0, backup);
    }
    sessionStorage.setItem("aliasData", JSON.stringify(aliasData));
    // Update Alias Array
    let aliasReset = JSON.parse(sessionStorage.getItem("aliasReset"));
    aliasReset.rooms = aliasReset.rooms.filter(e => e != backup.name);
    sessionStorage.setItem("aliasReset", JSON.stringify(aliasReset));
    // Reset Button
    let optionsButton = row.getElementsByTagName("button")[0];
    optionsButton.classList.remove("exeButton");
    optionsButton.classList.add("rmvButton");
    optionsButton.innerHTML = "Remove Alias";
    optionsButton.setAttribute("onclick", `removeAliasRow('${rowId}')`);
    return;
}

// Collect Information from tables and package them into json to send to packend.
// "Bronson Name" : {lsmName:"",liveName:"",hostnameException:""};
async function postAliasTable() {
    // Get Room Alias Data
    let aliasData = JSON.parse(sessionStorage.getItem("aliasData"));
    // Get existing rows and update sessionStorage Object
    let rows = document.getElementsByClassName("aliasRow");
    for(let i = 0; i < rows.length; i++) {
        // Get Bronson name
        let name = rows[i].cells[0].innerText;
        //console.log("name from row: ", name);
        // determine if building alias or room alias.
        let roomBool = name.length > 5 ? true : false;
        // Get index of current row inside of aliasData
        if (roomBool) {
            let target = aliasData.rooms.findIndex(e => e.name == name);
            let aliasObj = aliasData.rooms[target];
            delete aliasObj.status;
            if(aliasObj != undefined) {
                aliasObj.lsmName = rows[i].cells[1].querySelector('input').value;
                aliasObj.liveName = rows[i].cells[2].querySelector('input').value;
                aliasObj.hostnameException = rows[i].cells[3].querySelector('input').value;
                // IF hostname exception is empty (''), add it to the aliasReset array
                if (aliasObj.hostnameException == '') {
                    console.log("Empty Hostname Exception Found on row ", name);
                    let aliasReset = JSON.parse(sessionStorage.getItem("aliasReset"));
                    aliasReset.rooms.push(name);
                    sessionStorage.setItem("aliasReset", JSON.stringify(aliasReset));
                }
                aliasData.rooms[target] = aliasObj;
            }
        } else {
            let target = aliasData.buildings.findIndex(e => e.name == name);
            let aliasObj = aliasData.buildings[target];
            if(aliasObj != undefined) {
                aliasObj.lsmName = rows[i].cells[1].querySelector('input').value;
                aliasObj.liveName = rows[i].cells[2].querySelector('input').value;
                aliasData.buildings[target] = aliasObj;
            }
        }
        // If value is different than default, update aliasData;
        // ...
        //console.log(rows[i]);
    }
    let resetReturn = await postAliasReset();
    console.log("Alias Reset Return:", resetReturn);
    // Post to backend.
    let packet = JSON.stringify(aliasData);
    return await fetch('setAliasTable', {
        method: 'POST',
        headers: {
            "Content-Type": "applciation/json",
            "Content-Length": packet.length
        },
        body: packet
    }).then((response) => {
        if(!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        setAliasEditor();
        return response;
    })
}

// When an alias is removed, or the hostname exception is removed we need to reset the inner 'room' field of ping_data to it's previous value.
async function postAliasReset() {
    let aliasReset = JSON.parse(sessionStorage.getItem("aliasReset"));
    console.log("Reseting Hostname Exception on following Rooms", aliasReset.rooms);
    let packet = JSON.stringify(aliasReset);
    return fetch('resetAlias', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Content-Length": packet.length
        },
        body: packet
    }).then((response) => {
        if(!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        return response;
    })
}