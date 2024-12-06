const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const ws = require('ws');
const fs = require('fs');
const User = require('./models/User');
const Message = require('./models/Message');

dotenv.config();

// Database connection
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Failed to connect to MongoDB', err));

const app = express();
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL,
}));

// Constants
const jwtSecret = process.env.JWT_SECRET;
const bcryptSalt = bcrypt.genSaltSync(10);

// Helper function to get user data from token
async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token;
        if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if (err) reject(err);
                else resolve(userData);
            });
        } else {
            reject('No token provided');
        }
    });
}

// Routes
app.get('/test', (req, res) => {
    res.json('Test OK');
});

app.get('/messages/:userId', async (req, res) => {
    const { userId } = req.params;
    const userData = await getUserDataFromRequest(req);
    const ourUserId = userData.userId;

    const messages = await Message.find({
        sender: { $in: [userId, ourUserId] },
        recipient: { $in: [userId, ourUserId] },
    }).sort({ createdAt: 1 });

    res.json(messages);
});

app.get('/people', async (req, res) => {
    const users = await User.find({}, { '_id': 1, username: 1 });
    res.json(users);
});

app.get('/profile', (req, res) => {
    const token = req.cookies?.token;
    if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
            if (err) res.status(403).json('Invalid token');
            else res.json(userData);
        });
    } else {
        res.status(401).json('No Token');
    }
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const foundUser = await User.findOne({ username });
    if (foundUser) {
        const passOk = await bcrypt.compare(password, foundUser.password);
        if (passOk) {
            jwt.sign({ userId: foundUser._id, username }, jwtSecret, {}, (err, token) => {
                res.cookie('token', token, { sameSite: 'none', secure: true }).status(201).json({
                    id: foundUser._id,
                });
            });
        } else {
            res.status(400).json('Incorrect password');
        }
    } else {
        res.status(400).json('User not found');
    }
});

app.post('/logout', (req, res) => {
    res.cookie('token', '', { sameSite: 'none', secure: true }).json('OK');

    const token = req.cookies?.token;
    if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
            if (!err) {
                [...wss.clients].forEach(client => {
                    if (client.userId === userData.userId) {
                        client.terminate();
                    }
                });
            }
        });
    }
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = bcrypt.hashSync(password, bcryptSalt);
        const createdUser = await User.create({
            username: username,
            password: hashedPassword,
        });
        jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token, { sameSite: 'none', secure: true }).status(201).json({
                id: createdUser._id,
            });
        });
    } catch (error) {
        res.status(500).json('Error occurred');
    }
});

// Server setup
const server = app.listen(3000, () => console.log('Server running on port 3000'));

// WebSocket setup
const wss = new ws.WebSocketServer({ server });

wss.on('connection', (connection, req) => {
    connection.isAlive = true;

    const notifyAboutOnlinePeople = () => {
        const onlineUsers = Array.from(wss.clients)
            .filter(client => client.userId)
            .map(client => ({
                userId: client.userId,
                username: client.username,
            }));

        wss.clients.forEach(client => {
            client.send(JSON.stringify({ online: onlineUsers }));
        });
    };

    connection.timer = setInterval(() => {
        connection.ping();
        connection.deathTimer = setTimeout(() => {
            connection.isAlive = false;
            clearInterval(connection.timer);
            connection.terminate();
            notifyAboutOnlinePeople();
        }, 1000);
    }, 5000);

    connection.on('pong', () => {
        clearTimeout(connection.deathTimer);
    });

    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookieString = cookies.split('; ').find(str => str.startsWith('token='));
        if (tokenCookieString) {
            const token = tokenCookieString.split('=')[1];
            if (token) {
                jwt.verify(token, jwtSecret, {}, (err, userData) => {
                    if (!err) {
                        connection.userId = userData.userId;
                        connection.username = userData.username;
                        notifyAboutOnlinePeople();
                    }
                });
            }
        }
    }

    connection.on('close', () => {
        notifyAboutOnlinePeople();
    });

    connection.on('message', async (message) => {
        const messageData = JSON.parse(message.toString());
        const { recipient, text, file } = messageData;
        let filename = null;

        if (file) {
            const parts = file.name.split('.');
            const ext = parts[parts.length - 1];
            filename = Date.now() + '.' + ext;
            const path = __dirname + '/uploads/' + filename;
            const bufferData = Buffer.from(file.data.split(',')[1], 'base64');
            fs.writeFileSync(path, bufferData);
        }

        if (recipient && (text || file)) {
            const messageDoc = await Message.create({
                sender: connection.userId,
                recipient,
                text,
                file: file ? filename : null,
            });

            [...wss.clients]
                .filter(client => client.userId === recipient)
                .forEach(client => client.send(JSON.stringify({
                    text,
                    sender: connection.userId,
                    recipient,
                    file: file ? filename : null,
                    _id: messageDoc._id,
                })));
        }
    });

    notifyAboutOnlinePeople();
});
