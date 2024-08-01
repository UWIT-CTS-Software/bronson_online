/*
   _____                 _____          _        _      
  / ____|               / ____|        | |      (_)     
 | |     __ _ _ __ ___ | |     ___   __| | ___   _ ___  
 | |    / _` | '_ ` _ \| |    / _ \ / _` |/ _ \ | / __| 
 | |___| (_| | | | | | | |___| (_) | (_| |  __/_| \__ \ 
  \_____\__,_|_| |_| |_|\_____\___/ \__,_|\___(_) |___/ 
                                               _/ |     
                                              |__/      

This file contains all code relating to camcode and will manipulate the DOM in index.html accordingly

CC
 - findFiles()

CFM
 - cfmGetFiles()
 - cfmGetFileJson()
 - cfmGetBuildingRoom()
 - cfmFiles()

HTML-CC
 - resetCamCode()
 - updateRoomList()
 - newPjSection()
 - newSpkrSection()
 - newMicSection()
[ ] removeSection()
 - setCamCode()
 
 HMTL-CFM
 - setBrowserCode()
 - updateRoomList()
 - setCrestronFile()

CamCode (Q-SYS)
TODO:
  [ ] - Define the parameters we are using
  [ ] - Prepare a library of Q-SYS files

Crestron File Manger (CFM)
TODO:
  [ ] - Make a dummy database for testing
  [ ] - Make a variant of the console log to be a file/folder viewer
          - Each row is a file
          - Double clicking a row will download it

BONUS MAYBE:
  If we are pulling from the Crestron files, we can include a log file for notes about the rooms.

  IE: When I pull up AG 2048 and there is a note about the Crestron Program not doing something it needs to do.

Q-SYS has a multitude of modules and we will be retrieving these modules based on the parameters given in the form.

NOTE:
Final CamCode DOM will NOT use the console prompt,
I am only using that to debug.
*/

/*
   _|_|_|    _|_|_|  
 _|        _|        
 _|        _|        
 _|        _|        
   _|_|_|    _|_|_|
*/

// TODO: findFiles()
//    Gather page parameters and use post fetch to get required files.
function findFiles() {
  updateConsole("CamCode Currently Nonfunctional Sorry :(");
  return;
}

/*
_|_|_|  _|_|_|_|  _|      _|  
_|        _|        _|_|  _|_|  
_|        _|_|_|    _|  _|  _|  
_|        _|        _|      _|  
  _|_|_|  _|        _|      _|  
*/
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

function cfmGetBuildingRoom(){
  let bl = document.getElementById('building_list');
  let rl = document.getElementById('room_list');;

  let building = bl.options[bl.selectedIndex].text;
  let room     = rl.options[rl.selectedIndex].text;

  return [building, room];
}

// TODO: cfmFiles()
async function cfmFiles() {
  updateConsole("CFM Currently Nonfunctional Sorry :(");
  let brm = cfmGetBuildingRoom(); //brm[0] = building, brm[1] = room
  updateConsole(brm[0] + " " + brm[1]);

  //let abbrev = await getAbbrev(brm[0]);

  let files = [];
  let header = "";

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

   _|_|_|    _|_|_|  
 _|        _|        
 _|        _|        
 _|        _|        
   _|_|_|    _|_|_|
*/



// return hmtl to start config
function resetCamCode() {
  setCamCode();
  return;
}

// takes a new type field for either
//    projector . speaker . mic
// id prefer to add 'x' buttons to the projector/speaker/microphone fieldsets for when there are more than one
function newPjSection() {
  updateConsole("Adding New Projector Field");
  let pjSection = document.querySelector('.program_board .program_guts .proj_sel');
  pjSection.innerHTML += `
    <div>
      <select id="proj_model">
        <option>EPSON Pro L510U</option>
        <option>2</option>
      </select> 
      <select id="proj_location">
        <option>Ceiling</option>
        <option>Somewhere else</option>
      </select> 
      <input type="number">
    </div>`;
  return;
}

function newSpkrSection() {
  updateConsole("Adding New Speaker Field");
  let spkrSection = document.querySelector('.program_board .program_guts .speak_sel');
  spkrSection.innerHTML += `
    <div>
      <select id="speak_model">
        <option>JBL Speaker</option>
        <option>2</option>
      </select> 
      <select id="speaker_location">
        <option>Ceiling</option>
        <option>Whiteboard Wall</option>
      </select> 
      <input type="number"> 
    </div>`;
  return;
}

function newMicSection() {
  updateConsole("Adding New Microphone Field");
  let spkrSection = document.querySelector('.program_board .program_guts .mic_sel');
  spkrSection.innerHTML += `
    <div>
      <select id="mic_model">
        <option>microphone</option>
        <option>2</option>
      </select> 
      <select id="mic_location">
        <option>Ceiling</option>
        <option>table</option>
      </select> 
      <input type="number"> 
      <button onclick="deleteMicSection()">x</button>
    </div>`;
  return;
}

function deleteMicSection() {
  return;
}


// Change the DOM for CamCode (Q-SYS Module Manager)
async function setCamCode() {
    console.log('Switching to camcode')
    let progGuts = document.querySelector('.program_board .program_guts');
    let main_container = document.createElement('div');
    main_container.innerHTML = `
      <p>hello world - CamCode</p>
      <button id="crestron_files" onclick="setCrestronFile()"> 
        Crestron File Manager </button>
      <p>\n</p>`;

    // Room Orientation
    // Projectors or displays?
    //   proj - lazer or bulb
    let projectorSection = document.createElement("fieldset");
    projectorSection.classList.add('proj_sel');
    let set_Inner = `
      <div>
        <select id="proj_model">
          <option>EPSON Pro L510U</option>
          <option>2</option>
        </select> 
        <select id="proj_location">
          <option>Ceiling</option>
          <option>Somewhere else</option>
        </select> 
        <input type="number"> 
        <button id="new_sel" onclick="newPjSection()">
          New Field </button>
      </div>`;
    projectorSection.innerHTML = `
      <legend>
        Projector(s):
      </legend> 
      ${set_Inner}`;

    // Speakers
    //    wall or ceiling
    //    kind of speakers
    //    quauntity
    let speakerSection = document.createElement("fieldset");
    speakerSection.classList.add('speak_sel');
    set_Inner = `
      <div> 
        <select id="speak_model">
          <option>JBL 26CT</option>
          <option>2</option>
        </select>
        <select id="speaker_location">
          <option>Ceiling</option>
          <option>Whiteboard Wall</option>
        </select>
        <input type="number">
        <button id="new_sel" onclick="newSpkrSection()">
          New Field
        </button>
      </div>`;
    speakerSection.innerHTML = `
      <legend>
        Speakers(s):
      </legend> 
      ${set_Inner}`;

    // Mics
    //    kind of mics
    //    quantity
    //    speaking zones?
    let micSection = document.createElement("fieldset");
    micSection.classList.add('mic_sel');
    set_Inner = `
      <div>
        <select id="mic_model">
          <option>microphone</option>
          <option>2</option>
        </select> 
        <select id="mic_location">
          <option>Ceiling</option>
          <option>table</option>
        </select> 
        <input type="number"> 
        <button id="new_sel" onclick="newMicSection()"> 
          New Field
        </button>
      </div>`;
    micSection.innerHTML = `
      <legend>
        Microphones(s):
      </legend> 
      ${set_Inner}`;
    
    // Src Selection
    let srcSelect = document.createElement("fieldset");
    srcSelect.classList.add('devSelect');
    srcSelect.innerHTML = `
      <legend>Sources in Classroom: </legend>
      <input class="cbSrc" 
            type ="checkbox" 
            id="pc" 
            name="dev" 
            value="Room PC"/>
      <label for="pc">
        Room PC </label>
      <br>
      <input class="cbSrc" type="checkbox" id="laptop" name="dev" value="laptop"/>
      <label for="laptop">
        Laptop </label>
      <br>
      <input class="cbSrc" type="checkbox" id="ws" name="dev" value="Wyo Shares"/>
      <label for="ws">
        Wyo Shares </label>
      <br>
      <input class="cbSrc" type="checkbox" id="bd" name="dev" value="Blu-Ray" />
      <label for="bd">
        Blu-Ray Player </label>
      <br>
      <input class="cbSrc" type ="checkbox" id="elmo" name="dev" value="Document Camera" />
      <label for="elmo">
        Document Camera </label>
      <br>`;

    // Console Output
    let consoleOutput = document.createElement("fieldset");
    consoleOutput.classList.add('consoleOutput');
    consoleOutput.innerHTML = `
      <legend>
        Console Output:
      </legend>
      <textarea readonly rows="10" cols ="80" class="innerConsole" name="consoleOutput" spellcheck="false">
        Console: CAMCODECAMCODE
      </textarea>`;

    // Bottom Menu buttons
    // html options: menu
    let bottomMenu = document.createElement("fieldset");
    bottomMenu.classList.add('bottomMenu');
    bottomMenu.innerHTML = `
      <legend>Options: </legend>
      <menu>
        <button id="run" onclick="findFiles()"> 
          Generate Files </button>
        <button id="clearCon" onclick="clearConsole()"> 
          Clear Console </button>
        <button id="reset" onclick="resetCamCode()"> 
          Reset </button>
      </menu>`;

    // PUT EVERYTHING TOGETHER MAIN_CONTAINER
    main_container.appendChild(projectorSection);
    main_container.appendChild(speakerSection);
    main_container.appendChild(micSection);
    main_container.appendChild(srcSelect);
    main_container.appendChild(consoleOutput);
    main_container.appendChild(bottomMenu);
    main_container.classList.add('program_guts');
    //p.appendChild(select)
    progGuts.replaceWith(main_container);
    return;
  }

/*
   _|_|_|  _|_|_|_|  _|      _|  
 _|        _|        _|_|  _|_|  
 _|        _|_|_|    _|  _|  _|  
 _|        _|        _|      _|  
   _|_|_|  _|        _|      _|  
*/

// CONSOLE REVAMP FUNCTIONS HERE
//    MAKE A WEIRD SUDO DIRECTORY BROWSER
// Note:
// Console Stuff: rows=10, cols=80
//   MAY need to use something other than textedit
function setBrowserConsole(header, files) {
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
  return;
}

// May want to pull directory for dropdown
async function populateDropdown(list) {
  //let obj = document.querySelector(className)
  html = ``;
  for(var i in list) {
    html += `<option value=${i}>${list[i]}</option>`;
  };

  return html;
}

async function getCFMBuildingSelection() {
  let select = document.getElementById('building_list');
  return select.value;
}

// updateRoomList()
async function updateRoomList() {
  let rl = document.querySelector('.program_board .program_guts .rmSelect');
  let rms = document.createElement("Fieldset");
  rms.classList.add('rmSelect');

  let sel_building = await getCFMBuildingSelection();
  
  //let new_rl = await getRooms(sel_building);

  let cfmDirList = await getCFMCodeDir();
  //let cfmRmList  = await getCFMBuildingRooms(cfmDirList[0]);
  let new_rl = await getCFM_BuildRooms(cfmDirList[sel_building]);
  console.log(new_rl);

  let set_inner_html = `<select id="room_list">`;
  set_inner_html += await populateDropdown(new_rl);
  set_inner_html += '</select>';

  rms.innerHTML = `<legend>Choose Rooms(s): </legend> ${set_inner_html}`;
  rl.replaceWith(rms);
  return;
}

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
      CamCode (Q-SYS)
    </button>
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
    <legend> 
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