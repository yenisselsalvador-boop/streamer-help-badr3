// Streamer Help By Badr - Backend Server
// Completely independent implementation

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000; // Different port than original

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Data storage paths
const DATA_DIR = path.join(__dirname, 'storage');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ACTIVITY_FILE = path.join(DATA_DIR, 'activity.json');

// ============= INITIALIZATION =============
async function initializeStorage() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        // Initialize users file
        try {
            await fs.access(USERS_FILE);
        } catch {
            await fs.writeFile(USERS_FILE, JSON.stringify([]));
        }
        
        // Initialize activity file
        try {
            await fs.access(ACTIVITY_FILE);
        } catch {
            await fs.writeFile(ACTIVITY_FILE, JSON.stringify([]));
        }
        
        console.log('Storage initialized');
    } catch (error) {
        console.error('Failed to initialize storage:', error);
    }
}

// ============= DATA HELPERS =============
async function readUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function writeUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function readActivity() {
    try {
        const data = await fs.readFile(ACTIVITY_FILE, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function writeActivity(activity) {
    await fs.writeFile(ACTIVITY_FILE, JSON.stringify(activity, null, 2));
}

// ============= API ENDPOINTS =============

// Register new user
app.post('/api/register', async (req, res) => {
    try {
        const { id, username, email, registeredAt, version } = req.body;
        
        if (!id || !username || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const users = await readUsers();
        
        // Check if user already exists
        const existingUser = users.find(u => u.id === id || u.email === email);
        if (existingUser) {
            return res.status(200).json({ message: 'User already registered', user: existingUser });
        }
        
        // Add new user
        const newUser = {
            id,
            username,
            email,
            registeredAt: registeredAt || new Date().toISOString(),
            version: version || '1.0.0',
            lastActive: new Date().toISOString()
        };
        
        users.push(newUser);
        await writeUsers(users);
        
        res.json({ success: true, user: newUser });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Log activity
app.post('/api/activity', async (req, res) => {
    try {
        const { userId, action, messagesSent, timestamp } = req.body;
        
        if (!userId || !action) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Update user's last active
        const users = await readUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            users[userIndex].lastActive = timestamp || new Date().toISOString();
            await writeUsers(users);
        }
        
        // Log activity
        const activity = await readActivity();
        activity.push({
            userId,
            action,
            messagesSent: messagesSent || 0,
            timestamp: timestamp || new Date().toISOString()
        });
        
        // Keep only last 1000 activities
        if (activity.length > 1000) {
            activity.splice(0, activity.length - 1000);
        }
        
        await writeActivity(activity);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Activity logging error:', error);
        res.status(500).json({ error: 'Failed to log activity' });
    }
});

// Get all users (for admin panel)
app.get('/api/users', async (req, res) => {
    try {
        const users = await readUsers();
        res.json({ users });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get activity logs
app.get('/api/activity', async (req, res) => {
    try {
        const activity = await readActivity();
        res.json({ activity });
    } catch (error) {
        console.error('Error fetching activity:', error);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

// Get stats
app.get('/api/stats', async (req, res) => {
    try {
        const users = await readUsers();
        const activity = await readActivity();
        
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        const activeToday = users.filter(u => {
            const lastActive = u.lastActive ? u.lastActive.split('T')[0] : null;
            return lastActive === today;
        }).length;
        
        const totalMessages = activity
            .filter(a => a.action === 'stop')
            .reduce((sum, a) => sum + (a.messagesSent || 0), 0);
        
        res.json({
            totalUsers: users.length,
            activeToday,
            totalMessages
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ============= ADMIN PANEL HTML =============
app.get('/dashboard', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Streamer Help By Badr - Admin Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
            color: #e0e0e0;
            padding: 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .header h1 {
            font-size: 32px;
            background: linear-gradient(135deg, #ff8c00, #ff6b00);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        
        .stat-card {
            background: #2a2a2a;
            border: 2px solid #3a3a3a;
            border-radius: 12px;
            padding: 24px;
            text-align: center;
        }
        
        .stat-label {
            font-size: 14px;
            color: #999;
            margin-bottom: 8px;
        }
        
        .stat-value {
            font-size: 36px;
            font-weight: 700;
            color: #ff8c00;
        }
        
        .table-container {
            background: #2a2a2a;
            border: 2px solid #3a3a3a;
            border-radius: 12px;
            padding: 24px;
            overflow-x: auto;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th {
            background: #333;
            padding: 12px;
            text-align: left;
            color: #ff8c00;
            font-weight: 600;
            border-bottom: 2px solid #444;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #333;
        }
        
        tr:hover {
            background: #333;
        }
        
        .status-active {
            color: #4caf50;
        }
        
        .status-inactive {
            color: #999;
        }
        
        .refresh-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 14px 24px;
            background: linear-gradient(135deg, #ff8c00, #ff6b00);
            border: none;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(255, 140, 0, 0.3);
        }
        
        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(255, 140, 0, 0.4);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Streamer Help By Badr</h1>
        <p>Admin Dashboard</p>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">Total Users</div>
            <div class="stat-value" id="totalUsers">0</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Active Today</div>
            <div class="stat-value" id="activeToday">0</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">Total Messages</div>
            <div class="stat-value" id="totalMessages">0</div>
        </div>
    </div>
    
    <div class="table-container">
        <h2 style="margin-bottom: 20px; color: #ff8c00;">Registered Users</h2>
        <table>
            <thead>
                <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Registered</th>
                    <th>Last Active</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody id="usersTable">
                <tr><td colspan="5" style="text-align: center;">Loading...</td></tr>
            </tbody>
        </table>
    </div>
    
    <button class="refresh-btn" onclick="loadData()">🔄 Refresh</button>
    
    <script>
        async function loadData() {
            try {
                // Load stats
                const statsRes = await fetch('/api/stats');
                const stats = await statsRes.json();
                
                document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
                document.getElementById('activeToday').textContent = stats.activeToday || 0;
                document.getElementById('totalMessages').textContent = stats.totalMessages || 0;
                
                // Load users
                const usersRes = await fetch('/api/users');
                const usersData = await usersRes.json();
                
                const tbody = document.getElementById('usersTable');
                tbody.innerHTML = '';
                
                if (usersData.users.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No users registered yet</td></tr>';
                    return;
                }
                
                usersData.users.forEach(user => {
                    const row = document.createElement('tr');
                    
                    const today = new Date().toISOString().split('T')[0];
                    const lastActive = user.lastActive ? user.lastActive.split('T')[0] : null;
                    const isActiveToday = lastActive === today;
                    
                    row.innerHTML = \`
                        <td>\${user.username}</td>
                        <td>\${user.email}</td>
                        <td>\${new Date(user.registeredAt).toLocaleDateString()}</td>
                        <td>\${user.lastActive ? new Date(user.lastActive).toLocaleString() : 'Never'}</td>
                        <td class="\${isActiveToday ? 'status-active' : 'status-inactive'}">
                            \${isActiveToday ? '🟢 Active' : '⚫ Inactive'}
                        </td>
                    \`;
                    
                    tbody.appendChild(row);
                });
            } catch (error) {
                console.error('Error loading data:', error);
            }
        }
        
        // Load data on page load
        loadData();
        
        // Auto-refresh every 10 seconds
        setInterval(loadData, 10000);
    </script>
</body>
</html>
    `);
});

// ============= START SERVER =============
initializeStorage().then(() => {
    app.listen(PORT, () => {
        console.log(`\n✨ Streamer Help By Badr - Backend Server Running\n`);
        console.log(`   📊 Dashboard: http://localhost:${PORT}/dashboard`);
        console.log(`   🔌 API: http://localhost:${PORT}/api\n`);
    });
});
