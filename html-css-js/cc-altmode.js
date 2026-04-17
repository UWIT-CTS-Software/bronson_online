/*                   _                                                
                    | |                            |           o      
  __ __  ___  __,   | |  _|_   _  _  _     __    __|    _          ,  
 /  /   /__/ /  |   |/    |   / |/ |/ |   /  \_ /  |   |/      |  / \_
 \__\__      \_/|_/ |__/  |_/   |  |  |_/ \__/  \_/|_/ |__/ o  |/  \/ 
                                                              /|      
                                                              \|      

    Crestron File Manager (CFM)

Originally in camcode.js, accesses a database on the server for crestron 
room files and allows the user to retreive any they may need.

 - setCrestronFile()          - Initialize the CFM interface
 - initializeCFM()            - Initialize with tree data
 - searchTree(search)         - Search and filter files by keyword

HMTL-CFM
 - selectFolderFromTree(pathString) - Navigate to a folder
 - updateFileTreeDisplay()          - Update folder tree panel
 - updateFileContainer()            - Update file list panel
 - updatePathTracker()              - Update breadcrumb path
 - controlButton(button)            - Handle navigation buttons

fetch
 - downloadFileFromPath(filePath)   - Download a file
 - getCFM_File(filepath)            - Fetch file from server
*/

// CFM State Management - Global State Controller
const cfmState = {
    fullTree: null,
    currentPath: [],
    currentNavIndex: 0,
    currentNode: null,
    expandedFolders: new Set() // Track which folders are expanded in the tree
};

  
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

    let cmff = `${current_header}/${filename}`;

    // User Selects a Directory
    if (classtype == "cfm_dir") {
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
        if(list[i].includes(".zip")) 
            classtype = "cfm_zip";
        else if (list[i].includes(".")) 
            classtype = "cfm_file";
        else 
            classtype = "cfm_dir";
        
        html += `
            <li class=${classtype} onclick=\"getCFMF(\'${list[i]}\', \'${classtype}\')\">
                ${list[i]}
            </li>
        `; 
    }

    return html;
}


// Buttons for file browser (back, forward, home, etc...)
function controlButton(button) {
    if (button === "home")
        initializeCFM();
    else if (button === "collapsible") 
        collapseAllFolders();
    else if (button === "back")
        navigateFolderHistory(-1);
    else if (button === "forward")
        navigateFolderHistory(1);
}

// Collapse all folders in left inspector panel
function collapseAllFolders() {
    cfmState.expandedFolders.clear();
    updateFileTreeDisplay();
}

let navStack = ["CamCode"]; // / CamCode / will always be root
cfmState.currentNavIndex = 0; 
function navigateFolderHistory(direction=0) {
    if (direction === -1) { // traverse backwards in stack
        if (cfmState.currentNavIndex <= 0) return; // at bottom, do nothing

        cfmState.currentNavIndex--;

        const path = navStack[cfmState.currentNavIndex];

        // load previous path
        cfmState.currentPath = Array.isArray(path) ? [...path] : [path];
        cfmState.currentNode = getNodeAtPath(cfmState.fullTree, cfmState.currentPath);
        updateFileContainer();
        updatePathTracker();
    }
    else if (direction === 1) { // traverse forwards in stack
        if (cfmState.currentNavIndex >= navStack.length - 1) return; // at top, do nothing

        cfmState.currentNavIndex++;

        const path = navStack[cfmState.currentNavIndex];

        // load next path
        cfmState.currentPath = Array.isArray(path) ? [...path] : [path];
        cfmState.currentNode = getNodeAtPath(cfmState.fullTree, cfmState.currentPath);
        updateFileContainer();
        updatePathTracker();
    }
    else if (direction === 0) { // normal navigation
        // Discard all "forward history"
        navStack = navStack.slice(0, cfmState.currentNavIndex + 1);

        // push new path
        const newPath = [...cfmState.currentPath];
        navStack.push(newPath);
        cfmState.currentNavIndex = navStack.length - 1;
    }

    // Failsafe: Never let stack be empty
    if (navStack.length === 0) {
        navStack.push("CamCode"); 
        cfmState.currentNavIndex = 0;
    }
}


//      setCrestronFile()
// Change the DOM for Crestron File Manager
async function setCrestronFile() {
    preserveCurrentTool();
    
    document.title = "CamCode - Bronson";

    let current = document.getElementsByClassName("selected");
    if (current.length != 0) 
        current[0].classList.remove("selected");

    let newCurrent = document.getElementById("CCButton");
    newCurrent.classList.add("selected");

    history.pushState("test", "CamCode", "/cc-altmode");


  
    /* --------------------- CC-AltMode (CamCode) --------------------- */

    let progGuts = document.querySelector('.program_board .program_guts');

    let cfm_container = document.createElement('div');
    cfm_container.classList.add('cfm_container');


    // Page Content

    let cfm_fileController = document.createElement('div');
    cfm_fileController.classList.add("cfm_fileController");
    cfm_fileController.innerHTML = `
        <button class="cfm_fileControllerButtons" onclick="controlButton('back')"> < </button>
        <button class="cfm_fileControllerButtons" onclick="controlButton('home')"> Home </button>
        <button class="cfm_fileControllerButtons" onclick="controlButton('collapsible')"> Collapse All </button>
        <button class="cfm_fileControllerButtons" onclick="controlButton('forward')"> > </button>
    `;

    let cfm_filePathTracker = document.createElement('div');
    cfm_filePathTracker.classList.add("cfm_filePathTracker");

    let cfm_search = document.createElement('div');
    cfm_search.classList.add("cfm_search");
    cfm_search.innerHTML = `
        <textarea class="cfm_searchBar searchButton" id="search_input" placeholder="Search keywords..."></textarea>
        <button class="cfm_searchButtons" onclick="searchTree(document.getElementById('search_input').value)">
            Search</button>
        <button class="cfm_searchButtons clearButton" onclick="initializeCFM()">
            Clear</button>
    `;

    setTimeout(() => { // Wait for DOM to load
        document.getElementById("search_input").focus(); // Have text area selected upon loading CamCode
    }, 10);

    // Pressing enter/escape for search bar
    cfm_search.addEventListener('keydown', function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            cfm_search.blur();
            document.getElementById("search_input").focus(); // keep text area select

            const search = (document.getElementById("search_input").value || '');
            searchTree(search);
        
            setTimeout(() => { // Wait for search
                document.getElementById("search_input").focus(); // Have text area selected upon loading CamCode
            }, 10);
        }

        if (e.key == 'Escape') initializeCFM(); // clear search and return to home page
    });

    let cfm_fileTreeInspector = document.createElement('div');
    cfm_fileTreeInspector.classList.add("cfm_fileTreeInspector");

    let cfm_FileContainer = document.createElement('div');
    cfm_FileContainer.classList.add("cfm_FileContainer");

    cfm_container.appendChild(cfm_fileController);
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

    main_container.appendChild(cfm_container);
    main_container.classList.add('program_guts');
    
    progGuts.replaceWith(main_container);
    
    // Initialize the CFM interface with tree data
    initializeCFM();
}


// Search tree for file and print path to console
function searchTree(search="") {
    getCFMTree().then((tree) => {
        if (search === "") {
            initializeCFM();
            return;
        }

        // Grab File Container and display search results
        const container = document.querySelector('.cfm_FileContainer');
        if (!container) return;

        const searchResults = searchTreeHelper(tree, search);

        let html = `<strong>Search Results for "${search.trim()}":</strong><br>`;
        if (searchResults.length === 0) {
            html += `<p>No matches found.</p>`;
        } else {
            for (let result of searchResults) {
                let fullPath = result.path;
                let displayPath = fullPath.startsWith('/CamCode/') ? fullPath.slice(9) : fullPath;
                let targetPath = result.isFolder ? fullPath.slice(1) : fullPath.slice(1, fullPath.lastIndexOf('/'));
                let displayText = displayPath;
                if (displayPath.length > 30) {
                    let prefix = displayPath.substring(0, displayPath.indexOf("/", displayPath.indexOf("/") + 1) + 1);
                    let suffix = displayPath.substring(displayPath.lastIndexOf("/") + 1);
                    displayText = prefix + ".../" + (suffix.length > 40 ? "..." + suffix.substring(suffix.length - 20, suffix.length) : suffix);
                    if (prefix.length === 0) displayText = displayPath; 
                }
                html += `<p style="cursor: pointer;" title="${displayPath}" onclick="selectFolderFromTree('${targetPath}')">${displayText}</p>`;
            }
        }
        container.innerHTML = html;
    });

    // Will traverse with DFS search algorithm
    // Partial matches will return a file path
    // If a match doesn't exist, will return empty array
    function searchTreeHelper(node, target, currentPath = "", results = []) {
        if (target === "") return results; // if empty search, return empty array
        if (currentPath === "") {
            target = target.trim();
            target = target.toLowerCase();
        } // scrub search one time

        const fullPath = currentPath + "/" + node.name;
        const nodeLowerCase = node.name.toLowerCase();

        if (nodeLowerCase.includes(target)) results.push({path: fullPath, isFolder: !!node.children});

        // Recurseive DFS Search of every child
        if (node.children) {
            for (let child of node.children) {
                searchTreeHelper(child, target, fullPath, results);
            }
        }

        return results;
    }
}



// Initialize CFM with tree data
async function initializeCFM() {
    const searchBar = document.getElementById('search_input');
    if (searchBar) searchBar.value = ""; // clear

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
            html += `<span onclick="selectFolderFromTree('${folderPath}')">${child.name}</span>`;
            html += `</p>`;
            
            // Show children only if expanded
            if (isExpanded) {
                html += buildTreeHTML(child, depth + 1);
            }
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
    if (node.name === targetName)
        return [...currentPath, node.name];
    
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
    
    navigateFolderHistory(0); // Record this navigation in the history stack
    
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
                html += `<p style="cursor: pointer;" title="${child.name}" onclick="selectFolderFromTree('${buildPathToChild(child)}')">📁${child.name}</p>`;
            else // It's a file
                html += `<p style="cursor: pointer;" title="${child.name}" onclick="downloadFileFromPath('${buildPathToChild(child)}')">📄${child.name}</p>`;
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
    let breadcrumb = ``;
    
    for (let i = 0; i < cfmState.currentPath.length; i++) {
        let pathUpToHere = cfmState.currentPath.slice(0, i + 1).join('/');
        let folderName = cfmState.currentPath[i];
        breadcrumb += `<span style="cursor: pointer; text-decoration: underline;" onclick="selectFolderFromTree('${pathUpToHere}')">${folderName}</span>`;
        
        if (i < cfmState.currentPath.length - 1)
            breadcrumb += ` / `;
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
