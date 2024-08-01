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

HTML-CC
 - hLengend(text)  ? is this needed?
 - resetCamCode()
 - updateRoomList()
 - newPjSection()
 - newSpkrSection()
 - newMicSection()
[ ] removeSection()
 - setCamCode()
 
CamCode (Q-SYS)
TODO:
  [ ] - Define the parameters we are using
  [ ] - Prepare a library of Q-SYS files

Q-SYS has a multitude of modules and we will be retrieving these modules based on the parameters given in the form.

NOTE:
Final CamCode DOM will NOT use the console prompt,
I am only using that to debug.
*/

// TODO: findFiles()
//    Gather page parameters and use post fetch to get required files.
function findFiles() {
  updateConsole("CamCode Currently Nonfunctional Sorry :(");
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

function hLegend(text) {
  return `
  <legend>
    ${text}
  <legend>`;
}

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
      ${hLegend("Projector(s):")}
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
          New Field</button>
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
      <legend>Sources in Classroom:</legend>
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