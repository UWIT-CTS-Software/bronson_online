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
    - getSchedule()
    - setDashboardDefaults()
    - getLocalCampusData()
        - getBuildingList()
        - getRooms(buildingName)
        - getAbbrev(buildingName)
        - getBuildingName(buildingAbbrev)
    - getLocalZoneData()
        - getBuildingNamesFromZone(zone_number)
        - getBuildingAbbrevsFromZone(zone_numebr)
  Cache
    - stashCheckerboard(checkerboardResponse)
    - stashJNResponse(formattedPingRequest, buildingName, deviceNames)
    - storeCBResponse(cbBody) ---------------------------------------------- UNUSED
    - storeJNResponse(jnBody) ---------------------------------------------- UNUSED
    - preserveCurrentTool()
  Dashboard Helpers
    - getDashboardChecker()
    - initCheckerboardStorage()
    - dashCheckerboard()
    - dashCheckerboard2()  // Need to rename this to populate_cb_dash() or something
    - setSchedule(buttonID)
    - setUserSchedule(name) ------------------------------------------------ DB_TODO / SSO
    - makeTechTableHeader(firstColumn)
    - makeTechSchdRow(tech, today)
    - getTechSchdTimeBlocks()
    - renderTimeIndicator() ------------------------------------------------ TODO
    - setLeaderWeek()
    - setLeaderMonth()
    - setLeaderSemester()
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
    // CheckerboardStorage
    if (sessionStorage.getItem("db_checker") == null) {
        initCheckerboardStorage();
    }
    // Once data is loaded, set default tab selection
    if(document.title.includes("Dashboard")) {
        setDashboardDefaults();
        dashCheckerboard2(); // poplate cb_dash
    }
    isMobile();
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
        }).then(json => {
            /* return JSON.parse(json); */
            return json;
        });
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
    let todayButton = Days[today.getDay()]+"Button";
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
    jnButton.classList.add("stashed");
    return;
}

// Session Storage Stuff (Tool Responses)
//  we store the most recent response for a given request in Checkerboard
//  and JackNet. These should become pretty redundant once the backend starts 
//  caching responses.
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
async function dashCheckerboard() {
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
            <div style="display: inline;"><p class="db_cbZonep">Zone ${zoneNum}: </p><p class="db_cbRoomCountp">${checkedRooms} / ${totalRooms} Rms</p>
            <label class="cbProgLabel" for="${zoneNum}_prog"> ${percent}%</label>
            <progress id="${zoneNum}_prog" value="${percent}" max="100"></progress></div>
            </li>`;
        }
    }
    cb_dashDivHTML += `</ul></fieldset>`;
    cb_dashDiv.innerHTML = cb_dashDivHTML;
    return cb_dashDiv;
}

// Parses CampusData for information. And places it in db_checker
async function dashCheckerboard2() {
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
    html_obj.replaceWith(await dashCheckerboard());
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
    // append to table
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
function setUserSchedule(name) {
    // let schdData = getSchedule();
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
    const COL_LIMIT = 28; // 28 Columns On Mobile, 41 On desktop.
    let r = window.innerWidth / window.innerHeight;
    console.log("r: ", r);
    //let col = Math.round(COL_LIMIT * (COL_LIMIT*r) / 41) - 3;
    let col = Math.round(4*Math.atan(1/70*window.innerWidth - 23.6) + 32);
    //let col = Math.round(13/Math.PI * Math.atan(1/60*window.innerWidth - 27.6) + 34.5);
    //let col = Math.round(13/Math.PI * Math.atan(20*(r-1)) + 34.5);
    console.log("col: ", col, "windowWidth :", window.innerWidth);
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

function isMobile() {
    let screenWidth = window.innerWidth;
    let screenHeight = window.innerHeight;
    let r = screenWidth / screenHeight;
    console.log("Screen Width: ", screenWidth, ", Screen Height: ", screenHeight, " Ratio: ", r);
    if (r < 1.2) {
        console.log("Mobile User Detected");
        return true;
    } else {
        console.log("Desktop User Detected");
        return false;
    }
}