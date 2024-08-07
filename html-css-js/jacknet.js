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
};

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

async function filterIp(ip) {
    let buff = ip.split("(")[1];
    buff = buff.split(")")[0];
    return buff;
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
};

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
};

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

    let printHostnames = "";
    let printIps       = "";

    let rooms   = await getRooms(building);
    let bAbbrev = await getAbbrev(building);

    
    for (var i = 0; i < rooms.length; i++) {
        printHostnames = "";
        printIps       = "";
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
            }
        }
        updateConsole("Hostnames: " + printHostnames);
        updateConsole("IP's     : " + printIps);
    }
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
    for (var i = 0; i < f_ips.length; i++) {
        if(f_ips[i] == "x") {
            not_found_count += 1;
        } else { // filter "hostname.uwyo.dns (ip-address)"
            f_ips[i] = await filterIp(f_ips[i]);
        }
    }

    // set the csv export data
    setCSVExport(f_hns, f_ips, f_rms);

    // Tell user how good the search went :)
    console.log(f_hns.length);
    totalNumDevices = f_hns.length;

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

// SETTING THE HTML DOM
async function setJackNet() {
    console.log('Switching to jacknet');
    let progGuts = document.querySelector('.program_board .program_guts');
    let main_container = document.createElement('div');
    main_container.innerHTML = '<p>JackNet</p>';

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
    let set_inner_html = '<select id="building_list"><option>All Buildings</option>';
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
    devSelect.innerHTML = `
        <legend>Choose Devices to Search For: </legend>
        <input class="cbDev" type ="checkbox" id="proc" name="dev" value="Processors"/>
        <label for="proc"> 
            Processors</label>
        <br>
        <input class="cbDev" type="checkbox" id="pj" name="dev" value="Projectors"/>
        <label for="pj">
            Projectors</label>
        <br>
        <input class="cbDev" type="checkbox" id="ws" name="dev" value="Wyo Shares"/>
        <label for="ws">
            Wyo Shares</label>
        <br>
        <input class="cbDev" type="checkbox" id="tp" name="dev" value="Touch Panels"/>
        <label for="tp">
            Touch Panels</label>
        <br>
        <input class="cbDev" type ="checkbox" id="cmicx" name="dev" value="Ceiling Mics"/>
        <label for="cmicx">
            Ceiling Mics </label>
        <br>`;

    // log progress (use tag progress)

    // Console Output
    let consoleOutput = document.createElement("fieldset");
    consoleOutput.classList.add('consoleOutput');
    consoleOutput.innerHTML = `
        <legend> Console Output: </legend>
        <textarea readonly rows="10" cols ="80" class="innerConsole" name="consoleOutput" spellcheck="false"> 
            Console: JackNet Example
        </textarea>`;

    // Bottom Menu buttons
    // html options: menu
    let bottomMenu = document.createElement("fieldset");
    bottomMenu.classList.add('bottomMenu');
    bottomMenu.innerHTML = `
        <legend>Options: </legend>
        <menu>
            <button id="run" onclick="runSearch()">Run Search</button>
            <button id="export" onclick="runExport()">Export as .csv </button>
            <button id="clearCon" onclick="clearConsole()"> Clear Console </button>
        </menu>`;

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