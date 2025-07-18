// admin_tools.js

// Note, I think it would be good to put the terminal stuff in here that is currently in index_admin.html but it utilizes JQueury in a way that I am not hundred percent sure of so I will not be doing that just yet because I don't want to break anything.

// A very slightly different admin dashboard function.
// mostly the same but it grabs the tool row and adds a new button on the right hand side that will give access to some priviledged settings. 
async function setDashboardAdmin() {
    // History and init
    preserveCurrentTool();
    document.title = "Admin Dashboard - Bronson";
    history.pushState({}, "Dashboard", "/");

    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("selected");
    if (current.length != 0) {
        current[0].classList.remove("selected");
    }
    let newCurrent = document.getElementById("DBButton");
    newCurrent.classList.add("selected");

    // Select Program guts, page content.
    let prog_guts = document.querySelector('.program_board .program_guts');

    let db_container = document.createElement("div");
    db_container.classList.add("db_container");

    // Dashboard Contents
    let consoleOutput = document.createElement("div");
    consoleOutput.classList.add('db_console');
    await fetch("/dashContents")
        .then((response) => response.json())
        .then((json) => {
            consoleOutput.innerHTML = `
            <fieldset>
                <legend> 
                    Messages: </legend>
                <textarea readonly rows="18" cols ="65" class="db_messages" name="consoleOutput" spellcheck="false"> 
                    ${json["contents"]}
                </textarea>
            </fieldset>`;
    });

    let leaderboard = document.createElement("div");
    leaderboard.classList.add("db_leader");
    leaderboard.innerHTML = `
    <fieldset>
        <legend>
        Room Check Leaderboard: 
        </legend>
        <div class="tab_row leader">
        <button id="WeekButton" onclick="setLeaderWeek()" type="button" class="leaderTab weekTab"><img class="leader_tab_img" src="button2.png"/><span>
            7 days </span></button>
        <button id="MonthButton" onclick="setLeaderMonth()" type="button" class="leaderTab monthTab"><img class="leader_tab_img" src="button2.png"/><span>
            30 days </span></button>
        <button id="SemesterButton" onclick="setLeaderSemester()" type="button" class="leaderTab semesterTab"><img class="leader_tab_img" src="button2.png"/><span> 
            90 days </span></button>
        </div>
        <textarea readonly rows="17" cols="35" class="innerConsole" id="leaderboard" spellcheck="false">
        </textarea>
    </fieldset>
    `;

    db_container.appendChild(consoleOutput);
    db_container.appendChild(leaderboard);

    // Check for client-side cached response
    if(sessionStorage.getItem("cb_body") != null) {
        db_container.append(await dashCheckerboard());
    } else if (sessionStorage.getItem("jn_body") != null) {
        db_container.append(dashJackNet());
    }

    let main_container = document.createElement('div');
    main_container.appendChild(db_container);
    main_container.classList.add('program_guts');
    prog_guts.replaceWith(main_container);
    // Init sessionStorage
    initLocalStorage();
    // Add Admin Tool Tab
    siteheader = document.getElementById("middle");
    adminTabs = document.createElement("div");
    adminTabs.classList.add("tab_row");
    adminTabs.classList.add("admin_tabs");
    adminTabs.innerHTML = `<button id="adminButton" class="toolTab adminTab" onclick="setAdminTools()" type=button><img class="tab_img" src=button2.png></img><span>Admin Tools</span></button>`;
    siteheader.appendChild(adminTabs);
    return;
}

async function setAdminTools() {
    const menuItems = document.querySelectorAll(".menuItem");

    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

    preserveCurrentTool();

    document.title = "Admin Tools - Bronson";
    // remove currently active status mark tab has active.
    // let active_tab_header = document.querySelector('.active_tab_header');
    // active_tab_header.innerHTML = 'Checkerboard';
    let current = document.getElementsByClassName("selected");
    if (current.length != 0) {
        current[0].classList.remove("selected");
        // current[0].classList.remove("active");
    }
    let newCurrent = document.getElementById("adminButton");
    // newCurrent.classList.add("active");
    newCurrent.classList.add("selected");


    history.pushState("test", "Admin Tools", "/admintools");

    let progGuts = document.querySelector('.program_board .program_guts');

    let at_container = document.createElement("div");
    at_container.classList.add("at_container");

    // Update Dashboard Message
    let dashboard_message_editor = document.createElement("div");
    dashboard_message_editor.classList.add('at_dme'); //dashboard message editor, acronym
    dashboard_message_editor.innerHTML = `
    <fieldset>
        <legend> Edit Dashboard Message: </legend>
        <textarea id="dme_editor"></textarea>
        <button onclick="setDashboardMessage()> Set Message </button>
        <button onclick="clearEditor()"> Clear Editor </button> 
    </fieldset>`;
    return;
}

// Grabs the contents of the text
//  Need to update setDashboard() to check for this
function setDashboardMessage() {
    let dme = document.getElementById("dme_editor");
    contents = dme.innerText; 
    localStorage.add("DashboardMessage", contents);
    return;
}

function clearEditor() {
    let dme = document.getElementById("dme_editor");
    dme.innerText = ``;
    return;
}