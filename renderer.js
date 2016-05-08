/**
 * A simple boid renderer. Renders each boid as a cuboid in the scene, oriented
 * along the velocity vector
 */
var BoidRenderer = function(simulator, settings) {
    this._simulator = simulator;
    this._settings = {
        showBounds: true
    };
    if (settings) {
        if (settings.showBounds != undefined) {
            this._settings.showBounds = settings.showBounds;
        }
    }
};
BoidRenderer.prototype = {
    /**
    * Generates the boid meshes and adds them to the scene
    */
    generateScene: function() {
        var scene = new THREE.Scene();
        this._addBoidsToScene(scene);

        if (this._settings.showBounds) {
            this._addBoundsToScene(scene);
        }
        return scene;
    },

    /**
    * Should be called after the boid simulator has been updated each frame so
    * we have the latest values
    */
    render: function() {
        // Since the render targets are swapped each iteration we need to make sure we are using
        // the latest values from the simulator each frame
        this._shaderMaterial.uniforms.uPos.value = this._simulator.currentPositions;
        this._shaderMaterial.uniforms.uVel.value = this._simulator.currentVelocities;
    },

    _addBoidsToScene(scene) {
        var numBoids = this._simulator.numBoids;
        var geometry = new THREE.BufferGeometry();

        //TODO: Remove
        var TEX_DIM = this._simulator.textureDimension;

        // Each boid is rendered as a cuboid, we add numBoids copies of the Box geometry
        // to the scene, all at position 0,0,0, the custom shader then reads the positions
        // from the simulator data and will render them at the correct position and with the
        // correct orientation
        var cuboid = new THREE.BoxBufferGeometry(1,1,5);
        var verts = cuboid.getAttribute("position").array;
        var positions = new Float32Array(numBoids * verts.length);
        var boidIndices = new Float32Array(numBoids * verts.length / 3);
        var posIndex = 0;
        var boidIndex = 0;
        var i,j;
        var colors = new Float32Array(numBoids * 3 * verts.length);
        var colorIndex = 0;
        for (i=0; i<numBoids; ++i) {
            var c = new THREE.Color();
            c.setHSL((i % numBoids) / numBoids, 1.0, 0.5);

            for (j=0; j<verts.length; j+=3) {
                positions[posIndex++] = verts[j];
                positions[posIndex++] = verts[j+1];
                positions[posIndex++] = verts[j+2];

                // For each vertex in the model, we need to know which boid it is associated
                // with so that in the shaders we can pull out the correct position + velocity info
                boidIndices[boidIndex++] = i;

                colors[colorIndex++] = c.r;
                colors[colorIndex++] = c.g;
                colors[colorIndex++] = c.b;
            }
        }

        var current = 0;
        var cuboidIndices = cuboid.getIndex().array;
        var newIndices = new Uint32Array(numBoids * cuboidIndices.length);
        for (i=0; i<numBoids; ++i) {
            var offset = i * verts.length / 3;
            for (j=0; j<cuboidIndices.length;++j) {
                newIndices[current++] = offset + cuboidIndices[j];
            }
        }

        geometry.setIndex(new THREE.BufferAttribute(newIndices, 1));
        geometry.addAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute('boidIndex', new THREE.BufferAttribute(boidIndices,1));
        geometry.addAttribute('color', new THREE.BufferAttribute(colors, 3));

        this._shaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uPos: { value: this._simulator.currentPositions },
                uVel: { value: this._simulator.currentVelocities },
                texDim: { value: this._simulator.textureDimension }
            },
            vertexShader: BoidRenderer._vertShader,
            fragmentShader: BoidRenderer._fragShader
        });
        scene.add(new THREE.Mesh(geometry, this._shaderMaterial));
    },

    _addBoundsToScene: function(scene) {
        var bounds = this._simulator.state.bounds;
        var geom = new THREE.BoxGeometry(
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY,
            bounds.maxZ - bounds.minZ);
        var material = new THREE.MeshBasicMaterial({
            color: 0xff0000
        });
        var mesh = new THREE.Mesh(geom, material);

        //Since the geometry is centered around 0 and assumes left/right are equal
        //we need to calculate the translation to the correct offset based on the min/max
        //values the caller passed in
        var edges = new THREE.EdgesHelper(mesh, 0x00ff00);
        edges.material.transparent = true;
        edges.material.opacity = 0.2;

        edges.translate.x = bounds.minX + (bounds.maxX - bounds.minX) / 2;
        edges.translateOnAxis(new THREE.Vector3(1,0,0), bounds.minX + (bounds.maxX - bounds.minX) / 2);
        edges.translateOnAxis(new THREE.Vector3(0,1,0), bounds.minY + (bounds.maxY - bounds.minY) / 2);
        edges.translateOnAxis(new THREE.Vector3(0,0,1), bounds.minZ + (bounds.maxZ - bounds.minZ) / 2);
        edges.updateMatrix();

        scene.add(edges);
    }
};

/**
* Simple frag shader, just make boids a solid color
*/
BoidRenderer._fragShader = `
varying vec3 vColor;

void main() {
    gl_FragColor = vec4(vColor, 1.0);
}`;

/**
* The vertex shader reads the position and velocity texture that were 
* generated by the simulator, then updates the boid vertices to have the
* correct position and orientation based on the velocities
*/
BoidRenderer._vertShader = `
// Texture of dimension texDim x texDim, containing the positions of the
// boids. Values are 16 bit floats, storing x,y,z positions
uniform sampler2D uPos;

// Texture of dimension texDim x texDim, containting the velocities of the
// boids. Values are 16 bit floats, containing the x,y,z values of the velocity vector
uniform sampler2D uVel;

uniform float texDim;
attribute vec3 color;
varying vec3 vColor;

// Value from 1 to numBoids-1 representing the index of the 
// boid that is currently being rendered
attribute float boidIndex;

mat4 rotationMatrix(vec3 axis, float angle)
{
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                0.0,                                0.0,                                0.0,                                1.0);
}

void main() {
    vColor = color;

    //For this vertex, what is the x,y offset to get the tex coord value
    vec2 boidLookup = vec2(mod(boidIndex, texDim) / texDim, floor(boidIndex / texDim) / texDim);
    vec3 p = texture2D(uPos, boidLookup).xyz;
    vec3 v = texture2D(uVel, boidLookup).xyz;

    //TODO: Fix should be based on world position of cuboid
    float cr = 1.0;//clamp(150.0 / abs(cameraPosition.z - p.z), 0.5, 2.0);

    vec3 velNorm = normalize(v);
    mat4 rot;
    if (velNorm.x == 0.0 && velNorm.y == 0.0) {
        //TODO: Degenerate case
        //http://stackoverflow.com/questions/20923232/how-to-rotate-a-vector-by-a-given-direction
        rot = rotationMatrix(vec3(0.0,1.0,0.0), 1.0);
    }
    else {
        vec3 defaultLook = vec3(0.0, 0.0, 1.0);
        vec3 axis = normalize(cross(velNorm, defaultLook));
        float angle = acos(dot(defaultLook, velNorm));
        rot = rotationMatrix(axis, angle);
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4((rot * vec4(cr * position,1.0)).xyz + p, 1.0);
}`;
