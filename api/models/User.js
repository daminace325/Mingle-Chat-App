const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 30,
        index: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    }
}, {timestamps: true})


const UserModel = mongoose.model('User', UserSchema)

module.exports = UserModel