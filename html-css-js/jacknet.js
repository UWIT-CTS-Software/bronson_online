/*
    _            _               _     _     
   (_)          | |             | |   (_)    
    _  __ _  ___| | ___ __   ___| |_   _ ___ 
   | |/ _` |/ __| |/ / '_ \ / _ \ __| | / __|
   | | (_| | (__|   <| | | |  __/ |_ _| \__ \
   | |\__,_|\___|_|\_\_| |_|\___|\__(_) |___/
  _/ |                               _/ |    
 |__/                               |__/     

This file contains all code relating to jacknet and will manipulate the DOM in index.html accordingly

Data
    - CSV_EXPORT declared
    - setCSVExport(hns, ips, rms)
    - getData()
    - getBuildingList()
    - getRooms(buildingName)
    - getAbbrev(buildingName)
    - getSelectedDevices()
    - getSelectedBuilding()
    - pad(n, width, z)

Export
    - runExport()
    - downloadCsv(data)

Search
    - PingPong(devices, building)            - flag: "ping"
    - printPingResult(pingResult, building)
    - runSearch()

HTML
    - clearConsole()
    - updateConsole()
    - setJackNet()
 

    NOTES

buildingData is a list of dictionaries containing buildings on campus and the rooms within that are being maintained/monitored by CTS

there should be an object for the csv export and if a search is ran, it is overwritten. If possible fade the export button until the first search is ran.

TODO:
    - All Buildings PopUp, "Are You Sure?"
    - Individual Room Option (checkbox ?)
    - Visualizer + Caching

$$$$$$$\             $$\               
$$  __$$\            $$ |              
$$ |  $$ | $$$$$$\ $$$$$$\    $$$$$$\  
$$ |  $$ | \____$$\\_$$  _|   \____$$\ 
$$ |  $$ | $$$$$$$ | $$ |     $$$$$$$ |
$$ |  $$ |$$  __$$ | $$ |$$\ $$  __$$ |
$$$$$$$  |\$$$$$$$ | \$$$$  |\$$$$$$$ |
\_______/  \_______|  \____/  \_______|
*/

let CSV_EXPORT = {
    hostnames: [],
    ip_addrs:  [],
    rooms:     []
}

// setCSVExport(hns, ips, rms)
function setCSVExport(hns, ips, rms) {
    CSV_EXPORT.hostnames = hns;
    CSV_EXPORT.ip_addrs  = ips;
    CSV_EXPORT.rooms     = rms;

    return;
}

// - - -- --- - - CMAPUS.JSON GET INFO FUNCTIONS
// copy this to extract info from ping response
async function getData() {
    return fetch('campus.json')
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
    });
}

// Returns a list of buildings
async function getBuildingList() {
    let data = await getData();
    data = JSON.stringify(data);
    let buildingData = JSON.parse(data).buildingData;
    let bl = [];
    for(var i = 0; i < buildingData.length; i++) {
        bl[i] = buildingData[i].name;
    }

    return bl;
}

// Returns a list of rooms given a building name
async function getRooms(buildingName) {
    let data = await getData();
    data = JSON.stringify(data);
    let buildingData = JSON.parse(data).buildingData;
    for(var i = 0; i < buildingData.length; i++) {
        if(buildingData[i].name == buildingName) {
            return buildingData[i].rooms;
        }
    }
}

// Returns a building abbreviation given a building name
async function getAbbrev(buildingName) {
    let data = await getData();
    data = JSON.stringify(data);
    let buildingData = JSON.parse(data).buildingData;
    for(var i = 0; i < buildingData.length; i++) {
        if(buildingData[i].name == buildingName) {
            return buildingData[i].abbrev;
        }
    }
}

// ---- ---- -- -- -  GET USER CONFIG FUNCTIONS
// getSelectedDevices()
//   - returns a list of user-selected devices to search for.
function getSelectedDevices() {
    let devices = document.getElementsByName('jn_dev');
    let devList = [];
    for (var i = 0; i < devices.length; ++i) {
        if(devices[i].checked) {
            devList.push(devices[i].id);
        };
    };
    return devList;
}

// getSelectedBuilding()
//   - returns the user-selected building/area
async function getSelectedBuilding() {
    let buildingList = await getBuildingList();
    let select = document.getElementById('building_list');
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

/*
$$$$$$$$\                                          $$\     
$$  _____|                                         $$ |    
$$ |      $$\   $$\  $$$$$$\   $$$$$$\   $$$$$$\ $$$$$$\   
$$$$$\    \$$\ $$  |$$  __$$\ $$  __$$\ $$  __$$\\_$$  _|  
$$  __|    \$$$$  / $$ /  $$ |$$ /  $$ |$$ |  \__| $$ |    
$$ |       $$  $$<  $$ |  $$ |$$ |  $$ |$$ |       $$ |$$\ 
$$$$$$$$\ $$  /\$$\ $$$$$$$  |\$$$$$$  |$$ |       \$$$$  |
\________|\__/  \__|$$  ____/  \______/ \__|        \____/ 
                    $$ |                                   
                    $$ |                                   
                    \__|       
                    
TODO:

setCSVExport(hns, ips, rms)
    [x] - Update the CSV Export Object
    [ ] - ? Maybe, Set CSV Button Opacity (If first search)
*/

function runExport() {
    // IDEAL CSV FORMAT
    // EN 1055
    // Hostname:   en-1055-proc1    en-1055-ws1   ...
    // Ip:           10.10.10.10              x   ...
    //  ...
    csvRows = [];
    const headers = Object.keys(CSV_EXPORT);
    const values = Object.values(CSV_EXPORT);
    // Break values into better variables
    let hostnames = values[0];
    let ips = values[1];
    let rms = values[2];
    updateConsole("-------=-------");
    updateConsole("Exporting CSV");
    // updateConsole(hostnames[0]);
    // updateConsole(rms);
    // updateConsole("DEBUG: Values:\n" + values);
    console.log(values);

    var hii      = 0;
    let hostBuff = [headers[0]];
    let ipBuff   = [headers[1]];

    for(var i = 0; i < rms.length; i++) {
        let num = rms[i].split(" ")[1];
        //updateConsole("NumCheck:\n" + num);
        //updateConsole("PAD CHECK:\n "+ pad(num, 4));
        while (hostnames[hii].includes(pad(num, 4))) {
            //updateConsole(pad(num, 4));
            hostBuff.push(hostnames[hii]);
            //updateConsole(hostnames[hii]);
            ipBuff.push(ips[hii]);
            if(hii >= hostnames.length - 1){
                break;
            }
            hii ++;
        }
        csvRows.push([rms[i]]);
        csvRows.push([hostBuff.join(',')]);
        csvRows.push([ipBuff.join(',')]);

        hostBuff = [headers[0]];
        ipBuff = [headers[1]];
        hii = hii;
    }

    downloadCsv(csvRows.join('\n'));

    return;
}

function downloadCsv(data) {
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    // Change to jn-{$timestamp}.csv
    let filename = new Date().getTime();
    a.download = filename + '.csv';

    a.click();

    updateConsole("Downloaded " + filename + '.csv');

    return;
}



/*
 $$$$$$\                                          $$\       
$$  __$$\                                         $$ |      
$$ /  \__| $$$$$$\   $$$$$$\   $$$$$$\   $$$$$$$\ $$$$$$$\  
\$$$$$$\  $$  __$$\  \____$$\ $$  __$$\ $$  _____|$$  __$$\ 
 \____$$\ $$$$$$$$ | $$$$$$$ |$$ |  \__|$$ /      $$ |  $$ |
$$\   $$ |$$   ____|$$  __$$ |$$ |      $$ |      $$ |  $$ |
\$$$$$$  |\$$$$$$$\ \$$$$$$$ |$$ |      \$$$$$$$\ $$ |  $$ |
 \______/  \_______| \_______|\__|       \_______|\__|  \__|


TODO: 
[ ] - ? Maybe, combine pingThis() and pingPong
[ ] - ? Maybe, check ip_addr return for "domain.name (ip_address)"
runSearch()
    [ ] - Incorrect (devFound- devNotFound) / totalDev
    [x] - Export Function Call / Update Object
*/

// Requests ping with device list and building.
async function pingpong(devices, building) {
    return await fetch('ping', {
        method: 'POST',
        body: JSON.stringify({
            devices: devices,
            building: building
        })
    })
    .then((response) => response.json())
    .then((json) => {return [json.hostnames, json.ips];});
}

// printPingResult(
//      - pingResult => [[Hostnames], [IP Addresses]]
// )
// Print the result of a ping to the user's console.
// Display the ping results
//  room 1055
//    en-1055-proc1    en-1055-ws1   ...
//      10.10.10.10              x   ...
//  ...
async function printPingResult(pingResult, building) {
    let hns = pingResult[0];
    let ips = pingResult[1];
    let rms = [];

    let graphBool = [];
    let tmpBool = [];

    let printHostnames = "";
    let printIps       = "";

    let rooms   = await getRooms(building);
    let bAbbrev = await getAbbrev(building);
    
    for (var i = 0; i < rooms.length; i++) {
        printHostnames = "";
        printIps       = "";
        tmpBool = [];
        updateConsole("---------")
        updateConsole(bAbbrev + " " + rooms[i]);
        rms.push(bAbbrev + " " + rooms[i]);
        for (var j=0; j < hns.length; j++) {
            // if hostname contains room#
            //   add to printout hostname line
            //   add corresponding ip
            if(hns[j].includes(pad(rooms[i], 4))){
                printHostnames += pad(hns[j], 15, " ") + "|";
                printIps       += pad(ips[j], 15, " ") + "|";
                if (ips[j] == 'x') {
                    tmpBool.push('0');
                } else {
                    tmpBool.push('1');
                }
            }
        }
        updateConsole("Hostnames: " + printHostnames);
        updateConsole("IP's     : " + printIps);
        graphBool.push(tmpBool)
    }
    // This is where we post some visualizations
    // Put together visualizer information
    /*      GOAL:
        ROOOOM |#1|#2|#3|... #9999
        --------------------------
            pj |x |o |o |
          proc |o |o |o |
            ws |x |o |x |
            tp |o |o |o |
        --------------------------
        Need some booleans array for each room
        ie: [[0,1,0,1],[1,1,1,1],[1,1,0,1]]

        

    */
    // we got it 
    //console.log(graphBool);
    postJNVis(graphBool, building);

    return rms;
}

// runSearch()
// runs the search and calls the above functions to do so.
//      TODO: 
//          [ ] - Fix "all buildings" export by adding new data structures
async function runSearch() {
    updateConsole("====--------------------========--------------------====");
    // get user-selection
    const building = await getSelectedBuilding();
    const devices  = await getSelectedDevices();

    // Variables
    let totalNumDevices =  0; // count
    let not_found_count =  0; // count
    let f_hns           = []; // final hostnames
    let f_ips           = []; // final ips
    let f_rms           = []; // final rooms - used for csv output
    let pingResult      = [[],[]]; // return format for pingRequest
    var bdl = [];

    // tell the user what they did
    updateConsole("Selected Devices:\n" + devices);
    updateConsole("Searching " + building);
    // updateConsole("Total Devices:\n" + totalNumDevices);

    // Check All Buildings Flag
    if (building == "All Buildings") {
        bdl = await getBuildingList();
    } else {
        bdl = [building];
    }

    // do the ping
    for (var i = 0; i < bdl.length; i++) {
        updateConsole("=-+-+-+-=\n Now Searching " + bdl[i] + "\n=-+-+-+-=");
        pingResult = await pingpong(devices, bdl[i]);
        let rms    = await printPingResult(pingResult, bdl[i]);
        f_rms = f_rms.concat(rms);
        f_hns = f_hns.concat(pingResult[0]);
        f_ips = f_ips.concat(pingResult[1]);
    }

    updateConsole("====--------------------========--------------------====");

    // Double check operation
    if (f_hns.length != f_ips.length) {
        updateConsole("FATAL ERROR: Unexpected difference in number of returns.");
        updateConsole("Number of hostnames\n " + f_hns.length);
        updateConsole("Number of Ip-Addrs\n " + f_ips.length);
        updateConsole("Number of rooms\n " + f_rms.length);
    }

    // Find number of devices not found
    totalNumDevices = f_hns.length;
    for (var i = 0; i < f_ips.length; i++) {
        if(f_ips[i] == "x") {
            not_found_count += 1;
        }
    }

    // set the csv export data
    setCSVExport(f_hns, f_ips, f_rms);

    // Tell user how good the search went :)
    updateConsole("Search Complete");
    updateConsole("Found " + (totalNumDevices - not_found_count) + "/" + totalNumDevices + " devices.");
    updateConsole("CSV Export Available");

    return;
};

/*
$$\   $$\ $$$$$$$$\ $$\      $$\ $$\       
$$ |  $$ |\__$$  __|$$$\    $$$ |$$ |      
$$ |  $$ |   $$ |   $$$$\  $$$$ |$$ |      
$$$$$$$$ |   $$ |   $$\$$\$$ $$ |$$ |      
$$  __$$ |   $$ |   $$ \$$$  $$ |$$ |      
$$ |  $$ |   $$ |   $$ |\$  /$$ |$$ |      
$$ |  $$ |   $$ |   $$ | \_/ $$ |$$$$$$$$\ 
\__|  \__|   \__|   \__|     \__|\________|
*/

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

// add a building tile
async function postJNVis(graphBool, building) {
    let vis_container = document.createElement('div');
    vis_container.classList.add('vis_container');

    //vis_container.innerHTML = `<p class=visHeader> ${building} </p>`;
    // !! get list of rooms in the building 
    let rooms   = await getRooms(building);

    const devices  = await getSelectedDevices();
    let numDevices = devices.length; // NEEDS TO BE CORRECT AND DYNAMIC

    let HTML_visList = `<p class=visHeader> ${building} </p>`;

    let HTML_tmp_visTile = `<div class=visTile>`;

    for (var i = 0; i < graphBool.length; i++) { // iterating room
        HTML_tmp_visTile += `<ul class=rmColumn> ${rooms[i]}`;
        for (var j = 0; (j < graphBool[i].length); j++){ // iterating devices
            console.log(graphBool[i][j]);
            if (graphBool[i][j] == 0) {
                HTML_tmp_visTile += `<li class=devVisFalse> ${graphBool[i][j]} </li>`;
            } else{
                HTML_tmp_visTile += `<li class=devVisTrue> ${graphBool[i][j]} </li>`;
            }
        }
        HTML_tmp_visTile += `</ul></div>`;
        HTML_visList += HTML_tmp_visTile;
        HTML_tmp_visTile = `<div class=visTile>`;
    }

    HTML_visList += `</p>`;
    
    vis_container.innerHTML = HTML_visList;
    //vis_container.innerHTML += `</p>`;

    let progGuts = document.querySelector('.program_board .program_guts');
    progGuts.append(vis_container);
    return;
}

// SETTING THE HTML DOM
async function setJackNet() {
    const menuItems = document.querySelectorAll(".menuItem");
    const hamburger = document.querySelector(".hamburger");

    hamburger.addEventListener("click", toggleMenu);
    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

    document.title = "JackNet - Bronson";
    // Update tool_header
    let tool_header = document.querySelector('.tool_header');
    tool_header.innerHTML = 'JackNet';
    history.pushState("test", "JackNet", "/jacknet");
    console.log('Switching to jacknet');

    let progGuts = document.querySelector('.program_board .program_guts');
    let jn_container = document.createElement('div');
    jn_container.classList.add('jn_container');

    // Make a box for list of buildings
    let buildingSelect = document.createElement("div");
    buildingSelect.classList.add('jn_buildSelect');
    let set_inner_html = `
        <select id="building_list" class="jn_select">
        <option>
            All Buildings
        </option>`;
    let bl = await getBuildingList();
    for(var i in bl) {
        set_inner_html += `
            <option value=${i}>
                ${bl[i]}
            </option>`;
    }
    set_inner_html += '</select>';
    buildingSelect.innerHTML = `
        <fieldset class="jn_fieldset">
        <legend>
            Choose Building(s):
        </legend>
        ${set_inner_html}
        </fieldset>`;

    // REDO: what flags for checkbox are neccessary?
    //   - do we need value and name?
    let devSelect = document.createElement("div");
    devSelect.classList.add('jn_devSelect');
    devSelect.innerHTML = `
        <fieldset class="jn_fieldset">
            <legend>
                Choose Devices to Search For: </legend>
            <input class="cbDev" type ="checkbox" id="proc" name="jn_dev" value="Processors"/>
            <label for="proc"> 
                Processors</label>
            <br>
            <input class="cbDev" type="checkbox" id="pj" name="jn_dev" value="Projectors"/>
            <label for="pj">
                Projectors</label>
            <br>
            <input class="cbDev" type="checkbox" id="ws" name="jn_dev" value="Wyo Shares"/>
            <label for="ws">
                Wyo Shares</label>
            <br>
            <input class="cbDev" type="checkbox" id="tp" name="jn_dev" value="Touch Panels"/>
            <label for="tp">
                Touch Panels</label>
            <br>
            <input class="cbDev" type ="checkbox" id="cmicx" name="jn_dev" value="Ceiling Mics"/>
            <label for="cmicx">
                Ceiling Mics </label>
            <br>
        </fieldset>`;

    // log progress here ? (use tag progress)

    // Console Output
    let consoleOutput = document.createElement("div");
    consoleOutput.classList.add('jn_console');
    consoleOutput.innerHTML = `
        <fieldset class="jn_fieldset">
            <legend> 
                Console Output: </legend>
            <textarea readonly rows="30" cols ="75" class="innerConsole" name="consoleOutput" spellcheck="false"> 
                Console: JackNet Example
            </textarea>
        </fieldset>`;

    // Bottom Menu buttons
    // html options: menu
    let bottomMenu = document.createElement("div");
    bottomMenu.classList.add('jn_bottomMenu');
    bottomMenu.innerHTML = `
        <fieldset class="jn_fieldset">
            <legend>
                Options: </legend>
            <button id="run" onclick="runSearch()" class="headButton">
                Run Search</button>
            <button id="export" onclick="runExport()" class="headButton">
                Export as .csv </button>
            <button id="clearCon" onclick="clearConsole()" class="headButton"> 
                Clear Console </button>
        </fieldset>`;

    // PUT EVERYTHING TOGETHER MAIN_CONTAINER
    jn_container.appendChild(buildingSelect);
    jn_container.appendChild(bottomMenu);
    jn_container.appendChild(devSelect);
    jn_container.appendChild(consoleOutput);

    let main_container = document.createElement('div');
    main_container.appendChild(jn_container);
    main_container.classList.add('program_guts');

    progGuts.replaceWith(main_container);

    return;
  }