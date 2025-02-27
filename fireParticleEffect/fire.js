import * as THREE from 'three';

/**
 * FireEffect class to create fire particles
 */
export default class FireEffect {

    constructor(scene) {
        this.scene = scene
        this.particleCount = 5
        this.particleSpeed = 0.01
        this.particles = []

        const positions = new Float32Array(this.particleCount * 3)

        for (let i = 0; i < this.particleCount; i++){

            const x = 0
            const y = 0
            const z = 0

            positions[i * 3] = x
            positions[i * 3 + 1] = y
            positions[i * 3 + 2] = x

            this.particles.push({
                position: new THREE.Vector3(x, y, z),
                direction: new THREE.Vector3(1, Math.random() - 0.5, Math.random() - 0.5)
                .normalize().multiplyScalar(this.particleSpeed),
                timeToLive: 4
            })
        }

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        this.material = new THREE.PointsMaterial({
            map: new THREE.TextureLoader().load('/models/fire2.png'),
            size: 1,
            color: 'red',
            transparent: true,
            depthTest: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            alphaTest: 0.01
        }) 

        const points = new THREE.Points(this.geometry, this.material)
        this.scene.add(points)

    }

    update(){

        const particleIndicesToRemove = []
        const positions = new Float32Array(this.particles.length * 3)

        for (let i = 0; i < this.particles.length; i++){

            this.particles[i].position.add(this.particles[i].direction)
 
            positions[i * 3] = this.particles[i].position.x
            positions[i * 3 + 1] = this.particles[i].position.y
            positions[i * 3 + 2] = this.particles[i].position.z

            this.particles[i].timeToLive -= 0.01
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        const removedParticles = this.particles.filter(p => p.timeToLive <= 0)
        this.particles = this.particles.filter(p => p.timeToLive > 0)
        // console.log(removedParticles)
    }

    
}
