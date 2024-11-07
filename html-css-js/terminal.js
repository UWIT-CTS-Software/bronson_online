function setTerminal() {
    const menuItems = document.querySelectorAll(".menuItem");
    const hamburger = document.querySelector(".hamburger");

    hamburger.addEventListener("click", toggleMenu);
    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

    document.title = "Terminal - Bronson";
    let tool_header = document.querySelector('.tool_header');
    tool_header.innerHTML = 'Terminal';
    history.pushState("test", "Terminal", "/terminal");

    console.log('Switching to terminal');
    let prog_guts = document.querySelector('.program_board .program_guts');

    let main_container = document.createElement("div");
    main_container.classList.add("terminal_container");

    // Console Output
    let console_output = document.createElement("div");
    console_output.classList.add('cb_console');
    console_output.innerHTML = `
        <fieldset class="cb_fieldset" >
            <legend>
                Terminal: </legend>
            <div id="terminal"></div>
        </fieldset>`;

    main_container.append(console_output);

    main_container.classList.add('program_guts');
    prog_guts.replaceWith(main_container);

    return;
}