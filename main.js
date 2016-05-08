//TODO: Check for support of webgl features that we need and webgl functionality
(function() {
    var stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    var renderer = new THREE.WebGLRenderer();
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 200;

    var scene = new THREE.Scene();

    // The number of boids we can render needs to be a power of 2 sized texture e.g.
    // 2x2 or 8x8 or 32x32
    var nBoids = 32*32;

    // Bound the boids to a cube, 150units in dimension, centered
    // around 0,0,0
    var halfBounds = 150 / 2;

    // NOTE: The quality of the simulation is very much dependant on the values you
    // choose below, you will have to spend some time tweaking them to make the simulation
    // work as you expect. The values below I found from trial and error for this
    // particular example
    var simulator = new BoidSimulator(renderer, nBoids, {
        bounds: {
            minX: -halfBounds,
            maxX: halfBounds,
            minY: -halfBounds,
            maxY: halfBounds,
            minZ: -halfBounds,
            maxZ: halfBounds
        },
        boundsMultiplier: 1.0 / 2.0,

        minSpeed: 1.2,
        maxSpeed: 3.5,

        separationRadius: 7,
        separationMultiplier: 1.0 / 5.0,

        cohesionRadius: 1,
        cohesionMultiplier: 0.01,

        alignmentRadius: 15,
        alignmentMultiplier: 1.0 / 8.0
    });
    simulator.init();

    var boidRenderer = new BoidRenderer(simulator, {
        showBounds: true
    });
    scene.add(boidRenderer.generateScene());

    function render() {
        stats.begin();

        // Move boids to next iteration
        simulator.step();

        // Update the renderer with the latest state
        boidRenderer.render();

        // Optional, just rotating the bounds to emphasize the 3D nature of the scene
        scene.rotation.y += THREE.Math.degToRad(0.2);

        renderer.render(scene, camera);

        stats.end();
        requestAnimationFrame(render);
    }
    render();
})();
