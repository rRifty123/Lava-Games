// --- 1. ENGINE RUNTIME STATE CONFIGURATION ---
let scene, camera, renderer, orbitControls, transformControls;
let selectedObject = null;
let currentToolMode = 'select'; // select, move, rotate, scale
let isPlaytesting = false;

// Roblox Studio Directory Data Structure Mock Engine Configuration Tree
let engineGameData = {
    Game: [],
    StarterPlayer: [],
    StarterCharacter: [],
    GUI: [],
    StarterInventory: [],
    Storage: [],
    ReplicatedStorage: [],
    ReplicatedFirst: [],
    Sound: [],
    Players: []
};

// --- 2. THE LAUNCH HUB CONTROLLER ---
function launchEngine(templateType) {
    document.getElementById('hub-screen').style.display = 'none';
    document.getElementById('studio-screen').style.display = 'flex';
    
    initEngineCore();
    loadTemplate(templateType);
    buildExplorerTree();
}

function exitToHub() {
    document.getElementById('studio-screen').style.display = 'none';
    document.getElementById('hub-screen').style.display = 'flex';
    if(renderer) {
        renderer.dispose();
        document.getElementById('viewport').innerHTML = '';
    }
}

// --- 3. INITIALIZE INTERACTIVE THREEJS RUNTIME SYSTEM ---
function initEngineCore() {
    const viewport = document.getElementById('viewport');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1e1e1e);

    camera = new THREE.PerspectiveCamera(60, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
    camera.position.set(15, 12, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    viewport.appendChild(renderer.domElement);

    // Camera Navigation Controls
    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;

    // Advanced Transform Interaction Hooks Gizmos (Move/Rotate/Scale arrows)
    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    scene.add(transformControls);

    // Prevent camera flight rotation conflicts when clicking gizmo arrows
    transformControls.addEventListener('dragging-changed', function (event) {
        orbitControls.enabled = !event.value;
    });

    // Update dynamic viewport properties input when manually transformed
    transformControls.addEventListener('objectChange', function () {
        if (selectedObject) loadProperties(selectedObject);
    });

    // Lighting Systems
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(20, 40, 20);
    scene.add(sunLight);

    // --- MOUSE 3D CLICK CLICK RAYCASTER INTERACTION SELECTION LINK ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('pointerdown', (event) => {
        // Calculate mouse position in normalized device bounds coordinates (-1 to +1)
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // Scan items stored specifically inside the Workspace structure array map
        const intersects = raycaster.intersectObjects(engineGameData.Game, true);

        if (intersects.length > 0) {
            let hitObject = intersects[0].object;
            
            // Traverse up tree if parts belong to custom assemblies (Rigs / Compound models)
            while (hitObject.parent && hitObject.parent !== scene && hitObject.parent.name !== "") {
                if (hitObject.parent.name.includes("VillageHouse") || hitObject.parent.name.includes("CharacterDummy")) {
                    hitObject = hitObject.parent;
                    break;
                }
                hitObject = hitObject.parent;
            }
            selectObject(hitObject);
        } else {
            // Clicked empty void layout space - but verify they didn't just click an active gizmo handle arm
            if(!transformControls.dragging) {
                selectObject(null);
            }
        }
    });

    setupToolbarActions();
    animateEngineLoop();
}

// --- 4. MAP AND DATA SYSTEM TEMPLATE ENGINE LOADING ---
function loadTemplate(type) {
    // Clean old engine states
    for (let directory in engineGameData) engineGameData[directory] = [];

    if (type === 'blank') {
        const geo = new THREE.BoxGeometry(50, 0.5, 50);
        const mat = new THREE.MeshStandardMaterial({ color: 0x2e3033, roughness: 0.9 });
        const baseplate = new THREE.Mesh(geo, mat);
        baseplate.name = "Baseplate";
        baseplate.customProperties = { transparency: 0, anchored: true, scriptText: "" };
        
        scene.add(baseplate);
        engineGameData.Game.push(baseplate);
    } else if (type === 'village') {
        const floorGeo = new THREE.BoxGeometry(60, 0.5, 60);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x345e37 });
        const villageFloor = new THREE.Mesh(floorGeo, floorMat);
        villageFloor.name = "GrassField";
        villageFloor.customProperties = { transparency: 0, anchored: true, scriptText: "" };
        scene.add(villageFloor);
        engineGameData.Game.push(villageFloor);

        // Generate preset house models structures inside loop layout bounds
        for(let i = 0; i < 3; i++) {
            const houseGroup = new THREE.Group();
            houseGroup.name = `VillageHouse_${i+1}`;
            
            const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), new THREE.MeshStandardMaterial({color: 0xbdc3c7}));
            wall.position.y = 1.5;
            const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2, 4), new THREE.MeshStandardMaterial({color: 0xc0392b}));
            roof.position.y = 4;
            roof.rotation.y = Math.PI / 4;

            houseGroup.add(wall, roof);
            houseGroup.position.set(-10 + (i * 10), 0, (Math.random() - 0.5) * 10);
            houseGroup.customProperties = { transparency: 0, anchored: true, scriptText: "" };

            scene.add(houseGroup);
            engineGameData.Game.push(houseGroup);
        }
    }
}

// --- 5. RENDER THE EXPLORER ROBLOX HIERARCHY TREE VIEW ---
function buildExplorerTree() {
    const treeContainer = document.getElementById('explorer-tree');
    treeContainer.innerHTML = '';

    for (let folderName in engineGameData) {
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-node';
        folderDiv.innerText = `📂 ${folderName}`;
        treeContainer.appendChild(folderDiv);

        const childListContainer = document.createElement('div');
        childListContainer.className = 'child-list';

        engineGameData[folderName].forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'tree-item';
            if (selectedObject === item) itemDiv.classList.add('selected');
            
            let icon = "📦 ";
            if(item.isScript) icon = "📜 ";
            if(item.isGUI) icon = "🖼️ ";
            
            itemDiv.innerText = `${icon}${item.name}`;
            itemDiv.onclick = (e) => {
                e.stopPropagation();
                selectObject(item);
            };
            childListContainer.appendChild(itemDiv);
        });

        treeContainer.appendChild(childListContainer);
    }
}

function selectObject(obj) {
    selectedObject = obj;
    buildExplorerTree();

    if (!obj || obj.isScript || obj.isGUI) {
        transformControls.detach();
        if(!obj) {
            document.getElementById('properties-panel').innerHTML = '<p class="placeholder-text">Select an item inside Explorer to read attributes</p>';
            return;
        }
    }

    // Attach transformation tool controls handle unless asset type non-spatial
    if(obj && !obj.isScript && !obj.isGUI && currentToolMode !== 'select') {
        transformControls.setMode(currentToolMode);
        transformControls.attach(obj);
    } else {
        transformControls.detach();
    }

    loadProperties(obj);
}

// --- 6. PROPERTIES WINDOW CONTROLLER ---
function loadProperties(obj) {
    const panel = document.getElementById('properties-panel');
    
    let sizeX = obj.scale?.x ?? 1;
    let sizeY = obj.scale?.y ?? 1;
    let sizeZ = obj.scale?.z ?? 1;

    panel.innerHTML = `
        <div class="property-row"><label>Name</label><input type="text" id="p-name" value="${obj.name}"></div>
        <div class="property-row"><label>Position X</label><input type="number" step="0.5" id="p-posx" value="${obj.position.x || 0}"></div>
        <div class="property-row"><label>Position Y</label><input type="number" step="0.5" id="p-posy" value="${obj.position.y || 0}"></div>
        <div class="property-row"><label>Position Z</label><input type="number" step="0.5" id="p-posz" value="${obj.position.z || 0}"></div>
        <div class="property-row"><label>Size Multiplier</label><input type="number" step="0.5" id="p-sizex" value="${sizeX}"></div>
        <div class="property-row"><label>Transparency</label><input type="number" min="0" max="1" step="0.1" id="p-trans" value="${obj.customProperties?.transparency || 0}"></div>
    `;

    // Real-time UI input listener mapping
    document.getElementById('p-name').oninput = (e) => { obj.name = e.target.value; buildExplorerTree(); };
    document.getElementById('p-posx').oninput = (e) => { obj.position.x = parseFloat(e.target.value) || 0; };
    document.getElementById('p-posy').oninput = (e) => { obj.position.y = parseFloat(e.target.value) || 0; };
    document.getElementById('p-posz').oninput = (e) => { obj.position.z = parseFloat(e.target.value) || 0; };
    document.getElementById('p-sizex').oninput = (e) => {
        let val = parseFloat(e.target.value) || 1;
        obj.scale.set(val, val, val);
    };
    document.getElementById('p-trans').oninput = (e) => {
        let val = parseFloat(e.target.value) || 0;
        obj.customProperties.transparency = val;
        if(obj.material) {
            obj.material.transparent = val > 0;
            obj.material.opacity = 1 - val;
        }
    };

    const anchorBtn = document.getElementById('btn-anchor');
    if (obj.customProperties?.anchored) {
        anchorBtn.innerText = "⚓ Anchor: ON";
        anchorBtn.classList.add('active-tool');
    } else {
        anchorBtn.innerText = "⚓ Anchor: OFF";
        anchorBtn.classList.remove('active-tool');
    }
}

// --- 7. TOOLBAR ACTIONS CONTROLLERS ROUTINES ---
function setupToolbarActions() {
    const tools = {
        'tool-select': 'select',
        'tool-move': 'translate',
        'tool-rotate': 'rotate',
        'tool-scale': 'scale'
    };

    Object.keys(tools).forEach(id => {
        document.getElementById(id).onclick = (e) => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active-tool'));
            e.target.classList.add('active-tool');
            currentToolMode = tools[id];
            
            if (currentToolMode === 'select' || !selectedObject) {
                transformControls.detach();
            } else {
                transformControls.setMode(currentToolMode);
                transformControls.attach(selectedObject);
            }
        };
    });

    document.getElementById('btn-anchor').onclick = () => {
        if (!selectedObject) return;
        if (!selectedObject.customProperties) selectedObject.customProperties = {};
        selectedObject.customProperties.anchored = !selectedObject.customProperties.anchored;
        loadProperties(selectedObject);
    };

    document.getElementById('btn-insert-part').onclick = () => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(2,2,2), new THREE.MeshStandardMaterial({color: 0x3498db}));
        mesh.position.set(0, 1.2, 0);
        mesh.name = `Part_${engineGameData.Game.length + 1}`;
        mesh.customProperties = { transparency: 0, anchored: false, scriptText: "" };
        scene.add(mesh);
        engineGameData.Game.push(mesh);
        selectObject(mesh);
    };

    document.getElementById('btn-insert-script').onclick = () => {
        const mockScriptNode = { name: `Script_${engineGameData.Game.length+1}`, isScript: true, customProperties: { scriptText: "console.log('Running Script!');" } };
        engineGameData.Game.push(mockScriptNode);
        selectObject(mockScriptNode);
    };

    document.getElementById('btn-insert-gui').onclick = () => {
        const mockGUINode = { name: `ScreenGui_${engineGameData.GUI.length+1}`, isGUI: true, text: "Sample Run HUD Text UI Label" };
        engineGameData.GUI.push(mockGUINode);
        selectObject(mockGUINode);
    };

    document.getElementById('btn-insert-rig').onclick = () => {
        const rig = new THREE.Group();
        rig.name = "CharacterDummy";
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.6), new THREE.MeshStandardMaterial({color: 0xd35400}));
        torso.position.y = 1;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({color: 0xf1c40f}));
        head.position.y = 2.4;
        rig.add(torso, head);
        rig.customProperties = { transparency: 0, anchored: false, scriptText: "" };
        scene.add(rig);
        engineGameData.Game.push(rig);
        selectObject(rig);
    };

    document.getElementById('btn-playtest').onclick = (e) => {
        isPlaytesting = !isPlaytesting;
        if(isPlaytesting) {
            e.target.innerText = "⏹️ Stop Playtest";
            e.target.classList.replace('success', 'btn-danger');
            
            const guiArea = document.getElementById('starter-gui-container');
            guiArea.innerHTML = '';
            engineGameData.GUI.forEach(ui => {
                const label = document.createElement('div');
                label.style.cssText = "position:absolute; top:20px; left:20px; background:rgba(0,0,0,0.8); padding:12px; color:#5cd65c; font-weight:bold; border-radius:4px; border:1px solid #333;";
                label.innerText = ui.text || ui.name;
                guiArea.appendChild(label);
            });
        } else {
            e.target.innerText = "▶️ Playtest";
            e.target.classList.replace('btn-danger', 'success');
            document.getElementById('starter-gui-container').innerHTML = '';
        }
    };

    // --- FILE COMPILATION COMPUTER SAVER ---
    document.getElementById('btn-save').onclick = () => {
        let exportData = {};
        for (let key in engineGameData) {
            exportData[key] = engineGameData[key].map(obj => ({
                name: obj.name,
                isScript: obj.isScript || false,
                isGUI: obj.isGUI || false,
                position: obj.position ? {x: obj.position.x, y: obj.position.y, z: obj.position.z} : null,
                scale: obj.scale ? {x: obj.scale.x, y: obj.scale.y, z: obj.scale.z} : null,
                customProperties: obj.customProperties || {}
            }));
        }

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {type: "application/json"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${exportData.Game[0]?.name || "MyStudioGame"}.json`;
        link.click();
    };
}

// --- 8. PRINCIPAL ANIMATION ENGINE TICK LOOP ---
function animateEngineLoop() {
    requestAnimationFrame(animateEngineLoop);
    
    if(orbitControls) orbitControls.update();

    // Simulation Gravity Physics checks active
    if (isPlaytesting) {
        engineGameData.Game.forEach(obj => {
            if (obj.position && obj.customProperties && !obj.customProperties.anchored) {
                if (obj.position.y > 1) {
                    obj.position.y -= 0.08; // Falls down until boundary hit
                }
            }
        });
    }

    if(renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// Global hook adjustments responsive window resize handlers
window.addEventListener('resize', () => {
    if(camera && renderer) {
        const viewport = document.getElementById('viewport');
        camera.aspect = viewport.clientWidth / viewport.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
});
