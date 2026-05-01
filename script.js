const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

let width, height;

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = canvas.width = rect.width;
    height = canvas.height = rect.height;
}
window.addEventListener('resize', resizeCanvas);

// Simulation State
let molecules = [];
let oils = [];
let waterParticles = [];
let state = 'FREE'; // FREE, OIL_ADDED, FORMING, WASHING

class WaterParticle {
    constructor() {
        this.x = -50 - Math.random() * 100;
        this.y = Math.random() * height;
        this.vx = 1.5 + Math.random() * 2; // Very slow flow
        this.radius = 2 + Math.random() * 5;
    }
    update() {
        this.x += this.vx;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fill();
    }
}

class Oil {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.targetRadius = 30 + Math.random() * 20;
    }

    update() {
        if (state === 'WASHING') {
            if (this.vx === undefined) this.vx = 0;
            if (this.vx < 1.5) this.vx += 0.02; // Accelerate slowly
            this.x += this.vx;
            
            // Repeat action: loop back to the left side
            if (this.x > width + 150) {
                this.x = -150;
                
                // Keep the attached molecules with the moving oil
                molecules.forEach(m => {
                    if (m.targetOil === this) {
                        m.x -= (width + 300);
                    }
                });
            }
        } else if (this.radius < this.targetRadius) {
            this.radius += 0.5; // Smoothly grow when added
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        const gradient = ctx.createRadialGradient(
            this.x - this.radius * 0.3, this.y - this.radius * 0.3, this.radius * 0.1,
            this.x, this.y, this.radius
        );
        gradient.addColorStop(0, '#a3e635');
        gradient.addColorStop(1, '#4d7c0f');
        
        ctx.fillStyle = gradient;
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(163, 230, 53, 0.4)';
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
    }
}

class Molecule {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 2;
        this.vy = (Math.random() - 0.5) * 2;
        this.angle = Math.random() * Math.PI * 2;
        
        this.headColor = '#38bdf8';
        this.tailColor = '#fbbf24';
        this.headRadius = 9;
        this.tailLength = 37.5;

        this.targetOil = null;
        this.targetAngle = 0;
    }

    update() {
        if (state === 'FREE' || state === 'OIL_ADDED') {
            this.x += this.vx;
            this.y += this.vy;
            
            const movementAngle = Math.atan2(this.vy, this.vx);
            // Gradually align with movement direction
            this.angle += (movementAngle - this.angle) * 0.1;

            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;
        } 
        else if (state === 'FORMING' || state === 'WASHING') {
            if (this.targetOil) {
                // Determine target position on the perimeter of the oil drop
                const distFromCenter = this.targetOil.radius + this.tailLength - 7.5;
                const targetX = this.targetOil.x + Math.cos(this.targetAngle) * distFromCenter;
                const targetY = this.targetOil.y + Math.sin(this.targetAngle) * distFromCenter;

                // Move towards target
                const dx = targetX - this.x;
                const dy = targetY - this.y;
                
                this.x += dx * 0.08;
                this.y += dy * 0.08;

                // Angle points from head to tail.
                // We want tail towards oil, head outwards.
                // So angle (tail direction relative to head) should be towards oil center.
                const desiredAngle = Math.atan2(this.targetOil.y - this.y, this.targetOil.x - this.x);
                
                let angleDiff = desiredAngle - this.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                
                this.angle += angleDiff * 0.1;

                // Make them slowly orbit the micelle
                this.targetAngle += 0.005;
            } else if (state === 'WASHING') {
                if (this.vx < 1.5) this.vx += 0.02; // Slower wash
                this.x += this.vx;
                this.y += Math.sin(this.x * 0.05) * 2;
                
                if (this.x > width + 150) {
                    this.x = -150; // Loop free molecules back
                }
                
                let angleDiff = 0 - this.angle;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                this.angle += angleDiff * 0.1;
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Draw Hydrophobic Tail (zig-zag / wavy line)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(this.tailLength * 0.25, 9, this.tailLength * 0.5, 0);
        ctx.quadraticCurveTo(this.tailLength * 0.75, -9, this.tailLength, 0);
        
        ctx.strokeStyle = this.tailColor;
        ctx.lineWidth = 3.75;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Draw Hydrophilic Head
        ctx.beginPath();
        ctx.arc(0, 0, this.headRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.headColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.headColor;
        ctx.fill();

        ctx.restore();
    }
}

function init() {
    resizeCanvas();
    molecules = [];
    oils = [];
    waterParticles = [];
    state = 'FREE';
    
    // Generate soap molecules
    for (let i = 0; i < 200; i++) {
        molecules.push(new Molecule());
    }
}

function addOil() {
    if (state === 'WASHING' || oils.length >= 5) return; // Prevent too many oil drops
    const padding = 100;
    const x = padding + Math.random() * (width - 2 * padding);
    const y = padding + Math.random() * (height - 2 * padding);
    oils.push(new Oil(x, y));
    state = 'OIL_ADDED';
}

function formMicelles() {
    if (state === 'WASHING') return;
    if (oils.length === 0) {
        // Automatically add one oil drop if user didn't
        addOil();
        // Give it a tiny bit of time to start growing, or just let it form instantly
    }
    
    state = 'FORMING';
    
    // Assign each soap molecule to the closest oil particle
    molecules.forEach(m => {
        let nearestOil = oils[0];
        let minDistance = Infinity;
        
        oils.forEach(oil => {
            const dist = Math.hypot(oil.x - m.x, oil.y - m.y);
            if (dist < minDistance) {
                minDistance = dist;
                nearestOil = oil;
            }
        });
        
        m.targetOil = nearestOil;
        m.targetAngle = Math.random() * Math.PI * 2; // Random position on the micelle
    });
}

function wash() {
    state = 'WASHING';
}

function animate() {
    // Semi-transparent fill for a nice trailing effect
    ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
    ctx.fillRect(0, 0, width, height);

    if (state === 'WASHING') {
        for(let i=0; i<3; i++) { // Spawn fewer particles for slower flow
            waterParticles.push(new WaterParticle());
        }
        for(let i = waterParticles.length - 1; i >= 0; i--) {
            let wp = waterParticles[i];
            wp.update();
            wp.draw();
            if (wp.x > width + 50) waterParticles.splice(i, 1);
        }
    }

    oils.forEach(oil => {
        oil.update();
        oil.draw();
    });

    molecules.forEach(m => {
        m.update();
        m.draw();
    });

    requestAnimationFrame(animate);
}

// Setup Event Listeners
document.getElementById('addOilBtn').addEventListener('click', addOil);
document.getElementById('formMicellesBtn').addEventListener('click', formMicelles);
document.getElementById('washBtn').addEventListener('click', wash);
document.getElementById('resetBtn').addEventListener('click', init);

// Start Simulation
// Delay init slightly to ensure canvas is sized
setTimeout(() => {
    init();
    animate();
}, 50);
