/* signing.js

Handles sign-in protocol and setting up the webpage once authorized.

notes;
make tool/site bar load once login is succesful
make sure to update bronson logo .onclick to return to dash instead of log in page.
*/


function setSignIn() {
    let tool_header = document.querySelector('.tool_header');
    tool_header.innerHTML = 'Dashboard';
    console.log('Switching to dashboard');

    let prog_guts = document.querySelector('.program_board .program_guts');

    let db_container = document.createElement("div");
    db_container.classList.add("db_container");
    // db_container.innerHTML = `
    //   <p class='tool_header'>
    //     Dashboard </p>`;

    // signin
    let signinDiv = document.createElement("div");
    signinDiv.classList.add('db_console');
    signinDiv.innerHTML = `
      <fieldset>
          <legend> 
              Username: </legend>
          <textarea rows="1" cols ="20" class="userSignIn" name="userSignInn" spellcheck="false">tech</textarea>
      </fieldset>
      <fieldset>
          <legend> 
              Password: </legend>
          <textarea rows="1" cols ="20" class="userPassword" name="userPassword" spellcheck="false"> 
              psswd
          </textarea>
      </fieldset>
      <button class=signButton onClick=chkPasswd()>
        Sign In</button>`;

    db_container.appendChild(signinDiv);

    let main_container = document.createElement('div');
    main_container.appendChild(db_container);
    main_container.classList.add('program_guts');
    prog_guts.replaceWith(main_container);
    return;
}

function chkPasswd() {
    let text = document.querySelector('.userSignIn');
    if(text.value == "admin") {
      setDashboard();
    }
    return;
}

// setDashboard()
function setDashboard() {
    // add tool/sitebar setup here.
    let tool_header = document.querySelector('.tool_header');
    tool_header.innerHTML = 'Dashboard';
    console.log('Switching to dashboard');

    let prog_guts = document.querySelector('.program_board .program_guts');

    let db_container = document.createElement("div");
    db_container.classList.add("db_container");
    // db_container.innerHTML = `
    //   <p class='tool_header'>
    //     Dashboard </p>`;

    // Console Output
    let consoleOutput = document.createElement("div");
    consoleOutput.classList.add('db_console');
    consoleOutput.innerHTML = `
      <fieldset>
          <legend> 
              Messages: </legend>
          <textarea readonly rows="20" cols ="75" class="innerConsole" name="consoleOutput" spellcheck="false"> 
              Welcome to Bronson!
          </textarea>
      </fieldset>`;

    db_container.appendChild(consoleOutput);

    let main_container = document.createElement('div');
    main_container.appendChild(db_container);
    main_container.classList.add('program_guts');
    prog_guts.replaceWith(main_container);
    return;