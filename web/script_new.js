class RaytracerApp {
    constructor() {
        this.raytracer = null;
        this.canvas = null;
        this.animationId = null;
        this.lastTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        
        // Camera controls
        this.keys = {};
        this.moveSpeed = 2.0;
        this.mouseSensitivity = 0.5;
        this.wasdEnabled = false; // Disabled by default
        
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
            this.updateObjectCount();
            this.updateObjectList();
            
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
        // Canvas click to add objects (Ctrl+click)
        this.canvas.addEventListener('click', (event) => {
            if (event.ctrlKey) {
                this.addSphereAtClick(event);
            }
        });
        
        // WASD controls (optional)
        document.addEventListener('keydown', (event) => {
            if (this.wasdEnabled) {
                this.keys[event.code] = true;
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
        // Add sphere button
        document.getElementById('addSphere').addEventListener('click', () => {
            this.addConfiguredSphere();
        });
        
        // Clear scene button
        document.getElementById('clearScene').addEventListener('click', () => {
            this.raytracer.clear_scene();
            this.updateObjectCount();
            this.updateObjectList();
        });
        
        // Random scene button
        document.getElementById('randomScene').addEventListener('click', () => {
            this.raytracer.random_scene();
            this.updateObjectCount();
            this.updateObjectList();
        });
        
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
        
        // Radius control
        document.getElementById('radius').addEventListener('input', (event) => {
            document.getElementById('radiusValue').textContent = event.target.value;
        });
        
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
        if (!this.wasdEnabled) return;
        
        let forward = 0, right = 0, up = 0;
        const speed = this.moveSpeed * deltaTime / 1000;
        
        if (this.keys['KeyW']) forward += speed;
        if (this.keys['KeyS']) forward -= speed;
        if (this.keys['KeyA']) right -= speed;
        if (this.keys['KeyD']) right += speed;
        if (this.keys['Space']) up += speed;
        if (this.keys['ShiftLeft']) up -= speed;
        
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
        const count = this.raytracer.get_sphere_count() + 1; // +1 for ground plane
        document.getElementById('objectCount').textContent = count;
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
        const rect = this.canvas.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        if (this.raytracer) {
            this.raytracer.resize(width, height);
        }
        
        document.getElementById('resolution').textContent = `${width}x${height}`;
    }
}

// Global app instance for onclick handlers
let app;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    app = new RaytracerApp();
});
