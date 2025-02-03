import { useContext, useState, useEffect } from "react";
import { UserContext } from "./UserContext";
import axios from "axios";
import Logo from "./Logo";

export default function RegisterAndLoginForm() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginOrRegister, setIsLoginOrRegister] = useState('login');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setUsername: setLoggedInUsername, setId } = useContext(UserContext);

    // Clear error after 5 seconds
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const url = isLoginOrRegister === 'register' ? 'register' : 'login';
            const { data } = await axios.post(url, { username, password });
            setLoggedInUsername(username);
            setId(data.id);
        } catch (error) {
            if (error.response) {
                setError(error.response.data);
            } else {
                setError('An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className='bg-gradient-to-r from-sky-300 to-sky-500 min-h-screen flex items-center justify-center p-2 sm:p-4'>
            <div className='bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl p-4 sm:p-8 w-full max-w-md mx-2'>
                <div className='flex justify-center mb-4 sm:mb-8'>
                    <Logo />
                </div>
                <h1 className='text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 text-sky-900'>
                    {isLoginOrRegister === 'register' ? 'Create Account' : 'Welcome Back'}
                </h1>
                
                <form onSubmit={handleSubmit} className='space-y-3 sm:space-y-4'>
                    {error && (
                        <div className='bg-red-100 text-red-600 p-2 sm:p-3 rounded-lg text-center text-sm sm:text-base animate-fade-in'>
                            {error}
                        </div>
                    )}
                    <input 
                        value={username} 
                        onChange={e => setUsername(e.target.value)}
                        type="text" 
                        placeholder='Username'
                        disabled={loading}
                        className='block w-full rounded-lg p-2.5 sm:p-3 border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400 transition text-sm sm:text-base' 
                    />
                    <input 
                        value={password} 
                        onChange={e => setPassword(e.target.value)}
                        type="password" 
                        placeholder='Password'
                        disabled={loading}
                        className='block w-full rounded-lg p-2.5 sm:p-3 border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400 transition text-sm sm:text-base' 
                    />
                    <button 
                        disabled={loading}
                        className='bg-sky-500 text-white block w-full rounded-lg p-2.5 sm:p-3 hover:bg-sky-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm sm:text-base'
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </span>
                        ) : (
                            isLoginOrRegister === 'register' ? 'Register' : 'Login'
                        )}
                    </button>
                </form>

                <div className='text-center mt-4 sm:mt-6 text-sky-900 text-sm sm:text-base'>
                    {isLoginOrRegister === 'register' ? (
                        <div>
                            Already have an account?{' '}
                            <button 
                                onClick={() => setIsLoginOrRegister('login')}
                                className='text-sky-600 hover:underline font-medium'
                            >
                                Login here
                            </button>
                        </div>
                    ) : (
                        <div>
                            New to Mingle?{' '}
                            <button 
                                onClick={() => setIsLoginOrRegister('register')}
                                className='text-sky-600 hover:underline font-medium'
                            >
                                Create an account
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
