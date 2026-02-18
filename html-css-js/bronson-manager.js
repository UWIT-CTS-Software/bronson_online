/*
▄               ▖  ▖               ▘  
▙▘▛▘▛▌▛▌▛▘▛▌▛▌▄▖▛▖▞▌▀▌▛▌▀▌▛▌█▌▛▘   ▌▛▘
▙▘▌ ▙▌▌▌▄▌▙▌▌▌  ▌▝ ▌█▌▌▌█▌▙▌▙▖▌ ▗  ▌▄▌
                          ▄▌      ▙▌  

TOC:
  Data
    - initLocalStorage()
    - getCampusData()
    - getZoneData()
    - getLeaderboard()
    - getSpares()
    - getSchedule()
    - setDashboardDefaults()
    - getLocalCampusData()
        - getBuilding(abbrev)
        - getBuildingList()
        - getRooms(buildingName)
        - getAbbrev(buildingName)
        - getBuildingName(buildingAbbrev)
    - getLocalZoneData()
        - getBuildingNamesFromZone(zone_number)
        - getBuildingAbbrevsFromZone(zone_numebr)
    - pad(n, width, z)
  Cache/Stash
    - stashCheckerboard(checkerboardResponse)
    - stashJNResponse(formattedPingRequest, buildingName, deviceNames)
    - storeCBResponse(cbBody) --------------------------------------- UNUSED
    - storeJNResponse(jnBody) --------------------------------------- UNUSED
    - preserveCurrentTool()
  Dashboard Helpers
    - initCheckerboardStorage()
    - dashCheckerboardHTML()
    - dashCheckerboard()
    - setSchedule(buttonID)
    - setUserSchedule() ------------------------------------- DB_TODO / SSO
    - makeTechTableHeader(firstColumn)
    - makeTechSchdRow(techObj, today)
    - getTechSchdTimeBlocks()
    - renderTimeIndicator() ---------------------------------------- TODO
    - setLeader(jsonValue)
    - rawTimeFormat(rawTime)
    - dashSpares()
    - isMobile() -------------------------------------------------- UNUSED

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

Notes:
There are some pieces from other files that may fit better here, such as building the HTML
when a tool tab is selected and the Cookie/Time struct from checkerboard.
These functions are used in Checkerboard, Jacknet, and the dashboard.

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

const Days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DevTypes = ["PROC", "PJ", "DISP", "TP", "WS", "CMIC"]
// Sets local strage for data used by the various tools
//  - Zone Building list array of room names for each zone
//  - Campus.json used for various things in jacknet
//  - Leaderboard
// This function is called when a user visits the dashboard,
//  the hope is that it keeps things up to date if/when things 
//  change on the backend.
async function initLocalStorage() {
    // Campus Data (Effectively a clone of the database)
    let campData = await getCampusData();
    localStorage.setItem("campData", JSON.stringify(campData));
    
    // Zone Arrays
    if (localStorage.getItem("zoneData") == null) {
        let zoneData = await getZoneData();
        localStorage.setItem("zoneData", JSON.stringify(zoneData));
    }
    // Leaderboard
    let leaderboard = await getLeaderboard();
    localStorage.setItem("leaderboard", JSON.stringify(leaderboard));
    // Spares
    let spares = await getSpares();
    //console.log(spares["spares"]);
    localStorage.setItem("spares", JSON.stringify(spares["spares"]));
    // CheckerboardStorage
    if (sessionStorage.getItem("db_checker") == null) {
        initCheckerboardStorage();
    }
    // Once data is loaded, set default tab selection
    if(document.title.includes("Dashboard")) {
        setDashboardDefaults();
        dashCheckerboard(); // poplate cb_dash
        dashSpares(); // populate db_spares
        dashTickex();
    }
    // Detect whether page is on Mobile
    localStorage.setItem("isMobile", isMobile());
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

async function getSpares() {
    return fetch("spares")
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
        }).then(json => {
            /* return JSON.parse(json); */
            return json;
        });
}

function setDashboardDefaults() {
    // Default Dashboard Selections
    //  Leaderboard: 7-Days
    //  Schedule: Current-Day
    //setLeaderWeek();
    setLeader("7days");
    // Set Schedule
    let today = new Date();
    // Add today class to today's button
    let buttons = document.getElementsByClassName("today");
    for(let i = 0; i< buttons.length; i++) {
        if (buttons != null) {
            buttons[i].classList.remove("today");
        }
    }

    let day;
    if (today.getDay() == 0 || today.getDay() == 6) {
        day = 1;
    } else {
        day = today.getDay();
    }
    let todayButton = Days[day]+"Button";
    let todayButtonObj = document.getElementById(todayButton);
    todayButtonObj.classList.add("today");
    // Set Today's Tab
    setSchedule(todayButton);
    // populate overview
    // let db_checker_obj = getElementsByClassName("db_checker")[0];
    // db_checker_obj.innerHTML = dashCheckerboard();
    return;
}

// - - -- --- - - CMAPUS.JSON GET INFO FUNCTIONS
// This section contains functions for retrieving the local instance 
//  of campusJson and getting pieces of it.
function getLocalCampusData() {
    let campJSON = localStorage.getItem("campData");
    return JSON.parse(campJSON);
}

async function getBuilding(abbrev) {
    let data = await getLocalCampusData();
    for (building in data) {
        if(building == abbrev) {
            return data[building];
        }
    }
    return data[abbrev];
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
    let abbrevs = getLocalZoneData();

    let buildings = getLocalCampusData();
    let ret_arr = [];
    abbrevs[`${zone_number}`].building_list.forEach(function(abbrev) {
        ret_arr.push(buildings[abbrev].name);
    });

    return ret_arr;
}

function getBuildingAbbrevsFromZone(zone_number) {
    let data = getLocalZoneData();
    
    return data[`${zone_number}`]["building_list"];
}

// pad()
//  n     - what you are padding
//  width - number of space
//  z     - what you are padding with (optional, default: 0)
function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendNotification (data, timeout) {
    await sleep(timeout);

    if (data == undefined || !data) { return false }
    var title = (data.title === undefined) ? 'Notification' : data.title
    var clickCallback = data.clickCallback
    var message = (data.message === undefined) ? 'null' : data.message
    var icon = (data.icon === undefined) ? 'https://cdn2.iconfinder.com/data/icons/mixed-rounded-flat-icon/512/megaphone-64.png' : data.icon
    var sendNotification = function (){
        var notification = new Notification(title, {
            icon: icon,
            body: message
        })
        if (clickCallback !== undefined) {
            notification.onclick = function () {
                clickCallback()
                notification.close()
            }
        }
    }

    if (!window.Notification) {
        return false
    } else {
        if (Notification.permission === 'default') {
            Notification.requestPermission(function (p) {
                if (p !== 'denied') {
                    sendNotification()
                }
            })
        } else {
            sendNotification()
        }
    }
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

// --------- Stash functions
//  When a user is not on a tool and clicks off, we use these to handle those responses
//  to prevent loss of data so we are not throwing anything into the void.
function stashCheckerboard(checkerboardResponse) {
    let stash = JSON.parse(sessionStorage.getItem("CheckerBoard_stash"));
    const newItem = {
        "checkerboardResponse": checkerboardResponse
    };
    if (stash == null) {
        sessionStorage.setItem("CheckerBoard_stash", JSON.stringify({"stashList": [newItem]}));
    } else {
        stash.stashList.push(newItem);
        sessionStorage.setItem("CheckerBoard_stash", JSON.stringify(stash));
    }
    // add indicator to button
    let cbButton = document.getElementById("CBButton");
    cbButton.classList.add("stashed");
    return;
}

function stashJNResponse(formattedPingRequest, buildingName, devTypes) {
    let stash = JSON.parse(sessionStorage.getItem("JackNet_stash"));
    const newItem = {
        "formattedPingRequest": formattedPingRequest,
        "buildingName": buildingName,
        "devTypes": devTypes
    };
    if (stash == null) {
        sessionStorage.setItem("JackNet_stash", JSON.stringify({"stashList": [newItem]}));
    } else {
        stash["stashList"].push(newItem);
        sessionStorage.setItem("JackNet_stash", JSON.stringify(stash));
    }
    // add indicator to button
    let jnButton = document.getElementById("JNButton");
    jnButton.classList.add("stashed");
    return;
}

function stashTickexResponse(newTickets) {
    let stash = JSON.parse(sessionStorage.getItem("Tickex_stash"));
    const newItem = {
        "newTickets": newTickets
    };
    if (stash == null) {
        sessionStorage.setItem("Tickex_stash", JSON.stringify({"stashList": [newItem]}));
    } else {
        stash["stashList"].push(newItem);
        sessionStorage.setItem("Tickex_stash", JSON.stringify(stash));
    }
    // add indicator to button
    let txButton = document.getElementById("TXButton");
    txButton.classList.add("stashed");
    return;
}

// Session Storage Stuff (Tool Responses)
// Unused
//  we store the most recent response for a given request in Checkerboard
//  and JackNet. These should become pretty redundant once the backend starts 
//  caching responses.
function storeCBResponse(cbBody) {
    sessionStorage.setItem("cb_body", JSON.stringify(cbBody));
    return;
}

// Jack Net functions
// Unused
function storeJNResponse(jnBody) {
    sessionStorage.setItem("jn_body", JSON.stringify(jnBody));
    return;
}

//preserve tool HTML
// Note, error checking (incorrect saved tool html) is not done here
// but done it our respective set<tool>() function.
function preserveCurrentTool() {
    let currentTool = document.title.split(" ")[0];
    // Check Current Tool, we do not preserve Admin Tools or Dashboard
    if(currentTool == "Admin" || currentTool == "Dashboard" || currentTool == "CamCode") {
        return;
    }
    currentTool += "_html";
    //
    let currentHTMLObject = document.querySelector('.program_board .program_guts');
    // console.log("bronson debug: preserving:\n", currentTool);
    if(currentHTMLObject != null) {
        sessionStorage.setItem(currentTool, currentHTMLObject.innerHTML);
    } else {
        console.log("Error, programGuts is null");
    }
    return;
}

// ----------- Dashboard Stuff
// DATABASE_TODO
// fetch checkerboard zone percentages from backend.
//  Current Session Object (this could also change): 
//    - if it changes, make sure to update dashCheckerboard();
/*
{[{
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
    }]}
*/

// Define the dashboard object, once it gets real values from the backend
//  users will see it on the dashboard.
function initCheckerboardStorage() {
    const initEntry = {
        zones: [
            {
                zone: 1,
                rooms: 0,
                checked: 0
            },{
                zone: 2,
                rooms: 0,
                checked: 0
            },{
                zone: 3,
                rooms: 0,
                checked: 0
            },{
                zone: 4,
                rooms: 0,
                checked: 0
            }
        ]
    };
    sessionStorage.setItem("db_checker", JSON.stringify(initEntry.zones));
    return;
}

// If cb_body is loaded when setDashboard() is called,
//  then this is called to load a HTML snippet detailing
//  the zones in checkerboard.
async function dashCheckerboardHTML() {
    // DATABASE_TODO: get out of local storage (once set up with database)
    let object = JSON.parse(sessionStorage.getItem("db_checker"));
    let cb_dashDiv = document.createElement("div");
    cb_dashDiv.classList.add("db_checker");
    cb_dashDiv.setAttribute("id", "db_checker");
    let cb_dashDivHTML = `<fieldset><legend>Checkerboard Zone Overview</legend><ul>`;
    for (item in object) {
        if (object[item]["rooms"] != 0) {
            let zoneNum = object[item]["zone"];
            let checkedRooms = object[item]["checked"];
            let totalRooms = object[item]["rooms"];
            let percent = checkedRooms / totalRooms;
            percent = String((100*percent).toFixed(5)).slice(0,5);
            cb_dashDivHTML += `<li> 
            <div style="display: inline;"><p class="db_cbZonep">Zone ${zoneNum}: </p><p class="db_cbRoomCountp">${checkedRooms} / ${totalRooms}</p>
            <label class="dbCbProgLabel" for="${zoneNum}_prog"> ${percent}%</label>
            <progress id="${zoneNum}_prog" value="${percent}" max="100"></progress></div>
            </li>`;
        }
    }
    cb_dashDivHTML += `</ul></fieldset>`;
    cb_dashDiv.innerHTML = cb_dashDivHTML;
    return cb_dashDiv;
}

// Parses CampusData for information. And places it in db_checker
async function dashCheckerboard() {
    let cb_dash = JSON.parse(sessionStorage.getItem("db_checker"));
    let zoneObject = JSON.parse(localStorage.getItem("zoneData"));
    //console.log(cb_dash);
    // GET ZONE OBJ AND ITERATE OVER THAT AND USE THAT ARRAY TO GRAB
    // ENTRIES OUT OF CAMPOBJECT
    for (zone in zoneObject) {
        let cr = 0; // Checked Rooms
        let tr = 0; // Total Rooms
        let bl = await getBuildingAbbrevsFromZone(zone);
        for(bldg in bl) {
            let building = await getBuilding(bl[bldg]);
            cr += building.checked_rooms;
            tr += building.total_rooms;
        }
        // add to cb_dash
        cb_dash[zone-1].checked = cr;
        cb_dash[zone-1].rooms = tr;
    }
    //console.log(cb_dash);
    // if good send to session storage
    sessionStorage.setItem("db_checker", JSON.stringify(cb_dash));
    let html_obj = document.getElementById("db_checker");
    html_obj.replaceWith(await dashCheckerboardHTML());
    return;
}

// Schedule
async function setSchedule(buttonID) {
    let current = document.getElementsByClassName("schedule_selected");
    if (current.length != 0) {
        current[0].classList.remove("schedule_selected");
    }
    let newCurrent = document.getElementById(buttonID);
    newCurrent.classList.add("schedule_selected");
    // Get schedule data
    let schdData = await getSchedule();
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
        Object.values(schdData).forEach(function(tech) {
            if (tech.Assignment == priorityList[i]) {
                zoneTechs.push(tech);
            }
        });
    }
    // populate otherTechs
    Object.values(schdData).forEach(function(tech) {
        if (!priorityList.includes(tech.Assignment)) {
            otherTechs.push(tech);
        }
    });
    let techList = zoneTechs.concat(otherTechs);
    // Build Table
    techList.forEach(function(tech) {
        tbody_HTML += makeTechSchdRow(tech, today);
    });
    tbody_HTML += `</tbody>`;
    let tbody = document.createElement('tbody');
    tbody.setAttribute("id", "schd_tbody");
    tbody.innerHTML = tbody_HTML;
    // Place Table on Dashboard
    let table = document.getElementById("schd_tbody");
    table.replaceWith(tbody);
    return;
}

// TODO:
// bit of a complicated limbo feature.
// We need to know what the cookie from the SSO auth will look like.
// But the idea is that we pull that name and pull the schedule from
// the backend and find the associated schedule. If we do not find it,
// print a statement saying there is not a tech schedule associated with
// their account.
// there will also need to be an update in index.html, when the dashboard page is loaded,
// the onclick function (this function), will need to be updated to have the correct
// name. In addition, makeTechSchdRow will need a sister function that returns
// 5 rows with the day in the left index column rather than name. This has already
// been done in the admin tools, moving that variant function over here may be a 
// good idea. Also utilize makeTechTableHeader("Weekday");
async function setUserSchedule() {
    let current = document.getElementsByClassName("schedule_selected");
    if (current.length != 0) {
        current[0].classList.remove("schedule_selected");
    }
    let newCurrent = document.getElementById("UserButton");
    newCurrent.classList.add("schedule_selected");
    // Get schedule data
    let schdData = await getSchedule();
    if (schdData == null) {
        console.assert("Error: Schedule Data does not exist here");
        return;
    }
    // get user's name 
    // HOTFIX: This will change when the server is mounted 
    //    the user name is stored in the cookie, not the user's
    //    name like it is in the schedule data, because of this. 
    //    I have a switch case that will need to be ripped out
    let username = document.cookie.split("=")[0];
    //console.log(username);
    let name = "name";
    switch (username) {
        case "jnyman1":
            name = "Jack Nyman";
            break;
        case "abryan9":
            name = "Alex Bryan";
            break;
        case "lfermeli":
            name = "Lexus Fermelia";
        default:
            break;
    }
    // Get Tech Obj for Current User, check against stored data.
    let tbody_HTML = `<tbody>`;
    let techObj = schdData[name];
    if (techObj == undefined) {
        console.warn("Dashboard: User does not have a schedule");
        tbody_HTML += `</tbody></table><span> No schedule found associated with current user.</span>`
    } else {
        // Build the table
        let weekdays = Days.slice(1,6);
        weekdays.forEach(function(day) {
            tbody_HTML += makeTechSchdRow(techObj, day); 
        });
        tbody_HTML += `</tbody></table>`;
    }
    let tbody = document.createElement('tbody');
    tbody.setAttribute("id", "schd_tbody");
    tbody.innerHTML = tbody_HTML;
    // Place Table on Dashboard
    let table = document.getElementById("schd_tbody");
    table.replaceWith(tbody);
    return;
}

function makeTechTableHeader(firstColumn) {
    let times = getTechSchdTimeBlocks();
    let html = `<tr>
        <th scope="col" class="schdLeftIndex">${firstColumn}</th>`;
    for( i in times) {
        html += `<th scope="col" class="timeBlockTable">${times[i]}</th>`;
    }
    html += '</tr>';
    return html;
}

function makeTechSchdRow(techObj, today) {
    // Check If UserButton is selected (Left Hand Column Changes Based off this)
    let weekdayBool = true;
    if (document.getElementById("UserButton").classList.contains("schedule_selected")) {
        weekdayBool = false;
    }
    // Build HTML
    let html = `
    <tr>
        <th scope="row">${weekdayBool ? techObj.Name : today}</th>`;
    // get schedule timeblocks
    let timeBlocks = getTechSchdTimeBlocks();
    timeBlocks.push("7:30PM");
    // get techs schedule for the day
    let timeSwitches = [];
    let shift = techObj.Schedule[today].split(",");
    for (let i = 0; i < shift.length; i++) {
        timeSwitches.push(shift[i].split(' - '))
    }
    timeSwitches = timeSwitches.flat(2);
    let onClock = false;
    let timeIndex = 0;
    let startShiftIndex, endShiftIndex = 0;
    // Iterate through 24 time blocks;
    for (let i = 0; i < timeBlocks.length-1; i++) {
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
            html += `<td class="schd${onClock}" colspan=${endShiftIndex - startShiftIndex}>${techObj.Assignment}\t</td>`;
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
function setLeader(jsonValue) {
    // button can be '90days','30days', and '7days'
    let leader = JSON.parse(localStorage.getItem("leaderboard"))[`${jsonValue}`];
    // get button ID
    let buttonId = "";
    switch (jsonValue) {
        case '90days':
            buttonId = "SemesterButton";
            break;
        case "30days":
            buttonId = "MonthButton";
            break;
        case "7days":
            buttonId = "WeekButton";
            break;
        default:
            console.warn("Faulty Leaderboard Behavior Detected, Unsupported Time Option");
            return;
    }

    let current = document.getElementsByClassName("leader_selected");
    if (current.length != 0) {
        current[0].classList.remove("leader_selected");
    }
    let newCurrent = document.getElementById(`${buttonId}`);
    newCurrent.classList.add("leader_selected");
    // number of characters per row
    //const COL_LIMIT = 28; // 28 Columns On Mobile, 41 On desktop.
    //let r = window.innerWidth / window.innerHeight;
    //let col = Math.round(COL_LIMIT * (COL_LIMIT*r) / 41) - 3;
    let col = Math.round(4*Math.atan(1/70*window.innerWidth - 23.6) + 32);
    // print
    let leaderString = "";
    for (let i=0; i<leader.length; i++) {
        let n = col - leader[i].Name.length;
        let spacer = n > 0 ? " ".repeat(n) : "";
        leaderString += `${i+1}. ${leader[i].Name}: ${spacer}${leader[i].Count}\n`;
    }
    let leaderboard = document.getElementById("leaderboard");
    leaderboard.innerHTML = leaderString;
    return;
}

// IE: YEAR-MT-DYT15:59:59Z
function rawTimeFormat(rawTime) {
    const MONTHS = ["Janurary","Feburary","March",
        "April","May","June",
        "July","August","September",
        "October","November","December"];
    let splitTime = rawTime.split("T");
    let date = splitTime[0].split("-");
    let timeOfDay = splitTime[1].slice(0,-1); // slice removes the Z
    let newTimeStr = `${MONTHS[Number(date[1]) - 1]} ${date[2]}, ${date[0]} at ${timeOfDay}`;
    return newTimeStr;
}

// dashSpares();
//  Populate the spares widget on the dashboard with information.
function dashSpares() {
    let spareDiv = document.getElementById("db_spare");
    let spareData = JSON.parse(localStorage.getItem("spares"));
    let tmp = `<fieldset> <legend> PC Spares </legend> <p class="spareHeader"> Deployed Spares </p> <ul>`;
    let tmp_deployed = ``;
    let tmp_notDeployed = ``;
    for(let i = 0; i < spareData.length; i++) {
        if(spareData[i]["Location"]["name"] == "ITC 0173") {
            tmp_notDeployed += `<li><span class="sparePCName">${spareData[i]["Asset Tag"]}: </span>
        <span class="spareLocale">Located in ${spareData[i]["Location"]["name"]} </span><br> 
        <span class="spareUpdate">Updated ${rawTimeFormat(spareData[i]["Last Updated"])} <br>
        by ${spareData[i]["User"]["displayName"]}</span></li>`;
        } else {
            tmp_deployed += `<li><span class="sparePCName">${spareData[i]["Asset Tag"]}: </span>
        <span class="spareLocale">Located in ${spareData[i]["Location"]["name"]} </span><br> 
        <span class="spareUpdate">Updated ${rawTimeFormat(spareData[i]["Last Updated"])} <br>
        by ${spareData[i]["User"]["displayName"]}</span></li>`;
        }
    }
    tmp += tmp_deployed;
    tmp += `</ul><p> Stored in ITC 173 </p><ul>`;
    tmp += tmp_notDeployed;
    tmp += `</ul></fieldset>`;
    spareDiv.innerHTML = tmp;
    return;
}

// Ticket Widget for Incoming/Unresponded Tickets
async function dashTickex() {
    let ticketsDiv = document.getElementById("db_tickets");
    ticketsDiv.classList.add("db_ticketContainer");

    // Loading Screen until Tickets are fetched
    let tmp = `
        <fieldset> 
            <p>Loading Tickets...</p>
        </fieldset>
    `;
    ticketsDiv.innerHTML = tmp;

    // Fetch the Tickets from TDX
    let tickets = [];
    while (!tickets.length) { // Keep trying until tickets are fetched
        let response = await fetchTickets("dash"); // fetchTickets() defined in tickex.js
        tickets = Array.isArray(response) ? response : [];
    }

    buildDBTickets();
    function buildDBTickets() {
        // Sort Tickets 
        tickets = tickets.sort((a, b) => b.ID - a.ID);
        
        window.currentTickets = tickets;
        window.allTickets = tickets;

        // Filter for unresponded/new tickets, 14 Days
        const unrespondedTickets = tickets.filter(ticket => {
            const isNew = (Date.now() - new Date(ticket.CreatedDate) < 14 * 24 * 60 * 60 * 1000 
                        || ticket.StatusName === 'New') 
                        && ticket.StatusName !== 'Closed'
                        && ticket.StatusName !== 'Cancelled'
                        && ticket.StatusName !== 'Resolved';
            return isNew;
        });

        // Build the Ticket Content
        let ticketsContent = `
            <table>
                <thead><tr>
                    <th>Title</th>
                    <th>ID</th>
                    <th>Status</th>
                </tr></thead>
                <tbody>
        `;

        let ticketRows = "";
        for (let ticket of unrespondedTickets) {
            let highlightClass = ticket.has_been_viewed ? '' : 'tx_highlight_row';
            ticketRows += `
                <tr class="tx_ticket dashboard ${highlightClass}" id="${ticket.ID}" onclick="showPopupFromDashboard(${JSON.stringify(ticket).replace(/"/g, '&quot;')}, this)">
                    <td>${ticket.Title}</td>
                    <td>${ticket.ID}</td>
                    <td>${ticket.StatusName}</td>
                </tr>
            `;
        }

        ticketsContent += `
                    ${ticketRows}
                </tbody>
            </table>
        `;

        if (ticketRows === "") ticketsContent = "<p>All Caught Up!</p>"; 

        tmp = `
            <fieldset> 
                <legend>Unresponded Tickets</legend> 
                <p class="ticketsHeader"> Only assign yourself if you are actively going to the Ticket </p>
                ${ticketsContent}
            </fieldset>
        `;

        ticketsDiv.innerHTML = tmp;
    }

    // Auto-refresh board logic
    if (localStorage.getItem("isDBTicketIntervalSet") == "true") return;
    localStorage.setItem("isDBTicketIntervalSet", true)
    setInterval(() => {
        // Will not fire if Dashboard is not currently Selected
        if (!document.getElementById("DBButton").classList.contains("selected")) return;

        fetchTickets().then(() => {
            buildDBTickets();
        }).catch(error => console.error('Error fetching tickets for update:', error));
    }, 20000); // Refresh every 20 seconds
}

// Not really being used, consider this a proof of concept to give more specific
// formatting based on user device (this is not perfect)
function isMobile() {
    let screenWidth = window.innerWidth;
    let screenHeight = window.innerHeight;
    let r = screenWidth / screenHeight;
    //console.log("Screen Width: ", screenWidth, ", Screen Height: ", screenHeight, " Ratio: ", r);
    if (r < 1.2) {
        console.log("Mobile User Detected");
        return true;
    } else {
        // console.log("Desktop User Detected");
        return false;
    }
}

// TODO: Temporary Pop-up Notification
//   I think it would be beneficial to have some kind of message banner to alert users for a number of things. A stashed request along with some kind of error handling to give more specific information about what happened. 
const defaultNotification = {
  title: 'New Notification',
  message: 'Your message goes here',
  icon:'https://cdn2.iconfinder.com/data/icons/mixed-rounded-flat-icon/512/megaphone-64.png',
  clickCallback: function () {
    alert('do something when clicked on notification');
  }
};
