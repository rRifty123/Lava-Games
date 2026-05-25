// --- 1. SETUP THREE.JS ENGINE SCENE ---
const viewport = document.getElementById('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);

const camera = new THREE.PerspectiveCamera(60, viewport.clientWidth / viewport.clientHeight, 0.1, 1000);
camera.position.set(0, 5, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
viewport.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Lighting (Sunlight + Ambient baseplate light)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(10, 20, 15);
scene.add(dirLight);

// The Roblox Baseplate
const gridHelper = new THREE.GridHelper(40, 40, 0x444444, 0x222222);
gridHelper.position.y = -0.01;
scene.add(gridHelper);

const baseplateGeo = new THREE.BoxGeometry(40, 0.2, 40);
const baseplateMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });
const baseplate = new THREE.Mesh(baseplateGeo, baseplateMat);
baseplate.position.y = -0.1;
baseplate.name = "Baseplate";
baseplate.isPart = true; 
scene.add(baseplate);

// --- 2. ENGINE STATE VARIABLES ---
let workspaceObjects = [baseplate];
let selectedObject = null;
let isRunning = false;
let partCounter = 0;
let userScriptCompiled = null;
let scriptScopeContext = { timer: 0 }; 

// Custom selection visual outline
const selectionBox = new THREE.BoxHelper(null, 0x00ff00);
scene.add(selectionBox);
selectionBox.visible = false;

// --- 3. EDITOR CORE FUNCTIONS ---
function updateExplorer() {
    const list = document.getElementById('explorer-list');
    list.innerHTML = '';
    
    workspaceObjects.forEach(obj => {
        const item = document.createElement('div');
        item.className = 'tree-item';
        if (selectedObject === obj) item.classList.add('selected');
        item.innerText = `📦 ${obj.name}`;
        
        item.onclick = () => selectObject(obj);
        list.appendChild(item);
    });
}

function selectObject(obj) {
    selectedObject = obj;
    updateExplorer();
    
    if (obj) {
        selectionBox.setFromObject(obj);
        selectionBox.visible = true;
        loadProperties(obj);
    } else {
        selectionBox.visible = false;
        document.getElementById('properties-panel').innerHTML = '<p class="placeholder-text">Select an object to edit properties</p>';
    }
}

function loadProperties(obj) {
    const panel = document.getElementById('properties-panel');
    panel.innerHTML = `
        <div class="property-row">
            <label>Name</label>
            <input type="text" id="prop-name" value="${obj.name}">
        </div>
        <div class="property-row">
            <label>Color</label>
            <input type="color" id="prop-color" value="#${obj.material.color.getHexString()}">
        </div>
        <div class="property-row">
            <label>Position Y</label>
            <input type="number" step="0.5" id="prop-pos-y" value="${obj.position.y}">
        </div>
    `;

    // Hook properties up to live UI inputs
    document.getElementById('prop-name').oninput = (e) => {
        obj.name = e.target.value;
        updateExplorer();
    };
    document.getElementById('prop-color').oninput = (e) => {
        obj.material.color.set(e.target.value);
    };
    document.getElementById('prop-pos-y').oninput = (e) => {
        obj.position.y = parseFloat(e.target.value) || 0;
        if(selectionBox.visible) selectionBox.setFromObject(obj);
    };
}

// Spawning Engine Logic
document.getElementById('btn-spawn-part').onclick = () => {
    partCounter++;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((Math.random() - 0.5) * 5, 0.5, (Math.random() - 0.5) * 5);
    mesh.name = `Part_${partCounter}`;
    mesh.isPart = true;

    scene.add(mesh);
    workspaceObjects.push(mesh);
    selectObject(mesh);
};

document.getElementById('btn-spawn-rig').onclick = () => {
    partCounter++;
    // Simple Roblox character model composition group
    const group = new THREE.Group();
    group.name = `DummyRig_${partCounter}`;
    
    const mat = new THREE.MeshStandardMaterial({ color: 0x00a2ff });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat);
    head.position.y = 1.4;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.5), mat);
    torso.position.y = 0.5;
    
    group.add(head, torso);
    group.position.set((Math.random() - 0.5) * 4, 0.5, (Math.random() - 0.5) * 4);
    
    // Wire properties patch up so group doesn't break color setter logic
    group.material = { color: { set: (c) => mat.color.set(c), getHexString: () => mat.color.getHexString() } };

    scene.add(group);
    workspaceObjects.push(group);
    selectObject(group);
};

// --- 4. THE ROBLOX INSPIRED SCRIPT EXECUTION SYSTEM ---
const runBtn = document.getElementById('btn-run');
const stopBtn = document.getElementById('btn-stop');

runBtn.onclick = () => {
    if (!selectedObject) {
        alert("Please select a Part/Model in the Explorer to bind your script to execution before running!");
        return;
    }
    const scriptText = document.getElementById('script-input').value;
    try {
        // Compile raw user string text to real operational Javascript closure function
        userScriptCompiled = new Function('script', scriptText);
        
        // Reset execution environment states
        scriptScopeContext = { Parent: selectedObject, timer: 0 };
        isRunning = true;
        
        runBtn.disabled = true;
        stopBtn.disabled = false;
    } catch (err) {
        alert("Script Compile Error: " + err.message);
    }
};

stopBtn.onclick = () => {
    isRunning = false;
    runBtn.disabled = false;
    stopBtn.disabled = true;
};

// --- 5. CORE RENDER AND INTERACTION ENGINE LOOP ---
function animate() {
    requestAnimationFrame(animate);
    controls.update();

    // If game simulation runtime active, cycle compiled user logic
    if (isRunning && userScriptCompiled) {
        try {
            userScriptCompiled(scriptScopeContext);
            // Dynamic check updating selection widget box shifts during scripts
            if (selectedObject && selectionBox.visible) {
                selectionBox.setFromObject(selectedObject);
            }
        } catch (scriptErr) {
            console.error("Runtime Script Crash:", scriptErr);
            isRunning = false;
            runBtn.disabled = false;
            stopBtn.disabled = true;
        }
    }

    renderer.render(scene, camera);
}

// Initialize View Engine UI layout states
updateExplorer();
animate();

// Adjust structural responsive layout resizing hooks
window.addEventListener('resize', () => {
    camera.aspect = viewport.clientWidth / viewport.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(viewport.clientWidth, viewport.clientHeight);
});
