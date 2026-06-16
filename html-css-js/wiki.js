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

     await getW_tree();
    let defult_wiki = "/home/rkilduff/Desktop/bronson_online/data/wiki_articles/BronsonWiki.pdf"
    getWiki_File(defult_wiki);

    let w_container = document.createElement('div');
    w_container.classList.add('w_container');


    let w_toc = document.createElement("div");
    w_toc.classList.add('w_toc');

    w_toc.innerHTML = await getTocHTML();

    let w_viwer = document.createElement("div");
    w_viwer.classList.add('w_viwer');

    w_viwer.id = "w_viwer";

    //w_viwer.innerHTML =  getArticleHTML("Admin Users.txt");

    w_container.appendChild(w_toc);
    w_container.appendChild(w_viwer); 
    main_container.appendChild(w_container);
    progGuts.replaceWith(main_container); 
}

async function getTocHTML() { // toC Tabel of Contents
    //let filenames = filepaths;
   // let articles = await getW_file();
   //console.log(articles);
   let treeJSON =  JSON.parse(sessionStorage.getItem('wikiTree'));
   

    let html = `
       
        <fieldset class="w_fieldset">
            <legend class="w_legend"> 
                Table of Contents:
            </legend>
             <div class ="scrollToc"> 
             ${treeJSON.tree.children.map(child => `<p class="toc-item" onClick="clickable(this)" data-path="${child.file_path}" data-isOpen="false">${child.name}</p>`).join('')}
             </div>
        </fieldset>
    `;

    return html;
}

function clickable(target){
    let treeJSON =  JSON.parse(sessionStorage.getItem('wikiTree'));
        
     if (!target) {
        console.log("Target not found returning");
        return;
     }
  
        const path = target.dataset.path;
        console.log("Path:", path)

        const node = findPath(treeJSON.tree, path);
        console.log("Node",node);

        if(!node) {
            console.log("No node found at given path", path);
            return;
        }

        if(Array.isArray(node.children)) {
            console.log("Clicked Dir", node.name);
            showDir(node, target);
        } else if (node.children === null){
            console.log("Clicked file", node.name);
            // Load content when I figure out how to do that
            getWiki_File(path);
            return;
       } else {
        console.log("Something went wrong");
        return;
       }

        let w_viwer = document.getElementById("w_viwer");
}

function findPath(node, path){
    if(node.file_path === path) return node;

    if(Array.isArray(node.children)){
        for (const child of node.children) {
            const found = findPath(child, path);
            if (found) return found;
        }
    }

    //Else 
    return null;
 }

function showDir(node, targetElement){
    console.log("showDir Reached");

    if(targetElement.getAttribute("data-isOpen") === "true") {
        targetElement.setAttribute("data-isOpen", "false");
        closeDir(targetElement);
        return;
    }

    let html = `
     <div id="scrollDir" class ="scrollDir"> 
     ${node.children.map(child => `<p class="toc-item", onClick="clickable(this)" data-path="${child.file_path}" data-isOpen="false">${child.name}</p>`).join('')} </div>
    `;
    targetElement.setAttribute("data-isOpen", "true");
    return targetElement.insertAdjacentHTML('afterend', html, true);
}

function closeDir(targetElement){
    const scrollDir = targetElement.nextElementSibling;

    if (scrollDir && scrollDir.id === "scrollDir"){
        scrollDir.remove();
    }
}

 async function getArticleHTML(blob, filename) {
    // let articles = JSON.parse(sessionStorage.getItem("wikiArticles"));
    console.log("BLOB:", blob, "FILENAME:", filename);
   
    if (filename.endsWith('.md')){
        
        let parsed_md = "";
        let md = await blob.text();
        parsed_md = marked.parse(md);
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
        w_viwer.innerHTML = html;
        return;
        
    } else if (filename.endsWith('.pdf')){
        // let pdf_file = articles[filename];
        // console.log("This should be base64",pdf_file)
        let raw_blob = await blob;
        let pdf_blob = new Blob([raw_blob], {type: "application/pdf"});
        const blobUrl = URL.createObjectURL(pdf_blob); 

        let html = `
            <fieldset class="wA_fieldset">
                <legend class='w_legend'> 
                    ${filename}
                </legend> 
                <div class = "scrollArt"> 
                <iframe width="1000px" height="1200px" src="${blobUrl}"></iframe>
                </div>

            </fieldset>
            
        `;
        w_viwer.innerHTML = html;
         return; 
    } else {
        let text = await blob.text();
        // let text_blob = new Blob([raw_blob], {type: "text/plain"});
        // const blobUrl = URL.createObjectURL(text_blob); 
       
        let html = `
            <fieldset class="wA_fieldset">
                <legend class='w_legend'> 
                    ${filename}
                </legend> 
                <div class = "scrollArt"> 
                <pre class="plain-text">${text}<pre>
                </div>

            </fieldset>
            
        `;
         w_viwer.innerHTML = html;
        return; 

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


async function getW_tree(){
    return await fetch('w_build_tree', {
        method: 'POST',
        body: JSON.stringify({
            message: 'w_build_tree'
        })
    })

    .then((response) => response.json())
    .then((json) => {
        sessionStorage.setItem("wikiTree", JSON.stringify(json));
        return json;
    });

};

async function getWiki_File(filepath) {
    console.log("First instance of filepath:", filepath);
    // If no display name provided, extract it from the filepath
    let filename = filepath.split('/').pop();
    let relativePath = filepath.split('wiki_articles').pop();
    console.log("Relative Path is:", relativePath);
    console.log("getWiki_File - Sending filepath:", filepath, "filename", filename);
    return await fetch('w_file', {
        method: 'POST',
        body: JSON.stringify({
            filename: relativePath
        })
    })
    .then((response) => {
        if (!response.ok && response.status !== 500) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.blob();
    })
    .then((blob) => getArticleHTML(blob, filename))
    .catch((error) => {
        // Log error but don't throw - file may still be downloading
        console.warn("Download completed (server error ignored):", error);
    });
}



