const segments = [
    { label: "10% OFF Chatbots", domain: "Chatbots", discount: 10, couponCode: "ZTX-CBOT10", color: "#2a2a40" },
    { label: "15% OFF Chatbots", domain: "Chatbots", discount: 15, couponCode: "ZTX-CBOT15", color: "#3a3a55" },
    { label: "10% OFF Websites", domain: "Websites", discount: 10, couponCode: "ZTX-WEB10", color: "#2a2a40" },
    { label: "15% OFF Websites", domain: "Websites", discount: 15, couponCode: "ZTX-WEB15", color: "#3a3a55" },
    { label: "10% OFF Apps", domain: "Mobile Apps", discount: 10, couponCode: "ZTX-MAPP10", color: "#2a2a40" },
    { label: "15% OFF Apps", domain: "Mobile Apps", discount: 15, couponCode: "ZTX-MAPP15", color: "#3a3a55" },
    { label: "10% OFF Custom", domain: "Custom Software", discount: 10, couponCode: "ZTX-CUST10", color: "#2a2a40" },
    { label: "15% OFF Custom", domain: "Custom Software", discount: 15, couponCode: "ZTX-CUST15", color: "#3a3a55" }
];

const wheelInner = document.getElementById('wheelInner');
const spinBtn = document.getElementById('spinBtn');
const userNameInput = document.getElementById('userName');
const userEmailInput = document.getElementById('userEmail');
const resultModal = document.getElementById('resultModal');
const resultText = document.getElementById('resultText');
const couponItem = document.getElementById('couponCode');
const closeModalBtn = document.getElementById('closeModalBtn');
const confettiCanvas = document.getElementById('confettiCanvas');

let currentRotation = 0;

// Initialize Wheel Labels
function initWheel() {
    const segmentAngle = 360 / segments.length; // 45 degrees

    segments.forEach((seg, index) => {
        // Create label element
        const label = document.createElement('div');
        label.classList.add('segment-label');
        label.innerText = seg.label;

        // Calculate rotation for label
        // We want the text to be in the middle of the slice
        // Slice starts at index*45
        // Middle is index*45 + 22.5
        // We assume 0deg is at 3 o'clock (standard CSS rotation). 
        // We map standard css rotation to our conic gradient slices which start at 12 o'clock usually or 0deg.
        // Conic gradient 0deg is usually Top (12 o'clock). CSS rotate 0deg is usually Top? No, check specific implementation.
        // Actually conic-gradient starts at 12 'clock (top) by default.
        // Transform rotate also rotates from 12 o'clock? No, usually element rotation center.
        // Let's assume conic starts at 12:00.
        // Segment 0: 0-45 deg (Top-Rightish). Center: 22.5 deg.

        // Transform: rotate(angle) translate(radius/2) rotate(-angle)? 
        // Simplest: Rotate about center, padding moves text out.
        // -90 to align with standard cartesian if needed, but here we can just follow the clock.
        // But we want text easier to read? Radial text.

        const rotation = (index * segmentAngle) + (segmentAngle / 2);
        // We subtract 90 because "left: 50%" places it at 12 o'clock, but we want to rotate from there.
        // Actually, let's just rotate.

        label.style.transform = `translate(-50%, -50%) rotate(${rotation - 90}deg) translate(80px) rotate(90deg)`;

        // Revised label positioning to correspond with conic segments
        // Only rotate: 
        label.style.position = 'absolute';
        label.style.left = '50%';
        label.style.top = '50%';
        // Pivot point is left center of the label (if we change origin) or center.
        // Let's use a simpler approach for the label.
        // Translate Y to radius, Rotate.

        // Reset transform
        label.style.transformOrigin = 'left center';
        // Move to center, rotate to angle, move out.
        // Conic starts at Top (0deg).
        // Slice 0 center = 22.5deg.
        // We want text to radian out from center.
        // -90 is to align the text horizontally first? 
        // Let's trial and error with a simple math:
        // Text is naturally horizontal.
        // Rotate (Angle - 90) -> points outward from center?

        label.style.transform = `rotate(${rotation - 90}deg) translate(60px)`;
        // translate(60px) pushes it out from center.

        wheelInner.appendChild(label);
    });
}

initWheel();

spinBtn.addEventListener('click', () => {
    const name = userNameInput.value.trim();
    const email = userEmailInput.value.trim();

    if (!name) {
        alert("Please enter your name.");
        return;
    }

    // Basic Email Validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert("Please enter a valid email address.");
        return;
    }

    // Disable button
    spinBtn.disabled = true;
    spinBtn.innerText = "Spinning...";

    // Determine Result Randomly
    const winnerIndex = Math.floor(Math.random() * segments.length);
    const winner = segments[winnerIndex];

    // Calculate Rotation
    // We want the Winner Index to end up at the TOP (Pointer).
    // Pointer is at Top (0 deg in Conic terms if we don't rotate container).
    // Conic gradient: Slice 0 is 0-45. Center 22.5.
    // If we want Slice 0 to be at Top, we need to rotate the wheel such that 22.5 aligns with 0 (or 360).
    // So rotation = -22.5 deg.
    // Example: Slice 1 (Index 1) is 45-90. Center 67.5.
    // Rotation = -67.5 deg.
    // General: Rotation = - (Index * 45 + 22.5).

    // Add extra spins (e.g., 5 full rotations = 1800 deg)
    const extraSpins = 5 * 360;
    const targetRotation = -(winnerIndex * 45 + 22.5);

    // Current rotation tracking ensures we don't spin backwards
    // We want to go from current to (current + extra + adjustment)
    // Actually simpler: just add to current.
    // We need to land on a specific angle relative to the circle.

    const totalRotation = extraSpins + targetRotation; // This implies resetting to 0 internally, but visuals might jerk.

    // Better: Add to current value.
    // New Target = Current + Extra + (Angle Difference).
    // But direct calculation is easier if we just set new transform value.
    // Force positive rotation.

    // Let's use a huge number + offset.
    // Calculate the precise angle needed to align winner to top.
    // offset = (winnerIndex * 45 + 22.5)
    // We want final angle % 360 == -offset (or 360 - offset).
    // Let's just use the negative logic, it works fine for 1 spin.

    // To allow multiple spins without reset (though refreshing page is expected), we can accumulate.
    // For this session:
    currentRotation += extraSpins + (360 - (currentRotation % 360)) + targetRotation;
    // This is getting complex. Simple logic:
    // Just set transform to a new large value.

    // Fixed logic:
    // visual_angle = current_angle + (360 * 4) + (360 - current_angle % 360) - (winner_center_angle)
    // winner_center_angle = winnerIndex * 45 + 22.5

    const winnerAngle = (winnerIndex * 45) + 22.5;
    // We want to end at -winnerAngle (relative to 0).
    // So find next multiple of 360 minus winnerAngle.

    // Reset basic approach:
    // Just Spin!
    const spinAngle = 360 * 4 + (360 - winnerAngle);

    wheelInner.parentElement.style.transform = `rotate(${spinAngle}deg)`;

    // Wait for animation
    setTimeout(() => {
        handleWin(winner, name, email);
    }, 4000);
});

async function handleWin(winner, name, email) {
    try {
        const response = await fetch('/api/spin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                email,
                domain: winner.domain,
                discount: winner.discount,
                couponCode: winner.couponCode
            })
        });

        const data = await response.json();

        if (data.allowed) {
            // Show Success Modal
            resultText.innerText = `You got ${winner.discount}% OFF on ${winner.domain}.`;
            couponItem.innerText = winner.couponCode;
            showModal();
            triggerConfetti();
        } else {
            // Show duplicate message
            alert(data.message || "You have already spun the wheel.");
            // Reset button
            spinBtn.disabled = false;
            spinBtn.innerText = "Spin Now";
        }

    } catch (e) {
        console.error(e);
        alert("Something went wrong with the server. Please try again.");
        spinBtn.disabled = false;
        spinBtn.innerText = "Spin Now";
    }
}

function showModal() {
    resultModal.classList.remove('hidden');
    resultModal.classList.add('visible');
}

closeModalBtn.addEventListener('click', () => {
    resultModal.classList.remove('visible');
    resultModal.classList.add('hidden');
    // Optional: Reset wheel or disable further spins
    spinBtn.innerText = "Spin Completed";
});

// Utility: Confetti
function triggerConfetti() {
    var myCanvas = document.getElementById('confettiCanvas');
    var myConfetti = confetti.create(myCanvas, {
        resize: true,
        useWorker: true
    });
    myConfetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00f2ff', '#bd00ff', '#ffffff']
    });
}
