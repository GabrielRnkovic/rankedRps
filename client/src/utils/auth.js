export const setToken = (token) => {
    localStorage.setItem('token', token);
};

export const getToken = () => {
    return localStorage.getItem('token');
};

export const removeToken = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
};

export const verifyToken = async () => {
    const token = getToken();
    if (!token) return null;

    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';

    try {
        const response = await fetch(`${apiUrl}/api/verify-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token })
        });

        if (!response.ok) {
            throw new Error('Token verification failed');
        }

        const data = await response.json();
        if (data.valid && data.data) {
            setToken(data.data.token); // Update with new token
            localStorage.setItem('username', data.data.username);
            return data.data;
        }
        
        removeToken();
        return null;
    } catch (error) {
        console.error('Token verification failed:', error);
        removeToken();
        return null;
    }
};
