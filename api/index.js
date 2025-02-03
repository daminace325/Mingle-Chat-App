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
app.use('/uploads', express.static(__dirname + '/uploads'))
app.use(express.json())
app.use(cookieParser())
app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL
}))
const jwtSecret = process.env.JWT_SECRET
const bcryptSalt = bcrypt.genSaltSync(10)

app.get('/test', (req, res) => {
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


app.get('/messages/:userId', async (req, res) => {
    const { userId } = req.params
    const userData = await getUserDataFromRequest(req)
    const ourUserId = userData.userId
    const messages = await Message.find({
        sender: { $in: [userId, ourUserId] },
        recipient: { $in: [userId, ourUserId] },
    }).sort({ createdAt: 1 })
    res.json(messages)
});


app.get('/people', async (req, res) => {
    const users = await User.find({}, { '_id': 1, username: 1 })
    res.json(users)
})


app.get('/profile', (req, res) => {
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
    res.cookie('token', '', { sameSite: 'none', secure: true }).json('OK')
})

app.post('/register', async (req, res) => {
    const { username, password } = req.body
    try {
        const hashedPassword = bcrypt.hashSync(password, bcryptSalt)
        const createdUser = await User.create({
            username: username,
            password: hashedPassword
        })
        jwt.sign({ userId: createdUser._id, username }, jwtSecret, {}, (err, token) => {
            if (err) throw err
            res.cookie('token', token, { sameSite: 'none', secure: true }).status(201).json({
                id: createdUser._id,
            })
        })
    } catch (error) {
        if (error) throw error
        res.status(500).json('error')
    }
})

const server = app.listen(3000)

const wss = new ws.WebSocketServer({ server })

wss.on('connection', (connection, req) => {
    function notifyAboutOnlinePeople() {
        const validClients = Array.from(wss.clients).filter(client => 
            client.userId && 
            client.username && 
            client.readyState === ws.OPEN
        );
        
        validClients.forEach(client => {
            client.send(JSON.stringify({
                online: validClients.map(c => ({
                    userId: c.userId,
                    username: c.username
                }))
            }));
        });
    }

    // Read username and id from the cookie for this connection
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookieString = cookies.split('; ').find(str => str.startsWith('token='));
        if (tokenCookieString) {
            const token = tokenCookieString.split('=')[1];
            if (token) {
                jwt.verify(token, jwtSecret, {}, (err, userData) => {
                    if (err) throw err;
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
