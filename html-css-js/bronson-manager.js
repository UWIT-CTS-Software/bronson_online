/*
▄               ▖  ▖               ▘  
▙▘▛▘▛▌▛▌▛▘▛▌▛▌▄▖▛▖▞▌▀▌▛▌▀▌▛▌█▌▛▘   ▌▛▘
▙▘▌ ▙▌▌▌▄▌▙▌▌▌  ▌▝ ▌█▌▌▌█▌▙▌▙▖▌ ▗  ▌▄▌
                          ▄▌      ▙▌  

Jack Nyman
6-17-2025

This file is set to host functions that are called throughout bronson suite
 that utilize or update session storage for a user.
 This includes data structs to update the page,
  - Checkerboard:
        Zones: {"1":[...],"2":[],"3":[],"4":[]}
  - campusData
  - Leaderboard

The scope of this file is not properly defined (sorry), but the idea is this is where we 
manage and manipulate the user storage session/local. Along with caching tool pages and 
handling reponses when the user does not have that given tool open (stashes).

TOC:
  Data
    - initLocalStorage()
    - getCampusData()
    - getZoneData()
    - getLeaderboard()
    - getLocalCampusData()
    - getRooms(buildingName)
    - getAbbrev(buildingName)
    - getLocalZoneData()
    - getBuildingNamesFromZone(zone_number)
    - getBuildingAbbrevsFromZone(zone_numebr)
  Cache
    - storeCBResponse(cbBody)
    - initCheckerboardStorage()
    - resetCBDash(zoneArray)
    - updateCBDashZone(currentZone, rooms, checked)
    - dashCheckerboard()
    - stashCheckerboard(checkerboardResponse)
    - storeJNResponse(jnBody)
    - stashJNResponse(formattedPingRequest, buildingName, deviceNames)
    - preserveCurrentTool()

Notes:
There are some pieces from other files that may fit better here, such as building the HTML
when a tool tab is selected and the Cookie/Time struct from checkerboard.
These functions are used in both Checkerboard and Jacknet.

*/

/*
░▒▓███████▓▒░ ░▒▓██████▓▒░▒▓████████▓▒░▒▓██████▓▒░  
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░  ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░  ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓████████▓▒░ ░▒▓█▓▒░  ░▒▓████████▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░  ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░  ░▒▓█▓▒░░▒▓█▓▒░ 
░▒▓███████▓▒░░▒▓█▓▒░░▒▓█▓▒░ ░▒▓█▓▒░  ░▒▓█▓▒░░▒▓█▓▒░ 
*/

// class Time {
//     constructor() { this.time = ''; }

//     setTime(time) { this.time = time; }

//     getTime() { return this.time; }
// }

// class Cookie {
//     constructor() { this.value = "none"; }

//     setCookie(id) { this.value = id; }

//     getCookie() { return this.value; }
// }

const Days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Sets local strage for data used by the various tools
//  - Zone Building list array of room names for each zone
//  - Campus.json used for various things in jacknet
//  - Leaderboard, displayed on the dashboard
// This function is called when a user visits the dashboard,
//  the hope is that it keeps things up to date if/when things 
//  change on the backend.
async function initLocalStorage() {
    // Campus Data (Effectively a clone of the hashmap)
    if(localStorage.getItem("campData") == null) {
        let campData = await getCampusData();
        localStorage.setItem("campData", JSON.stringify(campData));
    }
    // Zone Arrays
    if (localStorage.getItem("zoneData") == null) {
        let zoneData = await getZoneData();
        localStorage.setItem("zoneData", JSON.stringify(zoneData));
    }
    // Leaderboard
    if (localStorage.getItem("leaderboard") == null) {
        let leaderboard = await getLeaderboard();
        localStorage.setItem("leaderboard", JSON.stringify(leaderboard));
    }
    // Schedule
    if (localStorage.getItem("schedule") == null) {
        let schedule = await getSchedule();
        localStorage.setItem("schedule", schedule);
    }
    // CheckerboardStorage
    if (sessionStorage.getItem("cb_dash") == null) {
        initCheckerboardStorage();
    }
    // Default Dashboard Selections
    //  Leaderboard: 7-Days
    //  Schedule: Current-Day
    setLeaderWeek();
    // Set Schedule
    let today = new Date();
    console.log(`Today is ${today.getDay()}`);
    // Add today class to today's button
    let buttons = document.getElementsByClassName("today");
    for(let i = 0; i< buttons.length; i++) {
        if (buttons != null) {
            buttons[i].classList.remove("today");
        }
    }
    let todayButton = Days[today.getDay()]+"Button";
    let todayButtonObj = document.getElementById(todayButton);
    todayButtonObj.classList.add("today");
    // Set Today's Tab
    setSchedule(todayButton);
    return;
}

async function getCampusData() {
    return fetch('campusData')
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        }
    );
}

async function getZoneData() {
    return await fetch('zoneData')
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error" + response.status);
            }
            return response.json();
        }
    );
}

async function getLeaderboard() {
    return fetch("leaderboard")
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        }
    );
}

async function getSchedule() {
    return fetch("techSchedule")
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        }
    );
}

// Dashboard Stuff
// Schedule
function setSchedule(buttonID) {
    //console.log(buttonID + " Pressed");
    let current = document.getElementsByClassName("schedule_selected");
    if (current.length != 0) {
        current[0].classList.remove("schedule_selected");
    }
    let newCurrent = document.getElementById(buttonID);
    newCurrent.classList.add("schedule_selected");
    let schdData = JSON.parse(localStorage.getItem('schedule'));
    if (schdData == null) {
        console.assert("Error: Schedule Data does not exist here");
        return;
    }
    if (newCurrent.classList.contains('today')) {
        renderTimeIndicator();
    }
    // Build the table
    let tbody_HTML = `<tbody>`;
    let today = buttonID.split("Button")[0];
    // Sort Technicians by assignment
    const priorityList = ["Zone 1", "Zone 2", "Zone 3", "Zone 4"];
    let zoneTechs = [];
    let otherTechs = [];
    for(let i = 0; i < priorityList.length; i++) {
        // Iterate through techs
        for(let j = 0; j < schdData.Technicians.length; j++) {
            if(schdData.Technicians[j].Assignment == priorityList[i]) {
                zoneTechs.push(schdData.Technicians[j]);
            }
        }
    }
    // populate otherTechs
    for(let j = 0; j < schdData.Technicians.length; j++) {
        if(!priorityList.includes(schdData.Technicians[j].Assignment)) {
            otherTechs.push(schdData.Technicians[j]);
        }
    }
    let techList = zoneTechs.concat(otherTechs);
    // Build Table
    for(let i = 0; i < techList.length; i++) {
        tbody_HTML += makeTechSchdRow(techList[i], today);
    }
    tbody_HTML += `</tbody>`;
    let tbody = document.createElement('tbody');
    tbody.setAttribute("id", "schd_tbody");
    tbody.innerHTML = tbody_HTML;
    // append to table
    let table = document.getElementById("schd_tbody");
    table.replaceWith(tbody);
    return;
}

function makeTechTableHeader(firstColumn) {
    let times = getTechSchdTimeBlocks();
    let html = `<tr>
        <th scope="col" class="schdLeftIndex">${firstColumn}</th>`;
    for(i in times) {
        html += `<th scope="col" class="timeBlockTable">${times[i]}</th>`;
    }
    html += '</tr>';
    return html;
}

function makeTechSchdRow(tech, today) {
    let html = `
    <tr>
        <th scope="row">${tech.Name}</th>`;
    // get schedule timeblocks
    let timeBlocks = getTechSchdTimeBlocks();
    timeBlocks.push("7:30PM");
    // get techs schedule for the day
    let timeSwitches = [];
    let shift = tech.Schedule[today].split(",");
    for(let i = 0; i < shift.length; i++) {
        timeSwitches.push(shift[i].split(' - '))
    }
    timeSwitches = timeSwitches.flat(2);
    let onClock = false;
    let timeIndex = 0;
    let startShiftIndex, endShiftIndex = 0;
    // Iterate through 24 time blocks;
    for(let i = 0; i < timeBlocks.length-1; i++) {
        if(timeBlocks[i] == timeSwitches[timeIndex]) {
            onClock = !onClock;
            ++timeIndex;
            // I want to see when shift ends now
            startShiftIndex = i;
            if(onClock) {
                endShiftIndex = timeBlocks.indexOf(timeSwitches[timeIndex]);
                i = endShiftIndex - 1;
            }
        }
        if(onClock) {
            html += `<td class="schd${onClock}" colspan=${endShiftIndex - startShiftIndex}>${tech.Assignment}\t</td>`;
            startShiftIndex, endShiftIndex = 0;
            onClock = !onClock;
            ++timeIndex;
        } else {
            html += `<td class="schd${onClock}">\t</td>`;
        }
    }
    html += `</tr>`
    return html;
}

// The headers for scheudles
function getTechSchdTimeBlocks() {
    return ["7:30AM","8:00AM","8:30AM","9:00AM","9:30AM","10:00AM","10:30AM","11:00AM","11:30AM","12:00PM","12:30PM","1:00PM","1:30PM","2:00PM","2:30PM","3:00PM","3:30PM","4:00PM","4:30PM","5:00PM","5:30PM","6:00PM","6:30PM","7:00PM"];
}

// TODO : make a bar that indicates the time that spans the height of the tech schedule
function renderTimeIndicator() {
    return;
}

// Leaderboard
function setLeaderWeek() {
    let current = document.getElementsByClassName("leader_selected");
    if (current.length != 0) {
        current[0].classList.remove("leader_selected");
    }
    let newCurrent = document.getElementById("WeekButton");
    newCurrent.classList.add("leader_selected");
    let weekLeader = JSON.parse(localStorage.getItem("leaderboard"))["7days"];
    let leaderString = "";
    for (let i=0; i<weekLeader.length; i++) {
        leaderString += `${weekLeader[i].Name}: ${weekLeader[i].Count}\n`;
    }
    let leaderboard = document.getElementById("leaderboard");
    leaderboard.innerHTML = leaderString;
}

function setLeaderMonth() {
    let current = document.getElementsByClassName("leader_selected");
    if (current.length != 0) {
        current[0].classList.remove("leader_selected");
    }
    let newCurrent = document.getElementById("MonthButton");
    newCurrent.classList.add("leader_selected");
    let weekLeader = JSON.parse(localStorage.getItem("leaderboard"))["30days"];
    let leaderString = "";
    for (let i=0; i<weekLeader.length; i++) {
        leaderString += `${weekLeader[i].Name}: ${weekLeader[i].Count}\n`;
    }
    let leaderboard = document.getElementById("leaderboard");
    leaderboard.innerHTML = leaderString;
}

function setLeaderSemester() {
    let current = document.getElementsByClassName("leader_selected");
    if (current.length != 0) {
        current[0].classList.remove("leader_selected");
    }
    let newCurrent = document.getElementById("SemesterButton");
    newCurrent.classList.add("leader_selected");
    let weekLeader = JSON.parse(localStorage.getItem("leaderboard"))["90days"];
    let leaderString = "";
    for (let i=0; i<weekLeader.length; i++) {
        leaderString += `${weekLeader[i].Name}: ${weekLeader[i].Count}\n`;
    }
    let leaderboard = document.getElementById("leaderboard");
    leaderboard.innerHTML = leaderString;
}

// - - -- --- - - CMAPUS.JSON GET INFO FUNCTIONS
// This section contains functions for retrieving the local instance 
//  of campusJson and getting pieces of it.
function getLocalCampusData() {
    let campJSON = localStorage.getItem("campData");
    return JSON.parse(campJSON);
}

// Returns a list of buildings
async function getBuildingList() {
    let data = await getLocalCampusData();
    let bl = [];
    for(const abbrev in data) {
        bl.push(data[abbrev].name);
    }

    return bl.sort();
}

// Returns a list of rooms given a building name
async function getRooms(buildingName) {
    let buildingData = await getLocalCampusData();
    for(abbrev in buildingData) {
        if(buildingData[abbrev].name == buildingName) {
            return buildingData[abbrev].rooms.sort();
        }
    }
}

// Returns a building abbreviation given a building name
async function getAbbrev(buildingName) {
    let buildingData = await getLocalCampusData();
    for(abbrev in buildingData) {
        if(buildingData[abbrev].name == buildingName) {
            return abbrev;
        }
    }
}

function getBuildingName(buildingAbbrev) {
    let buildingData = getLocalCampusData();
    return buildingData[buildingAbbrev].name;
}

// -- - - --- - Zone Data
// getZoneData
function getLocalZoneData() {
    let zoneData = localStorage.getItem("zoneData");
    return JSON.parse(zoneData);
}

// getBuildingNamesFromZoneArray(zone_array);
//  returns a list of building names from a zone number
function getBuildingNamesFromZone(zone_number) {
    let data = getLocalZoneData();
    let zoneData = data.zones;
    // tmp value to store abbrevs
    let tmp = [];
    // iterate through zones
    for(var i = 0; i < zoneData.length; i++) {
        if (zone_number == zoneData[i].name) {
            let zoneBuildingList = zoneData[i].building_list;
            for (var j = 0; j < zoneBuildingList.length; j++) {
                tmp.push(getBuildingName(zoneBuildingList[j]));
            }
        }
    }
    return tmp;
}

function getBuildingAbbrevsFromZone(zone_number) {
    let data = getLocalZoneData();
    let zoneData = data.zones;
    for(var i = 0; i < zoneData.length; i++) {
        if(zone_number == zoneData[i].name) {
            return zoneData[i].building_list;
        }
    }
    return;
}
/*
 ░▒▓██████▓▒░ ░▒▓██████▓▒░ ░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓████████▓▒░ 
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░        
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░        
░▒▓█▓▒░      ░▒▓████████▓▒░▒▓█▓▒░      ░▒▓████████▓▒░▒▓██████▓▒░   
░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░      ░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░        
░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░░▒▓█▓▒░▒▓█▓▒░        
 ░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░░▒▓██████▓▒░░▒▓█▓▒░░▒▓█▓▒░▒▓████████▓▒░ 

This section deals with tool specific caches and stashes. The stash
is utilized when a user starts a call and clicks off the tab they
initiated it on. Also handling the dashboard widgets for a given tool.
*/

// Define the dashboard object, once it gets real values from the backend
//  users will see it on the dashboard.
function initCheckerboardStorage() {
    const initEntry = {zones: [{
        zone: "1",
        rooms: 0,
        checked: 0
    },{
        zone: "2",
        rooms: 0,
        checked: 0
    },{
        zone: "3",
        rooms: 0,
        checked: 0
    },{
        zone: "4",
        rooms: 0,
        checked: 0
    }]};
    sessionStorage.setItem("cb_dash", JSON.stringify(initEntry));
    return;
}

// sets newly called zones to zero, this is because when calculate the zone percentage,
// we are adding room numbers to these valus iteratively as they come in.
function resetCBDash(zoneArray) {
    let object = JSON.parse(sessionStorage.getItem("cb_dash"));
    for (item in object["zones"]) {
        if (object["zones"][item]["zone"] == zoneArray[item]) {
            object["zones"][item]["rooms"] = 0;
            object["zones"][item]["checked"] = 0;
        }
    }
    sessionStorage.setItem("cb_dash", JSON.stringify(object));
    return;
}

// When a building response is received it updates the dash object
// NOTE: if a user is in the middle of running checkerboard and clicks
//  dashboard before the zone completes, it will be skewed to only the 
//  receieved information. To actually update the dashboard widget they
//  need to go back to checkerboard. This could probably be fixed by 
//  making this update happen when something is stashed.
function updateCBDashZone(currentZone, rooms, checked) {
    let object = JSON.parse(sessionStorage.getItem("cb_dash"));
    for (item in object["zones"]) {
        if (object["zones"][item]["zone"] == currentZone) {
            object["zones"][item]["rooms"] += rooms;
            object["zones"][item]["checked"] += checked;
        }
    }
    sessionStorage.setItem("cb_dash", JSON.stringify(object));
    return;
}

// If cb_body is loaded when setDashboard() is called,
//  then this is called to load a HTML snippet detailing
//  the zones in checkerboard.
async function dashCheckerboard() {
    let object = JSON.parse(sessionStorage.getItem("cb_dash"));
    let cb_dashDiv = document.createElement("div");
    cb_dashDiv.classList.add("cb_dash");
    cb_dashDivHTML = `<fieldset><legend>Checkerboard Zone Overview</legend><ul class="cb_dashZones">`;
    for (item in object["zones"]) {
        if (object["zones"][item]["rooms"] != 0) {
            let percent = object["zones"][item]["checked"] / object["zones"][item]["rooms"];
            percent = String((100*percent).toFixed(5)).slice(0,5);
            cb_dashDivHTML += `<li> <label class="cbProgLabel for="${object["zones"][item]["zone"]}_prog">Zone ${object["zones"][item]["zone"]}:  ${percent}%</label><progress id="${object["zones"][item]["zone"]}_prog"value="${percent}" max="100"></progress></li>`;
        }
    }
    cb_dashDivHTML += `</ul></fieldset>`;
    cb_dashDiv.innerHTML = cb_dashDivHTML;
    return cb_dashDiv;
}

// Not sure what this would be atm
// function dashJackNet() {
//     return;
// }


// Stash functions
//  When a user is not on a tool and clicks off, we use these to handle those responses
//  to prevent loss of data so we are not throwing anything into the void.
function stashCheckerboard(checkerboardResponse) {
    let stash = JSON.parse(sessionStorage.getItem("CheckerBoard_stash"));
    //let stash = sessionStorage.getItem("CheckerBoard_stash");
    const newItem = {
        "checkerboardResponse": checkerboardResponse
    };
    //const newItem = checkerboardResponse;
    if (stash == null) {
        //sessionStorage.setItem("CheckerBoard_stash", [JSON.stringify(newItem)])
        sessionStorage.setItem("CheckerBoard_stash", JSON.stringify({"stashList": [newItem]}));
    } else {
        stash.stashList.push(newItem);
        sessionStorage.setItem("CheckerBoard_stash", JSON.stringify(stash));
    }
    // add indicator to button
    let cbButton = document.getElementById("CBButton");
    //cbButton.innerHTML = `<img class="tab_img" src="button2.png"/><span>CheckerBoard *</span>`;
    cbButton.classList.add("stashed");
    return;
}

function stashJNResponse(formattedPingRequest, buildingName, deviceNames) {
    let stash = JSON.parse(sessionStorage.getItem("JackNet_stash"));
    const newItem = {
        "formattedPingRequest": formattedPingRequest,
        "buildingName": buildingName,
        "deviceNames": deviceNames
    };
    if (stash == null) {
        sessionStorage.setItem("JackNet_stash", JSON.stringify({"stashList": [newItem]}));
    } else {
        stash["stashList"].push(newItem);
        sessionStorage.setItem("JackNet_stash", JSON.stringify(stash));
    }
    // add indicator to button
    let jnButton = document.getElementById("JNButton");
    //jnButton.innerHTML = `<img class="tab_img" src="button2.png"/><span>JackNet *</span>`;
    jnButton.classList.add("stashed");
    return;
}

// Session Storage Stuff (Tool Responses)
//  we store the most recent response for a given request in Checkerboard
//  and JackNet. There currently isnt a use for this, but I could see it being
//  helpful at somepoint. Until then it could be trimmed if need be.
function storeCBResponse(cbBody) {
    sessionStorage.setItem("cb_body", JSON.stringify(cbBody));
    return;
}

// Jack Net functions
function storeJNResponse(jnBody) {
    sessionStorage.setItem("jn_body", JSON.stringify(jnBody));
    return;
}

//preserve tool HTML
function preserveCurrentTool() {
    let currentTool = document.title.split(" ")[0];
    //
    let currentHTMLObject = document.querySelector('.program_board .program_guts');
    currentTool += "_html";
    // console.log("bronson debug: preserving:\n", currentTool);
    if(currentHTMLObject != null) {
        sessionStorage.setItem(currentTool, currentHTMLObject.innerHTML);
    } else {
        console.log("Error, programGuts is null");
    }
    return;
}