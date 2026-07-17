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

// update the realtime guy
async function updatePreview() {
    console.log("Typing...");
    let text = document.querySelector('.inputWindow');
    let wp   = document.querySelector('.w_preview');
    console.log(text);
    wp.innerHTML = marked.parse(text.value);
    return;
}

// setWiki()
async function setWiki() {
    const menuItems = document.querySelectorAll(".menuItem");

    menuItems.forEach(function(menuItem) {
      menuItem.addEventListener("click", toggleMenu);
    });

    document.title = "Wiki - Bronson";
    history.pushState("test", "Wiki", "/wiki");
    
    // remove currently active status mark tab has active.
    // Update active_tab_header
    // let active_tab_header = document.querySelector('.active_tab_header');
    // active_tab_header.innerHTML = 'Wiki';
    let current = document.getElementsByClassName("selected");
    console.log(current);
    if (current.length != 0) {
        // current[0].classList.remove("active");
        current[0].classList.remove("selected");
    }

    let progGuts = document.querySelector('.program_board .program_guts');
    let main_container = document.createElement('div');
    main_container.classList.add('program_guts');
    

    /* -------------------- Wiki Page -------------------- */

    let w_toc = document.createElement("div");
    w_toc.classList.add('w_toc');
    w_toc.id = "w_toc";

    let article_list_html = await getTocHTML();
    w_toc.innerHTML = article_list_html;

    //w_toc.innerHTML = await getTocHTML();
    w_toc.innerHTML = `  
            <fieldset class="w_fieldset" id="toc_fieldset">
            <legend class="w_legend"> 
                Table of Contents:
            </legend>
             </fieldset>
        `;
    let treeJSON =  JSON.parse(sessionStorage.getItem('wikiTree'));
   

    
    let w_viwer = document.createElement("div");
    w_viwer.classList.add('w_viwer');

    w_viwer.id = "w_viwer";

    let w_popup = document.createElement("div");
    w_popup.classList.add('w_popup');

    w_popup.id = "w_popup";
    w_popup.innerHTML = `
          <div id="wiki_modal" class="modal" style="display:none";>
          <fieldset class=pop_fieldset>
          <legend>Choose file </legend>
          <input id="newFile" type="file" class="wikiInput"></input>
          <button class="close" onClick="hidePopupHTML()">X</button> 
          <div class="modal_container">
          <button type="button" class="headButton" onclick="hidePopupHTML()">Cancel</button>
          <button class="submitButton" type="submit", onClick="submitFile(this)" style="float: right;">Submit</button>
          </div>
          </fieldset>
          </div>
    `;

    let wd_popup = document.createElement('div');
    wd_popup.classList.add('wd_popup');

    wd_popup.id = "wd_popup";
    wd_popup.innerHTML = `
       <div id="wiki_del_modal" class="modal" style="display:none";>
          <fieldset class=pop_fieldset_sm>
          <p> Are you sure you want to delete the selected element </p>
          <div class="modal_container">
          <button type="button" class="headButton" onclick="hideDeletePopup()">No</button>
          <button class="submitButton" type="submit", onClick="submitDelete(this)" style="float: right;">Yes</button>
          </div>
          </fieldset>
          </div>

    `;

    let wf_popup = document.createElement("div");
    wf_popup.classList.add('wf_popup');

    wf_popup.id = "wf_popup";
    wf_popup.innerHTML = `
          <div id="wiki_folder_modal" class="modal" style="display:none";>
          <fieldset class=pop_fieldset>
          <legend>New Directory </legend>
          <input id="newFolder" type="text" class="wikiInput"></input>
          <button class="close" onClick="hideDirPopup()">X</button> 
          <div class="modal_container">
          <button type="button" class="headButton" onclick="hideDirPopup()">Cancel</button>
          <button class="submitButton" type="submit", onClick="submitFolder(this)" style="float: right;">Submit</button>
          </div>
          </fieldset>
          </div>
    `;



    w_container.appendChild(w_toc);
    w_container.appendChild(w_viwer);
    w_container.appendChild(w_popup);
    w_container.appendChild(wd_popup);
    w_container.appendChild(wf_popup);
    main_container.appendChild(w_container);
    progGuts.replaceWith(main_container);
}

async function getTocHTML() {
    let default_html = `
        <fieldset class='w_fieldset'>
            <legend class='w_legend'>
                Articles: 
            </legend>
            <ul>
                <li> Item 1 </li>
                <li> Item 2 </li>
                <li> Item tmp </li>
                <li> Item 3 </li>
            </ul>
        </fieldset>`;

        if(isFile) { // Child is null
        buttonHTML = deleteButton(node);
        retHTML = ` 
          <div id ='${node.name}' data-isOpen="false">
           <p class="toc-item" onClick="clickableFiles('${node.file_path}')" data-path="${node.file_path}">${node.name}${(true) ? buttonHTML : " "}</p>
           </div>
        `;
        return retHTML; 

        } else if (node.children.length  === 0) {
             addButtonHTML = addFileButton(node);
             deleteButtonHTML = deleteButton(node);
             addFolderButtonHTML = addFolderButton(node);
             retHTML =  `
                <div id="${node.name}" data-isOpen="false" class="toc-folder"><p class="toc-item"
                onClick="clickableFiles('${node.file_path}')"
                data-path="${node.file_path}">${node.name} ${(true) ? addButtonHTML + deleteButtonHTML + addFolderButtonHTML : " "}</p>
                <div class="toc-children" style="margin-left: 20px; display:none;">${childHTML}</div>
                </div>
            `;
            return retHTML; 
            
        }else { // Directory with contents
            for (let child of node.children) {
                childHTML += dfs(child)
            }
            buttonHTML = addFileButton(node) + addFolderButton(node);
            retHTML =  `
                <div id="${node.name}" data-isOpen="false" class="toc-folder"><p class="toc-item"
                onClick="clickableFiles('${node.file_path}')"
                data-path="${node.file_path}">${node.name}${(true) ?  buttonHTML : " "}</p>
                <div class="toc-children" style="margin-left: 20px; display:none;">${childHTML}</div>
                </div>
            `;
            return retHTML; 
        }
    }

}


function clickableFiles(path) { // This is no longer a `this` element (it can be if needed, just use single-quotes), it is a string

    let treeJSON =  JSON.parse(sessionStorage.getItem('wikiTree'));
        
    if (!path) {
    return;
    }

    const node = findPath(treeJSON.tree, path);
   
    if(!node) {
        return;
    }

    if(Array.isArray(node.children)) {
        showDir(node, path);
    } else if (node.children === null){
        getWiki_File(path);
    } else {
        console.log("Something went wrong");
        return;
    }

    let w_viwer = document.getElementById("w_viwer");
}

function findPath(node, path) {
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

function showDir(node, path){
    let folderDiv = document.querySelector(`[data-path="${path}"]`).parentElement;
    let childDiv = folderDiv.querySelector(".toc-children");
    if(folderDiv.dataset.isopen ==="true"){
        childDiv.style.display="none";
        folderDiv.dataset.isopen="false";
       
    }else {
        childDiv.style.display="block";
        folderDiv.dataset.isopen="true";
    
    }

   
}

// Add Wikis Popup 
//------------------------------------------------------------------


function showWikiPopup(){
    document.getElementById('w_popup').style.display='block';
    document.getElementById('wiki_modal').style.display='block';
}

function hidePopupHTML(){
    document.getElementById('w_popup').style.display='none';
    document.getElementById('wiki_modal').style.display='none';

}

function showDeletePopup(){
    document.getElementById('wd_popup').style.display='block';
    document.getElementById('wiki_del_modal').style.display='block';
}

function hideDeletePopup(){
    document.getElementById('wd_popup').style.display='none';
    document.getElementById('wiki_del_modal').style.display='none';

}


function showFolderPopup(){
    document.getElementById('wf_popup').style.display='block';
    document.getElementById('wiki_folder_modal').style.display='block';
}

function hideDirPopup(){
    document.getElementById('wf_popup').style.display='none';
    document.getElementById('wiki_folder_modal').style.display='none';

}





function addFileButton(node){
   return `<button class="file-btn" id="${node.name}" data-path="${node.file_path}" onClick="uploadNewFile(this)">📄</button>`
}
function addFolderButton(node){
   return `<button class="folder-btn" id="${node.name}" data-path="${node.file_path}" onClick="uploadNewFolder(this)">📁</button>`
}

function deleteButton(node){
    return `<button class="delete-btn" id="${node.name}" data-path="${node.file_path}" onClick="deleteElement(this)">❌</button>`
}
// Article Viewer 
//-------------------------------------------------------------------

 async function getArticleHTML(blob, filename) {
   
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

// Table of Contents (ToC)
//-------------------------------------------------------------------


function renderToC(treeJSON) {
    let tocFieldset = document.getElementById("toc_fieldset"); 
    tocFieldset.innerHTML = `
        <legend> Table of Contents </legend>
        ${parseTreeToC(treeJSON.tree)}
    `;
    return;
}


function parseTreeToC(root) {
    if (!root) return;
    let buttonHTML = "";
    let addButtonHTML = "";
    let deleteButtonHTML = "";
    let addFileButtonHTML = "";
    let retHTML = "";
     for (let child of root.children) {
        retHTML += dfs(child)
     }
     return retHTML;
    
   
    function dfs(node){
        let buttonHTML = "";
        let childHTML = "";
        let isFile = node.children === null; 

        if(isFile) { // Child is null
        buttonHTML = deleteButton(node);
        retHTML = ` 
          <div id ='${node.name}' data-isOpen="false">
           <p class="toc-item" onClick="clickableFiles('${node.file_path}')" data-path="${node.file_path}">${node.name}${buttonHTML}</p>
           </div>
        `;
        return retHTML; 

        } else if (node.children.length  === 0) {
             addButtonHTML = addFileButton(node);
             deleteButtonHTML = deleteButton(node);
             addFolderButtonHTML = addFolderButton(node);
             retHTML =  `
                <div id="${node.name}" data-isOpen="false" class="toc-folder"><p class="toc-item"
                onClick="clickableFiles('${node.file_path}')"
                data-path="${node.file_path}">${node.name}${addButtonHTML}${addFolderButtonHTML}${deleteButtonHTML}</p>
                <div class="toc-children" style="margin-left: 20px; display:none;">${childHTML}</div>
                </div>
            `;
            return retHTML; 
            
        }else { // Directory with contents
            for (let child of node.children) {
                childHTML += dfs(child)
            }
            buttonHTML = addFileButton(node) + addFolderButton(node);
            retHTML =  `
                <div id="${node.name}" data-isOpen="false" class="toc-folder"><p class="toc-item"
                onClick="clickableFiles('${node.file_path}')"
                data-path="${node.file_path}">${node.name}${buttonHTML}</p>
                <div class="toc-children" style="margin-left: 20px; display:none;">${childHTML}</div>
                </div>
            `;
            return retHTML; 
        }
    }

}


function clickableFiles(path) { // This is no longer a `this` element (it can be if needed, just use single-quotes), it is a string

    let treeJSON =  JSON.parse(sessionStorage.getItem('wikiTree'));
        
    if (!path) {
    return;
    }

    const node = findPath(treeJSON.tree, path);
   
    if(!node) {
        return;
    }

    if(Array.isArray(node.children)) {
        showDir(node, path);
    } else if (node.children === null){
        getWiki_File(path);
    } else {
        console.log("Something went wrong");
        return;
    }

    let w_viwer = document.getElementById("w_viwer");
}

function findPath(node, path) {
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

function showDir(node, path){
    let folderDiv = document.querySelector(`[data-path="${path}"]`).parentElement;
    let childDiv = folderDiv.querySelector(".toc-children");
    if(folderDiv.dataset.isopen ==="true"){
        childDiv.style.display="none";
        folderDiv.dataset.isopen="false";
       
    }else {
        childDiv.style.display="block";
        folderDiv.dataset.isopen="true";
    
    }

   
}

// Add Wikis Popup 
//------------------------------------------------------------------


function showWikiPopup(){
    document.getElementById('w_popup').style.display='block';
    document.getElementById('wiki_modal').style.display='block';
}

function hidePopupHTML(){
    document.getElementById('w_popup').style.display='none';
    document.getElementById('wiki_modal').style.display='none';

}

function showDeletePopup(){
    document.getElementById('wd_popup').style.display='block';
    document.getElementById('wiki_del_modal').style.display='block';
}

function hideDeletePopup(){
    document.getElementById('wd_popup').style.display='none';
    document.getElementById('wiki_del_modal').style.display='none';

}


function showFolderPopup(){
    document.getElementById('wf_popup').style.display='block';
    document.getElementById('wiki_folder_modal').style.display='block';
}

function hideDirPopup(){
    document.getElementById('wf_popup').style.display='none';
    document.getElementById('wiki_folder_modal').style.display='none';

}





function addFileButton(node){
   return `<button class="file-btn" id=${node.name} data-path="${node.file_path}" onClick="uploadNewFile(this)">📄</button>`
}
function addFolderButton(node){
   return `<button class="folder-btn" id=${node.name} data-path="${node.file_path}" onClick="uploadNewFolder(this)">📁</button>`
}

function deleteButton(node){
    return `<button class="delete-btn" id=${node.name} data-path="${node.file_path}" onClick="deleteElement(this)">❌</button>`
}
// Article Viewer 
//-------------------------------------------------------------------

 async function getArticleHTML(blob, filename) {
   
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

// getW_BuildArticles()
//    "w_build"
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
