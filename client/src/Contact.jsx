import React from 'react'
import Avatar from './Avatar'

export default function Contact({id, username, onClick, selected, online}) {
    return (
        <div onClick={() => onClick(id)}
            className={`mb-2 flex items-center gap-2 cursor-pointer hover:bg-gray-700 rounded-lg p-2 transition-colors ${
                selected ? 'bg-gray-700' : ''
            }`}
        >
            <Avatar online={online} username={username} userId={id} />
            <span className={`text-gray-300 ${selected ? 'font-semibold' : ''}`}>
                {username}
            </span>
            {online && (
                <div className="ml-auto">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>
            )}
        </div>
    )
}
