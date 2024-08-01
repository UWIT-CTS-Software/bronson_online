/*
         _                                                
        | |                            |           o      
  __,   | |  _|_   _  _  _     __    __|    _          ,  
 /  |   |/    |   / |/ |/ |   /  \_ /  |   |/      |  / \_
 \_/|_/ |__/  |_/   |  |  |_/ \__/  \_/|_/ |__/ o  |/  \/ 
                                                  /|      
                                                  \|      

Originally in camcode.js, accesses a database on the server for crestron room files and allows the user to retreive any they may need.

/*
 
 - cfmFiles()

HMTL-CFM
 - populateDropdown(list)
 - getCFMBuildingSelection()
 - cfmGetBuildingRoom()
 - setBrowserCode()
 - updateRoomList()
 - setCrestronFile()

fetch
 - cfmGetFiles() - cfm_dir
 - cfmGetFileJson()
 - getCFMBuildingRooms(sel_building) - "cfm_build_r"
 - getCFM_BuildRooms(sb)
 - getCFMCodeDirs() - "cfm_build"
 - getCFMCodeDir()

Crestron File Manger (CFM)
TODO:
  [ ] - Make a dummy database for testing
  [ ] - Make a variant of the console log to be a file/folder viewer
          - Each row is a file
          - Double clicking a row will download it

BONUS MAYBE:
  If we are pulling from the Crestron files, we can include a log file for notes about the rooms.

  IE: When I pull up AG 2048 and there is a note about the Crestron Program not doing something it needs to do.
*/
  
// TODO: cfmFiles()
async function cfmFiles() {
    // Variables
    let brm = cfmGetBuildingRoom(); //brm[0] = building, brm[1] = room
    let files = [];
    let header = "";
    
    updateConsole("CFM Currently Nonfunctional Sorry :(");
    updateConsole(brm[0] + " " + brm[1]);
  
    // Get Files (Add Error Check: Room Directory Not Found)
    let received_filenames = await cfmGetFileJson(brm[0], brm[1]);
    
    for (var i = 0; i < received_filenames.length; i++) {
        let tmp = received_filenames[i].split("CFM_Code")[1];
        header = tmp.split(brm[1] + "/")[0] + brm[1] + "/";
        files.push(tmp.split(brm[1] + "/")[1]);
    }
  
    //updateConsole(received_filenames);
    updateConsole("Header:\n" + header);
    updateConsole("FILES:\n" + files);
  
    setBrowserConsole(header, files);
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
  
// May want to pull directory for dropdown
async function populateDropdown(list) {
    //let obj = document.querySelector(className)
    html = ``;
    for(var i in list) {
        html += `
        <option value=${i}>
            ${list[i]}
        </option>`;
    };
    return html;
}
  
async function getCFMBuildingSelection() {
    let select = document.getElementById('building_list');
    return select.value;
}

function cfmGetBuildingRoom(){
    let bl = document.getElementById('building_list');
    let rl = document.getElementById('room_list');;
  
    let building = bl.options[bl.selectedIndex].text;
    let room     = rl.options[rl.selectedIndex].text;
  
    return [building, room];
}
  
// updateRoomList()
//    - when the building dropdown changes, this updates the room dropdown.
async function updateRoomList() {
    let rl = document.querySelector('.program_board .program_guts .rmSelect');
    let rms = document.createElement("Fieldset");
    rms.classList.add('rmSelect');
  
    let sel_building = await getCFMBuildingSelection();
    let cfmDirList   = await getCFMCodeDir();
    
    let new_rl = await getCFM_BuildRooms(cfmDirList[sel_building]);
    console.log(new_rl);
  
    let set_inner_html = `
        <select id="room_list">
            ${await populateDropdown(new_rl)}
        </select>`;
  
    rms.innerHTML = `
        <legend>
            Choose Rooms(s): 
        </legend> 
        ${set_inner_html}`;
    rl.replaceWith(rms);
    return;
}

//      setCrestronFile()
// Change the DOM for Crestron File Manager
async function setCrestronFile() {
    console.log('switching to camcode-cfm');
  
    // Pull List of Directories
    let cfmDirList = await getCFMCodeDir();
    let cfmRmList  = await getCFMBuildingRooms(cfmDirList[0]);
    console.log(cfmDirList);
  
    let progGuts = document.querySelector('.program_board .program_guts');
    let main_container = document.createElement('div');
    main_container.innerHTML = `
        <p>
            hello world - CamCode (Crestron File Manager)
        </p>
        <button id="cam_code" onclick="setCamCode()">
            CamCode (Q-SYS) </button>
        <p>\n</p>`;
  
    // BUILDING Directory Dropdown
    let buildingSelect = document.createElement("Fieldset");
    buildingSelect.classList.add("bdSelect");
    let set_inner_html = `
        <select id="building_list" onchange="updateRoomList()">
            ${await populateDropdown(cfmDirList)}
        </select>`;
    buildingSelect.innerHTML = `
        <legend>
            Choose Building(s):
        </legend> 
        ${set_inner_html}`;
  
    // ROOM Directory Dropdown
    let roomSelect = document.createElement("Fieldset");
    roomSelect.classList.add('rmSelect');
    let rl = await getCFM_BuildRooms(cfmDirList[0]);
    set_inner_html = `
        <select id="room_list">
            ${await populateDropdown(rl)}
        </select>`;
    roomSelect.innerHTML = `
        <legend>
            Choose Rooms(s): 
        </legend> 
        ${set_inner_html}`;
  
    // Console Output
    let consoleOutput = document.createElement("fieldset");
    consoleOutput.classList.add('consoleOutput');
    consoleOutput.innerHTML = `
        <legend> e
            Console Output: 
        </legend> 
        <textarea readonly rows="10" cols ="80" class="innerConsole" name="consoleOutput" spellcheck="false">
            CamCode_altmode
        </textarea>`;
  
    // Bottom Menu buttons
    // [ Generate Files ] [ Clear Console ] [ Reset ]
    let bottomMenu = document.createElement("fieldset");
    bottomMenu.classList.add('bottomMenu');
    bottomMenu.innerHTML = `
        <legend>
            Options: 
        </legend>
        <menu>
            <button id="run" onclick="cfmFiles()"> 
                Generate Files </button>
            <button id="clearCon" onclick="clearConsole()">
                Clear Console </button>
            <button id="reset" onclick="resetCamCode()"> 
                Reset </button>
        </menu>`;
  
    main_container.appendChild(buildingSelect);
    main_container.appendChild(roomSelect);
    main_container.appendChild(consoleOutput);
    main_container.appendChild(bottomMenu);
    main_container.classList.add('program_guts');
    progGuts.replaceWith(main_container);
    return;
}

/*
  __        _          _     
 / _|  ___ | |_   ___ | |__  
| |_  / _ \| __| / __|| '_ \ 
|  _||  __/| |_ | (__ | | | |
|_|   \___| \__| \___||_| |_|    

TODO:
    [ ] - idk why i have two functions for each one, thats not needed.
*/

// cfmGetFiles
//    "cfm_dir"
async function cfmGetFiles(building, rm) {
    return await fetch('cfm_dir', {
        method: 'POST',
        body: JSON.stringify({
            building: building,
            rm: rm
        })
    })
    .then((response) => response.json())
    .then((json) => {return json;});
};
  
async function cfmGetFileJson(building, rm) {
    return await cfmGetFiles(building, rm)
        .then((value) => {
            return value.names;
        });
}

// getCFMBuildingRooms(sel_building)
//    "cfm_build_r"
async function getCFMBuildingRooms(sel_building) {
    return await fetch('cfm_build_r', {
        method: 'POST',
        body: JSON.stringify({
            building: sel_building
        })
    })
    .then((response) => response.json())
    .then((json) => {return json;})
};
  
async function getCFM_BuildRooms(sb) {
    return await getCFMBuildingRooms(sb)
        .then((value) => {
            return value.rooms;
        });
}

// getCFMCodeDirs()
//    "cfm_build"
async function getCFMCodeDirs() {
    return await fetch('cfm_build', {
        method: 'POST',
        body: JSON.stringify({
            message: 'cfm_build'
        })
    })
    .then((response) => response.json())
    .then((json) => {return json;});
};

async function getCFMCodeDir(){
    return await getCFMCodeDirs()
        .then((value) => {
            return value.dir_names;
        });
}