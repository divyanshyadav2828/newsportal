const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { createObjectCsvWriter } = require('csv-writer');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();

// --- DATABASE & DATA MANAGEMENT ---
const usersFilePath = path.join(__dirname, 'users.csv');
const dbFilePath = path.join(__dirname, 'db.json');
let users = [];
let db = { news: [], newsCategories: [] };
const continents = ['africa', 'asia', 'australia', 'europe', 'north-america', 'south-america', 'antarctica', 'india', 'global'];
continents.forEach(continent => {
    db[continent] = { news: [], newsCategories: [] };
});

async function saveData() {
    try {
        await fs.promises.writeFile(dbFilePath, JSON.stringify(db, null, 2));
    } catch (error) { console.error('Error saving data:', error); }
}

async function loadData() {
    try {
        if (fs.existsSync(dbFilePath)) {
            const fileContent = await fs.promises.readFile(dbFilePath, 'utf8');
            const loadedDb = JSON.parse(fileContent);
            db = { ...db, ...loadedDb };
        }
        if (fs.existsSync(usersFilePath)) {
            const fileContent = fs.readFileSync(usersFilePath, 'utf8');
            if (fileContent.trim()) {
                users = parse(fileContent, { columns: true, skip_empty_lines: true });
            }
        }
    } catch (error) { console.error('Error loading data:', error); }
}

async function saveUsers() {
    const csvWriter = createObjectCsvWriter({
        path: usersFilePath,
        header: [
            { id: 'id', title: 'id' },
            { id: 'passwordHash', title: 'passwordHash' },
            { id: 'role', title: 'role' }
        ]
    });
    try {
        const records = users.map(({ id, passwordHash, role }) => ({ id, passwordHash, role }));
        await csvWriter.writeRecords(records);
    } catch (error) {
        console.error('Error saving users.csv:', error);
    }
}

// --- MIDDLEWARE ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(session({
    secret: 'a-very-strong-secret-for-your-portal-continents',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true, secure: false }
}));

const ensureAdmin = (requiredRole) => (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ message: 'Unauthorized' });
    const { role } = req.session.user;
    if (role === 'editor' || role === requiredRole) return next();
    res.status(403).json({ message: 'Forbidden' });
};

// --- API ROUTES ---
const apiRouter = express.Router();

// AUTH
apiRouter.post('/login/admin', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.id === username);
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (isMatch) {
        req.session.user = { id: user.id, role: user.role };
        let redirectTo = user.role === 'editor' ? '/admin.html' : `/${user.role}/admin.html`;
        return res.json({ redirectTo });
    }
    res.status(401).json({ message: 'Invalid credentials' });
});
apiRouter.post('/logout', (req, res) => {
    let redirectTo = '/';
    if (req.session && req.session.user && req.session.user.role && continents.includes(req.session.user.role)) {
        redirectTo = `/${req.session.user.role}/`;
    }
    req.session.destroy(() => res.json({ redirectTo }));
});

apiRouter.get('/check-session', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// --- FINAL CHATBOT LOGIC ---

const stopWords = new Set(['a', 'an', 'the', 'is', 'in', 'it', 'of', 'for', 'on', 'with', 'what', 'when', 'where', 'how', 'who', 'about', 'news', 'tell', 'me', 'some']);

apiRouter.post('/chatbot', (req, res) => {
    const { message, continent } = req.body;
    let userMessage = message.toLowerCase().trim();
    
    // 1. Aggregate all news articles into a single searchable array.
    let newsToSearch = [];
    if (continent && db[continent] && db[continent].news) {
        const pageName = continent.charAt(0).toUpperCase() + continent.slice(1).replace('-', ' ');
        newsToSearch = db[continent].news.map(n => ({ ...n, pageName }));
    } else {
        newsToSearch = db.news.map(n => ({ ...n, pageName: 'Homepage' }));
        continents.forEach(c => {
            if (db[c] && db[c].news) {
                const continentTitle = c.charAt(0).toUpperCase() + c.slice(1).replace('-', ' ');
                newsToSearch = newsToSearch.concat(db[c].news.map(n => ({ ...n, pageName: continentTitle })));
            }
        });
    }

    // 2. Get a unique list of all source names to check for direct matches.
    const allSources = [...new Set(newsToSearch.map(n => n.source?.toLowerCase()).filter(Boolean))];
    const sourceMatch = allSources.find(source => source === userMessage);

    let searchField = 'all';
    let query = userMessage;
    const specialSyntaxMatch = userMessage.match(/^@(\w+):\s*(.*)/);
    if (specialSyntaxMatch) {
        searchField = specialSyntaxMatch[1];
        query = specialSyntaxMatch[2].trim();
    }

    // 3. If the user's query is a source name (either by direct match or @source syntax), return all articles from that source.
    if (sourceMatch || searchField === 'source') {
        const sourceQuery = sourceMatch || query;
        if (!sourceQuery) {
            return res.json({ reply: "Please provide a source name to search for." });
        }
        const matchedBySource = newsToSearch.filter(article => 
            article.source && article.source.toLowerCase().includes(sourceQuery)
        );

        if (matchedBySource.length > 0) {
            const results = matchedBySource.map(article => ({
                reply: article.content,
                heading: article.heading,
                source: article.source || 'N/A',
                category: article.category,
                pageName: article.pageName
            }));
            return res.json({ results });
        } else {
            return res.json({ reply: `I couldn't find any news from the source "${sourceQuery}".` });
        }
    }

    // 4. If not a source search, proceed with keyword-based scoring.
    const keywords = query.split(/\s+/).filter(word => word.length > 2 && !stopWords.has(word));

    if (keywords.length === 0) {
        return res.json({ reply: "Please provide a more specific keyword to search for." });
    }

    const matchedNews = newsToSearch.map(article => {
        let score = 0;
        let keywordMatchCount = 0;
        const heading = (article.heading || '').toLowerCase();
        const content = (article.content || '').toLowerCase();
        const source = (article.source || '').toLowerCase();
        const category = (article.category || '').toLowerCase();

        keywords.forEach(keyword => {
            let keywordFound = false;
            if (heading.includes(keyword)) { score += 5; keywordFound = true; }
            if (content.includes(keyword)) { score += 2; keywordFound = true; }
            if (source.includes(keyword)) { score += 3; keywordFound = true; }
            if (category.includes(keyword)) { score += 4; keywordFound = true; }
            if (keywordFound) keywordMatchCount++;
        });
        return { ...article, score, keywordMatchCount };
    })
    .filter(article => article.score > 0) // Keep only articles with at least one match
    .sort((a, b) => b.score - a.score);

    // 5. Return the top results based on the new relevance logic.
    if (matchedNews.length > 0) {
        let resultsToShow = [];
        const topResult = matchedNews[0];
        
        // Always show the top result.
        resultsToShow.push(topResult);

        // Check if there's a second result and if it meets the keyword match threshold.
        if (matchedNews.length > 1 && matchedNews[1].keywordMatchCount >= 3) {
            // If the second news item has at least three keyword matches, show the top 3 results.
            resultsToShow = matchedNews.slice(0, 3);
        }
        
        const results = resultsToShow.map(result => ({
            reply: result.content,
            heading: result.heading,
            source: result.source || 'N/A',
            category: result.category,
            pageName: result.pageName
        }));
        return res.json({ results });
    }

    res.json({ reply: "I couldn't find any news matching your search. Please try again." });
});


// USER MANAGEMENT API
const mainAdminOnly = ensureAdmin('editor');
apiRouter.get('/users', mainAdminOnly, (req, res) => res.json(users.map(({ id, role }) => ({ id, role }))));
apiRouter.post('/users', mainAdminOnly, async (req, res) => {
    const { id, password, role } = req.body;
    if (!id || !password || !role) return res.status(400).json({ message: 'Missing required fields' });
    if (users.some(u => u.id === id)) return res.status(409).json({ message: 'User already exists' });
    users.push({ id, passwordHash: await bcrypt.hash(password, 10), role });
    await saveUsers();
    res.status(201).json({ id, role });
});
apiRouter.put('/users/:id', mainAdminOnly, async (req, res) => {
    const originalId = decodeURIComponent(req.params.id);
    const { id: newId, password, role } = req.body;
    const userIndex = users.findIndex(u => u.id === originalId);
    if (userIndex === -1) return res.status(404).json({ message: 'User not found' });
    if (newId !== originalId && users.some(u => u.id === newId)) return res.status(409).json({ message: 'New user ID already in use' });
    const user = users[userIndex];
    user.id = newId || user.id;
    user.role = role || user.role;
    if (password) user.passwordHash = await bcrypt.hash(password, 10);
    await saveUsers();
    res.json({ id: user.id, role: user.role });
});
apiRouter.delete('/users/:id', mainAdminOnly, async (req, res) => {
    const userId = decodeURIComponent(req.params.id);
    if (req.session.user.id === userId) return res.status(403).json({ message: 'Cannot delete your own account' });
    const initialLength = users.length;
    users = users.filter(u => u.id !== userId);
    if (users.length === initialLength) return res.status(404).json({ message: 'User not found' });
    await saveUsers();
    res.status(204).send();
});

// GENERAL (HOME PAGE) API
const generalAdminMiddleware = ensureAdmin('editor');
apiRouter.get('/news', (req, res) => res.json([...db.news].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))));
apiRouter.get('/news-categories', (req, res) => res.json(db.newsCategories));
apiRouter.post('/news', generalAdminMiddleware, async (req, res) => {
    const newEntry = { id: uuidv4(), ...req.body, timestamp: new Date().toISOString() };
    db.news.push(newEntry);
    await saveData();
    res.status(201).json(newEntry);
});
apiRouter.put('/news/:id', generalAdminMiddleware, async (req, res) => {
    const index = db.news.findIndex(n => n.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: 'Not found' });
    db.news[index] = { ...db.news[index], ...req.body };
    await saveData();
    res.json(db.news[index]);
});
apiRouter.delete('/news/:id', generalAdminMiddleware, async (req, res) => {
    db.news = db.news.filter(n => n.id !== req.params.id);
    await saveData();
    res.status(204).send();
});
apiRouter.post('/news-categories', generalAdminMiddleware, async (req, res) => {
    const { category } = req.body;
    if (!category || db.newsCategories.includes(category)) return res.status(400).json({ message: 'Invalid category' });
    db.newsCategories.push(category);
    await saveData();
    res.status(201).json(db.newsCategories);
});
apiRouter.delete('/news-categories/:category', generalAdminMiddleware, async (req, res) => {
    const { category } = req.params;
    if (db.news.some(n => n.category === category)) return res.status(400).json({ message: 'Category is in use' });
    db.newsCategories = db.newsCategories.filter(c => c !== category);
    await saveData();
    res.status(204).send();
});

// DYNAMIC CONTINENT API ROUTES
continents.forEach(continent => {
    const adminMiddleware = ensureAdmin(continent);
    // GET
    apiRouter.get(`/${continent}/news`, (req, res) => res.json([...db[continent].news].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))));
    apiRouter.get(`/${continent}/news-categories`, (req, res) => res.json(db[continent].newsCategories));
    // POST NEWS
    apiRouter.post(`/${continent}/news`, adminMiddleware, async (req, res) => {
        const newEntry = { id: uuidv4(), ...req.body, timestamp: new Date().toISOString() };
        db[continent].news.push(newEntry);
        await saveData();
        res.status(201).json(newEntry);
    });
    // PUT NEWS
    apiRouter.put(`/${continent}/news/:id`, adminMiddleware, async (req, res) => {
        const index = db[continent].news.findIndex(n => n.id === req.params.id);
        if (index === -1) return res.status(404).json({ message: 'Not found' });
        db[continent].news[index] = { ...db[continent].news[index], ...req.body };
        await saveData();
        res.json(db[continent].news[index]);
    });
    // DELETE NEWS
    apiRouter.delete(`/${continent}/news/:id`, adminMiddleware, async (req, res) => {
        db[continent].news = db[continent].news.filter(n => n.id !== req.params.id);
        await saveData();
        res.status(204).send();
    });
    // POST CATEGORY
    apiRouter.post(`/${continent}/news-categories`, adminMiddleware, async (req, res) => {
        const { category } = req.body;
        if (!category || db[continent].newsCategories.includes(category)) return res.status(400).json({ message: 'Invalid category' });
        db[continent].newsCategories.push(category);
        await saveData();
        res.status(201).json(db[continent].newsCategories);
    });
    // DELETE CATEGORY
    apiRouter.delete(`/${continent}/news-categories/:category`, adminMiddleware, async (req, res) => {
        const { category } = req.params;
        if (db[continent].news.some(n => n.category === category)) return res.status(400).json({ message: 'Category is in use' });
        db[continent].newsCategories = db[continent].newsCategories.filter(c => c !== category);
        await saveData();
        res.status(204).send();
    });
});

// --- API ROUTER ---
app.use('/api', apiRouter);

// --- PAGE SERVING ---
// Admin pages (protected)
app.get('/admin.html', (req, res) => {
    if (req.session.user && req.session.user.role === 'editor') {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.redirect('/');
    }
});
app.get('/usermanagement.html', (req, res) => {
    if (req.session.user && req.session.user.role === 'editor') {
        res.sendFile(path.join(__dirname, 'public', 'usermanagement.html'));
    } else {
        res.status(403).send('<h1>403 Forbidden</h1>');
    }
});
continents.forEach(continent => {
    app.get(`/${continent}/admin.html`, (req, res) => {
        if (req.session.user && (req.session.user.role === continent || req.session.user.role === 'editor')) {
            res.sendFile(path.join(__dirname, 'public', continent, 'admin.html'));
        } else {
            res.status(403).send('<h1>403 Forbidden</h1>');
        }
    });
});


// --- SERVER STARTUP ---
const server = http.createServer(app);
const port = 3000;
server.listen(port, async () => {
    await loadData();
    console.log(`Server running at http://localhost:${port}`);
});