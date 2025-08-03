const express = require('express')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const User = require('./models/User')
const Message = require('./models/Message')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const ws = require('ws')
const { uploadToPinata } = require('./config/pinata')

dotenv.config()
mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch((err) => {
        console.error('Failed to connect to MongoDB', err);
    });

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL
}))
const jwtSecret = process.env.JWT_SECRET
const bcryptSalt = bcrypt.genSaltSync(10)

app.get('/api/test', (req, res) => {
    res.json('Test OK')
})

async function getUserDataFromRequest(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies?.token
        if (token) {
            jwt.verify(token, jwtSecret, {}, (err, userData) => {
                if (err) throw err
                resolve(userData)
            })
        } else {
            reject('no token')
        }
    })
}


app.get('/api/messages/:userId', async (req, res) => {
    const { userId } = req.params
    const userData = await getUserDataFromRequest(req)
    const ourUserId = userData.userId
    const messages = await Message.find({
        sender: { $in: [userId, ourUserId] },
        recipient: { $in: [userId, ourUserId] },
    }).sort({ createdAt: 1 })
    res.json(messages)
});


app.get('/api/people', async (req, res) => {
    const users = await User.find({}, { '_id': 1, username: 1 })
    res.json(users)
})


app.get('/api/profile', (req, res) => {
    const token = req.cookies?.token
    if (token) {
        jwt.verify(token, jwtSecret, {}, (err, userData) => {
            if (err) throw err
            res.json(userData)
        })
    } else {
        res.status(401).json('No Token')
    }
})

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Input validation
        if (!username || !password) {
            return res.status(400).json('Username and password are required');
        }
        
        // Find user with lean() for faster query
        const foundUser = await User.findOne({ username }).lean();
        if (!foundUser) {
            return res.status(400).json('User not found');
        }
        
        // Use async bcrypt.compare for non-blocking operation
        const passOk = await bcrypt.compare(password, foundUser.password);
        if (!passOk) {
            return res.status(400).json('Incorrect password');
        }
        
        // Promisify jwt.sign for cleaner async handling
        const token = await new Promise((resolve, reject) => {
            jwt.sign({ userId: foundUser._id, username }, jwtSecret, { expiresIn: '7d' }, (err, token) => {
                if (err) reject(err);
                else resolve(token);
            });
        });
        
        res.cookie('token', token, { 
            sameSite: 'none', 
            secure: true,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000
        }).status(200).json({
            id: foundUser._id,
            username: foundUser.username
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json('Server error during login');
    }
});

app.post('/api/logout', (req, res) => {
    res.cookie('token', '', { sameSite: 'none', secure: true }).json('OK')
})


app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Input validation
        if (!username || !password) {
            return res.status(400).json('Username and password are required');
        }
        
        if (username.length < 3) {
            return res.status(400).json('Username must be at least 3 characters long');
        }
        
        if (password.length < 6) {
            return res.status(400).json('Password must be at least 6 characters long');
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ username }).lean();
        if (existingUser) {
            return res.status(400).json('Username already exists');
        }
        
        // Use async bcrypt.hash for non-blocking operation
        const hashedPassword = await bcrypt.hash(password, bcryptSalt);
        const createdUser = await User.create({
            username: username,
            password: hashedPassword
        });
        
        // Promisify jwt.sign
        const token = await new Promise((resolve, reject) => {
            jwt.sign({ userId: createdUser._id, username }, jwtSecret, { expiresIn: '7d' }, (err, token) => {
                if (err) reject(err);
                else resolve(token);
            });
        });
        
        res.cookie('token', token, { 
            sameSite: 'none', 
            secure: true,
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        }).status(201).json({
            id: createdUser._id,
            username: createdUser.username
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        if (error.code === 11000) { // MongoDB duplicate key error
            res.status(400).json('Username already exists');
        } else {
            res.status(500).json('Server error during registration');
        }
    }
});

const server = app.listen(3000)

const wss = new ws.WebSocketServer({ server })

wss.on('connection', (connection, req) => {
    function notifyAboutOnlinePeople() {
        [...wss.clients]
            .filter(client => client.userId && client.username)
            .forEach(client => {
                client.send(JSON.stringify({
                    online: [...wss.clients]
                        .filter(c => c.userId && c.username)
                        .map(c => ({userId: c.userId, username: c.username}))
                }));
            });
    }

    // Read username and id from the cookie for this connection
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookieString = cookies.split(';').find(str => str.trim().startsWith('token='));
        if (tokenCookieString) {
            const token = tokenCookieString.split('=')[1].trim();
            if (token) {
                jwt.verify(token, jwtSecret, {}, (err, userData) => {
                    if (err) {
                        console.error('WebSocket JWT verification error:', err);
                        return;
                    }
                    const { userId, username } = userData;
                    connection.userId = userId;
                    connection.username = username;
                    notifyAboutOnlinePeople();
                });
            }
        }
    }

    connection.on('message', async (message) => {
        const messageData = JSON.parse(message.toString());
        if (messageData.type === 'logout') {
            connection.userId = null;
            connection.username = null;
            notifyAboutOnlinePeople();
        } else {
            const { recipient, text, file } = messageData;
            let fileUrl = null;
            let fileType = null;

            if (file) {
                const bufferData = Buffer.from(file.data.split(',')[1], 'base64');
                const fileName = `${Date.now()}_${file.name}`;
                fileType = file.name.split('.').pop();
                
                try {
                    const pinataResponse = await uploadToPinata(bufferData, fileName);
                    if (pinataResponse.success) {
                        fileUrl = pinataResponse.url;
                    } else {
                        console.error('Failed to upload file to Pinata');
                        return;
                    }
                } catch (error) {
                    console.error('Error uploading to Pinata:', error);
                    return;
                }
            }

            if (recipient && (text || fileUrl)) {
                const messageDoc = await Message.create({
                    sender: connection.userId,
                    recipient,
                    text,
                    file: fileUrl,
                    fileType: fileType
                });
                
                [...wss.clients]
                    .filter(client => client.userId === recipient || client.userId === connection.userId)
                    .forEach(client => {
                        client.send(JSON.stringify({
                            text,
                            sender: connection.userId,
                            recipient,
                            file: fileUrl,
                            fileType: fileType,
                            _id: messageDoc._id,
                        }));
                    });
            }
        }
    });

    connection.on('close', () => {
        connection.userId = null;
        connection.username = null;
        notifyAboutOnlinePeople();
    });
});
