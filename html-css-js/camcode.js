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
async function cfmGetFiles(building, abbrev, rm) {
  return await fetch('cfm', {
    method: 'POST',
    body: JSON.stringify({
      building: building,
      abbrev: abbrev,
      rm: rm
    })
  })
  .then((response) => response.json())
  .then((json) => {return json;});
};

async function cfmGetFileJson(building, abbrev, rm) {
  return await cfmGetFiles(building, abbrev, rm)
    .then((value) => {
      return value.names;
    });
}

function cfmGetBuildingRoom(){
  let bl = document.getElementById('building_list');
  let rl = document.getElementById('room_list');;
  //return [bl.value, rl.value];
  let building = bl.options[bl.selectedIndex].text;
  let room = rl.options[rl.selectedIndex].text;

  return [building, room];
}

// TODO: cfmFiles()
async function cfmFiles() {
  updateConsole("CFM Currently Nonfunctional Sorry :(");
  let brm = cfmGetBuildingRoom(); //brm[0] = building, brm[1] = room
  updateConsole(brm[0] + " " + brm[1]);

  let abbrev = await getAbbrev(brm[0]);

  let files = [];
  let header = "";

  // Get Files (Add Error Check: Room Directory Not Found)
  let received_filenames = await cfmGetFileJson(brm[0], abbrev, brm[1]);
  
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
  pjSection.innerHTML += '<div> \n <select id="proj_model"><option>EPSON Pro L510U</option><option>2</option></select> <select id="proj_location"><option>Ceiling</option><option>Somewhere else</option></select> <input type="number"> \n </div>';
  return;
}

function newSpkrSection() {
  updateConsole("Adding New Speaker Field");
  let spkrSection = document.querySelector('.program_board .program_guts .speak_sel');
  spkrSection.innerHTML += '<div> \n <select id="speak_model"><option>JBL Speaker</option><option>2</option></select> <select id="speaker_location"><option>Ceiling</option><option>Whiteboard Wall</option></select> <input type="number">\n </div>';
  return;
}

function newMicSection() {
  updateConsole("Adding New Microphone Field");
  let spkrSection = document.querySelector('.program_board .program_guts .mic_sel');
  spkrSection.innerHTML += '<div> \n <select id="mic_model"><option>microphone</option><option>2</option></select> <select id="mic_location"><option>Ceiling</option><option>table</option></select> <input type="number"> <button onclick="deleteMicSection()">x</button> \n </div>';
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
    main_container.innerHTML = '<p>hello world - CamCode</p> \n <button id="crestron_files" onclick="setCrestronFile()"> Crestron File Manager </button>\n <p>\n</p>';

    // Room Orientation
    // Projectors or displays?
    //   proj - lazer or bulb
    let projectorSection = document.createElement("fieldset");
    projectorSection.classList.add('proj_sel');
    let set_Inner = '<div> \n <select id="proj_model"><option>EPSON Pro L510U</option><option>2</option></select> <select id="proj_location"><option>Ceiling</option><option>Somewhere else</option></select> <input type="number"> <button id="new_sel" onclick="newPjSection()"> New Field</button> \n </div>';
    projectorSection.innerHTML = `<legend>Projector(s):</legend> ${set_Inner}`;

    // Speakers
    //    wall or ceiling
    //    kind of speakers
    //    quauntity
    let speakerSection = document.createElement("fieldset");
    speakerSection.classList.add('speak_sel');
    set_Inner = '<div> \n <select id="speak_model"><option>JBL Speaker</option><option>2</option></select> <select id="speaker_location"><option>Ceiling</option><option>Whiteboard Wall</option></select> <input type="number"> <button id="new_sel" onclick="newSpkrSection()"> New Field</button> \n </div>';
    speakerSection.innerHTML = `<legend>Speakers(s):</legend> ${set_Inner}`;

    // Mics
    //    kind of mics
    //    quantity
    //    speaking zones?
    let micSection = document.createElement("fieldset");
    micSection.classList.add('mic_sel');
    set_Inner = '<div> \n <select id="mic_model"><option>microphone</option><option>2</option></select> <select id="mic_location"><option>Ceiling</option><option>table</option></select> <input type="number"> <button id="new_sel" onclick="newMicSection()"> New Field</button> \n </div>';
    micSection.innerHTML = `<legend>Microphones(s):</legend> ${set_Inner}`;
    
    // Src Selection
    let srcSelect = document.createElement("fieldset");
    srcSelect.classList.add('devSelect');
    srcSelect.innerHTML = '<legend>Sources in Classroom: </legend> \n <input class="cbSrc" type ="checkbox" id="pc" name="dev" value="Room PC" /> \n <label for="pc"> Room PC </label><br> \n <input class="cbSrc" type="checkbox" id="laptop" name="dev" value="laptop" /> \n <label for="laptop">Laptop</label><br> \n <input class="cbSrc" type="checkbox" id="ws" name="dev" value="Wyo Shares" /> \n <label for="ws">Wyo Shares</label><br> \n <input class="cbSrc" type="checkbox" id="bd" name="dev" value="Blu-Ray" /> \n <label for="bd">Blu-Ray Player</label><br> \n <input class="cbSrc" type ="checkbox" id="elmo" name="dev" value="Document Camera" /> \n <label for="elmo"> Document Camera </label><br> \n ';

    // Console Output
    let consoleOutput = document.createElement("fieldset");
    consoleOutput.classList.add('consoleOutput');
    consoleOutput.innerHTML = '<legend> Console Output: </legend> \n <textarea readonly rows="10" cols ="80" class="innerConsole" name="consoleOutput" spellcheck="false"> Console: Example </textarea>';

    // Bottom Menu buttons
    // html options: menu
    let bottomMenu = document.createElement("fieldset");
    bottomMenu.classList.add('bottomMenu');
    bottomMenu.innerHTML = '<legend>Options: </legend> \n <menu> \n <button id="run" onclick="findFiles()"> Generate Files </button> \n <button id="clearCon" onclick="clearConsole()"> Clear Console </button> \n <button id="reset" onclick="resetCamCode()"> Reset </button> \n </menu>';

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
function setBrowserConsole(header, files) {
  let conObj = document.querySelector('.innerConsole');
  
  // center header
  let numberOfSpaces = 80 - header.length;
  let newHeader = header.padStart((numberOfSpaces/2), " ");
  let list = "";

  for(var i = 0; i < files.length; i++) {
    list += files[i] + '\n';
  }
  conObj.value = newHeader + '\n' + list;
  return;
}

async function updateRoomList() {
  let rl = document.querySelector('.program_board .program_guts .rmSelect');
  let rms = document.createElement("Fieldset");
  rms.classList.add('rmSelect');

  let set_inner_html = `<select id="room_list">`;

  let sel_building = await getBuildingSelection();
  let new_rl = await getRooms(sel_building);
  
  for(var i in new_rl) {
    set_inner_html += `<option value=${new_rl[i]}>${new_rl[i]}</option>`;
  };
  set_inner_html += '</select>';
  rms.innerHTML = `<legend>Choose Rooms(s): </legend> ${set_inner_html}`;
  rl.replaceWith(rms);
  return;
}

// Change the DOM for Crestron File Manager
async function setCrestronFile() {
  console.log('switching to camcode-cfm');
  let progGuts = document.querySelector('.program_board .program_guts');
  let main_container = document.createElement('div');
  main_container.innerHTML = '<p>hello world - CamCode (Crestron File Manager) </p> \n <button id="cam_code" onclick="setCamCode()"> CamCode (Q-SYS) </button> \n <p>\n</p> ';

  // Get Building List
  let buildingSelect = document.createElement("Fieldset");
  let set_inner_html = '<select id="building_list" onchange="updateRoomList()">';
  let bl = await getBuildingList();
  for(var i in bl) {
    set_inner_html += `<option value=${i}>${bl[i]}</option>`;
  };
  set_inner_html += '</select>';
  buildingSelect.innerHTML = `<legend>Choose Building(s): </legend> ${set_inner_html}`;

  // Get room list based on selected building
  // might need to be a seperate function so it updates on new building selections.
  let roomSelect = document.createElement("Fieldset");
  roomSelect.classList.add('rmSelect');
  set_inner_html = '<select id="room_list">';
  //let selected_building = document.getElementById('building_list');
  let rl = await getRooms('Agriculture');
  for(var i in rl) {
    set_inner_html += `<option value=${i}>${rl[i]}</option>`;
  };
  set_inner_html += '</select>';
  roomSelect.innerHTML = `<legend>Choose Rooms(s): </legend> ${set_inner_html}`;

  // Console Output
  let consoleOutput = document.createElement("fieldset");
  consoleOutput.classList.add('consoleOutput');
  consoleOutput.innerHTML = '<legend> Console Output: </legend> \n <textarea readonly rows="10" cols ="80" class="innerConsole" name="consoleOutput" spellcheck="false"> Console: Example </textarea>';

  // Bottom Menu buttons
  // html options: menu
  let bottomMenu = document.createElement("fieldset");
  bottomMenu.classList.add('bottomMenu');
  bottomMenu.innerHTML = '<legend>Options: </legend> \n <menu> \n <button id="run" onclick="cfmFiles()"> Generate Files </button> \n <button id="clearCon" onclick="clearConsole()"> Clear Console </button> \n <button id="reset" onclick="resetCamCode()"> Reset </button> \n </menu>';

  main_container.appendChild(buildingSelect);
  main_container.appendChild(roomSelect);
  main_container.appendChild(consoleOutput);
  main_container.appendChild(bottomMenu);
  main_container.classList.add('program_guts');
  progGuts.replaceWith(main_container);
  return;
}