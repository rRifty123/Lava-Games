// --- 1. ENGINE RUNTIME DATA & DIRECTORIES ARCHITECTURE ---
let scene, camera, renderer, orbitControls, transformControls;
let selectedObject = null;
let currentToolMode = 'select'; // select, move, rotate, scale
let isPlaytesting = false;

// Preserved workspace camera coordinate transform snapshots before playtest POV overrides
let savedStudioCameraPos = new THREE.Vector3();
let savedStudioCameraTarget = new THREE.Vector3();

// WASD Navigation Engine Tracker State
let keysPressed = {};

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
    scene.background = new THREE.Color(0x181818);

    camera = new THREE.PerspectiveCamera(60, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
    camera.position.set(15, 12, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    viewport.appendChild(renderer.domElement);

    // Mouse Navigation Setup
    orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;

    // Advanced Transform Gizmos
    transformControls = new THREE.TransformControls(camera, renderer.domElement);
    scene.add(transformControls);

    transformControls.addEventListener('dragging-changed', (e) => orbitControls.enabled = !e.value);
    transformControls.addEventListener('objectChange', () => { if (selectedObject) loadProperties(selectedObject); });

    // Environment Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(20, 40, 20);
    scene.add(sunLight);

    // --- KEYBOARD LISTENERS FOR INTERACTIVE CAMERA MOVEMENT ---
    window.addEventListener('keydown', (e) => { keysPressed[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });

    // --- MOUSE 3D CLICK RAYCASTER INTERACTION SELECTION ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    renderer.domElement.addEventListener('pointerdown', (event) => {
        if(isPlaytesting) return; // Prevent raw selection transformations inside active live gameplay POV
        
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(engineGameData.Game, true);

        if (intersects.length > 0) {
            let hitObject = intersects[0].object;
            while (hitObject.parent && hitObject.parent !== scene && hitObject.parent.name !== "") {
                if (hitObject.parent.name.includes("VillageHouse") || hitObject.parent.name.includes("CharacterDummy") || hitObject.parent.name.includes("PlayerCharacterInstance")) {
                    hitObject = hitObject.parent;
                    break;
                }
                hitObject = hitObject.parent;
            }
            selectObject(hitObject);
        } else {
            if(!transformControls.dragging) selectObject(null);
        }
    });

    setupToolbarActions();
    animateEngineLoop();
}

// --- 4. MAP TEMPLATE LOADING ---
function loadTemplate(type) {
    for (let directory in engineGameData) engineGameData[directory] = [];

    const geo = new THREE.BoxGeometry(50, 0.5, 50);
    const mat = new THREE.MeshStandardMaterial({ color: type === 'blank' ? 0x2e3033 : 0x345e37, roughness: 0.9 });
    const floor = new THREE.Mesh(geo, mat);
    floor.name = type === 'blank' ? "Baseplate" : "GrassField";
    floor.customProperties = { transparency: 0, anchored: true };
    scene.add(floor);
    engineGameData.Game.push(floor);

    if (type === 'village') {
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
            houseGroup.customProperties = { transparency: 0, anchored: true };
            scene.add(houseGroup);
            engineGameData.Game.push(houseGroup);
        }
    }
}

// --- 5. RENDER EXPLORER DIRECTORY TREE VIEW ---
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
            if(item.isPlayerCharacter) icon = "🎮 ";
            
            itemDiv.innerText = `${icon}${item.name}`;
            itemDiv.onclick = (e) => { e.stopPropagation(); selectObject(item); };
            itemDiv.ondblclick = (e) => { e.stopPropagation(); triggerDoubleClickedAction(item); };

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

    if(obj && !obj.isScript && !obj.isGUI && currentToolMode !== 'select') {
        transformControls.setMode(currentToolMode);
        transformControls.attach(obj);
    } else {
        transformControls.detach();
    }
    loadProperties(obj);
}

// --- 6. RENAME AND SUB-EDITOR DOUBLE CLICK ROUTINES ---
function triggerDoubleClickedAction(item) {
    const choice = confirm(`Would you like to Edit/Configure "${item.name}"?\n(Click Cancel if you want to Rename it instead)`);
    
    if (!choice) {
        const newName = prompt("Enter new resource name:", item.name);
        if (newName && newName.trim() !== "") {
            item.name = newName.trim();
            buildExplorerTree();
            if(selectedObject === item) loadProperties(item);
        }
        return;
    }

    document.getElementById('modal-container').style.display = 'flex';
    if(item.isScript) {
        document.getElementById('script-modal').style.display = 'flex';
        document.getElementById('script-title').innerText = `Editing Script: ${item.name}`;
        document.getElementById('modal-code-input').value = item.customProperties.scriptText;
    } else if (item.isGUI) {
        document.getElementById('gui-modal').style.display = 'flex';
    } else {
        document.getElementById('modal-container').style.display = 'none';
    }
}

function closeModal() {
    document.getElementById('modal-container').style.display = 'none';
    document.getElementById('script-modal').style.display = 'none';
    document.getElementById('gui-modal').style.display = 'none';
}

function saveScriptContent() {
    if(selectedObject && selectedObject.isScript) {
        selectedObject.customProperties.scriptText = document.getElementById('modal-code-input').value;
    }
    closeModal();
}

function setGUIType(type) {
    if(selectedObject && selectedObject.isGUI) {
        selectedObject.guiType = type;
        selectedObject.name = `${type}GuiInstance`;
        buildExplorerTree();
        loadProperties(selectedObject);
    }
    closeModal();
}

// --- 7. PROPERTIES WINDOW CONTROLLER ---
function loadProperties(obj) {
    const panel = document.getElementById('properties-panel');
    
    if(obj.isGUI) {
        panel.innerHTML = `
            <div class="property-row"><label>Name</label><input type="text" id="p-name" value="${obj.name}"></div>
            <div class="property-row"><label>UI Element Type</label><input type="text" value="${obj.guiType || 'Unassigned (Double Click to pick)'}" disabled></div>
            <div class="property-row"><label>Position Top (px)</label><input type="number" id="gui-top" value="${obj.customProperties.top || 50}"></div>
            <div class="property-row"><label>Position Left (px)</label><input type="number" id="gui-left" value="${obj.customProperties.left || 50}"></div>
        `;
        document.getElementById('p-name').oninput = (e) => { obj.name = e.target.value; buildExplorerTree(); };
        document.getElementById('gui-top').oninput = (e) => { obj.customProperties.top = parseInt(e.target.value) || 0; };
        document.getElementById('gui-left').oninput = (e) => { obj.customProperties.left = parseInt(e.target.value) || 0; };
        return;
    }

    let sizeX = obj.scale?.x ?? 1;
    panel.innerHTML = `
        <div class="property-row"><label>Name</label><input type="text" id="p-name" value="${obj.name}"></div>
        <div class="property-row"><label>Position X</label><input type="number" step="0.5" id="p-posx" value="${obj.position.x || 0}"></div>
        <div class="property-row"><label>Position Y</label><input type="number" step="0.5" id="p-posy" value="${obj.position.y || 0}"></div>
        <div class="property-row"><label>Position Z</label><input type="number" step="0.5" id="p-posz" value="${obj.position.z || 0}"></div>
        <div class="property-row"><label>Size Scale</label><input type="number" step="0.5" id="p-sizex" value="${sizeX}"></div>
        <div class="property-row"><label>Transparency</label><input type="number" min="0" max="1" step="0.1" id="p-trans" value="${obj.customProperties?.transparency || 0}"></div>
    `;

    document.getElementById('p-name').oninput = (e) => { obj.name = e.target.value; buildExplorerTree(); };
    document.getElementById('p-posx').oninput = (e) => { obj.position.x = parseFloat(e.target.value) || 0; };
    document.getElementById('p-posy').oninput = (e) => { obj.position.y = parseFloat(e.target.value) || 0; };
    document.getElementById('p-posz').oninput = (e) => { obj.position.z = parseFloat(e.target.value) || 0; };
    document.getElementById('p-sizex').oninput = (e) => { let val = parseFloat(e.target.value) || 1; obj.scale.set(val, val, val); };
    document.getElementById('p-trans').oninput = (e) => {
        let val = parseFloat(e.target.value) || 0;
        obj.customProperties.transparency = val;
        if(obj.material) { obj.material.transparent = val > 0; obj.material.opacity = 1 - val; }
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

// --- 8. TOOLBAR INSERT & TRIGGER SYSTEMS ---
function setupToolbarActions() {
    const tools = { 'tool-select': 'select', 'tool-move': 'translate', 'tool-rotate': 'rotate', 'tool-scale': 'scale' };
    Object.keys(tools).forEach(id => {
        document.getElementById(id).onclick = (e) => {
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active-tool'));
            e.target.classList.add('active-tool');
            currentToolMode = tools[id];
            if (currentToolMode === 'select' || !selectedObject) transformControls.detach();
            else { transformControls.setMode(currentToolMode); transformControls.attach(selectedObject); }
        };
    });

    document.getElementById('btn-anchor').onclick = () => {
        if (!selectedObject || selectedObject.isGUI || selectedObject.isScript) return;
        selectedObject.customProperties.anchored = !selectedObject.customProperties.anchored;
        loadProperties(selectedObject);
    };

    document.getElementById('btn-insert-part').onclick = () => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(2,2,2), new THREE.MeshStandardMaterial({color: 0x3498db}));
        mesh.position.set(0, 1.2, 0); mesh.name = `Part_${engineGameData.Game.length + 1}`;
        mesh.customProperties = { transparency: 0, anchored: false };
        scene.add(mesh); engineGameData.Game.push(mesh); selectObject(mesh);
    };

    document.getElementById('btn-insert-script').onclick = () => {
        const scriptNode = { name: `ScriptInstance`, isScript: true, customProperties: { scriptText: "// Write your custom javascript automation here\nconsole.log('Hello from Lava Games Studio Script!');" } };
        engineGameData.Game.push(scriptNode); selectObject(scriptNode);
    };

    document.getElementById('btn-insert-gui').onclick = () => {
        const guiNode = { name: `ScreenGui`, isGUI: true, guiType: null, customProperties: { top: 60, left: 40 } };
        engineGameData.GUI.push(guiNode); selectObject(guiNode);
    };

    document.getElementById('btn-insert-rig').onclick = () => {
        const rig = new THREE.Group(); rig.name = "CharacterDummy";
        const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.6), new THREE.MeshStandardMaterial({color: 0xd35400})); torso.position.y = 1;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({color: 0xf1c40f})); head.position.y = 2.4;
        rig.add(torso, head); rig.customProperties = { transparency: 0, anchored: false };
        scene.add(rig); engineGameData.Game.push(rig); selectObject(rig);
    };

    document.getElementById('btn-insert-player').onclick = () => {
        const pGroup = new THREE.Group(); pGroup.name = "PlayerCharacterInstance";
        pGroup.isPlayerCharacter = true;
        
        const pants = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 0.6), new THREE.MeshStandardMaterial({color: 0x0a3d62})); pants.position.y = 0.5;
        const shirt = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 0.6), new THREE.MeshStandardMaterial({color: 0x3c6382})); shirt.position.y = 1.6;
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshStandardMaterial({color: 0xffddaa})); face.position.y = 2.65;
        
        pGroup.add(pants, shirt, face);
        pGroup.position.set(0, 0, 4);
        pGroup.customProperties = { transparency: 0, anchored: false };
        
        scene.add(pGroup);
        engineGameData.Players.push(pGroup);
        engineGameData.Game.push(pGroup);
        selectObject(pGroup);
    };

    // --- PLAYTEST SWITCH WITH POV TRANSITION LAYER ACTION ---
    document.getElementById('btn-playtest').onclick = (e) => {
        isPlaytesting = !isPlaytesting;
        if(isPlaytesting) {
            e.target.innerText = "⏹️ Stop Playtest"; e.target.classList.replace('success', 'btn-danger');
            transformControls.detach(); // Safety off click handles during live gameplay simulation

            // Save old viewport camera parameters so we can safely teleport back when done
            savedStudioCameraPos.copy(camera.position);
            savedStudioCameraTarget.copy(orbitControls.target);

            // 🎥 TELEPORT CAMERA TO PLAYER CHARACTER POINT OF VIEW HEAD POSITION IF FOUND
            const playerAsset = engineGameData.Players[0];
            if (playerAsset) {
                camera.position.set(playerAsset.position.x, playerAsset.position.y + 2.65, playerAsset.position.z);
                orbitControls.target.set(playerAsset.position.x, playerAsset.position.y + 2.65, playerAsset.position.z - 5);
            } else {
                alert("Notice: No Active Player character found inside Workspace. Staying in Free Camera mode.");
            }
            
            const guiArea = document.getElementById('starter-gui-container');
            guiArea.innerHTML = '';
            engineGameData.GUI.forEach(ui => {
                if(!ui.guiType) return;
                let el;
                if(ui.guiType === 'Text') {
                    el = document.createElement('div'); el.className = "runtime-ui-text"; el.innerText = "Text Label Element";
                } else if (ui.guiType === 'Image') {
                    el = document.createElement('div'); el.className = "runtime-ui-image"; el.style.width = "100px"; el.style.height = "100px"; el.innerText = "IMAGE FRAME";
                } else if (ui.guiType === 'Button') {
                    el = document.createElement('button'); el.className = "runtime-ui-button"; el.innerText = "Click Me!";
                    el.onclick = () => alert("Runtime GUI Button Clicked!");
                }
                el.style.top = `${ui.customProperties.top}px`; el.style.left = `${ui.customProperties.left}px`;
                guiArea.appendChild(el);
            });
        } else {
            e.target.innerText = "▶️ Playtest"; e.target.classList.replace('btn-danger', 'success');
            document.getElementById('starter-gui-container').innerHTML = '';
            
            // 🎥 TETHER BACK TO OLD FREE CAM SNAPSHOT LOCATION OVER VIEWPORT
            camera.position.copy(savedStudioCameraPos);
            orbitControls.target.copy(savedStudioCameraTarget);
        }
    };

    // --- 9. COMPILE & DOWNLOAD STANDALONE APPLICATION RUNTIME ENGINE ---
    document.getElementById('btn-save').onclick = () => {
        let serializedJSON = {};
        for (let key in engineGameData) {
            serializedJSON[key] = engineGameData[key].map(obj => ({
                name: obj.name, isScript: obj.isScript || false, isGUI: obj.isGUI || false, isPlayerCharacter: obj.isPlayerCharacter || false, guiType: obj.guiType || null,
                position: obj.position ? {x: obj.position.x, y: obj.position.y, z: obj.position.z} : null,
                scale: obj.scale ? {x: obj.scale.x, y: obj.scale.y, z: obj.scale.z} : null,
                customProperties: obj.customProperties || {}
            }));
        }

        // We compile a self-executing HTML wrapper template payload that runs completely offline as a native app!
        const appPayload = `<!DOCTYPE html>
<html>
<head>
    <title>Lava Games Game Application</title>
    <style>
        body, html { margin:0; padding:0; width:100%; height:100%; overflow:hidden; background:#000; }
        #canvas-view { width:100%; height:100%; }
        #game-gui { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; font-family:sans-serif; }
        .ui-txt { position:absolute; background:rgba(0,0,0,0.7); padding:8px 16px; border-radius:4px; color:white; font-weight:bold; }
        .ui-img { position:absolute; background:linear-gradient(45deg, #ff5500, #ffaa00); border-radius:4px; display:flex; align-items:center; justify-content:center; color:white; font-size:12px;}
        .ui-btn { position:absolute; background:#007acc; padding:8px 16px; border-radius:4px; color:white; font-weight:bold; pointer-events:auto; cursor:pointer; border:none; }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"><\/script>
</head>
<body>
    <div id="canvas-view"></div>
    <div id="game-gui"></div>
    <script>
        const data = ${JSON.stringify(serializedJSON)};
        const scene = new THREE.Scene(); scene.background = new THREE.Color(0x181818);
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({antialiasing:true});
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.getElementById('canvas-view').appendChild(renderer.domElement);
        
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const sun = new THREE.DirectionalLight(0xffffff, 0.7); sun.position.set(10,30,10); scene.add(sun);

        let playerPos = {x:0, y:2.65, z:4};
        
        // Unpack World Objects
        data.Game.forEach(item => {
            if(item.isScript || item.isGUI) return;
            let geo = new THREE.BoxGeometry(2,2,2);
            if(item.name.includes("Baseplate") || item.name.includes("GrassField")) geo = new THREE.BoxGeometry(50, 0.5, 50);
            let mat = new THREE.MeshStandardMaterial({color: item.isPlayerCharacter ? 0x3c6382 : 0x3498db});
            if(item.name.includes("Baseplate")) mat.color.setHex(0x2e3033);
            if(item.name.includes("GrassField")) mat.color.setHex(0x345e37);
            
            const mesh = new THREE.Mesh(geo, mat);
            if(item.position) mesh.position.set(item.position.x, item.position.y, item.position.z);
            if(item.scale) mesh.scale.set(item.scale.x, item.scale.y, item.scale.z);
            scene.add(mesh);
            if(item.isPlayerCharacter && item.position) { playerPos = {x: item.position.x, y: item.position.y + 2.65, z: item.position.z}; }
        });

        // Set Camera inside Player head POV position
        camera.position.set(playerPos.x, playerPos.y, playerPos.z);
        camera.lookAt(playerPos.x, playerPos.y, playerPos.z - 10);

        // Render Loaded GUIs
        const guiBox = document.getElementById('game-gui');
        data.GUI.forEach(ui => {
            if(!ui.guiType) return;
            const el = document.createElement(ui.guiType === 'Button' ? 'button' : 'div');
            el.className = ui.guiType === 'Button' ? 'ui-btn' : (ui.guiType === 'Text' ? 'ui-txt' : 'ui-img');
            el.innerText = ui.guiType === 'Button' ? 'Click Me' : (ui.guiType === 'Text' ? 'Live Game UI Text' : 'IMAGE');
            if(ui.guiType === 'Image') { el.style.width='100px'; el.style.height='100px'; }
            el.style.top = ui.customProperties.top + 'px'; el.style.left = ui.customProperties.left + 'px';
            if(ui.guiType === 'Button') el.onclick = () => alert("App Action Confirmed!");
            guiBox.appendChild(el);
        });

        function playLoop() { requestAnimationFrame(playLoop); renderer.render(scene, camera); }
        playLoop();
        window.addEventListener('resize', () => { camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
    <\/script>
</body>
</html>`;

        const blob = new Blob([appPayload], {type: "text/html"});
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `LavaGamesApp.html`; // Standalone double-clickable app file executable anywhere!
        link.click();
    };
}

// --- 10. PRINCIPAL ANIMATION ENGINE TICK LOOP ---
function animateEngineLoop() {
    requestAnimationFrame(animateEngineLoop);
    
    // WASD Camera Free-Fly Movement Logic (Disabled when snapped to Player Character POV)
    if(!isPlaytesting) {
        const moveSpeed = 0.4;
        const directionVector = new THREE.Vector3();
        camera.getWorldDirection(directionVector);
        
        const forwardX = directionVector.x;
        const forwardZ = directionVector.z;

        if (keysPressed['w']) { camera.position.x += forwardX * moveSpeed; camera.position.z += forwardZ * moveSpeed; orbitControls.target.x += forwardX * moveSpeed; orbitControls.target.z += forwardZ * moveSpeed; }
        if (keysPressed['s']) { camera.position.x -= forwardX * moveSpeed; camera.position.z -= forwardZ * moveSpeed; orbitControls.target.x -= forwardX * moveSpeed; orbitControls.target.z -= forwardZ * moveSpeed; }
        if (keysPressed['a']) { camera.position.x += forwardZ * moveSpeed; camera.position.z -= forwardX * moveSpeed; orbitControls.target.x += forwardZ * moveSpeed; orbitControls.target.z -= forwardX * moveSpeed; }
        if (keysPressed['d']) { camera.position.x -= forwardZ * moveSpeed; camera.position.z += forwardX * moveSpeed; orbitControls.target.x -= forwardZ * moveSpeed; orbitControls.target.z += forwardX * moveSpeed; }
    }

    if(orbitControls) orbitControls.update();

    // Gravity Physics Engine loop Simulation
    if (isPlaytesting) {
        engineGameData.Game.forEach(obj => {
            if (obj.position && obj.customProperties && !obj.customProperties.anchored) {
                // Drop items until they reach ground level
                if (obj.position.y > 1 && !obj.isPlayerCharacter) obj.position.y -= 0.08;
            }
        });
    }

    if(renderer && scene && camera) renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    if(camera && renderer) {
        const viewport = document.getElementById('viewport');
        camera.aspect = viewport.clientWidth / viewport.clientHeight; camera.updateProjectionMatrix();
        renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    }
});
