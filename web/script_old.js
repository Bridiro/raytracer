import init, { Raytracer } from './pkg/raytracer.js';

class RaytracerApp {
    constructor() {
        this.raytracer = null;
        this.canvas = null;
        this.isPointerLocked = false;
        this.moveSpeed = 2.0;
        this.mouseSensitivity = 0.5;
        this.keys = {};
        this.lastTime = 0;
        this.objectCount = 3; // Start with default scene objects
        
        this.init();
    }
    
    async init() {
        try {
            await init();
            
            this.canvas = document.getElementById('raytracerCanvas');
            this.raytracer = new Raytracer('raytracerCanvas', this.canvas.width, this.canvas.height);
            
            this.setupEventListeners();
            this.setupControls();
            this.updateObjectCount();
            this.animate();
            
            console.log('Raytracer initialized successfully!');
        } catch (error) {
            console.error('Failed to initialize raytracer:', error);
            document.body.innerHTML = `<div style="color: red; padding: 20px; text-align: center;">
                <h2>Failed to load raytracer</h2>
                <p>Error: ${error}</p>
                <p>Make sure the WASM files are properly built.</p>
            </div>`;
        }
    }
    
    setupEventListeners() {
        // Canvas click to add objects (instead of mouse capture)
        this.canvas.addEventListener('click', (event) => {
            if (event.ctrlKey) {
                // Ctrl+click to add sphere at clicked position
                this.addSphereAtClick(event);
            }
        });
        
        // Optional WASD controls (disabled by default)
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
        if (!this.isPointerLocked) return;
        
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
            objectListContainer.innerHTML = '<h4>Scene Objects</h4>';
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
            objectItem.innerHTML = `
                <span>Sphere ${i + 1}</span>
                <button onclick="app.editSphere(${i})" class="btn-small">Edit</button>
                <button onclick="app.removeSphere(${i})" class="btn-small danger">Remove</button>
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
        `;
        notification.textContent = `WASD Camera Mode: ${status} (Press F to toggle)`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
    
    updateObjectCount() {
        const count = this.raytracer.get_sphere_count() + 1; // +1 for ground plane
        document.getElementById('objectCount').textContent = count;
    }
        const materialType = parseInt(document.getElementById('materialType').value);
        const radius = parseFloat(document.getElementById('radius').value);
        const color = this.hexToRgb(document.getElementById('sphereColor').value);
        
        // Random position
        const x = (Math.random() - 0.5) * 10;
        const y = Math.random() * 3;
        const z = (Math.random() - 0.5) * 10;
        
        this.raytracer.add_sphere(x, y, z, radius, color.r, color.g, color.b, materialType);
        this.objectCount++;
        this.updateObjectCount();
    }
    
    generateRandomScene() {
        this.raytracer.clear_scene();
        this.objectCount = 1; // Ground plane
        
        // Add random spheres
        for (let i = 0; i < 15; i++) {
            const x = (Math.random() - 0.5) * 20;
            const y = Math.random() * 2;
            const z = (Math.random() - 0.5) * 20;
            const radius = 0.2 + Math.random() * 1.3;
            const materialType = Math.floor(Math.random() * 3);
            
            const r = Math.random();
            const g = Math.random();
            const b = Math.random();
            
            this.raytracer.add_sphere(x, y, z, radius, r, g, b, materialType);
            this.objectCount++;
        }
        
        this.updateObjectCount();
    }
    
    createCornellBox() {
        this.raytracer.clear_scene();
        this.objectCount = 1; // Ground plane
        
        // Cornell box setup with colored walls
        this.raytracer.add_sphere(-1, 0, 0, 0.5, 0.8, 0.8, 0.8, 1); // Metal
        this.raytracer.add_sphere(1, 0, 0, 0.5, 1.0, 1.0, 1.0, 2);  // Glass
        this.raytracer.add_sphere(0, -0.5, -1, 0.3, 0.7, 0.3, 0.8, 0); // Lambertian
        this.objectCount += 3;
        
        this.updateObjectCount();
    }
    
    createGlassScene() {
        this.raytracer.clear_scene();
        this.objectCount = 1; // Ground plane
        
        // Various glass spheres with different properties
        this.raytracer.add_sphere(0, 0, 0, 1.0, 1.0, 1.0, 1.0, 2);
        this.raytracer.add_sphere(-2, 0, 1, 0.6, 0.9, 1.0, 0.9, 2);
        this.raytracer.add_sphere(2, 0, 1, 0.6, 1.0, 0.9, 0.9, 2);
        this.raytracer.add_sphere(0, 1.5, 0, 0.4, 0.9, 0.9, 1.0, 2);
        this.objectCount += 4;
        
        this.updateObjectCount();
    }
    
    createMetalScene() {
        this.raytracer.clear_scene();
        this.objectCount = 1; // Ground plane
        
        // Various metal spheres
        this.raytracer.add_sphere(0, 0, 0, 1.0, 0.8, 0.8, 0.9, 1);
        this.raytracer.add_sphere(-2, 0, 0, 0.7, 0.9, 0.7, 0.3, 1);
        this.raytracer.add_sphere(2, 0, 0, 0.7, 0.3, 0.7, 0.9, 1);
        this.raytracer.add_sphere(0, 0, -2, 0.5, 0.7, 0.9, 0.7, 1);
        this.raytracer.add_sphere(0, 1.2, 0, 0.3, 0.9, 0.9, 0.9, 1);
        this.objectCount += 5;
        
        this.updateObjectCount();
    }
    
    exportScene() {
        const sceneJson = this.raytracer.export_scene_json();
        const blob = new Blob([sceneJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'raytracer_scene.json';
        a.click();
        URL.revokeObjectURL(url);
    }
    
    async importScene(file) {
        if (!file) return;
        
        try {
            const text = await file.text();
            this.raytracer.load_scene_json(text);
            this.objectCount = 10; // Estimate - in real implementation we'd count from scene
            this.updateObjectCount();
        } catch (error) {
            console.error('Failed to import scene:', error);
            alert('Failed to import scene. Please check the file format.');
        }
    }
    
    async loadBlenderScene(file) {
        if (!file) return;
        
        try {
            const text = await file.text();
            this.raytracer.load_scene_json(text);
            this.objectCount = 10; // Estimate
            this.updateObjectCount();
        } catch (error) {
            console.error('Failed to load Blender scene:', error);
            alert('Failed to load Blender scene. Please check the file format.');
        }
    }
    
    updateObjectCount() {
        document.getElementById('objectCount').textContent = this.objectCount.toString();
    }
    
    handleResize() {
        const rect = this.canvas.getBoundingClientRect();
        const width = Math.floor(rect.width);
        const height = Math.floor(rect.height);
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.raytracer.resize(width, height);
        document.getElementById('resolution').textContent = `${width}x${height}`;
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : {r: 1, g: 1, b: 1};
    }
    
    animate(currentTime = 0) {
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Handle camera movement
        this.handleCameraMovement(deltaTime);
        
        // Render frame
        try {
            this.raytracer.render();
            
            // Update FPS
            const fps = this.raytracer.get_fps();
            document.getElementById('fpsDisplay').textContent = fps.toFixed(1);
            document.getElementById('frameTime').textContent = `${(1000/fps).toFixed(1)}ms`;
        } catch (error) {
            console.error('Render error:', error);
        }
        
        requestAnimationFrame((time) => this.animate(time));
    }
}

// Initialize the application when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new RaytracerApp();
});