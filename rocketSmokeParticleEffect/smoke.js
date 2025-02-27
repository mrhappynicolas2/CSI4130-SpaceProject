import * as THREE from 'three';

/**
 * SmokeEffect class to create smoke particles
 */
export default class SmokeEffect {

    constructor(scene, camera) {

        this.timer = 0
        this.scene = scene
        this.camera = camera
        
        this.particles = []

        this.PARTICLE_SPEED = 0.005
        this.MAX_TIME_TO_LIVE = 200
        this.PARTICLE_COUNT = 100
        
        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', 
            new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT * 3), 3))
        this.geometry.setAttribute('color', 
            new THREE.BufferAttribute(new Float32Array(this.PARTICLE_COUNT * 3)), 3)

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                diffuseTexture: { value: new THREE.TextureLoader().load( '/models/smoke.png' ) },
                pointMultiplier: { value: 500 }
            },
            vertexShader: `
                uniform float pointMultiplier;

                varying vec4 vColor;

                void main(){
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = pointMultiplier / gl_Position.w;

                    vColor = vec4(color, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D diffuseTexture;

                varying vec4 vColor;

                void main(){
                    gl_FragColor = texture2D(diffuseTexture, gl_PointCoord) * vColor;
                }
            `,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            vertexColors: true,
            blending: THREE.NormalBlending
        })

        const points = new THREE.Points(this.geometry, this.material)
        this.scene.add(points)

    }

    createParticle(particlesPosition){

        if (!particlesPosition){
            throw new Error()
        }

        const particleSpread = 0.2
        const directionVector = new THREE.Vector3(  
            1,
            Math.random() * 2 * particleSpread - particleSpread,
            Math.random() * 2 * particleSpread - particleSpread
        )
        directionVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * -0.15)
        directionVector.applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI * 0.15)

        this.particles.push({
            position: new THREE.Vector3(particlesPosition.x, particlesPosition.y, particlesPosition.z),
            direction: directionVector
            .normalize().multiplyScalar(this.PARTICLE_SPEED),
            timeToLive: this.MAX_TIME_TO_LIVE,
            alpha: 1.0
        })

        this.particles.sort((a, b)=>{
            const d1 = this.camera.position.distanceTo(a.position)
            const d2 = this.camera.position.distanceTo(b.position)

            if (d1 > d2){
                return -1
            }
            if (d1 < d2){
                return 1
            }
            return 0
        })

        this.update(particlesPosition)

    }

    update(newParticlesPosition){

        this.timer ++
        if (this.timer == 50){
            this.createParticle(newParticlesPosition)
            this.timer = 0
        }

        const positions = new Float32Array(this.PARTICLE_COUNT * 3)
        const colors = new Float32Array(this.PARTICLE_COUNT * 3)

        for (let i = 0; i < this.particles.length; i++){

            this.particles[i].position.add(this.particles[i].direction)
 
            positions[i * 3] = this.particles[i].position.x
            positions[i * 3 + 1] = this.particles[i].position.y
            positions[i * 3 + 2] = this.particles[i].position.z

            let color = new THREE.Color().setRGB(
                this.particles[i].timeToLive / this.MAX_TIME_TO_LIVE,
                this.particles[i].timeToLive / this.MAX_TIME_TO_LIVE,
                this.particles[i].timeToLive / this.MAX_TIME_TO_LIVE,
            )

            // if (this.particles[i].timeToLive < 20){
            //     color = new THREE.Color().setHex(0xff0000)
            // }

            colors[i * 3] = color.r
            colors[i * 3 + 1] = color.g
            colors[i * 3 + 2] = color.b


            this.particles[i].timeToLive -= 1
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        // if (this.particles.length < this.particleCount){
        //     this.createParticle()
        // }
        
        this.particles = this.particles.filter(p => p.timeToLive > 0)

    }

    
}
