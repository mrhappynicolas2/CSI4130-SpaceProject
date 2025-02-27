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
        
        this.geometry = new THREE.BufferGeometry()
        this.geometry.setAttribute('position', 
            new THREE.BufferAttribute(new Float32Array(this.particleCount * 3), 3))
        this.geometry.setAttribute('color', 
            new THREE.BufferAttribute(new Float32Array(this.particleCount * 3)), 3)

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                diffuseTexture: { value: new THREE.TextureLoader().load( '/models/fire2.png' ) },
                pointMultiplier: { value: 175 }
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
                    gl_FragColor = texture2D(diffuseTexture, gl_PointCoord);
                }
            `,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            vertexColors: true,
            blending: THREE.AdditiveBlending
        })

        const points = new THREE.Points(this.geometry, this.material)
        this.scene.add(points)

    }

    createParticle(){

        this.particles.push({
            position: new THREE.Vector3(this.particlesPosition.x, this.particlesPosition.y, this.particlesPosition.z),
            direction: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, -1)
            .normalize().multiplyScalar(this.particleSpeed),
            timeToLive: 50,
            alpha: 1.0
        })

        this.update()

    }

    update(){

        const positions = new Float32Array(this.particleCount * 3)
        const colors = new Float32Array(this.particleCount * 3)

        for (let i = 0; i < this.particles.length; i++){

            this.particles[i].position.add(this.particles[i].direction)
 
            positions[i * 3] = this.particles[i].position.x
            positions[i * 3 + 1] = this.particles[i].position.y
            positions[i * 3 + 2] = this.particles[i].position.z

            let color = new THREE.Color().setHex(0xff3333)

            // if (this.particles[i].timeToLive < 20){
            //     color = new THREE.Color().setHex(0x000000)
            // }

            colors[i * 3] = color.r
            colors[i * 3 + 1] = color.g
            colors[i * 3 + 2] = color.b


            this.particles[i].timeToLive -= 1
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

        if (this.particles.length < this.particleCount){
            this.createParticle()
        }

        const removedParticles = this.particles.filter(p => p.timeToLive <= 0)
        this.particles = this.particles.filter(p => p.timeToLive > 0)

    }

    
}
