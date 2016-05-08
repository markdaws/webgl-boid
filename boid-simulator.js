function BoidSimulator(renderer, numBoids, state) {

    // Since we use square textures, that must be a power of two in size, check the number
    // of boids passed in is a valid value.
    switch(numBoids) {
    case 1*1:
    case 2*2:
    case 4*4:
    case 8*8:
    case 16*16:
    case 32*32:
    case 64*64:
    case 128*128:
        break;
    default:
        throw 'Unsupported boid number, must be either 1, 4, 16, 64, 256, 1024, 4096, 16384';
    }

    this._initState(state);
    this.renderer = renderer;
    this.numBoids = numBoids;
    this.textureDimension = Math.sqrt(this.numBoids);

    this.stepOffset = 0;

    // Pass through vertex shader for computation shaders
    this._ptVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

    // Pass through fragment shader for rendering textures to render targets
    this._ptFragShader = `
varying vec2 vUv;
uniform sampler2D ptTex;

void main() {
    vec3 c = texture2D(ptTex, vUv.st).rgb;
    gl_FragColor = vec4(c, 1.0);
}`;

    // Fragment shader for calculating boid positions inside the GPU
    this._posFragShader = `
varying vec2 vUv;

// A 16float texture, storing x,y,z for each boid position, each pixel represents a single boid
uniform sampler2D posTex;

// A 16float texture, storing x,y,z for each boid velocity, each pixel represents a single boid
uniform sampler2D velTex;

void main() {
    vec3 currentPos = texture2D(posTex, vUv.xy).xyz;
    vec3 currentVel = texture2D(velTex, vUv.xy).xyz;
    gl_FragColor = vec4(currentPos + currentVel, 1.0);
}`;

    this._velFragShader = `
varying vec2 vUv;
uniform sampler2D posTex;
uniform sampler2D velTex;
uniform float uMinX;
uniform float uMaxX;
uniform float uMinY;
uniform float uMaxY;
uniform float uMinZ;
uniform float uMaxZ;
uniform float uBoundsMultiplier;
uniform float uMinSpeed;
uniform float uMaxSpeed;
uniform float uSeparationRadius;
uniform float uSeparationMultiplier;
uniform float uCohesionRadius;
uniform float uCohesionMultiplier;
uniform float uAlignmentRadius;
uniform float uAlignmentMultiplier;
uniform float uStepSize;
uniform float uStepOffset;

const float texDim = ` + this.textureDimension.toFixed(1) + `;
const float xSize = ` + (this.textureDimension / this.state.stepSize).toFixed(1) + `;

vec3 clampVel(in vec3 v) {
  vec3 newVel = normalize(v) * min(uMaxSpeed, max(length(v), uMinSpeed));
  return newVel;
}

vec3 all(in vec3 currentVelocity, in vec3 currentPosition) {
  vec2 currentIndex = vUv.xy * texDim;
  const float width=texDim;
  const float height=texDim;
  vec3 cohesionCentroid = vec3(0.0, 0.0, 0.0);
  vec3 alignmentVelocity = vec3(0.0, 0.0, 0.0);
  vec3 separationVelocity = vec3(0.0, 0.0, 0.0);
  float cohesionCount = 0.0;
  float alignmentCount = 0.0;
  float radiusCohesionSq = uCohesionRadius * uCohesionRadius;
  float radiusSeparationSq = uSeparationRadius * uSeparationRadius;
  float radiusAlignmentSq = uAlignmentRadius * uAlignmentRadius;
  float invTexDim = 1.0 / texDim;

  for (float x=0.0; x<xSize; ++x) {
    float xPos = (uStepOffset + x * uStepSize) * invTexDim;
    for (float y=0.0; y<height; ++y) {
        float yPos = y * invTexDim;
        vec2 lookup = vec2(xPos, yPos);
        vec3 neighbourPos = texture2D(posTex, lookup).xyz;
        vec3 delta = neighbourPos - currentPosition;
        float distSq = dot(delta, delta);

        float includeCohesion = max(0.0, sign(radiusCohesionSq - distSq) - 0.5);
        cohesionCentroid += includeCohesion * neighbourPos;
        cohesionCount += includeCohesion * 1.0;

        float includeAlignment = max(0.0, sign(radiusAlignmentSq - distSq) - 0.5);
        alignmentVelocity += texture2D(velTex, lookup).xyz * includeAlignment;
        alignmentCount += 1.0 * includeAlignment;

        float includeSeparation = max(0.0, sign(radiusSeparationSq - distSq) - 0.5);
        separationVelocity -= delta * includeSeparation;
    }
  }

  vec3 final = clampVel(separationVelocity);
  if (cohesionCount > 0.0) {
    cohesionCentroid /= cohesionCount;
    final += clampVel((cohesionCentroid - currentPosition) * uCohesionMultiplier);
  }
  if (alignmentCount > 0.0) {
    alignmentVelocity /= alignmentCount;
    final += clampVel((alignmentVelocity - currentVelocity) * uAlignmentMultiplier);
  }
  return final;
}

vec3 bound(in vec3 pos) {
    vec3 velocity = vec3(0.0, 0.0, 0.0);
    if (pos.x > uMaxX) {
      velocity.x = -uBoundsMultiplier;
    }
    else if (pos.x < uMinX) {
      velocity.x = uBoundsMultiplier;
    }
    else if (pos.y > uMaxY) {
      velocity.y = -uBoundsMultiplier;
    }
    else if (pos.y < uMinY) {
      velocity.y = uBoundsMultiplier;
    }
    else if (pos.z > uMaxZ) {
      velocity.z = -uBoundsMultiplier;
    }
    else if (pos.z < uMinZ) {
      velocity.z = uBoundsMultiplier;
    }
    return velocity;
}

vec3 avoid(in vec3 pos) {
   vec3 velocity = vec3(0.0,0.0,0.0);

   vec3 target = vec3(0.0,0.0,0.0);
   vec3 delta = target - pos;
   if (length(delta) < 5.0) {
    return -delta;
   }
   else {
   return vec3(0.0,0.0,0.0);
   }
}

void main() {
  vec3 oldVel = texture2D(velTex, vUv.xy).xyz;
  vec3 currentPosition = texture2D(posTex, vUv.xy).xyz;
  vec3 currentVelocity = texture2D(velTex, vUv.xy).xyz;

  vec3 aa = all(currentVelocity, currentPosition);
  vec3 newVel = oldVel + 0.2 * aa;
  vec3 b = bound(currentPosition + newVel);
  newVel += b;

  newVel = clampVel(newVel);
  gl_FragColor = vec4(newVel,1.0);
}`;
}

BoidSimulator.prototype = {
    init: function() {
        // This scene is used to pass through a texture to a render target
        this._ptCamera = new THREE.Camera();
        this._ptCamera.position.z = 1;
        this._ptScene = new THREE.Scene();
        this._ptMaterial = new THREE.ShaderMaterial({
            uniforms: {
                ptTex: { }
            },
            vertexShader: this._ptVertexShader,
            fragmentShader: this._ptFragShader
        });
        this._ptMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2), this._ptMaterial);
        this._ptScene.add(this._ptMesh);

        // Create the initial random positions and velocities
        var positions = this._randomPositions();
        this._pos1 = this._createRenderTarget();
        this._pos2 = this._createRenderTarget();
        var velocities = this._randomVelocities();
        this._vel1 = this._createRenderTarget();
        this._vel2 = this._createRenderTarget();
        this._renderTextureToTarget(positions, this._pos1);
        this._renderTextureToTarget(positions, this._pos2);
        this._renderTextureToTarget(velocities, this._vel1);
        this._renderTextureToTarget(velocities, this._vel2);

        positions.dispose();
        velocities.dispose();
        positions = velocities = null;

        // Setup the shader which will process the positions
        this._posMaterial = new THREE.ShaderMaterial({
            uniforms: {
                posTex: { type: "t" },
                velTex: { type: "t" }
            },
            vertexShader: this._ptVertexShader,
            fragmentShader: this._posFragShader
        });
        this._posScene = new THREE.Scene();
        this._posMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2), this._posMaterial);
        this._posScene.add(this._posMesh);

        var bounds = this.state.bounds;
        this._velMaterial = new THREE.ShaderMaterial({
            uniforms: {
                posTex: { type: "t" },
                velTex: { type: "t" },
                uMinX: { value: bounds.minX },
                uMaxX: { value: bounds.maxX },
                uMinY: { value: bounds.minY },
                uMaxY: { value: bounds.maxY },
                uMinZ: { value: bounds.minZ },
                uMaxZ: { value: bounds.maxZ },
                uBoundsMultiplier: { value: this.state.boundsMultiplier },
                uMinSpeed: { value: this.state.minSpeed },
                uMaxSpeed: { value: this.state.maxSpeed },
                uSeparationRadius: { value: this.state.separationRadius },
                uSeparationMultiplier: { value: this.state.separationMultiplier },
                uCohesionRadius: { value: this.state.cohesionRadius },
                uCohesionMultiplier: { value: this.state.cohesionMultiplier },
                uAlignmentRadius: { value: this.state.alignmentRadius },
                uAlignmentMultiplier: { value: this.state.alignmentMultiplier },
                uStepSize: { value: this.state.stepSize },
                uStepOffset: { value: 0 }
            },
            vertexShader: this._ptVertexShader,
            fragmentShader: this._velFragShader
        });
        this._velScene = new THREE.Scene();
        this._velMesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2,2), this._velMaterial);
        this._velScene.add(this._velMesh);
    },

    dispose: function() {
        this._pos1.dispose();
        this._pos2.dispose();
        this._vel1.dispose();
        this._vel2.dispose();
        this._velMesh.material.dispose();
        this._velMesh.geometry.dispose();
        this._posMesh.material.dispose();
        this._posMesh.geometry.dispose();
        this._ptMesh.material.dispose();
        this._ptMesh.geometry.dispose();
    },

        /**
    * @param {Object} state
    * @param {Object} state.bounds
    * @param {number} state.bounds.minX
    * @param {number} state.bounds.maxX
    * @param {number} state.bounds.minY
    * @param {number} state.bounds.maxY
    * @param {number} state.bounds.minZ
    * @param {number} state.bounds.maxZ
    * @param {number} state.boundsMultiplier
    * @param {number} state.minSpeed
    * @param {number} state.maxSpeed
    * @param {number} state.separationRadius
    * @param {number} state.separationMultiplier
    * @param {number} state.cohesionRadius
    * @param {number} state.cohesionMultiplier
    * @param {number} state.alignmentRadius
    * @param {number} state.alignmentMultiplier
    * @param {number} state.stepSize;
    * state.bounds: 
    */
    _initState: function(state) {
        this.state = state;
        if (this.state.bounds == undefined) {
            throw 'You must specify a state.bounds value';
        }
        if (this.state.boundsMultiplier == undefined) {
            throw 'You must specify a state.boundsMultiplier value';
        }
        if (this.state.minSpeed == undefined) {
            throw 'You must specify a state.minSpeed value';
        }
        if (this.state.maxSpeed == undefined) {
            throw 'You must specify a state.maxSpeed value';
        }
        if (this.state.separationRadius == undefined) {
            throw 'You must specify a state.separationRadius value';
        }
        if (this.state.separationMultiplier == undefined) {
            throw 'You must specify a state.separationMultiplier value';
        }
        if (this.state.cohesionRadius == undefined) {
            throw 'You must specify a state.cohesionRadius value';
        }
        if (this.state.cohesionMultiplier == undefined) {
            throw 'You must specify a state.cohesionMultiplier value';
        }
        if (this.state.alignmentRadius == undefined) {
            throw 'You must specify a state.alignmentRadius value';
        }
        if (this.state.alignmentMultiplier == undefined) {
            throw 'You must specify a state.alignmentMultiplier value';
        }
        if (this.state.stepSize == undefined) {
            throw 'You must specify a state.stepSize value';
        }
    },

    _renderTextureToTarget: function(texture, target) {
        this._ptMaterial.uniforms.ptTex.value = texture;
        this.renderer.render(this._ptScene, this._ptCamera, target);
    },

    step: function() {

        this._stepVelocities();
        this._stepPositions();

        this.stepOffset = (this.stepOffset + this.state.stepSize) % this.state.stepSize;
        this._velMaterial.uniforms.uStepOffset.value = this.stepOffset;

        //Texture tick-tock, will swap the outputs of one render
        //cycle to be the inputs of the next cycle
        this.tick = !this.tick;
    },

    _stepVelocities: function() {
        if (this.tick) {
            this._velMaterial.uniforms.velTex.value = this._vel1;
            this._velMaterial.uniforms.posTex.value = this._pos2;
            this.renderer.render(this._velScene, this._ptCamera, this._vel2);
            this.currentVelocities = this._vel2;
        }
        else {
            this._velMaterial.uniforms.velTex.value = this._vel2;
            this._velMaterial.uniforms.posTex.value = this._pos1;
            this.renderer.render(this._velScene, this._ptCamera, this._vel1);
            this.currentVelocities = this._vel1;
        }
    },

    _stepPositions: function() {
        if (this.tick) {
            this._posMaterial.uniforms.posTex.value = this._pos1;
            this._posMaterial.uniforms.velTex.value = this._vel2;
            this.renderer.render(this._posScene, this._ptCamera, this._pos2);
            this.currentPositions = this._pos2;
        }
        else {
            this._posMaterial.uniforms.posTex.value = this._pos2;
            this._posMaterial.uniforms.velTex.value = this._vel1;
            this.renderer.render(this._posScene, this._ptCamera, this._pos1);
            this.currentPositions = this._pos1;
        }
    },

    _createRenderTarget: function() {
        var rt = new THREE.WebGLRenderTarget(
            this.textureDimension,
            this.textureDimension,
            {
                wrapS: THREE.RepeatWrapping,
                wrapT: THREE.RepeatWrapping,
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                type: THREE.FloatType,
                format: THREE.RGBAFormat,
                stencilBuffer: false
            }
        );
        return rt;
    },

    _randomPositions: function() {
        var bounds = this.state.bounds;
        var data = new Float32Array(this.numBoids * 4);
        for (var i=0, j=this.numBoids * 4; i<j; i+=4) {
            data[i] = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
            data[i + 1] = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
            data[i + 2] = bounds.minZ + Math.random() * (bounds.maxZ - bounds.minZ);
            data[i + 3] = 1;
        }

        var tex = new THREE.DataTexture(
            data,
            this.textureDimension,
            this.textureDimension,
            THREE.RGBAFormat,
            THREE.FloatType);
        tex.needsUpdate = true;
        return tex;
    },

    _randomVelocities: function() {
        var data = new Float32Array(this.numBoids * 4);
        for (var i=0, j=this.numBoids * 4; i<j; i+=4) {
            var v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
            v.setLength(this.state.minSpeed + Math.random() * (this.state.maxSpeed - this.state.minSpeed));

            data[i] = v.x;
            data[i + 1] = v.y;
            data[i + 2] = v.z;
            //TODO: 1 or 255
            data[i + 3] = 1;
        }

        var tex = new THREE.DataTexture(data, this.textureDimension, this.textureDimension, THREE.RGBAFormat, THREE.FloatType);
        tex.needsUpdate = true;
        return tex;
    }
};
