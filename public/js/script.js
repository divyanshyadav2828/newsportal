document.addEventListener('DOMContentLoaded', () => {
    // --- UI ELEMENT SELECTORS ---
    const navMenu = document.getElementById('nav-menu');
    const navToggle = document.getElementById('nav-toggle');
    const navClose = document.getElementById('nav-close');
    const themeBtn = document.getElementById('theme-btn');
    
    const searchBtn = document.getElementById('search-btn');
    const searchContainer = document.getElementById('search');
    const searchInput = document.getElementById('search-input-field');
    const loginBtn = document.getElementById('login-btn');
    const loginContainer = document.getElementById('login');
    const loginClose = document.getElementById('login-close');
    const loginForm = document.getElementById('login-form-popup');
    const newsGrid = document.getElementById('news-grid');

    // --- MOBILE MENU ---
    if (navToggle) {
        navToggle.addEventListener('click', () => navMenu.classList.add('show-menu'));
    }
    if (navClose) {
        navClose.addEventListener('click', () => navMenu.classList.remove('show-menu'));
    }

    // --- DROPDOWN (for mobile) ---
    document.querySelectorAll('.dropdown__link').forEach(link => {
        link.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024) {
                e.preventDefault();
                const dropdown = e.target.closest('.dropdown');
                dropdown.classList.toggle('show-dropdown');
            }
        });
    });

    // --- THEME TOGGLE ---
    const lightTheme = 'light-theme';
    const iconTheme = 'ri-sun-line';

    const selectedTheme = localStorage.getItem('selected-theme');
    const selectedIcon = localStorage.getItem('selected-icon');

    const getCurrentTheme = () => document.body.classList.contains(lightTheme) ? 'dark' : 'light';
    const getCurrentIcon = () => themeBtn.classList.contains(iconTheme) ? 'ri-moon-line' : 'ri-sun-line';

    if (selectedTheme) {
        document.body.classList[selectedTheme === 'dark' ? 'remove' : 'add'](lightTheme);
        themeBtn.classList[selectedIcon === 'ri-moon-line' ? 'remove' : 'add'](iconTheme);
    } else {
        // Default to light theme
        document.body.classList.add(lightTheme);
        themeBtn.classList.add(iconTheme);
        themeBtn.classList.remove('ri-moon-line');
        localStorage.setItem('selected-theme', 'light');
        localStorage.setItem('selected-icon', 'ri-sun-line');
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            document.body.classList.toggle(lightTheme);
            themeBtn.classList.toggle(iconTheme);
            
            localStorage.setItem('selected-theme', getCurrentTheme());
            localStorage.setItem('selected-icon', getCurrentIcon());
        });
    }

    // --- SEARCH BAR TOGGLE ---
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            searchContainer.classList.toggle('show-search');
            if (searchContainer.classList.contains('show-search')) {
                searchInput.focus();
            }
        });
    }

    // --- LOGIN MODAL ---
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('/api/check-session');
                if (!res.ok) { // Handle non-2xx responses
                    loginContainer.classList.add('show-login');
                    return;
                }
                const data = await res.json();

                if (data.loggedIn && data.user && data.user.role) {
                    const redirectTo = data.user.role === 'editor' ? '/admin.html' : `/${data.user.role}/admin.html`;
                    window.location.href = redirectTo;
                } else {
                    loginContainer.classList.add('show-login');
                }
            } catch (err) {
                console.error('Session check failed:', err);
                loginContainer.classList.add('show-login'); // Fallback to showing login modal
            }
        });
    }
    
    if (loginClose) {
        loginClose.addEventListener('click', () => loginContainer.classList.remove('show-login'));
    }

    // --- LOGIN FORM SUBMISSION ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const errorMessage = document.getElementById('error-message');
            
            try {
                const res = await fetch('/api/login/admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: email, password })
                });

                const data = await res.json();

                if (res.ok) {
                    errorMessage.style.display = 'none';
                    window.location.href = data.redirectTo || '/';
                } else {
                    errorMessage.textContent = data.message || 'An unknown error occurred.';
                    errorMessage.style.display = 'block';
                }
            } catch (err) {
                errorMessage.textContent = 'Failed to connect to the server.';
                errorMessage.style.display = 'block';
            }
        });
    }

    // --- CLIENT-SIDE SEARCH FILTER ---
    if (searchInput && newsGrid) {
        searchInput.addEventListener('keyup', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const newsCards = newsGrid.querySelectorAll('.news-card');
            
            newsCards.forEach(card => {
                const cardText = card.textContent.toLowerCase();
                if (cardText.includes(searchTerm)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
});