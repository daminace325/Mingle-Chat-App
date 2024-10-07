import React, { useContext, useEffect, useRef, useState } from 'react'
import Logo from './Logo';
import { UserContext } from './UserContext';
import { uniqBy } from 'lodash'
import axios from 'axios';
import Contact from './Contact';

export default function Chat() {
    const [ws, setWs] = useState(null)
    const [onlinePeople, setOnlinePeople] = useState({})
    const [offlinePeople, setOfflinePeople] = useState({})
    const [selectedUserId, setSelectedUserId] = useState(null)
    const { username, id, setId, setUsername } = useContext(UserContext)
    const [newMessageText, setNewMessageText] = useState('')
    const [messages, setMessages] = useState([])
    const divUnderMessages = useRef()

    function showOnlinePeople(peopleArray) {
        const people = {}

        peopleArray.forEach(({ userId, username }) => {
            people[userId] = username
        });
        setOnlinePeople(people)
    }

    function handleMessage(e) {
        const messageData = JSON.parse(e.data)
        console.log({ e, messageData });

        if ('online' in messageData) {
            showOnlinePeople(messageData.online)
        } else if ('text' in messageData) {
            if (messageData.sender === selectedUserId) {
                setMessages(prev => ([...prev, { ...messageData }]))
            }
        }
    }

    useEffect(() => {
        connectToWs()
    }, [])

    function logout() {
        axios.post('/logout').then(() => {
            setWs(null)
            setId(null)
            setUsername(null)
        })
    }

    function connectToWs() {
        const ws = new WebSocket('ws://localhost:3000')
        setWs(ws)
        ws.addEventListener('message', handleMessage)
        ws.addEventListener('close', () => {
            setTimeout(() => {
                console.log('Disconnected. Trying to Reconnect');
                connectToWs()
            }, 1000);
        })
    }


    const onlinePeopleExcOurUser = { ...onlinePeople }
    delete onlinePeopleExcOurUser[id]

    function sendMessage(e, file = null) {
        if (e) e.preventDefault()
        ws.send(JSON.stringify({
            recipient: selectedUserId,
            text: newMessageText,
            file
        }))
        if (file) {
            axios.get(`/messages/${selectedUserId}`).then(res => {
                setMessages(res.data)
            })
        } else {
            setNewMessageText('')
            setMessages(prev => ([...prev, {
                text: newMessageText,
                sender: id,
                recipient: selectedUserId,
                _id: Date.now()
            }]))
        }
    }

    function sendFile(e) {
        const reader = new FileReader()
        reader.readAsDataURL(e.target.files[0])
        reader.onload = () => {
            sendMessage(null, {
                name: e.target.files[0].name,
                data: reader.result
            })
        }
    }

    useEffect(() => {
        const div = divUnderMessages.current
        if (div) {
            div.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
    }, [messages])

    useEffect(() => {
        if (selectedUserId) {
            axios.get(`/messages/${selectedUserId}`).then(res => {
                setMessages(res.data)
            })
        }
    }, [selectedUserId]);

    useEffect(() => {
        axios.get('/people').then(res => {
            const offlinePeopleArr = res.data
                .filter(p => p._id !== id)
                .filter(p => !Object.keys(onlinePeople).includes(p._id))
            const offlinePeople = {}
            offlinePeopleArr.forEach(p => {
                offlinePeople[p._id] = p
            })
            setOfflinePeople(offlinePeople)
        })
    }, [onlinePeople])


    const messagesWithoutDupes = uniqBy(messages, '_id')

    return (
        <div className='flex h-screen'>
            <div className="bg-white w-1/3 py-4 pl-4 flex flex-col">
                <div className='flex-grow'>
                    <Logo />
                    {Object.keys(onlinePeopleExcOurUser).map(userId => (
                        <Contact
                            key={userId}
                            id={userId}
                            online={true}
                            username={onlinePeopleExcOurUser[userId]}
                            onClick={() => setSelectedUserId(userId)}
                            selected={userId === selectedUserId}
                        />
                    ))}
                    {Object.keys(offlinePeople).map(userId => (
                        <Contact
                            key={userId}
                            id={userId}
                            online={false}
                            username={offlinePeople[userId].username}
                            onClick={() => setSelectedUserId(userId)}
                            selected={userId === selectedUserId}
                        />
                    ))}
                </div>
                <div className='pr-4 flex justify-around items-center'>
                    <span className='text-sm text-gray-600 flex items-center'>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
                        </svg>
                        {username}
                    </span>
                    <button
                        onClick={logout}
                        className='text-sm text-gray-500 bg-blue-200 p-2 border rounded-md'>
                        LogOut
                    </button>
                </div>
            </div>
            <div className="flex flex-col bg-blue-50 w-2/3 p-2">
                <div className='flex-grow'>
                    {!selectedUserId && (
                        <div className='flex h-full items-center justify-center'>
                            <div className='text-gray-400 text-2xl'>
                                Select a Person and Start a Conversation!
                            </div>
                        </div>
                    )}
                    {selectedUserId && (
                        <div className='relative h-full'>
                            <div className='overflow-y-scroll absolute top-0 left-0 right-0 bottom-2'>
                                {messagesWithoutDupes.map(message => (
                                    <div key={message._id} className={`${message.sender === id ? 'text-right' : 'text-left'}`}>
                                        <div className={`text-left inline-block p-2 my-2 rounded-lg text-sm ${message.sender === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-600'}`}>
                                            {message.text}
                                            {message.file && (
                                                <div className=''>
                                                    <a target='_blank' className='flex items-center gap-1 border-b border-gray-600' href={axios.defaults.baseURL + '/uploads/' + message.file}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                                                            <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 0 1 5.91 15.66l7.81-7.81a.75.75 0 0 1 1.061 1.06l-7.81 7.81a.75.75 0 0 0 1.054 1.068L18.97 6.84a2.25 2.25 0 0 0 0-3.182Z" clipRule="evenodd" />
                                                        </svg>
                                                        {message.file}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={divUnderMessages}></div>
                            </div>
                        </div>
                    )}
                </div>
                {selectedUserId && (<form className='flex gap-2' onSubmit={sendMessage}>
                    <input
                        type="text"
                        value={newMessageText}
                        onChange={e => setNewMessageText(e.target.value)}
                        name=""
                        placeholder='Type your Message'
                        id=""
                        className='bg-white rounded-sm flex-grow border p-2' />
                    <label className='bg-blue-100 p-2 rounded-sm cursor-pointer text-gray-600 border border-blue-200'>
                        <input type="file" className='hidden' onChange={sendFile} />
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6">
                            <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 0 0-3.182 0l-10.94 10.94a3.75 3.75 0 1 0 5.304 5.303l7.693-7.693a.75.75 0 0 1 1.06 1.06l-7.693 7.693a5.25 5.25 0 1 1-7.424-7.424l10.939-10.94a3.75 3.75 0 1 1 5.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 0 1 5.91 15.66l7.81-7.81a.75.75 0 0 1 1.061 1.06l-7.81 7.81a.75.75 0 0 0 1.054 1.068L18.97 6.84a2.25 2.25 0 0 0 0-3.182Z" clipRule="evenodd" />
                        </svg>
                    </label>
                    <button type='submit' className='bg-blue-500 p-2 rounded-sm text-white'>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                        </svg>
                    </button>
                </form>)}
            </div>
        </div>
    )
}
