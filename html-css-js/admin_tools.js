/* 

admin_tools.js

Functions
    - sleep(ms);
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
*/
// Note, I think it would be good to put the terminal stuff in here that is currently in index_admin.html but it utilizes JQueury in a way that I am not hundred percent sure of so I will not be doing that just yet because I don't want to break anything.

// quick sleep function, used to wait for server response when jquery delays retreiveing
// something from the backend. Which should only really need to happen when an admin
// refreshes the page.
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Adds the 'Admin Tools' tab to the program header
async function setAdminBronson() {
    // Add Admin Tool Tab
    siteheader = document.getElementById("middle");
    adminTabs = document.createElement("div");
    adminTabs.classList.add("tab_row");
    adminTabs.classList.add("admin_tab");
    adminTabs.innerHTML = `<button id="adminButton" class="toolTab adminTab" onclick="setAdminTools()" type=button><img class="tab_img" src=button2.png></img><span>Admin Tools</span></button>`;
    siteheader.appendChild(adminTabs);

    // Add Admin Buttons to hamburger button
    //  - Hide Terminal
    hamburger = document.getElementById("hb_menu");
    hamburger.innerHTML += `<fieldset id="admin_hb_fieldset">
    <legend>Admin Buttons</legend>
    <button id="admin_terminalButton" class="hb_button" onclick="hideTerminal()">Hide Terminal</button>
    </fieldset>`;
}

function hideTerminal() {
    //console.log("Changing visability of the terminal");
    let termButton = document.getElementById("admin_terminalButton");
    //console.log(termButton.innerHTML);
    if(termButton.innerHTML == "Hide Terminal") {
        document.getElementById('terminal').style.display = 'none';
        termButton.innerHTML = "Show Terminal";
    } else {
        document.getElementById('terminal').style.display = 'block';
        termButton.innerHTML = "Hide Terminal";
    }
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
    if (localStorage.getItem("isMobile") === "true") 
        admin_tab_row.classList.add("mobile");
    admin_tab_row.innerHTML = `
    <button id="at_message" onclick="setMessageEditor()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Message Editor </span>
    </button>
    <button id="at_schedule" onclick="setScheduleEditor()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Schedule Editor </span>
    </button>
    ${localStorage.getItem("isMobile") === "true" ? "" : `
        <button id="at_diag" onclick="setDiag()" type="button" class="atTab">
            <img class="at_tab_img" src="button2.png"/>
            <span> Diagnostics </span>
        </button>`
    }
    <button id="at_thread" onclick="setThreadEditor()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Thread Editor </span>
    </button>`;
    // init admin tool guts
    let admin_internals = document.createElement("div");
    admin_internals.setAttribute("id", "admin_internals");
    admin_internals.innerHTML = `<p ${localStorage.getItem("isMobile") === "true" ? "class='mobile_font'" : ""}> Please Select an Administrative Tool </p>`;
    // fieldset
    let at_fieldset = document.createElement('fieldset');
    at_fieldset.classList.add('at_fieldset');
    at_fieldset.innerHTML = 
        `<legend ${localStorage.getItem("isMobile") === "true" ? "class='mobile_legend'" : ""}> Admin Tools </legend>`;
    at_fieldset.appendChild(admin_tab_row);
    at_fieldset.appendChild(admin_internals);
    at_container.appendChild(at_fieldset);

    let main_container = document.createElement('div');
    main_container.appendChild(at_container);
    main_container.classList.add('program_guts');
    progGuts.replaceWith(main_container);
}



// MESSAGE EDITOR

// Set MessageEditor
function setMessageEditor() {
    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("at_selected");
    if (current.length != 0) current[0].classList.remove("at_selected");

    let newCurrent = document.getElementById("at_message");
    newCurrent.classList.add("at_selected");

    // Update Dashboard Message
    let dashboard_message_editor = document.createElement("div");
    dashboard_message_editor.setAttribute("id", "admin_internals");
    dashboard_message_editor.classList.add('at_dme'); //dashboard message editor, acronym
    dashboard_message_editor.innerHTML = `
    <fieldset>
        <legend ${localStorage.getItem("isMobile") === "true" ? "class='mobile_legend'" : ""}> Edit Dashboard Message: </legend>
        <textarea id="dme_editor" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_font'" : ""}></textarea>
        <button onclick="setDashboardMessage()" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_button'" : ""}> Set Message </button>
        <button onclick="clearEditor()" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_button'" : ""}> Clear Editor </button> 
    </fieldset>`;

    // replace admin_internals
    let admin_internals = document.getElementById('admin_internals');
    admin_internals.replaceWith(dashboard_message_editor);

    // Retrieve current message from Database and populate it in the editor
    fetchDashboardMessage().then(message => {
        const editor = document.getElementById("dme_editor");
        if (editor) editor.value = message;
    });
}

function fetchDashboardMessage() {
    return fetch("/dashContents")
        .then(response => response.json())
        .then(data => {
            // replace literal "\n" with real newlines, database doesn't store \n properly, so it's baked into the string
            const message = data.contents.replace(/\\n/g, "\n");
            return message;
        });
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

    // replace real newlines with literal "\n", database removes them
    contents = contents.replace(/\n/g, "\\n");

    fetch("/update/dash", {
        method: "POST",
        body: contents
    });
}

function clearEditor() {
    let dme = document.getElementById("dme_editor");
    dme.value = ``;
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
        <legend ${localStorage.getItem("isMobile") === "true" ? "class='mobile_legend'" : ""}> Options </legend>
        <button class="exeButton ${localStorage.getItem("isMobile") === "true" ? "mobile_button" : ""}" onclick="updateAllTechSchedules()"> Save All Schedules </button>
        <button id="addNewTechBttn" onclick="addBlankTechSchedule(0)" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_button'" : ""}> Add Technician </button>
        <button onclick="setRemoveMode()" class="rmvButton ${localStorage.getItem("isMobile") === "true" ? "mobile_button" : ""}"> Remove Technician </button>
        ${localStorage.getItem("isMobile") ? "" : `<button onclick="exportSchd()"> Export Schedules (CSV)</button>`}
        ${localStorage.getItem("isMobile") ? "" : `
        <div class="techFilterDiv">
            <label for="techSchdFilter">Filter Technicians:</label>
            <textarea id="techSchdFilter" placeholder="Name:" onkeyup="filterTechs()"></textarea>
        </div>`}
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
    <fieldset>
    <legend ${localStorage.getItem("isMobile") === "true" ? "class='mobile_legend'" : ""}> Remove a technician from the schedule </legend>
    <ul id="techSchdRemoveList">`;
    Object.values(scheduleData).forEach(function(tech) {
        html += `<li id="rm_${tech.Name}" onclick="removeTechSelect('rm_${tech.Name}')">
            <span style="text-align: left; color: rgb(236, 200, 101)" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_font'" : ""}>${tech.Name}</span>
        </li>`;
    })
    html +=`</ul>`;
    html += `<button onclick="exitRemoveMode()" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_button'" : ""}>Exit Remove Mode</button>
    <button onclick="removeSelectedTechs()" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_button'" : ""}>Confirm Selection</button>
    </fieldset>`;
    // place new element on page
    fireSomeoneMenu.innerHTML = html;
    if (document.getElementById('techSchdRemoveTech') == undefined) {
        document.getElementById("admin_internals").appendChild(fireSomeoneMenu);
    } else {
        document.getElementById("techSchdRemoveTech").replaceWith(fireSomeoneMenu);
    }
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
}

function exitRemoveMode() {
    document.getElementById("techSchdRemoveTech").remove();
    setScheduleEditor();
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
    await updateSchedule(scheduleData);
    await setRemoveMode();
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
}

function makeTechEditTable(techObj) {
    let techTable = document.createElement('div');
    techTable.classList.add("techSchdDiv");
    techTable.setAttribute("id", techObj.Name);
    //techTable.innerText = techObj.Name;
    //let techSchedule = techObj.Schedule;
    let tableHTML = `
        <fieldset id="${techObj.Name.split(" ")[1]}_table" class="techFieldset">
        <legend ${localStorage.getItem("isMobile") === "true" ? "class='mobile_legend'" : ""}>Technician: ${techObj.Name}</legend>
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
}

function updateHours(tableID, tableHoursID) {
    let table = document.getElementById(tableID);
    let hoursEntry = document.getElementById(tableHoursID);
    let onCells = table.getElementsByClassName('schdtrue');
    //console.log("updateHours", onCells);
    hoursEntry.innerText = onCells.length * .5;
}

async function updateAllTechSchedules() {
    let schedule = {};
    let tables = document.getElementsByClassName("adminTechTable");
    for(let i = 0; i < tables.length; i++) {
        let tableId = tables[i].getAttribute("id");
        schedule = await updateTechSchedule(tableId, schedule);
    }
    console.log(schedule);
    const scheduleSorted = Object.keys(schedule)
        .sort()
        .reduce((tech, name) => {
            tech[name] = schedule[name];
            return tech;
        }, {});
    console.log("Sorted Schedule, ", scheduleSorted);
    await updateSchedule(scheduleSorted);
    await setScheduleEditor();
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
}

function clearDTerm() {
    let term = document.getElementById("diag_terminal");
    term.value = '';
}

function updateDTerm(string) {
    let term = document.getElementById("diag_terminal");
    term.value += string;
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



// THREAD EDITOR
// Thread Schedule Tasks Editor
async function setThreadEditor() {
    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("at_selected");
    if (current.length != 0) {
        current[0].classList.remove("at_selected");
    }
    let newCurrent = document.getElementById("at_thread");
    newCurrent.classList.add("at_selected");
    // Create New Element
    let thread_editor = document.createElement("div");
    thread_editor.setAttribute("id", "admin_internals");
    thread_editor.classList.add('at_thread_edit'); 
    // Get Current Thread Object
    let ts = await getThreadSchedule();
    ts = ts.response;
    let tsKeys = Object.keys(ts);
    console.log(ts);
    let tmp = `
    <fieldset>
        <legend ${localStorage.getItem("isMobile") === "true" ? "class='mobile_legend'" : ""}> Thread Schedule Editor: </legend>`;
    for(let i = 0; i < tsKeys.length; i++) {
        tmp += `<fieldset>
            <legend ${localStorage.getItem("isMobile") === "true" ? "class='mobile_legend'" : ""}>${tsKeys[i]}</legend>
            <div style="float:left">
                <input type="number" id="thread-${tsKeys[i]}-interval" value="${ts[tsKeys[i]].duration}" min="60" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_font'" : ""}> 
                <span style="color: rgba(166, 172, 114, 1)" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_font'" : ""}> Seconds between runs </span>
                <button onclick="setNewThreadDuration('${tsKeys[i]}')" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_button'" : ""}> Set Duration </button>
            </div>
            <div style="float:${localStorage.getItem("isMobile") === "true" ? "left" : "right"}">
                <span style="color: rgba(166, 172, 114, 1)" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_font'" : ""}> Last Run: ${new Date(ts[tsKeys[i]].timestamp).toLocaleString()} </span>
                <button onclick="resetThreadInterval('${tsKeys[i]}')" ${localStorage.getItem("isMobile") === "true" ? "class='mobile_button'" : ""}> Run Now </button>
            </div>
            </fieldset>`;
    }
    tmp += `</fieldset>`;
    thread_editor.innerHTML = tmp;
    // replace admin_internals
    let admin_internals = document.getElementById('admin_internals');
    admin_internals.replaceWith(thread_editor);
}

async function getThreadSchedule() {
    return fetch('threadSchedule')
        .then((response) => {
            if(!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        }
    );
}

async function resetThreadInterval(threadName) {
    let packet = {
        task_name: threadName,
    };
    packet = JSON.stringify(packet);
    return fetch('resetThreadInterval', {
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

function setNewThreadDuration(taskName) {
    let inputId = `thread-${taskName}-interval`;
    let value = document.getElementById(inputId).value;
    console.log(value);
    let packet = {
        task: taskName,
        new_duration: value,
    };
    return fetch('setThreadDuration', {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Content-Length": packet.length
        },
        body: JSON.stringify(packet)
    }).then((response) => {
        if(!response.ok) {
            throw new Error("HTTP error " + response.status);
        }
        return response;
    })
}