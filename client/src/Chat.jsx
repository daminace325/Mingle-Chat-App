import React, { useContext, useEffect, useRef, useState } from 'react';
import Logo from './Logo';
import { UserContext } from './UserContext';
import { uniqBy } from 'lodash';
import axios from 'axios';
import Contact from './Contact';

export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [selectedUserId, setSelectedUserId] = useState(null);
    const { username, id, setId, setUsername } = useContext(UserContext);
    const [newMessageText, setNewMessageText] = useState('');
    const [messages, setMessages] = useState([]);
    const divUnderMessages = useRef();
    const [showSidebar, setShowSidebar] = useState(false);

    const reconnectTimeout = useRef(1000); // Start with 1 second

    function showOnlinePeople(peopleArray) {
        const people = {};
        peopleArray.forEach(({ userId, username }) => {
            people[userId] = username;
        });
        setOnlinePeople(people);
    }

    function handleMessage(e) {
        const messageData = JSON.parse(e.data);
        
        if (messageData.online) {
            showOnlinePeople(messageData.online);
            // Update offline people when online list changes
            const onlineUserIds = messageData.online.map(user => user.userId);
            axios.get('/people').then(res => {
                const offlinePeopleArr = res.data
                    .filter(p => p._id !== id)
                    .filter(p => !onlineUserIds.includes(p._id));
                const offlinePeople = {};
                offlinePeopleArr.forEach(p => {
                    offlinePeople[p._id] = p;
                });
                setOfflinePeople(offlinePeople);
            });
        } else if (messageData.text || messageData.file) {
            setMessages(prev => [...prev, {
                ...messageData
            }]);
        }
    }

    useEffect(() => {
        connectToWs();
        return () => ws && ws.close(); // Cleanup on component unmount
    }, []);

    function connectToWs() {
        const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:3000');
        setWs(ws);

        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close', () => {
            console.log('Disconnected. Attempting to reconnect...');
            setTimeout(connectToWs, reconnectTimeout.current);
            reconnectTimeout.current = Math.min(reconnectTimeout.current * 2, 30000); // Cap at 30 seconds
        });
        ws.addEventListener('open', () => {
            console.log('Connected to WebSocket');
            reconnectTimeout.current = 1000; // Reset timeout on successful connection
        });
    }

    function logout() {
        if (ws) {
            // Send logout message before closing
            ws.send(JSON.stringify({ type: 'logout' }));
            const wsToClose = ws;
            setWs(null);
            wsToClose.close();
        }
        
        axios.post('/logout').then(() => {
            setId(null);
            setUsername(null);
            setSelectedUserId(null);
            setMessages([]);
            setOnlinePeople({});
            setOfflinePeople({});
            // Add window refresh after state updates
            window.location.reload();
        });
    }

    function sendMessage(e, file = null) {
        e && e.preventDefault();
        if (!ws || !selectedUserId) return;

        const message = {
            recipient: selectedUserId,
            text: newMessageText,
            file,
        };

        ws.send(JSON.stringify(message));
        if (!file) {
            setNewMessageText('');
        }
    }

    function sendFile(e) {
        const reader = new FileReader();
        reader.readAsDataURL(e.target.files[0]);
        reader.onload = () => {
            const fileData = {
                name: e.target.files[0].name,
                data: reader.result,
            };
            sendMessage(null, fileData);
        };
    }

    useEffect(() => {
        if (selectedUserId) {
            axios.get(`/messages/${selectedUserId}`).then(res => {
                setMessages(res.data);
            });
        }
    }, [selectedUserId]);

    useEffect(() => {
        axios.get('/people').then(res => {
            const offlinePeopleArr = res.data
                .filter(p => p._id !== id)
                .filter(p => !Object.keys(onlinePeople).includes(p._id));
            const offlinePeople = {};
            offlinePeopleArr.forEach(p => {
                offlinePeople[p._id] = p;
            });
            setOfflinePeople(offlinePeople);
        });
    }, [onlinePeople]);

    useEffect(() => {
        if (divUnderMessages.current) {
            divUnderMessages.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [messages]);

    const messagesWithoutDupes = uniqBy(messages, '_id');
    const onlinePeopleExcOurUser = { ...onlinePeople };
    delete onlinePeopleExcOurUser[id];

    return (
        <div className="flex flex-col sm:flex-row h-screen bg-gradient-to-br from-sky-50 to-sky-100">
            {/* Sidebar */}
            <div className={`
                fixed sm:static inset-0 bg-gradient-to-b from-sky-800 to-sky-900
                w-3/4 sm:w-1/3 md:w-1/4 py-2 sm:py-4 px-2 sm:px-4 
                flex flex-col shadow-xl z-40 transition-transform duration-300
                ${showSidebar ? 'translate-x-0' : '-translate-x-full'} 
                sm:translate-x-0
            `}>
                {/* Close button for mobile */}
                <button 
                    onClick={() => setShowSidebar(false)}
                    className="sm:hidden absolute top-4 right-4 text-white hover:text-sky-200"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="flex-grow mt-8 sm:mt-0">
                    <Logo />
                    <div className="px-2 sm:px-4 mb-4 sm:mb-6">
                        <div className="mt-2 text-sky-200 text-xs sm:text-sm">
                            Connect and chat with friends
                        </div>
                    </div>
                    
                    <div className="mb-4 sm:mb-8 space-y-2 sm:space-y-4">
                        <h2 className="text-white font-semibold text-xl px-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            Online Users
                        </h2>
                        <div className="space-y-2">
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
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <h2 className="text-white font-semibold text-xl px-4 flex items-center gap-2">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            Offline Users
                        </h2>
                        <div className="space-y-2">
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
                    </div>
                </div>
                
                <div className="p-2 sm:p-4 mx-2 sm:mx-4 bg-gradient-to-r from-sky-900 to-sky-800 rounded-xl shadow-lg border border-sky-700/50">
                    <span className="text-white flex items-center gap-2 mb-3 bg-sky-800/50 p-2 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                        </svg>
                        <span className="font-medium">{username}</span>
                    </span>
                    <button 
                        onClick={logout} 
                        className="bg-gradient-to-r from-red-500 to-red-600 text-white py-2 px-4 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 w-full font-medium shadow-lg"
                    >
                        Logout
                    </button>
                </div>
            </div>

            {/* Overlay for mobile */}
            {showSidebar && (
                <div 
                    className="fixed inset-0 bg-black/50 z-30 sm:hidden"
                    onClick={() => setShowSidebar(false)}
                ></div>
            )}

            {/* Chat Area - Now full width on mobile */}
            <div className="flex flex-col w-full sm:w-2/3 md:w-3/4 p-2 sm:p-6 h-[calc(100vh-4rem)] sm:h-auto">
                <div className="flex-grow">
                    {!selectedUserId && (
                        <div className="flex h-full flex-col items-center justify-center">
                            <div className="text-sky-800 text-2xl sm:text-4xl mb-2 sm:mb-4 font-bold text-center">
                                Welcome to Mingle! 👋
                            </div>
                            <div className="text-sky-600 text-base sm:text-xl bg-white/50 backdrop-blur-sm p-3 sm:p-4 rounded-xl shadow-lg text-center">
                                Select a person from the sidebar to start chatting
                            </div>
                        </div>
                    )}
                    {selectedUserId && (
                        <div className="relative h-full bg-white/80 backdrop-blur-sm rounded-xl shadow-xl border border-sky-100">
                            <div className="absolute top-0 left-0 right-0 p-2 sm:p-4 bg-gradient-to-r from-sky-100 to-sky-50 border-b border-sky-200 rounded-t-xl">
                                <span className="font-bold text-sky-900 flex items-center gap-3">
                                    <button 
                                        onClick={() => setShowSidebar(!showSidebar)}
                                        className="sm:hidden p-1.5 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                        </svg>
                                    </button>
                                    <div className={`w-2 h-2 rounded-full ${onlinePeople[selectedUserId] ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                    {onlinePeople[selectedUserId] || offlinePeople[selectedUserId]?.username}
                                </span>
                            </div>
                            <div className="overflow-y-scroll absolute top-12 sm:top-16 left-0 right-0 bottom-2 p-2 sm:p-4">
                                {messagesWithoutDupes.map(message => (
                                    <div key={message._id} className={message.sender === id ? 'text-right' : 'text-left'}>
                                        <div className={`inline-block p-3 my-2 rounded-xl text-sm max-w-[80%] shadow-md ${
                                            message.sender === id 
                                                ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white rounded-br-none' 
                                                : 'bg-white text-sky-900 rounded-bl-none'
                                        }`}>
                                            {message.text}
                                            {message.file && (
                                                <div className="mt-2">
                                                    <a
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 underline underline-offset-2 opacity-90 hover:opacity-100"
                                                        href={message.file}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                            <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z" clipRule="evenodd" />
                                                        </svg>
                                                        {message.fileType ? `View ${message.fileType.toUpperCase()} File` : 'View File'}
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
                {selectedUserId && (
                    <form className="flex gap-1 sm:gap-2 mt-2 sm:mt-4" onSubmit={sendMessage}>
                        <input
                            type="text"
                            value={newMessageText}
                            onChange={e => setNewMessageText(e.target.value)}
                            placeholder="Type your message here..."
                            className="bg-white/80 backdrop-blur-sm rounded-xl flex-grow border border-sky-100 p-2 sm:p-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-sky-400 shadow-lg"
                        />
                        <label className="bg-white/80 backdrop-blur-sm p-3 rounded-xl cursor-pointer hover:bg-sky-50 transition-colors border border-sky-100 shadow-lg">
                            <input type="file" className="hidden" onChange={sendFile} />
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-sky-600">
                                <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z" clipRule="evenodd" />
                            </svg>
                        </label>
                        <button
                            type="submit"
                            className="bg-gradient-to-r from-sky-500 to-sky-600 p-3 text-white rounded-xl hover:from-sky-600 hover:to-sky-700 transition-all duration-200 shadow-lg"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
