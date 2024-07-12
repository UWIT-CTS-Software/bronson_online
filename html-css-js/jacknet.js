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
// TO-DO: return list of checked devices
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

// TO-DO: return the selected option in the dropdown menu for buildings/zones
async function getBuildingSelection() {
    let buildingList = await getBuildingList();
    let select = document.getElementById('building_List');
    if (select.value == "All Buildings") {
        return select.value;
    } else {
        return buildingList[select.value];
    }
}

function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

// - - ---- -- - ---- PING FUNCTIONS
//TO-DO: generate host names based on rooms/devices selected.
async function genHostnames(devices, buildingName) {
    let ab = await getAbbrev(buildingName);
    let rms = await getRooms(buildingName);
    console.log(rms);
    console.log(ab);
    let hnList = [];
    // go through devices here and generate hostnames
    // ABBREVIATION-####-DEVICE#
    for(var i = 0; i < rms.length; ++i) {
        for(var j = 0; j < devices.length; ++j) {
            hnList.push(ab + '-' + pad(rms[i], 4) + '-' + devices[j] + '1');
        }
    }
    return hnList;
};

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

// TODO - handle ping resonse apporpriately
async function getPingData() {
    return
}

// Requests ping with device list and building.
async function pingThis(devices, building) {
    return await fetch('ping', {
        method: 'POST',
        body: JSON.stringify({
            devices: devices,
            building: building
        })
    });
};

//TO-DO: ping fetch results
async function pingGet() {
    return await fetch('ping', {
        method: 'GET',
        body: {}
    });
};

// - ---- ----- - - - EXPORT FUNCTIONS
// TODO: Export findings as csv
function exportCsv() {
    return;
};

// TODO: Main function
// runs the search and calls the above functions to do so.
async function runSearch() {
    updateConsole("====--------------------========--------------------====");
    const devices = getSelectedDevices();
    const building = await getBuildingSelection();
    console.log(building);
    let hostnames = [];
    let totalNumDevices = 0;
    updateConsole("Selected Devices: " + devices);
    // When the time comes do something simular for zones
    if (building == "All Buildings") {
        let buildingList = await getBuildingList();
        updateConsole("Selected Buildings: " + buildingList);
        // iterate through each building and create hostnames for each and ping
        for (var i=0; i < buildingList.length; ++i) {
            let newHosts = await genHostnames(devices, buildingList[i]);
            for (var j=0; j < newHosts.length; ++j) {
                hostnames.push(newHosts[j]);
            }
            totalNumDevices += newHosts.length;
        }
        //updateConsole(hostnames);
        //console.log(hostnames)
    }
    else {
        updateConsole("Selected Building: " + building);
        // generate hostnames
        hostnames = await genHostnames(devices, building);
        totalNumDevices = hostnames.length;
        //updateConsole(hostnames);
    }
    updateConsole("Searching for " + totalNumDevices + " devices.");
    // build progress bar here ?

    // Check if the pack of building flag is raised (all buildings/zone selection) and then ping every generated hostname
    pingThis(devices, building);
    //pingThis(devices, building);
    return;
};

// DEBUG/testing commands
// let bl = getBuildingList()
// console.log(bl)
// let rooms_test = getRooms(bl[0])
// console.log(rooms_test)