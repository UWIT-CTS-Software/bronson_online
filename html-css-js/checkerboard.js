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

function myFunc() {
    console.log("Click");
}

async function getRoomChecks() {
    let response = await cbSearch("2024-06-01", "2024-06-28");

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
    console.log(response.json());

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

async function run() {
    let zones = document.getElementsByName('cb_dev');
    let zone_array = [];

    for (var i=0; i<zones.length; i++) {
        if (zones[i].checked) {
            zone_array.push(zones[i].id);
        }
    }

    let response = await fetch('run_cb', {
        method: "POST",
        body: JSON.stringify({
            zones: zone_array,
        })
    })
    .then((response) => response.json())
    .then((json) => {
        return json.rooms;
    });

    updateConsole(response);

    return;
}

function updateConsole(text) {
    let consoleObj = document.querySelector('.innerConsole');
    const beforeText = consoleObj.value.substring(0, consoleObj.value.length);
    consoleObj.value = beforeText + '\n' + text;
    consoleObj.scrollTop = consoleObj.scrollHeight;
    return;
};

function setChecker() {
    let tool_header = document.querySelector('.tool_header');
    tool_header.innerHTML = 'Checkerboard';

    console.log('Switching to checkerboard');
    let prog_guts = document.querySelector('.program_board .program_guts');

    var base_time = new Time;
    base_time.setTime("2024-06-01");

    let main_container = document.createElement("div");
    main_container.classList.add("cb_container");

    // map_select Section
    let map_select = document.createElement("div");
    map_select.classList.add('cb_mapSelect');
    map_select.innerHTML = `
        <fieldset>
            <legend>
                Select Zone: </legend>
            <input class="cbDev" type ="checkbox" id="1" name="cb_dev" value="Processors"/>
            <label for="1"> 
                Zone 1</label>
            <br>
            <input class="cbDev" type="checkbox" id="2" name="cb_dev" value="Projectors"/>
            <label for="2">
                Zone 2</label>
            <br>
            <input class="cbDev" type="checkbox" id="3" name="cb_dev" value="Wyo Shares"/>
            <label for="3">
                Zone 3</label>
            <br>
            <input class="cbDev" type="checkbox" id="4" name="cb_dev" value="Touch Panels"/>
            <label for="4">
                Zone 4</label>
            <br>
        </fieldset>`;

    // Bottom Menu buttons
    // html options: menu
    let button_menu = document.createElement("div");
    button_menu.classList.add('cb_buttonRow');
    button_menu.innerHTML = `
        <fieldset class="cb_fieldset">
            <legend>
                Options: </legend>
            <button id="cb_run" onclick="run()">
                Run!</button>
        </fieldset>`;

    // Console Output
    let console_output = document.createElement("div");
    console_output.classList.add('cb_console');
    console_output.innerHTML = `
        <fieldset>
            <legend>
                Console Output: </legend>
            <textarea readonly rows="35" cols ="70" class="innerConsole" name="consoleOutput" spellcheck="false">
                Console: Example </textarea>
        </fieldset>`;

    main_container.append(map_select);
    main_container.append(button_menu);
    main_container.append(console_output);

    main_container.classList.add('program_guts');
    prog_guts.replaceWith(main_container);
    return;
}