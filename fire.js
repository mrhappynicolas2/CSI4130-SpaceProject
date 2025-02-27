import * as THREE from 'three';

/**
 * FireEffect class to create fire particles
 */
export class FireEffect {
    constructor(scene) {
        this.scene = scene;
        this.particleCount =0 ;
        this.fireParticles = [];

        // Particle system
        this.particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const colors = new Float32Array(this.particleCount * 3);

        this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const fireTexture = new THREE.TextureLoader().load('models/fire2.png');
        this.particleMaterial = new THREE.PointsMaterial({
            color: 'red',
            size: 1, // Base size of fire particles
            map: fireTexture,
            transparent: true,
            blending: THREE.NormalBlending,
            vertexColors: true
        });

        this.particles = new THREE.Points(this.particleGeometry, this.particleMaterial);
        this.scene.add(this.particles);
    }

    createFireParticle(origin, locationZ, locationY, size) {
        const index = Math.floor(Math.random() * this.particleCount);
        const positionAttribute = this.particleGeometry.getAttribute('position');

        // Adjust particle spawn spread based on size
        positionAttribute.setXYZ(
            index,
            origin.x, // Spread X based on size
            locationY,  // Spread Y
            origin.z // Spread Z
        );

        // Direction where the fire will go, scaled by size
        const direction = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5 * size, // Fire spreads more with size
            (Math.random() - 0.5) * 0.5 * size,
            Math.random() * -1 * size // More aggressive spread
        ).normalize().multiplyScalar(0.2 * size); // Increased movement with size

        const lifeTime = 50
        // const lifeTime = (50 + Math.random() * 30) * (size * 0.8); // Particles last longer if size is larger
        const colorAttribute = this.particleGeometry.getAttribute('color');
        const startColor = new THREE.Color(0xffa500);
        colorAttribute.setXYZ(index, startColor.r, startColor.g, startColor.b);
        // console.log(lifeTime)

        return { index, direction, lifeTime };
    }

    updateParticles() {
        const positionAttribute = this.particleGeometry.getAttribute('position');
        const colorAttribute = this.particleGeometry.getAttribute('color');

        for (let i = this.fireParticles.length - 1; i >= 0; i--) {
            const particle = this.fireParticles[i];
            const vertex = new THREE.Vector3(
                positionAttribute.getX(particle.index),
                positionAttribute.getY(particle.index),
                positionAttribute.getZ(particle.index)
            );
            vertex.add(particle.direction);
            // console.log(particle)
            // positionAttribute.setXYZ(particle.index, vertex.x, vertex.y, vertex.z);

            particle.lifeTime--;

            if (particle.lifeTime <= 0) {
                this.fireParticles.splice(i, 1);
                positionAttribute.setXYZ(particle.index, 0, 0, 0);
            } else {
                const ageFactor = 1 - (particle.lifeTime / 80);
                const currentColor = new THREE.Color(0xffa500).lerp(new THREE.Color(0xff0000), ageFactor);
                colorAttribute.setXYZ(particle.index, currentColor.r, currentColor.g, currentColor.b);
            }
        }

        positionAttribute.needsUpdate = true;
        colorAttribute.needsUpdate = true;
    }

    /**
     * Uses the Z location information from rocketGroup and the Y information from rocket to decide where the fire comes from
     * @param {number} locationZ - The Z position of the fire source
     * @param {number} locationY - The Y position of the fire source
     * @param {number} size - The scale/spread of the fire effect
     */
    animate(locationZ, locationY, size = 1) {
        //console.log(location);
        const coneBaseCenter = new THREE.Vector3(-1, 0, 0); // Fire starts from left, moves right
        for (let i = 0; i < 5 * size; i++) { // More particles for larger size
            this.fireParticles.push(this.createFireParticle(coneBaseCenter, locationZ, locationY, size));
        }
        this.updateParticles();
        this.particles.visible = true;
    }

    visible() {
        console.log("visible");
        this.particles.visible = !this.particles.visible;
    }
}
