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
async function initSessionStorage() {
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
    });
}

async function getZoneData() {
    return await fetch('zoneData', {
        method: 'POST',
    })
    .then((response) => response.json())
    .then((json) => {return json;});
}

