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
    // Name
    let name = document.getElementById(`techNameEdit${techName}`);
    // get copy of current tech schedules and update it
    let techObj = {
        "Name": name.value,
        "Assignment": select.value,
        "Schedule": newSchdObj
    }
    scheduleData[techObj["Name"]] = techObj;
    // DATABASE_TODO
    // need to grab this updated schedule object and post it to the backend.
    // Since this is not something that is managed indepth by the database,
    // calculating the hash value that we check in 'checkForDataUpdates()'
    // here may be neccessary.
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
                    </ol>
                </details>
                <li> 
                    <details> 
                        <summary> Database Diagnostics </summary>
                        <ol id="db_diag_list">
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
            <button onclick="runDiagnostics()"> Run Diagnostics </button>
            <button onclick="document.getElementById('diag_terminal').value = ''"> Clear Terminal </button>
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

async function getProcsByAbbrev(build_ab) {
    return await fetch('procDiag', {
        method: "POST",
        body: build_ab
    })
    .then((response) => response.json())
    .then((json) => {return json;});
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
        // Compare Data
        console.log("Bronson Devices: \n", bronDevs);
        console.log("LSM Devices: \n", lsmDevs);
        if (Object.keys(lsmDevs).length > Object.keys(bronDevs).length) {
            updateDTerm(`⚠️ WARNING: LSM shows more ${deviceType.toLowerCase()}s than Bronson has recorded.\n`);
            updateDTerm(`${Object.keys(lsmDevs).length - Object.keys(bronDevs).length} more ${deviceType.toLowerCase()}s in LSM.\n`);
        } else if (Object.keys(lsmDevs).length < Object.keys(bronDevs).length) {
            updateDTerm(`⚠️ WARNING: Bronson shows more ${deviceType.toLowerCase()}s than LSM has recorded.\n`);
            updateDTerm(`${Object.keys(bronDevs).length - Object.keys(lsmDevs).length} more ${deviceType.toLowerCase()}s in Bronson .\n`);
        } else {
            updateDTerm(`✅ OK: LSM and Bronson show the same number of ${deviceType.toLowerCase()}s.\n`);
        }
        for (let j = 0; j < lsmDevs.length; j++) {
            let counterPart = bronDevs[lsmDevs[j].RoomName];
            if(counterPart == undefined) {
                updateDTerm(`⚠️ WARNING: LSM shows a ${deviceType.toLowerCase()} in room ${lsmDevs[j].RoomName}, but Bronson has no record of a ${deviceType.toLowerCase()} in that room.\n`);
            } else {
                // Room exists in both datasets, compare Hostnames
                if(counterPart.hostname.num < lsmDevs[j].NumDevs) {
                    updateDTerm(`⚠️ WARNING: LSM shows more ${deviceType.toLowerCase()}s in room ${lsmDevs[j].RoomName} than Bronson has recorded.\n`);
                    updateDTerm(`${lsmDevs[j].NumDevs - counterPart.hostname.num} more ${deviceType.toLowerCase()}s in LSM.\n`);
                } else if(counterPart.hostname.num > lsmDevs[j].NumDevs) {
                    updateDTerm(`⚠️ WARNING: Bronson shows more ${deviceType.toLowerCase()}s in room ${lsmDevs[j].RoomName} than LSM has recorded.\n`);
                    updateDTerm(`${counterPart.hostname.num - lsmDevs[j].NumDevs} more ${deviceType.toLowerCase()}s in Bronson.\n`);
                } else {
                    updateDTerm(`✅ OK: LSM and Bronson show the same number of ${deviceType.toLowerCase()}s in room ${lsmDevs[j].RoomName}.\n`);
                }
            }
        }
    }
    return;
}

// This is tied to the run button, but it will be replaced
// with more specific functions as they are built out.
async function runDiagnostics() {
    updateDTerm("Starting Diagnostics \n");
    let buildings = await getBuildingList();
    let baArr = [];
    // Build Abbreviation Array
    for(let i = 0; i < buildings.length; i++) {
        let ba = await getAbbrev(buildings[i]);
        baArr.push(ba);
    }
    //let procData = await getProcs();
    // Due to a cap in the LSM API requests,
    // we have to do this in several parts.
    updateDTerm("Checking for Local LSM Data\n");
    if (localStorage.getItem("lsm_data") == null) {
        updateDTerm("No Local LSM Data Found, Retreiving from LSM API\n");
        let lsm = {
            data: {}
        };
        // Test Request
        // let test = await getProcs();
        // console.log("Test Request:\n",test);
        // Iterate through buildings and get procs for each
        for(let i = 0; i < buildings.length; i++) {
            baArr.push(baArr[i]);
            updateDTerm(`\nGetting Procs for ${baArr[i]} - ${buildings[i]}`);
            let tmp = await getProcsByAbbrev(baArr[i]);
            lsm.data[baArr[i]] = tmp.procs;
            //console.log(tmp);
        }
        updateDTerm("\nLSM Data Retreived\n");
        console.log("Diagnostic DEBUG: lsm_data: \n",lsm.data);
        localStorage.setItem("lsm_data", JSON.stringify(lsm.data));
    } else {
        updateDTerm("Local LSM Data Found, Using Local Data\n");
    }
    // Get Database Information to compare against.
    //  note that lsm_data has a different structure than campData
    let lsm = JSON.parse(localStorage.getItem("lsm_data"));
    let campusData = JSON.parse(localStorage.getItem("campData"));
    // Iterate through building abbreviations and compare data
    updateDTerm("Comparing LSM Data to Bronson Campus Data\n");
    // Iterate through buildings
    for(let i = 0; i < baArr.length; i++) {
        let b_ab = baArr[i];
        let b_name = buildings[i];
        updateDTerm(`\nBuilding: ${b_ab} - ${b_name}\n---------------\n`);
        let lsmProcs = formatLSMDevices(lsm[b_ab]);
        let bronPrcs = await getBuildingDeviceInfo(b_name, "PROC");
        // Compare Data
        if (Object.keys(lsmProcs).length > Object.keys(bronPrcs).length) {
            updateDTerm(`⚠️ WARNING: LSM shows more processors than Bronson has recorded.\n`);
            updateDTerm(`${Object.keys(lsmProcs).length - Object.keys(bronPrcs).length} more processors in LSM.\n`);
        } else if (Object.keys(lsmProcs).length < Object.keys(bronPrcs).length) {
            updateDTerm(`⚠️ WARNING: Bronson shows more processors than LSM has recorded.\n`);
            updateDTerm(`${Object.keys(bronPrcs).length - Object.keys(lsmProcs).length} more processors in Bronson.\n`);
        } else {
            updateDTerm(`✅ OK: LSM and Bronson show the same number of processors.\n`);
        }
        for (let j = 0; j < lsmProcs.length; j++) {
            let counterPart = bronPrcs[lsmProcs[j].RoomName];
        }
    }
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
        //let tmpObj = {};
        //console.log(`Room: ${roomNum}`);
        let roomPD = bronRooms[j].ping_data; // Room Ping Data
        for(let k = 0; k < roomPD.length; k++) { // Iterate through devices in room.
            //console.log("Iterating through roomPD: \n", roomPD[k]);
            let ip = roomPD[k].ip; // ip Object
            //console.log("IP: ", ip);
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