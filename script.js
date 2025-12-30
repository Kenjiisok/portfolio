// Toggle mobile menu
function toggleMenu() {
    const menu = document.querySelector(".menu-links");
    const icon = document.querySelector(".icone-icon");
    menu.classList.toggle("open");
    icon.classList.toggle("open");
}

// Toggle dark/light theme
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');

    if (currentTheme === 'dark') {
        html.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    } else {
        html.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
}

// Load saved theme on page load
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    }
}

// Initialize theme when DOM is ready
document.addEventListener('DOMContentLoaded', loadTheme);

// Random color wave animation for name
function animateName() {
    const nameElement = document.getElementById('animated-name');
    if (!nameElement) return;

    const text = nameElement.textContent;
    nameElement.innerHTML = '';

    // Create spans for each letter
    for (let i = 0; i < text.length; i++) {
        const span = document.createElement('span');
        span.textContent = text[i];
        span.style.display = 'inline-block';
        span.style.transition = 'color 0.5s ease';
        if (text[i] === ' ') {
            span.style.width = '0.3em';
        }
        nameElement.appendChild(span);
    }

    const colors = [
        '#0984e3', '#00b894', '#e17055', '#6c5ce7',
        '#fd79a8', '#00cec9', '#e84393', '#74b9ff',
        '#55efc4', '#a29bfe', '#ff7675', '#fdcb6e'
    ];

    const spans = nameElement.querySelectorAll('span');
    let colorIndex = 0;

    // Wave animation
    function wave() {
        spans.forEach((span, index) => {
            setTimeout(() => {
                const color = colors[(colorIndex + index) % colors.length];
                span.style.color = color;
            }, index * 50);
        });
        colorIndex = (colorIndex + 1) % colors.length;
    }

    // Start wave and repeat
    wave();
    setInterval(wave, 1000);
}

// Start name animation
document.addEventListener('DOMContentLoaded', animateName);