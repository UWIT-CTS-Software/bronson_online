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
  let prog_guts = document.querySelector('.program_board .program_guts');

  var base_time = new Time;
  base_time.setTime("2024-06-01");

  let body_container = document.createElement("div");
  body_container.classList.add("largeContainer");

  let map_select = document.createElement("fieldset");
  map_select.classList.add('mapSelect');
  map_select.innerHTML = '<legend>Select Zone: </legend> \n \
                          <img src ="uw-laramie-campus-zones.jpg" style="width:100%;height:auto" usemap="#zonemap"> \n \
                          <map name="zonemap"> \n \
                            <area shape="poly" coords="70,480,620,478,618,535,769,560,769,630,448,641,451,867,230,870,233,960,124,960,127,806,183,809,188,647,68,647" alt="Test" onclick="myFunc()"> \n \
                          </map>';

  let control_container = document.createElement("div");
  control_container.classList.add("mediumContainer");

  // Bottom Menu buttons
  // html options: menu
  let button_menu = document.createElement("fieldset");
  button_menu.classList.add('buttonRow');
  button_menu.innerHTML = '<legend>Options: </legend> \n <menu> \n <button id="roomSchedule" onclick="getRoomSchedule()">Room Schedule</button> \n <button id="roomChecks" onclick="getRoomChecks()">Room Checks</button> \n <button id="print" onclick="printToConsole()">Print</button> \n </menu>';

  // Console Output
  let console_output = document.createElement("fieldset");
  console_output.classList.add('console');
  console_output.innerHTML = '<legend> Console Output: </legend> \n <textarea readonly rows="35" cols ="70" class="innerConsole" name="consoleOutput" spellcheck="false"> Console: Example </textarea>';

  control_container.append(button_menu, console_output);
  body_container.append(map_select, control_container);

  body_container.classList.add('program_guts');
  prog_guts.replaceWith(body_container);
  return;
}

function myFunc() {
    console.log("Click");
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

    let response = await fetch('lsm', {
        method: "POST",
        body: JSON.stringify({
            start_time: init_time,
            end_time, end_time,
        })
    });
    console.log(response);

    return;
}

async function getRoomSchedule() {
    let zones = document.getElementsByName('dev');
    let zone_array = [];

    for (var i=0; i<zones.length; i++) {
        if (zones[i].checked) {
            zone_array.push(zones[i].id);
        }
    }

    let response = await fetch('schedule', {
        method: "POST",
        body: JSON.stringify({
            zones: zone_array,
        })
    });
    console.log(response);

    return;
}

function printToConsole() {
    let str = 'awginearhoi5nh345980uq3o4hnae\nrhklq3-40haekbkln   23y09jearhbjn   234t09jq3rhoinq34y09'
    let console = document.querySelector('.innerConsole');
    let inner = console.value.substring(0, console.value.length);
    for (var i=0; i<20; ++i) {
        inner += `\n-- ${str.slice((i*4), ((i*4)+5))} ${i}   |`;
    }
    console.value = inner;
    console.scrollTop = console.scrollHeight;
}