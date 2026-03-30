/*
            _ _    _   _     
            (_) |  (_) (_)    
    __      ___| | ___   _ ___ 
    \ \ /\ / / | |/ / | | / __|
     \ V  V /| |   <| |_| \__ \
      \_/\_/ |_|_|\_\_(_) |___/
                     _/ |    
                    |__/     

    A wiki / knowledge base interface for the CTS team.
*/

// setWiki()
async function setWiki() {
    const menuItems = document.querySelectorAll(".menuItem");

    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

    document.title = "Wiki - Bronson";
    history.pushState("test", "Wiki", "/wiki");

    let current = document.getElementsByClassName("selected");
    if (current.length != 0) current[0].classList.remove("selected");

    let progGuts = document.querySelector('.program_board .program_guts');
    let main_container = document.createElement('div');
    main_container.classList.add('program_guts');
    

    /* -------------------- Wiki Page -------------------- */

    let w_toc = document.createElement("div");
    w_toc.classList.add('w_toc');

    let article_list_html = await getTocHTML();
    w_toc.innerHTML = article_list_html;

    main_container.appendChild(w_toc);
    progGuts.replaceWith(main_container);
}

async function getTocHTML() {
    let articles = await getW_BuildArticles();
    console.log(articles);

    let html = `
        <fieldset class='w_fieldset'>
            <legend class='w_legend'>
                Table of Contents:
            </legend>
            ${articles.map(article => `<p>${article}</p>`).join('')}
        </fieldset>
    `;
    
    return html;
}

/*
 __        _          _     
/ _|  ___ | |_   ___ | |__  
| |_  / _ \| __| / __|| '_ \ 
|  _||  __/| |_ | (__ | | | |
|_|   \___| \__| \___||_| |_|    
*/

async function getW_BuildArticles() {
    return await fetch('w_build', {
        method: 'POST',
        body: JSON.stringify({
            message: 'w_build'
        })
    })
    .then((response) => response.json())
    .then((json) => {
        return json.names;
    });
};