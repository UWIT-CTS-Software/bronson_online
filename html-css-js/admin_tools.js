// admin_tools.js

// Note, I think it would be good to put the terminal stuff in here that is currently in index_admin.html but it utilizes JQueury in a way that I am not hundred percent sure of so I will not be doing that just yet because I don't want to break anything.


function setAdminBronson() {
    // Add Admin Tool Tab
    siteheader = document.getElementById("middle");
    adminTabs = document.createElement("div");
    adminTabs.classList.add("tab_row");
    adminTabs.classList.add("admin_tab");
    adminTabs.innerHTML = `<button id="adminButton" class="toolTab adminTab" onclick="setAdminTools()" type=button><img class="tab_img" src=button2.png></img><span>Admin Tools</span></button>`;
    siteheader.appendChild(adminTabs);
}

// Set Admin Tool Page
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

    // Build Admin Tools Landing Page
    let at_container = document.createElement("div");
    at_container.classList.add("at_container");
    // Admin Tool Tab Rows
    let admin_tab_row = document.createElement("div");
    admin_tab_row.classList.add("tab_row");
    admin_tab_row.classList.add("admin_tabs");
    admin_tab_row.innerHTML = `
    <button id="at_message" onclick="setMessageEditor()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Message Editor </span>
    </button>
    <button id="at_schedule" onclick="setScheduleEditor()" type="button" class="atTab">
        <img class="at_tab_img" src="button2.png"/>
        <span> Schedule Editor </span>
    </button>`;
    // init admin tool guts
    let admin_internals = document.createElement("div");
    admin_internals.setAttribute("id", "admin_internals");
    admin_internals.innerHTML = `<p> Please Select an Administrative Tool </p>`;
    // fieldset
    let at_fieldset = document.createElement('fieldset');
    at_fieldset.classList.add('at_fieldset');
    at_fieldset.innerHTML = `<legend> Admin Tools </legend>`;
    at_fieldset.appendChild(admin_tab_row);
    at_fieldset.appendChild(admin_internals);
    at_container.appendChild(at_fieldset);

    let main_container = document.createElement('div');
    main_container.appendChild(at_container);
    main_container.classList.add('program_guts');
    progGuts.replaceWith(main_container);
    return;
}

// Set MessageEditor
// TODO - Check permissions here
function setMessageEditor() {
    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("at_selected");
    if (current.length != 0) {
        current[0].classList.remove("at_selected");
    }
    let newCurrent = document.getElementById("at_message");
    newCurrent.classList.add("at_selected");

    // Update Dashboard Message
    let dashboard_message_editor = document.createElement("div");
    dashboard_message_editor.setAttribute("id", "admin_internals");
    dashboard_message_editor.classList.add('at_dme'); //dashboard message editor, acronym
    dashboard_message_editor.innerHTML = `
    <fieldset>
        <legend> Edit Dashboard Message: </legend>
        <textarea id="dme_editor"></textarea>
        <button onclick="setDashboardMessage()"> Set Message </button>
        <button onclick="clearEditor()"> Clear Editor </button> 
    </fieldset>`;
    // replace admin_internals
    let admin_internals = document.getElementById('admin_internals');
    admin_internals.replaceWith(dashboard_message_editor);
    return;
}

function setScheduleEditor() {
    // remove currently active status, mark tab has active.
    let current = document.getElementsByClassName("at_selected");
    if (current.length != 0) {
        current[0].classList.remove("at_selected");
    }
    let newCurrent = document.getElementById("at_schedule");
    newCurrent.classList.add("at_selected");
    // build tool
    let schedule_editor = document.createElement('div');
    schedule_editor.setAttribute("id", "admin_internals");
    schedule_editor.classList.add('at_se');
    // get Current Schedule
    //  Note this will change with the database
    let scheduleData = JSON.parse(localStorage.getItem("schedule"));
    if(scheduleData == null) {
        console.assert("Error: schedule not found in local storage.");
        return;
    }
    for(let i = 0; i < scheduleData.Technicians.length; i++) {
        console.log(scheduleData.Technicians[i]);
        schedule_editor.appendChild(makeTechEditTable(scheduleData.Technicians[i]));
    }
    // TODO: Make Buttons
    let buttonFieldset = document.createElement('div');
    buttonFieldset.innerHTML = `
    <fieldset>
        <legend> Buttons </legend>
        <button> Set Schedule </button>
        <button> Add Technician </button>
    </fieldset>`;
    schedule_editor.appendChild(buttonFieldset);
    // replace admin_internals
    let admin_internals = document.getElementById('admin_internals');
    admin_internals.replaceWith(schedule_editor);
    return;
}

// TODO - return a div for each tech given
function makeTechEditTable(techObj) {
    let techTable = document.createElement('div');
    //techTable.innerText = techObj.Name;
    //let techSchedule = techObj.Schedule;
    let tableHTML = `
        <table>
        <thead>
        </thead>
            <tr>
                <th scope="col">Weekday</th>
                <th scope="col">7:30AM</th>
                <th scope="col">8:00AM</th>
                <th scope="col">8:30AM</th>
                <th scope="col">9:00AM</th>
                <th scope="col">9:30AM</th>
                <th scope="col">10:00AM</th>
                <th scope="col">10:30AM</th>
                <th scope="col">11:00AM</th>
                <th scope="col">11:30AM</th>
                <th scope="col">12:00PM</th>
                <th scope="col">12:30PM</th>
                <th scope="col">1:00PM</th>
                <th scope="col">1:30PM</th>
                <th scope="col">2:00PM</th>
                <th scope="col">2:30PM</th>
                <th scope="col">3:00PM</th>
                <th scope="col">3:30PM</th>
                <th scope="col">4:00PM</th>
                <th scope="col">4:30PM</th>
                <th scope="col">5:00PM</th>
                <th scope="col">5:30PM</th>
                <th scope="col">6:00PM</th>
                <th scope="col">6:30PM</th>
                <th scope="col">7:00PM</th>
            </tr>
        <tbody>
            ${makeTechSchdRow(techObj, "Monday")}
            ${makeTechSchdRow(techObj, "Tuesday")}
            ${makeTechSchdRow(techObj, "Wednesday")}
            ${makeTechSchdRow(techObj, "Thursday")}
            ${makeTechSchdRow(techObj, "Friday")}
        </tbody>
        </table>`;
    techTable.innerHTML = tableHTML;
    return techTable;
}

// Grabs the contents of the text
//  Need to update setDashboard() to check for this
//  I am waiting on the database to have the correct behavior.
//  When the pieces are in place, the contents of this editor will
//  be sent to the back end and be saved in the database and then all
//  dashboards will pull that value for the dashboard messages content.
function setDashboardMessage() {
    let dme = document.getElementById("dme_editor");
    contents = dme.innerText;
    localStorage.setItem("DashboardMessage", contents);
    return;
}

function clearEditor() {
    let dme = document.getElementById("dme_editor");
    dme.innerText = ``;
    return;
}