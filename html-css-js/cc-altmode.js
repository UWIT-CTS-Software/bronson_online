/*       _                                                
        | |                            |           o      
  __,   | |  _|_   _  _  _     __    __|    _          ,  
 /  |   |/    |   / |/ |/ |   /  \_ /  |   |/      |  / \_
 \_/|_/ |__/  |_/   |  |  |_/ \__/  \_/|_/ |__/ o  |/  \/ 
                                                  /|      
                                                  \|      

    Crestron File Manger (CFM)

Originally in camcode.js, accesses a database on the server for crestron room files and allows the user to retreive any they may need.
 
 - cfmFiles()
 - getCFMF(filename, classtype)
 - downloadFile(s, fn)

HMTL-CFM
 - getCFMBuildingSelection()   -- notsure if this should ever be used
 - cfmGetBuildingRoom()
 - setFileBrowser(header, files)
 - populateFileList(list)
 - populateDropdown(list)
 - updateRoomList()
 - setCrestronFile()

fetch
 - getCFM_BuildDirs()                    - flag: "cfm_build"
 - getCFM_BuildRooms(sel_building)       - flag: "cfm_build_r"
 - getCFM_FileDirectory(building,rm)     - flag: "cfm_c_dir"
 - getCFM_File(filename)                 - flag: "cfm_file"
 - getCFM_Dir()                          - flag: "cfm_dir"
*/
  
// cfmFiles()
//// onclick for "generate files"
async function cfmFiles() {
    // Variables
    let brm = cfmGetBuildingRoom(); //brm[0] = building, brm[1] = room
    let files = [];
    let header = "";
  
    // Get Files (Add Error Check: Room Directory Not Found)
    let received_filenames = await getCFM_FileDirectory(brm[0], brm[1]);
    
    for (var i = 0; i < received_filenames.length; i++) {
        let tmp = received_filenames[i].split("CFM_Code")[1];
        header = tmp.split(brm[1] + "/")[0] + brm[1] + "/";
        files.push(tmp.split(brm[1] + "/")[1]);
    }
  
    setFileBrowser(header, files);

    return;
}

// This is a onclick function tied to entries in "File Selection"
async function getCFMF(filename, classtype) {
    let brs = cfmGetBuildingRoom();
    // Get the header value instead
    let current_header = getCurrentHeader();
    // current_header = current_header + '/';

    let cmff = `${current_header}/${filename}`;

    // User Selects a Directory
    if (classtype == "cfm_dir") {
        //updateConsole("ERRORSelected Directory");
        // It would be sweet to go into room sub-directories
        // do that
        let files = await getCFM_Dir(cmff);
        //update filebrowser

        console.log(files);
        // Need a variant function for populating 
        for (var i in files) {
            files[i] = files[i].split(cmff + '/')[1];
        }
        await setFileBrowser(cmff, files);

        return;
    }
    
    await getCFM_File(cmff);

    return;
}

function downloadFile(s, fn) {
    //const blob = new Blob(s, { });
    const url = URL.createObjectURL(s);
    const a = document.createElement('a');
    
    a.href=url;

    a.download = fn;
    a.click();

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

function getCurrentHeader() {
    let fs = document.querySelector('.cfm_text');
    console.log(fs.innerText);
    return fs.innerText;
}

// CONSOLE REVAMP FUNCTIONS HERE
//    MAKE A WEIRD SUDO DIRECTORY BROWSER
async function setFileBrowser(header, files) {
    let fs = document.querySelector('.cfm_fileSelection');
    let new_fs = document.createElement("fieldset");
    new_fs.classList.add('cfm_fileSelection');
    new_fs.innerHTML =`
        <legend>
            File Selection
        </legend>
        <h2 class='cfm_text'>${header}</h2>
        <body>
            <ol class='cfm_list'>
                ${await populateFileList(files)}
            </ol>
        </body>`;
    fs.replaceWith(new_fs);

    return;
}

// Need to figure out a mechanism to differntiate file types
async function populateFileList(list) {
    html = ``;
    let classtype  = "";
    for(var i in list) {
        if(list[i].includes(".zip")) {
            classtype = "cfm_zip";
        } else if (list[i].includes(".")) {
            classtype = "cfm_file";
        } else {
            classtype = "cfm_dir";
        }
        html += `
            <li class=${classtype} onclick=\"getCFMF(\'${list[i]}\', \'${classtype}\')\">
                ${list[i]}
            </li>`; 
    }

    return html;
}

//   populateDropdown(list)
// May want to pull directory for dropdown
async function populateDropdown(list) {
    //let obj = document.querySelector(className)
    html = ``;
    for(var i in list) {
        html += `
        <option value=${i}>
            ${list[i]}
        </option>`;
    }

    return html;
}
  
// updateRoomList()
//    - when the building dropdown changes, this updates the room dropdown.
async function updateRoomList() {
    let rl = document.querySelector('.program_board .program_guts .rmSelect');
    let rms = document.createElement("Fieldset");
    rms.classList.add('rmSelect');
  
    let sel_building = await getCFMBuildingSelection();
    let cfmDirList   = await getCFM_BuildDirs();
    
    let new_rl = await getCFM_BuildRooms(cfmDirList[sel_building]);
    console.log(new_rl);
  
    let set_inner_html = `
        <select id="room_list">
            ${await populateDropdown(new_rl)}
        </select>`;
  
    rms.innerHTML = `
        <legend>
            Rooms(s): 
        </legend> 
        ${set_inner_html}`;
    rl.replaceWith(rms);

    return;
}

//      setCrestronFile()
// Change the DOM for Crestron File Manager
async function setCrestronFile() {
    const menuItems = document.querySelectorAll(".menuItem");
    const hamburger = document.querySelector(".hamburger");

    hamburger.addEventListener("click", toggleMenu);
    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

    document.title = "CamCode - Bronson";
    let active_tab_header = document.querySelector('.active_tab_header');
    active_tab_header.innerHTML = 'CamCode';
    history.pushState("test", "CamCode-CFM", "/cc-altmode");
    console.log('switching to camcode-cfm');
  
    // Pull List of Directories
    let cfmDirList = await getCFM_BuildDirs();
    console.log(cfmDirList);
  
    let progGuts = document.querySelector('.program_board .program_guts');

    let cfm_container = document.createElement('div');
    cfm_container.classList.add('cfm_container');
  
    // START cfm_paramContainer
    let cfm_ParamContainer = document.createElement('div');
    cfm_ParamContainer.classList.add("cfm_ParamContainer");

    // BUILDING Directory Dropdown
    let buildingSelect = document.createElement("Fieldset");
    buildingSelect.classList.add("bdSelect");
    let set_inner_html = `
        <select id="building_list" onchange="updateRoomList()">
            ${await populateDropdown(cfmDirList)}
        </select>`;
    buildingSelect.innerHTML = `
        <legend>
            Building(s):
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
            Rooms(s): 
        </legend> 
        ${set_inner_html}`;

    // option buttons
    // [ Generate Files ] [ Clear Console ] [ Reset ]
    let optionMenu = document.createElement("div");
    optionMenu.classList.add('cfm_optionMenu');
    optionMenu.innerHTML = `
        <fieldset class="cfm_fieldset">
            <legend>
                Options: </legend>
            <button id="run" onclick="cfmFiles()" class='headButton'> 
                Generate Files </button>
            <button id="reset" onclick="setCrestronFile()" class='headButton'> 
                Reset </button>
        </fieldset>`;

    // End cfm_paramContainer
    cfm_ParamContainer.appendChild(buildingSelect);
    cfm_ParamContainer.appendChild(roomSelect);
    cfm_ParamContainer.appendChild(optionMenu);

    // Start cfm_FileContainer
    let cfm_FileContainer = document.createElement('div');
    cfm_FileContainer.classList.add("cfm_FileContainer");

    // File Selection Area
    let fileSelection = document.createElement("fieldset");
    fileSelection.classList.add('cfm_fileSelection');
    fileSelection.innerHTML = `
        <legend>
            File Selection
        </legend>
        <p class='cfm_text'>
            Please Select Room and Generate Files
        </p>`;

    cfm_FileContainer.appendChild(fileSelection);
    
    cfm_container.appendChild(cfm_ParamContainer);
    cfm_container.appendChild(cfm_FileContainer);

    // main_container
    let main_container = document.createElement('div');
    // main_container.innerHTML = `
    //     <button id="cam_code" onclick="setCamCode()">
    //         CamCode (Q-SYS) </button>
    //     <p>\n</p>`;

    main_container.appendChild(cfm_container);
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
*/

// getCFM_BuildDirs()
//    "cfm_build"
async function getCFM_BuildDirs() {
    return await fetch('cfm_build', {
        method: 'POST',
        body: JSON.stringify({
            message: 'cfm_build'
        })
    })
    .then((response) => response.json())
    .then((json) => {
        return json.dir_names.sort();
    });
}

// getCFM_BuildRooms(sel_building)
//    "cfm_build_r"
async function getCFM_BuildRooms(sel_building) {
    return await fetch('cfm_build_r', {
        method: 'POST',
        body: JSON.stringify({
            building: sel_building
        })
    })
    .then((response) => response.json())
    .then((json) => {return json.rooms;})
}

// getCFM_FileDirectory
//    "cfm_cDir" Crestron File Manager Current Directory
async function getCFM_FileDirectory(building, rm) {
    return await fetch('cfm_c_dir', {
        method: 'POST',
        body: JSON.stringify({
            building: building,
            rm: rm
        })
    })
    .then((response) => response.json())
    .then((json) => {return json.names;});
}

// getCFM_File()
//   "cfm_file"
async function getCFM_File(filename) {
    return await fetch('cfm_file', {
        method: 'POST',
        body: JSON.stringify({
            filename: filename
        })
    })
    .then((response) => response.blob())
    .then((blob) => downloadFile(blob, filename));
}

// getCFM_Dir()
//   "cfm_dir"
//    TODO
async function getCFM_Dir(dirname) {
    return await fetch('cfm_dir', {
        method: 'POST',
        body: JSON.stringify({
            filename: dirname
        })
    })
    .then((response) => response.json())
    .then((json) => {return json.names;});
}