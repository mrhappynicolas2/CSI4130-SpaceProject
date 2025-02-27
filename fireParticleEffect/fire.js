import * as THREE from 'three';

/**
 * FireEffect class to create fire particles
 */
export default class FireEffect {

    constructor(scene, particlesPosition) {

        this.particlesPosition = particlesPosition
        this.scene = scene
        this.particleSpeed = 0.01
        this.particles = []
        this.particleCount = 50
        const positions = new Float32Array(this.particleCount * 3)

        
        for (let i = 0; i < this.particleCount; i++){
            this.createParticle()
        }

        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        this.material = new THREE.PointsMaterial({
            map: new THREE.TextureLoader().load('/models/fire2.png'),
            size: 0.5,
            color: new THREE.Color().setHex( 0xff3333 ),
            transparent: true,
            depthTest: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            alphaTest: 0.01,
            
        }) 

        const points = new THREE.Points(this.geometry, this.material)
        this.scene.add(points)

    }

    createParticle(){

        this.particles.push({
            position: new THREE.Vector3(this.particlesPosition.x, this.particlesPosition.y, this.particlesPosition.z),
            direction: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, -1)
            .normalize().multiplyScalar(this.particleSpeed),
            timeToLive: 50
        })

    }

    update(){

        const positions = new Float32Array(this.particles.length * 3)

        for (let i = 0; i < this.particles.length; i++){

            this.particles[i].position.add(this.particles[i].direction)
 
            positions[i * 3] = this.particles[i].position.x
            positions[i * 3 + 1] = this.particles[i].position.y
            positions[i * 3 + 2] = this.particles[i].position.z

            this.particles[i].timeToLive -= 1
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))

        if (this.particles.length < this.particleCount){
            this.createParticle()
        }

        const removedParticles = this.particles.filter(p => p.timeToLive <= 0)
        this.particles = this.particles.filter(p => p.timeToLive > 0)

    }

    
}
