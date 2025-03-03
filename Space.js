import * as THREE from 'three';
import { initKeyboardControls, fpsController, debugCamController, settings, ammoController, showHitboxController } from './guiControls.js'; 
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // allows loading models in .glb format
import { FireEffect } from './fire.js'; // fire particles
import FireParticleEffect from './fireParticleEffect/fire.js';
import SmokeEffect from './rocketSmokeParticleEffect/smoke.js';
import { materialIOR } from 'three/tsl';

// variable to keep track of our game (initially the game is not started)
let gameStatus = false;

// variables to keep track of our fire particles and smoke effects
let smokeEffect = null
let fireParticleSystems = []

// if the game has not started
if (!gameStatus) {
    // indicate to our user that the game is not in motion
    console.log("The game has not started yet.")

    // load our background image
    document.body.style.backgroundImage = "url('models/backgrounds/landing.webp')";

    // preserve the aspect ratio for high quality and cover the entire page
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';

    // make sure it is not scrollable
    document.body.style.backgroundAttachment = 'fixed';

    // create the initial welcome game text
    const welcomeText = document.createElement('div');
    welcomeText.id = 'game-text';
    welcomeText.innerText = 'Welcome to AstroBlast';
    welcomeText.style.position = 'absolute';
    welcomeText.style.top = '40%';
    welcomeText.style.left = '50%';
    welcomeText.style.transform = 'translate(-50%, -50%)';
    welcomeText.style.fontFamily = "'Press Start 2P', sans-serif"; // 8 bit font
    welcomeText.style.fontSize = '30px';
    welcomeText.style.color = 'white';
    welcomeText.style.textAlign = 'center';
    welcomeText.style.textShadow = '4px 4px 8px black';

    // create the start button
    const startButton = document.createElement('button');
    startButton.innerText = 'START GAME';
    startButton.style.position = 'absolute';
    startButton.style.top = '55%';
    startButton.style.left = '50%';
    startButton.style.transform = 'translate(-50%, -50%)';
    startButton.style.fontFamily = "'Press Start 2P', sans-serif";
    startButton.style.fontSize = '20px';
    startButton.style.padding = '10px 20px';
    startButton.style.background = 'red';
    startButton.style.color = 'white';
    startButton.style.border = 'solid 3.5px';
    startButton.style.borderColor = 'black';
    startButton.style.cursor = 'pointer';
    startButton.style.textShadow = '2px 2px 4px black';
    
    // initially since the game has not started make the health bar invisible from the HTML document
    const healthBar = document.getElementById('healthBar');
    const healthBarContainer = document.getElementById('healthBarContainer');
    if (healthBar) healthBar.style.visibility = 'hidden';
    if (healthBarContainer) healthBarContainer.style.visibility = 'hidden';

    // if the start button is clicked - remove the current text on the screen and call the start game function
    startButton.addEventListener('click', () => {
        // set the game status to be true because the user clicked the button to start the game
        gameStatus = true;
        
        // call the start game function
        startGame();

        // remove current text and buttons
        welcomeText.remove();
        startButton.remove();
    });

    // add elements to document
    document.body.appendChild(welcomeText);
    document.body.appendChild(startButton);
}

/**
 * function that is responsible for the game starting
 */
function startGame() {
    // indicate to our user that the game has started
    console.log("Let the games begin!")

    // render our health bar right away
    const healthBar = document.getElementById('healthBar');
    const healthBarContainer = document.getElementById('healthBarContainer');
    if (healthBar) healthBar.style.visibility = 'visible';
    if (healthBarContainer) healthBarContainer.style.visibility = 'visible';

    // all content and drawings will be organized in a scenegraph
    const scene = new THREE.Scene();

    // initialize a camera to look at scene's content and drawings
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    smokeEffect = new SmokeEffect(scene, camera)

    // setting up the camera's position
    camera.position.x = 6;
    camera.position.y = 3;
    camera.position.z = 0;

    // initialize a renderer and set a state (size)
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // add the output of the renderer to the HTML element
    document.body.appendChild(renderer.domElement);

    // use ambient lighting for brighter scene
    const ambientLight = new THREE.AmbientLight('white');
    scene.add(ambientLight);
    
    // only display axes and let the user move the camera if in debug mode (off by default)
    const axesHelper = new THREE.AxesHelper(2);
    const gridhelper = new THREE.GridHelper(50, 50);
    
    // create controls
    let controls;
    debugCamController.onChange((value) => {
        if (controls == null) controls = new OrbitControls(camera, renderer.domElement);
    
        controls.enableDamping = value;
        controls.enablePan = value;
        controls.enableRotate = value;
    
        if (value) scene.add(axesHelper);
        else scene.remove(axesHelper);
    });

    // added vertical grid
    const verticalGrid = new THREE.GridHelper(50, 50);
    verticalGrid.rotation.x = Math.PI / 2; // rotate 90 degrees to align with the YZ plane
    verticalGrid.position.z = -25; // move the grid to the back of the scene
    // scene.add(verticalGrid, gridhelper);

    // add the controls, axis lines/helper, and the ambient lighting to the scene
    scene.add(controls, axesHelper, ambientLight);

    // keep track of the hit boxes (rectangles around objects)
    const hitboxes = []

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
    const explosions = [];
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

    // fire blasters
    let orangeCone, orangeCone2, orangeCone3;
    let AmmoJS = 0

    // shield power up management
    const shields = [];
    let shieldActive = false;
    let shieldActivationTime = 0;
    setInterval(createShieldPowerUp, 7000);

    // regeneration health power up management
    const regenerations = [];
    let regenStatus = false;
    setInterval(createRegenerationHealthPowerUp, 15000);

    // initialize a loader to load models in .glb format
    const loader = new GLTFLoader();
    
    // load our spaceship
    loader.load('models/spaceship.glb', function (gltf) {
        // add it to scene
        scene.add(gltf.scene);
        rocket = gltf.scene;

        fireParticleSystems.push(
            new FireParticleEffect(rocket, new THREE.Vector3(0, 5.4, -9.5)),
            new FireParticleEffect(rocket, new THREE.Vector3(-1.5, 3, -9.5)),
            new FireParticleEffect(rocket, new THREE.Vector3(1.5, 3, -9.5))
        )

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
    
        // position our rocket
        rocket.position.y = 0.5;
    
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
        console.error(error);
    });

    // load our rockets
    loader.load('models/rocket.glb', function (gltf) {
        // create bullet model
        bulletModel = gltf.scene;

        // scale the bullet in size
        bulletModel.scale.set(0.05, 0.05, 0.05);
        
    }, undefined, function (error) {
        console.error(error);
    });

    /**
     * TESTING SHIELD STUFF....
     * 
     *  const bubbleLoader = new THREE.TextureLoader();

        // load the bubble
        let someTexture = bubbleLoader.load('models/textures/bubble.jpg');

        // create a shield for our rocket and add it to our group while scaling in size
        const material = new THREE.MeshPhysicalMaterial({
            transparent: true,
            opacity: 0.9,
            emissiveIntensity: 0.8,
            roughness: 0,
            metalness: 1,
            transmission: 1,
            clearcoat: 1,
            clearcoatRoughness: 0,
            reflectivity: 1,
            map: someTexture
        });    
        
        // create sphere geometry with slight distortions for a wavy effect
        const shieldGeometry = new THREE.SphereGeometry(3.9, 64, 64);
        const shield = new THREE.Mesh(shieldGeometry, material);
     * 
     * 
     */

    // create a shield for our rocket and add it to our group while scaling in size
    const material = new THREE.PointsMaterial({
        color: 0x0050FF,
        size: 0.1, // adjust size
        transparent: false,
        opacity: 0.9
    });
    
    // add the shield
    const shield = new THREE.Points(new THREE.IcosahedronGeometry(5, 5), material);
    rocketGroup.add(shield);
    shield.scale.set(0.5, 0.5, 0.75);
    shield.visible = false;

    // TODO: warp field (could be removed later, its just a placeholder)
    const warpField = new THREE.PointsMaterial({
        color: 0x0050FF, // orange colour
        size: 0.1, // adjust size
        transparent: false,
        opacity: 0.9
    });

    // add the warp
    const warp = new THREE.Points(new THREE.IcosahedronGeometry(5, 8), warpField);
    scene.add(warp);
    warp.scale.set(2, 2, 25);
    warp.rotateY(Math.PI / 2);

    /**
     * initialises AmmoJS library
     */
    function initAmmoJS(){
        Ammo().then(ammo=>{
            AmmoJS = ammo 
        })
    }

    /**
     * listen for key presses
     */
    function initKeypressEventListeners(){

        function onKeyDown(event){
            if (event.key == 'ArrowUp') {
                arrowKeysState[0] = true;
            }
            if (event.key == 'ArrowRight' || event.key == 'D' || event.key == 'd') {
                arrowKeysState[1] = true;
            }
            if (event.key == 'ArrowDown') {
                arrowKeysState[2] = true;
            }
            if (event.key == 'ArrowLeft' || event.key == "A" || event.key == 'a') {
                arrowKeysState[3] = true;
            } 
        }

        function onKeyUp(event){
            if (event.key == 'ArrowUp') {
                arrowKeysState[0] = false;
            }
            if (event.key == 'ArrowRight' || event.key == 'D' || event.key == 'd') {
                arrowKeysState[1] = false;
            }
            if (event.key == 'ArrowDown') {
                arrowKeysState[2] = false;
            }
            if (event.key == 'ArrowLeft' || event.key == "A" || event.key == 'a') {
                arrowKeysState[3] = false;
            } 
        }

        window.addEventListener('keydown', onKeyDown, false);
        window.addEventListener('keyup', onKeyUp, false);
    }

    /**
     * responsible for creating our asteroids
     */
    function createAsteroid() {
        const numAsteroidModels = 6;
        const randomlyChosenAsteroidModel = Math.floor(Math.random() * numAsteroidModels) + 1;
        
        loader.load(`models/asteroids/asteroid${randomlyChosenAsteroidModel}.glb`, function (gltf) {

            const singleAsteroidGroup = new THREE.Group() //THREE.Group used to store a single asteroid
            singleAsteroidGroup.position.set(-25, 0.5, Math.random() * 11 - 5.5); // Start from the left side with random Z position
            
            if (gameStatus) {
                scene.add(singleAsteroidGroup)
            }

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

    // call this function thus creating asteroids every second
    setInterval(createAsteroid, 1000);

    function createExplosion(position, material) {
        const explosion = new THREE.Points(new THREE.SphereGeometry(5), material);
        explosion.geometry.scale(0.01, 0.01, 0.01);
        explosion.position.set(position.x, position.y, position.z);
    
        explosions.push(explosion);
        scene.add(explosion);
    }
    
    // position our camera
    camera.position.x = 6;
    camera.position.y = 4;
    camera.rotateY(Math.PI / 2);
    camera.rotateX(-0.3);

    const missileFireEffects = {};
    const fireEffectShip = new FireEffect(rocketGroup); // used for fire particle

    // add a listener for key downs
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
            // console.log('Pew pew');
            missileFireEffects[bullet.uuid] = new FireEffect(scene);
        }
        if (event.key === 'f'){
            //shield.visible = !shield.visible;
            warp.visible = !warp.visible; 
        }
        // Secondary Bullet - Fires when pressing "v"
        if (event.key === 'v' && settings.ammo > 0 && now - lastSecondaryShotTimes >= 500) {
            lastSecondaryShotTimes = now;
            const secondaryBulletGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.2); // Small rectangle
            const secondaryBulletMaterial = new THREE.MeshBasicMaterial({ color: 0x40E0D0 }); // Yellow color
            const secondaryBullet = new THREE.Mesh(secondaryBulletGeometry, secondaryBulletMaterial);
            
            secondaryBullet.position.copy(rocketGroup.position);
            secondaryBullet.position.y = rocket.position.y;
            secondaryBullet.position.x -= 1.5; 
            secondaryBullet.position.y += 1.35;
            secondaryBullet.scale.set(0.5, 0.5, 0.5);

            scene.add(secondaryBullet);
            secondaryBullets.push(secondaryBullet);
            // console.log('Secondary bullet fired');
        }
    });

    // angular velocity and acceleration of the spaceship
    let angularVelocity = 0.01
    let angularAcceleration = 0

    let linearVelocity = [0, 0, 0]
    let linearAcceleration = [0, 0, 0]

    /**
     * this function animates the spaceship. It will apply the idle/moving animations etc depending on the state of the key presses
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
                if (arrowKeysState[3] && rocketGroup.position.z <= 6){
                    rocketGroup.position.z += 0.05
                    rocket.rotateZ(-0.01)
                    if (rocket.rotation.z <=  -1 * rotationAngleCap){
                        rocket.rotation.z = -1 * rotationAngleCap
                    }
                    rocketGroup.position.z += 0.05
                }

                //player is pressing right key
                else if (arrowKeysState[1] && rocketGroup.position.z >= -6){
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

            }
            
            else {
                // Homing behavior
                let closestTarget = findClosestTarget(missile.mesh.position, targets);
                if (closestTarget) { // Check if a target was found
                
                    const material = new THREE.PointsMaterial({
                        color: 0xFFA500,
                        size: 0.1,
                        transparent: false,
                        opacity: 1.0
                    });

                    // If the missile has collided with the target, remove it
                    if(closestTarget.position.distanceTo(missile.mesh.position) < 0.1) {
                        scene.remove(closestTarget);
                        scene.remove(missile.mesh);
                        missiles.splice(i, 1);
                        createExplosion(closestTarget.position, material);
                        // Go closer to the target
                    }
                    
                    else {
                        directionVector = new THREE.Vector3().subVectors(closestTarget.position, missile.mesh.position);
                        directionVector.normalize();
                        missile.mesh.position.addScaledVector(directionVector, missileSpeed);
                    }
                }
                
                else {
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

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /**
     * 
     * @param {*} collisionStatus boolean to track where it was called from
     */
    function updateHealthBar(collisionStatus) {
        // if the spaceship actually collided with an asteroid this will execute
        if (collisionStatus && !shield.visible) {
            // console.log("Ship has collided!. Time to deduct health.")
            const healthBar = document.getElementById('healthBar');
            
            // Update the health bar’s width based on the current health
            rocketHealth -= 10;
            healthBar.style.width = rocketHealth + '%';
        }

        // the regeneration health icon was hit thus execute this code
        else if (!collisionStatus && regenStatus) {
            regenStatus = false;
            console.log("We are resetting the health to 100.");
            healthBar.style.width = rocketHealth + '%';
        }

        // if the spaceship hit a shield icon...solidify the health bar to look like rock
        else if (!collisionStatus && shield.visible) {
            // console.log("The spaceship is shielded, so solidify the health bar.");
            const healthBar = document.getElementById('healthBar');
            
            // give the health bar a rock-like appearance
            healthBar.style.backgroundColor = 'gray';
            healthBar.style.backgroundImage = 'url("models/textures/solidify.png")'; // load the rock texture
            healthBar.style.backgroundSize = 'cover';
            healthBar.style.borderRadius = '5px';
            healthBar.style.boxShadow = 'inset 0 0 10px rgba(0, 0, 0, 0.5)';
            healthBar.style.pointerEvents = 'none';
        }

        // else if the spaceship is not currently shielded and not in collision with anything
        else if (!collisionStatus && !shield.visible) {
            // console.log("The spaceship is in it's regular state (no collision or powerups) thus display the health bar as normal.");
            const healthBar = document.getElementById('healthBar');
        
            // apply the gradient background
            let gradient;
            if (rocketHealth < 30) {
            gradient = 'red'; // solid red when on low health
            }

            else if (rocketHealth >= 30 && rocketHealth <= 50) {
                gradient = 'linear-gradient(to right, red, orange)'; // gradient from red to orange when health bar is halfish health
            }
            
            else if (rocketHealth > 50 && rocketHealth <= 70) {
                gradient = 'linear-gradient(to right, red, orange, yellow)'; // gradient from red to orange to yellow when health bar is more than halfish health
            }
            
            else {
            gradient = 'linear-gradient(to right, red, orange, yellow, green)'; // full gradient from red to orange to yellow to green when health bar is nearly full
            }
            
            // apply the gradient and some other styles
            healthBar.style.background = gradient;
            healthBar.style.borderRadius = '0px';
            healthBar.style.boxShadow = 'inset 0 0 5px rgba(0, 0, 0, 0.5);';
            healthBar.style.pointerEvents = 'auto';
        }

        // if the health bar is 0 or less, end the game
        if (rocketHealth <= 0) {
            // print the status of the game to the user in the console
            console.log("Game Over! Spaceship destroyed.");

            // TODO:
            // triggerExplosion();
            
            // call the end game function
            endGame();
        }
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
     * create celestial objects
     * - responsible for creating the planets and moon
     * - responsible for creating the volumetric nebula
     */
    function createCelestialObjects() {
        createPlanetsAndMoon();
        // TODO:
        // createVolumetricNebula();
        createGlowingCometWithTail();
        createMeteorShower();
    }

    /**
     * function to create all of our individual planets and the moon
     */
    function createPlanetsAndMoon() {
        createEarth();
        createSaturn();
        createVenus();
        createMoon();
    }

    /**
     * create earth
     */
    function createEarth() {
        // load our earth texture
        const textureLoader = new THREE.TextureLoader();
        const planetTexture = textureLoader.load('models/textures/earth.jpeg');

        // create sphere for the earth
        const planetGeometry = new THREE.SphereGeometry(5, 64, 64);
        const planetMaterial = new THREE.MeshStandardMaterial({ map: planetTexture });

        // create the planet and add it to our scene
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);
        planet.position.set(-48, 0, -15);
        scene.add(planet);

        // add a nice atmosphere to the planet (earth is blue)
        createAtmosphere(planet, 1);

        // rotate the planet continuously
        function animateEarth() {
            requestAnimationFrame(animateEarth);
        
            // get time
            const time = Date.now() * 0.0005;
        
            // how big the circle should be
            const radius = 80;

            // move around x and y and z
            planet.position.x = Math.cos(time) * radius;
            planet.position.y = Math.sin(time) * radius;
            planet.position.z = Math.sin(time) * radius;
        
            // rotate the planet around the y axis
            planet.rotation.y += 0.01;
        }

        // start the animation so that earth is rotating
        animateEarth();
    }

    /**
     * create saturn
     */
    function createSaturn() {
        // load our saturn texture
        const textureLoader = new THREE.TextureLoader();
        
        // planet texture
        const planetTexture = textureLoader.load('models/textures/saturn.jpg');

        // saturn has rings so give that a nice texture too
        const ringTexture = textureLoader.load('models/textures/rings.jpg');

        // create sphere for saturn
        const planetGeometry = new THREE.SphereGeometry(5, 64, 64);
        const planetMaterial = new THREE.MeshStandardMaterial({ map: planetTexture });

        // create the planet and add it to our scene
        const planet = new THREE.Mesh(planetGeometry, planetMaterial);
        planet.position.set(-500, 0, 0);
        scene.add(planet);

        // create ring geometry and material
        const ringGeometry = new THREE.RingGeometry(9, 7, 32);
        const ringMaterial = new THREE.MeshStandardMaterial({
            map: ringTexture,
            side: THREE.DoubleSide,
            transparent: true,
        });

        // construct the rings and add it to our scene (same spot as our saturn planet)
        const rings = new THREE.Mesh(ringGeometry, ringMaterial);
        rings.position.set(-500, 0, 0);

        // tilt it so it looks realistic
        rings.rotation.x = Math.PI / 2.5;
        rings.rotation.y = Math.PI / 4;

        // add it to our scene
        scene.add(rings);

        // give it a nice atmosphere, saturn is light brownish
        createAtmosphere(planet, 2);

        // rotate the planet so that it is moving
        function animateSaturn() {
            requestAnimationFrame(animateSaturn);
        
            // we only want the planet to rotate - NOT THE RINGS
            // making the rings rotate around the z axis give a spinning effect (this is nicer - ignore comment above)
            planet.rotation.y += 0.005;
            rings.rotation.z += 0.005;
            console.log(planet.scale)
            let scaleX = planet.scale.x
            let scaleY = planet.scale.y
            let scaleZ = planet.scale.z
            
            if(planet.scale.x < 40){
                planet.scale.set(scaleX*1.001, scaleY*1.001, scaleZ*1.001)
                rings.scale.set(scaleX*1.001, scaleY*1.001, scaleZ*1.001)
            }
            else if(planet.scale.x >= 35 && planet.scale.x < 40){
                planet.scale.set(scaleX*1.0001, scaleY*1.0001, scaleZ*1.0001)
                rings.scale.set(scaleX*1.0001, scaleY*1.0001, scaleZ*1.0001)
                warp.color = new THREE.Color(0xFFA500) //orange
            }
            else{
                warp.visible = false
            }
        }
        animateSaturn();
    }

    /**
     * create venus
     */
    function createVenus() {
        // load the venus texture
        const textureLoader = new THREE.TextureLoader();
        const planetTexture = textureLoader.load('models/textures/venus.jpg');

        // create sphere for venus
        const planetGeometry = new THREE.SphereGeometry(5, 64, 64);
        const planetMaterial = new THREE.MeshStandardMaterial({ map: planetTexture });

        // construct our planet and add it to the scene
        const venus = new THREE.Mesh(planetGeometry, planetMaterial);
        venus.position.set(-5, 0, -10);
        scene.add(venus);

        // add a nice atmosphere (venus is dark brownish)
        createAtmosphere(venus, 3);
        
        // start animating our venus so that it is rotating
        function animateVenus() {
            requestAnimationFrame(animateVenus);

            // get time
            const time = Date.now() * 0.00025;

            // how big the circle should be
            const radius = 80;

            // move around x and z
            venus.position.x = Math.cos(time) * radius;
            venus.position.z = Math.sin(time) * radius;

            // rotate venus around the y axis
            venus.rotation.y += 0.005;
        }

        // call the function to animate venus
        animateVenus();
    }

    /**
     * function to create our moon
     */
    function createMoon() {
        // load our moon texture
        const textureLoader = new THREE.TextureLoader();
        const moonTexture = textureLoader.load('models/textures/moon.jpg');

        // create a sphere for the moon
        const moonGeometry = new THREE.SphereGeometry(2, 64, 64);
        const moonMaterial = new THREE.MeshStandardMaterial({ map: moonTexture });

        // construct our moon and add it to the scene
        const moon = new THREE.Mesh(moonGeometry, moonMaterial);
        moon.position.set(-60, 0, 25);
        scene.add(moon);

        // add an atmosphere for our moon which is greyish
        createAtmosphere(moon, 4);

        // start animating our moon
        function animateMoon() {
            requestAnimationFrame(animateMoon);

            // get time
            const time = Date.now() * 0.0005;

            // how big the circle should be
            const radius = 80;

            // move around y and z
            moon.position.y = Math.cos(time) * radius;
            moon.position.z = Math.sin(time) * radius;

            // rotate the moon around the y axis
            moon.rotation.y += 0.01;
        }

        // start animating the moon so it is rotating
        animateMoon();
    }

    /**
     * create atmosphere for planets
     * - earth = bluish
     * - saturn = sandish colour (light brown)
     * - venus = dark brownish
     * - moon = greyish
     * @param {*} planet the planet we will be applying the texture too
     * @param {*} specifier the specifier helps indicate which planet it is for specific colours
     * @returns NONE
     */
    function createAtmosphere(planet, specifier) {
        // of the 4 cases, 3 of them are a planet this line makes the geometry so that it is a little bit bigger than the plane itself to show it
        let atmosphereGeometry = new THREE.SphereGeometry(5.2, 64, 64);
        let atmosphereColor;

        // determine the colour
        switch (specifier) {
            case 1:
                // earth is blue
                atmosphereColor = new THREE.Color(0.2, 0.5, 1.0);
                break;
            case 2:
                // saturn is sandish
                atmosphereColor = new THREE.Color(0.9, 0.7, 0.4);
                break;
            case 3:
                // venus is dark brown
                atmosphereColor = new THREE.Color(0.4, 0.2, 0.1);
                break;
            case 4:
                // change the size because moon is relatively smaller than other planets
                atmosphereGeometry = new THREE.SphereGeometry(2.1, 64, 64);
                
                // moon is greyish
                atmosphereColor = new THREE.Color(0.2, 0.2, 0.2);
                break;

            // in case of an invalid number (dead code)
            default:
                console.log("Testing...");
                return;
        }

        // create out atmosphere material from shaders
        const atmosphereMaterial = new THREE.ShaderMaterial({
            // vertex shader
            vertexShader: ` // Simple vertex shader
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,

            // fragment shader
            fragmentShader: ` // Fading effect based on the selected color
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(0.8 - dot(vNormal, vec3(0,0,1)), 3.0);
                    gl_FragColor = vec4(${atmosphereColor.r}, ${atmosphereColor.g}, ${atmosphereColor.b}, 1.0) * intensity;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true
        });

        // actually create the atmosphere from the materials and geometries defined
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);

        // add it to our planet parameter passed in
        planet.add(atmosphere);
    }

    /**
     * TODO:
     * create volumetric nebula...
     */
    function createVolumetricNebula() {
    }

    /**
     * TODO:
     * create a glowing comet with a tail and streak
     */
    function createGlowingCometWithTail() {
        // create the comet geometry and material
        const cometGeometry = new THREE.SphereGeometry(10, 32, 32);
        const cometMaterial = new THREE.MeshStandardMaterial({
            color: 0xff5500,
            emissive: 0xff5500,
            emissiveIntensity: 1.5
        });

        // construct the comet from the geometry and material
        const comet = new THREE.Mesh(cometGeometry, cometMaterial);

        // initially set the position for the comet to be at the bottom right of the screen
        comet.position.set(-600, -750, -1000);

        // add the comet to our scene
        scene.add(comet);
        
        // initialize some tail variables
        const tailLength = 100;
        const tailWidth = 20;
        
        // create the tail geometry
        const tailGeometry = new THREE.PlaneGeometry(tailLength, tailWidth, 1, 1);
        
        // create the tail material (using a custom shader for a better fade + gradient colour)
        const tailMaterial = new THREE.ShaderMaterial({
            uniforms: {
                // fade with yellow and pink
                uColor1: { value: new THREE.Color(0xffff00) },
                uColor2: { value: new THREE.Color(0xff66cc) },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                varying vec2 vUv;
                
                void main() {
                    // blend the yellow and pink
                    vec3 gradientColor = mix(uColor1, uColor2, vUv.x);

                    // fade this out at the end (it should NOT be solid at the end of the comet - otherwise it doesn't look clean)
                    float alpha = smoothstep(0.0, 1.0, vUv.x);
                    gl_FragColor = vec4(gradientColor, alpha);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });        
        
        // create a tail for the comet from the material
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);

        // position it so that it is behind
        tail.position.set(tailLength / 2, 0, 0);
        tail.rotation.z = Math.PI;
        
        // attach the tail to the comet
        comet.add(tail);
        
        // animation function
        function animate() {
            requestAnimationFrame(animate);

            // move the comet slowly up
            comet.position.y += 0.5;

            // move the comet slowly from left to right
            comet.position.z += 0.5;

            // this gives the tail effect
            comet.rotation.x += 900;

            // once it's no longer visible to the user just remove it from the scene to prevent clutter and lag
            if (comet.position.y > 300) {
                scene.remove(comet);
            }
        }
        
        // call the animation
        animate();
    }      

    /**
     * creates a meteor shower
     */
    function createMeteorShower() {
        // some meteor setup such as geometry, position, count, etc.
        const meteorGeometry = new THREE.BufferGeometry();
        const meteorCount = 50;
        const positions = new Float32Array(meteorCount * 3);
        const velocities = [];
    
        // create random positions
        for (let i = 0; i < meteorCount; i++) {
            positions[i * 3] = Math.random() * 400 - 200;
            positions[i * 3 + 1] = Math.random() * 200 + 100;
            positions[i * 3 + 2] = Math.random() * 400 - 200;
            velocities.push(new THREE.Vector3(Math.random() * -1 - 0.5, Math.random() * -1, 0));
        }
    
        // set the position
        meteorGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
        // create the material
        const meteorMaterial = new THREE.PointsMaterial({
            color: 0xffcc66,
            size: 2,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
    
        // construct the meteors from our geometry and materials
        const meteors = new THREE.Points(meteorGeometry, meteorMaterial);

        // add it to the scene
        scene.add(meteors);
    
        /**
         * function to animate our meteors so that they move
         */
        function animateMeteors() {
            // retrieve the positions
            const positions = meteorGeometry.attributes.position.array;

            // for all the positions (move them)
            for (let i = 0; i < meteorCount; i++) {
                positions[i * 3] += velocities[i].x;
                positions[i * 3 + 1] += velocities[i].y;
                positions[i * 3 + 2] += velocities[i].z;
    
                // reset if it is gone/dissappears
                if (positions[i * 3 + 1] < -100) {
                    positions[i * 3] = Math.random() * 400 - 200;
                    positions[i * 3 + 1] = Math.random() * 200 + 100;
                    positions[i * 3 + 2] = Math.random() * 400 - 200;
                }
            }
            meteorGeometry.attributes.position.needsUpdate = true;
            requestAnimationFrame(animateMeteors);
        }
    
        // call the animation
        animateMeteors();
    }

    /**
     * TODO:
     * function to explode the spaceship on destruction
     */
    function triggerExplosion() {
        // create a particle system for explosion when the spaceship dies
        const geometry = new THREE.SphereGeometry(5, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const explosion = new THREE.Mesh(geometry, material);

        // position it too where the rocket was
        explosion.position.set(rocket.position.x, rocket.position.y, rocket.position.z);
        scene.add(explosion);


        // animate it
        animateExplosion(explosion);
    }

    /**
     * TODO:
     * function to animate the explosion
     * @param {} explosion 
     */
    function animateExplosion(explosion) {
        // create some animation
        const scaleTween = new THREE.TWEEN.Tween(explosion.scale)
            .to({ x: 10, y: 10, z: 10 }, 500)
            .onComplete(() => {

                // remove the animation
                scene.remove(explosion);
            });
        scaleTween.start();
    }

    /**
     * function responsible for end game functionality
     */
    function endGame() {
        // print the status of the game to the user
        console.log("We are ending the game.")

        // set the current game status to false
        gameStatus = false;

        // remove objects from the scene
        const n = scene.children.length - 1; 
        for (var i = n; i > -1; i--) {
            scene.remove(scene.children[i]);
            console.log("Removing all children and objects of scene.")
        } 

        // clear the scene for additional safety
        scene.clear();

        // create game over text
        const gameOverText = document.createElement('div');
        gameOverText.id = 'game-over-text';
        gameOverText.innerText = 'GAME OVER';

        // apply styles to game over text
        gameOverText.style.position = 'absolute';
        gameOverText.style.top = '50%';
        gameOverText.style.left = '50%';
        gameOverText.style.transform = 'translate(-50%, -50%)';
        gameOverText.style.fontFamily = "'Press Start 2P', sans-serif";
        gameOverText.style.fontSize = '40px';
        gameOverText.style.color = 'red';
        gameOverText.style.textAlign = 'center';
        gameOverText.style.textShadow = '4px 4px 8px black';
        
        // add it to the document
        document.body.appendChild(gameOverText);

        // we restart the game automatically (have the user do it through button clicks is hard due to animation frames)
        // the clicks do not get registered during the game session
        const countdownText = document.createElement('div');
        countdownText.id = 'countdown-text';
        countdownText.innerText = 'Restarting Soon...';
        
        // add some styles
        countdownText.style.position = 'absolute';
        countdownText.style.top = 'calc(50% + 60px)';
        countdownText.style.left = '50%';
        countdownText.style.transform = 'translate(-40%, -50%)';
        countdownText.style.fontFamily = "'Press Start 2P', sans-serif"; // 8 bit font, but fall back on regular sans-serif
        countdownText.style.fontSize = '20px';
        countdownText.style.color = 'white';
        countdownText.style.textAlign = 'center';
        countdownText.style.textShadow = '2px 2px 4px black';
        countdownText.style.zIndex = '1000';
        countdownText.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        countdownText.style.padding = '5px 10px';
        countdownText.style.borderRadius = '5px';
            
        // display to the user that we are restarting the game
        document.body.appendChild(countdownText);

        // create a sprite for a broken heart like in video games
        const heartImage = document.createElement('img');
        heartImage.src = 'models/sprites/heartbreak.png';
        heartImage.alt = 'Broken Heart';

        // apply styles
        heartImage.style.position = 'absolute';
        heartImage.style.top = '50%';
        heartImage.style.left = 'calc(50% + 225px)';
        heartImage.style.transform = 'translate(-50%, -50%)';
        heartImage.style.width = '80px';
        heartImage.style.height = '80px';
        heartImage.style.filter = 'brightness(1.2) contrast(1.5)';

        // add it to our document
        document.body.appendChild(heartImage);

        // automatically restart the game after 5 seconds
        setTimeout(() => {
            console.log("We are restarting the game");
            
            // set the game status to false
            gameStatus = false;

            // remove any text
            gameOverText.remove();

            // FORCE RELOAD...
            location.replace(window.location.href);
        }, 5000);
    }

    // create our celestial objects
    createCelestialObjects();

    /**
     * function to create the regeneration health icon
     */
    function createRegenerationHealthPowerUp() {
        // load our 3D heart model
        loader.load('models/heart.glb', function (gltf) {
            // create the THREE Group for heart icons and map it to valid values meaning...
            // all the way back and where the spaceship can possibly be in terms of y axis and z axis
            const singleHealthIconGroup = new THREE.Group();
            singleHealthIconGroup.position.set(-25, 0.5, Math.random() * 8 - 4);
            
            // get the actual power up icon and scale it smaller
            const regenerateHealthPowerUp = gltf.scene;
            regenerateHealthPowerUp.scale.set(0.15, 0.15, 0.15);

            // create a pink hitbox for the icon and scale it smaller
            const healthIconHitbox = new THREE.BoxHelper(regenerateHealthPowerUp, 'pink');
            healthIconHitbox.scale.set(0.15, 0.15, 0.15);

            // update it to recalculate bounding box and get correct dimensions
            healthIconHitbox.update();

            // add them to the group
            singleHealthIconGroup.add(regenerateHealthPowerUp);
            singleHealthIconGroup.add(healthIconHitbox);

            // push to the array for all regenerations
            regenerations.push(singleHealthIconGroup);

            // add it to our hit boxes array as well
            hitboxes.push(healthIconHitbox);

            // add it to the scene
            scene.add(singleHealthIconGroup)
        }, undefined, function (error) {
            console.error("Error loading regeneration health power-up:", error);
        });
    }

    /**
     * update the regeneration health and apply it to the spaceship if the boxes intersect
     */
    function updateRegenerationHealthPowerUp() {
        // ensure we have a valid box helper for the spaceship
        if (rocketGroup.children[2]) {
            // retrieve the hit box for the spaceship
            const rocketHitbox = new THREE.Box3().setFromObject(rocketGroup.children[2]);
        
            // loop through the regenerations
            regenerations.forEach(regenerationGroup => {
                // ensure we have a valid box helper for the regeneration
                if (regenerationGroup.children[1]) {
                    // retrieve the hit box for the regeneration
                    const regenHitbox = new THREE.Box3().setFromObject(regenerationGroup);
        
                    // if the boxes intersect this means the spaceship has collided with the health icon
                    if (rocketHitbox.intersectsBox(regenHitbox)) {
                        // update status to user
                        console.log("You have collected a power-up! The health restores back to max health.");

                        // set the health back to 100 and update the health bar accordingly
                        rocketHealth = 100;
                        regenStatus = true;
                        updateHealthBar(false);

                        // remove everything from the regeneration group because the user has collected it
                        regenerationGroup.children.forEach(child=>{
                            regenerationGroup.remove(child);
                        })

                        // remove the regeneration health group from the scene
                        scene.remove(regenerationGroup);
                    }
                }
            });
        }
    }
    
    /**
     * Function to create a shield power-up icon
     */
    function createShieldPowerUp() {
        // load our 3D shield icon model
        loader.load('models/shieldIcon.glb', function (gltf) {
            // create the THREE Group for shield icons and map it to valid values meaning...
            // all the way back and where the spaceship can possibly be in terms of y axis and z axis
            const singleShieldIconGroup = new THREE.Group();
            singleShieldIconGroup.position.set(-25, 0.5, Math.random() * 8 - 4)

            // get the actual power up icon and scale it and rotate it so that it is facing the correct orientation
            const shieldPowerUp = gltf.scene;
            shieldPowerUp.scale.set(2, 2, 2);
            shieldPowerUp.rotateY(Math.PI / 2);

            // create a grey hitbox for the icon and scale it and rotate it so that it matches the icon
            const shieldIconHitbox = new THREE.BoxHelper(shieldPowerUp, 'grey');
            shieldIconHitbox.scale.set(2, 2, 2);
            shieldIconHitbox.rotateY(Math.PI / 2);
            
            // update it to recalculate bounding box and get correct dimensions
            shieldIconHitbox.update()

            // add them to the group
            singleShieldIconGroup.add(shieldPowerUp);
            singleShieldIconGroup.add(shieldIconHitbox);
            
            // push it to the array for all shields
            shields.push(singleShieldIconGroup);

            // add it to our hit boxes array as well
            hitboxes.push(shieldIconHitbox);

            // add it to the scene
            scene.add(singleShieldIconGroup);
        }, undefined, function (error) {
            console.error("Error loading shield power-up:", error);
        });
    }

    /**
     * update the shield power up and apply it to the spaceship based on the distance
     */
    function updateShieldPowerUp() {
        // ensure we have a valid box helper for the spaceship
        if (rocketGroup.children[2]) {
            // retrieve the hit box for the spaceship
            const rocketHitbox = new THREE.Box3().setFromObject(rocketGroup.children[2]);

            // loop through the shields
            shields.forEach(shieldGroup => {
                // ensure we have a valid box helper for the shield
                if (shieldGroup.children[1]) {
                    // retrieve the hit box for the shield
                    const shieldHitbox = new THREE.Box3().setFromObject(shieldGroup);

                    // if the boxes intersect this means the spaceship has collided with the shield icon
                    if (rocketHitbox.intersectsBox(shieldHitbox)) {
                        // update status to user
                        console.log("You have collected a power-up! Thie shield protects you from all asteroids temporarily.");

                        // set the shield states...
                        // if the shield is not currently active then activate it
                        if (!shieldActive) {
                            shield.visible = true;
                            shieldActive = true;
                            shieldActivationTime = Date.now();
                        }

                        // remove everything from the shield group because the user has collected it
                        shieldGroup.children.forEach(child=>{
                            shieldGroup.remove(child);
                        })

                        // remove the shield group from the scene
                        scene.remove(shieldGroup);
                    }
                }

            });

            // handle shield expiration and colour change
            if (shieldActive) {
                // progress from 0 to 1 over 5 seocnds
                let elapsed = (Date.now() - shieldActivationTime) / 5000;

                // smoothly transition colour from blue to yellow
                let shieldColour = new THREE.Color().lerpColors(
                    new THREE.Color(0x0050FF), // start with blue
                    new THREE.Color(0xFFFF00), // end with yellow
                    elapsed // interpolation factor (0 to 1)
                );
                shield.material.color.set(shieldColour);

                // turn off the shield after 5 seconds
                if (elapsed >= 1) {
                    shield.visible = false;
                    shieldActive = false;
                    console.log("Shield is deactivated.")
                }
            }
        }
    }
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * exhaust animation
     */
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

            const material = new THREE.PointsMaterial({
                color: 0xFFA500,
                size: 0.1,
                transparent: false,
                opacity: 1.0
            });

            // if there are asteroids
            if (asteroids.length > 0){
                let closestTarget = findClosestTarget(secondaryBullets[i].position, asteroids);
                // If the bullet has collided with the target, remove it
                if(closestTarget.position.distanceTo(secondaryBullets[i].position) < 0.5) {
                    scene.remove(closestTarget);
                    scene.remove(secondaryBullets[i]);
                    secondaryBullets.splice(i, 1);
                    createExplosion(closestTarget.position, material);
                }
            }

            // Remove bullets if they go out of bounds
            if (secondaryBullets[i].position.x < -30) {
                scene.remove(secondaryBullets[i]);
                secondaryBullets.splice(i, 1);
            }
        } 
    }

    /**
     * function used to check if the hitbox of an asteroid collides with the hitbox of the spaceship
     * */
    function checkForAsteroidCollision(){
        // ensure we have a valid box helper for the spaceship
        if (rocketGroup.children[2]){
            // retrieve the hit box for the spaceship
            const rocketHitbox = new THREE.Box3().setFromObject(rocketGroup.children[2]) 

            // loop through the asteroids
            asteroids.forEach(asteroidGroup=>{

                // ensure we have a valid box helper for the asteroid
                if (asteroidGroup.children[1]){
                    // retrieve the hit box for the asteroid
                    const asteroidHitbox = new THREE.Box3().setFromObject(asteroidGroup)

                    // if the boxes intersect this means the spaceship has collided with the asteroid
                    if (rocketHitbox.intersectsBox(asteroidHitbox)){
                        // call the handle collision function on this asteroid group
                        handleCollision(asteroidGroup)
                    }
                }      
            })
        }
    }

    /**
     * called when a collision between an asteroid and the rocket has been detected
     * */
    function handleCollision(asteroidGroup){

        const material = new THREE.PointsMaterial({
            color: 0xFF474C,
            size: 0.1,
            transparent: false,
            opacity: 1.0
        });
        if (shield.visible) {
            material.color = new THREE.Color(0xADDFFF);
            console.log("Shield absorbed the asteroid! Explosion triggered.");
            createExplosion(asteroidGroup.position, material);
        } else {
            // If no shield is active, apply damage to the spaceship
            
            createExplosion(asteroidGroup.position, material);
            updateHealthBar(true);
        }

        // remove everything from the asteroid group because the user has hit the asteroid
        asteroidGroup.children.forEach(child=>{
            asteroidGroup.remove(child)
        })

        // remove the asteroid group from the scene
        scene.remove(asteroidGroup)

        // update the health bar accordingly (user hit the asteroid so spaceship takes damage)
        updateHealthBar(true);
    }

    // FPS related stuff
    let previousDelta = 0

    // animation function
    function animate(currentDelta) {
        // if the user has selected that hit boxes should be turned ON
        if (showHitboxController.getValue()){
            hitboxes.forEach(hitbox=>{
                hitbox.visible = true
            })
        }

        // else the user has selected that hit boxes should be turned OFF
        else{
            hitboxes.forEach(hitbox=>{
                hitbox.visible = false
            })
            
        }

        // if the health falls below 50 then add smoke to the rocket indicating poor health and status
        if (rocket && smokeEffect && rocketHealth <= 50){
            let initialSmokePosition = new THREE.Vector3(0, 1, 0)
            let rocketPos = new THREE.Vector3(0, 0, 0) 
            rocket.getWorldPosition(rocketPos)
            initialSmokePosition.add(rocketPos)
            smokeEffect.update(initialSmokePosition)
        }

        // if the health back is back to over 50 it is because the user has hit a special ability (health power up)
        // thus we have to account for the smoke and effectively stop it
        if (rocket && smokeEffect && rocketHealth >= 50){
            smokeEffect.stop();
        }

        // check if the spaceship has hit an asteroid
        checkForAsteroidCollision()

        // check if the spaceship has hit the health power up
        updateRegenerationHealthPowerUp();

        // check if the spaceship has hit the shield power up
        updateShieldPowerUp();

        // animate our stars and create the star field essentially
        animateStars();

        // update the fire particles
        fireParticleSystems.forEach(fireParticleSystem=>{
            fireParticleSystem.update()
        })
        
        // animate
        requestAnimationFrame(animate);

        // wait for the spaceship to load
        if (!orangeCone || !orangeCone2 || !orangeCone3) return;

        // FPS
        var delta = currentDelta - previousDelta
        const FPS = fpsController.getValue()
        if (FPS && delta < 1000 / FPS) {
            return;
        }

        // animate our spaceship so that it jiggles and wiggles
        animateSpaceship()

        if (rocketGroup && rocket && rocketGroup.position && rocket.position) { // It kept crashing for some reason withouth this (I'm guessing its trying to access the position before its created?)
            fireEffectShip.animate(rocketGroup.position.z, rocket.position.y, 1); 
        }
        //console.log(rocket.position.y)
        //console.log(rocketGroup.position)
        //console.log(rocketGroup.position.z);

        // if there are asteroids call the homing missiles functions
        if(asteroids.length != 0){updateHomingMissiles(bullets, asteroids)}

        // start the exhaust animation
        exaustAnimation();

        // start the secondary bullet animation
        secondaryBulletAnimation();

        // for every regeneration move it along the x axis so that it comes all the way from the back to the front
        // it also removes any regenerations if they pass the spaceship as the user has not collected it (to avoid cluttering and lagging the scene)
        regenerations.forEach((regenerationGroup, index) => {
            regenerationGroup.position.x += 0.15;
            if (regenerationGroup.position.x > 15) {
                scene.remove(regenerationGroup);
                regenerations.splice(index, 1);
            }
        });

        // for every shield move it along the x axis so that it comes all the way from the back to the front
        // it also removes any shields if they pass the spaceship as the user has not collected it (to avoid cluttering and lagging the scene)
        shields.forEach((shieldGroup, index) => {
            shieldGroup.position.x += 0.15;
            if (shieldGroup.position.x > 15) {
                scene.remove(shieldGroup);
                shields.splice(index, 1);
            }
        });

        // for every asteroid move it along the x axis so that it comes all the way from the back to the front
        // it also removes any asteroids if they pass the spaceship as the user has avoided it (to avoid cluttering and lagging the scene)
        asteroids.forEach((asteroid, index) => {
            asteroid.position.x += 0.15;
            if (asteroid.position.x > 15) {
                scene.remove(asteroid);
                asteroids.splice(index, 1);
            }
        });

        // for every explosion scale it and set the opacity
        // it also removes any explosions from the scene if opacity is 0 (to avoid cluttering and lagging the scene)
        explosions.forEach((explosion, index) => {
            explosion.geometry.scale(1.4, 1.4, 1.4);
            explosion.material.opacity -= 0.3;
    
            if(explosion.material.opacity == 0) {
                scene.remove(explosion);
                explosions.splice(index, 1);
            }
        });

        // rotate the shield around the z axis
        shield.rotation.z += 0.01;
        
        // rotate the warp around the z axis
        warp.rotation.z += 0.015;

        // render the scene with the camera
        renderer.render(scene, camera);

        // FPS
        previousDelta = currentDelta;

        // constantly check for updates to the health bar (sizing + colours - etc.)
        updateHealthBar(false);
    }
}