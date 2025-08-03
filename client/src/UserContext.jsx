import { createContext, useEffect, useState } from "react";
import axios from "axios";

export const UserContext = createContext({})

export function UserContextProvider({ children }) {
    const [username, setUsername] = useState(null)
    const [id, setId] = useState(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        
        if (token) {
            // Add timeout for profile fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            axios.get('/profile', { signal: controller.signal })
                .then(res => {
                    setId(res.data.userId)
                    setUsername(res.data.username)
                })
                .catch(err => {
                    if (err.name === 'AbortError') {
                        console.warn('Profile fetch timed out');
                    } else if (err.response && err.response.status === 401) {
                        setId(null);
                        setUsername(null);
                    } else {
                        console.error('Profile fetch error:', err);
                    }
                })
                .finally(() => {
                    clearTimeout(timeoutId);
                    setIsLoading(false);
                });
        } else {
            setIsLoading(false);
        }
    }, [])
    
    return (
        <UserContext.Provider value={{ username, setUsername, id, setId, isLoading }}>
            {children}
        </UserContext.Provider>
    )
}
