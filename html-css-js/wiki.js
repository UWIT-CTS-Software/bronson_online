/*
          _ _    _   _     
         (_) |  (_) (_)    
__      ___| | ___   _ ___ 
\ \ /\ / / | |/ / | | / __|
 \ V  V /| |   <| |_| \__ \
  \_/\_/ |_|_|\_\_(_) |___/
                   _/ |    
                  |__/     

A wiki / knowledge base interface for the cts team.

Written by Jack Nyman
*/

//// Marked Import
// import { marked } from 'marked';
// or const { marked } = require('marked');
//const html = marked.parse('# Marked in Node.js\n\nRendered by **marked**.');

// idk lol wiki_button()
function wiki_button() {
    return;
}

// update the realtime guy
async function updatePreview() {
    console.log("Typing...");
    let text = document.querySelector('.w_input');
    let wp   = document.querySelector('.w_preview');
    console.log(text);
    wp.innerHTML = marked.parse(text);
    return;
}

// setWiki()
function setWiki() {
    console.log('switching to wiki');

    let progGuts = document.querySelector('.program_board .program_guts');
    let main_container = document.createElement('div');
    main_container.classList.add('program_guts');
    main_container.innerHTML = `
        <p>
            hello world - Wiki
        </p>
        <p>\n</p>`;

    
    // Wiki editor container
    let w_editor = document.createElement('div');
    w_editor.classList.add("w_editor");

    // Wiki input page
    let w_input = document.createElement('div');
    w_input.classList.add("w_input");
    w_input.innerHTML = `
        <textarea id="input" class="inputWindow" placeholder="# MMm markdown" cols=50 rows=25 onkeyup="updatePreview()"></textarea>`;

    // Wiki preview/output Page
    let w_preview = document.createElement('div');
    w_preview.classList.add("w_preview");
    w_preview.innerHTML = `
        <p>
            This is text
        </p><br>`;

    // Bottom Menu buttons
    // [ Generate Files ] [ Clear Console ] [ Reset ]
    let bottomMenu = document.createElement("div");
    bottomMenu.classList.add('w_bottomMenu');
    bottomMenu.innerHTML = `
        <fieldset>
            <legend>
                Options: 
            </legend>
            <menu>
                <button id="run" onclick="wiki_button()"> 
                    Wiki Button </button>
                <button id="reset" onclick="setWiki()"> 
                    Reset </button>
            </menu>
        </fieldset>`;

    w_editor.appendChild(w_input);
    w_editor.appendChild(w_preview);

    main_container.appendChild(w_editor);
    main_container.appendChild(bottomMenu);
    progGuts.replaceWith(main_container);
    return;
}