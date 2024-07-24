/*
jacknet.js
This file contains all code relating to jacknet and will manipulate the DOM in index.html accordingly
*/

// buildingData is a list of dictionaries containing buildings on campus and the rooms within that are being maintained/monitored by CTS

// SETTING THE HTML DOM
async function setJackNet() {
    console.log('Switching to jacknet');
    let progGuts = document.querySelector('.program_board .program_guts');
    let main_container = document.createElement('div');
    main_container.innerHTML = '<p>hello world - jacknet</p>';

    // Make a box for list of buildings
    /* 
    POSSIBLE HTML TAGS
        select
        optgroup (Zone 1...)
        option
        label
        dt      
    */
    // UNcomment this if the fieldset supremecy mindset sucks
    let buildingSelect = document.createElement("fieldset");
    buildingSelect.classList.add('building_List');
    let set_inner_html = '<select id="building_List"><option>All Buildings</option>';
    // TO-DO: add zone options here
    let bl = await getBuildingList();
    for(var i in bl) {
        set_inner_html += `<option value=${i}>${bl[i]}</option>`;
    };
    set_inner_html += '</select>';
    buildingSelect.innerHTML = `<legend>Choose Building(s): </legend> ${set_inner_html}`;

    // make options for touch panel, proc, etc
    /*
    POSSIBLE HTML TAGS
        label
        legend
    */

    // REDO: what flags for checkbox are neccessary?
    //   - do we need value and name?
    let devSelect = document.createElement("fieldset");
    devSelect.classList.add('devSelect');
    devSelect.innerHTML = '<legend>Choose Devices to Search For: </legend> \n <input class="cbDev" type ="checkbox" id="proc" name="dev" value="Processors" /> \n <label for="proc"> Processors </label><br> \n <input class="cbDev" type="checkbox" id="pj" name="dev" value="Projectors" /> \n <label for="pj">Projectors</label><br> \n <input class="cbDev" type="checkbox" id="ws" name="dev" value="Wyo Shares" /> \n <label for="ws">Wyo Shares</label><br> \n <input class="cbDev" type="checkbox" id="tp" name="dev" value="Touch Panels" /> \n <label for="tp">Touch Panels</label><br> \n <input class="cbDev" type ="checkbox" id="cmicx" name="dev" value="Ceiling Mics" /> \n <label for="cmicx"> Ceiling Mics </label><br> \n ';

    // log progress (use tag progress)

    // Console Output
    let consoleOutput = document.createElement("fieldset");
    consoleOutput.classList.add('consoleOutput');
    consoleOutput.innerHTML = '<legend> Console Output: </legend> \n <textarea readonly rows="10" cols ="80" class="innerConsole" name="consoleOutput" spellcheck="false"> Console: Example </textarea>';

    // Bottom Menu buttons
    // html options: menu
    let bottomMenu = document.createElement("fieldset");
    bottomMenu.classList.add('bottomMenu');
    bottomMenu.innerHTML = '<legend>Options: </legend> \n <menu> \n <button id="run" onclick="runSearch()">Run Search</button> \n <button id="export">Export as .csv </button> \n <button id="clearCon" onclick="clearConsole()"> Clear Console </button> \n </menu>';

    // PUT EVERYTHING TOGETHER MAIN_CONTAINER
    main_container.appendChild(buildingSelect);
    main_container.appendChild(devSelect);
    main_container.appendChild(consoleOutput);
    main_container.appendChild(bottomMenu);
    main_container.classList.add('program_guts');
    //p.appendChild(select)
    progGuts.replaceWith(main_container);
    return;
  };

// - -- - -- - - - CONSOLE FUNCTIONS
// Tied to 'Clear Console' button, clears the console
function clearConsole() {
    let consoleObj = document.querySelector('.innerConsole');
    consoleObj.value = '';
    return;
};

// updates the console by appending an item of text to contents
function updateConsole(text) {
    let consoleObj = document.querySelector('.innerConsole');
    const beforeText = consoleObj.value.substring(0, consoleObj.value.length);
    consoleObj.value = beforeText + '\n' + text;
    consoleObj.scrollTop = consoleObj.scrollHeight;
    return;
};

// - - -- ----- - - CMAPUS.JSON GET INFO FUNCTIONS
// copy this to extract info from ping response
async function getData() {
    return fetch('campus.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
    });
};

// Returns a list of buildings
async function getBuildingList() {
    let data = await getData();
    data = JSON.stringify(data);
    let buildingData = JSON.parse(data).buildingData;
    let bl = [];
    for(var i = 0; i < buildingData.length; i++) {
        bl[i] = buildingData[i].name;
    };
    return bl;
};

// Returns a list of rooms given a building name
async function getRooms(buildingName) {
    let data = await getData();
    data = JSON.stringify(data);
    let buildingData = JSON.parse(data).buildingData;
    for(var i = 0; i < buildingData.length; i++) {
        if(buildingData[i].name == buildingName) {
            return buildingData[i].rooms;
        };
    };
};

// Returns a building abbreviation given a building name
async function getAbbrev(buildingName) {
    let data = await getData();
    data = JSON.stringify(data);
    let buildingData = JSON.parse(data).buildingData;
    for(var i = 0; i < buildingData.length; i++) {
        if(buildingData[i].name == buildingName) {
            return buildingData[i].abbrev;
        };
    };
};

// ---- ---- -- -- -  GET USER CONFIG FUNCTIONS
// getSelectedDevices()
//   - returns a list of user-selected devices to search for.
function getSelectedDevices() {
    let devices = document.getElementsByName('dev');
    let devList = [];
    for (var i = 0; i < devices.length; ++i) {
        if(devices[i].checked) {
            devList.push(devices[i].id);
        };
    };
    return devList;
}

// getBuildingSelection()
//   - returns the user-selected building/area
async function getBuildingSelection() {
    let buildingList = await getBuildingList();
    let select = document.getElementById('building_List');
    if (select.value == "All Buildings") {
        return select.value;
    } else {
        return buildingList[select.value];
    }
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

// // - - ---- -- - ---- PING FUNCTIONS

// Requests ping with device list and building.
async function pingThis(devices, building) {
    return await fetch('ping', {
        method: 'POST',
        body: JSON.stringify({
            devices: devices,
            building: building
        })
    })
    .then((response) => response.json())
    .then((json) => {return json;});
};

async function pingpong(devices, building) {
    return await pingThis(devices, building)
        .then((value) => { 
            // updateConsole("Ping Response: \n");
            // updateConsole(value.building);
            // updateConsole(value.hostnames);
            // updateConsole(value.ips);
            return [value.hostnames, value.ips];
        });
    
}

// printPingResult(
//      - pingResult => [[Hostnames], [IP Addresses]]
// )
// Print the result of a ping to the user's console.
async function printPingResult(pingResult, building) {
    let hns = pingResult[0];
    let ips = pingResult[1];

    let printHostnames = "";
    let printIps       = "";

    let rooms   = await getRooms(building);
    let bAbbrev = await getAbbrev(building);

    // updateConsole("DEBUG 1:\n" + hns);
    // updateConsole("DEBUG 2:\n" + ips);
    // updateConsole("DEBUG 3:\n" + rooms);
    // updateConsole("DEBUG 4:\n" + bAbbrev);


    // Display the ping results
    //  room 1055
    //    en-1055-proc1    en-1055-ws1   ...
    //      10.10.10.10              x   ...
    //  ...
    for (var i = 0; i < rooms.length; i++) {
        printHostnames = "";
        printIps       = "";
        updateConsole("---------")
        updateConsole(bAbbrev + " " + rooms[i]);
        for (var j=0; j < hns.length; j++) {
            // if hostname contains room#
            //   add to printout hostname line
            //   add corresponding ip
            if(hns[j].includes(pad(rooms[i], 4))){
                printHostnames += pad(hns[j], 15, " ") + "|";
                printIps       += pad(ips[j], 15, " ") + "|";
            }
        }
        updateConsole("Hostnames: " + printHostnames);
        updateConsole("IP's     : " + printIps);
    }    

    return;
}

// - ---- ----- - - - EXPORT FUNCTIONS
// TODO: Export findings as csv
function exportCsv() {
    return;
};

// TODO: Main function
// runs the search and calls the above functions to do so.
async function runSearch() {
    updateConsole("====--------------------========--------------------====");
    // get user-selection
    const devices  = getSelectedDevices();
    const building = await getBuildingSelection();
    // const rooms    = await getRooms(building);
    // const bAbbrev  = await getAbbrev(building);

    // Variables
    let totalNumDevices =  0;
    let not_found_count =  0;
    // let printHostnames  = "";
    // let printIps        = "";
    let f_hns           = [];
    let f_ips           = [];
    let pingResult      = [[],[]];
    let f_all_buildings = false;   // all buildings flag (changes alot)

    // tell the user what they did
    updateConsole("Selected Devices:\n" + devices);
    updateConsole("Searching " + building);
    // updateConsole("Total Devices:\n" + totalNumDevices);


    // Check All Buildings Flag
    if (building == "All Buildings") {
        f_all_buildings = true;
    }

    // do the ping
    if (f_all_buildings) {
        let bdl = await getBuildingList();
        for (var i = 0; i < bdl.length; i++) {
            updateConsole("=-+-+-+-=\n Now Searching " + bdl[i] + "\n=-+-+-+-=");
            pingResult = await pingpong(devices, bdl[i]);
            await printPingResult(pingResult, bdl[i]);
            f_hns += pingResult[0];
            f_ips += pingResult[1];
            //updateConsole("DEBUG 69:\n" + f_hns);
        }
    }
    else if (!f_all_buildings) { 
        pingResult = await pingpong(devices, building);
        await printPingResult(pingResult, building);
        f_hns = pingResult[0]; // hostnames
        f_ips = pingResult[1]; // ips
    }

    // updateConsole("DEBUG 5:\n" + f_hns);
    // updateConsole("DEBUG 6:\n" + f_ips);


    // TODO: Set the CSV Export with ping result

    

    updateConsole("====--------------------========--------------------====");

    // Double check operation
    if (f_hns.length != f_ips.length) {
        updateConsole("FATAL ERROR: Unexpected difference in number of returns.");
    }

    // Find number of devices not found
    for (var i = 0; i < f_ips.length; i++) {
        if(f_ips[i] == "x") {
            not_found_count += 1;
        }
    }

    console.log(f_hns.length);
    totalNumDevices = f_hns.length;

    updateConsole("Search Complete");
    updateConsole("Found " + (totalNumDevices - not_found_count) + "/" + totalNumDevices + " devices.");

    updateConsole("CSV Export Available (kinda not really sry)");
    // maybe return ping result to ge

    return;
};