/*
checkboard.js

This file contains all code relating to checkboard and will manipulate the DOM in index.html accordingly
*/
class Time {
    constructor() { this.time = ''; }

    setTime(time) { this.time = time; }

    getTime() { return this.time; }
}

class Cookie {
    constructor() { this.value = "none"; }

    setCookie(id) { this.value = id; }

    getCookie() { return this.value; }
}

// Run Checkerboard
async function getCheckerboardByBuilding(build_ab) {
    return await fetch('run_cb', {
        method: "POST",
        body: build_ab
    })
    .then((response) => response.json())
    .then((json) => {return json;});
}

async function run() {
    let zones = document.getElementsByName('cb_dev');
    let zone_array = [];

    for (var i=0; i<zones.length; i++) {
        if (zones[i].checked) {
            zone_array.push(zones[i].id);
        }
    }

    // Clear cbVisContainer (??)
    clearVisContainer();

    // Get selected zone building list
    //console.log(zone_array);
    buildStarterTopper(zone_array);

    // iterativly go through buildings
    // compile a hit list
    let buildingsToCheck = [];
    for(var i = 0; i < zone_array.length; i++) {
        buildingsToCheck.push(... getBuildingAbbrevsFromZone(zone_array[i]));
    }
    //console.log("cbDebug-BuildingsToCheck: ", buildingsToCheck);
    // Iterating through building hitlist
    let cbTotalBuildingResponse = [];
    for(var i = 0; i < buildingsToCheck.length; i++) {
        let cbBuildingResponse = await getCheckerboardByBuilding(buildingsToCheck[i]);
        printCBResponse(cbBuildingResponse);
        cbTotalBuildingResponse.push(JSON.stringify(cbBuildingResponse));
    }

    storeCBResponse(cbTotalBuildingResponse);

    return;
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

// The top of the page we have a pesudo table of contents
//  that allows users to jump around the page quickly
//  One of the challenges here is that I will not have some location info
// This is why this is a 'starter', when a zone is ran, this is a preallocated space,
// when a building completes and returns, we update it's spot in the topper.
//  --- Zone 1 -----------
//  Building1 Name / percent checked {#######---------}
//  ...

function buildStarterTopper(zone_array) {
    let topperContainer = document.querySelector(".cbTopperContainer");
    // Iterate through selected zones
    let HTML_cbTopperContainer = ``;
    for(var i = 0; i < zone_array.length; i++) {
        let buildingNames = getBuildingNamesFromZone(zone_array[i]);
        let buildingAbbrev = getBuildingAbbrevsFromZone(zone_array[i]);
        // Make HTML for zone Header
        let HTML_cbTopperZone = `<div class ="cbTopperZoneHeader"> Zone ${zone_array[i]} </div>`;
        let HTML_cbTopperBuildings = `<ul class="cbTopperBuildingList">`;
        // Iterate through buildings in a given zone
        for (var j = 0; j < buildingNames.length; j++) {
            // Note, would be cool if this could be animated triple dot...
            let HTML_tmp = `<li class=cbTopperBuilding id="cbTopper_${buildingAbbrev[j]}" onclick="cbJumpTo(\'cbVis_${buildingAbbrev[j]}\')"> Loading ${buildingNames[j]} ...</li>`;
            HTML_cbTopperBuildings += HTML_tmp;
        }
        HTML_cbTopperBuildings += `</ul>`;
        HTML_cbTopperZone += HTML_cbTopperBuildings;
        HTML_cbTopperContainer += HTML_cbTopperZone;
    }
    //HTML_cbTopperContainer += `</div>`;
    //console.log(HTML_cbTopperContainer);
    topperContainer.innerHTML = HTML_cbTopperContainer;
    return;
}

async function updateTopperElement(topperID, buildingName, numberChecked, numberRooms) {
    let percent = 100*((numberChecked/numberRooms).toFixed(5));
    let topperEntry = document.getElementById(topperID);
    topperEntry.innerText = `${buildingName} - Rooms Checked: ${numberChecked} / ${numberRooms} (${percent}%)`;
    return;
}

function clearVisContainer() {
    let visCon = document.querySelector('.cbVisContainer');
    visCon.innerHTML = ``;
    return;
}

// Re-written to handle a response from a building call instead of a entire zone
async function printCBResponse(JSON) {
    let consoleObj = document.querySelector('.cbVisContainer');

    let building = JSON['cb_body'][0];
    // Information
    let numberChecked = 0;
    //console.log("CheckerboardDebug - returned building:\n", building);
    let numberRooms = building['rooms'].length;

    // Start building output
    let cbVisContainer = document.createElement('div');
    cbVisContainer.classList.add('cbVisBuildingEntry');
    // Building Name
    //  Note: this id is intended to be used to identify where to jump in the toppper
    //   redirect.
    HTML_cbBuildingHeader = `
    <div class="cbVisHeader" id="cbVis_${building['abbrev']}"> 
        ${building['name']} (${building['abbrev']}) 
        <button class="visButton" onclick="cbJumpTo(\'cbTopID\')"> Jump to Top </button>
    </div>`;
    //console.log(building);
    // Start the room processing
    let rooms = building['rooms'];
    let HTML_cbVisRooms = `<ul class="cbVisRooms">`;
    // Iterating through each room in a building
    for(var j = 0; j < rooms.length; j++) {
        let cbRoomEntry = `<li class=cbVisRoom>`;
        // Maybe add some generalPool/DepartmentShared indicator
        cbRoomEntry += `<p class="cbVisRoomName">${rooms[j]['name']} </p>`;
        //  - ROOM ATTRIBUTES
        cbRoomEntry += `<ul class="cbVisRoomAttributes">`
        let check_date = rooms[j]['checked'].split('T')[0];
        if(rooms[j]['needs_checked']) {
            cbRoomEntry += `<li><span class="cbVisNotChecked"> Room Needs Checked! (${check_date})</span></li>`;
        } else {
            cbRoomEntry += `<li><span class="cbVisChecked"> Recently Checked! (${check_date})</span></li>`;
            numberChecked++;
        }
        // Is available ?
        console.log("cbDebug- until field ", rooms[j]['until'])
        if(rooms[j]['available']) {
            cbRoomEntry += `<li><span class="cbVisAvailable"> Available Until ${rooms[j]['until']} </span></li>`;
        } else { 
            cbRoomEntry += `<li><span class="cbVisNotAvailable"> Unavailable Until ${rooms[j]['until']} </span></li>`;
        }
        cbRoomEntry += `</ul>`;
        cbRoomEntry += `</li>`;
        HTML_cbVisRooms += cbRoomEntry;
    }
    HTML_cbVisRooms += `</ul>`;
    // Send a processed building to the page
    // FUNC (?)
    // HTML
    cbVisContainer.innerHTML += HTML_cbBuildingHeader + HTML_cbVisRooms;

    consoleObj.append(cbVisContainer);

    //update topper entry
    let checkedPercent = 100 * (numberChecked / numberRooms);
    let topperID = `cbTopper_${building['abbrev']}`;
    await updateTopperElement(topperID, building['name'], numberChecked, numberRooms);
    return;
}

// TODO
function cbJumpTo(entryID) {
    let target = document.getElementById(entryID);
    target.scrollIntoView({behavior: 'smooth'});
    return;
}

function setChecker() {
    const menuItems = document.querySelectorAll(".menuItem");

    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

    document.title = "CheckerBoard - Bronson";
    // remove currently active status mark tab has active.
    // let active_tab_header = document.querySelector('.active_tab_header');
    // active_tab_header.innerHTML = 'Checkerboard';
    let current = document.getElementsByClassName("selected");
    console.log(current);
    if (current.length != 0) {
        current[0].classList.remove("selected");
        // current[0].classList.remove("active");
    }
    let newCurrent = document.getElementById("CBButton");
    // newCurrent.classList.add("active");
    newCurrent.classList.add("selected");


    history.pushState("test", "CheckerBoard", "/checkerboard");

    console.log('Switching to checkerboard');
    let prog_guts = document.querySelector('.program_board .program_guts');

    let main_container = document.createElement("div");
    main_container.classList.add("cb_container");

    // map_select Section
    let map_select = document.createElement("div");
    map_select.classList.add('cb_mapSelect');
    map_select.innerHTML = `
        <fieldset class="cb_fieldset">
            <legend>
                Select Zone: </legend>
            <input class="cbDev" type ="checkbox" id="1" name="cb_dev" value="Processors"/>
            <label for="1"> 
                Zone 1</label>
            
            <input class="cbDev" type="checkbox" id="2" name="cb_dev" value="Projectors"/>
            <label for="2">
                Zone 2</label>
            <br>
            <input class="cbDev" type="checkbox" id="3" name="cb_dev" value="Wyo Shares"/>
            <label for="3">
                Zone 3</label>
            
            <input class="cbDev" type="checkbox" id="4" name="cb_dev" value="Touch Panels"/>
            <label for="4">
                Zone 4</label>
            <br>
        </fieldset>`;

    // Bottom Menu buttons
    // html options: menu
    let button_menu = document.createElement("div");
    button_menu.classList.add('cb_buttonRow');
    button_menu.innerHTML = `
        <fieldset class="cb_fieldset">
            <legend>
                Options: </legend>
            <button id="cb_run" onclick="run()" class="headButton">
                Run!</button>
        </fieldset>`;

    // Console Output
    let console_output = document.createElement("div");
    console_output.classList.add('cb_console');
    console_output.innerHTML = `
        <fieldset class="cb_fieldset" >
            <legend>
                Console Output: </legend>
            <div class="cbTopperContainer" id="cbTopID">
                <p class="cfm_text">Select Zone(s) and click Run to run search.</p>
            </div>
            <div class="cbVisContainer">
            </div>
        </fieldset>`;

    main_container.append(map_select);
    main_container.append(button_menu);
    main_container.append(console_output);

    main_container.classList.add('program_guts');
    prog_guts.replaceWith(main_container);

    return;
}