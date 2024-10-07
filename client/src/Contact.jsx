import React from 'react'
import Avatar from './Avatar'

export default function Contact({id,username, onClick, selected, online}) {
    return (
        <div onClick={() => onClick(id)}
            key={id}
            className={`border-b mb-2 flex items-center gap-2 cursor-pointer ${selected ? 'bg-blue-100' : ''}`}>
            {selected && (
                <div className='w-1 bg-blue-500 h-14 rounded-r-sm'>
                </div>
            )}
            <div className='flex gap-2 items-center p-3'>
                <Avatar online={online} username={username} userId={id} />
                <span className='text-gray-800'>
                    {username}
                </span>
            </div>
        </div>
    )
}
