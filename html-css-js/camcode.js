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

TODO:
  [ ] - Define the parameters we are using
  [ ] - Prepare a library of Q-SYS files
*/

function findFiles() {
  updateConsole("CamCode Currently Nonfunctional Sorry :(");
  return;
}

function setCamCode() {
    console.log('Switching to camcode')
    let progGuts = document.querySelector('.program_board .program_guts');
    let main_container = document.createElement('div');
    main_container.innerHTML = '<p>hello world - CamCode</p>';

    // Room Orientation
    let projectorSection = document.createElement("fieldset");
    projectorSection.classList.add('proj_sel');
    let set_Inner = '<select id="proj_sel"><option>1</option><option>2</option></select>';
    projectorSection.innerHTML = `<legend>Number of Projector(s):</legend> ${set_Inner}`;

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
    bottomMenu.innerHTML = '<legend>Options: </legend> \n <menu> \n <button id="run" onclick="findFiles()"> Generate Files </button> \n <button id="clearCon" onclick="clearConsole()"> Clear Console </button> \n </menu>';

    // PUT EVERYTHING TOGETHER MAIN_CONTAINER
    main_container.appendChild(projectorSection);
    main_container.appendChild(srcSelect);
    main_container.appendChild(consoleOutput);
    main_container.appendChild(bottomMenu);
    main_container.classList.add('program_guts');
    //p.appendChild(select)
    progGuts.replaceWith(main_container);
    return
  }