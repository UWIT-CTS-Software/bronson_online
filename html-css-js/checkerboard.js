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

    cb_fetchAlertConsole();

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
        return json.rooms.sort();
    });

    cb_updateConsole(response);

    return;
}

function cb_updateConsole(array) {
    let consoleObj = document.querySelector('.cb_console');
    let html_str = `
        <fieldset class="cb_fieldset">
            <legend>
                Console Output: </legend>
            <ul>`;

    for (row in array) {
        let split_str = array[row].split(' | ');
        let span_str = '';
        switch (split_str[0].length) {
            case 7:
                span_str = `<li>&nbsp;&nbsp;&nbsp;&nbsp;${split_str[0]} | `;
                break;
            case 8:
                span_str = `<li>&nbsp;&nbsp;${split_str[0]} | `;
                break;
            default:
                span_str = `<li>${split_str[0]} | `;
                break;

        }

        if (split_str[1].includes("[+]")) {
            span_str += `<span class="cb_green">${split_str[1]}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> | ${split_str[2]} | `;
        } else if (split_str[1].includes("[-]")) {
            span_str += `<span class="cb_red">${split_str[1]}&nbsp;&nbsp;</span> | ${split_str[2]} | `;
        }

        if (split_str[3].includes("[+]")) {
            span_str += `<span class="cb_green">${split_str[3]}&nbsp;&nbsp;&nbsp;&nbsp;</span>&nbsp;| ${split_str[4]}`;
        } else if (split_str[3].includes("[-]")) {
            span_str += `<span class="cb_red"">${split_str[3]}&nbsp;&nbsp;</span>&nbsp;| ${split_str[4]}`;
        }
        span_str += `</li>`;
        html_str += span_str;
    }
    html_str += `</ul></fieldset>`;
    consoleObj.innerHTML = html_str;
    
    return;
}

function cb_fetchAlertConsole() {
    let consoleObj = document.querySelector('.cb_console');
    consoleObj.innerHTML = `
        <fieldset class="cb_fieldset" name="innerConsole">
            <legend>
                Console Output: </legend>
            <p class="cfm_text">Fetching rooms...</p>
        </fieldset>`;

    return;
}

function cb_clearConsole() {
    let consoleObj = document.querySelector('.cb_console');
    consoleObj.innerHTML = `
        <fieldset class="cb_fieldset" name="innerConsole">
            <legend>
                Console Output: </legend>
            <p class="cfm_text">Select Zone(s) and click Run to run search.</p>
        </fieldset>`;

    return;
}

function setChecker() {
    const menuItems = document.querySelectorAll(".menuItem");
    const hamburger = document.querySelector(".hamburger");

    hamburger.addEventListener("click", toggleMenu);
    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

    document.title = "CheckerBoard - Bronson";
    // remove currently active status mark tab has active.
    // let active_tab_header = document.querySelector('.active_tab_header');
    // active_tab_header.innerHTML = 'Checkerboard';
    let current = document.getElementsByClassName("selected");
    console.log(current);
    if (current.length != 0) {
        current[0].classList.remove("selected");
        // current[0].classList.remove("active");
    }
    let newCurrent = document.getElementById("CBButton");
    // newCurrent.classList.add("active");
    newCurrent.classList.add("selected");


    history.pushState("test", "CheckerBoard", "/checkerboard");

    console.log('Switching to checkerboard');
    let prog_guts = document.querySelector('.program_board .program_guts');

    let main_container = document.createElement("div");
    main_container.classList.add("cb_container");

    // map_select Section
    let map_select = document.createElement("div");
    map_select.classList.add('cb_mapSelect');
    map_select.innerHTML = `
        <fieldset class="cb_fieldset">
            <legend>
                Select Zone: </legend>
            <input class="cbDev" type ="checkbox" id="1" name="cb_dev" value="Processors"/>
            <label for="1"> 
                Zone 1</label>
            
            <input class="cbDev" type="checkbox" id="2" name="cb_dev" value="Projectors"/>
            <label for="2">
                Zone 2</label>
            <br>
            <input class="cbDev" type="checkbox" id="3" name="cb_dev" value="Wyo Shares"/>
            <label for="3">
                Zone 3</label>
            
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
            <button id="cb_run" onclick="run()" class="headButton">
                Run!</button>
        </fieldset>`;

    // Console Output
    let console_output = document.createElement("div");
    console_output.classList.add('cb_console');
    console_output.innerHTML = `
        <fieldset class="cb_fieldset" >
            <legend>
                Console Output: </legend>
            <p class="cfm_text">Select Zone(s) and click Run to run search.</p>
        </fieldset>`;

    main_container.append(map_select);
    main_container.append(button_menu);
    main_container.append(console_output);

    main_container.classList.add('program_guts');
    prog_guts.replaceWith(main_container);

    return;
}