/*
    _            _               _     _     
   (_)          | |             | |   (_)    
    _  __ _  ___| | ___ __   ___| |_   _ ___ 
   | |/ _` |/ __| |/ / '_ \ / _ \ __| | / __|
   | | (_| | (__|   <| | | |  __/ |_ _| \__ \
   | |\__,_|\___|_|\_\_| |_|\___|\__(_) |___/
  _/ |                               _/ |    
 |__/                               |__/     

This file contains all code relating to jacknet and will manipulate the DOM in index.html accordingly, this file contains calls to the backend to ping devices and all of the handling
for when it receives a response, such as drawing visualizer tiles.

Data
    - CSV_EXPORT declared
    - setCSVExport(hns, ips, rms)
    - getSelectedDevices()
    - getSelDevNames(binaryDevList)
    - getSelectedBuilding()
    - pad(n, width, z)
Export
    - runExport()
    - downloadCsv(data)
Search
    - runSearch()
    - PingPong(devices, building)            - flag: "ping"
    - formatPingPong(PingPongJSON, devices)
    - printPR(formPing, building, deviceNames)
HTML
    - clearConsole()
    - updateConsole(text)
    - closeVisTab(tabID)
    - minimizeVisTab(tabID)
    - genTileID(building)
    - postJNVis(hns, ips, building, totalDevices, totalNotFound, devicesNames)
    - setJackNet()
 
    NOTES

there should be an object for the csv export and if a search is ran, it is overwritten. If possible fade the export button until the first search is ran.

TODO:
    [ ] - All Buildings PopUp, "Are You Sure?"
    [ ] - When a response is received add new buttons to the options
        - "collapse all/expand all" 
            when we have all these tiles it may be nice to collapse all of them
    [ ] - change the minimze/exapand button to change depending on state.
*/

/*
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

// ---- ---- -- -- -  GET USER CONFIG FUNCTIONS
// getSelectedDevices()
//   - returns a list of booleans mapped to device types
//   [1,1,0,0,0,0] Representing procs and pjs.
//     Relations:
//   [procs, projs, disps, ws, tp, cmix]
function getSelectedDevices() {
    let devices = document.getElementsByName('jn_dev');
    let devList = [];
    for (var i = 0; i < devices.length; ++i) {
        if(devices[i].checked === true) {
            devList.push(1);
        } else {
            devList.push(0);
        };
    };
    let sum = devList.reduce((acc, cur) => acc + cur, 0);
    if (sum == 0) {
        devList = [1,1,1,1,1,1];
    }
    return devList;
}

//getSelDevNames(binaryDevList)
// converts binaryDevList provided from getSelectedDevices(
//  to an array of device names. 
// This is used in the visualizer to get index collumn headers. 
function getSelDevNames(binaryDevList) {
    const devices = ["Processor", "Projector(s)", "Display(s)", "Wyo Share", "Touch Panel", "Ceiling Mic"];
    output = [];
    for(var i=0;i < binaryDevList.length; i++) {
        if (binaryDevList[i]) {
            output.push(devices[i]);
        } else {
            continue;
        }
    }
    return output;
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
*/

function runExport() {
    // IDEAL CSV FORMAT (from original roomcheck excel sheet)
    // EN 1055
    // Hostname:   en-1055-proc1    en-1055-ws1   ...
    // Ip:           10.10.10.10              x   ...
    //  ...
    csvRows = [];
    const headers = Object.keys(CSV_EXPORT);
    const values  = Object.values(CSV_EXPORT);
    // Break values into better variables
    let hostnames = values[0];
    let ips = values[1];
    let rms = values[2];
    updateConsole("-------=-------");
    updateConsole("Exporting CSV");
    // updateConsole(hostnames[0]);
    // updateConsole(rms);
    // updateConsole("DEBUG: Values:\n" + values);

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

*/

// runSearch()
// runs the search and calls the above functions to do so.
//     TODO: 
//        [ ] - Add a pop-up when "All Buildings" is selected. Are you sure? This will be computationally very heavy and may take some time to complete.
async function runSearch() {
    updateConsole("====--------------------========--------------------====");
    //Disable button - prevents abuse of server
    const runButton = document.getElementById('run');
    runButton.disabled = true;
    // If the user is not on JackNet by the end of the ping,
    // funny things can happen.
    let userOnPage = true;
    // get user-selection
    const building = await getSelectedBuilding();
    const devices  = getSelectedDevices();
    const deviceNames = getSelDevNames(devices);

    // Variables
    let totalNumDevices =  0; // count
    let not_found_count =  0; // count
    let f_hns           = []; // final hostnames
    let f_ips           = []; // final ips
    let f_rms           = []; // final rooms - used for csv output
    let pingResult      = [[],[]]; // return format for pingRequest
    var bdl = [];

    // tell the user what they did
    updateConsole("Selected Devices:\n" + deviceNames);
    updateConsole("Searching " + building);
    // updateConsole("Total Devices:\n" + totalNumDevices);

    // Check All Buildings Flag
    if (building == "All Buildings") {
        bdl = await getBuildingList();
        // TODO: STOP THE USER HERE AND ASK ARE YOU SURE.
        // await abPrompt();
    } else {
        bdl = [building];
    }

    // do the ping
    for (var i = 0; i < bdl.length; i++) {
        updateConsole("=-+-+-+-=\n Now Searching " + bdl[i] + "\n=-+-+-+-=");
        b_abbrev = await getAbbrev(bdl[i]);
        pingResult = await pingpong(devices, b_abbrev);
        // Expect the structure of ping result to change.
        let formPR = formatPingPong(pingResult, devices);
        // console.log("JackNet Debug - formPR:\n", formPR);
        // - maybe
        // TODO - check document title and if it is not jacknet,
        //  chuck the response into session storage and when the user 
        //  goes back to JackNet, continue with everything below
        if (document.title != "JackNet - Bronson") {
            console.log("Response from JackNet Received, placing in a queue");
            userOnPage = false;
            stashJNResponse(formPR, bdl[i], deviceNames);
        } else {
            // temp: eventually pingResult will return as this form
            let rms   = await printPR(formPR, bdl[i], deviceNames);
            // COULD STASH THESE TO MAINTAIN THE TOTAL RESPONSE OUTPUT
            f_rms = f_rms.concat(rms);
            f_hns = f_hns.concat(formPR[0].flat(3));
            f_ips = f_ips.concat(formPR[1].flat(3));
        }
    }
    // If the user is on the page the whole time continue with this.
    if(userOnPage) {
        // console.log("JackNet Debug - f_ips:\n",f_ips);
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

        // // Tell user how good the search went :)
        // updateConsole("Search Complete");
        // updateConsole("Found " + (totalNumDevices - not_found_count) + "/" + totalNumDevices + " devices.");
        updateConsole("CSV Export Available");
    }
    // re-enable runButton;
    runButton.disabled = false;
    return;
};

// Requests ping with device list and building.
//  jn_body.rooms[i].hostnames
async function pingpong(devices, building) {
    return await fetch('ping', {
        method: 'POST',
        body: JSON.stringify({
            devices: devices,
            building: building
        })
    })
    .then((response) => response.json())
    .then((json) => {return json;});
}

// Takes the 'jn_body' response and turns it into a nested array of nested arrays, (could be revised)
// INPUT: 'jn_body' (Data Hashmap from backend)
// OUTPUT:
//   [
//     [[ROOM1-DEV1-1, ROOM1-DEV1-2],[ROOM1-DEV2-1],[]],
//     [[ROOM2-DEV1-1, ROOM2-DEV1-2],[ROOM2-DEV2-1],[ROOM2-DEV3-1]],
//     [[...],[...]]
//   ],
//   [
//      [[IP-ADDRS],[...],[...]],
//      [[...],[...],[...]]
//   ]
function formatPingPong(PingPongJSON, devices) {
    // tmp
    let tmp_hn = [];
    let tmp_ip = [];
    let index_weight = 0;
    // out
    let out_hn = [];
    let out_ip = [];
    //
    let room_list = PingPongJSON['jn_body'];
    for(var i = 0; i < room_list.length; i++) {
        let room_arr_hn = [];
        let room_arr_ip = [];
        for (var k = 0; k < devices.length; k++) {
            if (devices[k] != 0) {
                let dev_type;
                switch (k) {
                    case 0:
                        dev_type = "PROC";
                        break;
                    case 1:
                        dev_type = "PJ";
                        break;
                    case 2:
                        dev_type = "DISP";
                        break;
                    case 3:
                        dev_type = "WS";
                        break;
                    case 4:
                        dev_type = "TP";
                        break;
                    case 5:
                        dev_type = "CMIC";
                        break;
                    default:
                        dev_type = "UNKNOWN";
                        break;
                }

                let filtered_arr = room_list[i]["ping_data"].filter(element => element.hostname.dev_type === dev_type);
                let tmp_hn = [];
                let tmp_ip = [];
                for (var j=0; j<filtered_arr.length; j++) {
                    let ping_element = filtered_arr[j];
                    let hn_element = ping_element.hostname;
                    tmp_hn.push(`${hn_element.room.replace(" ", "-")}-${hn_element.dev_type}${hn_element.num}`);
                    tmp_ip.push(ping_element.ip);
                }

                // push to output arrays
                room_arr_hn.push(tmp_hn);
                room_arr_ip.push(tmp_ip);
            }
        }

        out_hn.push(room_arr_hn);
        out_ip.push(room_arr_hn);
    }
    // output
    let new_PR = [out_hn, out_ip];
    console.log(new_PR);
    return new_PR;
}

// New replacement printPingResult for the new response format
async function printPR(formPing, building, deviceNames) {
    let hns = formPing[0];
    let ips = formPing[1];

    let graphBool = [];
    let tmpBool = [];

    let printHostnames = "";
    let printIps       = "";
    let rms = [];

    let totalNumDevices = 0;
    let not_found_count = 0;
    let rooms   = await getRooms(building);
    
    // Iterate over each room in hns
    for (var j = 0; j < hns.length; j++) {
        printHostnames = "";
        printIps       = "";
        tmpBool = [];
        updateConsole("---------");
        updateConsole(rooms[j].name);
        // ROOM NUMBER
        roomNum = rooms[j].name.split(" ")[1];
        rms.push(rooms[j].name);
        // Iterate over the device type in each room in each hn
        for (var a=0; a < hns[j].length; a++) {
            // Iterate over each hostname in a given device type
            totalNumDevices += hns[j][a].length;
            for (var k=0; k < hns[j][a].length; k++) {
                // if hostname contains room#
                //   add to printout hostname line
                //   add corresponding ip
                if(hns[j][a][k].includes(pad(roomNum, 4))) {
                    printHostnames += pad(hns[j][a][k], 15, " ") + "|";
                    printIps       += pad(ips[j][a][k], 15, " ") + "|";
                } if (ips[j][a][k] == "x") {
                    not_found_count += 1;
                }
            }
        }
        updateConsole("Hostnames: " + printHostnames);
        updateConsole("IP's     : " + printIps);
        graphBool.push(tmpBool)
    }
    // Tell user how good the search went :)
    updateConsole("Singular Building Search Complete");
    updateConsole("Building Report:\n -- Found " + (totalNumDevices - not_found_count) + "/" + totalNumDevices + " devices.");
    // we got it, send to visualizer
    postJNVis(hns, ips, building, totalNumDevices, not_found_count, deviceNames);
    return rms;
}

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
    let consoleObj = document.querySelector('.jn_innerConsole');
    consoleObj.value = '';
    // remove every div with the class 'vis_container'
    let visObj = document.querySelectorAll('.vis_container').forEach(element =>    {
        element.remove();
    }
    );
    // clear html cache
    sessionStorage.removeItem("JackNet_html");
    return;
};

// updates the console by appending an item of text to contents
function updateConsole(text) {
    let consoleObj = document.querySelector('.jn_innerConsole');
    const beforeText = consoleObj.value.substring(0, consoleObj.value.length);
    consoleObj.value = beforeText + '\n' + text;
    consoleObj.scrollTop = consoleObj.scrollHeight;

    return;
};

// Helpers
function closeVisTab(tabID) {
    // get document select by ID.
    // remove from dom. see clear console button function
    let visObj = document.getElementById("tile"+tabID)
    visObj.remove();
    return;
}

function minimizeVisTab(tabID) {
    // minimze tab
    // add a tag to the element with the class name "visTile"
    let visObj = document.getElementById(tabID);
    if (visObj.classList.contains("hideVisTile")) {
        visObj.classList.remove("hideVisTile");
        // closeIcon.style.display = "none";
        // menuIcon.style.display = "block";
    } else {
        visObj.classList.add("hideVisTile");
        // closeIcon.style.display = "block";
        // menuIcon.style.display = "none";
    }
    return;
}

// Makes a unique Tile ID for visualizer tabs
function genTileID(building) {
    let time = Date.now();
    let outputID = building + String(time);
    return outputID;
}

// Takes a nested array(rooms) of nested arrays(deviceType) for hns and ips
// This is where we post some visualizations
// Put together visualizer information
/*      GOAL:
                        * BUILDING *         |x| |
                            ---                  |
      ROOOOM |#1 |#2 |#3|   ...     #9999        |
    ---------------------------------------------|
        proc |o  |o  |o |                        |
        pj   |x o|   |  |                        |
        disp |   |o o|o |                        |
        ws   |x  |o  |  |                        |
        tp   |o  |o  |o |                        |
    ---------------------------------------------|
*/
// There are alot of inputs here, may want to pass an object (?)
async function postJNVis(hns, ips, building, totalDevices, totalNotFound, devicesNames) {
    // Init Visualizer Tile
    let vis_container = document.createElement('li');
    vis_container.classList.add('vis_container');
    // !--! List of rooms/devices in newly pinged building 
    let rooms           = await getRooms(building);
    //const devicesNames  = getSelDevNames(await getSelectedDevices());
    // - Build our tile HTML block 
    //   Give this as an ID,
    let tileID = genTileID(building);
    vis_container.id = "tile" + tileID;
    let bAbbrev = await getAbbrev(building);
    let totalFound = totalDevices - totalNotFound;
    // TODO - add a percentage in the header?
    let HTML_visHeader = `<div class="visHeader"> ${building} (${bAbbrev})<button class="visButton" onclick="closeVisTab(\'${tileID}\')"> x </button><button class="visButton" onclick="minimizeVisTab(\'${tileID}\')"> _ </button><span style="color: rgb(95, 95, 95); margin: 0% 2%;float:right"> ${totalFound}/${totalDevices} Devices Found</span></div>`;
    // Compile lists...
    // Tables are row based instead of column, making this a little different
    //  than the ul list like before.
    tableHeaders = ["Room #:"];
    for(var i = 0; i < rooms.length; i++) {
        let roomNumber = rooms[i].name.split(" ")[1];
        roomNumber = parseInt(roomNumber);
        tableHeaders.push(`<p class=visRoomHeadText>${roomNumber}</p>`);
    }
    // Device Lists
    //  More complicated due to a dynamic number of rows.
    //  iterating through device lists, creating a nested array
    let deviceRows = [];
    for(devName in devicesNames) {
        let tmpRow = [String(devicesNames[devName])];
        // iterate through hostnames/ips by ROOM
        for(var j = 0; j < hns.length; j++) {
            let HTML_visRoomEntry = `<ul class="visRoomDeviceList">`;
            // Looking at a specific device
            for(var a = 0; a < hns[j][devName].length; a++) {
                // for each hostname in each kind of type
                // Did we find it?
                if(ips[j][devName][a] == "x") {
                    bool_ipFound = false;
                } else {
                    bool_ipFound = true;
                }
                if (bool_ipFound) { // Positive Hit
                    HTML_visRoomEntry += `<li class="visRoomDeviceItem visTrue" title="Hostname: ${hns[j][devName][a]}\n            IP: ${ips[j][devName][a]}"> _ </li>`;
                } else { // Negative Hit
                    HTML_visRoomEntry += `<li class="visRoomDeviceItem visFalse" title="${hns[j][devName][a]} not found"> _ </li>`;
                }
            }
            // If there are no hostnames
            if (hns[j][devName].length == 0) {
                HTML_visRoomEntry += `<li class="visRoomDeviceItem" title="No Device in Inventory">_</li>`;
            }
            HTML_visRoomEntry += `</ul>`;
            tmpRow.push(HTML_visRoomEntry);
        }
        deviceRows.push(tmpRow);
    }
    // Put it together
    //  Headers
    let HTML_table = `<table class="visTile"  id=\"${tileID}\"> <tr>`;
    for(header in tableHeaders) {
        HTML_table += `<th class="visRoomHead"> ${tableHeaders[header]} </th>`;
    }
    HTML_table += `</tr>`;
    //  Device Rows
    for(row in deviceRows) {
        HTML_table += `<tr>`;
        for(hostname in deviceRows[row]) {
            if (hostname == 0) {
                HTML_table += `<td class="visIndexItem">${deviceRows[row][hostname]} </td>`
            } else {
                HTML_table += `<td class="visRoomDevice"> ${deviceRows[row][hostname]} </td>`;
            }
        }
        HTML_table += `</tr>`;
    }
    HTML_table += `</table>`;
    // Put it all together
    vis_container.innerHTML = HTML_visHeader + HTML_table;
    // Put it on the page
    let progGuts = document.querySelector('.program_board .program_guts .jn_visList');
    progGuts.append(vis_container);
    return;
}

// SETTING THE HTML DOM
async function setJackNet() {
    // 7.7.25 - what is a menuItem?
    const menuItems = document.querySelectorAll(".menuItem");

    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

    preserveCurrentTool();

    document.title = "JackNet - Bronson";
    // remove currently active status mark tab has active.
    // Update active_tab_header
    // let active_tab_header = document.querySelector('.active_tab_header');
    // active_tab_header.innerHTML = 'JackNet';
    let current = document.getElementsByClassName("selected");
    if (current.length != 0) {
        // current[0].classList.remove("active");
        current[0].classList.remove("selected");
    }
    let newCurrent = document.getElementById("JNButton");
    // newCurrent.classList.add("active");
    newCurrent.classList.add("selected");

    history.pushState("test", "JackNet", "/jacknet");

    let progGuts = document.querySelector('.program_board .program_guts');
    // Check for preserved space
    let cached_HTML = sessionStorage.getItem("JackNet_html");
    if (cached_HTML != null) {
        progGuts.innerHTML = cached_HTML;
        const runButton = document.getElementById('run');
        runButton.disabled = false;
        let stash = JSON.parse(sessionStorage.getItem("JackNet_stash"));
        if (stash != null) {
            console.log("JackNet Stash Found, unloading items");
            for(response in stash.stashList) {
                console.log(stash.stashList[response]);
                let pr = stash.stashList[response]["formattedPingRequest"];
                let bn = stash.stashList[response]["buildingName"];
                let dn = stash.stashList[response]["deviceNames"];
                await printPR(pr, bn, dn);
            }
            // reset stash
            sessionStorage.removeItem("JackNet_stash");
            // Reset button
            let jnButton = document.getElementById("JNButton");
            //jnButton.innerHTML = `<img class="tab_img" src="button2.png"/><span>JackNet</span>`;
            jnButton.classList.remove("stashed");
        }
        return;
    }

    //--- No html cache found, build from scratch
    let jn_container = document.createElement('div');
    jn_container.classList.add('jn_container');

    // Make a box for list of buildings
    let buildingSelect = document.createElement("div");
    buildingSelect.classList.add('jn_buildSelect');
    let set_inner_html = `
        <select id="building_list">
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
        <fieldset>
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
        <fieldset>
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
            <input class="cbDev" type="checkbox" id="disp" name="jn_dev" value="Display"/>
            <label for="disp">
                Displays</label>
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
        <fieldset>
            <legend> 
                Console Output: </legend>
            <textarea readonly rows="15" cols ="75" class="jn_innerConsole" name="consoleOutput" spellcheck="false"> 
JackNet Console: Responses will be printed here along with some tiles below.
            </textarea>
        </fieldset>`;

    // Bottom Menu buttons
    // html options: menu
    let bottomMenu = document.createElement("div");
    bottomMenu.classList.add('jn_bottomMenu');
    bottomMenu.innerHTML = `
        <fieldset>
            <legend>
                Options: </legend>
            <button id="run" onclick="runSearch()" class="headButton">
                Run Search</button>
            <button id="export" onclick="runExport()" class="headButton">
                Export as .csv </button>
            <button id="clearCon" onclick="clearConsole()" class="headButton"> 
                Clear</button>
        </fieldset>`;

    // Empty Visualizer Container
    let visualizerSection = document.createElement("ul");
    visualizerSection.classList.add('jn_visList');

    // PUT EVERYTHING TOGETHER MAIN_CONTAINER
    jn_container.appendChild(buildingSelect);
    jn_container.appendChild(bottomMenu);
    jn_container.appendChild(devSelect);
    jn_container.appendChild(consoleOutput);
    

    let main_container = document.createElement('div');
    main_container.appendChild(jn_container);
    main_container.classList.add('program_guts');
    main_container.appendChild(visualizerSection);
    progGuts.replaceWith(main_container);

    return;
  }