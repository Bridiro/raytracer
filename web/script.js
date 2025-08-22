class RaytracerApp {
    constructor() {
        this.raytracer = null;
        this.canvas = null;
        this.animationId = null;
        this.lastTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.isPointerLocked = false;
        
        // Camera controls
        this.keys = {};
        this.moveSpeed = 5.0; // Faster default movement
        this.mouseSensitivity = 0.3; // Lower mouse sensitivity for better control
        this.wasdEnabled = true; // Enable WASD by default
        
        // Scene editor
        this.currentMode = 'raytracer';
        this.selectedObject = null;
        this.sceneObjects = [];
        this.viewCanvases = {};
        
        this.init();
    }
    
    async init() {
        try {
            // Load WASM module
            const wasm = await import('./pkg/raytracer.js');
            await wasm.default();
            
            // Get canvas
            this.canvas = document.getElementById('raytracerCanvas');
            if (!this.canvas) {
                throw new Error('Canvas not found');
            }
            
            // Initialize raytracer
            this.raytracer = new wasm.Raytracer('raytracerCanvas', 800, 600);
            
            this.setupEventListeners();
            this.setupControls();
            this.setupModeToggle();
            this.setupSceneEditor();
            this.updateObjectCount();
            this.updateObjectList();
            
            // Set proper canvas size
            this.handleResize();
            
            // Start render loop
            this.render();
            
            console.log('Raytracer initialized successfully!');
        } catch (error) {
            console.error('Failed to load raytracer:', error);
            document.body.innerHTML = `
                <div style="color: red; text-align: center; margin-top: 50px;">
                    <h2>Failed to load raytracer</h2>
                    <p>Error: ${error.message}</p>
                    <p>Make sure the WASM files are properly built.</p>
                </div>
            `;
        }
    }
    
    setupEventListeners() {
        // Canvas click for pointer lock (raytracer mode only)
        this.canvas.addEventListener('click', (event) => {
            if (this.currentMode === 'raytracer') {
                // Request pointer lock for mouse look
                this.canvas.requestPointerLock();
            }
        });
        
        // Pointer lock handling
        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.canvas;
            if (this.isPointerLocked) {
                console.log('Mouse captured. Press ESC to release.');
            }
        });
        
        // Mouse movement for camera
        document.addEventListener('mousemove', (event) => {
            if (this.isPointerLocked) {
                const deltaX = event.movementX * this.mouseSensitivity * 0.01;
                const deltaY = event.movementY * this.mouseSensitivity * 0.01;
                this.raytracer.rotate_camera(deltaX, -deltaY);
            }
        });
        
        // WASD controls
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
            
            // Exit pointer lock with Escape
            if (event.code === 'Escape' && this.isPointerLocked) {
                document.exitPointerLock();
            }
            
            // Toggle WASD mode with F key
            if (event.code === 'KeyF') {
                this.toggleWASDMode();
            }
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    setupControls() {
        // Remove old scene editing controls from raytracer mode
        // Only keep camera and scene I/O controls for raytracer mode
        // Reset camera button
        document.getElementById('resetCamera').addEventListener('click', () => {
            this.raytracer.set_camera_position(0.0, 2.0, 5.0);
            this.raytracer.set_camera_target(0.0, 0.0, 0.0);
        });
        
        // Speed control
        document.getElementById('moveSpeed').addEventListener('input', (event) => {
            this.moveSpeed = parseFloat(event.target.value);
            document.getElementById('speedValue').textContent = this.moveSpeed.toFixed(1);
        });
        
        // Mouse sensitivity control
        document.getElementById('mouseSensitivity').addEventListener('input', (event) => {
            this.mouseSensitivity = parseFloat(event.target.value);
            document.getElementById('sensitivityValue').textContent = this.mouseSensitivity.toFixed(1);
        });
        
        // Remove radius control from raytracer mode - now only in editor mode
        
        // Export scene
        document.getElementById('exportScene').addEventListener('click', () => {
            this.exportScene();
        });
        
        // Import scene
        document.getElementById('importScene').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        document.getElementById('fileInput').addEventListener('change', (event) => {
            this.importScene(event.target.files[0]);
        });
        
        // Load Blender scene
        document.getElementById('loadBlenderScene').addEventListener('click', () => {
            document.getElementById('blenderInput').click();
        });
        
        document.getElementById('blenderInput').addEventListener('change', (event) => {
            this.loadBlenderScene(event.target.files[0]);
        });
        
        // Preset scenes
        document.getElementById('cornellBox').addEventListener('click', () => {
            this.createCornellBox();
        });
        
        document.getElementById('glassScene').addEventListener('click', () => {
            this.createGlassScene();
        });
        
        document.getElementById('metalScene').addEventListener('click', () => {
            this.createMetalScene();
        });
    }
    
    handleCameraMovement(deltaTime) {
        let forward = 0, right = 0, up = 0;
        const speed = this.moveSpeed * deltaTime / 1000;
        
        if (this.keys['KeyW']) forward += speed;
        if (this.keys['KeyS']) forward -= speed;
        if (this.keys['KeyA']) right -= speed;
        if (this.keys['KeyD']) right += speed;
        if (this.keys['KeyE']) up += speed;  // E to go up
        if (this.keys['KeyQ']) up -= speed;  // Q to go down
        
        if (forward !== 0 || right !== 0 || up !== 0) {
            this.raytracer.move_camera(forward, right, up);
        }
    }
    
    addConfiguredSphere() {
        const radius = parseFloat(document.getElementById('radius').value);
        const materialType = parseInt(document.getElementById('materialType').value);
        const color = document.getElementById('sphereColor').value;
        
        // Convert hex color to RGB
        const r = parseInt(color.substr(1, 2), 16) / 255;
        const g = parseInt(color.substr(3, 2), 16) / 255;
        const b = parseInt(color.substr(5, 2), 16) / 255;
        
        // Add sphere at origin (user can move it later)
        this.raytracer.add_sphere(0, 0, -2, radius, r, g, b, materialType);
        this.updateObjectCount();
        this.updateObjectList();
    }
    
    addSphereAtClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        
        // Place sphere in front of camera
        const worldX = x * 5;
        const worldY = y * 3;
        const worldZ = -3;
        
        const radius = parseFloat(document.getElementById('radius').value);
        const materialType = parseInt(document.getElementById('materialType').value);
        const color = document.getElementById('sphereColor').value;
        
        const r = parseInt(color.substr(1, 2), 16) / 255;
        const g = parseInt(color.substr(3, 2), 16) / 255;
        const b = parseInt(color.substr(5, 2), 16) / 255;
        
        this.raytracer.add_sphere(worldX, worldY, worldZ, radius, r, g, b, materialType);
        this.updateObjectCount();
        this.updateObjectList();
    }
    
    updateObjectList() {
        // Create or update object list in the UI
        let objectListContainer = document.getElementById('objectList');
        if (!objectListContainer) {
            objectListContainer = document.createElement('div');
            objectListContainer.id = 'objectList';
            objectListContainer.className = 'control-section';
            objectListContainer.innerHTML = '<h3><span class="accent">//</span> Scene Objects</h3>';
            document.querySelector('.control-panel').appendChild(objectListContainer);
        }
        
        // Clear existing list
        const existingList = objectListContainer.querySelector('.object-items');
        if (existingList) {
            existingList.remove();
        }
        
        // Create new list
        const listContainer = document.createElement('div');
        listContainer.className = 'object-items';
        
        const sphereCount = this.raytracer.get_sphere_count();
        for (let i = 0; i < sphereCount; i++) {
            const objectItem = document.createElement('div');
            objectItem.className = 'object-item';
            objectItem.style.cssText = `
                display: flex; justify-content: space-between; align-items: center;
                margin: 5px 0; padding: 8px; background: rgba(255,255,255,0.1);
                border-radius: 5px; font-size: 0.9em;
            `;
            
            const position = this.raytracer.get_sphere_position(i);
            objectItem.innerHTML = `
                <span>Sphere ${i + 1} (${position[0].toFixed(1)}, ${position[1].toFixed(1)}, ${position[2].toFixed(1)})</span>
                <div>
                    <button onclick="app.editSphere(${i})" style="margin-right: 5px; padding: 4px 8px; font-size: 0.8em;">Edit</button>
                    <button onclick="app.removeSphere(${i})" style="padding: 4px 8px; font-size: 0.8em; background: #ff6b6b;">Remove</button>
                </div>
            `;
            listContainer.appendChild(objectItem);
        }
        
        objectListContainer.appendChild(listContainer);
    }
    
    editSphere(index) {
        const position = this.raytracer.get_sphere_position(index);
        const newX = prompt(`X position (current: ${position[0].toFixed(2)}):`, position[0]);
        const newY = prompt(`Y position (current: ${position[1].toFixed(2)}):`, position[1]);
        const newZ = prompt(`Z position (current: ${position[2].toFixed(2)}):`, position[2]);
        
        if (newX !== null && newY !== null && newZ !== null) {
            this.raytracer.set_sphere_position(index, parseFloat(newX), parseFloat(newY), parseFloat(newZ));
            this.updateObjectList();
        }
    }
    
    removeSphere(index) {
        this.raytracer.remove_sphere(index);
        this.updateObjectCount();
        this.updateObjectList();
    }
    
    toggleWASDMode() {
        this.wasdEnabled = !this.wasdEnabled;
        const status = this.wasdEnabled ? 'ENABLED' : 'DISABLED';
        console.log(`WASD Camera Mode: ${status}`);
        
        // Show notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed; top: 20px; right: 20px; background: rgba(0,0,0,0.8);
            color: #00d4aa; padding: 10px 20px; border-radius: 5px; z-index: 1000;
            font-family: monospace;
        `;
        notification.textContent = `WASD Camera Mode: ${status} (Press F to toggle)`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
    
    createCornellBox() {
        this.raytracer.clear_scene();
        
        // Cornell box spheres
        this.raytracer.add_sphere(-1, 0, -1, 0.5, 1.0, 0.2, 0.2, 0); // Red sphere
        this.raytracer.add_sphere(1, 0, -1, 0.5, 0.2, 1.0, 0.2, 1);  // Green metallic sphere
        this.raytracer.add_sphere(0, 1, -1, 0.3, 1.0, 1.0, 1.0, 2);  // Glass sphere
        
        this.updateObjectCount();
        this.updateObjectList();
    }
    
    createGlassScene() {
        this.raytracer.clear_scene();
        
        // Multiple glass spheres
        this.raytracer.add_sphere(-2, 0, -2, 0.8, 1.0, 1.0, 1.0, 2);
        this.raytracer.add_sphere(0, 0, -1, 0.6, 0.9, 0.9, 1.0, 2);
        this.raytracer.add_sphere(2, 0, -2, 0.4, 1.0, 0.9, 0.9, 2);
        
        this.updateObjectCount();
        this.updateObjectList();
    }
    
    createMetalScene() {
        this.raytracer.clear_scene();
        
        // Metallic spheres with different colors
        this.raytracer.add_sphere(-2, 0, -1, 0.7, 0.8, 0.8, 0.9, 1); // Silver
        this.raytracer.add_sphere(0, 0, -1, 0.7, 1.0, 0.8, 0.2, 1);  // Gold
        this.raytracer.add_sphere(2, 0, -1, 0.7, 0.9, 0.3, 0.3, 1);  // Copper
        
        this.updateObjectCount();
        this.updateObjectList();
    }
    
    exportScene() {
        const sceneData = this.raytracer.export_scene_json();
        const blob = new Blob([sceneData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'raytracer_scene.json';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    async importScene(file) {
        if (file) {
            try {
                const text = await file.text();
                this.raytracer.load_scene_json(text);
                this.updateObjectCount();
                this.updateObjectList();
            } catch (error) {
                alert('Failed to load scene: ' + error.message);
            }
        }
    }
    
    async loadBlenderScene(file) {
        if (file) {
            try {
                const text = await file.text();
                const blenderData = JSON.parse(text);
                
                // Convert Blender data to our format
                // This is a simplified conversion - you'd need to adapt based on your Blender export format
                this.raytracer.clear_scene();
                
                if (blenderData.objects) {
                    blenderData.objects.forEach(obj => {
                        if (obj.type === 'MESH' && obj.name.includes('Sphere')) {
                            const pos = obj.location || [0, 0, 0];
                            const scale = obj.scale ? obj.scale[0] : 1;
                            this.raytracer.add_sphere(pos[0], pos[2], -pos[1], scale, 0.7, 0.7, 0.7, 0);
                        }
                    });
                }
                
                this.updateObjectCount();
                this.updateObjectList();
            } catch (error) {
                alert('Failed to load Blender scene: ' + error.message);
            }
        }
    }
    
    updateObjectCount() {
        const sphereCount = this.raytracer.get_sphere_count();
        const raytracerCountElement = document.getElementById('raytracerObjectCount');
        const generalCountElement = document.getElementById('objectCount');
        
        if (raytracerCountElement) {
            raytracerCountElement.textContent = sphereCount;
        }
        if (generalCountElement) {
            generalCountElement.textContent = sphereCount + 1; // +1 for ground plane
        }
    }
    
    render(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Handle camera movement
        this.handleCameraMovement(deltaTime);
        
        // Render frame
        this.raytracer.render();
        
        // Update FPS
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1000 / (deltaTime || 16));
            document.getElementById('fpsDisplay').textContent = this.fps;
            document.getElementById('frameTime').textContent = `${deltaTime.toFixed(1)}ms`;
        }
        
        // Continue rendering
        this.animationId = requestAnimationFrame((time) => this.render(time));
    }
    
    handleResize() {
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        
        // Maintain 4:3 aspect ratio
        const maxWidth = Math.floor(rect.width);
        const maxHeight = Math.floor(rect.height);
        
        let width, height;
        if (maxWidth / maxHeight > 4/3) {
            // Container is wider than 4:3, constrain by height
            height = maxHeight;
            width = Math.floor(height * 4/3);
        } else {
            // Container is taller than 4:3, constrain by width
            width = maxWidth;
            height = Math.floor(width * 3/4);
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        if (this.raytracer) {
            this.raytracer.resize(width, height);
        }
        
        document.getElementById('resolution').textContent = `${width}x${height}`;
    }
    
    setupModeToggle() {
        const raytracerButton = document.getElementById('raytracerMode');
        const editorButton = document.getElementById('editorMode');
        
        if (raytracerButton) {
            raytracerButton.addEventListener('click', () => {
                console.log('Raytracer mode button clicked');
                this.switchMode('raytracer');
            });
        } else {
            console.error('Raytracer mode button not found');
        }
        
        if (editorButton) {
            editorButton.addEventListener('click', () => {
                console.log('Editor mode button clicked');
                this.switchMode('editor');
            });
        } else {
            console.error('Editor mode button not found');
        }
        
        // Test: Add debug information
        console.log('Mode toggle setup complete');
        console.log('Raytracer view exists:', !!document.getElementById('raytracerView'));
        console.log('Editor view exists:', !!document.getElementById('editorView'));
    }
    
    switchMode(mode) {
        console.log('Switching to mode:', mode);
        
        if (!this.raytracer) {
            console.error('Raytracer not initialized yet');
            return;
        }
        
        this.currentMode = mode;
        
        // Update button states
        document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
        const modeButton = document.getElementById(mode + 'Mode');
        if (modeButton) {
            modeButton.classList.add('active');
        } else {
            console.error('Mode button not found:', mode + 'Mode');
        }
        
        // Show/hide views
        document.querySelectorAll('.view-container').forEach(container => {
            container.classList.remove('active');
        });
        
        if (mode === 'raytracer') {
            const raytracerView = document.getElementById('raytracerView');
            if (raytracerView) {
                raytracerView.classList.add('active');
                console.log('Raytracer view activated');
            } else {
                console.error('Raytracer view not found');
            }
            // Release pointer lock when switching away
            if (this.isPointerLocked) {
                document.exitPointerLock();
            }
        } else {
            const editorView = document.getElementById('editorView');
            if (editorView) {
                editorView.classList.add('active');
                console.log('Editor view activated');
                try {
                    this.initializeEditorCanvases();
                    this.updateEditorObjectList();
                    this.updateEditorCameraControls();
                    this.updateEditorViews();
                } catch (error) {
                    console.error('Error initializing editor:', error);
                }
            } else {
                console.error('Editor view not found');
            }
        }
    }
    
    setupSceneEditor() {
        // Editor controls for adding objects
        document.getElementById('editorAddSphere').addEventListener('click', () => {
            this.addObjectInEditor('sphere');
        });
        
        document.getElementById('editorAddBox').addEventListener('click', () => {
            this.addObjectInEditor('box');
        });
        
        document.getElementById('editorAddCylinder').addEventListener('click', () => {
            this.addObjectInEditor('cylinder');
        });
        
        document.getElementById('editorAddPlane').addEventListener('click', () => {
            this.addObjectInEditor('plane');
        });
        
        // OBJ import controls
        document.getElementById('importObjBtn').addEventListener('click', () => {
            const fileInput = document.getElementById('objFileInput');
            fileInput.click();
        });
        
        document.getElementById('objFileInput').addEventListener('change', (e) => {
            this.handleObjFileImport(e);
        });
        
        document.getElementById('editorClearScene').addEventListener('click', () => {
            this.raytracer.clear_scene();
            this.selectedObject = null;
            this.updateObjectCount();
            this.updateEditorObjectList();
            this.updateEditorViews();
        });
        
        document.getElementById('editorRandomScene').addEventListener('click', () => {
            this.raytracer.random_scene();
            this.selectedObject = null;
            this.updateObjectCount();
            this.updateEditorObjectList();
            this.updateEditorViews();
        });

        // Object type selection
        document.getElementById('editorObjectType').addEventListener('change', (e) => {
            this.updateParameterVisibility(e.target.value);
            this.updateSelectedObjectFromEditor();
        });

        // Position controls
        document.getElementById('editorPosX').addEventListener('input', (e) => {
            document.getElementById('editorPosXValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });
        
        document.getElementById('editorPosY').addEventListener('input', (e) => {
            document.getElementById('editorPosYValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });
        
        document.getElementById('editorPosZ').addEventListener('input', (e) => {
            document.getElementById('editorPosZValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });

        // Sphere controls
        document.getElementById('editorRadius').addEventListener('input', (e) => {
            document.getElementById('editorRadiusValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });

        // Box controls
        document.getElementById('editorBoxWidth').addEventListener('input', (e) => {
            document.getElementById('editorBoxWidthValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });
        
        document.getElementById('editorBoxHeight').addEventListener('input', (e) => {
            document.getElementById('editorBoxHeightValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });
        
        document.getElementById('editorBoxDepth').addEventListener('input', (e) => {
            document.getElementById('editorBoxDepthValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });

        // Cylinder controls
        document.getElementById('editorCylinderRadius').addEventListener('input', (e) => {
            document.getElementById('editorCylinderRadiusValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });
        
        document.getElementById('editorCylinderHeight').addEventListener('input', (e) => {
            document.getElementById('editorCylinderHeightValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });

        // Plane controls
        document.getElementById('editorPlaneNormalX').addEventListener('input', (e) => {
            document.getElementById('editorPlaneNormalXValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });
        
        document.getElementById('editorPlaneNormalY').addEventListener('input', (e) => {
            document.getElementById('editorPlaneNormalYValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });
        
        document.getElementById('editorPlaneNormalZ').addEventListener('input', (e) => {
            document.getElementById('editorPlaneNormalZValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });

        // Material controls
        document.getElementById('editorMaterialType').addEventListener('change', (e) => {
            this.updateMaterialControls(parseInt(e.target.value));
            this.updateSelectedObjectFromEditor();
        });
        
        document.getElementById('editorObjectColor').addEventListener('change', (e) => {
            this.updateSelectedObjectFromEditor();
        });

        document.getElementById('editorRoughness').addEventListener('input', (e) => {
            document.getElementById('editorRoughnessValue').textContent = parseFloat(e.target.value).toFixed(2);
            this.updateSelectedObjectFromEditor();
        });

        document.getElementById('editorIor').addEventListener('input', (e) => {
            document.getElementById('editorIorValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateSelectedObjectFromEditor();
        });
        
        document.getElementById('applyProperties').addEventListener('click', () => {
            this.updateSelectedObjectFromEditor();
        });

        document.getElementById('deleteSelected').addEventListener('click', () => {
            this.deleteSelectedObject();
        });

        // Camera controls
        document.getElementById('editorCamX').addEventListener('input', (e) => {
            document.getElementById('editorCamXValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateCameraFromEditor();
        });
        
        document.getElementById('editorCamY').addEventListener('input', (e) => {
            document.getElementById('editorCamYValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateCameraFromEditor();
        });
        
        document.getElementById('editorCamZ').addEventListener('input', (e) => {
            document.getElementById('editorCamZValue').textContent = parseFloat(e.target.value).toFixed(1);
            this.updateCameraFromEditor();
        });
        
        document.getElementById('editorResetCamera').addEventListener('click', () => {
            this.raytracer.set_camera_position(0.0, 2.0, 5.0);
            this.raytracer.set_camera_target(0.0, 0.0, 0.0);
            this.updateEditorCameraControls();
        });
    }
    
    addObjectInEditor(objectType) {
        // Default settings for different object types
        const x = 0.0, y = 0.0, z = -2.0;
        const r = 1.0, g = 0.4, b = 0.4; // Default red color
        const materialType = 0; // Lambertian
        
        switch (objectType) {
            case 'sphere':
                this.raytracer.add_sphere(x, y, z, 1.0, r, g, b, materialType);
                break;
            case 'box':
                this.raytracer.add_box(x, y, z, 1.0, 1.0, 1.0, r, g, b, materialType);
                break;
            case 'cylinder':
                this.raytracer.add_cylinder(x, y, z, 0.5, 2.0, r, g, b, materialType);
                break;
            case 'plane':
                this.raytracer.add_plane(x, y, z, 0.0, 1.0, 0.0, r, g, b, materialType);
                break;
        }
        
        this.updateObjectCount();
        this.updateEditorObjectList();
        this.updateEditorViews();
        
        // Select the newly added object (assuming spheres for now - will need to track object types)
        const sphereCount = this.raytracer.get_sphere_count();
        if (sphereCount > 0 && objectType === 'sphere') {
            this.selectObject('sphere', sphereCount - 1);
        }
    }

    handleObjFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Update status
        const statusEl = document.getElementById('importStatus');
        statusEl.textContent = 'Reading file...';
        statusEl.className = 'status-text';

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                statusEl.textContent = 'Parsing OBJ file...';
                
                // Get the file content
                const objContent = e.target.result;
                
                // Default material properties for imported objects
                const name = file.name.replace('.obj', '');
                const r = 0.7;  // Default red color
                const g = 0.3;  // 
                const b = 0.3;  // 
                const materialType = 0; // Lambertian
                const roughness = 0.0;
                const ior = 1.5;
                
                // Call the Rust function to parse and add the mesh
                this.raytracer.import_obj_file(objContent, name, r, g, b, materialType, roughness, ior);
                
                statusEl.textContent = 'OBJ file imported successfully!';
                statusEl.className = 'status-text success';
                
                // Update the scene editor
                this.updateObjectCount();
                this.updateEditorObjectList();
                this.updateEditorViews();
                
                // Clear the file input for next use
                event.target.value = '';
            } catch (error) {
                console.error('Error importing OBJ file:', error);
                statusEl.textContent = 'Error importing OBJ file: ' + error.message;
                statusEl.className = 'status-text error';
            }
        };

        reader.onerror = () => {
            statusEl.textContent = 'Error reading file.';
            statusEl.className = 'status-text error';
        };

        reader.readAsText(file);
    }

    updateParameterVisibility(objectType) {
        // Hide all parameter groups first
        document.getElementById('sphereParams').style.display = 'none';
        document.getElementById('boxParams').style.display = 'none';
        document.getElementById('cylinderParams').style.display = 'none';
        document.getElementById('planeParams').style.display = 'none';
        
        // Show the relevant parameter group
        switch (objectType) {
            case 'sphere':
                document.getElementById('sphereParams').style.display = 'block';
                break;
            case 'box':
                document.getElementById('boxParams').style.display = 'block';
                break;
            case 'cylinder':
                document.getElementById('cylinderParams').style.display = 'block';
                break;
            case 'plane':
                document.getElementById('planeParams').style.display = 'block';
                break;
        }
    }

    updateMaterialControls(materialType) {
        const roughnessParam = document.getElementById('roughnessParam');
        const iorParam = document.getElementById('iorParam');
        
        // Show/hide relevant material parameters
        switch (materialType) {
            case 0: // Lambertian
                roughnessParam.style.display = 'none';
                iorParam.style.display = 'none';
                break;
            case 1: // Metal
                roughnessParam.style.display = 'block';
                iorParam.style.display = 'none';
                break;
            case 2: // Dielectric/Glass
                roughnessParam.style.display = 'none';
                iorParam.style.display = 'block';
                break;
        }
    }

    deleteSelectedObject() {
        if (this.selectedObject === null) return;
        
        // For now, we'll only handle spheres since that's what's implemented
        // This will need to be expanded when we support all geometry types
        if (this.selectedObject.type === 'sphere') {
            this.raytracer.remove_sphere(this.selectedObject.index);
        }
        
        this.selectedObject = null;
        this.updateObjectCount();
        this.updateEditorObjectList();
        this.updateEditorViews();
    }

    addSphereInEditor() {
        this.addObjectInEditor('sphere');
    }
    
    selectObject(type, index) {
        this.selectedObject = { type, index };
        this.updateEditorObjectList();
        this.updateObjectPropertiesFromSelected();
        this.render(); // Update rendering to show selection
    }

    rgbToHex(r, g, b) {
        const toHex = (c) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16) / 255.0,
            parseInt(result[2], 16) / 255.0,
            parseInt(result[3], 16) / 255.0
        ] : [1.0, 1.0, 1.0];
    }
    
    updateObjectPropertiesFromSelected() {
        if (this.selectedObject === null) return;
        
        // For now, handle only spheres since that's what's currently implemented
        if (this.selectedObject.type === 'sphere') {
            const pos = this.raytracer.get_sphere_position(this.selectedObject.index);
            const radius = this.raytracer.get_sphere_radius(this.selectedObject.index);
            
            // Update object type dropdown
            document.getElementById('editorObjectType').value = 'sphere';
            this.updateParameterVisibility('sphere');
            
            // Update position controls
            document.getElementById('editorPosX').value = pos[0];
            document.getElementById('editorPosXValue').textContent = pos[0].toFixed(1);
            document.getElementById('editorPosY').value = pos[1];
            document.getElementById('editorPosYValue').textContent = pos[1].toFixed(1);
            document.getElementById('editorPosZ').value = pos[2];
            document.getElementById('editorPosZValue').textContent = pos[2].toFixed(1);
            
            // Update radius control
            document.getElementById('editorRadius').value = radius;
            document.getElementById('editorRadiusValue').textContent = radius.toFixed(1);
        }
    }
    
    initializeEditorCanvases() {
        if (Object.keys(this.viewCanvases).length > 0) return; // Already initialized
        
        this.viewCanvases = {
            top: document.getElementById('topView'),
            side: document.getElementById('sideView'),
            front: document.getElementById('frontView'),
            preview: document.getElementById('previewCanvas')
        };
        
        // Setup canvas event listeners for object manipulation
        Object.entries(this.viewCanvases).forEach(([viewName, canvas]) => {
            canvas.addEventListener('click', (e) => this.handleCanvasClick(viewName, e));
            canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(viewName, e));
        });
    }
    
    updateEditorViews() {
        if (!this.viewCanvases.top) return;
        
        Object.entries(this.viewCanvases).forEach(([viewName, canvas]) => {
            this.drawView(viewName, canvas);
        });
    }
    
    drawView(viewName, canvas) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, width, height);
        
        // Draw grid
        this.drawGrid(ctx, width, height, viewName);
        
        // Draw objects
        this.drawObjectsInView(ctx, width, height, viewName);
        
        // Draw camera
        this.drawCameraInView(ctx, width, height, viewName);
    }
    
    drawGrid(ctx, width, height, viewName) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        const gridSize = 50; // pixels per unit
        const centerX = width / 2;
        const centerY = height / 2;
        
        // Vertical lines
        for (let x = centerX % gridSize; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = centerY % gridSize; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Axes
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, height);
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
    }
    
    drawObjectsInView(ctx, width, height, viewName) {
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = 50; // pixels per unit
        
        // Draw spheres
        const sphereCount = this.raytracer.get_sphere_count();
        for (let i = 0; i < sphereCount; i++) {
            const pos = this.raytracer.get_sphere_position(i);
            const radius = this.raytracer.get_sphere_radius(i);
            let screenX, screenY, displayRadius;
            
            // Project to 2D based on view
            switch (viewName) {
                case 'top': // XZ view
                    screenX = centerX + pos[0] * scale;
                    screenY = centerY + pos[2] * scale;
                    displayRadius = radius * scale;
                    break;
                case 'side': // XY view
                    screenX = centerX + pos[0] * scale;
                    screenY = centerY - pos[1] * scale;
                    displayRadius = radius * scale;
                    break;
                case 'front': // YZ view
                    screenX = centerX + pos[1] * scale;
                    screenY = centerY + pos[2] * scale;
                    displayRadius = radius * scale;
                    break;
                default:
                    continue;
            }
            
            // Check if this sphere is selected
            const isSelected = this.selectedObject && 
                              this.selectedObject.type === 'sphere' && 
                              this.selectedObject.index === i;
            
            // Draw sphere as circle
            ctx.fillStyle = isSelected ? '#00d4aa' : '#e94560';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.arc(screenX, screenY, Math.max(displayRadius, 8), 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            
            // Draw type indicator and index
            ctx.fillStyle = '#fff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('S' + i, screenX, screenY + 3);
        }
        
        // TODO: Draw other object types when they're available
        // For now, we'll add placeholder functions for future geometry types
        
        // Draw boxes (when implemented)
        this.drawBoxesInView(ctx, width, height, viewName, centerX, centerY, scale);
        
        // Draw cylinders (when implemented)
        this.drawCylindersInView(ctx, width, height, viewName, centerX, centerY, scale);
        
        // Draw planes (when implemented)
        this.drawPlanesInView(ctx, width, height, viewName, centerX, centerY, scale);
    }
    
    drawBoxesInView(ctx, width, height, viewName, centerX, centerY, scale) {
        // Placeholder for box drawing - will be implemented when WASM bindings are ready
        // const boxCount = this.raytracer.get_box_count();
        // for (let i = 0; i < boxCount; i++) { ... }
    }
    
    drawCylindersInView(ctx, width, height, viewName, centerX, centerY, scale) {
        // Placeholder for cylinder drawing - will be implemented when WASM bindings are ready
        // const cylinderCount = this.raytracer.get_cylinder_count();
        // for (let i = 0; i < cylinderCount; i++) { ... }
    }
    
    drawPlanesInView(ctx, width, height, viewName, centerX, centerY, scale) {
        // Placeholder for plane drawing - will be implemented when WASM bindings are ready
        // const planeCount = this.raytracer.get_plane_count();
        // for (let i = 0; i < planeCount; i++) { ... }
    }
    
    drawCameraInView(ctx, width, height, viewName) {
        const camPos = this.raytracer.get_camera_position();
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = 50;
        
        let screenX, screenY;
        
        switch (viewName) {
            case 'top': // XZ view
                screenX = centerX + camPos[0] * scale;
                screenY = centerY + camPos[2] * scale;
                break;
            case 'side': // XY view
                screenX = centerX + camPos[0] * scale;
                screenY = centerY - camPos[1] * scale;
                break;
            case 'front': // YZ view
                screenX = centerX + camPos[1] * scale;
                screenY = centerY + camPos[2] * scale;
                break;
            default:
                return;
        }
        
        // Draw camera as triangle
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - 10);
        ctx.lineTo(screenX - 8, screenY + 8);
        ctx.lineTo(screenX + 8, screenY + 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    handleCanvasClick(viewName, event) {
        const canvas = this.viewCanvases[viewName];
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Check if clicking on an object
        const clickedObject = this.getObjectAtPosition(viewName, x, y);
        if (clickedObject !== null) {
            this.selectObject(clickedObject.type, clickedObject.index);
        }
    }
    
    getObjectAtPosition(viewName, screenX, screenY) {
        const sphereCount = this.raytracer.get_sphere_count();
        const centerX = this.viewCanvases[viewName].width / 2;
        const centerY = this.viewCanvases[viewName].height / 2;
        const scale = 50;
        
        // Check spheres
        for (let i = 0; i < sphereCount; i++) {
            const pos = this.raytracer.get_sphere_position(i);
            let objScreenX, objScreenY;
            
            switch (viewName) {
                case 'top':
                    objScreenX = centerX + pos[0] * scale;
                    objScreenY = centerY + pos[2] * scale;
                    break;
                case 'side':
                    objScreenX = centerX + pos[0] * scale;
                    objScreenY = centerY - pos[1] * scale;
                    break;
                case 'front':
                    objScreenX = centerX + pos[1] * scale;
                    objScreenY = centerY + pos[2] * scale;
                    break;
                default:
                    continue;
            }
            
            const distance = Math.sqrt((screenX - objScreenX) ** 2 + (screenY - objScreenY) ** 2);
            if (distance <= 20) { // Click tolerance
                return { type: 'sphere', index: i };
            }
        }
        
        // TODO: Add detection for other object types when implemented
        // Check boxes, cylinders, planes...
        
        return null;
    }

    loadObjectProperties(index) {
        const pos = this.raytracer.get_sphere_position(index);
        const radius = this.raytracer.get_sphere_radius(index);
        
        document.getElementById('editorPosX').value = pos[0];
        document.getElementById('editorPosXValue').textContent = pos[0].toFixed(1);
        document.getElementById('editorPosY').value = pos[1];
        document.getElementById('editorPosYValue').textContent = pos[1].toFixed(1);
        document.getElementById('editorPosZ').value = pos[2];
        document.getElementById('editorPosZValue').textContent = pos[2].toFixed(1);
        document.getElementById('editorRadius').value = radius;
        document.getElementById('editorRadiusValue').textContent = radius.toFixed(1);
    }
    
    updateSelectedObjectFromEditor() {
        if (this.selectedObject === null) return;
        
        const x = parseFloat(document.getElementById('editorPosX').value);
        const y = parseFloat(document.getElementById('editorPosY').value);
        const z = parseFloat(document.getElementById('editorPosZ').value);
        const materialType = parseInt(document.getElementById('editorMaterialType').value);
        const color = document.getElementById('editorObjectColor').value;
        
        // Convert hex color to RGB
        const r = parseInt(color.substr(1, 2), 16) / 255;
        const g = parseInt(color.substr(3, 2), 16) / 255;
        const b = parseInt(color.substr(5, 2), 16) / 255;
        
        // Get material properties
        let roughness = 0.0;
        let ior = 1.5;
        
        if (materialType === 1) { // Metal
            roughness = parseFloat(document.getElementById('editorRoughness').value);
        } else if (materialType === 2) { // Glass
            ior = parseFloat(document.getElementById('editorIor').value);
        }
        
        // Update based on object type
        if (this.selectedObject.type === 'sphere') {
            const radius = parseFloat(document.getElementById('editorRadius').value);
            this.raytracer.set_sphere_position(this.selectedObject.index, x, y, z);
            this.raytracer.set_sphere_radius(this.selectedObject.index, radius);
            this.raytracer.set_sphere_material(this.selectedObject.index, r, g, b, materialType, roughness, ior);
        }
        // TODO: Add support for other object types when WASM bindings are ready
        
        this.updateEditorObjectList();
        this.updateEditorViews();
    }
    
    updateCameraFromEditor() {
        const x = parseFloat(document.getElementById('editorCamX').value);
        const y = parseFloat(document.getElementById('editorCamY').value);
        const z = parseFloat(document.getElementById('editorCamZ').value);
        
        this.raytracer.set_camera_position(x, y, z);
        this.updateEditorViews();
    }
    
    updateEditorCameraControls() {
        try {
            const pos = this.raytracer.get_camera_position();
            document.getElementById('editorCamX').value = pos[0];
            document.getElementById('editorCamXValue').textContent = pos[0].toFixed(1);
            document.getElementById('editorCamY').value = pos[1];
            document.getElementById('editorCamYValue').textContent = pos[1].toFixed(1);
            document.getElementById('editorCamZ').value = pos[2];
            document.getElementById('editorCamZValue').textContent = pos[2].toFixed(1);
        } catch (error) {
            console.error('Error updating editor camera controls:', error);
        }
    }
    
    updateEditorObjectList() {
        const listContainer = document.getElementById('editorObjectList');
        listContainer.innerHTML = '';
        
        const sphereCount = this.raytracer.get_sphere_count();
        // TODO: Add counts for other object types when implemented
        // const boxCount = this.raytracer.get_box_count();
        // const cylinderCount = this.raytracer.get_cylinder_count();
        // const planeCount = this.raytracer.get_plane_count();
        
        const totalObjects = sphereCount; // + boxCount + cylinderCount + planeCount;
        
        if (totalObjects === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'No objects in scene. Add objects to start.';
            emptyMessage.style.cssText = `
                padding: 10px;
                color: #666;
                font-style: italic;
                text-align: center;
                background: rgba(255,255,255,0.05);
                border-radius: 5px;
                margin: 10px 0;
            `;
            listContainer.appendChild(emptyMessage);
            return;
        }
        
        // Add spheres to list
        for (let i = 0; i < sphereCount; i++) {
            const position = this.raytracer.get_sphere_position(i);
            const objectItem = document.createElement('div');
            objectItem.className = 'object-item';
            
            const isSelected = this.selectedObject && 
                              this.selectedObject.type === 'sphere' && 
                              this.selectedObject.index === i;
            
            if (isSelected) {
                objectItem.classList.add('selected');
            }
            
            // Add sphere icon and info
            objectItem.innerHTML = `
                <span class="object-icon">🔴</span>
                <span class="object-info">
                    <strong>Sphere ${i + 1}</strong><br>
                    <small>(${position[0].toFixed(1)}, ${position[1].toFixed(1)}, ${position[2].toFixed(1)})</small>
                </span>
            `;
            
            objectItem.addEventListener('click', () => {
                this.selectObject('sphere', i);
            });
            
            listContainer.appendChild(objectItem);
        }
        
        // TODO: Add other object types when implemented
        /*
        // Add boxes to list
        for (let i = 0; i < boxCount; i++) {
            // Similar implementation for boxes
        }
        
        // Add cylinders to list
        for (let i = 0; i < cylinderCount; i++) {
            // Similar implementation for cylinders
        }
        
        // Add planes to list
        for (let i = 0; i < planeCount; i++) {
            // Similar implementation for planes
        }
        */
    }
    
    handleCanvasMouseMove(viewName, event) {
        // Update coordinates display
        const canvas = this.viewCanvases[viewName];
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = 50;
        
        let worldX, worldY;
        let coordsElement;
        
        switch (viewName) {
            case 'top':
                worldX = (x - centerX) / scale;
                worldY = (y - centerY) / scale;
                coordsElement = document.getElementById('topCoords');
                coordsElement.textContent = `X: ${worldX.toFixed(1)}, Z: ${worldY.toFixed(1)}`;
                break;
            case 'side':
                worldX = (x - centerX) / scale;
                worldY = -(y - centerY) / scale;
                coordsElement = document.getElementById('sideCoords');
                coordsElement.textContent = `X: ${worldX.toFixed(1)}, Y: ${worldY.toFixed(1)}`;
                break;
            case 'front':
                worldX = (x - centerX) / scale;
                worldY = (y - centerY) / scale;
                coordsElement = document.getElementById('frontCoords');
                coordsElement.textContent = `Y: ${worldX.toFixed(1)}, Z: ${worldY.toFixed(1)}`;
                break;
        }
    }
}

// Global app instance for onclick handlers
let app;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    app = new RaytracerApp();
});
