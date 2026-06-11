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

// setWiki() sets up container 
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

    setListeners();
    //hideTerminal();
    // await getW_tree();
    // var tree = JSON.parse(sessionStorage.getItem("wikiTree"));
    // console.log(tree);
    // var filepaths = getFilepaths(tree);
    // console.log("Should show filepaths", filepaths);


    let w_container = document.createElement('div');
    w_container.classList.add('w_container');


    let w_toc = document.createElement("div");
    w_toc.classList.add('w_toc');

    w_toc.innerHTML = await getTocHTML();

    let w_viwer = document.createElement("div");
    w_viwer.classList.add('w_viwer');

    w_viwer.id = "w_viwer";

    w_viwer.innerHTML =  getArticleHTML("Admin Users.txt");

    w_container.appendChild(w_toc);
    w_container.appendChild(w_viwer); 
    main_container.appendChild(w_container);
    progGuts.replaceWith(main_container); 
}

// function getFilepaths(node, currentPath = "", results = []) {
//     const newPath = currentPath ? `${currentPath}/${node.name}`: node.name;
//     // If leaf save path 
//     if (!node.children || node.children.length === 0) {
//         results.push(newPath);
//         return results;
//     }

//     for (const child of node.children){
//         getFilepaths(child, newPath, results);
//     }

//     return results;
// }

async function getTocHTML() { // toC Tabel of Contents
    let articles = await getW_BuildArticles();
   // let articles = await getW_file();
   console.log(articles);

    let html = `
       
        <fieldset class="w_fieldset">
            <legend class="w_legend"> 
                Table of Contents:
            </legend>
             <div class ="scrollToc"> 
             ${Object.keys(articles).map(article => `<p class="toc-item" data-name="${article}">${article}</p>`).join('')} 

             </div>
        </fieldset>
    `;


    return html;
}

 function setListeners() {
     document.addEventListener('click', (e) => {
        let target = e.target.closest('.toc-item'); 
        if (!target) return;
        
        const filename = target.dataset.name;

        new_read = getArticleHTML(filename);

        let w_viwer = document.getElementById("w_viwer");

        w_viwer.innerHTML = new_read;

        console.log("Clicked", filename);
        console.log("Content:", new_read);
    });
}



 function getArticleHTML(filename) {
    let articles = JSON.parse(sessionStorage.getItem("wikiArticles"));

    if (filename.endsWith('.md')){
        let encoded = (articles[filename]);
        const u8arr = Uint8Array.fromBase64(encoded);
        const textdecoder = new TextDecoder('utf-8');
        let decodedtext = textdecoder.decode(u8arr);
    
        
        let md = decodedtext;
        var parsed_md = marked.parse(md);
        let html = `
            <fieldset class="wA_fieldset">
                <legend class='w_legend'> 
                    ${filename}
                </legend> 
                <div class = "scrollArt"> 
                <pre>${parsed_md} </pre>
                </div>

            </fieldset>
            
        `;
        return html; 
        
    } else if (filename.endsWith('.pdf')){
        let pdf_file = articles[filename];
        console.log("This should be base64",pdf_file)
        let html = `
            <fieldset class="wA_fieldset">
                <legend class='w_legend'> 
                    ${filename}
                </legend> 
                <div class = "scrollArt"> 
                <iframe width="1000px" height="1200px" src="data:application/pdf;base64, ${pdf_file}"></iframe>
                </div>

            </fieldset>
            
        `;
         return html; 
    } else {
        let encoded = (articles[filename]);
        const u8arr = Uint8Array.fromBase64(encoded);
        const textdecoder = new TextDecoder('utf-8');
        let decodedtext = textdecoder.decode(u8arr);
        let html = `
            <fieldset class="wA_fieldset">
                <legend class='w_legend'> 
                    ${filename}
                </legend> 
                <div class = "scrollArt"> 
                <pre>${decodedtext}</pre>
                </div>

            </fieldset>
            
        `;
        return html; 

    }

    
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
        sessionStorage.setItem("wikiArticles", JSON.stringify(json));
        return json;
    });
};


// async function getW_tree(){
//     return await fetch('w_build_tree', {
//         method: 'POST',
//         body: JSON.stringify({
//             message: 'w_build_tree'
//         })
//     })

//     .then((response) => response.json())
//     .then((json) => {
//         sessionStorage.setItem("wikiTree", JSON.stringify(json));
//         return json;
//     });

// };


// async function getW_file(){
//     return await fetch('w_file', {
//         method: 'POST',
//         body: JSON.stringify({
//             message: 'w_file'
//         })
//     })

//     .then((response) => response.json())
//     .then((json) => {
//         sessionStorage.setItem("wikiFile", JSON.stringify(json));
//         return json;
//     });



// async function getW_file(filepath, displayName = null) {
//     // If no display name provided, extract it from the filepath
//     let filename = displayName || filepath.split('/').pop();
//     console.log("getW_File - Sending filepath:", filepath, "displayName:", filename);
//     return await fetch('w_file', {
//         method: 'POST',
//         body: JSON.stringify({
//             filename: filepath,
//             message: 'w_file'
//         })
//     })
//     .then((response) => {
//         if (!response.ok && response.status !== 500) {
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
//         return response.blob();
//     })
//     .then((response) => response.json())
//      .then((json) => {
//         sessionStorage.setItem("wikiFile", JSON.stringify(json));
//        return json;
//     });

//  }