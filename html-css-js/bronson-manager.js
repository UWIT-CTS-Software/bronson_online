// bronson-manager.js
// Jack Nyman
// 6-17-2025
//
// This file is set to host functions that are called throughout bronson suite
//  that utilize or update session storage for a user.
//  This includes data structs to update the page,
//   - Checkerboard:
//         Zones: {"1":[...],"2":[],"3":[],"4":[]}
//   - Jacknet:
//         Campus.json
// In addition, this would be handle place to put HTML heavy functions like setChkrboard(), ...
// this could also be handy place to add some UI heavy functions (minimze tile by ID)
// pop-ups, location jumping (height), disabling buttons while a tool is running, etc.

// Sets local strage for data used by the various tools
//  - Zone Building list array of room names for each zone
//  - Campus.json used for various things in jacknet
async function initLocalStorage() {
    let campJSON = await getCampusData();
    localStorage.setItem("campusJSON", JSON.stringify(campJSON));
    // Need to make a function on the backend that handles this request.
    // Campus Data (Effectively a clone of the hashmap)
    let campData = await getCampusData();
    console.log(campData);
    localStorage.setItem("campData", JSON.stringify(campData));
    // Zone Arrays
    let zoneData = await getZoneData();
    localStorage.setItem("zoneData", JSON.stringify(zoneData));

    let leaderboard = await getLeaderboard();
    localStorage.setItem("leaderboard", JSON.stringify(leaderboard));
    return;
}

// TODO (also on the backend) 
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

// Session Storage Stuff (Tool Responses)
function storeCBResponse(cbBody) {
    sessionStorage.setItem("cb_body", cbBody);
    return;
}

function storeJNResponse(jnBody) {
    sessionStorage.setItem("jn_body", jnBody);
    return;
}

// - - -- --- - - CMAPUS.JSON GET INFO FUNCTIONS
//
// This section contains functions for retrieving
//  the local instance of campusJson and getting pieces
//  of it.
// Copy this to extract info from ping response
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