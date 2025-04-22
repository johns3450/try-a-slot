if (!localStorage.getItem('initialOverlayShown')) {
    const overlay = document.getElementById('initialOverlay');
  
    const loadPromise = new Promise(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', resolve);
      }
    });
  
    const logoImg = document.getElementById('logoImg');
    const logoPromise = logoImg
      ? (logoImg.complete
          ? Promise.resolve()
          : new Promise(res => logoImg.addEventListener('load', res)))
      : Promise.resolve();
  
    const fontPromise = (document.fonts && document.fonts.ready)
      ? document.fonts.ready
      : Promise.resolve();

    Promise.all([loadPromise, logoPromise, fontPromise])
      .then(() => {
        overlay.classList.add('hidden');
        overlay.addEventListener('transitionend', () => {
          overlay.remove();
          localStorage.setItem('initialOverlayShown', 'true');
        }, { once: true });
      });
  
} else {
    document.getElementById('initialOverlay')?.remove();
}

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'https://api.tryaslot.com';
    const emailModal = document.getElementById('emailModal');
    const submitEmail = document.getElementById('submitEmail');
    const emailInput = document.getElementById('emailInput');
    const categoryBar = document.getElementById('categoryBar');
    const gamesGrid = document.getElementById('gamesGrid');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const gamesCountContainer = document.querySelector('.games-count-container');
    const gamesCountEl = document.getElementById('gamesCount');
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    const spinner = document.getElementById('spinner');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const userProfile = document.getElementById('userProfile');
    const profileModal = document.getElementById('profileModal');

    let userEmail = localStorage.getItem('tryaslot-email');
    let allGames = [];
    let filteredGameMatches = [];
    let filteredGameDetails = [];
    let captchaText = '';
    let pendingEmail = '';
    let hasError = false;

    const perPage = 60;
    let currentSearchPage = 1;
    let totalGamesCount = 0;

    function showError(message) {
        const panel = document.querySelector('#emailModal .email-modal-content > div:not(.hidden)');
        if (!panel) return console.error('No active panel!');
        
        const errorEl = panel.querySelector('.error-message');
        if (!errorEl) return console.error('Error element missing in active panel');
      
        if (message) {
          errorEl.textContent = message;
          errorEl.classList.add('show');
        } else {
          errorEl.textContent = '';
          errorEl.classList.remove('show');
        }
    }

    const userEmailField = document.getElementById('userEmail');
    userEmailField.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('emailSubmit').click();
      }
    });

    const captchaField = document.getElementById('captchaInput');
    captchaField.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('registerSubmit').click();
      }
    });

    function updateUserProfileVisibility() {
      if (localStorage.getItem('tryaslot-email')) {
        userProfile.style.display = 'block';
      } else {
        userProfile.style.display = 'none';
      }
    }

    updateUserProfileVisibility();

    async function populateCountrySelector() {
        try {
            const res = await fetch('/countries.json');
            const list = await res.json();
            if (!res.ok) throw new Error('Failed to fetch countries');
            const list = await res.json();
            const PRIORITY = ['GB', 'US'];
            const top = [], rest = [];
    
            list.forEach(c => {
                const label = `<img class="flag-icon" src="${c.flags.png}" /> ${c.name.common}`;
                (PRIORITY.includes(c.cca2) ? top : rest).push({ value: c.cca2, label });
            });
    
            rest.sort((a, b) =>
                a.label.replace(/<[^>]*>/g, '')
                    .localeCompare(b.label.replace(/<[^>]*>/g, ''))
            );
    
            const choices = [
                ...top,
                ...rest
            ];
    
            const countrySelect = document.getElementById('countrySelector');
            const countryChoice = new Choices(countrySelect, {
                choices,
                searchEnabled: true,
                shouldSort: false,
                searchFields: ['value', 'label'],
                fuseOptions: {
                    keys: ['label'],
                    threshold: 0.3,
                    ignoreLocation: true,
                    getFn: option => option.label.replace(/<[^>]*>/g, '')
                },
                placeholder: true,
                placeholderValue: 'Select your country',
                searchPlaceholderValue: 'Type to search…',
                allowHTML: true,
                itemSelectText: ''
            });
    
            countrySelect.addEventListener('change', () => {
                if (countrySelect.value) {
                    countryChoice.setChoiceByValue(countrySelect.value);
                    countrySelect.parentNode.classList.add('has-value');
                }
            });
        } catch (err) {
            console.error('Error populating country selector:', err);
        }
    }

    function generateCaptchaText() {
        const chars = 'ABCDEFGHJKMNPRSTUVWXYZabcdefghjkmnprstuvwxyz';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    function renderCaptcha() {
        const canvas = document.getElementById('captchaCanvas');
        const ctx = canvas.getContext('2d');
        captchaText = generateCaptchaText();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '20px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const charWidth = 15;
        const totalTextWidth = captchaText.length * charWidth;
        const startX = canvas.width / 2 - totalTextWidth / 2 + charWidth / 2;
        for (let i = 0; i < captchaText.length; i++) {
            ctx.save();
            ctx.translate(startX + i * charWidth, canvas.height / 2);
            ctx.rotate((Math.random() - 0.5) * 0.3);
            ctx.fillText(captchaText[i], 0, 0);
            ctx.restore();
        }
        for (let i = 0; i < 30; i++) {
            ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`;
            ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
        }
    }

    function showSpinner() {
        spinner.classList.remove('hidden');
    }

    function hideSpinner() {
        spinner.classList.add('hidden');
    }

    function showNoResults(show) {
        noResultsMessage.classList.toggle('hidden', !show);
        gamesGrid.style.display = show ? 'none' : 'grid';
        loadMoreBtn.style.display = show ? 'none' : 'block';
        gamesCountContainer.style.display = show ? 'none' : 'flex';
    }

    function updateGamesCount(viewed, total) {
        const isSearchActive = searchInput.value.trim() !== '';
        const isAllActive = document.querySelector('button[data-category="all"].active');
        const displayTotal = (!isSearchActive && isAllActive) ? totalGamesCount : total;

        if (viewed === 0 || displayTotal === 0) {
            gamesCountContainer.style.display = 'none';
        } else {
            gamesCountEl.textContent = `You have viewed ${viewed} of ${displayTotal} games.`;
            gamesCountContainer.style.display = 'flex';
        }
    }

    async function fetchGamesFromLocalAPI() {
        try {
            const initialRes = await fetch(`${API_BASE}/api/games?limit=${perPage}&offset=0`);
            const initialJson = await initialRes.json();
            totalGamesCount = initialJson.meta ? initialJson.meta.total : initialJson.data.length;
            allGames = initialJson.data || [];
            filteredGameMatches = allGames;
            currentSearchPage = 1;
            filteredGameDetails = [];
            await renderCurrentSearchPage();
            showNoResults(allGames.length === 0);
            fetchAllGames();
        } catch (err) {
            console.error('Failed to load local games:', err);
        }
    }

    async function fetchAllGames() {
        try {
            const res = await fetch(`${API_BASE}/api/games`);
            const json = await res.json();
            if (json.data && json.data.length > allGames.length) {
                allGames = json.data;
                totalGamesCount = allGames.length;
                const isAllActive = document.querySelector('button[data-category="all"].active');
                if (isAllActive) {
                    filteredGameMatches = allGames;
                    updateGamesCount(filteredGameDetails.length, filteredGameMatches.length);
                    const moreResults = currentSearchPage * perPage < filteredGameMatches.length;
                    loadMoreBtn.style.display = moreResults ? 'block' : 'none';
                }
            }
        } catch (err) {
            console.error('Failed to load full dataset:', err);
        }
    }

    async function fetchCategories() {
        try {
            const res = await fetch(`${API_BASE}/api/types`);
            const json = await res.json();
            const categories = json.data || [];
            const unwanted = [
                'virtual', 'tap', 'table-games', 'swipe', 'smash', 'skill', 'shooting',
                'pull-tabs', 'plinko', 'pachinko', 'mine-games', 'luckytap', 'lottery',
                'live-dealer', 'gridders', 'fishing', 'crash', 'claw'
            ];
            const filteredCategories = categories.filter(cat => !unwanted.includes(cat.slug));

            const categoryNameMap = {
                'video-poker': 'Poker',
                'instant-win': 'Instants'
            };

            const categoryIcons = {
                'slots': 'fi fi-rr-slot-machine',
                'video-poker': 'fi fi-rr-card-spade',
                'arcade': 'fi fi-rr-joystick',
                'blackjack': 'fi fi-rr-playing-cards',
                'roulette': 'fi fi-rr-roulette',
                'bingo': 'fi fi-rr-check-circle',
                'keno': 'fi fi-rr-category-alt',
                'dice': 'fi fi-rr-dice-alt',
                'slingo': 'fi fi-rr-heart',
                'scratch': 'fi fi-rr-eraser',
                'instant-win': 'fi fi-rr-trophy'
            };

            const customOrder = [
                'slots', 'video-poker', 'arcade', 'blackjack', 'roulette',
                'bingo', 'keno', 'dice', 'slingo', 'scratch', 'instant-win'
            ];

            filteredCategories.sort((a, b) => {
                let indexA = customOrder.indexOf(a.slug);
                let indexB = customOrder.indexOf(b.slug);
                if (indexA === -1) indexA = customOrder.length;
                if (indexB === -1) indexB = customOrder.length;
                return indexA - indexB;
            });

            categoryBar.innerHTML = `
                <button data-category="all" class="active">
                    <i class="fi fi-rr-flame" style="display: block; margin: 0 auto 5px; font-size:20px; color: #eb2f06;"></i>
                    <span>Hot</span>
                </button>
            `;
            filteredCategories.forEach(cat => {
                const btn = document.createElement('button');
                btn.setAttribute('data-category', cat.slug);
                const displayName = categoryNameMap[cat.slug] || cat.name;
                const iconClass = categoryIcons[cat.slug] || 'uil uil-question-circle';
                const iconHtml = `<i class="${iconClass}" style="display: block; margin: 0 auto 5px; font-size:20px;"></i>`;
                btn.innerHTML = `${iconHtml}<span>${displayName}</span>`;
                categoryBar.appendChild(btn);
            });

            setupCategoryListeners();
        } catch (err) {
            console.error('Failed to fetch categories:', err);
        }
    }

    let currentCategorySlug = 'all';

    function setupCategoryListeners() {
        const categoryButtons = categoryBar.querySelectorAll('button');
        categoryButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                searchInput.value = '';
                currentSearchPage = 1;
                filteredGameDetails = [];
                filteredGameMatches = [];
                categoryButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const selected = btn.getAttribute('data-category');
                let filtered;
                if (selected === 'all') {
                    filtered = allGames; // Preserve server order with pinned games first
                } else {
                    filtered = allGames.filter(game => (game.type_slug || 'misc') === selected);
                    filtered.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                }
                filteredGameMatches = filtered;

                gamesGrid.innerHTML = '';
                showNoResults(filtered.length === 0);
                showSpinner();
                if (filtered.length > 0) {
                    currentSearchPage = 1;
                    filteredGameDetails = [];
                    await renderCurrentSearchPage();
                }
            });
        });
    }

    async function fetchDetailsFor(gamesToLoad) {
        const params = new URLSearchParams();
        params.append('token', 'RbG9QL8cCFe376wMMYFzU19hNWTmT5uTNHcQ2WUgWdnv90PXxd');
        gamesToLoad.forEach(g => params.append('id[]', g.id));
        const res = await fetch(`https://slotslaunch.com/api/games?${params}`);
        const json = await res.json();
        const detailsMap = new Map(json.data.map(d => [d.id, d]));
        return gamesToLoad.map(g => detailsMap.get(g.id)).filter(d => d !== undefined);
    }

    async function renderCurrentSearchPage(loadMore = false) {
        if (!loadMore) {
            showSpinner();
            gamesCountContainer.style.display = 'none';
            loadMoreBtn.style.display = 'none';
        }

        const start = (currentSearchPage - 1) * perPage;
        const end = currentSearchPage * perPage;
        const slice = filteredGameMatches.slice(start, end);
        const details = await fetchDetailsFor(slice);
        filteredGameDetails.push(...details);

        const fragment = document.createDocumentFragment();
        const newCards = [];
        details.forEach(game => {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.setAttribute('data-category', game.type_slug || 'misc');
            card.innerHTML = `<img src="${game.thumb}" alt="${game.name}"><p>${game.name}</p>`;
            card.addEventListener('click', () => {
                if (!localStorage.getItem('tryaslot-email')) {
                    emailModal.classList.remove('hidden');
                } else {
                    const embedUrl = `https://slotslaunch.com/iframe/${game.id}?token=RbG9QL8cCFe376wMMYFzU19hNWTmT5uTNHcQ2WUgWdnv90PXxd`;
                    let iframe = document.getElementById("gameIframe");
                    if (!iframe) {
                        iframe = document.createElement('iframe');
                        iframe.id = "gameIframe";
                        iframe.style.width = '100%';
                        iframe.style.height = '100%';
                        document.getElementById('yourGameContainer').appendChild(iframe);
                    }
                    iframe.src = embedUrl;
                    document.getElementById('gameOverlay').classList.remove('hidden');
                }
            });
            fragment.appendChild(card);
            newCards.push(card);
        });

        document.getElementById('closeGameOverlay').addEventListener('click', () => {
            document.getElementById('gameOverlay').classList.add('hidden');
            const iframe = document.getElementById("gameIframe");
            if (iframe) {
                iframe.src = '';
            }
        });

        await Promise.all(newCards.map(card => {
            const img = card.querySelector('img');
            return new Promise(resolve => {
                if (img.complete) {
                    resolve();
                } else {
                    img.addEventListener('load', resolve);
                    img.addEventListener('error', resolve);
                }
            });
        }));

        gamesGrid.appendChild(fragment);

        if (!loadMore) {
            hideSpinner();
        }

        const moreResults = end < filteredGameMatches.length;
        loadMoreBtn.style.display = moreResults ? 'block' : 'none';
        updateGamesCount(filteredGameDetails.length, filteredGameMatches.length);
    }

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const query = searchInput.value.trim().toLowerCase();

        showSpinner();
        filteredGameDetails = [];
        filteredGameMatches = [];
        currentSearchPage = 1;

        try {
            const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
            const json = await res.json();
            filteredGameMatches = json.data || [];

            if (filteredGameMatches.length === 0) {
                gamesGrid.innerHTML = '';
                showNoResults(true);
                updateGamesCount(0, 0);
                hideSpinner();
                return;
            }

            gamesGrid.innerHTML = '';
            showNoResults(false);
            await renderCurrentSearchPage();
        } catch (err) {
            console.error('Search failed:', err);
        }

        hideSpinner();
    });

    loadMoreBtn.addEventListener('click', async () => {
        if (filteredGameMatches.length > 0) {
            const originalText = loadMoreBtn.innerHTML;
            const originalWidth = loadMoreBtn.offsetWidth;
            loadMoreBtn.style.width = originalWidth + 'px';
            loadMoreBtn.innerHTML = `<div class="btn-spinner"></div>`;
            currentSearchPage++;
            await renderCurrentSearchPage(true);
            loadMoreBtn.innerHTML = originalText;
            loadMoreBtn.style.width = '';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    });

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && loadMoreBtn.style.display !== 'none') {
                    loadMoreBtn.click();
                }
            });
        }, { threshold: 1.0 });
        observer.observe(loadMoreBtn);
    }

    function showModal(stateId) {
        showError('');
        document.querySelectorAll('#emailModal .email-modal-content > div')
            .forEach(el => el.classList.add('hidden'));
        document.getElementById(stateId).classList.remove('hidden');
        document.getElementById('emailModal').classList.remove('hidden');

        if (stateId === 'registrationState') {
            populateCountrySelector();
            renderCaptcha();
        }
    }

    function hideModal() {
        showError('');
        document.getElementById('emailModal').classList.add('hidden');
    }

    const closeEmailModal = document.getElementById('closeEmailModal');
    if (closeEmailModal) {
        closeEmailModal.addEventListener('click', () => {
            document.getElementById('emailModal').classList.add('hidden');
        });
    }

    document.getElementById('emailModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('emailModal')) {
            document.getElementById('emailModal').classList.add('hidden');
        }
    });

    document.getElementById('personIcon')?.addEventListener('click', () => {
        showModal('emailInputState');
    });

    document.getElementById('emailSubmit').addEventListener('click', async () => {
        showError('');
      
        const email = document.getElementById('userEmail').value.trim();
      
        if (!email) {
          showError('Please enter your email address.');
          return;
        }
      
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          showError('Invalid email address. Please try again.');
          return;
        }
      
        pendingEmail = email;
      
        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
      
            if (data.status === 'verified') {
                localStorage.setItem('tryaslot-email', email);
                userEmail = email;
                hideModal();
                updateUserProfileVisibility();
            } else if (data.status === 'pending') {
                showModal('verificationState');
            } else if (data.status === 'new') {
                showModal('registrationState');
            }
        } catch (err) {
            console.error('Login error:', err);
            showError('An error occurred. Please try again.');
        }
    });

    document.getElementById('registerSubmit').addEventListener('click', async () => {
        showError('', 'registerSubmit-start');
    
        const email = pendingEmail;
        const country = document.getElementById('countrySelector').value;
        const captchaInput = document.getElementById('captchaInput').value.trim();
    
        if (!email || !country || !captchaInput) {
            showError('Please complete all fields.', 'registerSubmit-validation');
            return;
        }
    
        if (captchaInput.toLowerCase() !== captchaText.toLowerCase()) {
            showError('Incorrect captcha. Please try again.', 'registerSubmit-captcha');
            renderCaptcha();
            document.getElementById('captchaInput').value = '';
            return;
        }
    
        const payload = { email, country, captcha: 'ABC123' };
        console.log('Sending /api/register payload:', payload);
    
        try {
            const res = await fetch(`${API_BASE}/api/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });              
            const data = await res.json();
    
            if (data.success) {
                showModal('verificationState');
            } else {
                showError(data.message || 'Registration failed.', 'registerSubmit-server');
            }
        } catch (err) {
            console.error('Registration error:', err);
            showError('An error occurred. Please try again.', 'registerSubmit-error');
        }
    });

    document.getElementById('refreshCaptcha')?.addEventListener('click', () => {
        showError('');
        renderCaptcha();
        document.getElementById('captchaInput').value = '';
    });

    document.getElementById('verificationDone').addEventListener('click', async () => {
        showError('');

        const email = pendingEmail || document.getElementById('userEmail').value.trim();
        if (!email) {
            showError('No email provided.');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/check-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });              
            const data = await res.json();

            if (data.verified) {
                localStorage.setItem('tryaslot-email', email);
                userEmail = email;
                hideModal();
                updateUserProfileVisibility();
            } else {
                showError('Your email is still not verified. Please check your inbox.');
            }
        } catch (err) {
            console.error('Verification check error:', err);
            showError('An error occurred. Please try again.');
        }
    });

    document.getElementById('userProfile').addEventListener('click', () => {
        const profileModal = document.getElementById('profileModal');
        document.getElementById('loggedInEmail').textContent = localStorage.getItem('tryaslot-email') || '';
        profileModal.classList.remove('hidden');
    });

    document.querySelector('.close-btn').addEventListener('click', () => {
        document.getElementById('profileModal').classList.add('hidden');
    });

    document.getElementById('profileModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('profileModal')) {
            document.getElementById('profileModal').classList.add('hidden');
        }
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('tryaslot-email');
        userEmail = null;
        updateUserProfileVisibility();
        document.getElementById('profileModal').classList.add('hidden');
    });

    fetchGamesFromLocalAPI();
    fetchCategories();
});

document.addEventListener('DOMContentLoaded', () => {
    const footerExpand = document.getElementById('footerExpand');
    const footerCollapse = document.getElementById('footerCollapse');
    const footerCollapsed = document.querySelector('.footer-collapsed');
    const footerExpanded = document.querySelector('.footer-expanded');

    footerExpand.addEventListener('click', (e) => {
        e.preventDefault();
        footerCollapsed.style.display = 'none';
        footerExpanded.style.display = 'block';
    });

    footerCollapse.addEventListener('click', (e) => {
        e.preventDefault();
        footerExpanded.style.display = 'none';
        footerCollapsed.style.display = 'block';
    });

    function updateUserProfileVisibility() {
        if (localStorage.getItem('tryaslot-email')) {
            document.getElementById('userProfile').style.display = 'block';
        } else {
            document.getElementById('userProfile').style.display = 'none';
        }
    }

    updateUserProfileVisibility();
});

if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
    const btn = document.getElementById('backToTop');
  
    window.addEventListener('scroll', () => {
      btn.classList.toggle('show', window.scrollY > 500);
    });
  
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}