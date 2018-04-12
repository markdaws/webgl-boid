# webgl-boid
A webgl implementation of a boid simulation using [three.js](http://threejs.org/)

Boid positions + velocities are calculated on the GPU, not the CPU allowing a larger number of boid to be simulated in real time.

# Overview
From [Wikipedia](https://en.wikipedia.org/wiki/Boids):
>Boids is an artificial life program, developed by Craig Reynolds in 1986, which simulates the flocking behaviour of birds. His paper on this topic was published in 1987 in the proceedings of the ACM SIGGRAPH conference.[1] The name "boid" corresponds to a shortened version of "bird-oid object", which refers to a bird-like object.[2] Its pronunciation evokes that of "bird" in a stereotypical New York accent.
As with most artificial life simulations, Boids is an example of emergent behavior; that is, the complexity of Boids arises from the interaction of individual agents (the boids, in this case) adhering to a set of simple rules. The rules applied in the simplest Boids world are as follows:
 - separation: steer to avoid crowding local flockmates
 - alignment: steer towards the average heading of local flockmates
 - cohesion: steer to move toward the average position (center of mass) of local flockmates




This implementation uses a naive n^2 implementation for calculating the updated velocities and positions of each boid.

# Demo
Click [http://markdaws.github.io/webgl-boid](http://markdaws.github.io/webgl-boid) to see a live demo

![](/boid.png)

# Code
To use the simulator in your own code, look at main.js.  It has an example of how to initialize the simulator, the demo page has a renderer.js file that renders the boids as cuboids, but you can render the boids any way you want.
