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
    let campJSON = await getCampusJSON();
    console.log(campJSON);
    localStorage.setItem("campusJSON", JSON.stringify(campJSON));
    // Need to make a function on the backend that handles this request.
    // Zone Arrays
    let zoneData = await getZoneData();
    console.log(zoneData);
    localStorage.setItem("zoneData", JSON.stringify(zoneData));
    return;
}

async function getCampusJSON() {
    return fetch('campus.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        }
    );
}

// TODO (also on the backend) 
// - this should replace campus.json in it's entirety, 
//    should be structured like the hashmap (should be an 
//    array of clones of each building entry in it). 
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
    return await fetch('zoneData', {
        method: 'POST',
    })
    .then((response) => response.json())
    .then((json) => {return json;});
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
    let campJSON = localStorage.getItem("campusJSON");
    return JSON.parse(campJSON);
}

// Returns a list of buildings
async function getBuildingList() {
    let data = await getLocalCampusData();
    data = JSON.stringify(data);
    let buildingData = JSON.parse(data).buildingData;
    let bl = [];
    for(var i = 0; i < buildingData.length; i++) {
        bl[i] = buildingData[i].name;
    }

    return bl.sort();
}

// Returns a list of rooms given a building name
async function getRooms(buildingName) {
    let data = await getLocalCampusData();
    //data = JSON.stringify(data);
    //let buildingData = JSON.parse(data).buildingData;
    let buildingData = data.buildingData;
    for(var i = 0; i < buildingData.length; i++) {
        if(buildingData[i].name == buildingName) {
            return buildingData[i].rooms.sort();
        }
    }
}

// Returns a building abbreviation given a building name
async function getAbbrev(buildingName) {
    let data = await getLocalCampusData();
    //data = JSON.stringify(data);
    //let buildingData = JSON.parse(data).buildingData;
    let buildingData = data.buildingData;
    for(var i = 0; i < buildingData.length; i++) {
        if(buildingData[i].name == buildingName) {
            return buildingData[i].abbrev;
        }
    }
}

function getBuildingName(buildingAbbrev) {
    let data = getLocalCampusData();
    let buildingData = data.buildingData;
    for (var i = 0; i < buildingData.length; i++) {
        if(buildingData[i].abbrev == buildingAbbrev) {
            return buildingData[i].name;
        }
    }
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