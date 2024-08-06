/*       _                                                
        | |                            |           o      
  __,   | |  _|_   _  _  _     __    __|    _          ,  
 /  |   |/    |   / |/ |/ |   /  \_ /  |   |/      |  / \_
 \_/|_/ |__/  |_/   |  |  |_/ \__/  \_/|_/ |__/ o  |/  \/ 
                                                  /|      
                                                  \|      

Originally in camcode.js, accesses a database on the server for crestron room files and allows the user to retreive any they may need.
 
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

// TODO: request specific file
async function getCFMF(filename, classtype) {
    updateConsole("Attempting to pull " + filename);
    let brs = cfmGetBuildingRoom();

    if (classtype == "cfm_dir") {
        updateConsole("ERRORSelected Directory");
        // It would be sweet to go into room sub-directories
        // do that
        getCFMDir(brs[0], brs[1], filename);
        return;
    }
    
    let cmff = `/${brs[0]}${brs[1]}/${filename}`;

    let value = await getCFMFile(cmff);

    console.log(value);
    cmff = `/CFM_Code/${brs[0]}${brs[1]}/${filename}`;
    
    // let iframe_html = `
    // <iframe id="my_iframe" style ="display:none;"></iframe>`;
    //document.getElementById('my_iframe').src = cmff;

    await downloadFile(value, filename);
    console.log(value);
    //downloadFile(value, filename);
    //let formData = new FormData();
    
    return;
}

async function downloadFile(s, fn) {
    const blob = new Blob(s, { });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    a.href=url;

    a.download = fn;
    a.click();
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

// CONSOLE REVAMP FUNCTIONS HERE
//    MAKE A WEIRD SUDO DIRECTORY BROWSER
// Note:
// Console Stuff: rows=10, cols=80
//   MAY need to use something other than textedit
async function setBrowserConsole(header, files) {
    let conObj = document.querySelector('.innerConsole');
  
    // center header
    let numberOfSpaces = 80 - header.length;
    let new_rows = 1;
    let newHeader = header.padStart((numberOfSpaces/2), " ");
    let list = "";
  
    for(var i = 0; i < files.length; i++) {
        list += files[i] + '\n';
        new_rows += 1;
    }
    conObj.value = newHeader + '\n' + list;
  
    // Resize Here?
  
    // Add Mouse listeners on the rows
    // maybe ! MAYBE hyperlinks?

    /// ALT PRMOPT (fileSelection)
    let fs = document.querySelector('.fileSelection');
    let new_fs = document.createElement("fieldset");
    new_fs.classList.add('fileSelection');
    new_fs.innerHTML =`
        <legend>
            File Selection
        </legend>
        <p>
            ${header}
        </p>
        <body>
            <ol>
                ${await populateFileList(files)}
            </ol>
        </body>
        `;
    
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
        }
        else if (list[i].slice(-8).includes(".")) {
            classtype = "cfm_file";
        }
        else {
            classtype = "cfm_dir";
        }
        html += `
        <li class=${classtype} onclick=\"getCFMF(\'${list[i]}\', \'${classtype}\')\">
            <p><u>${list[i]}</u></p>
        </li>\n`;
    };
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

    // End cfm_paramContainer
    cfm_ParamContainer.appendChild(buildingSelect);
    cfm_ParamContainer.appendChild(roomSelect);
    cfm_ParamContainer.appendChild(bottomMenu);

    // Start cfm_FileContainer
    let cfm_FileContainer = document.createElement('div');
    cfm_FileContainer.classList.add("cfm_FileContainer");

    // File Selection Area
    let fileSelection = document.createElement("fieldset");
    fileSelection.classList.add('fileSelection');
    fileSelection.innerHTML = `
        <legend>
            File Selection
        </legend>
        <p>
            Header
        </p>
        <ul>
            <p>file exmaple1<p>
            <p>file example2<p>
            <p>file example3<p>
        </ul>`;

    cfm_FileContainer.appendChild(fileSelection);

    // Console Output
    let consoleOutput = document.createElement("fieldset");
    consoleOutput.classList.add('consoleOutput');
    consoleOutput.innerHTML = `
        <br>
        <legend>
            Console Output: 
        </legend> 
        <textarea readonly rows="10" cols ="80" class="innerConsole" name="consoleOutput" spellcheck="false">
            CamCode_altmode
        </textarea>`;
  
    cfm_ParamContainer.appendChild(consoleOutput); // DEBUG
    
    main_container.appendChild(cfm_ParamContainer);
    main_container.appendChild(cfm_FileContainer);
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
};

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

// cfmGetFiles
//    "cfm_cDir" Crestron File Manager Current Directory
async function cfmGetFiles(building, rm) {
    return await fetch('cfm_c_dir', {
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

// getCFMFile()
//   "cfm_file"
async function getCFMFile(filename) {
    return await fetch('cfm_file', {
        method: 'POST',
        body: JSON.stringify({
            filename: filename
        })
    })
    .then((response) => {return response});
};

// getCFMFile()
//   "cfm_dir"
async function getCFMDir(building, rm, dirname) {
    return await fetch('cfm_dir', {
        method: 'POST',
        body: JSON.stringify({
            building: building,
            rm: rm,
            dirname: dirname
        })
    })
    .then((response) => response.json())
    .then((json) => {return json;});
};