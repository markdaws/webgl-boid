//TODO: Check for support of webgl features that we need and webgl functionality
(function() {
    var stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    // The number of boids we can render needs to be a power of 2 sized texture e.g.
    // 2x2 or 8x8 or 32x32, add ?numBoids=X to the querystring to change the number
    var query = window.location.search.split('=');
    var numBoids = query.length === 2 ? parseInt(query[1], 10) : 32*32;

    // The visual appearance of the simulation is very dependant on the parameters you choose. One config
    // may look good for a certain bounding size, but not for another, you will need to play around with the
    // values to find something that looks good for your application
    var presets = {
        1024: {
            cameraZ: 200,
            state: {
                bounds: {
                    minX: -75,
                    maxX: 75,
                    minY: -75,
                    maxY: 75,
                    minZ: -75,
                    maxZ: 75
                },
                boundsMultiplier: 1.0 / 2.0,

                minSpeed: 1.2,
                maxSpeed: 3.5,

                separationRadius: 7,
                separationMultiplier: 1.0 / 5.0,

                cohesionRadius: 1,
                cohesionMultiplier: 0.01,

                alignmentRadius: 15,
                alignmentMultiplier: 1.0 / 8.0,

                stepSize: 1
            }
        },
        4096: {
            cameraZ: 300,
            state: {
                bounds: {
                    minX: -110,
                    maxX: 110,
                    minY: -110,
                    maxY: 110,
                    minZ: -110,
                    maxZ: 110
                },
                boundsMultiplier: 1.0 / 2.0,

                minSpeed: 1.2,
                maxSpeed: 3.5,

                separationRadius: 7,
                separationMultiplier: 1.0 / 5.0,

                cohesionRadius: 1,
                cohesionMultiplier: 0.01,

                alignmentRadius: 15,
                alignmentMultiplier: 1.0 / 8.0,

                stepSize: 2
            }
        },
        16384: {
            cameraZ: 300,
            state: {
                bounds: {
                    minX: -110,
                    maxX: 110,
                    minY: -110,
                    maxY: 110,
                    minZ: -110,
                    maxZ: 110
                },
                boundsMultiplier: 1.0 / 2.0,

                minSpeed: 1.2,
                maxSpeed: 3.5,

                separationRadius: 7,
                separationMultiplier: 1.0 / 5.0,

                cohesionRadius: 1,
                cohesionMultiplier: 0.01,

                alignmentRadius: 15,
                alignmentMultiplier: 1.0 / 8.0,

                stepSize: 16
            }
        }
    };
    // Set all to the same as the values we defined in 1024
    presets[1] = presets[4] = presets[16] = presets[64] = presets[256] = presets[1024];

    var renderer = new THREE.WebGLRenderer();
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    var datGui = new dat.GUI();
    var currentPreset = presets[numBoids].state;
    datGui.add(currentPreset, 'minSpeed').onFinishChange(resetSimulation);
    datGui.add(currentPreset, 'maxSpeed').onFinishChange(resetSimulation);
    datGui.add(currentPreset, 'separationRadius').onFinishChange(resetSimulation);
    datGui.add(currentPreset, 'separationMultiplier').onFinishChange(resetSimulation);
    datGui.add(currentPreset, 'cohesionRadius').onFinishChange(resetSimulation);
    datGui.add(currentPreset, 'cohesionMultiplier').onFinishChange(resetSimulation);
    datGui.add(currentPreset, 'alignmentRadius').onFinishChange(resetSimulation);
    datGui.add(currentPreset, 'alignmentMultiplier').onFinishChange(resetSimulation);
    datGui.add(currentPreset, 'stepSize').onFinishChange(resetSimulation);
    datGui.add(currentPreset.bounds, 'minX').onFinishChange(resetSimulation);
    datGui.add(currentPreset.bounds, 'maxX').onFinishChange(resetSimulation);
    datGui.add(currentPreset.bounds, 'minY').onFinishChange(resetSimulation);
    datGui.add(currentPreset.bounds, 'maxY').onFinishChange(resetSimulation);
    datGui.add(currentPreset.bounds, 'minZ').onFinishChange(resetSimulation);
    datGui.add(currentPreset.bounds, 'maxZ').onFinishChange(resetSimulation);
    datGui.add(currentPreset, 'boundsMultiplier').onFinishChange(resetSimulation);

    var simulator, boidRenderer, scene, camera;
    function resetSimulation() {
        simulator && simulator.dispose();
        boidRenderer && boidRenderer.dispose();

        simulator = new BoidSimulator(renderer, numBoids, presets[numBoids].state);
        simulator.init();

        boidRenderer = new BoidRenderer(simulator, {
            showBounds: true
        });
        scene = new THREE.Scene();
        scene.add(boidRenderer.generateScene());

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = presets[numBoids].cameraZ;
    }
    resetSimulation();

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
