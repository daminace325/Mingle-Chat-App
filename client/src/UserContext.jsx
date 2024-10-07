// import { createContext, useEffect, useState } from "react";
// import axios from "axios";

// export const UserContext = createContext({})


// export function UserContextProvider({ children }) {
//     const [username, setUsername] = useState(null)
//     const [id, setId] = useState(null)

//     useEffect(() => {
//         axios.get('/profile').then(res => {
//             setId(res.data.userId)
//             setUsername(res.data.username)
//         })
//     }, [])

//     return (
//         <UserContext.Provider value={{ username, setUsername, id, setId }}>
//             {children}
//         </UserContext.Provider>
//     )
// }

import { createContext, useEffect, useState } from "react";
import axios from "axios";

export const UserContext = createContext({})

export function UserContextProvider({ children }) {
    const [username, setUsername] = useState(null)
    const [id, setId] = useState(null)

    useEffect(() => {
        // Check if a token exists before making the profile request
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        
        if (token) {
            axios.get('/profile')
                .then(res => {
                    setId(res.data.userId)
                    setUsername(res.data.username)
                })
                .catch(err => {
                    if (err.response && err.response.status === 401) {
                        setId(null);
                        setUsername(null);
                    } else {
                        console.error('An error occurred:', err);
                    }
                });
        }
    }, [])
    
    return (
        <UserContext.Provider value={{ username, setUsername, id, setId }}>
            {children}
        </UserContext.Provider>
    )
}
