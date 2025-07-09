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
    let zoneData = await getZoneData();
    localStorage.setItem("zoneData", JSON.stringify(zoneData));
    // Leaderboard
    let leaderboard = await getLeaderboard();
    localStorage.setItem("leaderboard", JSON.stringify(leaderboard));
    // CheckerboardStorage
    if (sessionStorage.getItem("cb_dash") == null) {
        initCheckerboardStorage();
    }
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
    cbButton.innerHTML = `<span>CheckerBoard *</span>`;
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
    jnButton.innerHTML = `<span>JackNet *</span>`;
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
    sessionStorage.setItem(currentTool, currentHTMLObject.innerHTML);
    return;
}