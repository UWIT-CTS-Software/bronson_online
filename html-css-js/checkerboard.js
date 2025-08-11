/*
   _____ _               _             ____                      _   _     
  / ____| |             | |           |  _ \                    | | (_)    
 | |    | |__   ___  ___| | _____ _ __| |_) | ___   __ _ _ __ __| |  _ ___ 
 | |    | '_ \ / _ \/ __| |/ / _ \ '__|  _ < / _ \ / _` | '__/ _` | | / __|
 | |____| | | |  __/ (__|   <  __/ |  | |_) | (_) | (_| | | | (_| |_| \__ \
  \_____|_| |_|\___|\___|_|\_\___|_|  |____/ \___/ \__,_|_|  \__,_(_) |___/
                                                                   _/ |    
                                                                  |__/     

This file contains all code relating to checkboard and will manipulate the DOM in index.html accordingly. There are some simularities to JackNet and it's visualizer.

TOC:
    - getCheckerboardByBuilding(build_ab)
    - run() ---------------------------------------------------------------------------------- DB_TODO
  HTML
    - FourDigitToTimeFormat(unformattedTime)
    - buildStarterTopper(zone_array)
    - updateTopperElement(topperID, buildingName, numberCheckd, numberRooms)
    - clearVisContainer()
    - printCBResponse(JSON) ------------------------------------------------------------------ DB_TODO
    - cbJumpTo(entryID)
    - cb_clear()
    - setChecker()

Notes:
I am still not completely satisfied with the look, specifically the topper section, there 
are things to be desired still.

I think the Time and Cookie classes may be better suited for bronson-manager.js

TODO - 
    [ ] - minimize collapse functionality on the generated tiles
    [ ] - filter checked rooms / hide them 
      for this, I think it be best to add a button (or checkbox) to options fieldset.
      will need to iterate through all the drawn tiles and add some 'hide' tag/class
      to remove it from the page and do the same to reverse it.
    [ ] - all rooms checked special behavior
      If every room in a building (or zone) is checked, it is an achievement for the tech
      they should get some kinda special message or confetti when this happens.
*/


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
    //Disable button - prevents abuse of server
    const runButton = document.getElementById('cb_run');
    runButton.disabled = true;
    //
    let zone_array = [];

    for (var i=0; i<zones.length; i++) {
        if (zones[i].checked) {
            zone_array.push(zones[i].id);
        }
    }
    //console.log(zone_array);
    // Clear cbVisContainer
    clearVisContainer();
    // Get selected zone building list
    buildStarterTopper(zone_array);
    // iterativly go through buildings
    // compile a hit list
    let buildingsToCheck = [];
    for(var i = 0; i < zone_array.length; i++) {
        buildingsToCheck.push(...getBuildingAbbrevsFromZone(zone_array[i]));
    }
    // Iterating through buildings to check
    let cbTotalBuildingResponse = [];
    for(var i = 0; i < buildingsToCheck.length; i++) {
        let cbBuildingResponse = await getCheckerboardByBuilding(buildingsToCheck[i]);
        // stash
        if (document.title != "CheckerBoard - Bronson") {
            stashCheckerboard(cbBuildingResponse);
        }
        else {
            printCBResponse(cbBuildingResponse);
        }
        // Caching raw room response
        cbTotalBuildingResponse.push(cbBuildingResponse);
    }

    // This will store in Session Storage as an array of objects, each one being a building
    //  in a zone. Gets overwritten frequently. May need to utilize a different kind
    //  of object in session storage for dashboard information. Hoping to use this when
    //  refreshing the page.
    storeCBResponse(cbTotalBuildingResponse);
    // Turn run button back on
    runButton.disabled = false;
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

// We are currently not formatting the time in a good way, ie: 1900 is the displayed
// time on checkerboard, so we need to have some way to make it nice.
function FourDigitToTimeFormat(unformattedTime) {
    let hours = unformattedTime.slice(0,2);
    let minutes = unformattedTime.slice(2,4);
    //console.log(hours, minutes);
    if (hours == "TO" || hours == "00") {
        return "TOMORROW";
    }
    hours = Number(hours);
    minutes = Number(minutes);
    let suffix = " AM";
    if (hours >= 12) {
        suffix = " PM";
        if (hours != 12) {
            hours = hours % 12;
        }
    }
    let newTime = String(hours).padStart(2,'0') + ":" + String(minutes).padStart(2,'0') + suffix;
    return newTime;
}

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
            let HTML_tmp = `<li class=cbTopperBuilding id="cbTopper_${buildingAbbrev[j]}" onclick="cbJumpTo(\'cbVis_${buildingAbbrev[j]}\')">
            <p class="cbTopperBuildingNameText">${buildingNames[j]}</p>
            <p class="cbTopperBuildingStatus">Loading. .. </p>
            </li>`;
            HTML_cbTopperBuildings += HTML_tmp;
        }
        HTML_cbTopperBuildings += `</ul>`;
        HTML_cbTopperZone += HTML_cbTopperBuildings;
        HTML_cbTopperContainer += HTML_cbTopperZone;
    }
    topperContainer.innerHTML = HTML_cbTopperContainer;
    return;
}

async function updateTopperElement(topperID, buildingName, numberChecked, numberRooms) {
    let percent = String(100*((numberChecked/numberRooms).toFixed(5))).slice(0,5);
    let topperEntry = document.getElementById(topperID);
    // TODO - Make this more fancy
    //topperEntry.innerText = `${buildingName} - Rooms Checked: ${numberChecked} / ${numberRooms} (${percent}%)`;
    topperEntry.innerHTML = `<p class="cbTopperBuildingNameText">${buildingName}</p>
    <div class="cbTopperBuildingStatus"><p class="cbBStatusText">Rooms Checked: ${numberChecked}/${numberRooms}</p><label class="cbProgLabel" for="${buildingName}_status">${percent}%</label><progress id="${buildingName}_status" class="cbProgress" value="${percent}" max="100"> </progress></div>`;
    return;
}

// Used to wipe board if there is something there already
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
        <span class="cbHeaderSpan">${building['name']} (${building['abbrev']}) </span>
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
            cbRoomEntry += `<li class="cbVisNotChecked"><span class="cbVisRoomAttributeSpan "> Needs Checked! (${check_date})</span></li>`;
        } else {
            cbRoomEntry += `<li class="cbVisChecked"><span class="cbVisRoomAttributeSpan "> Recently Checked! (${check_date})</span></li>`;
            numberChecked++;
        }
        // Is available ?
        let formattedTime = FourDigitToTimeFormat(rooms[j]['until']);
        if(rooms[j]['available']) {
            // Sometimes, until is 0000, should probably say 'TOMORROW'
            // if (rooms[j]['until'].slice(0,2) == "00") {
            //     rooms[j]['until'] = "TOMORROW";
            // }
            cbRoomEntry += `<li class="cbVisAvailable"><span class="cbVisRoomAttributeSpan "> Available Until \n ${formattedTime} </span></li>`;
        } else { 
            cbRoomEntry += `<li class="cbVisNotAvailable"><span class="cbVisRoomAttributeSpan "> Unavailable Until ${formattedTime} </span></li>`;
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


function cbJumpTo(entryID) {
    let target = document.getElementById(entryID);
    target.scrollIntoView({behavior: 'smooth'});
    return;
}

function cb_clear() {
    let consoleObj = document.getElementById("cbTopID");
    console.log(consoleObj);
    consoleObj.innerHTML = `
        <p class="cfm_text">Select Zone(s) and click Run to run search.</p>`;
    let cbVisContainer = document.getElementById("cbVisConID");
    cbVisContainer.innerHTML = ``;
    // clear cache
    sessionStorage.removeItem("CheckerBoard_html");
    return;
}

async function setChecker() {
    preserveCurrentTool();

    document.title = "CheckerBoard - Bronson";
    // remove currently active status mark tab has active.
    // let active_tab_header = document.querySelector('.active_tab_header');
    // active_tab_header.innerHTML = 'Checkerboard';
    let current = document.getElementsByClassName("selected");
    if (current.length != 0) {
        current[0].classList.remove("selected");
        // current[0].classList.remove("active");
    }
    let newCurrent = document.getElementById("CBButton");
    // newCurrent.classList.add("active");
    newCurrent.classList.add("selected");


    history.pushState("test", "CheckerBoard", "/checkerboard");

    let progGuts = document.querySelector('.program_board .program_guts');
    // Check for preserved space
    let cached_HTML = sessionStorage.getItem("CheckerBoard_html");
    if (cached_HTML != null) {
        // make sure cache was not overwritten with another tool.
        if(cached_HTML.includes("cb_container")) {
            progGuts.innerHTML = cached_HTML;
            // Quickly make sure that run is enabled
            const runButton = document.getElementById('cb_run');
            runButton.disabled = false;
            let stash = JSON.parse(sessionStorage.getItem("CheckerBoard_stash"));
            if (stash != null) {
                console.log("Checkerboard stash found, unloading items");
                for(item in stash.stashList) {
                    await printCBResponse(stash.stashList[item]["checkerboardResponse"]);
                }
                // Reset stash
                sessionStorage.removeItem("CheckerBoard_stash");
                // Reset button
                let cbButton = document.getElementById("CBButton");
                //cbButton.innerHTML = `<img class="tab_img" src="button2.png"/><span>CheckerBoard</span>`;
                cbButton.classList.remove("stashed");
            }
            return;
        }
    }
    
    // -- No HTML Cache found, build from scratch
    let cb_container = document.createElement("div");
    cb_container.classList.add("cb_container");

    // map_select Section
    let map_select = document.createElement("div");
    map_select.classList.add('cb_mapSelect');
    map_select.innerHTML = `
        <fieldset>
            <legend>
                Zones: </legend>
            <input class="cbDev" type ="checkbox" id="1" name="cb_dev" value="zone1"/>
            <label for="1"> 
                Zone 1</label>
            <br>
            <input class="cbDev" type="checkbox" id="2" name="cb_dev" value="zone2"/>
            <label for="2">
                Zone 2</label>
            <br>
            <input class="cbDev" type="checkbox" id="3" name="cb_dev" value="zone3"/>
            <label for="3">
                Zone 3</label>
            <br>
            <input class="cbDev" type="checkbox" id="4" name="cb_dev" value="zone4"/>
            <label for="4">
                Zone 4</label>
            <br>
        </fieldset>`;

    // Bottom Menu buttons
    // html options: menu
    let button_menu = document.createElement("div");
    button_menu.classList.add('cb_buttonRow');
    button_menu.innerHTML = `
        <fieldset>
            <legend>
                Options: </legend>
            <button id="cb_run" onclick="run()" class="headButton">
                Run!</button>
            <button id="cb_clear" onclick="cb_clear()" class="headButton">
                Clear</button>
        </fieldset>`;

    // Console Output
    let console_output = document.createElement("div");
    console_output.classList.add('cb_console');
    console_output.innerHTML = `
        <fieldset>
            <legend>
                Console Output: </legend>
            <div class="cbTopperContainer" id="cbTopID">
                <p class="cfm_text">Select Zone(s) and click Run to run search.</p>
            </div>
            <div id="cbVisConID" class="cbVisContainer">
            </div>
        </fieldset>`;

    cb_container.append(map_select);
    cb_container.append(button_menu);
    cb_container.append(console_output);

    let main_container = document.createElement('div');
    main_container.appendChild(cb_container);
    main_container.classList.add('program_guts');
    progGuts.replaceWith(main_container);

    return;
}