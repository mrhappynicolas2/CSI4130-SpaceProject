// imports
import * as THREE from 'three'; // three.js
import { initKeyboardControls, heightController, lengthController, fpsController, settings, ammoController,
    showHitboxController
 } from './guiControls.js'; // gui details
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // allows loading models in .glb format
import { FireEffect } from './fire.js'; // fire particles
import FireParticleEffect from './fireParticleEffect/fire.js';

// all content and drawings will be organized in a scenegraph
const scene = new THREE.Scene();

// initialize a camera to look at scene's content and drawings
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// TODO: set up the camera's position
camera.position.x = 3;
camera.position.y = 6;
camera.position.z = 0;

// initialize a renderer and set a state (size)
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);

// add the output of the renderer to the HTML element
document.body.appendChild(renderer.domElement);

// use ambient lighting for brighter scene
const ambientLight = new THREE.AmbientLight('white');

// create controls
const controls = new OrbitControls(camera, renderer.domElement);

// create three.js helpers for axis and grid
const axesHelper = new THREE.AxesHelper(2);
const gridhelper = new THREE.GridHelper(50, 50);

// added vertical grid
const verticalGrid = new THREE.GridHelper(50, 50);
verticalGrid.rotation.x = Math.PI / 2; // rotate 90 degrees to align with the YZ plane
verticalGrid.position.z = -25; // move the grid to the back of the scene
//scene.add(verticalGrid, gridhelper);

// add the controls, axis lines/helper, and the ambient lighting to the scene
scene.add(controls, axesHelper, ambientLight);

const hitboxes = []
const fireParticleSystems = []


// variables to keep track of rocket and bullets
let rocketGroup, rocketHealth, rocket;
rocketHealth = 100;
let bulletModel;
let lastShotTime = 0;

// variables to keep track of missiles/projectiles
const missileSpeed = 0.25;
const missileLifetime = 5000; // 5 seconds in milliseconds
const targetDistanceThreshold = 10; // minimum distance for missle to target asteroid 

// keep track of all bullets and asteroids
const bullets = [];
const asteroids = [];
const secondaryBullets = [];
let lastSecondaryShotTimes = 0;

// variable for all the stars in the background
const starField = createStarField();

/**
 * keys state
 * 0 : up key
 * 1 : right key pressed
 * 2 : down key pressed
 * 3 : left key pressed
 */
let arrowKeysState = [false, false, false, false] 
initKeypressEventListeners()

// create a group for the rocket and add it to the scene after rotating in Y
rocketGroup = new THREE.Group()
rocketGroup.rotateY(-Math.PI/2)
scene.add(rocketGroup)

let orangeCone, orangeCone2, orangeCone3;
let AmmoJS = 0

const shields = [];
let shieldActive = false;
let shieldActivationTime = 0;
setInterval(createShieldPowerUp, 7500);

// initialize a loader to load models in .glb format
const loader = new GLTFLoader();
loader.load('models/spaceship.glb', function (gltf) {
    // add it to scene
    scene.add(gltf.scene);
    rocket = gltf.scene;

    
    // add rocket to our rocket group
    rocketGroup.add(rocket)

    // scale the rocket in size
    rocket.scale.set(0.2, 0.2, 0.2);
    const rocketHitbox = new THREE.BoxHelper(rocket, 'green')
    // rocketHitbox.scale.set(0.9, 1.2, 0.8)
    rocketHitbox.scale.set(0.1, 0.1, 0.1)
    rocketHitbox.update()
    hitboxes.push(rocketHitbox)
    rocketGroup.add(rocketHitbox)
   


    // TODO: position the rocket to the center of the scene
    // rocket.position.x = 5;
    // rocket.position.y = 0.5;
    rocket.position.y = 0.5;

    fireParticleSystems.push(
        new FireParticleEffect(rocket, new THREE.Vector3(0, 5.4, -9.5)),
        new FireParticleEffect(rocket, new THREE.Vector3(-1.5, 3, -9.5)),
        new FireParticleEffect(rocket, new THREE.Vector3(1.5, 3, -9.5))
    )

    // create geometries and materials
    const sphereGeometry = new THREE.ConeGeometry(1, 2, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xFFA500 });
    orangeCone = new THREE.Mesh(sphereGeometry, sphereMaterial);
    orangeCone.position.set(0, 5.4, -10.25);
    
    orangeCone.rotation.x = -Math.PI / 2;

    // add to our rocket
    // rocket.add(orangeCone);
 
    orangeCone2 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    orangeCone2.position.set(-1.5, 3, -10.25);
    
    orangeCone2.rotation.x = -Math.PI / 2;

    // add to our rocket
    // rocket.add(orangeCone2);
  
    orangeCone3 = new THREE.Mesh(sphereGeometry, sphereMaterial);
    orangeCone3.position.set(1.5, 3, -10.25);
    
    orangeCone3.rotation.x = -Math.PI / 2;

    // add to our rocket
    // rocket.add(orangeCone3);

}, undefined, function (error) {
    // in case of error
    console.error(error);
});

loader.load('models/rocket.glb', function (gltf) {
    // create bullet model
    bulletModel = gltf.scene;

    // scale the bullet in size
    bulletModel.scale.set(0.05, 0.05, 0.05);
}, undefined, function (error) {
    // in case of error
    console.error(error);
});

// create a shield for our rocket and add it to our group while scaling in size
const material = new THREE.PointsMaterial({
    color: 0x0050FF,
    size: 0.1,       // Adjust point size
    transparent: false,
    opacity: 0.9
});
const shield = new THREE.Points(new THREE.IcosahedronGeometry(5, 5), material);
rocketGroup.add(shield);
shield.scale.set(0.5, 0.5, 0.75);
shield.visible = false

// Warp field (could be removed later, its just a placeholder)
const warpField = new THREE.PointsMaterial({
    color: 0x0050FF, // Orange color
    size: 0.1,       // Adjust point size
    transparent: false,
    opacity: 0.9
});
const warp = new THREE.Points(new THREE.IcosahedronGeometry(5, 8), warpField);
scene.add(warp);
warp.scale.set(2, 2, 25);
warp.rotateY(Math.PI / 2);

/**initialises AmmoJS library */
function initAmmoJS(){
    Ammo().then(ammo=>{
        AmmoJS = ammo 
    })

}

function initKeypressEventListeners(){

    function onKeyDown(event){
        if (event.key == 'ArrowUp') {
            arrowKeysState[0] = true;
        }
        if (event.key == 'ArrowRight') {
            arrowKeysState[1] = true;
        }
        if (event.key == 'ArrowDown') {
            arrowKeysState[2] = true;
        }
        if (event.key == 'ArrowLeft') {
            arrowKeysState[3] = true;
        } 
    }

    function onKeyUp(event){
        if (event.key == 'ArrowUp') {
            arrowKeysState[0] = false;
        }
        if (event.key == 'ArrowRight') {
            arrowKeysState[1] = false;
        }
        if (event.key == 'ArrowDown') {
            arrowKeysState[2] = false;
        }
        if (event.key == 'ArrowLeft') {
            arrowKeysState[3] = false;
        } 
    }

    window.addEventListener('keydown', onKeyDown, false);
    window.addEventListener('keyup', onKeyUp, false);

}

function createAsteroid() {
    const numAsteroidModels = 6;
    const randomlyChosenAsteroidModel = Math.floor(Math.random() * numAsteroidModels) + 1;
    
    loader.load(`models/asteroids/asteroid${randomlyChosenAsteroidModel}.glb`, function (gltf) {

        const singleAsteroidGroup = new THREE.Group() //THREE.Group used to store a single asteroid
        singleAsteroidGroup.position.set(-25, 0, Math.random() * 14 - 7); // Start from the left side with random Z position
        scene.add(singleAsteroidGroup)

        const asteroid = gltf.scene;
        singleAsteroidGroup.add(asteroid)
        
        const asteroidHitbox = new THREE.BoxHelper(asteroid, 'red')
        singleAsteroidGroup.add(asteroidHitbox)
        hitboxes.push(asteroidHitbox)

        
        
        asteroids.push(singleAsteroidGroup);
        

    }, undefined, function (error) {
        console.error(error);
    });
}

setInterval(createAsteroid, 1000);

// camera.position.z = 6; (TODO: We should remove this to make our game centered)
const missileFireEffects = {};
const fireEffectShip = new FireEffect(rocketGroup); //Used for fire particle

document.addEventListener('keydown', (event) => {
    const now = Date.now(); 
    if (event.code === 'Space' && settings.ammo > 0 && bulletModel && now - lastShotTime >= 500) {
        lastShotTime = now;
        ammoController.updateDisplay();
        
        const bullet = bulletModel.clone();
        bullet.position.copy(rocketGroup.position);
        bullet.position.y = rocket.position.y;
        bullet.position.x -= 1.25; 
        bullet.position.y += 1.35; 
        bullet.rotation.z = -0 ;

        // Create a small red sphere on top of the bullet
        const sphereGeometry = new THREE.SphereGeometry(2, 16, 16);
        const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const redSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        redSphere.position.set(0, 0.1, 0);
        bullet.add(redSphere);

        scene.add(bullet);
        bullets.push({ mesh: bullet, spawnTime: Date.now() }); // Store the spawn time of the bullet and the mesh itself
        console.log('Pew pew');
        missileFireEffects[bullet.uuid] = new FireEffect(scene);
    }
    if (event.key === 'f'){
        shield.visible = !shield.visible;
        warp.visible = !warp.visible; 
        fireEffectShip.visible();
    }
    // Secondary Bullet - Fires when pressing "v"
    if (event.key === 'v' && settings.ammo > 0 && now - lastSecondaryShotTimes >= 500) {
        lastSecondaryShotTimes = now;
        const secondaryBulletGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.2); // Small rectangle
        const secondaryBulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 }); // Yellow color
        const secondaryBullet = new THREE.Mesh(secondaryBulletGeometry, secondaryBulletMaterial);
        
        secondaryBullet.position.copy(rocketGroup.position);
        secondaryBullet.position.y = rocket.position.y;
        secondaryBullet.position.x -= 1.5; 
        secondaryBullet.position.y += 1.35;
        secondaryBullet.scale.set(0.5, 0.5, 0.5);

        scene.add(secondaryBullet);
        secondaryBullets.push(secondaryBullet);
        console.log('Secondary bullet fired');
         
    }
});

// angular velocity and acceleration of the spaceship
let angularVelocity = 0.01
let angularAcceleration = 0

let linearVelocity = [0, 0, 0]
let linearAcceleration = [0, 0, 0]

/**this function animates the spaceship. It will apply the idle/moving animations etc depending on
 * the state of the key presses
 */
function animateSpaceship(){
    if (rocket != null){  
        const DAMPING_FACTOR = 0.007
        const INERTIA = 0.001

        //if player is not pressing 'left' or 'right', display idle animation
        if (!arrowKeysState[1] && !arrowKeysState[3]){

            //physics for movement of the spaceship
            linearAcceleration[1] = -1 * INERTIA * rocket.position.y
            linearVelocity[1] += linearAcceleration[1]
            rocket.position.y += linearVelocity[1] + 0.5 * linearAcceleration[1]

            //physics for rotation of the spaceship
            angularAcceleration = -1 * INERTIA * rocket.rotation.z - DAMPING_FACTOR * angularVelocity
            angularVelocity += angularAcceleration
            rocket.rotation.z += angularVelocity + 0.5 * angularAcceleration

        }
        else{

            const HEIGHT_DIP_CAP = -0.5
            const DIP_ACCELERATION = -0.0005
            const rotationAngleCap = 0.2 * Math.PI

            linearAcceleration[1] = DIP_ACCELERATION
            linearVelocity[1] += linearAcceleration[1]
            rocket.position.y += linearVelocity[1] + 0.5 * linearAcceleration[1]
            if (rocket.position.y <= HEIGHT_DIP_CAP){
                linearVelocity[1] = 0
                rocket.position.y = HEIGHT_DIP_CAP
            }

            //player is pressing left key
            if (arrowKeysState[3]){
                rocketGroup.position.z += 0.05
                rocket.rotateZ(-0.01)
                if (rocket.rotation.z <=  -1 * rotationAngleCap){
                    rocket.rotation.z = -1 * rotationAngleCap
                }
                rocketGroup.position.z += 0.05
            }

            //player is pressing right key
            else if (arrowKeysState[1]){
                rocketGroup.position.z -= 0.05
                rocket.rotateZ(0.01)
                if (rocket.rotation.z >= rotationAngleCap){
                    rocket.rotation.z = rotationAngleCap
                }
            }
        }
    }
}



// added light to the scene, otherwise stuff was black
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

animate(fpsController.getValue()); //60 FPS by default, can be changed on the dat.gui
initKeyboardControls();

/**
 * Function to update homing behavior for multiple missiles
 * @param {*} missiles 
 * @param {*} asteroid 
 */
function updateHomingMissiles(missiles, targets) {
    const currentTime = Date.now();
    const initialForwardTime = 750; // 0.75 seconds to go forward before homing

    for (let i = missiles.length - 1; i >= 0; i--) {
        let missile = missiles[i];

        if (currentTime - missile.spawnTime > missileLifetime) {
            scene.remove(missile.mesh);
            missiles.splice(i, 1);
            continue;
        }

        let directionVector;

        if (currentTime - missile.spawnTime < initialForwardTime) {
            // Initial forward movement
            directionVector = new THREE.Vector3(-1, 0, 0); 
            missile.mesh.position.addScaledVector(directionVector, missileSpeed);

        } else {
            // Homing behavior
            let closestTarget = findClosestTarget(missile.mesh.position, targets);
            if (closestTarget) { // Check if a target was found
                directionVector = new THREE.Vector3().subVectors(closestTarget.position, missile.mesh.position);
                directionVector.normalize();
                missile.mesh.position.addScaledVector(directionVector, missileSpeed);
            } else {
                // What to do if no target is found after initial time? Keep going forward
                directionVector = new THREE.Vector3(0, 0, 1);
                missile.mesh.position.addScaledVector(directionVector, missileSpeed);
            }
        }

        //if (missileFireEffects[missile.mesh.uuid]) {
        //    missileFireEffects[missile.mesh.uuid].animate(missile.mesh.position.z, missile.mesh.position.y, 0.25);
        //}


    }
}

/**
 * Finds the closest target while prioritizing those with a lower X position.
 * @param {THREE.Vector3} position - The current missile position.
 * @param {Array} targets - List of potential targets.
 * @returns The closest target considering weighted distances.
 */
function findClosestTarget(position, targets) {
    return targets.reduce((closest, target) => {
        let dx = target.position.x - position.x;
        let dy = target.position.y - position.y;
        let dz = target.position.z - position.z;

        // Adjust weighting based on X position
        let xWeight = dx > 0 ? 10 : 0.5; // More weight for negative X, less for positive X
        let weightedDx = dx * xWeight;

        let weightedDistance = Math.sqrt(weightedDx * weightedDx + dy * dy + dz * dz);

        let closestDx = closest.position.x - position.x;
        let closestDy = closest.position.y - position.y;
        let closestDz = closest.position.z - position.z;
        
        let closestXWeight = closestDx < 0 ? 1.5 : 0.7;
        let closestWeightedDx = closestDx * closestXWeight;

        let closestWeightedDistance = Math.sqrt(closestWeightedDx * closestWeightedDx + closestDy * closestDy + closestDz * closestDz);

        return weightedDistance < closestWeightedDistance ? target : closest;
    }, targets[0]);
}

/**
 * function used to update the health bar on the UI side in case of collision (TODO: or special ability to increase health)
 */
function updateHealthBar() {
    // retrieve the HTML element for the health bar
    rocketHealth -= 10
    const healthBar = document.getElementById('healthBar');
    healthBar.style.width = rocketHealth + '%';

    // if the health bar is 0 or less, end the game
    if (rocketHealth <= 0) {
        healthBar.style.backgroundColor = 'gray';
        console.log("Game Over! Rocket destroyed.")
    }
}

/**
 * function used to create the nebula background and add it to the scene from a .gif or .mp4 file
 */
function createNebulaBackground() {
    // retrieve the nebula effect from a .mp4 file
    const video = document.createElement('video');
    video.src = './models/nebulaEffect.mp4';
    video.loop = true; // continuously loop video
    video.muted = true; // mute the .mp4 video
    video.autoplay = true; // start automatically
    video.play(); // play the video

    // create a video texture for it
    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.minFilter = THREE.LinearFilter;
    videoTexture.magFilter = THREE.LinearFilter;
    videoTexture.format = THREE.RGBAFormat;

    // ensuring we keep same colouring (TODO: Does not work...)
    videoTexture.encoding = THREE.sRGBEncoding;

    scene.background = videoTexture;
}

/**
 * function to create 1000 random stars in the background of the game with randomly generated different positions and adds it to the scene
 * @returns the star field which contains all of our stars
 */
function createStarField() {
    // create a random set of 1000 stars
    const starCount = 1000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);

    // set the x, y, z positions
    for (let i = 0; i < starCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 1000;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 1000;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 1000;
    }

    // set the positions
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // create the star material
    const material = new THREE.PointsMaterial({
        color: 0xffffff,  // White stars
        size: 0.75,  // Adjust star size
        transparent: true
    });

    // create the stars from the geometry and the material
    const stars = new THREE.Points(geometry, material)
    
    // add stars to the scene
    scene.add(stars);

    // return all of our stars
    return stars;
}

/**
 * function to animate our stars so that they are not static and move in the spaceships direction
 */
function animateStars() {
    const positions = starField.geometry.attributes.position.array;

    // change stars to go from left-right (can change in other directions as well)
    for (let i = 0; i < positions.length; i += 3) {
        // change value for speed
        positions[i] -= 2

        // in case stars go out of FOV and screen view, rearrange them
        if (positions[i] < -500) {
            positions[i] = 500;
        }
    }

    starField.geometry.attributes.position.needsUpdate = true;
}

/**
 * function to check for collisions and update health bar
 * OLD FUNCTION, NEW FUNCTION HAS BEEN DEFINED BELOW
 */
// function checkCollisions() {
//     // for each asteroid check the distance to the rocket
//     asteroids.forEach((asteroid, index) => {
//         const distance = rocketGroup.position.distanceTo(asteroid.position);

//         // if the asteroid is extremely close to rocket it has been hit
//         if (distance < 2) {
//             console.log("Rocket has been hit by the asteroid");

//             rocketHealth -= 10; // reduce the health
//             updateHealthBar() // update the health bar

//             // remove the asteroid after the collision
//             scene.remove(asetroid);
//             asteroids.splice(index, 1);
//         }
//     });
// }
//  * Does animation for the back cone exaust
//  */

function exaustAnimation() {
    const cones = [orangeCone, orangeCone2, orangeCone3];

    cones.forEach((cone, index) => {
        // Randomly change color to different shades of orange
        const hue = (20 + Math.sin(Date.now() * 0.003 + index) * 10) % 360; // Hue oscillates between 10-30
        const slowOrange = new THREE.Color(`hsl(${hue}, 100%, 50%)`);
        cone.material.color.set(slowOrange);

        // Pulsing effect (scaling up and down)
        const scale = 1 + 0.075 * Math.sin(Date.now() * 0.005);
        cone.scale.set(scale, scale, scale);
    });
}

/**
 * Secondary bullet animation
 */
function secondaryBulletAnimation(){
    for (let i = secondaryBullets.length - 1; i >= 0; i--) {
        secondaryBullets[i].position.x -= 0.15;

        // Remove bullets if they go out of bounds
        if (secondaryBullets[i].position.x < -30) {
            scene.remove(secondaryBullets[i]);
            secondaryBullets.splice(i, 1);
        }
    } 
}

/**
 * Function to create a shield power-up icon
 */
function createShieldPowerUp() {
    loader.load('models/shieldIcon.glb', function (gltf) {
        const shieldPowerUp = gltf.scene;
        
        shieldPowerUp.position.set(-25, -2, (Math.random()*15)-1); // Spawn randomly along the Z-axis
        shieldPowerUp.scale.set(4, 4, 4);

        scene.add(shieldPowerUp);
        shields.push(shieldPowerUp); 
        shieldPowerUp.rotateY(Math.PI / 2);
    }, undefined, function (error) {
        console.error("Error loading shield power-up:", error);
    });
}

function updateShieldPowerUp() {
    shields.forEach((shieldIcon, index) => {
        shieldIcon.position.x += 0.15; // Move shield icons from left to right

        // Calculate distance between the spaceship and the shield icon
        const xDistance = rocketGroup.position.x - shieldIcon.position.x;
        const zDistance = rocketGroup.position.z - shieldIcon.position.z;
        const distance = Math.sqrt(xDistance * xDistance + zDistance * zDistance);

        // console.log(distance);
        if (distance < 6.5) { // If shield icon is close to the spaceship
            console.log("Shield collected!");

            if (!shieldActive) {
                shield.visible = true; // Turn on the shield
                shieldActive = true;
                shieldActivationTime = Date.now(); // Start shield timer
            }

            // Remove shield icon after collecting
            scene.remove(shieldIcon);
            shields.splice(index, 1);
        }

        if (shieldIcon.position.x > 15) { // Remove shield icons when they go off-screen
            scene.remove(shieldIcon);
            shields.splice(index, 1);
        }
    });

    // Handle shield expiration and color change
    if (shieldActive) {
        let elapsed = (Date.now() - shieldActivationTime) / 5000; // Progress from 0 to 1 over 5 seconds

        // Smoothly transition color from blue to yellow
        let shieldColor = new THREE.Color().lerpColors(
            new THREE.Color(0x0050FF), // Start (blue)
            new THREE.Color(0xFFFF00), // End (yellow)
            elapsed // Interpolation factor (0 to 1)
        );
        shield.material.color.set(shieldColor);

        if (elapsed >= 1) { // Turn off shield after 5 seconds
            shield.visible = false;
            shieldActive = false;
            console.log("Shield deactivated.");
        }
    }
}
/**function used to check if the hitbox of an asteroid collides with the hitbox of the spaceship */
function checkForAsteroidCollision(){
    

    if (rocketGroup.children[3]){
        const rocketHitbox = new THREE.Box3().setFromObject(rocketGroup.children[3]) 

        asteroids.forEach(asteroidGroup=>{
            if (asteroidGroup.children[1]){
                const asteroidHitbox = new THREE.Box3().setFromObject(asteroidGroup) 
                if (rocketHitbox.intersectsBox(asteroidHitbox)){
                    // console.log(asteroidGroup.children[0].children[0].position)
                    handleCollision(asteroidGroup)
                }
            }      
        })
    }
    

}

/**called when a collision between an asteroid and the rocket has been detected */
function handleCollision(asteroidGroup){
    asteroidGroup.children.forEach(child=>{
        asteroidGroup.remove(child)
    })
    // console.log(asteroidGroup.children)
    asteroids.filter(a=>a==asteroidGroup)
    scene.remove(asteroidGroup)
    updateHealthBar()
}

// FPS related stuff
let previousDelta = 0
function animate(currentDelta) {

    if (showHitboxController.getValue()){
        hitboxes.forEach(hitbox=>{
            hitbox.visible = true
        })
    }
    else{
        hitboxes.forEach(hitbox=>{
            hitbox.visible = false
        })
        
    }

    checkForAsteroidCollision()
    fireParticleSystems.forEach(fireParticleSystem=>{
        fireParticleSystem.update()
    })

    // console.log()
    

    requestAnimationFrame(animate);
    if (!orangeCone || !orangeCone2 || !orangeCone3) return; // Wait for the spaceship to load

    // check if the rocket is hit
    // checkCollisions()

    animateStars();

    var delta = currentDelta - previousDelta
    // console.log(delta)
    const FPS = fpsController.getValue()

    if (FPS && delta < 1000 / FPS) {
        return;
    }

    animateSpaceship()
    if (rocketGroup && rocket && rocketGroup.position && rocket.position) { // It kept crashing for some reason withouth this (I'm guessing its trying to access the position before its created?)
        fireEffectShip.animate(rocketGroup.position.z, rocket.position.y, 1); 
    }
    //console.log(rocket.position.y)
    //console.log(rocketGroup.position)
    //console.log(rocketGroup.position.z);

    if(asteroids.length != 0){updateHomingMissiles(bullets, asteroids)}
    exaustAnimation();
    secondaryBulletAnimation();
    updateShieldPowerUp();

    asteroids.forEach((asteroid, index) => {
        asteroid.position.x += 0.15; // Move asteroids from left to right
        if (asteroid.position.x > 15) { // Remove asteroid when it goes off-screen
            scene.remove(asteroid);
            asteroids.splice(index, 1);
        }
    });

    shield.rotation.z += 0.01;
    warp.rotation.z += 0.015;

    renderer.render(scene, camera);

    previousDelta = currentDelta;
}


