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

    return bl.sort();
}

// Returns a list of rooms given a building name
async function getRooms(buildingName) {
    let data = await getData();
    data = JSON.stringify(data);
    let buildingData = JSON.parse(data).buildingData;
    for(var i = 0; i < buildingData.length; i++) {
        if(buildingData[i].name == buildingName) {
            return buildingData[i].rooms.sort();
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
    //console.log("JN Binary Device List:", devList);
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
        updateConsole("---------");
        updateConsole(bAbbrev + " " + rooms[i]);
        rms.push(bAbbrev + " " + rooms[i]);
        // Iterate over the hostnames
        for (var j=0; j < hns.length; j++) {
            // if hostname contains room#
            //   add to printout hostname line
            //   add corresponding ip
            if(hns[j].includes(pad(rooms[i], 4))){
                printHostnames += pad(hns[j], 15, " ") + "|";
                printIps       += pad(ips[j], 15, " ") + "|";
                // Visualizer Booleans
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
    
    // we got it 
    //console.log(graphBool);
    postJNVis(graphBool, building);

    return rms;
}

// New replacement printPingResult for the new response format
// [
//  [[room1-dev1-hn1],[room1-dev2-hn1]],
//  [[][room2-dev2-hn1]],
//  ...
// ],
// [
//  [[IP-Addr],[IP-Addr]],
//  [[][IP-Addr]],
//  ...
// ]
// TODO - replace printPingRequest
// note index value names are important
async function printPR2(formPing, building) {
    let hns = formPing[0];
    let ips = formPing[1];

    let graphBool = [];
    let tmpBool = [];

    let printHostnames = "";
    let printIps       = "";
    let rms = [];

    let rooms   = await getRooms(building);
    let bAbbrev = await getAbbrev(building);
    
    // Iterate over each room in hns
    for (var j = 0; j < hns.length; j++) {
        printHostnames = "";
        printIps       = "";
        tmpBool = [];
        updateConsole("---------");
        updateConsole(bAbbrev + " " + rooms[j]);
        rms.push(bAbbrev + " " + rooms[j]);
        // Iterate over the device type in each room in each hn
        for (var a=0; a < hns[j].length; a++) {
            // Iterate over each hostname in a given device type
            for (var k=0; k < hns[j][a].length; k++) {
                // if hostname contains room#
                //   add to printout hostname line
                //   add corresponding ip
                //console.log("JN-Debug: Hostname", hns[j][a][k])
                if(hns[j][a][k].includes(pad(rooms[j], 4))) {
                    printHostnames += pad(hns[j][a][k], 15, " ") + "|";
                    printIps       += pad(ips[j][a][k], 15, " ") + "|";
                }
            }
        }
        updateConsole("Hostnames: " + printHostnames);
        updateConsole("IP's     : " + printIps);
        graphBool.push(tmpBool)
    }
    // we got it 
    postJNVis2(hns, ips, building);

    return rms;
}

// runSearch()
// runs the search and calls the above functions to do so.
//     TODO: 
//        [ ] - Fix "all buildings" export by adding new data structures
//        [ ] - Add a pop-up when "All Buildings" is selected. Are you sure? This will be computationally very heavy and may take some time to complete.
async function runSearch() {
    updateConsole("====--------------------========--------------------====");
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
        // TODO [ ] - UPDATE PINGPONG TO RETURN HN/IP array
        pingResult = await pingpong(devices, b_abbrev);
        // Expect the structure of ping result to change.
        console.log("JN-PingResult: ", pingResult);
        // We will need to introduce a series of functions to handle
        //  this new structure. (TRIM THIS)
        let formPR = formatPingPong(pingResult, devices);
        //let formPR = fixPR(pingResult, devices); 
        // temp: eventually pingResult will return as this form
        //let rms    = await printPingResult(pingResult, bdl[i]);
        let rms   = await printPR2(formPR, bdl[i]);

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

function formatPingPong(PingPongJSON, devices) {
    // tmp
    let tmp_hn = [];
    let tmp_ip = [];
    let index_weight = 0;
    // out
    let out_hn = [];
    let out_ip = [];
    //
    let inner_body = PingPongJSON['jn_body'];
    let room_list = inner_body['rooms'];
    for(var i = 0; i < room_list.length; i++) {
        index_weight = 0;
        // get hn/ip and trim uncalled devices
        tmp_hn = room_list[i]['hostnames'];
        tmp_ip = room_list[i]['ips'];
        // iterate through devices and if 0, slice
        for(var j = 0; j < devices.length; j++) {
            if (!devices[j]) {
                //console.log("JN-Removing uncalled device type");
                tmp_hn.splice(j - index_weight, 1);
                tmp_ip.splice(j - index_weight, 1);
                index_weight++;
            }
        }
        // push to output arrays
        out_hn.push(tmp_hn);
        out_ip.push(tmp_ip);
    }
    // check output
    console.log(out_hn);
    console.log(out_ip);
    // output
    let new_PR = [out_hn, out_ip];
    return new_PR;
}

// TODO - StructureChange
/*
This takes the form from [[hostnames], [ips]]
to [[hn-dev1],[hn2-dev1, hn2-dev2]],[],[hn4-dev1]][room2]
This is a nested array where each element is a nested array of device types.
Strategy:
 1. Create a number of slices based on number of rooms.
    - Find the first element containing a new room.
    - go through entire array and get out [[room1],[room2],...]
 2. Create a number of slices from device types in room.
    - for each room take turn into [[dev1],[dev2],...]
 3. Append above output to output.
*/
// NOTE: Additional inputs are required in the event that a device does not exist in the room
//   but was still one of the selected devices. Meaning, each room has an array for each selected
//   device.
// Could adjust this to make sure we get an empty nested array for empty rooms
//  planning on just leaving such cases out of the visualizer. But when we are receiving responses in this format we will cut this function out and need to add that functionality.
// function fixPR(pingRequest,devices) {
//     output = [];
//     tmpHN = [];
//     tmpIP = []
//     //Init the first room number
//     tmpRoom = pingRequest[0][0].split('-')[1];
//     tmpIndex = 0;
//     devCount = 0;
//     // Number of rooms
//     const N = pingRequest[0].length; // Number of hostnames/Ips
//     // Iterate over hostnames
//     for(var i = 1; i < N; i++) {
//         // Slice inbetween the two '-' signs.
//         if (tmpRoom != pingRequest[0][i].split('-')[1]) {
//             newRoomElement_HN = pingRequest[0].slice(tmpIndex, i);
//             newRoomElement_IP = pingRequest[1].slice(tmpIndex, i);
//             tmpHN.push(newRoomElement_HN);
//             tmpIP.push(newRoomElement_IP);
//             tmpIndex = i;
//             tmpRoom = pingRequest[0][i].split('-')[1];
//         }
//         else if(i == N-1) {
//             newRoomElement_HN = pingRequest[0].slice(tmpIndex, N);
//             newRoomElement_IP = pingRequest[1].slice(tmpIndex, N);
//             tmpHN.push(newRoomElement_HN);
//             tmpIP.push(newRoomElement_IP);
//         }
//         //console.log("JN-PingResultReformat:tmpIndex", tmpIndex);
//     }
//     //console.log("JN-PingResultReformat:tmpHN", tmpHN);
//     //console.log("JN-PingResultReformat:tmpIP", tmpIP);

//     outputHN = [];
//     outputIP = [];
//     // Iterate over each room in tmpHN
//     for(var j = 0; j < tmpHN.length; j++) {
//         tmpRoomHN = [];
//         tmpRoomIP = [];
//         //iterate through devices Booleans
//         for(var x = 0; x < devices.length; x++) {
//             // If we are looking for a device
//             if(devices[x]) {
//                 tmpDevHN = [];
//                 tmpDevIP = [];
//                 // Iterate through each item in a room in tmpHN
//                 for(var k = 0; k < tmpHN[j].length; k++) {
//                     // Get current hostname device type
//                     tmpIndex = tmpHN[j][k].split('-').pop().slice(0,-1); // ie: PROC
//                     //console.log("JN-DEBUG: Looking at ", tmpHN[j][k],"indexes(j,x,k): ", j,x,k, "tmpIndex: ", tmpIndex);
//                     switch(x) {
//                         case 0: //Processor and so on
//                             if(tmpIndex == "PROC") {
//                                 //console.log("Pushing Proc HN/IP");
//                                 tmpDevHN.push(tmpHN[j][k]);
//                                 tmpDevIP.push(tmpIP[j][k]);
//                             }
//                             break;
//                         case 1:
//                             if(tmpIndex == ("PROJ" || "PJ")) {
//                                 //console.log("Pushing Projector HN/IP");
//                                 tmpDevHN.push(tmpHN[j][k]);
//                                 tmpDevIP.push(tmpIP[j][k]);
//                             }
//                             break;
//                         case 2:
//                             if(tmpIndex == "DISP") {
//                                 tmpDevHN.push(tmpHN[j][k]);
//                                 tmpDevIP.push(tmpIP[j][k]);
//                             }
//                             break;
//                         case 3:
//                             if(tmpIndex == "WS") {
//                                 tmpDevHN.push(tmpHN[j][k]);
//                                 tmpDevIP.push(tmpIP[j][k]);
//                             }
//                             break;
//                         case 4:
//                             if(tmpIndex == "TP") {
//                                 tmpDevHN.push(tmpHN[j][k]);
//                                 tmpDevIP.push(tmpIP[j][k]);
//                             }
//                             break;
//                         case 5:
//                             if(tmpIndex == "CMIX") {
//                                 tmpDevHN.push(tmpHN[j][k]);
//                                 tmpDevIP.push(tmpIP[j][k]);
//                             }
//                             break;
//                         default:
//                             break;
//                     }
//                     //console.log("JN-Debug: Current tmpDevHN: ", tmpDevHN);
//                 }
//                 // Add array of devices found in room (could be empty)
//                 tmpRoomHN.push(tmpDevHN);
//                 tmpRoomIP.push(tmpDevIP);
//             }
//         }
//         outputHN.push(tmpRoomHN);
//         outputIP.push(tmpRoomIP);
//     }
//     // Bring it all together
//     output.push(outputHN);
//     output.push(outputIP);
//     console.log("JN-Request Reformat Output: ", output);
//     return output;
// }

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
    // TODO - Clear Visualizer Section
    // remove every div with the class 'vis_container'
    let visObj = document.querySelectorAll('.vis_container').forEach(element =>    {
        element.remove();
    }
    );

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

// // add a building visualization tile
// // TODO - Replace this function w/ new better system
// async function postJNVis(graphBool, building) {
//     // Init Visualizer Tile
//     let vis_container = document.createElement('div');
//     vis_container.classList.add('vis_container');
//     // !--! List of rooms/devices in newly pinged building 
//     let rooms      = await getRooms(building);
//     const devices  = getSelDevNames(await getSelectedDevices());
//     // EX: devices -> ["Processors", "Ceiling Mics"]
//     console.log("JN-Visualizing building (OLD): ", building, " for ", devices);
//     //console.log("JN-GraphBool: ", graphBool)

//     let numDevices = devices.length;
//     // Where is num Devices used?

//     let HTML_visList = `<p class=visHeader> ${building} </p>`;

//     let HTML_tmp_visTile = `<div class=visTile>`;

//     //TODO - create div class = visIndex
//     //   Contains <ul>Index<li>devices[1]</li><\ul>

//     for (var i = 0; i < graphBool.length; i++) { // iterating room
//         HTML_tmp_visTile += `<ul class=rmColumn> ${rooms[i]}`;
//         for (var j = 0; (j < graphBool[i].length); j++){ // iterating devices
//             if (graphBool[i][j] == 0) {
//                 HTML_tmp_visTile += `<li class=devVisFalse> ${graphBool[i][j]} </li>`;
//             } else{
//                 HTML_tmp_visTile += `<li class=devVisTrue> ${graphBool[i][j]} </li>`;
//             }
//         }
//         HTML_tmp_visTile += `</ul></div>`;
//         HTML_visList += HTML_tmp_visTile;
//         HTML_tmp_visTile = `<div class=visTile>`;
//     }

//     HTML_visList += `</p>`;
    
//     vis_container.innerHTML = HTML_visList;
//     //vis_container.innerHTML += `</p>`;

//     let progGuts = document.querySelector('.program_board .program_guts');
//     progGuts.append(vis_container);
//     return;
// }
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

// TODO - Make this unique
function genTileID(building, devices) {
    return building;
}
// Rewrite for visualizer
// Takes a nested array(rooms) of nested arrays(deviceType) for hns and ips
// This is where we post some visualizations
// Put together visualizer information
// TO-DO:
    /*      GOAL:
                            * BUILDING *         |x| |
                                ---                  |
        ROOOOM |#1 |#2 |#3|     ...     #9999        |
        ---------------------------------------------
          proc |o  |o  |o |                          |
            pj |x o|   |  |                          |
          disp |   |o o|o |                          |
            ws |x  |o  |  |                          |
            tp |o  |o  |o |                          |
        ---------------------------------------------
        Need some nested booleans array for each room
        ie: 
        TODO - Format graphBool and handling of it here.
        graphBool:
            [[1],[0,1],[],[0],[1]],
            [[1],[],[1,1],[1],[1]],
            [[1],[],[1],[],[1]],
             ...]
        building: AG
    */
// Note, instead of booleans, I want the full object so I can implement an on hover show hostname/ip
// Note: I do not believe rooms w/o devices will appear. This is because the temp struct
//  change does not include it (can't easily find rooms that are not in the response).
//  However, they will be included in the incoming updated response, make sure that is
//  accounted for.
async function postJNVis2(hns, ips, building) {
    // Init Visualizer Tile
    let vis_container = document.createElement('div');
    vis_container.classList.add('vis_container2');
    
    // !--! List of rooms/devices in newly pinged building 
    let rooms           = await getRooms(building);
    const devicesNames  = getSelDevNames(await getSelectedDevices());
    // What are we doing right now?
    console.log("JN-Visualizing building: ", building, " for ", devicesNames);
    // - Build our tile HTML block 
    //          TODO- Add tag for vis container
    // hash - building name/results back/time.
    //   Give this as an ID,
    let tileID = genTileID(building, devicesNames);
    vis_container.id = "tile" + tileID;
    //  - TODO - Add minimize and close buttons
    /*
    Need two new new buttons and the close will need a unique identifier for each tab. see tag/ID todo above
    */
    
    let HTML_visHeader = `<div class="visHeader2"> ${building} <button class="visButton" onclick="closeVisTab(\'${tileID}\')"> x </button><button class="visButton" onclick="minimizeVisTab(\'${tileID}\')"> _ </button></div>`;

    // - Build an index section/left hand side, lists all devices searched for.
    let HTML_visIndex = `<ul class="visIndex"> <li class="visIndexItemHead"> Room # </li>`;
    for(var i = 0; i < devicesNames.length; i++) {
        HTML_visIndex += `<li class="visIndexItem"> ${devicesNames[i]} </li>`;
    }
    HTML_visIndex += `</ul>`;
    // - Build each room collumn. Nested ul.
    /*  BUILDING THIS HTML BLOCK
    <ul class=visRooms> ROOM#
        <ul class = visRoomDeviceList>
            <li class=visRoomDeviceItem>0</li>   : + OnHover "Hostname: {}\n IP: {}"
        </ul>
        <ul class=visRoomDeviceList>
            <li>...</li>
        </ul>
        ...
    </ul>
    */
    let bool_ipFound = true;
    let HTML_visRooms = `<ul class="visTile"  id=\"${tileID}\">`;
    HTML_visRooms += `<li>` + HTML_visIndex + `</li>`;
    let HTML_visRoomEntry = ``;
    // For each room in hn
    for(var j = 0; j < hns.length; j++) {
        HTML_visRoomEntry = `<li><ul class=visRooms> <li class="visRoomHead"><p class=visRoomHeadText>${rooms[j][0] == 0 ? rooms[j].slice(1) : rooms[j]}</p></li>`;
        // For each device type in a room
        for(var a = 0; a < hns[j].length; a++) {
            HTML_visRoomEntry += `<li class="visRoomDevice"><ul class="visRoomDeviceList">`
            // for each hostname in each kind of type
            for(var k = 0; k < hns[j][a].length; k++) {
                // Did we find it?
                if(ips[j][a][k] == "x") {
                    bool_ipFound = false;
                } else {
                    bool_ipFound = true;
                }
                // Positive Hit
                if (bool_ipFound) {
                    HTML_visRoomEntry += `<li class="visRoomDeviceItem visTrue" title="Hostname: ${hns[j][a][k]}\n            IP: ${ips[j][a][k]}"> _ </li>`;
                } else { // Negative Hit
                    HTML_visRoomEntry += `<li class="visRoomDeviceItem visFalse" title="${hns[j][a][k]} not found"> _ </li>`;
                }
            }
            // If there are no hostnames
            if (hns[j][a].length == 0) {
                HTML_visRoomEntry += `<li class="visRoomDeviceItem" title="No Device in Inventory">_</li>`;
            }
            HTML_visRoomEntry += `</ul></li>`;
        }
        HTML_visRoomEntry += `</ul></li>`;
        HTML_visRooms += HTML_visRoomEntry;
    }
    HTML_visRooms += `</ul>`;
    // Put it all together
    vis_container.innerHTML = HTML_visHeader + HTML_visRooms;
    // Put it on the page
    let progGuts = document.querySelector('.program_board .program_guts');
    progGuts.append(vis_container);
    return;
}

// SETTING THE HTML DOM
async function setJackNet() {
    const menuItems = document.querySelectorAll(".menuItem");

    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

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
        <fieldset class="jn_fieldset">
            <legend> 
                Console Output: </legend>
            <textarea readonly rows="15" cols ="75" class="innerConsole" name="consoleOutput" spellcheck="false"> 
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