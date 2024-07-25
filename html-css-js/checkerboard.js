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

function setChecker() {

  console.log('Switching to checkerboard');
  let progGuts = document.querySelector('.program_board .program_guts');

  let main_container = document.createElement('div');
  main_container.innerHTML = '<p>hello world - checkerboard</p>';

  var base_time = new Time;
  base_time.setTime("2024-06-01");

  let devSelect = document.createElement("fieldset");
  devSelect.classList.add('devSelect');
  devSelect.innerHTML = '<legend>Choose Devices to Search For: </legend> \n <input class="cbDev" type ="checkbox" id="z1" name="dev" value="Zone 1" /> \n <label for="z1"> Zone 1 </label><br> \n <input class="cbDev" type="checkbox" id="z2" name="dev" value="Zone 2" /> \n <label for="z2">Zone 2</label><br> \n <input class="cbDev" type="checkbox" id="z3" name="dev" value="Zone 3" /> \n <label for="z3">Zone 3</label><br> \n <input class="cbDev" type="checkbox" id="z4" name="dev" value="Zone 4" /> \n <label for="z4">Zone 4</label><br>\n';

  // log progress (use tag progress)

  // Console Output
  let consoleOutput = document.createElement("fieldset");
  consoleOutput.classList.add('consoleOutput');
  consoleOutput.innerHTML = '<legend> Console Output: </legend> \n <textarea readonly rows="10" cols ="80" class="innerConsole" name="consoleOutput" spellcheck="false"> Console: Example </textarea>';

  // Bottom Menu buttons
  // html options: menu
  let bottomMenu = document.createElement("fieldset");
  bottomMenu.classList.add('bottomMenu');
  bottomMenu.innerHTML = `<legend>Options: </legend> \n <menu> \n <button id="test" onclick="getRoomChecks()">Test</button> \n <button id="print" onclick="printToConsole()">Print</button> \n </menu>`;

  main_container.append(devSelect, consoleOutput, bottomMenu);
  main_container.classList.add('program_guts');
  progGuts.replaceWith(main_container);
  return;
}

async function getRoomChecks() {
    let cookie = new Cookie;
    let response = await cbSearch("2024-06-01", "2024-06-28", cookie);

    return response;
}

async function cbSearch(init_time, end_time, cookie) {
    /* let url = `https://uwyo.talem3.com/lsm/api/RoomCheck?offset=0&p=%7BCompletedOn%3A%5B${init_time}%2C${end_time}%5D%7D`;
    let xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Authorization', 'Basic YXBpX2Fzc2VzczpVb2ZXeW8tQ1RTMzk0NS1BUEk=');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
          console.log(xhr.responseText);
        }
    };
    xhr.send(); */

    response = await fetch('lsm', {
        method: "POST",
        body: JSON.stringify({
            start_time: init_time,
            end_time, end_time,
        })
    });
    console.log(response);

    return;
}

function printToConsole() {
    let str = 'awginearhoi5nh345980uq3o4hnaerhklq3-40haekbkln   23y09jearhbjn   234t09jq3rhoinq34y09'
    let console = document.querySelector('.innerConsole');
    let inner = console.value.substring(0, console.value.length);
    for (var i=0; i<20; ++i) {
        inner += `\n-- ${str.slice((i*4), ((i*4)+5))} ${i}   |`;
    }
    console.value = inner;
    console.scrollTop = console.scrollHeight;
}
