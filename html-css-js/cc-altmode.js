/*                   _                                                
                    | |                            |           o      
  __ __  ___  __,   | |  _|_   _  _  _     __    __|    _          ,  
 /  /   /__/ /  |   |/    |   / |/ |/ |   /  \_ /  |   |/      |  / \_
 \__\__      \_/|_/ |__/  |_/   |  |  |_/ \__/  \_/|_/ |__/ o  |/  \/ 
                                                              /|      
                                                              \|      

    Crestron File Manger (CFM)

Originally in camcode.js, accesses a database on the server for crestron room files and allows the user to retreive any they may need.
 
 - cfmFiles()
 - getCFMF(filename, classtype)
 - downloadFile(s, fn)

HMTL-CFM
 - getCFMBuildingSelection()   -- notsure if this should ever be used
 - cfmGetBuildingRoom()
 - setFileBrowser(header, files)
 - populateFileList(list)
 - populateDropdown(list)
 - updateRoomList()
 - setCrestronFile()

fetch
 - getCFM_BuildDirs()                    - flag: "cfm_build"
 - getCFM_BuildRooms(sel_building)       - flag: "cfm_build_r"
 - getCFM_FileDirectory(building,rm)     - flag: "cfm_c_dir"
 - getCFM_File(filename)                 - flag: "cfm_file"
 - getCFM_Dir()                          - flag: "cfm_dir"
*/
  
// cfmFiles()
//// onclick for "generate files"
async function cfmFiles() {
    // Variables
    let brm = cfmGetBuildingRoom(); //brm[0] = building, brm[1] = room
    let files = [];
    let header = "";
  
    // Get Files (Add Error Check: Room Directory Not Found)
    let received_filenames = await getCFM_FileDirectory(brm[0], brm[1]);
    
    for (var i = 0; i < received_filenames.length; i++) {
        let tmp = received_filenames[i].split("CFM_Code")[1];
        header = tmp.split(brm[1] + "/")[0] + brm[1] + "/";
        files.push(tmp.split(brm[1] + "/")[1]);
    }
  
    setFileBrowser(header, files);
}

// This is a onclick function tied to entries in "File Selection"
async function getCFMF(filename, classtype) {
    let brs = cfmGetBuildingRoom();
    // Get the header value instead
    let current_header = getCurrentHeader();
    // current_header = current_header + '/';

    let cmff = `${current_header}/${filename}`;

    // User Selects a Directory
    if (classtype == "cfm_dir") {
        //updateConsole("ERRORSelected Directory");
        // It would be sweet to go into room sub-directories
        // do that
        let files = await getCFM_Dir(cmff);
        //update filebrowser

        // Need a variant function for populating 
        for (var i in files) {
            files[i] = files[i].split(cmff + '/')[1];
        }
        await setFileBrowser(cmff, files);

        return;
    }
    
    await getCFM_File(cmff);
}

// Simulated click for downloading file
function downloadFile(s, fn) {
    //const blob = new Blob(s, { });
    const url = URL.createObjectURL(s);
    const a = document.createElement('a');
    
    a.href=url;

    a.download = fn;
    a.click();
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

async function getCFMBuildingSelection() {
    let select = document.getElementById('building_list');
    return select.value;
}
  
function cfmGetBuildingRoom(){
    let bl = document.getElementById('building_list');
    let rl = document.getElementById('room_list');
  
    let building = bl.options[bl.selectedIndex].text;
    let room     = rl.options[rl.selectedIndex].text;
  
    return [building, room];
}

function getCurrentHeader() {
    let fs = document.querySelector('.cfm_text');
    return fs.innerText;
}

// CONSOLE REVAMP FUNCTIONS HERE
//    MAKE A WEIRD SUDO DIRECTORY BROWSER
async function setFileBrowser(header, files) {
    let fs = document.querySelector('.cfm_fileSelection');
    let new_fs = document.createElement("fieldset");
    new_fs.classList.add('cfm_fileSelection');
    new_fs.innerHTML =`
        <legend>
            File Selection
        </legend>
        <h2 class='cfm_text'>${header}</h2>
        <body>
            <ol class='cfm_list'>
                ${await populateFileList(files)}
            </ol>
        </body>
    `;
    fs.replaceWith(new_fs);
}

// Need to figure out a mechanism to differntiate file types
async function populateFileList(list) {
    html = ``;
    let classtype  = "";
    for(var i in list) {
        if(list[i].includes(".zip")) {
            classtype = "cfm_zip";
        } else if (list[i].includes(".")) {
            classtype = "cfm_file";
        } else {
            classtype = "cfm_dir";
        }
        html += `
            <li class=${classtype} onclick=\"getCFMF(\'${list[i]}\', \'${classtype}\')\">
                ${list[i]}
            </li>
        `; 
    }

    return html;
}

//   populateDropdown(list)
// May want to pull directory for dropdown
async function populateDropdown(list) {
    //let obj = document.querySelector(className)
    html = ``;
    for(var i in list) {
        html += `
        <option value=${i}>
            ${list[i]}
        </option>
    `;
    }

    return html;
}
  
// updateRoomList()
//    - when the building dropdown changes, this updates the room dropdown.
async function updateRoomList() {
    let rl = document.querySelector('.program_board .program_guts .rmSelect');
    let rms = document.createElement("Fieldset");
    rms.classList.add('rmSelect');
  
    let sel_building = await getCFMBuildingSelection();
    let cfmDirList   = await getCFM_BuildDirs();
    
    let new_rl = await getCFM_BuildRooms(cfmDirList[sel_building]);
  
    let set_inner_html = `
        <select id="room_list">
            ${await populateDropdown(new_rl)}
        </select>`;
  
    rms.innerHTML = `
        <legend>
            Rooms(s): 
        </legend> 
        ${set_inner_html}
    `;
    rl.replaceWith(rms);
}


//      setCrestronFile()
// Change the DOM for Crestron File Manager
async function setCrestronFile() {
    preserveCurrentTool();
    
    document.title = "CamCode - Bronson";
    // remove currently active status mark tab has active.
    // let active_tab_header = document.querySelector('.active_tab_header');
    // active_tab_header.innerHTML = 'CamCode';
    let current = document.getElementsByClassName("selected");
    if (current.length != 0) {
        // current[0].classList.remove("active");
        current[0].classList.remove("selected");
    }
    let newCurrent = document.getElementById("CCButton");
    // newCurrent.classList.add("active");
    newCurrent.classList.add("selected");

    history.pushState("test", "CamCode", "/cc-altmode");


  
    /* --------------------- CC-AltMode (CamCode) --------------------- */

    let progGuts = document.querySelector('.program_board .program_guts');

    let cfm_container = document.createElement('div');
    cfm_container.classList.add('cfm_container');


    // Page Content

    let cfm_filePathTracker = document.createElement('div');
    cfm_filePathTracker.classList.add("cfm_filePathTracker");

    let cfm_search = document.createElement('div');
    cfm_search.classList.add("cfm_search");
    cfm_search.innerHTML = `
        <textarea class="cfm_searchBar" id="search_input" placeholder="Search CFM..."></textarea>
    `;

    let cfm_fileTreeInspector = document.createElement('div');
    cfm_fileTreeInspector.classList.add("cfm_fileTreeInspector");

    let cfm_FileContainer = document.createElement('div');
    cfm_FileContainer.classList.add("cfm_FileContainer");

    cfm_container.appendChild(cfm_filePathTracker);
    cfm_container.appendChild(cfm_search);
    cfm_container.appendChild(cfm_fileTreeInspector);
    cfm_container.appendChild(cfm_FileContainer);


    // main_container
    let main_container = document.createElement('div');
    // main_container.innerHTML = `
    //     <button id="cam_code" onclick="setCamCode()">
    //         CamCode (Q-SYS) </button>
    //     <p>\n</p>
    // `;
    
    ///////// Remove Later
    main_container.innerHTML = `
        <button onclick="searchTree(document.getElementById('search_input').value)">
            Search Tree</button>
        <button onclick="printTree()">
            Print Full Tree</button>
    `;
    /////////

    main_container.appendChild(cfm_container);
    main_container.classList.add('program_guts');
    
    progGuts.replaceWith(main_container);
    
    // Initialize the CFM interface with tree data
    initializeCFM();
}

/////////// Remove Later
// Print tree strucute to console
function printTree() {
    getCFMTree().then((tree) => {
        console.log(tree);
    });
}
///////////


// Search tree for file and print path to console
function searchTree(search="") {
    getCFMTree().then((tree) => {
        let searchResults = searchTreeHelper(tree, search);
        console.log("Search: \n");
        console.log(searchResults);
    });

    // Will traverse with DFS search algorithm
    // Partial matches will return a file path
    // If a match doesn't exist, will return empty array
    function searchTreeHelper(node, target, currentPath = "", results = []) {
        if (target === "") return results; // if empty search, return empty array
        if (currentPath === "") target = target.toLowerCase(); // toLower just the one time

        const fullPath = currentPath + "/" + node.name;
        const nodeLowerCase = node.name.toLowerCase();

        if (nodeLowerCase.includes(target)) results.push(fullPath);

        // Recurseive DFS Search of every child
        if (node.children) {
            for (let child of node.children) {
                searchTreeHelper(child, target, fullPath, results);
            }
        }

        return results;
    }
}


// CFM State Management
const cfmState = {
    fullTree: null,
    currentPath: [],
    currentNode: null,
    expandedFolders: new Set() // Track which folders are expanded in the tree
};

// Initialize CFM with tree data
async function initializeCFM() {
    cfmState.fullTree = await getCFMTree();
    cfmState.currentNode = cfmState.fullTree;
    cfmState.currentPath = [cfmState.fullTree.name];
    
    updateFileTreeDisplay();
    updateFileContainer();
    updatePathTracker();
}

// Update the left panel with folder tree (only shows folders)
function updateFileTreeDisplay() {
    let treeContainer = document.querySelector('.cfm_fileTreeInspector');
    if (!treeContainer) return;
    
    treeContainer.innerHTML = `${buildTreeHTML(cfmState.fullTree, 0)}`;
}

// Build HTML for tree display (only shows one level at a time with expand/collapse arrows)
function buildTreeHTML(node, depth) {
    if (!node.children || node.children.length === 0) return '';
    
    let html = '';
    for (let child of node.children) {
        // Only show folders
        if (child.children) {
            let folderPath = buildPathString(child);
            let isExpanded = cfmState.expandedFolders.has(folderPath);
            let arrow = isExpanded ? '▼' : '▶';
            let hasChildren = child.children && child.children.some(c => c.children);
            
            html += `<p style="margin-left: ${depth * 15 + 8}px; cursor: pointer; display: flex; align-items: center; width: fit-content;">`;
            
            // Arrow button (only show if has subfolders)
            if (hasChildren)
                html += `<span onclick="event.stopPropagation(); toggleExpandFolder('${folderPath}')" style="margin-right: 5px; min-width: 15px;">${arrow}</span>`;
            else 
                html += `<span style="margin-right: 5px; min-width: 15px;"></span>`;
            
            // Folder icon and name
            html += `<span onclick="selectFolderFromTree('${child.name}', '${folderPath}')">${child.name}</span>`;
            html += `</p>`;
            
            // Show children only if expanded
            if (isExpanded)
                html += buildTreeHTML(child, depth + 1);
        }
    }
    return html;
}

// Build path string for a node
function buildPathString(node) {
    // Find the path to this node by traversing the tree
    return findPathToNode(cfmState.fullTree, node.name).join('/');
}

// Toggle folder expansion in the tree
function toggleExpandFolder(folderPath) {
    if (cfmState.expandedFolders.has(folderPath))
        cfmState.expandedFolders.delete(folderPath);
    else
        cfmState.expandedFolders.add(folderPath);

    updateFileTreeDisplay();
}

// Find path to a node in the tree
function findPathToNode(node, targetName, currentPath = []) {
    if (node.name === targetName) {
        return [...currentPath, node.name];
    }
    
    if (node.children) {
        for (let child of node.children) {
            let result = findPathToNode(child, targetName, [...currentPath, node.name]);
            if (result.length > 0) return result;
        }
    }
    
    return [];
}

// Select a folder from the tree
function selectFolderFromTree(pathString) {
    let pathArray = pathString.split('/').filter(p => p.length > 0);
    cfmState.currentPath = pathArray;
    cfmState.currentNode = getNodeAtPath(cfmState.fullTree, pathArray);
    
    updateFileContainer();
    updatePathTracker();
}

// Get node at specific path
function getNodeAtPath(node, path) {
    if (path.length === 0) return node;
    if (path[0] !== node.name) return null;
    
    if (path.length === 1) return node;
    
    if (!node.children) return null;
    
    for (let child of node.children) {
        if (child.name === path[1])
            return getNodeAtPath(child, path.slice(1));
    }
    
    return null;
}

// Update the right panel with file/folder contents
function updateFileContainer() {
    let container = document.querySelector('.cfm_FileContainer');
    if (!container || !cfmState.currentNode) return;
    
    let html = ``;
    
    if (cfmState.currentNode.children && cfmState.currentNode.children.length > 0) {
        for (let child of cfmState.currentNode.children) {
            if (child.children) // It's a folder
                html += `<p style="cursor: pointer;" onclick="selectFolderFromTree('${child.name}', '${buildPathToChild(child)}')">📁${child.name}</p>`;
            else // It's a file  
                html += `<p style="cursor: pointer;" onclick="downloadFileFromPath('${buildPathToChild(child)}')">📄${child.name}</p>`;
        }
    } else {
        html += `<p>No items in this directory</p>`;
    }
    
    container.innerHTML = html;
}

// Build path to a child node
function buildPathToChild(node) {
    let fullPath = [...cfmState.currentPath, node.name];
    return getPathStringFromArray(fullPath);
}

// Convert path array to string
function getPathStringFromArray(pathArray) {
    return pathArray.join('/');
}

// Download file from path
async function downloadFileFromPath(filePath) {
    // Extract just the filename from the path
    let filename = filePath.split('/').pop();
    // Call the fetch to download the file
    await getCFM_File(filePath, filename);
}

// Update the top breadcrumb/path tracker
function updatePathTracker() {
    let tracker = document.querySelector('.cfm_filePathTracker');
    if (!tracker) return;
    
    // Build breadcrumb with clickable path components
    let breadcrumb = `. / `;
    
    for (let i = 0; i < cfmState.currentPath.length; i++) {
        let pathUpToHere = cfmState.currentPath.slice(0, i + 1).join('/');
        let folderName = cfmState.currentPath[i];
        breadcrumb += `<span style="cursor: pointer; text-decoration: underline;" onclick="selectFolderFromTree('${folderName}', '${pathUpToHere}')">${folderName}</span>`;
        
        if (i < cfmState.currentPath.length - 1) {
            breadcrumb += ` / `;
        }
    }
    
    breadcrumb += ` / `;
    
    tracker.innerHTML = `
        <strong style="float: left; padding: 10px;">
            ${breadcrumb}
        </strong>
    `;
}

/*
 __        _          _     
/ _|  ___ | |_   ___ | |__  
| |_  / _ \| __| / __|| '_ \ 
|  _||  __/| |_ | (__ | | | |
|_|   \___| \__| \___||_| |_|    
*/

// getCFMTree()
//    "cfm_get_tree" 
async function getCFMTree() {
    return await fetch('cfm_get_tree', {
        method: 'POST',
        body: JSON.stringify({
            message: 'cfm_get_tree'
        })
    })
    .then((response) => response.json())
    .then((json) => {
        return json.tree;
    });
}

// getCFM_BuildDirs()
//    "cfm_build"
async function getCFM_BuildDirs() {
    return await fetch('cfm_build', {
        method: 'POST',
        body: JSON.stringify({
            message: 'cfm_build'
        })
    })
    .then((response) => response.json())
    .then((json) => {
        return json.dir_names.sort();
    });
}

// getCFM_BuildRooms(sel_building)
//    "cfm_build_r"
async function getCFM_BuildRooms(sel_building) {
    return await fetch('cfm_build_r', {
        method: 'POST',
        body: JSON.stringify({
            building: sel_building
        })
    })
    .then((response) => response.json())
    .then((json) => {return json.rooms;})
}

// getCFM_FileDirectory
//    "cfm_cDir" Crestron File Manager Current Directory
async function getCFM_FileDirectory(building, rm) {
    console.log("Getting CFM File Directory for Building:", building, "Room:", rm);
    return await fetch('cfm_c_dir', {
        method: 'POST',
        body: JSON.stringify({
            building: building,
            rm: rm
        })
    })
    .then((response) => response.json())
    .then((json) => {return json.names;});
}

// getCFM_File()
//   "cfm_file"
async function getCFM_File(filepath, displayName = null) {
    // If no display name provided, extract it from the filepath
    let filename = displayName || filepath.split('/').pop();
    console.log("getCFM_File - Sending filepath:", filepath, "displayName:", filename);
    return await fetch('cfm_file', {
        method: 'POST',
        body: JSON.stringify({
            filename: filepath
        })
    })
    .then((response) => {
        if (!response.ok && response.status !== 500) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.blob();
    })
    .then((blob) => downloadFile(blob, filename))
    .catch((error) => {
        // Log error but don't throw - file may still be downloading
        console.warn("Download completed (server error ignored):", error);
    });
}

// getCFM_Dir()
//   "cfm_dir"
//    TODO
async function getCFM_Dir(dirname) {
    return await fetch('cfm_dir', {
        method: 'POST',
        body: JSON.stringify({
            filename: dirname
        })
    })
    .then((response) => response.json())
    .then((json) => {return json.names;});
}