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

    //   DATABASE_TODO - once functional, uncomment line below.
    // await checkForDataUpdates()

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
    <button id="at_diag" onclick="setDiag()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Diagnostics </span>
    </button>
    <button id="at_dbedit" onclick="setDBEditor()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Database Editor </span>
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
        <button onclick="updateAllTechSchedules()"> Save All Schedules </button>
        <button id="addNewTechBttn" onclick="addBlankTechSchedule(0)"> Add a Technician </button>
        <button onclick="setRemoveMode()"> Remove a Technician </button>
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
    // update hours for everyone
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
function setDBEditor() {
    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("at_selected");
    if (current.length != 0) {
        current[0].classList.remove("at_selected");
    }
    let newCurrent = document.getElementById("at_dbedit");
    newCurrent.classList.add("at_selected");
    // Get Data to populate page with
    let campData = JSON.parse(localStorage.getItem("campData"));
    if (campData == null) {
        console.error("No Campus Data found in local storage.");
        return;
    }

    let db_editor = document.createElement("div");
    db_editor.setAttribute("id", "admin_internals");
    db_editor.classList.add('at_dbedit'); //dashboard message editor, acronym
    db_editor.innerHTML = `<fieldset>
        <legend> Datbase Editor </legend>
        <p> Use this interface to update Bronson's database, specifically the inventory side.
        This page manages the data that JackNet uses to know what and where to look for. Be 
        careful when making changes here, as it can and will break things if mistakes are made.
        While updating things below, the changelog will keep track of what changes have been made.
        The changes will not be applied to the database until you hit "Save Changes to Database."
        <br>
        <br>
        TODO's:
        This page needs the backend infrastructure that actually updates the PostgreSQL database, 
        along with updating the campus.csv file. (Maybe make sure the database is updating 
        correctly before tackling the campus.csv file also)</p>
        <fieldset>
            <legend> Changelog: </legend>
            <textarea id="DBE-Changelog" spellcheck="false" rows="8" cols="50" readonly></textarea>
        </fieldset>
        <menu>
            <button id="updateDatabaseButton" onclick="updateDatabaseFromEditor()"> Save Changes to Database </button>
            <button onclick="setDBEditor()"> Refresh Editor </button>
            <button onclick="setAddDBBuilding()"> Add Building </button>
        </menu>
        </fieldset>`;
    //let tmp = ``;
    Object.keys(campData).forEach(function(building) {
        let tmp = ``;
        let rooms = campData[building].rooms;
        let buildingName = campData[building].name;
        let lsmName = campData[building].lsm_name;
        tmp += `
        <fieldset class="dbBuildingFieldset">
            <legend> Building: ${buildingName} - ${building} </legend>
            <menu id="${building}-buildingMenu" oninput="updateBuilding('${building}-buildingMenu')">
            <label for="dbe-${building}-name">Building Name: </label>
            <input id="dbe-${building}-name" type="text" value="${buildingName}" class="dbBuildingInput">
            <br>
            <label for="dbe-${building}-abbrev">Abbreviation: </label>
            <input type="text" value="${building}" id="dbe-${building}-abbrev" class="dbBuildingSmallInput">
            <br>
            <label for="dbe-${building}-lsmName">LSM Name: </label>
            <input type="text" id="dbe-${building}-lsmName" value="${lsmName}" class="dbBuildingInput"}>
            <br>
            <label for="dbe-${building}-zone">Zone: </label>
            <input id="dbe-${building}-zone" type="number" class="dbBuildingSmallInput" value=${campData[building].zone} min="1" max="4">
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
            pingData.forEach(function(device) {
                let hnObj = device.hostname; // hostname Object
                switch(hnObj.dev_type) {
                    case "PROC":
                        procCount += hnObj.num;
                        break;
                    case "DISP":
                        dispCount += hnObj.num;
                        break;
                    case "PJ":
                        pjCount += hnObj.num;
                        break;
                    case "TP":
                        tpCount += hnObj.num;
                        break;
                    case "WS":
                        wsCount += hnObj.num;
                        break;
                    case "CMIC":
                        micCount += hnObj.num;
                        break;
                    default:
                        break;
                }
            });
            tmp += `
                <tr id="${roomName}-row" oninput="updateRow('${roomName}-row')">
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
                <button id="compareLSMBtn" onclick="compareDBEditLSM('${building}')"> Compare Inventory With LSM </button>
            </menu>
            </div>
            <menu id="${building}-menu">
                <button onclick="markBuildingToRemove(${building})"> Remove Building </button>
            </menu>
        </fieldset>`;
        db_editor.innerHTML += tmp;
    });
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
    // Init Changelog in SessionStorage
    sessionStorage.setItem("DBEChanges", JSON.stringify({log: []}));
    return;
}

// TODO
// Post the changes made in the editor to the database, need to be progmatic about it. This tab is a mess and I need to clean up the changelog mechanics until I worry about this, but most of whats currently here will not work.
function updateDatabaseFromEditor() {
    let changelog = document.getElementById("db_changelog");
    let log = changelog.value.split("\n");
    let packet = {
        data: []
    }
    // Create an object of rooms with changes
    let changedRows = document.getElementsByClassName("dbRowChanged");
    // Iterate through changed rows;
    for(let i = 0; i < changedRows.length; i++) {
        let inputs = changedRows[i].getElementsByTagName("input");
        // Get RoomName/ID Info
        let roomName = inputs[0].getAttribute("id").split("-")[0];
        //console.log(roomName);
        // If text is changed, it is an update
        let roomObj = {
            mode: "UPDATE", // UPDATE (stock) or REPLACE (room name change)
            target: roomName, // Room Name
            info: [] // [#dev1, #dev2, ... , #dev6, gp_bool];
        }
        for (let j = 0; j < inputs.length; j++) {
            // Examine Attributes (number and checkbox)
            if (inputs[j].type == "number") {
                roomObj.info.push(inputs[j].value);
            } else if (inputs[j].type == "checkbox") {
                roomObj.info.push(inputs[j].checked);
            }
        }
        packet.data.push(roomObj);
    }
    // Iterate through rows to be added
    let addedRows = document.getElementsByClassName("dbRowToBeAdded");
    for(let i = 0; i < addedRows.length; i++) {
        let inputs = addedRows[i].getElementsByTagName("input");
        let roomObj = {
            mode: "ADD",
            target: "",
            info: []
        }
        for(let j = 0; j < inputs.length; j++) {
            switch(inputs[j].type) {
                case "text":
                    roomObj.target = inputs[j].value;
                    break;
                case "number":
                    roomObj.info.push(inputs[j].value);
                    break;
                case "checked":
                    roomObj.info.push(inputs[j].checked);
                    break;
                default:
                    break;
            }
        }
        packet.data.push(roomObj);
    }
    // Iterate through rows that need to be removed
    let removedRows = document.getElementsByClassName("dbRowToBeRemoved");
    for(let i = 0; i < removedRows.length; i++) {
        let rowID = removedRows[i].getAttribute("id").split("-")[0];
        let roomObj = {
            mode: "REMOVE",
            target: rowID
        };
        packet.data.push(roomObj);
    }
    // Prep Request to Backend
    console.log(packet);
    return;
}

// TODO : When a user wants to add a new building that we do not currently have in Bronson, we have some validation things to do, No duplicate Names or ABBREV Names, Test the LSM Name, etc. Need to mimic the RoomAddition functions below
function setDBBuildingAddition() {
    return;
}

function confirmDBBuildingAddition() {
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
    <button id="compareLSMBtn" onclick="compareDBEditLSM('${building}')"> Compare Inventory With LSM </button>`;
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

// TODO: Building Changes, these are more overreaching, because of this, changing something in the building menu will disable the user's ability to edit a specific room for that building. 
function updateBuilding(menuID) {
    let menuElement = document.getElementById(menuID);
    let inputs = menuElement.getElementsByTagName("input");
    let building = menuID.split("-")[0];
    let defaultBool = true;
    // Init Changelog Data
    let tmpObj = {
        Type: "BUILDING",
        Destination: building,
        Change: "UPDATE",
        Field: [],
        DefaultValue: [],
        NewValue: []
    };
    // Iterate through elements.
    for(let i = 0; i < inputs.length; i++) {
        let inputElement = inputs[i];
        let inputID = inputElement.id;
        // Change Obj
        tmpObj.Field.push(inputID.split('-')[2]);
        if(inputElement.value != inputElement.defaultValue) {
            defaultBool = false;
            inputElement.classList.add("dbBuildingChanged");
        }else if (inputElement.classList.contains("dbBuildingChanged")) {
            inputElement.classList.remove("dbBuildingChanged");
        }
        tmpObj.DefaultValue.push(inputElement.defaultValue);
        tmpObj.NewValue.push(inputElement.value);
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
        newChange.Field.push(devField);
        if (inputs[i].type == "checkbox") {
            if (inputs[i].defaultChecked != inputs[i].checked) {
                defaultBool = false;
            }
            newChange.DefaultValue.push(inputs[i].defaultChecked);
            newChange.NewValue.push(inputs[i].checked);
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
            newChange.DefaultValue.push(inputs[i].defaultValue);
            newChange.NewValue.push(inputs[i].value);
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
        } else if (buildingChanges[i].Change == "REMOVE") {
            tmp_html.push(`   To Be Removed`);
        } else if (buildingChanges[i].Change == "INSERT") {
            tmp_html.push(`   To Be Added`);
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

function compareDBEditLSM(buildingAbbreviation) {
    return;
}